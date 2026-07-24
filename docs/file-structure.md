# 文件结构规范

## 项目结构

```text
apps/desktop/
  src/main/                 Electron 主进程
  src/main/agent/           Agent 主进程桥接和权限策略
  src/main/pet/             桌宠窗口位置、拖拽记忆和几何计算
  src/main/reminders/       系统提醒调度和 Windows 通知服务接口
  src/preload/              安全 IPC 桥接
  src/renderer/             React 渲染进程
  src/renderer/components/  共享 UI 基础组件
  src/renderer/features/    按业务拆分的功能模块
  src/renderer/features/cyclePlans/ 当前第一版周期计划、日期条目和内容块展示
  src/renderer/styles/      设计 token、全局样式、动效样式
docs/                       产品、设计、动效、组件和交接文档
figma/                      Figma 节点记录和验收记录
```

## 当前关键模块

- `src/main/pet/petDragSession.ts`：区分点击与超过 `5px` 的拖动会话。
- `src/main/pet/petWindowBounds.ts`：计算向上/向下锚定面板和组合窗口 bounds。
- `src/main/pet/petPositionStore.ts`：校正桌宠位置并处理显示器变化。
- `src/main/pet/petPositionFileStore.ts`：独立读写 `pet-position.v1.json`。
- `src/main/pet/petWindowController.ts`：编排拖动、展开、收起、跨屏和一次性保存。
- `src/main/pet/petElectronPorts.ts`：把 Electron `screen/BrowserWindow` 适配为控制器端口。
- `src/main/pet/petIpc.ts`：注册 renderer 可调用的桌宠白名单 IPC。
- `src/main/reminders/reminderScheduler.ts`：筛选已经到点、可触发提醒的待办。
- `src/main/reminders/notificationService.ts`：预留 Windows 通知服务接口。
- `src/main/agent/agentBridge.ts`：预留 renderer 到 Hermes Agent 的主进程桥接。
- `src/main/agent/agentPermissionPolicy.ts`：定义 Agent 动作的确认和拒绝策略。
- `src/renderer/features/sidebar/DesktopPetButton.tsx`：桌宠式闲置入口。
- `src/renderer/features/sidebar/petDragInteraction.ts`：协调指针会话与安全 bridge。
- `src/renderer/features/sidebar/usePetDrag.ts`：把 React 指针事件连接到拖动协调器。
- `src/renderer/features/sidebar/SidebarShell.tsx`：消费布局快照并组合桌宠与锚定面板。
- `src/renderer/components/DetailPageShell.tsx`：今日待办和周期计划复用的同面板详情页。
- `src/renderer/features/todos/todoModel.ts`：待办创建、完成、简单排序，以及后续稍后和提醒扩展纯函数。
- `src/renderer/features/todos/todoRepository.ts`：待办仓储接口。
- `src/renderer/features/todos/localTodoRepository.ts`：`localStorage` 本地持久化实现。
- `src/renderer/features/todos/todoStore.ts`：React 状态与仓储连接层。
- `src/renderer/features/todos/TopModeTabs.tsx`：`今日待办 / 周期计划` 顶部主导航。
- `src/renderer/features/todos/TodayTodoView.tsx`：今日待办页，合并手动待办和当天周期计划条目。
- `src/renderer/features/todos/TodayTodoCard.tsx`：今日待办卡片，支持来源标签和完成动作。
- `src/renderer/features/todos/todayItems.ts`：今日视图合并、筛选和摘要纯函数。
- `src/renderer/features/cyclePlans/cyclePlanTypes.ts`：当前周期计划、日期条目和统一内容块类型。
- `src/renderer/features/cyclePlans/cyclePlanModel.ts`：日期命中、统计、完成和内容块识别纯函数。
- `src/renderer/features/cyclePlans/mockCyclePlans.ts`：健身和教程学习周期计划 demo 数据。
- `src/renderer/features/cyclePlans/localCyclePlanRepository.ts`：周期计划 `localStorage` 持久化实现。
- `src/renderer/features/cyclePlans/cyclePlanStore.ts`：周期计划 React 状态连接层。
- `src/renderer/features/cyclePlans/CyclePlanView.tsx`：周期计划列表入口。
- `src/renderer/features/cyclePlans/CyclePlanDetail.tsx`：计划条目和内容块详情页。
- `src/renderer/features/cyclePlans/ContentBlockPreview.tsx`：未知 JSON/Markdown 内容块兜底展示。
- `src/renderer/features/cyclePlans/FitnessExerciseBlock.tsx`：健身动作内容块专用展示。
- `src/renderer/features/sync/syncClient.ts`：Hermes 同步客户端接口和禁用态实现。
- `src/renderer/features/sync/syncQueue.ts`：待同步事件队列。
- `src/renderer/features/sync/syncTypes.ts`：Hermes/飞书同步占位类型。
- `src/renderer/features/agent/agentTypes.ts`：Agent 意图、上下文、建议和动作类型。
- `src/renderer/features/agent/agentContext.ts`：从待办列表提取 Agent 最小上下文。
- `src/renderer/features/agent/agentClient.ts`：Agent 客户端接口和禁用态实现。
- `src/renderer/features/agent/agentActionRegistry.ts`：Agent 动作白名单和确认策略。

## 模块规则

- Electron 主进程只处理窗口、托盘、IPC、通知和桌面生命周期。
- React feature 模块不直接依赖 Electron 对象，只通过 `window.hermesPet` 白名单桥接。
- 待办领域纯函数放在 `features/todos/todoModel.ts`。
- 本地持久化通过 `TodoRepository` 接口接入，不写进 UI 组件。
- 第一版 UI 只展示日期级周期计划，不展示具体时间安排。
- 当前周期计划只使用 v2 `CyclePlan + CyclePlanEntry + contentBlocks`。
- Hermes 计划草稿使用 `draft/candidate`，确认前不进入今日待办。
- 新任务领域只扩展 `contentBlocks.kind` 和 `data`，不新建顶层计划模型。
- Hermes 和飞书网络逻辑不能写进 UI 组件。
- Agent 推理和联网逻辑不能写进 UI 组件；UI 只展示建议并等待确认。
- 新模块必须有中文模块用途注释。
- `App.tsx` 只做状态组合和 feature 编排，不承载完整 UI。
- 桌宠坐标只存在于 `src/main/pet/`；待办和周期计划模块不得读取屏幕坐标。
- `pet-position.v1.json` 与 `data/state.v1.json` 分开保存，互不改变 schema。

## 文件大小规则

单个组件文件目标不超过 220 行。超过时拆分为：

- `*.view.tsx`：视图结构。
- `*.logic.ts`：状态和纯函数。
- `*.types.ts`：共享类型。
- `*.styles.css`：稳定后可拆出的局部样式。

## Cloud Plan API foundation

```text
services/plan-api/
  src/plan_api/              FastAPI app, settings, CLI, backup, DB, API routes, contracts, repositories, services
  src/plan_api/db/sql/       SQLite migration files bundled with the Python package
  tests/                     Plan API unit, repository, service, contract, backup, and CLI tests
  deploy/systemd/            User systemd service and timer units for API serving and daily maintenance
  openapi.v1.json            Deterministic OpenAPI contract for later Hermes and desktop phases
docs/cloud-plan-api-deployment.md  Linux user-systemd deployment, SSH tunnel, health check, backup, and restore guide
```

Boundary note: the cloud Plan API foundation is ready as an isolated service.
Hermes sync integration and Electron desktop migration remain separate phases,
so existing desktop/frontend files should not depend on the Plan API yet.
