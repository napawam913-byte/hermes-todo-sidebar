/**
 * 模块用途：面板顶部主导航，切换今日待办和周期任务。
 * 模块边界：只表达当前模式和切换事件，不读取待办数据。
 */
export type PanelMode = "today" | "cycle";

interface TopModeTabsProps {
  activeMode: PanelMode;
  onModeChange: (mode: PanelMode) => void;
}

const modes: Array<{ key: PanelMode; label: string }> = [
  { key: "today", label: "今日待办" },
  { key: "cycle", label: "周期任务" }
];

export function TopModeTabs({ activeMode, onModeChange }: TopModeTabsProps) {
  return (
    <nav className="top-mode-tabs" aria-label="待办主导航">
      {modes.map((mode) => (
        <button
          className={mode.key === activeMode ? "top-mode-tab is-active" : "top-mode-tab"}
          key={mode.key}
          type="button"
          onClick={() => onModeChange(mode.key)}
        >
          {mode.label}
        </button>
      ))}
    </nav>
  );
}
