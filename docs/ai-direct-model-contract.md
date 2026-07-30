# 大模型直连与变更提案合同

## 当前目标

`0.1.3` 测试版允许单机 Electron 应用直接调用 OpenAI 兼容的 `chat/completions` 接口。用户用自然语言描述想要的调整，模型只生成变更提案；桌面端展示整批预览，用户确认后才写入本地数据。

第一版不接 Hermes、不自动执行、不保存聊天记录，也不处理具体时间和系统提醒。

## 本地完整交互闭环

`0.1.3-test.8` 中，周期任务内容只通过 AI 提案创建或调整；普通待办和周期任务状态操作仍使用手动入口。所有写入共用 `AppMutationOperation` 白名单，并最终进入主进程 `AppMutationExecutor`：先校验批次和目标版本，在克隆状态上执行全部操作，再通过 `AppStateService.transact()` 一次写入。任一步失败都不会替换 renderer 当前快照。

普通待办支持手动新增、修改、完成、恢复和永久删除。周期计划可手动启用、暂停、归档和删除；周期条目可手动完成、恢复、跳过和删除。周期任务内容的新建和修改必须由 API 生成提案。修改与删除操作必须携带 `expectedUpdatedAt`，以阻止过期界面覆盖较新的本地数据。

Electron 数据文件位于测试用户目录下的 `data/state.v1.json`，采用临时文件替换并保留最近 7 份备份。浏览器预览不访问该文件，只在当前站点 `localStorage` 中模拟同样的操作语义。

## 用户流程

1. 在 `周期任务` 页面点击 `AI 生成周期任务`，或在计划详情中点击 `AI 调整`。
2. 二级导航固定为 `‹ 周期任务 / 对话 / 提案 N`；首次使用先填写 `Base URL`、`API Key` 和模型名称，未配置时禁用对话入口。
3. 用自然语言描述要生成的周期任务，或补充当前计划的调整要求。
4. 模型需要更多信息时留在对话页追问；信息足够时生成变更提案。
5. 前端显示每一项新增、修改、状态变化和永久删除，删除在清单与确认区重复提示不可恢复。
6. 用户点击 `确认执行` 后，主进程校验整批操作并一次性保存；执行期间锁定确认按钮。
7. 任一目标不存在、版本冲突、字段无效或持久化失败时，整批回滚。
8. 成功后按受影响数据提供 `查看今日待办`、`查看周期任务` 或两个入口。

## 数据发送范围

生成提案时会发送当前全部待办和周期计划，包括：

- ID、标题、日期、状态和 `updatedAt`。
- 周期计划的主题、描述、条目和 `contentBlocks`。
- 当前页面中的轻量对话历史。

不会发送 API Key、桌宠坐标、Electron 窗口状态、导出文件和飞书凭据。聊天记录和未执行提案只存在于当前应用会话；切换顶部页面和收起桌宠不会清除，应用重启后不会恢复。

## 配置与密钥

- 配置文件：用户数据目录下的 `ai-model-config.v1.json`。
- API Key：先通过 Electron `safeStorage` 加密，再以密文写入配置文件。
- renderer：只能读取脱敏配置，例如 `sk-••••••1234`。
- 网络请求：只在 Electron 主进程执行；renderer 不接触 `fetch` 和明文密钥。
- 日志与错误：不记录请求正文、服务端响应正文或 API Key。
- 结构化输出：优先请求严格 `json_schema`；兼容网关拒绝或断开该请求时自动降级为 `json_object`，返回内容仍由本地严格校验。
- 网络诊断：超时、DNS、拒绝连接或连接重置会显示对应错误代码，便于区分配置问题与服务端波动。

## 提案合同

顶层合同为 `AiMutationProposal v1`：

```json
{
  "schemaVersion": 1,
  "proposalId": "proposal_...",
  "summary": "创建健身计划并加入三条日期任务",
  "operations": []
}
```

模型只返回 `schemaVersion`、`summary` 和 `operations`。`proposalId`、新对象 ID、时间戳、来源和冲突版本由桌面主进程补充。

底层合同继续支持以下操作白名单：

- `todo.create / update / complete / reopen / delete`
- `cyclePlan.create / update / setStatus / delete`
- `cyclePlan.entry.create / update / complete / reopen / skip / delete`

单批最多 50 项。外层对象和操作对象禁止未知字段；只有 `contentBlocks.data` 允许领域自定义 JSON。

每次请求必须携带生成上下文：

- `cyclePlan.create`：只允许返回 `cyclePlan.create`，初始日期条目放在 `draft.entries`。
- `cyclePlan.adjust`：必须携带 `targetPlanId`，只允许修改该计划及其已有条目。

模型返回普通待办操作、其他计划 ID 或不属于目标计划的条目 ID 时，主进程会拒绝整份提案。

## 提案生命周期

- 返回对话调整时保留当前提案，`提案 N` 可随时切回查看。
- 生成请求携带可选 `supersedesProposalId`；只有新提案成功注册后，主进程才注销旧提案。
- 追问、网络错误和解析失败都不会覆盖已有提案。
- 点击 `放弃草稿` 会通过 `discardProposal(proposalId)` 同时清除 renderer 状态和主进程待执行缓存。
- 失败提案以只读结果保留；`刷新并重新生成` 会读取最新本地数据，并复用最后一次用户指令。
- 应用重启不恢复会话或未执行提案，不形成长期聊天记录。

创建全新周期计划时，`cyclePlan.create.draft.entries` 可以携带初始日期条目。桌面端确认后一次生成计划、条目和内容块 ID，因此模型不需要引用尚不存在的 `planId`。

## 原子执行

确认执行时，renderer 只提交 `proposalId`，不回传可被篡改的操作正文。主进程从内存中的待确认提案读取原始操作，并执行：

1. 校验所有目标 ID 存在。
2. 比较 `expectedUpdatedAt`，阻止旧提案覆盖新数据。
3. 在克隆状态上依次应用所有操作。
4. 全部成功后通过 `AppStateService.transact()` 保存一次。
5. 任一操作失败时放弃克隆状态，不修改正式文件。

执行失败使用结构化原因：

- `target_missing`：目标已不存在。
- `version_conflict`：`updatedAt` 与提案版本不一致。
- `validation_failed`：提案格式或操作组合无效。
- `persistence_failed`：本地文件无法完成一次性保存。

执行成功后提案变为只读结果；`继续调整` 返回对话并保留本次结果上下文。失败后重新生成的新提案只有在成功注册后才替换旧失败记录。

永久删除没有回收站。删除周期计划会同时移除它的全部日期条目，因此前端必须显示危险标签和不可恢复说明。

## Hermes 替换边界

未来接入 Hermes 时保留以下模块和合同：

- `AiMutationProposal v1` 与操作白名单。
- 本地严格校验、冲突检查、整批预览和原子执行。
- renderer 的对话、提案和确认页面。

只替换主进程中的模型客户端与身份配置：Hermes 负责大模型、长期对话、飞书和联网工具；桌面端继续负责本地上下文整理、用户确认和本地写入。Hermes 模式下桌面端不再保存模型供应商 API Key。
