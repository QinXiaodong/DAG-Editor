import { Udf, globalDag } from "./Dag";
import { editUdf } from "./editUdf";
import switchView from "./switchView";


export const viewId = 'manageUdfContainer';
export let currentNodeId = '';

export function registerManageUdfEvents() {

    // 为udf管理界面绑定事件
    document.querySelector(`#${viewId} #add`)?.addEventListener('click', function (event) {
        event.preventDefault();
        globalDag.addNewUdf(currentNodeId);
        globalDag.post();
    });

    document.querySelector(`#${viewId} #return`)?.addEventListener('click', function (event) {
        event.preventDefault();
        // 切换画布视图
        switchView('canvasContainer');
    });


    // 为udf列表拖动排序绑定事件
    let currentLi: HTMLLIElement;
    const list = <HTMLUListElement>document.querySelector(`#${viewId} ul`)!;
    list.addEventListener('dragstart', (e: DragEvent) => {
        e.dataTransfer!.effectAllowed = 'move';
        currentLi = <HTMLLIElement>e.target;
        setTimeout(() => {
            if (currentLi) {
                currentLi.classList.add('moving');
            }
        });
    });

    list.addEventListener('dragenter', (e: DragEvent) => {
        e.preventDefault();
        let targetLi: HTMLLIElement = <HTMLLIElement>e.target;
        if (targetLi === currentLi || targetLi.tagName !== 'LI') {
            return;
        }

        const liArray = Array.from(list.childNodes);
        const currentIndex = liArray.indexOf(currentLi);
        const targetIndex = liArray.indexOf(targetLi);

        if (currentIndex < targetIndex) {
            if (targetLi.nextElementSibling) {
                list.insertBefore(currentLi, targetLi.nextElementSibling);
            } else {
                list.appendChild(currentLi);
            }
        } else {
            list.insertBefore(currentLi, targetLi);
        }
    });

    list.addEventListener('dragover', (e: DragEvent) => {
        e.preventDefault();
    });

    list.addEventListener('dragend', (e: DragEvent) => {
        currentLi.classList.remove('moving');
        const node = globalDag.getNode(currentNodeId)!;
        const newUdfs = [];
        for (const li of Array.from(list.childNodes)) {
            const udf = globalDag.getUdfFromNode(node, li.textContent!);
            if (udf) {
                newUdfs.push(udf);
            }
        }
        node.udfs = newUdfs;
        globalDag.post();
    });
}

export function manageUdf(nodeId: string) {
    currentNodeId = nodeId;

    const nodeName = <HTMLDivElement>document.querySelector(`#${viewId} #nodeName`)!;
    nodeName.textContent = currentNodeId;

    // 清理历史的udf列表
    const udfList = document.querySelector(`#${viewId} ul`)!;
    udfList.innerHTML = '';

    // 填充当前节点下的所有udf name
    for (const udf of globalDag.getNode(currentNodeId)?.udfs || []) {
        addUdf(udf);
    }

    // 显示管理UDF视图
    switchView(viewId);
}

export function addUdf(udf: Udf) {
    let udfList = <HTMLUListElement>document.querySelector(`#${viewId} ul`);

    // 创建一个新的列表元素
    let item: HTMLLIElement = document.createElement('li');
    item.draggable = true;
    if (udf.disabled && udf.disabled === true) {
        item.style.borderStyle = 'dashed';
    }
    // 点击列表元素打开编辑UDF视图
    item.addEventListener('click', function (e) {
        const li = <HTMLLIElement>e.target;
        editUdf(currentNodeId, udf.name);
    });

    item.append(udf.name);
    udfList.append(item);
}
