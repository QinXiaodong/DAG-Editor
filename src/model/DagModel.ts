export interface Dag {
  nodes?: Node[];
}

export interface Node {
  name: string;
  className?: string;
  props?: Prop[];
  udfs?: Udf[];
  preNodes?: string[];
  disabled?: boolean;
}

export interface Prop {
  name: string;
  value: string;
  type?: string;
}

export interface Udf {
  name: string;
  className?: string;
  props?: Prop[];
  udfs?: Udf[];
  disabled?: boolean;
}

export interface DagValidationIssue {
  code:
    | "duplicate-node"
    | "duplicate-udf"
    | "empty-name"
    | "invalid-name"
    | "missing-pre-node"
    | "self-reference"
    | "cycle";
  message: string;
  path: string;
  location: Array<string | number>;
}

type UdfOwner = Node | Udf;

export class DagModel {
  private dag: Dag;

  constructor(dag: Dag = { nodes: [] }) {
    this.dag = dag;
  }

  setDag(dag: Dag): void {
    this.dag = dag;
  }

  getDag(): Dag {
    return this.dag;
  }

  setNodes(nodes: Node[]): void {
    this.dag.nodes = nodes;
  }

  getNodes(): Node[] | undefined {
    return this.dag.nodes;
  }

  getNode(name: string): Node | undefined {
    return this.dag.nodes?.find((node) => node.name === name);
  }

  getUdfFromNode(node: Node | undefined, udfName: string): Udf | undefined {
    return node?.udfs?.find((udf) => udf.name === udfName);
  }

  getUdfFromUdf(udf: Udf | undefined, udfName: string): Udf | undefined {
    return udf?.udfs?.find((child) => child.name === udfName);
  }

  getUdf(fullUdfId: string): Udf | undefined {
    const [nodeName, ...udfNames] = fullUdfId.split(".");
    if (!nodeName || udfNames.length === 0) {
      return undefined;
    }

    let current = this.getUdfFromNode(this.getNode(nodeName), udfNames[0] ?? "");
    for (const udfName of udfNames.slice(1)) {
      current = this.getUdfFromUdf(current, udfName);
      if (!current) {
        return undefined;
      }
    }
    return current;
  }

  getNodeOrUdf(fullId: string): Node | Udf | undefined {
    return fullId.includes(".") ? this.getUdf(fullId) : this.getNode(fullId);
  }

  addNewNode(): string {
    const name = this.getAvailableName("newNode", (candidate) => Boolean(this.getNode(candidate)));
    this.ensureNodes().push({ name });
    return name;
  }

  addEdge(source: string, target: string): boolean {
    const node = this.getNode(target);
    if (
      !this.getNode(source) ||
      !node ||
      source === target ||
      node.preNodes?.includes(source) ||
      this.wouldCreateCycle(source, target)
    ) {
      return false;
    }

    node.preNodes = [...(node.preNodes ?? []), source];
    return true;
  }

  deleteEdge(source: string, target: string): boolean {
    const node = this.getNode(target);
    if (!node?.preNodes?.includes(source)) {
      return false;
    }

    const preNodes = node.preNodes.filter((name) => name !== source);
    node.preNodes = preNodes.length > 0 ? preNodes : undefined;
    return true;
  }

  insertNewNode(source: string, target: string): string {
    this.deleteEdge(source, target);
    const newNodeId = this.addNewNode();
    this.addEdge(source, newNodeId);
    this.addEdge(newNodeId, target);
    return newNodeId;
  }

  addNewDownstreamNode(nodeId: string): string | undefined {
    if (!this.getNode(nodeId)) {
      return undefined;
    }

    const name = this.getAvailableName("newNode", (candidate) => Boolean(this.getNode(candidate)));
    this.ensureNodes().push({ name, preNodes: [nodeId] });
    return name;
  }

  addNewUpstreamNode(nodeId: string): string | undefined {
    const targetNode = this.getNode(nodeId);
    if (!targetNode) {
      return undefined;
    }

    const name = this.getAvailableName("newNode", (candidate) => Boolean(this.getNode(candidate)));
    this.ensureNodes().push({ name });
    targetNode.preNodes = [...(targetNode.preNodes ?? []), name];
    return name;
  }

