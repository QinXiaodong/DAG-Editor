import { IWheelEvent } from "@antv/g6";
import { graph } from "./graph";

export function registerGraphEvents() {
    // 原生zoom-canvas 有bug, 自定义鼠标滚轮事件
    graph.on('wheel', (e: IWheelEvent) => {
        graph.zoomBy(e.deltaY > 0 ? 0.8 : 1.25);
    });
}