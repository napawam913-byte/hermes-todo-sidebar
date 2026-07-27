/**
 * 模块用途：验证快速新增按钮能够通过表单提交触发待办创建。
 * 模块边界：只检查可访问的静态表单语义，不执行数据写入或 Electron IPC。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QuickAddBar } from "./QuickAddBar";

describe("QuickAddBar", () => {
  it("uses a submit button so mouse clicks trigger the form", () => {
    const html = renderToStaticMarkup(
      <QuickAddBar busy={false} onAdd={async () => true} />
    );

    expect(html).toContain('type="submit"');
  });
});
