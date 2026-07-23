import type { Node, Udf } from "./Dag";
import { globalDag } from "./Dag";
import { getElement } from "./dom";
import { edit } from "./edit";
import switchView from "./switchView";

export const viewId = "manageUdfContainer";
export let currentPrefix = "";

let currentRightClickUdf: string | undefined;
let draggedItem: HTMLLIElement | undefined;
let dragPreview: HTMLLIElement | undefined;
let dragPreviewOffset: { x: number; y: number } | undefined;
let dragStartPoint: { x: number; y: number } | undefined;
const selectedUdfIds = new Set<string>();
const UDF_DRAG_PREVIEW_SCALE = 1.01;

export function setCurrentPrefix(prefix: string): void {
  currentPrefix = prefix;
}

export function clearSelectedUdfs(): void {
  selectedUdfIds.clear();
  updateSelectedClasses();
}

export function registerManageUdfEvents(): void {
  for (const item of document.querySelectorAll<HTMLLIElement>("#rightClickMenu li")) {
    item.addEventListener("click", handleMenuClick);
  }

  getElement<HTMLButtonElement>("#addUdf").addEventListener("click", (event) => {
    event.preventDefault();
    if (globalDag.addNewUdf(currentPrefix)) {
      commitUdfChanges();
    }
  });

  const list = getUdfList();
  list.addEventListener("dragstart", handleDragStart);
  list.addEventListener("dragenter", handleDragEnter);
  list.addEventListener("dragover", handleDragOver);
  list.addEventListener("dragend", handleDragEnd);

  const container = getElement<HTMLDivElement>(`#${viewId}`);
  container.addEventListener("click", handleBlankClick);
  container.addEventListener("contextmenu", handleBlankContextMenu);
}

export function manageUdf(prefix: string): void {
  const owner = getOwner(prefix);
  if (!owner) {
    switchView("canvasContainer");
    return;
  }

  currentPrefix = prefix;
  pruneSelectedUdfs(owner);
  getElement<HTMLDivElement>(`#${viewId} #prefix`).textContent = currentPrefix;
  getElement<HTMLDivElement>(`#${viewId} .innerDiv`).style.borderStyle =
    owner.disabled === true ? "dashed" : "solid";

  const udfList = getUdfList();
  udfList.replaceChildren();
  for (const [index, udf] of (owner.udfs ?? []).entries()) {
    addUdf(udf, index);
  }

  switchView(viewId);
}

export function addUdf(udf: Udf, index: number): void {
  const item = document.createElement("li");
  const fullUdfId = getFullUdfId(udf.name);
  item.draggable = true;
  item.dataset.udfName = udf.name;
  item.dataset.udfIndex = `${index}`;
  item.dataset.udfId = fullUdfId;

  item.classList.toggle("disabled", globalDag.isUdfDisabled(udf));
  item.classList.toggle("selected", selectedUdfIds.has(fullUdfId));
  item.addEventListener("click", (event) => handleUdfClick(item, event));
  item.addEventListener("dblclick", (event) => {
    event.preventDefault();
    event.stopPropagation();
    selectedUdfIds.clear();
    manageUdf(fullUdfId);
  });
  item.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
    currentRightClickUdf = udf.name;
    updateUdfMenu(fullUdfId);
    showMenu(event);
  });

  item.textContent =
    udf.udfs && udf.udfs.length > 0 ? `${udf.name} (${udf.udfs.length})` : udf.name;
  getUdfList().appendChild(item);
}

export function copySelectedUdfs(): void {
  copyUdfs(getCurrentSelectedUdfIds());
}

export function cutSelectedUdfs(): void {
  cutUdfs(getCurrentSelectedUdfIds());
}

export function deleteUdfs(udfIds: string[]): void {
  let changed = false;
  for (const udfId of udfIds) {
    changed = globalDag.deleteUdf(udfId) || changed;
  }
  if (!changed) {
    return;
  }

  selectedUdfIds.clear();
  commitUdfChanges();
}

export function pasteClipboardUdfs(udfs: Udf[]): void {
  const pastedUdfIds = globalDag.pasteUdfsFromClipboard(currentPrefix, udfs);
  if (pastedUdfIds.length === 0) {
    return;
  }

  selectedUdfIds.clear();
  for (const udfId of pastedUdfIds) {
    selectedUdfIds.add(udfId);
  }
  commitUdfChanges();
}

