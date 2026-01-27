from app.services.llm import client, SYSTEM_PROMPT
from app.core.db import db
from datetime import datetime, timezone
import json

async def generate_feedback(interview_id: str):
    # 1. Fetch Interview Data
    interview = await db.interview.find_unique(
        where={"id": interview_id},
        include={"questions": True}
    )
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
        
        result = json.loads(completion.choices[0].message.content)
        
        # 4. Save to DB
        try:
            await db.feedback.create(
                data={
                    "interviewId": interview.id,
                    "rating": result.get("rating", 0),
                    "englishScore": result.get("englishScore", 0),
                    "technicalScore": result.get("technicalScore", 0),
                    "communicationScore": result.get("communicationScore", 0),
                    "feedbackText": result.get("feedbackText", "No feedback generated.")
                }
            )
        except Exception as e:
            # Check for various prisma unique constraint error forms if "Unique constraint" string check isn't enough
            # But generally it's enough. If 'ws' loop error printed 'Skipping feedback... No data', that's different.
            # But for 'Unique constraint', we return.
            if "Unique constraint" in str(e) or "P2002" in str(e):
                 print(f"Feedback already exists for {interview_id}. Skipping.")
                 return
            print(f"Feedback creation error: {e}")
            # Dont raise, just fail gracefully
            pass
        
        # Update status
        await db.interview.update(
            where={"id": interview.id},
            data={"status": "COMPLETED", "endTime": datetime.now(timezone.utc)}
        )
        
        print(f"Feedback generated for {interview_id}")

    except Exception as e:
        print(f"Feedback generation error: {e}")
        # Only mark as FAILED if it wasn't already marked COMPLETED by successful finish
        # Actually, if feedback fails, it's better to leave it as COMPLETED (but missing feedback) 
        # than FAILED so the user can see the transcript.
        # We can also check if transcript was empty.
        
        # Optionally, create a dummy feedback record saying "Analysis Failed"
        try:
             await db.feedback.create(
                data={
                    "interviewId": interview.id,
                    "rating": 0,
                    "feedbackText": "Automated analysis failed or insufficient data. Please review the transcript manually."
                }
            )
        except:
             pass
