// 注册事件和回调函数

import { graph } from "./graph";
import { globalDag } from "./Dag";
import { registerEditNodeEvents } from "./editNode";
import { currentPrefix, manageUdf, registerManageUdfEvents } from "./manageUdf";
import { registerEditUdfEvents } from "./editUdf";
import { registerGraphEvents } from "./events";
import switchView, { currentViewId } from "./switchView";


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


document.addEventListener('keydown', function (event) {
  // keyCode用于检查按键代码（在现代浏览器中可能被key替代）
  if (event.key === 'Escape') {
    // 在这里执行你希望当按下ESC键时发生的动作
    if (currentViewId === 'editNodeContainer') {
      switchView('canvasContainer');
    } else if (currentViewId === 'editUdfContainer') {
      switchView("manageUdfContainer");
    } else if (currentViewId === 'manageUdfContainer') {
      if (currentPrefix.includes('.')) {
        // 如果前缀是udf则返回上级udf的管理界面
        manageUdf(currentPrefix.substring(0, currentPrefix.lastIndexOf('.')));
      } else {
        // 切换画布视图
        switchView('canvasContainer');
      }
    }
  }
});