/**
 * 模块用途：把正式模型配置与本次连接测试结果映射为设置导航状态。
 * 模块边界：不读取密钥、不发起网络请求，也不持久化状态。
 */
import type { AiConfigDraftState } from "../ai/aiConfigDraftState";

export type SettingsModelTone = "unconfigured" | "configured" | "success" | "failure";

export interface SettingsModelStatus {
  label: string;
  tone: SettingsModelTone;
}

export function getSettingsModelStatus(
  configured: boolean,
  connection: AiConfigDraftState["connection"]
): SettingsModelStatus {
  if (connection.status === "success") return { label: "连接正常", tone: "success" };
  if (connection.status === "failure") return { label: "连接失败", tone: "failure" };
  if (connection.status === "testing") return { label: "正在测试", tone: "configured" };
  if (configured) return { label: "已保存", tone: "configured" };
  return { label: "未配置", tone: "unconfigured" };
}
