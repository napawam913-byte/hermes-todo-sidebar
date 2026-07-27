/**
 * 模块用途：统一编排配置、模型提案、内存待确认队列和原子执行。
 * 模块边界：renderer 只能按 proposalId 确认，不能提交或篡改操作正文。
 */
import type {
  AiConfigInput,
  AiConfigDraftV1,
  AiConnectionResult,
  AiPublicConfig
} from "../../shared/aiBridgeContract.js";
import type {
  AiExecuteResult,
  AiGenerateRequest,
  AiGenerateResult,
  AiMutationProposal
} from "../../shared/aiMutationTypes.js";
import type { StoredAppStateV1 } from "../storage/appStateTypes.js";
import type { AiModelCredentials } from "./aiConfigTypes.js";
import { toAiExecutionError } from "./aiExecutionError.js";
import type { HermesCapabilitySnapshot } from "./hermesCapabilityProbe.js";

interface ConfigPort {
  getPublicConfig(): Promise<AiPublicConfig>;
  save(input: AiConfigInput): Promise<AiPublicConfig>;
  getCredentials(): Promise<AiModelCredentials | null>;
  resolveCredentials(input: AiConfigInput): Promise<AiModelCredentials>;
}

interface ConfigDraftPort {
  load(): Promise<AiConfigDraftV1 | null>;
  save(draft: AiConfigDraftV1): Promise<void>;
  clear(): Promise<void>;
}

interface ProposalPort {
  generate(request: AiGenerateRequest): Promise<AiGenerateResult>;
}

interface ExecutorPort {
  execute(proposal: AiMutationProposal): Promise<StoredAppStateV1>;
}

interface ConnectionPort {
  testConnection(credentials: AiModelCredentials): Promise<void>;
}

interface CapabilityProbePort {
  inspect(credentials: AiModelCredentials): Promise<HermesCapabilitySnapshot>;
}

interface AiCoordinatorOptions {
  configStore: ConfigPort;
  proposalService: ProposalPort;
  executor: ExecutorPort;
  connectionClient: ConnectionPort;
  configDraftStore: ConfigDraftPort;
  capabilityProbe?: CapabilityProbePort;
}

export class AiCoordinator {
  private readonly pending = new Map<string, AiMutationProposal>();

  constructor(private readonly options: AiCoordinatorOptions) {}

  getConfig(): Promise<AiPublicConfig> {
    return this.options.configStore.getPublicConfig();
  }

  saveConfig(input: AiConfigInput): Promise<AiPublicConfig> {
    return this.saveConfigAndClearDraft(input);
  }

  getConfigDraft(): Promise<AiConfigDraftV1 | null> {
    return this.options.configDraftStore.load();
  }

  saveConfigDraft(draft: AiConfigDraftV1): Promise<void> {
    return this.options.configDraftStore.save(draft);
  }

  clearConfigDraft(): Promise<void> {
    return this.options.configDraftStore.clear();
  }

  async testConnection(input: AiConfigInput): Promise<AiConnectionResult> {
    try {
      const credentials = await this.options.configStore.resolveCredentials(input);
      await this.options.connectionClient.testConnection(credentials);
      const capability = this.options.capabilityProbe
        ? await this.options.capabilityProbe.inspect(credentials)
        : { provider: "openai-compatible" as const, cyclePlanExtension: "unknown" as const };
      return { ok: true, message: connectionMessage(capability), ...capability };
    } catch (error) {
      return { ok: false, message: safeErrorMessage(error) };
    }
  }

  private async saveConfigAndClearDraft(input: AiConfigInput): Promise<AiPublicConfig> {
    const config = await this.options.configStore.save(input);
    await this.options.configDraftStore.clear();
    return config;
  }

  async generate(request: AiGenerateRequest): Promise<AiGenerateResult> {
    const result = await this.options.proposalService.generate(request);
    if (result.status === "proposal") {
      this.pending.set(result.proposal.proposalId, structuredClone(result.proposal));
      if (
        request.supersedesProposalId
        && request.supersedesProposalId !== result.proposal.proposalId
      ) {
        this.pending.delete(request.supersedesProposalId);
      }
    }
    return result;
  }

  discard(proposalId: string): boolean {
    return this.pending.delete(proposalId);
  }

  async execute(proposalId: string): Promise<AiExecuteResult> {
    const proposal = this.pending.get(proposalId);
    if (!proposal) return {
      status: "failed",
      code: "validation_failed",
      message: "提案不存在、已执行或已过期"
    };
    this.pending.delete(proposalId);
    try {
      const state = await this.options.executor.execute(proposal);
      return {
        status: "success",
        summary: proposal.summary,
        operationCount: proposal.operations.length,
        state: { todos: state.todos, cyclePlans: state.cyclePlans }
      };
    } catch (error) {
      const failure = toAiExecutionError(error, "validation_failed");
      return {
        status: "failed",
        code: failure.code,
        message: failure.message,
        ...(failure.targetId ? { targetId: failure.targetId } : {})
      };
    }
  }
}

function connectionMessage(capability: HermesCapabilitySnapshot): string {
  if (capability.provider === "openai-compatible") {
    return "兼容模型接口连接正常，周期计划扩展未验证";
  }
  if (capability.cyclePlanExtension === "unknown") {
    return "Hermes 在线，当前版本无法自动验证周期计划扩展";
  }
  return capability.cyclePlanExtension === "ready"
    ? "Hermes 在线，周期计划扩展已就绪"
    : "Hermes 在线，但周期计划扩展未安装";
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "模型操作失败，请重试";
}
