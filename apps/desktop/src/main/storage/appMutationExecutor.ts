/**
 * 模块用途：执行手动与 AI 共用的变更批次，并通过 AppStateService 原子保存。
 * 模块边界：不生成模型提案、不处理 UI，只协调校验、纯变更和持久化错误。
 */
import { randomUUID } from "node:crypto";
import type { AppMutationBatch } from "../../shared/appMutationTypes.js";
import { applyCyclePlanMutation } from "../ai/applyCyclePlanMutation.js";
import { applyTodoMutation } from "../ai/applyTodoMutation.js";
import { toAiExecutionError } from "../ai/aiExecutionError.js";
import { validateMutationTargets } from "../ai/aiTargetValidation.js";
import { readStoredPlans, readStoredTodos } from "../ai/storedDomainValidation.js";
import type { StoredAppStateV1 } from "./appStateTypes.js";
import type { AppStateService } from "./appStateService.js";

interface ExecutorOptions {
  now?: () => Date;
  idFactory?: (prefix: string) => string;
}

export class AppMutationExecutor {
  private readonly now: () => Date;
  private readonly idFactory: (prefix: string) => string;

  constructor(
    private readonly stateService: AppStateService,
    options: ExecutorOptions = {}
  ) {
    this.now = options.now ?? (() => new Date());
    this.idFactory = options.idFactory ?? ((prefix) => `${prefix}_${randomUUID()}`);
  }

  async execute(batch: AppMutationBatch): Promise<StoredAppStateV1> {
    try {
      return await this.stateService.transact((state) => {
        try {
          return this.apply(state, batch);
        } catch (error) {
          throw toAiExecutionError(error, "validation_failed");
        }
      });
    } catch (error) {
      throw toAiExecutionError(error, "persistence_failed");
    }
  }

  private apply(state: StoredAppStateV1, batch: AppMutationBatch): StoredAppStateV1 {
    let todos = readStoredTodos(state.todos);
    let cyclePlans = readStoredPlans(state.cyclePlans);
    validateMutationTargets(todos, cyclePlans, batch.operations);
    const context = {
      now: this.now().toISOString(),
      source: batch.source,
      idFactory: this.idFactory
    };
    for (const operation of batch.operations) {
      todos = applyTodoMutation(todos, operation, context);
      cyclePlans = applyCyclePlanMutation(cyclePlans, operation, context);
    }
    return { ...state, todos, cyclePlans };
  }
}
