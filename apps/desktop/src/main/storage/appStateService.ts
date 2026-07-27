/**
 * 模块用途：串行协调待办与周期计划的状态更新，避免不同 renderer 写入互相覆盖。
 * 模块边界：管理内存快照和持久化顺序，不直接访问文件系统或 Electron IPC。
 */
import { createEmptyAppState, type StoredAppStateV1 } from "./appStateTypes.js";

export interface AppStatePersistence {
  load(): Promise<StoredAppStateV1>;
  save(state: StoredAppStateV1): Promise<void>;
  exportTo(destinationPath: string): Promise<void>;
  importFrom(sourcePath: string): Promise<StoredAppStateV1>;
}

export class AppStateService {
  private state = createEmptyAppState();
  private writeTail: Promise<void> = Promise.resolve();

  constructor(
    private readonly persistence: AppStatePersistence,
    private readonly now: () => Date = () => new Date()
  ) {}

  async initialize(): Promise<StoredAppStateV1> {
    this.state = await this.persistence.load();
    return this.getSnapshot();
  }

  getSnapshot(): StoredAppStateV1 {
    return structuredClone(this.state);
  }

  replaceTodos(todos: unknown[]): Promise<StoredAppStateV1> {
    return this.enqueueUpdate((state) => ({ ...state, todos: structuredClone(todos) }));
  }

  replaceCyclePlans(cyclePlans: unknown[]): Promise<StoredAppStateV1> {
    return this.enqueueUpdate((state) => ({
      ...state,
      cyclePlans: structuredClone(cyclePlans)
    }));
  }

  transact(
    update: (state: StoredAppStateV1) => StoredAppStateV1
  ): Promise<StoredAppStateV1> {
    return this.enqueueUpdate((state) => update(structuredClone(state)));
  }

  async exportTo(destinationPath: string): Promise<void> {
    await this.writeTail;
    await this.persistence.exportTo(destinationPath);
  }

  async importFrom(sourcePath: string): Promise<StoredAppStateV1> {
    await this.writeTail;
    this.state = await this.persistence.importFrom(sourcePath);
    return this.getSnapshot();
  }

  private enqueueUpdate(
    update: (state: StoredAppStateV1) => StoredAppStateV1
  ): Promise<StoredAppStateV1> {
    const operation = this.writeTail.then(async () => {
      const next = {
        ...update(this.state),
        updatedAt: this.now().toISOString()
      };
      await this.persistence.save(next);
      this.state = next;
      return this.getSnapshot();
    });

    this.writeTail = operation.then(
      () => undefined,
      () => undefined
    );
    return operation;
  }
}
