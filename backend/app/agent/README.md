# Agent — LangGraph Implementation

Server-side AI agent built with LangGraph. Two independent graphs: a **daily planner** that runs every morning, and a **weekly review** that runs every Sunday. Both are triggered by APScheduler cron jobs, run synchronously, and are never called directly from the mobile app.

---

## Architecture Overview

```
APScheduler (scheduler.py)
    │
    ├── 6:00 AM  → morning_plan_job()   → run_planner()        → planner.py
    ├── 10:00 PM → evening_check_job()  → tools directly        → tools.py
    └── 9:00 PM Sun → weekly_review_job() → run_weekly_review() → weekly_review.py
                                                  │
                                              tools.py
                                              (Supabase + Groq + Push)
```

All graph nodes are **synchronous** functions. The async scheduler calls them via `asyncio.to_thread()` to avoid blocking the FastAPI event loop.

---

## Files

| File | Purpose |
|---|---|
| `planner.py` | Daily planner LangGraph graph — 7 nodes |
| `weekly_review.py` | Weekly review LangGraph graph — 5 nodes |
| `tools.py` | All DB helpers, Groq caller, push notification sender |
| `prompts.py` | Raw prompt strings for each LLM call |
| `scheduler.py` | APScheduler cron job definitions |

---

## Daily Planner Graph (`planner.py`)

### State — `PlannerState` (TypedDict)

```python
class PlannerState(TypedDict):
    user_id:        str       # Supabase auth user UUID
    plan_date:      str       # "YYYY-MM-DD" — the plan being generated
    yesterday:      str       # "YYYY-MM-DD" — for rollover check
    hours_budget:   float     # max hours to schedule (default 3.0)
    active_paths:   list      # learning_paths rows, annotated with _pace_status
    missed_task_ids: list     # task IDs missed yesterday → is_rollover=True today
    path_paces:     dict      # path_id → {status, days_behind, completion_pct}
    selected_items: list      # final tasks chosen for today's plan
    llm_plan:       dict      # Groq output: {greeting, focus_hint, plan_items}
    plan_id:        str       # UUID of the saved daily_plans row
```

State is a plain Python dict. LangGraph passes it through each node; every node returns a partial dict that is merged back into state.

### Graph — node execution order

```
START
  │
  ▼
load_user_context          Fetch all active learning_paths for this user
  │
  ▼
check_yesterday            Mark pending items in yesterday's plan as 'missed',
  │                        increment rollover_count on those tasks,
  │                        collect their task_ids → state.missed_task_ids
  ▼
calculate_path_pace        For each path: count total vs completed tasks,
  │                        compute days_behind and pace status
  ▼
score_and_select_tasks     Score every candidate task, apply fairness rule,
  │                        fill hours budget
  ▼
generate_plan_with_llm     Format context, call Groq, get greeting + tips
  │
  ▼
save_daily_plan            Upsert daily_plans row, delete+reinsert plan items
  │
  ▼
send_push_notification     Look up push token, POST to Expo push API
  │
  ▼
 END
```

### Scoring algorithm (`tools.score_task`)

Every pending/suggested task for a path gets a numeric score. Higher score = higher priority in today's plan.

```python
score = (6 - priority) * 10   # P1 → 50pts,  P5 → 10pts
score += rollover_count * 15   # each missed day adds 15pts
score += days_behind * 5       # each day behind on pace adds 5pts
if pace_status == "behind":
    score += 20                # flat bonus for behind paths
```

### Fairness rule (`score_and_select_tasks`)

1. From each active path, pick the **top-scored task** → guaranteed slot
2. Add all guaranteed tasks to the plan first (regardless of budget)
3. Fill remaining budget with the next highest-scoring tasks across all paths

This ensures every active learning path gets at least one task per day, even if the budget is tight.

### Rollover flag

