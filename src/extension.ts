import { commands, ExtensionContext } from "vscode";
import { DagEditorProvider } from "./DagEditorProvider";

export function activate(context: ExtensionContext) {
  context.subscriptions.push(DagEditorProvider.register(context));
}
