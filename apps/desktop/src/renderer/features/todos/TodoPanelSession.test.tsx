/**
 * 模块用途：验证今日、周期和 AI 工作面保持挂载，以保留各自会话草稿。
 * 模块边界：使用静态 HTML，不执行 Electron IPC、模型请求或数据写入。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockCyclePlans } from "../cyclePlans/mockCyclePlans";
import { createTestCharacterPack } from "../sidebar/testCharacterPack";
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
    expect(html).toContain('class="settings-shell"');
    expect(html).toContain("模型连接");
    expect(html).toContain("保存配置");
    expect(html).not.toContain("桌宠设置");
    expect(html).not.toContain("第一版桌宠");
    expect(html).not.toContain('class="todo-summary"');
    expect(html).not.toContain('aria-label="今日待办摘要"');
    expect(html).toContain('aria-label="今日待办筛选"');
  });
});

const penguinPack = createTestCharacterPack();
