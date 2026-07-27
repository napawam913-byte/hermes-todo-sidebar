/**
 * 模块用途：在同一 DOM 中组织始终存在的主列表和可选详情。
 * 模块边界：只提供响应式结构，不管理选择状态或业务操作。
 */
import type { ReactNode } from "react";

interface ResponsiveMasterDetailProps {
  master: ReactNode;
  detail?: ReactNode;
  className?: string;
}

export function ResponsiveMasterDetail({
  className,
  detail,
  master
}: ResponsiveMasterDetailProps) {
  const classes = [
    "responsive-master-detail",
    detail ? "has-detail" : "is-master-only",
    className
  ].filter(Boolean).join(" ");

  return (
    <div className={classes} data-testid="master-detail">
      <div className="responsive-master-detail-layout">
        <div className="responsive-master-pane" data-testid="master-pane">
          {master}
        </div>
        {detail ? (
          <div className="responsive-detail-pane" data-testid="detail-pane">
            {detail}
          </div>
        ) : null}
      </div>
    </div>
  );
}
