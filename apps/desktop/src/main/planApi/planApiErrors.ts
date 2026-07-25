export type PlanApiErrorCode =
  | "auth_failed"
  | "version_conflict"
  | "validation_failed"
  | "offline"
  | "http_error"
  | "response_invalid";

const messages: Record<PlanApiErrorCode, string> = {
  auth_failed: "Plan API authentication failed",
  version_conflict: "Plan API version conflict",
  validation_failed: "Plan API validation failed",
  offline: "Plan API is unavailable",
  http_error: "Plan API request failed",
  response_invalid: "Plan API returned an invalid response",
};

export class PlanApiError extends Error {
  readonly name = "PlanApiError";

  constructor(
    readonly code: PlanApiErrorCode,
    readonly status?: number,
    readonly requestId?: string,
  ) {
    super(messages[code]);
  }
}
