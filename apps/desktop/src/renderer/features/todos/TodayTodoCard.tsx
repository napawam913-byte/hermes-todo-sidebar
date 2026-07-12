/**
 * 模块用途：展示今日待办中的单条项目，兼容手动待办和周期计划条目。
 * 模块边界：只渲染列表项、详情入口和完成动作，不持有抽屉状态。
 */
import { Check, ChevronRight, MoreHorizontal } from "lucide-react";
import { IconButton } from "../../components/buttons";
import { SyncStatusPill } from "../sync/SyncStatusPill";
import { SourcePill } from "./SourcePill";
import type { TodayItem } from "./todayItems";

interface TodayTodoCardProps {
  item: TodayItem;
  onComplete: () => void;
  onOpen: () => void;
  selected: boolean;
}

export function TodayTodoCard({ item, onComplete, onOpen, selected }: TodayTodoCardProps) {
  const completed = item.status === "completed";
  const classes = [
    "today-todo-card",
    completed ? "is-completed" : "",
    item.isOverdue ? "is-overdue" : "",
    selected ? "is-selected" : ""
  ].filter(Boolean).join(" ");

  return (
    <article className={classes} role="listitem">
      <button
        aria-label={`查看${item.title}详情`}
        aria-pressed={selected}
        className="today-todo-open"
        type="button"
        onClick={onOpen}
      >
        <span className="todo-item-status" aria-hidden="true" />
        <div className="today-todo-main">
          <div className="today-todo-title-row">
            <h2>{item.title}</h2>
            <div className="today-todo-title-trailing">
              <SourcePill label={item.sourceLabel} />
              <ChevronRight className="today-todo-chevron" size={16} strokeWidth={1.8} />
            </div>
          </div>
          {item.summary ? <p>{item.summary}</p> : null}
          <div className="todo-item-meta">
            {item.isOverdue ? <span className="overdue-pill">逾期 · {item.date}</span> : null}
            {item.kind === "manual" ? <SyncStatusPill status={item.todo.syncStatus} /> : <span>{item.planTopic}</span>}
          </div>
        </div>
      </button>
      <div className="todo-item-actions">
        <IconButton
          disabled={completed}
          icon={<Check size={17} strokeWidth={1.8} />}
          onClick={onComplete}
        >
          标记完成
        </IconButton>
        <IconButton icon={<MoreHorizontal size={17} strokeWidth={1.8} />}>更多操作</IconButton>
      </div>
    </article>
  );
}
