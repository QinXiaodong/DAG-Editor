import { graph, updateContent } from './graph';

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
    disabled?: boolean;
}

const vscode = acquireVsCodeApi<Dag>();

export class DagClass {

    private dag: Dag = {
        nodes: [],
    };

    init() {
        const state = vscode.getState();
        if (state) {
            this.setDag(state);
            updateContent();
        }

    }
    update(dag: Dag): void {
        vscode.setState(dag);
        this.setDag(dag);
        updateContent();
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
        for (const node of this.getNodes() || []) {
            if (node.name === name) {
                return node;
            }
        }
        return undefined;
    }

    getUdfFromNode(node: Node, udfName: string) {
        for (const udf of node.udfs || []) {
            if (udf.name === udfName) {
                return udf;
            }
        }
        return undefined;
    }
    getUdf(nodeName: string, udfName: string): Udf | undefined {
        for (const udf of this.getNode(nodeName)?.udfs || []) {
            if (udf.name === udfName) {
                return udf;
            }
        }
        return undefined;
    }

    addNewNode() {
        let id = 0;
        while (this.getNode(`newNode-${id}`)) {
            id++;
        }
        if (!this.getNodes()) {
            this.setNodes([]);
        }
        this.getNodes()!.push({ name: `newNode-${id}` });


        graph.addNodeData([{ id: `newNode-${id}`, style: { fillOpacity: 0 } }]);
        graph.render().then(() => graph.focusElement(`newNode-${id}`));
        // 新增节点后视角移动到新节点
    }

    addEdge(source: string, target: string) {
        const node = this.getNode(target);
        if (node) {
            node.preNodes = Array.isArray(node.preNodes) ? node.preNodes : [];
            if (!node.preNodes.includes(source)) {
                node.preNodes.push(source);
            }
        }
    }

    deleteEdge(source: string, target: string) {
        const node = this.getNode(target);
        if (node) {
            if (node.preNodes && node.preNodes.includes(source)) {
                const index = node.preNodes.indexOf(source);
                node.preNodes.splice(index, 1);
                if (node.preNodes.length === 0) {
                    node.preNodes = undefined;
                }
            }
        }
    }

    addNewDownstreamNode(nodeId: string) {
        let id = 0;
        while (this.getNode(`newNode-${id}`)) {
            id++;
        }
        this.getNodes()!.push({ name: `newNode-${id}`, preNodes: [nodeId] });

        graph.addData({ nodes: [{ id: `newNode-${id}`, style: { fillOpacity: 0 } }], edges: [{ source: nodeId, target: `newNode-${id}`, style: { opacity: 0 } }] });
        graph.render().then(() => graph.focusElement(`newNode-${id}`));
        // 新增节点后视角移动到新节点

    }
    addNewUpstreamNode(nodeId: string) {
        let id = 0;
        while (this.getNode(`newNode-${id}`)) {
            id++;
        }
        this.getNodes()!.push({ name: `newNode-${id}` });
        const targetNode = this.getNode(nodeId)!;
        if (!targetNode.preNodes) {
            targetNode.preNodes = [];
        }
        targetNode.preNodes.push(`newNode-${id}`);

        graph.addData({ nodes: [{ id: `newNode-${id}`, style: { fillOpacity: 0 } }], edges: [{ source: `newNode-${id}`, target: nodeId, style: { opacity: 0 } }] });
        graph.render().then(() => graph.focusElement(`newNode-${id}`));
        // 新增节点后视角移动到新节点

    }
    deleteNode(nodeId: string) {
        let newNodes: Node[] = [];
        this.getNodes()!.forEach(node => {
            if (node.name !== nodeId) {
                if (node.preNodes && node.preNodes.includes(nodeId)) {
                    node.preNodes.splice(node.preNodes.indexOf(nodeId), 1);
                    if (node.preNodes.length === 0) {
                        node.preNodes = undefined;
                    }
                }
                newNodes.push(node);
            }
        });
        this.setNodes(newNodes);
    }
    isDisabled(nodeId: string) {
        return this.getNode(nodeId)?.disabled;
    }
    changeNodeDisabledStatus(nodeId: string) {
        if (this.getNode(nodeId)!.disabled) {
            this.getNode(nodeId)!.disabled = undefined;
        } else {
            this.getNode(nodeId)!.disabled = true;
        }
    }
    changeNodeName(oldName: string, newName: string) {
        this.getNodes()!.forEach(node => {
            if (node.name === oldName) {
                node.name = newName;
            }
            if (node.preNodes?.includes(oldName)) {
                node.preNodes.splice(node.preNodes.indexOf(oldName), 1);
                node.preNodes.push(newName);
            }
        });
    }

    addNewUdf(nodeId: string): string {
        const node = globalDag.getNode(nodeId)!;
        let id = 0;
        while (globalDag.getUdfFromNode(node, `newUdf-${id}`)) {
            id++;
        }
        let newUdfName = `newUdf-${id}`;
        node.udfs = Array.isArray(node.udfs) ? node.udfs : [];
        node.udfs.push({ name: newUdfName });
        return newUdfName;
    }

    deleteUdf(nodeId: string, udfName: string) {
        const node = globalDag.getNode(nodeId)!;
        let udfs = [];
        for (const udf of node.udfs || []) {
            if (udf.name !== udfName) {
                udfs.push(udf);
            }
        }
        node.udfs = udfs.length > 0 ? udfs : undefined;
    }

    post() {
        vscode.postMessage(this.getDag());
    }
}

export const globalDag = new DagClass();
