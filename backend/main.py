# import os
# import json
# import time
# import uuid
# import asyncio
# import websockets

# from fastapi import FastAPI, WebSocket, WebSocketDisconnect
# from fastapi.middleware.cors import CORSMiddleware
# from dotenv import load_dotenv
# from groq import Groq

# # ---------------- CONFIG ----------------
# load_dotenv()

# ASSEMBLYAI_URL = "wss://streaming.assemblyai.com/v3/ws"
# ASSEMBLYAI_API_KEY = os.getenv("ASSEMBLYAI_API_KEY")
# GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# SAMPLE_RATE = 16000
# SILENCE_FINAL_SEC = 3.0   # Wait 3 seconds of silence

# MIN_READING_TIME = 2.5
# MAX_READING_TIME = 8.0
# READING_MS_PER_CHAR = 0.04 

# LOG_DIR = "logs"
# LOG_FILE = os.path.join(LOG_DIR, "conversation.jsonl")
# os.makedirs(LOG_DIR, exist_ok=True)

# # ---------------- APP ----------------
# app = FastAPI()
# client = Groq(api_key=GROQ_API_KEY)

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"], # Allow all for dev
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# # ---------------- INTERVIEW LOGIC ----------------
# # SYSTEM_PROMPT = """
# # You are an AI technical interviewer.
# # Ask ONE question at a time.
# # Wait patiently for the candidate to answer.
# # Be calm, professional, and human.
# # """


# SYSTEM_PROMPT = """
# You are an AI technical interviewer conducting a structured technical interview.

# Interview behavior rules (must be strictly followed):
# - Ask exactly ONE question at a time.
# - Keep questions short, direct, and point-to-point.
# - Do NOT explain concepts, definitions, or correct the candidate’s answers.
# - Do NOT provide hints, clarifications, or teaching-style feedback.
# - Do NOT restate the correct answer if the candidate responds incorrectly or incompletely.
# - If the candidate does not know an answer, acknowledge it implicitly and move on.
# - Do NOT ask multiple follow-up questions on the same concept.
# - You may ask at most ONE brief follow-up question on a topic, then move to a different concept.
# - Progress the interview by exploring different areas of knowledge, not by deep drilling.
# - Avoid praise, congratulations, or evaluative language.
# - Maintain a neutral, calm, and professional tone throughout.

# - The goal is assessment, not instruction.
# """

# FIRST_QUESTION = "Can you briefly introduce yourself and your experience with React?"

# SESSIONS = {}

# def log_event(session_id, role, text):
#     with open(LOG_FILE, "a", encoding="utf-8") as f:
#         f.write(json.dumps({
#             "session_id": session_id,
#             "role": role,
#             "text": text,
#             "ts": time.time()
#         }) + "\n")

# def create_session():
#     sid = str(uuid.uuid4())
#     SESSIONS[sid] = {
#         "history": [],
#         "buffer": [],
#         "last_voice_ts": None,
#         "turn": "user",
#         "ai_speaking": False,
#         "ai_end_ts": None,
#         "user_started": False,
#         "reading_time": 0,
#         "processing_ai": False # New flag to prevent double triggering
#     }
#     return sid

# def ask_llm(history):
#     try:
#         resp = client.chat.completions.create(
#             model="llama-3.3-70b-versatile", # Switched to a standard Groq model ID
#             messages=[{"role": "system", "content": SYSTEM_PROMPT}, *history],
#             temperature=0.3,
#             max_completion_tokens=250
#         )
#         return resp.choices[0].message.content
#     except Exception as e:
#         print(f"LLM Error: {e}")
#         return "I'm sorry, I encountered an error. Could you repeat that?"

# # ---------------- WS ----------------
# @app.websocket("/ws/interview")
# async def interview_ws(ws: WebSocket):
#     await ws.accept()
#     session_id = create_session()
    
#     # --- Helper to send AI response ---
#     async def process_and_send_ai_response():
#         # Lock to prevent double processing
#         if SESSIONS[session_id]["processing_ai"]:
#             return
        
#         SESSIONS[session_id]["processing_ai"] = True
        
#         buffer = SESSIONS[session_id]["buffer"]
#         full_answer = " ".join(buffer).strip()
#         SESSIONS[session_id]["buffer"] = [] # Clear buffer immediately

