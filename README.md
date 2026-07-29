# DAG Editor Extension

DAG Editor is a VS Code custom editor for `*.dag.json` documents used by ETL programs such as Flink jobs.

## Features

- Create, edit, rename, disable, and delete DAG nodes.
- Create and remove edges, or insert a node into an existing edge.
- Edit typed node properties.
- Create, edit, disable, delete, nest, and reorder UDFs.
- Switch between left-to-right and top-to-bottom Dagre layouts.
- Report malformed references, duplicate names, and cycles in the Problems panel.
- Reject stale writes when the same document changes in another editor.

Edges are represented by the target node's `preNodes` array. The editor preserves the existing JSON document model:

```json
{
  "nodes": [
    {
      "name": "source",
      "className": "example.Source"
    },
    {
      "name": "sink",
      "className": "example.Sink",
      "preNodes": ["source"]
    }
  ]
}
```

## Usage

Open the command palette and run `DAG Editor: New DAG`, or open an existing `*.dag.json` file.

Use the context menu on nodes, edges, and the canvas for graph operations. Double-click a node to open its UDF list, and double-click a UDF to manage nested UDFs.

Mouse and keyboard interactions follow common file-manager behavior:

- Click a node or UDF to select it.
- Use `Ctrl` + click (`Cmd` + click on macOS) to select multiple nodes or UDFs.
- Drag UDFs in the UDF list to reorder them.
- Hover nodes, edges, and UDFs to emphasize their border or line.
- Press `Escape` to return from the node or UDF editor to its parent view.

Field changes are synchronized in the background without disabling the active input. Press `Ctrl+S` (`Cmd+S` on macOS) to flush pending field changes and save the remote document immediately.

## DAG document format

DAG Editor keeps the document model as plain JSON. Nodes are stored in a top-level `nodes` array. Edges are represented by each target node's `preNodes` array. UDFs can be nested under nodes or other UDFs through the `udfs` array.

Minimal example:

```json
{
  "nodes": [
    {
      "name": "source",
      "className": "example.Source"
    },
    {
      "name": "transform",
      "className": "example.Transform",
      "preNodes": ["source"],
      "udfs": [
        {
          "name": "normalize",
          "className": "example.udf.Normalize"
        }
      ]
    },
    {
      "name": "sink",
      "className": "example.Sink",
      "preNodes": ["transform"]
    }
  ]
}
```

## Validation

The editor reports semantic problems in the VS Code Problems panel, including:

- malformed node references;
- duplicate node or UDF names;
- self-referencing or cyclic edges.

## Development

```powershell
npm.cmd install
npm.cmd run check
```

Press `F5` in VS Code to compile the extension in watch mode and launch an Extension Development Host.

Available scripts:

- `npm run compile`: create a development bundle with source maps.
- `npm run watch`: rebuild development bundles after source changes.
- `npm run package`: create minified production bundles.
- `npm run test`: run the core unit tests.
- `npm run test:integration`: launch an isolated Extension Host and verify activation, custom editor loading, JSON preservation, and diagnostics.
- `npm run typecheck`: strictly type-check extension and Webview code.
- `npm run lint`: run ESLint with zero warnings allowed.
- `npm run check`: run formatting, type checking, linting, unit tests, and a development build.
