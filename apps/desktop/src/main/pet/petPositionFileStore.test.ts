/**
 * 模块用途：验证桌宠位置文件的版本化保存、读取和损坏回退。
 * 模块边界：只在系统临时目录读写，不启动 Electron。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PetPositionFileStore } from "./petPositionFileStore.js";

let userDataDirectory = "";

beforeEach(async () => {
  userDataDirectory = await mkdtemp(path.join(os.tmpdir(), "hermes-pet-position-"));
});

afterEach(async () => {
  await rm(userDataDirectory, { recursive: true, force: true });
});

describe("PetPositionFileStore", () => {
  it("保存并读取带显示器来源的位置记录", async () => {
    const store = new PetPositionFileStore({
      userDataDirectory,
      now: () => new Date("2026-07-13T05:00:00.000Z")
    });

    await store.save({ displayId: 2, x: 1880, y: 640 });

    await expect(store.load()).resolves.toEqual({
      schemaVersion: 1,
      displayId: 2,
      x: 1880,
      y: 640,
      updatedAt: "2026-07-13T05:00:00.000Z"
    });
  });

  it("位置文件损坏时返回空值", async () => {
    const store = new PetPositionFileStore({ userDataDirectory });
    await writeFile(store.filePath, "{broken", "utf8");

    await expect(store.load()).resolves.toBeUndefined();
  });
});
