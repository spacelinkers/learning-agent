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

CONTENT_ANALYSIS_PROMPT = """
You are an expert learning assistant and software engineer. Deeply analyze the following content and produce a rich structured learning guide.

Title: {title}

Content:
{content}

Return ONLY valid JSON — no markdown, no explanation, no code fences.

Rules:
- takeaways: Each point must be a DETAILED teaching note (3-5 sentences of explanation) with a working code snippet that demonstrates the concept. Do not write one-liners — teach like a senior engineer explaining to a junior.
- next_reads: Recommend REAL, specific books with real authors, and REAL blog posts/articles from known sources (official docs, martinfowler.com, realpython.com, css-tricks.com, engineering blogs, etc.). Include the actual URL when you know it. Mix books, articles, and blog posts.

{{
  "takeaways": [
    {{
      "title": "Short concept title (5-8 words)",
      "explanation": "3-5 sentences explaining WHY this matters, HOW it works, and WHEN to use it. Write for a developer who needs to understand deeply, not just recognize the term.",
      "code": "# Working code snippet demonstrating the concept\\n# Include comments explaining key lines\\nexample = 'code here'",
      "language": "python"
    }},
    {{
      "title": "...",
      "explanation": "...",
      "code": "...",
      "language": "python"
    }},
    {{
      "title": "...",
      "explanation": "...",
      "code": "...",
      "language": "python"
    }},
    {{
      "title": "...",
      "explanation": "...",
      "code": "...",
      "language": "python"
    }},
    {{
      "title": "...",
      "explanation": "...",
      "code": "...",
      "language": "python"
    }}
  ],
  "code": {{
    "simple": {{
      "title": "Basic example title",
      "language": "python",
      "code": "# short working code snippet",
      "explanation": "What this demonstrates in one sentence"
    }},
    "intermediate": {{
      "title": "...",
      "language": "python",
      "code": "# realistic multi-step example",
      "explanation": "..."
    }},
    "production": {{
      "title": "...",
      "language": "python",
      "code": "# production-quality pattern with error handling",
      "explanation": "..."
    }}
  }},
  "projects": [
    {{
      "title": "Project name",
      "description": "What to build and the core learning outcome",
      "tech_stack": ["tech1", "tech2"],
      "difficulty": "easy"
    }},
    {{"title": "...", "description": "...", "tech_stack": ["..."], "difficulty": "medium"}},
    {{"title": "...", "description": "...", "tech_stack": ["..."], "difficulty": "medium"}},
    {{"title": "...", "description": "...", "tech_stack": ["..."], "difficulty": "hard"}}
  ],
  "next_reads": [
    {{
      "title": "Real book title",
      "author": "Real Author Name",
      "type": "book",
      "source": "",
      "reason": "Specific reason this book deepens understanding of the topic",
      "url": "https://amazon.com/... or official site if known"
    }},
    {{
      "title": "Real book title",
      "author": "Real Author Name",
      "type": "book",
      "source": "",
      "reason": "...",
      "url": ""
    }},
    {{
      "title": "Real article or blog post title",
      "author": "Author name if known",
      "type": "article",
      "source": "e.g. martinfowler.com / Real Python / official docs",
      "reason": "Why this article is essential reading",
      "url": "https://real-url-if-known.com/article"
    }},
    {{
      "title": "Real blog post title",
      "author": "...",
      "type": "blog",
      "source": "Blog name",
      "reason": "...",
      "url": "https://..."
    }},
    {{
      "title": "...",
      "author": "...",
      "type": "article",
      "source": "...",
      "reason": "...",
      "url": ""
    }}
  ],
  "difficulty": "easy",
  "reading_time_minutes": 20,
  "prerequisites": ["prerequisite1", "prerequisite2"],
  "interview_questions": {{
    "junior": [
      {{"q": "Question?", "a": "Concise answer."}},
      {{"q": "Question?", "a": "Concise answer."}},
      {{"q": "Question?", "a": "Concise answer."}}
    ],
    "mid": [
      {{"q": "Question?", "a": "Concise answer."}},
      {{"q": "Question?", "a": "Concise answer."}},
      {{"q": "Question?", "a": "Concise answer."}}
    ],
    "senior": [
      {{"q": "Question?", "a": "Concise answer."}},
      {{"q": "Question?", "a": "Concise answer."}},
      {{"q": "Question?", "a": "Concise answer."}}
    ]
  }},
  "flashcards": [
    {{"q": "What is X?", "a": "X is ..."}},
    {{"q": "...", "a": "..."}},
    {{"q": "...", "a": "..."}},
    {{"q": "...", "a": "..."}},
    {{"q": "...", "a": "..."}},
    {{"q": "...", "a": "..."}},
    {{"q": "...", "a": "..."}},
    {{"q": "...", "a": "..."}},
    {{"q": "...", "a": "..."}},
    {{"q": "...", "a": "..."}}
  ],
  "quiz": [
    {{
      "question": "Question text?",
      "options": ["A. option", "B. option", "C. option", "D. option"],
      "correct": 0,
      "explanation": "Brief reason why A is correct."
    }},
    {{"question": "...", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "correct": 1, "explanation": "..."}},
    {{"question": "...", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "correct": 2, "explanation": "..."}},
    {{"question": "...", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "correct": 0, "explanation": "..."}},
    {{"question": "...", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "correct": 3, "explanation": "..."}},
    {{"question": "...", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "correct": 1, "explanation": "..."}},
    {{"question": "...", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "correct": 0, "explanation": "..."}},
    {{"question": "...", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "correct": 2, "explanation": "..."}},
    {{"question": "...", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "correct": 1, "explanation": "..."}},
    {{"question": "...", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "correct": 3, "explanation": "..."}}
  ]
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
