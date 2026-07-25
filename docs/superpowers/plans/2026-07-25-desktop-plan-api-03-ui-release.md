# 桌面端 Plan API 前端与发布实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Plan API 状态接入 React、增加“数据服务”设置分区、落实离线只读、让 AI 与手动操作共用云端执行器，并产出 `0.2.0-test.1` 免安装测试副本。

**Architecture:** renderer 只通过 preload 白名单获得快照、公开连接状态和配置操作。`App` 持有数据服务会话状态，业务页面只消费 `canMutate`；AI 主进程通过抽象 Snapshot/Mutation Port 使用同一个 `PlanApiRuntime`。

**Tech Stack:** React 19、Electron IPC、TypeScript、Vitest、Neutral Glass CSS。

## Global Constraints

- 必须先完成阶段一和阶段二。
- 设置页只增加一个真实分区“数据服务”，不添加占位功能。
- 离线状态下浏览可用，所有写操作和 AI 提案确认必须禁用。
- 已保存的 API Token 不得回传 renderer、DOM、日志或缓存；用户本次输入只在局部
  密码字段中短暂存在，提交 IPC 后立即清空。
- 浏览器 Vite 预览继续使用 localStorage Demo，并明确显示“浏览器预览”。
- 不改变待办、周期任务、角色包和 AI 提案 JSON 合同。
- 所有新增 TS、TSX、CSS 和 Python 源码文件不超过 220 行。
- 发布新副本前保留 `0.1.3-test.17`，不得覆盖稳定版。

---

### Task 1: renderer 启动状态与数据服务控制器

**Files:**
- Modify: `apps/desktop/src/renderer/data/appDataBootstrap.ts`
- Modify: `apps/desktop/src/renderer/data/appDataBootstrap.test.ts`
- Modify: `apps/desktop/src/renderer/data/appMutationGateway.ts`
- Create: `apps/desktop/src/renderer/data/usePlanApiDataService.ts`
- Create: `apps/desktop/src/renderer/data/usePlanApiDataService.test.tsx`
- Delete: `apps/desktop/src/renderer/data/electronRepositories.ts`
- Delete: `apps/desktop/src/renderer/data/electronRepositories.test.ts`

**Interfaces:**
- Consumes: `PlanApiSnapshotEnvelope` 和 preload 事件。
- Produces: `PlanApiDataServiceController`。
- Produces: `AppDataBootstrapResult.initialDataStatus` 和 `planApiBridge`。

- [ ] **Step 1: 写正式启动不静默伪造空状态测试**

```ts
it("keeps the offline cache status returned by Electron", async () => {
  const bridge = {
    loadState: vi.fn(async () => ({
      todos: [{ ...mockTodos[0], id: "cached_todo" }],
      cyclePlans: [],
      status: {
        mode: "offline_cache" as const,
        canMutate: false,
        message: "数据服务离线，当前仅可查看",
        cacheAvailable: true
      }
    })),
    executeMutations: vi.fn()
  };

  const result = await bootstrapAppData({ bridge });
  expect(result.initialTodos[0].id).toBe("cached_todo");
  expect(result.initialDataStatus.mode).toBe("offline_cache");
  expect(result.mutationGateway.canMutate()).toBe(false);
});
```

- [ ] **Step 2: 运行启动测试确认先失败**

Run:

```powershell
npm test -- apps/desktop/src/renderer/data/appDataBootstrap.test.ts apps/desktop/src/renderer/data/usePlanApiDataService.test.tsx
```

Expected: FAIL，结果中尚无数据服务状态。

- [ ] **Step 3: 修改启动合同**

Electron `loadState()` 返回 `PlanApiSnapshotEnvelope`。删除 `loadDesktopSnapshot` 中吞错后返回
空数组的逻辑。浏览器预览返回：

```ts
const browserStatus: PlanApiRuntimeStatus = {
  mode: "online",
  canMutate: true,
  message: "浏览器预览数据",
  cacheAvailable: false
};
```

`AppMutationGateway` 增加：

```ts
export interface AppMutationGateway {
  execute(batch: AppMutationBatch): Promise<AppMutationSnapshot>;
  canMutate(): boolean;
}
```

Electron gateway 的 `canMutate` 从控制器当前状态读取；正式离线时 `execute` 在 IPC 前即抛出
“数据服务离线，当前仅可查看”。

