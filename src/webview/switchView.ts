
// 指定viewId 的div可见，其他div都不可见
export default function switchView(viewId: string) {
    for (const view of document.querySelectorAll('body>div.view')) {
        (<HTMLDivElement>view).style.display = 'none';
    }
    const canvasContainer = document.querySelector<HTMLDivElement>("body>div#canvasContainer")!;
    canvasContainer.style.visibility = 'hidden';

    const targetView = <HTMLDivElement>document.getElementById(viewId);
    if (viewId === 'canvasContainer') {
        targetView.style.visibility = 'visible';
    } else {
        targetView.style.display = 'block';
    }
}