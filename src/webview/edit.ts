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
    nameInput.disabled = false;
    nameInput.addEventListener("focus", function (event) {
        lastPropId = '-1'
        lastPropElement = 'nameInput';
        lastCursorPos = nameInput.selectionStart!;
    });
    nameInput.addEventListener("input", function (event) {
        lastPropId = '-1';
        lastPropElement = 'nameInput';
        lastCursorPos = nameInput.selectionStart!;
        handleInputDelayed(nameInput);
    });

    nameInput.value = id.includes('.') ? id.substring(id.lastIndexOf('.') + 1) : id;
    if (lastPropElement === 'nameInput' && lastPropId === '-1') {
        targetElement = nameInput;
    }


    // 填充原来的className
    let classNameInput = <HTMLInputElement>document.querySelector(`#${viewId} #className`);
    classNameInput.disabled = false;
    classNameInput.addEventListener("focus", function (event) {
        lastPropId = '-1'
        lastPropElement = 'classNameInput';
        lastCursorPos = classNameInput.selectionStart!;
    });
    classNameInput.addEventListener("input", function (event) {
        lastPropElement = 'classNameInput';
        lastPropId = '-1';
        lastCursorPos = classNameInput.selectionStart!;
        handleInputDelayed(classNameInput);
    });
    classNameInput.value = obj.className ? obj.className : '';

    if (lastPropElement === 'classNameInput' && lastPropId === '-1') {
        targetElement = classNameInput;
    }
    const propsContainer = <HTMLDivElement>document.querySelector(`#${viewId} #props`)!;
    propsContainer.innerHTML = '';

    let propId = 0;
    for (const prop of obj.props || []) {
        addProp(prop, `${propId++}`);
    }

    if (targetElement) {
        targetElement.focus();
        if (targetElement instanceof HTMLInputElement) {
            let input = <HTMLInputElement>targetElement;
            if (lastCursorPos > 0) {
                input.setSelectionRange(lastCursorPos, lastCursorPos);
            }
        }
        targetElement = undefined;
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
        nameInput.disabled=false;
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
        lastPropElement = 'propNameInput';
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
        newRow.remove();
        save();
    };
    removeButton.addEventListener('focus', function (event) {
        lastPropElement = 'remove';
        lastPropId = newRow.id;
        lastCursorPos = -1;
    });
    newRow.appendChild(removeButton);

    if (lastPropElement === 'remove' && lastPropId === id) {
        targetElement = removeButton;
    }

    // 创建属性类型选择框  
    let typeSelect = document.createElement('select');
    typeSelect.addEventListener("input", function (event) {
        lastPropId = newRow.id;
        lastPropElement = 'typeSelect';
        lastCursorPos = -1;
        save();
    });
    typeSelect.addEventListener("focus", function (event) {
        lastPropId = newRow.id;
        lastPropElement = 'typeSelect';
        lastCursorPos = -1;
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
    newRow.appendChild(typeSelect);

    if (lastPropElement === 'typeSelect' && lastPropId === id) {
        targetElement = typeSelect;
    }

    // 添加分隔符  
    newRow.appendChild(document.createTextNode(' '));

    // 创建属性名输入框  
    let propNameInput = document.createElement('input');
    propNameInput.addEventListener('input', function (event) {
        lastPropId = newRow.id;
        lastPropElement = 'propNameInput';
        lastCursorPos = propNameInput.selectionStart!;
        handleInputDelayed(propNameInput);
    });
    propNameInput.addEventListener('focus', function (event) {
        if (lastPropId != newRow.id || lastPropElement != 'propNameInput') {
            lastCursorPos = propNameInput.selectionStart!;
        }
        lastPropId = newRow.id;
        lastPropElement = 'propNameInput';
    });

    propNameInput.type = 'text';
    propNameInput.placeholder = 'Name';
    propNameInput.className = 'propName';
    propNameInput.required = true;

    if (prop?.name) {
        propNameInput.value = prop.name;
    }
    if (lastPropElement === 'propNameInput' && lastPropId === id) {
        targetElement = propNameInput;
    }
    newRow.appendChild(propNameInput);

    // 添加分隔符（这里使用文本节点）  
    newRow.appendChild(document.createTextNode(' '));

    // 创建属性值输入框  
    let propValueInput = document.createElement('input');
    propValueInput.addEventListener('input', function (event) {
        lastPropId = newRow.id;
        lastPropElement = 'propValueInput';
        lastCursorPos = propValueInput.selectionStart!;
        handleInputDelayed(propValueInput);
    });
    propValueInput.addEventListener('focus', function (event) {
        if (lastPropId != newRow.id || lastPropElement != 'propValueInput') {
            lastCursorPos = propValueInput.selectionStart!;
        }
        lastPropId = newRow.id;
        lastPropElement = 'propValueInput';
    });

    propValueInput.type = 'text';
    propValueInput.placeholder = 'Value';
    propValueInput.className = 'propValue';
    propValueInput.required = true;
    if (prop?.value || prop?.value === '') {
        propValueInput.value = prop.value;
    }
    if (lastPropElement === 'propValueInput' && lastPropId === id) {
        targetElement = propValueInput;
    }
    newRow.appendChild(propValueInput);

    // 将新行添加到容器中  
    propsContainer?.appendChild(newRow);

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
function handleInputDelayed(input: HTMLInputElement | undefined) {
    // 延迟 500 毫秒后处理输入事件
    if (timeoutId) {
        clearTimeout(timeoutId); // 清除之前的计时器
    }
    timeoutId = setTimeout(function () {
        if (input) {
            input.disabled = true;
        }
        save();
    }, 500);
}