#         if not full_answer:
#             SESSIONS[session_id]["processing_ai"] = False
#             return

#         log_event(session_id, "user", full_answer)
#         SESSIONS[session_id]["history"].append({"role": "user", "content": full_answer})

#         # Call LLM (make this async friendly if needed, but synchronous is fine for short delays)
#         reply = ask_llm(SESSIONS[session_id]["history"])
#         log_event(session_id, "assistant", reply)

#         SESSIONS[session_id]["history"].append({"role": "assistant", "content": reply})

#         # Calculate reading delay
#         char_len = len(reply)
#         reading_time = min(
#             MAX_READING_TIME,
#             max(MIN_READING_TIME, char_len * READING_MS_PER_CHAR)
#         )

#         SESSIONS[session_id]["reading_time"] = reading_time
#         SESSIONS[session_id]["ai_end_ts"] = time.time()
#         SESSIONS[session_id]["user_started"] = False
#         SESSIONS[session_id]["last_voice_ts"] = None # Reset voice timer
        
#         # Send to UI
#         await ws.send_json({
#             "type": "ai_response",
#             "text": reply,
#             "reading_time": reading_time
#         })
        
#         SESSIONS[session_id]["processing_ai"] = False


#     # --- Initial Greeting ---
#     question = FIRST_QUESTION
#     SESSIONS[session_id]["history"].append({"role": "assistant", "content": question})
#     log_event(session_id, "assistant", question)
    
#     char_len = len(question)
#     reading_time = min(MAX_READING_TIME, max(MIN_READING_TIME, char_len * READING_MS_PER_CHAR))
#     SESSIONS[session_id]["reading_time"] = reading_time
#     SESSIONS[session_id]["ai_end_ts"] = time.time()

#     await ws.send_json({
#         "type": "ai_response",
#         "text": question,
#         "reading_time": reading_time
#     })

#     # --- AssemblyAI Connection ---
#     params = f"?sample_rate={SAMPLE_RATE}"
#     headers = {"Authorization": ASSEMBLYAI_API_KEY}

#     async with websockets.connect(ASSEMBLYAI_URL + params, extra_headers=headers) as aai_ws:

#         # Task 1: Forward Audio from Client -> AssemblyAI
#         async def send_audio():
#             try:
#                 while True:
#                     data = await ws.receive_bytes()
#                     # Only send audio if AI is NOT speaking (simple echo cancellation)
#                     # Note: You might want to refine this logic if you want interruptibility
#                     now = time.time()
#                     ai_end = SESSIONS[session_id]["ai_end_ts"] or 0
#                     reading_time = SESSIONS[session_id]["reading_time"] or 0
                    
#                     if (now - ai_end) > reading_time:
#                          await aai_ws.send(data)
#             except WebSocketDisconnect:
#                 pass
#             except Exception as e:
#                 print(f"Audio error: {e}")

#         # Task 2: Receive Transcripts from AssemblyAI -> Server
#         async def receive_text():
#             async for msg in aai_ws:
#                 data = json.loads(msg)
#                 if data.get("type") == "Turn":
#                     text = data.get("transcript", "").strip()
#                     is_final = data.get("end_of_turn", False)

#                     if text:
#                         now = time.time()
#                         SESSIONS[session_id]["last_voice_ts"] = now
                        
#                         if not SESSIONS[session_id]["user_started"]:
#                              SESSIONS[session_id]["user_started"] = True

#                         if is_final:
#                             SESSIONS[session_id]["buffer"].append(text)
#                             await ws.send_json({"type": "stt_final", "text": text})

#         # Task 3: The Silence Watchdog (NEW)
#         async def watch_silence():
#             while True:
#                 await asyncio.sleep(0.5) # Check every 500ms
                
#                 # Check if client disconnected (optional, usually send_audio handles this)
#                 if ws.client_state.name == "DISCONNECTED":
#                     break

#                 now = time.time()
#                 last_voice = SESSIONS[session_id]["last_voice_ts"]
#                 buffer = SESSIONS[session_id]["buffer"]
#                 ai_end = SESSIONS[session_id]["ai_end_ts"]
#                 reading_time = SESSIONS[session_id]["reading_time"]

#                 # Don't trigger if AI is still "reading/speaking"
#                 if ai_end and (now - ai_end) < reading_time:
#                     continue

