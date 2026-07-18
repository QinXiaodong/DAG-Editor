import type { ExtensionMessage } from "../model/messages";
import { globalDag } from "./Dag";
import { flushPendingSave, registerEditEvents, currentId } from "./edit";
import {
  graph,
  registerGraphSelectionEvents,
  registerGraphThemeEvents,
  updateContent,
} from "./graph";
import { currentPrefix, manageUdf, registerManageUdfEvents } from "./manageUdf";
import switchView, { currentViewId } from "./switchView";
import { registerGraphWheelZoomFallback } from "./graphWheelZoom";

let hasDeferredRender = false;

window.addEventListener("message", (event: MessageEvent<ExtensionMessage>) => {
  if (event.data.type === "requestSave") {
    saveDocument();
    return;
  }
  const shouldRender =
    event.data.type === "document"
      ? globalDag.receiveDocument(event.data)
      : globalDag.handleUpdateResult(event.data);
  if (shouldRender) {
    renderSyncedDocument(event.data.type === "document");
  }
});

window.addEventListener("resize", () => {
  const container = document.getElementById("canvasContainer");
  if (!container) {
    return;
  }
  graph.resize(container.clientWidth, container.clientHeight - 2);
  void graph.fitCenter();
});

registerEditEvents();
registerManageUdfEvents();
registerGraphSelectionEvents();
registerGraphThemeEvents();
registerGraphWheelZoomFallback();

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    event.stopPropagation();
    saveDocument();
    return;
  }

  if (event.key !== "Escape") {
    return;
  }

  if (currentViewId === "editContainer") {
    if (!flushPendingSave()) {
      return;
    }
    if (currentId.includes(".")) {
      manageUdf(currentPrefix);
    } else {
      showCanvas();
    }
    return;
  }

  if (currentViewId === "manageUdfContainer") {
    if (currentPrefix.includes(".")) {
      manageUdf(currentPrefix.slice(0, currentPrefix.lastIndexOf(".")));
    } else {
      showCanvas();
    }
  }
});

function saveDocument(): void {
  if (currentViewId !== "editContainer" || flushPendingSave()) {
    globalDag.saveToDisk();
  }
}

function showCanvas(): void {
  switchView("canvasContainer");
  void updateContent();
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && hasDeferredRender) {
    hasDeferredRender = false;
    void updateContent({ restoreFocus: false });
  }
  if (document.hidden && currentViewId === "editContainer") {
    flushPendingSave();
  }
  if (document.hidden) {
    globalDag.flush();
  }
});

window.addEventListener("pagehide", () => {
  if (currentViewId === "editContainer") {
    flushPendingSave();
  }
  globalDag.flush();
});

function renderSyncedDocument(isDocumentBroadcast: boolean): void {
  if (document.hidden) {
    hasDeferredRender = true;
    return;
  }
  void updateContent({ restoreFocus: !isDocumentBroadcast });
}
