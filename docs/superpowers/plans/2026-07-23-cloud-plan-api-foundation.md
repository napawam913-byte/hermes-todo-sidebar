# Cloud Plan API Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个可独立运行、可测试和可部署的 FastAPI + SQLite Plan API，完成统一任务、灵活内容、原子操作、今日查询、未来 7 天滚动生成、双令牌鉴权和备份。

**Architecture:** Plan API 是唯一数据库写入边界，使用同步 `sqlite3` 仓储和短事务，FastAPI 同步路由由线程池执行。领域合同、数据库连接、仓储、业务服务和 HTTP 路由分层；本计划不修改 Hermes Plugin 或 Electron，它们在后续独立计划中消费这里固化的 API。

**Tech Stack:** Python 3.11、FastAPI、Pydantic v2、Uvicorn、标准库 `sqlite3`、pytest、HTTPX TestClient。

## Global Constraints

- 设计来源：`docs/superpowers/specs/2026-07-23-cloud-task-plan-api-design.md`。
- Plan API 仅监听 `127.0.0.1:8743`，不得在第一阶段开放公网端口。
- SQLite 是唯一真实数据源；所有写入必须经过服务层事务。
- 领域内容只存 `content_json`，日期、状态、版本和生成规则保持结构化字段。
- 单个内容最多 64 KB、嵌套最多 8 层、单数组最多 200 项。
- 滚动计划只支持 `daily` 与 `weekly` 节奏，窗口固定为未来 7 天。
- 所有写请求必须携带幂等键；修改和删除必须检查 `expectedVersion`。
- 所有新增 Python 源码文件不超过 220 行，SQL、Markdown 和测试夹具不计入源码上限。
- 所有中文文件使用 UTF-8，不把令牌或完整内容写入日志。
- 本阶段不修改现有 Electron、Hermes Plugin、本地 JSON 和发布版本。

## Phase Boundary

本计划只交付 Plan API Foundation。后续分别编写并执行：

1. Hermes Proposal Integration：提案生命周期、确认工具、Skill 和自然语言确认。
2. Desktop Cloud Migration：Cloud Data Gateway、只读缓存、旧数据迁移和 UI 连接状态。

---

### Task 1: FastAPI Package And App Factory

**Files:**
- Create: `services/plan-api/pyproject.toml`
- Create: `services/plan-api/src/plan_api/__init__.py`
- Create: `services/plan-api/src/plan_api/settings.py`
- Create: `services/plan-api/src/plan_api/app.py`
- Create: `services/plan-api/tests/test_app.py`

**Interfaces:**
- Produces: `Settings.from_env() -> Settings`
- Produces: `create_app(settings: Settings | None = None) -> FastAPI`
- Produces: `GET /v1/health`

- [ ] **Step 1: Write the failing app factory test**

```python
from fastapi.testclient import TestClient
from plan_api.app import create_app
from plan_api.settings import Settings


def test_health_identifies_service(tmp_path):
    settings = Settings(
        database_path=tmp_path / "plan.db",
        desktop_token="desktop-test-token",
        hermes_token="hermes-test-token",
    )
    with TestClient(create_app(settings)) as client:
        response = client.get("/v1/health")
    assert response.status_code == 200
    assert response.json()["service"] == "plan-api"
```

- [ ] **Step 2: Run it and verify failure**

Run: `python -m pytest services/plan-api/tests/test_app.py -q`  
Expected: FAIL with `ModuleNotFoundError: No module named 'plan_api'`.

- [ ] **Step 3: Add the package and minimal app**

`pyproject.toml`:

```toml
[project]
name = "hermes-todo-plan-api"
version = "0.1.0"
requires-python = ">=3.11,<3.12"
dependencies = [
  "fastapi>=0.115,<1",
  "pydantic>=2.10,<3",
  "uvicorn>=0.32,<1",
]

[project.optional-dependencies]
dev = ["httpx>=0.27,<1", "pytest>=8,<10"]

[build-system]
requires = ["setuptools>=75"]
build-backend = "setuptools.build_meta"

[tool.setuptools.packages.find]
where = ["src"]

[tool.setuptools.package-data]
plan_api = ["db/sql/*.sql"]

[tool.pytest.ini_options]
pythonpath = ["src"]
testpaths = ["tests"]
```

`settings.py`:

