# 桌面端接入 Plan API 实施计划索引

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Windows 桌宠从本地 JSON 权威存储切换为 Plan API 权威存储，并完成自动 SSH 隧道、一次性迁移、离线只读和前端数据服务状态。

**Architecture:** 实施按三个可独立审查的阶段展开。第一阶段只建立纯合同、映射和 API 适配核心；第二阶段接入加密配置、自动 SSH 隧道、运行时缓存与旧数据迁移；第三阶段连接 React 设置页、AI 提案执行和便携版发布。

**Tech Stack:** Electron 43、React 19、TypeScript 5.7、Vitest 3、Node.js Fetch、Windows OpenSSH、FastAPI、SQLite。

## Global Constraints

- Plan API 是正式业务数据的唯一真实来源。
- API 不可用时只读显示最近缓存，禁止任何本地回退写入。
- renderer 不得接触 Desktop Token、SSH、HTTP、SQLite 或文件路径。
- SSH 隧道由 Electron 主进程通过无 shell 的 `ssh.exe` 子进程自动维护。
- SSH 私钥只由 Windows OpenSSH、`~/.ssh/config` 或 `ssh-agent` 管理。
- 旧 `state.v1.json` 迁移前必须备份，迁移成功后不再承接业务写入。
- Hermes 与手动操作必须共用同一 Plan API 变更执行边界。
- 不引入 Redux、Zustand、Axios、Zod 或 SSH 第三方依赖。
- 所有新增 TS、TSX、CSS 和 Python 源码文件不超过 220 行。
- 不提交 `.env`、Token、SSH 私钥、数据库、缓存、备份或测试用户数据。
- 当前工作树已有修改不得被回滚、覆盖或混入无关提交。
- 每次提交前必须运行 `git diff --cached --name-only` 并核对精确文件集合。

---

## 执行阶段

1. [阶段一：核心合同、映射与变更适配](./2026-07-25-desktop-plan-api-01-core.md)
2. [阶段二：连接、自动 SSH 隧道、缓存与迁移](./2026-07-25-desktop-plan-api-02-connection-migration.md)
3. [阶段三：前端状态、AI 网关、文档与发布](./2026-07-25-desktop-plan-api-03-ui-release.md)

三个阶段必须按顺序执行。后续阶段只能消费前一阶段明确导出的接口，不得绕过接口直接引用内部实现。

## 提交纪律

每个任务完成后执行：

```powershell
git diff --check
git diff --cached --name-only
git status --short
```

预期：

- `git diff --check` 无输出。
- 暂存区仅包含当前任务列出的文件。
- 既有脏文件仍保持原状态，没有被重置或覆盖。

若当前任务必须修改一个已经存在其他未提交改动的文件，先阅读完整 diff，再只提交本任务对应的补丁；无法安全拆分时停止该次提交，但继续保留已验证的工作树改动。

## 阶段验收门

- 阶段一结束：所有纯 TypeScript 合同、映射、适配器和缓存测试通过，尚不切换正式数据源。
- 阶段二结束：Electron 可在本地直连和自动 SSH 两种模式下读取、写入、缓存并迁移，正式写入已不再进入本地 JSON。
- 阶段三结束：设置页可管理数据服务，断网状态明确只读，AI 提案共用云端执行器，`0.2.0-test.1` 免安装测试副本可供人工验收。
