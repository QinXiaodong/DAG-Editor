import { graph } from "./graph";

const MAX_WHEEL_VALUE = 50;
const ZOOM_SENSITIVITY = 0.25;

export function registerGraphWheelZoomFallback(): void {
  const container = document.getElementById("canvasContainer");
  if (!container) {
    throw new Error("Missing graph canvas container");
  }

  container.addEventListener("wheel", handleWheel, { capture: true, passive: false });
}

function handleWheel(event: WheelEvent): void {
  event.preventDefault();

  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const origin: [number, number] = [event.clientX - rect.left, event.clientY - rect.top];
  const value = -normalizeWheelDelta(event, rect.height);
  const boundedValue = Math.max(-MAX_WHEEL_VALUE, Math.min(MAX_WHEEL_VALUE, value));
  const ratio = 1 + (boundedValue * ZOOM_SENSITIVITY) / 100;
  void graph.zoomTo(graph.getZoom() * ratio, false, origin);
}

function normalizeWheelDelta(event: WheelEvent, pageHeight: number): number {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    return event.deltaY * 16;
  }
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return event.deltaY * pageHeight;
  }
  return event.deltaY || event.deltaX;
}
