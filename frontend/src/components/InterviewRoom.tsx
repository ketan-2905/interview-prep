"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, Cpu } from "lucide-react";
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
  const audioRef = useRef<AudioWorkletProcessor | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const aiLockedRef = useRef(true); // Start locked (Muted)
  const { reset } = usePassStore();

  useEffect(() => {
    return () => {
      stop();
      reset();
    };
  }, []);

  // useEffect(() => {
  //   // Fetch duration to init timer
  //   const fetchInfo = async () => {
  //     try {
  //       const res = await fetch(
  //         `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/interview/${interviewId}`,
  //       );
  //       const data = await res.json();
  //       if (data.duration) setTimeLeft(data.duration * 60);
  //     } catch (e) {}
  //   };
  //   fetchInfo();
  // }, [interviewId]);


  useEffect(() => {
  // Fetch duration and startTime to init timer
  const fetchInfo = async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/interview/${interviewId}`,
      );
      const data = await res.json();
      const durationSec = (data.duration || 0) * 60;

      // If the interview has a startTime, compute elapsed and set remaining
      if (data.startTime) {
        const startMs = new Date(data.startTime).getTime();
        const nowMs = Date.now();
        const elapsedSec = Math.floor((nowMs - startMs) / 1000);
        const remaining = Math.max(0, durationSec - elapsedSec);
        setTimeLeft(remaining);
      } else {
        // not started on server yet -> full duration
        setTimeLeft(durationSec);
      }
    } catch (e) {
      console.error("Failed to fetch interview info", e);
    }
  };
  fetchInfo();
}, [interviewId]);


  // useEffect(() => {
  //   if (!recording || timeLeft <= 0) return;
  //   const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
  //   return () => clearInterval(timer);
  // }, [recording, timeLeft]);

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
      // Init Audio Context
      if (!audioCtxRef.current) {
        const AudioCtx =
          window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AudioCtx();
        // Resume if suspended (browser policy)
        if (audioCtxRef.current.state === "suspended") {
          await audioCtxRef.current.resume();
        }

        // Load Worklet
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

      // Mic Stream
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

        // BUFFERING & CONVERSION
        workletNode.port.onmessage = (e) => {
          if (!aiLockedRef.current && ws.readyState === WebSocket.OPEN) {
            const inputData = e.data; // Float32Array
            const inputSampleRate = audioCtxRef.current?.sampleRate || 48000;
            const targetSampleRate = 16000;

            // Simple Downsampling if needed
            let processedData = inputData;
            if (inputSampleRate !== targetSampleRate) {
              const ratio = inputSampleRate / targetSampleRate;
              const newLength = Math.floor(inputData.length / ratio);
              processedData = new Float32Array(newLength);
              for (let i = 0; i < newLength; i++) {
                // Simple decimation (can be improved with averaging)
                processedData[i] = inputData[Math.floor(i * ratio)];
              }
            }

            // Convert to Int16
            const int16Buffer = new Int16Array(processedData.length);
            for (let i = 0; i < processedData.length; i++) {
              const s = Math.max(-1, Math.min(1, processedData[i]));
              int16Buffer[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
            }

            ws.send(int16Buffer.buffer);
          }
        };

        source.connect(workletNode);
        // Workaround: Connect to a GainNode with gain 0, then to destination, to prevent feedback and keep node alive.
        const muteNode = audioCtxRef.current.createGain();
        muteNode.gain.value = 0;
        workletNode.connect(muteNode);
        muteNode.connect(audioCtxRef.current.destination);

        // --- SUCCESS ---
        setRecording(true);
        setConnecting(false);
        setAiSpeaking(true); // START SPEAKING (Pending Audio) -> Mutes Mic Visually
      } catch (e) {
        console.error(e);
        setConnecting(false);
        setRecording(false);
        alert("Microphone access failed. Please allow permissions.");
        ws.close();
      }
    };

    // ... (rest of start function) ...

    ws.onmessage = async (e) => {
      // Audio
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

          // SYNC: Show text when audio starts playing
          setAiTextPending((pending) => {
            if (pending) {
              setCurrentSubtitle(pending);
              setMessages((prev) => [...prev, { role: "ai", text: pending }]);
              return null;
            }
            return null;
          });

          setAiSpeaking(true);
          aiLockedRef.current = true; // LOCK INPUT while audio plays

          source.onended = () => {
            // Check if this was the last chunk in the queue
            // We compare times with a small epsilon for float precision
            if (ctx.currentTime + 0.2 >= nextPlayTimeRef.current) {
              setTimeout(() => {
                // Double check we haven't added more chunks in the meantime
                if (ctx.currentTime + 0.2 >= nextPlayTimeRef.current) {
                  setCurrentSubtitle("");
                  aiLockedRef.current = false;
                  setAiSpeaking(false);
                }
              }, 800); // 800ms silence buffer
            }
          };
        } catch (err) {
          console.warn(err);
        }
        return;
      }

      // JSON
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
      } catch (err) {}
    };

    ws.onclose = () => {
      setRecording(false);
      setAiSpeaking(false);
    };
  };

  const stop = () => {
    audioRef.current?.stop();
    socketRef.current?.close();

    // Kill Audio Context
    audioCtxRef.current?.close().then(() => {
      audioCtxRef.current = null;
    });

    setRecording(false);
    setAiSpeaking(false);
  };

  const handleEnd = () => {
    stop();
    // Robust Termination using Beacon
    try {
      const blob = new Blob([JSON.stringify({})], { type: "application/json" });
      const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/interview/${interviewId}/finish`;
      navigator.sendBeacon(url, blob);
    } catch (e) {
      // Fallback to fetch if Beacon fails or is blocked?
      // Beacon is usually safer for unload.
      console.error("Beacon failed", e);
    }
    router.push("/dashboard");
  };

  return (
    <div className="relative min-h-screen bg-neutral-950 text-white overflow-hidden flex flex-col items-center justify-center">
      {/* Background Waves */}
      <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
        {aiSpeaking && (
          <>
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 2.5, opacity: 0 }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute w-96 h-96 rounded-full border border-emerald-500/50"
            />
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 2, opacity: 0 }}
              transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
              className="absolute w-80 h-80 rounded-full border border-teal-500/50"
            />
          </>
        )}
      </div>

      {/* Timer */}
      {recording && timeLeft > 0 && (
        <div className="absolute top-6 right-6 font-mono text-xl text-slate-400 border border-slate-700 px-4 py-2 rounded-lg bg-slate-900/50 backdrop-blur">
          {Math.floor(timeLeft / 60)}:
          {(timeLeft % 60).toString().padStart(2, "0")}
        </div>
      )}

      {/* Center AI Avatar */}
      <div className="z-10 flex flex-col items-center gap-8">
        <div
          className={clsx(
            "w-40 h-40 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center shadow-2xl transition-all duration-500",
            aiSpeaking
              ? "shadow-emerald-500/50 scale-110 border-2 border-emerald-500"
              : "border-2 border-slate-700",
          )}
        >
          <Cpu
            className={clsx(
              "w-20 h-20 transition-colors duration-300",
              aiSpeaking ? "text-emerald-400" : "text-slate-600",
            )}
          />
        </div>

        {!recording && !showEndModal && (
          <button
            onClick={() => {
              setConnecting(true);
              start().catch(() => setConnecting(false));
            }}
            disabled={connecting}
            className={clsx(
              "bg-emerald-600 hover:bg-emerald-500 px-8 py-3 rounded-full font-bold text-lg shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2",
              connecting && "opacity-75 cursor-not-allowed",
            )}
          >
            {connecting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Connecting...
              </>
            ) : (
              "Start Interview"
            )}
          </button>
        )}
      </div>

      {/* Subtitles */}
      <div className="absolute bottom-20 w-full max-w-3xl text-center px-6 min-h-[60px]">
        <AnimatePresence mode="wait">
          <motion.p
            key={currentSubtitle}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-2xl font-medium text-slate-200 drop-shadow-md"
          >
            {currentSubtitle || (aiSpeaking ? "..." : "")}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="absolute bottom-6 flex gap-4">
        {recording && (
          <>
            <button
              disabled
              className={clsx(
                "p-4 rounded-full transition-colors",
                aiSpeaking
                  ? "bg-slate-700 opacity-50 cursor-not-allowed"
                  : "bg-emerald-500/20 text-emerald-400 animate-pulse",
              )}
            >
              {aiSpeaking ? (
                <MicOff className="w-6 h-6" />
              ) : (
                <Mic className="w-6 h-6" />
              )}
            </button>
            <button
              onClick={handleEnd}
              className="p-4 rounded-full bg-red-600 hover:bg-red-500 text-white transition-colors shadow-lg shadow-red-500/20"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
          </>
        )}
      </div>

      {/* End Modal */}
      <AnimatePresence>
        {showEndModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl"
            >
              <div className="mx-auto w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
                <Cpu className="w-8 h-8 text-emerald-500" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Interview Completed
              </h2>
              <p className="text-slate-400 mb-8">
                Great job! Your feedback is being generated and will appear on
                your dashboard shortly.
              </p>
              <button
                onClick={handleEnd}
                className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl font-bold transition-all"
              >
                Return to Dashboard
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// "use client";

// import { useEffect, useRef, useState } from "react";
// import { Mic, MicOff, PhoneOff, Cpu } from "lucide-react";
// import { motion, AnimatePresence } from "framer-motion";
// import { AudioWorkletProcessor } from "@/utils/audioProcessor";
// import { useRouter } from "next/navigation";
// import clsx from "clsx";

// export default function InterviewRoom({ interviewId }: { interviewId: string }) {
//     const router = useRouter();
//     const [messages, setMessages] = useState<{ role: 'ai' | 'user', text: string }[]>([]);
//     const [recording, setRecording] = useState(false);
//     const [connecting, setConnecting] = useState(false);
//     const [aiSpeaking, setAiSpeaking] = useState(false);
//     const [currentSubtitle, setCurrentSubtitle] = useState("");
//     const [aiTextPending, setAiTextPending] = useState<string | null>(null);
//     const [timeLeft, setTimeLeft] = useState(0);
//     const [showEndModal, setShowEndModal] = useState(false);

//     const socketRef = useRef<WebSocket | null>(null);
//     const audioRef = useRef<AudioWorkletProcessor | null>(null);
//     const audioCtxRef = useRef<AudioContext | null>(null);
//     const nextPlayTimeRef = useRef<number>(0);
//     const aiLockedRef = useRef(true);

//     useEffect(() => {
//         return () => stop();
//     }, []);

//     useEffect(() => {
//         const fetchInfo = async () => {
//             try {
//                 const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/interview/${interviewId}`);
//                 const data = await res.json();
//                 if (data.duration) setTimeLeft(data.duration * 60);
//             } catch (e) { }
//         };
//         fetchInfo();
//     }, [interviewId]);

//     useEffect(() => {
//         if (!recording || timeLeft <= 0) return;
//         const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
//         return () => clearInterval(timer);
//     }, [recording, timeLeft]);

//     const start = async () => {
//         const ws = new WebSocket(`${process.env.NEXT_PUBLIC_BACKEND_URL?.replace('http', 'ws')}/ws/interview?interview_id=${interviewId}`);
//         ws.binaryType = "arraybuffer";
//         socketRef.current = ws;

//         ws.onopen = async () => {
//             if (!audioCtxRef.current) {
//                 const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
//                 audioCtxRef.current = new AudioCtx();
//                 if (audioCtxRef.current.state === 'suspended') {
//                     await audioCtxRef.current.resume();
//                 }

//                 try {
//                     await audioCtxRef.current.audioWorklet.addModule('/audio-worklet.js');
//                 } catch (e) { console.error("Worklet Load Failed", e); }
//             } else {
//                 if (audioCtxRef.current.state === 'suspended') {
//                     await audioCtxRef.current.resume();
//                 }
//             }

//             try {
//                 const stream = await navigator.mediaDevices.getUserMedia({
//                     audio: {
//                         echoCancellation: true,
//                         noiseSuppression: true,
//                         autoGainControl: true,
//                     }
//                 });

//                 const source = audioCtxRef.current.createMediaStreamSource(stream);
//                 const workletNode = new AudioWorkletNode(audioCtxRef.current, 'audio-input-processor');

//                 workletNode.port.onmessage = (e) => {
//                     if (!aiLockedRef.current && ws.readyState === WebSocket.OPEN) {
//                         const inputData = e.data;
//                         const inputSampleRate = audioCtxRef.current?.sampleRate || 48000;
//                         const targetSampleRate = 16000;

//                         let processedData = inputData;
//                         if (inputSampleRate !== targetSampleRate) {
//                             const ratio = inputSampleRate / targetSampleRate;
//                             const newLength = Math.floor(inputData.length / ratio);
//                             processedData = new Float32Array(newLength);
//                             for (let i = 0; i < newLength; i++) {
//                                 processedData[i] = inputData[Math.floor(i * ratio)];
//                             }
//                         }

//                         const int16Buffer = new Int16Array(processedData.length);
//                         for (let i = 0; i < processedData.length; i++) {
//                             const s = Math.max(-1, Math.min(1, processedData[i]));
//                             int16Buffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
//                         }

//                         ws.send(int16Buffer.buffer);
//                     }
//                 };

//                 source.connect(workletNode);
//                 const muteNode = audioCtxRef.current.createGain();
//                 muteNode.gain.value = 0;
//                 workletNode.connect(muteNode);
//                 muteNode.connect(audioCtxRef.current.destination);

//                 setRecording(true);
//                 setConnecting(false);
//                 setAiSpeaking(true);

//             } catch (e) {
//                 console.error(e);
//                 setConnecting(false);
//                 setRecording(false);
//                 alert("Microphone access failed. Please allow permissions.");
//                 ws.close();
//             }
//         };

//         ws.onmessage = async (e) => {
//             if (e.data instanceof ArrayBuffer) {
//                 try {
//                     const ctx = audioCtxRef.current;
//                     if (!ctx) return;
//                     const audioBuffer = await ctx.decodeAudioData(e.data.slice(0));
//                     const source = ctx.createBufferSource();
//                     source.buffer = audioBuffer;
//                     source.connect(ctx.destination);

//                     const start = Math.max(nextPlayTimeRef.current, ctx.currentTime);
//                     source.start(start);
//                     nextPlayTimeRef.current = start + audioBuffer.duration;

//                     setAiTextPending((pending) => {
//                         if (pending) {
//                             setCurrentSubtitle(pending);
//                             setMessages(prev => [...prev, { role: 'ai', text: pending }]);
//                             return null;
//                         }
//                         return null;
//                     });

//                     setAiSpeaking(true);
//                     aiLockedRef.current = true;

//                     source.onended = () => {
//                         if (ctx.currentTime + 0.2 >= nextPlayTimeRef.current) {
//                             setTimeout(() => {
//                                 if (ctx.currentTime + 0.2 >= nextPlayTimeRef.current) {
//                                     setCurrentSubtitle("");
//                                     aiLockedRef.current = false;
//                                     setAiSpeaking(false);
//                                 }
//                             }, 800);
//                         }
//                     };

//                 } catch (err) { console.warn(err); }
//                 return;
//             }

//             try {
//                 const data = JSON.parse(e.data);
//                 if (data.type === "ai_response") {
//                     aiLockedRef.current = true;
//                     setAiSpeaking(true);
//                     setAiTextPending(data.text);

//                     if (data.is_final) {
//                         setTimeout(() => {
//                             setShowEndModal(true);
//                             stop();
//                         }, 5000);
//                         return;
//                     }
//                 }
//                 if (data.type === "stt_partial") {
//                     // Update only if we are not currently displaying an AI response
//                     // to prevent visual flickering between AI and User text
//                     if (!aiLockedRef.current) {
//                         setCurrentSubtitle(data.text);
//                     }
//                 }
//                 if (data.type === "stt_final") {
//                     setMessages(prev => [...prev, { role: 'user', text: data.text }]);
//                     setCurrentSubtitle("");
//                 }
//             } catch (err) { }
//         };

//         ws.onclose = () => {
//             setRecording(false);
//             setAiSpeaking(false);
//         };
//     };

//     const stop = () => {
//         audioRef.current?.stop();
//         socketRef.current?.close();

//         audioCtxRef.current?.close().then(() => {
//             audioCtxRef.current = null;
//         });

//         setRecording(false);
//         setAiSpeaking(false);
//     };

//     const handleEnd = () => {
//         stop();
//         try {
//             const blob = new Blob([JSON.stringify({})], { type: 'application/json' });
//             const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/interview/${interviewId}/finish`;
//             navigator.sendBeacon(url, blob);
//         } catch (e) {
//             console.error("Beacon failed", e);
//         }
//         router.push("/dashboard");
//     };

//     return (
//         <div className="relative min-h-screen bg-neutral-950 text-white overflow-hidden flex flex-col items-center justify-center">
//             <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
//                 {aiSpeaking && (
//                     <>
//                         <motion.div
//                             initial={{ scale: 0.5, opacity: 0 }}
//                             animate={{ scale: 2.5, opacity: 0 }}
//                             transition={{ repeat: Infinity, duration: 2 }}
//                             className="absolute w-96 h-96 rounded-full border border-emerald-500/50"
//                         />
//                         <motion.div
//                             initial={{ scale: 0.5, opacity: 0 }}
//                             animate={{ scale: 2, opacity: 0 }}
//                             transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
//                             className="absolute w-80 h-80 rounded-full border border-teal-500/50"
//                         />
//                     </>
//                 )}
//             </div>

//             {recording && timeLeft > 0 && (
//                 <div className="absolute top-6 right-6 font-mono text-xl text-slate-400 border border-slate-700 px-4 py-2 rounded-lg bg-slate-900/50 backdrop-blur">
//                     {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
//                 </div>
//             )}

//             <div className="z-10 flex flex-col items-center gap-8">
//                 <div className={clsx(
//                     "w-40 h-40 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center shadow-2xl transition-all duration-500",
//                     aiSpeaking ? "shadow-emerald-500/50 scale-110 border-2 border-emerald-500" : "border-2 border-slate-700"
//                 )}>
//                     <Cpu className={clsx("w-20 h-20 transition-colors duration-300", aiSpeaking ? "text-emerald-400" : "text-slate-600")} />
//                 </div>

//                 {!recording && !showEndModal && (
//                     <button
//                         onClick={() => {
//                             setConnecting(true);
//                             start().catch(() => setConnecting(false));
//                         }}
//                         disabled={connecting}
//                         className={clsx(
//                             "bg-emerald-600 hover:bg-emerald-500 px-8 py-3 rounded-full font-bold text-lg shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2",
//                             connecting && "opacity-75 cursor-not-allowed"
//                         )}
//                     >
//                         {connecting ? (
//                             <>
//                                 <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
//                                 Connecting...
//                             </>
//                         ) : "Start Interview"}
//                     </button>
//                 )}
//             </div>

//             {/* FIXED SUBTITLES SECTION */}
//             <div className="absolute bottom-20 w-full max-w-3xl text-center px-6 min-h-[80px] flex items-center justify-center">
//                 <AnimatePresence mode="popLayout">
//                     {currentSubtitle ? (
//                         <motion.p
//                             key={currentSubtitle}
//                             initial={{ opacity: 0, y: 5 }}
//                             animate={{ opacity: 1, y: 0 }}
//                             exit={{ opacity: 0, y: -5 }}
//                             transition={{ duration: 0.15 }}
//                             className="text-2xl font-medium text-slate-200 drop-shadow-md"
//                         >
//                             {currentSubtitle}
//                         </motion.p>
//                     ) : aiSpeaking ? (
//                         <motion.div
//                             key="loader"
//                             initial={{ opacity: 0 }}
//                             animate={{ opacity: 1 }}
//                             className="flex gap-1"
//                         >
//                             <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
//                             <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
//                             <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></span>
//                         </motion.div>
//                     ) : null}
//                 </AnimatePresence>
//             </div>

//             <div className="absolute bottom-6 flex gap-4">
//                 {recording && (
//                     <>
//                         <button disabled className={clsx("p-4 rounded-full transition-colors", aiSpeaking ? "bg-slate-700 opacity-50 cursor-not-allowed" : "bg-emerald-500/20 text-emerald-400 animate-pulse")}>
//                             {aiSpeaking ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
//                         </button>
//                         <button onClick={handleEnd} className="p-4 rounded-full bg-red-600 hover:bg-red-500 text-white transition-colors shadow-lg shadow-red-500/20">
//                             <PhoneOff className="w-6 h-6" />
//                         </button>
//                     </>
//                 )}
//             </div>

//             <AnimatePresence>
//                 {showEndModal && (
//                     <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
//                         <motion.div
//                             initial={{ scale: 0.9, opacity: 0 }}
//                             animate={{ scale: 1, opacity: 1 }}
//                             className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl"
//                         >
//                             <div className="mx-auto w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
//                                 <Cpu className="w-8 h-8 text-emerald-500" />
//                             </div>
//                             <h2 className="text-2xl font-bold text-white mb-2">Interview Completed</h2>
//                             <p className="text-slate-400 mb-8">
//                                 Great job! Your feedback is being generated and will appear on your dashboard shortly.
//                             </p>
//                             <button
//                                 onClick={handleEnd}
//                                 className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl font-bold transition-all"
//                             >
//                                 Return to Dashboard
//                             </button>
//                         </motion.div>
//                     </div>
//                 )}
//             </AnimatePresence>
//         </div>
//     );
// }

// "use client";

// import { useEffect, useRef, useState } from "react";
// import { Mic, MicOff, PhoneOff, Cpu } from "lucide-react";
// import { motion, AnimatePresence } from "framer-motion";
// import { AudioWorkletProcessor } from "@/utils/audioProcessor";
// import { useRouter } from "next/navigation";
// import clsx from "clsx";

// export default function InterviewRoom({ interviewId }: { interviewId: string }) {
//     const router = useRouter();
//     const [messages, setMessages] = useState<{ role: 'ai' | 'user', text: string }[]>([]);
//     const [recording, setRecording] = useState(false);
//     const [connecting, setConnecting] = useState(false);
//     const [aiSpeaking, setAiSpeaking] = useState(false);
//     const [currentSubtitle, setCurrentSubtitle] = useState("");
//     const [aiTextPending, setAiTextPending] = useState<string | null>(null);
//     const [timeLeft, setTimeLeft] = useState(0);
//     const [showEndModal, setShowEndModal] = useState(false);

//     const socketRef = useRef<WebSocket | null>(null);
//     const audioRef = useRef<AudioWorkletProcessor | null>(null);
//     const audioCtxRef = useRef<AudioContext | null>(null);
//     const nextPlayTimeRef = useRef<number>(0);
//     const aiLockedRef = useRef(true); // Start locked (Muted)

//     useEffect(() => {
//         return () => stop();
//     }, []);

//     useEffect(() => {
//         // Fetch duration to init timer
//         const fetchInfo = async () => {
//             try {
//                 const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/interview/${interviewId}`);
//                 const data = await res.json();
//                 if (data.duration) setTimeLeft(data.duration * 60);
//             } catch (e) { }
//         };
//         fetchInfo();
//     }, [interviewId]);

//     useEffect(() => {
//         if (!recording || timeLeft <= 0) return;
//         const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
//         return () => clearInterval(timer);
//     }, [recording, timeLeft]);

//     // --- FIX: Watchdog to prevent stuck subtitles ---
//     useEffect(() => {
//         if (!aiSpeaking) return;

//         const interval = setInterval(() => {
//             const ctx = audioCtxRef.current;
//             // If context is gone, or we are past the play time by a buffer (0.5s), force clear
//             if (ctx && nextPlayTimeRef.current > 0 && ctx.currentTime > nextPlayTimeRef.current + 0.5) {
//                 // Double check we haven't just received a new chunk (in case of race condition)
//                 if (ctx.currentTime > nextPlayTimeRef.current + 0.5) {
//                     setAiSpeaking(false);
//                     setCurrentSubtitle("");
//                     aiLockedRef.current = false;
//                 }
//             }
//         }, 500);

//         return () => clearInterval(interval);
//     }, [aiSpeaking]);
//     // ------------------------------------------------

//     const start = async () => {
//         const ws = new WebSocket(`${process.env.NEXT_PUBLIC_BACKEND_URL?.replace('http', 'ws')}/ws/interview?interview_id=${interviewId}`);
//         ws.binaryType = "arraybuffer";
//         socketRef.current = ws;

//         ws.onopen = async () => {
//             // Init Audio Context
//             if (!audioCtxRef.current) {
//                 const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
//                 audioCtxRef.current = new AudioCtx();
//                 // Resume if suspended (browser policy)
//                 if (audioCtxRef.current.state === 'suspended') {
//                     await audioCtxRef.current.resume();
//                 }

//                 // Load Worklet
//                 try {
//                     await audioCtxRef.current.audioWorklet.addModule('/audio-worklet.js');
//                 } catch (e) { console.error("Worklet Load Failed", e); }
//             } else {
//                 if (audioCtxRef.current.state === 'suspended') {
//                     await audioCtxRef.current.resume();
//                 }
//             }

//             // Mic Stream
//             try {
//                 const stream = await navigator.mediaDevices.getUserMedia({
//                     audio: {
//                         echoCancellation: true,
//                         noiseSuppression: true,
//                         autoGainControl: true,
//                     }
//                 });

//                 const source = audioCtxRef.current.createMediaStreamSource(stream);
//                 const workletNode = new AudioWorkletNode(audioCtxRef.current, 'audio-input-processor');

//                 // BUFFERING & CONVERSION
//                 workletNode.port.onmessage = (e) => {
//                     if (!aiLockedRef.current && ws.readyState === WebSocket.OPEN) {
//                         const inputData = e.data; // Float32Array
//                         const inputSampleRate = audioCtxRef.current?.sampleRate || 48000;
//                         const targetSampleRate = 16000;

//                         // Simple Downsampling if needed
//                         let processedData = inputData;
//                         if (inputSampleRate !== targetSampleRate) {
//                             const ratio = inputSampleRate / targetSampleRate;
//                             const newLength = Math.floor(inputData.length / ratio);
//                             processedData = new Float32Array(newLength);
//                             for (let i = 0; i < newLength; i++) {
//                                 // Simple decimation (can be improved with averaging)
//                                 processedData[i] = inputData[Math.floor(i * ratio)];
//                             }
//                         }

//                         // Convert to Int16
//                         const int16Buffer = new Int16Array(processedData.length);
//                         for (let i = 0; i < processedData.length; i++) {
//                             const s = Math.max(-1, Math.min(1, processedData[i]));
//                             int16Buffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
//                         }

//                         ws.send(int16Buffer.buffer);
//                     }
//                 };

//                 source.connect(workletNode);
//                 // Workaround: Connect to a GainNode with gain 0, then to destination, to prevent feedback and keep node alive.
//                 const muteNode = audioCtxRef.current.createGain();
//                 muteNode.gain.value = 0;
//                 workletNode.connect(muteNode);
//                 muteNode.connect(audioCtxRef.current.destination);

//                 // --- SUCCESS ---
//                 setRecording(true);
//                 setConnecting(false);
//                 setAiSpeaking(true); // START SPEAKING (Pending Audio) -> Mutes Mic Visually

//             } catch (e) {
//                 console.error(e);
//                 setConnecting(false);
//                 setRecording(false);
//                 alert("Microphone access failed. Please allow permissions.");
//                 ws.close();
//             }
//         };

//         // ... (rest of start function) ...

//         ws.onmessage = async (e) => {
//             // Audio
//             if (e.data instanceof ArrayBuffer) {
//                 try {
//                     const ctx = audioCtxRef.current;
//                     if (!ctx) return;
//                     const audioBuffer = await ctx.decodeAudioData(e.data.slice(0));
//                     const source = ctx.createBufferSource();
//                     source.buffer = audioBuffer;
//                     source.connect(ctx.destination);

//                     const start = Math.max(nextPlayTimeRef.current, ctx.currentTime);
//                     source.start(start);
//                     nextPlayTimeRef.current = start + audioBuffer.duration;

//                     // SYNC: Show text when audio starts playing
//                     setAiTextPending((pending) => {
//                         if (pending) {
//                             setCurrentSubtitle(pending);
//                             setMessages(prev => [...prev, { role: 'ai', text: pending }]);
//                             return null;
//                         }
//                         return null;
//                     });

//                     setAiSpeaking(true);
//                     aiLockedRef.current = true; // LOCK INPUT while audio plays

//                     source.onended = () => {
//                         // Keep existing logic as first line of defense,
//                         // but rely on Watchdog useEffect for robust cleanup.
//                         if (ctx.currentTime + 0.2 >= nextPlayTimeRef.current) {
//                             setTimeout(() => {
//                                 if (ctx.currentTime + 0.2 >= nextPlayTimeRef.current) {
//                                     setCurrentSubtitle("");
//                                     aiLockedRef.current = false;
//                                     setAiSpeaking(false);
//                                 }
//                             }, 800);
//                         }
//                     };

//                 } catch (err) { console.warn(err); }
//                 return;
//             }

//             // JSON
//             try {
//                 const data = JSON.parse(e.data);
//                 if (data.type === "ai_response") {
//                     aiLockedRef.current = true;
//                     setAiSpeaking(true);

//                     setAiTextPending(data.text);

//                     if (data.is_final) {
//                         setTimeout(() => {
//                             setShowEndModal(true);
//                             stop();
//                         }, 5000);
//                         return;
//                     }
//                 }
//                 if (data.type === "stt_partial") {
//                     // Only update STT if AI isn't speaking (avoids echo showing as text)
//                     if (!aiSpeaking) {
//                         setCurrentSubtitle(data.text);
//                     }
//                 }
//                 if (data.type === "stt_final") {
//                     setMessages(prev => [...prev, { role: 'user', text: data.text }]);
//                     setCurrentSubtitle("");
//                 }
//             } catch (err) { }
//         };

//         ws.onclose = () => {
//             setRecording(false);
//             setAiSpeaking(false);
//         };
//     };

//     const stop = () => {
//         audioRef.current?.stop();
//         socketRef.current?.close();

//         // Kill Audio Context
//         audioCtxRef.current?.close().then(() => {
//             audioCtxRef.current = null;
//         });

//         setRecording(false);
//         setAiSpeaking(false);
//     };

//     const handleEnd = () => {
//         stop();
//         // Robust Termination using Beacon
//         try {
//             const blob = new Blob([JSON.stringify({})], { type: 'application/json' });
//             const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/interview/${interviewId}/finish`;
//             navigator.sendBeacon(url, blob);
//         } catch (e) {
//             console.error("Beacon failed", e);
//         }
//         router.push("/dashboard");
//     };

//     return (
//         <div className="relative min-h-screen bg-neutral-950 text-white overflow-hidden flex flex-col items-center justify-center">
//             {/* Background Waves */}
//             <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
//                 {aiSpeaking && (
//                     <>
//                         <motion.div
//                             initial={{ scale: 0.5, opacity: 0 }}
//                             animate={{ scale: 2.5, opacity: 0 }}
//                             transition={{ repeat: Infinity, duration: 2 }}
//                             className="absolute w-96 h-96 rounded-full border border-emerald-500/50"
//                         />
//                         <motion.div
//                             initial={{ scale: 0.5, opacity: 0 }}
//                             animate={{ scale: 2, opacity: 0 }}
//                             transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
//                             className="absolute w-80 h-80 rounded-full border border-teal-500/50"
//                         />
//                     </>
//                 )}
//             </div>

//             {/* Timer */}
//             {recording && timeLeft > 0 && (
//                 <div className="absolute top-6 right-6 font-mono text-xl text-slate-400 border border-slate-700 px-4 py-2 rounded-lg bg-slate-900/50 backdrop-blur">
//                     {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
//                 </div>
//             )}

//             {/* Center AI Avatar */}
//             <div className="z-10 flex flex-col items-center gap-8">
//                 <div className={clsx(
//                     "w-40 h-40 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center shadow-2xl transition-all duration-500",
//                     aiSpeaking ? "shadow-emerald-500/50 scale-110 border-2 border-emerald-500" : "border-2 border-slate-700"
//                 )}>
//                     <Cpu className={clsx("w-20 h-20 transition-colors duration-300", aiSpeaking ? "text-emerald-400" : "text-slate-600")} />
//                 </div>

//                 {!recording && !showEndModal && (
//                     <button
//                         onClick={() => {
//                             setConnecting(true);
//                             start().catch(() => setConnecting(false));
//                         }}
//                         disabled={connecting}
//                         className={clsx(
//                             "bg-emerald-600 hover:bg-emerald-500 px-8 py-3 rounded-full font-bold text-lg shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2",
//                             connecting && "opacity-75 cursor-not-allowed"
//                         )}
//                     >
//                         {connecting ? (
//                             <>
//                                 <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
//                                 Connecting...
//                             </>
//                         ) : "Start Interview"}
//                     </button>
//                 )}
//             </div>

//             {/* Subtitles */}
//             <div className="absolute bottom-20 w-full max-w-3xl text-center px-6 min-h-[60px]">
//                 <AnimatePresence mode="wait">
//                     <motion.p
//                         key={currentSubtitle}
//                         initial={{ opacity: 0, y: 10 }}
//                         animate={{ opacity: 1, y: 0 }}
//                         exit={{ opacity: 0, y: -10 }}
//                         className="text-2xl font-medium text-slate-200 drop-shadow-md"
//                     >
//                         {currentSubtitle || (aiSpeaking ? "..." : "")}
//                     </motion.p>
//                 </AnimatePresence>
//             </div>

//             {/* Controls */}
//             <div className="absolute bottom-6 flex gap-4">
//                 {recording && (
//                     <>
//                         <button disabled className={clsx("p-4 rounded-full transition-colors", aiSpeaking ? "bg-slate-700 opacity-50 cursor-not-allowed" : "bg-emerald-500/20 text-emerald-400 animate-pulse")}>
//                             {aiSpeaking ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
//                         </button>
//                         <button onClick={handleEnd} className="p-4 rounded-full bg-red-600 hover:bg-red-500 text-white transition-colors shadow-lg shadow-red-500/20">
//                             <PhoneOff className="w-6 h-6" />
//                         </button>
//                     </>
//                 )}
//             </div>

//             {/* End Modal */}
//             <AnimatePresence>
//                 {showEndModal && (
//                     <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
//                         <motion.div
//                             initial={{ scale: 0.9, opacity: 0 }}
//                             animate={{ scale: 1, opacity: 1 }}
//                             className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl"
//                         >
//                             <div className="mx-auto w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
//                                 <Cpu className="w-8 h-8 text-emerald-500" />
//                             </div>
//                             <h2 className="text-2xl font-bold text-white mb-2">Interview Completed</h2>
//                             <p className="text-slate-400 mb-8">
//                                 Great job! Your feedback is being generated and will appear on your dashboard shortly.
//                             </p>
//                             <button
//                                 onClick={handleEnd}
//                                 className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl font-bold transition-all"
//                             >
//                                 Return to Dashboard
//                             </button>
//                         </motion.div>
//                     </div>
//                 )}
//             </AnimatePresence>
//         </div>
//     );
// }

// "use client";

// import { useEffect, useRef, useState } from "react";
// import { Mic, MicOff, PhoneOff, Cpu } from "lucide-react";
// import { motion, AnimatePresence } from "framer-motion";
// import { AudioWorkletProcessor } from "@/utils/audioProcessor";
// import { useRouter } from "next/navigation";
// import clsx from "clsx";

// export default function InterviewRoom({ interviewId }: { interviewId: string }) {
//     const router = useRouter();
//     const [messages, setMessages] = useState<{ role: 'ai' | 'user', text: string }[]>([]);
//     const [recording, setRecording] = useState(false);
//     const [connecting, setConnecting] = useState(false);
//     const [aiSpeaking, setAiSpeaking] = useState(false);
//     const [currentSubtitle, setCurrentSubtitle] = useState("");
//     const [aiTextPending, setAiTextPending] = useState<string | null>(null);
//     const [timeLeft, setTimeLeft] = useState(0);
//     const [showEndModal, setShowEndModal] = useState(false);

//     const socketRef = useRef<WebSocket | null>(null);
//     const audioRef = useRef<AudioWorkletProcessor | null>(null);
//     const audioCtxRef = useRef<AudioContext | null>(null);
//     const nextPlayTimeRef = useRef<number>(0);
//     const aiLockedRef = useRef(true); // Start locked (Muted)

//     useEffect(() => {
//         return () => stop();
//     }, []);

//     useEffect(() => {
//         // Fetch duration to init timer
//         const fetchInfo = async () => {
//             try {
//                 const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/interview/${interviewId}`);
//                 const data = await res.json();
//                 if (data.duration) setTimeLeft(data.duration * 60);
//             } catch (e) { }
//         };
//         fetchInfo();
//     }, [interviewId]);

//     // --- 1. TIMER AUTO-END LOGIC ---
//     useEffect(() => {
//         if (!recording || showEndModal) return;

//         if (timeLeft <= 0) {
//             // Timer finished: Stop recording and show modal
//             stop();
//             setShowEndModal(true);
//             return;
//         }

//         const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
//         return () => clearInterval(timer);
//     }, [recording, timeLeft, showEndModal]);

//     // --- 2. & 3. FIXED BLINKING & REDUCED LATENCY ---
//     // Instead of onEnded, we poll audio status quickly to keep state stable
//     useEffect(() => {
//         if (!aiSpeaking && !aiLockedRef.current) return;

//         const interval = setInterval(() => {
//             const ctx = audioCtxRef.current;

//             // Safety check: if context is missing, stop speaking state
//             if (!ctx) return;

//             // If current time > next scheduled play time + small buffer (150ms)
//             // We consider the AI finished.
//             // Reduced buffer from 800ms -> 150ms for snappy response.
//             if (nextPlayTimeRef.current > 0 && ctx.currentTime > nextPlayTimeRef.current + 0.15) {
//                 // Only update state if we haven't already
//                 if (aiLockedRef.current) {
//                     setAiSpeaking(false);
//                     setCurrentSubtitle("");
//                     aiLockedRef.current = false;
//                 }
//             }
//         }, 100); // Check every 100ms for smoothness

//         return () => clearInterval(interval);
//     }, [aiSpeaking]);

//     const start = async () => {
//         const ws = new WebSocket(`${process.env.NEXT_PUBLIC_BACKEND_URL?.replace('http', 'ws')}/ws/interview?interview_id=${interviewId}`);
//         ws.binaryType = "arraybuffer";
//         socketRef.current = ws;

//         ws.onopen = async () => {
//             // Init Audio Context
//             if (!audioCtxRef.current) {
//                 const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
//                 audioCtxRef.current = new AudioCtx();
//                 if (audioCtxRef.current.state === 'suspended') {
//                     await audioCtxRef.current.resume();
//                 }
//                 try {
//                     await audioCtxRef.current.audioWorklet.addModule('/audio-worklet.js');
//                 } catch (e) { console.error("Worklet Load Failed", e); }
//             } else {
//                 if (audioCtxRef.current.state === 'suspended') {
//                     await audioCtxRef.current.resume();
//                 }
//             }

//             // Mic Stream
//             try {
//                 const stream = await navigator.mediaDevices.getUserMedia({
//                     audio: {
//                         echoCancellation: true,
//                         noiseSuppression: true,
//                         autoGainControl: true,
//                     }
//                 });

//                 const source = audioCtxRef.current.createMediaStreamSource(stream);
//                 const workletNode = new AudioWorkletNode(audioCtxRef.current, 'audio-input-processor');

//                 workletNode.port.onmessage = (e) => {
//                     // Only send data if AI is NOT locked (Not speaking)
//                     if (!aiLockedRef.current && ws.readyState === WebSocket.OPEN) {
//                         const inputData = e.data;
//                         const inputSampleRate = audioCtxRef.current?.sampleRate || 48000;
//                         const targetSampleRate = 16000;

//                         let processedData = inputData;
//                         if (inputSampleRate !== targetSampleRate) {
//                             const ratio = inputSampleRate / targetSampleRate;
//                             const newLength = Math.floor(inputData.length / ratio);
//                             processedData = new Float32Array(newLength);
//                             for (let i = 0; i < newLength; i++) {
//                                 processedData[i] = inputData[Math.floor(i * ratio)];
//                             }
//                         }

//                         const int16Buffer = new Int16Array(processedData.length);
//                         for (let i = 0; i < processedData.length; i++) {
//                             const s = Math.max(-1, Math.min(1, processedData[i]));
//                             int16Buffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
//                         }

//                         ws.send(int16Buffer.buffer);
//                     }
//                 };

//                 source.connect(workletNode);
//                 const muteNode = audioCtxRef.current.createGain();
//                 muteNode.gain.value = 0;
//                 workletNode.connect(muteNode);
//                 muteNode.connect(audioCtxRef.current.destination);

//                 setRecording(true);
//                 setConnecting(false);
//                 setAiSpeaking(true);

//             } catch (e) {
//                 console.error(e);
//                 setConnecting(false);
//                 setRecording(false);
//                 alert("Microphone access failed. Please allow permissions.");
//                 ws.close();
//             }
//         };

//         ws.onmessage = async (e) => {
//             // Audio Handling
//             if (e.data instanceof ArrayBuffer) {
//                 try {
//                     const ctx = audioCtxRef.current;
//                     if (!ctx) return;
//                     const audioBuffer = await ctx.decodeAudioData(e.data.slice(0));
//                     const source = ctx.createBufferSource();
//                     source.buffer = audioBuffer;
//                     source.connect(ctx.destination);

//                     // Robust Time Scheduling to prevent gaps/blinking
//                     const currentTime = ctx.currentTime;
//                     // If nextPlayTime is in the past, reset it to now
//                     const startAt = Math.max(nextPlayTimeRef.current, currentTime);

//                     source.start(startAt);
//                     nextPlayTimeRef.current = startAt + audioBuffer.duration;

//                     // UI Updates
//                     setAiTextPending((pending) => {
//                         if (pending) {
//                             setCurrentSubtitle(pending);
//                             setMessages(prev => [...prev, { role: 'ai', text: pending }]);
//                             return null;
//                         }
//                         return null;
//                     });

//                     // Force state to speaking
//                     setAiSpeaking(true);
//                     aiLockedRef.current = true;

//                     // Note: We removed source.onended here.
//                     // The useEffect interval handles the "End" state now.
//                     // This prevents the blinking caused by events firing between chunks.

//                 } catch (err) { console.warn(err); }
//                 return;
//             }

//             // JSON Handling
//             try {
//                 const data = JSON.parse(e.data);
//                 if (data.type === "ai_response") {
//                     aiLockedRef.current = true;
//                     setAiSpeaking(true);
//                     setAiTextPending(data.text);

//                     if (data.is_final) {
//                         setTimeout(() => {
//                             setShowEndModal(true);
//                             stop();
//                         }, 2000); // Reduced final wait time
//                         return;
//                     }
//                 }
//                 if (data.type === "stt_partial") {
//                     if (!aiSpeaking) {
//                         setCurrentSubtitle(data.text);
//                     }
//                 }
//                 if (data.type === "stt_final") {
//                     setMessages(prev => [...prev, { role: 'user', text: data.text }]);
//                     setCurrentSubtitle("");
//                 }
//             } catch (err) { }
//         };

//         ws.onclose = () => {
//             setRecording(false);
//             setAiSpeaking(false);
//         };
//     };

//     const stop = () => {
//         audioRef.current?.stop();
//         socketRef.current?.close();

//         // Kill Audio Context to release hardware
//         if (audioCtxRef.current) {
//             audioCtxRef.current.close().then(() => {
//                 audioCtxRef.current = null;
//             }).catch(() => { });
//         }

//         setRecording(false);
//         setAiSpeaking(false);
//     };

//     const handleEnd = () => {
//         stop();
//         // Robust Termination using Beacon
//         try {
//             const blob = new Blob([JSON.stringify({})], { type: 'application/json' });
//             const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/interview/${interviewId}/finish`;
//             navigator.sendBeacon(url, blob);
//         } catch (e) {
//             console.error("Beacon failed", e);
//         }
//         router.push("/dashboard");
//     };

//     return (
//         <div className="relative min-h-screen bg-neutral-950 text-white overflow-hidden flex flex-col items-center justify-center">
//             {/* Background Waves */}
//             <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
//                 {aiSpeaking && (
//                     <>
//                         <motion.div
//                             initial={{ scale: 0.5, opacity: 0 }}
//                             animate={{ scale: 2.5, opacity: 0 }}
//                             transition={{ repeat: Infinity, duration: 2 }}
//                             className="absolute w-96 h-96 rounded-full border border-emerald-500/50"
//                         />
//                         <motion.div
//                             initial={{ scale: 0.5, opacity: 0 }}
//                             animate={{ scale: 2, opacity: 0 }}
//                             transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
//                             className="absolute w-80 h-80 rounded-full border border-teal-500/50"
//                         />
//                     </>
//                 )}
//             </div>

//             {/* Timer */}
//             {recording && timeLeft > 0 && (
//                 <div className="absolute top-6 right-6 font-mono text-xl text-slate-400 border border-slate-700 px-4 py-2 rounded-lg bg-slate-900/50 backdrop-blur">
//                     {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
//                 </div>
//             )}

//             {/* Center AI Avatar */}
//             <div className="z-10 flex flex-col items-center gap-8">
//                 <div className={clsx(
//                     "w-40 h-40 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center shadow-2xl transition-all duration-500",
//                     aiSpeaking ? "shadow-emerald-500/50 scale-110 border-2 border-emerald-500" : "border-2 border-slate-700"
//                 )}>
//                     <Cpu className={clsx("w-20 h-20 transition-colors duration-300", aiSpeaking ? "text-emerald-400" : "text-slate-600")} />
//                 </div>

//                 {!recording && !showEndModal && (
//                     <button
//                         onClick={() => {
//                             setConnecting(true);
//                             start().catch(() => setConnecting(false));
//                         }}
//                         disabled={connecting}
//                         className={clsx(
//                             "bg-emerald-600 hover:bg-emerald-500 px-8 py-3 rounded-full font-bold text-lg shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2",
//                             connecting && "opacity-75 cursor-not-allowed"
//                         )}
//                     >
//                         {connecting ? (
//                             <>
//                                 <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
//                                 Connecting...
//                             </>
//                         ) : "Start Interview"}
//                     </button>
//                 )}
//             </div>

//             {/* Subtitles */}
//             <div className="absolute bottom-20 w-full max-w-3xl text-center px-6 min-h-[60px]">
//                 <AnimatePresence mode="wait">
//                     <motion.p
//                         key={currentSubtitle}
//                         initial={{ opacity: 0, y: 10 }}
//                         animate={{ opacity: 1, y: 0 }}
//                         exit={{ opacity: 0, y: -10 }}
//                         className="text-2xl font-medium text-slate-200 drop-shadow-md"
//                     >
//                         {currentSubtitle || (aiSpeaking ? "..." : "")}
//                     </motion.p>
//                 </AnimatePresence>
//             </div>

//             {/* Controls */}
//             <div className="absolute bottom-6 flex gap-4">
//                 {recording && (
//                     <>
//                         <button disabled className={clsx("p-4 rounded-full transition-colors", aiSpeaking ? "bg-slate-700 opacity-50 cursor-not-allowed" : "bg-emerald-500/20 text-emerald-400 animate-pulse")}>
//                             {aiSpeaking ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
//                         </button>
//                         <button onClick={handleEnd} className="p-4 rounded-full bg-red-600 hover:bg-red-500 text-white transition-colors shadow-lg shadow-red-500/20">
//                             <PhoneOff className="w-6 h-6" />
//                         </button>
//                     </>
//                 )}
//             </div>

//             {/* End Modal */}
//             <AnimatePresence>
//                 {showEndModal && (
//                     <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
//                         <motion.div
//                             initial={{ scale: 0.9, opacity: 0 }}
//                             animate={{ scale: 1, opacity: 1 }}
//                             className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl"
//                         >
//                             <div className="mx-auto w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
//                                 <Cpu className="w-8 h-8 text-emerald-500" />
//                             </div>
//                             <h2 className="text-2xl font-bold text-white mb-2">Interview Completed</h2>
//                             <p className="text-slate-400 mb-8">
//                                 Great job! Your feedback is being generated and will appear on your dashboard shortly.
//                             </p>
//                             <button
//                                 onClick={handleEnd}
//                                 className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl font-bold transition-all"
//                             >
//                                 Return to Dashboard
//                             </button>
//                         </motion.div>
//                     </div>
//                 )}
//             </AnimatePresence>
//         </div>
//     );
// }
