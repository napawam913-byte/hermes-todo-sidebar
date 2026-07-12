/**
 * 模块用途：验证正式版应用状态文件的保存、备份、恢复和导入安全性。
 * 模块边界：使用临时目录测试真实文件系统，不启动 Electron。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AppStateFileStore } from "./appStateFileStore.js";
import { createEmptyAppState } from "./appStateTypes.js";

let dataDirectory = "";

beforeEach(async () => {
  dataDirectory = await mkdtemp(path.join(os.tmpdir(), "hermes-sidebar-store-"));
});

afterEach(async () => {
  await rm(dataDirectory, { recursive: true, force: true });
});

describe("AppStateFileStore", () => {
  it("saves and loads a versioned application state", async () => {
    const store = new AppStateFileStore({ dataDirectory });
    const state = { ...createEmptyAppState(), todos: [{ id: "todo_1" }] };

    await store.save(state);

    await expect(store.load()).resolves.toMatchObject({
      schemaVersion: 1,
      todos: [{ id: "todo_1" }]
    });
  });

  it("keeps only the seven newest backups", async () => {
    let tick = 0;
    const store = new AppStateFileStore({
      dataDirectory,
      now: () => new Date(2026, 6, 12, 9, 0, tick++)
    });

    for (let index = 0; index < 10; index += 1) {
      await store.save({ ...createEmptyAppState(), todos: [{ index }] });
    }

    const backups = await readdir(path.join(dataDirectory, "backups"));
    expect(backups).toHaveLength(7);
  });

  it("recovers from the newest valid backup when the main file is broken", async () => {
    const store = new AppStateFileStore({ dataDirectory });
    await store.save({ ...createEmptyAppState(), todos: [{ id: "safe" }] });
    await store.save({ ...createEmptyAppState(), todos: [{ id: "latest" }] });
    await writeFile(store.stateFilePath, "{broken json", "utf8");

    const recovered = await store.load();

    expect(recovered.todos).toEqual([{ id: "safe" }]);
  });

  it("rejects an invalid import without replacing the current state", async () => {
    const store = new AppStateFileStore({ dataDirectory });
    await store.save({ ...createEmptyAppState(), todos: [{ id: "current" }] });
    const importPath = path.join(dataDirectory, "invalid-import.json");
    await writeFile(importPath, JSON.stringify({ schemaVersion: 99 }), "utf8");

    await expect(store.importFrom(importPath)).rejects.toThrow("不支持的应用数据格式");
    const persisted = JSON.parse(await readFile(store.stateFilePath, "utf8"));
    expect(persisted.todos).toEqual([{ id: "current" }]);
  });
});
