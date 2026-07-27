/**
 * 模块用途：在 userData 下原子读写仅含密文的模型配置文件。
 * 模块边界：不加解密 API Key，不向 renderer 暴露文件路径。
 */
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StoredAiConfigV1 } from "./aiConfigTypes.js";
import type { AiConfigPersistence } from "./aiConfigStore.js";

export class AiConfigFileStore implements AiConfigPersistence {
  private readonly filePath: string;
  private readonly tempPath: string;

  constructor(userDataDirectory: string) {
    this.filePath = path.join(userDataDirectory, "ai-model-config.v1.json");
    this.tempPath = path.join(userDataDirectory, "ai-model-config.v1.tmp");
  }

  async load(): Promise<StoredAiConfigV1 | null> {
    try {
      const value: unknown = JSON.parse(await readFile(this.filePath, "utf8"));
      return isStoredConfig(value) ? value : null;
    } catch {
      return null;
    }
  }

  async save(config: StoredAiConfigV1): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.tempPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
    try {
      await rename(this.tempPath, this.filePath);
    } finally {
      await rm(this.tempPath, { force: true });
    }
  }
}

function isStoredConfig(value: unknown): value is StoredAiConfigV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const config = value as Partial<StoredAiConfigV1>;
  return config.schemaVersion === 1
    && typeof config.baseUrl === "string"
    && typeof config.model === "string"
    && typeof config.apiKeyCiphertext === "string"
    && typeof config.updatedAt === "string";
}
