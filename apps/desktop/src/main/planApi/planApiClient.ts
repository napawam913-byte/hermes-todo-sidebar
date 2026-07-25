import {
  parsePlanApiHealth,
  parsePlanApiMutationResult,
  parsePlanApiSnapshot,
} from "./planApiWireTypes.js";
import type {
  PlanApiHealth,
  PlanApiMutationBatch,
  PlanApiMutationResult,
  PlanApiSnapshot,
} from "./planApiWireTypes.js";
import { PlanApiError, type PlanApiErrorCode } from "./planApiErrors.js";

export interface PlanApiClientOptions {
  baseUrl: string;
  token: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class PlanApiClient {
  constructor(private readonly options: PlanApiClientOptions) {}

  health(): Promise<PlanApiHealth> {
    return this.request("/v1/health", { method: "GET" }, parsePlanApiHealth);
  }

  snapshot(): Promise<PlanApiSnapshot> {
    return this.request("/v1/snapshot", { method: "GET" }, parsePlanApiSnapshot);
  }

  mutate(batch: PlanApiMutationBatch): Promise<PlanApiMutationResult> {
    return this.request(
      "/v1/mutations",
      { method: "POST", body: JSON.stringify(batch) },
      parsePlanApiMutationResult,
    );
  }

  private async request<T>(
    path: string,
    init: RequestInit,
    parse: (value: unknown) => T,
  ): Promise<T> {
    const fetchImpl = this.options.fetchImpl ?? fetch;
    let response: Response;
    try {
      response = await fetchImpl(`${this.options.baseUrl.replace(/\/$/, "")}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Authorization: `Bearer ${this.options.token}`,
          ...init.headers,
        },
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 8_000),
      });
    } catch {
      throw new PlanApiError("offline");
    }

    const body = await response.json().catch(() => null) as unknown;
    const requestId = readRequestId(body, this.options.token);
    if (!response.ok) {
      throw new PlanApiError(classifyStatus(response.status), response.status, requestId);
    }

    try {
      return parse(body);
    } catch {
      throw new PlanApiError("response_invalid", response.status, requestId);
    }
  }
}

function classifyStatus(status: number): PlanApiErrorCode {
  if (status === 401 || status === 403) return "auth_failed";
  if (status === 409) return "version_conflict";
  if (status === 422) return "validation_failed";
  return "http_error";
}

function readRequestId(value: unknown, token: string): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const requestId = (value as { requestId?: unknown }).requestId;
  return typeof requestId === "string" && requestId && requestId !== token ? requestId : undefined;
}
