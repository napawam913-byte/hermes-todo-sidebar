/** 模块用途：编排托盘的数据目录与当前快照导出；不提供旧 JSON 导入。 */
export interface DataTransferDependencies {
  dataDirectory: string;
  defaultExportPath: string;
  openPath(path: string): Promise<string>;
  exportState(path: string): Promise<void>;
  requestExportPath(defaultPath: string): Promise<string | undefined>;
  showError(message: string): Promise<void>;
  showSuccess(message: string): Promise<void>;
}

export interface DataTransferActions {
  openDataDirectory(): Promise<void>;
  exportData(): Promise<void>;
}

export function createDataTransferActions(dependencies: DataTransferDependencies): DataTransferActions {
  return {
    async openDataDirectory() {
      try {
        const error = await dependencies.openPath(dependencies.dataDirectory);
        if (error) await dependencies.showError(error);
      } catch (error) {
        await dependencies.showError(formatError(error));
      }
    },
    async exportData() {
      try {
        const destination = await dependencies.requestExportPath(dependencies.defaultExportPath);
        if (!destination) return;
        await dependencies.exportState(destination);
        await dependencies.showSuccess("数据已成功导出");
      } catch (error) {
        await dependencies.showError(`导出失败：${formatError(error)}`);
      }
    },
  };
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
