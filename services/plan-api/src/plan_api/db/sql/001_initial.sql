CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('daily', 'cycle')),
    status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'archived')),
    generation_mode TEXT NOT NULL
        CHECK (generation_mode IN ('fixed', 'rolling')),
    content_json TEXT NOT NULL,
    schedule_rule_json TEXT,
    generated_through_date TEXT,
    rule_revision INTEGER NOT NULL CHECK (rule_revision >= 1),
    version INTEGER NOT NULL CHECK (version >= 1),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE task_entries (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    scheduled_date TEXT NOT NULL,
    status TEXT NOT NULL
        CHECK (status IN ('pending', 'completed', 'skipped')),
    content_json TEXT NOT NULL,
    source TEXT NOT NULL
        CHECK (source IN ('manual', 'rule_generated', 'hermes')),
    slot_key TEXT,
    is_overridden INTEGER NOT NULL
        CHECK (is_overridden IN (0, 1)),
    generation_revision INTEGER,
    version INTEGER NOT NULL CHECK (version >= 1),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT
);

CREATE TABLE agent_sessions (
    id TEXT PRIMARY KEY,
    external_session_id TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE agent_proposals (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL
        REFERENCES agent_sessions(id) ON DELETE CASCADE,
    proposal_json TEXT NOT NULL,
    status TEXT NOT NULL
        CHECK (status IN ('pending', 'applied', 'cancelled', 'expired', 'failed')),
    expires_at TEXT NOT NULL,
    target_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    target_version INTEGER,
    idempotency_key TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    applied_at TEXT
);

CREATE TABLE audit_events (
    id TEXT PRIMARY KEY,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    proposal_id TEXT
        REFERENCES agent_proposals(id) ON DELETE SET NULL,
    result_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE schema_migrations (
    version TEXT PRIMARY KEY,
    checksum TEXT NOT NULL,
    applied_at TEXT NOT NULL
);

CREATE TABLE app_meta (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    server_revision INTEGER NOT NULL
        CHECK (server_revision >= 0),
    updated_at TEXT NOT NULL
);

INSERT INTO app_meta (id, server_revision, updated_at)
VALUES (1, 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

CREATE TABLE idempotency_records (
    idempotency_key TEXT PRIMARY KEY,
    request_hash TEXT NOT NULL,
    response_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX uq_generated_entry
ON task_entries(task_id, scheduled_date, slot_key)
WHERE slot_key IS NOT NULL;

CREATE INDEX ix_entries_today
ON task_entries(scheduled_date, status);

CREATE INDEX ix_tasks_status
ON tasks(status, kind);
