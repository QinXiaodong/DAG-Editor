import { Prop, globalDag } from "./Dag";
import switchView from "./switchView";

const viewId = 'editContainer';
export let currentId = ''; // nosonar
let lastPropId = '';
let lastPropElement = '';
let lastCursorPos = -1;
let globalPropId = 0;
let targetElement: HTMLElement | undefined = undefined;
export function registerEditEvents() {

    // 为节点编辑界面绑定事件
    let addButton = document.querySelector(`#${viewId} #add`);
    addButton?.addEventListener('click', function (event) {
        event.preventDefault();
        addProp(undefined, `${globalPropId++}`);
    });
    addButton?.addEventListener('focus', function (event) {
        lastPropElement = '';
        lastPropId = '';
    });
}

export function edit(id: string) {
    globalPropId = 0;
    document.querySelector(`#${viewId} #input-group1 #alert`)?.remove();
    currentId = id;

    // 渲染已有数据
    const obj = globalDag.getNodeOrUdf(id);
    if (obj === undefined) {
        return;
    }


    // 填充原来的节点名称
    let nameInput = <HTMLInputElement>document.querySelector(`#${viewId} #name`);
    nameInput.addEventListener("input", function (event) {
        targetElement = undefined;
        lastPropElement = '';
        lastPropId = '';
        handleInputDelayed();
    });

    nameInput.value = id.includes('.') ? id.substring(id.lastIndexOf('.') + 1) : id;

    // 填充原来的className
    let classNameInput = <HTMLInputElement>document.querySelector(`#${viewId} #className`);
    classNameInput.addEventListener("input", function (event) {
        targetElement = undefined;
        lastPropElement = '';
        lastPropId = '';
        handleInputDelayed();
    });
    classNameInput.value = obj.className ? obj.className : '';

    const propsContainer = <HTMLDivElement>document.querySelector(`#${viewId} #props`)!;
    propsContainer.innerHTML = '';

    let propId = 0;
    for (const prop of obj.props || []) {
        addProp(prop, `${propId++}`);
    }
    globalPropId = propId;
    // edit view变可见
    switchView(viewId);
}


export function save() {

    const obj = globalDag.getNodeOrUdf(currentId);
    if (obj === undefined) {
        switchView('canvasContainer');
        return;
    }
    const nameInput = <HTMLInputElement>document.querySelector(`#${viewId} #name`);

    if (currentId.includes('.') && nameInput.value !== currentId.substring(currentId.lastIndexOf('.') + 1) && globalDag.getUdf(`${currentId.substring(0, currentId.lastIndexOf('.'))}.${nameInput.value}`)
        ||
        !currentId.includes('.') && nameInput.value !== currentId && globalDag.getNode(nameInput.value)) {
        let alert = document.createElement('div');
        alert.style.marginBottom = '20px';
        alert.id = 'alert';
        alert.textContent = `${currentId.includes('.') ? 'UDF' : 'Node'} [ ${nameInput.value} ] already exists. Please rename it.`;
        document.querySelector(`#${viewId} #input-group1`)?.insertBefore(alert, document.querySelector(`#${viewId} #input-group1 #classNameDiv`));
        nameInput.focus();
        return;
    }

    if (currentId.includes('.')) {
        obj.name = nameInput.value;
    } else {
        // 全局改名，除了节点名称要改， 其他节点的preNodes也要改
        globalDag.changeNodeName(currentId, nameInput.value);
    }

    const classNameInput = <HTMLInputElement>document.querySelector(`#${viewId} #className`);
    obj.className = classNameInput.value;

    obj.props = extractProps();

    if (currentId.includes('.')) {
        currentId = currentId.substring(0, currentId.lastIndexOf('.') + 1) + nameInput.value;
    } else {
        currentId = nameInput.value;
    }
    globalDag.post();
}


