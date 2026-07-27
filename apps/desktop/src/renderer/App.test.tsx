// @vitest-environment jsdom
/** 验证顶层订阅外部快照并 hydrate 当前工作区，而不刷新 renderer。 */
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { PlanApiRuntimeStatus, PlanApiSnapshotEnvelope } from "../shared/planApiBridgeContract";
import type { AppDataBootstrapResult, PlanApiRendererBridge } from "./data/appDataBootstrap";
import { mockCyclePlans } from "./features/cyclePlans/mockCyclePlans";
import { mockTodos } from "./features/todos/mockTodos";

const todoPanelProbe = vi.hoisted(() => ({ mounts: 0 }));

vi.mock("./features/appearance/useAppearanceSettings", () => ({
  useAppearanceSettings: () => ({ characterId: "penguin-todo", panelOpacity: 86, setCharacterId: vi.fn(), setPanelOpacity: vi.fn() })
}));
vi.mock("./features/sidebar/PetActivityContext", () => ({
  usePetActivity: () => ({ beginWorking: () => () => undefined, celebrate: vi.fn(), fail: vi.fn(), remind: vi.fn() })
}));
vi.mock("./features/sidebar/usePetReminderSignals", () => ({ usePetReminderSignals: () => undefined }));
vi.mock("./features/sidebar/SidebarShell", () => ({ SidebarShell: ({ children }: { children: unknown }) => <>{children}</> }));
vi.mock("./features/todos/TodoPanel", async () => {
  const { useState } = await import("react");
  return {
    TodoPanel: ({ todos, cyclePlans, dataService }: { todos: { id: string }[]; cyclePlans: { id: string }[]; dataService?: unknown }) => {
      const [session] = useState(() => `session-${++todoPanelProbe.mounts}`);
      return <output data-cycles={cyclePlans.map((plan) => plan.id).join(",")} data-service={String(Boolean(dataService))} data-session={session} data-todos={todos.map((todo) => todo.id).join(",")} />;
    }
  };
});

import { App } from "./App";

const status: PlanApiRuntimeStatus = { mode: "online", canMutate: true, message: "已连接", cacheAvailable: true };

function bridge() {
  const snapshotListeners = new Set<(snapshot: PlanApiSnapshotEnvelope) => void>();
  const port = {
    loadState: vi.fn(async () => ({ todos: mockTodos, cyclePlans: mockCyclePlans, status })),
    executeMutations: vi.fn(),
    onSnapshotChanged(listener: (snapshot: PlanApiSnapshotEnvelope) => void) {
      snapshotListeners.add(listener);
      return () => snapshotListeners.delete(listener);
    },
    getConfig: vi.fn(async () => ({ configured: false, schemaVersion: 1 as const, mode: "local" as const, baseUrl: "", sshTarget: "", localPort: 0, remotePort: 0, tokenConfigured: false, tokenHint: "" })),
    testConnection: vi.fn(), saveConnection: vi.fn(), inspectMigration: vi.fn(), migrateLegacyState: vi.fn(), keepRemoteData: vi.fn(),
    onStatusChanged: vi.fn(() => () => undefined)
  } satisfies PlanApiRendererBridge;
  return { port, emit: (snapshot: PlanApiSnapshotEnvelope) => snapshotListeners.forEach((listener) => listener(snapshot)) };
}

describe("App external snapshot lifecycle", () => {
  it("hydrates external snapshots without reloading and passes data service to the work surface", async () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const fake = bridge();
    const appData = {
      initialTodos: mockTodos,
      initialCyclePlans: mockCyclePlans,
      initialDataStatus: status,
      mutationGateway: {
        canMutate: () => true,
        execute: async () => ({ todos: mockTodos, cyclePlans: mockCyclePlans, status })
      },
      planApiBridge: fake.port,
      startExpanded: false
    } satisfies AppDataBootstrapResult;
    const container = document.createElement("div");
    const root = createRoot(container);
    todoPanelProbe.mounts = 0;
    await act(async () => { root.render(<App appData={appData} />); });
    const initialSession = container.querySelector("output")?.dataset.session;
    await act(async () => { fake.emit({ todos: [{ ...mockTodos[0], id: "todo_remote" }], cyclePlans: [{ ...mockCyclePlans[0], id: "plan_remote" }], status }); });
    const output = container.querySelector("output");
    expect(output?.dataset.todos).toBe("todo_remote");
    expect(output?.dataset.cycles).toBe("plan_remote");
    expect(output?.dataset.service).toBe("true");
    expect(output?.dataset.session).toBe(initialSession);
    expect(todoPanelProbe.mounts).toBe(1);
    const reloadExpression = ["window", "location", "reload"].join(".");
    expect(readFileSync("apps/desktop/src/renderer/main.tsx", "utf8")).not.toContain(reloadExpression);
    const appSource = readFileSync("apps/desktop/src/renderer/App.tsx", "utf8");
    expect(appSource).toContain("usePlanApiDataService");
    expect(appSource).toContain("dataService={dataService}");
  });
});
