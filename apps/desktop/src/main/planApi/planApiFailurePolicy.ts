import { PlanApiError } from "./planApiErrors.js";

export function isReconnectablePlanApiFailure(error: unknown): boolean {
  return error instanceof PlanApiError
    && (error.code === "offline"
      || (error.code === "http_error" && (error.status ?? 0) >= 500));
}

export function preventsWriteRetry(error: unknown): boolean {
  return error instanceof PlanApiError
    && (["auth_failed", "validation_failed", "version_conflict"].includes(error.code)
      || (error.code === "http_error" && (error.status ?? 500) < 500));
}
