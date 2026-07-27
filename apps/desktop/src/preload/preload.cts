/**
 * 模块用途：暴露渲染进程可用的安全桌面 API。
 * 模块边界：只桥接 Electron IPC，不访问 React 状态；使用 .cts 输出 sandbox 可执行的 CommonJS。
 */
import { contextBridge, ipcRenderer } from "electron";
import type {
  PetDragPointerSample,
  PetDragStartSample
} from "../shared/petDragContract.js";
import type { AppMutationBatch } from "../shared/appMutationTypes.js";
import type {
  PlanApiConnectionInput,
  PlanApiMigrationInspection,
  PlanApiSnapshotEnvelope
} from "../shared/planApiBridgeContract.js";

function subscribe(channel: string, callback: (payload: unknown) => void) {
  const listener = (_event: unknown, payload: unknown) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}


contextBridge.exposeInMainWorld("hermesAppData", {
  loadState: () => ipcRenderer.invoke("plan-api:load-state"),
  executeMutations: (batch: AppMutationBatch) =>
    ipcRenderer.invoke("plan-api:execute-mutations", batch),
  onSnapshotChanged: (callback: (snapshot: PlanApiSnapshotEnvelope) => void) =>
    subscribe("plan-api:snapshot-changed", (payload) => callback(payload as PlanApiSnapshotEnvelope))
});

contextBridge.exposeInMainWorld("hermesPlanApi", {
  getConfig: () => ipcRenderer.invoke("plan-api:get-config"),
  testConnection: (input: PlanApiConnectionInput) => ipcRenderer.invoke("plan-api:test-connection", input),
  saveConnection: (input: PlanApiConnectionInput) => ipcRenderer.invoke("plan-api:save-connection", input),
  inspectMigration: (): Promise<PlanApiMigrationInspection> =>
    ipcRenderer.invoke("plan-api:inspect-migration"),
  migrateLegacyState: () => ipcRenderer.invoke("plan-api:migrate"),
  keepRemoteData: () => ipcRenderer.invoke("plan-api:keep-remote"),
  onStatusChanged: (callback: (status: PlanApiSnapshotEnvelope["status"]) => void) =>
    subscribe("plan-api:status-changed", (payload) => callback(payload as PlanApiSnapshotEnvelope["status"]))
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
  startDrag: (sample: PetDragStartSample) => ipcRenderer.send("pet:drag-start", sample),
  updateDrag: (sample: PetDragPointerSample) => ipcRenderer.send("pet:drag-update", sample),
  endDrag: (sample: PetDragPointerSample) => ipcRenderer.send("pet:drag-end", sample),
  cancelDrag: (pointerId: number) => ipcRenderer.send("pet:drag-cancel", pointerId),
  onLayoutChanged: (callback: (snapshot: unknown) => void) => {
    const listener = (_event: unknown, snapshot: unknown) => callback(snapshot);
    ipcRenderer.on("pet:layout-changed", listener);
    return () => ipcRenderer.removeListener("pet:layout-changed", listener);
  }
});
