"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Mic, Clock, BarChart, User as UserIcon, Calendar, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import axios from "axios";
import clsx from "clsx";

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
        // ... (existing code, ensure it uses email or correct ID logic if needed, but existing is fine for now, just sync states)
        try {
            // Using logic from previous turns, assuming session.user.id or similar is patched/available or using email
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
            // Call backend
            const userId = (session?.user as any)?.id || session?.user?.email;
            const res = await axios.post(
                `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/interview`,
                {
                    ...formData,
                    userId: userId || "guest",
                }
            );
            // Navigate to interview room
            window.location.href = `/interview/${res.data.id}`;
        } catch (err) {
            console.error(err);
            setSubmitLoading(false);
            alert("Failed to create interview");
        }
    };


    if (status === "loading") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    if (status === "unauthenticated") {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white">
                <p className="mb-4 text-slate-400">You need to be logged in to continue.</p>
                <Link
                    href="/login"
                    className="px-6 py-3 bg-emerald-500 rounded-lg font-semibold hover:bg-emerald-600"
                >
                    Go to Login
                </Link>
            </div>
        );
    }

    if (!session) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white">
                <p className="mb-4 text-slate-400">You need to be logged in to continue.</p>
                <Link
                    href="/login"
                    className="px-6 py-3 bg-emerald-500 rounded-lg font-semibold hover:bg-emerald-600"
                >
                    Go to Login
                </Link>
            </div>
        );
    }


    return (
        <div className="min-h-screen bg-slate-950 text-white p-8">
            <header className="flex justify-between items-center mb-10 max-w-6xl mx-auto">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                    Dashboard
                </h1>
                <div className="flex items-center gap-4">
                    <span className="text-slate-400">Welcome, {session.user?.name}</span>
                    <img
                        src={session.user?.image || ""}
                        alt="Profile"
                        className="w-10 h-10 rounded-full border border-slate-700"
                    />
                </div>
            </header>

            {!isCreating ? (
                <div className="max-w-6xl mx-auto">
                    <div className="flex justify-between items-end mb-8">
                        <div>
                            <h2 className="text-2xl font-semibold mb-2">Your Interviews</h2>
                            <p className="text-slate-400">Track your progress and review feedback.</p>
                        </div>
                        <button
                            onClick={() => setIsCreating(true)}
                            className="group relative px-6 py-3 bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-all hover:scale-105 shadow-lg shadow-emerald-900/20"
                        >
                            <span className="font-bold flex items-center gap-2">
                                <Mic className="w-5 h-5" /> New Interview
                            </span>
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-20"><Loader2 className="animate-spin w-8 h-8 text-emerald-500" /></div>
                    ) : interviews.length === 0 ? (
                        <div className="text-center py-20 bg-slate-900/30 rounded-2xl border border-slate-800 border-dashed">
                            <p className="text-slate-500">No interviews found. Start one now!</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {interviews.map((int) => (
                                <Link key={int.id} href={`/interview/${int.id}`} className="block">
                                    <div className="bg-slate-900/50 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/50 p-6 rounded-xl transition-all flex justify-between items-center group">
                                        <div>
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">{int.topic}</h3>
                                                <span className={clsx(
                                                    "text-xs px-2 py-0.5 rounded-full border",
                                                    int.status === "COMPLETED" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                                                        int.status === "IN_PROGRESS" ? "bg-blue-500/10 border-blue-500/20 text-blue-400" :
                                                            "bg-slate-800 border-slate-700 text-slate-400"
                                                )}>{int.status}</span>
                                            </div>
                                            <div className="flex items-center gap-6 text-sm text-slate-400">
                                                <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {new Date(int.createdAt).toLocaleDateString()}</span>
                                                <span className="flex items-center gap-1"><BarChart className="w-4 h-4" /> {int.difficulty}</span>
                                            </div>
                                        </div>

                                        {int.feedback ? (
                                            <div className="text-right">
                                                <div className="text-2xl font-bold text-emerald-400">{int.feedback.rating}/10</div>
                                                <div className="text-xs text-slate-500">Overall Score</div>
                                            </div>
                                        ) : (
                                            <div className="text-slate-600">
                                                <ArrowRightIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                            </div>
                                        )}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="max-w-2xl mx-auto bg-slate-900/50 border border-slate-800 p-8 rounded-2xl backdrop-blur-sm mt-10">
                    <h2 className="text-2xl font-semibold mb-6">Setup Interview</h2>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-slate-400 mb-2">Topic</label>
                            <input
                                type="text"
                                required
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                                placeholder="e.g. React Hooks, System Design"
                                value={formData.topic}
                                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-slate-400 mb-2 flex items-center gap-2">
                                    <Clock className="w-4 h-4" /> Duration
                                </label>
                                <select
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 outline-none"
                                    value={formData.duration}
                                    onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
                                >
                                    <option value={5}>5 Minutes</option>
                                    <option value={10}>10 Minutes</option>
                                    <option value={15}>15 Minutes</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-slate-400 mb-2 flex items-center gap-2">
                                    <BarChart className="w-4 h-4" /> Difficulty
                                </label>
                                <select
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 outline-none"
                                    value={formData.difficulty}
                                    onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                                >
                                    <option value="Easy">Easy</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Hard">Hard</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-slate-400 mb-2 flex items-center gap-2">
                                    <UserIcon className="w-4 h-4" /> Type / Seniority
                                </label>
                                <select
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 outline-none"
                                    value={formData.seniority}
                                    onChange={(e) => setFormData({ ...formData, seniority: e.target.value })}
                                >
                                    <option value="Junior">Junior</option>
                                    <option value="Mid">Mid-Level</option>
                                    <option value="Senior">Senior</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-slate-400 mb-2">Silence Timeout (sec)</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 outline-none"
                                    value={formData.silence_time}
                                    onChange={(e) => setFormData({ ...formData, silence_time: parseFloat(e.target.value) })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-slate-400 mb-2">Specific Concept (Optional)</label>
                            <input
                                type="text"
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                                placeholder="e.g. useCallback vs useMemo"
                                value={formData.concept}
                                onChange={(e) => setFormData({ ...formData, concept: e.target.value })}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={submitLoading}
                            className={clsx(
                                "w-full bg-gradient-to-r from-emerald-500 to-teal-500 py-3 rounded-lg font-bold hover:shadow-lg hover:shadow-emerald-500/20 transition-all flex items-center justify-center gap-2",
                                submitLoading && "opacity-70 cursor-not-allowed"
                            )}
                        >
                            {submitLoading ? <Loader2 className="animate-spin w-5 h-5" /> : "Start Interview"}
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsCreating(false)}
                            className="w-full text-slate-400 hover:text-white py-2"
                        >
                            Cancel
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}

function ArrowRightIcon({ className }: { className?: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
    </svg>;

}
