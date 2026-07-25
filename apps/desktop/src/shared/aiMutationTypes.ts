/**
 * 模块用途：定义模型提案与桌面端确认执行共用的 AI 变更合同。
 * 模块边界：只包含可序列化类型，不依赖 Electron、React 或具体模型供应商。
 */
export const AI_MUTATION_SCHEMA_VERSION = 1 as const;

export type CyclePlanMutationStatus = "draft" | "active" | "paused" | "archived";
export type ContentBlockFormat = "json" | "markdown";

export interface ContentBlockDraft {
  kind: string;
  title: string;
  format: ContentBlockFormat;
  data: Record<string, unknown>;
}

export interface TodoCreateDraft {
  title: string;
  date: string;
  notes?: string;
}

export interface TodoPatch {
  title?: string;
  date?: string;
  notes?: string;
}

export interface CyclePlanCreateDraft {
  title: string;
  topic: string;
  description: string;
  status?: CyclePlanMutationStatus;
  entries?: CyclePlanEntryCreateDraft[];
}

export interface CyclePlanPatch {
  title?: string;
  topic?: string;
  description?: string;
}

export interface CyclePlanEntryCreateDraft {
  date: string;
  title: string;
  contentSummary: string;
  contentBlocks: ContentBlockDraft[];
}

export interface CyclePlanEntryPatch {
  date?: string;
  title?: string;
  contentSummary?: string;
  contentBlocks?: ContentBlockDraft[];
}

type TargetOperation<T extends string> = {
  type: T;
  targetId: string;
  expectedUpdatedAt?: string;
  targetLabel?: string;
};

export type AiMutationOperation =
  | { type: "todo.create"; draft: TodoCreateDraft }
  | (TargetOperation<"todo.update"> & { patch: TodoPatch })
  | TargetOperation<"todo.complete">
  | TargetOperation<"todo.reopen">
  | TargetOperation<"todo.delete">
  | { type: "cyclePlan.create"; draft: CyclePlanCreateDraft }
  | (TargetOperation<"cyclePlan.update"> & { patch: CyclePlanPatch })
  | (TargetOperation<"cyclePlan.setStatus"> & { status: CyclePlanMutationStatus })
  | TargetOperation<"cyclePlan.delete">
  | {
      type: "cyclePlan.entry.create";
      planId: string;
      expectedUpdatedAt?: string;
      targetLabel?: string;
      draft: CyclePlanEntryCreateDraft;
    }
  | (TargetOperation<"cyclePlan.entry.update"> & { patch: CyclePlanEntryPatch })
  | TargetOperation<"cyclePlan.entry.complete">
  | TargetOperation<"cyclePlan.entry.reopen">
  | TargetOperation<"cyclePlan.entry.skip">
  | TargetOperation<"cyclePlan.entry.delete">;

export interface ModelMutationProposal {
  schemaVersion: typeof AI_MUTATION_SCHEMA_VERSION;
  summary: string;
  operations: AiMutationOperation[];
}

export interface AiMutationProposal extends ModelMutationProposal {
  proposalId: string;
}

export interface AiConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export type AiGenerationContext =
  | { type: "assistant" }
  | { type: "cyclePlan.create" }
  | { type: "cyclePlan.adjust"; targetPlanId: string };

export interface AiGenerateRequest {
  sessionId: string;
  requestId: string;
  message: string;
  conversation: AiConversationTurn[];
  context: AiGenerationContext;
  supersedesProposalId?: string;
}

export type AiGenerateResult =
  | { status: "message"; message: string }
  | { status: "proposal"; proposal: AiMutationProposal };

export type AiExecutionFailureCode =
  | "target_missing"
  | "version_conflict"
  | "validation_failed"
  | "persistence_failed";

export type AiExecuteResult =
  | {
      status: "success";
      summary: string;
      operationCount: number;
      state: { todos: unknown[]; cyclePlans: unknown[] };
    }
  | {
      status: "failed";
      code: AiExecutionFailureCode;
      message: string;
      targetId?: string;
    };
