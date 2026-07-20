import { DagModel } from "../model/DagModel";
import type { Dag, Node } from "../model/DagModel";
import type { DocumentMessage, UpdateResultMessage } from "../model/messages";
import { SaveCoordinator } from "./SaveCoordinator";

export type { Dag, Node, Prop, Udf } from "../model/DagModel";

const vscode = acquireVsCodeApi<Dag>();

export class DagClass extends DagModel {
  private readonly saveCoordinator = new SaveCoordinator({
    getDag: () => this.getDag(),
    postMessage: (message) => vscode.postMessage(message),
  });

  receiveDocument(message: DocumentMessage): boolean {
    return this.applyDocument(this.saveCoordinator.receiveDocument(message));
  }

  post(): void {
    this.saveCoordinator.markChanged();
  }

  saveToDisk(): void {
    this.saveCoordinator.saveToDisk();
  }

  flush(): void {
    this.saveCoordinator.flush();
  }

  handleUpdateResult(message: UpdateResultMessage): boolean {
    return this.applyDocument(this.saveCoordinator.handleUpdateResult(message));
  }

  copyNodesToClipboard(nodeIds: string[]): boolean {
    const nodes = this.getClipboardNodes(nodeIds);
    if (nodes.length === 0) {
      return false;
    }
    vscode.postMessage({ type: "copyNodes", nodes });
    return true;
  }

  cutNodesToClipboard(nodeIds: string[]): boolean {
    const nodes = this.getClipboardNodes(nodeIds);
    if (nodes.length === 0) {
      return false;
    }
    vscode.postMessage({ type: "cutNodes", nodes });
    return true;
  }

  requestPasteNodesFromClipboard(): void {
    vscode.postMessage({ type: "pasteNodes" });
  }

  pasteNodesFromClipboard(nodes: Node[]): string[] {
    return this.pasteClipboardNodes(nodes);
  }

  copyUdfsToClipboard(udfIds: string[]): boolean {
    const udfs = this.getClipboardUdfs(udfIds);
    if (udfs.length === 0) {
      return false;
    }
    vscode.postMessage({ type: "copyUdfs", udfs });
    return true;
  }

  cutUdfsToClipboard(udfIds: string[]): boolean {
    const udfs = this.getClipboardUdfs(udfIds);
    if (udfs.length === 0) {
      return false;
    }
    vscode.postMessage({ type: "cutUdfs", udfs, udfIds });
    return true;
  }

  requestPasteUdfsFromClipboard(): void {
    vscode.postMessage({ type: "pasteUdfs" });
  }

  pasteUdfsFromClipboard(prefix: string, udfs: Node["udfs"]): string[] {
    return this.pasteClipboardUdfs(prefix, udfs ?? []);
  }

  private applyDocument(message: DocumentMessage | undefined): boolean {
    if (!message) {
      return false;
    }
    this.setDag(message.dag);
    return true;
  }
}

export const globalDag = new DagClass();
