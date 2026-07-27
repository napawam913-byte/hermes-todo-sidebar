/**
 * 模块用途：连接模型配置草稿状态、非敏感持久化和安全 AI bridge。
 * 模块边界：不管理 AI 对话、提案或页面路由，不把 API Key 写入草稿。
 */
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { AiPublicConfig } from "../../../shared/aiBridgeContract";
import type { AiDesktopBridge } from "./aiBridge";
import {
  createAiConfigDraftState,
  reduceAiConfigDraftState,
  toConfigDraft,
  type AiConfigField
} from "./aiConfigDraftState";
import { AiConfigAsyncCoordinator } from "./aiConfigAsyncCoordinator";

export function useAiConfigController(bridge: AiDesktopBridge) {
  const [draft, dispatch] = useReducer(
    reduceAiConfigDraftState,
    undefined,
    createAiConfigDraftState
  );
  const [config, setConfig] = useState<AiPublicConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumeConfigRequested, setResumeConfigRequested] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const asyncCoordinator = useRef(new AiConfigAsyncCoordinator());
  const activeTestRef = useRef<number | null>(null);
  const latestDraftRef = useRef(draft);
  latestDraftRef.current = draft;

  useEffect(() => {
    let active = true;
    void Promise.all([bridge.getConfig(), bridge.getConfigDraft()])
      .then(([nextConfig, storedDraft]) => {
        if (!active) return;
        setConfig(nextConfig);
        dispatch({ type: "draft.hydrated", config: nextConfig, draft: storedDraft });
        setResumeConfigRequested(!nextConfig.configured && Boolean(storedDraft));
      })
      .catch((reason) => active && setError(readError(reason)));
    return () => { active = false; };
  }, [bridge]);

  useEffect(() => {
    if (!draft.initialized || !draft.nonSecretDirty || busy) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = undefined;
      const snapshot = toConfigDraft(latestDraftRef.current, new Date().toISOString());
      void asyncCoordinator.current
        .enqueueDraft(() => bridge.saveConfigDraft(snapshot))
        .catch((reason) => setError(readError(reason)));
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = undefined;
    };
  }, [bridge, busy, draft.fields.baseUrl, draft.fields.model, draft.initialized,
    draft.nonSecretDirty]);

  const changeField = useCallback((field: AiConfigField, value: string) => {
    asyncCoordinator.current.markFieldChanged();
    setError(null);
    dispatch({ type: "field.changed", field, value });
  }, []);

  const save = useCallback(async () => {
    const revision = asyncCoordinator.current.getFormRevision();
    const input = { ...latestDraftRef.current.fields };
    cancelScheduledSave(timerRef);
    setBusy(true); setError(null);
    try {
      await asyncCoordinator.current.waitForDrafts();
      const next = await bridge.saveConfig(input);
      setConfig(next);
      if (!asyncCoordinator.current.isCurrentForm(revision)) {
        setError("配置在保存期间发生变化，请确认后再次保存");
        return false;
      }
      setResumeConfigRequested(false);
      dispatch({ type: "save.succeeded", config: next });
      return true;
    } catch (reason) {
      setError(readError(reason));
      return false;
    } finally {
      setBusy(false);
    }
  }, [bridge]);

  const test = useCallback(async () => {
    const epoch = asyncCoordinator.current.beginConnection();
    activeTestRef.current = epoch;
    setBusy(true); setError(null);
    dispatch({ type: "connection.started" });
    try {
      const result = await bridge.testConnection(latestDraftRef.current.fields);
      if (!asyncCoordinator.current.isCurrentConnection(epoch)) return;
      dispatch({ type: "connection.finished", result });
    } catch (reason) {
      if (!asyncCoordinator.current.isCurrentConnection(epoch)) return;
      const message = readError(reason);
      setError(message);
      dispatch({ type: "connection.finished", result: { ok: false, message } });
    } finally {
      if (activeTestRef.current === epoch) {
        activeTestRef.current = null;
        setBusy(false);
      }
    }
  }, [bridge]);

  return {
    busy,
    changeField,
    config,
    consumeResumeConfig: () => setResumeConfigRequested(false),
    draft,
    error,
    resumeConfigRequested,
    save,
    test
  };
}

function cancelScheduledSave(timerRef: {
  current: ReturnType<typeof setTimeout> | undefined;
}) {
  if (timerRef.current) clearTimeout(timerRef.current);
  timerRef.current = undefined;
}

function readError(value: unknown): string {
  return value instanceof Error ? value.message : "模型配置操作失败，请重试";
}
