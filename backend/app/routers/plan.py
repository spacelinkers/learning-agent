import asyncio
from datetime import date

from fastapi import APIRouter, Depends, HTTPException

from app.db.supabase import get_supabase
from app.deps import get_user_id
from app.models.schemas import TodayPlanOut, PlanItemOut

router = APIRouter(prefix="/api/plan", tags=["plan"])


@router.get("/today", response_model=TodayPlanOut)
async def get_today(user_id: str = Depends(get_user_id)):
    today = date.today().isoformat()
    sb = get_supabase()

    plan_res = (
        sb.table("daily_plans")
        .select("*")
        .eq("user_id", user_id)
        .eq("date", today)
        .execute()
    )

    if not plan_res.data:
        # Auto-generate on first request of the day
        from app.agent.planner import run_planner
        await asyncio.to_thread(run_planner, user_id, today)
        plan_res = (
            sb.table("daily_plans")
            .select("*")
            .eq("user_id", user_id)
            .eq("date", today)
            .execute()
        )
        if not plan_res.data:
            raise HTTPException(status_code=500, detail="Plan generation failed")

    plan = plan_res.data[0]
    items = _fetch_plan_items(plan["id"])
    return TodayPlanOut(
        plan_id=plan["id"],
        date=plan["date"],
        hours_budget=plan["total_hours_budget"],
        status=plan["status"],
        items=items,
    )


@router.post("/generate")
async def force_generate(user_id: str = Depends(get_user_id)):
    from app.agent.planner import run_planner
    today = date.today().isoformat()
    await asyncio.to_thread(run_planner, user_id, today)
    return {"status": "regenerated", "date": today}


@router.post("/item/{item_id}/done")
async def mark_done(item_id: str, user_id: str = Depends(get_user_id)):
    sb = get_supabase()
    item = _assert_owns_item(item_id, user_id, sb)

    sb.table("daily_plan_items").update({"status": "done"}).eq("id", item_id).execute()
    sb.table("learning_tasks").update({
        "status": "completed",
        "completed_date": date.today().isoformat(),
    }).eq("id", item["task_id"]).execute()

    return {"item_id": item_id, "status": "done"}


@router.post("/item/{item_id}/skip")
async def skip_item(item_id: str, user_id: str = Depends(get_user_id)):
    """Mark item as missed without incrementing rollover_count (user chose to skip)."""
    sb = get_supabase()
    _assert_owns_item(item_id, user_id, sb)

    sb.table("daily_plan_items").update({"status": "missed"}).eq("id", item_id).execute()
    return {"item_id": item_id, "status": "missed"}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _fetch_plan_items(plan_id: str) -> list[PlanItemOut]:
    res = (
        get_supabase()
        .table("daily_plan_items")
        .select("*, learning_tasks(title, description, estimated_hours, rollover_count), learning_paths(title)")
        .eq("plan_id", plan_id)
        .order("suggested_order")
        .execute()
    )
    items = []
    for row in (res.data or []):
        task = row.get("learning_tasks") or {}
        rollover_count = task.get("rollover_count") or 0
        items.append(PlanItemOut(
            item_id=row["id"],
            task_id=row["task_id"],
            path_id=row["path_id"],
            title=task.get("title", ""),
            path_title=(row.get("learning_paths") or {}).get("title", ""),
            description=task.get("description"),
            estimated_hours=task.get("estimated_hours", 1.0),
            suggested_order=row.get("suggested_order", 0),
            is_rollover=row.get("is_rollover", False),
            status=row.get("status", "pending"),
            rollover_count=rollover_count,
            needs_review=rollover_count >= 3,
        ))
    return items


def _assert_owns_item(item_id: str, user_id: str, sb) -> dict:
    """Verify the plan item belongs to the user and return it."""
    res = (
        sb.table("daily_plan_items")
        .select("id, task_id, plan_id, daily_plans(user_id)")
        .eq("id", item_id)
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Plan item not found")
    plan_user = (res.data.get("daily_plans") or {}).get("user_id")
    if plan_user != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return res.data