```python
from dataclasses import dataclass
from pathlib import Path
import os


@dataclass(frozen=True, slots=True)
class Settings:
    database_path: Path
    desktop_token: str
    hermes_token: str

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            database_path=Path(os.environ["PLAN_DATABASE_PATH"]),
            desktop_token=os.environ["PLAN_DESKTOP_TOKEN"],
            hermes_token=os.environ["PLAN_HERMES_TOKEN"],
        )
```

`app.py` creates `FastAPI(title="Hermes Todo Plan API", version="1")` and returns `{"status":"ok","service":"plan-api","apiVersion":1}` from `/v1/health`.

- [ ] **Step 4: Install and rerun**

Run:

```powershell
python -m pip install -e "services/plan-api[dev]"
python -m pytest services/plan-api/tests/test_app.py -q
```

Expected: `1 passed`.

- [ ] **Step 5: Commit**

```powershell
git add services/plan-api
git commit -m "feat: scaffold cloud plan api"
```

---

### Task 2: Self-Describing Content Contract

**Files:**
- Create: `services/plan-api/src/plan_api/contracts/content.py`
- Create: `services/plan-api/src/plan_api/validation/json_bounds.py`
- Create: `services/plan-api/tests/contracts/test_content.py`

**Interfaces:**
- Produces: `ContentField`, `ContentItem`, `ContentSection`, `ContentDocument`
- Produces: `validate_content_payload(payload: object) -> ContentDocument`

- [ ] **Step 1: Write failing contract tests**

Create fixtures for `fitness.workout` with `reps: [15,12,12]` and `learning.tutorial` with `section: "3.2"`. Assert both validate. Add cases for an unknown top-level field, 65 KB value, 9-level object and 201-item array; each must be rejected.

Run: `python -m pytest services/plan-api/tests/contracts/test_content.py -q`  
Expected: FAIL because the contract module is missing.

- [ ] **Step 2: Implement the fixed envelope**

```python
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field
from ..validation.json_bounds import enforce_json_bounds


class ContentField(BaseModel):
    model_config = ConfigDict(extra="forbid")
    key: str = Field(pattern=r"^[A-Za-z][A-Za-z0-9_.-]*$", max_length=80)
    label: str = Field(min_length=1, max_length=120)
    type: str = Field(min_length=1, max_length=80)
    value: Any


class ContentItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=160)
    fields: list[ContentField] = Field(default_factory=list, max_length=100)


class ContentSection(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1, max_length=80)
    label: str = Field(min_length=1, max_length=120)
    layout: Literal["fields", "list", "markdown", "table"]
    fields: list[ContentField] = Field(default_factory=list, max_length=100)
    items: list[ContentItem] = Field(default_factory=list, max_length=100)


class ContentDocument(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schemaVersion: Literal[1]
    kind: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=1, max_length=200)
    summary: str = Field(min_length=1, max_length=500)
    locale: str = Field(min_length=2, max_length=20)
    sections: list[ContentSection] = Field(default_factory=list, max_length=100)


def validate_content_payload(payload: object) -> ContentDocument:
    enforce_json_bounds(payload, max_bytes=65536, max_depth=8, max_array=200)
    return ContentDocument.model_validate(payload)
```

`enforce_json_bounds` serializes with `ensure_ascii=False`, rejects non-JSON values, recursively检查深度与数组长度，并抛出稳定错误：`content_too_large`、`content_too_deep`、`array_too_large`。

- [ ] **Step 3: Verify and commit**

Run: `python -m pytest services/plan-api/tests/contracts/test_content.py -q`  
Expected: all content tests PASS.

```powershell
git add services/plan-api/src/plan_api/contracts services/plan-api/src/plan_api/validation services/plan-api/tests/contracts
git commit -m "feat: define flexible task content contract"
```

---

### Task 3: SQLite Schema And Migrations

**Files:**
- Create: `services/plan-api/src/plan_api/db/database.py`
- Create: `services/plan-api/src/plan_api/db/migrations.py`
- Create: `services/plan-api/src/plan_api/db/sql/001_initial.sql`
- Create: `services/plan-api/tests/db/test_database.py`
- Create: `services/plan-api/tests/db/test_migrations.py`

**Interfaces:**
- Produces: `Database.connect()`
- Produces: `Database.transaction()`
- Produces: `apply_migrations(database: Database) -> None`

- [ ] **Step 1: Write failing database tests**

