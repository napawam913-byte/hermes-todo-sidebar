import type { PlanApiSnapshot } from "./planApiWireTypes.js";

export interface EntryVersionRecord {
  id: string;
  taskId: string;
  version: number;
  updatedAt: string;
}

export interface TaskVersionRecord {
  id: string;
  version: number;
  updatedAt: string;
}

export class PlanApiVersionIndex {
  private constructor(
    private readonly tasks: Map<string, TaskVersionRecord>,
    private readonly entries: Map<string, EntryVersionRecord>,
  ) {}

  static fromSnapshot(snapshot: PlanApiSnapshot): PlanApiVersionIndex {
    const tasks = new Map<string, TaskVersionRecord>();
    const entries = new Map<string, EntryVersionRecord>();

    for (const task of snapshot.tasks) {
      tasks.set(task.id, { id: task.id, version: task.version, updatedAt: task.updated_at });
      for (const entry of task.entries) {
        entries.set(entry.id, {
          id: entry.id, taskId: task.id, version: entry.version, updatedAt: entry.updated_at,
        });
      }
    }
    return new PlanApiVersionIndex(tasks, entries);
  }

  requireTask(id: string): TaskVersionRecord {
    const task = this.tasks.get(id);
    if (!task) throw new Error(`Unknown Plan API task: ${id}`);
    return task;
  }

  requireEntry(id: string): EntryVersionRecord {
    const entry = this.entries.get(id);
    if (!entry) throw new Error(`Unknown Plan API entry: ${id}`);
    return entry;
  }
}
