# 桌面端 Plan API 核心实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立不依赖 Electron UI 的 Plan API 合同、HTTP 客户端、内容映射、快照映射、版本索引、变更适配器和快照缓存。

**Architecture:** 所有服务端线格式只存在于 `main/planApi`，renderer 继续使用现有 `Todo`、`CyclePlan` 和 `AppMutationBatch`。纯函数完成双向映射，HTTP 客户端只负责传输，后续运行时通过这些小模块组合。

**Tech Stack:** TypeScript 5.7、Vitest 3、Node.js Fetch、现有共享领域类型。

## Global Constraints

- 本阶段不修改 `main.ts`、preload、React 页面或正式数据源。
- 不引入新 npm 依赖。
- API Token 只能作为 HTTP 客户端构造参数存在，不写日志与错误消息。
- 未知 `ContentDocument.kind` 必须无损映射为通用内容块。
- 所有新增源码文件不超过 220 行。
- 每个任务独立测试、独立核对暂存区、独立提交。

---

### Task 1: 线格式合同与严格解析

**Files:**
- Create: `apps/desktop/src/main/planApi/planApiWireTypes.ts`
- Create: `apps/desktop/src/main/planApi/planApiWireTypes.test.ts`
- Create: `apps/desktop/src/shared/planApiBridgeContract.ts`

**Interfaces:**
- Produces: `PlanApiTaskView`、`PlanApiTaskEntryView`、`PlanApiSnapshot`、`PlanApiMutationBatch`、`parsePlanApiSnapshot(value)`。
- Produces: renderer 可见的 `PlanApiRuntimeStatus`、`PlanApiSnapshotEnvelope`、`PlanApiConnectionInput` 和 `PlanApiPublicConfig`。

- [ ] **Step 1: 写严格快照解析失败测试**

```ts
import { describe, expect, it } from "vitest";
import { parsePlanApiSnapshot } from "./planApiWireTypes.js";

describe("parsePlanApiSnapshot", () => {
  it("rejects a task without an entry version", () => {
    const value = {
      serverRevision: 1,
      tasks: [{
        id: "task_1",
        kind: "daily",
        status: "active",
        generation_mode: "fixed",
        content: content("训练"),
        schedule_rule: null,
        generated_through_date: null,
        rule_revision: 1,
        version: 1,
        created_at: "2026-07-25T01:00:00Z",
        updated_at: "2026-07-25T01:00:00Z",
        entries: [{
          id: "entry_1",
          task_id: "task_1",
          scheduled_date: "2026-07-25",
          status: "pending",
          content: content("训练"),
          source: "manual",
          slot_key: null,
          is_overridden: false,
          generation_revision: null,
          created_at: "2026-07-25T01:00:00Z",
          updated_at: "2026-07-25T01:00:00Z",
          completed_at: null
        }]
      }]
    };
    expect(() => parsePlanApiSnapshot(value)).toThrow("Plan API 快照格式无效");
  });
});

function content(title: string) {
  return {
    schemaVersion: 1,
    kind: "todo.general",
    title,
    summary: title,
    locale: "zh-CN",
    sections: []
  };
}
```

- [ ] **Step 2: 运行测试确认先失败**

Run:

```powershell
npm test -- apps/desktop/src/main/planApi/planApiWireTypes.test.ts
```

Expected: FAIL，提示模块或 `parsePlanApiSnapshot` 不存在。

- [ ] **Step 3: 定义线格式和解析入口**

`planApiWireTypes.ts` 必须定义以下核心结构，不复用 renderer 类型：

