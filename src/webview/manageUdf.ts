import { Node, Udf, globalDag } from "./Dag";
import { getElement } from "./dom";
import { edit } from "./edit";
import switchView from "./switchView";

export const viewId = "manageUdfContainer";
export let currentPrefix = "";

let currentRightClickUdf: string | undefined;
let draggedItem: HTMLLIElement | undefined;
const selectedUdfIds = new Set<string>();

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
  list.addEventListener("dragover", (event) => event.preventDefault());
  list.addEventListener("dragend", handleDragEnd);
  getElement<HTMLDivElement>(`#${viewId}`).addEventListener("click", handleBlankClick);
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
  item.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    currentRightClickUdf = udf.name;
    updateDisableMenuText(fullUdfId);
    showMenu(event);
  });

  item.textContent =
    udf.udfs && udf.udfs.length > 0 ? `${udf.name} (${udf.udfs.length})` : udf.name;
  getUdfList().appendChild(item);
}

function handleMenuClick(event: MouseEvent): void {
  event.stopPropagation();
  const action = (event.currentTarget as HTMLLIElement).dataset.action;
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
    case "delete-udf":
      if (globalDag.deleteUdf(fullUdfId)) {
        selectedUdfIds.delete(fullUdfId);
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
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
  }
  setTimeout(() => draggedItem?.classList.add("moving"));
}

function handleDragEnter(event: DragEvent): void {
  event.preventDefault();
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
  draggedItem = undefined;

  const owner = getOwner(currentPrefix);
  if (!owner?.udfs) {
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

function updateDisableMenuText(anchorUdfId: string): void {
  const selectedIds = getSelectedUdfIds(anchorUdfId);
  const hasEnabledSelectedUdf = selectedIds.some((id) => {
    const udf = globalDag.getUdf(id);
    return udf && !globalDag.isUdfDisabled(udf);
  });
  setUdfMenuBulkMode(selectedIds.length > 1);
  getElement<HTMLLIElement>("#disableUdfMenuItem").textContent =
    selectedIds.length > 1
      ? hasEnabledSelectedUdf
        ? "禁用选中UDF"
        : "启用选中UDF"
      : hasEnabledSelectedUdf
      ? "禁用UDF"
      : "启用UDF";
}

function setUdfMenuBulkMode(isBulkMode: boolean): void {
  for (const item of document.querySelectorAll<HTMLLIElement>("#rightClickMenu li")) {
    item.style.display = isBulkMode && item.dataset.action !== "disable-udf" ? "none" : "";
  }
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
  return selectedUdfIds.has(anchorUdfId) ? Array.from(selectedUdfIds) : [anchorUdfId];
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
  return item && getUdfList().contains(item) ? item : undefined;
}

function getUdfList(): HTMLUListElement {
  return getElement<HTMLUListElement>(`#${viewId} ul`);
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
