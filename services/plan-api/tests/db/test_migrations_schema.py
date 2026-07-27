# 用途：验证 Plan API 初始迁移的结构合同；边界：不覆盖升级、损坏迁移与校验和场景。
import pytest

from plan_api.db.database import Database
from plan_api.db.migrations import apply_migrations


EXPECTED_COLUMNS = {
    "tasks": (
        "id kind status generation_mode content_json schedule_rule_json "
        "generated_through_date rule_revision version created_at updated_at"
    ).split(),
    "task_entries": (
        "id task_id scheduled_date status content_json source slot_key "
        "is_overridden generation_revision version created_at updated_at "
        "completed_at"
    ).split(),
    "agent_sessions": "id external_session_id created_at updated_at".split(),
    "agent_proposals": (
        "id session_id proposal_json status expires_at target_task_id "
        "target_version idempotency_key created_at updated_at applied_at"
    ).split(),
    "audit_events": (
        "id actor action target_type target_id proposal_id result_json created_at"
    ).split(),
    "schema_migrations": "version checksum applied_at".split(),
    "app_meta": "id server_revision updated_at".split(),
    "idempotency_records": (
        "idempotency_key request_hash response_json created_at"
    ).split(),
}


def test_initial_migration_creates_all_tables_and_exact_columns(tmp_path) -> None:
    database = Database(tmp_path / "plan.db")
    apply_migrations(database)

    with database.connect() as connection:
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )
            if not row[0].startswith("sqlite_")
        }
        assert tables == set(EXPECTED_COLUMNS)
        for table, expected in EXPECTED_COLUMNS.items():
            columns = [
                row["name"]
                for row in connection.execute(f"PRAGMA table_info({table})")
            ]
            assert columns == expected
        assert connection.execute(
            "SELECT server_revision FROM app_meta WHERE id = 1"
        ).fetchone()[0] == 0


@pytest.mark.parametrize(
    ("table", "check"),
    [
        ("tasks", "kind IN ('daily', 'cycle')"),
        ("tasks", "status IN ('active', 'paused', 'archived')"),
        ("tasks", "generation_mode IN ('fixed', 'rolling')"),
        ("task_entries", "status IN ('pending', 'completed', 'skipped')"),
        (
            "task_entries",
            "source IN ('manual', 'rule_generated', 'hermes')",
        ),
        (
            "agent_proposals",
            "status IN ('pending', 'applied', 'cancelled', 'expired', 'failed')",
        ),
    ],
)
def test_schema_declares_exact_approved_enum_checks(
    tmp_path, table: str, check: str
) -> None:
    database = Database(tmp_path / "plan.db")
    apply_migrations(database)

    with database.connect() as connection:
        sql = connection.execute(
            "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
            (table,),
        ).fetchone()[0]
    assert f"CHECK ({check})" in sql
