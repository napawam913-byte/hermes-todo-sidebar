# Desktop Plan API Final Review Fix Report

## Baseline And Safety

- Required baseline: `b87a09041a5fd0db6eaebe0688c57f7ea3ec2f33`
- Observed baseline before edits: `b87a09041a5fd0db6eaebe0688c57f7ea3ec2f33`
- No reset, clean, checkout, revert, stash, or broad staging command was used.
- Pre-existing user changes, including `planApiIpc.ts`, cycle plan files, pet assets,
  docs, data, integrations, Python scripts, and egg-info, were not edited or staged.

Initial `git status --short`:

```text
 M .gitignore
 M README.md
 M apps/desktop/src/main/planApi/planApiIpc.ts
 M apps/desktop/src/renderer/features/cyclePlans/CyclePlanEditorDrawer.test.tsx
 M apps/desktop/src/renderer/features/cyclePlans/CyclePlanEditorDrawer.tsx
 M apps/desktop/src/renderer/features/cyclePlans/CyclePlanEntryFields.tsx
 M apps/desktop/src/renderer/features/cyclePlans/cyclePlanDraft.ts
 M apps/desktop/src/renderer/features/cyclePlans/cyclePlanStore.ts
 M apps/desktop/src/renderer/features/todos/todoStore.ts
 M apps/desktop/src/renderer/styles/global.css
 M docs/agent-extension-points.md
 M docs/character-pack-spec.md
 M docs/cycle-plan-data-contract.md
 M docs/extension-points.md
 M docs/file-structure.md
 M docs/frontend-component-map.md
 M docs/frontend-motion-spec.md
 M docs/local-v1-usage.md
 M docs/superpowers/plans/2026-07-25-desktop-plan-api-03-ui-release.md
 M docs/superpowers/specs/2026-07-23-cloud-task-plan-api-design.md
 M scripts/pets/build_character_pack.py
?? apps/desktop/src/renderer/assets/pets/
?? apps/desktop/src/renderer/features/sidebar/PenguinPetSprite.tsx
?? data/
?? docs/ai-conversation-flow.md
?? docs/ai-direct-model-contract.md
?? docs/character-pack-v3.md
?? docs/pet-animation-spec.md
?? docs/state-management.md
?? docs/superpowers/plans/2026-07-17-todo-ai-layout-fix.md
?? docs/superpowers/specs/2026-07-17-todo-ai-layout-design.md
?? integrations/
?? scripts/pets/background_cleanup.py
?? scripts/pets/character_pack_v3.py
?? scripts/pets/install_character_pack.py
?? scripts/pets/prepare_character_pack.py
?? scripts/pets/tests/
?? services/plan-api/src/hermes_todo_plan_api.egg-info/
```

## TDD Evidence

### 1. First Connection Migration Decision

RED:

- `npm test -- apps/desktop/src/main/planApi/planApiRuntimeReleaseGaps.test.ts --reporter=dot`
- Result: 7 failed, 6 passed. Ready, pending, blocked, and inspection failure all
  incorrectly produced `online/canMutate=true`.
- `npm test -- apps/desktop/src/main/planApi/planApiBootstrap.test.ts --reporter=dot`
- Result: 1 failed, 4 passed. Production bootstrap did not inject a migration inspector.

GREEN:

- Production bootstrap now injects `PlanApiMigrationService.inspect()` without exposing
  a token.
- Runtime maps `ready/pending` to `migration_required`, unsafe blocked reasons to
  `migration_blocked`, and `legacy_empty/completed/skipped` to online.
- Inspection failure falls back read-only. A later refresh after migrate/keep restores
  online state.
- Focused combined result: 3 files passed, 26 tests passed.

### 2. Migration Completion Time Semantics

RED:

- `npm test -- apps/desktop/src/main/planApi/planApiMigrationService.test.ts --reporter=dot`
- Result: 2 failed, 8 passed. Equivalent timezone timestamps were rejected and matching
  invalid timestamps were accepted.

