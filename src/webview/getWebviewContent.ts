import * as vscode from "vscode";
import { getNonce } from "../utilities/getNonce";
import { getUri } from "../utilities/getUri";

export function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const webviewUri = getUri(webview, extensionUri, ["out", "webview.js"]);
  const styleUri = getUri(webview, extensionUri, ["media", "dagEditor.css"]);
  const editDarkStyleUri = getUri(webview, extensionUri, ["media", "edit-dark.css"]);
  const manageUdfDarkStyleUri = getUri(webview, extensionUri, ["media", "manageUdf-dark.css"]);
  const editLightStyleUri = getUri(webview, extensionUri, ["media", "edit-light.css"]);
  const manageUdfLightStyleUri = getUri(webview, extensionUri, ["media", "manageUdf-light.css"]);
  const nonce = getNonce();

  return /* html */ `
    <!DOCTYPE html>
    <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
        <link href="${styleUri}" nonce="${nonce}" rel="stylesheet" />
        <link href="${editDarkStyleUri}" nonce="${nonce}" rel="stylesheet" />
        <link href="${manageUdfDarkStyleUri}" nonce="${nonce}" rel="stylesheet" />
        <link href="${editLightStyleUri}" nonce="${nonce}" rel="stylesheet" />
        <link href="${manageUdfLightStyleUri}" nonce="${nonce}" rel="stylesheet" />
        <title>DAG Editor</title>
      </head>
      <body>
        <div id="rightClickMenu" role="menu" style="display: none; position: absolute;">
          <ul>
            <li role="menuitem" data-action="edit-udf">&#32534;&#36753;UDF</li>
            <li role="menuitem" data-action="manage-udf">&#31649;&#29702;&#23376;UDF</li>
            <li role="menuitem" data-action="copy-udf">&#22797;&#21046;UDF</li>
            <li role="menuitem" data-action="cut-udf">&#21098;&#20999;UDF</li>
            <li role="menuitem" data-action="paste-udf">&#31896;&#36148;UDF</li>
            <li role="menuitem" data-action="delete-udf">&#21024;&#38500;UDF</li>
            <li role="menuitem" data-action="disable-udf" id="disableUdfMenuItem"></li>
          </ul>
        </div>
        <div id="canvasContainer"></div>
        <div id="editContainer" class="view" style="display: none;">
          <div class="outerDiv">
            <div class="innerDiv">
              <div id="input-group1">
                <div id="nameDiv">
                  <div><label for="name">Name</label></div>
                  <div><input type="text" id="name"></div>
                </div>
                <div id="classNameDiv">
                  <div><label for="className">ClassName</label></div>
                  <div><input type="text" id="className"></div>
                </div>
              </div>
              <br>
              <div id="input-group2">
                <div id="propsLabel"><label>Props</label></div>
                <div id="props"></div>
                <button type="button" id="addProp">Add</button>
              </div>
            </div>
          </div>
        </div>
        <div id="manageUdfContainer" class="view" style="display: none;">
          <div class="outerDiv">
            <div class="innerDiv">
              <div id="prefix"></div>
              <div id="udfs"><ul></ul></div>
              <div id="buttons">
                <button type="button" id="addUdf">Add</button>
              </div>
            </div>
          </div>
        </div>
        <script type="module" nonce="${nonce}" src="${webviewUri}"></script>
      </body>
    </html>
  `;
}
