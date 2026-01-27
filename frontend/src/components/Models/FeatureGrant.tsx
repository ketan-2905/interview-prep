import { usePassStore } from "@/store/useFeatureGrantStore";
const FeatureGrant = () => {
 const{setpass,pass,loading,verify,open} = usePassStore()
  return open && (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div
        className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl"
      >
        <h2 className="text-2xl font-bold text-white mb-2">
          Verify yourself
        </h2>
        <div className="flex flex-col gap-2 justify-start items-start mb-2">
          <input name="pass" type="password" placeholder="Pass" className="w-full rounded-lg border border-white/10 bg-slate-950/50 p-3 text-white outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
          value={pass}
          onChange={(e) => setpass(e.target.value)}
          />
        </div>
        <button
          onClick={verify}
          className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl font-bold transition-all"
        >
          {loading ? "Verifying...":"Verify"}
        </button>
      </div>
    </div>
  );
};

export default FeatureGrant;
