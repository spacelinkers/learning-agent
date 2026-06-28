# Backend — FastAPI + Supabase + Groq

## Structure
```
backend/
├── main.py              ← FastAPI app, routers, CORS, lifespan
├── requirements.txt     ← pinned versions
├── render.yaml          ← Render Blueprint (at repo root, not here)
├── README.md
└── app/
    ├── deps.py          ← get_user_id: JWT → user UUID
    ├── routers/
    │   ├── schedule.py  ← /api/schedule/parse + /save (rate limited)
    │   ├── paths.py     ← /api/paths CRUD + DELETE
    │   ├── plan.py      ← /api/plan daily plan endpoints
    │   ├── log.py       ← /api/log task logging
    │   ├── user.py      ← /api/user/push-token
    │   └── review.py    ← /api/review weekly review
    ├── agent/
    │   ├── planner.py       ← LangGraph daily planner
    │   ├── weekly_review.py ← LangGraph weekly review
    │   ├── tools.py         ← Supabase queries + Groq calls
    │   ├── prompts.py       ← LLM prompts
    │   └── scheduler.py     ← APScheduler cron jobs
    ├── models/
    │   └── schemas.py   ← Pydantic request/response models
    └── db/
        └── supabase.py  ← Supabase client singleton (service key)
```

## Dependencies (requirements.txt — pinned)
```
fastapi==0.138.1
uvicorn[standard]==0.49.0
supabase==2.31.0
groq==0.37.1
langgraph==1.2.6
langchain-groq==1.1.3
pydantic==2.13.4
python-dotenv==1.2.2
httpx==0.28.1
APScheduler==3.11.2
```

## Supabase Schema
Run these in the Supabase SQL editor. All tables have RLS enabled.

```sql
-- Core tables
create table learning_paths (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  title text not null,
  priority int default 3,          -- 1=highest, 5=lowest
  status text default 'active',    -- active/paused/completed/archived
  estimated_days int,
  start_date date,
  target_date date,
  source text default 'chat_import',
  created_at timestamptz default now()
);

create table learning_tracks (
  id uuid primary key default gen_random_uuid(),
  path_id uuid references learning_paths on delete cascade,
  title text not null,
  estimated_days int,
  sequence_order int,
  status text default 'pending'    -- pending/active/completed
);

create table learning_tasks (
  id uuid primary key default gen_random_uuid(),
  track_id uuid references learning_tracks on delete cascade,
  path_id uuid references learning_paths,   -- ← direct FK, no CASCADE
  title text not null,
  description text,
  estimated_hours float default 1.0,
  sequence_order int,
  status text default 'pending',   -- pending/suggested/completed/skipped
  suggested_date date,
  completed_date date,
  rollover_count int default 0
);

create table daily_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  date date not null,
  total_hours_budget float default 3.0,
  status text default 'active',
  generated_at timestamptz default now(),
  unique(user_id, date)
);

create table daily_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references daily_plans on delete cascade,
  task_id uuid references learning_tasks,
  path_id uuid references learning_paths,   -- ← direct FK, no CASCADE
  suggested_order int,
  is_rollover boolean default false,
  status text default 'pending'    -- pending/done/missed
);

create table daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  task_id uuid references learning_tasks,
  path_id uuid references learning_paths,   -- ← direct FK, no CASCADE
  date date,
  time_spent_minutes int,
  notes text,
  mood text,                       -- 'good'/'okay'/'tired'
  logged_at timestamptz default now()
);

-- Migration 001
create table push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users unique,
  token text not null,
  updated_at timestamptz default now()
);

-- Migration 002
create table weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  week_start date not null,
  week_end date not null,
  summary text,
  highlights jsonb default '[]',
  concerns jsonb default '[]',
  recommendations jsonb default '[]',
  next_week_focus text,
  encouragement text,
  created_at timestamptz default now()
);

-- RLS
alter table learning_paths   enable row level security;
alter table learning_tracks  enable row level security;
alter table learning_tasks   enable row level security;
alter table daily_plans      enable row level security;
alter table daily_plan_items enable row level security;
alter table daily_logs       enable row level security;
alter table push_tokens      enable row level security;
alter table weekly_reviews   enable row level security;

-- RLS Policies
create policy "own data" on learning_paths   for all using (auth.uid() = user_id);
create policy "own data" on daily_plans      for all using (auth.uid() = user_id);
create policy "own data" on daily_logs       for all using (auth.uid() = user_id);
create policy "own data" on push_tokens      for all using (auth.uid() = user_id);
create policy "own data" on weekly_reviews   for all using (auth.uid() = user_id);
```

