# Agent — LangGraph Daily Planner

## Location
```
backend/app/agent/
├── planner.py       # main LangGraph graph
├── tools.py         # all agent tools
├── prompts.py       # all LLM prompts
└── scheduler.py     # APScheduler jobs (morning + evening)
```

## LLM
- Provider: Groq
- Model: llama-3.3-70b-versatile
- Temperature: 0.3 (consistent planning)

## LangGraph Graph
```
START
  │
  ▼
load_user_context        ← fetch active paths, priorities, today's logs
  │
  ▼
check_yesterday          ← find missed items → mark rollover
  │
  ▼
calculate_path_pace      ← on_track / behind / ahead per path
  │
  ▼
score_and_select_tasks   ← priority algorithm (see below)
  │
  ▼
generate_plan_with_llm   ← Groq formats friendly daily plan
  │
  ▼
save_daily_plan          ← write to daily_plans + daily_plan_items
  │
  ▼
send_push_notification   ← Expo Push API
  │
  ▼
END
```

## Agent Tools (tools.py)
```python
# All tools receive user_id as context

get_active_paths(user_id)
  → returns list of paths with priority, status, pace

get_missed_tasks(user_id, date)
  → returns tasks with status='missed' from yesterday's plan

calculate_pace(path_id)
  → returns: { on_track: bool, days_behind: int, completion_pct: float }

get_next_tasks(path_id, limit=3)
  → returns next pending tasks in sequence order

score_task(task, path)
  → returns priority score (see algorithm below)

save_plan(user_id, date, items)
  → writes to daily_plans + daily_plan_items

mark_missed(plan_id, date)
  → marks all pending items as missed, increments rollover_count

send_notification(user_id, title, body)
  → calls Expo Push API
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
# Fill until total estimated_hours >= user's daily budget
# Always include at least 1 task per active path (fairness)
```

## Prompts (prompts.py)

### Daily Plan Prompt
```python
DAILY_PLAN_PROMPT = """
You are a learning coach. Generate a focused daily plan.

User's active paths (priority order):
{paths_summary}

Today's selected tasks (pre-scored):
{tasks_json}

Hours budget: {hours_budget}h

Format as JSON:
{
  "greeting": "one motivational sentence",
  "focus_hint": "one key focus tip for today",
  "plan_items": [
    {
      "task_id": "...",
      "display_title": "friendly task title",
      "path_title": "...",
      "estimated_minutes": <int>,
      "is_rollover": <bool>,
      "tip": "one short practical tip"
    }
  ]
}
Return ONLY JSON. No markdown.
"""
```

### Evening Summary Prompt
```python
EVENING_PROMPT = """
Summarize today's learning progress.

Completed: {completed}
Missed: {missed}
Total time logged: {total_minutes} minutes

Return JSON:
{
  "summary": "2 sentence summary",
  "encouragement": "one sentence",
  "rollover_note": "mention any rolled over tasks"
}
Return ONLY JSON.
"""
```

## Scheduler Jobs (scheduler.py)
```python
# Morning: generate daily plan
@scheduler.scheduled_job('cron', hour=6, minute=0)
async def morning_plan():
    # for each active user → run planner graph

# Evening: mark missed + send summary  
@scheduler.scheduled_job('cron', hour=22, minute=0)
async def evening_check():
    # mark uncompleted plan items as missed
    # increment rollover_count on tasks
    # run evening summary LLM call
    # send push notification
```

## Rollover Rules
- missed once → rollover_count = 1, reprioritized tomorrow
- missed 3 times → flagged as needs_review in API response
- user can: reschedule / break into smaller tasks / skip permanently
- paused paths → no rollovers generated

## Path Pace Calculation
```python
def calculate_pace(path):
    days_elapsed = (today - path.start_date).days
    tasks_completed = count completed tasks
    total_tasks = count all tasks
    expected_pct = days_elapsed / path.estimated_days
    actual_pct = tasks_completed / total_tasks

    if actual_pct >= expected_pct - 0.1:
        return 'on_track'
    elif actual_pct >= expected_pct - 0.25:
        return 'slight_delay'
    else:
        return 'behind'
```
