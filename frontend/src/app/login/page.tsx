"use client";

import { signIn } from "next-auth/react";
import clsx from "clsx";
import { Zap } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] text-slate-900 selection:bg-emerald-100 selection:text-emerald-900 relative overflow-hidden">
            {/* Subtle Background Decor */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-50/50 blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-50/50 blur-[120px]" />
            </div>

            <div className="relative z-10 p-10 bg-white/70 backdrop-blur-xl border border-slate-200 rounded-3xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)] max-w-md w-full text-center">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600 shadow-lg shadow-emerald-100">
                    <Zap size={32} className="fill-white text-white" />
                </div>

                <h1 className="text-4xl font-black mb-2 tracking-tight text-slate-950">
                    Interview<span className="text-emerald-600">AI</span>
                </h1>
                <p className="text-slate-500 mb-8 font-medium">Master your technical interviews with precision.</p>

                <button
                    onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                    className={clsx(
                        "w-full py-4 px-6 rounded-2xl font-bold text-white",
                        "bg-emerald-600 hover:bg-emerald-500",
                        "transition-all duration-200 shadow-xl shadow-emerald-100",
                        "flex items-center justify-center gap-3 active:scale-95"
                    )}
                >
                    <img src="https://www.google.com/favicon.ico" alt="G" className="w-5 h-5 invert" />
                    Sign in with Google
                </button>

                <div className="mt-8 flex items-center gap-4 text-slate-300 text-xs font-bold uppercase tracking-widest">
                    <div className="h-px bg-slate-200 flex-1" />
                    <span>Secure Access</span>
                    <div className="h-px bg-slate-200 flex-1" />
                </div>

                <p className="mt-8 text-xs text-slate-400 font-medium">
                    By signing in, you agree to our <Link href="#" className="underline">Terms</Link> and <Link href="#" className="underline">Privacy Policy</Link>.
                </p>
            </div>
        </div>
    );
}
