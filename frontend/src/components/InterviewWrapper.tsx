"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Mic, BarChart, CheckCircle, AlertCircle, Calendar } from "lucide-react";
import InterviewRoom from "./InterviewRoom";

export default function InterviewWrapper({ interviewId }: { interviewId: string }) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchInfo = async () => {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/interview/${interviewId}`);
                const json = await res.json();
                setData(json);
            } catch (e) { }
            setLoading(false);
        };
        fetchInfo();
    }, [interviewId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-emerald-500">
                    <div className="w-12 h-12 border-4 border-current border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-400 font-medium">Loading Interview...</p>
                </div>
            </div>
        );
    }

    // If Interview is COMPLETED, show Feedback
    if (data?.status === "COMPLETED") {
        const fb = data.feedback;
        return (
            <div className="min-h-screen bg-slate-950 text-white p-8 overflow-y-auto">
                <div className="max-w-4xl mx-auto space-y-8">
                    <header className="text-center mb-10">
                        <h1 className="text-3xl font-bold text-emerald-400 mb-2">Interview Report</h1>
                        <p className="text-slate-400 text-lg">{data.topic} • {data.difficulty}</p>
                    </header>

                    {/* Overall Score Card */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-center md:col-span-1 flex flex-col items-center justify-center">
                            <div className="w-24 h-24 rounded-full border-4 border-emerald-500 flex items-center justify-center text-3xl font-bold text-white mb-2">
                                {fb?.rating || "?"}
                            </div>
                            <p className="text-slate-400">Overall Rating</p>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl md:col-span-3 space-y-6">
                            <h3 className="text-xl font-semibold border-b border-slate-800 pb-4">Detailed Breakdown</h3>
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <ScoreItem label="English" score={fb?.englishScore} />
                                <ScoreItem label="Technical" score={fb?.technicalScore} />
                                <ScoreItem label="Communication" score={fb?.communicationScore} />
                            </div>
                        </div>
                    </div>

                    {/* Feedback Text */}
                    <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl">
                        <h3 className="text-xl font-semibold mb-4 text-white">AI Analysis</h3>
                        <div className="prose prose-invert max-w-none text-slate-300 leading-relaxed">
                            {fb?.feedbackText ? fb.feedbackText.split('\n').map((line: string, i: number) => (
                                <p key={i}>{line}</p>
                            )) : (
                                <div className="flex items-center gap-2 text-yellow-400 bg-yellow-400/10 p-4 rounded-lg">
                                    <AlertCircle size={20} />
                                    <span>Feedback is currently generating. Please refresh in a moment.</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Transcript */}
                    <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl">
                        <h3 className="text-xl font-semibold mb-6">Transcript</h3>
                        <div className="space-y-6">
                            {data.questions.map((q: any, i: number) => (
                                <div key={q.id} className="space-y-2">
                                    <div className="flex gap-4">
                                        <div className="min-w-[40px] pt-1">
                                            <div className="w-8 h-8 rounded bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-xs font-bold">AI</div>
                                        </div>
                                        <p className="text-slate-300 bg-slate-800/50 p-3 rounded-lg rounded-tl-none">{q.question}</p>
                                    </div>
                                    {q.userAnswer && (
                                        <div className="flex gap-4 flex-row-reverse">
                                            <div className="min-w-[40px] pt-1">
                                                <div className="w-8 h-8 rounded bg-blue-500/10 text-blue-500 flex items-center justify-center text-xs font-bold">You</div>
                                            </div>
                                            <p className="text-slate-300 bg-slate-800 p-3 rounded-lg rounded-tr-none">{q.userAnswer}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="text-center pt-8">
                        <a href="/dashboard" className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 font-medium">
                            ← Back to Dashboard
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    // Else, show Interview Room (Active)
    // Check if we need to force reload if status just changed?
    return <InterviewRoom interviewId={interviewId} />;
}

function ScoreItem({ label, score }: { label: string, score?: number }) {
    return (
        <div className="flex flex-col items-center">
            <div className="text-2xl font-bold text-white mb-1">{score || "-"}</div>
            <div className="text-sm text-slate-500 uppercase tracking-wider font-medium">{label}</div>
        </div>
    );
}
