# Hermes 周期任务扩展

本扩展把 Hermes 变成桌宠的自然语言入口，同时保留明确的确认边界：

```text
普通聊天
  ↓ 明确制定或调整计划
Hermes Skill
  ↓ 调用受限 Plugin
Plan API 创建 pending 提案
  ↓ 用户在同一会话明确确认
Plan API 原子写入 SQLite
  ↓
Windows 桌宠读取并回显
```

## 能力

- 查询指定日期的今日任务。
- 列出并读取周期任务。
- 创建周期任务提案。
- 调整一个指定周期任务及其条目的提案。
- 在同一 Hermes 会话中确认或取消提案。

Plugin 不提供桌面 `/v1/mutations` 权限，不直接读写 SQLite，也不会在没有确认的情况下保存计划。

## 环境配置

在云服务器的 `~/.hermes/.env` 中配置：

```bash
PLAN_API_BASE_URL=http://127.0.0.1:8743
PLAN_HERMES_TOKEN=请填入服务端生成的_Hermes_专用_Token
```

不要把真实 Token 提交到 Git。Plan API 和 Hermes 部署在同一服务器时，优先使用 `127.0.0.1`，无需把数据库接口开放到公网。

## 安装

```bash
cd integrations/hermes/cycle-plan
chmod +x install.sh
./install.sh
```

脚本会：

1. 使用 Hermes Token 验证 Plan API 读取权限。
2. 复制 Plugin 到 `~/.hermes/plugins/cycle-plan-tools/`。
3. 复制 Skill 到 `~/.hermes/skills/cycle-plan/SKILL.md`。
4. 运行扩展测试、启用 Plugin 并重启 Gateway。

## 工具清单

| 工具 | 用途 | 是否写入 |
|---|---|---|
| `cycle_plan_today` | 读取日期对应任务 | 否 |
| `cycle_plan_list` | 读取周期任务摘要 | 否 |
| `cycle_plan_get` | 读取一个任务快照 | 否 |
| `cycle_plan_propose_create` | 创建待确认提案 | 仅提案 |
| `cycle_plan_propose_adjust` | 创建调整提案 | 仅提案 |
| `cycle_plan_confirm` | 用户确认后原子应用 | 是 |
| `cycle_plan_cancel` | 取消待确认提案 | 否 |

## 自然语言示例

```text
用户：我刚开始健身，一周练三次，帮我制定四周计划。
Hermes：先补充一个关键问题……
用户：每次做全身训练。
Hermes：已生成待确认提案，概述如下……是否确认？
用户：可以。
Hermes：调用 cycle_plan_confirm，成功后说明已写入。
```

普通的“初学者一周练几次合适”只作为聊天回答，不调用计划工具。

## 安全建议

运行 `hermes tools`，针对实际聊天平台只启用：

- Skills
- Memory
- 必要的 Web/Search
- `cycle_plan`

关闭 Terminal、File、Code、Delegation 与 Cron，避免远程聊天拥有无关的高权限能力。

官方依据：[Hermes Plugins](https://hermes-agent.nousresearch.com/docs/user-guide/features/plugins) 与 [Creating Skills](https://hermes-agent.nousresearch.com/docs/developer-guide/creating-skills)。
