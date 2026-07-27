/**
 * 模块用途：把统一变更网关连接到 React 状态，并只接受已持久化快照。
 * 模块边界：不构造具体待办操作，也不直接访问 Electron 或 localStorage。
 */
import { useCallback, useReducer } from "react";
import type { AppMutationBatch } from "../../shared/appMutationTypes";
import type { AppMutationGateway, AppMutationSnapshot } from "./appMutationGateway";
import { createMutationUiState, reduceMutationUiState } from "./appMutationState";

interface UseAppMutationStoreOptions {
  gateway: AppMutationGateway;
  initialState: AppMutationSnapshot;
}

export function useAppMutationStore(options: UseAppMutationStoreOptions) {
  const [state, dispatch] = useReducer(
    reduceMutationUiState,
    options.initialState,
    createMutationUiState
  );

  const execute = useCallback(async (batch: AppMutationBatch): Promise<boolean> => {
    dispatch({ type: "mutation.started" });
    try {
      const snapshot = await options.gateway.execute(batch);
      dispatch({ type: "mutation.succeeded", snapshot });
      return true;
    } catch (error) {
      dispatch({
        type: "mutation.failed",
        message: error instanceof Error ? error.message : "保存失败，请重试"
      });
      return false;
    }
  }, [options.gateway]);

  const hydrate = useCallback((snapshot: AppMutationSnapshot) => {
    dispatch({ type: "snapshot.hydrated", snapshot });
  }, []);

  const reportError = useCallback((message: string) => {
    dispatch({ type: "mutation.failed", message });
  }, []);

  return {
    ...state,
    clearError: () => dispatch({ type: "error.cleared" }),
    execute,
    hydrate,
    reportError
  };
}