```ts
export interface PlanApiContentDocument {
  schemaVersion: 1;
  kind: string;
  title: string;
  summary: string;
  locale: string;
  sections: PlanApiContentSection[];
}

export interface PlanApiTaskEntryView {
  id: string;
  task_id: string;
  scheduled_date: string;
  status: "pending" | "completed" | "skipped";
  content: PlanApiContentDocument;
  source: "manual" | "rule_generated" | "hermes";
  slot_key: string | null;
  is_overridden: boolean;
  generation_revision: number | null;
  version: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface PlanApiTaskView {
  id: string;
  kind: "daily" | "cycle";
  status: "active" | "paused" | "archived";
  generation_mode: "fixed" | "rolling";
  content: PlanApiContentDocument;
  schedule_rule: Record<string, unknown> | null;
  generated_through_date: string | null;
  rule_revision: number;
  version: number;
  created_at: string;
  updated_at: string;
  entries: PlanApiTaskEntryView[];
}

export interface PlanApiSnapshot {
  serverRevision: number;
  tasks: PlanApiTaskView[];
}

export interface PlanApiTaskEntryDraft {
  scheduled_date: string;
  status: "pending" | "completed" | "skipped";
  content: PlanApiContentDocument;
  source: "manual" | "rule_generated" | "hermes";
  slot_key: string | null;
  is_overridden: boolean;
  generation_revision: number | null;
  completed_at: string | null;
}

export type PlanApiMutationOperation =
  | { type: "task.create"; draft: {
      kind: "daily" | "cycle";
      status: "active" | "paused" | "archived";
      generation_mode: "fixed" | "rolling";
      content: PlanApiContentDocument;
      schedule_rule: Record<string, unknown> | null;
      generated_through_date: string | null;
      rule_revision: number;
      entries: PlanApiTaskEntryDraft[];
    } }
  | { type: "task.update"; targetId: string; expectedVersion: number;
      patch: Record<string, unknown> }
  | { type: "task.setStatus"; targetId: string; expectedVersion: number;
      status: "active" | "paused" | "archived" }
  | { type: "task.delete"; targetId: string; expectedVersion: number }
  | { type: "entry.create"; taskId: string; draft: PlanApiTaskEntryDraft }
  | { type: "entry.update"; targetId: string; expectedVersion: number;
      patch: Record<string, unknown> }
  | { type: "entry.complete" | "entry.reopen" | "entry.skip" | "entry.delete";
      targetId: string; expectedVersion: number };

export interface PlanApiMutationBatch {
  idempotencyKey: string;
  operations: PlanApiMutationOperation[];
}

export interface PlanApiMutationResult {
  serverRevision: number;
  changedTaskIds: string[];
  changedEntryIds: string[];
}

export interface PlanApiHealth {
  status: "ok";
  service: "plan-api";
  apiVersion: 1;
  database: { status: "ok" };
  serverRevision: number;
}

export function parsePlanApiSnapshot(value: unknown): PlanApiSnapshot {
  if (!isRecord(value) || !isNonNegativeInteger(value.serverRevision)
    || !Array.isArray(value.tasks)) {
    throw new Error("Plan API 快照格式无效");
  }
  return {
    serverRevision: value.serverRevision,
    tasks: value.tasks.map(parseTask)
  };
}
```

同文件提供 `parsePlanApiHealth` 和 `parsePlanApiMutationResult`。解析器逐层检查必需
字段、枚举、整数和数组，顶层未知结构直接拒绝。辅助解析函数拆分后仍需保持文件总行数
不超过 220 行。

`planApiBridgeContract.ts` 定义：

```ts
export type PlanApiConnectionMode = "local" | "ssh";
export type PlanApiRuntimeMode =
  | "unconfigured"
  | "connecting"
  | "online"
  | "offline_cache"
  | "migration_required"
  | "migration_blocked";

export interface PlanApiRuntimeStatus {
  mode: PlanApiRuntimeMode;
  canMutate: boolean;
  message: string;
  serverRevision?: number;
  lastSyncedAt?: string;
  cacheAvailable: boolean;
  migration?: {
    state: "required" | "blocked" | "completed" | "skipped";
    localTaskCount: number;
    localEntryCount: number;
    remoteTaskCount: number;
    message: string;
  };
}

export interface PlanApiSnapshotEnvelope {
  todos: unknown[];
  cyclePlans: unknown[];
  status: PlanApiRuntimeStatus;
}

export interface PlanApiConnectionInput {
  mode: PlanApiConnectionMode;
  baseUrl: string;
  sshTarget: string;
  localPort: number;
  remotePort: number;
  desktopToken: string;
}

export interface PlanApiPublicConfig {
  schemaVersion: 1;
  configured: boolean;
  mode: PlanApiConnectionMode;
  baseUrl: string;
  sshTarget: string;
  localPort: number;
  remotePort: number;
  tokenConfigured: boolean;
  tokenHint: string;
  updatedAt?: string;
}

export type PlanApiConnectionTestResult =
  | { ok: true; message: string; apiVersion: 1; serverRevision: number }
  | { ok: false; message: string };
```

- [ ] **Step 4: 运行解析测试**

Run:

```powershell
npm test -- apps/desktop/src/main/planApi/planApiWireTypes.test.ts
```

Expected: PASS，合法快照保留原值，缺失版本和非法枚举均被拒绝。

- [ ] **Step 5: 提交合同**