A task gets `is_rollover=True` in today's plan if its `task_id` appears in `state.missed_task_ids` (tasks that were still `pending` in yesterday's plan when the 10 PM job ran). This is surfaced in the mobile UI with a 🔄 badge.

When `rollover_count >= 3`, the API response includes `needs_review: true` for that task — surfaced with a ⚠️ badge.

---

## Weekly Review Graph (`weekly_review.py`)

### State — `WeeklyReviewState` (TypedDict)

```python
class WeeklyReviewState(TypedDict):
    user_id:       str    # Supabase auth user UUID
    week_start:    str    # "YYYY-MM-DD" Monday
    week_end:      str    # "YYYY-MM-DD" Sunday
    active_paths:  list   # learning_paths rows
    week_stats:    dict   # {paths: {path_id: {completed, missed, minutes}}, overall: {...}}
    path_paces:    dict   # path_id → {status, days_behind, completion_pct}
    llm_review:    dict   # full Groq output
    review_id:     str    # UUID of the saved weekly_reviews row
```

### Graph — node execution order

```
START
  │
  ▼
gather_week_stats          Fetch active paths + aggregate 7-day plan item
  │                        completions and daily_logs minutes per path
  ▼
calculate_path_paces       Reuse same pace calc as daily planner
  │
  ▼
generate_review_llm        Build context string, call Groq, validate output:
  │                        drop any recommendations whose path_id doesn't
  │                        match a real active path (hallucination guard)
  ▼
save_review                Upsert weekly_reviews (unique on user_id + week_start)
  │
  ▼
send_review_notification   Push notification with encouragement line
  │
  ▼
 END
```

### Hallucination guard

The LLM sometimes generates `path_id` values that don't exist. After the Groq call, the node filters `recommendations` to only include entries whose `path_id` is in the set of real active path UUIDs:

```python
valid_path_ids = {p["id"] for p in state["active_paths"]}
llm_review["recommendations"] = [
    r for r in recs if r.get("path_id") in valid_path_ids
]
```

---

## Tools (`tools.py`)

All functions are **synchronous**. Called directly from graph nodes or via `asyncio.to_thread()` from the scheduler.

| Function | What it does |
|---|---|
| `get_active_paths(user_id)` | Returns all `status=active` paths ordered by priority |
| `get_all_active_users()` | Distinct user_ids with at least one active path |
| `get_next_tasks(path_id, limit)` | Next N pending/suggested tasks in sequence order |
| `get_path_task_counts(path_id)` | Returns `(total, completed)` task counts |
| `calculate_pace(path, completed, total)` | Returns `{status, days_behind, completion_pct}` |
| `score_task(task, path, days_behind)` | Returns integer score (see scoring formula above) |
| `mark_missed(user_id, yesterday)` | Marks pending plan items as missed, increments rollover_count |
| `save_plan(user_id, plan_date, items, hours_budget)` | Upserts daily_plans + inserts plan items |
| `get_evening_stats(user_id, today)` | Returns `{completed, missed, total_minutes}` for today |
| `get_week_stats(user_id, week_start, week_end)` | Per-path and overall stats for a 7-day window |
| `save_weekly_review(user_id, ...)` | Upserts weekly_reviews row |
| `call_groq(prompt)` | Calls LLaMA 3.3 70B, returns parsed JSON dict |
| `send_notification(user_id, title, body)` | Looks up push token, POSTs to Expo push API |

### Groq call

```python
client = Groq(api_key=os.environ["GROQ_API_KEY"])
resp = client.chat.completions.create(
    model="llama-3.3-70b-versatile",
    temperature=0.3,           # low temp for structured JSON output
    messages=[{"role": "user", "content": prompt}],
)
return json.loads(resp.choices[0].message.content)
```

All prompts instruct the model to return **only valid JSON with no markdown**. `temperature=0.3` keeps output deterministic enough to reliably parse.

---

## Prompts (`prompts.py`)

### `DAILY_PLAN_PROMPT`

Inputs: `paths_summary`, `tasks_json`, `hours_budget`

