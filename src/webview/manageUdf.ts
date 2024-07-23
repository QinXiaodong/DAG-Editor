import { Udf, globalDag } from "./Dag";
import { editUdf } from "./editUdf";
import switchView from "./switchView";


export const viewId = 'manageUdfContainer';
export let currentPrefix = '';

let rightClickMenu = document.querySelector<HTMLDivElement>('#rightClickMenu')!;
let currentRightClickUdf: string;
export function registerManageUdfEvents() {

    // 获取所有菜单项
    var menuItems = document.querySelectorAll('#rightClickMenu li');

    // 遍历所有菜单项
    menuItems.forEach(function (item) {
        item.addEventListener('click', function (event) {
            let et = <HTMLLIElement>event.target;
            event.stopPropagation(); // 防止事件冒泡关闭菜单
            var action = et.getAttribute('data-action');
            switch (action) {
                case 'edit-udf':
                    editUdf(`${currentPrefix}.${currentRightClickUdf}`);
                    break;
                case 'delete-udf':
                    globalDag.deleteUdf(`${currentPrefix}.${currentRightClickUdf}`);
                    globalDag.post();
                    break;
                case 'disable-udf':
                    globalDag.changeUdfDisabledStatus(`${currentPrefix}.${currentRightClickUdf}`);
                    globalDag.post();
                    break;
                case 'manage-udf':
                    manageUdf(`${currentPrefix}.${currentRightClickUdf}`);
                    break;
                default:
                    console.log(currentRightClickUdf + '未知动作');
            }
            closeMenu();
        });
    });
    // 为udf管理界面绑定事件
    document.querySelector(`#${viewId} #add`)?.addEventListener('click', function (event) {
        event.preventDefault();
        globalDag.addNewUdf(currentPrefix);
        globalDag.post();
    });

    document.querySelector(`#${viewId} #return`)?.addEventListener('click', function (event) {
        event.preventDefault();
        if (currentPrefix.includes('.')) {
            // 如果前缀是udf则返回上级udf的管理界面
            manageUdf(currentPrefix.substring(0, currentPrefix.lastIndexOf('.')));

        } else {
            // 切换画布视图
            switchView('canvasContainer');
        }
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

        if (currentPrefix.includes('.')) {
            const outerUdf = globalDag.getUdf(currentPrefix)!;
            const newUdfs = [];
            for (const li of Array.from(list.childNodes)) {
                const udf = globalDag.getUdfFromUdf(outerUdf, li.textContent!);
                if (udf) {
                    newUdfs.push(udf);
                }
            }
            outerUdf.udfs = newUdfs;

        } else {
            const node = globalDag.getNode(currentPrefix)!;
            const newUdfs = [];
            for (const li of Array.from(list.childNodes)) {
                const udf = globalDag.getUdfFromNode(node, li.textContent!);
                if (udf) {
                    newUdfs.push(udf);
                }
            }
            node.udfs = newUdfs;

        }
        globalDag.post();
    });
}

export function manageUdf(prefix: string) {


    currentPrefix = prefix;

    const prefixDiv = <HTMLDivElement>document.querySelector(`#${viewId} #prefix`)!;
    prefixDiv.textContent = currentPrefix;

    const innerDiv = <HTMLDivElement>document.querySelector(`#${viewId} #innerDiv`);
    if (currentPrefix.includes('.')) {
        const udf = globalDag.getUdf(currentPrefix)!;
        if (globalDag.isUdfDisabled(udf)) {
            innerDiv.style.borderStyle = 'dashed';
        } else {
            innerDiv.style.borderStyle = 'solid';
        }

    } else {
        const node = globalDag.getNode(currentPrefix)!;
        if (globalDag.isNodeDisabled(node)) {
            innerDiv.style.borderStyle = 'dashed';
        } else {
            innerDiv.style.borderStyle = 'solid';
        }
    }

    // 清理历史的udf列表
    const udfList = document.querySelector(`#${viewId} ul`)!;
    udfList.innerHTML = '';

    // 填充当前节点下的所有udf name
    const udfs = (currentPrefix.includes('.') ? globalDag.getUdf(currentPrefix) : globalDag.getNode(currentPrefix))?.udfs;
    for (const udf of udfs || []) {
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
    if (globalDag.isUdfDisabled(udf)) {
        item.style.borderStyle = 'dashed';
    }

    item.addEventListener('contextmenu', function (event) {
        event.preventDefault(); // 阻止浏览器默认行为
        currentRightClickUdf = udf.name;
        let disableUdfMenuItem = document.querySelector<HTMLLIElement>('#disableUdfMenuItem')!;
        if (globalDag.isUdfDisabled(udf)) {
            disableUdfMenuItem.textContent = '启用UDF';
        } else {
            disableUdfMenuItem.textContent = '禁用UDF';
        }
        const li = <HTMLLIElement>event.target;

        rightClickMenu.style.display = 'block';

        // 获取当前的滚动偏移量
        var scrollTop = document.documentElement.scrollTop;
        var scrollLeft = document.documentElement.scrollLeft;

        rightClickMenu.style.top = (event.clientY + scrollTop) + 'px';
        rightClickMenu.style.left = (event.clientX + scrollLeft) + 'px';

        // 当点击页面其他地方时关闭菜单
        window.addEventListener('click', closeMenu);

    });


    item.append(udf.name);
    udfList.append(item);
}
function closeMenu() {
    rightClickMenu.style.display = 'none';
    window.removeEventListener('click', closeMenu);
}
