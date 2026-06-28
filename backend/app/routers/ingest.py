"""
Content ingestion router — free-tier safe (5 analyses/user/day).

POST   /api/ingest/url
POST   /api/ingest/pdf
GET    /api/ingest/sources
GET    /api/ingest/source/{source_id}
PATCH  /api/ingest/source/{source_id}/progress
DELETE /api/ingest/source/{source_id}
"""

import asyncio
import math
import time
from collections import defaultdict

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.agent.content_analyzer import run_content_analyzer
from app.agent.tools import (
    create_content_source,
    delete_content_source,
    get_content_source_with_analysis,
    get_content_sources,
    update_completed_topics,
)
from app.deps import get_user_id

router = APIRouter(prefix="/api/ingest", tags=["ingest"])

# 5 analyses per user per day (Groq free-tier guard)
_INGEST_LIMIT  = 5
_INGEST_WINDOW = 86_400  # 24 h in seconds
_ingest_log: dict[str, list[float]] = defaultdict(list)


def _check_rate_limit(user_id: str) -> None:
    now = time.monotonic()
    _ingest_log[user_id] = [t for t in _ingest_log[user_id] if now - t < _INGEST_WINDOW]
    if len(_ingest_log[user_id]) >= _INGEST_LIMIT:
        oldest    = _ingest_log[user_id][0]
        retry_sec = int(_INGEST_WINDOW - (now - oldest)) + 1
        retry_hr  = math.ceil(retry_sec / 3600)
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit: max {_INGEST_LIMIT} analyses per day. "
                   f"Try again in {retry_hr} hour{'s' if retry_hr != 1 else ''}.",
        )
    _ingest_log[user_id].append(now)


async def _run_background(source_id: str, user_id: str, **kwargs) -> None:
    await asyncio.to_thread(run_content_analyzer, source_id=source_id, user_id=user_id, **kwargs)


# ── Request / response models ─────────────────────────────────────────────────

class IngestUrlRequest(BaseModel):
    url: str

class UpdateProgressRequest(BaseModel):
    completed_topics: list[str]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/url")
async def ingest_url(
    body: IngestUrlRequest,
    user_id: str = Depends(get_user_id),
):
    _check_rate_limit(user_id)
    source_id = await asyncio.to_thread(
        create_content_source, user_id, "url", url=body.url
    )
    asyncio.create_task(
        _run_background(source_id=source_id, user_id=user_id, content_type="url", raw_url=body.url)
    )
    return {"source_id": source_id, "status": "analyzing"}


@router.post("/pdf")
async def ingest_pdf(
    file: UploadFile = File(...),
    user_id: str = Depends(get_user_id),
):
    _check_rate_limit(user_id)

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    contents = await file.read()
    if len(contents) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="PDF must be under 20 MB.")

    def extract_text() -> str:
        import io
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(contents))
        return "\n".join(page.extract_text() or "" for page in reader.pages)

    raw_text = await asyncio.to_thread(extract_text)
    title = (file.filename or "document").removesuffix(".pdf").replace("_", " ").replace("-", " ")

    source_id = await asyncio.to_thread(
        create_content_source, user_id, "pdf", filename=file.filename
    )
    asyncio.create_task(
        _run_background(
            source_id=source_id,
            user_id=user_id,
            content_type="pdf",
            raw_text=raw_text,
            title=title,
        )
    )
    return {"source_id": source_id, "status": "analyzing"}


@router.get("/sources")
async def list_sources(user_id: str = Depends(get_user_id)):
    return await asyncio.to_thread(get_content_sources, user_id)


@router.get("/source/{source_id}")
async def get_source(source_id: str, user_id: str = Depends(get_user_id)):
    result = await asyncio.to_thread(get_content_source_with_analysis, source_id, user_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Source not found.")
    return result


@router.patch("/source/{source_id}/progress")
async def update_progress(
    source_id: str,
    body: UpdateProgressRequest,
    user_id: str = Depends(get_user_id),
):
    ok = await asyncio.to_thread(update_completed_topics, source_id, user_id, body.completed_topics)
    if not ok:
        raise HTTPException(status_code=404, detail="Source not found.")
    return {"ok": True}


@router.delete("/source/{source_id}")
async def delete_source(source_id: str, user_id: str = Depends(get_user_id)):
    ok = await asyncio.to_thread(delete_content_source, source_id, user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Source not found.")
    return {"ok": True}
