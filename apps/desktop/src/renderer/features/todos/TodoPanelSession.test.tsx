// @vitest-environment jsdom
/**
 * 模块用途：验证今日、周期和 AI 工作面保持挂载，以保留各自会话草稿。
 * 模块边界：使用内存桥接，不执行网络、真实 IPC 或磁盘写入。
 */
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../App";
import type { AppDataBootstrapResult, PlanApiRendererBridge } from "../../data/appDataBootstrap";
import type { PlanApiRuntimeStatus, PlanApiSnapshotEnvelope } from "../../../shared/planApiBridgeContract";
import { mockCyclePlans } from "../cyclePlans/mockCyclePlans";
import { createTestCharacterPack } from "../sidebar/testCharacterPack";
import { mockTodos } from "./mockTodos";
import { TodoPanel } from "./TodoPanel";

describe("TodoPanel session surfaces", () => {
  afterEach(() => { delete window.hermesAi; vi.unstubAllGlobals(); });

  it("keeps all work surfaces mounted while one surface is active", () => {
    vi.stubGlobal("window", {});
    const html = renderToStaticMarkup(
      <TodoPanel
        characterId="penguin-todo"
        characters={[penguinPack]}
        cyclePlans={mockCyclePlans}
        collapseVersion={0}
        browserPreview
        dataService={previewController}
        mutationBusy={false}
        mutationError={null}
        panelOpacity={86}
        readOnly={false}
        todayKey="2026-07-17"
        todos={mockTodos}
        onAiStateApplied={() => undefined}
        onCharacterChange={() => undefined}
        onDismissMutationError={() => undefined}
        onManualMutate={async () => true}
        onPanelOpacityChange={() => undefined}
      />
    );

    expect(html).toContain("添加一个待办");
    expect(html).toContain("AI 生成周期任务");
    expect(html).toContain('class="settings-shell"');
    expect(html).toContain("模型连接");
    expect(html).toContain("保存配置");
    expect(html).not.toContain("桌宠设置");
    expect(html).not.toContain("第一版桌宠");
    expect(html).not.toContain('class="todo-summary"');
    expect(html).not.toContain('aria-label="今日待办摘要"');
    expect(html).toContain('aria-label="今日待办筛选"');
    expect(html).toContain("浏览器预览 / 桌面连接尚未接入");
    expect(html).not.toContain('name="baseUrl"');
  });

  it("hydrates a snapshot without remounting TodoPanel or the active AI session", async () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
    installConfiguredAiBridge();
    const remote = createPlanBridge();
    const appData: AppDataBootstrapResult = {
      initialTodos: mockTodos,
      initialCyclePlans: mockCyclePlans,
      initialDataStatus: onlineStatus,
      mutationGateway: { canMutate: () => true, execute: vi.fn(async () => ({
        todos: mockTodos, cyclePlans: mockCyclePlans
      })) },
      planApiBridge: remote.bridge,
      startExpanded: true
    };
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => { root.render(<App appData={appData} />); });
    expect(container.querySelector<HTMLInputElement>(".quick-add input")?.disabled).toBe(false);
    await act(async () => remote.emitStatus(offlineStatus));
    expect(container.querySelector<HTMLInputElement>(".quick-add input")?.disabled).toBe(true);
    expect(container.textContent).toContain("当前仅可查看");
    await act(async () => remote.emitStatus(onlineStatus));
    expect(container.querySelector<HTMLInputElement>(".quick-add input")?.disabled).toBe(false);
    expect(container.querySelector('input[name="baseUrl"]')).not.toBeNull();
    expect(container.textContent).not.toContain("桌面连接尚未接入");
    await clickButton(container, "周期任务");
    await clickButton(container, "AI 生成周期任务");
    await act(async () => { await Promise.resolve(); });
    const panelBefore = requiredElement(container, ".todo-panel");
    const aiBefore = requiredElement(container, ".ai-planner-view");
    const composerBefore = requiredElement(container, ".ai-composer-dock textarea");

    const nextPlan = {
      ...mockCyclePlans[0],
      title: "事件周期计划",
      source: { type: "feishu" as const, externalId: "remote-plan" },
      entries: [{
        ...mockCyclePlans[0].entries[0],
        source: { type: "ai_draft" as const, proposalId: "remote-entry" }
      }]
    };
    await act(async () => {
      remote.emit({
        todos: [{
          ...mockTodos[0],
          title: "事件待办",
          source: { type: "hermes", externalId: "remote-todo" }
        }],
        cyclePlans: [nextPlan],
        status: onlineStatus
      });
    });

    expect(container.textContent).toContain("事件待办");
    expect(container.textContent).toContain("事件周期计划");
    expect(requiredElement(container, ".todo-panel")).toBe(panelBefore);
    expect(requiredElement(container, ".ai-planner-view")).toBe(aiBefore);
    expect(requiredElement(container, ".ai-composer-dock textarea")).toBe(composerBefore);
    await act(async () => root.unmount());
  });

  it("loads the banner stylesheet directly and never registers snapshot reload", () => {
    const source = readFileSync(
      "apps/desktop/src/renderer/main.tsx", "utf8"
    );
    expect(source).toContain('import "./styles/data-service-banner.css"');
    expect(source).not.toContain("window.location.reload");
  });
});

