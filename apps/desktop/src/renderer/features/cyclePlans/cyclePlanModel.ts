/**
 * 模块用途：周期计划的纯函数，负责日期命中、统计、完成和内容块识别。
 * 模块边界：不访问 React、本地存储、Hermes 或飞书。
 */
import type {
  CyclePlan,
  CyclePlanEntry,
  CyclePlanEntryWithPlan,
  CyclePlanStats,
  PlanContentBlock
} from "./cyclePlanTypes";

interface FitnessExercise {
  name: string;
  sets?: Array<{ reps?: number; rir?: number }>;
  note?: string;
}

export interface FitnessExerciseListBlock extends PlanContentBlock {
  kind: "fitness.exercise_list";
  data: {
    exercises: FitnessExercise[];
  };
}

export function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getCycleEntriesForDate(plans: CyclePlan[], dateKey: string): CyclePlanEntryWithPlan[] {
  return plans
    .filter((plan) => plan.status === "active")
    .flatMap((plan) =>
      plan.entries
        .filter(
          (entry) =>
            entry.date === dateKey
            && entry.status !== "candidate"
            && entry.status !== "skipped"
        )
        .map((entry) => ({
          ...entry,
          planTitle: plan.title,
          planTopic: plan.topic
        }))
    );
}

export function getCyclePlanStats(plan: CyclePlan, todayKey: string): CyclePlanStats {
  return {
    totalEntries: plan.entries.length,
    pendingEntries: plan.entries.filter((entry) => entry.status === "pending").length,
    todayHits: plan.entries.filter((entry) => entry.date === todayKey && entry.status !== "skipped").length
  };
}

export function completeCyclePlanEntry(plans: CyclePlan[], entryId: string, now: Date): { plans: CyclePlan[]; entry?: CyclePlanEntry } {
  const timestamp = now.toISOString();
  let completedEntry: CyclePlanEntry | undefined;

  const updatedPlans = plans.map((plan) => {
    let planChanged = false;
    const entries = plan.entries.map((entry) => {
      if (entry.id !== entryId) return entry;

      planChanged = true;
      completedEntry = {
        ...entry,
        status: "completed",
        completedAt: timestamp,
        updatedAt: timestamp
      };
      return completedEntry;
    });

    return planChanged ? { ...plan, entries, updatedAt: timestamp } : plan;
  });

  return { plans: updatedPlans, entry: completedEntry };
}

export function isFitnessExerciseListBlock(block: PlanContentBlock | undefined): block is FitnessExerciseListBlock {
  if (!block || block.kind !== "fitness.exercise_list") return false;
  const exercises = block.data.exercises;
  if (!Array.isArray(exercises)) return false;

  return exercises.every((exercise) => {
    if (!isRecord(exercise) || typeof exercise.name !== "string") return false;
    if (!("sets" in exercise) || exercise.sets === undefined) return true;
    return Array.isArray(exercise.sets);
  });
}

export function formatCyclePlanStatus(status: CyclePlan["status"]): string {
  if (status === "draft") return "草稿";
  if (status === "active") return "进行中";
  if (status === "paused") return "已暂停";
  return "已归档";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