#                 # TRIGGERS ONLY IF:
#                 # 1. We have text in buffer
#                 # 2. User has spoken recently (last_voice is set)
#                 # 3. Silence duration exceeded
#                 # 4. Not currently processing another request
#                 if (buffer and last_voice and 
#                     (now - last_voice) >= SILENCE_FINAL_SEC and 
#                     not SESSIONS[session_id]["processing_ai"]):
                    
#                     print(f"Silence detected ({now - last_voice:.1f}s). Triggering AI...")
#                     await process_and_send_ai_response()

#         # Run all three tasks concurrently
#         try:
#             await asyncio.gather(send_audio(), receive_text(), watch_silence())
#         except Exception as e:
#             print(f"Session ended: {e}")

# backend/main.py
# import os
# import json
# import time
# import uuid
# import asyncio
# import base64
# import io
# import wave
# import websockets

# from fastapi import FastAPI, WebSocket, WebSocketDisconnect
# from fastapi.middleware.cors import CORSMiddleware
# from dotenv import load_dotenv
# from groq import Groq

# # ---------------- CONFIG ----------------
# load_dotenv()

# ASSEMBLYAI_URL = "wss://streaming.assemblyai.com/v3/ws"
# ASSEMBLYAI_API_KEY = os.getenv("ASSEMBLYAI_API_KEY")
# GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# INWORLD_API_KEY = os.getenv("INWORLD_API_KEY")
# INWORLD_VOICE_ID = os.getenv("INWORLD_VOICE_ID", "Ashley")
# INWORLD_MODEL_ID = "inworld-tts-1.5-max"
# INWORLD_SAMPLE_RATE = 24000

# SAMPLE_RATE = 16000
# SILENCE_FINAL_SEC = 3.0

# MIN_READING_TIME = 2.5
# MAX_READING_TIME = 8.0
# READING_MS_PER_CHAR = 0.04
# THINKING_DELAY = 2.0

# LOG_DIR = "logs"
# LOG_FILE = os.path.join(LOG_DIR, "conversation.jsonl")
# os.makedirs(LOG_DIR, exist_ok=True)

# # ---------------- APP ----------------
# app = FastAPI()
# client = Groq(api_key=GROQ_API_KEY)

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# # ---------------- HELPERS ----------------
# def pcm_to_wav(pcm: bytes, rate: int):
#     buf = io.BytesIO()
#     with wave.open(buf, "wb") as wf:
#         wf.setnchannels(1)
#         wf.setsampwidth(2)
#         wf.setframerate(rate)
#         wf.writeframes(pcm)
#     return buf.getvalue()

# # ---------------- INWORLD TTS ----------------
# async def stream_inworld_tts_to_client(text: str, ws: WebSocket):
#     """
#     Connects to Inworld and streams audio back as binary chunks to the client WebSocket.
#     """
#     headers = {"Authorization": f"Basic {INWORLD_API_KEY}"}
#     url = "wss://api.inworld.ai/tts/v1/voice:streamBidirectional"
#     context_id = f"ctx-{int(time.time()*1000)}-{uuid.uuid4().hex[:6]}"

#     # Note: this function may be cancelled by the caller (task.cancel()), so callers
#     # should handle asyncio.CancelledError if they choose to cancel.
#     async with websockets.connect(url, extra_headers=headers) as tts_ws:
#         await tts_ws.send(json.dumps({
#             "context_id": context_id,
#             "create": {
#                 "voice_id": INWORLD_VOICE_ID,
#                 "model_id": INWORLD_MODEL_ID,
#                 "audio_config": {
#                     "audio_encoding": "LINEAR16",
#                     "sample_rate_hertz": INWORLD_SAMPLE_RATE
#                 }
#             }
#         }))

#         await tts_ws.send(json.dumps({
#             "context_id": context_id,
#             "send_text": {"text": text, "flush_context": {}}
#         }))

#         await tts_ws.send(json.dumps({
#             "context_id": context_id,
#             "close_context": {}
#         }))

#         sent_meta = False

#         async for msg in tts_ws:
#             # Expect JSON messages per Inworld spec
#             try:
#                 data = json.loads(msg)
#             except Exception:
#                 continue

#             chunk = data.get("result", {}).get("audioChunk", {}).get("audioContent")
#             if chunk:
#                 raw = base64.b64decode(chunk)
#                 audio = raw if raw[:4] == b"RIFF" else pcm_to_wav(raw, INWORLD_SAMPLE_RATE)

