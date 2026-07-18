import type { Dag } from "../model/DagModel";
import type {
  DocumentMessage,
  UpdateDocumentMessage,
  UpdateResultMessage,
} from "../model/messages";

export interface SaveCoordinatorOptions {
  getDag: () => Dag;
  postMessage: (message: UpdateDocumentMessage) => void;
  editorId?: string;
  debounceDelayMs?: number;
  maximumWaitMs?: number;
}

export class SaveCoordinator {
  private revision = 0;
  private readonly editorId: string;
  private readonly debounceDelayMs: number;
  private readonly maximumWaitMs: number;
  private requestSequence = 0;
  private generation = 0;
  private acknowledgedGeneration = 0;
  private inFlight: PendingUpdate | undefined;
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private maximumWaitTimer: ReturnType<typeof setTimeout> | undefined;
  private persistRequested = false;
  private pendingExternalDocument: DocumentMessage | undefined;

  constructor(private readonly options: SaveCoordinatorOptions) {
    this.editorId = options.editorId ?? createId("editor");
    this.debounceDelayMs = options.debounceDelayMs ?? 200;
    this.maximumWaitMs = options.maximumWaitMs ?? 2_000;
  }

  receiveDocument(message: DocumentMessage): DocumentMessage | undefined {
    if (message.originEditorId === this.editorId) {
      return undefined;
    }
    if (this.hasPendingChanges()) {
      if (
        !this.pendingExternalDocument ||
        message.revision > this.pendingExternalDocument.revision
      ) {
        this.pendingExternalDocument = message;
      }
      return undefined;
    }
    return this.acceptExternalDocument(message);
  }

  markChanged(): void {
    this.generation += 1;
    this.scheduleUpdate();
  }

  saveToDisk(): void {
    if (this.inFlight?.persist && this.generation <= this.inFlight.generation) {
      return;
    }
    this.persistRequested = true;
    this.flush();
  }

  flush(): void {
    this.clearUpdateTimers();
    this.sendNextUpdate();
  }

  handleUpdateResult(message: UpdateResultMessage): DocumentMessage | undefined {
    const pending = this.inFlight;
    if (!pending || pending.requestId !== message.requestId) {
      return undefined;
    }

    this.inFlight = undefined;
    this.revision = message.revision;

    if (message.status === "conflict") {
      this.clearUpdateTimers();
      this.generation = 0;
      this.acknowledgedGeneration = 0;
      this.persistRequested = false;
      this.pendingExternalDocument = undefined;
      return {
        type: "document",
        dag: message.dag,
        revision: message.revision,
      };
    }

    if (message.status === "error") {
      if (message.accepted) {
        this.acknowledgedGeneration = Math.max(this.acknowledgedGeneration, pending.generation);
      }
      if (pending.persist) {
        this.persistRequested = true;
      }
      return undefined;
    }

    this.acknowledgedGeneration = Math.max(this.acknowledgedGeneration, pending.generation);
    if (this.hasUnacknowledgedChanges() || this.persistRequested) {
      this.sendNextUpdate();
      return undefined;
    }

    const externalDocument = this.pendingExternalDocument;
    this.pendingExternalDocument = undefined;
    return externalDocument ? this.acceptExternalDocument(externalDocument) : undefined;
  }

  private scheduleUpdate(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = undefined;
      this.sendNextUpdate();
    }, this.debounceDelayMs);

    if (!this.maximumWaitTimer) {
      this.maximumWaitTimer = setTimeout(() => {
        this.maximumWaitTimer = undefined;
        this.sendNextUpdate();
      }, this.maximumWaitMs);
    }
  }

  private sendNextUpdate(): void {
    if (this.inFlight || (!this.hasUnacknowledgedChanges() && !this.persistRequested)) {
      return;
    }
    this.clearUpdateTimers();

    const requestId = `${this.editorId}-${this.requestSequence++}`;
    const persist = this.persistRequested;
    this.persistRequested = false;
    this.inFlight = { requestId, generation: this.generation, persist };
    this.options.postMessage({
      type: "updateDocument",
      dag: cloneDag(this.options.getDag()),
      baseRevision: this.revision,
      editorId: this.editorId,
      requestId,
      persist: persist || undefined,
    });
  }

  private hasPendingChanges(): boolean {
    return Boolean(this.inFlight) || this.hasUnacknowledgedChanges();
  }

  private hasUnacknowledgedChanges(): boolean {
    return this.generation > this.acknowledgedGeneration;
  }

  private acceptExternalDocument(message: DocumentMessage): DocumentMessage | undefined {
    if (message.revision < this.revision) {
      return undefined;
    }
    this.revision = message.revision;
    return message;
  }

  private clearUpdateTimers(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
    if (this.maximumWaitTimer) {
      clearTimeout(this.maximumWaitTimer);
      this.maximumWaitTimer = undefined;
    }
  }
}

interface PendingUpdate {
  requestId: string;
  generation: number;
  persist: boolean;
}

function cloneDag(dag: Dag): Dag {
  return JSON.parse(JSON.stringify(dag)) as Dag;
}

function createId(prefix: string): string {
  const randomPart =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${randomPart}`;
}
