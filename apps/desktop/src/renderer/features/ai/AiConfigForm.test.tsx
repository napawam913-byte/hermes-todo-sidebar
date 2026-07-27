/**
 * 模块用途：验证模型配置表单可在 AI 引导和设置控制台中复用不同提交文案。
 * 模块边界：只检查受控表单结构，不连接真实模型接口。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AiConfigForm } from "./AiConfigForm";

describe("AiConfigForm", () => {
  it("uses the settings save label without rendering onboarding copy", () => {
    const html = renderToStaticMarkup(
      <AiConfigForm
        busy={false}
        config={{ configured: true, baseUrl: "https://api.example.com/v1", model: "grok-4.5", maskedApiKey: "sk-***" }}
        connection={{ status: "idle", message: "" }}
        draft={{ baseUrl: "https://api.example.com/v1", model: "grok-4.5", apiKey: "" }}
        submitLabel="保存配置"
        onFieldChange={() => undefined}
        onSave={async () => undefined}
        onTest={async () => undefined}
      />
    );

    expect(html).toContain("保存配置");
    expect(html).not.toContain("保存并继续");
    expect(html).not.toContain("AI 周期任务");
    expect(html).toContain('type="submit"');
  });
});