  deleteNode(nodeId: string): boolean {
    if (!this.getNode(nodeId)) {
      return false;
    }

    this.dag.nodes = (this.dag.nodes ?? [])
      .filter((node) => node.name !== nodeId)
      .map((node) => {
        if (!node.preNodes?.includes(nodeId)) {
          return node;
        }
        const preNodes = node.preNodes.filter((name) => name !== nodeId);
        node.preNodes = preNodes.length > 0 ? preNodes : undefined;
        return node;
      });
    return true;
  }

  getClipboardNodes(nodeIds: string[]): Node[] {
    const copiedNodeIds = new Set(nodeIds);
    return (this.dag.nodes ?? [])
      .filter((node) => copiedNodeIds.has(node.name))
      .map((node) => {
        const copy = cloneNode(node);
        const preNodes = (copy.preNodes ?? []).filter((name) => copiedNodeIds.has(name));
        copy.preNodes = preNodes.length > 0 ? preNodes : undefined;
        return copy;
      });
  }

  pasteClipboardNodes(nodes: Node[]): string[] {
    if (nodes.length === 0) {
      return [];
    }

    const targetNodes = this.ensureNodes();
    const reservedNames = new Set(targetNodes.map((node) => node.name));
    const nameMap = new Map<string, string>();
    for (const node of nodes) {
      const nextName = getAvailablePastedName(node.name, reservedNames);
      reservedNames.add(nextName);
      nameMap.set(node.name, nextName);
    }

    const pastedNodes = nodes.map((node) => {
      const copy = cloneNode(node);
      copy.name = nameMap.get(node.name) ?? node.name;
      const preNodes = (node.preNodes ?? [])
        .map((name) => nameMap.get(name))
        .filter((name): name is string => Boolean(name));
      copy.preNodes = preNodes.length > 0 ? preNodes : undefined;
      return copy;
    });
    targetNodes.push(...pastedNodes);
    return pastedNodes.map((node) => node.name);
  }

  getClipboardUdfs(fullUdfIds: string[]): Udf[] {
    return fullUdfIds
      .map((fullUdfId) => this.getUdf(fullUdfId))
      .filter((udf): udf is Udf => Boolean(udf))
      .map(cloneUdf);
  }

  pasteClipboardUdfs(prefix: string, udfs: Udf[]): string[] {
    const owner = this.getUdfOwner(prefix);
    if (!owner || udfs.length === 0) {
      return [];
    }

    owner.udfs ??= [];
    const reservedNames = new Set(owner.udfs.map((udf) => udf.name));
    const pastedUdfs = udfs.map((udf) => {
      const copy = cloneUdf(udf);
      copy.name = getAvailablePastedName(udf.name, reservedNames);
      reservedNames.add(copy.name);
      return copy;
    });
    owner.udfs.push(...pastedUdfs);
    return pastedUdfs.map((udf) => `${prefix}.${udf.name}`);
  }

  isDisabled(nodeId: string): boolean {
    const node = this.getNode(nodeId);
    return node ? this.isNodeDisabled(node) : false;
  }

  isNodeDisabled(node: Node): boolean {
    return node.disabled === true;
  }

  isUdfDisabled(udf: Udf): boolean {
    return udf.disabled === true;
  }

  changeNodeDisabledStatus(nodeId: string): boolean {
    const node = this.getNode(nodeId);
    if (!node) {
      return false;
    }
    node.disabled = node.disabled === true ? undefined : true;
    return true;
  }

  setNodesDisabledStatus(nodeIds: string[], disabled: boolean): boolean {
    let changed = false;
    for (const nodeId of nodeIds) {
      const node = this.getNode(nodeId);
      if (node && node.disabled !== (disabled ? true : undefined)) {
        node.disabled = disabled ? true : undefined;
        changed = true;
      }
    }
    return changed;
  }

  changeUdfDisabledStatus(fullUdfId: string): boolean {
    const udf = this.getUdf(fullUdfId);
    if (!udf) {
      return false;
    }
    udf.disabled = udf.disabled === true ? undefined : true;
    return true;
  }

  setUdfsDisabledStatus(fullUdfIds: string[], disabled: boolean): boolean {
    let changed = false;
    for (const fullUdfId of fullUdfIds) {
      const udf = this.getUdf(fullUdfId);
      if (udf && udf.disabled !== (disabled ? true : undefined)) {
        udf.disabled = disabled ? true : undefined;
        changed = true;
      }
    }
    return changed;
  }

