/**
 * 模块用途：在设置控制台中展示模型连接状态与可复用配置表单。
 * 模块边界：不进入 AI 对话，不决定保存后的页面跳转，也不读取明文密钥。
 */
import { ShieldCheck } from "lucide-react";
import { AiConfigForm, type AiConfigFormProps } from "../ai/AiConfigForm";
import type { SettingsModelStatus } from "./settingsModelStatus";

interface ModelConnectionSettingsProps extends AiConfigFormProps {
  error: string | null;
  status: SettingsModelStatus;
}

export function ModelConnectionSettings({ error, status, ...formProps }: ModelConnectionSettingsProps) {
  return (
    <section className="settings-section model-connection-settings">
      <header className="settings-section-header model-settings-header">
        <div>
          <h2>模型连接</h2>
          <p>配置桌宠使用的模型接口。</p>
        </div>
        <span className={`settings-status-pill is-${status.tone}`}>
          <i aria-hidden="true" />
          {status.label}
        </span>
      </header>
      <div className="settings-section-divider" />
      {error ? <div className="settings-inline-error" role="alert">{error}</div> : null}
      <AiConfigForm {...formProps} submitLabel="保存配置" />
      <p className="settings-security-note">
        <ShieldCheck aria-hidden="true" size={16} strokeWidth={1.8} />
        API Key 仅加密保存在本机，不会进入对话上下文或导出文件。
      </p>
    </section>
  );
}
