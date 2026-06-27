# Backend — FastAPI + Supabase + Groq

## Structure
```
backend/
├── main.py
├── requirements.txt
├── .env
└── app/
    ├── routers/
    │   ├── schedule.py     # import + save learning paths
    │   ├── plan.py         # daily plan CRUD
    │   ├── log.py          # daily log entries
    │   └── paths.py        # learning path CRUD
    ├── agent/
    │   └── planner.py      # LangGraph agent (see agent/CLAUDE.md)
    ├── models/
    │   └── schemas.py      # Pydantic models
    └── db/
        └── supabase.py     # Supabase client singleton
```

## Dependencies (requirements.txt)
```
fastapi
uvicorn
supabase
groq
langgraph
langchain-groq
pydantic
python-dotenv
httpx
apscheduler          # for scheduled agent runs
```

## Supabase Schema (run in Supabase SQL editor)
```sql
-- Learning Paths (imported from chat or manual)
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

-- Tracks within a path
create table learning_tracks (
  id uuid primary key default gen_random_uuid(),
  path_id uuid references learning_paths on delete cascade,
  title text not null,
  estimated_days int,
  sequence_order int,
  status text default 'pending'    -- pending/active/completed
);

-- Atomic tasks within a track
create table learning_tasks (
  id uuid primary key default gen_random_uuid(),
  track_id uuid references learning_tracks on delete cascade,
  path_id uuid references learning_paths,
  title text not null,
  description text,
  estimated_hours float default 1.0,
  sequence_order int,
  status text default 'pending',   -- pending/suggested/completed/skipped
  suggested_date date,
  completed_date date,
  rollover_count int default 0     -- times missed/rolled over
);

-- Daily generated plans
create table daily_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  date date not null,
  total_hours_budget float default 3.0,
  status text default 'active',    -- active/completed
  generated_at timestamptz default now(),
  unique(user_id, date)
);

-- Items within a daily plan
create table daily_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references daily_plans on delete cascade,
  task_id uuid references learning_tasks,
  path_id uuid references learning_paths,
  suggested_order int,
  is_rollover boolean default false,
  status text default 'pending'    -- pending/done/missed
);

-- What user actually logs
create table daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  task_id uuid references learning_tasks,
  path_id uuid references learning_paths,
  date date,
  time_spent_minutes int,
  notes text,
  mood text,                       -- 'good'/'okay'/'tired'
  logged_at timestamptz default now()
);

-- Enable RLS
alter table learning_paths enable row level security;
alter table learning_tracks enable row level security;
alter table learning_tasks enable row level security;
alter table daily_plans enable row level security;
alter table daily_plan_items enable row level security;
alter table daily_logs enable row level security;

-- RLS Policies (user sees only their own data)
create policy "own data" on learning_paths for all using (auth.uid() = user_id);
create policy "own data" on daily_plans for all using (auth.uid() = user_id);
create policy "own data" on daily_logs for all using (auth.uid() = user_id);
```

## API Endpoints

### Schedule Import
```
POST /api/schedule/parse
  body: { raw_text: string }
  returns: { tracks: [...], title: string }  ← preview before save

POST /api/schedule/save
  body: { approved_schedule: {...}, priority: int }
  returns: { path_id: string }
```

### Learning Paths
```
GET  /api/paths              → list all active paths
GET  /api/paths/{id}         → path detail with tracks + tasks
PUT  /api/paths/{id}/priority → update priority
PUT  /api/paths/{id}/status   → pause/resume/complete
```

### Daily Plan
```
GET  /api/plan/today         → get or generate today's plan
POST /api/plan/item/{id}/done → mark task done
POST /api/plan/item/{id}/skip → skip task (no rollover penalty)
POST /api/plan/generate      → force regenerate today's plan
```

### Logging
```
POST /api/log                → log a completed task
GET  /api/log/weekly         → last 7 days summary
```

## Pydantic Schemas (models/schemas.py)
```python
class ParseRequest(BaseModel):
    raw_text: str

class TaskPreview(BaseModel):
    title: str
    description: str | None
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
    priority: int = 3
    hours_per_day: float = 3.0
```

## Groq Parse Prompt
```python
PARSE_PROMPT = """
Extract a structured learning schedule from this conversation.
Return ONLY valid JSON. No markdown. No explanation.

Schema:
{
  "title": "short descriptive title",
  "tracks": [
    {
      "title": "track name",
      "estimated_days": <int>,
      "subtopics": [
        {"title": "task name", "estimated_hours": <float>, "sequence_order": <int>}
      ]
    }
  ]
}

Conversation:
{raw_text}
"""
```

## Rules
- All routes require Bearer token (Supabase JWT)
- Parse endpoint: max input 8000 chars
- Daily plan generation runs at 6AM via APScheduler
- Evening check at 10PM marks uncompleted items as missed + increments rollover_count
- If rollover_count >= 3 → flag task in response with needs_review: true
