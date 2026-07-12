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
  setExpanded: (expanded: boolean) => ipcRenderer.invoke("sidebar:set-expanded", expanded),
  setDetailOpen: (detailOpen: boolean) => ipcRenderer.invoke("sidebar:set-detail-open", detailOpen),
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
