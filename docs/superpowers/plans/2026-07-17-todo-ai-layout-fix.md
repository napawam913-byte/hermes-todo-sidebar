# Todo And AI Layout Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复今日待办横向拉伸，并把 AI 对话改成带按需范围说明的全宽单栏。

**Architecture:** 每个工作页拥有一个明确根容器，父级只分配可用高度。AI 范围说明由独立组件管理，聊天编排不再依赖固定上下文栏。

**Tech Stack:** Electron、React、TypeScript、Vitest、CSS。

## Global Constraints

- 不修改待办、周期任务和 AI 提案数据合同。
- 新增及修改后的源码文件不超过 220 行。
- 新模块包含中文用途与边界注释。
- 不直接删除被替换模块，先添加 `[待删除-2026-07-17]` 标记。

---

### Task 1: 今日待办布局隔离

**Files:**
- Modify: `apps/desktop/src/renderer/features/todos/TodayTodoView.tsx`
- Modify: `apps/desktop/src/renderer/styles/todo-panel.css`
- Test: `apps/desktop/src/renderer/styles/aiPlannerLayout.test.ts`

**Interfaces:**
- Produces: `.today-todo-view`，一个填满可用高度的纵向根容器。

- [ ] 在样式测试中断言 `.today-todo-view` 使用纵向 flex，并禁止 `.panel-surface > :not([hidden])` 通用规则。
- [ ] 运行目标测试并确认先失败。
- [ ] 用 `.today-todo-view` 包裹摘要、筛选、快速新增和列表。
- [ ] 删除误伤页面内部节点的父级通用选择器。
- [ ] 再次运行目标测试并确认通过。

### Task 2: AI 单栏对话与操作范围

**Files:**
- Create: `apps/desktop/src/renderer/features/ai/AiScopePopover.tsx`
- Modify: `apps/desktop/src/renderer/features/ai/AiConversationPanel.tsx`
- Modify: `apps/desktop/src/renderer/features/ai/AiTaskContext.tsx`
- Modify: `apps/desktop/src/renderer/styles/ai-conversation.css`
- Test: `apps/desktop/src/renderer/styles/aiPlannerLayout.test.ts`

**Interfaces:**
- Produces: `AiScopePopover({ contextLabel })`，负责打开和关闭用户可读的操作范围说明。
- Consumes: `AiLaunchPresentation.contextLabel`。

- [ ] 在测试中断言对话为单列、旧 7/3 网格不存在、固定上下文栏不再渲染。
- [ ] 运行目标测试并确认先失败。
- [ ] 新建范围浮层组件，支持按钮、Escape 和点击外部关闭。
- [ ] 从对话组件移除 `AiTaskContext` 和收起状态，接入范围浮层。
- [ ] 重写单栏布局样式并保持消息区独立滚动。
- [ ] 标记旧上下文模块待删除并断开引用。
- [ ] 再次运行目标测试并确认通过。

### Task 3: 视觉与完整验证

**Files:**
- Modify: `docs/frontend-component-map.md`
- Modify: `docs/ai-conversation-flow.md`

- [ ] 在 `854px` 与 `360px` 下分别截图，检查今日待办、长对话、输入区和范围浮层。
- [ ] 更新中文组件及交互说明。
- [ ] 运行 `npm test`，预期所有测试通过。
- [ ] 运行 `npm run typecheck`，预期退出码为 0。
- [ ] 运行 `npm run build`，预期 Electron 与 Vite 构建通过。
- [ ] 检查源码文件行数，确认没有超过 220 行的新增或修改文件。
