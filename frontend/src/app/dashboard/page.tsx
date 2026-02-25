"use client";

import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
    Mic,
    Clock,
    BarChart,
    User as UserIcon,
    Calendar,
    Loader2,
    Zap
} from "lucide-react";
import axios from "axios";
import clsx from "clsx";
import { usePassStore } from "@/store/useFeatureGrantStore";
import FeatureGrant from "@/components/Models/FeatureGrant";

interface Interview {
    id: string;
    topic: string;
    status: string;
    difficulty: string;
    createdAt: string;
    feedback?: {
        rating: number;
        feedbackText: string;
    };
}

export default function Dashboard() {
    const { data: session, status } = useSession();
    const [interviews, setInterviews] = useState<Interview[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const { allowed, setopen } = usePassStore();

    // Form State
    const [formData, setFormData] = useState({
        topic: "",
        duration: 5,
        difficulty: "Medium",
        seniority: "Junior",
        concept: "",
        silence_time: 3.0,
    });

    useEffect(() => {
        if (session?.user?.email) {
            fetchInterviews();
        }
    }, [session]);

    const fetchInterviews = async () => {
        try {
            const userId = (session?.user as any)?.id || session?.user?.email;
            const res = await axios.get(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/interview?userId=${userId}`);
            setInterviews(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitLoading(true);
        try {
            const userId = (session?.user as any)?.id || session?.user?.email;
            const res = await axios.post(
                `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/interview`,
                {
                    ...formData,
                    userId: userId || "guest",
                }
            );
            window.location.href = `/interview/${res.data.id}`;
        } catch (err) {
            console.error(err);
            setSubmitLoading(false);
            alert("Failed to create interview");
        }
    };

    if (status === "loading") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    if (status === "unauthenticated" || !session) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAFAFA] text-slate-900">
                <p className="mb-4 text-slate-500 font-medium">You need to be logged in to continue.</p>
                <Link
                    href="/login"
                    className="px-8 py-3 bg-emerald-600 text-white rounded-full font-bold shadow-xl shadow-emerald-100 transition-all hover:scale-105 active:scale-95"
                >
                    Go to Login
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FAFAFA] text-slate-900 selection:bg-emerald-100 selection:text-emerald-900">
            {/* Subtle Background Decor */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-50/50 blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-50/50 blur-[120px]" />
            </div>

            <nav className="fixed top-0 z-50 w-full border-b border-slate-200/50 bg-white/70 backdrop-blur-md">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
                    <Link href="/" className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 shadow-lg shadow-emerald-100">
                            <Zap size={18} className="fill-white text-white" />
                        </div>
                        <span className="text-xl font-bold tracking-tight text-slate-900">
                            Interview<span className="text-emerald-600">AI</span>
                        </span>
                    </Link>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white p-1 pr-4">
                            <img
                                src={session.user?.image || ""}
                                alt="Profile"
                                className="h-8 w-8 rounded-full border border-slate-100"
                            />
                            <span className="text-sm font-medium text-slate-600">{session.user?.name?.split(' ')[0]}</span>
                        </div>
                        <button
                            onClick={() => signOut()}
                            className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-full text-sm font-bold hover:bg-slate-50 transition-colors"
                        >
                            Log Out
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-6xl mx-auto pt-32 pb-20 px-6">
                <FeatureGrant />

                {!isCreating ? (
                    <div className="space-y-12">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                            <div>
                                <h1 className="text-4xl font-black text-slate-950 mb-2">Dashboard</h1>
                                <p className="text-slate-500 font-medium">Manage your progress and scheduled sessions.</p>
                            </div>

                            {allowed ? (
                                <button
                                    onClick={() => setIsCreating(true)}
                                    className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-bold shadow-xl shadow-emerald-100 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                                >
                                    <Mic className="w-5 h-5" /> New Interview
                                </button>
                            ) : (
                                <button
                                    onClick={() => setopen(true)}
                                    className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-full font-bold shadow-xl transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                                >
                                    <Mic className="w-5 h-5 text-emerald-500" /> Unlock Sessions
                                </button>
                            )}
                        </div>

                        <div className="space-y-4">
                            <h2 className="text-xl font-bold text-slate-900 mb-6">Recent Interviews</h2>
                            {loading ? (
                                <div className="flex justify-center py-20">
                                    <Loader2 className="animate-spin w-8 h-8 text-emerald-600" />
                                </div>
                            ) : interviews.length === 0 ? (
                                <div className="text-center py-24 bg-white rounded-3xl border border-slate-200 border-dashed">
                                    <div className="mx-auto w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                        <Calendar className="text-slate-300" />
                                    </div>
                                    <p className="text-slate-400 font-medium">No sessions found. Start your first practice today!</p>
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {interviews.map((int) => (
                                        <Link key={int.id} href={`/interview/${int.id}`} className="block">
                                            <div className="bg-white border border-slate-200 hover:border-emerald-300 p-6 rounded-2xl transition-all flex justify-between items-center group shadow-sm hover:shadow-md">
                                                <div className="flex gap-5 items-center">
                                                    <div className="h-12 w-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-emerald-500 transition-colors">
                                                        <Clock size={24} />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-3 mb-1">
                                                            <h3 className="text-lg font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">{int.topic}</h3>
                                                            <span className={clsx(
                                                                "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border",
                                                                int.status === "COMPLETED" ? "bg-emerald-50 border-emerald-100 text-emerald-600" :
                                                                    int.status === "IN_PROGRESS" ? "bg-blue-50 border-blue-100 text-blue-600" :
                                                                        "bg-slate-50 border-slate-100 text-slate-400"
                                                            )}>{int.status}</span>
                                                        </div>
                                                        <div className="flex items-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-wide">
                                                            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {new Date(int.createdAt).toLocaleDateString()}</span>
                                                            <span className="flex items-center gap-1"><BarChart className="w-3.5 h-3.5" /> {int.difficulty}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {int.feedback ? (
                                                    <div className="text-right">
                                                        <div className="text-2xl font-black text-emerald-600">{int.feedback.rating}/10</div>
                                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Score</div>
                                                    </div>
                                                ) : (
                                                    <div className="text-slate-300 group-hover:text-emerald-500 transition-all group-hover:translate-x-1">
                                                        <ArrowRightIcon className="w-6 h-6" />
                                                    </div>
                                                )}
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="max-w-2xl mx-auto bg-white border border-slate-200 p-10 rounded-3xl shadow-xl">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-3xl font-black text-slate-950">Setup Interview</h2>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-8">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Interview Topic</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full bg-[#FAFAFA] border border-slate-200 rounded-xl p-4 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
                                    placeholder="e.g. React Hooks, System Design"
                                    value={formData.topic}
                                    onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                        <Clock className="w-3.5 h-3.5" /> Duration
                                    </label>
                                    <select
                                        className="w-full bg-[#FAFAFA] border border-slate-200 rounded-xl p-4 outline-none font-medium appearance-none"
                                        value={formData.duration}
                                        onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
                                    >
                                        <option value={5}>5 Minutes</option>
                                        <option value={10}>10 Minutes</option>
                                        <option value={15}>15 Minutes</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                        <BarChart className="w-3.5 h-3.5" /> Difficulty
                                    </label>
                                    <select
                                        className="w-full bg-[#FAFAFA] border border-slate-200 rounded-xl p-4 outline-none font-medium appearance-none"
                                        value={formData.difficulty}
                                        onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                                    >
                                        <option value="Easy">Easy</option>
                                        <option value="Medium">Medium</option>
                                        <option value="Hard">Hard</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                        <UserIcon className="w-3.5 h-3.5" /> Seniority
                                    </label>
                                    <select
                                        className="w-full bg-[#FAFAFA] border border-slate-200 rounded-xl p-4 outline-none font-medium appearance-none"
                                        value={formData.seniority}
                                        onChange={(e) => setFormData({ ...formData, seniority: e.target.value })}
                                    >
                                        <option value="Junior">Junior</option>
                                        <option value="Mid">Mid-Level</option>
                                        <option value="Senior">Senior</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Silence (sec)</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        className="w-full bg-[#FAFAFA] border border-slate-200 rounded-xl p-4 outline-none font-medium"
                                        value={formData.silence_time}
                                        onChange={(e) => setFormData({ ...formData, silence_time: parseFloat(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Specific Concepts</label>
                                <input
                                    type="text"
                                    className="w-full bg-[#FAFAFA] border border-slate-200 rounded-xl p-4 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
                                    placeholder="e.g. useCallback vs useMemo"
                                    value={formData.concept}
                                    onChange={(e) => setFormData({ ...formData, concept: e.target.value })}
                                />
                            </div>

                            <div className="pt-4 flex flex-col gap-4">
                                <button
                                    type="submit"
                                    disabled={submitLoading}
                                    className={clsx(
                                        "w-full py-4 rounded-xl font-black text-white bg-emerald-600 hover:bg-emerald-500 shadow-xl shadow-emerald-100 transition-all flex items-center justify-center gap-3 active:scale-95",
                                        submitLoading && "opacity-70 cursor-not-allowed"
                                    )}
                                >
                                    {submitLoading ? <Loader2 className="animate-spin w-6 h-6" /> : (
                                        <>Start Session <ArrowRightIcon className="w-5 h-5" /></>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsCreating(false)}
                                    className="w-full text-slate-400 hover:text-slate-600 font-bold py-2 text-sm transition-colors"
                                >
                                    Go Back
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </main>
        </div>
    );
}

function ArrowRightIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
        </svg>
    );
}
