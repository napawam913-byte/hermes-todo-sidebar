# 前端组件地图

## V3 桌宠组件

- `PetSprite`：只根据规范化后的角色包、动作槽位和方向渲染六帧图集；不理解待办或 AI。
- `PetActivityContext`：对外提供 `beginThinking / beginWorking / beginWaiting` 与 `awaken / remind / celebrate / fail`，业务页面不直接选择图集行。
- `petStateCoordinator`：按统一优先级选择状态，一次性事件只保留一个候选。
- `usePetAmbientState`：负责 8–14 秒眨眼和收起 20 分钟睡眠。
- `usePetReminderSignals`：按日期和条目 ID 去重提醒，徽标仍负责持续提示。
- 角色包不得携带 UI 主题；Neutral Glass 的颜色、布局、字体和业务语义色始终由应用统一控制。

## Neutral Glass 界面约束

- 待办界面使用统一的 Neutral Glass 材质：冷白玻璃面板、`--ui-*` 语义 Token 和 Apple Blue 主操作色；不得从角色包读取或注入界面颜色。
- 角色包只提供桌宠缩略图、动作图集和状态动画。更换角色不会改变待办、设置、详情、AI 对话、状态菜单的配色、字体或布局。
- 面板透明度由外观设置统一控制，范围为 `72%` 到 `94%`，默认 `86%`；透明度只作用于展开面板，不降低卡片、输入文字和危险操作提示的可读性。
- 直接位于玻璃面板上的辅助文字使用 `--ui-text-on-glass-secondary`；卡片、输入框和菜单内部的辅助文字使用 `--ui-text-secondary`。
- 响应式主从布局断点为 `720px`：大于等于断点时保留列表和详情/AI 工作区的并列信息层级；小于断点时切换为同一面板内的单页导航，避免横向滚动。


## 侧边栏组件

- `SidebarShell`：管理展开态和桌宠闲置态，负责向 Electron 通知窗口尺寸变化。
- `DesktopPetButton`：闲置态桌宠入口，组合数量徽标、点击唤醒和四向拖动状态。
- `PetSprite`：按 `CharacterPack` 播放七行动作图集；向左只镜像角色本体。
- `petDragDirection`：按屏幕坐标稳定计算上、下、左、右，不操作 Electron 窗口。
- `builtInCharacterRegistry`：构建期发现角色目录，校验 Manifest 并提供默认回退。
- `IdleIconButton`：旧版右侧小图标入口，已标记待删除，不再由新侧边栏引用。
- `EdgeHandle`：旧版全高窄条入口，已标记待删除，不再由新侧边栏引用。

## 设置与外观模块

- `appearanceSettings.ts`：定义 schema v3、角色 ID、`72%–94%` 透明度、默认 `86%` 和本地仓储接口；旧设置会迁移后继续使用。
- `useAppearanceSettings.ts`：连接 React 状态与 `localStorage`，重启后恢复用户选择。
- `SettingsPanel`：设置页装配层，连接当前分区、外观偏好与模型配置保存逻辑。
- `SettingsShell`：C 分栏控制台壳；宽屏显示左侧导航，紧凑面板显示顶部双 Tab。
- `AppearanceSettingsPanel`：无嵌套大卡片的外观内容区，只展示角色选择和面板透明度。
- `ModelConnectionSettings`：模型连接分区，复用受控配置表单并统一连接状态颜色。
- `AiConfigForm`：AI 首次配置和设置页共用的表单；由外层决定保存后继续对话或停留当前分区。
- `CharacterPicker`：只展示已安装角色并更新选择，不参与拖动或素材生成。
- `SidebarShell`：只消费面板透明度和窗口几何变量，不读取角色主题或注入界面颜色，也不直接读写设置。

## 待办组件

- `TodoPanel`：展开后的主面板容器，组织标题栏、`今日待办 / 周期计划` 主导航和两个子视图。
- `TopModeTabs`：顶部主导航，只有 `今日待办` 与 `周期计划` 两个入口。
- `TodayTodoView`：协调今日待办主列表与详情；合并手动待办和今天命中的周期计划条目，窄屏同面板切页，宽屏使用 `40% / 60%` 主从布局。
- `TodayTodoCard`：今日列表卡片，支持 `手动` 与 `周期计划` 来源。
- `SourcePill`：来源标签，当前支持 `手动`、`周期计划`、`AI草稿`、`Hermes`。
- `QuickAddBar`：第一版只收集待办标题。
- `TodoItem`：旧版单条待办卡片，保留给后续复用或兼容，不再作为今日页主卡片。
- `ReminderBadge`：后续提醒扩展组件，第一版不在界面中引用。
- `SnoozeMenu`：后续稍后提醒扩展组件，第一版不在界面中引用。

