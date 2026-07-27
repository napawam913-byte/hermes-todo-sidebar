/**
 * 模块用途：管理模型配置表单、非敏感草稿标记与连接测试状态。
 * 模块边界：只做纯状态转换，不访问 React、IPC、磁盘或 safeStorage。
 */
import type {
  AiConfigDraftV1,
  AiConfigInput,
  AiConnectionResult,
  AiPublicConfig
} from "../../../shared/aiBridgeContract";

export type AiConfigField = keyof AiConfigInput;

export interface AiConfigDraftState {
  initialized: boolean;
  fields: AiConfigInput;
  dirtyFields: AiConfigField[];
  nonSecretDirty: boolean;
  restoredFromDisk: boolean;
  connection: {
    status: "idle" | "testing" | "success" | "failure";
    message: string;
  };
}

export type AiConfigDraftAction =
  | { type: "draft.hydrated"; config: AiPublicConfig; draft: AiConfigDraftV1 | null }
  | { type: "field.changed"; field: AiConfigField; value: string }
  | { type: "connection.started" }
  | { type: "connection.finished"; result: AiConnectionResult }
  | { type: "save.succeeded"; config: AiPublicConfig };

export function createAiConfigDraftState(): AiConfigDraftState {
  return {
    initialized: false,
    fields: { baseUrl: "", model: "", apiKey: "" },
    dirtyFields: [],
    nonSecretDirty: false,
    restoredFromDisk: false,
    connection: { status: "idle", message: "" }
  };
}

export function reduceAiConfigDraftState(
  state: AiConfigDraftState,
  action: AiConfigDraftAction
): AiConfigDraftState {
  if (action.type === "draft.hydrated") {
    return {
      initialized: true,
      fields: {
        baseUrl: state.dirtyFields.includes("baseUrl")
          ? state.fields.baseUrl
          : action.draft?.baseUrl ?? action.config.baseUrl,
        model: state.dirtyFields.includes("model")
          ? state.fields.model
          : action.draft?.model ?? action.config.model,
        apiKey: state.fields.apiKey
      },
      dirtyFields: state.dirtyFields,
      nonSecretDirty: state.nonSecretDirty,
      restoredFromDisk: Boolean(action.draft),
      connection: { status: "idle", message: "" }
    };
  }
  if (action.type === "field.changed") {
    return {
      ...state,
      fields: { ...state.fields, [action.field]: action.value },
      dirtyFields: state.dirtyFields.includes(action.field)
        ? state.dirtyFields
        : [...state.dirtyFields, action.field],
      nonSecretDirty: state.nonSecretDirty || action.field !== "apiKey",
      connection: { status: "idle", message: "" }
    };
  }
  if (action.type === "connection.started") {
    return { ...state, connection: { status: "testing", message: "正在测试连接..." } };
  }
  if (action.type === "connection.finished") {
    return {
      ...state,
      connection: {
        status: action.result.ok ? "success" : "failure",
        message: action.result.message
      }
    };
  }
  return {
    ...state,
    fields: {
      baseUrl: action.config.baseUrl,
      model: action.config.model,
      apiKey: ""
    },
    dirtyFields: [],
    nonSecretDirty: false,
    restoredFromDisk: false,
    connection: { status: "idle", message: "" }
  };
}

export function toConfigDraft(
  state: AiConfigDraftState,
  updatedAt: string
): AiConfigDraftV1 {
  return {
    schemaVersion: 1,
    baseUrl: state.fields.baseUrl,
    model: state.fields.model,
    updatedAt
  };
}