  changeUdfName(fullUdfId: string, newName: string): boolean {
    const separatorIndex = fullUdfId.lastIndexOf(".");
    if (separatorIndex < 0) {
      return false;
    }

    const owner = this.getUdfOwner(fullUdfId.slice(0, separatorIndex));
    const udf = this.getUdf(fullUdfId);
    if (!owner?.udfs || !udf) {
      return false;
    }
    if (owner.udfs.some((candidate) => candidate !== udf && candidate.name === newName)) {
      return false;
    }

    udf.name = newName;
    return true;
  }

  changeNodeName(oldName: string, newName: string): boolean {
    if (!this.getNode(oldName) || (oldName !== newName && this.getNode(newName))) {
      return false;
    }

    for (const node of this.dag.nodes ?? []) {
      if (node.name === oldName) {
        node.name = newName;
      }
      if (node.preNodes?.includes(oldName)) {
        node.preNodes = node.preNodes.map((name) => (name === oldName ? newName : name));
      }
    }
    return true;
  }

  addNewUdf(prefix: string): string | undefined {
    const owner = this.getUdfOwner(prefix);
    if (!owner) {
      return undefined;
    }

    const name = this.getAvailableName("newUdf", (candidate) =>
      Boolean(owner.udfs?.some((udf) => udf.name === candidate))
    );
    owner.udfs = [...(owner.udfs ?? []), { name }];
    return name;
  }

  deleteUdf(fullUdfId: string): boolean {
    const separatorIndex = fullUdfId.lastIndexOf(".");
    if (separatorIndex < 0) {
      return false;
    }

    const owner = this.getUdfOwner(fullUdfId.slice(0, separatorIndex));
    const udfName = fullUdfId.slice(separatorIndex + 1);
    if (!owner?.udfs?.some((udf) => udf.name === udfName)) {
      return false;
    }

    const udfs = owner.udfs.filter((udf) => udf.name !== udfName);
    owner.udfs = udfs.length > 0 ? udfs : undefined;
    return true;
  }

  private ensureNodes(): Node[] {
    this.dag.nodes ??= [];
    return this.dag.nodes;
  }

  private getUdfOwner(prefix: string): UdfOwner | undefined {
    return prefix.includes(".") ? this.getUdf(prefix) : this.getNode(prefix);
  }

  private getAvailableName(prefix: string, exists: (candidate: string) => boolean): string {
    let index = 0;
    while (exists(`${prefix}-${index}`)) {
      index += 1;
    }
    return `${prefix}-${index}`;
  }

  private wouldCreateCycle(source: string, target: string): boolean {
    const pending = [source];
    const visited = new Set<string>();

    while (pending.length > 0) {
      const current = pending.pop();
      if (!current || visited.has(current)) {
        continue;
      }
      visited.add(current);

      for (const preNode of this.getNode(current)?.preNodes ?? []) {
        if (preNode === target) {
          return true;
        }
        pending.push(preNode);
      }
    }
    return false;
  }
}

export function isDag(value: unknown): value is Dag {
  if (!isRecord(value)) {
    return false;
  }
  return value.nodes === undefined || (Array.isArray(value.nodes) && value.nodes.every(isNode));
}

export function validateDag(dag: Dag): DagValidationIssue[] {
  const issues: DagValidationIssue[] = [];
  const nodes = dag.nodes ?? [];
  const nodeNames = new Set<string>();

  for (const [index, node] of nodes.entries()) {
    const path = `nodes[${index}]`;
    validateName(node.name, path, ["nodes", index, "name"], issues);
    if (nodeNames.has(node.name)) {
      issues.push({
        code: "duplicate-node",
        message: `Node name "${node.name}" is duplicated.`,
        path,
        location: ["nodes", index, "name"],
      });
    }
    nodeNames.add(node.name);
    validateUdfs(node.udfs, `${path}.udfs`, ["nodes", index, "udfs"], issues);
  }

  for (const [index, node] of nodes.entries()) {
    for (const [preNodeIndex, preNode] of (node.preNodes ?? []).entries()) {
      const path = `nodes[${index}].preNodes[${preNodeIndex}]`;
      if (preNode === node.name) {
        issues.push({
          code: "self-reference",
          message: `Node "${node.name}" references itself.`,
          path,
          location: ["nodes", index, "preNodes", preNodeIndex],
        });
      } else if (!nodeNames.has(preNode)) {
        issues.push({
          code: "missing-pre-node",
          message: `Predecessor node "${preNode}" does not exist.`,
          path,
          location: ["nodes", index, "preNodes", preNodeIndex],
        });
      }
    }
  }

  const cycle = findCycle(nodes, nodeNames);
  if (cycle) {
    issues.push({
      code: "cycle",
      message: `DAG contains a cycle: ${cycle.join(" -> ")}.`,
      path: "nodes",
      location: ["nodes"],
    });
  }

  return issues;
}

