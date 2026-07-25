# 桌面端 Plan API 连接与迁移实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Electron 主进程中实现加密连接配置、自动 SSH 隧道、在线/离线运行时、版本化缓存和旧 JSON 一次性迁移。

**Architecture:** `PlanApiRuntime` 是主进程唯一数据端口。它根据连接配置启动隧道、读取 API、维护快照与版本索引、执行变更并发布状态；旧 `AppStateService` 只作为迁移来源和本地设置来源，不再接收正式业务写入。

**Tech Stack:** Electron `safeStorage`、Node.js `child_process.spawn`、Windows OpenSSH、Node.js Fetch、Vitest。

## Global Constraints

- 必须先完成阶段一。
- SSH 命令必须使用参数数组和 `shell: false`。
- 不保存 SSH 密码或私钥路径内容，不在应用内提示输入密码。
- Desktop Token 必须通过 `safeStorage` 加密。
- 断网时只读缓存，任何 Mutation 都必须失败而不是写本地 JSON。
- 自动迁移仅允许在远端为空时执行。
- 一批迁移最多 100 个 Task；超过时明确阻止，不分批产生非原子状态。
- 应用退出时只终止本进程创建的隧道。
- 所有新增源码文件不超过 220 行。

---

### Task 1: 加密数据服务连接配置

**Files:**
- Create: `apps/desktop/src/main/planApi/planApiConnectionStore.ts`
- Create: `apps/desktop/src/main/planApi/planApiConnectionStore.test.ts`

**Interfaces:**
- Consumes: `PlanApiConnectionInput`、Electron `safeStorage` 适配器。
- Produces: `getPublicConfig()`、`resolveConnection(input?)`、`save(input)`。
- Storage path: `<userData>/plan-api-connection.v1.json`。

- [ ] **Step 1: 写密文保存和留空沿用测试**

```ts
it("stores only ciphertext and keeps the previous token when input is blank", async () => {
  const crypto = {
    isAvailable: () => true,
    encrypt: (value: string) => Buffer.from(`enc:${value}`),
    decrypt: (value: Buffer) => value.toString().replace(/^enc:/, "")
  };
  const store = new PlanApiConnectionStore(fileStore, crypto);

  await store.save({
    mode: "local",
    baseUrl: "http://127.0.0.1:8743",
    sshTarget: "",
    localPort: 8743,
    remotePort: 8743,
    desktopToken: "desktop-secret"
  });
  await store.save({
    mode: "local",
    baseUrl: "http://127.0.0.1:8743",
    sshTarget: "",
    localPort: 8743,
    remotePort: 8743,
    desktopToken: ""
  });

  expect(await store.resolveConnection()).toMatchObject({
    token: "desktop-secret"
  });
  expect(JSON.stringify(fileStore.saved)).not.toContain("desktop-secret");
});
```

- [ ] **Step 2: 运行测试确认先失败**

Run:

```powershell
npm test -- apps/desktop/src/main/planApi/planApiConnectionStore.test.ts
```

Expected: FAIL，连接 Store 不存在。

- [ ] **Step 3: 实现连接存储**

持久化结构固定为：

```ts
interface StoredPlanApiConnectionV1 {
  schemaVersion: 1;
  mode: "local" | "ssh";
  baseUrl: string;
  sshTarget: string;
  localPort: number;
  remotePort: number;
  tokenCiphertext: string;
  updatedAt: string;
}
```

公开配置只返回 `tokenConfigured` 和最后四位提示。`desktopToken: ""` 表示沿用旧密钥；
首次保存时密钥为空必须拒绝。`mode = "ssh"` 时要求非空 `sshTarget`，端口范围为
`1..65535`。

环境变量仅用于开发：

```text
HERMES_PLAN_API_MODE
HERMES_PLAN_API_URL
HERMES_PLAN_API_TOKEN
HERMES_PLAN_API_SSH_TARGET
```

打包模式优先读取加密文件，不把环境 Token 写回磁盘。

- [ ] **Step 4: 运行配置测试**

Run:

```powershell
npm test -- apps/desktop/src/main/planApi/planApiConnectionStore.test.ts
```

