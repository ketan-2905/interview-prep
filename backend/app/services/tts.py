import os
import json
import uuid
import time
import asyncio
import base64
import wave
import io
import websockets
from dotenv import load_dotenv

load_dotenv()

INWORLD_API_KEY = os.getenv("INWORLD_API_KEY")
INWORLD_VOICE_ID = os.getenv("INWORLD_VOICE_ID", "Ashley")
INWORLD_MODEL_ID = "inworld-tts-1.5-max"
INWORLD_SAMPLE_RATE = 24000

def pcm_to_wav(pcm: bytes, rate: int):
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(rate)
        wf.writeframes(pcm)
    return buf.getvalue()

async def stream_inworld_tts_to_client(text: str, ws):
    """
    Connects to Inworld and streams audio back as binary chunks to the client WebSocket.
    """
    if not INWORLD_API_KEY:
        print("Error: INWORLD_API_KEY not set")
        return

    headers = {"Authorization": f"Basic {INWORLD_API_KEY}"}
    url = "wss://api.inworld.ai/tts/v1/voice:streamBidirectional"
    context_id = f"ctx-{int(time.time()*1000)}-{uuid.uuid4().hex[:6]}"

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
            try:
                data = json.loads(msg)
            except Exception:
                continue

            chunk = data.get("result", {}).get("audioChunk", {}).get("audioContent")
            if chunk:
                raw = base64.b64decode(chunk)
                audio = raw if raw[:4] == b"RIFF" else pcm_to_wav(raw, INWORLD_SAMPLE_RATE)

                if not sent_meta:
                    await ws.send_json({"type": "audio_meta", "mime": "audio/wav"})
                    sent_meta = True

                await ws.send_bytes(audio)

            if data.get("result", {}).get("contextClosed"):
                break
