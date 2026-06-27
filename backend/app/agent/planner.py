"""
LangGraph daily planner graph.

Graph: load_user_context → check_yesterday → calculate_path_pace
       → score_and_select_tasks → generate_plan_with_llm
       → save_daily_plan → send_push_notification → END

Run via:
    from app.agent.planner import run_planner
    run_planner(user_id="...", plan_date="2026-06-27")
"""

import json
from datetime import date, timedelta
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from app.agent import tools
from app.agent.prompts import DAILY_PLAN_PROMPT


# ── State ─────────────────────────────────────────────────────────────────────

class PlannerState(TypedDict):
    user_id: str
    plan_date: str           # "YYYY-MM-DD"
    yesterday: str           # "YYYY-MM-DD"
    hours_budget: float
    active_paths: list       # learning_paths rows (annotated with _pace_*)
    missed_task_ids: list    # task IDs missed yesterday → is_rollover flag
    path_paces: dict         # path_id → {status, days_behind, completion_pct}
    selected_items: list     # [{task_id, path_id, is_rollover, estimated_hours, title}]
    llm_plan: dict           # {greeting, focus_hint, plan_items}
    plan_id: str


# ── Nodes ─────────────────────────────────────────────────────────────────────

def load_user_context(state: PlannerState) -> dict:
    active_paths = tools.get_active_paths(state["user_id"])
    return {
        "active_paths": active_paths,
        "hours_budget": 3.0,   # default; Phase 5 will pull from user preferences
    }


def check_yesterday(state: PlannerState) -> dict:
    missed_count = tools.mark_missed(state["user_id"], state["yesterday"])

    # Collect task IDs that were missed → used for is_rollover flag today
    from app.db.supabase import get_supabase
    sb = get_supabase()
    plan_res = (
        sb.table("daily_plans")
        .select("id")
        .eq("user_id", state["user_id"])
        .eq("date", state["yesterday"])
        .execute()
    )
    missed_task_ids: list[str] = []
    if plan_res.data:
        plan_id = plan_res.data[0]["id"]
        items = (
            sb.table("daily_plan_items")
            .select("task_id")
            .eq("plan_id", plan_id)
            .eq("status", "missed")
            .execute()
        )
        missed_task_ids = [r["task_id"] for r in (items.data or [])]

    return {"missed_task_ids": missed_task_ids}


def calculate_path_pace(state: PlannerState) -> dict:
    path_paces: dict = {}
    annotated_paths = []

    for path in state["active_paths"]:
        total, completed = tools.get_path_task_counts(path["id"])
        pace = tools.calculate_pace(path, completed, total)
        path_paces[path["id"]] = pace
        annotated_paths.append({**path, "_pace_status": pace["status"]})

    return {"path_paces": path_paces, "active_paths": annotated_paths}


def score_and_select_tasks(state: PlannerState) -> dict:
    """
    Fairness rule: guarantee at least 1 task per active path,
    then fill remaining budget sorted by score DESC.
    """
    hours_budget = state["hours_budget"]
    missed_ids = set(state["missed_task_ids"])

    # Build candidate pool: score each task per path
    guaranteed: list[dict] = []   # one top-scorer per path
    extras: list[dict] = []       # everything else

    for path in state["active_paths"]:
        pace = state["path_paces"].get(path["id"], {})
        days_behind = pace.get("days_behind", 0)

        candidates = tools.get_next_tasks(path["id"], limit=5)
        if not candidates:
            continue

        scored = sorted(
            [
                {
                    **task,
                    "_score": tools.score_task(task, path, days_behind),
                    "_path_title": path["title"],
                    "is_rollover": task["id"] in missed_ids,
                    "path_id": path["id"],
                    "task_id": task["id"],
                }
                for task in candidates
            ],
            key=lambda t: t["_score"],
            reverse=True,
        )

        guaranteed.append(scored[0])
        extras.extend(scored[1:])

    # Fill budget: start with guaranteed slots
    selected: list[dict] = []
    hours_used = 0.0
    guaranteed_ids = {t["task_id"] for t in guaranteed}

    for task in guaranteed:
        selected.append(task)
        hours_used += task.get("estimated_hours", 1.0)

    # Top up with extras sorted by score, skip tasks already guaranteed
    extras_sorted = sorted(
        [t for t in extras if t["task_id"] not in guaranteed_ids],
        key=lambda t: t["_score"],
        reverse=True,
    )
    for task in extras_sorted:
        if hours_used >= hours_budget:
            break
        selected.append(task)
        hours_used += task.get("estimated_hours", 1.0)

    return {"selected_items": selected}


