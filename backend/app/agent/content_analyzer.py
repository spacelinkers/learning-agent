"""
Content Analyzer — LangGraph agent.
Fetches URL or reads PDF text, analyzes with Groq, saves to DB.
All nodes are sync; called via asyncio.to_thread from ingest.py.
"""

from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from app.agent.prompts import CONTENT_ANALYSIS_PROMPT
from app.agent.tools import call_groq, save_content_analysis, update_source_status


class ContentAnalyzerState(TypedDict):
    source_id: str
    user_id: str
    content_type: str   # 'url' | 'pdf'
    raw_url: str | None
    raw_text: str
    truncated_text: str
    title: str
    analysis: dict


def fetch_content(state: ContentAnalyzerState) -> dict:
    if state["content_type"] != "url":
        return {}  # PDF text already in raw_text

    import httpx
    from bs4 import BeautifulSoup

    url = state["raw_url"] or ""
    try:
        resp = httpx.get(
            url,
            follow_redirects=True,
            timeout=15,
            headers={"User-Agent": "Mozilla/5.0 (learning-agent/1.0)"},
        )
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
            tag.decompose()
        text = soup.get_text(separator="\n", strip=True)
        title_tag = soup.find("title")
        title = title_tag.get_text(strip=True) if title_tag else url
    except Exception:
        text = ""
        title = url
    return {"raw_text": text, "title": title}


def truncate_content(state: ContentAnalyzerState) -> dict:
    text = state.get("raw_text", "")
    if len(text) > 20_000:
        text = text[:20_000] + "\n\n[...content truncated...]"
    return {"truncated_text": text}


def analyze_with_llm(state: ContentAnalyzerState) -> dict:
    prompt = CONTENT_ANALYSIS_PROMPT.format(
        title=state.get("title") or "Unknown",
        content=state["truncated_text"],
    )
    analysis = call_groq(prompt)
    return {"analysis": analysis}


def save_analysis(state: ContentAnalyzerState) -> dict:
    analysis = state["analysis"]
    title = state.get("title") or analysis.get("title") or "Untitled"
    update_source_status(
        state["source_id"],
        status="done",
        title=title,
        difficulty=analysis.get("difficulty"),
        reading_time=analysis.get("reading_time_minutes"),
        prerequisites=analysis.get("prerequisites", []),
    )
    save_content_analysis(state["source_id"], state["user_id"], analysis)
    return {}


def _build_graph():
    g = StateGraph(ContentAnalyzerState)
    g.add_node("fetch_content", fetch_content)
    g.add_node("truncate_content", truncate_content)
    g.add_node("analyze_with_llm", analyze_with_llm)
    g.add_node("save_analysis", save_analysis)
    g.add_edge(START, "fetch_content")
    g.add_edge("fetch_content", "truncate_content")
    g.add_edge("truncate_content", "analyze_with_llm")
    g.add_edge("analyze_with_llm", "save_analysis")
    g.add_edge("save_analysis", END)
    return g.compile()


_graph = _build_graph()


def run_content_analyzer(
    source_id: str,
    user_id: str,
    content_type: str,
    raw_url: str | None = None,
    raw_text: str = "",
    title: str = "",
) -> None:
    try:
        _graph.invoke({
            "source_id": source_id,
            "user_id": user_id,
            "content_type": content_type,
            "raw_url": raw_url,
            "raw_text": raw_text,
            "truncated_text": "",
            "title": title,
            "analysis": {},
        })
    except Exception as e:
        update_source_status(source_id, status="failed", error_msg=str(e))
