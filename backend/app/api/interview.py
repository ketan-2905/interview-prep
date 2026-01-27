from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.core.db import db
from datetime import datetime, timezone

router = APIRouter()

class InterviewCreateRequest(BaseModel):
    topic: str
    duration: int
    difficulty: str
    seniority: str
    concept: Optional[str] = None
    silence_time: Optional[float] = 3.0
    userId: str 

@router.post("")
async def create_interview(req: InterviewCreateRequest):
    if req.duration not in [5, 10, 15]:
        raise HTTPException(status_code=400, detail="Duration must be 5, 10, or 15 minutes")

    item = await db.interview.create(
        data={
            "topic": req.topic,
            "duration": req.duration,
            "difficulty": req.difficulty,
            "seniority": req.seniority,
            "concept": req.concept,
            "silenceTime": req.silence_time,
            "userId": req.userId,
            "status": "CREATED"
        }
    )
    return item

@router.get("")
async def list_interviews(userId: str):
    items = await db.interview.find_many(
        where={"userId": userId},
        order={"createdAt": "desc"},
        include={"feedback": True}
    )
    return items

@router.get("/{interview_id}")
async def get_interview(interview_id: str):
    item = await db.interview.find_unique(
        where={"id": interview_id},
        include={"user": True, "feedback": True, "questions": True}
    )
    if not item:
        raise HTTPException(status_code=404, detail="Interview not found")
    return item
@router.post("/{interview_id}/finish")
async def finish_interview(interview_id: str):
    interview = await db.interview.find_unique(where={"id": interview_id})
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    # Mark completed
    await db.interview.update(
        where={"id": interview_id},
        data={"status": "COMPLETED", "endTime": datetime.now(timezone.utc)}
    )
    
    # Trigger AI Feedback in background
    from app.services.feedback import generate_feedback
    import asyncio
    asyncio.create_task(generate_feedback(interview_id))

    return {"message": "Interview marked completed"}
