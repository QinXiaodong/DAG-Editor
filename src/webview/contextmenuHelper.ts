import type { AntVDagreLayoutOptions, Graph, LayoutOptions } from "@antv/g6";
import { globalDag } from "./Dag";
import { edit } from "./edit";
import { manageUdf } from "./manageUdf";

interface MenuItem {
  name: string;
  value: string;
}

type NodeAction = {
  type: "node";
  item:
    | "editNode"
    | "newDownstreamNode"
    | "newUpstreamNode"
    | "manageUdf"
    | "copyNode"
    | "copySelectedNodes"
    | "cutNode"
    | "cutSelectedNodes"
    | "deleteNode"
    | "deleteSelectedNodes"
    | "changeNodeDisabledStatus"
    | "disableSelectedNodes"
    | "enableSelectedNodes";
  id: string;
};

type EdgeAction = {
  type: "edge";
  item: "deleteEdge" | "insertNewNode";
  source: string;
  target: string;
};

type CanvasAction = {
  type: "canvas";
  item: "newNode" | "pasteNodes" | "fitView" | "fitCenter" | "changeRankdir";
};

type MenuAction = NodeAction | EdgeAction | CanvasAction;

const menuActions = new Map<string, MenuAction>();
let nextMenuActionId = 0;
let graph: Graph | undefined;
let refreshGraph: (() => Promise<void>) | undefined;
let refreshGraphAndFocus: ((nodeId: string | undefined) => Promise<void>) | undefined;

export function configureContextmenu(
  graphInstance: Graph,
  refresh: () => Promise<void>,
  refreshAndFocus: (nodeId: string | undefined) => Promise<void>
): void {
  graph = graphInstance;
  refreshGraph = refresh;
  refreshGraphAndFocus = refreshAndFocus;
}

export function contextmenuClickCallback(value: string): void {
  const action = menuActions.get(value);
  if (!action) {
    return;
  }
  menuActions.delete(value);

  switch (action.type) {
    case "node":
      handleNodeAction(action);
      break;
    case "edge":
      handleEdgeAction(action);
      break;
    case "canvas":
      handleCanvasAction(action);
      break;
  }
}

export function getContextmenuCallback(event: unknown): MenuItem[] {
  menuActions.clear();
  if (!isRecord(event) || typeof event.targetType !== "string") {
    return [];
  }

  switch (event.targetType) {
    case "node": {
      const id = getNestedString(event, "target", "id");
      return id ? getNodeMenuItems(id) : [];
    }
    case "edge": {
      const source = getNestedString(event, "target", "sourceNode", "id");
      const target = getNestedString(event, "target", "targetNode", "id");
      return source && target ? getEdgeMenuItems(source, target) : [];
    }
    case "canvas":
      return getCanvasMenuItems();
    default:
      return [];
  }
}

function handleNodeAction(action: NodeAction): void {
  switch (action.item) {
    case "editNode":
      edit(action.id);
      break;
    case "newDownstreamNode":
      commitChanges(globalDag.addNewDownstreamNode(action.id));
      break;
    case "newUpstreamNode":
      commitChanges(globalDag.addNewUpstreamNode(action.id));
      break;
    case "manageUdf":
      manageUdf(action.id);
      break;
    case "copyNode":
      globalDag.copyNodesToClipboard([action.id]);
      break;
    case "copySelectedNodes":
      globalDag.copyNodesToClipboard(getSelectedNodeIds(action.id));
      break;
    case "cutNode":
      globalDag.cutNodesToClipboard([action.id]);
      break;
    case "cutSelectedNodes":
      globalDag.cutNodesToClipboard(getSelectedNodeIds(action.id));
      break;
    case "deleteNode":
      globalDag.deleteNode(action.id);
      commitChanges();
      break;
    case "deleteSelectedNodes":
      if (deleteSelectedNodes(action.id)) {
        clearSelectedNodeStates();
        commitChanges();
      }
      break;
    case "changeNodeDisabledStatus":
      globalDag.changeNodeDisabledStatus(action.id);
      clearSelectedNodeStates();
      commitChanges();
      break;
    case "disableSelectedNodes":
      if (globalDag.setNodesDisabledStatus(getSelectedNodeIds(action.id), true)) {
        clearSelectedNodeStates();
        commitChanges();
      }
      break;
    case "enableSelectedNodes":
      if (globalDag.setNodesDisabledStatus(getSelectedNodeIds(action.id), false)) {
        clearSelectedNodeStates();
        commitChanges();
      }
      break;
  }
}

function handleEdgeAction(action: EdgeAction): void {
  if (action.item === "deleteEdge") {
    globalDag.deleteEdge(action.source, action.target);
  } else {
    globalDag.insertNewNode(action.source, action.target);
  }
  commitChanges();
}

function handleCanvasAction(action: CanvasAction): void {
  switch (action.item) {
    case "newNode":
      commitChanges(globalDag.addNewNode());
      break;
    case "pasteNodes":
      globalDag.requestPasteNodesFromClipboard();
      break;
    case "fitView":
      void getGraph().fitView();
      break;
    case "fitCenter":
      void getGraph().fitCenter();
      break;
    case "changeRankdir":
      changeRankdir();
      break;
  }
}

