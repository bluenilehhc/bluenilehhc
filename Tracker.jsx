import { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabase";
import Logo from "./Logo.jsx";
import { CONTACT_EMAIL } from "./brand.js";
import {
  CalendarPlus, Check, Trash2, Pencil, Plus, X, Download,
  CircleAlert, Clock, ShieldCheck, FileDown, BookOpen, RotateCcw, LogOut, UserPlus, ChevronLeft, ChevronRight,
} from "lucide-react";

const NILE = "#0f2b46";

/* ===== 245D / CFSS document library ===== */
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
const todayISO = () => toISO(todayLocal());
const parseLocal = (s) => { if (!s) return null; const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function addMonths(s, n) {
  const d = parseLocal(s); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return toISO(d);
}
const daysUntil = (s) => Math.round((parseLocal(s) - todayLocal()) / 86400000);
const prettyDate = (s) => parseLocal(s).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
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

/* ===== calendar (events) ===== */
const rruleFor = (f) => (!f ? "" : f === 12 ? "RRULE:FREQ=YEARLY" : `RRULE:FREQ=MONTHLY;INTERVAL=${f}`);
const eventTitle = (it) => `245D ${it.doc}${it.client ? ": " + it.client : ""}`;
const eventDetails = (it) => {
  const b = [`Client: ${it.client || ""}`, `Category: ${it.category}`, `Recurs: ${freqText(it.freqMonths)}`];
  if (it.notes) b.push(it.notes); b.push("Tracked in Blue Nile 245D/CFSS Tracker."); return b.join("\n");
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
  const out = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Blue Nile Tracker//EN", "CALSCALE:GREGORIAN"];
  items.forEach((it) => {
    const lead = Number(it.leadDays) || 30;
    out.push("BEGIN:VEVENT", `UID:${it.id}@bn-tracker`, `DTSTART;VALUE=DATE:${icsDate(it.dueDate)}`, `DTEND;VALUE=DATE:${icsDatePlus1(it.dueDate)}`, `SUMMARY:${esc(eventTitle(it))}`, `DESCRIPTION:${esc(eventDetails(it))}`);
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

/* ===== row mapping ===== */
const fromRow = (r) => ({ id: r.id, client: r.client || "", category: r.category, doc: r.doc, dueDate: r.due_date, freqMonths: r.freq_months, leadDays: r.lead_days, notes: r.notes || "", completed: r.completed });

/* ===== month calendar (right side) ===== */
function MonthCalendar({ items, category }) {
  const now = new Date();
  const [cur, setCur] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [sel, setSel] = useState(null);

  const byDate = useMemo(() => {
    const map = {};
    (category === "All" ? items : items.filter((x) => x.category === category))
      .filter((x) => !x.completed)
      .forEach((it) => { (map[it.dueDate] = map[it.dueDate] || []).push(it); });
    return map;
  }, [items, category]);

  const first = new Date(cur.y, cur.m, 1);
  const startDay = first.getDay();
  const dim = new Date(cur.y, cur.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(d);

  const label = first.toLocaleString(undefined, { month: "long", year: "numeric" });
  const prev = () => { setSel(null); setCur((c) => { const m = c.m - 1; return m < 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m }; }); };
  const next = () => { setSel(null); setCur((c) => { const m = c.m + 1; return m > 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m }; }); };
  const goToday = () => { setSel(null); setCur({ y: now.getFullYear(), m: now.getMonth() }); };
  const iso = (d) => `${cur.y}-${String(cur.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const todayIso = todayISO();
  const dotColor = (arr) => { let s = "ontrack"; arr.forEach((it) => { const st = statusOf(it); if (st === "overdue") s = "overdue"; else if (st === "soon" && s !== "overdue") s = "soon"; }); return STATUS[s].bar; };
  const selItems = sel ? (byDate[sel] || []) : [];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <button onClick={prev} className="rounded-md p-1 text-slate-500 hover:bg-slate-100"><ChevronLeft size={18} /></button>
        <div className="text-sm font-bold text-slate-800">{label}</div>
        <button onClick={next} className="rounded-md p-1 text-slate-500 hover:bg-slate-100"><ChevronRight size={18} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-400">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i}>{d}</div>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const day = iso(d);
          const arr = byDate[day];
          const isToday = day === todayIso;
          const isSel = day === sel;
          return (
            <button key={i} onClick={() => arr && setSel(isSel ? null : day)}
              className={`relative flex h-8 items-center justify-center rounded-md text-xs ${arr ? "cursor-pointer font-bold text-slate-800" : "text-slate-400"} ${isSel ? "ring-2 ring-slate-800" : ""} ${isToday ? "bg-slate-100" : ""}`}>
              {d}
              {arr && <span className="absolute bottom-0.5 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dotColor(arr) }} />}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: "#dc2626" }} />overdue</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: "#d97706" }} />soon</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: "#059669" }} />ok</span>
        </div>
        <button onClick={goToday} className="rounded-md border border-slate-300 px-2 py-0.5 text-xs text-slate-600">Today</button>
      </div>
      {sel && (
        <div className="mt-3 border-t border-slate-100 pt-2">
          <div className="mb-1 text-xs font-semibold text-slate-500">Due {prettyDate(sel)}</div>
          {selItems.length === 0 ? <div className="text-xs text-slate-400">Nothing due.</div> :
            selItems.map((it) => (
              <div key={it.id} className="flex items-center gap-2 py-1 text-sm">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: STATUS[statusOf(it)].bar }} />
                <span className="truncate"><span className="font-medium">{it.client}</span> · {it.doc}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

/* ===== Add-client wizard: pick many documents, each with its own date ===== */
function AddClientWizard({ onCancel, onCreate }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("CFSS");
  const [rows, setRows] = useState(() => LIBRARY["CFSS"].map((p) => ({ ...p, checked: true, date: "" })));
  const [bulkDate, setBulkDate] = useState(todayISO());
  const [err, setErr] = useState(null);

  const changeCategory = (c) => { setCategory(c); setRows(LIBRARY[c].map((p) => ({ ...p, checked: true, date: "" }))); };
  const setRow = (i, patch) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const applyBulk = () => setRows((rs) => rs.map((r) => (r.checked && !r.date ? { ...r, date: bulkDate } : r)));

  const field = "w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-500 bg-white";
  const lab = "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500";

  const submit = () => {
    setErr(null);
    if (!name.trim()) { setErr("Enter a client code or name."); return; }
    const picks = rows.filter((r) => r.checked && r.date).map((r) => ({ doc: r.doc, freq: r.freq, lead: r.lead, date: r.date }));
    if (picks.length === 0) { setErr("Check at least one document and give it a date."); return; }
    onCreate(name.trim(), category, picks);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-slate-700">New client — add documents</h2>
        <button onClick={onCancel} className="text-slate-400"><X size={20} /></button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><label className={lab}>Client code / name</label>
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. A.H. or C-104" /></div>
        <div><label className={lab}>Service category</label>
          <select className={field} value={category} onChange={(e) => changeCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select></div>
      </div>
      <div className="mt-4 mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-slate-600">Check the documents you need and set each due date</div>
        <div className="flex items-center gap-2">
          <input type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1 text-sm" />
          <button onClick={applyBulk} className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1 text-sm font-medium text-slate-700">Fill empty dates</button>
        </div>
      </div>
      <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200">
        {rows.map((r, i) => (
          <div key={r.doc} className={`flex items-center gap-3 border-b border-slate-100 px-3 py-2 last:border-0 ${r.checked ? "" : "opacity-50"}`}>
            <input type="checkbox" checked={r.checked} onChange={(e) => setRow(i, { checked: e.target.checked })} className="h-4 w-4" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-slate-800">{r.doc}</div>
              <div className="text-xs text-slate-400">{freqText(r.freq)}</div>
            </div>
            <input type="date" value={r.date} onChange={(e) => setRow(i, { date: e.target.value, checked: true })} className="rounded-lg border border-slate-300 px-2 py-1 text-sm" />
          </div>
        ))}
      </div>
      {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      <div className="mt-4 flex gap-2">
        <button onClick={submit} style={{ backgroundColor: NILE }} className="flex-1 rounded-lg px-4 py-2.5 font-semibold text-white">Add client &amp; documents</button>
        <button onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-600">Cancel</button>
      </div>
    </div>
  );
}

/* ===== single-document form ===== */
function DocForm({ client, category, initial, onSave, onCancel }) {
  const empty = { doc: "", dueDate: "", freqMonths: 12, leadDays: 30, notes: "" };
  const [f, setF] = useState(initial || empty);
  useEffect(() => setF(initial || empty), [initial]);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const presets = LIBRARY[category] || [];
  const isCustom = f.doc !== "" && !presets.some((p) => p.doc === f.doc);
  const pick = (name) => {
    const p = presets.find((x) => x.doc === name);
    if (name === "__custom") setF((prev) => ({ ...prev, doc: "" }));
    else if (p) setF((prev) => ({ ...prev, doc: p.doc, freqMonths: p.freq, leadDays: p.lead }));
    else set("doc", "");
  };
  const field = "w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-500 bg-white";
  const lab = "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500";
  const valid = f.doc.trim() && f.dueDate;
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{initial ? "Edit document" : "Add document"} · {client}</div>
      <label className={lab}>Document</label>
      <select className={field} value={presets.some((p) => p.doc === f.doc) ? f.doc : (f.doc ? "__custom" : "")} onChange={(e) => pick(e.target.value)}>
        <option value="">Choose a document…</option>
        {presets.map((p) => <option key={p.doc} value={p.doc}>{p.doc} · {freqText(p.freq)}</option>)}
        <option value="__custom">Custom…</option>
      </select>
      {isCustom && <input className={`${field} mt-2`} value={f.doc} onChange={(e) => set("doc", e.target.value)} placeholder="Custom document name" />}
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div><label className={lab}>Due date</label><input type="date" className={field} value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} /></div>
        <div><label className={lab}>Repeats</label>
          <select className={field} value={f.freqMonths} onChange={(e) => set("freqMonths", Number(e.target.value))}>
            <option value={12}>Annual</option><option value={6}>Every 6 months</option><option value={3}>Quarterly</option><option value={1}>Monthly</option><option value={0}>One-time</option>
          </select></div>
        <div><label className={lab}>Remind days early</label><input type="number" min="0" className={field} value={f.leadDays} onChange={(e) => set("leadDays", e.target.value)} /></div>
      </div>
      <input className={`${field} mt-2`} value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Notes (optional)" />
      <div className="mt-2 flex gap-2">
        <button disabled={!valid} onClick={() => onSave(f)} style={{ backgroundColor: valid ? NILE : "#94a3b8" }} className="flex-1 rounded-lg px-3 py-2 text-sm font-semibold text-white">{initial ? "Save" : "Add"}</button>
        <button onClick={onCancel} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600">Cancel</button>
      </div>
    </div>
  );
}

/* ===== document row ===== */
function DocRow({ it, onComplete, onEdit, onDelete, showClient }) {
  const meta = STATUS[statusOf(it)];
  const d = daysUntil(it.dueDate);
  const count = it.completed ? "Completed" : d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? "Due today" : `${d}d left`;
  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex">
        <div style={{ backgroundColor: meta.bar, width: 5 }} />
        <div className="flex-1 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {showClient && <div className="text-xs font-semibold text-slate-500">{it.client} · <span className="font-normal">{it.category}</span></div>}
              <div className="text-sm font-semibold text-slate-900">{it.doc}</div>
              <div className="text-xs text-slate-400">{freqText(it.freqMonths)}</div>
            </div>
            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.chip}`}><meta.Icon size={13} /> {meta.label}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div className="text-sm text-slate-600">{prettyDate(it.dueDate)}</div>
            <div className="text-sm font-bold" style={{ fontFamily: "ui-monospace, monospace", color: meta.bar }}>{count}</div>
          </div>
          {it.notes && <div className="mt-1 text-sm italic text-slate-500">{it.notes}</div>}
          {!it.completed && (
            <div className="mt-2 flex flex-wrap gap-2">
              <a href={googleUrl(it)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"><CalendarPlus size={14} /> Google</a>
              <a href={outlookUrl(it)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"><CalendarPlus size={14} /> Outlook</a>
              <button onClick={() => downloadICS([it], `245D_${(it.client || it.doc).replace(/\s+/g, "_")}.ics`)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"><Download size={14} /> .ics</button>
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-2 border-t border-slate-100 pt-2">
            <button onClick={() => onComplete(it)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-emerald-700">
              {it.completed ? <><RotateCcw size={14} /> Reopen</> : it.freqMonths ? <><Check size={14} /> Done · next due</> : <><Check size={14} /> Mark done</>}
            </button>
            <button onClick={() => onEdit(it)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-slate-500"><Pencil size={14} /> Edit</button>
            <button onClick={() => onDelete(it)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-slate-400"><Trash2 size={14} /> Delete</button>
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
                {LIBRARY[c].map((p) => <li key={p.doc} className="flex justify-between gap-3"><span>{p.doc}</span><span className="shrink-0 text-slate-400">{freqText(p.freq)}</span></li>)}
              </ul>
            </div>
          ))}
          <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-400">Cadences are defaults (245D.07, 245D.071, 245A.65, 245D.09; CFSS under 256B.85 &amp; the DHS CFSS Policy Manual) and are editable. Actual dates follow each person's plan. Not legal advice — verify with your lead agency / licensor.</p>
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
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState(null); // null | overdue | soon | ontrack
  const [openState, setOpenState] = useState({});
  const [wizard, setWizard] = useState(false);
  const [docForm, setDocForm] = useState(null);

  const load = async () => {
    const { data, error } = await supabase.from("tracked_items").select("*").order("due_date", { ascending: true });
    if (error) setError(error.message); else setItems(data.map(fromRow));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const createClientDocs = async (name, category, picks) => {
    setError(null);
    const rows = picks.map((p) => ({ org_id: orgId, client: name, category, doc: p.doc, due_date: p.date, freq_months: p.freq, lead_days: p.lead, notes: "", completed: false }));
    const { error } = await supabase.from("tracked_items").insert(rows);
    if (error) { setError(error.message); return; }
    setWizard(false); setOpenState((s) => ({ ...s, [name + "||" + category]: true })); load();
  };
  const saveDoc = async (f) => {
    setError(null);
    const row = { client: docForm.client, category: docForm.category, doc: f.doc.trim(), due_date: f.dueDate, freq_months: Number(f.freqMonths), lead_days: Number(f.leadDays) || 30, notes: f.notes };
    const { error } = docForm.editId
      ? await supabase.from("tracked_items").update(row).eq("id", docForm.editId)
      : await supabase.from("tracked_items").insert({ ...row, org_id: orgId });
    if (error) { setError(error.message); return; }
    setDocForm(null); load();
  };
  const complete = async (it) => {
    const patch = it.completed ? { completed: false } : it.freqMonths ? { due_date: addMonths(it.dueDate, it.freqMonths) } : { completed: true };
    const { error } = await supabase.from("tracked_items").update(patch).eq("id", it.id);
    if (error) setError(error.message); else load();
  };
  const removeItem = async (it) => {
    const { error } = await supabase.from("tracked_items").delete().eq("id", it.id);
    if (error) setError(error.message); else load();
  };
  const renameProfile = async (client, category) => {
    const next = window.prompt("Rename this client to:", client);
    if (!next || !next.trim() || next.trim() === client) return;
    const { error } = await supabase.from("tracked_items").update({ client: next.trim() }).eq("client", client).eq("category", category);
    if (error) setError(error.message); else load();
  };
  const deleteProfile = async (client, category) => {
    if (!window.confirm(`Delete "${client}" and all its documents?`)) return;
    const { error } = await supabase.from("tracked_items").delete().eq("client", client).eq("category", category);
    if (error) setError(error.message); else load();
  };

  const counts = useMemo(() => {
    const c = { overdue: 0, soon: 0, ontrack: 0 };
    items.forEach((x) => { const s = statusOf(x); if (c[s] !== undefined) c[s]++; });
    return c;
  }, [items]);

  const profiles = useMemo(() => {
    const map = new Map();
    items.forEach((it) => {
      const key = (it.client || "Unassigned") + "||" + it.category;
      if (!map.has(key)) map.set(key, { key, client: it.client || "Unassigned", category: it.category, items: [] });
      map.get(key).items.push(it);
    });
    let arr = [...map.values()];
    if (filter !== "All") arr = arr.filter((p) => p.category === filter);
    arr.forEach((p) => p.items.sort((a, b) => (a.completed !== b.completed ? (a.completed ? 1 : -1) : parseLocal(a.dueDate) - parseLocal(b.dueDate))));
    arr.sort((a, b) => a.client.localeCompare(b.client));
    return arr;
  }, [items, filter]);

  const statusList = useMemo(() => {
    if (!statusFilter) return [];
    return (filter === "All" ? items : items.filter((x) => x.category === filter))
      .filter((x) => statusOf(x) === statusFilter)
      .sort((a, b) => parseLocal(a.dueDate) - parseLocal(b.dueDate));
  }, [items, filter, statusFilter]);

  return (
    <div className="min-h-screen bg-slate-100" style={{ fontFamily: "system-ui, sans-serif" }}>
      <header className="border-b border-slate-200 bg-white px-5 pb-5 pt-6">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-start justify-between gap-3">
            <Logo size={42} />
            <button onClick={() => supabase.auth.signOut()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600"><LogOut size={15} /> Sign out</button>
          </div>
          <div className="mt-3 text-xs font-semibold uppercase tracking-widest text-slate-400">245D &amp; CFSS Tracker</div>
          <p className="mt-1 text-sm text-slate-500">{orgName} · {session.user.email}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-slate-400">Invite code</span>
            <button onClick={() => { navigator.clipboard?.writeText(joinCode); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs tracking-wider text-slate-700">{copied ? "Copied!" : joinCode}</button>
            <span className="text-xs text-slate-400">share to add staff</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[["overdue", "overdue", counts.overdue, "#dc2626", "bg-red-50"], ["due soon", "soon", counts.soon, "#d97706", "bg-amber-50"], ["on track", "ontrack", counts.ontrack, "#059669", "bg-emerald-50"]].map(([label, key, n, col, bg]) => (
              <button key={key} onClick={() => setStatusFilter(statusFilter === key ? null : key)} className={`rounded-lg px-3 py-2 text-left ${bg} ${statusFilter === key ? "ring-2 ring-slate-800" : "hover:ring-1 hover:ring-slate-300"}`}>
                <div className="text-2xl font-bold" style={{ color: col, fontFamily: "ui-monospace, monospace" }}>{n}</div>
                <div className="text-xs capitalize text-slate-500">{label}</div>
              </button>
            ))}
          </div>
          <p className="mt-1 text-center text-[11px] text-slate-400">Tap a box above to see who's in it</p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5">
        <Reference />
        {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="grid gap-5 lg:grid-cols-[1fr_330px]">
          {/* LEFT: list */}
          <div>
            <div className="mb-3 flex gap-2">
              {!wizard && <button onClick={() => setWizard(true)} style={{ backgroundColor: NILE }} className="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-semibold text-white"><UserPlus size={18} /> Add client</button>}
              {items.length > 0 && <button onClick={() => downloadICS(items.filter((x) => !x.completed), "245D_CFSS_all.ics")} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-semibold text-slate-700"><FileDown size={18} /> Export all</button>}
            </div>

            {items.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-1.5">
                {["All", ...CATEGORIES].map((c) => <button key={c} onClick={() => setFilter(c)} className={`rounded-full px-3 py-1 text-sm font-medium ${filter === c ? "bg-slate-800 text-white" : "bg-white text-slate-600 border border-slate-300"}`}>{c}</button>)}
              </div>
            )}

            {wizard && <div className="mb-4"><AddClientWizard onCancel={() => setWizard(false)} onCreate={createClientDocs} /></div>}

            {statusFilter ? (
              <div>
                <div className="mb-3 flex items-center justify-between rounded-lg border px-3 py-2" style={{ borderColor: STATUS[statusFilter].bar }}>
                  <div className="text-sm font-semibold" style={{ color: STATUS[statusFilter].bar }}>{STATUS[statusFilter].label} — {statusList.length}{filter !== "All" ? " in " + filter : ""}</div>
                  <button onClick={() => setStatusFilter(null)} className="inline-flex items-center gap-1 text-sm text-slate-500"><X size={15} /> Clear</button>
                </div>
                {statusList.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white py-10 text-center text-sm text-slate-400">Nothing here right now.</div>
                ) : statusList.map((it) => (
                  docForm && docForm.editId === it.id
                    ? <div key={it.id} className="mt-2"><DocForm client={it.client} category={it.category} initial={{ doc: it.doc, dueDate: it.dueDate, freqMonths: it.freqMonths, leadDays: it.leadDays, notes: it.notes }} onSave={saveDoc} onCancel={() => setDocForm(null)} /></div>
                    : <DocRow key={it.id} it={it} showClient onComplete={complete} onEdit={(x) => setDocForm({ client: x.client, category: x.category, editId: x.id })} onDelete={removeItem} />
                ))}
              </div>
            ) : loading ? (
              <div className="py-16 text-center text-slate-400">Loading…</div>
            ) : profiles.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white py-14 text-center">
                <p className="font-semibold text-slate-600">{items.length ? "No clients in this category" : "No clients yet"}</p>
                <p className="mx-auto mt-1 max-w-xs text-sm text-slate-400">Tap “Add client”, pick the service type, then check the documents and set each due date.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {profiles.map((p) => {
                  const open = openState[p.key] !== false;
                  const sc = { overdue: 0, soon: 0 };
                  p.items.forEach((x) => { const s = statusOf(x); if (s === "overdue") sc.overdue++; else if (s === "soon") sc.soon++; });
                  const dot = sc.overdue ? "#dc2626" : sc.soon ? "#d97706" : "#059669";
                  const sum = sc.overdue || sc.soon ? `${sc.overdue ? sc.overdue + " overdue" : ""}${sc.overdue && sc.soon ? ", " : ""}${sc.soon ? sc.soon + " due soon" : ""}` : "all on track";
                  const addingHere = docForm && !docForm.editId && docForm.client === p.client && docForm.category === p.category;
                  return (
                    <div key={p.key} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                      <div className="flex cursor-pointer items-center justify-between gap-3 p-4" onClick={() => setOpenState((s) => ({ ...s, [p.key]: !open }))}>
                        <div className="min-w-0">
                          <div className="text-base font-bold text-slate-900">{p.client} <span className={`ml-1 rounded-full px-2 py-0.5 align-middle text-[11px] font-semibold ${CAT_COLOR[p.category]}`}>{p.category}</span></div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500"><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: dot }} />{sum} · {p.items.length} doc{p.items.length === 1 ? "" : "s"}</div>
                        </div>
                        <span className="text-xl text-slate-400">{open ? "−" : "+"}</span>
                      </div>
                      {open && (
                        <div className="border-t border-slate-100 px-4 pb-4 pt-2">
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => setDocForm({ client: p.client, category: p.category, editId: null })} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-sm font-medium text-slate-700"><Plus size={15} /> Add document</button>
                            <button onClick={() => downloadICS(p.items.filter((x) => !x.completed), `245D_${p.client.replace(/\s+/g, "_")}.ics`)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-sm font-medium text-slate-700"><FileDown size={15} /> Export client</button>
                            <button onClick={() => renameProfile(p.client, p.category)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-slate-500"><Pencil size={15} /> Rename</button>
                            <button onClick={() => deleteProfile(p.client, p.category)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-slate-400"><Trash2 size={15} /> Delete</button>
                          </div>
                          {addingHere && <div className="mt-3"><DocForm client={p.client} category={p.category} onSave={saveDoc} onCancel={() => setDocForm(null)} /></div>}
                          {p.items.map((it) => (
                            docForm && docForm.editId === it.id
                              ? <div key={it.id} className="mt-2"><DocForm client={p.client} category={p.category} initial={{ doc: it.doc, dueDate: it.dueDate, freqMonths: it.freqMonths, leadDays: it.leadDays, notes: it.notes }} onSave={saveDoc} onCancel={() => setDocForm(null)} /></div>
                              : <DocRow key={it.id} it={it} onComplete={complete} onEdit={(x) => setDocForm({ client: p.client, category: p.category, editId: x.id })} onDelete={removeItem} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT: calendar */}
          <div className="lg:sticky lg:top-4 lg:self-start">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Calendar {filter !== "All" ? "· " + filter : ""}</div>
            <MonthCalendar items={items} category={filter} />
          </div>
        </div>

        <p className="mt-6 px-1 text-center text-xs text-slate-400">Add a client once, then check off their documents with a due date for each. Everyone on your team shares this list.</p>
        <p className="mt-2 px-1 text-center text-xs text-slate-400">Questions? <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-slate-500 underline">{CONTACT_EMAIL}</a></p>
      </main>
    </div>
  );
}
