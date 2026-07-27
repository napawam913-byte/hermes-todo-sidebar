/**
 * 模块用途：定义 AI 读取快照与提交变更所需的最小异步数据合同。
 * 模块边界：不暴露连接配置、令牌、缓存、Electron 或 Plan API 实现细节。
 */
import type { AppMutationBatch } from "../../shared/appMutationTypes.js";
import type { StoredAppStateV1 } from "../storage/appStateTypes.js";

export interface AiSnapshotPort {
  getSnapshot(): Promise<StoredAppStateV1>;
}

export interface AiMutationPort {
  execute(batch: AppMutationBatch): Promise<StoredAppStateV1>;
}
