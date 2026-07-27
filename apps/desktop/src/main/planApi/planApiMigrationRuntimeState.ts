/** 将迁移检查结果映射为运行时写入门禁，不执行迁移或网络操作。 */
import type {
  PlanApiMigrationInspection,
  PlanApiRuntimeStatus,
} from "../../shared/planApiBridgeContract.js";

interface MigrationRuntimeContext {
  serverRevision: number;
  syncedAt: string;
}

export function migrationRuntimeStatus(
  inspection: PlanApiMigrationInspection,
  context: MigrationRuntimeContext,
): PlanApiRuntimeStatus {
  const common = {
    cacheAvailable: true,
    serverRevision: context.serverRevision,
    lastSyncedAt: context.syncedAt,
  };
  if (inspection.status === "completed"
    || inspection.status === "skipped"
    || (inspection.status === "blocked" && inspection.reason === "legacy_empty")) {
    return {
      ...common,
      mode: "online",
      canMutate: true,
      message: "数据服务已连接",
    };
  }
  if (inspection.status === "ready" || inspection.status === "pending") {
    return {
      ...common,
      mode: "migration_required",
      canMutate: false,
      message: "需要确认本地数据迁移",
    };
  }
  return {
    ...common,
    mode: "migration_blocked",
    canMutate: false,
    message: "数据迁移已阻塞，请检查本地与远端数据",
  };
}
