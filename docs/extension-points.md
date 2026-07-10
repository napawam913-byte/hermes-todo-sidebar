# 后续功能扩展点

这份文档专门说明当前项目为后续能力预留的位置，避免把真实联网、系统通知或桌宠能力塞进 UI 组件。

## 数据持久化

当前已完成：

- `apps/desktop/src/renderer/features/todos/todoRepository.ts`
- `apps/desktop/src/renderer/features/todos/localTodoRepository.ts`
- `apps/desktop/src/renderer/features/todos/todoStore.ts`

现在第一版新增、完成的待办会写入 `localStorage`。后续如果要改成 Electron 文件存储，可以新增 `fileTodoRepository.ts`，继续实现同一个 `TodoRepository` 接口。

## 真实提醒

当前已预留：

- `apps/desktop/src/main/reminders/reminderTypes.ts`
- `apps/desktop/src/main/reminders/reminderScheduler.ts`
- `apps/desktop/src/main/reminders/notificationService.ts`

第一版界面不展示提醒时间、稍后或到点状态。当前只保留“哪些待办已经到点”的纯函数筛选，还没有启动定时器，也没有调用 Electron `Notification`。后续真实提醒应在主进程中接入，不要让 React 组件直接弹系统通知。

## Hermes 连接

当前已预留：

- `apps/desktop/src/renderer/features/sync/syncTypes.ts`
- `apps/desktop/src/renderer/features/sync/syncClient.ts`
- `apps/desktop/src/renderer/features/sync/syncQueue.ts`

现在 `syncClient.ts` 只提供禁用态实现，不发起网络请求。后续接 Hermes 时，优先补真实 `HermesSyncClient`，再让 `syncQueue.ts` 负责失败重试和状态回写。

## 飞书连接

当前策略：

- UI 不直接调用飞书。
- 飞书机器人和多维表格写入由 Hermes 负责。
- 前端只表达用户意图和同步状态。

这样可以避免桌面端保存飞书密钥，也便于统一日志、重试和权限控制。

## Agent 能力

当前已预留：

- `apps/desktop/src/renderer/features/agent/agentTypes.ts`
- `apps/desktop/src/renderer/features/agent/agentContext.ts`
- `apps/desktop/src/renderer/features/agent/agentClient.ts`
- `apps/desktop/src/renderer/features/agent/agentActionRegistry.ts`
- `apps/desktop/src/main/agent/agentBridge.ts`
- `apps/desktop/src/main/agent/agentPermissionPolicy.ts`

现在 Agent 只保留接口和禁用态实现，不调用模型、不联网、不改待办。未来应由 Hermes 承接 Agent 推理、飞书和长期任务，桌面端只展示建议并等待用户确认。详细说明见 `docs/agent-extension-points.md`。

## 当前周期计划界面

当前已新增：

- `apps/desktop/src/renderer/features/cyclePlans/cyclePlanTypes.ts`
- `apps/desktop/src/renderer/features/cyclePlans/cyclePlanModel.ts`
- `apps/desktop/src/renderer/features/cyclePlans/mockCyclePlans.ts`
- `apps/desktop/src/renderer/features/cyclePlans/cyclePlanRepository.ts`
- `apps/desktop/src/renderer/features/cyclePlans/localCyclePlanRepository.ts`
- `apps/desktop/src/renderer/features/cyclePlans/cyclePlanStore.ts`
- `apps/desktop/src/renderer/features/cyclePlans/CyclePlanView.tsx`
- `apps/desktop/src/renderer/features/cyclePlans/CyclePlanDetail.tsx`
- `apps/desktop/src/renderer/features/cyclePlans/ContentBlockPreview.tsx`
- `apps/desktop/src/renderer/features/cyclePlans/FitnessExerciseBlock.tsx`

第一版界面已经展示 `周期计划`。规则是：外层只按 `date` 匹配今天，不展示具体时间；细节进入 `contentBlocks`，健身动作列表有专用展示，未知 JSON/Markdown 块使用通用预览。当前数据仍是本地 demo 和 `localStorage`，不会联网生成真实计划。

## 统一周期计划合同

项目已经删除旧 `PlanEntry` 和滚动模板 Demo，只保留 `features/cyclePlans`。正式数据使用 `schemaVersion: 2`，具体说明见 `docs/cycle-plan-data-contract.md`。

后续 Hermes 不在桌面端执行滚动模板。Hermes 直接提交完整周期计划草稿；用户确认后再把计划从 `draft` 激活为 `active`，把条目从 `candidate` 转为 `pending`。

## 桌宠完整能力

当前已预留：

- `apps/desktop/src/main/pet/petWindowBounds.ts`
- `apps/desktop/src/main/pet/petPositionStore.ts`

现在只提供位置计算、边界夹取和内存位置存储。后续拖拽、贴边吸附、位置记忆、开机自启动、托盘菜单，都应该在 `src/main/pet/` 或 Electron 主进程附近继续扩展。

## 文件拆分约束

- 不把 Hermes、飞书、提醒、桌宠位置逻辑写进 `App.tsx`。
- 不把 Agent 推理、权限和联网逻辑写进 `TodoPanel.tsx` 或桌宠按钮组件。
- 不把业务逻辑写进 `TodoItem.tsx` 或 `TodoPanel.tsx`。
- 新增真实能力时，优先新增小模块和测试，再接入 UI。
