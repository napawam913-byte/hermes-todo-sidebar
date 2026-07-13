/**
 * 模块用途：验证桌宠入口位置记忆和屏幕边界夹取逻辑。
 * 模块边界：不读写真实磁盘，只测试可替换的内存存储实现。
 */
import { describe, expect, it } from "vitest";
import {
  clampPetPosition,
  createMemoryPetPositionStore,
  resolvePetPosition
} from "./petPositionStore.js";

describe("petPositionStore", () => {
  it("keeps a dragged pet position inside the visible work area", () => {
    const position = clampPetPosition(
      { x: 2000, y: -100 },
      { x: 0, y: 40, width: 1440, height: 860 },
      { width: 88, height: 96 },
      8
    );

    expect(position).toEqual({ x: 1344, y: 48 });
  });

  it("saves and loads the last known pet position through a store interface", () => {
    const store = createMemoryPetPositionStore();

    store.save({ x: 1200, y: 720 });

    expect(store.load()).toEqual({ x: 1200, y: 720 });
  });

  it("分辨率变化后把已保存位置夹回原显示器", () => {
    const resolved = resolvePetPosition(
      { displayId: 2, x: 2400, y: 1100 },
      [
        { id: 1, workArea: { x: 0, y: 0, width: 1707, height: 1019 } },
        { id: 2, workArea: { x: 1707, y: 0, width: 720, height: 1232 } }
      ],
      1
    );

    expect(resolved).toEqual({ displayId: 2, position: { x: 2331, y: 1100 } });
  });

  it("原显示器断开时回到主屏默认位置", () => {
    const resolved = resolvePetPosition(
      { displayId: 2, x: 1900, y: 700 },
      [{ id: 1, workArea: { x: 0, y: 0, width: 1707, height: 1019 } }],
      1
    );

    expect(resolved).toEqual({ displayId: 1, position: { x: 1595, y: 899 } });
  });
});
