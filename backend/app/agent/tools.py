"""
Agent tools — all Supabase interactions for the planner graph.
Sync functions; called via asyncio.to_thread from the scheduler.
"""

import json
import os
from datetime import date, timedelta

import httpx
from groq import Groq

from app.db.supabase import get_supabase


# ── Supabase helpers ──────────────────────────────────────────────────────────

def get_active_paths(user_id: str) -> list[dict]:
    res = (
        get_supabase()
        .table("learning_paths")
        .select("*")
        .eq("user_id", user_id)
        .eq("status", "active")
        .order("priority")
        .execute()
    )
    return res.data or []


def get_all_active_users() -> list[str]:
    """Return distinct user_ids that have at least one active path."""
    res = (
        get_supabase()
        .table("learning_paths")
        .select("user_id")
        .eq("status", "active")
        .execute()
    )
    seen: set[str] = set()
    users = []
    for row in (res.data or []):
        uid = row["user_id"]
        if uid not in seen:
            seen.add(uid)
            users.append(uid)
    return users


def get_next_tasks(path_id: str, limit: int = 3) -> list[dict]:
    res = (
        get_supabase()
        .table("learning_tasks")
        .select("*")
        .eq("path_id", path_id)
        .in_("status", ["pending", "suggested"])
        .order("sequence_order")
        .limit(limit)
        .execute()
    )
    return res.data or []


def get_path_task_counts(path_id: str) -> tuple[int, int]:
    """Return (total_tasks, completed_tasks)."""
    sb = get_supabase()
    total = sb.table("learning_tasks").select("id", count="exact").eq("path_id", path_id).execute()
    done = (
        sb.table("learning_tasks")
        .select("id", count="exact")
        .eq("path_id", path_id)
        .eq("status", "completed")
        .execute()
    )
    return (total.count or 0), (done.count or 0)


def calculate_pace(path: dict, completed: int, total: int) -> dict:
    if total == 0:
        return {"status": "on_track", "days_behind": 0, "completion_pct": 0.0}

    start_str = path.get("start_date")
    estimated_days = path.get("estimated_days") or 1
    today = date.today()
    start = date.fromisoformat(start_str) if start_str else today
    days_elapsed = max((today - start).days, 0)

    expected_pct = min(days_elapsed / estimated_days, 1.0)
    actual_pct = completed / total
    days_behind = max(int((expected_pct - actual_pct) * estimated_days), 0)

    if actual_pct >= expected_pct - 0.1:
        status = "on_track"
    elif actual_pct >= expected_pct - 0.25:
        status = "slight_delay"
    else:
        status = "behind"

    return {
        "status": status,
        "days_behind": days_behind,
        "completion_pct": round(actual_pct * 100, 1),
    }


def score_task(task: dict, path: dict, days_behind: int) -> int:
    score = (6 - path.get("priority", 3)) * 10      # P1=50, P5=10
    score += (task.get("rollover_count") or 0) * 15  # each miss +15
    score += days_behind * 5                          # pace penalty
    if path.get("_pace_status") == "behind":
        score += 20
    return score


def mark_missed(user_id: str, yesterday: str) -> int:
    """
    Marks all pending items in yesterday's plan as 'missed' and
    increments rollover_count on the underlying tasks.
    Returns the number of items marked.
    """
    sb = get_supabase()

    plan_res = (
        sb.table("daily_plans")
        .select("id")
        .eq("user_id", user_id)
        .eq("date", yesterday)
        .execute()
    )
    if not plan_res.data:
        return 0
    plan_id = plan_res.data[0]["id"]

    items_res = (
        sb.table("daily_plan_items")
        .select("id, task_id")
        .eq("plan_id", plan_id)
        .eq("status", "pending")
        .execute()
    )
    if not items_res.data:
        return 0

    item_ids = [r["id"] for r in items_res.data]
    task_ids = [r["task_id"] for r in items_res.data]

    sb.table("daily_plan_items").update({"status": "missed"}).in_("id", item_ids).execute()

    for task_id in task_ids:
        task_res = sb.table("learning_tasks").select("rollover_count").eq("id", task_id).execute()
        if task_res.data:
            current = task_res.data[0]["rollover_count"] or 0
            sb.table("learning_tasks").update({"rollover_count": current + 1}).eq("id", task_id).execute()

    return len(item_ids)


def save_plan(
    user_id: str,
    plan_date: str,
    items: list[dict],
    hours_budget: float = 3.0,
) -> str:
    """Upsert daily_plan and insert plan items. Returns plan_id."""
    sb = get_supabase()

    plan_res = (
        sb.table("daily_plans")
        .upsert(
            {"user_id": user_id, "date": plan_date, "total_hours_budget": hours_budget, "status": "active"},
            on_conflict="user_id,date",
        )
        .execute()
    )
    plan_id = plan_res.data[0]["id"]

    # Clear stale items when regenerating
    sb.table("daily_plan_items").delete().eq("plan_id", plan_id).execute()

    if items:
        sb.table("daily_plan_items").insert(
            [
                {
                    "plan_id": plan_id,
                    "task_id": item["task_id"],
                    "path_id": item["path_id"],
                    "suggested_order": idx + 1,
                    "is_rollover": item.get("is_rollover", False),
                    "status": "pending",
                }
                for idx, item in enumerate(items)
            ]
        ).execute()

    return plan_id


