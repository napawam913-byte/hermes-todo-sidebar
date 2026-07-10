# 今日待办详情抽屉 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让今日待办复用固定双栏详情抽屉，并按手动或周期来源展示真实细节。

**Architecture:** 抽取通用 `DetailDrawerShell` 承担固定右栏壳层。周期任务和今日待办分别保留领域内容组件，`TodoPanel` 只转发统一的 `onDetailOpenChange`。

**Tech Stack:** React 19、TypeScript、Vite、Vitest、原生 CSS。

## Global Constraints

- 左栏固定 `360px`，右栏固定 `400px`，详情模式窗口固定 `760px`。
- 不新增依赖，不修改 Hermes、飞书和 Agent 数据层。
- 新模块使用中文用途与边界注释。
- 单个 TS、TSX、CSS 文件不超过 220 行。

---

### Task 1: 抽取通用详情抽屉

**Files:**
- Create: `apps/desktop/src/renderer/components/DetailDrawerShell.tsx`
- Create: `apps/desktop/src/renderer/styles/detail-drawer.css`
- Modify: `apps/desktop/src/renderer/features/cyclePlans/CyclePlanDrawer.tsx`
- Modify: `apps/desktop/src/renderer/styles/cycle-drawer.css`
- Modify: `apps/desktop/src/renderer/styles/cycleDrawerLayout.test.ts`
- Modify: `apps/desktop/src/renderer/styles/global.css`

**Interfaces:**
- Produces: `DetailDrawerShell({ label, title, onClose, children })`。
- Consumes: 现有 `IconButton`、固定双栏 CSS token 和 React children。

- [ ] **Step 1: 写入失败契约测试**

更新 `cycleDrawerLayout.test.ts`，断言通用 `.detail-drawer` 位于 `left: 360px`、宽 `400px`，并断言周期抽屉源码使用 `DetailDrawerShell`。

- [ ] **Step 2: 验证旧实现失败**

Run: `npm test -- cycleDrawerLayout`

Expected: FAIL，当前只有周期任务专用壳层。

- [ ] **Step 3: 实现通用壳层并迁移周期抽屉**

```tsx
<DetailDrawerShell label="周期任务详情" title={plan.title} onClose={onClose}>
  {周期条目与内容块}
</DetailDrawerShell>
```

- [ ] **Step 4: 验证通用布局契约通过**

Run: `npm test -- cycleDrawerLayout sourceFileSize`

Expected: PASS，通用抽屉与文件体积约束均通过。

### Task 2: 今日待办详情与点击状态

**Files:**
- Create: `apps/desktop/src/renderer/features/todos/TodayTodoDetailDrawer.tsx`
- Create: `apps/desktop/src/renderer/features/todos/TodayTodoCard.test.tsx`
- Create: `apps/desktop/src/renderer/styles/todo-detail.css`
- Modify: `apps/desktop/src/renderer/features/todos/TodayTodoCard.tsx`
- Modify: `apps/desktop/src/renderer/features/todos/TodayTodoView.tsx`
- Modify: `apps/desktop/src/renderer/features/todos/TodoPanel.tsx`
- Modify: `apps/desktop/src/renderer/App.tsx`
- Modify: `apps/desktop/src/renderer/styles/base.css`
- Modify: `apps/desktop/src/renderer/styles/todo-panel.css`
- Modify: `apps/desktop/src/renderer/styles/global.css`

**Interfaces:**
- Consumes: `TodayItem`、`ContentBlockPreview`、`SyncStatusPill`。
- Produces: `TodayTodoDetailDrawer({ item, onClose })` 与卡片 `onOpen` 交互。

- [ ] **Step 1: 写入失败卡片测试**

使用 `renderToStaticMarkup` 渲染 `TodayTodoCard`，断言存在 `aria-label="查看测试待办详情"`。

- [ ] **Step 2: 验证旧卡片不可打开详情**

Run: `npm test -- TodayTodoCard`

Expected: FAIL，旧卡片没有详情入口。

- [ ] **Step 3: 实现选择状态和领域详情**

卡片主体使用独立按钮打开详情；手动待办显示备注与同步状态，周期条目显示计划、日期与内容块。

- [ ] **Step 4: 验证今日详情测试通过**

Run: `npm test -- TodayTodoCard todayItems sourceFileSize`

Expected: PASS，详情入口、数据来源和文件体积均符合约束。

### Task 3: 浏览器与完整验证

**Files:**
- Verify: `http://127.0.0.1:5178/`

- [ ] **Step 1: 点击今日待办条目**

确认右栏打开，显示正确标题、来源、状态和内容块。

- [ ] **Step 2: 测量固定双栏**

确认主面板 `360px`、导航 `320px`、详情 `400px`、总宽 `760px`，没有横向溢出。

- [ ] **Step 3: 完整验证**

Run: `npm test`

Run: `npm run typecheck`

Run: `npm run build`

Expected: 三条命令均以退出码 `0` 完成。
