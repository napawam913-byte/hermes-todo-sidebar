# Phase 3 Task 2 Report

## Changes

- Added the `data` settings section, persistent session selection, a three-tab compact layout, and a 156px desktop settings navigation.
- Added Plan API data-service configuration, connection testing, masked Token handling, public status presentation, read-only browser preview, and real migration inspection actions with second confirmation.
- Added the existing model connection settings files as self-contained settings-module dependencies.

## Verification

- `npm test -- apps/desktop/src/renderer/features/settings apps/desktop/src/renderer/features/sidebar/panelSessionState.test.ts apps/desktop/src/renderer/styles/settingsLayout.test.ts`
  - Passed: 7 files, 16 tests.
- `npm run typecheck`
  - Passed.
- `git diff --check`
  - Passed; existing working-tree CRLF warnings only.

## Line Counts

All changed TS, TSX, and CSS files are at or below 220 lines. Largest files: `settings-shell.css` 214, `data-service-settings.css` 160, `DataServiceSettings.tsx` 157, `DataServiceSettings.test.tsx` 123.

## Commit Scope

Commit hash: `HEAD` (the finalized hash is reported in the task response).

- `apps/desktop/src/renderer/features/sidebar/panelSessionState.ts`
- `apps/desktop/src/renderer/features/sidebar/panelSessionState.test.ts`
- `apps/desktop/src/renderer/features/settings/SettingsShell.tsx`
- `apps/desktop/src/renderer/features/settings/SettingsShell.test.tsx`
- `apps/desktop/src/renderer/features/settings/SettingsPanel.tsx`
- `apps/desktop/src/renderer/features/settings/ModelConnectionSettings.tsx`
- `apps/desktop/src/renderer/features/settings/ModelConnectionSettings.test.tsx`
- `apps/desktop/src/renderer/features/settings/settingsModelStatus.ts`
- `apps/desktop/src/renderer/features/settings/settingsModelStatus.test.ts`
- `apps/desktop/src/renderer/features/settings/DataServiceSettings.tsx`
- `apps/desktop/src/renderer/features/settings/DataServiceSettings.test.tsx`
- `apps/desktop/src/renderer/features/settings/dataServicePresentation.ts`
- `apps/desktop/src/renderer/features/settings/dataServicePresentation.test.ts`
- `apps/desktop/src/renderer/styles/data-service-settings.css`
- `apps/desktop/src/renderer/styles/settings-shell.css`
- `apps/desktop/src/renderer/styles/settingsLayout.test.ts`
- `apps/desktop/src/renderer/styles/global.css` (only the settings-shell and data-service imports are staged)
- `.superpowers/sdd/desktop-plan-api-ui-task-2-report.md`

## Self-Review

- Token input is component-local, uses `password`, is never rehydrated from public config, and is cleared after a successful save.
- The form sends current inputs to test without saving, clears a test result on every field change, and disables repeated submissions while the controller is busy.
- Migration copy comes only from `PlanApiMigrationInspection`; there is no local-data or mode inference. Both destructive paths require a second same-panel confirmation.
- The data status dot only receives semantic labels; it never receives Base URL, SSH target, or Token values.

## Concerns

- Task 3 must create and pass the real `PlanApiDataServiceController` through `App` and `TodoPanel`. Until then, this task intentionally renders the explicit read-only browser-preview state.

## Fix Round 1

### Changes

- Added a request-version guard and local test-request lock. Editing a field invalidates an in-flight response, and test/save buttons remain disabled until that request settles.
- Added public `本次测试模式` and `本次测试版本` facts from the successful current draft, alongside the distinct saved connection facts.
- Moved model/data status semantics into each sidebar button's accessible name; status dots are now decorative only.
- Strengthened the 360px compact-tab CSS contract for three equal tracks, zero minimum width, clipping, and no horizontal overflow.

### Verification

- `npm test -- apps/desktop/src/renderer/features/settings apps/desktop/src/renderer/features/sidebar/panelSessionState.test.ts apps/desktop/src/renderer/styles/settingsLayout.test.ts`
  - Passed: 7 files, 18 tests.
- `npm run typecheck`
  - Passed.
- `git diff --check`
  - Passed; existing working-tree CRLF warnings only.

### Line Counts

- `DataServiceSettings.tsx`: 177
- `DataServiceSettings.test.tsx`: 165
- `SettingsShell.tsx`: 99
- `SettingsShell.test.tsx`: 70
- `settings-shell.css`: 218
- `settingsLayout.test.ts`: 44

### Self-Review

- A stale result can no longer overwrite post-edit state because only the current request version writes `testResult`.
- The local `testing` lock remains active after an edit until the outstanding request resolves, preventing duplicate test or save submissions.
- Test facts expose only the draft mode and returned revision; no Base URL, SSH target, or Token is surfaced.
- Fix scope is limited to the original Task 2 whitelist and this report; no historical dirty changes were staged.

## Fix Round 2

### RED

- `npm test -- apps/desktop/src/renderer/styles/neutralGlassTokens.test.ts apps/desktop/src/renderer/styles/settingsLayout.test.ts`
  - Failed as expected: `neutralGlassTokens.test.ts` reported `--ui-accent-contrast` as the only referenced-but-undeclared UI token.

### Changes

- Replaced the undeclared `--ui-accent-contrast` reference in `data-service-settings.css` with the existing semantic Neutral Glass token `--ui-text-on-accent`.
- Added no token declarations and changed no historical dirty files.

### Verification

- `npm test -- apps/desktop/src/renderer/styles/neutralGlassTokens.test.ts apps/desktop/src/renderer/styles/settingsLayout.test.ts`
  - Passed: 2 files, 12 tests.
- `npm test -- apps/desktop/src/renderer/features/settings apps/desktop/src/renderer/features/sidebar/panelSessionState.test.ts apps/desktop/src/renderer/styles/settingsLayout.test.ts`
  - Passed: 7 files, 18 tests.
- `npm run typecheck`
  - Passed.
- `git diff --check`
  - Passed; existing working-tree CRLF warnings only.

### Line Counts

- `data-service-settings.css`: 160

### Self-Review

- The accent action foreground now uses the repository's declared semantic token.
- No duplicate or alias token was introduced.
- Fix Round 2 modifies only `data-service-settings.css` and this Task 2 report.
