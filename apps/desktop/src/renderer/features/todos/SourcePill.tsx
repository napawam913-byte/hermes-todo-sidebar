/**
 * 模块用途：统一展示待办来源标签，区分手动、周期任务和 AI 草稿。
 * 模块边界：只负责标签外观，不包含来源转换逻辑。
 */
export type SourcePillLabel = "手动" | "周期任务" | "AI草稿" | "Hermes" | "飞书";

interface SourcePillProps {
  label: SourcePillLabel;
}

const sourceClasses: Record<SourcePillLabel, string> = {
  手动: "source-manual",
  周期任务: "source-cycle",
  AI草稿: "source-ai",
  Hermes: "source-hermes",
  飞书: "source-feishu"
};

export function SourcePill({ label }: SourcePillProps) {
  return <span className={`source-pill ${sourceClasses[label]}`}>{label}</span>;
}
