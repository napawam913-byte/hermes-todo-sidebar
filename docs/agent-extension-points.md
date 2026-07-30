# Agent 扩展点说明

这份文档说明未来 Agent 能力如何接入桌宠待办项目。当前 `features/agent` 仍只预留接口；`0.1.3` 的真实模型调用属于独立 AI 提案层，不代表 Hermes Agent 已接入。

## 设计边界

- 桌面端负责：输入用户意图、整理待办上下文、展示 Agent 建议、等待用户确认。
- Hermes 负责：Agent 推理、长期任务、飞书机器人、多维表格记录、联网操作。
- 当前直连测试版会用 Electron `safeStorage` 加密保存模型 API Key；未来切换 Hermes Agent 后，桌面端不再保存模型供应商密钥，也不直接调用飞书。
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
- `cyclePlan.createDraft`：早期 Agent 动作预留，当前运行时不使用；未来 Hermes 适配器必须先转换为 `AiMutationProposal v1` 的 `cyclePlan.create`。

## 主进程预留模块

当前已新增：

- `apps/desktop/src/main/agent/agentBridge.ts`
- `apps/desktop/src/main/agent/agentPermissionPolicy.ts`

职责说明：

- `agentBridge.ts`：未来承接 renderer 到 Hermes Agent 的 IPC 或服务桥接。
- `agentPermissionPolicy.ts`：在主进程层面限制 Agent 动作，未知动作默认拒绝。

## 未来数据流

1. 用户从周期任务页发起创建或指定计划调整。
2. 桌面端整理 `AiGenerationContext` 与当前本地数据快照。
3. `AgentClient` 把意图和上下文交给 Hermes Agent。
4. Hermes 返回 `AiMutationProposal v1`，不返回可直接执行的自由工具调用。
5. 主进程校验创建/调整作用域、JSON Schema 和目标版本。
6. 前端展示整批建议，不直接执行。
7. 用户确认后由现有 `AppMutationExecutor` 原子写入本地数据。
8. 执行后的事件再进入 Hermes 同步队列和飞书记录流程。

## 安全默认值

- `todo.create`、`todo.complete`、`todo.snooze` 都需要用户确认。
- 旧 `cyclePlan.createDraft` 不能直接写入，必须转换成 `cyclePlan.create` 提案并经过预览确认。
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
