/**
 * 模块用途：展示今日待办的完整只读详情，兼容手动待办和周期任务条目。
 * 模块边界：不修改待办状态，不生成计划，也不调用 Hermes。
 */
import { MoreHorizontal, Pencil } from "lucide-react";
import { DetailPageShell } from "../../components/DetailPageShell";
import { QuietButton } from "../../components/buttons";
import { ContentBlockPreview } from "../cyclePlans/ContentBlockPreview";
import { SyncStatusPill } from "../sync/SyncStatusPill";
import { SourcePill } from "./SourcePill";
import type { TodayItem } from "./todayItems";

interface TodayTodoDetailDrawerProps {
  item: TodayItem;
  onClose: () => void;
  onEdit?: () => void;
  onOpenActions: () => void;
}

export function TodayTodoDetailDrawer(props: TodayTodoDetailDrawerProps) {
  const { item, onClose } = props;
  const completed = item.status === "completed";
  const blocks = item.kind === "cycle"
    ? item.entry.contentBlocks
    : [];
  const description = item.kind === "cycle"
    ? item.entry.contentSummary
    : item.todo.notes;

  return (
    <DetailPageShell label="今日待办详情" title={item.title} onBack={onClose}>
      <section className="todo-detail-summary">
        <div className="todo-detail-summary-row">
          <SourcePill label={item.sourceLabel} />
          <span className={completed ? "todo-detail-status is-completed" : "todo-detail-status"}>
            {completed ? "已完成" : "待处理"}
          </span>
        </div>
        <p>{description || "暂无补充说明"}</p>
      </section>

      <div className="todo-detail-actions">
        {props.onEdit ? (
          <QuietButton icon={<Pencil size={16} />} onClick={props.onEdit}>编辑待办</QuietButton>
        ) : null}
        <QuietButton icon={<MoreHorizontal size={16} />} onClick={props.onOpenActions}>更多操作</QuietButton>
      </div>

      <div className="todo-detail-content">
        <dl className="todo-detail-metadata">
          {item.kind === "cycle" ? (
            <>
              <MetadataRow label="来源计划" value={item.planTitle} />
              <MetadataRow label="主题" value={item.planTopic} />
              <MetadataRow label="日期" value={item.entry.date} />
            </>
          ) : (
            <div className="todo-detail-metadata-row">
              <dt>同步状态</dt>
              <dd><SyncStatusPill status={item.todo.syncStatus} /></dd>
            </div>
          )}
          <MetadataRow label="当前状态" value={completed ? "已完成" : "待处理"} />
        </dl>

        {blocks.length > 0 ? (
          <section className="todo-detail-section">
            <h3>任务内容</h3>
            {blocks.map((block) => (
              <ContentBlockPreview block={block} key={block.id} />
            ))}
          </section>
        ) : (
          <section className="todo-detail-empty">
            <strong>暂无结构化内容</strong>
            <span>这条待办当前只有标题和说明。</span>
          </section>
        )}
      </div>
    </DetailPageShell>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="todo-detail-metadata-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
