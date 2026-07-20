import { strict as assert } from "assert";
import { DagModel, isDag, validateDag } from "./DagModel";
import type { Dag } from "./DagModel";
import { isUpdateDocumentMessage } from "./messages";
import type { UpdateDocumentMessage } from "./messages";
import { getDagTextUpdate } from "../utilities/getDagTextUpdate";
import { getMinimalTextReplacement } from "../utilities/getMinimalTextReplacement";
import { SaveCoordinator } from "../webview/SaveCoordinator";

const tests: Array<{ name: string; run: () => void }> = [];

function test(name: string, run: () => void): void {
  tests.push({ name, run });
}

test("accepts the existing JSON document structure", () => {
  assert.equal(
    isDag({
      nodes: [
        {
          name: "source",
          className: "example.Source",
          props: [{ name: "parallelism", value: "2", type: "Integer" }],
          udfs: [{ name: "normalize", udfs: [{ name: "trim" }] }],
        },
      ],
    }),
    true
  );
  assert.equal(isDag({ nodes: [{ name: "source", props: [{ name: "x", value: 1 }] }] }), false);
});

test("creates unique nodes and rewires an inserted node", () => {
  const model = new DagModel({
    nodes: [{ name: "source" }, { name: "sink", preNodes: ["source"] }],
  });

  const inserted = model.insertNewNode("source", "sink");

  assert.equal(inserted, "newNode-0");
  assert.deepEqual(model.getNode(inserted)?.preNodes, ["source"]);
  assert.deepEqual(model.getNode("sink")?.preNodes, [inserted]);
  assert.equal(model.addNewNode(), "newNode-1");
});

test("rejects duplicate, self-referencing, missing, and cyclic edges", () => {
  const model = new DagModel({
    nodes: [{ name: "a" }, { name: "b", preNodes: ["a"] }, { name: "c", preNodes: ["b"] }],
  });

  assert.equal(model.addEdge("a", "b"), false);
  assert.equal(model.addEdge("a", "a"), false);
  assert.equal(model.addEdge("missing", "a"), false);
  assert.equal(model.addEdge("c", "a"), false);
  assert.deepEqual(model.getNode("a")?.preNodes, undefined);
});

test("renames nodes and updates predecessor references in place", () => {
  const model = new DagModel({
    nodes: [{ name: "source" }, { name: "other" }, { name: "sink", preNodes: ["source", "other"] }],
  });

  assert.equal(model.changeNodeName("source", "input"), true);
  assert.deepEqual(model.getNode("sink")?.preNodes, ["input", "other"]);
  assert.equal(model.changeNodeName("input", "other"), false);
});

test("deletes nodes and removes all incoming references", () => {
  const model = new DagModel({
    nodes: [
      { name: "source" },
      { name: "left", preNodes: ["source"] },
      { name: "right", preNodes: ["source"] },
    ],
  });

  assert.equal(model.deleteNode("source"), true);
  assert.equal(model.getNode("source"), undefined);
  assert.equal(model.getNode("left")?.preNodes, undefined);
  assert.equal(model.getNode("right")?.preNodes, undefined);
  assert.equal(model.setNodesDisabledStatus(["left", "right"], true), true);
  assert.equal(model.getNode("left")?.disabled, true);
  assert.equal(model.setNodesDisabledStatus(["left", "missing"], false), true);
  assert.equal(model.getNode("left")?.disabled, undefined);
});

