from pydantic import BaseModel, Field


class ParseRequest(BaseModel):
    raw_text: str = Field(..., max_length=40000)


class TaskPreview(BaseModel):
    title: str
    description: str | None = None
    estimated_hours: float = 1.0
    sequence_order: int


class TrackPreview(BaseModel):
    title: str
    estimated_days: int
    subtopics: list[TaskPreview]


class SchedulePreview(BaseModel):
    title: str
    tracks: list[TrackPreview]


class SaveScheduleRequest(BaseModel):
    approved_schedule: SchedulePreview
    priority: int = Field(default=3, ge=1, le=5)
    hours_per_day: float = Field(default=3.0, gt=0)


# ── Paths ─────────────────────────────────────────────────────────────────────

class UpdatePriorityRequest(BaseModel):
    priority: int = Field(..., ge=1, le=5)


class UpdateStatusRequest(BaseModel):
    status: str = Field(..., pattern="^(active|paused|completed|archived)$")


# ── Plan ──────────────────────────────────────────────────────────────────────

class PlanItemOut(BaseModel):
    item_id: str
    task_id: str
    path_id: str
    title: str
    path_title: str
    description: str | None
    estimated_hours: float
    suggested_order: int
    is_rollover: bool
    status: str
    rollover_count: int
    needs_review: bool


class TodayPlanOut(BaseModel):
    plan_id: str
    date: str
    hours_budget: float
    status: str
    items: list[PlanItemOut]


# ── Log ───────────────────────────────────────────────────────────────────────

class LogRequest(BaseModel):
    task_id: str | None = None
    path_id: str | None = None
    date: str | None = None          # defaults to today server-side
    time_spent_minutes: int = Field(..., gt=0)
    notes: str | None = None
    mood: str | None = Field(default=None, pattern="^(good|okay|tired)$")
