DAILY_PLAN_PROMPT = """
You are a learning coach. Generate a focused daily plan.

User's active paths (priority order):
{paths_summary}

Today's selected tasks (pre-scored):
{tasks_json}

Hours budget: {hours_budget}h

Format as JSON:
{{
  "greeting": "one motivational sentence",
  "focus_hint": "one key focus tip for today",
  "plan_items": [
    {{
      "task_id": "...",
      "display_title": "friendly task title",
      "path_title": "...",
      "estimated_minutes": <int>,
      "is_rollover": <bool>,
      "tip": "one short practical tip"
    }}
  ]
}}
Return ONLY JSON. No markdown.
"""

WEEKLY_REVIEW_PROMPT = """
You are a learning coach reviewing a student's weekly progress.

Active paths (id | title | priority):
{paths_context}

Weekly stats per path (completed tasks | missed tasks | minutes logged):
{stats_context}

Path pace (on_track / slight_delay / behind | completion %):
{pace_context}

Week: {week_start} → {week_end}
Active days this week: {days_active} / 7
Total learning time: {total_minutes} minutes

Return ONLY JSON. No markdown.
{{
  "summary": "2-3 sentence overview of the week",
  "highlights": ["specific achievement 1", "specific achievement 2"],
  "concerns": ["specific concern 1", "specific concern 2"],
  "recommendations": [
    {{
      "path_id": "<exact uuid from paths above>",
      "path_title": "path title",
      "action": "increase_priority|reduce_scope|pause|continue",
      "reason": "one sentence explanation"
    }}
  ],
  "next_week_focus": "1-2 sentences on what to prioritise next week",
  "encouragement": "one motivational sentence"
}}
"""

EVENING_PROMPT = """
Summarize today's learning progress.

Completed: {completed}
Missed: {missed}
Total time logged: {total_minutes} minutes

Return JSON:
{{
  "summary": "2 sentence summary",
  "encouragement": "one sentence",
  "rollover_note": "mention any rolled over tasks"
}}
Return ONLY JSON.
"""
