"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, Cpu, Loader2, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AudioWorkletProcessor } from "@/utils/audioProcessor";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { usePassStore } from "@/store/useFeatureGrantStore";

export default function InterviewRoom({
  interviewId,
}: {
  interviewId: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<
    { role: "ai" | "user"; text: string }[]
  >([]);
  const [recording, setRecording] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [currentSubtitle, setCurrentSubtitle] = useState("");
  const [aiTextPending, setAiTextPending] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showEndModal, setShowEndModal] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const aiLockedRef = useRef(true);
  const { reset } = usePassStore();

  useEffect(() => {
    return () => {
      stop();
      reset();
    };
  }, []);

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/interview/${interviewId}`,
        );
        const data = await res.json();
        const durationSec = (data.duration || 0) * 60;

        if (data.startTime) {
          const startMs = new Date(data.startTime).getTime();
          const nowMs = Date.now();
          const elapsedSec = Math.floor((nowMs - startMs) / 1000);
          const remaining = Math.max(0, durationSec - elapsedSec);
          setTimeLeft(remaining);
        } else {
          setTimeLeft(durationSec);
        }
      } catch (e) {
        console.error("Failed to fetch interview info", e);
      }
    };
    fetchInfo();
  }, [interviewId]);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 1;
        return next >= 0 ? next : 0;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const start = async () => {
    const ws = new WebSocket(
      `${process.env.NEXT_PUBLIC_BACKEND_URL?.replace("http", "ws")}/ws/interview?interview_id=${interviewId}`,
    );
    ws.binaryType = "arraybuffer";
    socketRef.current = ws;

    ws.onopen = async () => {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AudioCtx();
        if (audioCtxRef.current.state === "suspended") {
          await audioCtxRef.current.resume();
        }

        try {
          await audioCtxRef.current.audioWorklet.addModule("/audio-worklet.js");
        } catch (e) {
          console.error("Worklet Load Failed", e);
        }
      } else {
        if (audioCtxRef.current.state === "suspended") {
          await audioCtxRef.current.resume();
        }
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        const source = audioCtxRef.current.createMediaStreamSource(stream);
        const workletNode = new AudioWorkletNode(
          audioCtxRef.current,
          "audio-input-processor",
        );

        workletNode.port.onmessage = (e) => {
          if (!aiLockedRef.current && ws.readyState === WebSocket.OPEN) {
            const inputData = e.data;
            const inputSampleRate = audioCtxRef.current?.sampleRate || 48000;
            const targetSampleRate = 16000;

            let processedData = inputData;
            if (inputSampleRate !== targetSampleRate) {
              const ratio = inputSampleRate / targetSampleRate;
              const newLength = Math.floor(inputData.length / ratio);
              processedData = new Float32Array(newLength);
              for (let i = 0; i < newLength; i++) {
                processedData[i] = inputData[Math.floor(i * ratio)];
              }
            }

            const int16Buffer = new Int16Array(processedData.length);
            for (let i = 0; i < processedData.length; i++) {
              const s = Math.max(-1, Math.min(1, processedData[i]));
              int16Buffer[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
            }

            ws.send(int16Buffer.buffer);
          }
        };

        source.connect(workletNode);
        const muteNode = audioCtxRef.current.createGain();
        muteNode.gain.value = 0;
        workletNode.connect(muteNode);
        muteNode.connect(audioCtxRef.current.destination);

        setRecording(true);
        setConnecting(false);
        setAiSpeaking(true);
      } catch (e) {
        console.error(e);
        setConnecting(false);
        setRecording(false);
        alert("Microphone access failed. Please allow permissions.");
        ws.close();
      }
    };

    ws.onmessage = async (e) => {
      if (e.data instanceof ArrayBuffer) {
        try {
          const ctx = audioCtxRef.current;
          if (!ctx) return;
          const audioBuffer = await ctx.decodeAudioData(e.data.slice(0));
          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(ctx.destination);

          const start = Math.max(nextPlayTimeRef.current, ctx.currentTime);
          source.start(start);
          nextPlayTimeRef.current = start + audioBuffer.duration;

          setAiTextPending((pending) => {
            if (pending) {
              setCurrentSubtitle(pending);
              setMessages((prev) => [...prev, { role: "ai", text: pending }]);
              return null;
            }
            return null;
          });

          setAiSpeaking(true);
          aiLockedRef.current = true;

          source.onended = () => {
            if (ctx.currentTime + 0.2 >= nextPlayTimeRef.current) {
              setTimeout(() => {
                if (ctx.currentTime + 0.2 >= nextPlayTimeRef.current) {
                  setCurrentSubtitle("");
                  aiLockedRef.current = false;
                  setAiSpeaking(false);
                }
              }, 800);
            }
          };
        } catch (err) {
          console.warn(err);
        }
        return;
      }

      try {
        const data = JSON.parse(e.data);
        if (data.type === "ai_response") {
          aiLockedRef.current = true;
          setAiSpeaking(true);
          setAiTextPending(data.text);

          if (data.is_final) {
            setTimeout(() => {
              setShowEndModal(true);
              stop();
            }, 5000);
            return;
          }
        }
        if (data.type === "stt_partial") {
          setCurrentSubtitle(data.text);
        }
        if (data.type === "stt_final") {
          setMessages((prev) => [...prev, { role: "user", text: data.text }]);
          setCurrentSubtitle("");
        }
      } catch (err) { }
    };

    ws.onclose = () => {
      setRecording(false);
      setAiSpeaking(false);
    };
  };

  const stop = () => {
    socketRef.current?.close();
    audioCtxRef.current?.close().then(() => {
      audioCtxRef.current = null;
    });
    setRecording(false);
    setAiSpeaking(false);
  };

  const handleEnd = () => {
    stop();
    try {
      const blob = new Blob([JSON.stringify({})], { type: "application/json" });
      const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/interview/${interviewId}/finish`;
      navigator.sendBeacon(url, blob);
    } catch (e) {
      console.error("Beacon failed", e);
    }
    router.push("/dashboard");
  };

  return (
    <div className="relative min-h-screen bg-[#FAFAFA] text-slate-900 overflow-hidden flex flex-col items-center justify-center selection:bg-emerald-100">
      {/* Subtle Background Decor */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-50/70 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-50/70 blur-[120px]" />
      </div>

      {/* Voice Visualization Waves */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <AnimatePresence>
          {aiSpeaking && (
            <>
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 2.2, opacity: 0.15 }}
                exit={{ opacity: 0 }}
                transition={{ repeat: Infinity, duration: 2.5, ease: "easeOut" }}
                className="absolute w-[400px] h-[400px] rounded-full border-4 border-emerald-600"
              />
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1.8, opacity: 0.1 }}
                exit={{ opacity: 0 }}
                transition={{ repeat: Infinity, duration: 2.5, delay: 0.8, ease: "easeOut" }}
                className="absolute w-[300px] h-[300px] rounded-full border-4 border-blue-600"
              />
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Top Bar: Brand & Timer */}
      <div className="absolute top-0 w-full p-8 flex justify-between items-center z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-100">
            <Zap size={20} className="text-white fill-white" />
          </div>
          <span className="text-xl font-black tracking-tighter uppercase">Interview<span className="text-emerald-600">AI</span></span>
        </div>

        {recording && timeLeft > 0 && (
          <div className="flex items-center gap-3 px-6 py-2.5 bg-white border border-slate-200 rounded-full shadow-sm font-mono text-sm font-black text-slate-900">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
          </div>
        )}
      </div>

      {/* Center UI */}
      <div className="z-10 flex flex-col items-center gap-12">
        <div
          className={clsx(
            "w-48 h-48 rounded-[60px] bg-white border-2 flex items-center justify-center shadow-2xl transition-all duration-700",
            aiSpeaking
              ? "border-emerald-500 scale-110 shadow-emerald-100"
              : "border-slate-100 shadow-slate-100",
          )}
        >
          <div className={clsx("relative p-8 rounded-full transition-all duration-500", aiSpeaking ? "bg-emerald-50" : "bg-slate-50")}>
            <Cpu
              className={clsx(
                "w-16 h-16 transition-colors duration-500",
                aiSpeaking ? "text-emerald-600" : "text-slate-300",
              )}
            />
            {aiSpeaking && (
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-4 border-white"
              />
            )}
          </div>
        </div>

        {!recording && !showEndModal && (
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={() => {
                setConnecting(true);
                start().catch(() => setConnecting(false));
              }}
              disabled={connecting}
              className={clsx(
                "bg-emerald-600 hover:bg-emerald-500 text-white px-10 py-4 rounded-full font-black uppercase tracking-widest text-sm shadow-xl shadow-emerald-100 transition-all hover:scale-105 active:scale-95 flex items-center gap-3",
                connecting && "opacity-75 cursor-not-allowed",
              )}
            >
              {connecting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Initializing Node...
                </>
              ) : (
                <>Start Session</>
              )}
            </button>
            <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.3em]">Ensure your mic is connected</p>
          </div>
        )}
      </div>

      {/* Subtitles Area */}
      <div className="absolute bottom-32 w-full max-w-4xl text-center px-8 min-h-[100px] flex items-center justify-center pointer-events-none">
        <AnimatePresence mode="wait">
          {currentSubtitle ? (
            <motion.p
              key={currentSubtitle}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-3xl font-black text-slate-900 leading-tight tracking-tight drop-shadow-sm"
            >
              {currentSubtitle}
            </motion.p>
          ) : aiSpeaking ? (
            <div className="flex gap-2">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  animate={{ y: [0, -8, 0] }}
                  transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.15 }}
                  className="w-2 h-2 bg-emerald-600 rounded-full"
                />
              ))}
            </div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Controls Bar */}
      <AnimatePresence>
        {recording && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="absolute bottom-10 flex items-center gap-6"
          >
            <div className="px-6 py-4 bg-white border border-slate-200 rounded-3xl shadow-xl flex items-center gap-6">
              <button
                disabled
                className={clsx(
                  "p-4 rounded-2xl transition-all",
                  aiSpeaking
                    ? "bg-slate-50 text-slate-300 opacity-50 cursor-not-allowed"
                    : "bg-emerald-50 text-emerald-600 animate-pulse shadow-sm shadow-emerald-100",
                )}
              >
                {aiSpeaking ? (
                  <MicOff className="w-6 h-6" />
                ) : (
                  <Mic className="w-6 h-6" />
                )}
              </button>
              <div className="h-8 w-px bg-slate-100" />
              <button
                onClick={handleEnd}
                className="p-4 rounded-2xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all hover:scale-105 active:scale-95 shadow-sm shadow-red-50"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* End Modal */}
      <AnimatePresence>
        {showEndModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-xl">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white border border-slate-200 p-12 rounded-[40px] max-w-md w-full text-center shadow-[0_32px_80px_-12px_rgba(0,0,0,0.1)]"
            >
              <div className="mx-auto w-20 h-20 bg-emerald-600 rounded-3xl flex items-center justify-center mb-8 shadow-xl shadow-emerald-100 rotate-3">
                <Cpu className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-black text-slate-950 mb-3 tracking-tight">
                Assessment Complete
              </h2>
              <p className="text-slate-500 font-medium mb-10 text-lg">
                Excellent focus. Our neural engine is now synthesizing your performance data into actionable feedback.
              </p>
              <button
                onClick={handleEnd}
                className="w-full bg-slate-950 text-white hover:bg-slate-800 py-5 rounded-full font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-slate-200"
              >
                View Results Dashboard
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
