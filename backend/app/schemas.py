from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

class FeedbackRead(BaseModel):
    id: str
    rating: int
    englishScore: Optional[int] = None
    technicalScore: Optional[int] = None
    communicationScore: Optional[int] = None
    feedbackText: str
    createdAt: datetime
    model_config = ConfigDict(from_attributes=True)

class QuestionRead(BaseModel):
    id: str
    question: str
    userAnswer: Optional[str] = None
    createdAt: datetime
    model_config = ConfigDict(from_attributes=True)

class UserRead(BaseModel):
    id: str
    name: Optional[str] = None
    email: Optional[str] = None
    image: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class InterviewRead(BaseModel):
    id: str
    userId: str
    topic: str
    duration: int
    difficulty: str
    seniority: Optional[str] = None
    concept: Optional[str] = None
    silenceTime: float
    status: str
    startTime: Optional[datetime] = None
    endTime: Optional[datetime] = None
    createdAt: datetime
    updatedAt: datetime
    feedback: Optional[FeedbackRead] = None
    model_config = ConfigDict(from_attributes=True)

class InterviewFullRead(InterviewRead):
    questions: List[QuestionRead] = []
    user: Optional[UserRead] = None