#                 if not sent_meta:
#                     # inform client about MIME; frontend already expects "audio/wav"
#                     await ws.send_json({"type": "audio_meta", "mime": "audio/wav"})
#                     sent_meta = True

#                 # forward binary bytes
#                 await ws.send_bytes(audio)

#             # contextClosed indicates the TTS server finished this context
#             if data.get("result", {}).get("contextClosed"):
#                 break

# # ---------------- INTERVIEW ----------------
# SYSTEM_PROMPT = """You are an AI technical interviewer.
# Ask exactly one question at a time.
# Do not explain or teach.
# Keep a neutral tone.
# """

# FIRST_QUESTION = "Can you briefly introduce yourself and your experience with React?"
# SESSIONS = {}

# def log_event(sid, role, text):
#     with open(LOG_FILE, "a", encoding="utf-8") as f:
#         f.write(json.dumps({"session_id": sid, "role": role, "text": text, "ts": time.time()}) + "\n")

# def create_session():
#     sid = str(uuid.uuid4())
#     SESSIONS[sid] = {
#         "history": [],
#         "buffer": [],
#         "last_voice_ts": None,
#         # processing_ai is only True while we are calling the LLM (not while TTS plays)
#         "processing_ai": False,
#         "ai_end_ts": None,
#         "reading_time": 0,
#         # keep a handle to the current TTS task so it can be cancelled on user barge-in
#         "tts_task": None
#     }
#     return sid

# def ask_llm(history):
#     r = client.chat.completions.create(
#         model="llama-3.3-70b-versatile",
#         messages=[{"role": "system", "content": SYSTEM_PROMPT}, *history],
#         temperature=0.3,
#         max_completion_tokens=250
#     )
#     return r.choices[0].message.content

# # ---------------- WS ----------------
# @app.websocket("/ws/interview")
# async def interview_ws(ws: WebSocket):
#     await ws.accept()
#     sid = create_session()

#     async def run_tts_task(text, sid_local):
#         """
#         Wrapper that runs the TTS streaming function. It handles cancellation gracefully.
#         Note: we DON'T hold processing_ai during this task — processing_ai is released
#         earlier so user speech can be captured while the assistant speaks.
#         """
#         try:
#             await stream_inworld_tts_to_client(text, ws)
#         except asyncio.CancelledError:
#             # Task was cancelled (user started speaking) — we can just return
#             # Optionally notify client (not required)
#             try:
#                 await ws.send_json({"type": "audio_cancelled"})
#             except Exception:
#                 pass
#             return
#         except Exception as e:
#             print("TTS error:", e)
#             try:
#                 await ws.send_json({"type": "audio_error", "error": str(e)})
#             except Exception:
#                 pass
#         finally:
#             # Clear the stored tts_task handle
#             if SESSIONS.get(sid_local):
#                 SESSIONS[sid_local]["tts_task"] = None

#     async def process_ai():
#         """
#         Called when a user turn is complete (silence detected). This function:
#         - sets a short LLM-processing lock
#         - calls LLM
#         - sends ai_response (and reading_time)
#         - schedules TTS as a background cancellable task
#         - releases processing lock so user audio can be accepted immediately (barge-in)
#         """
#         if SESSIONS[sid]["processing_ai"]:
#             return
#         SESSIONS[sid]["processing_ai"] = True

#         text = " ".join(SESSIONS[sid]["buffer"]).strip()
#         SESSIONS[sid]["buffer"] = []

#         if not text:
#             SESSIONS[sid]["processing_ai"] = False
#             return

#         # Log user input and append to history
#         log_event(sid, "user", text)
#         SESSIONS[sid]["history"].append({"role": "user", "content": text})

#         # Call the LLM (this is the critical section we want processing_ai True for)
#         try:
#             reply = ask_llm(SESSIONS[sid]["history"])
#         except Exception as e:
#             print("LLM error:", e)
#             reply = "I'm sorry, I encountered an error. Could you repeat that?"

#         # Log assistant reply and append to history
#         log_event(sid, "assistant", reply)
#         SESSIONS[sid]["history"].append({"role": "assistant", "content": reply})

