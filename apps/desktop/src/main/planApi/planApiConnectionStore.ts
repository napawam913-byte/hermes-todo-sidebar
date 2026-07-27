import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { PlanApiConnectionInput, PlanApiPublicConfig } from "../../shared/planApiBridgeContract.js";

export interface StoredPlanApiConnectionV1 { schemaVersion: 1; mode: "local" | "ssh"; baseUrl: string; sshTarget: string; localPort: number; remotePort: number; tokenCiphertext: string; updatedAt: string; }
export interface PlanApiConnectionPersistence { load(): Promise<StoredPlanApiConnectionV1 | null>; save(config: StoredPlanApiConnectionV1): Promise<void>; }
export interface SecretProtector { isAvailable(): boolean; encrypt(value: string): Buffer; decrypt(value: Buffer): string; }
export interface PlanApiConnectionEnvironment { isPackaged(): boolean; get(name: string): string | undefined; }
export interface PlanApiConnectionFs {
  mkdir(directory: string, options: { recursive: true }): Promise<unknown>;
  readFile(file: string, encoding: "utf8"): Promise<string>;
  writeFile(file: string, value: string, encoding: "utf8"): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  rm(file: string, options: { force: true }): Promise<void>;
}
export interface PlanApiRuntimeConnection { mode: "local" | "ssh"; baseUrl: string; sshTarget: string; localPort: number; remotePort: number; token: string; }

const nodeFs: PlanApiConnectionFs = {
  mkdir: async (directory, options) => { await mkdir(directory, options); },
  readFile: async (file, encoding) => readFile(file, encoding),
  writeFile: async (file, value, encoding) => { await writeFile(file, value, encoding); },
  rename: async (from, to) => { await rename(from, to); },
  rm: async (file, options) => { await rm(file, options); }
};

