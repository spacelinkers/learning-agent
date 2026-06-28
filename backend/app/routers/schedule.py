import json
import os
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from groq import Groq

from app.db.supabase import get_supabase
from app.deps import get_user_id
from app.models.schemas import ParseRequest, SaveScheduleRequest, SchedulePreview

router = APIRouter(prefix="/api/schedule", tags=["schedule"])

PARSE_PROMPT = """
Extract a structured learning schedule from this conversation.
Return ONLY valid JSON. No markdown. No explanation.

Schema:
{{
  "title": "short descriptive title",
  "tracks": [
    {{
      "title": "track name",
      "estimated_days": <int>,
      "subtopics": [
        {{"title": "task name", "estimated_hours": <float>, "sequence_order": <int>}}
      ]
    }}
  ]
}}

Conversation:
{raw_text}
"""


def _groq_client() -> Groq:
    return Groq(api_key=os.environ["GROQ_API_KEY"])


def _extract_json(text: str) -> str:
    """Strip markdown code fences and extract the first JSON object/array."""
    import re
    # Remove ```json ... ``` or ``` ... ``` wrappers
    text = re.sub(r"^```(?:json)?\s*", "", text.strip())
    text = re.sub(r"\s*```$", "", text.strip())
    # If LLM still added preamble text, find the first { or [
    match = re.search(r"[{\[]", text)
    if match:
        text = text[match.start():]
    return text.strip()


@router.post("/parse")
async def parse_schedule(
    body: ParseRequest,
    user_id: str = Depends(get_user_id),
):
    """Call Groq to extract a structured schedule from pasted chat text."""
    prompt = PARSE_PROMPT.format(raw_text=body.raw_text)
    try:
        client = _groq_client()
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
        )
        raw_json = _extract_json(response.choices[0].message.content)
        parsed = SchedulePreview.model_validate_json(raw_json)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Parse failed: {exc}")

    return parsed


@router.post("/save")
async def save_schedule(
    body: SaveScheduleRequest,
    user_id: str = Depends(get_user_id),
):
    """Persist an approved schedule preview as a full path/tracks/tasks hierarchy."""
    supabase = get_supabase()
    schedule = body.approved_schedule

    total_days = sum(t.estimated_days for t in schedule.tracks)
    start = date.today()
    target = start + timedelta(days=total_days)

    # 1 — insert learning_path
    path_res = (
        supabase.table("learning_paths")
        .insert({
            "user_id": user_id,
            "title": schedule.title,
            "priority": body.priority,
            "status": "active",
            "estimated_days": total_days,
            "start_date": start.isoformat(),
            "target_date": target.isoformat(),
            "source": "chat_import",
        })
        .execute()
    )
    if not path_res.data:
        raise HTTPException(status_code=500, detail="Failed to create learning path")
    path_id = path_res.data[0]["id"]

    # 2 — insert tracks + tasks
    for seq_track, track in enumerate(schedule.tracks, start=1):
        track_res = (
            supabase.table("learning_tracks")
            .insert({
                "path_id": path_id,
                "title": track.title,
                "estimated_days": track.estimated_days,
                "sequence_order": seq_track,
                "status": "pending" if seq_track > 1 else "active",
            })
            .execute()
        )
        if not track_res.data:
            raise HTTPException(status_code=500, detail="Failed to create track")
        track_id = track_res.data[0]["id"]

        tasks_payload = [
            {
                "track_id": track_id,
                "path_id": path_id,
                "title": task.title,
                "description": task.description,
                "estimated_hours": task.estimated_hours,
                "sequence_order": task.sequence_order,
                "status": "pending",
                "rollover_count": 0,
            }
            for task in track.subtopics
        ]
        if tasks_payload:
            supabase.table("learning_tasks").insert(tasks_payload).execute()

    return {"path_id": path_id, "title": schedule.title, "estimated_days": total_days}
