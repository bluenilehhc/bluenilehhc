import { useState } from "react";
import { supabase } from "./supabase";
import Logo from "./Logo.jsx";
import { CONTACT_EMAIL } from "./brand.js";

const NILE = "#0f2b46";

export default function Auth() {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  const submit = async () => {
    setErr(null);
    setMsg(null);
    if (!email || !password) {
      setErr("Enter an email and password.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg(
          "Account created. If email confirmation is on in Supabase, check your inbox, then sign in."
        );
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e) {
      setErr(e.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const field =
    "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none focus:border-slate-500";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4" style={{ fontFamily: "system-ui, sans-serif" }}>
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 w-fit"><Logo size={56} /></div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">245D & CFSS Tracker</p>
          <p className="mt-2 text-sm text-slate-400">
            {mode === "signin" ? "Sign in to your account" : "Create your account"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Email</label>
          <input className={field} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@agency.com" />

          <label className="mb-1 mt-3 block text-xs font-semibold uppercase tracking-wide text-slate-500">Password</label>
          <input
            className={field}
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="••••••••"
          />

          {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
          {msg && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</p>}

          <button
            onClick={submit}
            disabled={busy}
            style={{ backgroundColor: NILE }}
            className="mt-4 w-full rounded-lg px-4 py-2.5 font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>

          <button
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setErr(null);
              setMsg(null);
            }}
            className="mt-3 w-full text-sm font-medium text-slate-500"
          >
            {mode === "signin" ? "No account yet? Create one" : "Already have an account? Sign in"}
          </button>
        </div>

        <p className="mt-4 px-2 text-center text-xs text-slate-400">
          Use client codes or initials inside the app — not full names — unless your hosting is covered by a signed BAA.
        </p>
        <p className="mt-2 text-center text-xs text-slate-400">
          Need access? Contact <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-slate-500 underline">{CONTACT_EMAIL}</a>
        </p>
      </div>
    </div>
  );
}
