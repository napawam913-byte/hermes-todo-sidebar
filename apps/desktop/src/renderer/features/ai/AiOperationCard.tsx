/**
 * 模块用途：统一回显单条 AI 新增、修改、状态或永久删除操作。
 * 模块边界：只读类型化提案，不执行操作也不修改字段。
 */
import { Check, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import type { AiMutationOperation } from "../../../shared/aiMutationTypes";

interface AiOperationCardProps { operation: AiMutationOperation; }

export function AiOperationCard({ operation }: AiOperationCardProps) {
  const meta = operationMeta(operation);
  const Icon = meta.icon;
  return (
    <article className={`ai-operation-card is-${meta.kind}`}>
      <div className="ai-operation-badge"><Icon size={14} />{meta.label}<span>{operation.type}</span></div>
      <strong>{meta.title}</strong>
      <p>{meta.description}</p>
      {meta.payload ? <pre>{meta.payload}</pre> : null}
      {meta.kind === "delete" ? <small>永久删除后不可恢复</small> : null}
    </article>
  );
}

function operationMeta(operation: AiMutationOperation) {
  const payload = "patch" in operation
    ? JSON.stringify(operation.patch, null, 2)
    : undefined;
  if (operation.type.endsWith(".delete")) return {
    kind: "delete", label: "永久删除", icon: Trash2,
    title: targetTitle(operation), description: "目标对象将从本地数据中移除", payload
  };
  if (operation.type.endsWith(".create")) return {
    kind: "create", label: "新增", icon: Plus,
    title: "draft" in operation ? operation.draft.title : "新增对象",
    description: operation.type === "cyclePlan.entry.create" ? `加入计划 ${operation.planId}` : "来源标记为 AI 草稿",
    payload: "draft" in operation ? JSON.stringify(operation.draft, null, 2) : undefined
  };
  if (operation.type.endsWith(".complete")) return {
    kind: "complete", label: "完成", icon: Check,
    title: targetTitle(operation), description: "状态改为已完成", payload
  };
  if (operation.type.endsWith(".reopen")) return {
    kind: "update", label: "恢复", icon: RotateCcw,
    title: targetTitle(operation), description: "状态恢复为待处理", payload
  };
  return {
    kind: "update", label: "修改", icon: Pencil,
    title: targetTitle(operation), description: operation.type, payload
  };
}

function targetTitle(operation: AiMutationOperation): string {
  if ("targetLabel" in operation && operation.targetLabel) return operation.targetLabel;
  if ("targetId" in operation) return operation.targetId;
  if (operation.type === "cyclePlan.entry.create") return operation.targetLabel ?? operation.planId;
  return "新对象";
}
