import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Search, Filter, X, AlertTriangle, CheckCircle2, Clock, Radio, Plus,
  Building2, Wallet, TrendingUp, ShieldAlert, RefreshCw, LogOut, Mail,
  Loader2, Users, Eye, ArrowLeft,
} from "lucide-react";

/* ====================================================================== */
/*  CONFIG — edit these as your org changes                               */
/* ====================================================================== */

// 1. Your Supabase connection. Paste your PUBLISHABLE (anon) key below.
//    The URL is safe here; the anon key is safe in frontend code because
//    Row Level Security controls what it can actually read/write.
const SUPABASE_URL = "https://xrekebgnubhjqtpllbcz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ic6iwJHLl6R8GHQ6exf7vg_xjBq5hjr";

// 2. The selling teams shown in the management breakdown toggle.
//    (Order Delivery / leadership are intentionally excluded here.)
const SELLING_TEAMS = ["Sam Wilkes", "Michael Barker", "Chris Pennington"];

// NOTE: The staff list (Closer / Lead Gen dropdowns) now comes LIVE from the
//   `staff` table in Supabase — no hardcoding. Each person's team and UIN are
//   read from there, and only staff with sells = true appear in the dropdowns.

/* ====================================================================== */

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Live staff list, loaded once from the database and shared to every form.
const StaffContext = React.createContext({ all: [], sellers: [] });
const useStaff = () => React.useContext(StaffContext);
const findStaff = (list, name) => list.find((s) => s.full_name === name) || null;

/* ---------------------------------------------------------------------- */
/*  DESIGN TOKENS                                                          */
/* ---------------------------------------------------------------------- */

