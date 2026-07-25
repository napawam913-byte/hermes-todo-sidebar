/**
 * 模块用途：定义手动操作与 AI 提案共用的应用变更批次合同。
 * 模块边界：复用现有操作白名单，不依赖 Electron、React 或持久化实现。
 */
import type { AiMutationOperation } from "./aiMutationTypes.js";

export type AppMutationOperation = AiMutationOperation;

export type AppMutationSource =
  | { type: "manual" }
  | { type: "ai_draft"; proposalId: string };

export interface AppMutationBatch {
  source: AppMutationSource;
  summary: string;
  operations: AppMutationOperation[];
}