Assert migration creates `tasks`、`task_entries`、`agent_sessions`、`agent_proposals`、`audit_events`、`schema_migrations`、`app_meta` and `idempotency_records`. Assert transaction rollback, foreign-key cascade, WAL mode and generated-entry uniqueness.

Run: `python -m pytest services/plan-api/tests/db -q`  
Expected: FAIL because database modules are missing.

- [ ] **Step 2: Implement the connection boundary**

```python
@contextmanager
def connect(self):
    self.path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(self.path, timeout=5, isolation_level=None)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA busy_timeout = 5000")
    connection.execute("PRAGMA journal_mode = WAL")
    try:
        yield connection
    finally:
        connection.close()


@contextmanager
def transaction(self):
    with self.connect() as connection:
        connection.execute("BEGIN IMMEDIATE")
        try:
            yield connection
            connection.commit()
        except BaseException:
            connection.rollback()
            raise
```

`001_initial.sql` must use the exact fields and enum checks from the approved design. Add:

```sql
CREATE UNIQUE INDEX uq_generated_entry
ON task_entries(task_id, scheduled_date, slot_key)
WHERE slot_key IS NOT NULL;

CREATE INDEX ix_entries_today
ON task_entries(scheduled_date, status);

CREATE INDEX ix_tasks_status
ON tasks(status, kind);
```

`apply_migrations` reads numbered SQL resources in lexical order, verifies SHA-256, uses `sqlite3.complete_statement()` to execute statements inside `BEGIN IMMEDIATE`, and records the migration only before the same transaction commits.

- [ ] **Step 3: Verify and commit**

Run: `python -m pytest services/plan-api/tests/db -q`  
Expected: all database tests PASS.

```powershell
git add services/plan-api/src/plan_api/db services/plan-api/tests/db
git commit -m "feat: add plan api sqlite schema"
```

---

### Task 4: Task Repository And Today Query

**Files:**
- Create: `services/plan-api/src/plan_api/contracts/tasks.py`
- Create: `services/plan-api/src/plan_api/repositories/task_repository.py`
- Create: `services/plan-api/src/plan_api/services/query_service.py`
- Create: `services/plan-api/tests/repositories/test_task_repository.py`
- Create: `services/plan-api/tests/services/test_today_query.py`

**Interfaces:**
- Produces: `TaskRepository.insert_task(connection, draft) -> str`
- Produces: `TaskRepository.get_task(connection, task_id) -> TaskView | None`
- Produces: `QueryService.today(target_date: date) -> TodayView`

- [ ] **Step 1: Write failing repository and date tests**

Create active daily、active cycle、paused cycle and overdue entries. Assert daily has exactly one entry, same-day cycle slots coexist, paused entries are excluded, overdue rows sort first, and completed-today uses Shanghai-local calendar day.

Run: `python -m pytest services/plan-api/tests/repositories services/plan-api/tests/services/test_today_query.py -q`  
Expected: FAIL because repository modules are missing.

- [ ] **Step 2: Implement typed rows and one today query**

Define strict enums for task kind/status、generation mode、entry status/source. Parse every JSON column with `validate_content_payload`; raw `sqlite3.Row` must not leave the repository.

The query uses UTC boundaries computed from `ZoneInfo("Asia/Shanghai")`:

```sql
SELECT e.*, t.kind AS task_kind, t.status AS task_status,
       t.content_json AS task_content_json
FROM task_entries e
JOIN tasks t ON t.id = e.task_id
WHERE t.status = 'active'
  AND (
    e.scheduled_date = ?
    OR (e.scheduled_date < ? AND e.status = 'pending')
    OR (
      e.status = 'completed'
      AND e.completed_at >= ?
      AND e.completed_at < ?
    )
  )
ORDER BY
  CASE WHEN e.status = 'pending' AND e.scheduled_date < ? THEN 0 ELSE 1 END,
  e.scheduled_date,
  e.created_at;
```

- [ ] **Step 3: Verify and commit**

Run: `python -m pytest services/plan-api/tests/repositories services/plan-api/tests/services/test_today_query.py -q`  
Expected: all repository and today tests PASS.

```powershell
git add services/plan-api/src/plan_api/contracts/tasks.py services/plan-api/src/plan_api/repositories services/plan-api/src/plan_api/services/query_service.py services/plan-api/tests/repositories services/plan-api/tests/services/test_today_query.py
git commit -m "feat: query unified cloud tasks"
```

---

### Task 5: Atomic Mutation Executor