function handleMenuClick(event: MouseEvent): void {
  event.stopPropagation();
  const action = (event.currentTarget as HTMLLIElement).dataset.action;
  if (action === "paste-udf") {
    globalDag.requestPasteUdfsFromClipboard();
    closeMenu();
    return;
  }
  if (!currentRightClickUdf) {
    closeMenu();
    return;
  }

  const fullUdfId = getFullUdfId(currentRightClickUdf);
  switch (action) {
    case "edit-udf":
      clearSelectedUdfs();
      edit(fullUdfId);
      break;
    case "copy-udf":
      copyUdfs(getSelectedUdfIds(fullUdfId));
      break;
    case "cut-udf":
      cutUdfs(getSelectedUdfIds(fullUdfId));
      break;
    case "delete-udf":
      if (deleteSelectedUdfs(fullUdfId)) {
        selectedUdfIds.clear();
        commitUdfChanges();
      }
      break;
    case "disable-udf":
      if (changeSelectedUdfDisabledStatus(fullUdfId)) {
        selectedUdfIds.clear();
        commitUdfChanges();
      }
      break;
    case "manage-udf":
      manageUdf(fullUdfId);
      break;
  }
  closeMenu();
}

function handleDragStart(event: DragEvent): void {
  const item = getListItem(event.target);
  if (!item) {
    return;
  }

  draggedItem = item;
  dragStartPoint = { x: event.clientX, y: event.clientY };
  const startingOrder = getCurrentUdfOrder();
  getUdfList().classList.add("dragging");
  item.classList.add("dragging-source");
  item.dataset.dragStartOrder = JSON.stringify(startingOrder);
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", item.dataset.udfId ?? "");
    const rect = item.getBoundingClientRect();
    dragPreview = createUdfDragPreview(item, rect);
    dragPreviewOffset = {
      x: (event.clientX - rect.left) * UDF_DRAG_PREVIEW_SCALE,
      y: (event.clientY - rect.top) * UDF_DRAG_PREVIEW_SCALE,
    };
    updateDragPreviewPosition(event);
    const nativeDragImage = createTransparentDragImage();
    event.dataTransfer.setDragImage(nativeDragImage, 0, 0);
    window.addEventListener("dragover", updateDragPreviewPosition);
    setTimeout(() => nativeDragImage.remove());
  }
  setTimeout(() => draggedItem?.classList.add("moving"));
}

function handleDragOver(event: DragEvent): void {
  event.preventDefault();
  updateDragPreviewPosition(event);
}

function handleDragEnter(event: DragEvent): void {
  event.preventDefault();
  updateDragPreviewPosition(event);
  const targetItem = getListItem(event.target);
  if (!draggedItem || !targetItem || targetItem === draggedItem) {
    return;
  }

  const list = getUdfList();
  const items = Array.from(list.children);
  const currentIndex = items.indexOf(draggedItem);
  const targetIndex = items.indexOf(targetItem);
  if (currentIndex < targetIndex) {
    targetItem.after(draggedItem);
  } else {
    targetItem.before(draggedItem);
  }
}

function handleDragEnd(): void {
  if (!draggedItem) {
    return;
  }
  draggedItem.classList.remove("moving");
  draggedItem.classList.remove("dragging-source");
  dragPreview?.remove();
  dragPreview = undefined;
  dragPreviewOffset = undefined;
  window.removeEventListener("dragover", updateDragPreviewPosition);
  const startingOrder = parseUdfOrder(draggedItem.dataset.dragStartOrder);
  delete draggedItem.dataset.dragStartOrder;
  draggedItem = undefined;
  const list = getUdfList();
  suppressDragStartPositionHover();
  list.classList.remove("dragging");

  const owner = getOwner(currentPrefix);
  if (!owner?.udfs) {
    return;
  }

  const nextOrder = getCurrentUdfOrder();
  if (startingOrder && isSameOrder(startingOrder, nextOrder)) {
    return;
  }

  owner.udfs = Array.from(getUdfList().children)
    .map((item) => owner.udfs?.[Number((item as HTMLLIElement).dataset.udfIndex)])
    .filter((udf): udf is Udf => Boolean(udf));
  globalDag.post();
}

