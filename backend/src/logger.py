import json
import os
from datetime import datetime

LOG_DIR = "logs"
LOG_FILE = os.path.join(LOG_DIR, "conversations.jsonl")

os.makedirs(LOG_DIR, exist_ok=True)

def log_conversation(session_id: str, role: str, text: str):
    entry = {
        "session_id": session_id,
        "role": role,              # "user" | "ai"
        "text": text,
        "ts": datetime.utcnow().isoformat()
    }

    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")
