"use client";

import { signIn } from "next-auth/react";
import clsx from "clsx";

export default function LoginPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/30 rounded-full blur-[128px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-teal-600/30 rounded-full blur-[128px]" />

            <div className="relative z-10 p-10 bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl max-w-md w-full text-center">
                <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                    Interview AI
                </h1>
                <p className="text-slate-400 mb-8">Master your technical interviews with AI.</p>

                <button
                    onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                    className={clsx(
                        "w-full py-3 px-6 rounded-xl font-medium text-white",
                        "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500",
                        "transition-all duration-200 shadow-lg shadow-indigo-500/25",
                        "flex items-center justify-center gap-3"
                    )}
                >
                    <img src="https://www.google.com/favicon.ico" alt="G" className="w-5 h-5 invert" />
                    Sign in with Google
                </button>

                <div className="mt-6 flex items-center gap-4 text-slate-500 text-sm">
                    <div className="h-px bg-slate-700 flex-1" />
                    <span>OR</span>
                    <div className="h-px bg-slate-700 flex-1" />
                </div>

                <button
                    disabled
                    className="mt-6 w-full py-3 px-6 rounded-xl font-medium text-slate-400 bg-slate-800 cursor-not-allowed border border-slate-700"
                >
                    Sign in with Credentials (Disabled)
                </button>
            </div>
        </div>
    );
}