def get_evening_stats(user_id: str, today: str) -> dict:
    """Return completed/missed counts and total minutes logged today."""
    sb = get_supabase()

    plan_res = sb.table("daily_plans").select("id").eq("user_id", user_id).eq("date", today).execute()
    if not plan_res.data:
        return {"completed": 0, "missed": 0, "total_minutes": 0}
    plan_id = plan_res.data[0]["id"]

    items = sb.table("daily_plan_items").select("status").eq("plan_id", plan_id).execute().data or []
    completed = sum(1 for i in items if i["status"] == "done")
    missed = sum(1 for i in items if i["status"] in ("pending", "missed"))

    logs = sb.table("daily_logs").select("time_spent_minutes").eq("user_id", user_id).eq("date", today).execute().data or []
    total_minutes = sum(r["time_spent_minutes"] or 0 for r in logs)

    return {"completed": completed, "missed": missed, "total_minutes": total_minutes}


# ── Weekly review helpers ─────────────────────────────────────────────────────

def get_week_stats(user_id: str, week_start: str, week_end: str) -> dict:
    """Return per-path task counts and overall time for a 7-day window."""
    sb = get_supabase()

    plans = (
        sb.table("daily_plans")
        .select("id")
        .eq("user_id", user_id)
        .gte("date", week_start)
        .lte("date", week_end)
        .execute()
    ).data or []

    plan_ids = [p["id"] for p in plans]
    path_stats: dict[str, dict] = {}

    if plan_ids:
        items = (
            sb.table("daily_plan_items")
            .select("status, path_id")
            .in_("plan_id", plan_ids)
            .execute()
        ).data or []

        for item in items:
            pid = item["path_id"]
            if pid not in path_stats:
                path_stats[pid] = {"completed": 0, "missed": 0, "minutes": 0}
            if item["status"] == "done":
                path_stats[pid]["completed"] += 1
            elif item["status"] == "missed":
                path_stats[pid]["missed"] += 1

    logs = (
        sb.table("daily_logs")
        .select("path_id, time_spent_minutes")
        .eq("user_id", user_id)
        .gte("date", week_start)
        .lte("date", week_end)
        .execute()
    ).data or []

    total_minutes = 0
    for log in logs:
        mins = log.get("time_spent_minutes") or 0
        total_minutes += mins
        pid = log.get("path_id")
        if pid and pid in path_stats:
            path_stats[pid]["minutes"] += mins

    return {
        "paths": path_stats,
        "overall": {"total_minutes": total_minutes, "days_active": len(plans)},
    }


def save_weekly_review(
    user_id: str,
    week_start: str,
    week_end: str,
    llm_review: dict,
) -> str:
    """Upsert weekly review. Returns review_id."""
    res = (
        get_supabase()
        .table("weekly_reviews")
        .upsert(
            {
                "user_id":         user_id,
                "week_start":      week_start,
                "week_end":        week_end,
                "summary":         llm_review.get("summary"),
                "highlights":      llm_review.get("highlights", []),
                "concerns":        llm_review.get("concerns", []),
                "recommendations": llm_review.get("recommendations", []),
                "next_week_focus": llm_review.get("next_week_focus"),
                "encouragement":   llm_review.get("encouragement"),
                "raw_llm":         llm_review,
            },
            on_conflict="user_id,week_start",
        )
        .execute()
    )
    return res.data[0]["id"]


# ── Groq helper ───────────────────────────────────────────────────────────────

def call_groq(prompt: str) -> dict:
    client = Groq(api_key=os.environ["GROQ_API_KEY"])
    resp = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
    )
    return json.loads(resp.choices[0].message.content)


# ── Push notification ─────────────────────────────────────────────────────────

def send_notification(user_id: str, title: str, body: str) -> bool:
    """Send Expo push notification. Gracefully skips if push_tokens table not yet present."""
    sb = get_supabase()
    try:
        token_res = sb.table("push_tokens").select("token").eq("user_id", user_id).execute()
        if not token_res.data:
            return False
        token = token_res.data[0]["token"]
    except Exception:
        return False  # table added in Phase 5

    try:
        resp = httpx.post(
            "https://exp.host/--/api/v2/push/send",
            json={"to": token, "title": title, "body": body},
            headers={"Accept": "application/json", "Content-Type": "application/json"},
            timeout=10,
        )
        return resp.status_code == 200
    except Exception:
        return False
