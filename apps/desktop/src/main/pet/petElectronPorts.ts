/**
 * 模块用途：把 Electron BrowserWindow 与 screen 适配为桌宠控制器端口。
 * 模块边界：不计算布局、不处理拖动阈值，也不保存位置。
 */
import { screen, type BrowserWindow, type Display } from "electron";
import type { PetDisplayArea } from "./petPositionStore.js";
import type { PetScreenPort, PetWindowPort } from "./petWindowController.js";

function toDisplayArea(display: Display): PetDisplayArea {
  return {
    id: display.id,
    workArea: {
      x: display.workArea.x,
      y: display.workArea.y,
      width: display.workArea.width,
      height: display.workArea.height
    }
  };
}

export function createPetWindowPort(window: BrowserWindow): PetWindowPort {
  return {
    setBounds: (bounds) => window.setBounds(bounds),
    sendLayout: (snapshot) => {
      if (!window.webContents.isDestroyed()) {
        window.webContents.send("pet:layout-changed", snapshot);
      }
    }
  };
}

export function createPetScreenPort(): PetScreenPort {
  return {
    getDisplays: () => screen.getAllDisplays().map(toDisplayArea),
    getPrimaryDisplayId: () => screen.getPrimaryDisplay().id,
    getDisplayNearestPoint: (point) => toDisplayArea(screen.getDisplayNearestPoint(point))
  };
}
