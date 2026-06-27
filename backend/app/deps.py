from fastapi import Header, HTTPException

from app.db.supabase import get_supabase


async def get_user_id(authorization: str = Header(...)) -> str:
    """Extract and verify user_id from a Supabase JWT Bearer token."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = authorization.removeprefix("Bearer ")
    try:
        user = get_supabase().auth.get_user(token)
        return user.user.id
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
