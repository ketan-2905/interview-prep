import os
from groq import Groq
from dotenv import load_dotenv
load_dotenv()

api_key = os.getenv("GROQ_API_KEY")
assert api_key, "GROQ_API_KEY not set"

client = Groq(api_key=api_key)

SYSTEM_PROMPT = """
You are an AI interviewer conducting a frontend React interview.

Rules:
- Ask ONE question at a time
- DO NOT restart the interview
- DO NOT repeat already asked questions
- Ask follow-ups based on the last answer
- If the answer is unclear, gently rephrase ONCE
- Keep responses short
"""

def ask_llm(history: list) -> str:
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *history
    ]

    completion = client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=messages,
        temperature=0.3,
        max_completion_tokens=250
    )

    return completion.choices[0].message.content
