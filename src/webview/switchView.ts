export type ViewId = "canvasContainer" | "editContainer" | "manageUdfContainer";

export let currentViewId: ViewId = "canvasContainer";

export default function switchView(viewId: ViewId): void {
  currentViewId = viewId;

  for (const view of document.querySelectorAll<HTMLDivElement>("body > div.view")) {
    view.style.display = "none";
  }

  const canvasContainer = getView("canvasContainer");
  canvasContainer.style.visibility = viewId === "canvasContainer" ? "visible" : "hidden";

  if (viewId !== "canvasContainer") {
    getView(viewId).style.display = "block";
  }
}

function getView(viewId: ViewId): HTMLDivElement {
  const view = document.getElementById(viewId);
  if (!(view instanceof HTMLDivElement)) {
    throw new Error(`Missing required view: ${viewId}`);
  }
  return view;
}
