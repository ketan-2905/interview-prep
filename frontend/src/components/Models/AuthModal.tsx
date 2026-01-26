"use client";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Lock, Chrome } from "lucide-react";
import { useState } from "react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-slate-900 p-8 shadow-2xl"
          >
            <button onClick={onClose} className="absolute right-4 top-4 text-slate-400 hover:text-white">
              <X size={20} />
            </button>

            <div className="mb-8 text-center">
              <h2 className="text-3xl font-bold text-white">{isLogin ? "Welcome Back" : "Create Account"}</h2>
              <p className="mt-2 text-slate-400">
                {isLogin ? "Enter your details to continue your prep." : "Start your AI-powered interview journey."}
              </p>
            </div>

            <div className="space-y-4">
              {/* Google OAuth */}
              <button className="flex w-full items-center justify-center gap-3 rounded-lg border border-white/10 bg-white/5 py-3 text-white transition-all hover:bg-white/10">
                <Chrome size={20} className="text-emerald-400" />
                Continue with Google
              </button>

              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-white/5"></span></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-slate-900 px-2 text-slate-500">Or continue with</span></div>
              </div>

              {/* Credentials Form */}
              <div className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 text-slate-500" size={18} />
                  <input type="email" placeholder="Email Address" className="w-full rounded-lg border border-white/10 bg-slate-950/50 py-3 pl-10 pr-4 text-white outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50" />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 text-slate-500" size={18} />
                  <input type="password" placeholder="Password" className="w-full rounded-lg border border-white/10 bg-slate-950/50 py-3 pl-10 pr-4 text-white outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50" />
                </div>
              </div>

              <button className="w-full rounded-lg bg-emerald-500 py-3 font-semibold text-slate-950 transition-all hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                {isLogin ? "Sign In" : "Get Started"}
              </button>

              <p className="text-center text-sm text-slate-400 mt-6">
                {isLogin ? "New here?" : "Already have an account?"}{" "}
                <button onClick={() => setIsLogin(!isLogin)} className="text-emerald-400 hover:underline font-medium">
                  {isLogin ? "Create an account" : "Sign in instead"}
                </button>
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}