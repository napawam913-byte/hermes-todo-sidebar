/**
 * 模块用途：验证 OpenAI 兼容客户端支持普通文本、Hermes 会话头和密钥保护。
 * 模块边界：使用注入的 fetch，不访问真实网络。
 */
import { describe, expect, it, vi } from "vitest";
import { OpenAiCompatibleClient } from "./openAiCompatibleClient.js";

const credentials = {
  baseUrl: "https://api.example.com/v1",
  model: "hermes-agent",
  apiKey: "sk-super-secret"
};
const requestMetadata = { sessionId: "session_1", requestId: "request_1" };

function assistantResponse(content: string): Response {
  return new Response(JSON.stringify({
    choices: [{ message: { content } }]
  }), { status: 200 });
}

function chunkedResponse(chunks: Uint8Array[]) {
  let pulls = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls += 1;
      const chunk = chunks.shift();
      if (chunk) controller.enqueue(chunk);
      else controller.close();
    }
  }, { highWaterMark: 0 });
  const nativeReader = stream.getReader();
  const reader = {
    read: vi.fn(() => nativeReader.read()),
    cancel: vi.fn((reason?: unknown) => nativeReader.cancel(reason)),
    releaseLock: vi.fn(() => nativeReader.releaseLock())
  };
  return {
    pulls: () => pulls,
    reader,
    response: { ok: true, status: 200, headers: new Headers(), body: { getReader: () => reader } } as unknown as Response
  };
}

describe("OpenAiCompatibleClient", () => {
  it("returns ordinary assistant text without forcing response_format", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      assistantResponse("新手可以先从每周三练开始。")
    );
    const client = new OpenAiCompatibleClient(fetchMock as typeof fetch);

    const result = await client.requestAssistant(credentials, [
      { role: "system", content: "你是通用助手" },
      { role: "user", content: "新手一周练几次？" }
    ], requestMetadata);

    expect(result).toBe("新手可以先从每周三练开始。");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const options = fetchMock.mock.calls[0][1];
    const body = JSON.parse(options.body as string);
    expect(body).not.toHaveProperty("response_format");
    expect(options.headers.Authorization).toBe("Bearer sk-super-secret");
    expect(options.headers["X-Hermes-Session-Id"]).toBe("session_1");
    expect(options.headers["X-Hermes-Session-Key"]).toBe("hermes-todo-sidebar:desktop");
    expect(options.headers["Idempotency-Key"]).toBe("request_1");
  });

  it("returns proposal JSON as text for the local classifier", async () => {
    const proposal = JSON.stringify({
      schemaVersion: 1,
      summary: "创建健身计划",
      operations: []
    });
    const fetchMock = vi.fn().mockResolvedValue(assistantResponse(proposal));
    const client = new OpenAiCompatibleClient(fetchMock as typeof fetch);

    await expect(client.requestAssistant(
      credentials,
      [{ role: "user", content: "制定计划" }],
      requestMetadata
    )).resolves.toBe(proposal);
  });

  it("does not include the API key in request errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("bad gateway", { status: 502 }));
    const client = new OpenAiCompatibleClient(fetchMock as typeof fetch);

    await expect(client.requestAssistant(
      credentials,
      [{ role: "user", content: "测试" }],
      requestMetadata
    )).rejects.not.toThrow(/sk-super-secret/);
  });

  it("reports the network cause without leaking the API key", async () => {
    const socketError = Object.assign(new Error("socket closed"), { code: "ECONNRESET" });
    const fetchMock = vi.fn().mockRejectedValue(
      new TypeError("fetch failed", { cause: socketError })
    );
    const client = new OpenAiCompatibleClient(fetchMock as typeof fetch);

    await expect(client.testConnection(credentials))
      .rejects.toThrow("无法连接模型接口（ECONNRESET）");
    await expect(client.testConnection(credentials))
      .rejects.not.toThrow(/sk-super-secret/);
  });

  it("rejects an oversized declared response before JSON parsing", async () => {
    const response = new Response("{}", {
      headers: { "Content-Length": "524289" }
    });
    const client = new OpenAiCompatibleClient(vi.fn().mockResolvedValue(response));

    await expect(client.testConnection(credentials)).rejects.toThrow(/响应过大/);
  });

  it("rejects an oversized actual response before JSON parsing", async () => {
    const response = new Response("x".repeat(524289));
    const client = new OpenAiCompatibleClient(vi.fn().mockResolvedValue(response));

    await expect(client.testConnection(credentials)).rejects.toThrow(/响应过大/);
  });

  it("cancels an oversized chunked response before reading the next chunk", async () => {
    const stream = chunkedResponse([
      new Uint8Array(524289),
      new TextEncoder().encode('{"choices":[]}')
    ]);
    const client = new OpenAiCompatibleClient(vi.fn().mockResolvedValue(stream.response));

    await expect(client.testConnection(credentials)).rejects.toThrow(/响应过大/);
    expect(stream.reader.cancel).toHaveBeenCalledOnce();
    expect(stream.reader.read).toHaveBeenCalledTimes(1);
    expect(stream.pulls()).toBe(1);
  });

  it("treats a successful response without a body as an invalid assistant response", async () => {
    const client = new OpenAiCompatibleClient(vi.fn().mockResolvedValue(new Response(null)));

    await expect(client.requestAssistant(credentials, [{ role: "user", content: "测试" }], requestMetadata))
      .rejects.toThrow(/响应格式/);
  });
});