- [ ] **Step 4: 实现数据服务 Hook**

```ts
export interface PlanApiDataServiceController {
  status: PlanApiRuntimeStatus;
  config: PlanApiPublicConfig | null;
  busy: boolean;
  error: string | null;
  refreshConfig(): Promise<void>;
  testConnection(input: PlanApiConnectionInput): Promise<PlanApiConnectionTestResult>;
  saveConnection(input: PlanApiConnectionInput): Promise<boolean>;
  migrateLegacyState(): Promise<boolean>;
  keepRemoteData(): Promise<boolean>;
}
```

Hook 订阅 `onStatusChanged` 和 `onSnapshotChanged`；收到新快照时调用传入的
`onSnapshot(todos, cyclePlans)`，组件卸载时取消订阅。

- [ ] **Step 5: 运行 renderer 数据测试**

```powershell
npm test -- apps/desktop/src/renderer/data/appDataBootstrap.test.ts apps/desktop/src/renderer/data/appMutationGateway.test.ts apps/desktop/src/renderer/data/usePlanApiDataService.test.tsx
```

Expected: PASS，正式模式不再创建兼容仓储，浏览器预览仍可独立运行。

- [ ] **Step 6: 删除兼容仓储并提交**

```powershell
git add -- apps/desktop/src/renderer/data/appDataBootstrap.ts apps/desktop/src/renderer/data/appDataBootstrap.test.ts apps/desktop/src/renderer/data/appMutationGateway.ts apps/desktop/src/renderer/data/appMutationGateway.test.ts apps/desktop/src/renderer/data/usePlanApiDataService.ts apps/desktop/src/renderer/data/usePlanApiDataService.test.tsx
git rm -- apps/desktop/src/renderer/data/electronRepositories.ts apps/desktop/src/renderer/data/electronRepositories.test.ts
git diff --cached --name-only
git commit -m "feat: expose plan api state to renderer"
```

---

### Task 2: “数据服务”设置分区

**Files:**
- Modify: `apps/desktop/src/renderer/features/sidebar/panelSessionState.ts`
- Modify: `apps/desktop/src/renderer/features/sidebar/panelSessionState.test.ts`
- Modify: `apps/desktop/src/renderer/features/settings/SettingsShell.tsx`
- Modify: `apps/desktop/src/renderer/features/settings/SettingsShell.test.tsx`
- Modify: `apps/desktop/src/renderer/features/settings/SettingsPanel.tsx`
- Create: `apps/desktop/src/renderer/features/settings/DataServiceSettings.tsx`
- Create: `apps/desktop/src/renderer/features/settings/DataServiceSettings.test.tsx`
- Create: `apps/desktop/src/renderer/styles/data-service-settings.css`
- Modify: `apps/desktop/src/renderer/styles/global.css`

**Interfaces:**
- Consumes: `PlanApiDataServiceController`。
- Produces: `SettingsSection = "appearance" | "model" | "data"`。

- [ ] **Step 1: 写三分区和紧凑布局测试**

```tsx
it("renders the real data service section in both navigation modes", () => {
  const html = renderToStaticMarkup(
    <SettingsShell
      activeSection="data"
      appearance={<div>外观</div>}
      model={<div>模型</div>}
      data={<div>数据服务内容</div>}
      modelStatus={{ label: "已配置", tone: "configured" }}
      dataStatus={{ label: "云端已连接", tone: "success" }}
      onSectionChange={() => undefined}
    />
  );
  expect(html).toContain("数据服务");
  expect(html).toContain("云端已连接");
  expect(html).toContain("数据服务内容");
  expect(html).not.toContain("数据管理");
});
```

- [ ] **Step 2: 运行设置测试确认先失败**

```powershell
npm test -- apps/desktop/src/renderer/features/settings/SettingsShell.test.tsx apps/desktop/src/renderer/features/settings/DataServiceSettings.test.tsx apps/desktop/src/renderer/features/sidebar/panelSessionState.test.ts
```

Expected: FAIL，第三分区尚不存在。

- [ ] **Step 3: 扩展设置状态和壳层**

`panelSessionState.ts`：

```ts
export type SettingsSection = "appearance" | "model" | "data";
```

`SettingsShell` 使用 `DatabaseZap` 或 `Cloud` Lucide 图标增加第三项；宽屏沿用左侧导航，
小于 `720px` 沿用顶部 Tab，不新增卡片嵌套。

