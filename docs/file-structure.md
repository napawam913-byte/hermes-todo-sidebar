# 文件结构规范

## CharacterPack V3 新增边界

- `features/sidebar/petBehaviorTemplate.ts`：统一动作时长、行号、循环方式和状态优先级。
- `features/sidebar/petStateCoordinator.ts`：持续状态、一次性事件与拖动覆盖的纯状态机。
- `features/sidebar/PetActivityContext.tsx`：把业务信号、眨眼、睡眠和动作计时接入状态机。
- `features/sidebar/characterPackV3.ts`：V3 严格 Manifest 校验及 V1/V2 固定回退。
- `scripts/pets/character_pack_v3.py`：角色工厂共享尺寸和 14 行 Manifest 合同。
- `scripts/pets/background_cleanup.py`：只移除边界连通的浅色背景，保护角色内部白色细节。
- `artifacts/character-runs/`：三视图副本、生成条、候选包和 QA 预览；始终忽略版本控制。

## 项目结构

```text
apps/desktop/
  src/main/                 Electron 主进程
  src/main/agent/           Agent 主进程桥接和权限策略
  src/main/ai/              大模型配置、客户端、提案校验和原子执行
  src/main/pet/             桌宠窗口位置、拖拽记忆和几何计算
  src/main/reminders/       系统提醒调度和 Windows 通知服务接口
  src/preload/              安全 IPC 桥接
  src/renderer/             React 渲染进程
  src/renderer/components/  共享 UI 基础组件
  src/renderer/features/    按业务拆分的功能模块
  src/renderer/features/ai/ 大模型配置、对话、提案预览和执行结果
  src/renderer/features/appearance/ 面板透明度数据、持久化 Hook 与设置界面
  src/renderer/features/settings/ 设置分栏壳、分区状态和模型连接适配层
  src/renderer/assets/characters/ 已审核的内置角色包、图集与缩略图
  src/renderer/features/cyclePlans/ 当前第一版周期计划、日期条目和内容块展示
  src/renderer/styles/      设计 token、全局样式、动效样式
docs/                       产品、设计、动效、组件和交接文档
figma/                      Figma 节点记录和验收记录
scripts/                    打包与开发辅助脚本
scripts/pets/               三视图生成准备、角色包构建与人工确认安装工具
```

## 当前关键模块

