/**
 * 模块用途：验证今日、周期和 AI 工作面保持挂载，以保留各自会话草稿。
 * 模块边界：使用静态 HTML，不执行 Electron IPC、模型请求或数据写入。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockCyclePlans } from "../cyclePlans/mockCyclePlans";
import type { CharacterPack } from "../sidebar/characterPack";
import { mockTodos } from "./mockTodos";
import { TodoPanel } from "./TodoPanel";

describe("TodoPanel session surfaces", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps all work surfaces mounted while one surface is active", () => {
    vi.stubGlobal("window", {});
    const html = renderToStaticMarkup(
      <TodoPanel
        characterId="penguin-todo"
        characters={[penguinPack]}
        cyclePlans={mockCyclePlans}
        collapseVersion={0}
        mutationBusy={false}
        mutationError={null}
        panelOpacity={86}
        todayKey="2026-07-17"
        todos={mockTodos}
        onAiStateApplied={() => undefined}
        onCharacterChange={() => undefined}
        onDismissMutationError={() => undefined}
        onManualMutate={async () => true}
        onPanelOpacityChange={() => undefined}
      />
    );

    expect(html).toContain("添加一个待办");
    expect(html).toContain("AI 生成周期任务");
    expect(html).toContain("模型连接设置");
  });
});

const clip = (row: number) => ({ row, frames: 6 as const, durationMs: 600, loop: true });
const penguinPack: CharacterPack = {
  atlasUrl: "/atlas.webp",
  thumbnailUrl: "/penguin.webp",
  manifest: {
    schemaVersion: 2,
    id: "penguin-todo",
    displayName: "企鹅待办助手",
    version: "1.0.0",
    atlas: {
      columns: 6, rows: 7, cellWidth: 192, cellHeight: 208,
      renderWidth: 88, renderHeight: 96
    },
    clips: {
      idle: clip(0), awaken: clip(1),
      dragging: { down: clip(2), up: clip(3), left: clip(4), right: clip(4) },
      working: clip(5), complete: clip(6)
    }
  }
};