**Files:**
- Create: `services/plan-api/src/plan_api/contracts/mutations.py`
- Create: `services/plan-api/src/plan_api/services/mutation_executor.py`
- Create: `services/plan-api/src/plan_api/services/task_mutations.py`
- Create: `services/plan-api/src/plan_api/services/entry_mutations.py`
- Create: `services/plan-api/tests/services/test_mutation_executor.py`

**Interfaces:**
- Produces: `MutationExecutor.execute(batch, actor) -> MutationResult`
- Produces errors: `target_missing`、`version_conflict`、`validation_failed`、`permission_denied`、`persistence_failed`

- [ ] **Step 1: Write failing mutation matrix**

Test all operations: `task.create/update/setStatus/delete` and `entry.create/update/complete/reopen/skip/delete`. Assert a failing second operation rolls back the first, stale versions return `version_conflict`, daily creation rejects zero/two entries, cascade delete works, and repeated idempotency keys return the original result.

Run: `python -m pytest services/plan-api/tests/services/test_mutation_executor.py -q`  
Expected: FAIL because mutation modules are missing.

- [ ] **Step 2: Implement strict operation unions and one transaction**

```python
def execute(self, batch: MutationBatch, actor: Actor) -> MutationResult:
    try:
        with self._database.transaction() as connection:
            cached = self._idempotency.find(connection, batch.idempotencyKey)
            if cached is not None:
                return cached
            changed_tasks: set[str] = set()
            changed_entries: set[str] = set()
            for operation in batch.operations:
                task_ids, entry_ids = self._dispatch(
                    connection, operation, actor
                )
                changed_tasks.update(task_ids)
                changed_entries.update(entry_ids)
            revision = self._bump_revision(connection)
            result = MutationResult(
                serverRevision=revision,
                changedTaskIds=sorted(changed_tasks),
                changedEntryIds=sorted(changed_entries),
            )
            self._write_audit(connection, batch, actor, result)
            self._idempotency.save(
                connection, batch.idempotencyKey, batch.request_hash(), result
            )
            return result
    except MutationError:
        raise
    except Exception as error:
        raise MutationError("persistence_failed") from error
```

The same idempotency key with a different request hash returns `validation_failed`. Every update/delete executes `WHERE id = ? AND version = ?`; zero rows must distinguish missing target from stale version.

- [ ] **Step 3: Verify and commit**

Run: `python -m pytest services/plan-api/tests/services/test_mutation_executor.py services/plan-api/tests/db -q`  
Expected: all tests PASS with no partial rows.

```powershell
git add services/plan-api/src/plan_api/contracts/mutations.py services/plan-api/src/plan_api/services services/plan-api/tests/services/test_mutation_executor.py
git commit -m "feat: execute cloud task mutations atomically"
```

---

### Task 6: Seven-Day Rolling Generator

**Files:**
- Create: `services/plan-api/src/plan_api/contracts/schedule_rules.py`
- Create: `services/plan-api/src/plan_api/services/rolling_generator.py`
- Create: `services/plan-api/src/plan_api/services/rule_adjustment.py`
- Create: `services/plan-api/tests/services/test_rolling_generator.py`
- Create: `services/plan-api/tests/services/test_rule_adjustment.py`

**Interfaces:**
- Produces: `ScheduleRuleV1` with `daily | weekly` cadence
- Produces: `RollingGenerator.ensure_window(today: date) -> RollingResult`
- Produces: `RuleAdjustmentService.replace_future(connection, task_id, rule, expected_version, today) -> RuleAdjustmentResult`

- [ ] **Step 1: Write deterministic failing tests**

Use `2026-07-23`. Assert daily creates seven dates, weekly only matches ISO weekdays, second run adds zero rows, slots preserve content/revision/source, paused/fixed tasks are ignored, and `horizonDays != 7` is rejected.

Add rule-adjustment tests asserting that a new rule:

- preserves historical, completed and skipped entries;
- preserves `is_overridden = true` future entries;
- removes only future pending `rule_generated` entries from the previous revision;
- creates the new seven-day window inside the caller's transaction;
- reports exact added, replaced and removed counts;
- rolls back the rule and every entry when any new content fails validation.

Run: `python -m pytest services/plan-api/tests/services/test_rolling_generator.py services/plan-api/tests/services/test_rule_adjustment.py -q`  
Expected: FAIL because rolling modules are missing.

- [ ] **Step 2: Implement cadence matching and idempotent inserts**

