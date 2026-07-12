# 后续功能扩展点

本项目按能力拆分模块，后续联网、提醒或 Agent 接入时不应把实现塞进 React 页面组件。

## 本地数据层

已完成：

- `src/main/storage/appStateTypes.ts`：版本化应用状态合同。
- `src/main/storage/appStateFileStore.ts`：原子写入、7 份备份、损坏恢复和导入校验。
- `src/main/storage/appStateService.ts`：串行更新，避免待办和计划互相覆盖。
- `src/main/storage/storageIpc.ts`：renderer 可调用的最小 IPC 白名单。
- `src/renderer/data/electronRepositories.ts`：把异步 IPC 适配为现有 repository 接口。
- `src/renderer/data/appDataBootstrap.ts`：选择正式 Electron 数据或浏览器 Demo 数据。

后续 schema 升级必须新增明确版本迁移，不直接修改旧文件含义。

## 周期计划

正式合同位于 `features/cyclePlans/cyclePlanTypes.ts`，使用 `schemaVersion: 2`。

- 手动内容：`kind: generic.note`、`format: markdown`。
- 专业内容：通过 `contentBlocks.kind` 区分，例如 `fitness.exercise_list`。
- 未知 `kind`：使用通用 JSON/Markdown 预览，不能阻塞新领域。
- 今日待办：只读取 `date` 命中的条目，不复制周期条目快照。

Hermes 未来直接提交完整计划草稿；桌面端不运行领域专用计划生成器。

## Hermes 与飞书

预留模块：

- `features/sync/syncClient.ts`
- `features/sync/syncQueue.ts`
- `features/sync/syncTypes.ts`

当前 client 为禁用态，不联网。飞书消息与多维表格应由 Hermes 代理，桌面端不保存模型或飞书密钥。

## Agent

预留模块：

- `features/agent/agentTypes.ts`
- `features/agent/agentContext.ts`
- `features/agent/agentClient.ts`
- `features/agent/agentActionRegistry.ts`
- `src/main/agent/agentBridge.ts`
- `src/main/agent/agentPermissionPolicy.ts`

未来流程固定为：用户意图 → 最小待办上下文 → Hermes 建议 → 用户确认 → 白名单动作 → 本地保存与同步队列。所有写操作默认需要确认。

## 系统提醒

预留模块位于 `src/main/reminders/`。当前第一版不展示具体时间，也不启动调度器或 Electron `Notification`。未来提醒必须在主进程实现，React 只展示状态。

## Windows 生命周期

已完成模块：

- `src/main/lifecycle/appLifecycle.ts`
- `src/main/lifecycle/trayController.ts`
- `src/main/lifecycle/dataTransferController.ts`

拖拽、贴边吸附和位置记忆继续放在 `src/main/pet/`，不要混入待办数据仓储。

## 文件约束

- `App.tsx` 只做顶层组合。
- 业务纯函数、store、视图、样式和主进程能力分文件维护。
- 新增能力先写失败测试，再实现和接线。
- TS、TSX、CSS 文件不超过 220 行。
