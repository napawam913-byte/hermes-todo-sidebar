"""模块用途：为 Plan API SQLite 数据库创建原子备份并清理过期备份。"""

from datetime import datetime, timezone
import os
from pathlib import Path
import sqlite3
from tempfile import mkstemp

from .db.database import Database


def create_backup(
    database: Database, backup_dir: Path, keep: int = 14
) -> Path:
    backup_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    descriptor, temporary_name = mkstemp(
        dir=backup_dir, prefix=f".plan-{stamp}-", suffix=".db.tmp"
    )
    os.close(descriptor)
    temporary = Path(temporary_name)
    try:
        with database.connect() as source:
            target = sqlite3.connect(temporary)
            try:
                source.backup(target)
            finally:
                target.close()
        destination = _publish_without_overwrite(
            temporary, backup_dir, stamp
        )
    finally:
        temporary.unlink(missing_ok=True)
    backups = sorted(
        backup_dir.glob("plan-*.db"), key=_backup_sort_key, reverse=True
    )
    for expired in backups[keep:]:
        expired.unlink()
    return destination


def _publish_without_overwrite(
    temporary: Path, backup_dir: Path, stamp: str
) -> Path:
    sequence = max(
        (_collision_sequence(path, stamp) for path in backup_dir.glob(
            f"plan-{stamp}*.db"
        )),
        default=-1,
    ) + 1
    while True:
        suffix = "" if sequence == 0 else f"_{sequence:06d}"
        destination = backup_dir / f"plan-{stamp}{suffix}.db"
        try:
            os.link(temporary, destination)
            return destination
        except FileExistsError:
            sequence += 1


def _collision_sequence(path: Path, stamp: str) -> int:
    if path.name == f"plan-{stamp}.db":
        return 0
    prefix = f"plan-{stamp}_"
    suffix = path.stem.removeprefix(prefix)
    return int(suffix) if path.name.startswith(prefix) and suffix.isdigit() else -1


def _backup_sort_key(path: Path) -> tuple[str, str, int, str]:
    identity = path.stem.removeprefix("plan-")
    stamp, separator, suffix = identity.partition("_")
    if not stamp.endswith("Z"):
        return "", "", -1, path.name
    timestamp = stamp[:-1]
    seconds = timestamp[:15]
    fraction = timestamp[15:].ljust(6, "0")
    sequence = int(suffix) if separator and suffix.isdigit() else 0
    return seconds, fraction, sequence, path.name