- [ ] **Step 4: 实现数据服务表单**

表单字段：

- 连接模式：本地直连 / 云端 SSH 分段控件。
- 本地模式：Base URL。
- SSH 模式：SSH 目标、本地端口、远端端口。
- Desktop Token 密码输入。
- 测试连接、保存连接。
- 连接状态、最近同步时间、serverRevision。
- 迁移预览、确认迁移或“保留云端数据”确认。

Token 输入使用局部受控 state，保存成功立即清空；公开 config 只显示 `tokenHint`。

状态颜色：

- 未配置和离线：中性灰。
- 连接中和已保存：蓝色。
- 在线：绿色。
- 失败和迁移阻止：红色。

- [ ] **Step 5: 运行设置测试和布局测试**

```powershell
npm test -- apps/desktop/src/renderer/features/settings apps/desktop/src/renderer/features/sidebar/panelSessionState.test.ts apps/desktop/src/renderer/styles/settingsLayout.test.ts
```

Expected: PASS，`854×581` 分栏和 `360×581` 三 Tab 均无横向溢出。

- [ ] **Step 6: 提交设置 UI**

```powershell
git add -- apps/desktop/src/renderer/features/sidebar/panelSessionState.ts apps/desktop/src/renderer/features/sidebar/panelSessionState.test.ts apps/desktop/src/renderer/features/settings/SettingsShell.tsx apps/desktop/src/renderer/features/settings/SettingsShell.test.tsx apps/desktop/src/renderer/features/settings/SettingsPanel.tsx apps/desktop/src/renderer/features/settings/DataServiceSettings.tsx apps/desktop/src/renderer/features/settings/DataServiceSettings.test.tsx apps/desktop/src/renderer/styles/data-service-settings.css apps/desktop/src/renderer/styles/global.css
git diff --cached --name-only
git commit -m "feat: add plan api data service settings"
```

---

### Task 3: 离线只读与重连刷新

**Files:**
- Modify: `apps/desktop/src/renderer/App.tsx`
- Modify: `apps/desktop/src/renderer/features/todos/TodoPanel.tsx`
- Create: `apps/desktop/src/renderer/features/todos/DataServiceBanner.tsx`
- Create: `apps/desktop/src/renderer/features/todos/DataServiceBanner.test.tsx`
- Modify: `apps/desktop/src/renderer/features/todos/TodayTodoView.tsx`
- Modify: `apps/desktop/src/renderer/features/cyclePlans/CyclePlanView.tsx`
- Modify: `apps/desktop/src/renderer/features/ai/AiPlannerView.tsx`
- Modify: `apps/desktop/src/renderer/features/ai/AiProposalPanel.tsx`
- Create: `apps/desktop/src/renderer/styles/data-service-banner.css`
- Modify: `apps/desktop/src/renderer/styles/global.css`

**Interfaces:**
- Consumes: `PlanApiRuntimeStatus.canMutate`。
- Produces: `readOnly` 业务页面契约和明确状态横幅。

- [ ] **Step 1: 写离线按钮和横幅测试**

```tsx
it("explains cached read-only mode and disables writes", () => {
  const html = renderToStaticMarkup(
    <DataServiceBanner status={{
      mode: "offline_cache",
      canMutate: false,
      message: "数据服务离线，当前仅可查看",
      cacheAvailable: true
    }} />
  );
  expect(html).toContain("离线");
  expect(html).toContain("仅可查看");
  expect(html).toContain('role="status"');
});
```

在 `AiProposalPanel` 测试中确认 `canExecute={false}` 时确认按钮 disabled，放弃草稿仍可用。

- [ ] **Step 2: 运行测试确认先失败**

```powershell
npm test -- apps/desktop/src/renderer/features/todos/DataServiceBanner.test.tsx apps/desktop/src/renderer/features/ai/AiFlowViews.test.tsx
```

Expected: FAIL，横幅和 `canExecute` 尚不存在。

- [ ] **Step 3: 接入 App 数据服务状态**

`App` 创建 `usePlanApiDataService`，快照事件调用现有 `mutation.hydrate()`。手动写入口增加：

```ts
if (!dataService.status.canMutate) {
  mutation.fail("数据服务离线，当前仅可查看");
  return false;
}
```

为避免扩大 `App.tsx`，状态组装放在 Hook；`App` 只传递 `dataService` 和
`readOnly={!status.canMutate}`。

