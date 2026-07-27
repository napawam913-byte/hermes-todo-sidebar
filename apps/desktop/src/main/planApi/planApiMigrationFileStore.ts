/** 模块用途：保存可恢复迁移日志，并为冻结的旧状态创建不覆盖的备份。 */
import { randomUUID } from "node:crypto";
import { link, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StoredAppStateV1 } from "../storage/appStateTypes.js";

const RECORD_NAME = "plan-api-migration.v1.json";
const FINGERPRINT = /^[a-f0-9]{64}$/;

export interface PlanApiMigrationRecordV1 {
  schemaVersion: 1;
  status: "pending" | "completed" | "skipped";
  sourceUpdatedAt: string;
  sourceFingerprint: string;
  backupPath: string;
  idempotencyKey: string;
  importedTaskCount: number;
  importedEntryCount: number;
  baselineRevision: number;
  completedAt?: string;
}

export class PlanApiMigrationStorageError extends Error {
  readonly cause: { name: string; code?: string };

  constructor(
    readonly code:
      "record_invalid" | "read_failed" | "backup_failed" | "write_failed",
    cause?: unknown,
  ) {
    super(`Plan API migration storage ${code}`);
    this.name = "PlanApiMigrationStorageError";
    this.cause = safeCause(cause);
  }
}

export class PlanApiMigrationFileStore {
  readonly recordPath: string;
  readonly legacyStatePath: string;
  private writeTail: Promise<void> = Promise.resolve();

  constructor(
    private readonly dataDirectory: string,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.recordPath = path.join(dataDirectory, RECORD_NAME);
    this.legacyStatePath = path.join(dataDirectory, "state.v1.json");
  }

  async loadRecord(): Promise<PlanApiMigrationRecordV1 | null> {
    try {
      return parseRecord(await readFile(this.recordPath, "utf8"));
    } catch (error: unknown) {
      if (codeOf(error) === "ENOENT") return null;
      const code =
        error instanceof SyntaxError || messageOf(error) === "invalid record"
          ? "record_invalid"
          : "read_failed";
      throw new PlanApiMigrationStorageError(code, error);
    }
  }

  async backupLegacy(snapshot: StoredAppStateV1): Promise<string> {
    const stamp = this.now().toISOString().replace(/[:.]/g, "-");
    const finalPath = path.join(
      this.dataDirectory,
      `state.v1.pre-plan-api-${stamp}-${randomUUID()}.json`,
    );
    const temporaryPath = `${finalPath}.tmp`;
    let originalFailure: unknown;
    try {
      await mkdir(this.dataDirectory, { recursive: true });
      await writeFile(
        temporaryPath,
        `${JSON.stringify(snapshot, null, 2)}\n`,
        "utf8",
      );
      await link(temporaryPath, finalPath);
      return finalPath;
    } catch (error) {
      originalFailure = error;
      throw new PlanApiMigrationStorageError("backup_failed", error);
    } finally {
      await removeTemporary(temporaryPath, originalFailure, "backup_failed");
    }
  }

  async saveRecord(record: PlanApiMigrationRecordV1): Promise<void> {
    let serialized: string;
    try {
      serialized = `${JSON.stringify(parseRecord(JSON.stringify(record)), null, 2)}\n`;
    } catch (error) {
      throw new PlanApiMigrationStorageError("record_invalid", error);
    }
    const temporaryPath = path.join(
      this.dataDirectory,
      `${RECORD_NAME}.${randomUUID()}.tmp`,
    );
    const write = this.writeTail.then(async () => {
      let originalFailure: unknown;
      try {
        await mkdir(this.dataDirectory, { recursive: true });
        await writeFile(temporaryPath, serialized, "utf8");
        await rename(temporaryPath, this.recordPath);
      } catch (error) {
        originalFailure = error;
        throw new PlanApiMigrationStorageError("write_failed", error);
      } finally {
        await removeTemporary(temporaryPath, originalFailure, "write_failed");
      }
    });
    this.writeTail = write.catch(() => undefined);
    await write;
  }
}

async function removeTemporary(
  temporaryPath: string,
  originalFailure: unknown,
  code: "backup_failed" | "write_failed",
): Promise<void> {
  try {
    await rm(temporaryPath, { force: true });
  } catch (cleanupError) {
    if (!originalFailure)
      throw new PlanApiMigrationStorageError(code, cleanupError);
  }
}

function parseRecord(raw: string): PlanApiMigrationRecordV1 {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("invalid record");
  const record = value as Record<string, unknown>;
  const keys = [
    "schemaVersion",
    "status",
    "sourceUpdatedAt",
    "sourceFingerprint",
    "backupPath",
    "idempotencyKey",
    "importedTaskCount",
    "importedEntryCount",
    "baselineRevision",
    "completedAt",
  ];
  const required = keys.slice(0, -1);
  const completed = record.status === "completed";
  const skipped = record.status === "skipped";
  const final = completed || skipped;
  const valid =
    record.schemaVersion === 1 &&
    (record.status === "pending" || final) &&
    required.every((key) => key in record) &&
    Object.keys(record).every((key) => keys.includes(key)) &&
    typeof record.sourceUpdatedAt === "string" &&
    nonEmpty(record.backupPath) &&
    typeof record.idempotencyKey === "string" &&
    typeof record.sourceFingerprint === "string" &&
    FINGERPRINT.test(record.sourceFingerprint) &&
    record.idempotencyKey === `desktop-migration:${record.sourceFingerprint}` &&
    numeric(record.importedTaskCount) &&
    numeric(record.importedEntryCount) &&
    numeric(record.baselineRevision) &&
    (final
      ? iso(record.completedAt)
      : !("completedAt" in record)) &&
    (skipped
      ? record.importedTaskCount === 0 && record.importedEntryCount === 0
      : record.importedTaskCount > 0);
  if (!valid) throw new Error("invalid record");
  return record as unknown as PlanApiMigrationRecordV1;
}

function numeric(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function iso(value: unknown): value is string {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T/.test(value)
    && !Number.isNaN(Date.parse(value));
}

function safeCause(value: unknown): { name: string; code?: string } {
  const code = codeOf(value);
  return {
    name: value instanceof Error ? value.name : "Error",
    ...(code ? { code } : {}),
  };
}

function codeOf(value: unknown): string | undefined {
  return typeof value === "object" && value !== null && "code" in value
    ? String((value as { code: unknown }).code)
    : undefined;
}

function messageOf(value: unknown): string | undefined {
  return value instanceof Error ? value.message : undefined;
}
