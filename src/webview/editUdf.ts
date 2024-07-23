import { globalDag } from "./Dag";
import { addProp, extractProps } from "./addProp";
import switchView from "./switchView";

const viewId = 'editUdfContainer';
let currentNodeId = '';
let currentUdfName = '';
export function registerEditUdfEvents() {
    // 为节点编辑界面绑定事件
    document.querySelector(`#${viewId} #add`)?.addEventListener('click', function (event) {
        event.preventDefault();
        addProp(viewId, undefined);
    });
    document.querySelector(`#${viewId} #delete`)?.addEventListener('click', function (event) {
        event.preventDefault();
        deleteUdf();
    });

    document.querySelector(`#${viewId} #delete`)?.addEventListener('click', function (event) {
        event.preventDefault();
        deleteUdf();
    });

    document.querySelector(`#${viewId} #quit`)?.addEventListener('click', function (event) {
        event.preventDefault();
        switchView("manageUdfContainer");
    });

    document.querySelector(`#${viewId} form`)?.addEventListener('submit', function (event) {
        event.preventDefault();
        saveUdf();
    });


}


export function editUdf(nodeId: string, udfName: string) {

    currentNodeId = nodeId;
    currentUdfName = udfName;

    const deleteButton = <HTMLButtonElement>document.querySelector(`#${viewId} #delete`)!;
    deleteButton.textContent = 'Delete Current UDF';

    // 渲染已有数据
    const udf = globalDag.getUdf(nodeId, udfName)!;

    const enableInput = <HTMLInputElement>document.querySelector(`#${viewId} #enable`);
    if (globalDag.isUdfDisabled(udf)) {
        enableInput.checked = false;
    } else {
        enableInput.checked = true;
    }

    // 填充原来的udf名称
    let nameInput = <HTMLInputElement>document.querySelector(`#${viewId} #name`);
    nameInput.value = udfName;
    nameInput.required = true;

    // 填充原来的className
    let classNameInput = <HTMLInputElement>document.querySelector(`#${viewId} #className`);
    classNameInput.required = true;
    classNameInput.value = udf.className ? udf.className : '';

    const propsContainer = <HTMLDivElement>document.querySelector(`#${viewId} #props`)!;
    propsContainer.innerHTML = '';

    for (const prop of udf.props || []) {
        addProp(viewId, prop);
    }

    // editUdf view 变可见
    switchView(viewId);
    nameInput.focus();
}

function deleteUdf() {
    const button = <HTMLButtonElement>document.querySelector(`#${viewId} #delete`)!;

    if (button.textContent !== `Delete Current UDF?`) {
        button.textContent = `Delete Current UDF?`;
        return;
    }
    globalDag.deleteUdf(currentNodeId, currentUdfName);
    globalDag.post();

    // 切换回管理UDF 视图
    switchView('manageUdfContainer');
}

function saveUdf() {

    const udf = globalDag.getUdf(currentNodeId, currentUdfName)!;

    const enableInput = <HTMLInputElement>document.querySelector(`#${viewId} #enable`);
    if (enableInput.checked) {
        udf.disabled = undefined;
    } else {
        udf.disabled = true;
    }

    const nameInput = <HTMLInputElement>document.querySelector(`#${viewId} #name`);

    document.querySelector(`#${viewId} #input-group1 #alert`)?.remove();

    if (nameInput.value !== currentUdfName && globalDag.getUdf(currentNodeId, nameInput.value)) {
        let alert = document.createElement('div');
        alert.style.marginBottom = '20px';
        alert.id = 'alert';
        alert.textContent = `UDF [ ${nameInput.value} ] already exists. Please rename the UDF.`;
        document.querySelector(`#${viewId} #input-group1`)?.insertBefore(alert, document.querySelector(`#${viewId} #input-group1 #classNameDiv`));
        nameInput.focus();
        return;
    }

    udf.name = nameInput.value;

    const classNameInput = <HTMLInputElement>document.querySelector(`#${viewId} #className`);
    udf.className = classNameInput.value;

    udf.props = extractProps(viewId);

    globalDag.post();

    currentNodeId = '';
    currentUdfName = '';

    // 切换manageUdf视图
    switchView('manageUdfContainer');
}
