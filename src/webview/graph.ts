import { Graph } from "@antv/g6";
import type { GraphData } from "@antv/g6";
import {
  configureContextmenu,
  contextmenuClickCallback,
  getContextmenuCallback,
} from "./contextmenuHelper";
import { globalDag } from "./Dag";
import { currentPrefix, manageUdf, setCurrentPrefix } from "./manageUdf";
import switchView, { currentViewId } from "./switchView";
import { currentId, edit } from "./edit";

const DAG_EDGE_TYPE = "polyline";
const FALLBACK_LIGHT = "#616161";
const FALLBACK_DARK = "#cccccc";
const FALLBACK_ACTIVE_LIGHT = "#000000";
const FALLBACK_ACTIVE_DARK = "#ffffff";

export const graph = new Graph({
  container: "canvasContainer",
  animation: false,
  autoResize: false,
  padding: 10,
  behaviors: [
    {
      type: "drag-canvas",
    },
    "hover-activate",
    {
      type: "create-edge",
      onFinish: (e: { source: string; target: string }) => {
        const edgeAdded = globalDag.addEdge(e.source, e.target);
        if (edgeAdded) {
          globalDag.post();
        }
        void updateContent(!edgeAdded);
      },
      style: {
        endArrow: true,
        lineWidth: 3,
        radius: 20,
        stroke: getGraphForegroundColor(getActiveColor()),
        opacity: 1,
        loop: false,
      },
    },
  ],
  plugins: [
    {
      type: "contextmenu",
      onClick: contextmenuClickCallback,
      getItems: getContextmenuCallback,
    },
  ],
  layout: {
    type: "dagre",
    rankdir: "LR",
  },
  node: {
    state: {
      active: {
        stroke: getThemeColor("--vscode-focusBorder", getActiveColor()),
        halo: false,
        lineWidth: 2,
        fill: getThemeColor("--vscode-list-activeSelectionBackground", getNodeFillColor()),
        labelFill: getThemeColor("--vscode-list-activeSelectionForeground", getBaseColor()),
        labelFontSize: 16,
        labelFontStyle: "italic",
        labelFontWeight: "normal",
      },
      selected: {
        stroke: getThemeColor("--vscode-focusBorder", getActiveColor()),
        halo: false,
        lineWidth: 2,
        fill: getThemeColor("--vscode-list-activeSelectionBackground", getNodeFillColor()),
        labelFill: getThemeColor("--vscode-list-activeSelectionForeground", getBaseColor()),
        labelFontSize: 16,
        labelFontStyle: "italic",
        labelFontWeight: "normal",
      },
      disabled: {
        stroke: getDisabledGraphColor(),
        strokeOpacity: 1,
        fill: "transparent",
        fillOpacity: 1,
        lineWidth: 2,
        lineDash: 4,
        labelFill: getDisabledGraphColor(),
        labelFillOpacity: 1,
      },
    },
  },
  edge: {
    type: DAG_EDGE_TYPE,
    state: {
      active: {
        stroke: getThemeColor("--vscode-focusBorder", getActiveColor()),
        halo: false,
        lineWidth: 6,
      },
      disabled: {
        stroke: getDisabledGraphColor(),
        strokeOpacity: 1,
        lineDash: 4,
      },
    },
  },
  theme: isDark() ? "dark" : "light",
});

export interface UpdateContentOptions {
  forceRender?: boolean;
  restoreFocus?: boolean;
}

/**
 * Render the document in the webview.
 */
export function updateContent(options: boolean | UpdateContentOptions = {}): Promise<void> {
  const normalizedOptions = typeof options === "boolean" ? { forceRender: options } : options;
  const { forceRender = false, restoreFocus = true } = normalizedOptions;

  if (currentViewId === "editContainer") {
    if (globalDag.getNodeOrUdf(currentId)) {
      edit(currentId, { restoreFocus });
    } else if (currentId.includes(".")) {
      while (currentPrefix.includes(".") && globalDag.getUdf(currentPrefix) === undefined) {
        setCurrentPrefix(currentPrefix.substring(0, currentPrefix.lastIndexOf(".")));
      }
      if (currentPrefix.includes(".") || globalDag.getNode(currentPrefix)) {
        manageUdf(currentPrefix);
      } else {
        switchView("canvasContainer");
      }
    } else {
      switchView("canvasContainer");
    }
  } else if (currentViewId === "manageUdfContainer") {
    while (currentPrefix.includes(".") && globalDag.getUdf(currentPrefix) === undefined) {
      setCurrentPrefix(currentPrefix.substring(0, currentPrefix.lastIndexOf(".")));
    }
    if (currentPrefix.includes(".") || globalDag.getNode(currentPrefix)) {
      manageUdf(currentPrefix);
    } else {
      switchView("canvasContainer");
    }
  }

  const graphData = getGraphData();
  const signature = JSON.stringify(graphData);
  if (!forceRender && signature === lastGraphSignature) {
    return renderQueue;
  }

  lastGraphSignature = signature;
  renderQueue = renderQueue
    .catch(() => undefined)
    .then(async () => {
      graph.setData(graphData);
      await graph.render();
      if (isFirstRender) {
        isFirstRender = false;
        await graph.fitCenter();
      }
    })
    .catch((error: unknown) => {
      console.error("Could not render DAG graph", error);
    });
  return renderQueue;
}

export async function updateContentAndFocus(nodeId: string | undefined): Promise<void> {
  await updateContent();
  if (nodeId) {
    await graph.focusElement(nodeId);
  }
}

export function registerGraphThemeEvents(): void {
  new MutationObserver(() => {
    void updateContent(true);
  }).observe(document.body, {
    attributes: true,
    attributeFilter: ["class", "style"],
  });
}

