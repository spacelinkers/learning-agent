# Backend — Deployment Guide

FastAPI backend for Learning Agent. Hosted on Render (free tier). Auto-deploys on every `git push`.

---

## First-Time Deployment

### Step 1 — Push code to GitHub

If you haven't already:

```bash
cd /path/to/learning-agent
git remote add origin https://github.com/YOUR_USERNAME/learning-agent.git
git push -u origin master
```

---

### Step 2 — Create Render service

1. Go to [render.com](https://render.com) and sign in (free account)
2. Click **New → Blueprint**
3. Click **Connect a repository** → authorize GitHub → select `learning-agent`
4. Render detects `render.yaml` at the repo root and shows one service: `learning-agent-api`
5. Click **Apply**

Render will start the first build. It will **fail** with missing environment variables — that is expected. Fix it in Step 3.

---

### Step 3 — Add environment variables

In the Render dashboard:

1. Click the `learning-agent-api` service
2. Go to **Environment** tab
3. Add these 4 variables (click **Add Environment Variable** for each):

| Key | Where to get it |
|---|---|
| `SUPABASE_URL` | Supabase dashboard → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_KEY` | Supabase dashboard → Project Settings → API → `service_role` key |
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) → API Keys |
| `EXPO_ACCESS_TOKEN` | [expo.dev](https://expo.dev) → Account Settings → Access Tokens |

4. Click **Save Changes**

Render automatically triggers a new deploy after saving. Watch the **Logs** tab — it should end with:

```
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:10000
```

---

### Step 4 — Run database migrations

Before the backend can serve requests, all tables must exist in Supabase.

Go to **Supabase dashboard → SQL Editor → New query** and run these in order:

**1. Core schema** — copy the full contents of `backend/schema.sql` and run it.

**2. Migration 001** — push tokens table:

```sql
create table if not exists push_tokens (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        references auth.users not null,
  token      text        not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id)
);
alter table push_tokens enable row level security;
create policy "own push_tokens" on push_tokens
  for all using (auth.uid() = user_id);
create index if not exists push_tokens_user_id_idx on push_tokens (user_id);
```

**3. Migration 002** — weekly reviews table:

```sql
create table if not exists weekly_reviews (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        references auth.users not null,
  week_start       date        not null,
  week_end         date        not null,
  summary          text,
  highlights       jsonb       default '[]',
  concerns         jsonb       default '[]',
  recommendations  jsonb       default '[]',
  next_week_focus  text,
  encouragement    text,
  raw_llm          jsonb,
  created_at       timestamptz default now(),
  unique (user_id, week_start)
);
alter table weekly_reviews enable row level security;
create policy "own weekly_reviews" on weekly_reviews
  for all using (auth.uid() = user_id);
create index if not exists weekly_reviews_user_week_idx
  on weekly_reviews (user_id, week_start desc);
```

---

### Step 5 — Verify the deployment

Your Render URL will be: `https://learning-agent-api.onrender.com`

Test the health endpoint:

```bash
curl https://learning-agent-api.onrender.com/health
# Expected: {"status":"ok"}
```

Update `mobile/.env` with the Render URL:

```
EXPO_PUBLIC_API_URL=https://learning-agent-api.onrender.com
```

Then restart Expo:

```bash
cd mobile && npx expo start --clear
```

---

## Auto-Deploy on Git Push

Once Render is connected to the repo, every push to `master` triggers an automatic redeploy.

### Workflow

```bash
# Make changes to backend code
# e.g. fix a bug in app/routers/plan.py

git add backend/app/routers/plan.py
git commit -m "fix: plan rollover logic"
git push origin master
```

That's it. Render detects the push via GitHub webhook and:

1. Pulls latest code
2. Runs `pip install -r requirements.txt`
3. Restarts `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. New version is live in ~2 minutes

Watch the progress in **Render dashboard → Logs**.

---

### Checking deploy status

In the Render dashboard → `learning-agent-api` → **Events** tab you can see every deploy:

| Status | Meaning |
|---|---|
| `In Progress` | Build running |
| `Live` | Deploy succeeded |
| `Failed` | Build or startup error — check Logs |

---

### If a deploy fails

1. Go to **Logs** tab in Render
2. Scroll to the bottom — the error will be there
3. Common causes:

| Error | Fix |
|---|---|
| `ModuleNotFoundError` | Add missing package to `requirements.txt` and push again |
| `KeyError: 'SUPABASE_URL'` | Environment variable missing — add it in the Environment tab |
| `APIError: table not found` | Run the missing SQL migration in Supabase |
| Port binding error | Render assigns `$PORT` automatically — never hardcode a port |

---

## Local Development

Run the backend locally (useful for testing before pushing):

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # then fill in real keys
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

The `--reload` flag restarts the server automatically when you save a file.

Set `EXPO_PUBLIC_API_URL=http://<your-local-ip>:8001` in `mobile/.env` to point the app at the local server during development.

---

## Free Tier Notes

