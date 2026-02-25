"use client";

import { motion } from "framer-motion";
import { Mic, Zap, Shield, Cpu, ArrowRight, Play, Sparkles } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";

/**
 * LandingPage - A refined, compact, minimalist light-themed entry point.
 * Focuses on clarity, whitespace, and subtle micro-interactions.
 */
export default function LandingPage() {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-900 selection:bg-emerald-100 selection:text-emerald-900">

      {/* Subtle Background Decor */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-50/50 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-50/50 blur-[120px]" />
      </div>

      {/* Navigation */}
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

          <div className="flex items-center gap-6">
            {session?.user ? (
              <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white p-1 pr-4">
                <img
                  src={session.user.image || ""}
                  alt="Profile"
                  className="h-8 w-8 rounded-full border border-slate-100"
                />
                <span className="text-sm font-medium text-slate-600">Hello, {session.user.name?.split(' ')[0]}</span>
              </div>
            ) : (
              <Link
                href="/login"
                className="text-sm font-semibold text-slate-600 hover:text-emerald-600 transition-colors"
              >
                Log in
              </Link>
            )}
            <Link
              href="/dashboard"
              className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 transition-all active:scale-95"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-6">

        {/* Hero Section */}
        <section className="relative flex flex-col items-center pt-32 pb-24 text-center md:pt-48 md:pb-32">
          {/* <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50/50 px-3.5 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700"
          >
            <Sparkles size={14} />
            <span>AI-Powered Interviews</span>
          </motion.div> */}

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="mb-6 text-5xl font-black leading-[1.1] tracking-tight text-slate-950 md:text-7xl"
          >
            Master your next <br />
            <span className="bg-gradient-to-r from-emerald-600 to-sky-600 bg-clip-text text-transparent">
              Technical Interview
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="mb-10 max-w-2xl text-lg leading-relaxed text-slate-500 md:text-xl"
          >
            Realistic 1:1 voice interviews with specialized AI agents.
            Get instant feedback on your code, structure, and communication.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="flex flex-col items-center gap-4 sm:flex-row"
          >
            <Link
              href="/dashboard"
              className="group flex h-14 items-center gap-2 rounded-full bg-emerald-600 px-8 text-lg font-bold text-white shadow-xl shadow-emerald-200 transition-all hover:bg-emerald-500 active:scale-95"
            >
              Start Free Session
              <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" />
            </Link>
            <button className="flex h-14 items-center gap-3 rounded-full border border-slate-200 bg-white px-8 text-lg font-semibold text-slate-900 hover:bg-slate-50 transition-colors">
              <Play size={18} className="fill-slate-900" />
              Watch Demo
            </button>
          </motion.div>
        </section>

        {/* Features - Compact Grid */}
        <section className="mb-24 grid gap-6 md:grid-cols-3">
          <FeatureCard
            icon={<Cpu size={24} />}
            title="Tailored Agents"
            desc="AI that adapts to your target job role. Pure specialized practice."
          />
          <FeatureCard
            icon={<Mic size={24} />}
            title="Zero Latency"
            desc="Human-like voice interaction powered by low-latency WebSockets."
          />
          <FeatureCard
            icon={<Shield size={24} />}
            title="Deep Feedback"
            desc="Granular reports on your technical skills and communication style."
          />
        </section>
      </main>

      {/* Simplified Footer */}
      <footer className="border-t border-slate-200 py-12">
        <div className="mx-auto max-w-6xl px-6 flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2 text-lg font-bold text-slate-950">
            <Zap size={20} className="text-emerald-600 fill-emerald-600" />
            <span>InterviewAI</span>
          </div>
          <p className="text-sm font-medium text-slate-400">
            © 2026 Crafted with precision for engineers.
          </p>
          <div className="flex gap-6 text-sm font-semibold text-slate-500">
            <Link href="#" className="hover:text-emerald-600 transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-emerald-600 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      transition={{ type: "spring", stiffness: 300 }}
      className="group rounded-2xl border border-slate-200 bg-white p-8 transition-all hover:border-emerald-200 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.06)]"
    >
      <div className="mb-5 inline-block rounded-xl bg-emerald-50 p-3 text-emerald-600 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
        {icon}
      </div>
      <h3 className="mb-2 text-xl font-bold text-slate-900">{title}</h3>
      <p className="text-slate-500 leading-relaxed text-sm md:text-base">{desc}</p>
    </motion.div>
  );
}