- [ ] **Step 4: 禁用全部写入口**

- `TodayTodoView` 把 `busy || readOnly` 传给新增、完成、菜单和编辑器。
- `CyclePlanView` 把 `busy || readOnly` 传给 AI 创建、状态和删除操作。
- `AiProposalPanel` 使用 `disabled={busy || !canExecute}`。
- 浏览、筛选、详情、返回和放弃提案保持可用。
- `TodoPanel` 顶部只在非 online 状态显示 `DataServiceBanner`。

- [ ] **Step 5: 运行 UI 状态测试**

```powershell
npm test -- apps/desktop/src/renderer/features/todos apps/desktop/src/renderer/features/cyclePlans apps/desktop/src/renderer/features/ai
```

Expected: PASS，离线无法写入，重连快照 hydrate 后写按钮恢复。

- [ ] **Step 6: 提交只读状态**

```powershell
git add -- apps/desktop/src/renderer/App.tsx apps/desktop/src/renderer/features/todos/TodoPanel.tsx apps/desktop/src/renderer/features/todos/DataServiceBanner.tsx apps/desktop/src/renderer/features/todos/DataServiceBanner.test.tsx apps/desktop/src/renderer/features/todos/TodayTodoView.tsx apps/desktop/src/renderer/features/cyclePlans/CyclePlanView.tsx apps/desktop/src/renderer/features/ai/AiPlannerView.tsx apps/desktop/src/renderer/features/ai/AiProposalPanel.tsx apps/desktop/src/renderer/styles/data-service-banner.css apps/desktop/src/renderer/styles/global.css
git diff --cached --name-only
git commit -m "feat: enforce plan api read only mode"
```

---

### Task 4: AI 提案共用 Plan API 数据端口

**Files:**
- Modify: `apps/desktop/src/main/ai/aiProposalService.ts`
- Modify: `apps/desktop/src/main/ai/aiProposalService.test.ts`
- Modify: `apps/desktop/src/main/ai/aiProposalExecutor.ts`
- Modify: `apps/desktop/src/main/ai/aiProposalExecutor.test.ts`
- Modify: `apps/desktop/src/main/ai/aiCoordinator.ts`
- Modify: `apps/desktop/src/main/ai/aiBootstrap.ts`
- Modify: `apps/desktop/src/main/ai/aiCoordinator.test.ts`
- Modify: `apps/desktop/src/main/main.ts`
- Delete: `apps/desktop/src/main/storage/storageIpc.ts`
- Delete: `apps/desktop/src/main/storage/storageIpc.test.ts`
- Delete: `apps/desktop/src/main/storage/appMutationExecutor.ts`
- Delete: `apps/desktop/src/main/storage/appMutationExecutor.test.ts`

**Interfaces:**
- Consumes: `PlanApiRuntime.getStoredSnapshot()` 和 `execute(batch)`。
- Produces: AI 生成读取云端快照，AI 确认写入云端 Mutation。

- [ ] **Step 1: 写 AI 云端端口测试**

```ts
it("reads proposal context from the async snapshot port", async () => {
  const snapshotPort = { getSnapshot: vi.fn(async () => storedState()) };
  const service = createProposalService({ snapshotPort });
  await service.generate(request);
  expect(snapshotPort.getSnapshot).toHaveBeenCalledOnce();
});

it("executes a confirmed proposal through the shared mutation port", async () => {
  const mutationPort = { execute: vi.fn(async () => storedState()) };
  const executor = new AiProposalExecutor(mutationPort);
  await executor.execute(proposal);
  expect(mutationPort.execute).toHaveBeenCalledWith({
    source: { type: "ai_draft", proposalId: proposal.proposalId },
    summary: proposal.summary,
    operations: proposal.operations
  });
});
```

- [ ] **Step 2: 运行 AI 测试确认先失败**

```powershell
npm test -- apps/desktop/src/main/ai/aiProposalService.test.ts apps/desktop/src/main/ai/aiProposalExecutor.test.ts apps/desktop/src/main/ai/aiCoordinator.test.ts
```

Expected: FAIL，当前仍要求 `AppStateService`。

- [ ] **Step 3: 提取异步数据端口**

```ts
interface SnapshotPort {
  getSnapshot(): Promise<StoredAppStateV1>;
}

interface MutationPort {
  execute(batch: AppMutationBatch): Promise<StoredAppStateV1>;
}
```

