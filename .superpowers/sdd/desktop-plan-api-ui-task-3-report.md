# 阶段三 Task 3 完成报告

## 结果

- App 通过 `usePlanApiDataService` 消费 Plan API 状态与快照事件，事件快照统一归一化后 hydrate，不再整页 reload。
- Electron 离线缓存保持可浏览；今日待办、周期任务和 AI 提案确认的写入口进入只读状态。
- 手动写入同时具备 App 防御检查与 gateway 动态 `canMutate()` 检查。
- 浏览器预览继续使用本机 localStorage，并明确显示“浏览器预览”。
- 数据服务横幅覆盖离线、重连、未配置和迁移状态，不展示连接地址、SSH 或 Token 信息。
- 已删除兼容仓储、mutation diff 和 `RepositoryWriteNotice` 过渡层。

## 精确文件清单

修改：

- `apps/desktop/src/renderer/App.tsx`
- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/data/appDataBootstrap.ts`
- `apps/desktop/src/renderer/data/appDataBootstrap.test.ts`
- `apps/desktop/src/renderer/data/useAppMutationStore.ts`
- `apps/desktop/src/renderer/features/todos/TodoPanel.tsx`
- `apps/desktop/src/renderer/features/todos/TodoPanelSession.test.tsx`
- `apps/desktop/src/renderer/features/todos/TodayTodoView.tsx`
- `apps/desktop/src/renderer/features/todos/ManualInteractionViews.test.tsx`
- `apps/desktop/src/renderer/features/cyclePlans/CyclePlanView.tsx`
- `apps/desktop/src/renderer/features/cyclePlans/CyclePlanActions.test.tsx`
- `apps/desktop/src/renderer/features/cyclePlans/CyclePlanAiEntry.test.tsx`
- `apps/desktop/src/renderer/features/ai/AiPlannerView.tsx`
- `apps/desktop/src/renderer/features/ai/AiProposalPanel.tsx`
- `apps/desktop/src/renderer/features/ai/AiFlowViews.test.tsx`

新增：

- `apps/desktop/src/renderer/data/useAppMutationStore.test.tsx`
- `apps/desktop/src/renderer/features/todos/DataServiceBanner.tsx`
- `apps/desktop/src/renderer/features/todos/DataServiceBanner.test.tsx`
- `apps/desktop/src/renderer/styles/data-service-banner.css`

删除：

- `apps/desktop/src/renderer/data/electronRepositories.ts`
- `apps/desktop/src/renderer/data/electronRepositories.test.ts`
- `apps/desktop/src/renderer/data/electronMutationDiff.ts`
- `apps/desktop/src/renderer/components/RepositoryWriteNotice.tsx`
- `apps/desktop/src/renderer/components/RepositoryWriteNotice.test.tsx`
- `apps/desktop/src/renderer/components/repositoryWriteNotice.css`

未修改、未暂存：

- `apps/desktop/src/renderer/styles/global.css`
- 其余既有 dirty 文件，包括 package、docs、Plan API 主进程文件、旧 CyclePlanEditor 链、`todoStore`、资源和打包文件。

## 验证

- Focused tests：40 个测试文件、113 个测试通过。
- Full `npm test`：130 个测试文件、465 个测试通过。
- `npm run typecheck`：通过。
- `npm run build`：通过；主进程 TypeScript 与 renderer Vite 均成功，Vite 转换 1686 个模块。
- `git diff --check`：退出码 0；仅报告既有工作树的 LF/CRLF 转换提示。
- 旧引用检查：`electronRepositories`、`electronMutationDiff`、`writeController`、`RepositoryWriteNotice` 均无运行时引用。
- `main.tsx` 不包含 `window.location.reload`。

## 行数

| 文件 | 行数 |
| --- | ---: |
| `App.tsx` | 130 |
| `main.tsx` | 26 |
| `appDataBootstrap.ts` | 194 |
| `appDataBootstrap.test.ts` | 178 |
| `useAppMutationStore.ts` | 52 |
| `useAppMutationStore.test.tsx` | 43 |
| `TodoPanel.tsx` | 220 |
| `TodoPanelSession.test.tsx` | 220 |
| `TodayTodoView.tsx` | 123 |
| `ManualInteractionViews.test.tsx` | 77 |
| `CyclePlanView.tsx` | 61 |
| `CyclePlanActions.test.tsx` | 55 |
| `CyclePlanAiEntry.test.tsx` | 54 |
| `AiPlannerView.tsx` | 103 |
| `AiProposalPanel.tsx` | 64 |
| `AiFlowViews.test.tsx` | 101 |
| `DataServiceBanner.tsx` | 98 |
| `DataServiceBanner.test.tsx` | 67 |
| `data-service-banner.css` | 87 |

全部新增或修改的 TS、TSX、CSS 文件均不超过 220 行。

## Self-review

- 快照启动与事件更新共用 `normalizeAppSnapshot`，直接测试 Todo、周期计划和周期条目 source 保留。
- 直接测试快照 hydrate 后 `TodoPanel`、AI 页面和输入框不重挂载。
- 直接测试状态事件令 UI 无 reload 切换只读/可写，且 tracked gateway 同步更新第二道防御。
- 今日与周期浏览入口保持可用；周期详情所有写动作在只读状态 disabled。
- AI 普通对话路径未增加只读限制；仅提案确认 disabled，放弃草稿仍可用。
- 浏览器设置页获得明确只读 fallback；Electron 设置页获得真实 controller。

## Concerns

- 工作树在本任务开始前已有大量白名单外 dirty；提交后这些改动仍会保留，因此 `git status --short` 不会为空。
- Windows 行尾策略会输出 LF 转 CRLF 提示，但 `git diff --check` 无 whitespace error。
- 提交信息为 `feat: enforce plan api read only mode`。本报告属于同一提交，提交内容无法可靠自引用最终 SHA；最终 SHA 在提交后通过 `git log -1 --format=%H` 获取并在任务回复中报告。
