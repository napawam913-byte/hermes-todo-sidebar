import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { PlanApiConnectionInput, PlanApiPublicConfig } from "../../shared/planApiBridgeContract.js";

export interface StoredPlanApiConnectionV1 {
  schemaVersion: 1; mode: "local" | "ssh"; baseUrl: string; sshTarget: string;
  localPort: number; remotePort: number; tokenCiphertext: string; updatedAt: string;
}
export interface PlanApiConnectionPersistence {
  load(): Promise<StoredPlanApiConnectionV1 | null>;
  save(config: StoredPlanApiConnectionV1): Promise<void>;
}
export interface SecretProtector {
  isAvailable(): boolean;
  encrypt(value: string): Buffer;
  decrypt(value: Buffer): string;
}
export interface PlanApiConnectionEnvironment {
  isPackaged(): boolean;
  get(name: string): string | undefined;
}
export interface PlanApiRuntimeConnection {
  mode: "local" | "ssh"; baseUrl: string; sshTarget: string;
  localPort: number; remotePort: number; token: string;
}

export class PlanApiConnectionFileStore implements PlanApiConnectionPersistence {
  private readonly filePath: string;
  constructor(userDataDirectory: string) { this.filePath = path.join(userDataDirectory, "plan-api-connection.v1.json"); }
  async load(): Promise<StoredPlanApiConnectionV1 | null> {
    try {
      const value: unknown = JSON.parse(await readFile(this.filePath, "utf8"));
      return isStored(value) ? value : null;
    } catch { return null; }
  }
  async save(config: StoredPlanApiConnectionV1): Promise<void> {
    const directory = path.dirname(this.filePath);
    const tempPath = path.join(directory, `plan-api-connection.v1.${randomUUID()}.tmp`);
    await mkdir(directory, { recursive: true });
    await writeFile(tempPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
    try { await rename(tempPath, this.filePath); } finally { await rm(tempPath, { force: true }); }
  }
}

export class PlanApiConnectionStore {
  constructor(
    private readonly persistence: PlanApiConnectionPersistence,
    private readonly protector: SecretProtector,
    private readonly now: () => Date = () => new Date(),
    private readonly environment: PlanApiConnectionEnvironment = defaultEnvironment
  ) {}

  async save(input: PlanApiConnectionInput): Promise<PlanApiPublicConfig> {
    this.requireProtector();
    const saved = input.desktopToken.trim() ? null : await this.loadSaved();
    const connection = normalize({ ...input, desktopToken: input.desktopToken.trim() || saved?.connection.token || "" });
    const updatedAt = this.now().toISOString();
    await this.persistence.save({
      ...withoutToken(connection), schemaVersion: 1,
      tokenCiphertext: this.protector.encrypt(connection.token).toString("base64"), updatedAt
    });
    return publicConfig(connection, updatedAt);
  }

  async resolveConnection(input?: PlanApiConnectionInput): Promise<PlanApiRuntimeConnection | null> {
    if (input) {
      const saved = input.desktopToken.trim() ? null : await this.loadSaved();
      return normalize({ ...input, desktopToken: input.desktopToken.trim() || saved?.connection.token || "" });
    }
    const saved = await this.loadSaved();
    if (saved) return saved.connection;
    return this.environment.isPackaged() ? null : this.fromEnvironment();
  }

  async getPublicConfig(): Promise<PlanApiPublicConfig> {
    const saved = await this.loadSaved();
    if (saved) return publicConfig(saved.connection, saved.updatedAt);
    const connection = this.environment.isPackaged() ? null : this.fromEnvironment();
    return connection ? publicConfig(connection) : emptyPublicConfig();
  }

  private async loadSaved(): Promise<{ connection: PlanApiRuntimeConnection; updatedAt: string } | null> {
    const stored = await this.persistence.load();
    if (!stored) return null;
    this.requireProtector();
    return {
      connection: normalize({ ...stored, desktopToken: this.protector.decrypt(Buffer.from(stored.tokenCiphertext, "base64")) }),
      updatedAt: stored.updatedAt
    };
  }

  private fromEnvironment(): PlanApiRuntimeConnection | null {
    const baseUrl = this.environment.get("HERMES_PLAN_API_URL")?.trim() || "";
    const token = this.environment.get("HERMES_PLAN_API_TOKEN")?.trim() || "";
    if (!baseUrl || !token) return null;
    try {
      const url = new URL(baseUrl);
      const port = Number(url.port) || 8743;
      return normalize({ mode: this.environment.get("HERMES_PLAN_API_MODE") as "local" | "ssh", baseUrl,
        sshTarget: this.environment.get("HERMES_PLAN_API_SSH_TARGET") || "", localPort: port, remotePort: port, desktopToken: token });
    } catch { return null; }
  }

  private requireProtector(): void {
    if (!this.protector.isAvailable()) throw new Error("Secure storage is unavailable");
  }
}

const defaultEnvironment: PlanApiConnectionEnvironment = {
  isPackaged: () => process.env.NODE_ENV === "production",
  get: (name) => process.env[name]
};

function normalize(input: PlanApiConnectionInput): PlanApiRuntimeConnection {
  const baseUrl = input.baseUrl.trim().replace(/\/+$/, "");
  const token = input.desktopToken.trim();
  let parsed: URL;
  try { parsed = new URL(baseUrl); } catch { throw new Error("Base URL is invalid"); }
  if (!baseUrl || !parsed.hostname || !["http:", "https:"].includes(parsed.protocol)) throw new Error("Base URL must use HTTP or HTTPS");
  if (input.mode !== "local" && input.mode !== "ssh") throw new Error("Mode must be local or ssh");
  if (input.mode === "ssh" && !input.sshTarget.trim()) throw new Error("SSH target is required");
  if (!validPort(input.localPort) || !validPort(input.remotePort)) throw new Error("Port must be an integer from 1 to 65535");
  if (!token) throw new Error("Token is required");
  return { mode: input.mode, baseUrl, sshTarget: input.sshTarget.trim(), localPort: input.localPort, remotePort: input.remotePort, token };
}

function validPort(value: number): boolean { return Number.isInteger(value) && value >= 1 && value <= 65535; }
function withoutToken(connection: PlanApiRuntimeConnection): Omit<PlanApiRuntimeConnection, "token"> {
  const { token: _token, ...publicFields } = connection;
  return publicFields;
}
function publicConfig(connection: PlanApiRuntimeConnection, updatedAt?: string): PlanApiPublicConfig {
  return { schemaVersion: 1, configured: true, ...withoutToken(connection), tokenConfigured: true, tokenHint: connection.token.slice(-4), ...(updatedAt ? { updatedAt } : {}) };
}
function emptyPublicConfig(): PlanApiPublicConfig {
  return { schemaVersion: 1, configured: false, mode: "local", baseUrl: "", sshTarget: "", localPort: 8743, remotePort: 8743, tokenConfigured: false, tokenHint: "" };
}
function isStored(value: unknown): value is StoredPlanApiConnectionV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const keys = ["schemaVersion", "mode", "baseUrl", "sshTarget", "localPort", "remotePort", "tokenCiphertext", "updatedAt"];
  return Object.keys(record).length === keys.length && keys.every((key) => key in record)
    && record.schemaVersion === 1 && (record.mode === "local" || record.mode === "ssh")
    && typeof record.baseUrl === "string" && typeof record.sshTarget === "string"
    && typeof record.localPort === "number" && typeof record.remotePort === "number"
    && typeof record.tokenCiphertext === "string" && typeof record.updatedAt === "string";
}