function commitChanges(focusNodeId?: string): void {
  globalDag.post();
  if (focusNodeId) {
    void refreshGraphAndFocus?.(focusNodeId);
  } else {
    void refreshGraph?.();
  }
}

function changeRankdir(): void {
  const graphInstance = getGraph();
  const layoutOptions = graphInstance.getLayout() as AntVDagreLayoutOptions;
  layoutOptions.rankdir = layoutOptions.rankdir === "LR" ? "TB" : "LR";
  graphInstance.setLayout(layoutOptions as LayoutOptions);
  void graphInstance.layout().then(() => graphInstance.fitCenter());
}

function getGraph(): Graph {
  if (!graph) {
    throw new Error("Context menu graph has not been configured.");
  }
  return graph;
}

function clearSelectedNodeStates(): void {
  const graphInstance = getGraph();
  const states = Object.fromEntries(
    getDagGraphNodeIds(graphInstance).map((nodeId) => {
      return [
        nodeId,
        graphInstance.getElementState(nodeId).filter((state) => state !== "selected"),
      ];
    })
  );
  void graphInstance.setElementState(states, false);
}

function deleteSelectedNodes(anchorNodeId: string): boolean {
  let changed = false;
  for (const nodeId of getSelectedNodeIds(anchorNodeId)) {
    changed = globalDag.deleteNode(nodeId) || changed;
  }
  return changed;
}

function getNodeMenuItems(id: string): MenuItem[] {
  const selectedNodeIds = getSelectedNodeIds(id);
  const hasEnabledSelectedNode = selectedNodeIds.some((nodeId) => !globalDag.isDisabled(nodeId));
  const disabledMenuItem =
    selectedNodeIds.length > 1
      ? createMenuItem(hasEnabledSelectedNode ? "禁用选中节点" : "启用选中节点", {
          type: "node",
          item: hasEnabledSelectedNode ? "disableSelectedNodes" : "enableSelectedNodes",
          id,
        })
      : createMenuItem(globalDag.isDisabled(id) ? "启用节点" : "禁用节点", {
          type: "node",
          item: "changeNodeDisabledStatus",
          id,
        });

  if (selectedNodeIds.length > 1) {
    return [
      createMenuItem("复制选中节点", { type: "node", item: "copySelectedNodes", id }),
      createMenuItem("剪切选中节点", { type: "node", item: "cutSelectedNodes", id }),
      createMenuItem("删除选中节点", { type: "node", item: "deleteSelectedNodes", id }),
      disabledMenuItem,
    ];
  }

  return [
    createMenuItem("编辑节点", { type: "node", item: "editNode", id }),
    createMenuItem("管理UDF", { type: "node", item: "manageUdf", id }),
    createMenuItem("复制节点", { type: "node", item: "copyNode", id }),
    createMenuItem("剪切节点", { type: "node", item: "cutNode", id }),
    createMenuItem("新建下游节点", { type: "node", item: "newDownstreamNode", id }),
    createMenuItem("新建上游节点", { type: "node", item: "newUpstreamNode", id }),
    createMenuItem("删除节点", { type: "node", item: "deleteNode", id }),
    disabledMenuItem,
  ];
}

function getEdgeMenuItems(source: string, target: string): MenuItem[] {
  return [
    createMenuItem("删除边", { type: "edge", item: "deleteEdge", source, target }),
    createMenuItem("插入新节点", { type: "edge", item: "insertNewNode", source, target }),
  ];
}

function getCanvasMenuItems(): MenuItem[] {
  return [
    createMenuItem("新建节点", { type: "canvas", item: "newNode" }),
    createMenuItem("粘贴节点", { type: "canvas", item: "pasteNodes" }),
    createMenuItem("画面自适应", { type: "canvas", item: "fitView" }),
    createMenuItem("画面居中", { type: "canvas", item: "fitCenter" }),
    createMenuItem("调整布局方向", { type: "canvas", item: "changeRankdir" }),
  ];
}

function createMenuItem(name: string, action: MenuAction): MenuItem {
  const value = `menu-action-${nextMenuActionId++}`;
  menuActions.set(value, action);
  return { name, value };
}

function getSelectedNodeIds(anchorNodeId: string): string[] {
  const graphInstance = getGraph();
  const selectedIds = getDagGraphNodeIds(graphInstance).filter((id) =>
    graphInstance.getElementState(id).includes("selected")
  );

  return selectedIds.includes(anchorNodeId) ? selectedIds : [anchorNodeId];
}

function getDagGraphNodeIds(graphInstance: Graph): string[] {
  return graphInstance
    .getNodeData()
    .map(({ id }) => String(id))
    .filter((id) => Boolean(globalDag.getNode(id)));
}

function getNestedString(value: Record<string, unknown>, ...path: string[]): string | undefined {
  let current: unknown = value;
  for (const segment of path) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[segment];
  }
  return typeof current === "string" ? current : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
