/** 模块用途：安全保存旧状态迁移的备份与一次性结果记录。 */
import { randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export interface PlanApiMigrationRecordV1 {
  schemaVersion: 1;
  status: "completed" | "skipped";
  sourceUpdatedAt: string;
  backupPath: string;
  importedTaskCount: number;
  importedEntryCount: number;
  completedAt: string;
}

export class PlanApiMigrationStorageError extends Error {
  constructor(readonly code: "record_invalid" | "read_failed" | "backup_failed" | "write_failed") {
    super(`Plan API migration storage ${code}`);
    this.name = "PlanApiMigrationStorageError";
  }
}

const recordName = "plan-api-migration.v1.json";

export class PlanApiMigrationFileStore {
  readonly recordPath: string;
  readonly legacyStatePath: string;
  private saveTail: Promise<void> = Promise.resolve();

  constructor(private readonly dataDirectory: string, private readonly now: () => Date = () => new Date()) {
    this.recordPath = path.join(dataDirectory, recordName);
    this.legacyStatePath = path.join(dataDirectory, "state.v1.json");
  }

  async loadRecord(): Promise<PlanApiMigrationRecordV1 | null> {
    try {
      return parseRecord(await readFile(this.recordPath, "utf8"));
    } catch (error: any) {
      if (error?.code === "ENOENT") return null;
      if (error instanceof SyntaxError || error?.message === "invalid migration record") {
        throw new PlanApiMigrationStorageError("record_invalid");
      }
      throw new PlanApiMigrationStorageError("read_failed");
    }
  }

  async backupLegacy(): Promise<string> {
    const stamp = this.now().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(this.dataDirectory, `state.v1.pre-plan-api-${stamp}.json`);
    try {
      await mkdir(this.dataDirectory, { recursive: true });
      await copyFile(this.legacyStatePath, backupPath);
      return backupPath;
    } catch {
      throw new PlanApiMigrationStorageError("backup_failed");
    }
  }

  async saveRecord(record: PlanApiMigrationRecordV1): Promise<void> {
    const value = parseRecord(JSON.stringify(record));
    const serialized = `${JSON.stringify(value, null, 2)}\n`;
    const tempPath = path.join(this.dataDirectory, `${recordName}.${randomUUID()}.tmp`);
    const operation = this.saveTail.then(async () => {
      try {
        await mkdir(this.dataDirectory, { recursive: true });
        await writeFile(tempPath, serialized, "utf8");
        await rename(tempPath, this.recordPath);
      } catch {
        throw new PlanApiMigrationStorageError("write_failed");
      } finally {
        await rm(tempPath, { force: true });
      }
    });
    this.saveTail = operation.catch(() => undefined);
    await operation;
  }
}

function parseRecord(raw: string): PlanApiMigrationRecordV1 {
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value) || !hasKeys(value, [
    "schemaVersion", "status", "sourceUpdatedAt", "backupPath", "importedTaskCount", "importedEntryCount", "completedAt",
  ]) || value.schemaVersion !== 1 || (value.status !== "completed" && value.status !== "skipped")
    || !isTimestamp(value.sourceUpdatedAt) || !isString(value.backupPath) || !isCount(value.importedTaskCount)
    || !isCount(value.importedEntryCount) || !isTimestamp(value.completedAt)
    || (value.status === "completed" && !value.backupPath)) throw new Error("invalid migration record");
  return value as unknown as PlanApiMigrationRecordV1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function hasKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return keys.every((key) => key in value) && Object.keys(value).every((key) => keys.includes(key));
}
function isString(value: unknown): value is string { return typeof value === "string"; }
function isTimestamp(value: unknown): value is string { return isString(value) && !Number.isNaN(Date.parse(value)); }
function isCount(value: unknown): value is number { return typeof value === "number" && Number.isInteger(value) && value >= 0; }
