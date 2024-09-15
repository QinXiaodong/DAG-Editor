import { Graph, GraphData } from "@antv/g6";
import { contextmenuClickCallback, getContextmenuCallback } from "./contextmenuHelper";
import { globalDag } from "./Dag";
import { currentPrefix, manageUdf, setCurrentPrefix, viewId } from "./manageUdf";
import switchView, { currentViewId } from "./switchView";
import { currentId, edit } from "./edit";

export const graph = new Graph({
    container: 'canvasContainer',
    animation: false,
    autoResize: false,
    padding: 10,
    behaviors: [
        'drag-canvas',
        'hover-activate',
        {
            type: 'create-edge',
            onFinish: (e: { source: string; target: string; }) => {
                globalDag.addEdge(e.source, e.target);
                globalDag.post();
            },
            style: {
                endArrow: true,
                lineWidth: 3,
                radius: 20,
                stroke: isDark() ? '#FFFFFF' : '#000000',
                opacity: 1,
                loop: false,
            },
        }
    ],
    plugins: [{
        type: 'contextmenu',
        onClick: contextmenuClickCallback,
        getItems: getContextmenuCallback,
    },
    ],
    layout: {
        type: 'dagre',
        rankdir: 'LR',
    },
    node: {
        state: {
            active: {
                stroke: isDark() ? '#FFFFFF' : '#000000',
                halo: false,
                lineWidth: 6,
                labelFill: isDark() ? '#FFFFFF' : '#000000'
            },
            disabled: {
                stroke: '#858585',
                strokeOpacity: 1,
                fillOpacity: 0,
                lineWidth: 2,
                lineDash: 4,
                labelFill: '#858585',
                labelFillOpacity: 1,
            }
        },
    },
    edge: {
        state: {
            active: {
                stroke: isDark() ? '#FFFFFF' : '#000000',
                halo: false,
                lineWidth: 6,
            },
            disabled: {
                stroke: '#858585',
                strokeOpacity: 1,
                lineDash: 4,

            }
        },
    },
    theme: `${document.getElementsByClassName('vscode-dark').length > 0 ? 'dark' : 'light'}`,
});

/**
 * Render the document in the webview.
 */
export function updateContent() {

    // 清理历史的udf列表
    const udfList = document.querySelector(`#${viewId} ul`)!;
    udfList.innerHTML = '';


    if (currentViewId === 'editContainer') {
        if (globalDag.getNodeOrUdf(currentId)) {
            edit(currentId);
        }
    } else if (currentViewId === 'manageUdfContainer') {
        while (currentPrefix.includes('.') && globalDag.getUdf(currentPrefix) === undefined) {
            setCurrentPrefix(currentPrefix.substring(0, currentPrefix.lastIndexOf('.')));
        }
        if (currentPrefix.includes('.') || globalDag.getNode(currentPrefix)) {
            manageUdf(currentPrefix);
        }
    }

    // 根据json重绘Graph
    graph.setData(getGraphData());
    if (isFirst) {
        isFirst = false;
        graph.render().then(() => graph.fitCenter());
    } else {
        graph.render();
    }
}
let isFirst = true;



function getGraphData(): GraphData {

    let data: GraphData = {
        nodes: [],
        edges: [],
        combos: []
    };

    for (const node of globalDag.getNodes() || []) {

        let labelText = node.udfs !== undefined && node.udfs.length > 0 ? `${node.name} (${node.udfs.length})` : `${node.name}`;
        // 渲染节点
        data.nodes!.push({
            id: node.name,
            type: 'rect',
            style: {
                radius: 6,
                lineWidth: 2,
                lineDash: 0,
                stroke: isDark() ? '#CCCCCC' : '#616161',
                strokeOpacity: 1,
                fill: isDark() ? '#2D2D2D' : '#F8F8F8',
                fillOpacity: 1,
                labelFill: isDark() ? '#CCCCCC' : '#616161',
                labelFillOpacity: 1,
                labelPlacement: 'center',
                labelText: labelText,
                labelMaxWidth: '90%',
                labelWordWrap: true,
                labelFontSize: 16,
                labelFontStyle: 'italic',
                size: [Math.max(180, 11 * labelText.length), 40],
            },

            states: [globalDag.isNodeDisabled(node) ? 'disabled' : 'default']
        });

        // 渲染边
        for (const preNodeName of node.preNodes || []) {
            const preNode = globalDag.getNode(preNodeName);
            if (preNode) {
                data.edges!.push({
                    source: preNodeName,
                    target: node.name,
                    type: 'polyline',
                    style: {
                        endArrow: true,
                        lineWidth: 2,
                        opacity: 1,
                        lineDash: 0,
                        radius: 20,
                        stroke: isDark() ? '#CCCCCC' : '#616161',
                    },
                    states: [(globalDag.isNodeDisabled(node) || globalDag.isNodeDisabled(preNode)) ? 'disabled' : 'default']
                });
            }
        }
    }
    return data;
}


function isDark() {
    return document.querySelector("body.vscode-dark") !== null;
}