import { Prop } from "./Dag";

export function addProp(viewId: string, prop: Prop | undefined) {
    // 获取属性容器  
    const propsContainer = <HTMLDivElement>document.querySelector(`#${viewId} #props`)!;

    // 创建一个新的 div 元素作为新的属性行  
    let newRow: HTMLDivElement = document.createElement('div');

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
    };
    newRow.appendChild(removeButton);

    // 创建属性类型选择框  
    let typeSelect = document.createElement('select');
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

    // 添加分隔符  
    newRow.appendChild(document.createTextNode(' '));

    // 创建属性名输入框  
    let nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Name';
    nameInput.className = 'propName';
    nameInput.required = true;

    if (prop?.name) {
        nameInput.value = prop.name;
    }
    newRow.appendChild(nameInput);

    // 添加分隔符（这里使用文本节点）  
    newRow.appendChild(document.createTextNode(' '));

    // 创建属性值输入框  
    let valueInput = document.createElement('input');
    valueInput.type = 'text';
    valueInput.placeholder = 'Value';
    valueInput.className = 'propValue';
    valueInput.required = true;
    if (prop?.value) {
        valueInput.value = prop.value;
    }
    newRow.appendChild(valueInput);

    // 将新行添加到容器中  
    propsContainer?.appendChild(newRow);
    nameInput.focus();
}

export function extractProps(viewId: string): Prop[] | undefined {
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