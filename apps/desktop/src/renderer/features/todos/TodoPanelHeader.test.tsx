/**
 * 模块用途：验证全局面板标题在业务页与设置页之间切换正确。
 * 模块边界：只检查标题栏静态语义，不操作会话 reducer。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TodoPanelHeader } from "./TodoPanelHeader";

describe("TodoPanelHeader", () => {
  it("shows settings title and completion action while settings are open", () => {
    const html = renderToStaticMarkup(
      <TodoPanelHeader
        settingsOpen
        onCloseSettings={() => undefined}
        onOpenSettings={() => undefined}
      />
    );

    expect(html).toContain("<h1>设置</h1>");
    expect(html).toContain("完成");
    expect(html).not.toContain("打开设置");
  });

  it("shows the todo title and settings icon on business surfaces", () => {
    const html = renderToStaticMarkup(
      <TodoPanelHeader
        settingsOpen={false}
        onCloseSettings={() => undefined}
        onOpenSettings={() => undefined}
      />
    );

    expect(html).toContain("<h1>待办事项</h1>");
    expect(html).toContain("打开设置");
    expect(html).not.toContain(">完成<");
  });
});
