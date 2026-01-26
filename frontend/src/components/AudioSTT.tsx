// 'use client';

// import { useRef, useState } from 'react';
// import { Mic, MicOff } from 'lucide-react';
// import { AudioWorkletProcessor } from '@/utils/audioProcessor';

// export default function Home() {
//   const [messages, setMessages] = useState<string[]>([]);
//   const [recording, setRecording] = useState(false);

//   const socketRef = useRef<WebSocket | null>(null);
//   const audioRef = useRef<AudioWorkletProcessor | null>(null);
//   const aiLockedRef = useRef(false);

//   const start = async () => {
//     const ws = new WebSocket('ws://localhost:8000/ws/interview');
//     socketRef.current = ws;

//     ws.onopen = async () => {
//       audioRef.current = new AudioWorkletProcessor();
//       await audioRef.current.start((blob) => {
//         if (ws.readyState === WebSocket.OPEN && !aiLockedRef.current) {
//           ws.send(blob);
//         }
//       });
//       setRecording(true);
//     };

//     ws.onmessage = (e) => {
//       const data = JSON.parse(e.data);

//       if (data.type === "ai_response") {
//         aiLockedRef.current = true;
//         setMessages((m) => [...m, `🤖 ${data.text}`]);

//         const readingTimeMs = (data.reading_time ?? 3) * 1000;

//         setTimeout(() => {
//           aiLockedRef.current = false;
//         }, readingTimeMs);
//       }

//       if (data.type === "stt_final") {
//         setMessages((m) => [...m, `🧑 ${data.text}`]);
//       }
//     };

//     ws.onclose = stop;
//   };

//   const stop = () => {
//     audioRef.current?.stop();
//     socketRef.current?.close();
//     setRecording(false);
//   };

//   return (
//     <main className="p-10 bg-slate-950 text-white min-h-screen">
//       <button
//         onClick={recording ? stop : start}
//         className="bg-emerald-500 px-6 py-3 rounded flex gap-2"
//       >
//         {recording ? <MicOff /> : <Mic />}
//         {recording ? "Stop" : "Start"}
//       </button>

//       <div className="mt-6 space-y-2">
//         {messages.map((m, i) => (
//           <p key={i}>{m}</p>
//         ))}
//       </div>
//     </main>
//   );
// }

"use client";
import { useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { AudioWorkletProcessor } from "@/utils/audioProcessor";

export default function Home() {
  const [messages, setMessages] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const audioRef = useRef<AudioWorkletProcessor | null>(null);

  // Web Audio refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);

  const aiLockedRef = useRef(false);

  const start = async () => {
    const ws = new WebSocket("ws://localhost:8000/ws/interview");
    ws.binaryType = "arraybuffer";
    socketRef.current = ws;

    ws.onopen = async () => {
      audioRef.current = new AudioWorkletProcessor();
      await audioRef.current.start((blob) => {
        if (!aiLockedRef.current && ws.readyState === WebSocket.OPEN) {
          ws.send(blob);
        }
      });

      // Initialize AudioContext once
      if (!audioCtxRef.current) {
        const AudioCtx =
          window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AudioCtx();
      }

      // Reset playback clock
      nextPlayTimeRef.current = audioCtxRef.current.currentTime;

      setRecording(true);
    };

    ws.onmessage = async (e) => {
      // 🔊 AUDIO CHUNK (ArrayBuffer)
      if (e.data instanceof ArrayBuffer) {
        try {
          const audioCtx = audioCtxRef.current;
          if (!audioCtx) return;

          // Decode audio data (WAV)
          const audioBuffer = await audioCtx.decodeAudioData(
            e.data.slice(0)
          );

          const source = audioCtx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioCtx.destination);

          // Schedule sequential playback
          const startTime = Math.max(
            nextPlayTimeRef.current,
            audioCtx.currentTime
          );

          source.start(startTime);

          // Update next playback time
          nextPlayTimeRef.current = startTime + audioBuffer.duration;
        } catch (err) {
          console.warn("Audio playback error:", err);
        }
        return;
      }

      // 📩 JSON MESSAGE
      let data;
      try {
        data = JSON.parse(e.data);
      } catch {
        return;
      }

      if (data.type === "ai_response") {
        aiLockedRef.current = true;
        setMessages((m) => [...m, `🤖 ${data.text}`]);

        setTimeout(() => {
          aiLockedRef.current = false;
        }, (data.reading_time ?? 3) * 1000);
      }

      if (data.type === "stt_partial") {
        setMessages((m) => {
          const last = m[m.length - 1];
          if (last?.startsWith("🧑")) {
            return [...m.slice(0, -1), `🧑 ${data.text}`];
          }
          return [...m, `🧑 ${data.text}`];
        });
      }

      if (data.type === "stt_final") {
        setMessages((m) => [...m, `🧑 ${data.text}`]);
      }
    };

    ws.onclose = stop;
    ws.onerror = stop;
  };

  const stop = () => {
    audioRef.current?.stop();
    socketRef.current?.close();
    setRecording(false);
  };

  return (
    <main className="p-10 bg-slate-950 text-white min-h-screen">
      <button
        onClick={recording ? stop : start}
        className="bg-emerald-500 px-6 py-3 rounded flex gap-2"
      >
        {recording ? <MicOff /> : <Mic />}
        {recording ? "Stop" : "Start"}
      </button>

      <div className="mt-6 space-y-2">
        {messages.map((m, i) => (
          <p key={i}>{m}</p>
        ))}
      </div>
    </main>
  );
}