#         # compute reading time (seconds) + thinking delay
#         rt = min(MAX_READING_TIME, max(MIN_READING_TIME, len(reply) * READING_MS_PER_CHAR))
#         SESSIONS[sid]["reading_time"] = rt + THINKING_DELAY
#         SESSIONS[sid]["ai_end_ts"] = time.time()

#         # send ai_response JSON (frontend will lock mic based on reading_time)
#         try:
#             await ws.send_json({"type": "ai_response", "text": reply, "reading_time": SESSIONS[sid]["reading_time"]})
#         except Exception:
#             pass

#         # release processing lock now so the server can accept/route user audio (barge-in)
#         SESSIONS[sid]["processing_ai"] = False

#         # small thinking pause so user can see the text before audio begins
#         await asyncio.sleep(THINKING_DELAY)

#         # schedule TTS as cancellable background task and remember the handle so it can be cancelled on user speech
#         t = asyncio.create_task(run_tts_task(reply, sid))
#         SESSIONS[sid]["tts_task"] = t

#     # Initial greeting: send ai_response and schedule TTS in background
#     try:
#         await ws.send_json({"type": "ai_response", "text": FIRST_QUESTION, "reading_time": 4})
#     except Exception:
#         pass

#     # schedule initial TTS
#     initial_t = asyncio.create_task(run_tts_task(FIRST_QUESTION, sid))
#     SESSIONS[sid]["tts_task"] = initial_t
#     SESSIONS[sid]["history"].append({"role": "assistant", "content": FIRST_QUESTION})
#     SESSIONS[sid]["ai_end_ts"] = time.time()
#     SESSIONS[sid]["reading_time"] = 4

#     # connect to AssemblyAI
#     params = f"?sample_rate={SAMPLE_RATE}"
#     headers = {"Authorization": ASSEMBLYAI_API_KEY}

#     async with websockets.connect(ASSEMBLYAI_URL + params, extra_headers=headers) as aai_ws:

#         async def send_audio():
#             """
#             Receives binary audio from the frontend and forwards it to AssemblyAI.
#             We only gate sending until the frontend-side reading_time has elapsed
#             (that's coordinated via ai_end_ts + reading_time).
#             """
#             try:
#                 while True:
#                     data = await ws.receive_bytes()
#                     # Only forward audio after the assistant's reading_time window has passed
#                     if time.time() - (SESSIONS[sid]["ai_end_ts"] or 0) > (SESSIONS[sid]["reading_time"] or 0):
#                         await aai_ws.send(data)
#             except WebSocketDisconnect:
#                 pass
#             except Exception as e:
#                 # Unexpected error while reading binary from client
#                 print("Audio forwarding error:", e)

#         async def recv_text():
#             """
#             Listens for AssemblyAI streaming messages and forwards partial/final STT.
#             On the first partial of a user utterance, cancel any playing TTS so we can barge-in.
#             """
#             async for msg in aai_ws:
#                 try:
#                     d = json.loads(msg)
#                 except Exception:
#                     continue

#                 if d.get("type") == "Turn":
#                     text = d.get("transcript", "").strip()
#                     if text:
#                         # mark last voice timestamp for silence detection
#                         SESSIONS[sid]["last_voice_ts"] = time.time()

#                         # If user starts speaking (first partial), cancel any current TTS playback
#                         # This allows the user to interrupt the assistant (barge-in)
#                         ttask = SESSIONS[sid].get("tts_task")
#                         if ttask is not None and not ttask.done():
#                             try:
#                                 ttask.cancel()
#                             except Exception:
#                                 pass
#                             SESSIONS[sid]["tts_task"] = None

#                         # forward partial updates so frontend shows live text
#                         try:
#                             await ws.send_json({"type": "stt_partial", "text": text})
#                         except Exception:
#                             pass

#                         # if end_of_turn, finalize this chunk into the buffer for LLM
#                         if d.get("end_of_turn"):
#                             SESSIONS[sid]["buffer"].append(text)
#                             try:
#                                 await ws.send_json({"type": "stt_final", "text": text})
#                             except Exception:
#                                 pass

#         async def watch_silence():
#             """
#             Periodically checks for silence after user speech. If we detect
#             SILENCE_FINAL_SEC of inactivity after last speech, trigger LLM processing.
#             """
#             while True:
#                 await asyncio.sleep(0.5)
#                 last = SESSIONS[sid].get("last_voice_ts")
#                 # Only trigger if we've heard something and enough silence elapsed
#                 if last and (time.time() - last) > SILENCE_FINAL_SEC:
#                     # reset last_voice_ts to avoid repeated triggers until new speech arrives
#                     SESSIONS[sid]["last_voice_ts"] = None
#                     await process_ai()

