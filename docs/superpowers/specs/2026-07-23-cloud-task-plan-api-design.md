# 云端统一任务数据库与 Hermes 工作流设计

## 决策摘要

项目从“Windows 本地 JSON 是唯一数据源”演进为“云端 Plan API 是唯一真实数据源”。Windows 桌宠和 Hermes Agent 都通过同一套受限 API 读写任务，任何一方都不能直接操作 SQLite 文件。

本设计采用以下已确认决策：

- 单用户、单台 Windows 电脑优先，不提前建设账号系统。
- 云端使用 Python FastAPI 和 SQLite，后续需要多用户时再迁移 PostgreSQL。
- 所有事项统一为任务，使用 `daily` 和 `cycle` 区分一次性任务与周期任务。
- 领域详情只存入 `content_json`；数据库只理解日期、状态、版本和生成规则。
- `content_json` 使用固定外壳和 AI 自定义字段，不为健身、学习、饮食分别建表。
- 固定计划保存明确日期条目；滚动计划由服务器稳定补足未来 7 天。
- Hermes 只在创建计划或用户要求调整时参与，不每天调用模型生成任务。
- Hermes 先创建提案；同一会话中用户明确确认后，受限确认工具才能提交。
- Windows 首期通过 SSH 隧道访问 Plan API，API 不暴露公网端口。
- Desktop Token 与 Hermes Token 分离，并使用最小权限。
- 云端不可用时桌面端只读显示最近快照，不允许离线修改。

## 目标

- 让每日待办和周期计划使用同一套任务、条目和状态模型。
- 让 Hermes 能通过自然语言创建或调整计划，同时保留确认、校验、幂等和审计边界。
- 让“今日待办”直接按日期读取，不复制周期条目形成第二份数据。
- 允许 AI 为任意任务领域生成结构化内容，而前端不需要理解所有领域。
- 保留当前桌宠 UI、角色动画和 Neutral Glass 视觉体系。
- 通过明确的数据网关隔离本地存储与云端存储，降低迁移风险。

## 非目标

- 第一版不支持多用户、团队空间或复杂账户体系。
- 第一版不支持离线写入、冲突合并或多端同时编辑。
- 第一版不实现具体时间、系统提醒、飞书同步和长期聊天记录。
- 第一版不把 Plan API 或 SQLite 直接暴露到公网。
- 第一版不允许 Hermes 执行任意 SQL、绕过提案确认或直接永久删除数据。
- 第一版不在每次前端回显时调用模型翻译内容。

## 总体架构

```text
Windows 桌宠
  -> SSH 本地端口
  -> Plan API
  -> SQLite

Hermes Agent
  -> cycle-plan Skill
  -> 受限 Plugin Tools
  -> Plan API
  -> SQLite
```

Plan API 是唯一业务写入边界，负责鉴权、JSON 校验、权限范围、版本冲突、事务、幂等和审计。Hermes Plugin 与桌面 Electron 主进程只作为 API 客户端。

建议模块边界：

```text
services/plan-api/                 云端 FastAPI 服务、数据库和迁移
integrations/hermes/cycle-plan/   Hermes Skill、工具和安装脚本
apps/desktop/src/main/cloud/      Electron 云端网关、缓存和连接状态
apps/desktop/src/shared/cloud/    跨端请求、响应和内容合同
docs/                             中文设计、部署和迁移说明
```

所有新增 TS、TSX、CSS 和 Python 源码文件继续控制在 220 行以内。路由、业务服务、仓储、合同和迁移必须拆分。

## 统一任务模型

所有业务数据由任务与日期条目组成：

- `daily`：一次性任务。服务层保证恰好拥有一个日期条目。
- `cycle`：周期任务。可以拥有多个日期条目。
- `fixed`：日期在创建或调整提案中明确给出。
- `rolling`：服务器按稳定规则持续补足未来 7 天。

`daily` 和 `cycle` 的条目使用相同状态与 `content_json`，因此今日列表不需要合并两个不同领域仓储。

## 数据库结构

### `tasks`

保存任务整体与生成元数据：

