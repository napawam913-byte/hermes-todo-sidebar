def content(title: str) -> dict[str, object]:
    return {
        "schemaVersion": 1,
        "kind": "api.test.task",
        "title": title,
        "summary": "API test content.",
        "locale": "en-US",
        "sections": [],
    }


def daily_create(key: str = "create-daily") -> dict[str, object]:
    return {
        "idempotencyKey": key,
        "operations": [
            {
                "type": "task.create",
                "draft": {
                    "kind": "daily",
                    "generation_mode": "fixed",
                    "content": content("Daily task"),
                    "entries": [
                        {
                            "scheduled_date": "2026-07-24",
                            "content": content("Daily entry"),
                            "source": "manual",
                        }
                    ],
                },
            }
        ],
    }


def delete_batch(
    key: str, target_id: str, version: int = 1
) -> dict[str, object]:
    return {
        "idempotencyKey": key,
        "operations": [
            {
                "type": "task.delete",
                "targetId": target_id,
                "expectedVersion": version,
            }
        ],
    }