GREEN:

- Completion timestamps are validated as strict ISO instants, timezone offsets are
  normalized, and insignificant fractional trailing zeroes are ignored.
- Invalid calendar values, offsets, and timestamp shapes fail verification.
- Included in the focused combined result: 4 files passed, 24 tests passed.

### 3. Mutation Offline/5xx Downgrade

RED:

- Runtime release-gap test showed offline and HTTP 503 mutations left the runtime
  online and did not replace the live projection with cached read-only data.

GREEN:

- Offline and 5xx errors immediately publish `offline_cache/canMutate=false`, notify
  the reconnect loop, retain retryable manual idempotency keys, and rethrow the
  original error.
- Validation and HTTP 400 errors do not reconnect. Version conflict still refreshes
  the latest snapshot and does not reconnect when that refresh succeeds.
- Focused combined result: 3 files passed, 26 tests passed.

### 4. AI Proposal Removal Timing

RED:

- `npm test -- apps/desktop/src/main/ai/aiCoordinator.test.ts --reporter=dot`
- Result: 1 failed, 5 passed. Retry by the same proposal ID failed after an offline
  execution error.

GREEN:

- `AiCoordinator.execute()` removes a proposal only after executor success.
- Failure retains the same proposal ID for retry; a subsequent success removes it,
  and another sequential execution is rejected. Explicit discard remains unchanged.
- Included in the focused combined result: 4 files passed, 24 tests passed.

### 5. Skipped Daily Entry Mapping

RED:

- `npm test -- apps/desktop/src/main/planApi/snapshotMapper.test.ts --reporter=dot`
- Result: 2 failed, 2 passed. Mixed and all-skipped daily snapshots threw.

GREEN:

- Skipped daily entries are filtered from ordinary Todo projection.
- Pending entries still map normally, and the version index remains based on the
  original unfiltered Plan API snapshot.
- Included in the focused combined result: 4 files passed, 24 tests passed.

### 6. Desktop Token Immediate Clearing

RED:

- `npm test -- apps/desktop/src/renderer/features/settings/DataServiceSettings.test.tsx --reporter=dot`
- Result: 1 failed, 3 passed. The password input retained plaintext while save was
  pending.

GREEN:

- The submit handler copies the payload, schedules immediate token clearing, and then
  calls `saveConnection` with the copied value.
- A failed save does not restore plaintext; Base URL and other non-secret draft fields
  remain intact.
- Included in the focused combined result: 4 files passed, 24 tests passed.

## Files Changed

| File | Lines | Purpose |
| --- | ---: | --- |
| `apps/desktop/src/main/planApi/planApiRuntime.ts` | 218 | Migration gate and mutation downgrade integration |
| `apps/desktop/src/main/planApi/planApiRuntime.test.ts` | 220 | Existing runtime fixture receives explicit inspector |
| `apps/desktop/src/main/planApi/planApiRuntimeReleaseGaps.test.ts` | 211 | Release-gap runtime regressions |
| `apps/desktop/src/main/planApi/planApiMigrationRuntimeState.ts` | 45 | Single-purpose migration status mapping |
| `apps/desktop/src/main/planApi/planApiFailurePolicy.ts` | 13 | Single-purpose retry/failure classification |
| `apps/desktop/src/main/planApi/planApiMutationIdentity.ts` | 18 | Single-purpose stable mutation fingerprint |
| `apps/desktop/src/main/planApi/planApiBootstrap.ts` | 103 | Production migration inspector assembly |
| `apps/desktop/src/main/planApi/planApiBootstrap.test.ts` | 133 | Production assembly regression |
| `apps/desktop/src/main/planApi/planApiMigrationVerification.ts` | 118 | Semantic timestamp verification |
| `apps/desktop/src/main/planApi/planApiMigrationService.test.ts` | 149 | Equivalent/invalid timestamp regressions |
| `apps/desktop/src/main/ai/aiCoordinator.ts` | 164 | Remove proposal after confirmed success |
| `apps/desktop/src/main/ai/aiCoordinator.test.ts` | 198 | Same-ID retry and post-success rejection |
| `apps/desktop/src/main/planApi/snapshotMapper.ts` | 72 | Filter skipped daily entries |
| `apps/desktop/src/main/planApi/snapshotMapper.test.ts` | 98 | Mixed and all-skipped regressions |
| `apps/desktop/src/renderer/features/settings/DataServiceSettings.tsx` | 176 | Immediate sensitive-state clearing |
| `apps/desktop/src/renderer/features/settings/DataServiceSettings.test.tsx` | 170 | Pending and failed save regression |

