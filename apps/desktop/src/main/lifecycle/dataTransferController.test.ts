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
    importState: vi.fn(async () => undefined),
    requestExportPath: vi.fn(async () => "C:/selected-backup.json" as string | undefined),
    requestImportPath: vi.fn(async () => "C:/import.json" as string | undefined),
    showError: vi.fn(async () => undefined),
    showSuccess: vi.fn(async () => undefined),
    reloadRenderer: vi.fn()
  };
}

describe("createDataTransferActions", () => {
  it("exports and imports selected state files", async () => {
    const dependencies = createDependencies();
    const actions = createDataTransferActions(dependencies);

    await actions.openDataDirectory();
    await actions.exportData();
    await actions.importData();

    expect(dependencies.openPath).toHaveBeenCalledWith("C:/app-data");
    expect(dependencies.exportState).toHaveBeenCalledWith("C:/selected-backup.json");
    expect(dependencies.importState).toHaveBeenCalledWith("C:/import.json");
    expect(dependencies.reloadRenderer).toHaveBeenCalledOnce();
    expect(dependencies.showSuccess).toHaveBeenCalledTimes(2);
  });

  it("does nothing when a file selection is cancelled", async () => {
    const dependencies = createDependencies();
    dependencies.requestExportPath.mockResolvedValue(undefined);
    dependencies.requestImportPath.mockResolvedValue(undefined);
    const actions = createDataTransferActions(dependencies);

    await actions.exportData();
    await actions.importData();

    expect(dependencies.exportState).not.toHaveBeenCalled();
    expect(dependencies.importState).not.toHaveBeenCalled();
    expect(dependencies.reloadRenderer).not.toHaveBeenCalled();
  });
});
