/**
 * 模块用途：验证数据服务设置只展示公开状态及迁移的可操作说明。
 * 模块边界：不发起连接、保存或迁移请求。
 */
import { describe, expect, it } from "vitest";
import { getDataServiceStatus, getMigrationPresentation } from "./dataServicePresentation";

describe("dataServicePresentation", () => {
  it("maps saved, online and failure states without exposing connection details", () => {
    expect(getDataServiceStatus({
      status: { mode: "unconfigured", canMutate: false, cacheAvailable: false, message: "未配置" },
      configured: false,
      testResult: null
    })).toEqual({ label: "未配置", tone: "unconfigured" });
    expect(getDataServiceStatus({
      status: { mode: "offline_cache", canMutate: false, cacheAvailable: true, message: "离线" },
      configured: true,
      testResult: null
    })).toEqual({ label: "离线", tone: "unconfigured" });
    expect(getDataServiceStatus({
      status: { mode: "online", canMutate: true, cacheAvailable: true, message: "在线" },
      configured: true,
      testResult: { ok: true, message: "连接成功", apiVersion: 1, serverRevision: 7 }
    })).toEqual({ label: "连接正常", tone: "success" });
    expect(getDataServiceStatus({
      status: { mode: "migration_blocked", canMutate: false, cacheAvailable: true, message: "阻止" },
      configured: true,
      testResult: null
    })).toEqual({ label: "迁移受阻", tone: "failure" });
  });

  it("describes every real migration inspection state", () => {
    expect(getMigrationPresentation({ status: "ready", taskCount: 2, entryCount: 5 })).toMatchObject({
      title: "发现本地数据", action: "确认迁移", canKeepRemote: false
    });
    expect(getMigrationPresentation({ status: "pending" })).toMatchObject({
      title: "迁移尚未完成", action: "继续迁移", busy: false
    });
    expect(getMigrationPresentation({
      status: "completed",
      record: { schemaVersion: 1, status: "completed", sourceUpdatedAt: "", sourceFingerprint: "", backupPath: "backup", idempotencyKey: "", importedTaskCount: 2, importedEntryCount: 5, baselineRevision: 3 }
    })).toMatchObject({ title: "迁移已完成", detail: "已导入 2 个任务和 5 个条目，已保留备份" });
    expect(getMigrationPresentation({
      status: "skipped",
      record: { schemaVersion: 1, status: "skipped", sourceUpdatedAt: "", sourceFingerprint: "", backupPath: "backup", idempotencyKey: "", importedTaskCount: 0, importedEntryCount: 0, baselineRevision: 3 }
    })).toMatchObject({ title: "已保留云端数据", detail: "已导入 0 个任务和 0 个条目，已保留备份" });
    expect(getMigrationPresentation({ status: "blocked", reason: "remote_not_empty" })).toMatchObject({
      title: "迁移需要确认", tone: "failure", canKeepRemote: true
    });
  });
});
