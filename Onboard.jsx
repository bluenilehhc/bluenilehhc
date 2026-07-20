import { useState } from "react";
import { supabase } from "./supabase";
import { LogOut } from "lucide-react";
import Logo from "./Logo.jsx";
import { COMPANY } from "./brand.js";

const NILE = "#0f2b46";

export default function Onboard({ onDone }) {
  const [mode, setMode] = useState("create"); // create | join
  const [name, setName] = useState(COMPANY);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const go = async () => {
    setErr(null);
    setBusy(true);
    try {
      if (mode === "create") {
        const { error } = await supabase.rpc("create_org", { p_name: name });
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc("join_org", { p_code: code });
        if (error) throw error;
      }
      await onDone();
    } catch (e) {
      setErr(e.message || "Something went wrong.");
      setBusy(false);
    }
  };

  const field = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none focus:border-slate-500";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4" style={{ fontFamily: "system-ui, sans-serif" }}>
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 w-fit"><Logo size={56} /></div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">245D & CFSS Tracker</p>
          <p className="mt-1 text-sm text-slate-400">Set up your team — one shared client list for everyone.</p>
        </div>

        <div className="mb-3 flex rounded-lg border border-slate-300 bg-white p-1 text-sm font-medium">
          <button onClick={() => setMode("create")} className={`flex-1 rounded-md px-3 py-1.5 ${mode === "create" ? "bg-slate-800 text-white" : "text-slate-600"}`}>Create a team</button>
          <button onClick={() => setMode("join")} className={`flex-1 rounded-md px-3 py-1.5 ${mode === "join" ? "bg-slate-800 text-white" : "text-slate-600"}`}>Join with a code</button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          {mode === "create" ? (
            <>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Team / agency name</label>
              <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Blue Nile HHC" />
              <p className="mt-2 text-xs text-slate-400">You'll get an invite code to share with your staff.</p>
            </>
          ) : (
            <>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Invite code</label>
              <input className={field} value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. 3f9a1c20" onKeyDown={(e) => e.key === "Enter" && go()} />
              <p className="mt-2 text-xs text-slate-400">Ask whoever created the team for this code.</p>
            </>
          )}

          {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

          <button onClick={go} disabled={busy} style={{ backgroundColor: NILE }} className="mt-4 w-full rounded-lg px-4 py-2.5 font-semibold text-white disabled:opacity-60">
            {busy ? "Please wait…" : mode === "create" ? "Create team" : "Join team"}
          </button>
        </div>

        <button onClick={() => supabase.auth.signOut()} className="mt-4 inline-flex w-full items-center justify-center gap-1.5 text-sm font-medium text-slate-400">
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </div>
  );
}
