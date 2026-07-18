import { DagModel } from "../model/DagModel";
import type { Dag } from "../model/DagModel";
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

  private applyDocument(message: DocumentMessage | undefined): boolean {
    if (!message) {
      return false;
    }
    this.setDag(message.dag);
    return true;
  }
}

export const globalDag = new DagClass();
