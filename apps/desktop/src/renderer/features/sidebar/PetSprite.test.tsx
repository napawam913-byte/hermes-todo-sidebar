/**
 * 模块用途：验证通用角色图集按 V3 状态、方向和统一行为模板播放正确动作。
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
    schemaVersion: 3,
    id: "test-character",
    displayName: "测试角色",
    version: "1.0.0",
    atlas: {
      columns: 6,
      rows: 14,
      cellWidth: 192,
      cellHeight: 208,
      renderWidth: 88,
      renderHeight: 96
    },
    clips: {
      idle: { base: row(0), blink: row(1) },
      awaken: row(2),
      dragging: {
        down: row(3),
        up: row(4),
        right: row(5),
        left: row(6)
      },
      thinking: row(7),
      working: row(8),
      waiting: row(9),
      reminding: row(10),
      complete: row(11),
      error: row(12),
      sleeping: row(13)
    }
  }
};

describe("PetSprite", () => {
  it("按 V3 独立左向行播放拖动动作", () => {
    const html = renderToStaticMarkup(
      <PetSprite
        direction="left"
        moving
        pack={pack}
        state="dragging"
      />
    );

    expect(html).not.toContain("is-mirrored");
    expect(html).toContain("--pet-row-offset:-576px");
    expect(html).toContain("--pet-duration:600ms");
    expect(html).not.toContain("is-resting");
  });

  it("拖动停止后回到当前方向首帧站姿", () => {
    const html = renderToStaticMarkup(
      <PetSprite
        direction="up"
        moving={false}
        pack={pack}
        state="dragging"
      />
    );

    expect(html).toContain("is-resting");
    expect(html).toContain("--pet-row-offset:-384px");
  });

  it("闲置眨眼使用独立动作行", () => {
    const html = renderToStaticMarkup(
      <PetSprite blinking direction="down" moving={false} pack={pack} state="idle" />
    );

    expect(html).toContain("--pet-row-offset:-96px");
    expect(html).toContain("--pet-duration:360ms");
  });

  it("思考状态使用统一模板时长", () => {
    const html = renderToStaticMarkup(
      <PetSprite direction="down" moving={false} pack={pack} state="thinking" />
    );

    expect(html).toContain("--pet-row-offset:-672px");
    expect(html).toContain("--pet-duration:2800ms");
  });
});

function row(value: number) { return { row: value }; }
