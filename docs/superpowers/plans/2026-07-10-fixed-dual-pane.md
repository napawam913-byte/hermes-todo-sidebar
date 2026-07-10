# 固定双栏详情面板 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复周期任务详情打开后左侧导航和内容被拉伸的问题，并完成固定 `360px + 400px` 双栏视觉整理。

**Architecture:** 保留现有 React 组件边界，布局契约集中在 CSS。`sidebar.css` 固定主面板，`cycle-drawer.css` 管理详情栏、分隔、滚动和动画，`base.css` 统一键盘焦点。

**Tech Stack:** React 19、TypeScript、Vite、Vitest、原生 CSS。

## Global Constraints

- 左侧主面板固定 `360px`，右侧详情固定 `400px`。
- 不新增第三方依赖。
- 单个 TS、TSX、CSS 文件保持在 220 行以内。
- 新增模块使用中文用途注释。
- 第一版不修改 Hermes、飞书和 Agent 数据逻辑。

---

### Task 1: 建立布局回归契约

**Files:**
- Create: `apps/desktop/src/renderer/styles/cycleDrawerLayout.test.ts`
- Modify: `apps/desktop/src/renderer/styles/sidebar.css`
- Modify: `apps/desktop/src/renderer/styles/todo-panel.css`
- Modify: `apps/desktop/src/renderer/styles/cycle-drawer.css`

**Interfaces:**
- Consumes: 现有 `.sidebar-shell`、`.sidebar-content`、`.todo-panel`、`.cycle-plan-drawer`。
- Produces: `360px + 400px` 固定双栏 CSS 契约。

- [ ] **Step 1: 写入失败测试**

测试读取三个 CSS 文件，断言主面板宽度为 `360px`、展开容器为 `760px`、详情从 `360px` 开始且宽度为 `400px`。

- [ ] **Step 2: 验证测试按预期失败**

Run: `npm test -- cycleDrawerLayout`

Expected: FAIL，旧样式仍为 `720px` 容器、`384px` 起点和 `336px` 抽屉。

- [ ] **Step 3: 实现最小布局修复**

```css
.sidebar-shell:has(.cycle-plan-drawer) { width: 760px; }
.sidebar-content, .todo-panel { width: 360px; }
.cycle-drawer-scrim { left: 360px; width: 1px; }
.cycle-plan-drawer { left: 360px; width: 400px; }
```

- [ ] **Step 4: 验证布局测试通过**

Run: `npm test -- cycleDrawerLayout`

Expected: PASS，1 个测试文件无失败。

### Task 2: 视觉收敛与浏览器验收

**Files:**
- Modify: `apps/desktop/src/renderer/styles/base.css`
- Modify: `apps/desktop/src/renderer/styles/cycle-drawer.css`

**Interfaces:**
- Consumes: 现有设计 token、计划卡和日期条目 DOM。
- Produces: 固定标题、独立滚动、统一选中态和焦点态。

- [ ] **Step 1: 整理详情视觉**

把详情标题设为 sticky，移除灰色夹层，日期条目改为紧凑列表，选中态使用完整边框和浅青背景。

- [ ] **Step 2: 统一焦点样式**

为 `.top-mode-tab`、`.cycle-plan-card`、`.cycle-entry-card` 增加 `2px` 青绿色 `focus-visible` 轮廓。

- [ ] **Step 3: 浏览器点击验收**

在 `http://127.0.0.1:5178/` 点击“周期任务”与“健身计划”，测量主面板 `360px`、顶部导航不变、详情 `400px`。

- [ ] **Step 4: 完整验证**

Run: `npm test`

Run: `npm run typecheck`

Run: `npm run build`

Expected: 三条命令均以退出码 `0` 完成。

### Task 3: 自动守卫源码文件体积

**Files:**
- Create: `apps/desktop/src/renderer/styles/sourceFileSize.test.ts`
- Create: `apps/desktop/src/renderer/styles/todo-state.css`
- Modify: `apps/desktop/src/renderer/styles/todo-panel.css`
- Modify: `apps/desktop/src/renderer/styles/global.css`

**Interfaces:**
- Consumes: `apps/desktop/src` 下的 TS、TSX、CSS 文件。
- Produces: 单文件不超过 220 行的自动化回归约束。

- [ ] **Step 1: 写入失败测试**

递归读取源码目录，列出所有超过 220 行的 TS、TSX、CSS 文件，并断言结果为空。

- [ ] **Step 2: 验证测试捕获超限文件**

Run: `npm test -- sourceFileSize`

Expected: FAIL，并报告旧版 `todo-panel.css` 超过 220 行。

- [ ] **Step 3: 按职责拆分样式**

把来源标签和空状态移动到 `todo-state.css`，由 `global.css` 统一导入。

- [ ] **Step 4: 验证文件体积守卫通过**

Run: `npm test -- sourceFileSize`

Expected: PASS，源码目录不存在超限文件。

### Task 4: 联动 Electron 原生窗口宽度

**Files:**
- Modify: `apps/desktop/src/main/sidebarBounds.ts`
- Modify: `apps/desktop/src/main/sidebarBounds.test.ts`
- Modify: `apps/desktop/src/main/main.ts`
- Modify: `apps/desktop/src/preload/preload.ts`
- Modify: `apps/desktop/src/renderer/vite-env.d.ts`
- Modify: `apps/desktop/src/renderer/App.tsx`
- Modify: `apps/desktop/src/renderer/features/sidebar/SidebarShell.tsx`
- Modify: `apps/desktop/src/renderer/features/todos/TodoPanel.tsx`
- Modify: `apps/desktop/src/renderer/features/cyclePlans/CyclePlanView.tsx`

**Interfaces:**
- Consumes: `detailOpen: boolean` 和已有 `sidebar:set-expanded` IPC。
- Produces: `sidebar:set-detail-open` IPC 与 `760px` 详情模式原生窗口 bounds。

- [ ] **Step 1: 写入原生窗口失败测试**

在 `sidebarBounds.test.ts` 断言 `expanded: true, detailOpen: true` 返回右侧贴边的 `760px` 窗口。

- [ ] **Step 2: 验证旧实现仍返回 360px**

Run: `npm test -- sidebarBounds cycleDrawerLayout`

Expected: FAIL，详情模式仍返回 `360px`，分隔层仍位于抽屉下方。

- [ ] **Step 3: 打通详情状态与窗口几何**

由周期任务视图上报详情状态，经 App、SidebarShell、preload 发送到主进程，再由 `calculateSidebarBounds` 计算 `360px` 或 `760px`。

- [ ] **Step 4: 验证窗口与分隔契约**

Run: `npm test -- sidebarBounds cycleDrawerLayout sourceFileSize`

Expected: PASS，详情窗口为 `760px`，分隔层显示在抽屉上方，文件均不超过 220 行。
