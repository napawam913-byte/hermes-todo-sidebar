/**
 * 模块用途：面板顶部主导航，切换今日待办和周期任务。
 * 模块边界：只表达当前模式和切换事件，不读取待办数据。
 */
import { SegmentedControl } from "../../components/SegmentedControl";

export type PanelMode = "today" | "cycle";

interface TopModeTabsProps {
  activeMode: PanelMode;
  onModeChange: (mode: PanelMode) => void;
}

const modes = [
  { value: "today", label: "今日待办" },
  { value: "cycle", label: "周期任务" }
] satisfies ReadonlyArray<{ value: PanelMode; label: string }>;

export function TopModeTabs({ activeMode, onModeChange }: TopModeTabsProps) {
  return (
    <nav className="top-mode-tabs">
      <SegmentedControl
        ariaLabel="待办主导航"
        options={modes}
        size="regular"
        value={activeMode}
        onChange={onModeChange}
      />
    </nav>
  );
}
