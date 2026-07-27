/**
 * 模块用途：装配主进程 AI 配置、模型客户端、提案服务、执行器和 IPC。
 * 模块边界：只负责依赖连接，不包含提示词、校验或 UI 逻辑。
 */
import { safeStorage, type IpcMain } from "electron";
import type { AiMutationPort, AiSnapshotPort } from "./aiDataPorts.js";
import { AiConfigFileStore } from "./aiConfigFileStore.js";
import { AiConfigDraftFileStore } from "./aiConfigDraftFileStore.js";
import { AiConfigStore } from "./aiConfigStore.js";
import { AiCoordinator } from "./aiCoordinator.js";
import { registerAiIpc } from "./aiIpc.js";
import { AiProposalExecutor } from "./aiProposalExecutor.js";
import { AiProposalService } from "./aiProposalService.js";
import { OpenAiCompatibleClient } from "./openAiCompatibleClient.js";
import { HermesCapabilityProbe } from "./hermesCapabilityProbe.js";

export interface AiRuntimeOptions {
  snapshotPort: AiSnapshotPort;
  mutationPort: AiMutationPort;
  userDataDirectory: string;
}

export function registerAiRuntime(
  ipc: IpcMain,
  options: AiRuntimeOptions
): AiCoordinator {
  const configStore = new AiConfigStore(
    new AiConfigFileStore(options.userDataDirectory),
    {
      isAvailable: () => safeStorage.isEncryptionAvailable(),
      encrypt: (value) => safeStorage.encryptString(value),
      decrypt: (value) => safeStorage.decryptString(value)
    }
  );
  const modelClient = new OpenAiCompatibleClient();
  const coordinator = new AiCoordinator({
    configStore,
    configDraftStore: new AiConfigDraftFileStore(options.userDataDirectory),
    connectionClient: modelClient,
    capabilityProbe: new HermesCapabilityProbe(),
    proposalService: new AiProposalService({
      snapshotPort: options.snapshotPort,
      credentials: configStore,
      modelClient
    }),
    executor: new AiProposalExecutor(options.mutationPort)
  });
  registerAiIpc(ipc, coordinator);
  return coordinator;
}