The three additional production modules were required to keep `planApiRuntime.ts` below
the 220-line limit while preserving readable, single-purpose responsibilities.

## Final Verification

- Focused runtime/bootstrap:
  `npm test -- apps/desktop/src/main/planApi/planApiRuntimeReleaseGaps.test.ts apps/desktop/src/main/planApi/planApiRuntime.test.ts apps/desktop/src/main/planApi/planApiBootstrap.test.ts --reporter=dot`
  - PASS: 3 files, 26 tests.
- Focused remaining fixes:
  `npm test -- apps/desktop/src/main/planApi/planApiMigrationService.test.ts apps/desktop/src/main/ai/aiCoordinator.test.ts apps/desktop/src/main/planApi/snapshotMapper.test.ts apps/desktop/src/renderer/features/settings/DataServiceSettings.test.tsx --reporter=dot`
  - PASS: 4 files, 24 tests.
- `npm test -- --reporter=dot`
  - PASS: 132 files, 493 tests.
- `npm run typecheck`
  - PASS: renderer and Electron TypeScript projects.
- `npm run check:source-lines`
  - PASS: no checked source file exceeds 220 lines.
- `npm run build`
  - PASS: typecheck, Electron main build, and renderer build; 1686 modules transformed.
- `C:\tmp\hermes-plan-api-python311\python.exe -m pytest services\plan-api\tests -q -p no:cacheprovider`
  - First run: 1 failed, 209 passed. The unrelated backup uniqueness test observed one
    same-microsecond filename collision.
  - Focused rerun of `test_backup.py`: PASS, 3 tests.
  - Required full-command rerun: PASS, 210 tests, with one existing Starlette/httpx
    deprecation warning.
- Scoped `git diff --check`
  - PASS; only Git LF-to-CRLF working-copy notices were emitted.

## Concerns

- The Python suite produced one transient, non-reproducible backup filename collision
  on its first full run. The focused backup file and the complete required command both
  passed immediately afterward. No out-of-scope Python change was made.
- The passing Python run still reports the existing Starlette `httpx` deprecation
  warning.

## Backup Collision Safety Follow-Up

The earlier classification of the backup collision as transient is superseded by this
follow-up. Independent validation reproduced the failure, and a frozen-clock regression
confirmed the root cause: the timestamp was used as a unique identifier even though
Windows can return the same clock value for consecutive calls, while `Path.replace()`
silently overwrote the existing destination.

### TDD Evidence

RED:

- Added a frozen-clock same-timestamp test that changes `server_revision` between two
  backups and verifies both paths and database contents remain distinct.
- Added a same-timestamp retention test that creates three backups with `keep=2` and
  requires the first collision sequence to be pruned.
- Command:
  `C:\tmp\hermes-plan-api-python311\python.exe -m pytest services\plan-api\tests\test_backup.py -q -p no:cacheprovider`
- Result: 2 failed, 2 passed. Consecutive calls returned the same path and the oldest
  colliding backup could not be pruned independently.

GREEN:

- Backup creation now writes to a unique temporary file and publishes the complete
  SQLite file with `os.link`, which atomically fails rather than overwriting an existing
  destination.
- Same-timestamp collisions use monotonically increasing numeric suffixes. Concurrent
  publication that claims the same suffix retries the next suffix.
