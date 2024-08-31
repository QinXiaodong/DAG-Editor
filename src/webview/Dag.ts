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
    udfs?: Udf[];
    disabled?: boolean;
}

const vscode = acquireVsCodeApi<Dag>();

export class DagClass {

    private dag: Dag = {
        nodes: [],
    };

    update(dag: Dag): void {
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
    getUdfFromUdf(udf: Udf | undefined, udfName: string) {
        for (const u of udf?.udfs || []) {
            if (u.name === udfName) {
                return u;
            }
        }
        return undefined;
    }
    getUdf(fullUdfId: string): Udf | undefined {
        let lastIndexOfDot = fullUdfId.lastIndexOf('.');
        let prefix = fullUdfId.substring(0, lastIndexOfDot);
        let udfName = fullUdfId.substring(lastIndexOfDot + 1);
        if (prefix.includes('.')) {
            return this.getUdfFromUdf(this.getUdf(prefix), udfName);
        } else {
            return this.getUdfFromNode(this.getNode(prefix)!, udfName);
        }
    }

    getNodeOrUdf(fullId: string): Node | Udf | undefined {
        if (fullId.includes('.')) {
            return this.getUdf(fullId);
        } else {
            return this.getNode(fullId);
        }
    }

    addNewNode(): string {
        let id = 0;
        while (this.getNode(`newNode-${id}`)) {
            id++;
        }
        if (!this.getNodes()) {
            this.setNodes([]);
        }
        this.getNodes()!.push({ name: `newNode-${id}` });


        graph.addNodeData([{ id: `newNode-${id}`, style: { fillOpacity: 0 } }]);
        return `newNode-${id}`;
    }

    focusNode(name: string) {
        graph.render().then(() => graph.focusElement(name));
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

    insertNewNode(source: string, target: string) {
        this.deleteEdge(source, target);
        let newNodeId = this.addNewNode();
        this.addEdge(source, newNodeId);
        this.addEdge(newNodeId, target);
    }
    
    addNewDownstreamNode(nodeId: string) {
        let id = 0;
        while (this.getNode(`newNode-${id}`)) {
            id++;
        }
        this.getNodes()!.push({ name: `newNode-${id}`, preNodes: [nodeId] });

        graph.addData({ nodes: [{ id: `newNode-${id}`, style: { fillOpacity: 0 } }], edges: [{ source: nodeId, target: `newNode-${id}`, style: { opacity: 0 } }] });
        return `newNode-${id}`;

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
        return `newNode-${id}`;
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
        const node = this.getNode(nodeId);
        return node?.disabled && node?.disabled === true;
    }
    isNodeDisabled(node: Node) {
        return node.disabled && node.disabled === true;
    }
    isUdfDisabled(udf: Udf) {
        return udf.disabled && udf.disabled === true;
    }
    changeNodeDisabledStatus(nodeId: string) {
        const node = this.getNode(nodeId)!;
        if (node.disabled && node.disabled === true) {
            node.disabled = undefined;
        } else {
            node.disabled = true;
        }
    }

    changeUdfDisabledStatus(fullUdfId: string) {
        const udf = this.getUdf(fullUdfId)!;
        if (udf.disabled && udf.disabled === true) {
            udf.disabled = undefined;
        } else {
            udf.disabled = true;
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

    addNewUdf(prefix: string): string {

        if (prefix.includes('.')) {
            const udf = globalDag.getUdf(prefix)!;
            let id = 0;

            while (globalDag.getUdfFromUdf(udf, `newUdf-${id}`)) {
                id++;
            }
            let newUdfName = `newUdf-${id}`;
            udf.udfs = Array.isArray(udf.udfs) ? udf.udfs : [];
            udf.udfs.push({ name: newUdfName });
            return newUdfName;
        } else {
            const node = globalDag.getNode(prefix)!;
            let id = 0;

            while (globalDag.getUdfFromNode(node, `newUdf-${id}`)) {
                id++;
            }
            let newUdfName = `newUdf-${id}`;
            node.udfs = Array.isArray(node.udfs) ? node.udfs : [];
            node.udfs.push({ name: newUdfName });
            return newUdfName;
        }

    }

    deleteUdf(fullUdfId: string) {
        let lastIndexOfDot = fullUdfId.lastIndexOf('.');
        let prefix = fullUdfId.substring(0, lastIndexOfDot);
        let udfName = fullUdfId.substring(lastIndexOfDot + 1);
        if (prefix.includes('.')) {
            let udfs = [];
            const outerUdf = this.getUdf(prefix)!;
            for (const udf of outerUdf.udfs || []) {
                if (udf.name !== udfName) {
                    udfs.push(udf);
                }
            }
            outerUdf.udfs = udfs.length > 0 ? udfs : undefined;
        } else {

            let udfs = [];
            const node = this.getNode(prefix)!;
            for (const udf of node.udfs || []) {
                if (udf.name !== udfName) {
                    udfs.push(udf);
                }
            }
            node.udfs = udfs.length > 0 ? udfs : undefined;
        }
    }

    post() {
        vscode.postMessage(this.getDag());
    }
}

export const globalDag = new DagClass();
