import uuid
from datetime import datetime

SESSIONS = {}

def create_session():
    session_id = str(uuid.uuid4())
    SESSIONS[session_id] = {
        "created_at": datetime.utcnow(),
        "messages": []  # [{role, text, ts}]
    }
    return session_id

def log_message(session_id, role, text):
    SESSIONS[session_id]["messages"].append({
        "role": role,
        "text": text,
        "ts": datetime.utcnow().isoformat()
    })

def get_messages_for_llm(session_id):
    session = SESSIONS.get(session_id)

    if not session:
        return []

    return [
        {"role": m["role"], "content": m["text"]}
        for m in session["messages"]
    ]



def get_session(session_id):
    return SESSIONS.get(session_id)
