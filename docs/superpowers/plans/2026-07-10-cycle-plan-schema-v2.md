# 周期计划统一数据结构 v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将项目收敛到唯一的无时间周期计划 JSON，并删除未接入主界面的旧计划模型。

**Architecture:** 当前 `features/cyclePlans` 继续作为正式领域边界，类型、纯函数、仓储和 UI 保持分层。仓储负责旧字符串来源到 v2 来源对象的兼容规范化，Agent 只通过白名单动作提交草稿建议。

**Tech Stack:** Electron、React、TypeScript、Vitest、localStorage。

## Global Constraints

- 所有新增和修改模块使用中文模块用途注释。
- 正式计划条目不包含具体时间。
- 单个 TS、TSX、CSS 文件不超过 220 行。
- 不接入真实 Hermes、飞书或模型网络调用。

---

### Task 1: 用测试定义唯一正式模型

**Files:**
- Modify: `apps/desktop/src/renderer/features/cyclePlans/cyclePlanModel.test.ts`
- Create: `apps/desktop/src/renderer/features/cyclePlans/localCyclePlanRepository.test.ts`
- Modify: `apps/desktop/src/renderer/features/agent/agentActionRegistry.test.ts`
- Modify: `apps/desktop/src/main/agent/agentPermissionPolicy.test.ts`

- [ ] 增加 v2 版本号、结构化来源和无时间字段断言。
- [ ] 增加旧字符串来源规范化为来源对象的仓储测试。
- [ ] 增加 `cyclePlan.createDraft` 白名单与确认策略测试。
- [ ] 运行目标测试，确认因为新结构尚未实现而失败。

### Task 2: 实现 v2 类型与兼容仓储

**Files:**
- Modify: `apps/desktop/src/renderer/features/cyclePlans/cyclePlanTypes.ts`
- Modify: `apps/desktop/src/renderer/features/cyclePlans/localCyclePlanRepository.ts`
- Modify: `apps/desktop/src/renderer/features/cyclePlans/mockCyclePlans.ts`
- Modify: `apps/desktop/src/renderer/features/cyclePlans/cyclePlanModel.ts`
- Modify: `apps/desktop/src/renderer/features/cyclePlans/CyclePlanCard.tsx`
- Modify: `apps/desktop/src/renderer/features/cyclePlans/CyclePlanDetail.tsx`

- [ ] 添加 `schemaVersion: 2` 和 `CyclePlanSource` 对象。
- [ ] 扩展计划与条目草稿状态。
- [ ] 仓储兼容规范化无版本号的旧数据。
- [ ] 更新 mock 和 UI 来源读取。
- [ ] 运行周期计划目标测试并确认通过。

### Task 3: 收敛待办与 Agent 契约

**Files:**
- Modify: `apps/desktop/src/renderer/features/todos/types.ts`
- Modify: `apps/desktop/src/renderer/features/todos/localTodoRepository.ts`
- Modify: `apps/desktop/src/renderer/features/todos/TodayTodoDetailDrawer.tsx`
- Modify: `apps/desktop/src/renderer/features/agent/agentTypes.ts`
- Modify: `apps/desktop/src/renderer/features/agent/agentActionRegistry.ts`
- Modify: `apps/desktop/src/main/agent/agentPermissionPolicy.ts`

- [ ] 删除旧 `TodoPlanEntrySnapshot`。
- [ ] 增加 `cyclePlan.createDraft` 建议动作并要求用户确认。
- [ ] 运行待办与 Agent 测试并确认通过。

### Task 4: 删除旧模型和引用

**Files:**
- Delete: `apps/desktop/src/renderer/features/plans/`
- Delete: `apps/desktop/src/renderer/styles/plan-demo.css`
- Delete: `apps/desktop/src/renderer/styles/plan-entry-detail.css`
- Delete: `docs/rolling-plan-demo.md`
- Modify: `apps/desktop/src/renderer/styles/global.css`

- [ ] 删除旧文件。
- [ ] 搜索 `PlanEntry`、`RollingTodoCandidate`、旧样式导入和时间计划字段，确认正式源码无残留。
- [ ] 运行 TypeScript 检查确认无失效引用。

### Task 5: 更新中文文档并完整验证

**Files:**
- Create: `docs/cycle-plan-data-contract.md`
- Modify: `docs/extension-points.md`
- Modify: `docs/agent-extension-points.md`
- Modify: `docs/file-structure.md`

- [ ] 记录正式 JSON、状态转换、来源字段和 Hermes 返回约束。
- [ ] 更新扩展点和文件结构，移除旧模型说明。
- [ ] 运行 `npm test`、`npm run typecheck` 和 `npm run build`。
- [ ] 检查所有源码文件不超过 220 行并确认中文 UTF-8 正常。