- The service **sleeps after 15 minutes** of no traffic
- First request after sleep takes **~30 seconds** to wake up
- 750 free instance hours per month (enough for one always-on service)
- To keep the service warm, you can ping `/health` every 10 minutes using a free uptime monitor like [UptimeRobot](https://uptimerobot.com)

---

## Code Implementation Reference

### Entry Point — `main.py`

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.agent.scheduler import scheduler
from app.routers import log, paths, plan, review, schedule, user

@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.start()   # starts APScheduler cron jobs
    yield
    scheduler.shutdown()

app = FastAPI(title="Learning Agent API", lifespan=lifespan)

app.add_middleware(CORSMiddleware, allow_origins=["*"], ...)

app.include_router(schedule.router)   # /api/schedule
app.include_router(paths.router)      # /api/paths
app.include_router(plan.router)       # /api/plan
app.include_router(log.router)        # /api/log
app.include_router(user.router)       # /api/user
app.include_router(review.router)     # /api/review
```

The `lifespan` context manager is the FastAPI-recommended pattern for startup/shutdown logic. The scheduler starts with the app and shuts down cleanly when the process exits.

---

### Supabase Client — `app/db/supabase.py`

```python
from functools import lru_cache
from supabase import create_client, Client

@lru_cache(maxsize=1)
def get_supabase() -> Client:
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
```

`@lru_cache(maxsize=1)` makes this a singleton — the client is created once on first call and reused for the entire process lifetime. Every router and tool imports and calls `get_supabase()` directly; no dependency injection needed for the DB client.

The **service key** (not the anon key) is used here because all agent-side DB operations bypass RLS. The mobile app uses the anon key + user JWT, which goes through RLS policies.

---

### Auth Dependency — `app/deps.py`

```python
async def get_user_id(authorization: str = Header(...)) -> str:
    token = authorization.removeprefix("Bearer ")
    user = get_supabase().auth.get_user(token)
    return user.user.id
```

Used in every router with `Depends(get_user_id)`. Verifies the JWT issued by Supabase Auth and returns the `user_id` UUID. Returns `401` if the token is missing, malformed, or expired.

All data queries include `.eq("user_id", user_id)` so users can only read their own rows — a second layer of protection on top of Supabase RLS.

---

### Pydantic Models — `app/models/schemas.py`

**Request models (inbound):**

```python
class ParseRequest(BaseModel):
    raw_text: str = Field(..., max_length=8000)   # Groq context limit guard

class SaveScheduleRequest(BaseModel):
    approved_schedule: SchedulePreview
    priority: int = Field(default=3, ge=1, le=5)  # 1=highest, 5=lowest
    hours_per_day: float = Field(default=3.0, gt=0)

class LogRequest(BaseModel):
    task_id: str | None = None
    path_id: str | None = None
    date: str | None = None                        # defaults to today server-side
    time_spent_minutes: int = Field(..., gt=0)
    notes: str | None = None
    mood: str | None = Field(default=None, pattern="^(good|okay|tired)$")

class UpdateStatusRequest(BaseModel):
    status: str = Field(..., pattern="^(active|paused|completed|archived)$")
```

**Response model for today's plan:**

```python
class PlanItemOut(BaseModel):
    item_id: str          # daily_plan_items.id
    task_id: str          # learning_tasks.id
    path_id: str
    title: str
    path_title: str
    description: str | None
    estimated_hours: float
    suggested_order: int
    is_rollover: bool     # True if task was missed yesterday
    status: str           # pending / done / missed
    rollover_count: int   # how many times missed total
    needs_review: bool    # True when rollover_count >= 3
```

`needs_review` is computed server-side (`rollover_count >= 3`) — never stored in the DB, derived on every fetch.

---

### Schedule Router — `app/routers/schedule.py`

**POST /api/schedule/parse**

Takes raw pasted chat text, calls Groq, returns a structured `SchedulePreview`.

```python
@router.post("/parse")
async def parse_schedule(body: ParseRequest, user_id: str = Depends(get_user_id)):
    prompt = PARSE_PROMPT.format(raw_text=body.raw_text)
    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
    )
    parsed = SchedulePreview.model_validate_json(response.choices[0].message.content)
    return parsed
```

`SchedulePreview.model_validate_json()` both parses the JSON string and validates the Pydantic schema in one call. If Groq returns malformed JSON or a schema mismatch, a `422` is raised.

**POST /api/schedule/save**

Inserts the approved schedule as a 3-level hierarchy: path → tracks → tasks.

```python
# 1 — create the learning_path row
path_id = supabase.table("learning_paths").insert({...}).execute().data[0]["id"]

# 2 — for each track, insert track then bulk-insert all its tasks
for seq_track, track in enumerate(schedule.tracks, start=1):
    track_id = supabase.table("learning_tracks").insert({...}).execute().data[0]["id"]
    supabase.table("learning_tasks").insert([...tasks...]).execute()
