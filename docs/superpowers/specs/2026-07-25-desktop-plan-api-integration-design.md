# 桌面端接入 Plan API 设计

## 1. 背景

当前 Windows 桌宠已经具备待办、周期任务、AI 对话、角色动画和本地 JSON
持久化能力；云端 `Plan API` 已具备 SQLite 存储、鉴权、今日查询、快照查询和
原子变更接口。

下一阶段需要把两者连成一个正式可用的单用户系统：

```text
Windows 便携版桌宠
  -> Electron 主进程
  -> 主进程自动维护的 SSH 隧道 127.0.0.1:8743
  -> 云服务器 Plan API 127.0.0.1:8743
  -> SQLite plan.db
```

本设计是
[`2026-07-23-cloud-task-plan-api-design.md`](./2026-07-23-cloud-task-plan-api-design.md)
的桌面端接入补充。前一份文档定义云端模型和服务边界，本文件定义桌面运行时、
数据映射、迁移、缓存、错误处理和发布方式。

## 2. 目标

- Plan API 成为正式业务数据的唯一真实来源。
- 保留现有 React 页面和用户操作习惯，尽量不重写 UI 业务组件。
- Electron 主进程统一管理网络、Token、缓存、迁移和版本冲突。
- 将现有 `state.v1.json` 安全迁移到云端，迁移失败时不破坏原数据。
- 断网时允许查看最近快照，但不允许产生无法同步的本地写入。
- Windows 用户通过便携版 EXE 使用，不需要日常拉取源码。
- 为后续 Hermes 自然语言确认后提交计划保留受限接口边界。

## 3. 非目标

- 本阶段不实现离线写入队列、自动冲突合并或多端协同编辑。
- 本阶段不实现 PostgreSQL、多用户账号、飞书和系统级提醒。
- 本阶段不让 renderer 直接访问 HTTP、Token、SQLite 或 SSH。
- 本阶段不允许 Hermes 直接读取数据库文件、执行 SQL 或持有桌面 Token。
- 本阶段不删除现有本地 JSON；它会被转为只读迁移备份。

## 4. 核心决策

### 4.1 API 权威模式

完成首次迁移后，所有正式读取与写入均以 Plan API 为准。桌面端不得在 API
失败时静默写回本地 JSON，否则会形成两个互相冲突的数据源。

运行状态分为：

- `online`：读取 API，允许执行变更。
- `offline_cache`：显示最近成功快照，所有写操作禁用。
- `migration_required`：检测到旧数据且服务器为空，等待用户确认迁移。
- `migration_blocked`：服务器已有数据或迁移校验失败，停止自动迁移并说明原因。

### 4.2 SSH 隧道

云端 Plan API 继续只监听 `127.0.0.1:8743`，不开放公网业务端口。Windows
由 Electron 主进程调用系统自带的 `ssh.exe` 自动建立本地端口转发，桌面端
始终访问：

```text
http://127.0.0.1:8743
```

这样本地联调和云端运行使用相同 Base URL。SSH 登录密钥由 Windows
OpenSSH、`~/.ssh/config` 或 `ssh-agent` 管理，不写入应用配置和仓库。

自动隧道规则：

- 用户配置 SSH 目标，例如 `hermes-plan` 或 `ubuntu@服务器地址`。
- 主进程使用参数数组调用 `ssh.exe`，不经过 shell。
- 使用 `BatchMode=yes`，禁止应用内弹出密码输入。
- 使用 `ExitOnForwardFailure=yes`，端口转发失败时立即报告。
- 使用 ServerAlive 心跳检测断线，并采用有上限的退避重连。
- 本地开发模式可关闭隧道，直接连接本机 Plan API。
- 应用退出时只终止自己创建的 SSH 子进程。
- renderer 只能看到“连接中、已连接、重连中、失败”等状态。

### 4.3 密钥管理

- Desktop Token 只保存在 Electron `safeStorage` 加密配置中。
- renderer 只能读取脱敏连接状态，不能获得明文 Token。
- 云端模型密钥保存在 `~/.hermes/.env`。
- Plan API Token 保存在
  `~/.config/hermes-plan-api/plan-api.env`，文件权限为 `0600`。
- `.env`、Token、数据库、备份和本地缓存均不得提交 Git。

## 5. 模块与文件边界

```text
apps/desktop/src/main/planApi/
├── planApiRuntime.ts
├── planApiClient.ts
├── planApiErrors.ts
├── planApiConnectionStore.ts
├── planApiSshTunnel.ts
├── planApiSnapshotCache.ts
├── planApiMigrationService.ts
├── planApiMigrationFileStore.ts
├── planApiVersionIndex.ts
├── contentDocumentMapper.ts
├── snapshotMapper.ts
├── mutationAdapter.ts
├── todoMutationAdapter.ts
└── cycleMutationAdapter.ts

apps/desktop/src/shared/
└── planApiBridgeContract.ts

docs/
└── desktop-plan-api-integration.md
```