export class PlanApiConnectionFileStore implements PlanApiConnectionPersistence {
  private readonly filePath: string;
  constructor(userDataDirectory: string, private readonly fs: PlanApiConnectionFs = nodeFs) { this.filePath = path.join(userDataDirectory, "plan-api-connection.v1.json"); }
  async load(): Promise<StoredPlanApiConnectionV1 | null> {
    let text: string;
    try { text = await this.fs.readFile(this.filePath, "utf8"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
    try { const value: unknown = JSON.parse(text); return isStored(value) ? value : null; } catch { return null; }
  }
  async save(config: StoredPlanApiConnectionV1): Promise<void> {
    const directory = path.dirname(this.filePath);
    const temporary = path.join(directory, `plan-api-connection.v1.${randomUUID()}.tmp`);
    await this.fs.mkdir(directory, { recursive: true });
    let failed = false;
    try { await this.fs.writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`, "utf8"); await this.fs.rename(temporary, this.filePath); }
    catch (error) { failed = true; throw error; }
    finally { try { await this.fs.rm(temporary, { force: true }); } catch (error) { if (!failed) throw error; } }
  }
}

export class PlanApiConnectionStore {
  private saves: Promise<void> = Promise.resolve();
  constructor(
    private readonly persistence: PlanApiConnectionPersistence,
    private readonly protector: SecretProtector,
    private readonly now: () => Date = () => new Date(),
    private readonly environment: PlanApiConnectionEnvironment = noEnvironment
  ) {}

  save(input: PlanApiConnectionInput): Promise<PlanApiPublicConfig> {
    const result = this.saves.then(() => this.saveNow(input));
    this.saves = result.then(() => undefined, () => undefined);
    return result;
  }
  private async saveNow(input: PlanApiConnectionInput): Promise<PlanApiPublicConfig> {
    this.requireProtector();
    const saved = input.desktopToken.trim() ? null : await this.loadSaved();
    const connection = normalize({ ...input, desktopToken: input.desktopToken.trim() || saved?.connection.token || "" });
    const updatedAt = this.now().toISOString();
    await this.persistence.save({ ...withoutToken(connection), schemaVersion: 1, tokenCiphertext: this.protector.encrypt(connection.token).toString("base64"), updatedAt });
    return publicConfig(connection, updatedAt);
  }
  async resolveConnection(input?: PlanApiConnectionInput): Promise<PlanApiRuntimeConnection | null> {
    if (input) {
      const saved = input.desktopToken.trim() ? null : await this.loadSaved();
      return normalize({ ...input, desktopToken: input.desktopToken.trim() || saved?.connection.token || "" });
    }
    const saved = await this.loadSaved();
    return saved ? saved.connection : this.environment.isPackaged() ? null : this.fromEnvironment();
  }
  async getPublicConfig(): Promise<PlanApiPublicConfig> {
    const saved = await this.loadSaved();
    if (saved) return publicConfig(saved.connection, saved.updatedAt);
    const connection = this.environment.isPackaged() ? null : this.fromEnvironment();
    return connection ? publicConfig(connection) : emptyPublicConfig();
  }
  private async loadSaved(): Promise<{ connection: PlanApiRuntimeConnection; updatedAt: string } | null> {
    const stored: unknown = await this.persistence.load();
    if (!isStored(stored)) return null;
    this.requireProtector();
    return { connection: normalize({ ...stored, desktopToken: this.protector.decrypt(Buffer.from(stored.tokenCiphertext, "base64")) }), updatedAt: stored.updatedAt };
  }
  private fromEnvironment(): PlanApiRuntimeConnection | null {
    const baseUrl = this.environment.get("HERMES_PLAN_API_URL")?.trim() || "";
    const token = this.environment.get("HERMES_PLAN_API_TOKEN")?.trim() || "";
    if (!baseUrl || !token) return null;
    try {
      const port = Number(new URL(baseUrl).port) || 8743;
      return normalize({ mode: this.environment.get("HERMES_PLAN_API_MODE") as "local" | "ssh", baseUrl, sshTarget: this.environment.get("HERMES_PLAN_API_SSH_TARGET") || "", localPort: port, remotePort: port, desktopToken: token });
    } catch { return null; }
  }
  private requireProtector(): void { if (!this.protector.isAvailable()) throw new Error("Secure storage is unavailable"); }
}

const noEnvironment: PlanApiConnectionEnvironment = { isPackaged: () => true, get: () => undefined };
function normalize(input: PlanApiConnectionInput): PlanApiRuntimeConnection {
  const baseUrl = input.baseUrl.trim().replace(/\/+$/, "");
  const error = baseUrlError(baseUrl);
  if (error) throw new Error(error);
  if (input.mode !== "local" && input.mode !== "ssh") throw new Error("Mode must be local or ssh");
  if (input.mode === "ssh" && !input.sshTarget.trim()) throw new Error("SSH target is required");
  if (!port(input.localPort) || !port(input.remotePort)) throw new Error("Port must be an integer from 1 to 65535");
  const token = input.desktopToken.trim();
  if (!token) throw new Error("Token is required");
  return { mode: input.mode, baseUrl, sshTarget: input.sshTarget.trim(), localPort: input.localPort, remotePort: input.remotePort, token };
}
function baseUrlError(value: string): string | null {
  let url: URL;
  try { url = new URL(value); } catch { return "Base URL is invalid"; }
  if (!url.hostname || !["http:", "https:"].includes(url.protocol)) return "Base URL must use HTTP or HTTPS";
  return url.username || url.password ? "Base URL must not contain credentials" : null;
}
function port(value: number): boolean { return Number.isInteger(value) && value >= 1 && value <= 65535; }
function withoutToken(connection: PlanApiRuntimeConnection): Omit<PlanApiRuntimeConnection, "token"> { const { token: _token, ...fields } = connection; return fields; }
function publicConfig(connection: PlanApiRuntimeConnection, updatedAt?: string): PlanApiPublicConfig {
  return { schemaVersion: 1, configured: true, ...withoutToken(connection), tokenConfigured: true, tokenHint: connection.token.slice(-4), ...(updatedAt ? { updatedAt } : {}) };
}
function emptyPublicConfig(): PlanApiPublicConfig { return { schemaVersion: 1, configured: false, mode: "local", baseUrl: "", sshTarget: "", localPort: 8743, remotePort: 8743, tokenConfigured: false, tokenHint: "" }; }
function isStored(value: unknown): value is StoredPlanApiConnectionV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const keys = ["schemaVersion", "mode", "baseUrl", "sshTarget", "localPort", "remotePort", "tokenCiphertext", "updatedAt"];
  return Object.keys(record).length === keys.length && keys.every((key) => key in record)
    && record.schemaVersion === 1 && (record.mode === "local" || record.mode === "ssh")
    && typeof record.baseUrl === "string" && !baseUrlError(record.baseUrl)
    && typeof record.sshTarget === "string" && (record.mode !== "ssh" || !!record.sshTarget.trim())
    && typeof record.localPort === "number" && port(record.localPort) && typeof record.remotePort === "number" && port(record.remotePort)
    && typeof record.tokenCiphertext === "string" && canonicalBase64(record.tokenCiphertext)
    && typeof record.updatedAt === "string" && validTimestamp(record.updatedAt);
}
function canonicalBase64(value: string): boolean { return value.length > 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(value) && value.length % 4 === 0 && Buffer.from(value, "base64").toString("base64") === value; }
function validTimestamp(value: string): boolean { const time = new Date(value); return !Number.isNaN(time.valueOf()) && time.toISOString() === value; }