export function registerGraphSelectionEvents(): void {
  graph.on("node:click", (event: unknown) => {
    const nodeId = getEventTargetId(event);
    if (!nodeId) {
      return;
    }
    const selectedIds = getSelectedNodeIds();
    const shouldAppend = isMultiSelectEvent(event);
    const nextSelectedIds = shouldAppend
      ? toggleSelectedId(selectedIds, nodeId)
      : new Set([nodeId]);
    void applySelectedNodeIds(nextSelectedIds);
  });

  graph.on("canvas:click", () => {
    void applySelectedNodeIds(new Set());
  });
}

export function getSelectedNodeIds(anchorNodeId?: string): string[] {
  const selectedIds = graph
    .getNodeData()
    .map(({ id }) => String(id))
    .filter((id) => graph.getElementState(id).includes("selected"));

  if (!anchorNodeId || selectedIds.includes(anchorNodeId)) {
    return selectedIds;
  }
  return [anchorNodeId];
}

configureContextmenu(graph, updateContent, updateContentAndFocus);

let isFirstRender = true;
let lastGraphSignature: string | undefined;
let renderQueue = Promise.resolve();

function getGraphData(): GraphData {
  const nodes: NonNullable<GraphData["nodes"]> = [];
  const edges: NonNullable<GraphData["edges"]> = [];

  for (const node of globalDag.getNodes() || []) {
    const labelText =
      node.udfs && node.udfs.length > 0 ? `${node.name} (${node.udfs.length})` : node.name;
    // 渲染节点
    nodes.push({
      id: node.name,
      type: "rect",
      style: {
        radius: 6,
        lineWidth: 2,
        lineDash: 0,
        stroke: getGraphForegroundColor(getBaseColor()),
        strokeOpacity: 1,
        fill: getNodeBackgroundColor(),
        fillOpacity: 1,
        labelFill: getGraphForegroundColor(getBaseColor()),
        labelFillOpacity: 1,
        labelPlacement: "center",
        labelText: labelText,
        labelMaxWidth: "90%",
        labelWordWrap: true,
        labelFontSize: 16,
        labelFontStyle: "italic",
        size: [Math.max(180, 11 * labelText.length), 40],
      },

      states: [globalDag.isNodeDisabled(node) ? "disabled" : "default"],
    });

    // 渲染边
    for (const preNodeName of node.preNodes || []) {
      const preNode = globalDag.getNode(preNodeName);
      if (preNode) {
        edges.push({
          source: preNodeName,
          target: node.name,
          type: DAG_EDGE_TYPE,
          style: {
            endArrow: true,
            lineWidth: 2,
            opacity: 1,
            lineDash: 0,
            radius: 20,
            stroke: getGraphForegroundColor(getBaseColor()),
          },
          states: [
            globalDag.isNodeDisabled(node) || globalDag.isNodeDisabled(preNode)
              ? "disabled"
              : "default",
          ],
        });
      }
    }
  }
  return { nodes, edges };
}

function isDark(): boolean {
  return document.querySelector("body.vscode-dark") !== null;
}

function getBaseColor(): string {
  return isDark() ? FALLBACK_DARK : FALLBACK_LIGHT;
}

function getActiveColor(): string {
  return isDark() ? FALLBACK_ACTIVE_DARK : FALLBACK_ACTIVE_LIGHT;
}

function getNodeFillColor(): string {
  return isDark() ? "#2d2d2d" : "#f8f8f8";
}

function getNodeBackgroundColor(): string {
  return (
    getThemeColor("--vscode-sideBar-background", "") ||
    getThemeColor("--vscode-editorWidget-background", "") ||
    getThemeColor("--vscode-input-background", getNodeFillColor())
  );
}

function getThemeColor(variableName: string, fallback: string): string {
  return getComputedStyle(document.body).getPropertyValue(variableName).trim() || fallback;
}

function getGraphForegroundColor(fallback: string): string {
  return (
    getThemeColor("--vscode-editor-foreground", "") ||
    getThemeColor("--vscode-icon-foreground", "") ||
    getThemeColor("--vscode-foreground", fallback)
  );
}

function getDisabledGraphColor(): string {
  if (isDark()) {
    return getThemeColor("--vscode-disabledForeground", "#858585");
  }
  return (
    getThemeColor("--vscode-descriptionForeground", "") ||
    getThemeColor("--vscode-disabledForeground", "") ||
    "#6c6c6c"
  );
}

function getEventTargetId(event: unknown): string | undefined {
  if (!isRecord(event) || !isRecord(event.target)) {
    return undefined;
  }
  const { id } = event.target;
  return typeof id === "string" ? id : undefined;
}

function isMultiSelectEvent(event: unknown): boolean {
  return isRecord(event) && (event.ctrlKey === true || event.metaKey === true);
}

function toggleSelectedId(selectedIds: string[], nodeId: string): Set<string> {
  const nextSelectedIds = new Set(selectedIds);
  if (nextSelectedIds.has(nodeId)) {
    nextSelectedIds.delete(nodeId);
  } else {
    nextSelectedIds.add(nodeId);
  }
  return nextSelectedIds;
}

async function applySelectedNodeIds(selectedIds: Set<string>): Promise<void> {
  const states = Object.fromEntries(
    graph.getNodeData().map(({ id }) => {
      const nodeId = String(id);
      const currentStates = graph.getElementState(nodeId).filter((state) => state !== "selected");
      return [nodeId, selectedIds.has(nodeId) ? [...currentStates, "selected"] : currentStates];
    })
  );
  await graph.setElementState(states, false);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
