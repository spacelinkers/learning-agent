# Learning Agent — Project Root

## Vision
Mobile-first AI agent that tracks multiple learning paths, generates daily focus plans, handles rollovers, and accepts learning schedules imported from pasted chat conversations.

## Stack
| Layer | Tool | Notes |
|---|---|---|
| Mobile | Expo + React Native | Android primary |
| Backend | FastAPI | Deployed on Render (free) |
| Database | Supabase (PostgreSQL) | Free tier |
| LLM | Groq API (LLaMA 3.3 70B) | Free tier |
| Agent | LangGraph | Server-side only |
| Auth | Supabase Auth | JWT tokens |
| Push | Expo Push Notifications | Free |

## Project Structure
```
learning-agent/
├── CLAUDE.md               ← this file
├── backend/
│   ├── CLAUDE.md
│   ├── main.py
│   ├── requirements.txt
│   └── app/
│       ├── routers/
│       ├── agent/
│       ├── models/
│       └── db/
├── mobile/
│   ├── CLAUDE.md
│   └── (Expo project)
└── agent/
    └── CLAUDE.md
```

## Environment Variables (all services)
```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
GROQ_API_KEY=
EXPO_ACCESS_TOKEN=
```

## Build Phases
- Phase 1: Supabase schema + seed data
- Phase 2: FastAPI — /parse and /schedule endpoints
- Phase 3: LangGraph daily planner agent
- Phase 4: Expo mobile app (Today, Paths, Import, Log screens)
- Phase 5: Push notifications + rollover logic
- Phase 6: Weekly review agent

## Key Rules
- Never hardcode API keys
- All agent logic runs server-side only
- Mobile only calls FastAPI — never Groq/Supabase directly
- Use async/await throughout FastAPI
- Supabase RLS enabled on all tables
