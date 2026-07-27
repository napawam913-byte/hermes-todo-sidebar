/**
 * 模块用途：把数据服务的公开运行状态与迁移检查映射为设置界面文案。
 * 模块边界：不读取 Token，不保存配置，也不发起网络请求。
 */
import type {
  PlanApiConnectionTestResult,
  PlanApiMigrationBlockReason,
  PlanApiMigrationInspection,
  PlanApiRuntimeStatus
} from "../../../shared/planApiBridgeContract";

export type DataServiceTone = "unconfigured" | "configured" | "success" | "failure";

export interface DataServiceStatus {
  label: string;
  tone: DataServiceTone;
}

export function getDataServiceStatus(input: {
  status: PlanApiRuntimeStatus;
  configured: boolean;
  testResult: PlanApiConnectionTestResult | null;
}): DataServiceStatus {
  if (input.testResult?.ok || input.status.mode === "online") {
    return { label: "连接正常", tone: "success" };
  }
  if (input.status.mode === "migration_blocked") {
    return { label: "迁移受阻", tone: "failure" };
  }
  if (input.status.mode === "offline_cache") {
    return { label: "离线", tone: "unconfigured" };
  }
  if (input.testResult && !input.testResult.ok) {
    return { label: "连接失败", tone: "failure" };
  }
  if (input.status.mode === "connecting") return { label: "正在连接", tone: "configured" };
  if (input.configured) return { label: "已保存", tone: "configured" };
  return { label: "未配置", tone: "unconfigured" };
}

export interface MigrationPresentation {
  title: string;
  detail: string;
  tone: "neutral" | "failure" | "success";
  busy: boolean;
  action?: "确认迁移";
  canKeepRemote: boolean;
}

export function getMigrationPresentation(
  migration: PlanApiMigrationInspection
): MigrationPresentation {
  if (migration.status === "ready") {
    return {
      title: "发现本地数据",
      detail: `本地有 ${migration.taskCount} 个任务和 ${migration.entryCount} 个条目。`,
      tone: "neutral",
      busy: false,
      action: "确认迁移",
      canKeepRemote: false
    };
  }
  if (migration.status === "pending") {
    return {
      title: "正在恢复迁移",
      detail: "请等待当前迁移完成后再继续操作。",
      tone: "neutral",
      busy: true,
      canKeepRemote: false
    };
  }
  if (migration.status === "blocked") {
    const blocked = migration.reason === "remote_not_empty";
    return {
      title: blocked ? "迁移需要确认" : "迁移暂不可执行",
      detail: migrationBlockMessage(migration.reason),
      tone: "failure",
      busy: false,
      canKeepRemote: blocked
    };
  }
  return {
    title: migration.status === "completed" ? "迁移已完成" : "已保留云端数据",
    detail: `已导入 ${migration.record.importedTaskCount} 个任务和 ${migration.record.importedEntryCount} 个条目，已保留备份`,
    tone: "success",
    busy: false,
    canKeepRemote: false
  };
}

function migrationBlockMessage(reason: PlanApiMigrationBlockReason) {
  const messages = {
    remote_not_empty: "云端已有数据。确认迁移前请先清空云端，或选择保留云端数据。",
    remote_empty: "远端状态正在刷新，请稍后重试。",
    legacy_empty: "没有可迁移的本地数据。",
    legacy_invalid: "本地数据无法校验，请先修复后再试。",
    legacy_changed: "本地数据已变化，请重新检查迁移。",
    local_limit_exceeded: "本地数据超过迁移限制，请先整理后再试。"
  };
  return messages[reason as keyof typeof messages];
}
