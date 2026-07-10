/**
 * 模块用途：专用展示 fitness.exercise_list 内容块中的训练动作、组次和 RIR。
 * 模块边界：只理解健身动作列表，不处理其他内容块类型。
 */
import type { FitnessExerciseListBlock } from "./cyclePlanModel";

interface FitnessExerciseBlockProps {
  block: FitnessExerciseListBlock;
}

export function FitnessExerciseBlock({ block }: FitnessExerciseBlockProps) {
  return (
    <section className="content-block fitness-block">
      <h4>{block.title}</h4>
      <div className="fitness-exercise-list">
        {block.data.exercises.map((exercise) => (
          <article className="fitness-exercise" key={exercise.name}>
            <div>
              <strong>{exercise.name}</strong>
              {exercise.note ? <p>{exercise.note}</p> : null}
            </div>
            {exercise.sets ? <span>{formatSets(exercise.sets)}</span> : <span>待补充组次</span>}
          </article>
        ))}
      </div>
    </section>
  );
}

function formatSets(sets: Array<{ reps?: number; rir?: number }>) {
  return sets
    .map((set, index) => {
      const reps = typeof set.reps === "number" ? `${set.reps} 次` : "未定";
      const rir = typeof set.rir === "number" ? `RIR ${set.rir}` : "RIR 待定";
      return `${index + 1}组 ${reps} · ${rir}`;
    })
    .join(" / ");
}