```powershell
git add -- apps/desktop/src/main/planApi/planApiWireTypes.ts apps/desktop/src/main/planApi/planApiWireTypes.test.ts apps/desktop/src/shared/planApiBridgeContract.ts
git diff --cached --name-only
git commit -m "feat: add plan api wire contracts"
```

---

### Task 2: HTTP 客户端与错误分类

**Files:**
- Create: `apps/desktop/src/main/planApi/planApiErrors.ts`
- Create: `apps/desktop/src/main/planApi/planApiClient.ts`
- Create: `apps/desktop/src/main/planApi/planApiClient.test.ts`

**Interfaces:**
- Consumes: `parsePlanApiSnapshot`、`PlanApiMutationBatch`。
- Produces: `PlanApiClient.health()`、`snapshot()`、`mutate(batch)`。
- Produces: `PlanApiError` 与稳定错误码。

- [ ] **Step 1: 写鉴权、超时和敏感信息测试**

```ts
it("classifies 401 without leaking the token", async () => {
  const client = new PlanApiClient({
    baseUrl: "http://127.0.0.1:8743",
    token: "secret-token",
    fetchImpl: vi.fn(async () => new Response(
      JSON.stringify({ code: "permission_denied", message: "denied", requestId: "r1" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    )) as typeof fetch
  });

  await expect(client.snapshot()).rejects.toMatchObject({
    code: "auth_failed",
    status: 401,
    requestId: "r1"
  });
  await expect(client.snapshot()).rejects.not.toThrow("secret-token");
});
```

- [ ] **Step 2: 运行测试确认先失败**

Run:

```powershell
npm test -- apps/desktop/src/main/planApi/planApiClient.test.ts
```

Expected: FAIL，客户端尚不存在。

- [ ] **Step 3: 实现最小 HTTP 客户端**

```ts
export class PlanApiClient {
  constructor(private readonly options: {
    baseUrl: string;
    token: string;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  }) {}

  health(): Promise<PlanApiHealth> {
    return this.request("/v1/health", { method: "GET" }, parseHealth);
  }

  snapshot(): Promise<PlanApiSnapshot> {
    return this.request("/v1/snapshot", { method: "GET" }, parsePlanApiSnapshot);
  }

  mutate(batch: PlanApiMutationBatch): Promise<PlanApiMutationResult> {
    return this.request(
      "/v1/mutations",
      { method: "POST", body: JSON.stringify(batch) },
      parseMutationResult
    );
  }
}
```

`request` 必须：

- 使用模板字符串构造 `Authorization: Bearer ${token}`。
- 使用 `Content-Type: application/json; charset=utf-8`。
- 使用 `AbortSignal.timeout(timeoutMs ?? 8_000)`。
- 将 401/403 映射为 `auth_failed`。
- 将 409 映射为 `version_conflict`。
- 将 422 映射为 `validation_failed`。
- 将网络错误和超时映射为 `offline`。
- 错误对象只保存状态码、服务端 `requestId` 和安全消息。

- [ ] **Step 4: 运行客户端测试**

Run:

```powershell
npm test -- apps/desktop/src/main/planApi/planApiClient.test.ts
```

Expected: PASS，Authorization 正确、快照被解析、Token 不出现在错误中。

- [ ] **Step 5: 提交客户端**

```powershell
git add -- apps/desktop/src/main/planApi/planApiErrors.ts apps/desktop/src/main/planApi/planApiClient.ts apps/desktop/src/main/planApi/planApiClient.test.ts
git diff --cached --name-only
git commit -m "feat: add authenticated plan api client"
```

---

### Task 3: ContentDocument 双向映射

**Files:**
- Create: `apps/desktop/src/main/planApi/contentDocumentMapper.ts`
- Create: `apps/desktop/src/main/planApi/contentDocumentMapper.test.ts`

**Interfaces:**
- Produces: `todoToContentDocument(todo)`、`cyclePlanToContentDocument(plan)`。
- Produces: `cycleEntryToContentDocument(entry)`、`contentDocumentToBlocks(content)`。

- [ ] **Step 1: 写未知领域内容保留测试**

```ts
it("preserves an unknown content section as a generic block", () => {
  const blocks = contentDocumentToBlocks({
    schemaVersion: 1,
    kind: "language.shadowing",
    title: "跟读训练",
    summary: "完成第三段",
    locale: "zh-CN",
    sections: [{
      id: "segment",
      label: "学习片段",
      layout: "fields",
      fields: [{ key: "repeat", label: "重复次数", type: "number", value: 4 }],
      items: []
    }]
  });

  expect(blocks[0]).toMatchObject({
    kind: "language.shadowing.segment",
    title: "学习片段",
    format: "json"
  });
  expect(blocks[0].data).toMatchObject({ layout: "fields" });
});
```

