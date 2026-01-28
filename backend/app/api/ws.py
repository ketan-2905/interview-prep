import os
import json
import time
import asyncio
import websockets
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from dotenv import load_dotenv
from datetime import datetime, timezone
from sqlalchemy import select, desc

from app.services.session import SESSIONS
from app.services.llm import ask_llm
from app.services.tts import stream_inworld_tts_to_client
from app.services.feedback import generate_feedback
from app.core.database import AsyncSessionLocal
from app.models import Interview, Question

load_dotenv()

router = APIRouter()

ASSEMBLYAI_URL = "wss://streaming.assemblyai.com/v3/ws"
ASSEMBLYAI_API_KEY = os.getenv("ASSEMBLYAI_API_KEY")

SAMPLE_RATE = 16000
MIN_READING_TIME = 2.5
MAX_READING_TIME = 8.0
READING_MS_PER_CHAR = 0.04
THINKING_DELAY = 1.0 # Reduced delay for snapier checks

@router.websocket("/ws/interview")
async def interview_ws(ws: WebSocket, interview_id: str):
    await ws.accept()
    
    # Check if interview exists and is actually playable
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Interview).where(Interview.id == interview_id))
        interview = result.scalars().first()
        
        if not interview:
            await ws.close(code=4004, reason="Interview not found")
            return
        
        if interview.status == "COMPLETED":
            await ws.close(code=4000, reason="Interview already completed")
            return

        # Update StartTime if first run
        if not interview.startTime:
            interview.startTime = datetime.now(timezone.utc)
            interview.status = "IN_PROGRESS"
            await db.commit()
            await db.refresh(interview)

        # Configs from interview object (need to capture values before session closes or use eager load)
        # Primitives are safe to keep after session close if object is detached, but better to copy vars.
        SILENCE_FINAL_SEC = interview.silenceTime or 3.0
        DURATION_SEC = (interview.duration or 15) * 60
        start_time_utc = interview.startTime.replace(tzinfo=timezone.utc) if interview.startTime.tzinfo else interview.startTime.replace(tzinfo=timezone.utc) # Helper if naive
        
        interview_topic = interview.topic
        interview_seniority = interview.seniority
        interview_difficulty = interview.difficulty
        interview_concept = interview.concept

    # Calculate initial elapsed time
    
    SYSTEM_PROMPT = f"""You are an AI technical interviewer conducting a {interview_seniority or 'Mid-Level'} interview about {interview_topic}.
    Difficulty: {interview_difficulty}.
    """
    if interview_concept:
        SYSTEM_PROMPT += f"\nFocus specifically on checking knowledge of: {interview_concept}."

    SYSTEM_PROMPT += """
    \nRules:
    - Ask exactly ONE question at a time.
    - Keep questions short.
    - Never teach, hint, explain, or correct.
    - Explore different concepts within the domain; do not stay on one topic.
    - You may ask at most ONE follow-up question based on the previous answer.
    - Do not ask multiple follow-ups on the same concept.
    - If the candidate struggles, switch to a simpler or adjacent concept without explanation.
    - Keep questions concise and neutral.
    """

    FIRST_QUESTION = f"Hello. I'm your AI interviewer. Let's start with a interview about {interview_topic}."
    
    if interview_concept:
        FIRST_QUESTION += f" We may touch on concepts related to {interview_concept}."
    FIRST_QUESTION += " Let’s begin. Please briefly introduce yourself."


    sid = interview_id
    SESSIONS[sid] = {
        "history": [{"role": "system", "content": SYSTEM_PROMPT}],
        "buffer": [],
        "last_voice_ts": None,
        "processing_ai": False,
        "ai_end_ts": None,
        "reading_time": 0,
        "tts_task": None,
    }

    # Check if we are resuming (questions exist per DB)
    async with AsyncSessionLocal() as db:
        q_count = await db.execute(select(Question).where(Question.interviewId == interview_id)) # This returns rows, count via len or func.count
        # Better:
        from sqlalchemy import func
        result = await db.execute(select(func.count(Question.id)).where(Question.interviewId == interview_id))
        questions_count = result.scalar()
        is_resuming = questions_count > 0

        if not is_resuming:
            new_q = Question(interviewId=interview_id, question=FIRST_QUESTION)
            db.add(new_q)
            await db.commit()
            SESSIONS[sid]["history"].append({"role": "assistant", "content": FIRST_QUESTION})
        else:
            # Load history context from DB if sophisticated (omitted for speed, assumes fresh session usually)
            pass

    async def run_tts_task(text, sid_local):
        try:
            await stream_inworld_tts_to_client(text, ws)
        except asyncio.CancelledError:
            try:
                await ws.send_json({"type": "audio_cancelled"})
            except: pass
            return
        except Exception as e:
            print("TTS error:", e)
        finally:
            if SESSIONS.get(sid_local):
                SESSIONS[sid_local]["tts_task"] = None

    async def process_ai():
        if SESSIONS[sid]["processing_ai"]: return
        SESSIONS[sid]["processing_ai"] = True

        elapsed = (datetime.now(timezone.utc) - start_time_utc).total_seconds()
        timeLeft = DURATION_SEC - elapsed
        
        # User Answer Processing
        user_text = " ".join(SESSIONS[sid]["buffer"]).strip()
        SESSIONS[sid]["buffer"] = []
        
        # Save User Answer to DB (Update last question)
        if user_text:
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(Question)
                    .where(Question.interviewId == interview_id)
                    .order_by(desc(Question.createdAt))
                    .limit(1)
                )
                last_q = result.scalars().first()
                if last_q:
                    last_q.userAnswer = user_text
                    await db.commit()
            
            SESSIONS[sid]["history"].append({"role": "user", "content": user_text})

        # --- TERMINATION LOGIC ---
        is_final = False
        reply = ""

        if timeLeft <= 10: # < 10s: Hard stop
             reply = "Our time is up. Thank you for your responses. I will now end the interview."
             is_final = True
        else:
            if not user_text and timeLeft > 0:
                SESSIONS[sid]["processing_ai"] = False
                return

            try:
                # 20s < Time < 40s: FORCE short question
                if 20 < timeLeft < 40:
                     SESSIONS[sid]["history"].append({"role": "system", "content": "You have less than 40 seconds remaining. Ask exactly one very short, simple question that can be answered in 20 seconds. Do not conclude yet."})
                
                # < 15s (but > 10s check above): Conclusion
                if timeLeft <= 15:
                     SESSIONS[sid]["history"].append({"role": "system", "content": "Time is almost up. Conclude the interview now with a closing statement."})
                     is_final = True

                reply = ask_llm(SESSIONS[sid]["history"])
            except Exception as e:
                print("LLM Error:", e)
                reply = "Could you repeat that?"

        SESSIONS[sid]["history"].append({"role": "assistant", "content": reply})

        # Save AI Question if NOT final (or even if final, to record the closing statement)
        async with AsyncSessionLocal() as db:
            db.add(Question(interviewId=interview_id, question=reply))
            if is_final:
                # Mark DB as completed NOW
                # We need to fetch interview again to attach or just update by ID logic (but sqlalchemy needs obj or explicit update)
                # Explicit update:
                from sqlalchemy import update
                await db.execute(
                    update(Interview)
                    .where(Interview.id == interview_id)
                    .values(status="COMPLETED", endTime=datetime.now(timezone.utc))
                )
            await db.commit()

        if is_final:
             # Trigger feedback generation immediately
             asyncio.create_task(generate_feedback(interview_id))

        rt = min(MAX_READING_TIME, max(MIN_READING_TIME, len(reply) * READING_MS_PER_CHAR))
        SESSIONS[sid]["reading_time"] = rt + 1.0
        SESSIONS[sid]["ai_end_ts"] = time.time()

        try:
            await ws.send_json({
                "type": "ai_response", 
                "text": reply, 
                "reading_time": SESSIONS[sid]["reading_time"],
                "is_final": is_final,
                "time_left": int(timeLeft)
            })
        except: pass
        
        SESSIONS[sid]["processing_ai"] = False

        # Play Audio
        await asyncio.sleep(0.5)
        t = asyncio.create_task(run_tts_task(reply, sid))
        SESSIONS[sid]["tts_task"] = t

    # If new session, greet
    if not is_resuming:
        try:
            await ws.send_json({"type": "ai_response", "text": FIRST_QUESTION, "reading_time": 4})
        except: pass
        initial_t = asyncio.create_task(run_tts_task(FIRST_QUESTION, sid))
        SESSIONS[sid]["tts_task"] = initial_t
        SESSIONS[sid]["ai_end_ts"] = time.time()
        SESSIONS[sid]["reading_time"] = 4


    # AssemblyAI Connection
    params = f"?sample_rate={SAMPLE_RATE}"
    headers = {"Authorization": ASSEMBLYAI_API_KEY or ""}

    try:
        async with websockets.connect(ASSEMBLYAI_URL + params, extra_headers=headers) as aai_ws:
            
            async def send_audio():
                try:
                    while True:
                        data = await ws.receive_bytes()
                        # Gate sending: Only if AI finished "reading/speaking" time
                        if time.time() - (SESSIONS[sid]["ai_end_ts"] or 0) > (SESSIONS[sid]["reading_time"] or 0):
                            await aai_ws.send(data)
                except WebSocketDisconnect: pass
                except Exception: pass

            async def recv_text():
                async for msg in aai_ws:
                    try:
                        d = json.loads(msg)
                        if d.get("type") == "Turn":
                            text = d.get("transcript", "").strip()
                            if text:
                                SESSIONS[sid]["last_voice_ts"] = time.time()
                                ttask = SESSIONS[sid].get("tts_task")
                                if ttask and not ttask.done():
                                    ttask.cancel()
                                    SESSIONS[sid]["tts_task"] = None
                                
                                try: await ws.send_json({"type": "stt_partial", "text": text})
                                except: pass
                                
                                if d.get("end_of_turn"):
                                    SESSIONS[sid]["buffer"].append(text)
                                    try: await ws.send_json({"type": "stt_final", "text": text})
                                    except: pass
                    except: continue

            async def watch_silence_and_time():
                while True:
                    await asyncio.sleep(0.5)
                    
                    # 1. Check Global Timeout
                    now_utc = datetime.now(timezone.utc)
                    elapsed_check = (now_utc - start_time_utc).total_seconds()
                    
                    # Force termination if time completely runs out (margin of 5s)
                    if elapsed_check >= DURATION_SEC + 5:
                         # Force close properly
                         async with AsyncSessionLocal() as db:
                             from sqlalchemy import update
                             await db.execute(
                                 update(Interview)
                                 .where(Interview.id == interview_id)
                                 .values(status="COMPLETED", endTime=now_utc)
                             )
                             await db.commit()
                         
                         asyncio.create_task(generate_feedback(interview_id))
                         try: await ws.send_json({"type": "ai_response", "text": "Time is up.", "is_final": True})
                         except: pass
                         await asyncio.sleep(2)
                         await ws.close()
                         break

                    # 2. Check Silence
                    last = SESSIONS[sid].get("last_voice_ts")
                    if last and (time.time() - last) > SILENCE_FINAL_SEC:
                        SESSIONS[sid]["last_voice_ts"] = None
                        await process_ai()

            await asyncio.gather(send_audio(), recv_text(), watch_silence_and_time())

    except Exception as e:
        print(f"WS Exception: {e}")
    finally:
        # 1. Flush Pending Buffer (Save user's last words if cut off)
        try:
            if sid in SESSIONS and SESSIONS[sid].get("buffer"):
                final_text = " ".join(SESSIONS[sid]["buffer"]).strip()
                if final_text:
                    async with AsyncSessionLocal() as db:
                        result = await db.execute(
                            select(Question)
                            .where(Question.interviewId == interview_id)
                            .order_by(desc(Question.createdAt))
                            .limit(1)
                        )
                        last_q = result.scalars().first()
                        if last_q:
                            new_ans = (last_q.userAnswer + " " + final_text) if last_q.userAnswer else final_text
                            last_q.userAnswer = new_ans
                            await db.commit()
        except Exception as e:
            print(f"Error flushing buffer: {e}")

        # 2. Cleanup Session
        if sid in SESSIONS: del SESSIONS[sid]

        # 3. FAST TERMINATION: Mark as COMPLETED immediately if not already
        try:
             async with AsyncSessionLocal() as db:
                 from sqlalchemy import update
                 await db.execute(
                     update(Interview)
                     .where(Interview.id == interview_id)
                     .values(status="COMPLETED", endTime=datetime.now(timezone.utc))
                 )
                 await db.commit()
        except Exception as e:
             pass

        # 4. Trigger Feedback Generation
        asyncio.create_task(generate_feedback(interview_id))
