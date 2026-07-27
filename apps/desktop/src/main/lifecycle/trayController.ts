/** 模块用途：定义托盘菜单；边界：只提供数据目录与当前快照导出。 */
export interface TrayActions {
  show(): void;
  hide(): void;
  openDataDirectory(): void;
  exportData(): void;
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
    { type: "separator" },
    { label: "退出", click: actions.quit },
  ];
}
