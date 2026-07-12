# Hermes 待办桌宠单机正式版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前前端 Demo 升级为可在单台 Windows 电脑长期使用的本地桌宠待办应用。

**Architecture:** renderer 继续按 feature 分层，Electron 主进程新增文件仓储与生命周期服务，通过 preload IPC 提供最小数据 API。周期计划保持 v2 统一 JSON，手动编辑只新增 `generic.note` Markdown 内容块。

**Tech Stack:** Electron 37、React 19、TypeScript、Vitest、electron-builder、Windows NSIS。

## Global Constraints

- 正式计划和待办只使用日期，不新增具体时间安排。
- 主进程不理解领域内容块，renderer 不直接访问文件系统。
- 所有新模块有中文用途与边界注释。
- 单个 TS、TSX、CSS 文件不超过 220 行。
- 不连接 Hermes、飞书或模型服务。

---

### Task 1: 日期级待办与逾期列表

**Files:**
- Modify: `apps/desktop/src/renderer/features/todos/types.ts`
- Modify: `apps/desktop/src/renderer/features/todos/todoModel.ts`
- Modify: `apps/desktop/src/renderer/features/todos/todoModel.test.ts`
- Modify: `apps/desktop/src/renderer/features/todos/todayItems.ts`
- Modify: `apps/desktop/src/renderer/features/todos/todayItems.test.ts`
- Create: `apps/desktop/src/renderer/features/todos/useLocalDateKey.ts`
- Create: `apps/desktop/src/renderer/features/todos/useLocalDateKey.test.ts`

- [ ] 先写缺少日期迁移、逾期筛选和排序的失败测试。
- [ ] 为手动待办增加 `date`，创建时使用当前本地日期。
- [ ] 合并今日与逾期的手动/周期条目，并提供 `isOverdue`。
- [ ] 实现午夜、焦点和可见性日期刷新 hook。
- [ ] 运行目标测试并确认通过。

### Task 2: Electron 应用状态文件仓储

**Files:**
- Create: `apps/desktop/src/main/storage/appStateTypes.ts`
- Create: `apps/desktop/src/main/storage/appStateFileStore.ts`
- Create: `apps/desktop/src/main/storage/appStateFileStore.test.ts`
- Create: `apps/desktop/src/main/storage/appStateService.ts`
- Create: `apps/desktop/src/main/storage/appStateService.test.ts`
- Create: `apps/desktop/src/main/storage/storageIpc.ts`
- Modify: `apps/desktop/src/preload/preload.ts`
- Modify: `apps/desktop/src/renderer/vite-env.d.ts`

- [ ] 先写原子保存、备份裁剪、损坏恢复和导入校验失败测试。
- [ ] 实现状态文件与串行更新服务。
- [ ] 注册最小 IPC：加载、保存待办、保存计划、导入后重载通知。
- [ ] 扩展 preload 类型安全桥接。
- [ ] 运行主进程仓储测试并确认通过。

### Task 3: renderer 数据启动与迁移

**Files:**
- Create: `apps/desktop/src/renderer/data/appDataBootstrap.ts`
- Create: `apps/desktop/src/renderer/data/electronRepositories.ts`
- Modify: `apps/desktop/src/renderer/features/todos/localTodoRepository.ts`
- Modify: `apps/desktop/src/renderer/features/todos/localTodoRepository.test.ts`
- Modify: `apps/desktop/src/renderer/features/cyclePlans/localCyclePlanRepository.ts`
- Modify: `apps/desktop/src/renderer/App.tsx`

- [ ] 先写未知数据规范化和旧待办日期迁移测试。
- [ ] 加载 Electron 状态并构造同步外观的 repository 适配器。
- [ ] 浏览器环境保留 localStorage fallback。
- [ ] App 使用启动数据、日期 hook 和重载事件。
- [ ] 运行 renderer 数据测试并确认通过。

### Task 4: 周期计划 Markdown 手动编辑

**Files:**
- Create: `apps/desktop/src/renderer/features/cyclePlans/cyclePlanDraft.ts`
- Create: `apps/desktop/src/renderer/features/cyclePlans/cyclePlanDraft.test.ts`
- Create: `apps/desktop/src/renderer/features/cyclePlans/CyclePlanEditorDrawer.tsx`
- Create: `apps/desktop/src/renderer/features/cyclePlans/CyclePlanEntryFields.tsx`
- Modify: `apps/desktop/src/renderer/features/cyclePlans/cyclePlanStore.ts`
- Modify: `apps/desktop/src/renderer/features/cyclePlans/CyclePlanView.tsx`
- Modify: `apps/desktop/src/renderer/features/cyclePlans/CyclePlanDrawer.tsx`
- Create: `apps/desktop/src/renderer/styles/cycle-plan-editor.css`
- Modify: `apps/desktop/src/renderer/styles/global.css`

- [ ] 先写新建计划、更新计划和保留专业内容块的失败测试。
- [ ] 实现计划 draft 纯函数和 store upsert。
- [ ] 实现多日期条目的 Markdown 编辑抽屉。
- [ ] 启用“手动添加”和计划编辑入口。
- [ ] 运行计划与文件大小测试并确认通过。

### Task 5: Windows 托盘、开机启动与数据菜单

**Files:**
- Create: `apps/desktop/src/main/lifecycle/appLifecycle.ts`
- Create: `apps/desktop/src/main/lifecycle/trayController.ts`
- Create: `apps/desktop/src/main/lifecycle/trayController.test.ts`
- Modify: `apps/desktop/src/main/main.ts`

- [ ] 先写中文托盘命令和退出语义失败测试。
- [ ] 接入单实例、正式包开机启动和启动收起。
- [ ] 增加打开数据目录、导出、导入和退出菜单。
- [ ] 保持主进程入口只做模块编排。
- [ ] 运行主进程测试并确认通过。

### Task 6: Windows 安装包与中文文档

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `README.md`
- Modify: `PRODUCT.md`
- Modify: `docs/extension-points.md`
- Create: `docs/local-v1-usage.md`

- [ ] 安装并配置 `electron-builder`。
- [ ] 添加 NSIS 与 portable 打包脚本。
- [ ] 更新中文安装、数据目录、备份和退出说明。
- [ ] 运行 `npm audit` 并记录高危依赖来源，不执行强制破坏性升级。
- [ ] 运行全量测试、类型检查、生产构建和 Windows 打包。
