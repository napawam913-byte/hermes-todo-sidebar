# Hermes Todo Plan API Deployment

The Plan API foundation is a single-user FastAPI service backed by SQLite.
It serves only on `127.0.0.1:8743`; expose it to another machine through SSH
port forwarding rather than binding it to a public interface.

## Install

Create the runtime directory on the Linux host:

```bash
mkdir -p ~/.local/share/hermes-plan-api ~/.config/hermes-plan-api
cd ~/.local/share/hermes-plan-api
python3.11 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install /path/to/hermes-todo/services/plan-api
```

Create `~/.config/hermes-plan-api/plan-api.env` with two distinct tokens.
Each token must be exactly 64 characters:

```bash
PLAN_DATABASE_PATH=/home/USER/.local/share/hermes-plan-api/plan.db
PLAN_DESKTOP_TOKEN=<replace-with-64-character-desktop-token>
PLAN_HERMES_TOKEN=<replace-with-64-character-hermes-token>
```

Protect the environment file:

```bash
chmod 0600 ~/.config/hermes-plan-api/plan-api.env
```

Run the initial migration:

```bash
set -a
. ~/.config/hermes-plan-api/plan-api.env
set +a
~/.local/share/hermes-plan-api/.venv/bin/python -m plan_api migrate
```

## User Systemd

Copy the units from `services/plan-api/deploy/systemd/`:

```bash
mkdir -p ~/.config/systemd/user
cp hermes-plan-api.service hermes-plan-maintenance.service hermes-plan-maintenance.timer ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now hermes-plan-api.service
systemctl --user enable --now hermes-plan-maintenance.timer
```

The API unit runs FastAPI on `127.0.0.1:8743`. The maintenance timer runs
daily rolling generation and creates SQLite backups in
`~/.local/share/hermes-plan-api/backups`, retaining the newest 14 files.

To keep the user service alive after logout:

```bash
loginctl enable-linger "$USER"
```

## SSH Port Mapping

From the Windows desktop, forward the local API port to the remote host:

```powershell
ssh -N -L 8743:127.0.0.1:8743 user@example.com
```

Clients should call `http://127.0.0.1:8743` through that tunnel and send one
of the configured bearer tokens.

## Health Check

```bash
curl -H "Authorization: Bearer $PLAN_DESKTOP_TOKEN" http://127.0.0.1:8743/v1/health
```

Expected result includes `"status":"ok"`, `"service":"plan-api"`, and
`"apiVersion":1`.

## Backup And Restore

Create an on-demand backup:

```bash
~/.local/share/hermes-plan-api/.venv/bin/python -m plan_api backup --backup-dir ~/.local/share/hermes-plan-api/backups
```

Restore from a backup while the API is stopped:

```bash
systemctl --user stop hermes-plan-api.service
rm -f ~/.local/share/hermes-plan-api/plan.db-wal ~/.local/share/hermes-plan-api/plan.db-shm
cp ~/.local/share/hermes-plan-api/backups/plan-YYYYMMDDTHHMMSSffffffZ.db ~/.local/share/hermes-plan-api/plan.db
sqlite3 ~/.local/share/hermes-plan-api/plan.db 'PRAGMA integrity_check;'
systemctl --user start hermes-plan-api.service
```

Only restore a backup that returns `ok` from `PRAGMA integrity_check`.

## Contract Export

The committed contract lives at `services/plan-api/openapi.v1.json`.
Regenerate it with:

```bash
set -a
. ~/.config/hermes-plan-api/plan-api.env
set +a
~/.local/share/hermes-plan-api/.venv/bin/python -m plan_api export-openapi --output services/plan-api/openapi.v1.json
```