职责约束：

- `planApiRuntime` 负责组装客户端、缓存、迁移和 IPC，不承载具体映射逻辑。
- `planApiClient` 只处理 HTTP、鉴权、超时和响应解析。
- `planApiSshTunnel` 只负责 `ssh.exe` 生命周期、心跳与退避重连。
- `snapshotMapper` 将 API Task/Entry 转换为现有 UI 领域状态。
- `mutationAdapter` 将现有 `AppMutationOperation` 转换为 Plan API 操作。
- Todo 与 Cycle 的转换分别拆入独立适配器。
- `main.ts` 只增加一次运行时装配调用。
- `App.tsx` 不包含 HTTP、Token、迁移或 SQLite 逻辑。
- 新增 TS、TSX、CSS 和 Python 源码文件不超过 220 行。

## 6. 数据映射

### 6.1 普通待办

Plan API 中的普通待办使用：

- `Task.kind = daily`
- 一个 `TaskEntry`
- UI `Todo.id = TaskEntry.id`

主进程维护 `entryId -> taskId` 索引，renderer 不需要理解 Task 与 Entry
的数据库关系。

### 6.2 周期任务

- UI `CyclePlan.id = Task.id`
- UI 周期条目 ID 与 `TaskEntry.id` 保持一致
- 周期计划状态映射为 `active / paused / archived`
- 今日待办直接读取匹配日期的 Entry，不复制出第二份 Todo

旧状态迁移规则：

| 旧值 | Plan API 值 |
| --- | --- |
| 周期计划 `draft` | `paused` |
| 条目 `candidate` | `skipped` |
| 条目 `pending` | `pending` |
| 条目 `completed` | `completed` |
| 条目 `skipped` | `skipped` |

来源迁移规则：

| 旧来源 | Plan API 来源 |
| --- | --- |
| `manual` | `manual` |
| `ai_draft` | `hermes` |
| 规则生成 | `rule_generated` |

### 6.3 灵活内容

健身、学习、饮食等领域内容继续使用统一 `ContentDocument` 外壳。数据库把它
作为 JSON 存在 `content_json` 中，HTTP 以 JSON 传输。

- 已知 `kind` 可使用专用回显组件。
- 未知 `kind` 必须保留原数据并使用通用组件展示。
- 前端不在每次渲染时调用模型翻译。
- SQLite 保存结构化 JSON 字符串；未来迁移 PostgreSQL 时可改为 JSONB，
  不改变桌面与 API 合同。

## 7. 首次迁移

迁移只在以下条件同时满足时自动提出：

1. 本地存在有效 `state.v1.json`。
2. Plan API 可连接。
3. 云端快照为空。
4. 本机尚无成功迁移记录。

迁移流程：

1. 读取并校验旧状态。
2. 创建带时间戳的只读备份。
3. 将 Todo、CyclePlan 和条目映射为一批 API 操作。
4. 使用稳定幂等键一次提交。
5. 重新读取云端快照。
6. 比较任务数、条目数和关键 ID。
7. 校验成功后写入迁移完成记录。

任一步失败都不得改写原文件，也不得产生部分迁移。若服务器已有数据，桌面端
拒绝自动合并，显示阻塞原因，避免覆盖云端内容。

运行时文件放在应用数据目录：

```text
data/
├── state.v1.json
├── state.v1.pre-plan-api-时间戳.json
├── plan-api-cache.v1.json
├── plan-api-connection.v1.json
└── plan-api-migration.v1.json
```

迁移成功后，`state.v1.json` 和备份只用于历史恢复，不再承接任何业务写入。

## 8. 读取、写入与版本冲突

### 8.1 启动读取

1. renderer 请求应用状态。
2. 主进程读取连接配置并探测 Plan API。
3. 在线时读取 `/v1/snapshot`，映射后返回 renderer，并原子更新缓存。
4. 离线时读取缓存并标记为只读。
5. 无 API、无缓存时显示连接引导，不伪造空数据库。

### 8.2 写入

现有手动操作和 AI 确认操作继续进入统一 `AppMutationOperation`。主进程：

1. 校验操作。
2. 根据版本索引补充目标 Task/Entry 与预期版本。
3. 转换为 Plan API 批量操作。
4. 调用 `/v1/mutations`。
5. 成功后重新读取快照并返回最新状态。

主进程不乐观修改 renderer 数据；只有服务器确认后界面才前进。

### 8.3 冲突与错误