- [ ] **Step 2: 运行测试确认先失败**

Run:

```powershell
npm test -- apps/desktop/src/main/planApi/contentDocumentMapper.test.ts
```

Expected: FAIL，映射函数不存在。

- [ ] **Step 3: 实现稳定外壳映射**

普通待办固定生成：

```ts
{
  schemaVersion: 1,
  kind: "todo.general",
  title: todo.title,
  summary: todo.notes?.trim() || todo.title,
  locale: "zh-CN",
  sections: todo.notes?.trim() ? [{
    id: "notes",
    label: "备注",
    layout: "markdown",
    fields: [{
      key: "notes",
      label: "备注",
      type: "markdown",
      value: todo.notes.trim()
    }],
    items: []
  }] : []
}
```

周期任务顶层使用 `plan.cycle`，通过 `metadata.topic` 字段保存主题。周期条目将每个
`PlanContentBlock` 放入一个 section 的 `contentBlock` object 字段；反向映射时优先
识别该字段，否则把服务端 section 转成通用块，确保未知领域内容不丢失。

- [ ] **Step 4: 运行映射测试**

Run:

```powershell
npm test -- apps/desktop/src/main/planApi/contentDocumentMapper.test.ts
```

Expected: PASS，Todo 备注、计划主题、Markdown 块、JSON 块和未知 section 均可往返。

- [ ] **Step 5: 提交内容映射**

```powershell
git add -- apps/desktop/src/main/planApi/contentDocumentMapper.ts apps/desktop/src/main/planApi/contentDocumentMapper.test.ts
git diff --cached --name-only
git commit -m "feat: map desktop content documents"
```

---

### Task 4: 快照映射与版本索引

**Files:**
- Create: `apps/desktop/src/main/planApi/planApiVersionIndex.ts`
- Create: `apps/desktop/src/main/planApi/planApiVersionIndex.test.ts`
- Create: `apps/desktop/src/main/planApi/snapshotMapper.ts`
- Create: `apps/desktop/src/main/planApi/snapshotMapper.test.ts`

**Interfaces:**
- Consumes: `PlanApiSnapshot` 和 ContentDocument 映射。
- Produces: `mapPlanApiSnapshot(snapshot)`。
- Produces: `PlanApiVersionIndex.fromSnapshot(snapshot)`、`requireTask(id)`、`requireEntry(id)`。

- [ ] **Step 1: 写 daily/cycle 与版本索引测试**

```ts
it("maps a daily entry id to Todo.id and indexes its parent task", () => {
  const result = mapPlanApiSnapshot(snapshotFixture());
  expect(result.todos[0]).toMatchObject({
    id: "entry_daily",
    title: "本地联调待办",
    status: "pending",
    syncStatus: "synced"
  });
  expect(result.versionIndex.requireEntry("entry_daily")).toEqual({
    id: "entry_daily",
    taskId: "task_daily",
    version: 3,
    updatedAt: "2026-07-25T05:01:01.127614Z"
  });
});
```

- [ ] **Step 2: 运行测试确认先失败**

Run:

```powershell
npm test -- apps/desktop/src/main/planApi/snapshotMapper.test.ts apps/desktop/src/main/planApi/planApiVersionIndex.test.ts
```

Expected: FAIL，映射器和索引不存在。

- [ ] **Step 3: 实现映射规则**

`snapshotMapper.ts` 必须：

- `daily` 的唯一 Entry 映射为 Todo，`Todo.id = Entry.id`。
- `cycle` 的 Task 映射为 CyclePlan，`CyclePlan.id = Task.id`。
- `paused -> paused`、`archived -> archived`、`active -> active`。
- API 不存在 `draft/candidate`，因此不得在读取时生成这两个状态。
- `manual -> manual`、`hermes -> hermes`、`rule_generated -> hermes`。
- 所有远端对象的 `syncStatus = "synced"`。
- 返回 `{ todos, cyclePlans, versionIndex, serverRevision }`。

`PlanApiVersionIndex` 使用两个 Map 保存：

```ts
export interface EntryVersionRecord {
  id: string;
  taskId: string;
  version: number;
  updatedAt: string;
}

export interface TaskVersionRecord {
  id: string;
  version: number;
  updatedAt: string;
}
```

