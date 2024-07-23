import * as vscode from "vscode";
import { getUri } from "./utilities/getUri";
import { getNonce } from "./utilities/getNonce";
import { Dag } from "./webview/Dag";

export class DagEditorProvider implements vscode.CustomTextEditorProvider {

    private static newDagFileId = 1;
    private lastDocumentVersions = new Map();
    public static register(context: vscode.ExtensionContext): vscode.Disposable {

        // 注册新建DAG命令，支持在control pallete中执行
        vscode.commands.registerCommand('dag-editor.new', () => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                vscode.window.showErrorMessage("Creating new DAG files currently requires opening a workspace");
                return;
            }

            const uri = vscode.Uri.joinPath(workspaceFolders[0].uri, `Untitled-${DagEditorProvider.newDagFileId++}.dag.json`)
                .with({ scheme: 'untitled' });

            vscode.commands.executeCommand('vscode.openWith', uri, 'dag-editor');
        });
        return vscode.window.registerCustomEditorProvider(
            "dag-editor",
            new DagEditorProvider(context),
        );

    }

    constructor(private readonly context: vscode.ExtensionContext) {
    }


    resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel, token: vscode.CancellationToken): void | Thenable<void> {



        // Hook up event handlers so that we can synchronize the webview with the text document.
        //
        // The text document acts as our model, so we have to sync change in the document to our
        // editor and sync changes in the editor back to the document.
        // 
        // Remember that a single text document can also be shared between multiple custom
        // editors (this happens for example when you split a custom editor)

        // 文档内容发生变化时主动向前端更新数据
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString() && e.document.version > this.lastDocumentVersions.get(e.document.uri)) {
                this.lastDocumentVersions.set(e.document.uri, e.document.version);
                updateWebview();
            }
        });

        // Make sure we get rid of the listener when our editor is closed.
        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });


        // 接收前端内容时更新文档
        webviewPanel.webview.onDidReceiveMessage((dag: Dag) => {
            updateTextDocument(dag);
        });

        this.lastDocumentVersions.set(document.uri, 0);
        // Setup initial content for the webview
        webviewPanel.webview.options = {
            // Enable JavaScript in the webview
            enableScripts: true,
            // Restrict the webview to only load resources from the `out` directory
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, "out"),
                vscode.Uri.joinPath(this.context.extensionUri, "media")
                ,],
        };

        webviewPanel.webview.html = this._getWebviewContent(webviewPanel.webview);

        updateWebview();






        function updateWebview() {
            // 向前端发送文档内容
            webviewPanel.webview.postMessage(getDocumentAsJson(document));
        }

        function updateTextDocument(json: Dag) {
            const edit = new vscode.WorkspaceEdit();

            // Just replace the entire document every time for this example extension.
            // A more complete extension should compute minimal edits instead.
            edit.replace(
                document.uri,
                new vscode.Range(0, 0, document.lineCount, 0),
                JSON.stringify(json, null, 2));

            return vscode.workspace.applyEdit(edit);
        }
        function getDocumentAsJson(document: vscode.TextDocument): any {
            const text = document.getText();
            if (text.trim().length === 0) {
                return {};
            }
            try {
                return JSON.parse(text);
            } catch {
                throw new Error('Could not get document as json. Content is not valid json');
            }
        }
    }


    private _getWebviewContent(webview: vscode.Webview) {
        const webviewUri = getUri(webview, this.context.extensionUri, ["out", "webview.js"]);
        const styleUri = getUri(webview, this.context.extensionUri, ["media", "dagEditor.css"]);
        const editNodeDarkStyleUri = getUri(webview, this.context.extensionUri, ["media", "editNode-dark.css"]);
        const editUdfDarkStyleUri = getUri(webview, this.context.extensionUri, ["media", "editUdf-dark.css"]);
        const manageUdfDarkStyleUri = getUri(webview, this.context.extensionUri, ["media", "manageUdf-dark.css"]);
        const editNodeLightStyleUri = getUri(webview, this.context.extensionUri, ["media", "editNode-light.css"]);
        const editUdfLightStyleUri = getUri(webview, this.context.extensionUri, ["media", "editUdf-light.css"]);
        const manageUdfLightStyleUri = getUri(webview, this.context.extensionUri, ["media", "manageUdf-light.css"]);
        const nonce = getNonce();

        // Tip: Install the es6-string-html VS Code extension to enable code highlighting below
        return /*html*/ `
          <!DOCTYPE html>
          <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
              <link href="${styleUri}" nonce="${nonce}" rel="stylesheet" />
              <link href="${editNodeDarkStyleUri}" nonce="${nonce}" rel="stylesheet" />
              <link href="${editUdfDarkStyleUri}" nonce="${nonce}" rel="stylesheet" />
              <link href="${manageUdfDarkStyleUri}" nonce="${nonce}" rel="stylesheet" />
              <link href="${editNodeLightStyleUri}" nonce="${nonce}" rel="stylesheet" />
              <link href="${editUdfLightStyleUri}" nonce="${nonce}" rel="stylesheet" />
              <link href="${manageUdfLightStyleUri}" nonce="${nonce}" rel="stylesheet" />
              <title>DAG Editor</title>
            </head>
            <body>
            <div id="rightClickMenu" style="display: none; position: absolute;">
                <ul>
                    <li data-action="edit-udf">编辑UDF</li>
                    <li data-action="delete-udf">删除UDF</li>
                    <li data-action="disable-udf">禁用UDF</li>
                    <li data-action="manage-udf">管理子UDF</li>
                </ul>
            </div>
                <div id='canvasContainer'></div>
                <div id='editNodeContainer' class='view' style="display: none;">
                    <div id="outerDiv">
                        <div id="innerDiv">
                            <form>  
                                <div id="input-group1">
                                    <div id="nameDiv">
                                        <div><label>Name</label></div>
                                        <div><input type="text" id="name"></div>
                                    </div>
                                    <div id="classNameDiv">
                                        <div><label>ClassName</label></div>
                                        <div><input type="text" id="className"></div>
                                    </div>
                                </div>
                                <br>
                                <div id="input-group2">
                                    <div id=propsLabel><label>Props</label></div>
                                    <div id="props"></div>  
                                    <button type="button" id="add">Add</button>  
                                </div>
                                <div id="buttons">
                                    <button type="button" id="quit">Quit</button>  
                                    <button type="submit" id="save">Save</button>  
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
                <div id="manageUdfContainer" class="view" style="display: none;">
                    <div id="outerDiv">
                        <div id="innerDiv">
                            <div id="prefix"></div>
                            <div id="udfs"><ul></ul></div>   
                            <div id="buttons">
                                <button type="button" id="add">Add</button>
                                <button type="button" id="return">return</button>  
                            </div>
                        </div>
                    </div>
                </div>
                <div id='editUdfContainer' class='view' style="display: none;">
                    <div id="outerDiv">
                        <div id="innerDiv">
                            <form>  
                                <div id="input-group1">
                                    <div id="nameDiv">
                                        <div><label>Name</label></div>
                                        <div><input type="text" id="name"></div>
                                    </div>
                                    <div id="classNameDiv">
                                        <div><label>ClassName</label></div>
                                        <div><input type="text" id="className"></div>
                                    </div>
                                </div>
                                <br>
                                <div id="input-group2">
                                    <div id=propsLabel><label>Props</label></div>
                                    <div id="props"></div>  
                                    <button type="button" id="add">Add</button>  
                                </div>
                                <br>
                                <div id="buttons">
                                    <button type="button" id="quit">Quit</button>  
                                    <button type="submit" id="save">Save</button>  
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
                <script type="module" nonce="${nonce}" src="${webviewUri}"></script>
            </body>
          </html>
        `;
    }

}