test("copies and pastes nodes with unique names and internal edges", () => {
  const source = new DagModel({
    nodes: [
      { name: "external" },
      { name: "source", className: "Source", udfs: [{ name: "normalize" }] },
      { name: "sink", preNodes: ["source", "external"], disabled: true },
    ],
  });
  const target = new DagModel({
    nodes: [{ name: "source" }, { name: "sink" }, { name: "sink-1" }],
  });

  const copiedNodes = source.getClipboardNodes(["source", "sink"]);
  assert.deepEqual(
    copiedNodes.map((node) => node.name),
    ["source", "sink"]
  );
  assert.deepEqual(copiedNodes.find((node) => node.name === "sink")?.preNodes, ["source"]);

  const pastedNodeIds = target.pasteClipboardNodes(copiedNodes);
  assert.deepEqual(pastedNodeIds, ["source-1", "sink-2"]);
  assert.deepEqual(target.getNode("sink-2")?.preNodes, ["source-1"]);
  assert.equal(target.getNode("sink-2")?.disabled, true);
  assert.equal(target.getNode("source-1")?.udfs?.[0]?.name, "normalize");
});

test("copies and pastes UDFs with unique sibling names", () => {
  const source = new DagModel({
    nodes: [
      {
        name: "source",
        udfs: [
          {
            name: "normalize",
            className: "Normalize",
            props: [{ name: "trim", value: "true", type: "Boolean" }],
            udfs: [{ name: "inner" }],
            disabled: true,
          },
        ],
      },
      { name: "target", udfs: [{ name: "normalize" }, { name: "normalize-1" }] },
    ],
  });

  const copiedUdfs = source.getClipboardUdfs(["source.normalize"]);
  assert.deepEqual(
    copiedUdfs.map((udf) => udf.name),
    ["normalize"]
  );

  const pastedUdfIds = source.pasteClipboardUdfs("target", copiedUdfs);
  assert.deepEqual(pastedUdfIds, ["target.normalize-2"]);
  assert.equal(source.getUdf("target.normalize-2")?.className, "Normalize");
  assert.equal(source.getUdf("target.normalize-2")?.props?.[0]?.name, "trim");
  assert.equal(source.getUdf("target.normalize-2")?.udfs?.[0]?.name, "inner");
  assert.equal(source.getUdf("target.normalize-2")?.disabled, true);
});

test("manages nested UDFs without changing their JSON shape", () => {
  const dag: Dag = {
    nodes: [{ name: "node", udfs: [{ name: "outer", udfs: [{ name: "inner" }] }] }],
  };
  const model = new DagModel(dag);

  assert.equal(model.getUdf("node.outer.inner")?.name, "inner");
  assert.equal(model.addNewUdf("node.outer"), "newUdf-0");
  assert.equal(model.changeUdfDisabledStatus("node.outer.newUdf-0"), true);
  assert.equal(model.getUdf("node.outer.newUdf-0")?.disabled, true);
  assert.equal(
    model.setUdfsDisabledStatus(["node.outer.inner", "node.outer.newUdf-0"], true),
    true
  );
  assert.equal(model.getUdf("node.outer.inner")?.disabled, true);
  assert.equal(model.setUdfsDisabledStatus(["node.outer.inner", "missing.udf"], false), true);
  assert.equal(model.getUdf("node.outer.inner")?.disabled, undefined);
  assert.equal(model.changeUdfName("node.outer.newUdf-0", "inner"), false);
  assert.equal(model.changeUdfName("node.outer.newUdf-0", "renamed"), true);
  assert.equal(model.getUdf("node.outer.renamed")?.disabled, true);
  assert.equal(model.deleteUdf("node.outer.inner"), true);
  assert.equal(model.getUdf("node.outer.inner"), undefined);
});

test("reports semantic validation issues without rejecting the structure", () => {
  const dag: Dag = {
    nodes: [
      { name: "a", preNodes: ["c"], udfs: [{ name: "same" }, { name: "same" }] },
      { name: "b", preNodes: ["a"] },
      { name: "c", preNodes: ["b", "missing"] },
      { name: "a" },
    ],
  };

  const codes = new Set(validateDag(dag).map((issue) => issue.code));
  assert.deepEqual(
    codes,
    new Set(["duplicate-node", "duplicate-udf", "missing-pre-node", "cycle"])
  );
  assert.ok(validateDag(dag).every((issue) => issue.location.length > 0));
});

