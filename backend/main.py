from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.agent.scheduler import scheduler
from app.routers import ingest, log, paths, plan, review, schedule, user


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(title="Learning Agent API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(schedule.router)
app.include_router(paths.router)
app.include_router(plan.router)
app.include_router(log.router)
app.include_router(user.router)
app.include_router(review.router)
app.include_router(ingest.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
