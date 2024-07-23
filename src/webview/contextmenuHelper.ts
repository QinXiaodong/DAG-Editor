import { globalDag } from "./Dag";
import { graph } from "./graph";
import { editNode } from "./editNode";
import { manageUdf } from "./manageUdf";
import { AntVDagreLayoutOptions, LayoutOptions } from "@antv/g6";

export function contextmenuClickCallback(v: string) {
    let e = str2obj(v);
    switch (e.type) {
        case 'node':
            dealNodeItems(e);
            break;
        case 'edge':
            dealEdgeItems(e);
            break;
        case 'canvas':
            dealCanvasItems(e);
            break;
        default:
            break;
    }
}

function dealNodeItems(e: { item: string; id: string }) {
    switch (e.item) {
        case 'editNode':
            editNode(e.id);
            break;
        case 'newDownstreamNode':
            globalDag.addNewDownstreamNode(e.id);
            globalDag.post();
            break;
        case 'newUpstreamNode':
            globalDag.addNewUpstreamNode(e.id);
            globalDag.post();
            break;
        case 'manageUdf':
            manageUdf(e.id);
            break;
        case 'deleteNode':
            globalDag.deleteNode(e.id);
            globalDag.post();
            break;
        case 'changeNodeDisabledStatus':
            globalDag.changeNodeDisabledStatus(e.id);
            globalDag.post();
            break;
        default:
            break;
    }
}

function dealEdgeItems(e: { item: string; source: string; target: string; }) {
    switch (e.item) {
        case 'deleteEdge':
            globalDag.deleteEdge(e.source, e.target);
            globalDag.post();
            break;
        default:
            break;
    }
}

function dealCanvasItems(e: { item: string; }) {
    switch (e.item) {
        case 'newNode':
            globalDag.addNewNode();
            globalDag.post();
            break;
        case 'fitView':
            graph.fitView();
            break;
        case 'fitCenter':
            graph.fitCenter();
            break;
        case 'changeRankdir':
            const layoutOptions = <AntVDagreLayoutOptions>graph.getLayout();
            layoutOptions.rankdir = layoutOptions.rankdir === 'LR' ? 'TB' : 'LR';
            graph.setLayout(<LayoutOptions>layoutOptions);
            graph.layout().then(() => graph.fitCenter());
            break;
        default:
            break;
    }
}


export function getContextmenuCallback(e: any) {
    switch (e.targetType) {
        case 'node':
            return getNodeMenuItems(e);
        case 'edge':
            return getEdgeMenuItems(e);
        case 'canvas':
            return getCanvasMenuItems(e);
    }
}

function getNodeMenuItems(e: { target: { id: any; }; }) {
    return [
        {
            name: '编辑节点',
            value: obj2str({
                type: 'node',
                item: 'editNode',
                id: `${e.target.id}`,

            }),
        },
        {
            name: '新建下游节点',
            value: obj2str({
                type: 'node',
                item: 'newDownstreamNode',
                id: `${e.target.id}`,

            }),
        },
        {
            name: '新建上游节点',
            value: obj2str({
                type: 'node',
                item: 'newUpstreamNode',
                id: `${e.target.id}`,

            }),
        },
        {
            name: '删除节点',
            value: obj2str({
                type: 'node',
                item: 'deleteNode',
                id: `${e.target.id}`,

            }),
        },
        {
            name: globalDag.isDisabled(e.target.id) ? '启用节点' : '禁用节点',
            value: obj2str({
                type: 'node',
                item: 'changeNodeDisabledStatus',
                id: `${e.target.id}`,
            }),
        },
        {
            name: '管理UDF',
            value: obj2str({
                type: 'node',
                item: 'manageUdf',
                id: `${e.target.id}`,

            }),
        },
    ];
}

function getEdgeMenuItems(e: any) {
    return [
        {
            name: '删除边',
            value: obj2str({
                type: 'edge',
                item: 'deleteEdge',
                source: e.target.sourceNode.id,
                target: e.target.targetNode.id,
            })
        },
    ];
}

function getCanvasMenuItems(e: any) {
    return [
        {
            name: '新建节点',
            value: obj2str({
                type: 'canvas',
                item: 'newNode'
            }),
        },
        {
            name: '画面自适应',
            value: obj2str({
                type: 'canvas',
                item: 'fitView'
            }),

        },
        {
            name: '画面居中',
            value: obj2str({
                type: 'canvas',
                item: 'fitCenter'
            }),
        },
        {
            name: '调整布局方向',
            value: obj2str({
                type: 'canvas',
                item: 'changeRankdir'
            }),
        },
    ];
}

function obj2str(obj: any): string {
    return JSON.stringify(obj).replace(/"/g, "\u0001");
}

function str2obj(str: string): any {
    return JSON.parse(str.replace(/\u0001/g, "\""));
}