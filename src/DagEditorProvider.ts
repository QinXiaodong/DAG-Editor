import * as vscode from "vscode";
import { DAG_EDITOR_VIEW_TYPE, NEW_DAG_COMMAND, SAVE_DAG_COMMAND } from "./constants";
import { DocumentSession } from "./DocumentSession";
import { isUpdateDocumentMessage } from "./model/messages";
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
}
