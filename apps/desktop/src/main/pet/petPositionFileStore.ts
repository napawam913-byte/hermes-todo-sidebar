/**
 * 模块用途：在 userData 根目录保存独立的桌宠位置文件。
 * 模块边界：不读取待办数据，不判断显示器，也不操作窗口。
 */
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

interface PetPositionFileStoreOptions {
  userDataDirectory: string;
  now?: () => Date;
}

export interface StoredPetPositionV1 {
  schemaVersion: 1;
  displayId: number;
  x: number;
  y: number;
  updatedAt: string;
}

export class PetPositionFileStore {
  readonly filePath: string;
  private readonly tempFilePath: string;
  private readonly now: () => Date;

  constructor(options: PetPositionFileStoreOptions) {
    this.filePath = path.join(options.userDataDirectory, "pet-position.v1.json");
    this.tempFilePath = path.join(options.userDataDirectory, "pet-position.v1.tmp");
    this.now = options.now ?? (() => new Date());
  }

  async load(): Promise<StoredPetPositionV1 | undefined> {
    try {
      const value: unknown = JSON.parse(await readFile(this.filePath, "utf8"));
      return isStoredPetPosition(value) ? value : undefined;
    } catch {
      return undefined;
    }
  }

  async save(position: { displayId: number; x: number; y: number }): Promise<void> {
    const record: StoredPetPositionV1 = {
      schemaVersion: 1,
      ...position,
      updatedAt: this.now().toISOString()
    };
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.tempFilePath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
    try {
      await rename(this.tempFilePath, this.filePath);
    } finally {
      await rm(this.tempFilePath, { force: true });
    }
  }
}

function isStoredPetPosition(value: unknown): value is StoredPetPositionV1 {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.schemaVersion === 1
    && typeof record.displayId === "number"
    && Number.isFinite(record.displayId)
    && typeof record.x === "number"
    && Number.isFinite(record.x)
    && typeof record.y === "number"
    && Number.isFinite(record.y)
    && typeof record.updatedAt === "string";
}
