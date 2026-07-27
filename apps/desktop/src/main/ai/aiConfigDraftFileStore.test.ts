/**
 * 模块用途：验证模型配置草稿只保存非敏感字段并支持显式清除。
 * 模块边界：使用临时目录，不调用 Electron safeStorage 或真实用户目录。
 */
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })));
});

describe("AiConfigDraftFileStore", () => {
  it("persists only the non-secret draft and clears it explicitly", async () => {
    const module = await import("./aiConfigDraftFileStore.js").catch(() => null);
    expect(module).not.toBeNull();
    if (!module) return;

    const directory = await mkdtemp(path.join(os.tmpdir(), "hermes-ai-draft-"));
    temporaryDirectories.push(directory);
    const store = new module.AiConfigDraftFileStore(directory);
    const draft = {
      schemaVersion: 1 as const,
      baseUrl: "https://api.example.com/v1",
      model: "model-v1",
      updatedAt: "2026-07-17T01:00:00.000Z"
    };

    await store.save(draft);

    await expect(store.load()).resolves.toEqual(draft);
    const raw = await readFile(path.join(directory, "ai-config-draft.v1.json"), "utf8");
    expect(raw).not.toContain("apiKey");
    expect(raw).not.toContain("secret");

    await store.clear();
    await expect(store.load()).resolves.toBeNull();
  });
});
