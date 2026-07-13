/**
 * 模块用途：提供今日待办与周期计划共用的同面板详情返回页。
 * 模块边界：只负责返回栏、标题和滚动容器，不解释领域数据。
 */
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

interface DetailPageShellProps {
  children: ReactNode;
  label: string;
  title: string;
  onBack: () => void;
}

export function DetailPageShell({ children, label, onBack, title }: DetailPageShellProps) {
  return (
    <section className="detail-page" aria-label={`${title}详情页`}>
      <header className="detail-page-header">
        <button
          className="detail-page-back"
          type="button"
          aria-label={`返回${label.replace("详情", "列表")}`}
          onClick={onBack}
        >
          <ArrowLeft size={17} strokeWidth={1.9} aria-hidden="true" />
          <span>返回</span>
        </button>
        <div>
          <p>{label}</p>
          <h2>{title}</h2>
        </div>
      </header>
      <div className="detail-page-body">{children}</div>
    </section>
  );
}
