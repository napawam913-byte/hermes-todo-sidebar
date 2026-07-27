/**
 * 模块用途：展示模型可见的数据范围，并提供宽屏收起和紧凑展开状态。
 * 模块边界：只说明上下文，不读取待办数据或触发模型调用。
 */
// [待删除-2026-07-17]
// 原用途：AI 对话页固定右侧任务上下文栏及紧凑详情。
// 替代方案：AiScopePopover 仅在用户需要时展示可读的操作范围说明。
// 删除条件：用户确认全宽单栏对话稳定后再删除本文件。
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { IconButton } from "../../components/buttons";
import type { AiLaunchPresentation } from "./aiPlannerLaunchContext";

interface AiTaskContextProps {
  collapsed: boolean;
  presentation: AiLaunchPresentation;
  onToggle(): void;
}

export function AiTaskContext(props: AiTaskContextProps) {
  return (
    <aside className={`ai-context-column${props.collapsed ? " is-collapsed" : ""}`}>
      <div className="ai-context-toolbar">
        <strong>{props.collapsed ? "" : "任务上下文"}</strong>
        <IconButton
          icon={props.collapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
          onClick={props.onToggle}
        >
          {props.collapsed ? "展开任务上下文" : "收起任务上下文"}
        </IconButton>
      </div>
      <div className="ai-context-content">
        <p>本次操作目标</p>
        <h3>{props.presentation.contextLabel}</h3>
        <div className="ai-context-card">
          <strong>待办与周期计划</strong>
          <span>包含 ID、标题、日期、状态、内容块和 updatedAt，用于生成可校验变更。</span>
        </div>
        <small>模型不会接收 API Key，也不能绕过确认直接写入。</small>
      </div>
    </aside>
  );
}

export function AiCompactTaskContext({ presentation }: {
  presentation: AiLaunchPresentation;
}) {
  return (
    <details className="ai-context-compact">
      <summary>任务上下文 · {presentation.contextLabel}</summary>
      <p>模型会接收当前待办和周期计划，但不会接收 API Key；所有写入仍需确认。</p>
    </details>
  );
}