const penguinPack = createTestCharacterPack();
const onlineStatus: PlanApiRuntimeStatus = {
  mode: "online", canMutate: true, message: "数据服务已连接",
  cacheAvailable: true, serverRevision: 9
};
const offlineStatus: PlanApiRuntimeStatus = {
  ...onlineStatus, mode: "offline_cache", canMutate: false
};
const previewController = {
  status: onlineStatus, config: null, migration: null, busy: false, error: null,
  refreshConfig: async () => undefined,
  refreshMigration: async () => undefined,
  testConnection: async () => ({ ok: false as const, message: "预览" }),
  saveConnection: async () => false,
  migrateLegacyState: async () => false,
  keepRemoteData: async () => false
};

function createPlanBridge() {
  const listeners = new Set<(snapshot: PlanApiSnapshotEnvelope) => void>();
  const statusListeners = new Set<(status: PlanApiRuntimeStatus) => void>();
  const bridge: PlanApiRendererBridge = {
    loadState: async () => ({ todos: mockTodos, cyclePlans: mockCyclePlans, status: onlineStatus }),
    executeMutations: vi.fn(),
    onSnapshotChanged(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getConfig: async () => ({
      schemaVersion: 1, configured: true, mode: "local",
      baseUrl: "http://127.0.0.1:8743", sshTarget: "",
      localPort: 8743, remotePort: 8743, tokenConfigured: true, tokenHint: "…token"
    }),
    testConnection: vi.fn(),
    saveConnection: vi.fn(),
    inspectMigration: async () => ({ status: "pending" }),
    migrateLegacyState: vi.fn(),
    keepRemoteData: vi.fn(),
    onStatusChanged(listener) {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    }
  };
  return {
    bridge,
    emitStatus: (status: PlanApiRuntimeStatus) =>
      statusListeners.forEach((listener) => listener(status)),
    emit: (snapshot: PlanApiSnapshotEnvelope) =>
      listeners.forEach((listener) => listener(snapshot))
  };
}

function installConfiguredAiBridge() {
  window.hermesAi = {
    getConfig: async () => ({
      configured: true, baseUrl: "https://model.example/v1",
      model: "test-model", maskedApiKey: "sk-***"
    }),
    getConfigDraft: async () => null,
    saveConfigDraft: async () => undefined,
    clearConfigDraft: async () => undefined,
    saveConfig: async () => ({
      configured: true, baseUrl: "https://model.example/v1",
      model: "test-model", maskedApiKey: "sk-***"
    }),
    testConnection: async () => ({
      ok: true, message: "连接成功",
      provider: "openai-compatible", cyclePlanExtension: "unknown"
    }),
    generate: async () => ({ status: "message", message: "ok" }),
    execute: async () => ({
      status: "failed", code: "validation_failed", message: "not used"
    }),
    discard: async () => true
  };
}

async function clickButton(container: HTMLElement, label: string) {
  const button = [...container.querySelectorAll("button")]
    .find((candidate) => candidate.textContent?.trim() === label);
  if (!button) throw new Error(`找不到按钮：${label}`);
  await act(async () => button.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

function requiredElement(container: HTMLElement, selector: string): Element {
  const element = container.querySelector(selector);
  if (!element) throw new Error(`找不到元素：${selector}`);
  return element;
}