- `src/main/pet/petDragSession.ts`：区分点击与 X/Y 任一方向达到 `4px` 的拖动会话。
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
- `src/main/ai/aiConfigStore.ts`：用安全加密端口保存模型配置并生成脱敏快照。
- `src/main/ai/aiConfigDraftFileStore.ts`：只保存 Base URL 与模型名的非敏感配置草稿。
- `src/main/ai/openAiCompatibleClient.ts`：调用 OpenAI 兼容 `chat/completions`。
- `src/main/ai/aiProposalService.ts`：整理完整本地上下文并生成严格提案。
- `src/main/ai/aiConversationBudget.ts`：在 `32,000` 字符内保留首次目标与最近完整消息。
- `src/main/ai/aiGenerationPolicy.ts`：限制 AI 创建与调整只能作用于允许的周期任务范围。
- `src/main/ai/aiProposalExecutor.ts`：在应用状态事务中原子执行已确认提案。
- `src/main/ai/aiExecutionError.ts`：统一目标不存在、版本冲突、格式校验和持久化失败错误。
- `src/main/ai/aiIpc.ts`：模型配置、生成和确认执行的 IPC 白名单。
- `src/main/storage/appMutationExecutor.ts`：手动操作与 AI 提案共用的校验、克隆执行和原子保存协调器。
- `src/shared/appMutationTypes.ts`：统一变更批次、来源和操作合同。
- `src/shared/appMutationValidation.ts`：renderer 到主进程之间的运行时白名单解析和 50 项上限。
- `src/shared/aiMutationTypes.ts`：15 种待办与周期计划操作的共享合同。
- `src/shared/aiMutationValidation.ts`：严格提案解析和 50 项上限。
- `src/renderer/features/sidebar/DesktopPetButton.tsx`：桌宠式闲置入口。
- `src/renderer/features/sidebar/petDragDirection.ts`：按 `3px` 采样和 `1.25` 轴优势计算稳定四向步态。
- `src/renderer/features/sidebar/petDragInteraction.ts`：协调指针会话与安全 bridge。
- `src/renderer/features/sidebar/usePetDrag.ts`：把 React 指针事件连接到拖动协调器。
- `src/renderer/features/sidebar/characterPack.ts`：角色 Manifest、动画片段与主题色严格合同。
- `src/renderer/features/sidebar/characterRegistry.ts`：已安装角色解析与默认角色回退。
- `src/renderer/features/sidebar/builtInCharacterRegistry.ts`：构建期自动发现内置角色资源。
- `src/renderer/features/sidebar/PetSprite.tsx`：通用七行动作图集播放器。
- `src/renderer/features/sidebar/SidebarShell.tsx`：消费布局快照并组合桌宠与锚定面板。
- `src/renderer/features/sidebar/panelSessionState.ts`：统一管理当前工作页、设置分区、返回目标和收起后的瞬时重置。
- `src/renderer/features/appearance/appearanceSettings.ts`：外观设置合同、透明层级计算和本地仓储。
- `src/renderer/features/appearance/useAppearanceSettings.ts`：外观偏好的 React 状态与持久化连接层。
- `src/renderer/features/appearance/AppearanceSettingsPanel.tsx`：角色选择和面板不透明度的无框内容区。
- `src/renderer/features/appearance/CharacterPicker.tsx`：内置角色选择器。
- `src/renderer/features/settings/SettingsPanel.tsx`：设置页装配层和保存后停留逻辑。
- `src/renderer/features/settings/SettingsShell.tsx`：宽屏左侧导航与紧凑顶部双 Tab 的响应式壳。
- `src/renderer/features/settings/ModelConnectionSettings.tsx`：模型表单与连接状态展示适配层。
- `src/renderer/features/settings/settingsModelStatus.ts`：未配置、已保存、测试成功和失败的状态映射。
- `src/renderer/components/DetailPageShell.tsx`：今日待办和周期计划复用的同面板详情页。
- `src/renderer/features/todos/todoModel.ts`：待办创建、完成、简单排序，以及后续稍后和提醒扩展纯函数。
- `src/renderer/features/todos/todoRepository.ts`：待办仓储接口。
- `src/renderer/features/todos/localTodoRepository.ts`：`localStorage` 本地持久化实现。
- `src/renderer/features/todos/todoStore.ts`：React 状态与仓储连接层。
- `src/renderer/features/todos/TopModeTabs.tsx`：`今日待办 / 周期计划` 顶部主导航。
- `src/renderer/features/todos/TodayTodoView.tsx`：今日待办页，合并手动待办和当天周期计划条目。
- `src/renderer/data/appMutationGateway.ts`：Electron 与浏览器预览共用的同形变更网关。
- `src/renderer/data/useAppMutationStore.ts`：只在持久化成功后接收最新快照，失败时保留原数据。
- `src/renderer/features/todos/TodoEditorDrawer.tsx`：普通待办标题、日期和备注编辑及删除确认。
- `src/renderer/features/todos/TodoActionMenu.tsx`：完成、恢复、编辑、跳过和永久删除入口。
- `src/renderer/features/cyclePlans/cyclePlanMutationCommands.ts`：计划状态、删除和条目状态到通用操作的转换；旧表单差异函数待验收后删除。
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
- `src/renderer/features/ai/aiPlannerState.ts`：独立的会话、提案和执行结果纯状态模型。
- `src/renderer/features/ai/aiPlannerLaunchContext.ts`：周期任务创建/调整入口与请求上下文映射。
- `src/renderer/features/ai/useAiPlanner.ts`：把 AI Flow 状态模型连接到安全 preload API。
- `src/renderer/features/ai/useAiConfigController.ts`：管理受控配置表单、防抖草稿保存和当前输入测试。
- `src/renderer/features/ai/AiConfigForm.tsx`：首次引导与设置页共用的受控模型配置表单。
- `src/renderer/features/ai/aiConfigDraftState.ts`：不依赖 React 的配置草稿与连接测试状态模型。
- `src/renderer/features/ai/aiConfigAsyncCoordinator.ts`：串行草稿写入并隔离过期连接与保存结果。
- `src/renderer/features/ai/AiFlowNav.tsx`：`周期任务 / 对话 / 提案 N` 二级导航和配置门槛。
- `src/renderer/features/ai/aiProposalDomains.ts`：判断提案影响今日待办、周期数据或两者。
- `src/renderer/features/ai/AiPlannerView.tsx`：同一面板内的 AI 安排页面编排。
- `src/renderer/features/ai/AiConversationPanel.tsx`：聊天优先双栏与模型真实配置状态。
- `src/renderer/features/ai/AiComposer.tsx`：受控、自适应并兼容中文输入法的输入区。
- `src/renderer/features/ai/AiTaskContext.tsx`：可收起任务上下文栏和紧凑摘要。
- `src/renderer/features/ai/useAiChatScroll.ts`：长对话自动跟随和新回复提示。
- `src/renderer/features/ai/AiProposalPanel.tsx`：整批操作预览和唯一确认入口。
- `src/renderer/features/ai/AiExecutionPanel.tsx`：原子写入成功入口和结构化整批回滚结果。
- `scripts/create-compatible-portable.mjs`：从 `win-unpacked` 生成使用官方签名 Electron 运行时的策略兼容免安装目录。
- `scripts/pets/prepare_character_pack.py`：由角色名称和三视图建立忽略版本控制的生成任务。
- `scripts/pets/build_character_pack.py`：把七条透明动作条构建成候选角色包与 QA 预览。
- `scripts/pets/install_character_pack.py`：验证并安装已人工确认的候选角色包。

