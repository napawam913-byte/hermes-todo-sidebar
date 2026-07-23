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
