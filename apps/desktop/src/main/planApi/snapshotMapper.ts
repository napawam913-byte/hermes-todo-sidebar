import type { CyclePlan, CyclePlanEntry, DataSource, Todo } from "../../shared/appDomainTypes.js";
import { contentDocumentToBlocks } from "./contentDocumentMapper.js";
import { PlanApiVersionIndex } from "./planApiVersionIndex.js";
import type { PlanApiContentDocument, PlanApiSnapshot, PlanApiTaskEntryView, PlanApiTaskView } from "./planApiWireTypes.js";

export interface PlanApiSnapshotMapping {
  todos: Todo[];
  cyclePlans: CyclePlan[];
  versionIndex: PlanApiVersionIndex;
  serverRevision: number;
}

export function mapPlanApiSnapshot(snapshot: PlanApiSnapshot): PlanApiSnapshotMapping {
  return {
    todos: snapshot.tasks.filter((task) => task.kind === "daily").flatMap(mapDailyTask),
    cyclePlans: snapshot.tasks.filter((task) => task.kind === "cycle").map(mapCyclePlan),
    versionIndex: PlanApiVersionIndex.fromSnapshot(snapshot),
    serverRevision: snapshot.serverRevision,
  };
}

function mapDailyTask(task: PlanApiTaskView): Todo[] {
  if (task.entries.some((entry) => entry.status === "skipped")) {
    throw new Error("Skipped daily entry cannot be mapped to Todo");
  }
  return task.entries.map(mapTodo);
}

function mapTodo(entry: PlanApiTaskEntryView): Todo {
  const notes = readNotes(entry.content);
  return {
    id: entry.id, title: entry.content.title, date: entry.scheduled_date, ...(notes ? { notes } : {}),
    status: entry.status === "completed" ? "completed" : "pending", syncStatus: "synced",
    source: mapSource(entry.source), createdAt: entry.created_at, updatedAt: entry.updated_at,
    ...(entry.completed_at ? { completedAt: entry.completed_at } : {}), snoozeCount: 0,
  };
}

function mapCyclePlan(task: PlanApiTaskView): CyclePlan {
  return {
    schemaVersion: 2, id: task.id, title: task.content.title, topic: readTopic(task.content),
    description: task.content.summary, status: task.status, source: { type: "hermes" },
    entries: task.entries.map((entry) => mapCycleEntry(task.id, entry)),
    createdAt: task.created_at, updatedAt: task.updated_at,
  };
}

function mapCycleEntry(planId: string, entry: PlanApiTaskEntryView): CyclePlanEntry {
  return {
    schemaVersion: 2, id: entry.id, planId, date: entry.scheduled_date, title: entry.content.title,
    contentSummary: entry.content.summary, contentBlocks: contentDocumentToBlocks(entry.content), status: entry.status,
    source: mapSource(entry.source), createdAt: entry.created_at, updatedAt: entry.updated_at,
    ...(entry.completed_at ? { completedAt: entry.completed_at } : {}),
  };
}

function mapSource(source: PlanApiTaskEntryView["source"]): DataSource {
  return { type: source === "manual" ? "manual" : "hermes" };
}

function readTopic(content: PlanApiContentDocument): string {
  for (const section of content.sections) {
    const topic = section.fields.find((field) => field.key === "topic" && typeof field.value === "string");
    if (topic && typeof topic.value === "string") return topic.value;
  }
  return "";
}

function readNotes(content: PlanApiContentDocument): string | undefined {
  for (const section of content.sections) {
    const notes = section.fields.find((field) => field.key === "notes" && typeof field.value === "string");
    if (notes && typeof notes.value === "string") return notes.value;
  }
  return undefined;
}
