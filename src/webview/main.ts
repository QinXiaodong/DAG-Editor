// 注册事件和回调函数

import { graph } from "./graph";
import { globalDag } from "./Dag";
import { registerEditNodeEvents } from "./editNode";
import { registerManageUdfEvents } from "./manageUdf";
import { registerEditUdfEvents } from "./editUdf";
import { registerGraphEvents } from "./events";


// Handle messages sent from the extension to the webview
// 接收后端消息
window.addEventListener('message', (e) => {
  // 更新全局Dag对象
  globalDag.update(e.data);
});


// 窗口大小有变化时调整graph大小
window.onresize = function () {
  const container = <HTMLDivElement>document.getElementById('canvasContainer');
  graph.resize(container?.clientWidth, container?.clientHeight - 2);
  graph.fitCenter();
};


// 绑定画布事件
registerGraphEvents();
// 为EditNode View 绑定一次按钮事件
registerEditNodeEvents();
registerManageUdfEvents();
registerEditUdfEvents();

// 启动时仅画布可见
// switchView('canvasContainer');
globalDag.init();