#         # Run the three tasks concurrently: forwarding audio, receiving STT, silence watch
#         await asyncio.gather(send_audio(), recv_text(), watch_silence())

# backend/main.py
import os
import json
import time
import uuid
import asyncio
import base64
import io
import wave
import websockets

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from groq import Groq

# ---------------- CONFIG ----------------
load_dotenv()

ASSEMBLYAI_URL = "wss://streaming.assemblyai.com/v3/ws"
ASSEMBLYAI_API_KEY = os.getenv("ASSEMBLYAI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

INWORLD_API_KEY = os.getenv("INWORLD_API_KEY")
INWORLD_VOICE_ID = os.getenv("INWORLD_VOICE_ID", "Ashley")
INWORLD_MODEL_ID = "inworld-tts-1.5-max"
INWORLD_SAMPLE_RATE = 24000

SAMPLE_RATE = 16000
SILENCE_FINAL_SEC = 3.0

MIN_READING_TIME = 2.5
MAX_READING_TIME = 8.0
READING_MS_PER_CHAR = 0.04  # seconds per character (used to estimate TTS duration)
THINKING_DELAY = 2.0

# Extra buffer after TTS playback finishes before we start listening for silence
EXTRA_AFTER_TTS_SEC = 1.0  # <-- the 1 second you requested

LOG_DIR = "logs"
LOG_FILE = os.path.join(LOG_DIR, "conversation.jsonl")
os.makedirs(LOG_DIR, exist_ok=True)

# ---------------- APP ----------------
app = FastAPI()
client = Groq(api_key=GROQ_API_KEY)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- HELPERS ----------------
def pcm_to_wav(pcm: bytes, rate: int):
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(rate)
        wf.writeframes(pcm)
    return buf.getvalue()

# ---------------- INWORLD TTS ----------------
async def stream_inworld_tts_to_client(text: str, ws: WebSocket):
    """
    Connects to Inworld and streams audio back as binary chunks to the client WebSocket.
    """
    headers = {"Authorization": f"Basic {INWORLD_API_KEY}"}
    url = "wss://api.inworld.ai/tts/v1/voice:streamBidirectional"
    context_id = f"ctx-{int(time.time()*1000)}-{uuid.uuid4().hex[:6]}"

    # Note: this function may be cancelled by the caller (task.cancel()), so callers
    # should handle asyncio.CancelledError if they choose to cancel.
    async with websockets.connect(url, extra_headers=headers) as tts_ws:
        await tts_ws.send(json.dumps({
            "context_id": context_id,
            "create": {
                "voice_id": INWORLD_VOICE_ID,
                "model_id": INWORLD_MODEL_ID,
                "audio_config": {
                    "audio_encoding": "LINEAR16",
                    "sample_rate_hertz": INWORLD_SAMPLE_RATE
                }
            }
        }))

        await tts_ws.send(json.dumps({
            "context_id": context_id,
            "send_text": {"text": text, "flush_context": {}}
        }))

        await tts_ws.send(json.dumps({
            "context_id": context_id,
            "close_context": {}
        }))

        sent_meta = False

        async for msg in tts_ws:
            # Expect JSON messages per Inworld spec
            try:
                data = json.loads(msg)
            except Exception:
                continue

            chunk = data.get("result", {}).get("audioChunk", {}).get("audioContent")
            if chunk:
                raw = base64.b64decode(chunk)
                audio = raw if raw[:4] == b"RIFF" else pcm_to_wav(raw, INWORLD_SAMPLE_RATE)

                if not sent_meta:
                    # inform client about MIME; frontend already expects "audio/wav"
                    await ws.send_json({"type": "audio_meta", "mime": "audio/wav"})
                    sent_meta = True

                # forward binary bytes
                await ws.send_bytes(audio)

            # contextClosed indicates the TTS server finished this context
            if data.get("result", {}).get("contextClosed"):
                break

# ---------------- INTERVIEW ----------------
SYSTEM_PROMPT = """You are an AI technical interviewer.
Ask exactly one question at a time.
Do not explain or teach.
Keep a neutral tone.
"""

FIRST_QUESTION = "Can you briefly introduce yourself and your experience with React?"
SESSIONS = {}

def log_event(sid, role, text):
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps({"session_id": sid, "role": role, "text": text, "ts": time.time()}) + "\n")

