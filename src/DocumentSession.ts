import * as vscode from "vscode";
import { findNodeAtLocation, parseTree, printParseErrorCode } from "jsonc-parser";
import type { Node as JsonNode, ParseError } from "jsonc-parser";
import { isDag, validateDag } from "./model/DagModel";
import type { Dag, DagValidationIssue } from "./model/DagModel";
import type { DocumentMessage, UpdateDocumentMessage, UpdateResultMessage } from "./model/messages";
import { DIAGNOSTIC_SOURCE } from "./constants";
import { getDagTextUpdate } from "./utilities/getDagTextUpdate";
import { getMinimalTextReplacement } from "./utilities/getMinimalTextReplacement";

export class DocumentSession implements vscode.Disposable {
  private readonly webviews = new Set<vscode.Webview>();
  private readonly state: DocumentState;
  private writeQueue = Promise.resolve();
  private analysis: DocumentAnalysis | undefined;
  private lastParseErrorText: string | undefined;

  constructor(
    readonly document: vscode.TextDocument,
    private readonly diagnostics: vscode.DiagnosticCollection
  ) {
    this.state = {
      revision: 0,
      documentVersion: document.version,
      applyingEdit: false,
    };
  }

  addWebview(webview: vscode.Webview): void {
    this.webviews.add(webview);
    void this.sendDocument(webview);
  }

  removeWebview(webview: vscode.Webview): void {
    this.webviews.delete(webview);
  }

  handleDocumentChange(): void {
    void this.broadcastDocument();
  }

  handleMessage(message: UpdateDocumentMessage, webview: vscode.Webview): void {
    const nextWrite = this.writeQueue
      .catch(() => undefined)
      .then(() => this.applyUpdate(message, webview));
    this.writeQueue = nextWrite;
    void nextWrite.catch((error: unknown) => {
      void vscode.window.showErrorMessage(getErrorMessage(error));
    });
  }

  dispose(): void {
    this.webviews.clear();
    this.diagnostics.delete(this.document.uri);
  }

  private async broadcastDocument(): Promise<void> {
    if (this.webviews.size === 0) {
      return;
    }
    const message = this.createDocumentMessage();
    if (!message) {
      return;
    }
    await Promise.all(Array.from(this.webviews, (webview) => webview.postMessage(message)));
  }

  private async sendDocument(webview: vscode.Webview): Promise<void> {
    const message = this.createDocumentMessage();
    if (message) {
      await webview.postMessage(message);
    }
  }

  private createDocumentMessage(): DocumentMessage | undefined {
    const dag = this.analyzeDocument();
    if (!dag) {
      return undefined;
    }
    this.synchronizeState();
    return {
      type: "document",
      dag,
      revision: this.state.revision,
      originEditorId: getDocumentOrigin(this.state, this.document.version),
    };
  }

  private analyzeDocument(): Dag | undefined {
    if (this.analysis?.documentVersion === this.document.version) {
      return this.analysis.dag;
    }

    const text = this.document.getText();
    try {
      const dag = parseDocument(text);
      this.lastParseErrorText = undefined;
      this.updateSemanticDiagnostics(text, validateDag(dag));
      this.analysis = { documentVersion: this.document.version, dag };
      return dag;
    } catch (error) {
      this.updateInvalidDocumentDiagnostics(text, error);
      this.analysis = { documentVersion: this.document.version };
      if (this.lastParseErrorText !== text) {
        this.lastParseErrorText = text;
        void vscode.window.showErrorMessage(getErrorMessage(error));
      }
      return undefined;
    }
  }

  private async applyUpdate(
    message: UpdateDocumentMessage,
    webview: vscode.Webview
  ): Promise<void> {
    this.synchronizeState();
    if (message.baseRevision !== this.state.revision) {
      void vscode.window.showWarningMessage(
        "The DAG changed in another editor. The latest document has been reloaded."
      );
      try {
        if (message.persist) {
          await this.saveTextDocument();
        }
        const result: UpdateResultMessage = {
          type: "updateResult",
          status: "conflict",
          requestId: message.requestId,
          revision: this.state.revision,
          dag: parseDocument(this.document.getText()),
        };
        await webview.postMessage(result);
      } catch (error) {
        await postErrorResult(webview, message, this.state.revision, false);
        void vscode.window.showErrorMessage(getErrorMessage(error));
      }
      return;
    }

    const previousRevision = this.state.revision;
    const startingDocumentVersion = this.document.version;
    const nextText = getDagTextUpdate(this.document.getText(), message.dag);
    let documentAccepted = nextText === undefined;
    this.state.applyingEdit = true;
    this.state.revisionReserved = nextText !== undefined;
    if (this.state.revisionReserved) {
      this.state.revision += 1;
    }
    this.state.activeEditorId = message.editorId;
    try {
      if (nextText !== undefined) {
        await this.updateTextDocument(nextText);
        documentAccepted = true;
      }
      if (message.persist) {
        await this.saveTextDocument();
      }
      this.state.documentVersion = this.document.version;
      if (this.document.version !== startingDocumentVersion) {
        this.state.lastOriginEditorId = message.editorId;
        this.state.lastOriginDocumentVersion = this.document.version;
      }
      await postAcceptedResult(webview, message, this.state.revision);
    } catch (error) {
      if (!documentAccepted) {
        this.state.revision = previousRevision;
      }
      await postErrorResult(webview, message, this.state.revision, documentAccepted);
      throw error;
    } finally {
      this.state.applyingEdit = false;
      this.state.revisionReserved = false;
      this.state.activeEditorId = undefined;
    }
  }