```python
def matches(cadence: Cadence, candidate: date) -> bool:
    if cadence.type == "daily":
        return True
    return candidate.isoweekday() in cadence.weekdays


def ensure_window(self, today: date) -> RollingResult:
    end = today + timedelta(days=6)
    created: list[str] = []
    metadata_changed = False
    with self._database.transaction() as connection:
        for task in self._repository.list_rolling_active(connection):
            rule = ScheduleRuleV1.model_validate_json(task.schedule_rule_json)
            for candidate in date_range(today, end):
                for slot in rule.slots:
                    if matches(slot.cadence, candidate):
                        entry_id = self._repository.insert_generated_if_absent(
                            connection, task, slot, candidate
                        )
                        if entry_id is not None:
                            created.append(entry_id)
            metadata_changed |= self._repository.mark_generated_through(
                connection, task.id, end, task.rule_revision
            )
        revision = self._bump_if_changed(
            connection, bool(created) or metadata_changed
        )
    return RollingResult(createdEntryIds=created, serverRevision=revision)
```

`mark_generated_through` checks `rule_revision`, not business `version`, so daily maintenance does not invalidate user edit proposals.

Expose an internal `ensure_task_window(connection, task, rule, today)` method so scheduled maintenance and rule adjustment share generation logic without nesting transactions. `RuleAdjustmentService` must:

```python
def replace_future(self, connection, task, new_rule, expected_version, today):
    self._assert_version(task, expected_version)
    removed = self._repository.delete_replaceable_future(
        connection=connection,
        task_id=task.id,
        from_date=today,
        generation_revision=task.rule_revision,
    )
    updated = self._repository.update_rule(
        connection=connection,
        task_id=task.id,
        expected_version=expected_version,
        schedule_rule_json=new_rule.model_dump_json(),
        next_rule_revision=task.rule_revision + 1,
    )
    created = self._generator.ensure_task_window(
        connection, updated, new_rule, today
    )
    return RuleAdjustmentResult(
        added=len(created),
        removed=removed,
        replaced=min(len(created), removed),
    )
```

Wire a `scheduleRule` change in `task.update` to this service. A normal title/content update must not regenerate entries.

- [ ] **Step 3: Verify and commit**

Run: `python -m pytest services/plan-api/tests/services -q`  
Expected: all service tests PASS.

```powershell
git add services/plan-api/src/plan_api/contracts/schedule_rules.py services/plan-api/src/plan_api/services/rolling_generator.py services/plan-api/src/plan_api/services/rule_adjustment.py services/plan-api/tests/services/test_rolling_generator.py services/plan-api/tests/services/test_rule_adjustment.py
git commit -m "feat: generate seven day rolling task window"
```

---

### Task 7: Authorization And HTTP Routes

**Files:**
- Create: `services/plan-api/src/plan_api/api/auth.py`
- Create: `services/plan-api/src/plan_api/api/dependencies.py`
- Create: `services/plan-api/src/plan_api/api/routes_health.py`
- Create: `services/plan-api/src/plan_api/api/routes_tasks.py`
- Create: `services/plan-api/src/plan_api/api/routes_mutations.py`
- Modify: `services/plan-api/src/plan_api/app.py`
- Create: `services/plan-api/tests/api/test_auth.py`
- Create: `services/plan-api/tests/api/test_tasks_api.py`
- Create: `services/plan-api/tests/api/test_mutations_api.py`

**Interfaces:**
- Produces: `TokenRole.DESKTOP | TokenRole.HERMES`
- Produces: `/v1/snapshot`、`/v1/today`、`/v1/tasks`、`/v1/tasks/{id}`、`/v1/mutations`

- [ ] **Step 1: Write failing API tests**

Assert missing/invalid token is `401`; both tokens can read; Hermes receives `403` from mutations; Desktop can create then query a daily task; structured errors include `code/message/requestId`; health includes database state and revision.

Run: `python -m pytest services/plan-api/tests/api -q`  
Expected: FAIL because API routes are missing.

- [ ] **Step 2: Implement constant-time role resolution**

```python
def resolve_role(credentials, settings) -> TokenRole:
    if credentials is None:
        raise HTTPException(status_code=401, detail="missing_token")
    token = credentials.credentials
    if secrets.compare_digest(token, settings.desktop_token):
        return TokenRole.DESKTOP
    if secrets.compare_digest(token, settings.hermes_token):
        return TokenRole.HERMES
    raise HTTPException(status_code=401, detail="invalid_token")
```

