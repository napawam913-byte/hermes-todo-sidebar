/**
 * 模块用途：定义主进程持久化文件的版本化顶层结构与基础校验。
 * 模块边界：只校验应用状态外壳，待办与周期计划的领域字段由 renderer 负责归一化。
 */
export const APP_STATE_SCHEMA_VERSION = 1 as const;

export interface AppSettings {
  launchAtLogin: boolean;
}

export interface StoredAppStateV1 {
  schemaVersion: typeof APP_STATE_SCHEMA_VERSION;
  todos: unknown[];
  cyclePlans: unknown[];
  settings: AppSettings;
  updatedAt: string;
}

export function createEmptyAppState(now = new Date()): StoredAppStateV1 {
  return {
    schemaVersion: APP_STATE_SCHEMA_VERSION,
    todos: [],
    cyclePlans: [],
    settings: { launchAtLogin: true },
    updatedAt: now.toISOString()
  };
}

export function isStoredAppState(value: unknown): value is StoredAppStateV1 {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<StoredAppStateV1>;
  return (
    candidate.schemaVersion === APP_STATE_SCHEMA_VERSION &&
    Array.isArray(candidate.todos) &&
    Array.isArray(candidate.cyclePlans) &&
    typeof candidate.updatedAt === "string" &&
    !!candidate.settings &&
    typeof candidate.settings.launchAtLogin === "boolean"
  );
}
