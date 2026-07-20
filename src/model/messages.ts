import { isDag } from "./DagModel";
import type { Dag, Node, Udf } from "./DagModel";

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

export interface CopyNodesMessage {
  type: "copyNodes";
  nodes: Node[];
}

export interface CutNodesMessage {
  type: "cutNodes";
  nodes: Node[];
}

export interface CopyUdfsMessage {
  type: "copyUdfs";
  udfs: Udf[];
}

export interface CutUdfsMessage {
  type: "cutUdfs";
  udfs: Udf[];
  udfIds: string[];
}

export interface PasteNodesRequestMessage {
  type: "pasteNodes";
}

export interface PasteUdfsRequestMessage {
  type: "pasteUdfs";
}

export interface ClipboardNodesMessage {
  type: "clipboardNodes";
  nodes: Node[];
}

export interface ClipboardUdfsMessage {
  type: "clipboardUdfs";
  udfs: Udf[];
}

export interface CutNodesCompleteMessage {
  type: "cutNodesComplete";
  nodeIds: string[];
}

export interface CutUdfsCompleteMessage {
  type: "cutUdfsComplete";
  udfIds: string[];
}

export interface NodeClipboardPayload {
  type: "dag-editor.nodes";
  version: 1;
  nodes: Node[];
}

export interface UdfClipboardPayload {
  type: "dag-editor.udfs";
  version: 1;
  udfs: Udf[];
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

export type ExtensionMessage =
  | DocumentMessage
  | UpdateResultMessage
  | SaveRequestMessage
  | ClipboardNodesMessage
  | ClipboardUdfsMessage
  | CutNodesCompleteMessage
  | CutUdfsCompleteMessage;

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

export function isCopyNodesMessage(value: unknown): value is CopyNodesMessage {
  return (
    isRecord(value) &&
    value.type === "copyNodes" &&
    Array.isArray(value.nodes) &&
    isDag({ nodes: value.nodes })
  );
}

export function isCutNodesMessage(value: unknown): value is CutNodesMessage {
  return (
    isRecord(value) &&
    value.type === "cutNodes" &&
    Array.isArray(value.nodes) &&
    isDag({ nodes: value.nodes })
  );
}

export function isCopyUdfsMessage(value: unknown): value is CopyUdfsMessage {
  return (
    isRecord(value) &&
    value.type === "copyUdfs" &&
    Array.isArray(value.udfs) &&
    isDag({ nodes: [{ name: "clipboard", udfs: value.udfs }] })
  );
}

export function isCutUdfsMessage(value: unknown): value is CutUdfsMessage {
  return (
    isRecord(value) &&
    value.type === "cutUdfs" &&
    Array.isArray(value.udfs) &&
    Array.isArray(value.udfIds) &&
    value.udfIds.every(isNonEmptyString) &&
    isDag({ nodes: [{ name: "clipboard", udfs: value.udfs }] })
  );
}

export function isPasteNodesRequestMessage(value: unknown): value is PasteNodesRequestMessage {
  return isRecord(value) && value.type === "pasteNodes";
}

export function isPasteUdfsRequestMessage(value: unknown): value is PasteUdfsRequestMessage {
  return isRecord(value) && value.type === "pasteUdfs";
}

export function isNodeClipboardPayload(value: unknown): value is NodeClipboardPayload {
  return (
    isRecord(value) &&
    value.type === "dag-editor.nodes" &&
    value.version === 1 &&
    Array.isArray(value.nodes) &&
    isDag({ nodes: value.nodes })
  );
}

export function isUdfClipboardPayload(value: unknown): value is UdfClipboardPayload {
  return (
    isRecord(value) &&
    value.type === "dag-editor.udfs" &&
    value.version === 1 &&
    Array.isArray(value.udfs) &&
    isDag({ nodes: [{ name: "clipboard", udfs: value.udfs }] })
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