function addProp(prop: Prop | undefined, id: string) { // nosonar
    if (prop === undefined) {
        lastPropElement = 'nameInput';
        lastPropId = id;
    }
    // 获取属性容器  
    const propsContainer = <HTMLDivElement>document.querySelector(`#${viewId} #props`)!;

    // 创建一个新的 div 元素作为新的属性行  
    let newRow: HTMLDivElement = document.createElement('div');
    newRow.id = id;

    newRow.className = 'propRow';

    // 添加删除按钮  
    let removeButton: HTMLButtonElement = document.createElement('button');
    removeButton.type = 'button';
    removeButton.textContent = 'Remove';
    removeButton.className = 'removeButton';
    removeButton.onclick = function (e) {
        const button = <HTMLButtonElement>e.target;
        const parentNode = <HTMLDivElement>button.parentNode;
        parentNode.remove();
        save();
    };
    removeButton.addEventListener('focus', function (event) {
        const button = <HTMLButtonElement>event.target;
        const parentNode = <HTMLDivElement>button.parentNode;
        lastPropElement = 'remove';
        lastPropId = parentNode.id;
    });
    newRow.appendChild(removeButton);
    if (lastPropElement === 'remove' && lastPropId === id) {
        targetElement = removeButton;
    }

    // 创建属性类型选择框  
    let typeSelect = document.createElement('select');
    typeSelect.addEventListener("input", function (event) {

        const select = <HTMLSelectElement>event.target;
        const parentNode = <HTMLDivElement>select.parentNode;
        lastPropId = parentNode.id;
        lastPropElement = 'typeSelect';
        save();
    });
    typeSelect.addEventListener("focus", function (event) {
        const select = <HTMLSelectElement>event.target;
        const parentNode = <HTMLDivElement>select.parentNode;
        lastPropId = parentNode.id;
        lastPropElement = 'typeSelect';
    });
    typeSelect.required = true;
    typeSelect.className = 'propType';

    // 添加选项  
    let option;

    option = document.createElement('option');
    option.value = 'String';
    option.text = 'String';
    option.selected = true;
    typeSelect.appendChild(option);

    option = document.createElement('option');
    option.value = 'Integer';
    option.text = 'Integer';
    typeSelect.appendChild(option);

    option = document.createElement('option');
    option.value = 'Long';
    option.text = 'Long';
    typeSelect.appendChild(option);

    option = document.createElement('option');
    option.value = 'Double';
    option.text = 'Double';

    typeSelect.appendChild(option);
    option = document.createElement('option');
    option.value = 'Boolean';
    option.text = 'Boolean';
    typeSelect.appendChild(option);


    if (prop?.type) {
        for (const child of typeSelect.children || []) {
            const option = <HTMLOptionElement>child;
            if (prop.type === option.value) {
                option.selected = true;
                break;
            }
        }
    }
    if (lastPropElement === 'typeSelect' && lastPropId === id) {
        targetElement = typeSelect;
    }

    newRow.appendChild(typeSelect);

    // 添加分隔符  
    newRow.appendChild(document.createTextNode(' '));

    // 创建属性名输入框  
    let nameInput = document.createElement('input');
    nameInput.addEventListener('input', function (event) {
        const input = <HTMLInputElement>event.target;
        const parentNode = <HTMLDivElement>input.parentNode;
        lastPropId = parentNode.id;
        lastPropElement = 'nameInput';
        lastCursorPos = input.selectionStart!;
        handleInputDelayed();
    });
    nameInput.addEventListener('focus', function (event) {
        const input = <HTMLInputElement>event.target;
        const parentNode = <HTMLDivElement>input.parentNode;
        lastPropId = parentNode.id;
        lastPropElement = 'nameInput';
    });
    nameInput.type = 'text';
    nameInput.placeholder = 'Name';
    nameInput.className = 'propName';
    nameInput.required = true;

    if (prop?.name) {
        nameInput.value = prop.name;
    }
    if (lastPropElement === 'nameInput' && lastPropId === id) {
        targetElement = nameInput;
    }
    newRow.appendChild(nameInput);

    // 添加分隔符（这里使用文本节点）  
    newRow.appendChild(document.createTextNode(' '));

    // 创建属性值输入框  
    let valueInput = document.createElement('input');
    valueInput.addEventListener('input', function (event) {
        const input = <HTMLInputElement>event.target;
        const parentNode = <HTMLDivElement>input.parentNode;
        lastPropId = parentNode.id;
        lastPropElement = 'valueInput';
        lastCursorPos = input.selectionStart!;
        handleInputDelayed();
    });
    valueInput.addEventListener('focus', function (event) {
        const input = <HTMLInputElement>event.target;
        const parentNode = <HTMLDivElement>input.parentNode;
        lastPropId = parentNode.id;
        lastPropElement = 'valueInput';
    });

    valueInput.type = 'text';
    valueInput.placeholder = 'Value';
    valueInput.className = 'propValue';
    valueInput.required = true;
    if (prop?.value || prop?.value === '') {
        valueInput.value = prop.value;
    }
    if (lastPropElement === 'valueInput' && lastPropId === id) {
        targetElement = valueInput;
    }
    newRow.appendChild(valueInput);

    // 将新行添加到容器中  
    propsContainer?.appendChild(newRow);
    if (targetElement) {
        targetElement.focus();
        if (lastCursorPos > 0) {
            let input = <HTMLInputElement>targetElement;
            input.setSelectionRange(lastCursorPos, lastCursorPos);
            lastCursorPos = -1;
        }
    }
}

function extractProps(): Prop[] | undefined {
    const propsContainer = <HTMLDivElement>document.querySelector(`#${viewId} #props`);

    let props: Prop[] = [];
    for (const element of propsContainer.children || []) {
        const prop: Prop = {
            name: "",
            value: "",
            type: ""
        };
        for (const child of element.children) {
            switch (child.className) {
                case 'propName':
                    prop.name = (<HTMLInputElement>child).value;
                    break;
                case 'propValue':
                    prop.value = (<HTMLInputElement>child).value;
                    break;
                case 'propType':
                    prop.type = (<HTMLSelectElement>child).value;
                    // 如果prop的类型为String,则省略
                    if (prop.type === 'String') {
                        prop.type = undefined;
                    }
                    break;
                default:
                    break;
            }
        }
        props.push(prop);
    }
    return props.length > 0 ? props : undefined;
}
let timeoutId: ReturnType<typeof setTimeout>; // 存储 setTimeout 的返回值
function handleInputDelayed() {
    // 延迟 500 毫秒后处理输入事件
    if (timeoutId) {
        clearTimeout(timeoutId); // 清除之前的计时器
    }
    timeoutId = setTimeout(function () {
        save();
    }, 500);
}