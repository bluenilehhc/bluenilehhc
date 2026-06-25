import { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabase";
import Auth from "./Auth.jsx";
import Onboard from "./Onboard.jsx";
import Tracker from "./Tracker.jsx";

export default function App() {
  const [session, setSession] = useState(null);
  const [membership, setMembership] = useState(null);
  const [phase, setPhase] = useState("loading"); // loading | auth | onboard | app

  const loadMembership = useCallback(async () => {
    const { data } = await supabase
      .from("memberships")
      .select("org_id, role, organizations(name, join_code)")
      .limit(1)
      .maybeSingle();
    if (data) {
      setMembership(data);
      setPhase("app");
    } else {
      setMembership(null);
      setPhase("onboard");
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) loadMembership();
      else setPhase("auth");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) loadMembership();
      else {
        setMembership(null);
        setPhase("auth");
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [loadMembership]);

  if (phase === "loading")
    return <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-400">Loading…</div>;
  if (phase === "auth") return <Auth />;
  if (phase === "onboard") return <Onboard onDone={loadMembership} />;
  return <Tracker session={session} membership={membership} />;
}
