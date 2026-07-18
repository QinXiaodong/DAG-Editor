import { isDag } from "./DagModel";
import type { Dag } from "./DagModel";

export interface DocumentMessage {
  type: "document";
  dag: Dag;
  revision: number;
  originEditorId?: string;
}

export interface UpdateDocumentMessage {
  type: "updateDocument";
  dag: Dag;
  baseRevision: number;
  editorId: string;
  requestId: string;
  persist?: boolean;
}

export interface SaveRequestMessage {
  type: "requestSave";
}

export type UpdateResultMessage =
  | {
      type: "updateResult";
      status: "accepted";
      requestId: string;
      revision: number;
    }
  | {
      type: "updateResult";
      status: "conflict";
      requestId: string;
      revision: number;
      dag: Dag;
    }
  | {
      type: "updateResult";
      status: "error";
      requestId: string;
      revision: number;
      accepted: boolean;
    };

export type ExtensionMessage = DocumentMessage | UpdateResultMessage | SaveRequestMessage;

export function isUpdateDocumentMessage(value: unknown): value is UpdateDocumentMessage {
  return (
    isRecord(value) &&
    value.type === "updateDocument" &&
    Number.isInteger(value.baseRevision) &&
    typeof value.baseRevision === "number" &&
    value.baseRevision >= 0 &&
    isNonEmptyString(value.editorId) &&
    isNonEmptyString(value.requestId) &&
    (value.persist === undefined || typeof value.persist === "boolean") &&
    isDag(value.dag)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
