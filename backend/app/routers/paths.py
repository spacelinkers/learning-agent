from fastapi import APIRouter, Depends, HTTPException

from app.db.supabase import get_supabase
from app.deps import get_user_id
from app.models.schemas import UpdatePriorityRequest, UpdateStatusRequest

router = APIRouter(prefix="/api/paths", tags=["paths"])


@router.get("")
async def list_paths(user_id: str = Depends(get_user_id)):
    res = (
        get_supabase()
        .table("learning_paths")
        .select("*")
        .eq("user_id", user_id)
        .neq("status", "archived")
        .order("priority")
        .execute()
    )
    return res.data or []


@router.get("/{path_id}")
async def get_path(path_id: str, user_id: str = Depends(get_user_id)):
    res = (
        get_supabase()
        .table("learning_paths")
        .select("*, learning_tracks(*, learning_tasks(*))")
        .eq("id", path_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Path not found")

    path = res.data
    # Sort tracks and tasks by sequence_order
    path["learning_tracks"] = sorted(
        path.get("learning_tracks") or [], key=lambda t: t.get("sequence_order", 0)
    )
    for track in path["learning_tracks"]:
        track["learning_tasks"] = sorted(
            track.get("learning_tasks") or [], key=lambda t: t.get("sequence_order", 0)
        )
    return path


@router.put("/{path_id}/priority")
async def update_priority(
    path_id: str,
    body: UpdatePriorityRequest,
    user_id: str = Depends(get_user_id),
):
    _assert_owns_path(path_id, user_id)
    get_supabase().table("learning_paths").update({"priority": body.priority}).eq("id", path_id).execute()
    return {"path_id": path_id, "priority": body.priority}


@router.put("/{path_id}/status")
async def update_status(
    path_id: str,
    body: UpdateStatusRequest,
    user_id: str = Depends(get_user_id),
):
    _assert_owns_path(path_id, user_id)
    get_supabase().table("learning_paths").update({"status": body.status}).eq("id", path_id).execute()
    return {"path_id": path_id, "status": body.status}


@router.delete("/{path_id}")
async def delete_path(path_id: str, user_id: str = Depends(get_user_id)):
    _assert_owns_path(path_id, user_id)
    sb = get_supabase()
    # Remove referencing rows first to avoid FK constraint violations
    sb.table("daily_plan_items").delete().eq("path_id", path_id).execute()
    sb.table("daily_logs").delete().eq("path_id", path_id).execute()
    # Delete path — cascades to learning_tracks → learning_tasks
    sb.table("learning_paths").delete().eq("id", path_id).execute()
    return {"path_id": path_id, "deleted": True}


def _assert_owns_path(path_id: str, user_id: str) -> None:
    res = (
        get_supabase()
        .table("learning_paths")
        .select("id")
        .eq("id", path_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Path not found")