`AiProposalService.generate()` 改为 `const state = await snapshotPort.getSnapshot()`。
`AiProposalExecutor` 不再构造本地 `AppMutationExecutor`，直接委托 `MutationPort`。

- [ ] **Step 4: 修改 AI 装配**

```ts
registerAiRuntime(ipcMain, {
  snapshotPort: planApiRuntime,
  mutationPort: planApiRuntime,
  userDataDirectory: app.getPath("userData")
});
```

AI 配置、模型调用、提案缓存和确认合同保持不变。

- [ ] **Step 5: 删除已断开的旧写入路径**

运行：

```powershell
rg -n "registerStorageIpc|AppMutationExecutor|data:replace-todos|data:replace-cycle-plans" apps/desktop/src
```

Expected: 只剩待删除文件自身。随后删除列出的四个旧 storage 文件，并从 preload
类型中移除所有 replace 接口。

- [ ] **Step 6: 运行 AI 与主进程测试**

```powershell
npm test -- apps/desktop/src/main/ai apps/desktop/src/main/planApi
npm run typecheck
```

Expected: PASS，普通手动操作和 AI 确认最终都调用同一个 `PlanApiRuntime.execute()`。

- [ ] **Step 7: 提交 AI 网关切换**

```powershell
git add -- apps/desktop/src/main/ai/aiProposalService.ts apps/desktop/src/main/ai/aiProposalService.test.ts apps/desktop/src/main/ai/aiProposalExecutor.ts apps/desktop/src/main/ai/aiProposalExecutor.test.ts apps/desktop/src/main/ai/aiCoordinator.ts apps/desktop/src/main/ai/aiBootstrap.ts apps/desktop/src/main/ai/aiCoordinator.test.ts apps/desktop/src/main/main.ts
git rm -- apps/desktop/src/main/storage/storageIpc.ts apps/desktop/src/main/storage/storageIpc.test.ts apps/desktop/src/main/storage/appMutationExecutor.ts apps/desktop/src/main/storage/appMutationExecutor.test.ts
git diff --cached --name-only
git commit -m "refactor: execute ai proposals through plan api"
```

---

### Task 5: 文件管理守卫与中文运维文档

**Files:**
- Create: `scripts/check-source-lines.mjs`
- Modify: `package.json`
- Create: `services/plan-api/.gitignore`
- Split: `services/plan-api/tests/db/test_migrations.py`
- Create: `services/plan-api/tests/db/test_migrations_schema.py`
- Create: `services/plan-api/tests/db/test_migrations_upgrade.py`
- Create: `docs/desktop-plan-api-integration.md`
- Modify: `docs/file-structure.md`
- Modify: `docs/local-v1-usage.md`

**Interfaces:**
- Produces: `npm run check:source-lines`。
- Produces: 中文本地直连、SSH 配置、迁移、断网和恢复手册。

- [ ] **Step 1: 写全仓源码行数守卫**

`check-source-lines.mjs` 扫描：

```js
const roots = [
  "apps/desktop/src",
  "services/plan-api/src",
  "services/plan-api/tests",
  "scripts"
];
const extensions = new Set([".ts", ".tsx", ".css", ".py", ".mjs"]);
const limit = 220;
```

排除 `node_modules`、`dist`、`dist-electron`、`release` 和生成素材。发现超限时逐行输出
`<行数> <路径>` 并设置 `process.exitCode = 1`。

同时在 `package.json` 的 scripts 中加入：

```json
"check:source-lines": "node scripts/check-source-lines.mjs"
```

- [ ] **Step 2: 拆分现有超限迁移测试**

保持测试内容和断言不变，把当前 `test_migrations.py` 按“初始 schema”和“升级/校验”
拆入两个明确文件，然后删除原文件。

Run:

```powershell
npm run check:source-lines
```

Expected: PASS，无超限源码。

- [ ] **Step 3: 增加局部忽略规则**

`services/plan-api/.gitignore`：

```gitignore
.venv/
*.db
*.db-wal
*.db-shm
backups/
```

不要修改或覆盖仓库中现有 `.env` 规则。

- [ ] **Step 4: 编写中文使用文档**

`docs/desktop-plan-api-integration.md` 必须包含：

