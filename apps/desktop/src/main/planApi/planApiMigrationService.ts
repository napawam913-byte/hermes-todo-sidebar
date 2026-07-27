import type { StoredAppStateV1 } from "../storage/appStateTypes.js";
import { createMigrationBatch } from "./planApiMigrationBatch.js";
import {
  PlanApiMigrationFileStore,
  type PlanApiMigrationRecordV1,
} from "./planApiMigrationFileStore.js";
import {
  freezeLegacyState,
  type FrozenLegacyState,
} from "./planApiMigrationLegacy.js";
import { migrationCommitIsVerified } from "./planApiMigrationVerification.js";
import type {
  PlanApiMutationBatch,
  PlanApiMutationResult,
  PlanApiSnapshot,
} from "./planApiWireTypes.js";

type Client = {
  snapshot(): Promise<PlanApiSnapshot>;
  mutate(batch: PlanApiMutationBatch): Promise<PlanApiMutationResult>;
};
type BlockReason = "remote_not_empty" | "remote_empty" | "legacy_empty"
  | "legacy_invalid" | "legacy_changed" | "local_limit_exceeded";
export type PlanApiMigrationInspection =
  | { status: "completed" | "skipped"; record: PlanApiMigrationRecordV1 }
  | { status: "pending" }
  | { status: "ready"; taskCount: number; entryCount: number }
  | { status: "blocked"; reason: BlockReason };

export class PlanApiMigrationError extends Error {
  constructor(readonly code: "migration_verification_failed") {
    super(code);
    this.name = "PlanApiMigrationError";
  }
}

export interface PlanApiMigrationDependencies {
  legacyState: { getSnapshot(): StoredAppStateV1 };
  client: Client;
  fileStore: Pick<PlanApiMigrationFileStore, "loadRecord" | "backupLegacy" | "saveRecord">;
  now?: () => Date;
}

export class PlanApiMigrationService {
  private tail: Promise<void> = Promise.resolve();
  private readonly now: () => Date;

  constructor(private readonly deps: PlanApiMigrationDependencies) {
    this.now = deps.now ?? (() => new Date());
  }

  inspect(): Promise<PlanApiMigrationInspection> {
    return this.enqueue(async () => {
      const record = await this.deps.fileStore.loadRecord();
      if (!record) return this.fresh(false);
      return record.status === "pending"
        ? this.pendingInspection(record, this.frozen())
        : { status: record.status, record };
    });
  }

  migrate(): Promise<PlanApiMigrationInspection> {
    return this.enqueue(async () => {
      const existing = await this.deps.fileStore.loadRecord();
      if (existing?.status !== "pending") {
        return existing ? { status: existing.status, record: existing } : this.fresh(true);
      }
      const frozen = this.frozen();
      const inspection = this.pendingInspection(existing, frozen);
      return inspection.status === "pending" ? this.commit(frozen!, existing) : inspection;
    });
  }

  keepRemoteAndSkip(): Promise<PlanApiMigrationInspection> {
    return this.enqueue(async () => {
      const existing = await this.deps.fileStore.loadRecord();
      if (existing) return existing.status === "pending"
        ? { status: "pending" }
        : { status: existing.status, record: existing };
      const frozen = this.frozen();
      if (!frozen) return blocked("legacy_invalid");
      const remote = await this.deps.client.snapshot();
      if (!remote.tasks.length) return blocked("remote_empty");
      const backupPath = await this.deps.fileStore.backupLegacy(frozen.state);
      const record = createRecord("skipped", frozen, backupPath, remote.serverRevision, this.now());
      await this.deps.fileStore.saveRecord(record);
      return { status: "skipped", record };
    });
  }

  private async fresh(commit: boolean): Promise<PlanApiMigrationInspection> {
    const frozen = this.frozen();
    if (!frozen) return blocked("legacy_invalid");
    if (!frozen.taskCount) return blocked("legacy_empty");
    if (frozen.taskCount > 100) return blocked("local_limit_exceeded");
    const remote = await this.deps.client.snapshot();
    if (remote.tasks.length) return blocked("remote_not_empty");
    if (!commit) return { status: "ready", taskCount: frozen.taskCount, entryCount: frozen.entryCount };
    const backupPath = await this.deps.fileStore.backupLegacy(frozen.state);
    const record = createRecord("pending", frozen, backupPath, remote.serverRevision, this.now());
    await this.deps.fileStore.saveRecord(record);
    return this.commit(frozen, record);
  }

  private async commit(
    frozen: FrozenLegacyState,
    record: PlanApiMigrationRecordV1,
  ): Promise<PlanApiMigrationInspection> {
    const batch = createMigrationBatch(
      frozen,
      record.idempotencyKey,
      record.baselineRevision,
    );
    const result = await this.deps.client.mutate(batch);
    const snapshot = await this.deps.client.snapshot();
    if (!migrationCommitIsVerified(result, snapshot, batch, record)) {
      throw new PlanApiMigrationError("migration_verification_failed");
    }
    const completed = { ...record, status: "completed" as const, completedAt: this.now().toISOString() };
    await this.deps.fileStore.saveRecord(completed);
    return { status: "completed", record: completed };
  }

  private frozen(): FrozenLegacyState | null {
    return freezeLegacyState(this.deps.legacyState.getSnapshot());
  }

  private pendingInspection(record: PlanApiMigrationRecordV1, frozen: FrozenLegacyState | null): PlanApiMigrationInspection {
    if (!frozen) return blocked("legacy_invalid");
    return record.sourceFingerprint === frozen.fingerprint
      && record.importedTaskCount === frozen.taskCount
      && record.importedEntryCount === frozen.entryCount
      ? { status: "pending" }
      : blocked("legacy_changed");
  }

  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const result = this.tail.then(job);
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }
}

function blocked(reason: BlockReason): PlanApiMigrationInspection {
  return { status: "blocked", reason };
}

function createRecord(
  status: "pending" | "skipped",
  frozen: FrozenLegacyState,
  backupPath: string,
  baselineRevision: number,
  now: Date,
): PlanApiMigrationRecordV1 {
  return {
    schemaVersion: 1,
    status,
    sourceUpdatedAt: frozen.state.updatedAt,
    sourceFingerprint: frozen.fingerprint,
    backupPath,
    idempotencyKey: `desktop-migration:${frozen.fingerprint}`,
    importedTaskCount: status === "pending" ? frozen.taskCount : 0,
    importedEntryCount: status === "pending" ? frozen.entryCount : 0,
    baselineRevision,
    ...(status === "skipped" ? { completedAt: now.toISOString() } : {}),
  };
}
