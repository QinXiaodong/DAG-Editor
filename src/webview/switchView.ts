
// 指定viewId 的div可见，其他div都不可见
export default function switchView(viewId: string) {
    for (const view of document.querySelectorAll('body>div')) {
        (<HTMLDivElement>view).style.visibility = 'hidden';
    }
    const targetView = <HTMLDivElement>document.getElementById(viewId);
    targetView.style.visibility = 'visible';
}