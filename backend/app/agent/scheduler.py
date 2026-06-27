"""
APScheduler jobs.
  6AM  — generate daily plan for every user with active paths
  10PM — mark missed tasks, send evening summary
"""

import asyncio
import json
import os
from datetime import date, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.agent import tools
from app.agent.planner import run_planner
from app.agent.prompts import EVENING_PROMPT
from app.agent.weekly_review import run_weekly_review

scheduler = AsyncIOScheduler()


@scheduler.scheduled_job("cron", hour=6, minute=0)
async def morning_plan_job() -> None:
    user_ids = await asyncio.to_thread(tools.get_all_active_users)
    for user_id in user_ids:
        try:
            await asyncio.to_thread(run_planner, user_id)
        except Exception as exc:
            print(f"[scheduler] morning_plan failed for {user_id}: {exc}")


@scheduler.scheduled_job("cron", hour=22, minute=0)
async def evening_check_job() -> None:
    today = date.today().isoformat()
    user_ids = await asyncio.to_thread(tools.get_all_active_users)

    for user_id in user_ids:
        try:
            # 1 — mark any still-pending items as missed
            await asyncio.to_thread(tools.mark_missed, user_id, today)

            # 2 — gather stats for evening summary
            stats = await asyncio.to_thread(tools.get_evening_stats, user_id, today)
            completed_tasks = await asyncio.to_thread(_get_completed_titles, user_id, today)
            missed_tasks = await asyncio.to_thread(_get_missed_titles, user_id, today)

            prompt = EVENING_PROMPT.format(
                completed=json.dumps(completed_tasks),
                missed=json.dumps(missed_tasks),
                total_minutes=stats["total_minutes"],
            )
            summary = await asyncio.to_thread(tools.call_groq, prompt)

            # 3 — send push notification
            body = summary.get("encouragement", "Great effort today! Keep going.")
            await asyncio.to_thread(tools.send_notification, user_id, "Evening Summary", body)

        except Exception as exc:
            print(f"[scheduler] evening_check failed for {user_id}: {exc}")


@scheduler.scheduled_job("cron", day_of_week="sun", hour=21, minute=0)
async def weekly_review_job() -> None:
    today      = date.today()
    week_end   = today.isoformat()
    week_start = (today - timedelta(days=6)).isoformat()

    user_ids = await asyncio.to_thread(tools.get_all_active_users)
    for user_id in user_ids:
        try:
            await asyncio.to_thread(run_weekly_review, user_id, week_start, week_end)
        except Exception as exc:
            print(f"[scheduler] weekly_review failed for {user_id}: {exc}")


# ── Helpers (sync) ────────────────────────────────────────────────────────────

def _get_completed_titles(user_id: str, today: str) -> list[str]:
    from app.db.supabase import get_supabase
    sb = get_supabase()
    plan = sb.table("daily_plans").select("id").eq("user_id", user_id).eq("date", today).execute()
    if not plan.data:
        return []
    plan_id = plan.data[0]["id"]
    items = (
        sb.table("daily_plan_items")
        .select("task_id")
        .eq("plan_id", plan_id)
        .eq("status", "done")
        .execute()
    )
    task_ids = [r["task_id"] for r in (items.data or [])]
    if not task_ids:
        return []
    tasks = sb.table("learning_tasks").select("title").in_("id", task_ids).execute()
    return [r["title"] for r in (tasks.data or [])]


def _get_missed_titles(user_id: str, today: str) -> list[str]:
    from app.db.supabase import get_supabase
    sb = get_supabase()
    plan = sb.table("daily_plans").select("id").eq("user_id", user_id).eq("date", today).execute()
    if not plan.data:
        return []
    plan_id = plan.data[0]["id"]
    items = (
        sb.table("daily_plan_items")
        .select("task_id")
        .eq("plan_id", plan_id)
        .eq("status", "missed")
        .execute()
    )
    task_ids = [r["task_id"] for r in (items.data or [])]
    if not task_ids:
        return []
    tasks = sb.table("learning_tasks").select("title").in_("id", task_ids).execute()
    return [r["title"] for r in (tasks.data or [])]