function isNode(value: unknown): value is Node {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    isOptionalString(value.className) &&
    isOptionalBoolean(value.disabled) &&
    isOptionalStringArray(value.preNodes) &&
    isOptionalPropArray(value.props) &&
    isOptionalUdfArray(value.udfs)
  );
}

function isUdf(value: unknown): value is Udf {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    isOptionalString(value.className) &&
    isOptionalBoolean(value.disabled) &&
    isOptionalPropArray(value.props) &&
    isOptionalUdfArray(value.udfs)
  );
}

function isProp(value: unknown): value is Prop {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    typeof value.value === "string" &&
    isOptionalString(value.type)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneNode(node: Node): Node {
  return JSON.parse(JSON.stringify(node)) as Node;
}

function cloneUdf(udf: Udf): Udf {
  return JSON.parse(JSON.stringify(udf)) as Udf;
}

function getAvailablePastedName(name: string, reservedNames: Set<string>): string {
  if (!reservedNames.has(name)) {
    return name;
  }

  let index = 1;
  let candidate = `${name}-${index}`;
  while (reservedNames.has(candidate)) {
    index += 1;
    candidate = `${name}-${index}`;
  }
  return candidate;
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function isOptionalBoolean(value: unknown): boolean {
  return value === undefined || typeof value === "boolean";
}

function isOptionalStringArray(value: unknown): boolean {
  return (
    value === undefined || (Array.isArray(value) && value.every((item) => typeof item === "string"))
  );
}

function isOptionalPropArray(value: unknown): boolean {
  return value === undefined || (Array.isArray(value) && value.every(isProp));
}

function isOptionalUdfArray(value: unknown): boolean {
  return value === undefined || (Array.isArray(value) && value.every(isUdf));
}

function validateName(
  name: string,
  path: string,
  location: Array<string | number>,
  issues: DagValidationIssue[]
): void {
  if (name.length === 0) {
    issues.push({ code: "empty-name", message: "Name cannot be empty.", path, location });
  } else if (name.includes(".")) {
    issues.push({
      code: "invalid-name",
      message: `Name "${name}" cannot contain a dot.`,
      path,
      location,
    });
  }
}

function validateUdfs(
  udfs: Udf[] | undefined,
  path: string,
  location: Array<string | number>,
  issues: DagValidationIssue[]
): void {
  const names = new Set<string>();
  for (const [index, udf] of (udfs ?? []).entries()) {
    const udfPath = `${path}[${index}]`;
    const udfLocation = [...location, index];
    validateName(udf.name, udfPath, [...udfLocation, "name"], issues);
    if (names.has(udf.name)) {
      issues.push({
        code: "duplicate-udf",
        message: `UDF name "${udf.name}" is duplicated under the same parent.`,
        path: udfPath,
        location: [...udfLocation, "name"],
      });
    }
    names.add(udf.name);
    validateUdfs(udf.udfs, `${udfPath}.udfs`, [...udfLocation, "udfs"], issues);
  }
}

function findCycle(nodes: Node[], knownNames: Set<string>): string[] | undefined {
  const downstream = new Map<string, string[]>();
  for (const node of nodes) {
    downstream.set(node.name, downstream.get(node.name) ?? []);
    for (const preNode of node.preNodes ?? []) {
      if (knownNames.has(preNode) && preNode !== node.name) {
        const targets = downstream.get(preNode) ?? [];
        targets.push(node.name);
        downstream.set(preNode, targets);
      }
    }
  }

  const visited = new Set<string>();
  const visiting = new Set<string>();
  const path: string[] = [];

  const visit = (name: string): string[] | undefined => {
    if (visiting.has(name)) {
      const start = path.indexOf(name);
      return [...path.slice(start), name];
    }
    if (visited.has(name)) {
      return undefined;
    }

    visiting.add(name);
    path.push(name);
    for (const target of downstream.get(name) ?? []) {
      const cycle = visit(target);
      if (cycle) {
        return cycle;
      }
    }
    path.pop();
    visiting.delete(name);
    visited.add(name);
    return undefined;
  };

  for (const name of knownNames) {
    const cycle = visit(name);
    if (cycle) {
      return cycle;
    }
  }
  return undefined;
}
