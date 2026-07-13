/**
 * 模块用途：组合面板壳层、今日待办、周期任务和本地持久化状态。
 * 模块边界：只管理前端原型状态，不直接访问 Electron 主进程实现细节。
 */
import { useMemo, useState } from "react";
import type { AppDataBootstrapResult } from "./data/appDataBootstrap";
import { useCyclePlanStore } from "./features/cyclePlans/cyclePlanStore";
import { SidebarShell } from "./features/sidebar/SidebarShell";
import { TodoPanel } from "./features/todos/TodoPanel";
import { buildTodayItems } from "./features/todos/todayItems";
import { useTodoStore } from "./features/todos/todoStore";
import type { Todo } from "./features/todos/types";
import { useLocalDateKey } from "./features/todos/useLocalDateKey";

const SOURCE_DEVICE_ID = "desktop-prototype";

interface AppProps {
  appData: AppDataBootstrapResult;
}

export function App({ appData }: AppProps) {
  const [detailResetVersion, setDetailResetVersion] = useState(0);
  const [expanded, setExpanded] = useState(appData.startExpanded);
  const todayKey = useLocalDateKey();
  const {
    addTodo,
    completeTodo,
    todos
  } = useTodoStore({
    initialTodos: appData.initialTodos,
    repository: appData.todoRepository,
    sourceDeviceId: SOURCE_DEVICE_ID
  });
  const { completeEntry, cyclePlans, upsertPlan } = useCyclePlanStore({
    initialPlans: appData.initialCyclePlans,
    repository: appData.cyclePlanRepository
  });

  const activeCount = useMemo(
    () =>
      buildTodayItems({ todos, cyclePlans, dateKey: todayKey }).filter((item) => item.status === "pending").length,
    [cyclePlans, todayKey, todos]
  );

  function handleAdd(title: string) {
    addTodo(title);
  }

  function handleComplete(todo: Todo) {
    completeTodo(todo);
  }

  function handleExpandedChange(nextExpanded: boolean) {
    setExpanded(nextExpanded);
    if (!nextExpanded) {
      setDetailResetVersion((version) => version + 1);
    }
  }

  return (
    <SidebarShell
      activeCount={activeCount}
      expanded={expanded}
      onExpandedChange={handleExpandedChange}
    >
      <TodoPanel
        cyclePlans={cyclePlans}
        detailResetVersion={detailResetVersion}
        todayKey={todayKey}
        todos={todos}
        onAdd={handleAdd}
        onCompleteCycleEntry={completeEntry}
        onComplete={handleComplete}
        onUpsertCyclePlan={upsertPlan}
      />
    </SidebarShell>
  );
}
