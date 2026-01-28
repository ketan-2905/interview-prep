from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, Base
from app.api import ws, interview



@asynccontextmanager
async def lifespan(app: FastAPI):
    # Optional: Ensure tables exist (helpful if running on a fresh DB, 
    # but user says schema is present). 
    # We can leave this uncommented or commented depending on preference.
    # async with engine.begin() as conn:
    #     await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()

app = FastAPI(title="Interview AI Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ws.router)
app.include_router(interview.router, prefix="/api/interview", tags=["interview"])

@app.get("/")
def root():
    return {"message": "Interview AI Backend Running"}
