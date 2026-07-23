from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from ..contracts.tasks import TodayView
from ..db.database import Database
from ..repositories.task_repository import TaskRepository


SHANGHAI = ZoneInfo("Asia/Shanghai")


class QueryService:
    def __init__(
        self,
        database: Database,
        repository: TaskRepository | None = None,
    ) -> None:
        self._database = database
        self._repository = repository or TaskRepository()

    def today(self, target_date: date) -> TodayView:
        local_start = datetime.combine(target_date, time.min, tzinfo=SHANGHAI)
        completed_start = local_start.astimezone(timezone.utc)
        completed_end = (local_start + timedelta(days=1)).astimezone(
            timezone.utc
        )
        with self._database.connect() as connection:
            items = self._repository.list_today(
                connection,
                target_date,
                completed_start,
                completed_end,
            )
        return TodayView(target_date=target_date, items=items)
