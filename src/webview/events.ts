import { IWheelEvent } from "@antv/g6";
import { graph } from "./graph";
import { editNode } from "./editNode";

export function registerGraphEvents() {
    // 原生zoom-canvas 有bug, 自定义鼠标滚轮事件
    graph.on('wheel', (e: IWheelEvent) => {
        graph.zoomBy(e.deltaY > 0 ? 0.8 : 1.25);
    });

    graph.on('node:click', (e: any) => {
        const nodeId = e.target.id;
        editNode(nodeId);
    });

    // graph.on('node:pointerenter', (e: any) => {
    //     const nodeId = e.target.id;
    //     try {
    //         graph.updateNodeData([{
    //             id: nodeId, style: {
    //                 stroke: '#FFFFFF',
    //                 labelFill: '#FFFFFF',
    //                 lineWidth: 4,
    //             }
    //         }]);
    //         graph.render();
    //     } catch (e) {
    //         console.log('node:pointerenter exception!');
    //     }
    // });

    // graph.on('node:pointerleave', (e: any) => {
    //     const nodeId = e.target.id;
    //     try {
    //         graph.updateNodeData([{
    //             id: nodeId, style: {
    //                 stroke: '#CCCCCC',
    //                 labelFill: '#CCCCCC',
    //                 lineWidth: 2,
    //             }
    //         }]);
    //         graph.render();
    //     } catch (e) {
    //         console.log('node:pointerleave exception!');
    //     }
    // });

    // graph.on('edge:pointerenter', (e: any) => {
    //     const edgeId = e.target.id;
    //     try {
    //         graph.updateEdgeData([{
    //             id: edgeId, style: {
    //                 stroke: '#FFFFFF',
    //                 lineWidth: 4,
    //             }
    //         }]);
    //         graph.render();
    //     } catch (e) {
    //         console.log('edge:pointerenter exception');
    //     }
    // });

    // graph.on('edge:pointerleave', (e: any) => {
    //     const edgeId = e.target.id;
    //     try {
    //         graph.updateEdgeData([{
    //             id: edgeId, style: {
    //                 stroke: '#CCCCCC',
    //                 lineWidth: 2,
    //             }
    //         }]);
    //         graph.render();
    //     } catch (e) {
    //         console.log('edge:pointerenter exception');
    //     }
    // });
}