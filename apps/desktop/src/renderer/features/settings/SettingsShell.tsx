/**
 * 模块用途：组织宽屏分栏与紧凑双 Tab 的统一设置控制台。
 * 模块边界：只管理设置分区展示，不读写外观配置或模型密钥。
 */
import { DatabaseZap, Palette, PlugZap } from "lucide-react";
import type { ReactNode } from "react";
import type { SettingsSection } from "../sidebar/panelSessionState";
import type { SettingsModelStatus } from "./settingsModelStatus";
import type { DataServiceStatus } from "./dataServicePresentation";

interface SettingsShellProps {
  activeSection: SettingsSection;
  appearance: ReactNode;
  model: ReactNode;
  data: ReactNode;
  modelStatus: SettingsModelStatus;
  dataStatus: DataServiceStatus;
  onSectionChange(section: SettingsSection): void;
}

const sections = [
  { id: "appearance" as const, label: "外观", icon: Palette },
  { id: "model" as const, label: "模型连接", icon: PlugZap },
  { id: "data" as const, label: "数据服务", icon: DatabaseZap }
];

export function SettingsShell(props: SettingsShellProps) {
  return (
    <section className="settings-shell">
      <div className="settings-compact-tabs" aria-label="设置分类" role="navigation">
        {sections.map((section) => renderTab(section, props))}
      </div>
      <div className="settings-console-layout">
        <nav className="settings-sidebar" aria-label="设置分类">
          <p>设置</p>
          {sections.map((section) => renderSidebarItem(section, props))}
        </nav>
        <div className="settings-content">
          <section
            className="settings-pane"
            hidden={props.activeSection !== "appearance"}
          >
            {props.appearance}
          </section>
          <section className="settings-pane" hidden={props.activeSection !== "model"}>
            {props.model}
          </section>
          <section className="settings-pane" hidden={props.activeSection !== "data"}>
            {props.data}
          </section>
        </div>
      </div>
    </section>
  );
}

function renderTab(
  section: (typeof sections)[number],
  props: SettingsShellProps
) {
  const active = props.activeSection === section.id;
  return (
    <button
      aria-current={active ? "page" : undefined}
      className={active ? "is-active" : undefined}
      key={`compact-${section.id}`}
      onClick={() => props.onSectionChange(section.id)}
      type="button"
    >
      {section.label}
    </button>
  );
}

function renderSidebarItem(
  section: (typeof sections)[number],
  props: SettingsShellProps
) {
  const active = props.activeSection === section.id;
  const Icon = section.icon;
  const status = section.id === "model" ? props.modelStatus : props.dataStatus;
  return (
    <button
      aria-current={active ? "page" : undefined}
      aria-label={section.id === "appearance" ? undefined : `${section.label}，${status.label}`}
      className={active ? "settings-nav-item is-active" : "settings-nav-item"}
      key={section.id}
      onClick={() => props.onSectionChange(section.id)}
      type="button"
    >
      <Icon aria-hidden="true" size={16} strokeWidth={1.8} />
      <span>{section.label}</span>
      {section.id !== "appearance" ? (
        <i
          aria-hidden="true"
          className={`settings-status-dot is-${status.tone}`}
        />
      ) : null}
    </button>
  );
}
