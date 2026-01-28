from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, Float, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from cuid2 import cuid_wrapper

# Generate a CUID generator function
generate_cuid = cuid_wrapper()

class User(Base):
    __tablename__ = "User"
    
    id = Column(String, primary_key=True, default=generate_cuid)
    name = Column(String, nullable=True)
    email = Column(String, unique=True, nullable=True)
    emailVerified = Column(DateTime(timezone=True), nullable=True)
    image = Column(String, nullable=True)
    createdAt = Column(DateTime(timezone=True), server_default=func.now())
    updatedAt = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    accounts = relationship("Account", back_populates="user", cascade="all, delete-orphan")
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    interviews = relationship("Interview", back_populates="user")

class Account(Base):
    __tablename__ = "Account"
    
    id = Column(String, primary_key=True, default=generate_cuid)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False)
    type = Column(String, nullable=False)
    provider = Column(String, nullable=False)
    providerAccountId = Column(String, nullable=False)
    refresh_token = Column(Text, nullable=True)
    access_token = Column(Text, nullable=True)
    expires_at = Column(Integer, nullable=True)
    token_type = Column(String, nullable=True)
    scope = Column(String, nullable=True)
    id_token = Column(Text, nullable=True)
    session_state = Column(String, nullable=True)

    user = relationship("User", back_populates="accounts")

class Session(Base):
    __tablename__ = "Session"
    
    id = Column(String, primary_key=True, default=generate_cuid)
    sessionToken = Column(String, unique=True, nullable=False)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False)
    expires = Column(DateTime(timezone=True), nullable=False)
    user = relationship("User", back_populates="sessions")

class VerificationToken(Base):
    __tablename__ = "VerificationToken"
    
    # Prisma defines @@unique([identifier, token]) and token @unique.
    # We will use token as PK since it is unique.
    token = Column(String, primary_key=True, unique=True)
    identifier = Column(String, nullable=False)
    expires = Column(DateTime(timezone=True), nullable=False)

class Interview(Base):
    __tablename__ = "Interview"
    
    id = Column(String, primary_key=True, default=generate_cuid)
    userId = Column(String, ForeignKey("User.id"), nullable=False)
    topic = Column(String, nullable=False)
    duration = Column(Integer, nullable=False)
    difficulty = Column(String, nullable=False)
    seniority = Column(String, nullable=True)
    concept = Column(String, nullable=True)
    silenceTime = Column(Float, default=3.0)
    status = Column(String, default="CREATED")
    startTime = Column(DateTime(timezone=True), nullable=True)
    endTime = Column(DateTime(timezone=True), nullable=True)
    createdAt = Column(DateTime(timezone=True), server_default=func.now())
    updatedAt = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    user = relationship("User", back_populates="interviews")
    questions = relationship("Question", back_populates="interview", cascade="all, delete-orphan")
    feedback = relationship("Feedback", uselist=False, back_populates="interview", cascade="all, delete-orphan")

class Question(Base):
    __tablename__ = "Question"
    
    id = Column(String, primary_key=True, default=generate_cuid)
    interviewId = Column(String, ForeignKey("Interview.id", ondelete="CASCADE"), nullable=False)
    question = Column(String, nullable=False)
    userAnswer = Column(String, nullable=True)
    createdAt = Column(DateTime(timezone=True), server_default=func.now())

    interview = relationship("Interview", back_populates="questions")

class Feedback(Base):
    __tablename__ = "Feedback"
    
    id = Column(String, primary_key=True, default=generate_cuid)
    interviewId = Column(String, ForeignKey("Interview.id", ondelete="CASCADE"), unique=True, nullable=False)
    rating = Column(Integer, nullable=False)
    englishScore = Column(Integer, nullable=True)
    technicalScore = Column(Integer, nullable=True)
    communicationScore = Column(Integer, nullable=True)
    feedbackText = Column(String, nullable=False)
    createdAt = Column(DateTime(timezone=True), server_default=func.now())

    interview = relationship("Interview", back_populates="feedback")
