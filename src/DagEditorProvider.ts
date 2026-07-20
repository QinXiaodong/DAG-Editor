import * as vscode from "vscode";
import { DAG_EDITOR_VIEW_TYPE, NEW_DAG_COMMAND, SAVE_DAG_COMMAND } from "./constants";
import { DocumentSession } from "./DocumentSession";
import {
  isCopyNodesMessage,
  isCopyUdfsMessage,
  isCutNodesMessage,
  isCutUdfsMessage,
  isNodeClipboardPayload,
  isPasteNodesRequestMessage,
  isPasteUdfsRequestMessage,
  isUdfClipboardPayload,
  isUpdateDocumentMessage,
} from "./model/messages";
import type {
  ClipboardNodesMessage,
  ClipboardUdfsMessage,
  CopyNodesMessage,
  CopyUdfsMessage,
  CutNodesCompleteMessage,
  CutNodesMessage,
  CutUdfsCompleteMessage,
  CutUdfsMessage,
  NodeClipboardPayload,
  UdfClipboardPayload,
} from "./model/messages";
import { getWebviewContent } from "./webview/getWebviewContent";

export class DagEditorProvider implements vscode.CustomTextEditorProvider {
  private static newDagFileId = 1;
  private readonly sessions = new Map<string, DocumentSession>();
  private readonly diagnostics = vscode.languages.createDiagnosticCollection(DAG_EDITOR_VIEW_TYPE);
  private readonly disposables: vscode.Disposable[];
  private activeWebview: vscode.Webview | undefined;

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new DagEditorProvider(context);
    const commandRegistration = vscode.commands.registerCommand(NEW_DAG_COMMAND, async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage(
          "Creating new DAG files currently requires opening a workspace"
        );
        return;
      }

