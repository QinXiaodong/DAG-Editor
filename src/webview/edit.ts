import { Prop, globalDag } from "./Dag";
import { getElement } from "./dom";
import switchView from "./switchView";

const viewId = "editContainer";
const stringType = "String";
const propTypes = [stringType, "Integer", "Long", "Double", "Boolean"];

export let currentId = "";

let lastPropId = "";
let lastPropElement = "";
let lastCursorPos = -1;
let globalPropId = 0;
let targetElement: HTMLElement | undefined;
let formDirty = false;

export function registerEditEvents(): void {
  const nameInput = getInput("name");
  const classNameInput = getInput("className");

  registerPersistentInput(nameInput, "nameInput");
  registerPersistentInput(classNameInput, "classNameInput");

  getElement<HTMLButtonElement>("#addProp").addEventListener("click", (event) => {
    event.preventDefault();
    addProp(undefined, `${globalPropId++}`);
  });
  getElement<HTMLButtonElement>("#addProp").addEventListener("focus", () => {
    lastPropElement = "";
    lastPropId = "";
  });
  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element) || !event.target.closest(`#${viewId} .propTypePicker`)) {
      closePropTypePickers();
    }
  });
}

export function edit(id: string, options: EditOptions = {}): void {
  const { restoreFocus = true } = options;
  formDirty = false;
  globalPropId = 0;
  currentId = id;
  clearAlert();

  const object = globalDag.getNodeOrUdf(id);
  if (!object) {
    return;
  }

  const nameInput = getInput("name");
  nameInput.value = getLocalName(id);
  restoreTarget(nameInput, "nameInput", "-1");

  const classNameInput = getInput("className");
  classNameInput.value = object.className ?? "";
  restoreTarget(classNameInput, "classNameInput", "-1");

  const propsContainer = getElement<HTMLDivElement>(`#${viewId} #props`);
  propsContainer.replaceChildren();

  let propId = 0;
  for (const prop of object.props ?? []) {
    addProp(prop, `${propId++}`);
  }

  if (restoreFocus) {
    focusTargetElement();
  } else {
    targetElement = undefined;
  }
  globalPropId = propId;
  switchView(viewId);
}

export function save(): boolean {
  const object = globalDag.getNodeOrUdf(currentId);
  if (!object) {
    formDirty = false;
    switchView("canvasContainer");
    return true;
  }

  const nameInput = getInput("name");
  const newName = nameInput.value;
  const oldName = getLocalName(currentId);
  const parentId = getParentId(currentId);
  const hasDuplicate = currentId.includes(".")
    ? newName !== oldName && Boolean(globalDag.getUdf(`${parentId}.${newName}`))
    : newName !== oldName && Boolean(globalDag.getNode(newName));

  if (hasDuplicate) {
    showNameAlert(
      `${currentId.includes(".") ? "UDF" : "Node"} [ ${newName} ] already exists. Please rename it.`
    );
    return false;
  }
  if (newName.length === 0) {
    showNameAlert("Name cannot be empty, please rename it.");
    return false;
  }
  if (newName.includes(".")) {
    showNameAlert("Name can not include dot, please rename it.");
    return false;
  }

  if (currentId.includes(".")) {
    if (!globalDag.changeUdfName(currentId, newName)) {
      showNameAlert(`UDF [ ${newName} ] already exists. Please rename it.`);
      return false;
    }
    currentId = `${parentId}.${newName}`;
  } else {
    globalDag.changeNodeName(currentId, newName);
    currentId = newName;
  }

  object.className = getInput("className").value;
  object.props = extractProps();
  formDirty = false;
  globalDag.post();
  return true;
}

export function flushPendingSave(): boolean {
  return !formDirty || save();
}

function registerPersistentInput(input: HTMLInputElement, elementName: string): void {
  input.addEventListener("focus", () => {
    lastPropId = "-1";
    lastPropElement = elementName;
    lastCursorPos = input.selectionStart ?? -1;
  });
  input.addEventListener("input", () => {
    lastPropId = "-1";
    lastPropElement = elementName;
    lastCursorPos = input.selectionStart ?? -1;
    formDirty = true;
    save();
  });
}

function addProp(prop: Prop | undefined, id: string): void {
  if (!prop) {
    lastPropElement = "propNameInput";
    lastPropId = id;
  }

  const row = document.createElement("div");
  row.id = id;
  row.className = "propRow";

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.textContent = "Remove";
  removeButton.className = "removeButton";
  removeButton.addEventListener("click", () => {
    row.remove();
    save();
  });
  removeButton.addEventListener("focus", () => trackPropFocus(row.id, "remove", -1));
  row.appendChild(removeButton);
  restoreTarget(removeButton, "remove", id);

  const typePicker = createPropTypePicker(prop?.type ?? stringType, row.id);
  row.append(typePicker, document.createTextNode(" "));
  restoreTarget(
    getElement<HTMLButtonElement>("button.propTypeToggle", typePicker),
    "typeSelect",
    id
  );

  const propNameInput = createPropInput("Name", "propName", prop?.name ?? "");
  registerPropInput(propNameInput, row.id, "propNameInput");
  row.append(propNameInput, document.createTextNode(" "));
  restoreTarget(propNameInput, "propNameInput", id);

  const propValueInput = createPropInput("Value", "propValue", prop?.value ?? "");
  registerPropInput(propValueInput, row.id, "propValueInput");
  row.appendChild(propValueInput);
  restoreTarget(propValueInput, "propValueInput", id);

  getElement<HTMLDivElement>(`#${viewId} #props`).appendChild(row);
}

