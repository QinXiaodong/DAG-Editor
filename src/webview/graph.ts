import { Graph } from "@antv/g6";
import type { BehaviorOptions, GraphData } from "@antv/g6";
import {
  configureContextmenu,
  contextmenuClickCallback,
  getContextmenuCallback,
} from "./contextmenuHelper";
import type { Node } from "../model/DagModel";
import { globalDag } from "./Dag";
import { currentPrefix, manageUdf, setCurrentPrefix } from "./manageUdf";
import switchView, { currentViewId } from "./switchView";
import { currentId, edit } from "./edit";

const DAG_EDGE_TYPE = "polyline";
const FALLBACK_LIGHT = "#616161";
const FALLBACK_DARK = "#cccccc";
const FALLBACK_ACTIVE_LIGHT = "#000000";
const FALLBACK_ACTIVE_DARK = "#ffffff";
const CREATE_EDGE_BEHAVIOR_KEY = "dag-editor-create-edge";
const CREATE_EDGE_ASSIST_EDGE_ID = "g6-create-edge-assist-edge-id";
const CREATE_EDGE_ASSIST_NODE_ID = "g6-create-edge-assist-node-id";

export const graph = new Graph({
  container: "canvasContainer",
  animation: false,
  autoResize: false,
  padding: 10,
  behaviors: getGraphBehaviors(),
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
        stroke: getGraphForegroundColor(getActiveColor()),
        halo: false,
        lineWidth: 2,
        fill: getNodeHighlightBackgroundColor(),
        labelFill: getThemeColor("--vscode-list-activeSelectionForeground", getBaseColor()),
        labelFontSize: 16,
        labelFontStyle: "italic",
        labelFontWeight: "normal",
      },
      selected: {
        stroke: getGraphForegroundColor(getActiveColor()),
        halo: false,
        lineWidth: 2,
        fill: getNodeHighlightBackgroundColor(),
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
      resetCreateEdgeInteraction();
      graph.setData(graphData);
      await graph.render();
      hasRenderedGraph = true;
      if (isFirstRender) {
        isFirstRender = false;
        await graph.fitCenter();
      }
      if (pendingGraphResize) {
        scheduleGraphResize();
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

export function scheduleGraphResize(): void {
  pendingGraphResize = true;
  if (resizeAnimationFrame !== undefined) {
    return;
  }

  resizeAnimationFrame = window.requestAnimationFrame(() => {
    resizeAnimationFrame = undefined;
    if (!hasRenderedGraph) {
      return;
    }
    void renderQueue.then(resizeGraphToContainer);
  });
}

export function registerGraphSelectionEvents(): void {
  graph.on("node:click", (event: unknown) => {
    const nodeId = getEventTargetId(event);
    if (!nodeId || !globalDag.getNode(nodeId)) {
      return;
    }
    if (!isMultiSelectEvent(event)) {
      void applySelectedNodeIds(new Set());
      return;
    }
    const selectedIds = getSelectedNodeIds();
    const nextSelectedIds = toggleSelectedId(selectedIds, nodeId);
    void applySelectedNodeIds(nextSelectedIds);
  });

  graph.on("node:pointerout", (event: unknown) => {
    const nodeId = getEventTargetId(event);
    if (nodeId && globalDag.getNode(nodeId)) {
      void clearActiveNodeState(nodeId);
    }
  });

  graph.on("node:dblclick", (event: unknown) => {
    const nodeId = getEventTargetId(event);
    if (nodeId && globalDag.getNode(nodeId)) {
      manageUdf(nodeId);
    }
  });

  graph.on("canvas:click", () => {
    void applySelectedNodeIds(new Set());
  });
}

export function resetCreateEdgeInteraction(): void {
  graph.setBehaviors((behaviors) =>
    behaviors.filter(
      (behavior) => !(typeof behavior === "object" && behavior.key === CREATE_EDGE_BEHAVIOR_KEY)
    )
  );

  if (graph.getEdgeData().some(({ id }) => id === CREATE_EDGE_ASSIST_EDGE_ID)) {
    graph.removeEdgeData([CREATE_EDGE_ASSIST_EDGE_ID]);
  }
  if (graph.getNodeData().some(({ id }) => id === CREATE_EDGE_ASSIST_NODE_ID)) {
    graph.removeNodeData([CREATE_EDGE_ASSIST_NODE_ID]);
  }

  graph.setBehaviors((behaviors) => [...behaviors, getCreateEdgeBehavior()]);
}

export function getSelectedNodeIds(anchorNodeId?: string): string[] {
  const selectedIds = getDagGraphNodeIds().filter((id) =>
    graph.getElementState(id).includes("selected")
  );

  if (!anchorNodeId || selectedIds.includes(anchorNodeId)) {
    return selectedIds;
  }
  return [anchorNodeId];
}

export function copySelectedNodes(): void {
  globalDag.copyNodesToClipboard(getSelectedNodeIds());
}

export function cutSelectedNodes(): void {
  globalDag.cutNodesToClipboard(getSelectedNodeIds());
}

export async function deleteNodes(nodeIds: string[]): Promise<void> {
  let changed = false;
  for (const nodeId of nodeIds) {
    changed = globalDag.deleteNode(nodeId) || changed;
  }
  if (!changed) {
    return;
  }

  globalDag.post();
  await updateContent({ forceRender: true, restoreFocus: false });
}

export async function pasteClipboardNodes(nodes: Node[]): Promise<void> {
  const pastedNodeIds = globalDag.pasteNodesFromClipboard(nodes);
  if (pastedNodeIds.length === 0) {
    return;
  }

  globalDag.post();
  await updateContent({ forceRender: true, restoreFocus: false });
  await applySelectedNodeIds(new Set(pastedNodeIds));
  const firstPastedNodeId = pastedNodeIds[0];
  if (firstPastedNodeId) {
    await graph.focusElement(firstPastedNodeId);
  }
}

configureContextmenu(graph, updateContent, updateContentAndFocus);

let isFirstRender = true;
let hasRenderedGraph = false;
let lastGraphSignature: string | undefined;
let renderQueue = Promise.resolve();
let pendingGraphResize = false;
let resizeAnimationFrame: number | undefined;

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

function getGraphBehaviors(): BehaviorOptions {
  return [
    {
      type: "drag-canvas",
    },
    "hover-activate",
    getCreateEdgeBehavior(),
  ];
}

function getCreateEdgeBehavior(): BehaviorOptions[number] {
  return {
    type: "create-edge",
    key: CREATE_EDGE_BEHAVIOR_KEY,
    enable: (event: unknown) => {
      const nodeId = getEventTargetId(event);
      return !isMultiSelectEvent(event) && Boolean(nodeId && globalDag.getNode(nodeId));
    },
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
  };
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

function getNodeHighlightBackgroundColor(): string {
  return (
    getThemeColor("--vscode-menu-selectionBackground", "") ||
    getThemeColor("--vscode-list-activeSelectionBackground", getNodeFillColor())
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
    getDagGraphNodeIds().map((nodeId) => {
      const currentStates = graph.getElementState(nodeId).filter((state) => state !== "selected");
      return [nodeId, selectedIds.has(nodeId) ? [...currentStates, "selected"] : currentStates];
    })
  );
  await graph.setElementState(states, false);
}

async function clearActiveNodeState(nodeId: string): Promise<void> {
  const currentStates = graph.getElementState(nodeId).filter((state) => state !== "active");
  await graph.setElementState({ [nodeId]: currentStates }, false);
}

function getDagGraphNodeIds(): string[] {
  return graph
    .getNodeData()
    .map(({ id }) => String(id))
    .filter((id) => Boolean(globalDag.getNode(id)));
}

async function resizeGraphToContainer(): Promise<void> {
  if (document.hidden) {
    return;
  }

  const container = document.getElementById("canvasContainer");
  if (!container) {
    return;
  }

  const width = container.clientWidth;
  const height = container.clientHeight - 2;
  if (width <= 0 || height <= 0) {
    return;
  }

  pendingGraphResize = false;
  try {
    graph.resize(width, height);
    await graph.fitCenter();
  } catch (error) {
    pendingGraphResize = true;
    console.error("Could not resize DAG graph", error);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
