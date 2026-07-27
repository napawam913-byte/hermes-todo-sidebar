/**
 * 模块用途：在用户数据目录原子保存不含 API Key 的模型配置草稿。
 * 模块边界：不保存、读取或推断任何密钥，不处理正式模型配置。
 */
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AiConfigDraftV1 } from "../../shared/aiBridgeContract.js";

export interface AiConfigDraftPersistence {
  load(): Promise<AiConfigDraftV1 | null>;
  save(draft: AiConfigDraftV1): Promise<void>;
  clear(): Promise<void>;
}

export class AiConfigDraftFileStore implements AiConfigDraftPersistence {
  private readonly filePath: string;
  private readonly tempPath: string;

  constructor(userDataDirectory: string) {
    this.filePath = path.join(userDataDirectory, "ai-config-draft.v1.json");
    this.tempPath = path.join(userDataDirectory, "ai-config-draft.v1.tmp");
  }

  async load(): Promise<AiConfigDraftV1 | null> {
    try {
      const value: unknown = JSON.parse(await readFile(this.filePath, "utf8"));
      return isDraft(value) ? value : null;
    } catch {
      return null;
    }
  }

  async save(draft: AiConfigDraftV1): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.tempPath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
    try {
      await rename(this.tempPath, this.filePath);
    } finally {
      await rm(this.tempPath, { force: true });
    }
  }

  async clear(): Promise<void> {
    await rm(this.tempPath, { force: true });
    await rm(this.filePath, { force: true });
  }
}

function isDraft(value: unknown): value is AiConfigDraftV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const exactKeys = ["schemaVersion", "baseUrl", "model", "updatedAt"];
  return Object.keys(record).every((key) => exactKeys.includes(key))
    && Object.keys(record).length === exactKeys.length
    && record.schemaVersion === 1
    && typeof record.baseUrl === "string"
    && typeof record.model === "string"
    && typeof record.updatedAt === "string";
}