## 数据与状态模块

- `todoModel.ts`：待办领域纯函数，不访问存储或网络。
- `todoRepository.ts`：待办读写接口，后续可替换为文件存储或 Hermes 缓存。
- `localTodoRepository.ts`：当前启用的 `localStorage` 持久化实现。
- `todoStore.ts`：把 React 状态、待办纯函数和仓储连接起来。
- `todayItems.ts`：把手动待办和当天周期计划条目合并成今日视图模型。

## 周期计划模块

- `cyclePlanTypes.ts`：定义 `CyclePlan`、`CyclePlanEntry` 和通用 `PlanContentBlock`。
- `mockCyclePlans.ts`：提供健身计划和教程学习计划 demo 数据。
- `cyclePlanModel.ts`：日期命中、计划统计、条目完成和内容块识别纯函数。
- `cyclePlanRepository.ts`：周期计划仓储接口，后续可替换为 Hermes。
- `localCyclePlanRepository.ts`：当前启用的 `localStorage` 持久化实现。
- `cyclePlanStore.ts`：把 React 状态、周期计划纯函数和仓储连接起来。
- `CyclePlanView`：协调周期计划列表与详情，复用统一主从容器并提供“AI 生成周期任务”入口，不包含手动内容表单。
- `CyclePlanCard`：计划卡，展示主题、状态、条目数和今日命中数。
- `CyclePlanDetail`：计划详情页，展示日期条目和选中内容块。
- `CyclePlanEntryCard`：周期计划日期条目卡。
- `ContentBlockPreview`：统一 JSON/Markdown 内容块通用预览。
- `FitnessExerciseBlock`：健身动作列表专用展示，支持动作、组次、次数、RIR 和备注。

## 周期计划数据边界

当前前端只使用 `features/cyclePlans`。计划卡、日期条目和内容块共享 v2 数据合同；Hermes 未来直接返回统一草稿 JSON，不在前端保留另一套滚动模板模型。

## 同步模块

- `SyncStatusPill`：展示“本地、待同步、已同步、同步失败”。
- `syncTypes.ts`：Hermes/飞书同步占位类型。
- `syncQueue.ts`：本地待同步事件队列。
- `syncClient.ts`：Hermes 客户端接口；当前只提供禁用态实现，不联网。

飞书不会直接从 UI 调用。后续路径是：桌宠前端生成待办事件，Hermes 接收事件，再由 Hermes 发送飞书机器人消息或写入多维表格。

## AI 对话模块

- `AiPlannerView`：组合配置、对话、提案和执行结果，并为工作页面提供剩余高度。
- `AiConversationPanel`：全宽单栏聊天，组织模型状态、聚焦引导、长消息列表、固定输入区和操作范围入口。
- `AiPromptSuggestions`：根据创建或调整上下文展示建议，只把选中内容写入输入草稿，不发送模型请求。
- `AiComposer`：紧凑受控输入框，支持 `44–120px` 自动增高、中文输入法和键盘发送。
- `AiScopePopover`：按需说明本次可操作范围、数据发送和人工确认边界。
- `AiTaskContext`：旧固定上下文栏，已断开引用并标记待删除。
- `useAiChatScroll`：管理自动跟随、用户上翻和“跳到最新”。
- `aiPlannerState`：保存对话、提案、执行结果和未发送输入草稿。
- `aiConversationBudget`：主进程按 `32,000` 字符选择首次目标和最近完整消息。

## 数据流

1. `App` 创建 `localTodoRepository`。
2. `useTodoStore` 先从仓储读取待办；没有本地数据时使用 `mockTodos` 作为初始演示数据。
3. `SidebarShell` 根据 `expanded` 切换桌宠入口和展开面板。
4. `DesktopPetButton` 点击后触发展开。
5. `App` 创建 `localCyclePlanRepository`，并通过 `useCyclePlanStore` 读取周期计划。
6. `TodoPanel` 展示顶部主导航。
7. `TodayTodoView` 使用 `todayItems.ts` 合并手动待办和当天周期计划条目。
8. `QuickAddBar` 调用 `onAdd(title)` 写入手动待办。
9. `TodayTodoCard` 根据来源调用 `completeTodo` 或 `completeEntry`。
10. `CyclePlanView` 展示计划卡；创建和内容调整进入 AI Flow，状态与条目完成操作仍直接进入统一变更网关。

## 共享按钮

- `IconButton`：图标按钮，配合隐藏文本保证可访问性。
- `PrimaryButton`：主操作按钮，例如添加待办。
- `QuietButton`：低强调按钮，当前为后续菜单类操作保留。