test("validates Webview update messages at the extension boundary", () => {
  assert.equal(
    isUpdateDocumentMessage({
      type: "updateDocument",
      dag: { nodes: [{ name: "source" }] },
      baseRevision: 2,
      editorId: "editor-1",
      requestId: "request-1",
    }),
    true
  );
  assert.equal(
    isUpdateDocumentMessage({
      type: "updateDocument",
      dag: {},
      baseRevision: -1,
      editorId: "editor-1",
      requestId: "request-1",
    }),
    false
  );
  assert.equal(
    isUpdateDocumentMessage({
      type: "updateDocument",
      dag: { nodes: [{}] },
      baseRevision: 0,
      editorId: "editor-1",
      requestId: "request-1",
    }),
    false
  );
  assert.equal(
    isUpdateDocumentMessage({
      type: "updateDocument",
      dag: {},
      baseRevision: 0,
      editorId: "",
      requestId: "request-1",
    }),
    false
  );
});

test("computes a minimal text replacement with the same final JSON", () => {
  const currentText = '{\n  "nodes": [{ "name": "source" }]\n}';
  const nextText = '{\n  "nodes": [{ "name": "input" }]\n}';
  const replacement = getMinimalTextReplacement(currentText, nextText);
  const updatedText =
    currentText.slice(0, replacement.startOffset) +
    replacement.text +
    currentText.slice(replacement.endOffset);

  assert.equal(updatedText, nextText);
  assert.ok(replacement.text.length < nextText.length);
});

test("preserves JSON text when the DAG is semantically unchanged", () => {
  const currentText = '{"nodes":[{"className":"Source","name":"source"}]}';
  const dag: Dag = { nodes: [{ name: "source", className: "Source", disabled: undefined }] };

  assert.equal(getDagTextUpdate(currentText, dag), undefined);
  assert.equal(
    getDagTextUpdate(currentText, { nodes: [{ name: "renamed", className: "Source" }] }),
    '{\n  "nodes": [\n    {\n      "name": "renamed",\n      "className": "Source"\n    }\n  ]\n}'
  );
});

test("coalesces in-flight Webview saves and persists the latest generation", () => {
  let dag: Dag = { nodes: [{ name: "first" }] };
  const messages: UpdateDocumentMessage[] = [];
  const coordinator = new SaveCoordinator({
    editorId: "editor-test",
    getDag: () => dag,
    postMessage: (message) => messages.push(message),
    debounceDelayMs: 60_000,
    maximumWaitMs: 60_000,
  });

  coordinator.markChanged();
  coordinator.flush();
  assert.equal(messages.length, 1);
  assert.equal(messages[0]?.dag.nodes?.[0]?.name, "first");

  dag = { nodes: [{ name: "second" }] };
  coordinator.markChanged();
  coordinator.handleUpdateResult({
    type: "updateResult",
    status: "accepted",
    requestId: messages[0]?.requestId ?? "",
    revision: 1,
  });
  assert.equal(messages.length, 2);
  assert.equal(messages[1]?.baseRevision, 1);
  assert.equal(messages[1]?.dag.nodes?.[0]?.name, "second");

  coordinator.saveToDisk();
  coordinator.handleUpdateResult({
    type: "updateResult",
    status: "accepted",
    requestId: messages[1]?.requestId ?? "",
    revision: 2,
  });
  assert.equal(messages.length, 3);
  assert.equal(messages[2]?.persist, true);

  coordinator.saveToDisk();
  assert.equal(messages.length, 3);
  coordinator.handleUpdateResult({
    type: "updateResult",
    status: "accepted",
    requestId: messages[2]?.requestId ?? "",
    revision: 2,
  });
});

let failures = 0;
for (const { name, run } of tests) {
  try {
    run();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

if (failures > 0) {
  process.exitCode = 1;
} else {
  console.log(`All ${tests.length} unit tests passed.`);
}
