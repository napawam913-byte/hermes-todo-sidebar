/**
 * 模块用途：编辑模型连接信息并显示第三方数据传输提示。
 * 模块边界：API Key 仅提交给 preload，不写入 React 的公开配置快照。
 */
import type { AiConfigFormProps } from "./AiConfigForm";
import { AiConfigForm } from "./AiConfigForm";

type AiConfigPanelProps = Omit<AiConfigFormProps, "heading" | "submitLabel">;

export function AiConfigPanel(props: AiConfigPanelProps) {
  return (
    <div className="ai-config-layout">
      <section className="ai-config-intro">
        <p>AI 周期任务</p>
        <h3>先连接你的模型接口</h3>
        <span>配置完成后，可以用自然语言生成或调整周期任务内容。</span>
        <div className="ai-privacy-note">
          <strong>数据发送说明</strong>
          <span>生成提案时会发送当前全部待办和周期计划；API Key 不会进入上下文。</span>
        </div>
      </section>
      <AiConfigForm {...props} heading="模型连接设置" submitLabel="保存并继续" />
    </div>
  );
}
