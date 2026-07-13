/**
 * 模块用途：注册 renderer 可调用的桌宠窗口白名单 IPC。
 * 模块边界：只转发到 PetWindowController，不暴露 Electron 对象。
 */
import type { IpcMain } from "electron";
import {
  isPetDragPointerSample,
  isPetDragStartSample,
  isPetPointerId
} from "../../shared/petDragContract.js";
import type { PetWindowController } from "./petWindowController.js";

export const PET_CHANNELS = {
  layout: "pet:get-layout",
  expanded: "pet:set-expanded",
  dragStart: "pet:drag-start",
  dragUpdate: "pet:drag-update",
  dragEnd: "pet:drag-end",
  dragCancel: "pet:drag-cancel"
} as const;

export function registerPetIpc(ipc: IpcMain, controller: PetWindowController): void {
  ipc.handle(PET_CHANNELS.layout, () => controller.getLayout());
  ipc.handle(PET_CHANNELS.expanded, (_event, expanded: boolean) =>
    controller.setExpanded(expanded));
  ipc.on(PET_CHANNELS.dragStart, (_event, sample: unknown) => {
    if (isPetDragStartSample(sample)) controller.startDrag(sample);
  });
  ipc.on(PET_CHANNELS.dragUpdate, (_event, sample: unknown) => {
    if (isPetDragPointerSample(sample)) controller.updateDrag(sample);
  });
  ipc.on(PET_CHANNELS.dragEnd, (_event, sample: unknown) => {
    if (isPetDragPointerSample(sample)) void controller.endDrag(sample);
  });
  ipc.on(PET_CHANNELS.dragCancel, (_event, pointerId: unknown) => {
    if (isPetPointerId(pointerId)) controller.cancelDrag(pointerId);
  });
}
