/**
 * 模块用途：组合面板壳层、今日待办、周期任务和本地持久化状态。
 * 模块边界：只管理前端原型状态，不直接访问 Electron 主进程实现细节。
 */
import { useMemo, useState } from "react";
import { createLocalCyclePlanRepository } from "./features/cyclePlans/localCyclePlanRepository";
import { mockCyclePlans } from "./features/cyclePlans/mockCyclePlans";
import { useCyclePlanStore } from "./features/cyclePlans/cyclePlanStore";
import { SidebarShell } from "./features/sidebar/SidebarShell";
import { TodoPanel } from "./features/todos/TodoPanel";
import { createLocalTodoRepository } from "./features/todos/localTodoRepository";
import { mockTodos } from "./features/todos/mockTodos";
import { buildTodayItems } from "./features/todos/todayItems";
import { useTodoStore } from "./features/todos/todoStore";
import type { Todo } from "./features/todos/types";
import { useLocalDateKey } from "./features/todos/useLocalDateKey";

const SOURCE_DEVICE_ID = "desktop-prototype";

function getBrowserStorage() {
  if (typeof window === "undefined") return undefined;

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

const todoRepository = createLocalTodoRepository(getBrowserStorage());
const cyclePlanRepository = createLocalCyclePlanRepository(getBrowserStorage());

export function App() {
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailResetVersion, setDetailResetVersion] = useState(0);
  const [expanded, setExpanded] = useState(true);
  const todayKey = useLocalDateKey();
  const {
    addTodo,
    completeTodo,
    todos
  } = useTodoStore({
    initialTodos: mockTodos,
    repository: todoRepository,
    sourceDeviceId: SOURCE_DEVICE_ID
  });
  const { completeEntry, cyclePlans } = useCyclePlanStore({
    initialPlans: mockCyclePlans,
    repository: cyclePlanRepository
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
      setDetailOpen(false);
      setDetailResetVersion((version) => version + 1);
    }
  }

  return (
    <SidebarShell
      activeCount={activeCount}
      detailOpen={detailOpen}
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
        onDetailOpenChange={setDetailOpen}
      />
    </SidebarShell>
  );
}
