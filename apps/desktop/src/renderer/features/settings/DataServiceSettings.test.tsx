// @vitest-environment jsdom
/**
 * 模块用途：验证数据服务表单只提交当前输入，并展示真实迁移检查结果。
 * 模块边界：使用内存控制器，不调用 preload、网络或磁盘。
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PlanApiConnectionTestResult } from "../../../shared/planApiBridgeContract";
import type { PlanApiDataServiceController } from "../../data/usePlanApiDataService";
import { DataServiceSettings } from "./DataServiceSettings";

function controller(overrides: Partial<PlanApiDataServiceController> = {}) {
  return {
    status: { mode: "offline_cache", canMutate: false, cacheAvailable: true, message: "离线" },
    config: {
      schemaVersion: 1, configured: true, mode: "local", baseUrl: "http://127.0.0.1:8743",
      sshTarget: "", localPort: 8743, remotePort: 8743, tokenConfigured: true, tokenHint: "...9f2a"
    },
    migration: { status: "ready", taskCount: 2, entryCount: 5 },
    busy: false,
    error: null,
    refreshConfig: vi.fn(async () => undefined),
    refreshMigration: vi.fn(async () => undefined),
    testConnection: vi.fn(async () => ({ ok: true as const, message: "连接成功", apiVersion: 1 as const, serverRevision: 7 })),
    saveConnection: vi.fn(async () => true),
    migrateLegacyState: vi.fn(async () => true),
    keepRemoteData: vi.fn(async () => true),
    ...overrides
  } satisfies PlanApiDataServiceController;
}

describe("DataServiceSettings", () => {
  it("renders local fields, password token and only public status", () => {
    const html = renderToStaticMarkup(<DataServiceSettings dataService={controller()} />);

    expect(html).toContain("本地直连");
    expect(html).toContain("云端 SSH");
    expect(html).toContain('name="baseUrl"');
    expect(html).toContain('name="desktopToken"');
    expect(html).toContain('type="password"');
    expect(html).toContain("...9f2a");
    expect(html).not.toContain('value="top-secret"');
    expect(html).toContain("确认迁移");
    expect(html).not.toContain("数据管理");
  });

  it("clears a submitted token while save is pending and keeps non-secret drafts after failure", async () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    let finishSave: (saved: boolean) => void = () => { throw new Error("保存尚未开始"); };
    const saveConnection = vi.fn((_input) => new Promise<boolean>((resolve) => { finishSave = resolve; }));
    const dataService = controller({ saveConnection });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => { root.render(<DataServiceSettings dataService={dataService} />); });
    const findButton = (text: string) => Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === text);
    const setValue = async (name: string, value: string) => {
      const input = container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
      if (!input) throw new Error(`缺少 ${name}`);
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    };

    await act(async () => { findButton("云端 SSH")?.click(); });
    expect(container.querySelector('input[name="sshTarget"]')).not.toBeNull();
    expect(container.querySelector('input[name="baseUrl"]')).toBeNull();
    await setValue("sshTarget", "ops@cloud.example");
    await act(async () => { findButton("测试连接")?.click(); });
    expect(dataService.testConnection).toHaveBeenLastCalledWith(expect.objectContaining({ mode: "ssh" }));
    expect(container.textContent).toContain("已保存连接模式");
    expect(container.textContent).toContain("本次测试模式");
    expect(container.textContent).toContain("云端 SSH");
    expect(container.textContent).toContain("本次测试版本");
    expect(container.textContent).toContain("#7");
    await act(async () => { findButton("本地直连")?.click(); });
    await act(async () => { findButton("测试连接")?.click(); });
    expect(dataService.testConnection).toHaveBeenCalledTimes(2);
    expect(dataService.testConnection).toHaveBeenLastCalledWith(expect.objectContaining({ mode: "local" }));
    expect(dataService.saveConnection).not.toHaveBeenCalled();
    expect(container.textContent).toContain("连接成功");
    await setValue("baseUrl", "http://127.0.0.1:9000");
    expect(container.textContent).not.toContain("连接成功");
    await setValue("desktopToken", "top-secret");
    expect(findButton("保存连接")?.disabled).toBe(false);
    await act(async () => {
      findButton("保存连接")?.click();
      await Promise.resolve();
    });
    expect(dataService.saveConnection).toHaveBeenLastCalledWith(expect.objectContaining({
      baseUrl: "http://127.0.0.1:9000", desktopToken: "top-secret"
    }));
    expect(container.querySelector<HTMLInputElement>('input[name="desktopToken"]')?.value).toBe("");
    expect(container.querySelector<HTMLInputElement>('input[name="baseUrl"]')?.value).toBe("http://127.0.0.1:9000");
    await act(async () => {
      finishSave(false);
      await Promise.resolve();
    });
    expect(container.querySelector<HTMLInputElement>('input[name="desktopToken"]')?.value).toBe("");
    expect(container.querySelector<HTMLInputElement>('input[name="baseUrl"]')?.value).toBe("http://127.0.0.1:9000");
    expect(dataService.saveConnection).toHaveBeenCalledOnce();
    await act(async () => { findButton("确认迁移")?.click(); });
    expect(dataService.migrateLegacyState).not.toHaveBeenCalled();
    expect(container.textContent).toContain("再次确认迁移");
    await act(async () => {
      findButton("再次确认迁移")?.click();
      await Promise.resolve();
    });
    expect(dataService.migrateLegacyState).toHaveBeenCalledOnce();
    await act(async () => { root.unmount(); });
    container.remove();
  });

  it("invalidates a delayed test after edits and blocks duplicate requests", async () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    let resolveTest: (result: PlanApiConnectionTestResult) => void = () => { throw new Error("测试尚未开始"); };
    const delayedTest = vi.fn((_input): Promise<PlanApiConnectionTestResult> => new Promise((resolve) => { resolveTest = resolve; }));
    const dataService = controller({ testConnection: delayedTest });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => { root.render(<DataServiceSettings dataService={dataService} />); });
    const testButton = () => Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "测试连接");
    const input = container.querySelector<HTMLInputElement>('input[name="baseUrl"]');
    if (!input) throw new Error("缺少 Base URL");

    await act(async () => { testButton()?.click(); });
    expect(testButton()?.disabled).toBe(true);
    await act(async () => { testButton()?.click(); });
    expect(dataService.testConnection).toHaveBeenCalledOnce();
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "http://127.0.0.1:9000");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(testButton()?.disabled).toBe(true);
    await act(async () => { testButton()?.click(); });
    expect(dataService.testConnection).toHaveBeenCalledOnce();
    resolveTest({ ok: true, message: "过期成功", apiVersion: 1, serverRevision: 99 });
    await act(async () => { await Promise.resolve(); });
    expect(container.textContent).not.toContain("过期成功");
    expect(container.textContent).not.toContain("#99");
    await act(async () => { root.unmount(); });
    container.remove();
  });

  it("renders pending, complete, skipped and blocked migration states and read-only preview", () => {
    const pending = renderToStaticMarkup(<DataServiceSettings dataService={controller({ migration: { status: "pending" } })} />);
    const completed = renderToStaticMarkup(<DataServiceSettings dataService={controller({ migration: { status: "completed", record: migrationRecord("completed") } })} />);
    const skipped = renderToStaticMarkup(<DataServiceSettings dataService={controller({ migration: { status: "skipped", record: migrationRecord("skipped") } })} />);
    const blocked = renderToStaticMarkup(<DataServiceSettings dataService={controller({ migration: { status: "blocked", reason: "remote_not_empty" } })} />);
    const preview = renderToStaticMarkup(<DataServiceSettings />);

    expect(pending).toContain("正在恢复迁移");
    expect(pending).not.toContain("确认迁移");
    expect(completed).toContain("迁移已完成");
    expect(skipped).toContain("已保留云端数据");
    expect(blocked).toContain("保留云端数据");
    expect(preview).toContain("浏览器预览 / 桌面连接尚未接入");
    expect(preview).toContain("只读");
  });
});

function migrationRecord(status: "completed" | "skipped") {
  return {
    schemaVersion: 1 as const, status, sourceUpdatedAt: "", sourceFingerprint: "", backupPath: "backup",
    idempotencyKey: "", importedTaskCount: 2, importedEntryCount: 5, baselineRevision: 3
  };
}
