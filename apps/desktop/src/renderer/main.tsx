/**
 * 模块用途：React 渲染进程入口，挂载桌面侧边栏应用。
 * 模块边界：只负责启动 React，不写业务逻辑。
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { bootstrapAppData } from "./data/appDataBootstrap";
import { PetActivityProvider } from "./features/sidebar/PetActivityContext";
import "./styles/global.css";
import "./styles/ai-onboarding.css";
import "./styles/responsive-panel.css";

async function startApplication() {
  const appData = await bootstrapAppData();
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <PetActivityProvider>
        <App appData={appData} />
      </PetActivityProvider>
    </React.StrictMode>
  );
}

void startApplication();
