import json
from vosk import Model, KaldiRecognizer

MODEL_PATH = "vosk-model-en-us-aspire-0.2"
model = Model(MODEL_PATH)

def create_recognizer():
    rec = KaldiRecognizer(model, 48000)
    rec.SetWords(True)
    return rec

def process_audio(recognizer, pcm_bytes):
    if recognizer.AcceptWaveform(pcm_bytes):
        return "final", json.loads(recognizer.Result()).get("text", "")
    else:
        return "partial", json.loads(recognizer.PartialResult()).get("partial", "")
