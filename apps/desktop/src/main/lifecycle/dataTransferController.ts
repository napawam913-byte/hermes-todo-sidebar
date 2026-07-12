/**
 * 模块用途：编排托盘中的数据目录、导出和导入流程，并统一成功/错误反馈。
 * 模块边界：通过依赖调用对话框和文件服务，不直接导入 Electron。
 */
export interface DataTransferDependencies {
  dataDirectory: string;
  defaultExportPath: string;
  openPath(path: string): Promise<string>;
  exportState(path: string): Promise<void>;
  importState(path: string): Promise<unknown>;
  requestExportPath(defaultPath: string): Promise<string | undefined>;
  requestImportPath(): Promise<string | undefined>;
  showError(message: string): Promise<void>;
  showSuccess(message: string): Promise<void>;
  reloadRenderer(): void;
}

export interface DataTransferActions {
  openDataDirectory(): Promise<void>;
  exportData(): Promise<void>;
  importData(): Promise<void>;
}

export function createDataTransferActions(
  dependencies: DataTransferDependencies
): DataTransferActions {
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
        const destination = await dependencies.requestExportPath(
          dependencies.defaultExportPath
        );
        if (!destination) return;
        await dependencies.exportState(destination);
        await dependencies.showSuccess("数据已成功导出");
      } catch (error) {
        await dependencies.showError(`导出失败：${formatError(error)}`);
      }
    },
    async importData() {
      try {
        const source = await dependencies.requestImportPath();
        if (!source) return;
        await dependencies.importState(source);
        dependencies.reloadRenderer();
        await dependencies.showSuccess("数据已成功导入");
      } catch (error) {
        await dependencies.showError(`导入失败：${formatError(error)}`);
      }
    }
  };
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