- `401/403`：连接配置错误，禁用写入并引导重新配置。
- 网络失败或超时：进入 `offline_cache`。
- 版本冲突：刷新最新快照，保留用户输入，提示重新确认。
- 校验失败：显示可读字段错误，不提交部分数据。
- 持久化失败：保持旧界面状态，记录不含敏感信息的诊断日志。

恢复连接后自动刷新快照，但不自动重放失败写入。

## 9. 设置页与用户体验

设置页新增第三个真实分区：

```text
外观 | 模型连接 | 数据服务
```

“数据服务”包含：

- 连接模式：本地直连或云端 SSH
- SSH 目标与本地/远端端口
- Desktop Token 输入与脱敏状态
- 测试连接
- 当前连接状态
- 最近同步时间
- 首次迁移预览与结果

状态文案至少区分：

- 未配置
- 正在连接
- 云端已连接
- 离线，只读显示缓存
- 需要迁移
- 迁移被阻止

离线时新增、编辑、完成、恢复、跳过、删除和 AI 提案确认按钮均禁用。浏览和
切换页面仍可使用，避免把网络故障表现为空白界面。

## 10. 发布与部署

### Windows

- 用户下载 GitHub Releases 中的免安装便携版 EXE。
- 日常使用不需要 `git pull`、Node.js 或 Python。
- 测试版与稳定版继续并存，验收后再提升版本。
- 连接配置和缓存位于 `%APPDATA%`，升级 EXE 不覆盖用户数据。

### 云服务器

- Plan API 源码通过 Git 更新。
- systemd 管理服务进程。
- SQLite `plan.db`、环境变量和备份位于仓库外。
- `git pull` 与代码部署不得覆盖数据库。
- 正式更新前先备份数据库并运行迁移。

## 11. Hermes 后续边界

Hermes 接入沿用同一 Plan API，但使用独立最小权限 Token。目标流程为：

```text
用户自然语言提出计划
  -> Hermes 正常讨论并补齐信息
  -> Skill 调用受限提案工具
  -> Plan API 保存 proposalId
  -> 用户在同一会话明确说“可以/确认/执行”
  -> Hermes 调用确认工具提交 proposalId
  -> Plan API 原子写入
  -> 桌面端刷新并回显
```

约束：

- 普通聊天不调用计划工具。
- Hermes 不获得数据库文件、任意 SQL 或 Desktop Token。
- 创建与调整先产生提案，不能绕过确认。
- 永久删除和批量覆盖需要更强的显式确认。
- 所有确认必须绑定会话、提案 ID、目标版本和幂等键。

本阶段只完成桌面端接入；提案路由、确认工具和 Hermes Plugin 的云端启用属于
下一阶段。

## 12. 文件管理与安全

- 仓库忽略 `.venv/`、`*.db`、`*.db-wal`、`*.db-shm`、本地缓存和备份。
- 不提交 `.env`、API Key、SSH 私钥、Token 或用户数据。
- 设计、实现计划、部署文档和运维脚本分别存放，避免单文件无限增长。
- 不把主进程、适配器、UI 和服务端合同写入同一个大文件。
- 当前脏工作树中的既有修改不得被迁移工作覆盖或回滚。

## 13. 验收标准

### 自动测试

- API 客户端鉴权、超时和错误分类。
- SSH 参数安全构造、启动失败、端口占用、断线重连和退出清理。
- Todo、CyclePlan、Entry 与 ContentDocument 双向映射。
- 所有现有手动操作到 API 操作的转换。
- 迁移备份、幂等、空服务器限制、失败回滚和重复启动。
- 缓存原子替换、损坏缓存回退和离线只读。
- 版本冲突刷新与禁止静默覆盖。
- Token 不进入 renderer、日志、缓存和测试快照。
- `npm test`、`npm run typecheck`、`npm run build` 通过。
- 所有新增源码文件保持不超过 220 行。

### 手动验收

1. 本地 Plan API 能显示并修改今日待办。
2. 旧 JSON 可一次迁移，重启后不会重复导入。
3. 关闭 API 后仍能浏览缓存，但所有写按钮禁用。
4. 恢复 API 后自动刷新为服务器数据。
5. SSH 隧道下连接云端，新增内容重启应用后仍存在。
6. 更新便携版 EXE 和服务器代码均不丢失数据库。

## 14. 实施顺序

1. 建立共享桥接合同、HTTP 客户端和错误模型。
2. 完成安全连接配置和自动 SSH 隧道。
3. 完成快照映射与只读启动链路。
4. 完成 Todo/Cycle 变更适配器和在线写入。
5. 完成缓存、版本索引和离线只读。
6. 完成旧 JSON 首次迁移。
7. 完成设置页“数据服务”分区。
8. 本地 API 全链路验收。
9. 自动 SSH 隧道云端验收。
10. 打包新的免安装测试副本。
11. 后续单独实施 Hermes 提案与确认工具。
