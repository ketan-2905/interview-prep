"use client";
import { motion } from "framer-motion";
import { Mic, Zap, Shield, Cpu, ArrowRight, Play } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";

export default function LandingPage() {
  const { data: session } = useSession();
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-emerald-500/30">
      {/* Navigation */}
      <nav className="fixed top-0 z-40 w-full border-b border-white/5 bg-slate-950/50 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-bold text-white text-xl">
            <div className="h-8 w-8 rounded bg-emerald-500 flex items-center justify-center">
              <Zap size={18} className="text-slate-950" />
            </div>
            <span>InterviewPrep</span>
          </div>
          {session?.user ? (
            <div className="flex items-center gap-4">
              <span className="text-slate-400">
                Welcome, {session.user?.name}
              </span>
              <img
                src={session.user?.image || ""}
                alt="Profile"
                className="w-10 h-10 rounded-full border border-slate-700"
              />
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-white/5 px-6 py-2 text-sm font-medium text-white border border-white/10 hover:bg-white/10 transition-all"
            >
              Login
            </Link>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-32 pb-20 px-6">
        <div className="absolute top-0 left-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[120px]" />

        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-4 py-1.5 text-sm font-medium text-emerald-400 mb-6"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Real-time WebSocket Interviews
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6"
          >
            Master your next <br />
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              Technical Interview
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-slate-400 mb-10 max-w-2xl mx-auto"
          >
            Connect with our high-fidelity AI agents over low-latency
            WebSockets. Practice coding, architecture, and soft skills in a
            realistic live-call environment.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              href="/dashboard"
              className="group flex h-14 items-center gap-2 rounded-full bg-emerald-500 px-8 text-lg font-semibold text-slate-950 transition-all hover:bg-emerald-400"
            >
              Start Session{" "}
              <ArrowRight
                size={20}
                className="transition-transform group-hover:translate-x-1"
              />
            </Link>
            <button className="flex h-14 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-8 text-lg font-semibold text-white hover:bg-white/10">
              <Play size={18} /> Watch Demo
            </button>
          </motion.div>
        </div>
      </section>

      {/* Feature Section: The Workflow */}
      <section className="py-24 px-6 bg-slate-900/50">
        <div className="mx-auto max-w-7xl">
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Cpu className="text-emerald-400" />}
              title="Tailored Agents"
              desc="Input your job description and our AI allocates a specialized space with custom interview logic."
            />
            <FeatureCard
              icon={<Mic className="text-cyan-400" />}
              title="Voice-First Experience"
              desc="Tap to call. Our WebSocket architecture ensures zero-lag, human-like voice interaction."
            />
            <FeatureCard
              icon={<Shield className="text-purple-400" />}
              title="Detailed Feedback"
              desc="Get a comprehensive report on your performance, tone, and technical accuracy after every call."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-5 px-6">
        <div className="mx-auto max-w-7xl flex flex-col items-center justify-center gap-4 text-slate-400">
          <div className="flex items-center gap-3 font-semibold text-white text-lg md:text-xl">
            <Zap size={20} className="text-emerald-500" />
            <span>InterAI © 2026</span>
          </div>

          <p className="text-sm md:text-base text-slate-500">
            AI-powered technical interviews, reimagined.
          </p>
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
    <div className="group rounded-2xl border border-white/5 bg-slate-950 p-8 transition-all hover:border-emerald-500/20 hover:shadow-2xl hover:shadow-emerald-500/5">
      <div className="mb-6 inline-block rounded-xl bg-white/5 p-3 group-hover:bg-white/10 transition-colors">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
      <p className="text-slate-400 leading-relaxed">{desc}</p>
    </div>
  );
}
