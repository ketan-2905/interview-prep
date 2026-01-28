from contextlib import asynccontextmanager
import os #New import
from pathlib import Path #New import
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.db import db
from app.api import ws, interview

BASE_DIR = Path(__file__).resolve().parent.parent
os.environ["PRISMA_PYTHON_ENGINE_BINARY"] = "1" #Added for render depolyment

@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.connect()
    yield
    await db.disconnect()

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
