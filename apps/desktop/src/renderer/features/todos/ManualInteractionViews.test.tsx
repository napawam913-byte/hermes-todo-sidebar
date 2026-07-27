/**
 * 模块用途：验证普通待办编辑表单与更多操作菜单暴露完整 CRUD 动作。
 * 模块边界：只渲染静态 HTML，不执行网关写入。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { mockTodos } from "./mockTodos";
import { TodoActionMenu } from "./TodoActionMenu";
import { TodoEditorDrawer } from "./TodoEditorDrawer";
import { toManualTodayItemForTest } from "./todayItems.testHelpers";

const noop = () => undefined;
const asyncNoop = async () => true;

describe("普通待办交互视图", () => {
  it("renders title, date, notes, save and permanent delete controls", () => {
    const html = renderToStaticMarkup(
      <TodoEditorDrawer
        busy={false}
        todo={mockTodos[0]}
        onClose={noop}
        onDelete={asyncNoop}
        onSave={asyncNoop}
      />
    );
    expect(html).toContain("编辑待办");
    expect(html).toContain('type="date"');
    expect(html).toContain("备注");
    expect(html).toContain("保存修改");
    expect(html).toContain("永久删除");
  });

  it("shows reopen, edit and delete for a completed manual item", () => {
    const item = toManualTodayItemForTest({ ...mockTodos[0], status: "completed" });
    const html = renderToStaticMarkup(
      <TodoActionMenu
        busy={false}
        item={item}
        onClose={noop}
        onComplete={asyncNoop}
        onDelete={asyncNoop}
        onEdit={noop}
        onReopen={asyncNoop}
        onSkip={asyncNoop}
      />
    );
    expect(html).toContain("恢复待办");
    expect(html).toContain("编辑待办");
    expect(html).toContain("永久删除");
  });
});