- [ ] **Step 4: 运行快照测试**

Run:

```powershell
npm test -- apps/desktop/src/main/planApi/snapshotMapper.test.ts apps/desktop/src/main/planApi/planApiVersionIndex.test.ts
```

Expected: PASS，ID、时间戳、状态、来源和版本关系完全匹配。

- [ ] **Step 5: 提交快照映射**

```powershell
git add -- apps/desktop/src/main/planApi/planApiVersionIndex.ts apps/desktop/src/main/planApi/planApiVersionIndex.test.ts apps/desktop/src/main/planApi/snapshotMapper.ts apps/desktop/src/main/planApi/snapshotMapper.test.ts
git diff --cached --name-only
git commit -m "feat: map plan api snapshots"
```

---

### Task 5: Todo 与周期任务变更适配

**Files:**
- Create: `apps/desktop/src/main/planApi/todoMutationAdapter.ts`
- Create: `apps/desktop/src/main/planApi/todoMutationAdapter.test.ts`
- Create: `apps/desktop/src/main/planApi/cycleMutationAdapter.ts`
- Create: `apps/desktop/src/main/planApi/cycleMutationAdapter.test.ts`
- Create: `apps/desktop/src/main/planApi/mutationAdapter.ts`
- Create: `apps/desktop/src/main/planApi/mutationAdapter.test.ts`

**Interfaces:**
- Consumes: `AppMutationBatch`、当前领域快照、`PlanApiVersionIndex`。
- Produces: `adaptAppMutationBatch(input)` 返回服务端 `PlanApiMutationBatch`。

- [ ] **Step 1: 写新增、更新和删除转换测试**

```ts
it("deletes a daily Todo by deleting its parent task", () => {
  const batch = adaptAppMutationBatch({
    batch: {
      source: { type: "manual" },
      summary: "删除待办",
      operations: [{
        type: "todo.delete",
        targetId: "entry_daily",
        expectedUpdatedAt: "2026-07-25T05:01:01.127614Z"
      }]
    },
    snapshot: mappedFixture(),
    versionIndex: versionIndexFixture(),
    idempotencyKey: "desktop-request-1"
  });

  expect(batch.operations).toEqual([{
    type: "task.delete",
    targetId: "task_daily",
    expectedVersion: 2
  }]);
});
```

另写测试确认：

- `todo.update` 修改标题时同时更新 Task 与 Entry content。
- `cyclePlan.create` 生成一个 `task.create`，Entry 嵌入 draft。
- `cyclePlan.entry.complete` 使用 Entry 版本。
- `draft` 状态写入时转换为 `paused`。
- `expectedUpdatedAt` 不匹配时在发请求前抛出 `version_conflict`。

- [ ] **Step 2: 运行适配器测试确认先失败**

Run:

```powershell
npm test -- apps/desktop/src/main/planApi/todoMutationAdapter.test.ts apps/desktop/src/main/planApi/cycleMutationAdapter.test.ts apps/desktop/src/main/planApi/mutationAdapter.test.ts
```

Expected: FAIL，适配器不存在。

- [ ] **Step 3: 实现适配器**

顶层输入固定为：

```ts
export interface MutationAdapterInput {
  batch: AppMutationBatch;
  snapshot: { todos: Todo[]; cyclePlans: CyclePlan[] };
  versionIndex: PlanApiVersionIndex;
  idempotencyKey: string;
}

export function adaptAppMutationBatch(
  input: MutationAdapterInput
): PlanApiMutationBatch {
  const operations = input.batch.operations.flatMap((operation) =>
    operation.type.startsWith("todo.")
      ? adaptTodoMutation(operation, input)
      : adaptCycleMutation(operation, input)
  );
  if (operations.length < 1 || operations.length > 100) {
    throw new PlanApiError("validation_failed", "变更操作数量超出服务限制");
  }
  return { idempotencyKey: input.idempotencyKey, operations };
}
```

来源规则：

- 手动批次 Entry source 为 `manual`。
- AI 批次 Entry source 为 `hermes`。
- 当前 UI 创建周期计划一律使用 `generation_mode: "fixed"`。
- Todo 删除映射为父 Task 删除，不能留下无 Entry 的 daily Task。

- [ ] **Step 4: 运行适配器测试**

Run:

```powershell
npm test -- apps/desktop/src/main/planApi/todoMutationAdapter.test.ts apps/desktop/src/main/planApi/cycleMutationAdapter.test.ts apps/desktop/src/main/planApi/mutationAdapter.test.ts
```