Expected: PASS，明文不落盘，错误输入被拒绝，留空沿用旧 Token。

- [ ] **Step 5: 提交连接配置**

```powershell
git add -- apps/desktop/src/main/planApi/planApiConnectionStore.ts apps/desktop/src/main/planApi/planApiConnectionStore.test.ts
git diff --cached --name-only
git commit -m "feat: store encrypted plan api connection"
```

---

### Task 2: 自动 SSH 隧道状态机

**Files:**
- Create: `apps/desktop/src/main/planApi/planApiSshTunnel.ts`
- Create: `apps/desktop/src/main/planApi/planApiSshTunnel.test.ts`

**Interfaces:**
- Produces: `buildSshTunnelArgs(config)`。
- Produces: `PlanApiSshTunnel.start(config)`、`stop()`、`getStatus()`、`subscribe(listener)`。

- [ ] **Step 1: 写安全参数和退出清理测试**

```ts
it("builds a non-interactive localhost tunnel without a shell", async () => {
  const spawn = vi.fn(() => fakeProcess);
  const tunnel = new PlanApiSshTunnel({ spawn, schedule: fakeSchedule });

  await tunnel.start({
    sshTarget: "hermes-plan",
    localPort: 8743,
    remotePort: 8743
  });

  expect(spawn).toHaveBeenCalledWith("ssh", [
    "-N", "-T",
    "-o", "BatchMode=yes",
    "-o", "ExitOnForwardFailure=yes",
    "-o", "ServerAliveInterval=30",
    "-o", "ServerAliveCountMax=3",
    "-L", "127.0.0.1:8743:127.0.0.1:8743",
    "hermes-plan"
  ], expect.objectContaining({ shell: false, windowsHide: true }));

  await tunnel.stop();
  expect(fakeProcess.kill).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: 运行测试确认先失败**

Run:

```powershell
npm test -- apps/desktop/src/main/planApi/planApiSshTunnel.test.ts
```

Expected: FAIL，隧道状态机不存在。

- [ ] **Step 3: 实现隧道状态机**

状态固定为：

```ts
export type SshTunnelState =
  | { type: "stopped" }
  | { type: "starting" }
  | { type: "running"; pid?: number }
  | { type: "reconnecting"; attempt: number; message: string }
  | { type: "failed"; message: string };
