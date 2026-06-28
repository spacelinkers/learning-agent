# Agent — LangGraph Implementation

## Location
All agent code lives inside the backend:
```
backend/app/agent/
├── planner.py        ← LangGraph daily plan graph
├── weekly_review.py  ← LangGraph weekly review graph
├── tools.py          ← all Supabase queries + Groq calls
├── prompts.py        ← LLM prompt strings
├── scheduler.py      ← APScheduler cron jobs
└── README.md         ← implementation detail reference
```

> The `agent/` folder at the repo root contains only this doc.
> The actual runnable code is in `backend/app/agent/`.

## LLM
- Provider: Groq
- Model: `llama-3.3-70b-versatile`
- Temperature: 0.3 (consistent, low-creativity planning)
- JSON output only — all prompts instruct "Return ONLY JSON. No markdown."
- Groq sometimes wraps output in code fences; `_extract_json()` in `tools.py` strips them

## Daily Planner Graph (planner.py)
```
START
  │
  ▼
load_user_context        ← fetch active paths + priorities
  │
  ▼
check_yesterday          ← find missed items → increment rollover_count
  │
  ▼
calculate_path_pace      ← on_track / slight_delay / behind per path
  │
  ▼
score_and_select_tasks   ← priority scoring algorithm
  │
  ▼
generate_plan_with_llm   ← Groq formats the final plan
  │
  ▼
save_daily_plan          ← write daily_plans + daily_plan_items rows
  │
  ▼
send_push_notification   ← Expo Push API (skipped if no token)
  │
  ▼
END
```

## Weekly Review Graph (weekly_review.py)
Runs every Sunday at 9PM via APScheduler. Also triggerable via `POST /api/review/generate`.
```
START
  │
  ▼
gather_week_stats        ← logs, completion rates, moods per path
  │
  ▼
generate_review_with_llm ← Groq produces structured JSON review
  │
  ▼
save_weekly_review       ← write to weekly_reviews table
  │
  ▼
END
```

## Task Scoring Algorithm
```python
def score_task(task, path, days_behind):
    score = 0
    score += (6 - path.priority) * 10    # P1 = 50pts, P5 = 10pts
    score += task.rollover_count * 15    # each missed day = +15pts
    score += days_behind * 5             # path falling behind = +5pts/day
    if path.status == 'behind':
        score += 20                      # behind paths get bonus
    return score

# Daily plan = sort all candidate tasks by score DESC
# Fill until total estimated_hours >= user's daily budget (default 3h)
# Always include at least 1 task per active path (fairness)
```

## Path Pace Calculation
```python
def calculate_pace(path):
    days_elapsed    = (today - path.start_date).days
    tasks_completed = count completed tasks
    total_tasks     = count all tasks
    expected_pct    = days_elapsed / path.estimated_days
    actual_pct      = tasks_completed / total_tasks

    if actual_pct >= expected_pct - 0.10:  return 'on_track'
    elif actual_pct >= expected_pct - 0.25: return 'slight_delay'
    else:                                   return 'behind'
```

## Rollover Rules
- Missed once → `rollover_count = 1`, reprioritized next day (+15pts)
- Missed 3+ times → `needs_review: true` in API response
- Paused paths → no rollovers generated
- User can skip permanently via the Skip button (no rollover penalty)

## Scheduler Jobs (scheduler.py)
Three APScheduler `AsyncIOScheduler` cron jobs:

| Job | Schedule | What it does |
|---|---|---|
| `morning_plan_job` | 6:00 AM daily | Runs planner graph for every user with active paths |
| `evening_check_job` | 10:00 PM daily | Marks pending items missed, sends evening push summary |
| `weekly_review_job` | Sunday 9:00 PM | Runs weekly review graph for all active users |

All jobs call sync tools via `asyncio.to_thread()` because Supabase client is sync.

## LangGraph / asyncio Bridge
LangGraph nodes are synchronous functions. The scheduler and FastAPI routes call them via:
```python
await asyncio.to_thread(run_planner, user_id, today)
```
This keeps FastAPI's event loop free while the graph runs in a thread pool.
