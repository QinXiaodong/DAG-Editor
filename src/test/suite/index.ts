import { strict as assert } from "assert";
import * as vscode from "vscode";

const extensionId = "QinXiaodong.dag-editor";
const viewType = "dag-editor";

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension(extensionId);
  assert.ok(extension, `Extension ${extensionId} was not found.`);
  await extension.activate();

  const commands = await vscode.commands.getCommands(true);
  assert.ok(commands.includes("dag-editor.new"), "New DAG command was not registered.");
  assert.ok(commands.includes("dag-editor.save"), "Save DAG command was not registered.");

  await verifyValidDocument();
  await verifySaveCommand();
  await verifySemanticDiagnostics();
}

async function verifyValidDocument(): Promise<void> {
  const uri = getFixtureUri("valid.dag.json");
  const document = await vscode.workspace.openTextDocument(uri);
  const originalText = document.getText();

  await vscode.commands.executeCommand("vscode.openWith", uri, viewType);
  await waitFor(() => vscode.languages.getDiagnostics(uri).length === 0);

  assert.equal(document.getText(), originalText, "Opening the custom editor changed the JSON.");
  await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
}

async function verifySemanticDiagnostics(): Promise<void> {
  const uri = getFixtureUri("invalid-semantic.dag.json");
  await vscode.workspace.openTextDocument(uri);
  await vscode.commands.executeCommand("vscode.openWith", uri, viewType);

  const diagnostics = await waitFor(() => {
    const current = vscode.languages.getDiagnostics(uri);
    return current.length >= 2 ? current : undefined;
  });
  const codes = new Set(diagnostics.map((diagnostic) => diagnostic.code));

  assert.ok(codes.has("missing-pre-node"), "Missing predecessor diagnostic was not published.");
  assert.ok(codes.has("cycle"), "Cycle diagnostic was not published.");
  assert.ok(
    diagnostics.every((diagnostic) => diagnostic.source === "DAG Editor"),
    "Diagnostics have an unexpected source."
  );
  assert.ok(
    diagnostics.some((diagnostic) => !diagnostic.range.isEmpty),
    "Diagnostics were not mapped to JSON ranges."
  );

  await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
}

async function verifySaveCommand(): Promise<void> {
  const uri = getFixtureUri("save-command.dag.json");
  const content = Buffer.from('{\n  "nodes": [{ "name": "source" }]\n}\n');
  await vscode.workspace.fs.writeFile(uri, content);

  try {
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.commands.executeCommand("vscode.openWith", uri, viewType);

    const edit = new vscode.WorkspaceEdit();
    const sourceOffset = document.getText().indexOf("source");
    assert.ok(sourceOffset >= 0, "Save command fixture is invalid.");
    edit.replace(
      uri,
      new vscode.Range(document.positionAt(sourceOffset), document.positionAt(sourceOffset + 6)),
      "saved-source"
    );
    assert.equal(
      await vscode.workspace.applyEdit(edit),
      true,
      "Could not dirty the test document."
    );
    assert.equal(document.isDirty, true, "The test document did not become dirty.");

    await new Promise((resolve) => setTimeout(resolve, 500));
    await vscode.commands.executeCommand("dag-editor.save");
    await waitFor(() => !document.isDirty);

    const savedText = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString("utf8");
    assert.match(savedText, /saved-source/, "Save DAG did not persist the latest document.");
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  } finally {
    await vscode.workspace.fs.delete(uri, { useTrash: false });
  }
}

function getFixtureUri(fileName: string): vscode.Uri {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(workspaceFolder, "Integration test workspace was not opened.");
  return vscode.Uri.joinPath(workspaceFolder.uri, fileName);
}

async function waitFor<T>(condition: () => T | undefined | false, timeoutMs = 15_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = condition();
    if (result) {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out after ${timeoutMs}ms.`);
}
