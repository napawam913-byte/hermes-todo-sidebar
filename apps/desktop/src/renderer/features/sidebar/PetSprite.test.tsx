/**
 * 模块用途：验证通用角色图集按状态、方向和暂停状态选择正确动画片段。
 * 模块边界：只检查静态渲染合同，不运行 CSS 动画计时。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CharacterPack } from "./characterPack";
import { PetSprite } from "./PetSprite";

const pack: CharacterPack = {
  atlasUrl: "/atlas.webp",
  thumbnailUrl: "/thumbnail.webp",
  manifest: {
    schemaVersion: 2,
    id: "test-character",
    displayName: "测试角色",
    version: "1.0.0",
    atlas: {
      columns: 6,
      rows: 7,
      cellWidth: 192,
      cellHeight: 208,
      renderWidth: 88,
      renderHeight: 96
    },
    clips: {
      idle: clip(0),
      awaken: clip(1, false),
      dragging: {
        down: clip(2),
        up: clip(3),
        left: { ...clip(4), mirrorX: true },
        right: clip(4)
      },
      working: clip(5),
      complete: clip(6, false)
    }
  }
};

describe("PetSprite", () => {
  it("向左拖动只镜像角色图集帧", () => {
    const html = renderToStaticMarkup(
      <PetSprite
        direction="left"
        moving
        pack={pack}
        state="dragging"
      />
    );

    expect(html).toContain("is-mirrored");
    expect(html).toContain("--pet-row-offset:-384px");
    expect(html).not.toContain("is-paused");
  });

  it("拖动停止后暂停当前行走帧", () => {
    const html = renderToStaticMarkup(
      <PetSprite
        direction="up"
        moving={false}
        pack={pack}
        state="dragging"
      />
    );

    expect(html).toContain("is-paused");
    expect(html).toContain("--pet-row-offset:-288px");
  });
});

function clip(row: number, loop = true) {
  return { row, frames: 6 as const, durationMs: 600, loop };
}
