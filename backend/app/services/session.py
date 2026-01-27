import uuid

SESSIONS = {}

def create_session():
    sid = str(uuid.uuid4())
    SESSIONS[sid] = {
        "history": [],
        "buffer": [],
        "last_voice_ts": None,
        "processing_ai": False,
        "ai_end_ts": None,
        "reading_time": 0,
        "tts_task": None
    }
    return sid

def get_session(sid):
    return SESSIONS.get(sid)

def delete_session(sid):
    if sid in SESSIONS:
        del SESSIONS[sid]
