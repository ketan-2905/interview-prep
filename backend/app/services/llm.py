import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
client = Groq(api_key=GROQ_API_KEY)

SYSTEM_PROMPT = """You are an AI technical interviewer.
Ask exactly one question at a time.
Do not explain or teach.
Keep a neutral tone.
"""

def ask_llm(history):
    try:
        r = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "system", "content": SYSTEM_PROMPT}, *history],
            temperature=0.3,
            max_completion_tokens=250
        )
        return r.choices[0].message.content
    except Exception as e:
        print(f"LLM Error: {e}")
        return "I'm sorry, I encountered an error. Could you repeat that?"
