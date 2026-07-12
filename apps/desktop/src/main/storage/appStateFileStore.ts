/**
 * 模块用途：在 Electron userData 目录原子保存应用状态，并管理最近七份可恢复备份。
 * 模块边界：只负责文件系统读写与顶层格式校验，不解释具体待办和计划字段。
 */
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import {
  createEmptyAppState,
  isStoredAppState,
  type StoredAppStateV1
} from "./appStateTypes.js";

const INVALID_DATA_MESSAGE = "不支持的应用数据格式";

export interface AppStateFileStoreOptions {
  dataDirectory: string;
  now?: () => Date;
  maxBackups?: number;
}

export class AppStateFileStore {
  readonly stateFilePath: string;
  readonly backupDirectory: string;
  private readonly tempFilePath: string;
  private readonly now: () => Date;
  private readonly maxBackups: number;
  private backupSequence = 0;

  constructor(options: AppStateFileStoreOptions) {
    this.stateFilePath = path.join(options.dataDirectory, "state.v1.json");
    this.backupDirectory = path.join(options.dataDirectory, "backups");
    this.tempFilePath = path.join(options.dataDirectory, "state.v1.tmp");
    this.now = options.now ?? (() => new Date());
    this.maxBackups = options.maxBackups ?? 7;
  }

  async load(): Promise<StoredAppStateV1> {
    const primary = await this.readValidState(this.stateFilePath);
    if (primary) {
      return primary;
    }

    const backupNames = await this.listBackupNames();
    for (const backupName of backupNames.reverse()) {
      const recovered = await this.readValidState(path.join(this.backupDirectory, backupName));
      if (recovered) {
        await this.writePrimary(recovered);
        return recovered;
      }
    }

    return createEmptyAppState(this.now());
  }

  async save(state: StoredAppStateV1): Promise<void> {
    this.assertValidState(state);
    await this.ensureDirectories();
    const existing = await this.readValidState(this.stateFilePath);
    if (existing) {
      await copyFile(this.stateFilePath, this.nextBackupPath());
    }

    await this.writePrimary(state);
    await this.pruneBackups();
  }

  async exportTo(destinationPath: string): Promise<void> {
    const state = await this.load();
    await mkdir(path.dirname(destinationPath), { recursive: true });
    await writeFile(destinationPath, this.serialize(state), "utf8");
  }

  async importFrom(sourcePath: string): Promise<StoredAppStateV1> {
    const imported = this.parse(await readFile(sourcePath, "utf8"));
    await this.save(imported);
    return imported;
  }

  private async writePrimary(state: StoredAppStateV1): Promise<void> {
    await this.ensureDirectories();
    await writeFile(this.tempFilePath, this.serialize(state), "utf8");
    try {
      await rename(this.tempFilePath, this.stateFilePath);
    } finally {
      await rm(this.tempFilePath, { force: true });
    }
  }

  private async readValidState(filePath: string): Promise<StoredAppStateV1 | null> {
    try {
      return this.parse(await readFile(filePath, "utf8"));
    } catch {
      return null;
    }
  }

  private parse(raw: string): StoredAppStateV1 {
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      throw new Error(INVALID_DATA_MESSAGE);
    }
    this.assertValidState(value);
    return value;
  }

  private assertValidState(value: unknown): asserts value is StoredAppStateV1 {
    if (!isStoredAppState(value)) {
      throw new Error(INVALID_DATA_MESSAGE);
    }
  }

  private async ensureDirectories(): Promise<void> {
    await mkdir(path.dirname(this.stateFilePath), { recursive: true });
    await mkdir(this.backupDirectory, { recursive: true });
  }

  private async listBackupNames(): Promise<string[]> {
    try {
      return (await readdir(this.backupDirectory))
        .filter((name) => name.endsWith(".json"))
        .sort();
    } catch {
      return [];
    }
  }

  private nextBackupPath(): string {
    const stamp = this.now().toISOString().replace(/[:.]/g, "-");
    this.backupSequence += 1;
    const sequence = String(this.backupSequence).padStart(4, "0");
    return path.join(this.backupDirectory, `state.${stamp}.${sequence}.json`);
  }

  private async pruneBackups(): Promise<void> {
    const backupNames = await this.listBackupNames();
    const expired = backupNames.slice(0, Math.max(0, backupNames.length - this.maxBackups));
    await Promise.all(expired.map((name) => rm(path.join(this.backupDirectory, name))));
  }

  private serialize(state: StoredAppStateV1): string {
    return `${JSON.stringify(state, null, 2)}\n`;
  }
}
