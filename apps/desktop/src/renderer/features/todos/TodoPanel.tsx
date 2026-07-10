/**
 * 模块用途：待办面板容器，组织标题栏、主导航、今日待办和周期任务视图。
 * 模块边界：只编排顶层 UI，不直接生成周期任务或调用 Hermes。
 */
import { Settings2 } from "lucide-react";
import { useState } from "react";
import { IconButton } from "../../components/buttons";
import { CyclePlanView } from "../cyclePlans/CyclePlanView";
import type { CyclePlan } from "../cyclePlans/cyclePlanTypes";
import { TodayTodoView } from "./TodayTodoView";
import { TopModeTabs, type PanelMode } from "./TopModeTabs";
import type { Todo } from "./types";

interface TodoPanelProps {
  todos: Todo[];
  cyclePlans: CyclePlan[];
  detailResetVersion: number;
  todayKey: string;
  onAdd: (title: string) => void;
  onComplete: (todo: Todo) => void;
  onCompleteCycleEntry: (entryId: string) => void;
  onDetailOpenChange: (open: boolean) => void;
}

export function TodoPanel(props: TodoPanelProps) {
  const [activeMode, setActiveMode] = useState<PanelMode>("today");

  return (
    <div className="todo-panel">
      <header className="todo-panel-header">
        <div>
          <p className="panel-kicker">第一版桌宠</p>
          <h1>待办事项</h1>
        </div>
        <div className="panel-actions">
          <IconButton icon={<Settings2 size={17} strokeWidth={1.8} />}>打开设置</IconButton>
        </div>
      </header>

      <TopModeTabs activeMode={activeMode} onModeChange={setActiveMode} />

      {activeMode === "today" ? (
        <TodayTodoView
          todos={props.todos}
          cyclePlans={props.cyclePlans}
          dateKey={props.todayKey}
          detailResetVersion={props.detailResetVersion}
          onAdd={props.onAdd}
          onCompleteTodo={props.onComplete}
          onCompleteCycleEntry={props.onCompleteCycleEntry}
          onDetailOpenChange={props.onDetailOpenChange}
        />
      ) : (
        <CyclePlanView
          detailResetVersion={props.detailResetVersion}
          plans={props.cyclePlans}
          todayKey={props.todayKey}
          onDetailOpenChange={props.onDetailOpenChange}
        />
      )}
    </div>
  );
}
