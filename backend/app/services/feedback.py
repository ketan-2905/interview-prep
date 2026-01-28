from app.services.llm import client
from app.core.database import AsyncSessionLocal
from app.models import Interview, Feedback
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timezone
import json

async def generate_feedback(interview_id: str):
    async with AsyncSessionLocal() as db:
        # 1. Fetch Interview Data
        result = await db.execute(
            select(Interview)
            .where(Interview.id == interview_id)
            .options(selectinload(Interview.questions))
        )
        interview = result.scalars().first()
        
        if not interview or not interview.questions:
            print(f"Skipping feedback for {interview_id}: No data.")
            return

        # 2. Build Transcript
        transcript = f"Interview Topic: {interview.topic}\n"
        transcript += f"Difficulty: {interview.difficulty}\n"
        transcript += f"Seniority: {interview.seniority}\n"
        if interview.concept:
            transcript += f"Specific Concept: {interview.concept}\n"
        
        transcript += "\n--- TRANSCRIPT ---\n"
        for q in interview.questions:
            transcript += f"AI: {q.question}\n"
            transcript += f"Candidate: {q.userAnswer or '(No Answer)'}\n\n"

        # 3. Prompt LLM
        FEEDBACK_PROMPT = """
        You are an expert technical interviewer. Analyze the following interview transcript.
        Provide a structured evaluation in JSON format with the following keys:
        - rating: Overall score (1-10)
        - englishScore: Rating of English proficiency, grammar, and fluency (1-10)
        - technicalScore: Rating of technical correctness and depth (1-10)
        - communicationScore: Rating of clarity and articulation (1-10)
        - feedbackText: A detailed summary of strengths, weaknesses, and areas for improvement.

        Return ONLY the valid JSON object.
        """

        try:
            completion = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": FEEDBACK_PROMPT},
                    {"role": "user", "content": transcript}
                ],
                temperature=0.3,
                response_format={"type": "json_object"}
            )
            
            result_json = json.loads(completion.choices[0].message.content)
            
            # 4. Save to DB
            try:
                new_feedback = Feedback(
                    interviewId=interview.id,
                    rating=result_json.get("rating", 0),
                    englishScore=result_json.get("englishScore", 0),
                    technicalScore=result_json.get("technicalScore", 0),
                    communicationScore=result_json.get("communicationScore", 0),
                    feedbackText=result_json.get("feedbackText", "No feedback generated.")
                )
                db.add(new_feedback)
                await db.commit()
            except IntegrityError:
                await db.rollback()
                print(f"Feedback already exists for {interview_id}. Skipping.")
                return
            except Exception as e:
                await db.rollback()
                print(f"Feedback creation error: {e}")
                # Dont raise, just fail gracefully
                pass
            
            # Update status
            # Reload interview to be safe or just use object if attached
            interview.status = "COMPLETED"
            interview.endTime = datetime.now(timezone.utc)
            db.add(interview) # Merges if detached but here it is persistent
            await db.commit()
            
            print(f"Feedback generated for {interview_id}")

        except Exception as e:
            print(f"Feedback generation error: {e}")
            # Optionally, create a dummy feedback record saying "Analysis Failed"
            try:
                # We need a new transaction or rollback previous if failed
                 await db.rollback()
                 new_feedback = Feedback(
                    interviewId=interview.id,
                    rating=0,
                    feedbackText="Automated analysis failed or insufficient data. Please review the transcript manually."
                )
                 db.add(new_feedback)
                 await db.commit()
            except:
                 pass
