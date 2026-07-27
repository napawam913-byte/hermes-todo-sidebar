/**
 * 模块用途：给主进程执行失败附加稳定错误码，供 renderer 选择恢复动作。
 * 模块边界：不处理 UI 文案，也不吞掉原始错误信息。
 */
import type { AiExecutionFailureCode } from "../../shared/aiMutationTypes.js";
import { PlanApiError } from "../planApi/planApiErrors.js";

export class AiExecutionError extends Error {
  constructor(
    readonly code: AiExecutionFailureCode,
    message: string,
    readonly targetId?: string
  ) {
    super(message);
    this.name = "AiExecutionError";
  }
}

export function toAiExecutionError(
  error: unknown,
  fallbackCode: AiExecutionFailureCode,
  fallbackMessage = "模型操作失败，请重试"
): AiExecutionError {
  if (error instanceof AiExecutionError) return error;
  if (error instanceof PlanApiError) return mapPlanApiError(error);
  return new AiExecutionError(
    fallbackCode,
    fallbackMessage
  );
}

function mapPlanApiError(error: PlanApiError): AiExecutionError {
  if (error.code === "version_conflict") {
    return new AiExecutionError(
      "version_conflict",
      "数据已更新，请刷新后重新生成提案"
    );
  }
  if (error.code === "validation_failed") {
    return new AiExecutionError(
      "validation_failed",
      "提案数据无效，请重新生成"
    );
  }
  return new AiExecutionError(
    "persistence_failed",
    "数据服务暂时不可用，请稍后重试"
  );
}