function handleUdfClick(item: HTMLLIElement, event: MouseEvent): void {
  event.stopPropagation();
  const fullUdfId = item.dataset.udfId;
  if (!fullUdfId) {
    return;
  }

  if (event.ctrlKey || event.metaKey) {
    if (selectedUdfIds.has(fullUdfId)) {
      selectedUdfIds.delete(fullUdfId);
    } else {
      selectedUdfIds.add(fullUdfId);
    }
  } else {
    selectedUdfIds.clear();
    selectedUdfIds.add(fullUdfId);
  }
  updateSelectedClasses();
}

function handleBlankClick(event: MouseEvent): void {
  const target = event.target instanceof Element ? event.target : undefined;
  if (
    getListItem(event.target) ||
    target?.closest("button") ||
    target?.closest("#rightClickMenu")
  ) {
    return;
  }
  selectedUdfIds.clear();
  updateSelectedClasses();
}

function handleBlankContextMenu(event: MouseEvent): void {
  const target = event.target instanceof Element ? event.target : undefined;
  if (
    getListItem(event.target) ||
    target?.closest("button") ||
    target?.closest("#rightClickMenu")
  ) {
    return;
  }

  event.preventDefault();
  currentRightClickUdf = undefined;
  setUdfMenuMode("blank");
  showMenu(event);
}

function updateUdfMenu(anchorUdfId: string): void {
  const selectedIds = getSelectedUdfIds(anchorUdfId);
  const hasEnabledSelectedUdf = selectedIds.some((id) => {
    const udf = globalDag.getUdf(id);
    return udf && !globalDag.isUdfDisabled(udf);
  });
  const isBulkMode = selectedIds.length > 1;
  setUdfMenuMode(isBulkMode ? "bulk" : "item");
  setUdfMenuText("copy-udf", isBulkMode ? "复制选中UDF" : "复制UDF");
  setUdfMenuText("cut-udf", isBulkMode ? "剪切选中UDF" : "剪切UDF");
  setUdfMenuText("delete-udf", isBulkMode ? "删除选中UDF" : "删除UDF");
  getElement<HTMLLIElement>("#disableUdfMenuItem").textContent = isBulkMode
    ? hasEnabledSelectedUdf
      ? "禁用选中UDF"
      : "启用选中UDF"
    : hasEnabledSelectedUdf
    ? "禁用UDF"
    : "启用UDF";
}

function setUdfMenuMode(mode: "item" | "bulk" | "blank"): void {
  for (const item of document.querySelectorAll<HTMLLIElement>("#rightClickMenu li")) {
    const action = item.dataset.action;
    const isBulkAction =
      action === "copy-udf" ||
      action === "cut-udf" ||
      action === "delete-udf" ||
      action === "disable-udf";
    item.style.display =
      (mode === "blank" && action !== "paste-udf") || (mode === "bulk" && !isBulkAction)
        ? "none"
        : "";
  }
}

function setUdfMenuText(action: string, text: string): void {
  getElement<HTMLLIElement>(`#rightClickMenu li[data-action="${action}"]`).textContent = text;
}

function copyUdfs(udfIds: string[]): void {
  globalDag.copyUdfsToClipboard(udfIds);
}

function cutUdfs(udfIds: string[]): void {
  globalDag.cutUdfsToClipboard(udfIds);
}

function deleteSelectedUdfs(anchorUdfId: string): boolean {
  let changed = false;
  for (const udfId of getSelectedUdfIds(anchorUdfId)) {
    changed = globalDag.deleteUdf(udfId) || changed;
  }
  return changed;
}

function changeSelectedUdfDisabledStatus(anchorUdfId: string): boolean {
  const selectedIds = getSelectedUdfIds(anchorUdfId);
  const shouldDisable = selectedIds.some((id) => {
    const udf = globalDag.getUdf(id);
    return udf && !globalDag.isUdfDisabled(udf);
  });
  return globalDag.setUdfsDisabledStatus(selectedIds, shouldDisable);
}

function getSelectedUdfIds(anchorUdfId: string): string[] {
  const currentSelectedIds = getCurrentSelectedUdfIds();
  return currentSelectedIds.includes(anchorUdfId) ? currentSelectedIds : [anchorUdfId];
}

function getCurrentSelectedUdfIds(): string[] {
  return Array.from(getUdfList().children)
    .map((item) => (item as HTMLLIElement).dataset.udfId)
    .filter((id): id is string => typeof id === "string" && selectedUdfIds.has(id));
}