- Retention sorting compares timestamp, fractional time, and numeric collision sequence,
  preserving newest-backup semantics for both legacy names and collision-safe names.

### Files And Line Limits

- `services/plan-api/src/plan_api/backup.py`: 78 lines.
- `services/plan-api/tests/test_backup.py`: 108 lines.
- No TypeScript or other source file was changed in this follow-up.

### Verification

- Focused backup command run 1: PASS, 4 tests.
- Focused backup command run 2: PASS, 4 tests.
- Focused backup command run 3: PASS, 4 tests.
- Full command:
  `C:\tmp\hermes-plan-api-python311\python.exe -m pytest services\plan-api\tests -q -p no:cacheprovider`
- Full result: PASS, 211 tests, with the existing Starlette/httpx deprecation warning.

### Remaining Concern

- The backup collision blocker is resolved. The only remaining observation is the
  existing Starlette `httpx` deprecation warning, which is outside this fix scope.

## 最终复审第二轮修复

最终整分支复审指出两个仍会阻断发布的端到端缺口：renderer 会锁死不确定
写入失败的提案，以及在线 mutation 遇到 401/403 后仍保持可写。本轮没有
修改数据结构、Plan API 协议或持久化格式。

### TDD 红灯证据

命令：

`npm test -- apps/desktop/src/renderer/features/ai/aiPlannerState.test.ts apps/desktop/src/renderer/features/ai/AiFlowViews.test.tsx apps/desktop/src/renderer/features/ai/useAiPlannerRetry.test.tsx apps/desktop/src/main/planApi/planApiRuntimeReleaseGaps.test.ts --reporter=dot`

结果：4 个测试失败、21 个通过。

- `persistence_failed` 被 reducer 设为 `failed`，第二次执行没有调用 bridge。
- 结果页仍显示“整批已回滚”和“刷新并重新生成”。
- `auth_failed` 后 runtime 仍为 `online/canMutate=true`，未切换缓存。

### 绿色实现

- `persistence_failed` 保留原提案的 `pending` 可执行阶段。
- 结果页显示“写入结果待确认”，通过 `onRetry` 调用现有
  `executeProposal()`，因此继续使用原 `proposalId` 和幂等键。
- `target_missing`、`version_conflict`、`validation_failed` 仍保持只读，
  继续走刷新后重新生成。
- mutation 认证失败会加载缓存、发布 `offline_cache/canMutate=false` 并向上
  返回原错误；认证失败不会启动 reconnect。
- 把认证运行时场景拆入独立测试文件，避免压缩
  `planApiRuntimeReleaseGaps.test.ts` 并保持所有文件不超过 220 行。

### 本轮文件

- `apps/desktop/src/renderer/features/ai/aiPlannerState.ts`
- `apps/desktop/src/renderer/features/ai/aiPlannerState.test.ts`
- `apps/desktop/src/renderer/features/ai/AiExecutionPanel.tsx`
- `apps/desktop/src/renderer/features/ai/AiPlannerView.tsx`
- `apps/desktop/src/renderer/features/ai/AiFlowViews.test.tsx`
- `apps/desktop/src/renderer/features/ai/useAiPlannerRetry.test.tsx`
- `apps/desktop/src/main/planApi/planApiFailurePolicy.ts`
- `apps/desktop/src/main/planApi/planApiRuntime.ts`
- `apps/desktop/src/main/planApi/planApiRuntimeReleaseGaps.test.ts`
- `apps/desktop/src/main/planApi/planApiRuntimeAuth.test.ts`

### 验证结果

- focused 回归：5 个文件、25 个测试通过。
- `npm test -- --reporter=dot`：134 个文件、497 个测试通过。
- `npm run typecheck`：通过。
- `npm run check:source-lines`：通过。
- `npm run build`：通过，renderer 共转换 1686 个模块。
- Plan API Python 全量：211 个测试通过；保留一个既有 Starlette/httpx
  弃用警告。
