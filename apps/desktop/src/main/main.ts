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
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { configureLaunchAtLogin, ensureSingleInstance } from "./lifecycle/appLifecycle.js";
import { registerAiRuntime } from "./ai/aiBootstrap.js";
import { createAiDataPorts } from "./ai/aiDataPorts.js";
import { reportBootstrapFailure, runBootstrapSequence } from "./lifecycle/bootstrapFailure.js";
import { createDataTransferActions } from "./lifecycle/dataTransferController.js";
import { createPlanApiBeforeQuitHandler } from "./lifecycle/planApiShutdown.js";
import { getRuntimeChannel, getTestUserDataPath } from "./lifecycle/runtimeChannel.js";
import { createTrayMenuTemplate } from "./lifecycle/trayController.js";
import { registerPlanApiRuntime, type RegisteredPlanApiRuntime } from "./planApi/planApiBootstrap.js";
import { createPetScreenPort, createPetWindowPort } from "./pet/petElectronPorts.js";
import { registerPetIpc } from "./pet/petIpc.js";
import { PetPositionFileStore } from "./pet/petPositionFileStore.js";
import { PetWindowController } from "./pet/petWindowController.js";
import { DESKTOP_PET_HEIGHT, DESKTOP_PET_WIDTH } from "./sidebarBounds.js";
import { AppStateFileStore } from "./storage/appStateFileStore.js";
import { AppStateService } from "./storage/appStateService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;
const rendererDevUrl = process.env.HERMES_RENDERER_URL ?? "http://127.0.0.1:5178";
const runtimeChannel = getRuntimeChannel(process.env, process.execPath);
if (runtimeChannel === "test") {
  app.setPath("userData", getTestUserDataPath(app.getPath("appData")));
}
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let petController: PetWindowController | null = null;
let planApiRuntime: RegisteredPlanApiRuntime | null = null;
let isQuitting = false;

interface PreparedDesktopRuntime { runtime: RegisteredPlanApiRuntime; dataDirectory: string; }

function showSidebar() {
  petController?.setExpanded(true);
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
      preload: path.join(__dirname, "../preload/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("blur", () => {
    if (petController?.isDragActive()) return;
    petController?.setExpanded(false);
    mainWindow?.webContents.send("sidebar:collapse-requested");
  });
  mainWindow.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow?.hide();
  });

  if (isDev) void mainWindow.loadURL(rendererDevUrl);
  else void mainWindow.loadFile(path.join(__dirname, "../../dist/renderer/index.html"));
}

async function createTray(runtime: RegisteredPlanApiRuntime, dataDirectory: string) {
  const today = new Date().toISOString().slice(0, 10);
  const dataActions = createDataTransferActions({
    dataDirectory,
    defaultExportPath: path.join(app.getPath("documents"), `hermes-todo-backup-${today}.json`),
    openPath: (target) => shell.openPath(target),
    exportState: async (target) => writeFile(target, `${JSON.stringify(await runtime.getStoredSnapshot(), null, 2)}\n`, "utf8"),
    requestExportPath: async (defaultPath) => {
      const result = await dialog.showSaveDialog({
        title: "导出待办数据",
        defaultPath,
        filters: [{ name: "JSON 数据", extensions: ["json"] }]
      });
      return result.canceled ? undefined : result.filePath;
    },
    showError: async (message) => {
      await dialog.showMessageBox({ type: "error", title: "Hermes 待办桌宠", message });
    },
    showSuccess: async (message) => {
      await dialog.showMessageBox({ type: "info", title: "Hermes 待办桌宠", message });
    },
  });
  const menu = createTrayMenuTemplate({
    show: showSidebar,
    hide: () => mainWindow?.hide(),
    openDataDirectory: dataActions.openDataDirectory,
    exportData: dataActions.exportData,
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

async function initializePlanApi(): Promise<PreparedDesktopRuntime> {
  configureLaunchAtLogin(app, {
    portable: Boolean(
      process.env.PORTABLE_EXECUTABLE_FILE || process.env.PORTABLE_EXECUTABLE_DIR
    )
  });
  const dataDirectory = path.join(app.getPath("userData"), "data");
  await mkdir(dataDirectory, { recursive: true });
  const appStateService = new AppStateService(new AppStateFileStore({ dataDirectory }));
  await appStateService.initialize();
  const runtime = registerPlanApiRuntime({
    ipc: ipcMain, userDataDirectory: app.getPath("userData"), dataDirectory,
    isPackaged: app.isPackaged,
    legacyStateService: appStateService,
    publish: (channel, payload) => mainWindow?.webContents.send(channel, payload),
  });
  await runtime.initialize();
  planApiRuntime = runtime;
  return { runtime, dataDirectory };
}

function registerAiDataRuntime({ runtime }: PreparedDesktopRuntime) {
  const aiDataPorts = createAiDataPorts(runtime);
  registerAiRuntime(ipcMain, {
    ...aiDataPorts,
    userDataDirectory: app.getPath("userData")
  });
}

async function createDesktopRuntime({ runtime, dataDirectory }: PreparedDesktopRuntime) {
  createMainWindow();
  if (!mainWindow) throw new Error("桌宠窗口创建失败");
  petController = new PetWindowController({
    window: createPetWindowPort(mainWindow),
    screen: createPetScreenPort(),
    positionStore: new PetPositionFileStore({ userDataDirectory: app.getPath("userData") })
  });
  registerPetIpc(ipcMain, petController);
  await petController.initialize();
  await createTray(runtime, dataDirectory);
  const recoverDisplayLayout = () => void petController?.recoverDisplayLayout();
  screen.on("display-added", recoverDisplayLayout);
  screen.on("display-removed", recoverDisplayLayout);
  screen.on("display-metrics-changed", recoverDisplayLayout);
}

async function bootstrap() {
  await runBootstrapSequence({
    initializePlanApi,
    registerAi: registerAiDataRuntime,
    createDesktop: createDesktopRuntime
  }, {
    showError: (title, message) => dialog.showErrorBox(title, message),
    exit: (code) => app.exit(code)
  });
}

function handleBootstrapFailure() {
  reportBootstrapFailure({
    showError: (title, message) => dialog.showErrorBox(title, message),
    exit: (code) => app.exit(code)
  });
}

if (ensureSingleInstance(app)) {
  void app.whenReady().then(bootstrap).catch(handleBootstrapFailure);
  app.on("second-instance", showSidebar);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    else showSidebar();
  });
}

const beforePlanApiQuit = createPlanApiBeforeQuitHandler(() => planApiRuntime, () => app.quit());
app.on("before-quit", (event) => { isQuitting = true; beforePlanApiQuit(event); });
app.on("window-all-closed", () => {
  // Windows 正式版保持托盘进程存活，仅托盘“退出”结束应用。
});
