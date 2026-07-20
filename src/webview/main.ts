import type { ExtensionMessage } from "../model/messages";
import { globalDag } from "./Dag";
import { flushPendingSave, registerEditEvents, currentId } from "./edit";
import {
  copySelectedNodes,
  cutSelectedNodes,
  deleteNodes,
  graph,
  pasteClipboardNodes,
  registerGraphSelectionEvents,
  registerGraphThemeEvents,
  updateContent,
} from "./graph";
import {
  copySelectedUdfs,
  currentPrefix,
  cutSelectedUdfs,
  deleteUdfs,
  manageUdf,
  pasteClipboardUdfs,
  registerManageUdfEvents,
} from "./manageUdf";
import switchView, { currentViewId } from "./switchView";
import { registerGraphWheelZoomFallback } from "./graphWheelZoom";

let hasDeferredRender = false;

window.addEventListener("message", (event: MessageEvent<ExtensionMessage>) => {
  if (event.data.type === "requestSave") {
    saveDocument();
    return;
  }
  if (event.data.type === "clipboardNodes") {
    void pasteClipboardNodes(event.data.nodes);
    return;
  }
  if (event.data.type === "clipboardUdfs") {
    pasteClipboardUdfs(event.data.udfs);
    return;
  }
  if (event.data.type === "cutNodesComplete") {
    void deleteNodes(event.data.nodeIds);
    return;
  }
  if (event.data.type === "cutUdfsComplete") {
    deleteUdfs(event.data.udfIds);
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
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
    if (currentViewId === "canvasContainer") {
      event.preventDefault();
      event.stopPropagation();
      copySelectedNodes();
    } else if (currentViewId === "manageUdfContainer") {
      event.preventDefault();
      event.stopPropagation();
      copySelectedUdfs();
    }
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "x") {
    if (currentViewId === "canvasContainer") {
      event.preventDefault();
      event.stopPropagation();
      cutSelectedNodes();
    } else if (currentViewId === "manageUdfContainer") {
      event.preventDefault();
      event.stopPropagation();
      cutSelectedUdfs();
    }
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {
    if (currentViewId === "canvasContainer") {
      event.preventDefault();
      event.stopPropagation();
      globalDag.requestPasteNodesFromClipboard();
    } else if (currentViewId === "manageUdfContainer") {
      event.preventDefault();
      event.stopPropagation();
      globalDag.requestPasteUdfsFromClipboard();
    }
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
