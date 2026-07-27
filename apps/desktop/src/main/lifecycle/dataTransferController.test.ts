/**
 * 模块用途：验证托盘数据命令的取消、导出、导入和 renderer 重载顺序。
 * 模块边界：使用依赖替身，不显示真实 Windows 文件对话框。
 */
import { describe, expect, it, vi } from "vitest";
import { createDataTransferActions } from "./dataTransferController.js";

function createDependencies() {
  return {
    dataDirectory: "C:/app-data",
    defaultExportPath: "C:/backup.json",
    openPath: vi.fn(async () => ""),
    exportState: vi.fn(async () => undefined),
    requestExportPath: vi.fn(async () => "C:/selected-backup.json" as string | undefined),
    showError: vi.fn(async () => undefined),
    showSuccess: vi.fn(async () => undefined),
  };
}

describe("createDataTransferActions", () => {
  it("exports selected snapshots without a legacy import action", async () => {
    const dependencies = createDependencies();
    const actions = createDataTransferActions(dependencies);

    await actions.openDataDirectory();
    await actions.exportData();

    expect(dependencies.openPath).toHaveBeenCalledWith("C:/app-data");
    expect(dependencies.exportState).toHaveBeenCalledWith("C:/selected-backup.json");
    expect(actions).not.toHaveProperty("importData");
    expect(dependencies.showSuccess).toHaveBeenCalledOnce();
  });

  it("does nothing when a file selection is cancelled", async () => {
    const dependencies = createDependencies();
    dependencies.requestExportPath.mockResolvedValue(undefined);
    const actions = createDataTransferActions(dependencies);

    await actions.exportData();

    expect(dependencies.exportState).not.toHaveBeenCalled();
  });
});