def create_session():
    sid = str(uuid.uuid4())
    SESSIONS[sid] = {
        "history": [],
        "buffer": [],
        "last_voice_ts": None,
        # processing_ai is only True while we are calling the LLM (not while TTS plays)
        "processing_ai": False,
        "ai_end_ts": None,
        "reading_time": 0,
        # keep a handle to the current TTS task so it can be cancelled on user barge-in
        "tts_task": None
    }
    return sid

def ask_llm(history):
    r = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "system", "content": SYSTEM_PROMPT}, *history],
        temperature=0.3,
        max_completion_tokens=250
    )
    return r.choices[0].message.content

# ---------------- WS ----------------
@app.websocket("/ws/interview")
async def interview_ws(ws: WebSocket):
    await ws.accept()
    sid = create_session()

    async def run_tts_task(text, sid_local):
        """
        Wrapper that runs the TTS streaming function. It handles cancellation gracefully.
        Note: we DON'T hold processing_ai during this task — processing_ai is released
        earlier so user speech can be captured while the assistant is speaking.
        """
        try:
            await stream_inworld_tts_to_client(text, ws)
        except asyncio.CancelledError:
            # Task was cancelled (user started speaking) — notify the client optionally
            try:
                await ws.send_json({"type": "audio_cancelled"})
            except Exception:
                pass
            return
        except Exception as e:
            print("TTS error:", e)
            try:
                await ws.send_json({"type": "audio_error", "error": str(e)})
            except Exception:
                pass
        finally:
            # Clear the stored tts_task handle
            if SESSIONS.get(sid_local):
                SESSIONS[sid_local]["tts_task"] = None

    async def process_ai():
        """
        Called when a user turn is complete (silence detected). This function:
        - sets a short LLM-processing lock
        - calls LLM
        - sends ai_response (and reading_time)
        - schedules TTS as a background cancellable task
        - releases processing lock so user audio can be accepted immediately (barge-in)
        """
        if SESSIONS[sid]["processing_ai"]:
            return
        SESSIONS[sid]["processing_ai"] = True

        text = " ".join(SESSIONS[sid]["buffer"]).strip()
        SESSIONS[sid]["buffer"] = []

        if not text:
            SESSIONS[sid]["processing_ai"] = False
            return

        # Log user input and append to history
        log_event(sid, "user", text)
        SESSIONS[sid]["history"].append({"role": "user", "content": text})

        # Call the LLM (this is the critical section we want processing_ai True for)
        try:
            reply = ask_llm(SESSIONS[sid]["history"])
        except Exception as e:
            print("LLM error:", e)
            reply = "I'm sorry, I encountered an error. Could you repeat that?"

        # Log assistant reply and append to history
        log_event(sid, "assistant", reply)
        SESSIONS[sid]["history"].append({"role": "assistant", "content": reply})

        # compute estimated reading time (seconds) + thinking delay
        rt = min(MAX_READING_TIME, max(MIN_READING_TIME, len(reply) * READING_MS_PER_CHAR))
        SESSIONS[sid]["reading_time"] = rt + THINKING_DELAY
        SESSIONS[sid]["ai_end_ts"] = time.time()

        # send ai_response JSON (frontend will lock mic based on reading_time)
        try:
            await ws.send_json({"type": "ai_response", "text": reply, "reading_time": SESSIONS[sid]["reading_time"]})
        except Exception:
            pass

        # release processing lock now so the server can accept/route user audio (barge-in)
        SESSIONS[sid]["processing_ai"] = False

        # small thinking pause so user can see the text before audio begins
        await asyncio.sleep(THINKING_DELAY)

        # schedule TTS as cancellable background task and remember the handle so it can be cancelled on user speech
        t = asyncio.create_task(run_tts_task(reply, sid))
        SESSIONS[sid]["tts_task"] = t

    # Initial greeting: send ai_response and schedule TTS in background
    try:
        await ws.send_json({"type": "ai_response", "text": FIRST_QUESTION, "reading_time": 4})
    except Exception:
        pass

    # schedule initial TTS
    initial_t = asyncio.create_task(run_tts_task(FIRST_QUESTION, sid))
    SESSIONS[sid]["tts_task"] = initial_t
    SESSIONS[sid]["history"].append({"role": "assistant", "content": FIRST_QUESTION})
    SESSIONS[sid]["ai_end_ts"] = time.time()
    SESSIONS[sid]["reading_time"] = 4

    # connect to AssemblyAI
    params = f"?sample_rate={SAMPLE_RATE}"
    headers = {"Authorization": ASSEMBLYAI_API_KEY}

    async with websockets.connect(ASSEMBLYAI_URL + params, extra_headers=headers) as aai_ws:

        async def send_audio():
            """
            Receives binary audio from the frontend and forwards it to AssemblyAI.
            We only gate sending until the frontend-side reading_time has elapsed
            (that's coordinated via ai_end_ts + reading_time).
            """
            try:
                while True:
                    data = await ws.receive_bytes()
                    # Only forward audio after the assistant's reading_time window has passed
                    if time.time() - (SESSIONS[sid]["ai_end_ts"] or 0) > (SESSIONS[sid]["reading_time"] or 0):
                        await aai_ws.send(data)
            except WebSocketDisconnect:
                pass
            except Exception as e:
                # Unexpected error while reading binary from client
                print("Audio forwarding error:", e)

        async def recv_text():
            """
            Listens for AssemblyAI streaming messages and forwards partial/final STT.
            On the first partial of a user utterance, cancel any playing TTS so we can barge-in.
            """
            async for msg in aai_ws:
                try:
                    d = json.loads(msg)
                except Exception:
                    continue

                if d.get("type") == "Turn":
                    text = d.get("transcript", "").strip()
                    if text:
                        # mark last voice timestamp for silence detection
                        SESSIONS[sid]["last_voice_ts"] = time.time()

                        # If user starts speaking (first partial), cancel any current TTS playback
                        # This allows the user to interrupt the assistant (barge-in)
                        ttask = SESSIONS[sid].get("tts_task")
                        if ttask is not None and not ttask.done():
                            try:
                                ttask.cancel()
                            except Exception:
                                pass
                            SESSIONS[sid]["tts_task"] = None

                        # forward partial updates so frontend shows live text
                        try:
                            await ws.send_json({"type": "stt_partial", "text": text})
                        except Exception:
                            pass

                        # if end_of_turn, finalize this chunk into the buffer for LLM
                        if d.get("end_of_turn"):
                            SESSIONS[sid]["buffer"].append(text)
                            try:
                                await ws.send_json({"type": "stt_final", "text": text})
                            except Exception:
                                pass

        async def watch_silence():
            """
            Periodically checks for silence after user speech. If we detect
            SILENCE_FINAL_SEC of inactivity after last speech, trigger LLM processing.

            This function now respects:
            - If a TTS task is running, do NOT trigger silence detection.
            - Also, wait for the assistant's estimated speaking time (reading_time)
              plus an extra buffer (EXTRA_AFTER_TTS_SEC) after ai_end_ts before
              considering silence. This prevents treating assistant speech as user silence.
            """
            while True:
                await asyncio.sleep(0.5)
                now = time.time()

                last = SESSIONS[sid].get("last_voice_ts")
                ttask = SESSIONS[sid].get("tts_task")
                ai_end = SESSIONS[sid].get("ai_end_ts")
                reading_time = SESSIONS[sid].get("reading_time") or 0

                # If TTS is currently playing, do not trigger silence detection
                if ttask is not None and not ttask.done():
                    continue

                # Also, if AI recently produced a response, wait until its estimated speaking time + extra buffer has passed.
                if ai_end and (now - ai_end) < (reading_time + EXTRA_AFTER_TTS_SEC):
                    continue

                # If we've recorded last_voice and it's been quiet for SILENCE_FINAL_SEC, trigger AI
                if (last and (now - last) >= SILENCE_FINAL_SEC and not SESSIONS[sid]["processing_ai"]):
                    # reset last_voice_ts so we don't trigger multiple times
                    SESSIONS[sid]["last_voice_ts"] = None
                    await process_ai()

        # Run the three tasks concurrently: forwarding audio, receiving STT, silence watch
        await asyncio.gather(send_audio(), recv_text(), watch_silence())