> **FK delete order**: `learning_tasks.path_id` has no CASCADE.
> When deleting a path, always delete in this order:
> `daily_plan_items` → `daily_logs` → `learning_tasks` → `learning_paths`

## API Endpoints

### Schedule Import (`schedule.py`)
```
POST /api/schedule/parse
  Rate limit: 5 per user per hour (in-memory sliding window)
  body: { raw_text: str }             ← max 40 000 chars
  returns: SchedulePreview JSON

POST /api/schedule/save
  body: { approved_schedule, priority, start_date? }
  returns: { path_id, title, estimated_days }
```

### Learning Paths (`paths.py`)
```
GET    /api/paths                → list all non-archived paths
GET    /api/paths/{id}           → path + nested tracks + tasks
PUT    /api/paths/{id}/priority  → body: { priority: 1-5 }
PUT    /api/paths/{id}/status    → body: { status: active|paused|completed|archived }
DELETE /api/paths/{id}           → deletes path and all related rows
```

### Daily Plan (`plan.py`)
```
GET  /api/plan/today              → fetch or auto-generate today's plan
POST /api/plan/generate           → force regenerate
POST /api/plan/item/{id}/done     → mark item done + task completed
POST /api/plan/item/{id}/skip     → mark item missed (no rollover penalty)
```

### Logging (`log.py`)
```
POST /api/log         → body: LogRequest
GET  /api/log/weekly  → last 7 days summary grouped by date
```

### User (`user.py`)
```
POST /api/user/push-token  → upsert Expo push token for authenticated user
```

### Weekly Review (`review.py`)
```
GET  /api/review/weekly    → latest weekly review or null
POST /api/review/generate  → manually trigger review (for testing)
```

## Pydantic Schemas (models/schemas.py)
```python
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
    start_date: str | None = None   # "YYYY-MM-DD", defaults to today

class UpdatePriorityRequest(BaseModel):
    priority: int = Field(..., ge=1, le=5)

class UpdateStatusRequest(BaseModel):
    status: str = Field(..., pattern="^(active|paused|completed|archived)$")

class LogRequest(BaseModel):
    task_id: str | None = None
    path_id: str | None = None
    date: str | None = None
    time_spent_minutes: int = Field(..., gt=0)
    notes: str | None = None
    mood: str | None = Field(default=None, pattern="^(good|okay|tired)$")
```

## Rate Limiting (schedule.py)
In-memory sliding-window limiter, no Redis needed:
```python
_PARSE_LIMIT  = 5
_PARSE_WINDOW = 3600   # seconds (1 hour)
_parse_log: dict[str, list[float]] = defaultdict(list)
```
Returns HTTP 429 with human-readable retry countdown if exceeded.

## Groq JSON Handling
Groq sometimes wraps responses in markdown code fences. `_extract_json()` strips them:
```python
def _extract_json(text: str) -> str:
    text = re.sub(r"^```(?:json)?\s*", "", text.strip())
    text = re.sub(r"\s*```$", "", text.strip())
    match = re.search(r"[{\[]", text)
    if match:
        text = text[match.start():]
    return text.strip()
```

## Deployment (Render)
- `render.yaml` at repo root defines the service
- `rootDir: backend`, build: `pip install -r requirements.txt`
- Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Render watches the `master` branch → always push with `git push origin main:master`
- Free tier sleeps after 15 min inactivity; first request wakes it (~10–30s)

## Rules
- All routes require Bearer token (Supabase JWT) via `get_user_id` dependency
- Backend uses the **service key** (bypasses RLS) — mobile never has the service key
- Use async/await throughout; sync Supabase calls wrapped in `asyncio.to_thread()`
- Never hardcode API keys — read from environment variables only