`create_app` constructs Database、repositories and services once during lifespan. `/v1/today` calls `ensure_window()` before querying. Error mapping is:

```text
target_missing=404
version_conflict=409
validation_failed=422
permission_denied=403
persistence_failed=500
```

- [ ] **Step 3: Verify and commit**

Run: `python -m pytest services/plan-api/tests/api -q`  
Expected: all API tests PASS.

```powershell
git add services/plan-api/src/plan_api/api services/plan-api/src/plan_api/app.py services/plan-api/tests/api
git commit -m "feat: expose authenticated plan api"
```

---

### Task 8: CLI, Backup, Deployment And Verification

**Files:**
- Create: `services/plan-api/src/plan_api/backup.py`
- Create: `services/plan-api/src/plan_api/cli.py`
- Create: `services/plan-api/src/plan_api/__main__.py`
- Create: `services/plan-api/deploy/systemd/hermes-plan-api.service`
- Create: `services/plan-api/deploy/systemd/hermes-plan-maintenance.service`
- Create: `services/plan-api/deploy/systemd/hermes-plan-maintenance.timer`
- Create: `services/plan-api/tests/test_backup.py`
- Create: `services/plan-api/tests/test_cli.py`
- Create: `services/plan-api/openapi.v1.json`
- Create: `docs/cloud-plan-api-deployment.md`
- Modify: `README.md`
- Modify: `docs/file-structure.md`

**Interfaces:**
- Produces: CLI `serve | migrate | ensure-window | backup | export-openapi`
- Produces: `create_backup(database, backup_dir, keep=14) -> Path`
- Produces: stable OpenAPI contract for later Hermes and desktop plans

- [ ] **Step 1: Write failing backup and CLI tests**

Use `sqlite3.Connection.backup()` into a temporary path, verify restored `PRAGMA integrity_check = ok`, and assert only 14 newest backups remain. Invoke each CLI command against a temporary environment; exporting OpenAPI twice must produce identical bytes.

Run: `python -m pytest services/plan-api/tests/test_backup.py services/plan-api/tests/test_cli.py -q`  
Expected: FAIL because operations modules are missing.

- [ ] **Step 2: Implement atomic backup and commands**

```python
def create_backup(database: Database, backup_dir: Path, keep: int = 14) -> Path:
    backup_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    temporary = backup_dir / f".plan-{stamp}.db.tmp"
    destination = backup_dir / f"plan-{stamp}.db"
    with database.connect() as source, sqlite3.connect(temporary) as target:
        source.backup(target)
    temporary.replace(destination)
    for expired in sorted(backup_dir.glob("plan-*.db"), reverse=True)[keep:]:
        expired.unlink()
    return destination
```

Systemd must run API on `127.0.0.1:8743`. Maintenance runs rolling generation and backup daily. Deployment docs include venv installation、two 64-character tokens、`0600` environment file、user systemd、SSH port mapping、health check and restore.

- [ ] **Step 3: Run complete verification**

```powershell
python -m pytest services/plan-api/tests -q
npm test
npm run typecheck
npm run build
git diff --check
```

Expected: all Python and existing desktop checks PASS.

Scan `services/plan-api/src/**/*.py`; every source file must be at most 220 lines. Confirm test tokens appear only in test fixtures. Update README honestly: Plan API foundation exists, while Hermes and desktop migration remain separate phases.

- [ ] **Step 4: Export contract and commit**

```powershell
python -m plan_api export-openapi --output services/plan-api/openapi.v1.json
git add services/plan-api README.md docs/cloud-plan-api-deployment.md docs/file-structure.md
git commit -m "feat: complete plan api foundation"
```

## Foundation Acceptance

Phase 1 is complete only when:

- a blank SQLite file migrates successfully;
- fitness and learning JSON validate without domain tables;
- mutation batches are atomic、versioned and idempotent;
- rolling generation maintains exactly seven calendar dates without duplicates;
- rolling rule changes preserve history and manual overrides while replacing future generated entries;
- `/v1/today` returns daily、cycle、overdue and locally completed rows;
- Desktop and Hermes tokens have distinct permissions;
- backup restoration passes integrity check;
- OpenAPI output is deterministic;
- Python、npm、typecheck and build checks pass;
- Electron、Hermes Plugin、本地 JSON and portable packages remain unchanged.
