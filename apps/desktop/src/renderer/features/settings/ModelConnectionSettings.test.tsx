/**
 * 模块用途：验证模型连接设置作为独立设置分区呈现，不泄漏 AI Flow 引导结构。
 * 模块边界：只检查静态表单与状态文案，不调用 preload。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ModelConnectionSettings } from "./ModelConnectionSettings";

describe("ModelConnectionSettings", () => {
  it("renders the reusable config form with settings-specific copy", () => {
    const html = renderToStaticMarkup(
      <ModelConnectionSettings
        busy={false}
        config={{ configured: true, baseUrl: "https://api.example.com/v1", model: "grok-4.5", maskedApiKey: "sk-***" }}
        connection={{ status: "success", message: "Hermes 在线" }}
        draft={{ baseUrl: "https://api.example.com/v1", model: "grok-4.5", apiKey: "" }}
        error={null}
        status={{ label: "连接正常", tone: "success" }}
        onFieldChange={() => undefined}
        onSave={async () => undefined}
        onTest={async () => undefined}
      />
    );

    expect(html).toContain("<h2>模型连接</h2>");
    expect(html).toContain("配置桌宠使用的模型接口");
    expect(html).toContain("连接正常");
    expect(html).toContain("保存配置");
    expect(html).toContain("API Key 仅加密保存在本机");
    expect(html).not.toContain("保存并继续");
    expect(html).not.toContain("AI 周期任务");
  });
});
