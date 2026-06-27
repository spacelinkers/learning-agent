from datetime import date, timedelta

from fastapi import APIRouter, Depends

from app.db.supabase import get_supabase
from app.deps import get_user_id
from app.models.schemas import LogRequest

router = APIRouter(prefix="/api/log", tags=["log"])


@router.post("")
async def create_log(body: LogRequest, user_id: str = Depends(get_user_id)):
    log_date = body.date or date.today().isoformat()
    res = (
        get_supabase()
        .table("daily_logs")
        .insert({
            "user_id": user_id,
            "task_id": body.task_id,
            "path_id": body.path_id,
            "date": log_date,
            "time_spent_minutes": body.time_spent_minutes,
            "notes": body.notes,
            "mood": body.mood,
        })
        .execute()
    )
    return res.data[0]


@router.get("/weekly")
async def weekly_summary(user_id: str = Depends(get_user_id)):
    today = date.today()
    week_start = (today - timedelta(days=6)).isoformat()

    logs = (
        get_supabase()
        .table("daily_logs")
        .select("*, learning_tasks(title), learning_paths(title)")
        .eq("user_id", user_id)
        .gte("date", week_start)
        .order("date", desc=True)
        .execute()
    ).data or []

    # Group by date
    by_date: dict[str, dict] = {}
    for log in logs:
        d = log["date"]
        if d not in by_date:
            by_date[d] = {"date": d, "total_minutes": 0, "entries": []}
        by_date[d]["total_minutes"] += log.get("time_spent_minutes") or 0
        by_date[d]["entries"].append({
            "log_id": log["id"],
            "task_title": (log.get("learning_tasks") or {}).get("title"),
            "path_title": (log.get("learning_paths") or {}).get("title"),
            "time_spent_minutes": log.get("time_spent_minutes"),
            "mood": log.get("mood"),
            "notes": log.get("notes"),
        })

    days = sorted(by_date.values(), key=lambda d: d["date"], reverse=True)
    total_minutes = sum(d["total_minutes"] for d in days)
    total_entries = sum(len(d["entries"]) for d in days)

    return {
        "days": days,
        "total_minutes": total_minutes,
        "total_entries": total_entries,
        "week_start": week_start,
        "week_end": today.isoformat(),
    }