const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
.sw-root {
  --bg:#F4F3FA; --surface:#FFF; --surface-alt:#FAF9FE; --border:#E3E0F0;
  --ink:#1D1A2E; --ink-soft:#6E6884; --ink-faint:#9C97B3;
  --primary:#4C1D8F; --primary-soft:#EEE7FB;
  --gold:#96700A; --gold-soft:#FBF3DE; --green:#1F7A3D; --green-soft:#E4F5E9;
  --amber:#B3660E; --amber-soft:#FBEDDA; --blue:#205EA6; --blue-soft:#E4EDF9;
  --red:#C0392B; --red-soft:#FBE7E4;
  font-family:'Inter',ui-sans-serif,system-ui,sans-serif; color:var(--ink);
  background:var(--bg); min-height:100vh;
}
.sw-root *{box-sizing:border-box;}
.sw-display{font-family:'Space Grotesk','Inter',sans-serif;letter-spacing:-.01em;}
.sw-mono{font-family:'JetBrains Mono',ui-monospace,monospace;}
.sw-root ::-webkit-scrollbar{width:8px;height:8px;}
.sw-root ::-webkit-scrollbar-thumb{background:var(--border);border-radius:8px;}
@keyframes sw-pulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.45;transform:scale(.82);}}
.sw-live-dot{animation:sw-pulse 1.8s ease-in-out infinite;}
@keyframes sw-flash{0%{background:var(--primary-soft);}100%{background:transparent;}}
.sw-flash{animation:sw-flash 1.6s ease-out;}
@keyframes sw-rise{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
.sw-rise{animation:sw-rise .35s ease-out both;}
@keyframes sw-slide-in{from{transform:translateX(24px);opacity:0;}to{transform:translateX(0);opacity:1;}}
.sw-slide-in{animation:sw-slide-in .28s cubic-bezier(.16,1,.3,1) both;}
.sw-focus:focus-visible{outline:2px solid var(--primary);outline-offset:2px;}
.sw-input{width:100%;font-size:13.5px;font-family:'Inter',sans-serif;padding:9px 11px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--ink);transition:border-color .15s,box-shadow .15s;}
.sw-input:focus{outline:none;border-color:var(--primary);box-shadow:0 0 0 3px var(--primary-soft);}
.sw-input::placeholder{color:var(--ink-faint);}
.sw-label{display:block;font-size:12px;font-weight:600;color:var(--ink-soft);margin-bottom:5px;}
.sw-req{color:var(--red);margin-left:2px;}
.sw-err{color:var(--red);font-size:12px;margin-top:4px;}
`;

/* ---------------------------------------------------------------------- */
/*  STATUS / FORMAT HELPERS                                                */
/* ---------------------------------------------------------------------- */

const STATUS_PIPELINE = ["Lilac Submitted", "NetSuite Processing", "Billed", "Closed Won"];
const STATUS_STYLE = {
  "Lilac Submitted": { fg: "var(--primary)", bg: "var(--primary-soft)" },
  "NetSuite Processing": { fg: "var(--amber)", bg: "var(--amber-soft)" },
  "Billed": { fg: "var(--blue)", bg: "var(--blue-soft)" },
  "Closed Won": { fg: "var(--green)", bg: "var(--green-soft)" },
  "Arbitration Pending": { fg: "var(--gold)", bg: "var(--gold-soft)" },
};
const ENTITY_TYPES = ["Charity", "Limited", "LLP", "Partnership", "Proprietorship", "Sole Trader", "Other"];
const DEAL_TYPES = ["Acquisition", "Cross-sell", "Migration", "Upgrade", "Resign", "Modify"];
const ARB_REASONS = ["CV Call plan", "Incremental Commission", "Transaction Change", "Mobile"];

const fmtGBP = (n) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const daysSince = (d) => (d ? Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000)) : 0);
const pctToNum = (p) => (parseFloat(String(p).replace("%", "")) || 0) / 100;
const num = (v) => (v == null || v === "" ? 0 : parseFloat(v) || 0);

// ---- GP aggregation with double-count logic -------------------------
// OFFICE GP: each deal's true GP, counted once (over-claims never inflate).
function officeGP(orders) {
  return orders.reduce((s, o) => s + (o.gp_office != null ? num(o.gp_office) : num(o.sales_agent_gp)), 0);
}
// TEAM GP: sum of that team's people's actual shares (closer + lead gen where
// their team matches), minus same-team over-claim excess on their deals.
function teamGP(orders, team) {
  let total = 0;
  for (const o of orders) {
    if (o.closer_team === team) total += num(o.closer_share);
    if (o.lead_gen_name && o.lead_gen_team === team) total += num(o.lead_gen_share);
    // dock same-team overclaim excess once (it's attached to the closer's team)
    if (o.closer_team === team && o.lead_gen_team === team) total -= num(o.gp_same_team_excess);
  }
  return total;
}
// SOV: order value, straight sum.
function totalSOV(orders) {
  return orders.reduce((s, o) => s + num(o.contract_value), 0);
}

/* ---- Product detection from the free-text Order Details -------------- */
// Agents describe what they've sold in prose, so the product is inferred
// from that text plus the structured yes/no flags on the form. Mirrors the
// classifier used for the historical import so old and new rows agree.
const PRODUCT_RULES = [
  ["Mobile",      /(\bee\s*sim|sim ?o?\b|\bsims?\b|mobile|\bmobs?\b|handsets?|\bfm\b|future mobile|\bmbb\b|airtime|\bsimo\b|\d+\s*gb data|bob bundle|5g\b|connections?\b|iphone|samsung|\bsme\b|\bacq rate)/i],
  ["Cloud Voice", /(cloud voice|cloud work|\bcw\b|cloud phone|complete cloud|\bcv\b|\bcve\b|cloud mod|licen[cs]e|collabrate|connect users|\bcloud\b|\bcp\b)/i],
  ["DV4 Cloud",   /(\bdv4|\bdv\b|\bdv4b\b)/i],
  ["BT Net",      /(bt\s*net|btnet|\bftip|gig on gig|\blevel [12]\b)/i],
  ["Broadband",   /(fttp|fttc|sogea|adsl|broadband|\bbb\b|\bbbeu|superfast|\bhalo\b|\bsup ess\b|ethernet|full fibre|essential \d+|tripple speed|triple speed|\bfbww|\bbndl|\bont\b)/i],
  ["Security",    /(badr|\bsecurity\b|\bccs\b|\bsecure\b|\bsec\b)/i],
  ["PSTN/Lines",  /(\bpstn\b|analogue line|\bisdn\b|\blines?\b)/i],
  ["Wi-Fi",       /(hybrid ?wifi|wi-?fi|smart hub|access point)/i],
  ["Porting",     /(number port|porting)/i],
  ["Cease/Admin", /(\bcease\b|backdate|\bmod\b|name change|\bcancel)/i],
];
const PRODUCT_GROUP = {
  "Mobile": "Mobile", "Cloud Voice": "Cloud", "DV4 Cloud": "Cloud", "BT Net": "Connectivity",
  "Broadband": "Broadband", "Security": "Security", "PSTN/Lines": "Connectivity",
  "Wi-Fi": "Connectivity", "Porting": "Connectivity", "Cease/Admin": "Other",
};

function detectProducts(text, flags = {}) {
  let t = text || "";
  if (flags.bundle) t += " broadband bundle";
  if (flags.pstnCve) t += " pstn cve";
  if (flags.cloudPorting) t += " cloud porting";
  if (flags.portingMobiles) t += " porting mobiles";
  if (flags.mobileOrder) t += " mobile";
  if (flags.btNet) t += " btnet";
  if (flags.dv4) t += " dv4";
  if (flags.badr) t += " badr security";
  const tags = PRODUCT_RULES.filter(([, re]) => re.test(t)).map(([label]) => label);
  if (tags.length === 0) return { summary: "Unspecified", group: "Other", tags: [] };
  const groups = [];
  tags.forEach((tag) => { const g = PRODUCT_GROUP[tag]; if (!groups.includes(g)) groups.push(g); });
  return { summary: tags.join(" + "), group: groups.join(" + "), tags };
}

/* ---- LBCR reference: the key carried across to NetSuite -------------- */
// Date-prefixed so collisions are only ever possible within a single day,
// which makes a clash vanishingly unlikely even at high volume.
function makeLbcrRef() {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rand = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
  return `LBCR-${yy}${mm}${dd}${rand}`;
}

/* ---- "Not Statted": submitted >12h ago with no NetSuite match -------- */
const NOT_STATTED_HOURS = 12;
function isNotStatted(o) {
  if (o.netsuite_matched_at || o.document_number) return false; // matched
  if (!o.submission_date) return false;
  const hours = (Date.now() - new Date(o.submission_date).getTime()) / 3600000;
  return hours > NOT_STATTED_HOURS;
}

/* ---- Time period filtering (financial year runs April -> March) ------ */
const PERIODS = [
  { key: "day", label: "Today" },
  { key: "wtd", label: "WTD" },
  { key: "mtd", label: "MTD" },
  { key: "ytd", label: "YTD" },
  { key: "all", label: "All" },
];

// Start of the current financial year: 1 April of this year if we're in
// April or later, otherwise 1 April of last year.
function fyStart(now = new Date()) {
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(y, 3, 1, 0, 0, 0, 0);
}
// Monday as the first day of the working week.
function weekStart(now = new Date()) {
  const d = new Date(now);
  const day = (d.getDay() + 6) % 7; // Mon=0 ... Sun=6
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}
function periodStart(period, now = new Date()) {
  switch (period) {
    case "day": { const d = new Date(now); d.setHours(0, 0, 0, 0); return d; }
    case "wtd": return weekStart(now);
    case "mtd": return new Date(now.getFullYear(), now.getMonth(), 1);
    case "ytd": return fyStart(now);
    default: return null; // 'all'
  }
}
function filterByPeriod(orders, period) {
  const start = periodStart(period);
  if (!start) return orders;
  const t = start.getTime();
  return orders.filter((o) => o.submission_date && new Date(o.submission_date).getTime() >= t);
}

// Recompute every derived GP figure from a GP value + the two split %s +
// whether closer & lead gen share a team. Mirrors the test-data logic so
// edits stay consistent with imported rows.
function recomputeGP({ gp, closerPct, leadGenPct, sameTeam, hasLeadGen }) {
  const g = num(gp);
  const cPct = num(closerPct);
  const lPct = hasLeadGen ? num(leadGenPct) : 0;
  const closer_share = +(g * cPct / 100).toFixed(2);
  const lead_gen_share = +(g * lPct / 100).toFixed(2);
  const excessPct = Math.max(0, cPct + lPct - 100);
  const excess = +(g * excessPct / 100).toFixed(2);
  return {
    sales_agent_gp: g,
    closer_share,
    lead_gen_share,
    closer_pct: cPct,
    lead_gen_pct: lPct,
    gp_office: g,                                   // true single-count profit
    gp_same_team_excess: sameTeam ? excess : 0,     // dock from team only if same-team overclaim
  };
}

// The GP figure to show ON A ROW, relative to who is viewing:
//   office (whole office) -> full single-count GP
//   a team scope          -> that team's cut of this specific deal
function rowGPForViewer(o, viewerScope) {
  if (!viewerScope || viewerScope === "office") return num(o.gp_office != null ? o.gp_office : o.sales_agent_gp);
  let v = 0;
  if (o.closer_team === viewerScope) v += num(o.closer_share);
  if (o.lead_gen_name && o.lead_gen_team === viewerScope) v += num(o.lead_gen_share);
  if (o.closer_team === viewerScope && o.lead_gen_team === viewerScope) v -= num(o.gp_same_team_excess);
  return v;
}

function StatusPill({ status }) {
  const s = STATUS_STYLE[status] || { fg: "var(--ink-soft)", bg: "var(--surface-alt)" };
  return (
    <span style={{ color: s.fg, background: s.bg }} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap">
      <span style={{ background: s.fg }} className="w-1.5 h-1.5 rounded-full" />
      {status}
    </span>
  );
}
function IdChip({ children }) {
  return <span className="sw-mono text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", color: "var(--ink-soft)" }}>{children}</span>;
}
function KPICard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="sw-rise rounded-2xl p-3.5 flex flex-col gap-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide truncate" style={{ color: "var(--ink-soft)" }}>{label}</span>
        <div className="w-7 h-7 shrink-0 rounded-lg flex items-center justify-center" style={{ background: accent + "1a", color: accent }}><Icon size={14} strokeWidth={2.25} /></div>
      </div>
      <div className="sw-display text-xl font-bold truncate">{value}</div>
      {sub && <div className="text-xs truncate" style={{ color: "var(--ink-faint)" }}>{sub}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  GENERIC FORM CONTROLS                                                  */
/* ---------------------------------------------------------------------- */

function Field({ label, name, value, onChange, type = "text", required, options, textarea, rows = 2, placeholder, error, colSpan }) {
  return (
    <div style={colSpan ? { gridColumn: `span ${colSpan}` } : undefined}>
      <label className="sw-label">{label} {required && <span className="sw-req">*</span>}</label>
      {textarea ? (
        <textarea className="sw-input sw-focus" name={name} value={value ?? ""} onChange={onChange} rows={rows} placeholder={placeholder} />
      ) : options ? (
        <select className="sw-input sw-focus" name={name} value={value ?? ""} onChange={onChange}>
          <option value="">Select...</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input className="sw-input sw-focus" type={type} name={name} value={value ?? ""} onChange={onChange} placeholder={placeholder} />
      )}
      {error && <div className="sw-err">{error}</div>}
    </div>
  );
}
function CheckboxGroup({ label, options, values, onToggle, error }) {
  return (
    <div>
      <label className="sw-label">{label}</label>
      <div className="flex flex-wrap gap-3 p-3 rounded-lg" style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}>
        {options.map((o) => (
          <label key={o} className="flex items-center gap-1.5 text-sm cursor-pointer">
            <input type="checkbox" checked={values.includes(o)} onChange={() => onToggle(o)} />{o}
          </label>
        ))}
      </div>
      {error && <div className="sw-err">{error}</div>}
    </div>
  );
}
function SectionCard({ title, children, tone = "primary", right }) {
  return (
    <div className="sw-rise rounded-2xl p-5 mb-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-4 pb-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <h3 className="sw-display text-sm font-bold" style={{ color: `var(--${tone})` }}>{title}</h3>
        {right}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{children}</div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  LOGIN SCREEN (magic link)                                             */
/* ---------------------------------------------------------------------- */

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const sendLink = async () => {
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Enter a valid email address."); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  return (
    <div className="sw-root flex items-center justify-center p-6" style={{ minHeight: "100vh" }}>
      <style>{STYLE}</style>
      <div className="sw-rise w-full max-w-sm rounded-2xl p-8" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center sw-display font-bold text-white" style={{ background: "var(--primary)" }}>S</div>
          <div>
            <div className="sw-display font-bold text-lg leading-tight">SchThrive WebOS</div>
            <div className="text-xs" style={{ color: "var(--ink-faint)" }}>Order tracking · GBP</div>
          </div>
        </div>
        {sent ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "var(--green-soft)", color: "var(--green)" }}><Mail size={22} /></div>
            <div className="font-semibold mb-1">Check your inbox</div>
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>We sent a sign-in link to <b>{email}</b>. Open it on this device to continue.</p>
            <button onClick={() => { setSent(false); setEmail(""); }} className="sw-focus text-xs font-semibold mt-4" style={{ color: "var(--primary)" }}>Use a different email</button>
          </div>
        ) : (
          <>
            <label className="sw-label">Work email</label>
            <input className="sw-input sw-focus" type="email" value={email} placeholder="you@btlbsw.co.uk" onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendLink()} />
            {error && <div className="sw-err">{error}</div>}
            <button onClick={sendLink} disabled={busy} className="sw-focus w-full py-3 rounded-full font-semibold text-sm mt-4 flex items-center justify-center gap-2" style={{ background: "var(--primary)", color: "#fff", opacity: busy ? 0.7 : 1 }}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />} Send sign-in link
            </button>
            <p className="text-xs text-center mt-4" style={{ color: "var(--ink-faint)" }}>No password needed — we email you a secure link.</p>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  DASHBOARD                                                              */
/* ---------------------------------------------------------------------- */

function DashboardView({ orders, onOpenOrder, flashId, profile, loading }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [agentFilter, setAgentFilter] = useState("All");
  const [sortKey, setSortKey] = useState("last_updated");
  const [sortDir, setSortDir] = useState("desc");
  const role = profile?.role || "agent";
  const isOffice = role === "office";
  const is2ic = role === "2ic";
  // office starts on whole-office; 2ic starts scoped to their own team
  const [scope, setScope] = useState(is2ic ? (profile?.team || "office") : "office");
  const [period, setPeriod] = useState("mtd"); // MTD is the default view
  const canFilterByAgent = isOffice || is2ic;

  // Period first, then team scope — so every figure below reflects both.
  const inPeriod = useMemo(() => filterByPeriod(orders, period), [orders, period]);

  const scoped = useMemo(() => {
    if (isOffice && scope === "office") return inPeriod;
    if (isOffice) return inPeriod.filter((o) => o.closer_team === scope || o.lead_gen_team === scope);
    // 2ic: RLS already limits rows to their team; the toggle lets them narrow to just themselves
    return inPeriod;
  }, [inPeriod, isOffice, scope]);

  // Every agent (closer or lead gen) appearing in the currently-scoped orders —
  // this is how a manager/2IC "sorts the list to agents".
  const agentOptions = useMemo(() => {
    const names = new Set();
    scoped.forEach((o) => { if (o.closer_name) names.add(o.closer_name); if (o.lead_gen_name) names.add(o.lead_gen_name); });
    return Array.from(names).sort();
  }, [scoped]);

  const filtered = useMemo(() => {
    const f = scoped.filter((o) => {
      const q = query.trim().toLowerCase();
      const mq = !q || (o.company_name || "").toLowerCase().includes(q) || (o.opp_id || "").toLowerCase().includes(q) || (o.cug || "").toLowerCase().includes(q);
      const ms = statusFilter === "All"
        || (statusFilter === "__not_statted" ? isNotStatted(o) : o.order_status === statusFilter);
      const ma = agentFilter === "All" || o.closer_name === agentFilter || o.lead_gen_name === agentFilter;
      return mq && ms && ma;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    const sorted = [...f].sort((a, b) => {
      let av, bv;
      switch (sortKey) {
        case "company": av = a.company_name || ""; bv = b.company_name || ""; break;
        case "agent": av = a.closer_name || ""; bv = b.closer_name || ""; break;
        case "sov": av = num(a.contract_value); bv = num(b.contract_value); break;
        case "gp": av = num(a.gp_office != null ? a.gp_office : a.sales_agent_gp); bv = num(b.gp_office != null ? b.gp_office : b.sales_agent_gp); break;
        case "status": av = a.order_status || ""; bv = b.order_status || ""; break;
        default: av = a.last_updated || ""; bv = b.last_updated || "";
      }
      if (typeof av === "string") return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
    return sorted;
  }, [scoped, query, statusFilter, agentFilter, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "company" || key === "agent" || key === "status" ? "asc" : "desc"); }
  };

  const sovTotal = useMemo(() => totalSOV(scoped), [scoped]);
  const gpTotal = useMemo(() => {
    // Office (whole office) -> single-count office GP.
    // A specific team scope -> that team's docked GP.
    if (isOffice && scope !== "office") return teamGP(scoped, scope);
    if (is2ic && profile?.team) return teamGP(scoped, profile.team);
    return officeGP(scoped);
  }, [scoped, isOffice, is2ic, scope, profile]);
  const activeOrders = useMemo(() => scoped.filter((o) => o.order_status !== "Closed Won").length, [scoped]);
  const dirtyCount = useMemo(() => scoped.filter((o) => o.dirty_order === "Yes").length, [scoped]);
  const notStattedCount = useMemo(() => scoped.filter(isNotStatted).length, [scoped]);
  const gpLabel = isOffice && scope !== "office" ? `GP · ${scope}` : is2ic && profile?.team ? `GP · ${profile.team}` : "GP · Office";
  const periodLabel = useMemo(() => {
    const s = periodStart(period);
    if (!s) return "all time";
    return `since ${s.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: period === "ytd" ? "numeric" : undefined })}`;
  }, [period]);

  return (
    <div>
      {/* Time period — MTD by default. FY runs April to March. */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5" style={{ color: "var(--ink-soft)" }}><Clock size={13} /> Period</span>
        {PERIODS.map((p) => (
          <button key={p.key} onClick={() => setPeriod(p.key)} className="sw-focus px-3 py-1.5 rounded-full text-xs font-semibold"
            style={period === p.key ? { background: "var(--ink)", color: "#fff" } : { background: "var(--surface)", color: "var(--ink-soft)", border: "1px solid var(--border)" }}>{p.label}</button>
        ))}
        <span className="text-xs" style={{ color: "var(--ink-faint)" }}>{periodLabel}</span>
      </div>
      {isOffice && (
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <span className="text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5" style={{ color: "var(--ink-soft)" }}><Eye size={13} /> Viewing</span>
          <button onClick={() => setScope("office")} className="sw-focus px-3 py-1.5 rounded-full text-xs font-semibold" style={scope === "office" ? { background: "var(--primary)", color: "#fff" } : { background: "var(--surface)", color: "var(--ink-soft)", border: "1px solid var(--border)" }}>Whole Office</button>
          {SELLING_TEAMS.map((t) => (
            <button key={t} onClick={() => setScope(t)} className="sw-focus px-3 py-1.5 rounded-full text-xs font-semibold" style={scope === t ? { background: "var(--primary)", color: "#fff" } : { background: "var(--surface)", color: "var(--ink-soft)", border: "1px solid var(--border)" }}>{t}</button>
          ))}
        </div>
      )}
      {is2ic && (
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <span className="text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5" style={{ color: "var(--ink-soft)" }}><Eye size={13} /> Viewing</span>
          <span className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: "var(--primary)", color: "#fff" }}>{profile?.team || "My team"}</span>
          <span className="text-xs" style={{ color: "var(--ink-faint)" }}>(2IC — you see your whole team)</span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "0.75rem" }} className="mb-6">
        <KPICard icon={TrendingUp} label={gpLabel} value={fmtGBP(gpTotal)} sub="Single-counted GP" accent="#1F7A3D" />
        <KPICard icon={Wallet} label="SOV" value={fmtGBP(sovTotal)} sub={`${scoped.length} orders`} accent="#4C1D8F" />
        <KPICard icon={Radio} label="Active Orders" value={activeOrders} sub="Not yet Closed Won" accent="#205EA6" />
        <KPICard icon={Clock} label="Not Statted" value={notStattedCount} sub="No NetSuite match 12h+" accent="#B3660E" />
        <KPICard icon={AlertTriangle} label="Dirty Orders" value={dirtyCount} sub="Flagged for review" accent="#C0392B" />
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4 p-3 rounded-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-faint)" }} />
          <input className="sw-input sw-focus" style={{ paddingLeft: 32 }} placeholder="Search company, Opp ID, or CUG..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} style={{ color: "var(--ink-faint)" }} />
          {canFilterByAgent && (
            <select className="sw-input sw-focus" style={{ width: 190 }} value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}>
              <option value="All">All agents</option>
              {agentOptions.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
          <select className="sw-input sw-focus" style={{ width: 190 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option>All</option>
            {[...STATUS_PIPELINE, "Arbitration Pending"].map((s) => <option key={s}>{s}</option>)}
            <option value="__not_statted">⚠ Not Statted</option>
          </select>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--surface-alt)" }}>
                {[
                  { label: "Opp ID", key: null },
                  { label: "Company", key: "company" },
                  { label: "People", key: "agent" },
                  { label: "Product", key: null },
                  { label: "SOV", key: "sov" },
                  { label: "GP", key: "gp" },
                  { label: "Status", key: "status" },
                  { label: "Updated", key: "last_updated" },
                ].map(({ label, key }) => (
                  <th
                    key={label}
                    onClick={key ? () => toggleSort(key) : undefined}
                    className={`text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide ${key ? "cursor-pointer select-none" : ""}`}
                    style={{ color: "var(--ink-soft)" }}
                  >
                    {label}{key && sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} onClick={() => onOpenOrder(o)} className={`cursor-pointer transition-colors ${flashId === o.id ? "sw-flash" : ""}`} style={{ borderTop: "1px solid var(--border)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-alt)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <td className="px-4 py-3"><IdChip>{o.opp_id}</IdChip></td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{o.company_name}</div>
                    {o.dirty_order === "Yes" && <div className="flex items-center gap-1 text-xs mt-0.5" style={{ color: "var(--red)" }}><ShieldAlert size={11} /> Dirty order flagged</div>}
                    {isNotStatted(o) && <div className="flex items-center gap-1 text-xs mt-0.5" style={{ color: "var(--amber)" }}><Clock size={11} /> Not Statted</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-xs">{o.closer_name || "—"}{o.closer_team ? <span style={{ color: "var(--ink-faint)" }}> · {o.closer_team}</span> : null}</div>
                    {o.lead_gen_name && <div className="text-xs mt-0.5" style={{ color: "var(--ink-soft)" }}>LG: {o.lead_gen_name}{o.lead_gen_team ? <span style={{ color: "var(--ink-faint)" }}> · {o.lead_gen_team}</span> : null}</div>}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--ink-soft)" }}>{o.item_name_grouped || "—"}</td>
                  <td className="px-4 py-3 sw-mono">{fmtGBP(o.contract_value)}</td>
                  <td className="px-4 py-3">
                    <div className="sw-mono font-semibold">{fmtGBP(o.gp_office != null ? o.gp_office : o.sales_agent_gp)}</div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>
                      C {o.closer_pct != null ? `${o.closer_pct}%` : "—"} {fmtGBP(o.closer_share)}
                      {o.lead_gen_name ? ` · LG ${o.lead_gen_pct != null ? `${o.lead_gen_pct}%` : "—"} ${fmtGBP(o.lead_gen_share)}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3"><StatusPill status={o.order_status} /></td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--ink-faint)" }}>{fmtDate(o.last_updated)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center" style={{ color: "var(--ink-faint)" }}>
                  {loading ? "Loading orders..." : "No orders to show yet. Submit one from New Submission to see it here."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-3 text-xs" style={{ color: "var(--ink-faint)" }}><RefreshCw size={11} /> Live — updates as orders change</div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  ORDER DETAIL DRAWER                                                    */
/* ---------------------------------------------------------------------- */

function OrderDrawer({ order, onClose, canEdit, onSave, saving, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [sov, setSov] = useState("");
  const [gp, setGp] = useState("");
  const [editErr, setEditErr] = useState("");
  const [removing, setRemoving] = useState(false);
  const [removeReason, setRemoveReason] = useState("");

  useEffect(() => {
    setEditing(false);
    setRemoving(false);
    setRemoveReason("");
    if (order) { setSov(String(order.contract_value ?? "")); setGp(String(order.sales_agent_gp ?? "")); setEditErr(""); }
  }, [order?.id]);

  if (!order) return null;

  const saveEdits = async () => {
    setEditErr("");
    if (gp !== "" && !/^\d*\.?\d+$/.test(String(gp).trim())) { setEditErr("GP must be a number."); return; }
    if (sov !== "" && !/^\d*\.?\d+$/.test(String(sov).trim())) { setEditErr("SOV must be a number."); return; }
    // Recompute all split / office / team figures from the new GP
    const recomputed = recomputeGP({
      gp,
      closerPct: order.closer_pct,
      leadGenPct: order.lead_gen_pct,
      sameTeam: !!(order.lead_gen_name && order.closer_team === order.lead_gen_team),
      hasLeadGen: !!order.lead_gen_name,
    });
    await onSave(order.id, { contract_value: num(sov), ...recomputed, last_updated: new Date().toISOString() });
    setEditing(false);
  };

  const rows = [
    ["Lilac Ref", order.lbcr_ref],
    ["NetSuite", order.document_number ? `Matched · Doc ${order.document_number}` : isNotStatted(order) ? "Not Statted (12h+)" : "Awaiting match"],
    ["CUG", order.cug], ["Partner", order.partner], ["Partner Role", order.partner_role],
    ["Quantity", order.quantity], ["Admin Agent", order.admin_agent], ["Schedule 5", order.schedule_5],
    ["Document No.", order.document_number], ["Campaign Source", order.campaign_source],
    ["Product Group", order.product_group_2],
    ["Closer", order.closer_name ? `${order.closer_name}${order.closer_team ? ` (${order.closer_team})` : ""}` : null],
    ["Lead Gen", order.lead_gen_name ? `${order.lead_gen_name}${order.lead_gen_team ? ` (${order.lead_gen_team})` : ""}` : null],
  ];

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0" style={{ background: "rgba(29,26,46,0.35)" }} onClick={onClose} />
      <div className="sw-slide-in relative w-full max-w-md h-full overflow-y-auto p-6" style={{ background: "var(--surface)", borderLeft: "1px solid var(--border)" }}>
        <button onClick={onClose} className="sw-focus absolute top-5 right-5 p-1.5 rounded-lg" style={{ color: "var(--ink-soft)" }}><X size={18} /></button>
        <div className="mb-1"><IdChip>{order.opp_id}</IdChip></div>
        <h2 className="sw-display text-xl font-bold mt-2 mb-1">{order.company_name}</h2>
        <div className="mb-4"><StatusPill status={order.order_status} /></div>

        {/* Deal value + GP — editable by office / 2ic / closer */}
        <div className="rounded-xl mb-5 p-4" style={{ background: "var(--surface-alt)" }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Deal Value</span>
            {canEdit && !editing && <button onClick={() => setEditing(true)} className="sw-focus text-xs font-semibold" style={{ color: "var(--primary)" }}>Edit SOV / GP</button>}
          </div>

          {editing ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="sw-label">SOV (£)</label>
                <input className="sw-input sw-focus" value={sov} onChange={(e) => setSov(e.target.value)} />
              </div>
              <div>
                <label className="sw-label">GP (£)</label>
                <input className="sw-input sw-focus" value={gp} onChange={(e) => setGp(e.target.value)} />
              </div>
              {gp !== "" && /^\d*\.?\d+$/.test(String(gp)) && (
                <div className="col-span-2 text-xs" style={{ color: "var(--ink-soft)" }}>
                  New splits: Closer {order.closer_pct ?? 0}% = {fmtGBP(num(gp) * num(order.closer_pct) / 100)}
                  {order.lead_gen_name ? ` · Lead Gen ${order.lead_gen_pct ?? 0}% = ${fmtGBP(num(gp) * num(order.lead_gen_pct) / 100)}` : ""}
                </div>
              )}
              {editErr && <div className="col-span-2 sw-err">{editErr}</div>}
              <div className="col-span-2 flex gap-2 mt-1">
                <button onClick={saveEdits} disabled={saving} className="sw-focus flex-1 py-2 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-1.5" style={{ background: "var(--primary)", opacity: saving ? 0.7 : 1 }}>{saving ? <Loader2 size={13} className="animate-spin" /> : null} Save</button>
                <button onClick={() => { setEditing(false); setSov(String(order.contract_value ?? "")); setGp(String(order.sales_agent_gp ?? "")); }} className="sw-focus px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--ink-soft)" }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              {/* Overall value first, then the splits beside it */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div><div className="text-xs" style={{ color: "var(--ink-faint)" }}>SOV</div><div className="sw-mono font-semibold text-lg">{fmtGBP(order.contract_value)}</div></div>
                <div><div className="text-xs" style={{ color: "var(--ink-faint)" }}>GP (deal)</div><div className="sw-mono font-semibold text-lg">{fmtGBP(order.gp_office != null ? order.gp_office : order.sales_agent_gp)}</div></div>
              </div>
              <div className="rounded-lg p-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="flex justify-between text-sm mb-1">
                  <span style={{ color: "var(--ink-soft)" }}>Closer — {order.closer_name || "—"} ({order.closer_pct ?? 0}%)</span>
                  <span className="sw-mono font-semibold">{fmtGBP(order.closer_share)}</span>
                </div>
                {order.lead_gen_name && (
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "var(--ink-soft)" }}>Lead Gen — {order.lead_gen_name} ({order.lead_gen_pct ?? 0}%)</span>
                    <span className="sw-mono font-semibold">{fmtGBP(order.lead_gen_share)}</span>
                  </div>
                )}
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div><div className="text-xs" style={{ color: "var(--ink-faint)" }}>Submitted</div><div className="text-sm">{fmtDate(order.submission_date)}</div></div>
            <div><div className="text-xs" style={{ color: "var(--ink-faint)" }}>Last Updated</div><div className="text-sm">{fmtDate(order.last_updated)}</div></div>
          </div>
        </div>

        <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--ink-soft)" }}>Order Details</h4>
        <div className="rounded-xl overflow-hidden mb-4" style={{ border: "1px solid var(--border)" }}>
          {rows.filter(([, v]) => v != null && v !== "").map(([label, val], i) => (
            <div key={label} className="flex justify-between px-3 py-2 text-sm" style={{ background: i % 2 ? "var(--surface-alt)" : "transparent" }}>
              <span style={{ color: "var(--ink-soft)" }}>{label}</span><span className="font-medium text-right">{val}</span>
            </div>
          ))}
        </div>
        {order.description && (<>
          <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--ink-soft)" }}>Description</h4>
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>{order.description}</p>
        </>)}

        {/* Remove an order — e.g. it was rejected and re-submitted, so this
            copy shouldn't count twice. Soft delete: it's hidden, not erased. */}
        {canEdit && (
          <div className="mt-6 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            {!removing ? (
              <button onClick={() => setRemoving(true)} className="sw-focus text-xs font-semibold px-3 py-2 rounded-lg"
                style={{ color: "var(--red)", background: "var(--red-soft)" }}>Remove this order</button>
            ) : (
              <div className="rounded-xl p-3" style={{ background: "var(--red-soft)", border: "1px solid var(--red)" }}>
                <div className="font-semibold text-sm mb-1" style={{ color: "var(--red)" }}>Remove this order?</div>
                <p className="text-xs mb-2" style={{ color: "var(--ink-soft)" }}>
                  It'll stop showing in the tracker and drop out of all totals. It stays recorded in the database, so it can be restored if needed.
                </p>
                <input className="sw-input sw-focus" placeholder="Reason (e.g. rejected and re-submitted)" value={removeReason} onChange={(e) => setRemoveReason(e.target.value)} />
                <div className="flex gap-2 mt-2">
                  <button onClick={async () => { await onRemove(order.id, removeReason); onClose(); }}
                    className="sw-focus flex-1 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "var(--red)" }}>Yes, remove it</button>
                  <button onClick={() => { setRemoving(false); setRemoveReason(""); }}
                    className="sw-focus px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--ink-soft)" }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  LILAC FORM  (with restored cross-field validation + GP split calc)    */
/* ---------------------------------------------------------------------- */

function LilacForm({ onSubmit, submitting }) {
  const { sellers } = useStaff();
  const [f, setF] = useState({ closerPct: "100%", leadGenPct: "0%" });
  const [dealTypes, setDealTypes] = useState([]);
  const [srDealTypes, setSrDealTypes] = useState([]);
  const [arbNeeded, setArbNeeded] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (e) => {
    const { name, value } = e.target;
    setF((p) => ({ ...p, [name]: value }));
  };

  // Team is DERIVED from whoever is picked (closer / lead gen), never asked for.
  const closerStaff = findStaff(sellers, f.closerName);
  const leadGenStaff = findStaff(sellers, f.leadGenName);
  const closerTeam = closerStaff?.team || null;
  const leadGenTeam = leadGenStaff?.team || null;
  const closerUin = closerStaff?.uin || "";
  const leadGenUin = leadGenStaff?.uin || "";
  const toggleDeal = (v) => setDealTypes((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
  const toggleSrDeal = (v) => setSrDealTypes((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));

  const isFutureMobile = f.mobileOrder === "Future Mobile";
  const isMobileOrder = f.mobileOrder === "SME" || f.mobileOrder === "Future Mobile";
  const isBtNetNew = f.btNetOrder === "Yes";
  const isBtNetUpgrade = f.btNetOrder === "BTNet Upgrade";
  const isDv4 = f.dv4Order === "Yes";
  const isResign = !!f.isResign;
  const isCeases = f.ceases === "Yes";
  const isCloudPorting = f.cloudPorting === "Yes";
  const isBadr = f.badrSold === "Yes";

  // Live product detection, so the agent can see what was picked up.
  const detectedProducts = detectProducts(f.orderDetails, {
    bundle: f.bundleStatus === "Yes",
    pstnCve: f.pstnCve === "Yes",
    cloudPorting: isCloudPorting,
    portingMobiles: f.portingStatus === "Yes",
    mobileOrder: isMobileOrder,
    btNet: isBtNetNew || isBtNetUpgrade,
    dv4: isDv4,
    badr: isBadr,
  });

  // Restored business rules from the original Lilac Box script
  const validate = () => {
    const e = {};
    const gp = String(f.gp ?? "");
    if (!gp.trim()) e.gp = "GP is required.";
    else if (!/^\d*\.?\d+$/.test(gp.trim())) e.gp = "GP must be a number (no £ or letters). Put splits in Order Details.";

    const pName = (f.customerName || "").trim().toLowerCase();
    const sName = (f.secondaryName || "").trim().toLowerCase();
    if (pName && pName === sName) e.secondaryName = "Primary and Secondary contact names can't be identical.";

    const pMob = (f.customerMobile || "").replace(/\s+/g, "");
    const sMob = (f.secondaryMobile || "").replace(/\s+/g, "");
    if (pMob && pMob === sMob) e.secondaryMobile = "Primary and Secondary mobiles can't be identical.";

    if (isFutureMobile && srDealTypes.length === 0) e.srDealType = "Select at least one SR Deal Type.";
    if (!f.lEName) e.lEName = "LE Name is required.";
    if (!f.oppId) e.oppId = "Opportunity ID is required.";
    if (!f.closerName) e.closerName = "Closer is required.";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }

    const gp = parseFloat(f.gp) || 0;
    const closerShare = +(gp * pctToNum(f.closerPct)).toFixed(2);
    const leadGenShare = +(gp * pctToNum(f.leadGenPct)).toFixed(2);

    // Work out the products from what the agent typed, backed up by the
    // structured yes/no answers they've already given on this form.
    const products = detectProducts(f.orderDetails, {
      bundle: f.bundleStatus === "Yes",
      pstnCve: f.pstnCve === "Yes",
      cloudPorting: isCloudPorting,
      portingMobiles: f.portingStatus === "Yes",
      mobileOrder: isMobileOrder,
      btNet: isBtNetNew || isBtNetUpgrade,
      dv4: isDv4,
      badr: isBadr,
    });

    onSubmit({
      opp_id: f.oppId,
      lbcr_ref: makeLbcrRef(),   // quote this in NetSuite to link the two
      cug: f.cug || null,
      company_name: f.lEName,
      team: closerTeam,          // primary/closer team for the top-level column
      closer_team: closerTeam,
      lead_gen_team: leadGenTeam,
      partner: "Direct",
      quantity: 1,
      sales_agent_gp: gp,
      order_status: arbNeeded ? "Arbitration Pending" : "Lilac Submitted",
      item_name_grouped: products.summary,
      product_group_2: products.group,
      class_name: closerTeam,
      dirty_order: "No",
      contract_value: gp * 8,
      partner_role: "N/A",
      admin_agent: f.closerName || "Unassigned",
      schedule_5: "No",
      document_number: null,
      campaign_source: "Lilac Box",
      description: f.orderDetails || "Submitted via New Submission portal.",
      closer_name: f.closerName || null,
      lead_gen_name: f.leadGenName || null,
      closer_id: closerStaff?.user_id || null,
      lead_gen_id: leadGenStaff?.user_id || null,
      closer_share: closerShare,
      lead_gen_share: leadGenShare,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <SectionCard title="Core Details" tone="primary">
        <Field label="CUG" name="cug" value={f.cug} onChange={set} required />
        <Field label="LE Number" name="lENumber" value={f.lENumber} onChange={set} required />
        <Field label="Opportunity ID" name="oppId" value={f.oppId} onChange={set} required error={errors.oppId} />
        <Field label="LE Name" name="lEName" value={f.lEName} onChange={set} required error={errors.lEName} />
        <Field label="Entity Type" name="entityTypeBase" value={f.entityTypeBase} onChange={set} options={ENTITY_TYPES} required />
        <Field label="Trading As" name="tradingAs" value={f.tradingAs} onChange={set} required />
      </SectionCard>

      <SectionCard title="Primary Contact" tone="primary">
        <Field label="Name" name="customerName" value={f.customerName} onChange={set} required />
        <Field label="Position" name="customerPosition" value={f.customerPosition} onChange={set} required />
        <Field label="Landline" name="customerLandline" value={f.customerLandline} onChange={set} required />
        <Field label="Mobile" name="customerMobile" value={f.customerMobile} onChange={set} required />
        <Field label="Email" name="customerEmail" value={f.customerEmail} onChange={set} type="email" required colSpan={2} />
      </SectionCard>

      <SectionCard title="Secondary Contact" tone="primary">
        <Field label="Name" name="secondaryName" value={f.secondaryName} onChange={set} required error={errors.secondaryName} />
        <Field label="Position" name="secondaryPosition" value={f.secondaryPosition} onChange={set} required />
        <Field label="Landline" name="secondaryLandline" value={f.secondaryLandline} onChange={set} required />
        <Field label="Mobile" name="secondaryMobile" value={f.secondaryMobile} onChange={set} required error={errors.secondaryMobile} />
        <Field label="Email" name="secondaryEmail" value={f.secondaryEmail} onChange={set} type="email" required colSpan={2} />
      </SectionCard>

      <SectionCard title="Mobile Order" tone="primary">
        <Field label="Is this a Mobile Order?" name="mobileOrder" value={f.mobileOrder} onChange={set} options={["No", "SME", "Future Mobile"]} />
        {isMobileOrder && (<>
          <Field label="Porting Mobiles?" name="portingStatus" value={f.portingStatus} onChange={set} options={["No", "Yes"]} required />
          <Field label="From EE?" name="fromEE" value={f.fromEE} onChange={set} options={["No", "Yes"]} />
          <Field label="Porting Numbers" name="portingNumbers" value={f.portingNumbers} onChange={set} colSpan={3} textarea />
        </>)}
        {isFutureMobile && (<>
          <Field label="Devices Needed" name="mobileDevices" value={f.mobileDevices} onChange={set} colSpan={3} textarea />
          <Field label="Deal Calc Attached?" name="fmDealCalc" value={f.fmDealCalc} onChange={set} options={["Yes", "No"]} />
          <Field label="Conn DB Attached?" name="fmConnDb" value={f.fmConnDb} onChange={set} options={["Yes", "No"]} />
          <Field label="Existing EE Conn" name="fmEEConn" value={f.fmEEConn} onChange={set} type="number" />
          <Field label="Existing BT Mobile Conn" name="fmBTMobConn" value={f.fmBTMobConn} onChange={set} type="number" />
          <Field label="Connections Porting" name="fmPortingQty" value={f.fmPortingQty} onChange={set} type="number" />
          <Field label="Porting From" name="fmPortingFrom" value={f.fmPortingFrom} onChange={set} />
          <Field label="Delivery Address" name="fmDeliveryAddr" value={f.fmDeliveryAddr} onChange={set} colSpan={3} textarea />
          <Field label="SOV (after ATC)" name="srSov" value={f.srSov} onChange={set} />
          <Field label="Hardware Fund" name="srHwFund" value={f.srHwFund} onChange={set} />
          <Field label="NET MRC" name="srNetMrc" value={f.srNetMrc} onChange={set} />
          <Field label="Provider" name="srProvider" value={f.srProvider} onChange={set} />
          <Field label="Employee Count" name="srEmpCount" value={f.srEmpCount} onChange={set} />
          <CheckboxGroup label="SR Deal Type" options={DEAL_TYPES} values={srDealTypes} onToggle={toggleSrDeal} error={errors.srDealType} />
          <label className="flex items-center gap-2 text-sm mt-6"><input type="checkbox" checked={isResign} onChange={(e) => setF((p) => ({ ...p, isResign: e.target.checked }))} /> Is this a Resign?</label>
          {isResign && (<>
            <Field label="Resign Pack Raised/Approved" name="resPackRaised" value={f.resPackRaised} onChange={set} />
            <Field label="ARPM & Buyout in Basket" name="resArpm" value={f.resArpm} onChange={set} />
          </>)}
        </>)}
      </SectionCard>

      <SectionCard title="BT Net Order" tone="primary">
        <Field label="Is this a BT Net Order?" name="btNetOrder" value={f.btNetOrder} onChange={set} options={["No", "Yes", "BTNet Upgrade"]} />
        {isBtNetNew && (<>
          <Field label="Full Address" name="btnAddress" value={f.btnAddress} onChange={set} colSpan={3} textarea required />
          <Field label="Pricing Level" name="btnPricing" value={f.btnPricing} onChange={set} required />
          <Field label="Router" name="btnRouter" value={f.btnRouter} onChange={set} required />
          <Field label="Speed" name="btnSpeed" value={f.btnSpeed} onChange={set} required />
        </>)}
        {isBtNetUpgrade && (<>
          <Field label="FTIP Reference" name="btNetFtipRef" value={f.btNetFtipRef} onChange={set} required />
          <Field label="Pre Upgrade Price" name="btNetPrePrice" value={f.btNetPrePrice} onChange={set} required />
          <Field label="New Price" name="btNetNewPrice" value={f.btNetNewPrice} onChange={set} required />
          <Field label="New Contract End Date" name="btNetEndDate" value={f.btNetEndDate} onChange={set} type="date" required />
        </>)}
      </SectionCard>

      <SectionCard title="DV4 Cloud Order" tone="primary">
        <Field label="Is this a DV4 Cloud Order?" name="dv4Order" value={f.dv4Order} onChange={set} options={["No", "Yes"]} />
        {isDv4 && (<>
          <Field label="Monthly Contract Term" name="dv4Term" value={f.dv4Term} onChange={set} required />
          <Field label="Package Required" name="dv4Package" value={f.dv4Package} onChange={set} options={["Essential", "Enhanced", "Extra"]} required />
          <Field label="Discount Provided" name="dv4Discount" value={f.dv4Discount} onChange={set} required />
          <Field label="Employee Count" name="dv4EmpCount" value={f.dv4EmpCount} onChange={set} type="number" required />
          <Field label="Webex Provided" name="dv4Webex" value={f.dv4Webex} onChange={set} options={["Basic", "Standard", "No"]} required />
          <Field label="Customer Address" name="dv4Address" value={f.dv4Address} onChange={set} colSpan={3} textarea required />
        </>)}
      </SectionCard>

      <SectionCard title="Technical & Connection Info" tone="primary">
        <Field label="Broadband Bundle?" name="bundleStatus" value={f.bundleStatus} onChange={set} options={["No", "Yes"]} />
        <Field label="PSTN / CVE Required?" name="pstnCve" value={f.pstnCve} onChange={set} options={["No", "Yes"]} />
        <Field label="Cloud Porting?" name="cloudPorting" value={f.cloudPorting} onChange={set} options={["No", "Yes"]} />
        {isCloudPorting && <Field label="Cloud Numbers Porting" name="cloudPortingNumbers" value={f.cloudPortingNumbers} onChange={set} required colSpan={3} textarea />}
        <Field label="Discount Level" name="discount" value={f.discount} onChange={set} />
        <Field label="Router" name="router" value={f.router} onChange={set} />
        <Field label="IP Type" name="ipType" value={f.ipType} onChange={set} options={["Dynamic", "Fixed"]} />
        <Field label="Ceases Required?" name="ceases" value={f.ceases} onChange={set} options={["No", "Yes"]} />
        {isCeases && <Field label="Cease Information" name="ceaseInfo" value={f.ceaseInfo} onChange={set} required colSpan={3} textarea />}
        <Field label="Required Date" name="reqDate" value={f.reqDate} onChange={set} type="date" />
        <Field label="ETC Waiver Ref" name="etcWaiver" value={f.etcWaiver} onChange={set} />
        <Field label="NAD Key" name="nadKey" value={f.nadKey} onChange={set} />
        <Field label="BADR / CCS Sold?" name="badrSold" value={f.badrSold} onChange={set} options={["Yes", "No"]} required />
        {isBadr && (<>
          <Field label="How many Licences?" name="badrLicences" value={f.badrLicences} onChange={set} type="number" required />
          <Field label="What Devices Covered?" name="badrDevices" value={f.badrDevices} onChange={set} required />
        </>)}
        <Field label="All Order Details" name="orderDetails" value={f.orderDetails} onChange={set} required colSpan={3} textarea rows={3} />
        {/* Products are read from what you type above — shown here so you can
            check it picked things up correctly before submitting. */}
        <div style={{ gridColumn: "span 3" }}>
          <div className="text-xs flex items-center gap-2 flex-wrap" style={{ color: "var(--ink-soft)" }}>
            <span className="font-semibold">Products detected:</span>
            {detectedProducts.tags.length === 0 ? (
              <span style={{ color: "var(--ink-faint)" }}>none yet — describe the order above</span>
            ) : detectedProducts.tags.map((t) => (
              <span key={t} className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>{t}</span>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Commercials & Personnel" tone="primary">
        <Field label="SOV" name="sov" value={f.sov} onChange={set} required />
        <Field label="Units" name="units" value={f.units} onChange={set} />
        <Field label="GP (£)" name="gp" value={f.gp} onChange={set} placeholder="e.g. 500" required error={errors.gp} />
        <CheckboxGroup label="Deal Type" options={DEAL_TYPES} values={dealTypes} onToggle={toggleDeal} />
        <div>
          <Field label="Closer Name" name="closerName" value={f.closerName} onChange={set} options={sellers.map((s) => s.full_name)} required error={errors.closerName} />
          {closerStaff && <div className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>Team: {closerTeam} · UIN: {closerUin || "—"}</div>}
        </div>
        <Field label="Closer Split %" name="closerPct" value={f.closerPct} onChange={set} options={["100%", "80%", "65%", "50%"]} />
        <div>
          <Field label="Lead Gen Name" name="leadGenName" value={f.leadGenName} onChange={set} options={sellers.map((s) => s.full_name)} />
          {leadGenStaff && <div className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>Team: {leadGenTeam} · UIN: {leadGenUin || "—"}</div>}
        </div>
        <Field label="Lead Gen Split %" name="leadGenPct" value={f.leadGenPct} onChange={set} options={["0%", "20%", "35%", "50%", "65%"]} />
        <Field label="Additional CC (optional)" name="additionalCc" value={f.additionalCc} onChange={set} colSpan={3} placeholder="name@company.com, name2@company.com" />
      </SectionCard>

      {/* Live GP split preview */}
      {f.gp && /^\d*\.?\d+$/.test(String(f.gp)) && (
        <div className="rounded-2xl p-4 mb-5 flex gap-6" style={{ background: "var(--primary-soft)", border: "1px solid var(--border)" }}>
          <div><div className="text-xs" style={{ color: "var(--ink-soft)" }}>Closer Share ({f.closerPct})</div><div className="sw-mono font-bold">{fmtGBP(parseFloat(f.gp) * pctToNum(f.closerPct))}</div></div>
          <div><div className="text-xs" style={{ color: "var(--ink-soft)" }}>Lead Gen Share ({f.leadGenPct})</div><div className="sw-mono font-bold">{fmtGBP(parseFloat(f.gp) * pctToNum(f.leadGenPct))}</div></div>
        </div>
      )}

      <div className="rounded-2xl p-4 mb-5 flex items-center justify-between" style={{ background: "var(--green-soft)", border: "1px solid var(--green)" }}>
        <div>
          <div className="font-semibold text-sm" style={{ color: "var(--green)" }}>Does this order need an Arbitration submission?</div>
          <div className="text-xs" style={{ color: "var(--ink-soft)" }}>Opens the linked Arbitration form and keeps key fields in sync.</div>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer" style={{ color: "var(--green)" }}>
          <input type="checkbox" checked={arbNeeded} onChange={(e) => setArbNeeded(e.target.checked)} /> Yes, open Arbitration
        </label>
      </div>

      {arbNeeded && <ArbitrationFields f={f} set={set} embedded />}

      <button type="submit" disabled={submitting} className="sw-focus w-full py-3 rounded-full font-semibold text-sm flex items-center justify-center gap-2" style={{ background: "var(--primary)", color: "#fff", opacity: submitting ? 0.7 : 1 }}>
        {submitting ? <Loader2 size={15} className="animate-spin" /> : null} Submit Secure Order
      </button>
    </form>
  );
}

function ArbitrationFields({ f, set, embedded }) {
  const { sellers } = useStaff();
  const reason = f.arbReason;
  const isMobile = reason === "Mobile";
  const showConnBreakdown = reason === "Mobile" || !reason;
  const showSch5 = reason === "CV Call plan" || reason === "Incremental Commission" || reason === "Transaction Change";
  return (
    <SectionCard title={embedded ? "Arbitration (linked)" : "Arbitration Portal"} tone="green">
      <Field label="Company Name" name="arbCompanyName" value={f.arbCompanyName} onChange={set} required colSpan={2} />
      <Field label="LE Number" name="arbLeNumber" value={f.arbLeNumber} onChange={set} required />
      <Field label="OID" name="arbOid" value={f.arbOid} onChange={set} required />
      <Field label="Reason" name="arbReason" value={f.arbReason} onChange={set} options={ARB_REASONS} required />
      <Field label="Raised By" name="arbRaisedBy" value={f.arbRaisedBy} onChange={set} options={sellers.map((s) => s.full_name)} required />
      <Field label="Original Product" name="arbOriginalProduct" value={f.arbOriginalProduct} onChange={set} required />
      <Field label="New Product" name="arbNewProduct" value={f.arbNewProduct} onChange={set} required />
      <Field label="Units" name="arbUnits" value={f.arbUnits} onChange={set} type="number" />
      <Field label="Term (Months)" name="arbTerm" value={f.arbTerm} onChange={set} type="number" />
      {isMobile && (<>
        <Field label="Data MRC (Per Sim)" name="arbData" value={f.arbData} onChange={set} />
        <Field label="Voice MRC (Per Sim)" name="arbVoice" value={f.arbVoice} onChange={set} />
        <Field label="Airtime Credits" name="arbAirtimeCredits" value={f.arbAirtimeCredits} onChange={set} />
      </>)}
      <Field label="Reported SOV (Sch5)" name="arbReportedSov" value={f.arbReportedSov} onChange={set} required />
      <Field label="Missing SOV" name="arbMissingSov" value={f.arbMissingSov} onChange={set} required />
      {showSch5 && (
        <label className="flex items-center gap-2 text-sm mt-6"><input type="checkbox" checked={!!f.arbSch5} onChange={(e) => set({ target: { name: "arbSch5", value: e.target.checked } })} /> On Sch5?</label>
      )}
      {showConnBreakdown && (<>
        <Field label="Migration Connections" name="arbMigConn" value={f.arbMigConn} onChange={set} type="number" />
        <Field label="Acquisition Connections" name="arbAcqConn" value={f.arbAcqConn} onChange={set} type="number" />
      </>)}
      <Field label="Overview" name="arbOverview" value={f.arbOverview} onChange={set} required colSpan={3} textarea />
      <Field label="Additional Notes" name="arbAdditionalNotes" value={f.arbAdditionalNotes} onChange={set} colSpan={3} textarea />
    </SectionCard>
  );
}

/* ---------------------------------------------------------------------- */
/*  IMP FORM  (with restored self-serve / billing links banner)           */
/* ---------------------------------------------------------------------- */

function ImpForm({ onSubmit, submitting }) {
  const { all, sellers } = useStaff();
  const [f, setF] = useState({});
  const set = (e) => setF((p) => ({ ...p, [e.target.name]: e.target.value }));
  const showEvidenceReason = f.impEvidenceAttached === "No";
  const raiserStaff = findStaff(sellers, f.impRaiser);

  const handleSubmit = (e) => {
    e.preventDefault();
    const raiserTeam = raiserStaff?.team || null;
    onSubmit({
      opp_id: f.impOppId || `IMP-${Date.now()}`,
      lbcr_ref: makeLbcrRef(),
      company_name: f.impCompanyName || "Unnamed Company",
      team: raiserTeam,
      closer_team: raiserTeam,
      lead_gen_team: null,
      order_status: "Lilac Submitted",
      item_name_grouped: "IMP Box",
      product_group_2: "Issue / Complaint",
      class_name: "IMP",
      dirty_order: "No",
      contract_value: 0,
      sales_agent_gp: 0,
      admin_agent: f.impRaiser || "Unassigned",
      campaign_source: "IMP Box",
      description: f.impWrongWhy || "IMP issue submitted.",
      closer_name: f.impRaiser || null,
      lead_gen_name: null,
      closer_id: raiserStaff?.user_id || null,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* RESTORED: Customer self-serve complaint links */}
      <div className="rounded-2xl p-5 mb-5 text-center" style={{ background: "var(--gold-soft)", border: "2px solid var(--gold)" }}>
        <div className="font-bold text-sm mb-1" style={{ color: "var(--gold)" }}>⚠️ Customer Self-Serve Links</div>
        <p className="text-xs mb-3" style={{ color: "var(--ink-soft)" }}>To raise a complaint, send the relevant link below to the customer to self-serve:</p>
        <div className="flex gap-3 justify-center flex-wrap">
          <a href="https://business.ee.co.uk/help/make-a-complaint/" target="_blank" rel="noreferrer" className="sw-focus px-4 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ background: "var(--gold)" }}>📱 EE Mobile Complaints</a>
          <a href="https://business.bt.com/help/contactus/complaints/" target="_blank" rel="noreferrer" className="sw-focus px-4 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ background: "var(--primary)" }}>🌐 BT Complaints</a>
        </div>
      </div>

      <SectionCard title="General Details" tone="gold">
        <Field label="Who is Raising this IMP?" name="impRaiser" value={f.impRaiser} onChange={set} options={sellers.map((s) => s.full_name)} required />
        <Field label="Raised Against" name="impRaisedAgainst" value={f.impRaisedAgainst} onChange={set} options={[...all.map((s) => s.full_name), "Ex/Other Employee"]} required />
        <Field label="Type of Issue" name="impIssueType" value={f.impIssueType} onChange={set} required />
        <Field label="LE Number" name="impLENumber" value={f.impLENumber} onChange={set} required />
        <Field label="Company Name" name="impCompanyName" value={f.impCompanyName} onChange={set} required />
        <Field label="Contact Name" name="impContactName" value={f.impContactName} onChange={set} required />
        <Field label="Contact Number" name="impContactNumber" value={f.impContactNumber} onChange={set} required />
        <Field label="Mobile Number" name="impMobileNumber" value={f.impMobileNumber} onChange={set} required />
        <Field label="Email Address" name="impEmail" value={f.impEmail} onChange={set} type="email" required />
      </SectionCard>

      <SectionCard title="Relevant Details" tone="gold">
        <Field label="Customer's Self-Serve Ref" name="impSelfServeRef" value={f.impSelfServeRef} onChange={set} required />
        <Field label="Agent EIN" name="impAgentEin" value={f.impAgentEin} onChange={set} required />
        <Field label="Order Number / Ref" name="impOrderRef" value={f.impOrderRef} onChange={set} required />
        <Field label="Opp ID (07 not 03)" name="impOppId" value={f.impOppId} onChange={set} required />
        <Field label="Billing Account Numbers" name="impBillingAcc" value={f.impBillingAcc} onChange={set} required />
        <Field label="Service ID Affected" name="impServiceId" value={f.impServiceId} onChange={set} required />
      </SectionCard>

      <SectionCard title="Incident Details" tone="gold">
        <Field label="What Has Gone Wrong and Why" name="impWrongWhy" value={f.impWrongWhy} onChange={set} required colSpan={3} textarea rows={3} />
        <Field label="Outcome Customer is Aiming For" name="impOutcome" value={f.impOutcome} onChange={set} required colSpan={3} textarea rows={3} />
        <Field label="Actions Taken So Far" name="impActionsTaken" value={f.impActionsTaken} onChange={set} required colSpan={3} textarea rows={3} />
        <Field label="Wrong Before/During/After Order" name="impWhenWrong" value={f.impWhenWrong} onChange={set} options={["Before Order", "During Order", "After Order"]} required />
        <Field label="Front End Close Complaint?" name="impFrontEndClose" value={f.impFrontEndClose} onChange={set} options={["Yes", "No"]} required />
        <Field label="Evidence Attached?" name="impEvidenceAttached" value={f.impEvidenceAttached} onChange={set} options={["Yes", "No"]} required />
        {showEvidenceReason && <Field label="Reason Not Attached" name="impEvidenceReason" value={f.impEvidenceReason} onChange={set} required colSpan={3} textarea />}
        <Field label="Additional Notes" name="impAdditionalNotes" value={f.impAdditionalNotes} onChange={set} colSpan={3} textarea />
      </SectionCard>

      <button type="submit" disabled={submitting} className="sw-focus w-full py-3 rounded-full font-semibold text-sm flex items-center justify-center gap-2" style={{ background: "var(--gold)", color: "#fff", opacity: submitting ? 0.7 : 1 }}>
        {submitting ? <Loader2 size={15} className="animate-spin" /> : null} Submit IMP Issue
      </button>
    </form>
  );
}

function ArbitrationForm({ onSubmit, submitting }) {
  const { sellers } = useStaff();
  const [f, setF] = useState({});
  const set = (e) => setF((p) => ({ ...p, [e.target.name]: e.target.value }));
  const handleSubmit = (e) => {
    e.preventDefault();
    const raiserStaff = findStaff(sellers, f.arbRaisedBy);
    const raiserTeam = raiserStaff?.team || null;
    onSubmit({
      opp_id: f.arbOid || `ARB-${Date.now()}`,
      lbcr_ref: makeLbcrRef(),
      company_name: f.arbCompanyName || "Unnamed Company",
      team: raiserTeam,
      closer_team: raiserTeam,
      order_status: "Arbitration Pending",
      item_name_grouped: "Arbitration",
      product_group_2: f.arbReason || "N/A",
      class_name: "Arbitration",
      dirty_order: "No",
      contract_value: 0,
      sales_agent_gp: 0,
      admin_agent: f.arbRaisedBy || "Unassigned",
      campaign_source: "Arbitration Portal",
      description: f.arbOverview || "Arbitration submitted.",
      closer_name: f.arbRaisedBy || null,
      closer_id: raiserStaff?.user_id || null,
    });
  };
  return (
    <form onSubmit={handleSubmit}>
      <ArbitrationFields f={f} set={set} embedded={false} />
      <button type="submit" disabled={submitting} className="sw-focus w-full py-3 rounded-full font-semibold text-sm flex items-center justify-center gap-2" style={{ background: "var(--green)", color: "#fff", opacity: submitting ? 0.7 : 1 }}>
        {submitting ? <Loader2 size={15} className="animate-spin" /> : null} Submit Arbitration
      </button>
    </form>
  );
}

function NewSubmissionView({ onSubmit, submitting }) {
  const [portal, setPortal] = useState("Lilac");
  const tabs = [
    { key: "Lilac", label: "Lilac Box (Secure Order)", tone: "primary" },
    { key: "IMP", label: "IMP Box (Issue / Complaint)", tone: "gold" },
    { key: "Arbitration", label: "Arbitration Portal", tone: "green" },
  ];
  return (
    <div>
      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setPortal(t.key)} className="sw-focus px-4 py-2 rounded-full text-sm font-semibold"
            style={portal === t.key ? { background: `var(--${t.tone})`, color: "#fff" } : { background: "var(--surface)", color: "var(--ink-soft)", border: "1px solid var(--border)" }}>{t.label}</button>
        ))}
      </div>
      {portal === "Lilac" && <LilacForm onSubmit={onSubmit} submitting={submitting} />}
      {portal === "IMP" && <ImpForm onSubmit={onSubmit} submitting={submitting} />}
      {portal === "Arbitration" && <ArbitrationForm onSubmit={onSubmit} submitting={submitting} />}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  TV WALL BOARD  (/tv route)                                            */
/* ---------------------------------------------------------------------- */

// Countdown to 17:00 today. After 5pm shows "Day complete".
function useCountdownTo5pm() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const target = new Date(now);
  target.setHours(17, 0, 0, 0);
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return { text: "Day complete", done: true };
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return { text: `${pad(h)}:${pad(m)}:${pad(s)}`, done: false };
}

function TVStat({ label, value, accent }) {
  return (
    <div className="rounded-2xl p-3 flex flex-col justify-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: "var(--ink-soft)" }}>{label}</div>
      <div className="sw-display font-bold text-3xl" style={{ color: accent || "var(--ink)" }}>{value}</div>
    </div>
  );
}

function TVBoard({ orders }) {
  const countdown = useCountdownTo5pm();

  const isThisWeek = (o) => daysSince(o.submission_date) <= 7;
  const isToday = (o) => daysSince(o.submission_date) === 0;
  const weekOrders = orders.filter(isThisWeek);
  const todayOrders = orders.filter(isToday);

  const officeGpTotal = officeGP(orders);
  const officeGpWeek = officeGP(weekOrders);
  const officeGpToday = officeGP(todayOrders);
  const sovWeek = totalSOV(weekOrders);

  const teamRows = SELLING_TEAMS.map((t) => ({
    team: t,
    gp: teamGP(orders, t),
    gpToday: teamGP(todayOrders, t),
    orders: orders.filter((o) => o.closer_team === t || o.lead_gen_team === t).length,
  })).sort((a, b) => b.gp - a.gp);

  // Agent leaderboard by GP share (closer + lead gen shares combined)
  const agentMap = {};
  for (const o of orders) {
    if (o.closer_name) agentMap[o.closer_name] = (agentMap[o.closer_name] || 0) + num(o.closer_share);
    if (o.lead_gen_name) agentMap[o.lead_gen_name] = (agentMap[o.lead_gen_name] || 0) + num(o.lead_gen_share);
  }
  const leaderboard = Object.entries(agentMap).map(([name, gp]) => ({ name, gp: Number(gp) })).sort((a, b) => b.gp - a.gp).slice(0, 8);

  const statusCounts = STATUS_PIPELINE.map((s) => ({ status: s, n: orders.filter((o) => o.order_status === s).length }));

  const ACCENTS = ["#4C1D8F", "#205EA6", "#1F7A3D"];

  return (
    <div className="sw-root p-4" style={{ minHeight: "100vh" }}>
      <style>{STYLE}</style>
      {/* Slim single-row header: back link, brand, countdown — no dead space */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-3">
          <a href="/" className="sw-focus flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-full" style={{ color: "var(--ink-soft)", background: "var(--surface)", border: "1px solid var(--border)" }}>
            <ArrowLeft size={13} /> Dashboard
          </a>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center sw-display font-bold text-white text-sm" style={{ background: "var(--primary)" }}>S</div>
            <div>
              <div className="sw-display font-bold text-base leading-none">SchThrive Stats</div>
              <div className="text-xs flex items-center gap-1" style={{ color: "var(--ink-faint)" }}><Radio size={9} className="sw-live-dot" style={{ color: "var(--green)" }} /> Live · GBP</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl px-4 py-1.5" style={{ background: countdown.done ? "var(--surface)" : "var(--primary)", border: "1px solid var(--border)" }}>
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: countdown.done ? "var(--ink-soft)" : "rgba(255,255,255,0.75)" }}>To 5pm</span>
          <span className="sw-mono font-bold text-xl" style={{ color: countdown.done ? "var(--ink)" : "#fff" }}>{countdown.text}</span>
        </div>
      </div>

      {/* One unified 4-column grid runs top to bottom, so everything lines up:
          the 4 headline numbers each own a column; Team + Leaderboard each
          span 2 of those same 4 columns underneath. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "0.75rem" }}>
        <TVStat label="Office GP (Total)" value={fmtGBP(officeGpTotal)} accent="#1F7A3D" />
        <TVStat label="GP This Week" value={fmtGBP(officeGpWeek)} accent="#4C1D8F" />
        <TVStat label="GP Today" value={fmtGBP(officeGpToday)} accent="#205EA6" />
        <TVStat label="SOV This Week" value={fmtGBP(sovWeek)} accent="#B3660E" />

        {/* Team vs Team + pipeline — spans columns 1-2 */}
        <div style={{ gridColumn: "span 2", background: "var(--surface)", border: "1px solid var(--border)" }} className="rounded-2xl p-4">
          <div className="sw-display font-bold text-sm mb-3" style={{ color: "var(--ink-soft)" }}>TEAM VS TEAM — GP</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.6rem" }} className="mb-4">
            {teamRows.map((r, i) => (
              <div key={r.team} className="rounded-xl p-3 text-center" style={{ background: "var(--surface-alt)", borderTop: `3px solid ${ACCENTS[i % 3]}` }}>
                <div className="text-xs font-semibold mb-1" style={{ color: "var(--ink-soft)" }}>{r.team}</div>
                <div className="sw-display font-bold text-2xl" style={{ color: ACCENTS[i % 3] }}>{fmtGBP(r.gp)}</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>Today {fmtGBP(r.gpToday)} · {r.orders} orders</div>
              </div>
            ))}
          </div>
          <div className="sw-display font-bold text-sm mb-2" style={{ color: "var(--ink-soft)" }}>ORDER PIPELINE</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "0.5rem" }}>
            {statusCounts.map((s) => (
              <div key={s.status} className="rounded-lg p-2 text-center" style={{ background: "var(--surface-alt)" }}>
                <div className="sw-display font-bold text-xl">{s.n}</div>
                <div className="text-xs" style={{ color: "var(--ink-soft)" }}>{s.status}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Agent leaderboard — spans columns 3-4 */}
        <div style={{ gridColumn: "span 2", background: "var(--surface)", border: "1px solid var(--border)" }} className="rounded-2xl p-4">
          <div className="sw-display font-bold text-sm mb-3" style={{ color: "var(--ink-soft)" }}>AGENT LEADERBOARD</div>
          <div className="flex flex-col gap-1.5">
            {leaderboard.map((a, i) => (
              <div key={a.name} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg" style={{ background: i === 0 ? "var(--primary-soft)" : "var(--surface-alt)" }}>
                <div className="flex items-center gap-2">
                  <span className="sw-mono text-xs font-bold" style={{ color: "var(--ink-faint)", width: 16 }}>{i + 1}</span>
                  <span className="font-medium text-xs">{a.name}</span>
                </div>
                <span className="sw-mono font-bold text-xs" style={{ color: "var(--green)" }}>{fmtGBP(a.gp)}</span>
              </div>
            ))}
            {leaderboard.length === 0 && <div className="text-xs text-center py-6" style={{ color: "var(--ink-faint)" }}>No deals yet.</div>}
          </div>
        </div>
      </div>

      {/* Phase-2 placeholders — a single slim strip, not dead space */}
      <div className="flex items-center gap-2 mt-3 px-1 flex-wrap">
        <span className="text-xs font-semibold" style={{ color: "var(--ink-faint)" }}>Coming soon:</span>
        {["Targets vs Actual", "Quarterly / YTD", "Product Gap"].map((label) => (
          <span key={label} className="text-xs px-2.5 py-1 rounded-full" style={{ background: "var(--surface)", border: "1px dashed var(--border)", color: "var(--ink-faint)" }}>{label}</span>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  ADMIN — office-only: manage staff records, roles, teams                */
/* ---------------------------------------------------------------------- */

const ROLE_OPTIONS = ["office", "2ic", "agent"];

function StaffRow({ s, profileForStaff, onSaveStaff, onSaveProfile }) {
  const [edit, setEdit] = useState({
    full_name: s.full_name || "", uin: s.uin || "", email: s.email || "",
    manager_name: s.manager_name || "", manager_email: s.manager_email || "",
    team: s.team || "", sells: !!s.sells,
  });
  const [roleEdit, setRoleEdit] = useState(profileForStaff?.role || "");
  const [teamEdit, setTeamEdit] = useState(profileForStaff?.team || s.team || "");
  const [savingStaff, setSavingStaff] = useState(false);
  const [savingRole, setSavingRole] = useState(false);
  const [saved, setSaved] = useState(false);

  const staffDirty = Object.keys(edit).some((k) => String(edit[k]) !== String(s[k] ?? (k === "sells" ? true : "")));
  const roleDirty = profileForStaff && (roleEdit !== profileForStaff.role || teamEdit !== (profileForStaff.team || ""));

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1500); };

  return (
    <tr style={{ borderTop: "1px solid var(--border)" }}>
      <td className="px-3 py-2"><input className="sw-input sw-focus" style={{ minWidth: 130 }} value={edit.full_name} onChange={(e) => setEdit((p) => ({ ...p, full_name: e.target.value }))} /></td>
      <td className="px-3 py-2"><input className="sw-input sw-focus" style={{ width: 90 }} value={edit.uin} onChange={(e) => setEdit((p) => ({ ...p, uin: e.target.value }))} placeholder="—" /></td>
      <td className="px-3 py-2"><input className="sw-input sw-focus" style={{ minWidth: 170 }} value={edit.email} onChange={(e) => setEdit((p) => ({ ...p, email: e.target.value }))} /></td>
      <td className="px-3 py-2"><input className="sw-input sw-focus" style={{ minWidth: 110 }} value={edit.team} onChange={(e) => setEdit((p) => ({ ...p, team: e.target.value }))} list="team-suggestions" /></td>
      <td className="px-3 py-2 text-center"><input type="checkbox" checked={edit.sells} onChange={(e) => setEdit((p) => ({ ...p, sells: e.target.checked }))} /></td>
      <td className="px-3 py-2">
        <button
          disabled={!staffDirty || savingStaff}
          onClick={async () => { setSavingStaff(true); await onSaveStaff(s.id, edit); setSavingStaff(false); flash(); }}
          className="sw-focus text-xs font-semibold px-2.5 py-1.5 rounded-lg"
          style={{ background: staffDirty ? "var(--primary)" : "var(--surface-alt)", color: staffDirty ? "#fff" : "var(--ink-faint)" }}
        >{savingStaff ? "..." : "Save"}</button>
      </td>
      <td className="px-3 py-2">
        {profileForStaff ? (
          <select className="sw-input sw-focus" style={{ width: 100 }} value={roleEdit} onChange={(e) => setRoleEdit(e.target.value)}>
            {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        ) : <span className="text-xs" style={{ color: "var(--ink-faint)" }}>not signed in yet</span>}
      </td>
      <td className="px-3 py-2">
        {profileForStaff && (
          <button
            disabled={!roleDirty || savingRole}
            onClick={async () => { setSavingRole(true); await onSaveProfile(profileForStaff.id, { role: roleEdit, team: teamEdit }); setSavingRole(false); flash(); }}
            className="sw-focus text-xs font-semibold px-2.5 py-1.5 rounded-lg"
            style={{ background: roleDirty ? "var(--green)" : "var(--surface-alt)", color: roleDirty ? "#fff" : "var(--ink-faint)" }}
          >{savingRole ? "..." : "Save Role"}</button>
        )}
      </td>
      <td className="px-2 text-center">{saved && <CheckCircle2 size={14} style={{ color: "var(--green)" }} />}</td>
    </tr>
  );
}

function AddStaffRow({ onAdd }) {
  const [f, setF] = useState({ full_name: "", uin: "", email: "", manager_name: "", manager_email: "", team: "", sells: true });
  const [saving, setSaving] = useState(false);
  const canAdd = f.full_name.trim().length > 0;
  return (
    <tr style={{ borderTop: "2px solid var(--border)", background: "var(--surface-alt)" }}>
      <td className="px-3 py-2"><input className="sw-input sw-focus" placeholder="Full name" value={f.full_name} onChange={(e) => setF((p) => ({ ...p, full_name: e.target.value }))} /></td>
      <td className="px-3 py-2"><input className="sw-input sw-focus" style={{ width: 90 }} placeholder="UIN" value={f.uin} onChange={(e) => setF((p) => ({ ...p, uin: e.target.value }))} /></td>
      <td className="px-3 py-2"><input className="sw-input sw-focus" placeholder="Email" value={f.email} onChange={(e) => setF((p) => ({ ...p, email: e.target.value }))} /></td>
      <td className="px-3 py-2"><input className="sw-input sw-focus" placeholder="Team" value={f.team} onChange={(e) => setF((p) => ({ ...p, team: e.target.value }))} list="team-suggestions" /></td>
      <td className="px-3 py-2 text-center"><input type="checkbox" checked={f.sells} onChange={(e) => setF((p) => ({ ...p, sells: e.target.checked }))} /></td>
      <td className="px-3 py-2" colSpan={3}>
        <button
          disabled={!canAdd || saving}
          onClick={async () => { setSaving(true); await onAdd(f); setF({ full_name: "", uin: "", email: "", manager_name: "", manager_email: "", team: "", sells: true }); setSaving(false); }}
          className="sw-focus text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1"
          style={{ background: canAdd ? "var(--primary)" : "var(--surface)", color: canAdd ? "#fff" : "var(--ink-faint)", border: "1px solid var(--border)" }}
        ><Plus size={12} /> {saving ? "Adding..." : "Add Staff"}</button>
      </td>
    </tr>
  );
}

function AdminView({ staff, profiles, onSaveStaff, onAddStaff, onSaveProfile }) {
  const teamOptions = useMemo(() => Array.from(new Set(staff.map((s) => s.team).filter(Boolean))), [staff]);
  const profileByUserId = useMemo(() => {
    const m = {};
    for (const p of profiles) m[p.id] = p;
    return m;
  }, [profiles]);

  return (
    <div>
      <datalist id="team-suggestions">{teamOptions.map((t) => <option key={t} value={t} />)}</datalist>
      <div className="flex items-center gap-2 mb-4">
        <Users size={18} style={{ color: "var(--primary)" }} />
        <h2 className="sw-display text-lg font-bold">Staff & Roles</h2>
        <span className="text-xs" style={{ color: "var(--ink-faint)" }}>Office only · changes take effect immediately</span>
      </div>
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--surface-alt)" }}>
                {["Name", "UIN", "Email", "Team", "Sells", "", "Role", "", ""].map((h, i) => (
                  <th key={i} className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <StaffRow key={s.id} s={s} profileForStaff={s.user_id ? profileByUserId[s.user_id] : null} onSaveStaff={onSaveStaff} onSaveProfile={onSaveProfile} />
              ))}
              <AddStaffRow onAdd={onAddStaff} />
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs mt-3" style={{ color: "var(--ink-faint)" }}>
        Adding someone here creates their staff record (name, team, UIN, email) so they're ready to go. Their role/team dropdown appears once they've logged in for the first time — that's when their account links up automatically.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  APP SHELL — auth gate + live data                                     */
/* ---------------------------------------------------------------------- */

export default function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [staff, setStaff] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("dashboard");
  const [selected, setSelected] = useState(null);
  const [flashId, setFlashId] = useState(null);
  const [toast, setToast] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null); // { company, ref } after a successful save
  // Simple route detection: /tv (path or #tv) shows the TV board.
  const isTVRoute = typeof window !== "undefined" && (window.location.pathname.replace(/\/$/, "").endsWith("/tv") || window.location.hash === "#tv");

  // Auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load profile once signed in
  useEffect(() => {
    if (!session?.user) { setProfile(null); return; }
    supabase.from("profiles").select("*").eq("id", session.user.id).single()
      .then(({ data }) => setProfile(data || { id: session.user.id, role: "agent", full_name: session.user.email }));
  }, [session]);

  // Load the staff list (for dropdowns) once signed in
  const loadStaff = useCallback(async () => {
    const { data } = await supabase.from("staff").select("*").order("full_name");
    setStaff(data || []);
  }, []);
  useEffect(() => { if (session?.user) loadStaff(); }, [session, loadStaff]);

  // Office users also load every profile, needed for the Admin page's role editor
  const loadAllProfiles = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("*");
    setAllProfiles(data || []);
  }, []);
  useEffect(() => { if (profile?.role === "office") loadAllProfiles(); }, [profile, loadAllProfiles]);

  // Load orders + subscribe to realtime changes
  const loadOrders = useCallback(async () => {
    // Supabase caps a single request at 1000 rows, so page through until
    // we've got everything — otherwise every total silently under-reports.
    const PAGE = 1000;
    let all = [];
    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .is("removed_at", null)          // hide removed orders
        .order("submission_date", { ascending: false })
        .range(from, from + PAGE - 1);
      if (error || !data) break;
      all = all.concat(data);
      if (data.length < PAGE) break;     // last page
      from += PAGE;
      if (from > 100000) break;          // hard stop, just in case
    }
    setOrders(all);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    loadOrders();
    const channel = supabase.channel("orders-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        loadOrders();
        if (payload.new?.id) {
          setFlashId(payload.new.id);
          setTimeout(() => setFlashId((f) => (f === payload.new.id ? null : f)), 1600);
        }
      })
      .subscribe();
    // Safety-net refresh every 60s (keeps the wall-mounted TV honest).
    const poll = setInterval(loadOrders, 60000);
    return () => { supabase.removeChannel(channel); clearInterval(poll); };
  }, [session, loadOrders]);

  const handleNewOrder = useCallback(async (partial) => {
    setSubmitting(true);
    const row = { ...partial, submission_date: new Date().toISOString(), last_updated: new Date().toISOString() };
    const { error } = await supabase.from("orders").insert(row);
    setSubmitting(false);
    if (error) {
      setToast(`Couldn't save: ${error.message}`);
      setTimeout(() => setToast(""), 5000);
      return;
    }
    setTab("dashboard");
    // Show the LBCR reference persistently — the agent needs to carry it
    // into NetSuite, so this shouldn't vanish on a timer like a toast.
    setSubmitted({ company: partial.company_name, ref: partial.lbcr_ref });
    // realtime will refresh the list; loadOrders as a fallback
    loadOrders();
  }, [loadOrders]);

  const signOut = () => supabase.auth.signOut();

  // Save SOV/GP edits. RLS enforces who's actually allowed; this mirror keeps the UI honest.
  const [savingEdit, setSavingEdit] = useState(false);
  const saveOrder = useCallback(async (id, patch) => {
    setSavingEdit(true);
    const { error } = await supabase.from("orders").update(patch).eq("id", id);
    setSavingEdit(false);
    if (error) {
      setToast(`Couldn't update: ${error.message}`);
      setTimeout(() => setToast(""), 5000);
      return;
    }
    setToast("Order updated");
    setTimeout(() => setToast(""), 2500);
    loadOrders();
    setSelected((s) => (s && s.id === id ? { ...s, ...patch } : s));
  }, [loadOrders]);

  // Remove (withdraw) an order — soft delete, keeps an audit trail.
  const removeOrder = useCallback(async (id, reason) => {
    const { error } = await supabase.from("orders").update({
      removed_at: new Date().toISOString(),
      removed_by: session?.user?.id || null,
      removed_reason: reason || null,
    }).eq("id", id);
    if (error) { setToast(`Couldn't remove: ${error.message}`); setTimeout(() => setToast(""), 5000); return; }
    setToast("Order removed");
    setTimeout(() => setToast(""), 2500);
    setSelected(null);
    loadOrders();
  }, [loadOrders, session]);

  // Can the current user edit this deal? office = any; 2ic = their team; agent = only deals they closed.
  const canEditOrder = useCallback((o) => {
    if (!o || !profile) return false;
    if (profile.role === "office") return true;
    if (profile.role === "2ic" && profile.team && (o.closer_team === profile.team || o.lead_gen_team === profile.team)) return true;
    if (o.closer_id && session?.user && o.closer_id === session.user.id) return true;
    return false;
  }, [profile, session]);

  // --- Admin: staff & role management (office only; RLS enforces this too) ---
  const saveStaff = useCallback(async (id, patch) => {
    const { error } = await supabase.from("staff").update(patch).eq("id", id);
    if (error) { setToast(`Couldn't save: ${error.message}`); setTimeout(() => setToast(""), 5000); return; }
    loadStaff();
  }, [loadStaff]);

  const addStaff = useCallback(async (row) => {
    const { error } = await supabase.from("staff").insert(row);
    if (error) { setToast(`Couldn't add: ${error.message}`); setTimeout(() => setToast(""), 5000); return; }
    setToast(`${row.full_name} added to staff`);
    setTimeout(() => setToast(""), 2500);
    loadStaff();
  }, [loadStaff]);

  const saveProfileRole = useCallback(async (profileId, patch) => {
    const { error } = await supabase.from("profiles").update(patch).eq("id", profileId);
    if (error) { setToast(`Couldn't update role: ${error.message}`); setTimeout(() => setToast(""), 5000); return; }
    loadAllProfiles();
  }, [loadAllProfiles]);

  const staffValue = useMemo(() => ({ all: staff, sellers: staff.filter((s) => s.sells) }), [staff]);

  if (!authReady) return <div className="sw-root flex items-center justify-center" style={{ minHeight: "100vh" }}><style>{STYLE}</style><Loader2 className="animate-spin" style={{ color: "var(--primary)" }} /></div>;
  if (!session) return <LoginScreen />;

  // TV wall board route — reuses the logged-in session on that device.
  if (isTVRoute) {
    return (
      <StaffContext.Provider value={staffValue}>
        <TVBoard orders={orders} />
      </StaffContext.Provider>
    );
  }

  return (
    <StaffContext.Provider value={staffValue}>
    <div className="sw-root">
      <style>{STYLE}</style>
      <header className="sticky top-0 z-30 px-6 py-4 flex items-center justify-between" style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center sw-display font-bold text-white" style={{ background: "var(--primary)" }}>S</div>
          <div>
            <div className="sw-display font-bold leading-tight">SchThrive WebOS</div>
            <div className="text-xs flex items-center gap-1.5" style={{ color: "var(--ink-faint)" }}>
              <Radio size={10} className="sw-live-dot" style={{ color: "var(--green)" }} /> Live · GBP
              {profile && <span> · {profile.role === "office" ? "Office" : profile.role === "2ic" ? "2IC" : "Agent"}{profile.team ? ` · ${profile.team}` : ""}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <nav className="flex gap-2">
            <button onClick={() => setTab("dashboard")} className="sw-focus px-4 py-2 rounded-full text-sm font-semibold" style={tab === "dashboard" ? { background: "var(--primary)", color: "#fff" } : { color: "var(--ink-soft)" }}>Dashboard</button>
            <button onClick={() => setTab("new")} className="sw-focus px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5" style={tab === "new" ? { background: "var(--primary)", color: "#fff" } : { color: "var(--ink-soft)" }}><Plus size={14} /> New Submission</button>
            {profile?.role === "office" && (
              <button onClick={() => setTab("admin")} className="sw-focus px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5" style={tab === "admin" ? { background: "var(--primary)", color: "#fff" } : { color: "var(--ink-soft)" }}><Users size={14} /> Admin</button>
            )}
            <a href="#tv" onClick={() => { setTimeout(() => window.location.reload(), 0); }} className="sw-focus px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5" style={{ color: "var(--ink-soft)" }} title="Open the wall board"><Radio size={14} /> TV Mode</a>
          </nav>
          <button onClick={signOut} title="Sign out" className="sw-focus p-2 rounded-lg" style={{ color: "var(--ink-soft)" }}><LogOut size={16} /></button>
        </div>
      </header>

      <main className="p-6 max-w-6xl mx-auto">
        {submitted && (
          <div className="sw-rise rounded-2xl p-4 mb-5 flex items-center justify-between gap-4" style={{ background: "var(--green-soft)", border: "1px solid var(--green)" }}>
            <div className="flex items-center gap-3">
              <CheckCircle2 size={20} style={{ color: "var(--green)" }} />
              <div>
                <div className="font-semibold text-sm">{submitted.company} submitted</div>
                <div className="text-xs" style={{ color: "var(--ink-soft)" }}>Quote this reference on the NetSuite order so the two can be matched up.</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="sw-mono font-bold text-sm px-3 py-2 rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>{submitted.ref}</span>
              <button onClick={() => { navigator.clipboard?.writeText(submitted.ref); setToast("Reference copied"); setTimeout(() => setToast(""), 1800); }}
                className="sw-focus text-xs font-semibold px-3 py-2 rounded-lg text-white" style={{ background: "var(--green)" }}>Copy</button>
              <button onClick={() => setSubmitted(null)} className="sw-focus p-2 rounded-lg" style={{ color: "var(--ink-soft)" }}><X size={16} /></button>
            </div>
          </div>
        )}
        {tab === "dashboard" && <DashboardView orders={orders} onOpenOrder={setSelected} flashId={flashId} profile={profile} loading={loading} />}
        {tab === "new" && <NewSubmissionView onSubmit={handleNewOrder} submitting={submitting} />}
        {tab === "admin" && profile?.role === "office" && <AdminView staff={staff} profiles={allProfiles} onSaveStaff={saveStaff} onAddStaff={addStaff} onSaveProfile={saveProfileRole} />}
      </main>

      {selected && <OrderDrawer order={selected} onClose={() => setSelected(null)} canEdit={canEditOrder(selected)} onSave={saveOrder} saving={savingEdit} onRemove={removeOrder} />}
      {toast && (
        <div className="sw-slide-in fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl flex items-center gap-2 text-sm font-medium text-white" style={{ background: toast.startsWith("Couldn't") ? "var(--red)" : "var(--green)" }}>
          {toast.startsWith("Couldn't") ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />} {toast}
        </div>
      )}
    </div>
    </StaffContext.Provider>
  );
}
