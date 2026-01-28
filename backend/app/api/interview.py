from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone

from app.core.database import get_db
from app.models import Interview
from app.schemas import InterviewRead, InterviewFullRead
from app.services.feedback import generate_feedback
import asyncio

router = APIRouter()

class InterviewCreateRequest(BaseModel):
    topic: str
    duration: int
    difficulty: str
    seniority: str
    concept: Optional[str] = None
    silence_time: Optional[float] = 3.0
    userId: str 

@router.post("", response_model=InterviewRead)
async def create_interview(req: InterviewCreateRequest, db: AsyncSession = Depends(get_db)):
    if req.duration not in [5, 10, 15]:
        raise HTTPException(status_code=400, detail="Duration must be 5, 10, or 15 minutes")

    new_interview = Interview(
        topic=req.topic,
        duration=req.duration,
        difficulty=req.difficulty,
        seniority=req.seniority,
        concept=req.concept,
        silenceTime=req.silence_time,
        userId=req.userId,
        status="CREATED"
    )
    db.add(new_interview)
    await db.commit()
    # Pydantic serialization will try to access 'feedback', which is lazy loaded.
    # In async SQLAlchemy, we must eager load it to avoid implicit IO errors.
    result = await db.execute(
        select(Interview)
        .where(Interview.id == new_interview.id)
        .options(selectinload(Interview.feedback))
    )
    fetched_interview = result.scalars().first()
    return fetched_interview

@router.get("", response_model=List[InterviewRead])
async def list_interviews(userId: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Interview)
        .where(Interview.userId == userId)
        .order_by(desc(Interview.createdAt))
        .options(selectinload(Interview.feedback))
    )
    items = result.scalars().all()
    return items

@router.get("/{interview_id}", response_model=InterviewFullRead)
async def get_interview(interview_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Interview)
        .where(Interview.id == interview_id)
        .options(
            selectinload(Interview.user),
            selectinload(Interview.feedback),
            selectinload(Interview.questions)
        )
    )
    item = result.scalars().first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Interview not found")
    return item

@router.post("/{interview_id}/finish")
async def finish_interview(interview_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Interview).where(Interview.id == interview_id))
    interview = result.scalars().first()

    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    # Mark completed
    interview.status = "COMPLETED"
    interview.endTime = datetime.now(timezone.utc)
    await db.commit()
    
    # Trigger AI Feedback in background
    # generate_feedback creates its own session, so we just pass the ID
    asyncio.create_task(generate_feedback(interview_id))

    return {"message": "Interview marked completed"}