Expected: PASS，全部现有 `AiMutationOperation` 类型都有明确服务端映射。

- [ ] **Step 5: 提交变更适配器**

```powershell
git add -- apps/desktop/src/main/planApi/todoMutationAdapter.ts apps/desktop/src/main/planApi/todoMutationAdapter.test.ts apps/desktop/src/main/planApi/cycleMutationAdapter.ts apps/desktop/src/main/planApi/cycleMutationAdapter.test.ts apps/desktop/src/main/planApi/mutationAdapter.ts apps/desktop/src/main/planApi/mutationAdapter.test.ts
git diff --cached --name-only
git commit -m "feat: adapt desktop mutations for plan api"
```

---

### Task 6: 原子快照缓存

**Files:**
- Create: `apps/desktop/src/main/planApi/planApiSnapshotCache.ts`
- Create: `apps/desktop/src/main/planApi/planApiSnapshotCache.test.ts`

**Interfaces:**
- Produces: `PlanApiSnapshotCache.load()` 和 `save(snapshot)`。
- Cache path: `<userData>/data/plan-api-cache.v1.json`。

- [ ] **Step 1: 写损坏缓存和原子替换测试**

```ts
it("returns null for a damaged cache and never exposes credentials", async () => {
  await writeFile(join(directory, "plan-api-cache.v1.json"), "{broken", "utf8");
  const cache = new PlanApiSnapshotCache(directory);
  await expect(cache.load()).resolves.toBeNull();

  await cache.save({
    schemaVersion: 1,
    serverRevision: 7,
    syncedAt: "2026-07-25T08:00:00.000Z",
    todos: [],
    cyclePlans: []
  });
  const raw = await readFile(join(directory, "plan-api-cache.v1.json"), "utf8");
  expect(raw).not.toContain("token");
  expect(raw).not.toContain("Authorization");
});
```

- [ ] **Step 2: 运行缓存测试确认先失败**

Run:

```powershell
npm test -- apps/desktop/src/main/planApi/planApiSnapshotCache.test.ts
```

Expected: FAIL，缓存类不存在。

- [ ] **Step 3: 实现缓存**

缓存格式固定为：

```ts
interface StoredPlanApiCacheV1 {
  schemaVersion: 1;
  serverRevision: number;
  syncedAt: string;
  todos: Todo[];
  cyclePlans: CyclePlan[];
}
```

保存顺序必须是 `mkdir -> write temp -> rename -> rm temp`。读取失败或格式不合法返回
`null`，不得尝试修复为伪造空状态。

- [ ] **Step 4: 运行缓存测试**

Run:

```powershell
npm test -- apps/desktop/src/main/planApi/planApiSnapshotCache.test.ts
```

Expected: PASS，缓存写入原子、损坏时安全回退、无敏感字段。

- [ ] **Step 5: 提交缓存**

```powershell
git add -- apps/desktop/src/main/planApi/planApiSnapshotCache.ts apps/desktop/src/main/planApi/planApiSnapshotCache.test.ts
git diff --cached --name-only
git commit -m "feat: cache plan api snapshots"
```

---

### Task 7: 阶段一完整验证

**Files:**
- No code changes unless verification reveals a defect in Tasks 1-6.

**Interfaces:**
- Produces: 可由 Electron 运行时组合的稳定纯核心。

- [ ] **Step 1: 运行 Plan API 核心测试**

Run:

```powershell
npm test -- apps/desktop/src/main/planApi
```

Expected: PASS。

- [ ] **Step 2: 运行完整前端测试和类型检查**

Run:

```powershell
npm test
npm run typecheck
```

Expected: 全部 PASS，现有本地模式尚未改变。

- [ ] **Step 3: 检查新增源码行数**

Run:

```powershell
Get-ChildItem apps/desktop/src/main/planApi -File |
  Where-Object { $_.Extension -in ".ts", ".tsx" } |
  ForEach-Object {
    $lines = (Get-Content -LiteralPath $_.FullName | Measure-Object -Line).Lines
    if ($lines -gt 220) { "$lines $($_.FullName)" }
  }
```

Expected: 无输出。

- [ ] **Step 4: 核对阶段提交**

Run:

```powershell
git log --oneline -7
git status --short
```

Expected: 最近提交仅覆盖核心合同、客户端、映射、适配器与缓存；既有脏文件未被清理或覆盖。
