/** 模块用途：验证写入失败通知可见且重试动作可达。 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RepositoryWriteNotice, retryRepositoryWrite } from "./RepositoryWriteNotice";

describe("RepositoryWriteNotice", () => {
  it("renders the failure and exposes the retry action", () => {
    const controller = {
      getWriteState: () => ({ pending: false, error: "offline" }),
      onWriteStateChanged: () => () => undefined,
      retryPending: vi.fn(),
    };
    const html = renderToStaticMarkup(<RepositoryWriteNotice controller={controller} />);

    expect(html).toContain("未保存到 Plan API：offline");
    expect(html).toContain("重试");
    retryRepositoryWrite(controller);
    expect(controller.retryPending).toHaveBeenCalledOnce();
  });
});
