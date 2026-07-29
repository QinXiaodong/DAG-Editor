# Changelog

## 0.4.0

- Add a VS Code custom editor for `*.dag.json` DAG documents.
- Add graph operations for creating, editing, renaming, disabling, deleting, copying, cutting, and pasting nodes.
- Add edge operations for creating and removing dependencies, plus inserting nodes into existing edges.
- Add UDF management for creating, editing, disabling, deleting, nesting, selecting, and drag-sorting UDFs.
- Add file-manager-style mouse interactions for node and UDF selection, including multi-select with `Ctrl`/`Cmd` click.
- Add DAG validation diagnostics for malformed references, duplicate names, and cycles.
- Preserve the JSON document model while synchronizing editor changes in the background.
