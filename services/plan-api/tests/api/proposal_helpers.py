from .api_helpers import content


def cycle_create_proposal(
    *,
    session_id: str = "hermes-session-1",
    key: str = "proposal-create-1",
    title: str = "Four week fitness plan",
) -> dict[str, object]:
    plan_content = content(title)
    entry_content = content("Day one workout")
    return {
        "externalSessionId": session_id,
        "idempotencyKey": key,
        "summary": "Create a four week fitness plan.",
        "operations": [
            {
                "type": "task.create",
                "draft": {
                    "kind": "cycle",
                    "generation_mode": "fixed",
                    "content": plan_content,
                    "entries": [
                        {
                            "scheduled_date": "2026-07-29",
                            "content": entry_content,
                            "source": "hermes",
                        }
                    ],
                },
            }
        ],
    }
