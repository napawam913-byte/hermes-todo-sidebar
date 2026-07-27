/**
 * 模块用途：调用模型生成提案，并在主进程完成解析、补全与追问分类。
 * 模块边界：不执行提案、不持久化聊天，也不向 renderer 暴露模型凭据。
 */
import { randomUUID } from "node:crypto";
import type {
  AiGenerateRequest,
  AiGenerateResult
} from "../../shared/aiMutationTypes.js";
import type { AiSnapshotPort } from "./aiDataPorts.js";
import type { AiModelCredentials } from "./aiConfigTypes.js";
import { assertProposalMatchesGenerationContext } from "./aiGenerationPolicy.js";
import { buildAiMessages } from "./aiPrompt.js";
import { classifyAiAssistantResponse } from "./aiResponseClassifier.js";
import { enrichAiProposal } from "./enrichAiProposal.js";
import type { AiRequestMetadata, ModelMessage } from "./openAiCompatibleClient.js";

interface CredentialProvider {
  getCredentials(): Promise<AiModelCredentials | null>;
}

interface ModelClient {
  requestAssistant(
    credentials: AiModelCredentials,
    messages: ModelMessage[],
    metadata: AiRequestMetadata
  ): Promise<string>;
}

interface AiProposalServiceOptions {
  snapshotPort: AiSnapshotPort;
  credentials: CredentialProvider;
  modelClient: ModelClient;
  idFactory?: () => string;
}

export class AiProposalService {
  private readonly idFactory: () => string;

  constructor(private readonly options: AiProposalServiceOptions) {
    this.idFactory = options.idFactory ?? (() => `proposal_${randomUUID()}`);
  }

  async generate(request: AiGenerateRequest): Promise<AiGenerateResult> {
    const message = request.message.trim();
    if (!message) throw new Error("请输入需要 AI 安排的内容");
    const credentials = await this.options.credentials.getCredentials();
    if (!credentials) throw new Error("请先配置模型接口");
    const state = await this.options.snapshotPort.getSnapshot();
    const content = await this.options.modelClient.requestAssistant(
      credentials,
      buildAiMessages(state, { ...request, message }, new Date(), credentials.model),
      { sessionId: request.sessionId, requestId: request.requestId }
    );
    const classified = classifyAiAssistantResponse(content);
    if (classified.status === "message") return classified;
    const modelProposal = classified.proposal;
    if (modelProposal.operations.length === 0) {
      return { status: "message", message: modelProposal.summary };
    }
    assertProposalMatchesGenerationContext(modelProposal, state, request.context);
    return {
      status: "proposal",
      proposal: enrichAiProposal(modelProposal, state, this.idFactory())
    };
  }
}
