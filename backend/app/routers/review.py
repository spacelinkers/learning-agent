import asyncio
from datetime import date, timedelta

from fastapi import APIRouter, Depends

from app.db.supabase import get_supabase
from app.deps import get_user_id

router = APIRouter(prefix="/api/review", tags=["review"])


@router.get("/weekly")
async def get_latest_review(user_id: str = Depends(get_user_id)):
    """Return the most recent weekly review, or null if none exists yet."""
    res = (
        get_supabase()
        .table("weekly_reviews")
        .select("*")
        .eq("user_id", user_id)
        .order("week_start", desc=True)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


@router.post("/generate")
async def trigger_review(user_id: str = Depends(get_user_id)):
    """Manually trigger a weekly review (useful for testing outside Sunday)."""
    from app.agent.weekly_review import run_weekly_review
    today      = date.today()
    week_end   = today.isoformat()
    week_start = (today - timedelta(days=6)).isoformat()
    await asyncio.to_thread(run_weekly_review, user_id, week_start, week_end)
    return {"status": "generated", "week_start": week_start, "week_end": week_end}
