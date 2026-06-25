import { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabase";
import Logo from "./Logo.jsx";
import { CONTACT_EMAIL } from "./brand.js";
import {
  CalendarPlus, Check, Trash2, Pencil, Plus, X, Download,
  CircleAlert, Clock, ShieldCheck, FileDown, BookOpen, RotateCcw, LogOut,
} from "lucide-react";

const NILE = "#0f2b46";

/* ===== 245D document library (editable defaults) ===== */
const LIBRARY = {
  Basic: [
    { doc: "Support plan addendum review", freq: 12, lead: 45 },
    { doc: "Annual progress review report", freq: 12, lead: 30 },
    { doc: "Support plan (CSSP) on file – annual update", freq: 12, lead: 30 },
    { doc: "Service rights / release authorization renewal", freq: 12, lead: 30 },
    { doc: "Initial 60-day service plan", freq: 0, lead: 14 },
  ],
  Intensive: [
    { doc: "Annual assessment", freq: 12, lead: 30 },
    { doc: "CSSP addendum review (outcomes & supports)", freq: 12, lead: 45 },
    { doc: "Progress review report", freq: 3, lead: 14 },
    { doc: "Individual Abuse Prevention Plan (IAPP) review", freq: 12, lead: 30 },
    { doc: "Self-management / risk assessment", freq: 12, lead: 30 },
    { doc: "Psychotropic medication monitoring review", freq: 3, lead: 7 },
    { doc: "Behavior / target symptom data review", freq: 3, lead: 7 },
    { doc: "Day services employment transition discussion", freq: 12, lead: 30 },
    { doc: "45-day planning meeting & CSSP addendum", freq: 0, lead: 14 },
  ],
  "Program-wide": [
    { doc: "245D license renewal", freq: 12, lead: 60 },
    { doc: "Staff orientation / training annual update", freq: 12, lead: 30 },
    { doc: "Program Abuse Prevention Plan (APP) review", freq: 12, lead: 30 },
    { doc: "Policies & procedures review", freq: 12, lead: 30 },
    { doc: "Designated coordinator / manager training", freq: 12, lead: 30 },
    { doc: "Internal compliance self-review", freq: 12, lead: 30 },
  ],
  CFSS: [
    { doc: "Annual reassessment request (DHS-6893B)", freq: 12, lead: 60 },
    { doc: "Service delivery plan / care plan update (DHS-6893P)", freq: 12, lead: 45 },
    { doc: "MnCHOICES annual reassessment", freq: 12, lead: 45 },
    { doc: "Service authorization renewal", freq: 12, lead: 30 },
    { doc: "Consultation services annual review", freq: 12, lead: 30 },
    { doc: "Worker supervision / performance review", freq: 12, lead: 30 },
    { doc: "Worker competency evaluation (within 30 days of start)", freq: 0, lead: 7 },
    { doc: "Support worker CFSS training/test current", freq: 12, lead: 30 },
    { doc: "Person's rights & responsibilities review", freq: 12, lead: 30 },
    { doc: "45-day temporary start", freq: 0, lead: 7 },
  ],
};
const CATEGORIES = ["Basic", "Intensive", "Program-wide", "CFSS"];
const FREQ_LABEL = { 0: "One-time", 1: "Monthly", 3: "Quarterly", 6: "Every 6 months", 12: "Annual" };
const freqText = (f) => FREQ_LABEL[f] || `Every ${f} months`;

/* ===== date helpers ===== */
const todayLocal = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
const parseLocal = (s) => { if (!s) return null; const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function addMonths(s, n) {
  const d = parseLocal(s); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return toISO(d);
}
const daysUntil = (s) => Math.round((parseLocal(s) - todayLocal()) / 86400000);
const prettyDate = (s) => parseLocal(s).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
const icsDate = (s) => s.replaceAll("-", "");
const icsDatePlus1 = (s) => { const d = parseLocal(s); d.setDate(d.getDate() + 1); return icsDate(toISO(d)); };

/* ===== status ===== */
function statusOf(it) {
  if (it.completed) return "done";
  const d = daysUntil(it.dueDate); const lead = Number(it.leadDays) || 30;
  if (d < 0) return "overdue"; if (d <= lead) return "soon"; return "ontrack";
}
const STATUS = {
  overdue: { label: "Overdue", chip: "bg-red-100 text-red-800 border-red-200", bar: "#dc2626", Icon: CircleAlert },
  soon: { label: "Due soon", chip: "bg-amber-100 text-amber-800 border-amber-200", bar: "#d97706", Icon: Clock },
  ontrack: { label: "On track", chip: "bg-emerald-100 text-emerald-800 border-emerald-200", bar: "#059669", Icon: ShieldCheck },
  done: { label: "Done", chip: "bg-slate-100 text-slate-600 border-slate-200", bar: "#94a3b8", Icon: Check },
};
const CAT_COLOR = { Basic: "bg-sky-100 text-sky-800", Intensive: "bg-violet-100 text-violet-800", "Program-wide": "bg-teal-100 text-teal-800", CFSS: "bg-rose-100 text-rose-800" };

/* ===== calendar builders ===== */
const rruleFor = (f) => (!f ? "" : f === 12 ? "RRULE:FREQ=YEARLY" : `RRULE:FREQ=MONTHLY;INTERVAL=${f}`);
const eventTitle = (it) => `245D ${it.doc}${it.client ? ": " + it.client : ""}`;
const eventDetails = (it) => {
  const b = [`Category: ${it.category}`, `Recurs: ${freqText(it.freqMonths)}`];
  if (it.notes) b.push(it.notes); b.push("Tracked in 245D Tracker."); return b.join("\n");
};
function googleUrl(it) {
  const p = new URLSearchParams({ action: "TEMPLATE", text: eventTitle(it), dates: `${icsDate(it.dueDate)}/${icsDatePlus1(it.dueDate)}`, details: eventDetails(it) });
  let u = `https://calendar.google.com/calendar/render?${p.toString()}`;
  const r = rruleFor(it.freqMonths); if (r) u += `&recur=${encodeURIComponent(r)}`; return u;
}
function outlookUrl(it) {
  const p = new URLSearchParams({ path: "/calendar/action/compose", rru: "addevent", subject: eventTitle(it), body: eventDetails(it), startdt: it.dueDate, enddt: it.dueDate, allday: "true" });
  return `https://outlook.office.com/calendar/0/deeplink/compose?${p.toString()}`;
}
function buildICS(items) {
  const esc = (s) => s.replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
  const out = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//245D Tracker//EN", "CALSCALE:GREGORIAN"];
  items.forEach((it) => {
    const lead = Number(it.leadDays) || 30;
    out.push("BEGIN:VEVENT", `UID:${it.id}@d245-tracker`, `DTSTART;VALUE=DATE:${icsDate(it.dueDate)}`, `DTEND;VALUE=DATE:${icsDatePlus1(it.dueDate)}`, `SUMMARY:${esc(eventTitle(it))}`, `DESCRIPTION:${esc(eventDetails(it))}`);
    const r = rruleFor(it.freqMonths); if (r) out.push(r);
    out.push("BEGIN:VALARM", `TRIGGER:-P${lead}D`, "ACTION:DISPLAY", "DESCRIPTION:245D item coming up", "END:VALARM", "END:VEVENT");
  });
  out.push("END:VCALENDAR"); return out.join("\r\n");
}
function downloadICS(items, filename) {
  try {
    const blob = new Blob([buildICS(items)], { type: "text/calendar" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) {}
}

/* ===== row <-> form mapping ===== */
const fromRow = (r) => ({ id: r.id, client: r.client || "", category: r.category, doc: r.doc, dueDate: r.due_date, freqMonths: r.freq_months, leadDays: r.lead_days, notes: r.notes || "", completed: r.completed });
const toRow = (f) => ({ client: f.client.trim(), category: f.category, doc: f.doc.trim(), due_date: f.dueDate, freq_months: Number(f.freqMonths), lead_days: Number(f.leadDays) || 30, notes: f.notes });

const emptyForm = { client: "", category: "Basic", doc: "", dueDate: "", freqMonths: 12, leadDays: 30, notes: "" };

/* ===== form ===== */
function ItemForm({ initial, onSave, onCancel }) {
  const [f, setF] = useState(initial || emptyForm);
  useEffect(() => setF(initial || emptyForm), [initial]);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const valid = f.doc.trim() && f.dueDate;
  const presets = LIBRARY[f.category] || [];
  const pickPreset = (name) => {
    const p = presets.find((x) => x.doc === name);
    if (p) setF((prev) => ({ ...prev, doc: p.doc, freqMonths: p.freq, leadDays: p.lead }));
    else set("doc", "");
  };
  const field = "w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-500 bg-white";
  const lab = "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={lab}>Client code / program</label>
            <input className={field} value={f.client} onChange={(e) => set("client", e.target.value)} placeholder="e.g. A.H. or C-104" />
          </div>
          <div>
            <label className={lab}>Service category</label>
            <select className={field} value={f.category} onChange={(e) => { set("category", e.target.value); set("doc", ""); }}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={lab}>245D document</label>
          <select className={field} value={presets.some((p) => p.doc === f.doc) ? f.doc : "__custom"} onChange={(e) => pickPreset(e.target.value)}>
            <option value="">Choose a document…</option>
            {presets.map((p) => <option key={p.doc} value={p.doc}>{p.doc} · {freqText(p.freq)}</option>)}
            <option value="__custom">Custom…</option>
          </select>
          {!presets.some((p) => p.doc === f.doc) && (
            <input className={`${field} mt-2`} value={f.doc} onChange={(e) => set("doc", e.target.value)} placeholder="Custom document name" />
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className={lab}>Due / anchor date</label>
            <input type="date" className={field} value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
          </div>
          <div>
            <label className={lab}>Repeats</label>
            <select className={field} value={f.freqMonths} onChange={(e) => set("freqMonths", Number(e.target.value))}>
              <option value={12}>Annual</option><option value={6}>Every 6 months</option><option value={3}>Quarterly</option><option value={1}>Monthly</option><option value={0}>One-time</option>
            </select>
          </div>
          <div>
            <label className={lab}>Remind days early</label>
            <input type="number" min="0" className={field} value={f.leadDays} onChange={(e) => set("leadDays", e.target.value)} />
          </div>
        </div>
        <div>
          <label className={lab}>Notes (optional)</label>
          <input className={field} value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Anything to remember" />
        </div>
        <div className="flex gap-2 pt-1">
          <button disabled={!valid} onClick={() => onSave(f)} style={{ backgroundColor: valid ? NILE : "#94a3b8" }} className="flex-1 rounded-lg px-4 py-2.5 font-semibold text-white">
            {initial ? "Save changes" : "Add document"}
          </button>
          {onCancel && <button onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-600">Cancel</button>}
        </div>
      </div>
    </div>
  );
}

/* ===== card ===== */
function ItemCard({ it, onComplete, onEdit, onDelete }) {
  const meta = STATUS[statusOf(it)];
  const d = daysUntil(it.dueDate);
  const count = it.completed ? "Completed" : d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? "Due today" : `${d}d left`;
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex">
        <div style={{ backgroundColor: meta.bar, width: 5 }} />
        <div className="flex-1 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${CAT_COLOR[it.category]}`}>{it.category}</span>
                <span className="text-xs text-slate-400">{freqText(it.freqMonths)}</span>
              </div>
              <div className="mt-1 text-base font-semibold text-slate-900">{it.doc}</div>
              {it.client && <div className="truncate text-sm text-slate-500">{it.client}</div>}
            </div>
            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.chip}`}>
              <meta.Icon size={13} /> {meta.label}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="text-sm text-slate-600">{prettyDate(it.dueDate)}</div>
            <div className="text-sm font-bold" style={{ fontFamily: "ui-monospace, monospace", color: meta.bar }}>{count}</div>
          </div>
          {it.notes && <div className="mt-2 text-sm italic text-slate-500">{it.notes}</div>}
          {!it.completed && (
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={googleUrl(it)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700"><CalendarPlus size={15} /> Google</a>
              <a href={outlookUrl(it)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700"><CalendarPlus size={15} /> Outlook</a>
              <button onClick={() => downloadICS([it], `245D_${(it.client || it.doc).replace(/\s+/g, "_")}.ics`)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700"><Download size={15} /> .ics</button>
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-2 border-t border-slate-100 pt-2">
            <button onClick={() => onComplete(it)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-emerald-700">
              {it.completed ? <><RotateCcw size={15} /> Reopen</> : it.freqMonths ? <><Check size={15} /> Mark done · next due</> : <><Check size={15} /> Mark done</>}
            </button>
            <button onClick={() => onEdit(it)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-slate-500"><Pencil size={15} /> Edit</button>
            <button onClick={() => onDelete(it)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-slate-400"><Trash2 size={15} /> Delete</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== reference ===== */
function Reference() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-4 py-3 text-left font-semibold text-slate-700">
        <span className="inline-flex items-center gap-2"><BookOpen size={17} /> 245D &amp; CFSS document reference</span>
        <span className="text-slate-400">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="border-t border-slate-100 p-4 text-sm text-slate-600">
          {CATEGORIES.map((c) => (
            <div key={c} className="mb-3 last:mb-0">
              <div className={`mb-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${CAT_COLOR[c]}`}>{c}</div>
              <ul className="ml-1 space-y-0.5">
                {LIBRARY[c].map((p) => (
                  <li key={p.doc} className="flex justify-between gap-3"><span>{p.doc}</span><span className="shrink-0 text-slate-400">{freqText(p.freq)}</span></li>
                ))}
              </ul>
            </div>
          ))}
          <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-400">Cadences are defaults from the statutes/manuals (245D.07, 245D.071, 245A.65, 245D.09; CFSS under 256B.85 and the DHS CFSS Policy Manual) and are editable. CFSS reassessments are typically requested ~60 days before the service delivery plan expires; actual dates follow each person's plan and service type. Not legal advice — verify against current rules and your lead agency / licensor.</p>
        </div>
      )}
    </div>
  );
}

/* ===== app ===== */
export default function Tracker({ session, membership }) {
  const orgId = membership.org_id;
  const orgName = membership.organizations?.name || "Team";
  const joinCode = membership.organizations?.join_code || "";
  const [copied, setCopied] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("All");
  const [error, setError] = useState(null);

  const load = async () => {
    const { data, error } = await supabase.from("tracked_items").select("*").order("due_date", { ascending: true });
    if (error) setError(error.message);
    else setItems(data.map(fromRow));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async (f) => {
    setError(null);
    const row = toRow(f);
    const { error } = editing
      ? await supabase.from("tracked_items").update(row).eq("id", editing.id)
      : await supabase.from("tracked_items").insert({ ...row, org_id: orgId });
    if (error) { setError(error.message); return; }
    setShowForm(false); setEditing(null); load();
  };
  const complete = async (it) => {
    const patch = it.completed ? { completed: false } : it.freqMonths ? { due_date: addMonths(it.dueDate, it.freqMonths) } : { completed: true };
    const { error } = await supabase.from("tracked_items").update(patch).eq("id", it.id);
    if (error) setError(error.message); else load();
  };
  const remove = async (it) => {
    const { error } = await supabase.from("tracked_items").delete().eq("id", it.id);
    if (error) setError(error.message); else load();
  };

  const counts = useMemo(() => {
    const c = { overdue: 0, soon: 0, ontrack: 0 };
    items.forEach((x) => { const s = statusOf(x); if (c[s] !== undefined) c[s]++; });
    return c;
  }, [items]);
  const shown = useMemo(() => {
    const list = filter === "All" ? items : items.filter((x) => x.category === filter);
    return [...list].sort((a, b) => (a.completed !== b.completed ? (a.completed ? 1 : -1) : parseLocal(a.dueDate) - parseLocal(b.dueDate)));
  }, [items, filter]);

  return (
    <div className="min-h-screen bg-slate-100" style={{ fontFamily: "system-ui, sans-serif" }}>
      <header className="border-b border-slate-200 bg-white px-5 pb-5 pt-6">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-start justify-between gap-3">
            <Logo size={42} />
            <button onClick={() => supabase.auth.signOut()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600">
              <LogOut size={15} /> Sign out
            </button>
          </div>
          <div className="mt-3 text-xs font-semibold uppercase tracking-widest text-slate-400">245D & CFSS Tracker</div>
          <p className="mt-1 text-sm text-slate-500">{orgName} · {session.user.email}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-slate-400">Invite code</span>
            <button
              onClick={() => { navigator.clipboard?.writeText(joinCode); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs tracking-wider text-slate-700"
              title="Copy invite code"
            >
              {copied ? "Copied!" : joinCode}
            </button>
            <span className="text-xs text-slate-400">share to add staff</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[["overdue", counts.overdue, "#dc2626", "bg-red-50"], ["due soon", counts.soon, "#d97706", "bg-amber-50"], ["on track", counts.ontrack, "#059669", "bg-emerald-50"]].map(([label, n, col, bg]) => (
              <div key={label} className={`rounded-lg px-3 py-2 ${bg}`}>
                <div className="text-2xl font-bold" style={{ color: col, fontFamily: "ui-monospace, monospace" }}>{n}</div>
                <div className="text-xs capitalize text-slate-500">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-5">
        <Reference />
        {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="mb-3 flex gap-2">
          {!showForm && <button onClick={() => { setEditing(null); setShowForm(true); }} style={{ backgroundColor: NILE }} className="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-semibold text-white"><Plus size={18} /> Add document</button>}
          {items.length > 0 && <button onClick={() => downloadICS(items.filter((x) => !x.completed), "245D_all.ics")} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-semibold text-slate-700"><FileDown size={18} /> Export all</button>}
        </div>

        {items.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {["All", ...CATEGORIES].map((c) => (
              <button key={c} onClick={() => setFilter(c)} className={`rounded-full px-3 py-1 text-sm font-medium ${filter === c ? "bg-slate-800 text-white" : "bg-white text-slate-600 border border-slate-300"}`}>{c}</button>
            ))}
          </div>
        )}

        {showForm && (
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold text-slate-700">{editing ? "Edit document" : "New document"}</h2>
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="text-slate-400"><X size={20} /></button>
            </div>
            <ItemForm initial={editing} onSave={save} onCancel={() => { setShowForm(false); setEditing(null); }} />
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-slate-400">Loading…</div>
        ) : shown.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white py-14 text-center">
            <p className="font-semibold text-slate-600">{items.length ? "Nothing in this category" : "No documents tracked yet"}</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-slate-400">Add a document and its date to start. Pick from the 245D library or add your own.</p>
          </div>
        ) : (
          <div className="grid gap-3">{shown.map((it) => <ItemCard key={it.id} it={it} onComplete={complete} onEdit={(x) => { setEditing(x); setShowForm(true); }} onDelete={remove} />)}</div>
        )}

        <p className="mt-6 px-1 text-center text-xs text-slate-400">Everyone on your team shares this list and can reach it from any computer they sign in on. Google/Outlook buttons open your calendar pre-filled; the .ics import carries the repeat and reminder.</p>
        <p className="mt-2 px-1 text-center text-xs text-slate-400">Questions? <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-slate-500 underline">{CONTACT_EMAIL}</a></p>
      </main>
    </div>
  );
}
