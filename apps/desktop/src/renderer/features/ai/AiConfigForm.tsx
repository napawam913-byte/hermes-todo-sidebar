/**
 * 模块用途：提供可被 AI 引导页与设置控制台复用的受控模型配置表单。
 * 模块边界：只提交当前字段，不负责页面跳转、配置持久化或连接协议。
 */
import type { FormEvent } from "react";
import type { AiConfigInput, AiPublicConfig } from "../../../shared/aiBridgeContract";
import { PrimaryButton, QuietButton } from "../../components/buttons";
import type { AiConfigDraftState, AiConfigField } from "./aiConfigDraftState";

export interface AiConfigFormProps {
  busy: boolean;
  config: AiPublicConfig | null;
  connection: AiConfigDraftState["connection"];
  draft: AiConfigInput;
  heading?: string;
  submitLabel?: string;
  onFieldChange(field: AiConfigField, value: string): void;
  onSave(): Promise<void>;
  onTest(): Promise<void>;
}

export function AiConfigForm({ heading, submitLabel = "保存并继续", ...props }: AiConfigFormProps) {
  const complete = Boolean(
    props.draft.baseUrl.trim()
    && props.draft.model.trim()
    && (props.draft.apiKey.trim() || props.config?.configured)
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    void props.onSave();
  }

  return (
    <form className="ai-config-form" onSubmit={submit}>
      {heading ? <h3>{heading}</h3> : null}
      <label>
        Base URL
        <input
          disabled={props.busy}
          value={props.draft.baseUrl}
          onChange={(event) => props.onFieldChange("baseUrl", event.target.value)}
        />
      </label>
      <label>
        模型名称
        <input
          disabled={props.busy}
          value={props.draft.model}
          onChange={(event) => props.onFieldChange("model", event.target.value)}
        />
      </label>
      <label>
        API Key
        <input
          disabled={props.busy}
          placeholder={props.config?.maskedApiKey || "sk-..."}
          type="password"
          value={props.draft.apiKey}
          onChange={(event) => props.onFieldChange("apiKey", event.target.value)}
        />
      </label>
      {props.connection.message ? (
        <p className={`ai-connection-message is-${props.connection.status}`}>
          {props.connection.message}
        </p>
      ) : null}
      <div className="ai-form-actions">
        <QuietButton disabled={props.busy || !complete} onClick={() => void props.onTest()}>
          测试连接
        </QuietButton>
        <PrimaryButton disabled={props.busy || !complete} type="submit">
          {submitLabel}
        </PrimaryButton>
      </div>
    </form>
  );
}
