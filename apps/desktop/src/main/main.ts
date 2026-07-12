/**
 * 模块用途：Electron 主进程入口，装配桌宠窗口、中文托盘和本地应用状态服务。
 * 模块边界：只负责桌面能力编排，不解释待办与周期计划的领域字段。
 */
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  shell,
  Tray,
  type MenuItemConstructorOptions
} from "electron";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { configureLaunchAtLogin, ensureSingleInstance } from "./lifecycle/appLifecycle.js";
import { createDataTransferActions } from "./lifecycle/dataTransferController.js";
import { createTrayMenuTemplate } from "./lifecycle/trayController.js";
import { calculateSidebarBounds, DESKTOP_PET_HEIGHT, DESKTOP_PET_WIDTH } from "./sidebarBounds.js";
import { AppStateFileStore } from "./storage/appStateFileStore.js";
import { AppStateService } from "./storage/appStateService.js";
import { registerStorageIpc } from "./storage/storageIpc.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;
const rendererDevUrl = process.env.HERMES_RENDERER_URL ?? "http://127.0.0.1:5178";
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let sidebarExpanded = false;
let sidebarDetailOpen = false;
let isQuitting = false;

function positionSidebar(window: BrowserWindow) {
  window.setBounds(calculateSidebarBounds({
    expanded: sidebarExpanded,
    detailOpen: sidebarDetailOpen,
    workArea: screen.getPrimaryDisplay().workArea
  }));
}

function showSidebar() {
  mainWindow?.show();
  mainWindow?.focus();
  mainWindow?.webContents.send("sidebar:expand-requested");
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: DESKTOP_PET_WIDTH,
    minWidth: DESKTOP_PET_WIDTH,
    height: DESKTOP_PET_HEIGHT,
    minHeight: DESKTOP_PET_HEIGHT,
    frame: false,
    resizable: false,
    movable: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    title: "Hermes 待办桌宠",
    backgroundColor: "#00000000",
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  positionSidebar(mainWindow);
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("blur", () => mainWindow?.webContents.send("sidebar:collapse-requested"));
  mainWindow.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow?.hide();
  });

  if (isDev) void mainWindow.loadURL(rendererDevUrl);
  else void mainWindow.loadFile(path.join(__dirname, "../../dist/renderer/index.html"));
}

async function createTray(appStateService: AppStateService, dataDirectory: string) {
  const today = new Date().toISOString().slice(0, 10);
  const dataActions = createDataTransferActions({
    dataDirectory,
    defaultExportPath: path.join(app.getPath("documents"), `hermes-todo-backup-${today}.json`),
    openPath: (target) => shell.openPath(target),
    exportState: (target) => appStateService.exportTo(target),
    importState: (target) => appStateService.importFrom(target),
    requestExportPath: async (defaultPath) => {
      const result = await dialog.showSaveDialog({
        title: "导出待办数据",
        defaultPath,
        filters: [{ name: "JSON 数据", extensions: ["json"] }]
      });
      return result.canceled ? undefined : result.filePath;
    },
    requestImportPath: async () => {
      const result = await dialog.showOpenDialog({
        title: "导入待办数据",
        properties: ["openFile"],
        filters: [{ name: "JSON 数据", extensions: ["json"] }]
      });
      return result.canceled ? undefined : result.filePaths[0];
    },
    showError: async (message) => {
      await dialog.showMessageBox({ type: "error", title: "Hermes 待办桌宠", message });
    },
    showSuccess: async (message) => {
      await dialog.showMessageBox({ type: "info", title: "Hermes 待办桌宠", message });
    },
    reloadRenderer: () => mainWindow?.webContents.send("data:reload-requested")
  });
  const menu = createTrayMenuTemplate({
    show: showSidebar,
    hide: () => mainWindow?.hide(),
    openDataDirectory: dataActions.openDataDirectory,
    exportData: dataActions.exportData,
    importData: dataActions.importData,
    quit: () => {
      isQuitting = true;
      app.quit();
    }
  });
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "tray-icon.png")
    : path.join(__dirname, "../../build/tray-icon.png");
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  tray.setToolTip("Hermes 待办桌宠");
  tray.setContextMenu(Menu.buildFromTemplate(menu as MenuItemConstructorOptions[]));
  tray.on("click", showSidebar);
}

async function bootstrap() {
  configureLaunchAtLogin(app);
  const dataDirectory = path.join(app.getPath("userData"), "data");
  await mkdir(dataDirectory, { recursive: true });
  const appStateService = new AppStateService(new AppStateFileStore({ dataDirectory }));
  await appStateService.initialize();
  registerStorageIpc(ipcMain, appStateService);
  createMainWindow();
  await createTray(appStateService, dataDirectory);

  ipcMain.handle("sidebar:set-expanded", (_event, expanded: boolean) => {
    if (!mainWindow) return;
    sidebarExpanded = expanded;
    if (!expanded) sidebarDetailOpen = false;
    positionSidebar(mainWindow);
  });
  ipcMain.handle("sidebar:set-detail-open", (_event, detailOpen: boolean) => {
    if (!mainWindow || !sidebarExpanded) return;
    sidebarDetailOpen = detailOpen;
    positionSidebar(mainWindow);
  });
}

if (ensureSingleInstance(app)) {
  void app.whenReady().then(bootstrap);
  app.on("second-instance", showSidebar);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    else showSidebar();
  });
}

app.on("before-quit", () => {
  isQuitting = true;
});
app.on("window-all-closed", () => {
  // Windows 正式版保持托盘进程存活，仅托盘“退出”结束应用。
});