1. 本地 Plan API 直连配置。
2. Windows `~/.ssh/config` alias 示例。
3. 数据服务设置页字段说明。
4. 首次迁移预览、备份路径和验收。
5. 离线只读与恢复连接。
6. 云端 systemd 更新与数据库备份。
7. 明确禁止提交 Token、`.env`、私钥和数据库。

`docs/file-structure.md` 记录 `main/planApi` 的职责边界；`docs/local-v1-usage.md`
标注本地 JSON 已降级为迁移来源和浏览器 Demo。

- [ ] **Step 5: 运行文档和后端测试**

```powershell
npm run check:source-lines
& "C:\tmp\hermes-plan-api-python311\python.exe" -m pytest services/plan-api/tests -q
```

Expected: 行数检查 PASS，Plan API 测试全部 PASS。

- [ ] **Step 6: 提交文件管理与文档**

```powershell
git add -- scripts/check-source-lines.mjs package.json services/plan-api/.gitignore services/plan-api/tests/db/test_migrations_schema.py services/plan-api/tests/db/test_migrations_upgrade.py docs/desktop-plan-api-integration.md docs/file-structure.md docs/local-v1-usage.md
git rm -- services/plan-api/tests/db/test_migrations.py
git diff --cached --name-only
git commit -m "docs: add plan api operations and file guards"
```

注意：`package.json`、`docs/file-structure.md` 和 `docs/local-v1-usage.md` 当前可能已有
其他未提交改动。暂存前必须逐项核对 diff；无法隔离时不得把无关改动混入本提交。

---

### Task 6: 完整验收与免安装测试副本

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Generated, not committed: `release/Hermes 待办桌宠-0.2.0-test.1-x64-portable-dir/`

**Interfaces:**
- Produces: `0.2.0-test.1` 兼容免安装目录副本。

- [ ] **Step 1: 运行全部自动验证**

```powershell
npm test
npm run typecheck
npm run check:source-lines
npm run build
& "C:\tmp\hermes-plan-api-python311\python.exe" -m pytest services/plan-api/tests -q
```

Expected: 全部 PASS。

- [ ] **Step 2: 本地直连人工验收**

1. 启动 `127.0.0.1:8743` Plan API。
2. 在“数据服务”选择本地直连。
3. 测试连接并保存。
4. 新增、修改、完成、恢复、删除普通待办。
5. AI 生成周期任务，预览并确认。
6. 重启应用，确认数据从 SQLite 恢复。

Expected: 所有写入只改变 `plan.db`，`state.v1.json` 不再变化。

- [ ] **Step 3: 自动 SSH 隧道人工验收**

使用已配置的 SSH alias：

```sshconfig
Host hermes-plan
  HostName 110.42.209.111
  User ubuntu
  IdentityFile ~/.ssh/id_ed25519
```

设置模式为云端 SSH、目标 `hermes-plan`、本地和远端端口 `8743`。保存后关闭外部
手工隧道，重启桌宠。

Expected: 应用自行启动 `ssh.exe`，显示云端在线；网络断开后进入只读，恢复后自动重连。

- [ ] **Step 4: 迁移人工验收**

1. 使用测试数据目录准备旧 `state.v1.json`。
2. 确认远端测试数据库为空。
3. 执行迁移并确认备份先生成。
4. 对比 Todo、CyclePlan 和 Entry 数量。
5. 重启应用确认不会重复导入。

Expected: 迁移只发生一次，旧 JSON 保留且不再写入。

- [ ] **Step 5: 更新测试版本**

将 `package.json` 与 `package-lock.json` 版本改为：

```json
"version": "0.2.0-test.1"
```

Run:

```powershell
npm run dist:win:compatible
```

Expected: 新建兼容免安装目录，不覆盖 `0.1.3-test.17` 或稳定版。

- [ ] **Step 6: 启动打包副本并复验**

从新目录双击 `Hermes 待办桌宠.exe`，检查：

- 桌宠收起、展开和拖动正常。
- 数据服务配置通过 `safeStorage` 恢复。
- SSH 隧道自动启动并在退出时清理。
- 今日待办和周期任务来自同一云端数据。
- 离线缓存和只读按钮状态正常。

- [ ] **Step 7: 提交版本清单**

```powershell
git add -- package.json package-lock.json
git diff --cached --name-only
git commit -m "chore: prepare 0.2.0 plan api test build"
```

不得提交 `release/`、数据库、缓存、迁移备份和任何密钥。
