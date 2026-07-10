# Agent 扩展点说明

这份文档说明未来 Agent 能力如何接入桌宠待办项目。当前阶段只预留接口和测试，不做真实模型调用。

## 设计边界

- 桌面端负责：输入用户意图、整理待办上下文、展示 Agent 建议、等待用户确认。
- Hermes 负责：Agent 推理、长期任务、飞书机器人、多维表格记录、联网操作。
- Electron 本地不保存模型密钥，不直接调用飞书。
- Agent 返回的内容默认只是建议，不直接修改待办。

## 前端预留模块

当前已新增：

- `apps/desktop/src/renderer/features/agent/agentTypes.ts`
- `apps/desktop/src/renderer/features/agent/agentContext.ts`
- `apps/desktop/src/renderer/features/agent/agentClient.ts`
- `apps/desktop/src/renderer/features/agent/agentActionRegistry.ts`

职责说明：

- `agentTypes.ts`：定义 `AgentIntent`、`AgentContextSnapshot`、`AgentProposal`、`AgentAction`。
- `agentContext.ts`：从待办列表提取最小上下文；第一版主要使用标题和状态，后续提醒启用后可补充提醒时间和稍后次数。
- `agentClient.ts`：定义 `AgentClient` 接口；当前禁用态不联网。
- `agentActionRegistry.ts`：维护 Agent 可建议动作白名单，以及是否需要用户确认。
- `cyclePlan.createDraft`：允许 Hermes 返回统一周期计划草稿，但桌面端接收前必须由用户确认。

## 主进程预留模块

当前已新增：

- `apps/desktop/src/main/agent/agentBridge.ts`
- `apps/desktop/src/main/agent/agentPermissionPolicy.ts`

职责说明：

- `agentBridge.ts`：未来承接 renderer 到 Hermes Agent 的 IPC 或服务桥接。
- `agentPermissionPolicy.ts`：在主进程层面限制 Agent 动作，未知动作默认拒绝。

## 未来数据流

1. 用户在桌宠面板输入自然语言，例如“帮我安排今天的待办”。
2. 前端生成 `AgentIntent`。
3. `agentContext.ts` 从当前待办生成 `AgentContextSnapshot`。
4. `AgentClient` 把意图和上下文交给 Hermes Agent。
5. Hermes 返回 `AgentProposal[]`。
6. 前端展示建议，不直接执行。
7. 普通建议转换为待办操作；周期计划建议必须符合 v2 数据合同。
8. 用户确认周期计划草稿后，才允许进入本地计划仓储。
9. 待办和计划修改继续走本地持久化与 Hermes 同步队列。

## 安全默认值

- `todo.create`、`todo.complete`、`todo.snooze` 都需要用户确认。
- `cyclePlan.createDraft` 需要用户确认，且默认只接收 `draft/candidate` 状态。
- `plan.today` 只生成计划建议，不修改待办，因此不需要写入确认。
- 未知动作默认拒绝。
- 不把 `notes`、`syncStatus`、完整 UI 状态传给 Agent。

## 后续接入顺序

1. 在 Hermes 侧实现真实 Agent API。
2. 用真实实现替换 `createDisabledAgentClient()`。
3. 在桌宠面板新增一个轻量 Agent 输入入口。
4. 用确认弹层展示 `AgentProposal`。
5. 用户确认后，把 `AgentAction` 转换为现有待办操作。
6. 把执行后的待办事件进入同步队列，由 Hermes 继续记录飞书。