| 字段 | 类型 | 用途 |
| --- | --- | --- |
| `id` | TEXT PK | 服务器生成的稳定任务 ID |
| `kind` | TEXT | `daily` 或 `cycle` |
| `status` | TEXT | `active`、`paused` 或 `archived` |
| `generation_mode` | TEXT | `fixed` 或 `rolling` |
| `content_json` | TEXT | 任务标题、摘要、主题及其他领域内容 |
| `schedule_rule_json` | TEXT NULL | 滚动任务的稳定生成规则 |
| `generated_through_date` | TEXT NULL | 已补足到的最后日期 |
| `rule_revision` | INTEGER | 当前生成规则版本 |
| `version` | INTEGER | 乐观并发版本 |
| `created_at` | TEXT | UTC 创建时间 |
| `updated_at` | TEXT | UTC 更新时间 |

领域标题、主题和描述不建立独立列，统一位于 `content_json`。`kind`、状态、日期和版本必须保持为数据库字段，因为服务需要稳定查询与校验。

### `task_entries`

保存某一天真正进入待办视图的内容：

| 字段 | 类型 | 用途 |
| --- | --- | --- |
| `id` | TEXT PK | 服务器生成的稳定条目 ID |
| `task_id` | TEXT FK | 所属任务，删除任务时级联删除 |
| `scheduled_date` | TEXT | `YYYY-MM-DD` 日期 |
| `status` | TEXT | `pending`、`completed` 或 `skipped` |
| `content_json` | TEXT | 当天具体待办的领域内容 |
| `source` | TEXT | `manual`、`rule_generated` 或 `hermes` |
| `slot_key` | TEXT NULL | 生成槽位，用于防重复 |
| `is_overridden` | INTEGER | 是否被用户手动覆盖 |
| `generation_revision` | INTEGER NULL | 生成该条目的规则版本 |
| `version` | INTEGER | 乐观并发版本 |
| `created_at` | TEXT | UTC 创建时间 |
| `updated_at` | TEXT | UTC 更新时间 |
| `completed_at` | TEXT NULL | 完成时间 |

滚动条目使用唯一约束 `task_id + scheduled_date + slot_key`。SQLite 允许多个空 `slot_key`，因此手动条目不受该约束误伤。

### Agent 与系统表

- `agent_sessions`：关联 Hermes 会话与待确认提案。
- `agent_proposals`：保存提案 JSON、状态、过期时间、目标版本和幂等键。
- `audit_events`：记录操作者、动作、目标、提案和结果，不记录密钥。
- `schema_migrations`：记录数据库迁移版本、校验和与应用时间。

提案状态固定为 `pending`、`applied`、`cancelled`、`expired` 或 `failed`。未确认内容只能存在于 `agent_proposals`，不能提前进入正式任务表。

## 通用内容合同

数据库不理解健身、学习或饮食字段，但要求 `content_json` 具有稳定外壳：

```json
{
  "schemaVersion": 1,
  "kind": "fitness.workout",
  "title": "上肢力量训练",
  "summary": "6 个动作，卧推 3 组",
  "locale": "zh-CN",
  "sections": [
    {
      "id": "exercises",
      "label": "训练动作",
      "layout": "list",
      "items": [
        {
          "title": "卧推",
          "fields": [
            {
              "key": "reps",
              "label": "每组次数",
              "type": "number_list",
              "value": [15, 12, 12]
            },
            {
              "key": "rir",
              "label": "剩余次数",
              "type": "number",
              "value": 3
            }
          ]
        }
      ]
    }
  ]
}
```

固定部分是 `schemaVersion`、`kind`、`title`、`summary`、`locale` 和 `sections`。领域差异位于分区、字段与值中。

字段至少包含：

- `key`：稳定机器名称。
- `label`：创建时使用的显示语言。
- `type`：通用渲染提示。
- `value`：受大小和深度限制的任意 JSON 值。

第一版通用类型包括 `text`、`number`、`boolean`、`number_list`、`tag_list`、`duration_minutes`、`markdown` 和 `object`。未知类型不得阻止读取，前端使用通用 JSON 预览。

