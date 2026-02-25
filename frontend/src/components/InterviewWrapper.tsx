"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Mic, BarChart, CheckCircle, AlertCircle, Calendar, ArrowLeft, MoreHorizontal, MessageSquare, Award, Loader2, Zap } from "lucide-react";
import InterviewRoom from "./InterviewRoom";
import Link from "next/link";

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
            <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 animate-spin text-emerald-600" />
                    <p className="text-slate-500 font-black uppercase tracking-widest text-xs">Analyzing Session...</p>
                </div>
            </div>
        );
    }

    // If Interview is COMPLETED, show Feedback
    if (data?.status === "COMPLETED") {
        const fb = data.feedback;
        return (
            <div className="min-h-screen bg-[#FAFAFA] text-slate-900 p-8 overflow-y-auto selection:bg-emerald-100">
                {/* Subtle Background Decor */}
                <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-50/50 blur-[120px]" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-50/50 blur-[120px]" />
                </div>

                <div className="max-w-4xl mx-auto space-y-12 pb-20">
                    <nav className="flex items-center justify-between mb-12">
                        <Link href="/dashboard" className="flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-colors font-bold text-sm uppercase tracking-widest">
                            <ArrowLeft size={16} /> Back
                        </Link>
                        <div className="flex items-center gap-2">
                            <Zap size={18} className="text-emerald-600" />
                            <span className="font-black text-sm uppercase tracking-tighter">Report#<span className="text-emerald-600">{interviewId.slice(-6)}</span></span>
                        </div>
                    </nav>

                    <header className="space-y-4">
                        <div className="flex items-center gap-3">
                            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-wider">Session Complete</span>
                        </div>
                        <h1 className="text-5xl font-black text-slate-950 tracking-tight leading-none">{data.topic}</h1>
                        <p className="text-slate-500 text-xl font-medium">{data.difficulty} Level Technical Assessment</p>
                    </header>

                    {/* Overall Score Card */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                        <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-xl shadow-emerald-50 text-center md:col-span-1 flex flex-col items-center justify-center relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-full h-1.5 bg-emerald-600" />
                            <div className="text-6xl font-black text-slate-950 mb-2 group-hover:scale-110 transition-transform duration-500">
                                {fb?.rating || "?"}
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Overall Score</p>
                        </div>

                        <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-sm md:col-span-3 space-y-8">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Award size={16} className="text-emerald-500" /> Dimension Analysis
                            </h3>
                            <div className="grid grid-cols-3 gap-8">
                                <ScoreItem label="English" score={fb?.englishScore} color="emerald" />
                                <ScoreItem label="Technical" score={fb?.technicalScore} color="blue" />
                                <ScoreItem label="Communication" score={fb?.communicationScore} color="indigo" />
                            </div>
                        </div>
                    </div>

                    {/* Feedback Text */}
                    <div className="bg-white border border-slate-200 p-10 rounded-[40px] shadow-sm relative overflow-hidden">
                        <div className="absolute top-10 right-10">
                            <MessageSquare size={120} className="text-slate-50/50" strokeWidth={3} />
                        </div>
                        <div className="relative z-10 space-y-6">
                            <h3 className="text-sm font-black text-emerald-600 uppercase tracking-[0.2em]">AI Performance Feedback</h3>
                            <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed font-medium text-lg">
                                {fb?.feedbackText ? fb.feedbackText.split('\n').filter((l: string) => l.trim()).map((line: string, i: number) => (
                                    <p key={i} className="mb-4">{line}</p>
                                )) : (
                                    <div className="flex items-center gap-4 text-emerald-600 bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
                                        <Loader2 className="animate-spin" size={20} />
                                        <span className="font-bold uppercase tracking-wider text-sm">Feedback system is synthesizing your results...</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Transcript */}
                    <div className="space-y-8">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Conversation Flow</h3>
                            <div className="h-px bg-slate-200 flex-1 ml-6" />
                        </div>
                        <div className="space-y-6">
                            {data.questions.map((q: any, i: number) => (
                                <div key={q.id} className="group transition-all">
                                    <div className="space-y-4">
                                        <div className="flex gap-4">
                                            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-[10px] shadow-lg shadow-emerald-100">AI</div>
                                            <div className="bg-slate-100/50 group-hover:bg-slate-100 p-4 rounded-2xl rounded-tl-none border border-slate-100/50 group-hover:border-slate-200 transition-all">
                                                <p className="text-slate-900 font-bold">{q.question}</p>
                                            </div>
                                        </div>
                                        {q.userAnswer && (
                                            <div className="flex gap-4 flex-row-reverse">
                                                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-950 flex items-center justify-center font-black text-[10px]">YOU</div>
                                                <div className="bg-white p-4 rounded-2xl rounded-tr-none border border-slate-200 shadow-sm">
                                                    <p className="text-slate-600 font-medium">{q.userAnswer}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="pt-20 border-t border-slate-200 flex flex-col items-center gap-6">
                        <Award size={48} className="text-emerald-100" />
                        <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">End of Summary Report</p>
                        <Link href="/dashboard" className="px-10 py-4 bg-slate-950 text-white rounded-full font-black uppercase tracking-widest text-xs hover:scale-105 active:scale-95 transition-all shadow-xl shadow-slate-200">
                            Return to Dashboard
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // Else, show Interview Room (Active)
    return <InterviewRoom interviewId={interviewId} />;
}

function ScoreItem({ label, score, color }: { label: string, score?: number, color: string }) {
    const colorClasses: Record<string, string> = {
        emerald: "text-emerald-600 bg-emerald-50",
        blue: "text-blue-600 bg-blue-50",
        indigo: "text-indigo-600 bg-indigo-50"
    };

    return (
        <div className="flex flex-col items-center gap-3">
            <div className={clsx("w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black shadow-sm", colorClasses[color] || "bg-slate-50 text-slate-900")}>
                {score || "-"}
            </div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</div>
        </div>
    );
}
