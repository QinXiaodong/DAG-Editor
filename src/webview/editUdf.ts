import { globalDag } from "./Dag";
import { addProp, extractProps } from "./addProp";
import switchView from "./switchView";

const viewId = 'editUdfContainer';
let currentFullUdfId = '';
export function registerEditUdfEvents() {
    // 为节点编辑界面绑定事件
    document.querySelector(`#${viewId} #add`)?.addEventListener('click', function (event) {
        event.preventDefault();
        addProp(viewId, undefined);
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


export function editUdf(fullUdfId: string) {

    currentFullUdfId = fullUdfId;


    // 渲染已有数据
    const udf = globalDag.getUdf(fullUdfId)!;

    // 填充原来的udf名称
    let nameInput = <HTMLInputElement>document.querySelector(`#${viewId} #name`);
    nameInput.value = fullUdfId.substring(fullUdfId.lastIndexOf('.') + 1);
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

function saveUdf() {

    const udf = globalDag.getUdf(currentFullUdfId)!;
    if (udf === undefined) {
        switchView('canvasContainer');
        return;
    }

    const nameInput = <HTMLInputElement>document.querySelector(`#${viewId} #name`);

    document.querySelector(`#${viewId} #input-group1 #alert`)?.remove();


    let lastIndexOfDot = currentFullUdfId.lastIndexOf('.');
    let prefix = currentFullUdfId.substring(0, lastIndexOfDot);
    let udfName = currentFullUdfId.substring(lastIndexOfDot + 1);
    if (nameInput.value !== udfName && globalDag.getUdf(`${prefix}.${nameInput.value}`)) {
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

    // 切换manageUdf视图
    switchView('manageUdfContainer');
}