模型必须根据目标语言直接生成 `label`。前端显示时不调用模型翻译。未来切换语言时使用显式翻译提案并保存结果，不能在每次渲染时产生不稳定翻译。

服务端严格校验外壳，拒绝未知顶层字段、非法类型、非 JSON 值和超限内容。建议初始限制为单个内容 64 KB、嵌套深度 8 层、单数组 200 项。

## 滚动生成规则

`rolling` 任务在 `schedule_rule_json` 中保存规则，不依赖 Hermes 每日运行：

```json
{
  "schemaVersion": 1,
  "timezone": "Asia/Shanghai",
  "horizonDays": 7,
  "slots": [
    {
      "slotKey": "strength",
      "cadence": {
        "type": "weekly",
        "weekdays": [1, 3, 5]
      },
      "content": {
        "schemaVersion": 1,
        "kind": "fitness.workout",
        "title": "力量训练",
        "summary": "按训练动作完成当日计划",
        "locale": "zh-CN",
        "sections": []
      }
    }
  ]
}
```

第一版滚动节奏支持 `daily` 和 `weekly`。不规则日期使用 `fixed` 明确列出，避免设计不完整的自定义日历语言。

服务器在以下时机确保未来 7 天窗口完整：

- Plan API 启动时。
- 每日系统定时任务执行时。
- 查询今日待办前发现窗口不足时。

调整规则时：

- 历史条目、已完成条目和跳过记录保持不变。
- `is_overridden = true` 的手动覆盖条目保持不变。
- 未来仍为 `pending` 的规则生成条目可以按新规则替换。
- 提案必须明确展示将新增、替换和删除的未来条目数量。
- 整批调整在一个事务内完成，失败时全部回滚。

## 今日待办规则

今日视图由服务器查询，不由前端拼接：

- 只读取 `tasks.status = active` 的条目。
- `scheduled_date = 今天` 且状态符合当前筛选的条目进入今日列表。
- 日期早于今天且仍为 `pending` 的条目标记为逾期。
- `completed_at` 为今天的条目可以进入“已完成”筛选。
- `skipped` 默认不进入今日列表。
- 完成周期条目只更新原始条目，不复制为普通待办。

日期按照任务规则中的 `Asia/Shanghai` 解释，时间戳统一保存为 UTC。

## Plan API

第一版 API 包含：

- `GET /v1/health`：服务、数据库和版本状态。
- `GET /v1/snapshot`：桌面端完整快照与服务端修订号。
- `GET /v1/today?date=YYYY-MM-DD`：今日与逾期条目。
- `GET /v1/tasks`：任务列表。
- `GET /v1/tasks/{id}`：任务、规则与条目详情。
- `POST /v1/mutations`：桌面端手动原子操作。
- `POST /v1/proposals`：Hermes 创建受限提案。
- `GET /v1/proposals/{id}`：读取提案状态。
- `POST /v1/proposals/{id}/confirm`：确认并原子应用。
- `POST /v1/proposals/{id}/cancel`：取消待确认提案。

所有写请求必须携带幂等键。修改和删除操作必须携带 `expectedVersion`。任一操作失败时整批不落库，并返回结构化原因：

- `target_missing`
- `version_conflict`
- `validation_failed`
- `permission_denied`
- `proposal_expired`
- `persistence_failed`

每次成功事务递增服务端修订号，桌面端据此判断是否需要刷新快照。

## Hermes Skill 与工具

Hermes 保持通用聊天助手。只有明确的创建、制定、安排、生成或调整计划意图才加载周期计划 Skill。

建议工具：

- `task_today_get`：读取必要的今日上下文。
- `cycle_plan_list`：列出计划摘要。
- `cycle_plan_get`：读取一个目标计划。
- `cycle_plan_propose_create`：创建新计划提案。
- `cycle_plan_propose_adjust`：创建目标计划调整提案。
- `proposal_confirm`：确认同一会话中的待处理提案。
- `proposal_cancel`：取消待处理提案。

Hermes Token 只能使用读取、提案和确认端点，不能调用桌面手动 mutation，也不能接触 SQLite 文件。
