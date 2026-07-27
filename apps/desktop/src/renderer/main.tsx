/**
 * 模块用途：React 渲染进程入口，挂载桌面侧边栏应用。
 * 模块边界：只负责启动 React，不写业务逻辑。
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { bootstrapAppData } from "./data/appDataBootstrap";
import "./styles/global.css";

async function startApplication() {
  window.hermesAppData?.onSnapshotChanged(() => window.location.reload());
  const appData = await bootstrapAppData();
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App appData={appData} />
    </React.StrictMode>
  );
}

void startApplication();
