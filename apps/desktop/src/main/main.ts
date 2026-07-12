/**
 * 模块用途：Electron 主进程入口，装配桌宠窗口、托盘和本地应用状态服务。
 * 模块边界：只负责桌面能力装配，不解释待办与周期计划的领域字段。
 */
import { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, screen } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { calculateSidebarBounds, DESKTOP_PET_HEIGHT, DESKTOP_PET_WIDTH } from "./sidebarBounds.js";
import { AppStateFileStore } from "./storage/appStateFileStore.js";
import { AppStateService } from "./storage/appStateService.js";
import { registerStorageIpc } from "./storage/storageIpc.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let sidebarExpanded = false;
let sidebarDetailOpen = false;

const isDev = !app.isPackaged;

function positionSidebar(window: BrowserWindow) {
  const display = screen.getPrimaryDisplay();
  window.setBounds(
    calculateSidebarBounds({
      expanded: sidebarExpanded,
      detailOpen: sidebarDetailOpen,
      workArea: display.workArea
    })
  );
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
    title: "Hermes Todo Sidebar",
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
  mainWindow.on("blur", () => {
    mainWindow?.webContents.send("sidebar:collapse-requested");
  });

  if (isDev) {
    void mainWindow.loadURL("http://127.0.0.1:5173");
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../../dist/renderer/index.html"));
  }
}

function createTray() {
  const trayIcon = nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
  );
  tray = new Tray(trayIcon);
  tray.setToolTip("Hermes Todo Sidebar");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Show sidebar",
        click: () => {
          mainWindow?.show();
          mainWindow?.webContents.send("sidebar:expand-requested");
        }
      },
      {
        label: "Hide sidebar",
        click: () => mainWindow?.hide()
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => app.quit()
      }
    ])
  );
}

app.whenReady().then(async () => {
  const appStateService = new AppStateService(
    new AppStateFileStore({ dataDirectory: path.join(app.getPath("userData"), "data") })
  );
  await appStateService.initialize();
  registerStorageIpc(ipcMain, appStateService);

  createMainWindow();
  createTray();

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

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  // 保持托盘进程存活，用户可通过托盘菜单主动退出。
});
