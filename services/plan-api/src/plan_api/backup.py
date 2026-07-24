"""模块用途：为 Plan API SQLite 数据库创建原子备份并清理过期备份。"""

from datetime import datetime, timezone
from pathlib import Path
import sqlite3

from .db.database import Database


def create_backup(
    database: Database, backup_dir: Path, keep: int = 14
) -> Path:
    backup_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    temporary = backup_dir / f".plan-{stamp}.db.tmp"
    destination = backup_dir / f"plan-{stamp}.db"
    with database.connect() as source:
        target = sqlite3.connect(temporary)
        try:
            source.backup(target)
        finally:
            target.close()
    temporary.replace(destination)
    for expired in sorted(backup_dir.glob("plan-*.db"), reverse=True)[keep:]:
        expired.unlink()
    return destination
