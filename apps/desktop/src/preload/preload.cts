/**
 * 模块用途：暴露渲染进程可用的安全桌面 API。
 * 模块边界：只桥接 Electron IPC，不访问 React 状态；使用 .cts 输出 sandbox 可执行的 CommonJS。
 */
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("hermesAppData", {
  loadState: () => ipcRenderer.invoke("data:load-state"),
  replaceTodos: (todos: unknown[]) => ipcRenderer.invoke("data:replace-todos", todos),
  replaceCyclePlans: (cyclePlans: unknown[]) =>
    ipcRenderer.invoke("data:replace-cycle-plans", cyclePlans),
  onReloadRequested: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("data:reload-requested", listener);
    return () => ipcRenderer.removeListener("data:reload-requested", listener);
  }
});

contextBridge.exposeInMainWorld("hermesSidebar", {
  onCollapseRequested: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("sidebar:collapse-requested", listener);
    return () => ipcRenderer.removeListener("sidebar:collapse-requested", listener);
  },
  onExpandRequested: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("sidebar:expand-requested", listener);
    return () => ipcRenderer.removeListener("sidebar:expand-requested", listener);
  }
});

contextBridge.exposeInMainWorld("hermesPet", {
  getLayout: () => ipcRenderer.invoke("pet:get-layout"),
  setExpanded: (expanded: boolean) => ipcRenderer.invoke("pet:set-expanded", expanded),
  startDrag: () => ipcRenderer.invoke("pet:drag-start"),
  updateDrag: () => ipcRenderer.invoke("pet:drag-update"),
  endDrag: () => ipcRenderer.invoke("pet:drag-end"),
  cancelDrag: () => ipcRenderer.invoke("pet:drag-cancel"),
  onLayoutChanged: (callback: (snapshot: unknown) => void) => {
    const listener = (_event: unknown, snapshot: unknown) => callback(snapshot);
    ipcRenderer.on("pet:layout-changed", listener);
    return () => ipcRenderer.removeListener("pet:layout-changed", listener);
  }
});
