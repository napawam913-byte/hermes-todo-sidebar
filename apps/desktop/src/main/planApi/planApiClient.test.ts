import { describe, expect, it, vi } from "vitest";
import { PlanApiClient } from "./planApiClient.js";
import { PlanApiError } from "./planApiErrors.js";

const health = {
  status: "ok", service: "plan-api", apiVersion: 1,
  database: { status: "ok" }, serverRevision: 4,
};

const response = (body: unknown, status = 200) => new Response(
  JSON.stringify(body),
  { status, headers: { "Content-Type": "application/json" } },
);

const clientWith = (fetchImpl: typeof fetch, timeoutMs?: number) => new PlanApiClient({
  baseUrl: "http://127.0.0.1:8743/",
  token: "secret-token",
  fetchImpl,
  ...(timeoutMs === undefined ? {} : { timeoutMs }),
});

describe("PlanApiClient", () => {
  it("sends bearer authentication and parses health", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(input).toBe("http://127.0.0.1:8743/v1/health");
      expect(init?.method).toBe("GET");
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer secret-token");
      expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json; charset=utf-8");
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return response(health);
    }) as typeof fetch;

    await expect(clientWith(fetchImpl).health()).resolves.toEqual(health);
  });

  it("classifies 401 without leaking the token", async () => {
    const fetchImpl = vi.fn(async () => response(
      { code: "permission_denied", message: "secret-token denied", requestId: "r1" }, 401,
    )) as typeof fetch;
    const error = await clientWith(fetchImpl).snapshot().catch((value: unknown) => value);

    expect(error).toBeInstanceOf(PlanApiError);
    expect(error).toMatchObject({ code: "auth_failed", status: 401, requestId: "r1" });
    expect(String(error)).not.toContain("secret-token");
  });

  it.each([
    [403, "auth_failed"], [409, "version_conflict"], [422, "validation_failed"], [500, "http_error"],
  ] as const)("classifies HTTP %i as %s", async (status, code) => {
    const fetchImpl = vi.fn(async () => response({ message: "unsafe detail", requestId: "req-2" }, status)) as typeof fetch;
    await expect(clientWith(fetchImpl).snapshot()).rejects.toMatchObject({ code, status, requestId: "req-2" });
  });

  it("classifies network and timeout failures as offline", async () => {
    const network = vi.fn(async () => { throw new TypeError("secret-token network detail"); }) as typeof fetch;
    await expect(clientWith(network).health()).rejects.toMatchObject({ code: "offline" });
    await expect(clientWith(network).health()).rejects.not.toThrow("secret-token");

    const timeout = vi.fn(async () => { throw new DOMException("secret-token timeout detail", "TimeoutError"); }) as typeof fetch;
    await expect(clientWith(timeout, 1234).health()).rejects.toMatchObject({ code: "offline" });
  });

  it("posts mutation batches as JSON", async () => {
    const batch = { idempotencyKey: "idem-1", operations: [] } as const;
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(init?.body).toBe(JSON.stringify(batch));
      return response({ serverRevision: 5, changedTaskIds: [], changedEntryIds: [] });
    }) as typeof fetch;

    await expect(clientWith(fetchImpl).mutate(batch)).resolves.toEqual({
      serverRevision: 5, changedTaskIds: [], changedEntryIds: [],
    });
  });
});
