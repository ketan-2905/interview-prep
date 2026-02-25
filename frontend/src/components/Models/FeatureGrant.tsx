"use client";

import { usePassStore } from "@/store/useFeatureGrantStore";
import { ShieldCheck, Loader2, X } from "lucide-react";
import clsx from "clsx";

const FeatureGrant = () => {
  const { setpass, pass, loading, verify, open, setopen } = usePassStore();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/60 backdrop-blur-xl p-6">
      <div className="bg-white border border-slate-200 p-10 rounded-[40px] max-w-md w-full text-center shadow-[0_32px_80px_-12px_rgba(0,0,0,0.12)] relative">
        <button
          onClick={() => setopen(false)}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-50 text-slate-400 hover:text-slate-900 transition-all"
        >
          <X size={20} />
        </button>

        <div className="mx-auto w-20 h-20 bg-emerald-600 rounded-3xl flex items-center justify-center mb-8 shadow-xl shadow-emerald-100 rotate-3 animate-in fade-in zoom-in duration-500">
          <ShieldCheck size={40} className="text-white" strokeWidth={1.5} />
        </div>

        <h2 className="text-3xl font-black text-slate-950 mb-3 tracking-tight">
          Admin Access
        </h2>
        <p className="text-slate-500 font-medium mb-10">
          Enter your security key to unlock advanced interviewing capabilities.
        </p>

        <div className="space-y-6">
          <div className="space-y-2 text-left">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Access Key</label>
            <input
              name="pass"
              type="password"
              placeholder="••••••••"
              className="w-full rounded-2xl border border-slate-200 bg-[#FAFAFA] p-4 text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
              value={pass}
              onChange={(e) => setpass(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && verify()}
              autoFocus
            />
          </div>

          <button
            onClick={verify}
            disabled={loading}
            className={clsx(
              "w-full py-5 rounded-full font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-emerald-50 flex items-center justify-center gap-3",
              loading ? "bg-emerald-400 text-white cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95"
            )}
          >
            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : "Verify Identity"}
          </button>
        </div>

        <p className="mt-8 text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em]">End-To-End Encrypted Verification</p>
      </div>
    </div>
  );
};

export default FeatureGrant;
