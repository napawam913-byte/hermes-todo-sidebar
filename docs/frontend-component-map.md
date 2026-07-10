# 前端组件地图

## 侧边栏组件

- `SidebarShell`：管理展开态和桌宠闲置态，负责向 Electron 通知窗口尺寸变化。
- `DesktopPetButton`：闲置态桌宠入口，第一版只显示待处理数量，点击后展开待办面板。
- `IdleIconButton`：旧版右侧小图标入口，已标记待删除，不再由新侧边栏引用。
- `EdgeHandle`：旧版全高窄条入口，已标记待删除，不再由新侧边栏引用。

## 待办组件

- `TodoPanel`：展开后的主面板容器，组织标题栏、`今日待办 / 周期计划` 主导航和两个子视图。
- `TopModeTabs`：顶部主导航，只有 `今日待办` 与 `周期计划` 两个入口。
- `TodayTodoView`：今日待办视图，合并手动待办和今天命中的周期计划条目。
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
- `CyclePlanView`：周期计划入口页，展示计划卡和本地 mock 操作按钮。
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
10. `CyclePlanView` 展示计划卡；点击后进入 `CyclePlanDetail` 查看内容块。

## 共享按钮

- `IconButton`：图标按钮，配合隐藏文本保证可访问性。
- `PrimaryButton`：主操作按钮，例如添加待办。
- `QuietButton`：低强调按钮，当前为后续菜单类操作保留。
