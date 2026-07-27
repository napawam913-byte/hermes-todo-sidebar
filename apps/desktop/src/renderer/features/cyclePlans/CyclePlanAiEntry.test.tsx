/**
 * 模块用途：验证周期任务页向用户提供可点击的 AI 安排入口。
 * 模块边界：只检查静态可用状态，不连接真实模型或 Electron IPC。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CyclePlanView } from "./CyclePlanView";

describe("CyclePlanView AI 入口", () => {
  it("只提供 API 生成入口，不显示手动添加", () => {
    const html = renderToStaticMarkup(
      <CyclePlanView
        busy={false}
        interactionResetVersion={0}
        plans={[]}
        todayKey="2026-07-14"
        onAiOpen={() => undefined}
        onMutate={async () => true}
      />
    );

    expect(html).toContain("AI 生成周期任务");
    expect(html).not.toContain("周期任务</p>");
    expect(html).not.toContain("按日期生成今日待办");
    expect(html).not.toContain("暂无周期任务");
    expect(html).not.toContain("使用 AI 生成第一个周期任务");
    expect(html).not.toContain("手动添加");
    expect(html).not.toContain("disabled");
  });
});