function updateSelectedClasses(): void {
  for (const item of getUdfList().children) {
    const listItem = item as HTMLLIElement;
    listItem.classList.toggle("selected", selectedUdfIds.has(listItem.dataset.udfId ?? ""));
  }
}

function pruneSelectedUdfs(owner: Node | Udf): void {
  const visibleUdfIds = new Set((owner.udfs ?? []).map((udf) => getFullUdfId(udf.name)));
  for (const selectedUdfId of selectedUdfIds) {
    if (!visibleUdfIds.has(selectedUdfId)) {
      selectedUdfIds.delete(selectedUdfId);
    }
  }
}

function getOwner(prefix: string): Node | Udf | undefined {
  return prefix.includes(".") ? globalDag.getUdf(prefix) : globalDag.getNode(prefix);
}

function commitUdfChanges(): void {
  globalDag.post();
  manageUdf(currentPrefix);
}

function getListItem(target: EventTarget | null): HTMLLIElement | undefined {
  if (!(target instanceof Element)) {
    return undefined;
  }
  const item = target.closest<HTMLLIElement>("li");
  return item?.parentElement === getUdfList() ? item : undefined;
}

function getUdfList(): HTMLUListElement {
  return getElement<HTMLUListElement>(`#${viewId} ul`);
}

function suppressDragStartPositionHover(): void {
  if (!dragStartPoint) {
    return;
  }

  const target = document.elementFromPoint(dragStartPoint.x, dragStartPoint.y);
  dragStartPoint = undefined;
  const item = getListItem(target);
  if (!item) {
    return;
  }

  item.classList.add("suppress-hover");
  const restoreHover = () => {
    item.classList.remove("suppress-hover");
    window.removeEventListener("mousemove", restoreHover);
  };
  window.addEventListener("mousemove", restoreHover);
}

function getCurrentUdfOrder(): string[] {
  return Array.from(getUdfList().children)
    .map((item) => (item as HTMLLIElement).dataset.udfId)
    .filter((id): id is string => typeof id === "string");
}

function parseUdfOrder(value: string | undefined): string[] | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) && parsed.every((id) => typeof id === "string")
      ? parsed
      : undefined;
  } catch {
    return undefined;
  }
}

function isSameOrder(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function updateDragPreviewPosition(event: DragEvent): void {
  if (!dragPreview || !dragPreviewOffset || event.clientX === 0 || event.clientY === 0) {
    return;
  }

  dragPreview.style.left = `${event.clientX - dragPreviewOffset.x}px`;
  dragPreview.style.top = `${event.clientY - dragPreviewOffset.y}px`;
}

function createUdfDragPreview(item: HTMLLIElement, rect: DOMRect): HTMLLIElement {
  const style = getComputedStyle(item);
  const dragPreviewElement = item.cloneNode(true) as HTMLLIElement;
  dragPreviewElement.classList.remove("moving");
  dragPreviewElement.classList.add("drag-image");
  dragPreviewElement.style.width = `${rect.width * UDF_DRAG_PREVIEW_SCALE}px`;
  dragPreviewElement.style.height = `${rect.height * UDF_DRAG_PREVIEW_SCALE}px`;
  dragPreviewElement.style.fontSize = `${parseFloat(style.fontSize) * UDF_DRAG_PREVIEW_SCALE}px`;
  document.body.appendChild(dragPreviewElement);
  return dragPreviewElement;
}

function createTransparentDragImage(): HTMLDivElement {
  const element = document.createElement("div");
  element.style.height = "1px";
  element.style.left = "-10000px";
  element.style.opacity = "0";
  element.style.position = "fixed";
  element.style.top = "-10000px";
  element.style.width = "1px";
  document.body.appendChild(element);
  return element;
}

function getFullUdfId(udfName: string): string {
  return `${currentPrefix}.${udfName}`;
}

function showMenu(event: MouseEvent): void {
  const menu = getElement<HTMLDivElement>("#rightClickMenu");
  menu.style.display = "block";
  menu.style.top = `${event.clientY + document.documentElement.scrollTop}px`;
  menu.style.left = `${event.clientX + document.documentElement.scrollLeft}px`;
  window.addEventListener("click", closeMenu, { once: true });
}

function closeMenu(): void {
  getElement<HTMLDivElement>("#rightClickMenu").style.display = "none";
  currentRightClickUdf = undefined;
  window.removeEventListener("click", closeMenu);
}
