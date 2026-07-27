/**
 * 模块用途：定义 AI 读取快照与提交变更所需的最小异步数据合同。
 * 模块边界：显式适配 Plan API runtime，不暴露连接、令牌、缓存或 Electron。
 */
import type { AppMutationBatch } from "../../shared/appMutationTypes.js";
import type { StoredAppStateV1 } from "../storage/appStateTypes.js";

export interface AiSnapshotPort {
  getSnapshot(): Promise<StoredAppStateV1>;
}

export interface AiMutationPort {
  execute(batch: AppMutationBatch): Promise<StoredAppStateV1>;
}

interface AiDataRuntime {
  getStoredSnapshot(): Promise<StoredAppStateV1>;
  execute(batch: AppMutationBatch): Promise<StoredAppStateV1>;
}

export interface AiDataPorts {
  snapshotPort: AiSnapshotPort;
  mutationPort: AiMutationPort;
}

export function createAiDataPorts(runtime: AiDataRuntime): AiDataPorts {
  return {
    snapshotPort: {
      getSnapshot: () => runtime.getStoredSnapshot()
    },
    mutationPort: {
      execute: (batch) => runtime.execute(batch)
    }
  };
}
