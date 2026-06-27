"""
LangGraph weekly review graph.

Graph: gather_week_stats → calculate_path_paces → generate_review_llm
       → save_review → send_review_notification → END

Run via:
    from app.agent.weekly_review import run_weekly_review
    run_weekly_review(user_id="...", week_start="2026-06-21", week_end="2026-06-27")
"""

import json
from datetime import date, timedelta
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from app.agent import tools
from app.agent.prompts import WEEKLY_REVIEW_PROMPT


# ── State ─────────────────────────────────────────────────────────────────────

class WeeklyReviewState(TypedDict):
    user_id:      str
    week_start:   str
    week_end:     str
    active_paths: list     # learning_paths rows
    week_stats:   dict     # {paths: {path_id: {completed, missed, minutes}}, overall: {...}}
    path_paces:   dict     # path_id → {status, days_behind, completion_pct}
    llm_review:   dict     # full LLM JSON response
    review_id:    str


# ── Nodes ─────────────────────────────────────────────────────────────────────

def gather_week_stats(state: WeeklyReviewState) -> dict:
    paths = tools.get_active_paths(state["user_id"])
    stats = tools.get_week_stats(state["user_id"], state["week_start"], state["week_end"])
    return {"active_paths": paths, "week_stats": stats}


def calculate_path_paces(state: WeeklyReviewState) -> dict:
    path_paces: dict = {}
    for path in state["active_paths"]:
        total, completed = tools.get_path_task_counts(path["id"])
        path_paces[path["id"]] = tools.calculate_pace(path, completed, total)
    return {"path_paces": path_paces}


def generate_review_llm(state: WeeklyReviewState) -> dict:
    valid_path_ids = {p["id"] for p in state["active_paths"]}

    paths_context = "\n".join(
        f"  {p['id']} | {p['title']} | P{p['priority']}"
        for p in state["active_paths"]
    )

    path_stats = state["week_stats"].get("paths", {})
    stats_context = "\n".join(
        f"  {p['title']}: {path_stats.get(p['id'], {}).get('completed', 0)} done"
        f" | {path_stats.get(p['id'], {}).get('missed', 0)} missed"
        f" | {path_stats.get(p['id'], {}).get('minutes', 0)} min"
        for p in state["active_paths"]
    )

    pace_context = "\n".join(
        f"  {p['title']}: {state['path_paces'].get(p['id'], {}).get('status', 'unknown')}"
        f" | {state['path_paces'].get(p['id'], {}).get('completion_pct', 0)}%"
        for p in state["active_paths"]
    )

    overall = state["week_stats"].get("overall", {})
    prompt = WEEKLY_REVIEW_PROMPT.format(
        paths_context=paths_context,
        stats_context=stats_context,
        pace_context=pace_context,
        week_start=state["week_start"],
        week_end=state["week_end"],
        days_active=overall.get("days_active", 0),
        total_minutes=overall.get("total_minutes", 0),
    )

    llm_review = tools.call_groq(prompt)

    # Validate path_ids in recommendations — drop any the LLM hallucinated
    recs = llm_review.get("recommendations", [])
    llm_review["recommendations"] = [r for r in recs if r.get("path_id") in valid_path_ids]

    return {"llm_review": llm_review}


def save_review(state: WeeklyReviewState) -> dict:
    review_id = tools.save_weekly_review(
        state["user_id"], state["week_start"], state["week_end"], state["llm_review"]
    )
    return {"review_id": review_id}


def send_review_notification(state: WeeklyReviewState) -> dict:
    body = state["llm_review"].get("encouragement", "Your weekly review is ready!")
    tools.send_notification(state["user_id"], "Weekly Review 📊", body)
    return {}


# ── Graph ─────────────────────────────────────────────────────────────────────

_workflow = StateGraph(WeeklyReviewState)

_workflow.add_node("gather_week_stats",        gather_week_stats)
_workflow.add_node("calculate_path_paces",     calculate_path_paces)
_workflow.add_node("generate_review_llm",      generate_review_llm)
_workflow.add_node("save_review",              save_review)
_workflow.add_node("send_review_notification", send_review_notification)

_workflow.add_edge(START,                        "gather_week_stats")
_workflow.add_edge("gather_week_stats",          "calculate_path_paces")
_workflow.add_edge("calculate_path_paces",       "generate_review_llm")
_workflow.add_edge("generate_review_llm",        "save_review")
_workflow.add_edge("save_review",                "send_review_notification")
_workflow.add_edge("send_review_notification",   END)

graph = _workflow.compile()


# ── Public entry point ────────────────────────────────────────────────────────

def run_weekly_review(user_id: str, week_start: str | None = None, week_end: str | None = None) -> dict:
    """Synchronously run the weekly review graph for one user."""
    today      = date.today()
    week_end   = week_end   or today.isoformat()
    week_start = week_start or (today - timedelta(days=6)).isoformat()

    initial: WeeklyReviewState = {
        "user_id":      user_id,
        "week_start":   week_start,
        "week_end":     week_end,
        "active_paths": [],
        "week_stats":   {},
        "path_paces":   {},
        "llm_review":   {},
        "review_id":    "",
    }
    return graph.invoke(initial)