def generate_plan_with_llm(state: PlannerState) -> dict:
    paths_summary = "\n".join(
        f"  P{p['priority']} — {p['title']} ({state['path_paces'].get(p['id'], {}).get('status', 'unknown')})"
        for p in state["active_paths"]
    )
    tasks_json = json.dumps(
        [
            {
                "task_id": t["task_id"],
                "title": t["title"],
                "path_title": t["_path_title"],
                "estimated_hours": t.get("estimated_hours", 1.0),
                "rollover_count": t.get("rollover_count", 0),
                "is_rollover": t.get("is_rollover", False),
                "score": t.get("_score", 0),
            }
            for t in state["selected_items"]
        ],
        indent=2,
    )

    prompt = DAILY_PLAN_PROMPT.format(
        paths_summary=paths_summary,
        tasks_json=tasks_json,
        hours_budget=state["hours_budget"],
    )
    llm_plan = tools.call_groq(prompt)
    return {"llm_plan": llm_plan}


def save_daily_plan(state: PlannerState) -> dict:
    plan_id = tools.save_plan(
        user_id=state["user_id"],
        plan_date=state["plan_date"],
        items=state["selected_items"],
        hours_budget=state["hours_budget"],
    )
    return {"plan_id": plan_id}


def send_push_notification(state: PlannerState) -> dict:
    greeting = state["llm_plan"].get("greeting", "Your daily learning plan is ready!")
    tools.send_notification(
        user_id=state["user_id"],
        title="Today's Learning Plan",
        body=greeting,
    )
    return {}


# ── Graph ─────────────────────────────────────────────────────────────────────

_workflow = StateGraph(PlannerState)

_workflow.add_node("load_user_context",      load_user_context)
_workflow.add_node("check_yesterday",        check_yesterday)
_workflow.add_node("calculate_path_pace",    calculate_path_pace)
_workflow.add_node("score_and_select_tasks", score_and_select_tasks)
_workflow.add_node("generate_plan_with_llm", generate_plan_with_llm)
_workflow.add_node("save_daily_plan",        save_daily_plan)
_workflow.add_node("send_push_notification", send_push_notification)

_workflow.add_edge(START,                      "load_user_context")
_workflow.add_edge("load_user_context",        "check_yesterday")
_workflow.add_edge("check_yesterday",          "calculate_path_pace")
_workflow.add_edge("calculate_path_pace",      "score_and_select_tasks")
_workflow.add_edge("score_and_select_tasks",   "generate_plan_with_llm")
_workflow.add_edge("generate_plan_with_llm",   "save_daily_plan")
_workflow.add_edge("save_daily_plan",          "send_push_notification")
_workflow.add_edge("send_push_notification",   END)

graph = _workflow.compile()


# ── Public entry point ────────────────────────────────────────────────────────

def run_planner(user_id: str, plan_date: str | None = None) -> dict:
    """Synchronously run the full planner graph for one user."""
    today = plan_date or date.today().isoformat()
    yesterday = (date.fromisoformat(today) - timedelta(days=1)).isoformat()

    initial: PlannerState = {
        "user_id": user_id,
        "plan_date": today,
        "yesterday": yesterday,
        "hours_budget": 3.0,
        "active_paths": [],
        "missed_task_ids": [],
        "path_paces": {},
        "selected_items": [],
        "llm_plan": {},
        "plan_id": "",
    }
    return graph.invoke(initial)
