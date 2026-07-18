import type { Dag } from "../model/DagModel";

export function getDagTextUpdate(currentText: string, dag: Dag): string | undefined {
  const nextText = JSON.stringify(dag, null, 2);
  const normalizedDag = JSON.parse(nextText) as unknown;
  let currentValue: unknown;
  try {
    currentValue = currentText.trim().length === 0 ? {} : JSON.parse(currentText);
  } catch {
    return nextText;
  }

  return isJsonEqual(currentValue, normalizedDag) ? undefined : nextText;
}

function isJsonEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => isJsonEqual(value, right[index]))
    );
  }
  if (!isRecord(left) || !isRecord(right)) {
    return false;
  }

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(right, key) && isJsonEqual(left[key], right[key])
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
