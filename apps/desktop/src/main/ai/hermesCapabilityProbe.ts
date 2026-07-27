/**
 * 模块用途：通过只读发现端点识别 Hermes，并检查周期计划 Skill/Tool 是否齐备。
 * 模块边界：不发送聊天、不修改 Hermes 配置，也不向 renderer 暴露 API Key。
 */
import type { AiModelCredentials } from "./aiConfigTypes.js";

export type HermesCapabilitySnapshot =
  | { provider: "hermes"; cyclePlanExtension: "ready" | "missing" | "unknown" }
  | { provider: "openai-compatible"; cyclePlanExtension: "unknown" };

const REQUIRED_TOOLS = new Set([
  "cycle_plan_propose_create",
  "cycle_plan_propose_adjust"
]);

export class HermesCapabilityProbe {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async inspect(credentials: AiModelCredentials): Promise<HermesCapabilitySnapshot> {
    const apiRoot = trimSlash(credentials.baseUrl);
    const serverRoot = apiRoot.replace(/\/v1$/i, "");
    const health = await this.get(credentials, `${serverRoot}/health`);
    if (!health.ok) return compatibleEndpoint();
    const capabilities = await this.get(credentials, `${apiRoot}/capabilities`);
    if (!capabilities.ok || !isHermesCapabilities(capabilities.body)) {
      return compatibleEndpoint();
    }
    const skillsPath = readEndpointPath(capabilities.body, "skills");
    const toolsetsPath = readEndpointPath(capabilities.body, "toolsets");
    if (!skillsPath || !toolsetsPath) {
      return { provider: "hermes", cyclePlanExtension: "unknown" };
    }
    const [skills, toolsets] = await Promise.all([
      this.get(credentials, `${serverRoot}${skillsPath}`),
      this.get(credentials, `${serverRoot}${toolsetsPath}`)
    ]);
    const ready = skills.ok
      && toolsets.ok
      && hasCyclePlanSkill(skills.body)
      && hasCyclePlanTools(toolsets.body);
    return {
      provider: "hermes",
      cyclePlanExtension: ready ? "ready" : "missing"
    };
  }

  private async get(credentials: AiModelCredentials, url: string) {
    try {
      const response = await this.fetchImpl(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${credentials.apiKey}` },
        signal: AbortSignal.timeout(10_000)
      });
      return {
        ok: response.ok,
        body: response.ok ? await response.json().catch(() => null) : null
      };
    } catch {
      return { ok: false, body: null };
    }
  }
}

function isHermesCapabilities(value: unknown): boolean {
  return isRecord(value) && value.platform === "hermes-agent";
}

function readEndpointPath(value: unknown, name: string): string | null {
  if (!isRecord(value) || !isRecord(value.endpoints)) return null;
  const endpoint = value.endpoints[name];
  if (!isRecord(endpoint) || typeof endpoint.path !== "string") return null;
  return endpoint.path.startsWith("/") ? endpoint.path : null;
}

function hasCyclePlanSkill(value: unknown): boolean {
  return Array.isArray(value) && value.some((item) =>
    isRecord(item) && item.name === "cycle-plan"
  );
}

function hasCyclePlanTools(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  const toolset = value.find((item) => isRecord(item) && item.name === "cycle_plan");
  if (!isRecord(toolset) || !Array.isArray(toolset.tools)) return false;
  const tools = new Set(toolset.tools.filter((item): item is string => typeof item === "string"));
  return [...REQUIRED_TOOLS].every((tool) => tools.has(tool));
}

function compatibleEndpoint(): HermesCapabilitySnapshot {
  return { provider: "openai-compatible", cyclePlanExtension: "unknown" };
}

function trimSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