      const uri = vscode.Uri.joinPath(
        workspaceFolder.uri,
        `Untitled-${DagEditorProvider.newDagFileId++}.dag.json`
      ).with({ scheme: "untitled" });
      await vscode.commands.executeCommand("vscode.openWith", uri, DAG_EDITOR_VIEW_TYPE);
    });
    const saveRegistration = vscode.commands.registerCommand(SAVE_DAG_COMMAND, () => {
      provider.requestSave();
    });
    const editorRegistration = vscode.window.registerCustomEditorProvider(
      DAG_EDITOR_VIEW_TYPE,
      provider,
      {
        webviewOptions: { enableFindWidget: true, retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: true,
      }
    );

    return vscode.Disposable.from(
      commandRegistration,
      saveRegistration,
      editorRegistration,
      provider
    );
  }

  constructor(private readonly context: vscode.ExtensionContext) {
    this.disposables = [
      vscode.workspace.onDidChangeTextDocument((event) => {
        this.sessions.get(event.document.uri.toString())?.handleDocumentChange();
      }),
      vscode.workspace.onDidCloseTextDocument((document) => {
        const key = document.uri.toString();
        this.sessions.get(key)?.dispose();
        this.sessions.delete(key);
      }),
    ];
  }

  dispose(): void {
    for (const session of this.sessions.values()) {
      session.dispose();
    }
    this.sessions.clear();
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.diagnostics.dispose();
  }

  resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel): void {
    const { webview } = webviewPanel;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "out"),
        vscode.Uri.joinPath(this.context.extensionUri, "media"),
      ],
    };
    webview.html = getWebviewContent(webview, this.context.extensionUri);

    if (webviewPanel.active) {
      this.activeWebview = webview;
    }

    const key = document.uri.toString();
    const session = this.getOrCreateSession(key, document);
    session.addWebview(webview);

    const subscriptions = [
      webviewPanel.onDidChangeViewState((event) => {
        if (event.webviewPanel.active) {
          this.activeWebview = webview;
        }
      }),
      webview.onDidReceiveMessage((message: unknown) => {
        if (isUpdateDocumentMessage(message)) {
          session.handleMessage(message, webview);
        } else if (isCopyNodesMessage(message)) {
          void this.copyNodesToClipboard(message);
        } else if (isCutNodesMessage(message)) {
          void this.cutNodesToClipboard(message, webview);
        } else if (isCopyUdfsMessage(message)) {
          void this.copyUdfsToClipboard(message);
        } else if (isCutUdfsMessage(message)) {
          void this.cutUdfsToClipboard(message, webview);
        } else if (isPasteNodesRequestMessage(message)) {
          void this.pasteNodesFromClipboard(webview);
        } else if (isPasteUdfsRequestMessage(message)) {
          void this.pasteUdfsFromClipboard(webview);
        }
      }),
    ];

    webviewPanel.onDidDispose(() => {
      if (this.activeWebview === webview) {
        this.activeWebview = undefined;
      }
      session.removeWebview(webview);
      for (const subscription of subscriptions) {
        subscription.dispose();
      }
    });
  }

  private getOrCreateSession(key: string, document: vscode.TextDocument): DocumentSession {
    const existing = this.sessions.get(key);
    if (existing) {
      return existing;
    }

    const session = new DocumentSession(document, this.diagnostics);
    this.sessions.set(key, session);
    return session;
  }

  private requestSave(): void {
    void this.activeWebview?.postMessage({ type: "requestSave" });
  }

  private async copyNodesToClipboard(message: CopyNodesMessage): Promise<void> {
    try {
      await this.writeNodesToClipboard(message.nodes);
    } catch {
      void vscode.window.showWarningMessage("Failed to copy DAG nodes.");
    }
  }

  private async cutNodesToClipboard(
    message: CutNodesMessage,
    webview: vscode.Webview
  ): Promise<void> {
    try {
      await this.writeNodesToClipboard(message.nodes);
      const completeMessage: CutNodesCompleteMessage = {
        type: "cutNodesComplete",
        nodeIds: message.nodes.map((node) => node.name),
      };
      await webview.postMessage(completeMessage);
    } catch {
      void vscode.window.showWarningMessage("Failed to cut DAG nodes.");
    }
  }

  private async copyUdfsToClipboard(message: CopyUdfsMessage): Promise<void> {
    try {
      await this.writeUdfsToClipboard(message.udfs);
    } catch {
      void vscode.window.showWarningMessage("Failed to copy DAG UDFs.");
    }
  }

  private async cutUdfsToClipboard(
    message: CutUdfsMessage,
    webview: vscode.Webview
  ): Promise<void> {
    try {
      await this.writeUdfsToClipboard(message.udfs);
      const completeMessage: CutUdfsCompleteMessage = {
        type: "cutUdfsComplete",
        udfIds: message.udfIds,
      };
      await webview.postMessage(completeMessage);
    } catch {
      void vscode.window.showWarningMessage("Failed to cut DAG UDFs.");
    }
  }

  private async writeNodesToClipboard(nodes: CopyNodesMessage["nodes"]): Promise<void> {
    const payload: NodeClipboardPayload = {
      type: "dag-editor.nodes",
      version: 1,
      nodes,
    };
    await vscode.env.clipboard.writeText(JSON.stringify(payload, null, 2));
  }

  private async writeUdfsToClipboard(udfs: CopyUdfsMessage["udfs"]): Promise<void> {
    const payload: UdfClipboardPayload = {
      type: "dag-editor.udfs",
      version: 1,
      udfs,
    };
    await vscode.env.clipboard.writeText(JSON.stringify(payload, null, 2));
  }

  private async pasteNodesFromClipboard(webview: vscode.Webview): Promise<void> {
    try {
      const text = await vscode.env.clipboard.readText();
      const payload = JSON.parse(text) as unknown;
      if (!isNodeClipboardPayload(payload)) {
        void vscode.window.showWarningMessage("Clipboard does not contain DAG nodes.");
        return;
      }

      const message: ClipboardNodesMessage = {
        type: "clipboardNodes",
        nodes: payload.nodes,
      };
      await webview.postMessage(message);
    } catch {
      void vscode.window.showWarningMessage("Clipboard does not contain DAG nodes.");
    }
  }

  private async pasteUdfsFromClipboard(webview: vscode.Webview): Promise<void> {
    try {
      const text = await vscode.env.clipboard.readText();
      const payload = JSON.parse(text) as unknown;
      if (!isUdfClipboardPayload(payload)) {
        void vscode.window.showWarningMessage("Clipboard does not contain DAG UDFs.");
        return;
      }

      const message: ClipboardUdfsMessage = {
        type: "clipboardUdfs",
        udfs: payload.udfs,
      };
      await webview.postMessage(message);
    } catch {
      void vscode.window.showWarningMessage("Clipboard does not contain DAG UDFs.");
    }
  }
}
