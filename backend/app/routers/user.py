from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.db.supabase import get_supabase
from app.deps import get_user_id

router = APIRouter(prefix="/api/user", tags=["user"])


class PushTokenRequest(BaseModel):
    token: str


@router.post("/push-token")
async def save_push_token(body: PushTokenRequest, user_id: str = Depends(get_user_id)):
    """Upsert the user's Expo push token. Called each time the app launches."""
    get_supabase().table("push_tokens").upsert(
        {
            "user_id": user_id,
            "token": body.token,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        on_conflict="user_id",
    ).execute()
    return {"status": "ok"}
