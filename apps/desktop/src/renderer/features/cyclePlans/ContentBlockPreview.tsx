/**
 * 模块用途：展示周期计划条目的内容块，已知类型走专用组件，未知类型走通用预览。
 * 模块边界：只负责只读回显，不编辑 JSON 内容。
 */
import { isFitnessExerciseListBlock } from "./cyclePlanModel";
import { FitnessExerciseBlock } from "./FitnessExerciseBlock";
import type { PlanContentBlock } from "./cyclePlanTypes";

interface ContentBlockPreviewProps {
  block: PlanContentBlock;
}

export function ContentBlockPreview({ block }: ContentBlockPreviewProps) {
  if (isFitnessExerciseListBlock(block)) {
    return <FitnessExerciseBlock block={block} />;
  }

  if (block.format === "markdown" && typeof block.data.markdown === "string") {
    return (
      <section className="content-block">
        <h4>{block.title}</h4>
        <pre>{block.data.markdown}</pre>
      </section>
    );
  }

  return (
    <section className="content-block">
      <div className="content-block-header">
        <h4>{block.title}</h4>
        <span>{block.kind}</span>
      </div>
      <pre>{JSON.stringify(block.data, null, 2)}</pre>
    </section>
  );
}