## 模块规则

- Electron 主进程只处理窗口、托盘、IPC、通知和桌面生命周期。
- React feature 模块不直接依赖 Electron 对象，只通过 `window.hermesPet`、`window.hermesAppData` 和 `window.hermesAi` 白名单桥接。
- 待办领域纯函数放在 `features/todos/todoModel.ts`。
- 正式写入统一通过 `AppMutationGateway` 提交操作批次；浏览器预览用同形执行器写入 `localStorage`。
- 第一版 UI 只展示日期级周期计划，不展示具体时间安排。
- 当前周期计划只使用 v2 `CyclePlan + CyclePlanEntry + contentBlocks`。
- Hermes 计划草稿使用 `draft/candidate`，确认前不进入今日待办。
- 新任务领域只扩展 `contentBlocks.kind` 和 `data`，不新建顶层计划模型。
- Hermes 和飞书网络逻辑不能写进 UI 组件。
- Agent 推理和联网逻辑不能写进 UI 组件；UI 只展示建议并等待确认。
- 模型只提交变更提案；renderer 只按 `proposalId` 确认，不能把操作正文直接写入本地数据。
- 模型的空操作 JSON 作为自然语言回复；只有非空白名单操作才进入提案预览。
- 长对话按字符预算选择完整消息，不截断单条内容，不额外调用模型摘要。
- AI 会话状态由 `TodoPanel` 持有，切换顶部页面和收起桌宠不丢失；应用重启后清除。
- 旧提案仅在新提案成功注册后替换；显式放弃必须同步清理主进程缓存。
- API Key 只能在主进程通过 `safeStorage` 加密保存，不能进入 renderer 状态、日志或模型上下文。
- 新模块必须有中文模块用途注释。
- `App.tsx` 只做状态组合和 feature 编排，不承载完整 UI。
- 桌宠坐标只存在于 `src/main/pet/`；待办和周期计划模块不得读取屏幕坐标。
- `pet-position.v1.json` 与 `data/state.v1.json` 分开保存，互不改变 schema。
- 外观设置独立保存到 renderer 本地存储，不进入待办或周期计划 JSON。
- 角色包遵守 `docs/character-pack-spec.md`；运行时不调用图像模型，也不加载外部角色包。

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

Boundary note: the cloud Plan API is the desktop's formal data source.
Electron reaches it through the main-process Plan API runtime and the preload bridge;
browser preview remains an isolated localStorage Demo.

## 桌面 Plan API 集成边界

- `services/plan-api/`：独立 FastAPI/SQLite 服务，负责迁移、版本、备份和 HTTP 数据合同；它不承载 Electron UI 或浏览器 Demo 状态。
- `src/main/planApi/`：主进程连接配置、Token 密文保存、SSH 隧道、缓存、迁移协调和 API 适配；正式数据读写只在这一层接入服务端。
- `src/renderer/data/`：renderer 的数据服务控制器和状态桥接，只消费 preload 白名单，不能直接访问 Token、SQLite、SSH 或网络客户端。
- `AppMutationGateway` 仍是 renderer 的统一写入入口；Electron 实现通过 `bridge.executeMutations` 把手动操作和 AI 已确认提案送入 `PlanApiRuntime.execute()`，离线缓存只能读取。
- 已删除的是主进程本地 `AppMutationExecutor` 和 JSON 正式写入路径；浏览器预览仍可用同形 Demo 写入 `localStorage`。