```

`sshTarget` 只接受 `A-Z a-z 0-9 . _ - @ :`，拒绝空白、引号和控制字符。断线重连
延迟依次为 `1000, 2000, 5000, 10000, 30000ms`，之后保持 `30000ms`。显式
`stop()` 必须取消计时器，不能触发重连。

- [ ] **Step 4: 运行隧道测试**

Run:

```powershell
npm test -- apps/desktop/src/main/planApi/planApiSshTunnel.test.ts
```

Expected: PASS，启动、失败、退避、重启和退出清理均可重复执行。

- [ ] **Step 5: 提交 SSH 隧道**

```powershell
git add -- apps/desktop/src/main/planApi/planApiSshTunnel.ts apps/desktop/src/main/planApi/planApiSshTunnel.test.ts
git diff --cached --name-only
git commit -m "feat: manage plan api ssh tunnel"
```

---

### Task 3: 不保存配置的连接测试器

**Files:**
- Create: `apps/desktop/src/main/planApi/planApiConnectionTester.ts`
- Create: `apps/desktop/src/main/planApi/planApiConnectionTester.test.ts`

**Interfaces:**
- Consumes: 当前表单输入、临时 SSH 隧道工厂、PlanApiClient 工厂。
- Produces: `test(input): Promise<PlanApiConnectionTestResult>`。

- [ ] **Step 1: 写 SSH 临时端口测试**

```ts
it("tests ssh input through a temporary local port and always stops it", async () => {
  const tester = new PlanApiConnectionTester({
    reservePort: async () => 49152,
    createTunnel: () => tunnel,
    createClient: (baseUrl, token) => {
      expect(baseUrl).toBe("http://127.0.0.1:49152");
      expect(token).toBe("form-token");
      return client;
    }
  });

  await expect(tester.test(sshInput())).resolves.toMatchObject({ ok: true });
  expect(tunnel.start).toHaveBeenCalledWith(expect.objectContaining({
    localPort: 49152
  }));
  expect(tunnel.stop).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: 运行测试确认先失败**

Run:

```powershell
npm test -- apps/desktop/src/main/planApi/planApiConnectionTester.test.ts
```

Expected: FAIL，测试器不存在。

- [ ] **Step 3: 实现测试器**

本地模式直接用表单 Base URL 请求 `/v1/health`。SSH 模式先用 Node `net.Server`
申请临时空闲端口，启动一次性隧道，轮询健康检查最多 8 秒，并在 `finally` 中停止。
测试成功只返回：

```ts
{
  ok: true,
  message: "Plan API 连接正常",
  apiVersion: 1,
  serverRevision: number
}
```

测试器不得调用 `PlanApiConnectionStore.save()`。

- [ ] **Step 4: 运行连接测试**

Run:

```powershell
npm test -- apps/desktop/src/main/planApi/planApiConnectionTester.test.ts
```

Expected: PASS，成功和失败都清理临时隧道，配置 Store 未被调用。

- [ ] **Step 5: 提交测试器**

```powershell
git add -- apps/desktop/src/main/planApi/planApiConnectionTester.ts apps/desktop/src/main/planApi/planApiConnectionTester.test.ts
git diff --cached --name-only
git commit -m "feat: test plan api connections safely"
```

---

### Task 4: 权威数据运行时

**Files:**
- Create: `apps/desktop/src/main/planApi/planApiReconnectLoop.ts`
- Create: `apps/desktop/src/main/planApi/planApiReconnectLoop.test.ts`
- Create: `apps/desktop/src/main/planApi/planApiRuntime.ts`
- Create: `apps/desktop/src/main/planApi/planApiRuntime.test.ts`

**Interfaces:**
- Consumes: connection Store、SSH tunnel、client factory、snapshot cache、mutation adapter。
- Produces: `initialize()`、`getSnapshotEnvelope()`、`getStoredSnapshot()`、`execute(batch)`、`refresh()`、`saveConnection(input)`、`testConnection(input)`、`shutdown()`。
- Produces: `subscribe(listener)` 状态与快照事件。

- [ ] **Step 1: 写断网只读与在线写入测试**

```ts
it("shows cache offline and rejects mutations without touching legacy storage", async () => {
  client.snapshot.mockRejectedValue(new PlanApiError("offline", "无法连接"));
  cache.load.mockResolvedValue(cachedState());
  const runtime = createRuntime();

  await runtime.initialize();
  expect(await runtime.getSnapshotEnvelope()).toMatchObject({
    status: { mode: "offline_cache", canMutate: false },
    todos: [{ id: "cached_todo" }]
  });
  await expect(runtime.execute(manualBatch())).rejects.toMatchObject({
    code: "offline"
  });
  expect(legacyStateService.transact).not.toHaveBeenCalled();
});
```

另写在线测试，确认 `mutate -> snapshot -> cache.save` 顺序，成功后返回服务端快照。

- [ ] **Step 2: 运行测试确认先失败**

Run:

```powershell
npm test -- apps/desktop/src/main/planApi/planApiRuntime.test.ts
```

Expected: FAIL，运行时不存在。

- [ ] **Step 3: 实现运行时**

先实现 `PlanApiReconnectLoop`。离线后按 `1000, 2000, 5000, 10000, 30000ms`
调用 `runtime.refresh()`；一旦在线立即重置 attempt，`shutdown()` 后不得继续调度。

运行时保存：

```ts
private current: PlanApiSnapshotEnvelope;
private versionIndex = PlanApiVersionIndex.empty();
private client: PlanApiClient | null = null;
private writeTail: Promise<void> = Promise.resolve();
```

公开读取分成两个接口：

- `getSnapshotEnvelope()`：renderer 使用，返回 todos、cyclePlans 和公开状态。
- `getStoredSnapshot()`：AI 使用，返回相同业务快照加 legacy service 中的本地 settings。

`execute(batch)` 必须串行：

```ts
async execute(batch: AppMutationBatch): Promise<StoredAppStateV1> {
  if (!this.current.status.canMutate || !this.client) {
    throw new PlanApiError("offline", "数据服务离线，当前仅可查看");
  }
  return this.enqueueWrite(async () => {
    const wireBatch = adaptAppMutationBatch({
      batch,
      snapshot: this.current,
      versionIndex: this.versionIndex,
      idempotencyKey: createIdempotencyKey(batch)
    });
    await this.client!.mutate(wireBatch);
    return this.refreshOnline();
  });
}
```

AI 批次幂等键使用 `proposalId`，手动批次使用一次生成的 UUID。运行时不自动重试
Mutation；网络恢复只刷新快照。

- [ ] **Step 4: 运行运行时测试**

Run:

```powershell
npm test -- apps/desktop/src/main/planApi/planApiRuntime.test.ts
```

Expected: PASS，在线写入服务端，断网只读缓存，冲突刷新快照但不覆盖重放。

- [ ] **Step 5: 提交运行时**

```powershell
git add -- apps/desktop/src/main/planApi/planApiReconnectLoop.ts apps/desktop/src/main/planApi/planApiReconnectLoop.test.ts apps/desktop/src/main/planApi/planApiRuntime.ts apps/desktop/src/main/planApi/planApiRuntime.test.ts
git diff --cached --name-only
git commit -m "feat: add authoritative plan api runtime"
```

---

### Task 5: 旧 JSON 迁移文件与迁移服务

**Files:**
- Create: `apps/desktop/src/main/planApi/planApiMigrationFileStore.ts`
- Create: `apps/desktop/src/main/planApi/planApiMigrationFileStore.test.ts`
- Create: `apps/desktop/src/main/planApi/planApiMigrationService.ts`
- Create: `apps/desktop/src/main/planApi/planApiMigrationService.test.ts`

**Interfaces:**
- Consumes: legacy `StoredAppStateV1`、远端快照、PlanApiClient、映射适配器。
- Produces: `inspect()`、`migrate()`、`keepRemoteAndSkip()`。
- Storage path: `<userData>/data/plan-api-migration.v1.json`。

- [ ] **Step 1: 写空服务器、备份先行和幂等测试**

```ts
it("backs up legacy state before one atomic import and verifies counts", async () => {
  const service = createMigrationService({
    localState: legacyState({ todos: 2, cyclePlans: 1 }),
    remoteSnapshot: emptyRemoteSnapshot()
  });

  await service.migrate();

  expect(fileStore.backupLegacy.mock.invocationCallOrder[0])
    .toBeLessThan(client.mutate.mock.invocationCallOrder[0]);
  expect(client.mutate).toHaveBeenCalledWith(expect.objectContaining({
    idempotencyKey: expect.stringMatching(/^desktop-migration:/),
    operations: expect.arrayContaining([
      expect.objectContaining({ type: "task.create" })
    ])
  }));
  expect(fileStore.saveRecord).toHaveBeenCalledWith(expect.objectContaining({
    status: "completed",
    importedTaskCount: 3
  }));
});
```

另写测试：

- 远端非空时 `inspect()` 返回 blocked，不调用 mutate。
- 本地超过 100 个 Task 时阻止迁移。
- mutate 失败时保留备份，不写 completed。
- completed 记录存在时重复启动不再次导入。

- [ ] **Step 2: 运行迁移测试确认先失败**

Run:

```powershell
npm test -- apps/desktop/src/main/planApi/planApiMigrationFileStore.test.ts apps/desktop/src/main/planApi/planApiMigrationService.test.ts
```

Expected: FAIL，迁移模块不存在。

- [ ] **Step 3: 实现迁移文件 Store**

记录结构：

```ts
interface PlanApiMigrationRecordV1 {
  schemaVersion: 1;
  status: "completed" | "skipped";
  sourceUpdatedAt: string;
  backupPath: string;
  importedTaskCount: number;
  importedEntryCount: number;
  completedAt: string;
}
```

备份文件名为 `state.v1.pre-plan-api-<ISO安全时间戳>.json`。Store 只复制和记录，
不解释业务内容。

- [ ] **Step 4: 实现迁移服务**

迁移服务把每个旧 Todo 转成一个 `todo.create`，每个旧 CyclePlan 转成一个
`cyclePlan.create`，再复用阶段一 `adaptAppMutationBatch`。提交后重新读取快照并
比较 Task 数、Entry 数；不相等则抛出 `migration_verification_failed`。

`keepRemoteAndSkip()` 仅在用户明确确认后写 `skipped` 记录，不删除旧 JSON 和备份。

- [ ] **Step 5: 运行迁移测试**

Run:

```powershell
npm test -- apps/desktop/src/main/planApi/planApiMigrationFileStore.test.ts apps/desktop/src/main/planApi/planApiMigrationService.test.ts
```

Expected: PASS，备份先于写入、迁移原子、重复启动不重复导入。

- [ ] **Step 6: 提交迁移模块**

```powershell
git add -- apps/desktop/src/main/planApi/planApiMigrationFileStore.ts apps/desktop/src/main/planApi/planApiMigrationFileStore.test.ts apps/desktop/src/main/planApi/planApiMigrationService.ts apps/desktop/src/main/planApi/planApiMigrationService.test.ts
git diff --cached --name-only
git commit -m "feat: migrate legacy state to plan api"
```

---

### Task 6: IPC、主进程装配与托盘边界

**Files:**
- Create: `apps/desktop/src/main/planApi/planApiBootstrap.ts`
- Create: `apps/desktop/src/main/planApi/planApiIpc.ts`
- Create: `apps/desktop/src/main/planApi/planApiIpc.test.ts`
- Modify: `apps/desktop/src/preload/preload.cts`
- Modify: `apps/desktop/src/renderer/vite-env.d.ts`
- Modify: `apps/desktop/src/main/main.ts`
- Modify: `apps/desktop/src/main/lifecycle/trayController.ts`
- Modify: `apps/desktop/src/main/lifecycle/trayController.test.ts`
- Modify: `apps/desktop/src/main/lifecycle/dataTransferController.ts`

**Interfaces:**
- Consumes: `PlanApiRuntime`。
- Produces: `window.hermesAppData.loadState/executeMutations` 由运行时实现。
- Produces: `window.hermesPlanApi` 配置、测试、迁移和状态白名单。

- [ ] **Step 1: 写 IPC 白名单测试**

```ts
it("registers runtime data and connection handlers without legacy replace channels", () => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  registerPlanApiIpc(fakeIpc(handlers), runtime);

  expect([...handlers.keys()]).toEqual(expect.arrayContaining([
    "plan-api:load-state",
    "plan-api:execute-mutations",
    "plan-api:get-config",
    "plan-api:test-connection",
    "plan-api:save-connection",
    "plan-api:migrate",
    "plan-api:keep-remote"
  ]));
  expect(handlers.has("data:replace-todos")).toBe(false);
  expect(handlers.has("data:replace-cycle-plans")).toBe(false);
});
```

- [ ] **Step 2: 运行 IPC 测试确认先失败**

Run:

```powershell
npm test -- apps/desktop/src/main/planApi/planApiIpc.test.ts apps/desktop/src/main/lifecycle/trayController.test.ts
```

Expected: FAIL，新 IPC 尚不存在。

- [ ] **Step 3: 注册白名单桥接**

preload 暴露：

```ts
contextBridge.exposeInMainWorld("hermesAppData", {
  loadState: () => ipcRenderer.invoke("plan-api:load-state"),
  executeMutations: (batch: AppMutationBatch) =>
    ipcRenderer.invoke("plan-api:execute-mutations", batch),
  onSnapshotChanged: (callback) => subscribe("plan-api:snapshot-changed", callback)
});

contextBridge.exposeInMainWorld("hermesPlanApi", {
  getConfig: () => ipcRenderer.invoke("plan-api:get-config"),
  testConnection: (input) => ipcRenderer.invoke("plan-api:test-connection", input),
  saveConnection: (input) => ipcRenderer.invoke("plan-api:save-connection", input),
  migrateLegacyState: () => ipcRenderer.invoke("plan-api:migrate"),
  keepRemoteData: () => ipcRenderer.invoke("plan-api:keep-remote"),
  onStatusChanged: (callback) => subscribe("plan-api:status-changed", callback)
});
```

不再暴露 `replaceTodos` 和 `replaceCyclePlans`。

- [ ] **Step 4: 装配主进程**

`main.ts` 保留 legacy `AppStateService` 作为迁移来源，然后只增加一个装配入口：

```ts
const planApiRuntime = await registerPlanApiRuntime({
  ipc: ipcMain,
  userDataDirectory: app.getPath("userData"),
  legacyStateService: appStateService,
  legacyStateFilePath: appStateFileStore.stateFilePath,
  publish: (channel, payload) => mainWindow?.webContents.send(channel, payload)
});
await planApiRuntime.initialize();
```

移除 `registerStorageIpc` 正式装配。`before-quit` 调用
`void planApiRuntime?.shutdown()`。

- [ ] **Step 5: 修正托盘数据操作**

托盘保留“打开数据目录”和“导出最近快照”，移除正式模式中的“导入数据”。旧 JSON
导入只能通过迁移流程，不能再次写成本地权威状态。更新测试确认菜单不存在“导入数据”。

- [ ] **Step 6: 运行 IPC、生命周期和类型检查**

Run:

```powershell
npm test -- apps/desktop/src/main/planApi/planApiIpc.test.ts apps/desktop/src/main/lifecycle/trayController.test.ts apps/desktop/src/main/preloadPackaging.test.ts
npm run typecheck
```

Expected: PASS，preload 只有白名单 API，主进程不再注册数组替换通道。

- [ ] **Step 7: 提交运行时装配**

```powershell
git add -- apps/desktop/src/main/planApi/planApiBootstrap.ts apps/desktop/src/main/planApi/planApiIpc.ts apps/desktop/src/main/planApi/planApiIpc.test.ts apps/desktop/src/preload/preload.cts apps/desktop/src/renderer/vite-env.d.ts apps/desktop/src/main/main.ts apps/desktop/src/main/lifecycle/trayController.ts apps/desktop/src/main/lifecycle/trayController.test.ts apps/desktop/src/main/lifecycle/dataTransferController.ts
git diff --cached --name-only
git commit -m "feat: route desktop data through plan api"
```

---

### Task 7: 阶段二完整验证

**Files:**
- No code changes unless verification reveals a defect in Tasks 1-6.

**Interfaces:**
- Produces: Electron 主进程可用的本地直连、SSH、缓存和迁移运行时。

- [ ] **Step 1: 运行主进程 Plan API 测试**

```powershell
npm test -- apps/desktop/src/main/planApi apps/desktop/src/main/lifecycle
```

Expected: PASS。

- [ ] **Step 2: 运行完整构建**

```powershell
npm test
npm run typecheck
npm run build
```

Expected: 全部 PASS。

- [ ] **Step 3: 本地 API 烟雾测试**

启动现有 Plan API 后设置开发环境变量：

```powershell
$env:HERMES_PLAN_API_MODE = "local"
$env:HERMES_PLAN_API_URL = "http://127.0.0.1:8743"
$env:HERMES_PLAN_API_TOKEN = "local-desktop-token"
npm run dev
```

Expected: Electron 读取当前 serverRevision，新增待办后 `/v1/today` 可看到同一 Entry。

- [ ] **Step 4: 断网测试**

停止 Plan API，再重新展开桌宠。

Expected: 最近快照仍可见，状态为“离线，只读显示缓存”，任何写入均不会修改
`state.v1.json` 或 `plan.db`。

- [ ] **Step 5: 行数和暂存区检查**

```powershell
Get-ChildItem apps/desktop/src/main/planApi -File |
  Where-Object { $_.Extension -in ".ts", ".tsx" } |
  ForEach-Object {
    $lines = (Get-Content -LiteralPath $_.FullName | Measure-Object -Line).Lines
    if ($lines -gt 220) { "$lines $($_.FullName)" }
  }
git diff --cached --name-only
```

Expected: 两条命令均无输出。
