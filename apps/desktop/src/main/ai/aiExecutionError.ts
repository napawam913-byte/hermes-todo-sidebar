/**
 * 模块用途：给主进程执行失败附加稳定错误码，供 renderer 选择恢复动作。
 * 模块边界：不处理 UI 文案，也不吞掉原始错误信息。
 */
import type { AiExecutionFailureCode } from "../../shared/aiMutationTypes.js";

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
  return new AiExecutionError(
    fallbackCode,
    error instanceof Error ? error.message : fallbackMessage
  );
}