  private synchronizeState(): void {
    if (this.state.documentVersion === this.document.version) {
      return;
    }

    this.state.documentVersion = this.document.version;
    if (this.state.applyingEdit) {
      if (!this.state.revisionReserved) {
        this.state.revision += 1;
        this.state.revisionReserved = true;
      }
    } else {
      this.state.revision += 1;
      this.state.lastOriginEditorId = undefined;
      this.state.lastOriginDocumentVersion = undefined;
    }
  }

  private updateSemanticDiagnostics(text: string, issues: DagValidationIssue[]): void {
    const root = parseTree(text);
    const diagnostics = issues.map((issue) => {
      const node = root ? findNodeAtLocation(root, issue.location) : undefined;
      const diagnostic = new vscode.Diagnostic(
        getNodeRange(this.document, node),
        issue.message,
        vscode.DiagnosticSeverity.Warning
      );
      diagnostic.code = issue.code;
      diagnostic.source = DIAGNOSTIC_SOURCE;
      return diagnostic;
    });
    this.diagnostics.set(this.document.uri, diagnostics);
  }

  private updateInvalidDocumentDiagnostics(text: string, error: unknown): void {
    const parseErrors: ParseError[] = [];
    parseTree(text, parseErrors, { allowTrailingComma: false, disallowComments: true });
    const diagnostics = parseErrors.map((parseError) => {
      const range = new vscode.Range(
        this.document.positionAt(parseError.offset),
        this.document.positionAt(parseError.offset + Math.max(parseError.length, 1))
      );
      const diagnostic = new vscode.Diagnostic(
        range,
        `Invalid JSON: ${printParseErrorCode(parseError.error)}.`,
        vscode.DiagnosticSeverity.Error
      );
      diagnostic.source = DIAGNOSTIC_SOURCE;
      return diagnostic;
    });

    if (diagnostics.length === 0) {
      const diagnostic = new vscode.Diagnostic(
        getDocumentRange(this.document),
        getErrorMessage(error),
        vscode.DiagnosticSeverity.Error
      );
      diagnostic.source = DIAGNOSTIC_SOURCE;
      diagnostics.push(diagnostic);
    }
    this.diagnostics.set(this.document.uri, diagnostics);
  }

  private async updateTextDocument(nextText: string): Promise<void> {
    const currentText = this.document.getText();
    if (currentText === nextText) {
      return;
    }

    const replacement = getMinimalTextReplacement(currentText, nextText);
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      this.document.uri,
      new vscode.Range(
        this.document.positionAt(replacement.startOffset),
        this.document.positionAt(replacement.endOffset)
      ),
      replacement.text
    );
    if (!(await vscode.workspace.applyEdit(edit))) {
      throw new Error("Could not update the DAG document.");
    }
  }

  private async saveTextDocument(): Promise<void> {
    if (!(await this.document.save())) {
      throw new Error("Could not save the DAG document.");
    }
  }
}

interface DocumentState {
  revision: number;
  documentVersion: number;
  applyingEdit: boolean;
  revisionReserved?: boolean;
  activeEditorId?: string;
  lastOriginEditorId?: string;
  lastOriginDocumentVersion?: number;
}

interface DocumentAnalysis {
  documentVersion: number;
  dag?: Dag;
}

function parseDocument(text: string): Dag {
  if (text.trim().length === 0) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("DAG document is not valid JSON.");
  }

  if (!isDag(parsed)) {
    throw new Error("DAG document has an invalid structure.");
  }
  return parsed;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Could not read the DAG document.";
}

function getNodeRange(document: vscode.TextDocument, node: JsonNode | undefined): vscode.Range {
  if (!node) {
    return getDocumentRange(document);
  }
  return new vscode.Range(
    document.positionAt(node.offset),
    document.positionAt(node.offset + Math.max(node.length, 1))
  );
}

function getDocumentRange(document: vscode.TextDocument): vscode.Range {
  return new vscode.Range(
    new vscode.Position(0, 0),
    document.positionAt(document.getText().length)
  );
}

function getDocumentOrigin(state: DocumentState, documentVersion: number): string | undefined {
  if (state.applyingEdit) {
    return state.activeEditorId;
  }
  return state.lastOriginDocumentVersion === documentVersion ? state.lastOriginEditorId : undefined;
}

async function postAcceptedResult(
  webview: vscode.Webview,
  message: UpdateDocumentMessage,
  revision: number
): Promise<void> {
  const result: UpdateResultMessage = {
    type: "updateResult",
    status: "accepted",
    requestId: message.requestId,
    revision,
  };
  await webview.postMessage(result);
}

async function postErrorResult(
  webview: vscode.Webview,
  message: UpdateDocumentMessage,
  revision: number,
  accepted: boolean
): Promise<void> {
  const result: UpdateResultMessage = {
    type: "updateResult",
    status: "error",
    requestId: message.requestId,
    revision,
    accepted,
  };
  await webview.postMessage(result);
}
