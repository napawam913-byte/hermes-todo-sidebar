/**
 * 模块用途：验证 AI 配置和自然语言输入的主按钮会提交所属表单。
 * 模块边界：只检查 HTML 表单语义，不连接 IPC 或模型网络。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AiComposer } from "./AiComposer";
import { AiConfigPanel } from "./AiConfigPanel";

describe("AI 表单按钮", () => {
  it("配置保存按钮使用 submit 类型", () => {
    const html = renderToStaticMarkup(
      <AiConfigPanel
        busy={false}
        config={{ configured: false, baseUrl: "", model: "", maskedApiKey: "" }}
        connection={{ status: "idle", message: "" }}
        draft={{
          baseUrl: "https://api.example.com/v1",
          model: "model-current",
          apiKey: "sk-session-only"
        }}
        onFieldChange={() => undefined}
        onSave={async () => undefined}
        onTest={async () => undefined}
      />
    );
    expect(html).toContain('type="submit"');
    expect(html).toContain('value="https://api.example.com/v1"');
    expect(html).toContain('value="model-current"');
    expect(html).toContain('value="sk-session-only"');
    expect(html).toMatch(/<button[^>]*type="button"[^>]*><span>测试连接<\/span><\/button>/);
    expect(html).toContain("用自然语言生成或调整周期任务内容");
    expect(html).not.toContain("永久删除待办");
  });

  it("提案生成按钮使用 submit 类型", () => {
    const html = renderToStaticMarkup(
      <AiComposer
        busy={false}
        placeholder="描述你的目标"
        value=""
        onChange={() => undefined}
        onSend={() => undefined}
      />
    );
    expect(html).toContain('type="submit"');
  });

  it("保存或测试期间锁定配置输入", () => {
    const html = renderToStaticMarkup(
      <AiConfigPanel
        busy
        config={{ configured: false, baseUrl: "", model: "", maskedApiKey: "" }}
        connection={{ status: "testing", message: "正在测试连接..." }}
        draft={{ baseUrl: "https://api.example.com/v1", model: "model", apiKey: "sk-key" }}
        onFieldChange={() => undefined}
        onSave={async () => undefined}
        onTest={async () => undefined}
      />
    );
    expect(html.match(/<input[^>]*disabled=""/g)).toHaveLength(3);
  });
});