```

`target_date` is computed as `today + sum(track.estimated_days)`. The first track gets `status="active"`, all others start as `"pending"`.

---

### Plan Router — `app/routers/plan.py`

**GET /api/plan/today**

Auto-generates the plan if it doesn't exist yet for today:

```python
@router.get("/today", response_model=TodayPlanOut)
async def get_today(user_id: str = Depends(get_user_id)):
    plan = supabase.table("daily_plans").select("*").eq("user_id", user_id).eq("date", today).execute()

    if not plan.data:
        # First request of the day triggers the LangGraph planner
        await asyncio.to_thread(run_planner, user_id, today)
        plan = supabase.table("daily_plans").select("*")...execute()
```

`asyncio.to_thread()` runs the synchronous LangGraph graph in a thread pool so it doesn't block the async FastAPI event loop.

**POST /api/plan/item/{id}/done vs skip**

| Endpoint | `daily_plan_items.status` | `learning_tasks.status` | `rollover_count` |
|---|---|---|---|
| `/done` | `done` | `completed` | unchanged |
| `/skip` | `missed` | unchanged | unchanged |

Done marks the underlying task as permanently completed. Skip marks the plan item as missed but does not increment `rollover_count` — that only happens via the 10 PM scheduler job for items still `pending`.

**Ownership check (`_assert_owns_item`):**

```python
res = sb.table("daily_plan_items")
    .select("id, task_id, plan_id, daily_plans(user_id)")
    .eq("id", item_id).single().execute()

if res.data["daily_plans"]["user_id"] != user_id:
    raise HTTPException(403)
```

Single query with a join — verifies ownership without an extra round trip.

**Plan item fetch (`_fetch_plan_items`):**

```python
res = supabase.table("daily_plan_items")
    .select("*, learning_tasks(title, description, estimated_hours, rollover_count), learning_paths(title)")
    .eq("plan_id", plan_id)
    .order("suggested_order")
    .execute()
```

Supabase PostgREST resolves the foreign key joins in a single query. `learning_tasks(...)` and `learning_paths(...)` return nested objects on each row.

---

### Paths Router — `app/routers/paths.py`

**GET /api/paths/{id}** — returns the full hierarchy in one query:

```python
supabase.table("learning_paths")
    .select("*, learning_tracks(*, learning_tasks(*))")
    .eq("id", path_id)
    .eq("user_id", user_id)
    .single()
    .execute()
```

PostgREST recursively resolves the foreign keys: `learning_tracks` nested under the path, `learning_tasks` nested under each track. The response is then sorted in Python by `sequence_order` at both levels.

---

### Log Router — `app/routers/log.py`

**GET /api/log/weekly** — groups 7 days of logs by date:

```python
logs = supabase.table("daily_logs")
    .select("*, learning_tasks(title), learning_paths(title)")
    .eq("user_id", user_id)
    .gte("date", week_start)
    .order("date", desc=True)
    .execute().data

# Group by date in Python
by_date: dict[str, dict] = {}
for log in logs:
    d = log["date"]
    by_date.setdefault(d, {"date": d, "total_minutes": 0, "entries": []})
    by_date[d]["total_minutes"] += log.get("time_spent_minutes") or 0
    by_date[d]["entries"].append({...})
```

Returns `{days: [...], total_minutes, total_entries, week_start, week_end}`.

---

### Key Design Patterns

**1. Sync tools, async routes**

All Supabase interactions in `tools.py` are synchronous (the `supabase-py` library is sync). FastAPI routes are async. The bridge is `asyncio.to_thread()`:

```python
# In an async route or scheduler job:
result = await asyncio.to_thread(sync_function, arg1, arg2)
```

**2. Upsert for idempotency**

Daily plans and weekly reviews use upsert with `on_conflict` so re-running the agent never creates duplicates:

```python
supabase.table("daily_plans").upsert(
    {"user_id": user_id, "date": plan_date, ...},
    on_conflict="user_id,date",
).execute()
```

**3. Service key vs anon key**

| Key | Used by | Bypasses RLS |
|---|---|---|
| `SUPABASE_SERVICE_KEY` | Backend (server-side) | Yes — full DB access |
| `SUPABASE_ANON_KEY` | Mobile (client-side) | No — RLS enforced |

The backend uses the service key so the agent can read all users' data for scheduled jobs. The mobile app uses the anon key + user JWT so each user can only access their own rows.

**4. Error handling**

Routers raise `HTTPException` with appropriate status codes. Agent tools (`tools.py`) catch exceptions silently where failure is non-critical (e.g. push notifications — if the token is missing or the Expo API is down, the plan still saves):

```python
def send_notification(user_id, title, body) -> bool:
    try:
        ...
    except Exception:
        return False   # non-critical — degrade gracefully
```

**5. `needs_review` is derived, not stored**

`needs_review: bool` in `PlanItemOut` is computed on every plan fetch:

```python
needs_review = rollover_count >= 3
```

This means the threshold can be changed without a migration — just update the comparison in `_fetch_plan_items`.
