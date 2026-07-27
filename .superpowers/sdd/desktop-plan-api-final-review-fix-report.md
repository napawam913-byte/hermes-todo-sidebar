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