function createPropInput(placeholder: string, className: string, value: string): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = placeholder;
  input.className = className;
  input.required = true;
  input.value = value;
  return input;
}

function createPropTypePicker(value: string, propId: string): HTMLDivElement {
  const picker = document.createElement("div");
  picker.className = "propTypePicker";

  const input = document.createElement("input");
  input.type = "hidden";
  input.className = "propType";
  input.value = propTypes.includes(value) ? value : stringType;
  picker.appendChild(input);

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "propTypeToggle";
  toggle.setAttribute("aria-haspopup", "listbox");
  toggle.setAttribute("aria-expanded", "false");
  toggle.textContent = input.value;
  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = picker.classList.contains("open");
    closePropTypePickers();
    if (!isOpen) {
      picker.classList.add("open");
      toggle.setAttribute("aria-expanded", "true");
    }
  });
  toggle.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closePropTypePickers();
      toggle.focus();
    }
  });
  toggle.addEventListener("focus", () => trackPropFocus(propId, "typeSelect", -1));
  picker.appendChild(toggle);

  const list = document.createElement("div");
  list.className = "propTypeOptions";
  list.setAttribute("role", "listbox");
  for (const type of propTypes) {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "propTypeOption";
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", `${type === input.value}`);
    option.textContent = type;
    option.addEventListener("click", (event) => {
      event.stopPropagation();
      input.value = type;
      toggle.textContent = type;
      updateSelectedPropTypeOption(list, type);
      trackPropFocus(propId, "typeSelect", -1);
      closePropTypePickers();
      save();
      toggle.focus();
    });
    list.appendChild(option);
  }
  picker.appendChild(list);

  return picker;
}

function updateSelectedPropTypeOption(list: HTMLElement, value: string): void {
  for (const option of list.querySelectorAll<HTMLButtonElement>(".propTypeOption")) {
    option.setAttribute("aria-selected", `${option.textContent === value}`);
  }
}

function closePropTypePickers(): void {
  for (const picker of document.querySelectorAll<HTMLElement>(`#${viewId} .propTypePicker.open`)) {
    picker.classList.remove("open");
    getElement<HTMLButtonElement>("button.propTypeToggle", picker).setAttribute(
      "aria-expanded",
      "false"
    );
  }
}

function registerPropInput(input: HTMLInputElement, propId: string, elementName: string): void {
  input.addEventListener("input", () => {
    trackPropFocus(propId, elementName, input.selectionStart ?? -1);
    formDirty = true;
    save();
  });
  input.addEventListener("focus", () => {
    if (lastPropId !== propId || lastPropElement !== elementName) {
      lastCursorPos = input.selectionStart ?? -1;
    }
    lastPropId = propId;
    lastPropElement = elementName;
  });
}

function trackPropFocus(propId: string, elementName: string, cursorPos: number): void {
  lastPropId = propId;
  lastPropElement = elementName;
  lastCursorPos = cursorPos;
}

function restoreTarget(element: HTMLElement, elementName: string, id: string): void {
  if (lastPropElement === elementName && lastPropId === id) {
    targetElement = element;
  }
}

function focusTargetElement(): void {
  if (!targetElement) {
    return;
  }

  targetElement.focus();
  if (targetElement instanceof HTMLInputElement && lastCursorPos >= 0) {
    targetElement.setSelectionRange(lastCursorPos, lastCursorPos);
  }
  targetElement = undefined;
}

function extractProps(): Prop[] | undefined {
  const rows = getElement<HTMLDivElement>(`#${viewId} #props`).children;
  const props = Array.from(rows, (row): Prop => {
    const type = getElement<HTMLInputElement>("input.propType", row).value;
    return {
      name: getElement<HTMLInputElement>("input.propName", row).value,
      value: getElement<HTMLInputElement>("input.propValue", row).value,
      type: type === stringType ? undefined : type,
    };
  });
  return props.length > 0 ? props : undefined;
}

function showNameAlert(message: string): void {
  clearAlert();
  const alert = document.createElement("div");
  alert.style.marginBottom = "20px";
  alert.id = "alert";
  alert.textContent = message;

  const inputGroup = getElement<HTMLDivElement>(`#${viewId} #input-group1`);
  inputGroup.insertBefore(alert, getElement<HTMLDivElement>(`#${viewId} #classNameDiv`));

  const nameInput = getInput("name");
  nameInput.focus();
}

function clearAlert(): void {
  document.querySelector(`#${viewId} #input-group1 #alert`)?.remove();
}

function getLocalName(id: string): string {
  return id.slice(id.lastIndexOf(".") + 1);
}

function getParentId(id: string): string {
  return id.slice(0, id.lastIndexOf("."));
}

function getInput(id: string): HTMLInputElement {
  return getElement<HTMLInputElement>(`#${viewId} #${id}`);
}

interface EditOptions {
  restoreFocus?: boolean;
}