Expected output shape:
```json
{
  "greeting": "one motivational sentence",
  "focus_hint": "one key focus tip for today",
  "plan_items": [
    {
      "task_id": "uuid",
      "display_title": "friendly task title",
      "path_title": "path name",
      "estimated_minutes": 45,
      "is_rollover": false,
      "tip": "one short practical tip"
    }
  ]
}
```

The `task_id` values passed in are the real UUIDs from Supabase, so the LLM's output `plan_items` can be matched back to database rows. The LLM does not select tasks — that is done by the scoring algorithm. The LLM only adds human-friendly text on top of what the algorithm already chose.

### `WEEKLY_REVIEW_PROMPT`

Inputs: `paths_context`, `stats_context`, `pace_context`, `week_start`, `week_end`, `days_active`, `total_minutes`

Expected output shape:
```json
{
  "summary": "2-3 sentence overview",
  "highlights": ["achievement 1", "achievement 2"],
  "concerns": ["concern 1", "concern 2"],
  "recommendations": [
    {
      "path_id": "<exact uuid>",
      "path_title": "name",
      "action": "increase_priority|reduce_scope|pause|continue",
      "reason": "one sentence"
    }
  ],
  "next_week_focus": "1-2 sentences",
  "encouragement": "one motivational sentence"
}
```

Path UUIDs are explicitly included in the prompt context so the model can reference them directly in `recommendations.path_id`. The hallucination guard (see above) filters any invented UUIDs before saving.

### `EVENING_PROMPT`

Inputs: `completed` (list of task titles), `missed` (list of task titles), `total_minutes`

Lightweight prompt — only used for the 10 PM evening push notification body.

---

## Scheduler (`scheduler.py`)

Three APScheduler cron jobs registered on the shared `AsyncIOScheduler` instance that is started in FastAPI's lifespan context (`main.py`).

| Job | Cron | What runs |
|---|---|---|
| `morning_plan_job` | `hour=6, minute=0` | `run_planner(user_id)` for every active user |
| `evening_check_job` | `hour=22, minute=0` | `mark_missed` + evening Groq summary + push |
| `weekly_review_job` | `day_of_week=sun, hour=21` | `run_weekly_review(user_id)` for every active user |

### Async ↔ sync bridge

Graph nodes and tools are all sync. The scheduler jobs are async (required by APScheduler's `AsyncIOScheduler`). The bridge is `asyncio.to_thread()`:

```python
@scheduler.scheduled_job("cron", hour=6, minute=0)
async def morning_plan_job() -> None:
    user_ids = await asyncio.to_thread(tools.get_all_active_users)
    for user_id in user_ids:
        await asyncio.to_thread(run_planner, user_id)
```

Each user runs sequentially inside the job. A `try/except` per user means one failing user doesn't block the others.

---

## How to extend

**Add a new node to a graph:**

```python
def my_new_node(state: PlannerState) -> dict:
    # read from state, do work, return partial state update
    return {"some_key": some_value}

_workflow.add_node("my_new_node", my_new_node)
_workflow.add_edge("score_and_select_tasks", "my_new_node")   # insert into chain
_workflow.add_edge("my_new_node", "generate_plan_with_llm")
```

**Add a new field to state:**

1. Add the key to the `TypedDict` with a type annotation
2. Set its initial value in `run_planner()` / `run_weekly_review()`
3. Return it from whichever node computes it

**Add a new scheduled job:**

```python
@scheduler.scheduled_job("cron", hour=12, minute=0)
async def midday_job() -> None:
    ...
```

The scheduler picks it up automatically since it's registered on the same `scheduler` instance imported in `main.py`.

**Run a graph manually (e.g. from a FastAPI route):**

```python
from app.agent.planner import run_planner
import asyncio

# In an async route:
result = await asyncio.to_thread(run_planner, user_id)

# Or directly in sync context:
result = run_planner(user_id)
```
