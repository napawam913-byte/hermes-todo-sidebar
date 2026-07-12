/**
 * 模块用途：定义 Windows 托盘的中文菜单结构，并把菜单项映射到外部动作。
 * 模块边界：只生成纯菜单模板，不创建 Tray，也不打开系统对话框。
 */
export interface TrayActions {
  show(): void;
  hide(): void;
  openDataDirectory(): void;
  exportData(): void;
  importData(): void;
  quit(): void;
}

export interface TrayMenuItem {
  label?: string;
  type?: "separator";
  click?: () => void;
}

export function createTrayMenuTemplate(actions: TrayActions): TrayMenuItem[] {
  return [
    { label: "打开待办", click: actions.show },
    { label: "隐藏", click: actions.hide },
    { type: "separator" },
    { label: "打开数据目录", click: actions.openDataDirectory },
    { label: "导出数据", click: actions.exportData },
    { label: "导入数据", click: actions.importData },
    { type: "separator" },
    { label: "退出", click: actions.quit }
  ];
}
