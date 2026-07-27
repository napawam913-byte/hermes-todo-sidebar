/** 模块用途：把 Plan API 写入失败显示为可重试的渲染进程通知。 */
import { useSyncExternalStore } from "react";
import type { RepositoryWriteController, RepositoryWriteState } from "../data/electronRepositories";
import "./repositoryWriteNotice.css";

const idle: RepositoryWriteState = { pending: false };

export function RepositoryWriteNotice({ controller }: { controller: RepositoryWriteController | null }) {
  const state = useSyncExternalStore(
    (listener) => controller ? controller.onWriteStateChanged(listener) : () => undefined,
    () => controller?.getWriteState() ?? idle,
    () => controller?.getWriteState() ?? idle,
  );
  if (!controller || !state.error) return null;
  return <aside className="repository-write-notice" role="alert">
    <span>未保存到 Plan API：{state.error}</span>
    <button type="button" onClick={() => retryRepositoryWrite(controller)}>重试</button>
  </aside>;
}

export function retryRepositoryWrite(controller: RepositoryWriteController): void { controller.retryPending(); }
