import { globalDag } from "./Dag";
import { addProp, extractProps } from "./addProp";
import switchView from "./switchView";

const viewId = 'editNodeContainer';
let currentNodeId = '';
export function registerEditNodeEvents() {

    // 为节点编辑界面绑定事件
    document.querySelector(`#${viewId} #add`)?.addEventListener('click', function (event) {
        event.preventDefault();
        addProp(viewId, undefined);
    });

    document.querySelector(`#${viewId} #quit`)?.addEventListener('click', function (event) {
        event.preventDefault();
        switchView("canvasContainer");
    });

    document.querySelector(`#${viewId} form`)?.addEventListener('submit', function (event) {
        event.preventDefault();
        saveNode();
    });
}

export function editNode(nodeId: string) {
    currentNodeId = nodeId;

    // 渲染已有数据
    const node = globalDag.getNode(nodeId)!;
    // 填充原来的节点名称
    let nameInput = <HTMLInputElement>document.querySelector(`#${viewId} #name`);
    nameInput.value = nodeId;
    nameInput.required = true;

    // 填充原来的clasName
    let classNameInput = <HTMLInputElement>document.querySelector(`#${viewId} #className`);
    classNameInput.required = true;
    classNameInput.value = node.className ? node.className : '';

    const propsContainer = <HTMLDivElement>document.querySelector(`#${viewId} #props`)!;
    propsContainer.innerHTML = '';
    for (const prop of node.props || []) {
        addProp(viewId, prop);
    }

    // editNode view变可见
    switchView(viewId);
    nameInput.focus();
}


function saveNode() {

    const node = globalDag.getNode(currentNodeId);
    if (node === undefined) {
        switchView('canvasContainer');
        return;
    }
    const nameInput = <HTMLInputElement>document.querySelector(`#${viewId} #name`);
    document.querySelector(`#${viewId} #input-group1 #alert`)?.remove();

    if (nameInput.value !== currentNodeId && globalDag.getNode(nameInput.value)) {
        let alert = document.createElement('div');
        alert.style.marginBottom = '20px';
        alert.id = 'alert';
        alert.textContent = `Node [ ${nameInput.value} ] already exists. Please rename the node.`;
        document.querySelector(`#${viewId} #input-group1`)?.insertBefore(alert, document.querySelector(`#${viewId} #input-group1 #classNameDiv`));
        nameInput.focus();
        return;
    }

    // 全局改名，除了节点名称要改， 其他节点的preNodes也要改
    globalDag.changeNodeName(currentNodeId, nameInput.value);

    const classNameInput = <HTMLInputElement>document.querySelector(`#${viewId} #className`);
    node.className = classNameInput.value;

    node.props = extractProps(viewId);
    globalDag.post();

    currentNodeId = '';

    // 切换画布视图
    switchView('canvasContainer');
}