/**
 * 模块用途：用固定安全文案展示 Plan API 运行状态和浏览器预览边界。
 * 模块边界：不显示连接地址、SSH 目标、Token 或主进程原始消息。
 */
import {
  CircleAlert,
  CloudOff,
  DatabaseZap,
  Monitor,
  RefreshCw
} from "lucide-react";
import type { ComponentType } from "react";
import type { PlanApiRuntimeStatus } from "../../../shared/planApiBridgeContract";

interface DataServiceBannerProps {
  browserPreview: boolean;
  status: PlanApiRuntimeStatus;
  onOpenDataSettings(): void;
}

interface BannerPresentation {
  title: string;
  detail: string;
  tone: "info" | "warning" | "danger";
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  action?: string;
}

export function DataServiceBanner(props: DataServiceBannerProps) {
  const presentation = getPresentation(props.status, props.browserPreview);
  if (!presentation) return null;
  const Icon = presentation.icon;
  return (
    <aside
      aria-live="polite"
      className={`data-service-banner is-${presentation.tone}`}
      role="status"
    >
      <Icon aria-hidden="true" size={17} strokeWidth={1.8} />
      <div>
        <strong>{presentation.title}</strong>
        <span>{presentation.detail}</span>
      </div>
      {presentation.action ? (
        <button onClick={props.onOpenDataSettings} type="button">
          {presentation.action}
        </button>
      ) : null}
    </aside>
  );
}

function getPresentation(
  status: PlanApiRuntimeStatus,
  browserPreview: boolean
): BannerPresentation | null {
  if (browserPreview) {
    return {
      title: "浏览器预览",
      detail: "数据保存在本机浏览器",
      tone: "info",
      icon: Monitor
    };
  }
  if (status.mode === "online") return null;
  if (status.mode === "offline_cache") {
    return {
      title: "数据服务离线",
      detail: "正在显示最近缓存，当前仅可查看",
      tone: "warning",
      icon: CloudOff
    };
  }
  if (status.mode === "connecting") {
    return {
      title: "正在重连数据服务",
      detail: "连接恢复后，写入操作会自动重新启用",
      tone: "info",
      icon: RefreshCw
    };
  }
  if (status.mode === "unconfigured") {
    return {
      title: "数据服务尚未配置",
      detail: "完成连接配置后才能同步和写入",
      tone: "warning",
      icon: DatabaseZap,
      action: "进入数据服务设置"
    };
  }
  return {
    title: status.mode === "migration_blocked" ? "数据迁移已阻塞" : "需要确认数据迁移",
    detail: "请在数据服务设置中检查本地与远端数据",
    tone: status.mode === "migration_blocked" ? "danger" : "warning",
    icon: CircleAlert,
    action: "进入数据服务设置"
  };
}
