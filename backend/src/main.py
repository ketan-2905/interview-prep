from session_store import get_messages_for_llm
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from stt import create_recognizer, process_audio
from llm import ask_llm
from logger import log_conversation   # ✅ NEW
import uuid


app = FastAPI()

@app.websocket("/ws/interview")
async def interview_ws(ws: WebSocket):
    await ws.accept()

    session_id = str(uuid.uuid4())
    recognizer = create_recognizer()

    # Send session id to frontend
    await ws.send_json({
        "type": "session",
        "session_id": session_id
    })

    try:
        while True:
            data = await ws.receive_bytes()

            kind, text = process_audio(recognizer, data)

            if not text:
                continue

            # Send STT text to frontend
            await ws.send_json({
                "type": f"stt_{kind}",
                "text": text
            })

            # ✅ ONLY LOG FINAL USER TEXT
            if kind == "final":
                # 1️⃣ LOG USER MESSAGE
                log_conversation(
                    session_id=session_id,
                    role="user",
                    text=text
                )

                history = get_messages_for_llm(session_id)
                ai_reply = ask_llm(history)

                # 3️⃣ LOG AI MESSAGE
                log_conversation(
                    session_id=session_id,
                    role="ai",
                    text=ai_reply
                )

                # 4️⃣ SEND AI RESPONSE TO FRONTEND
                await ws.send_json({
                    "type": "ai_response",
                    "text": ai_reply
                })

    except WebSocketDisconnect:
        print(f"Session closed: {session_id}")
