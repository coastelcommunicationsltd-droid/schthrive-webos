import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Search, Filter, X, AlertTriangle, CheckCircle2, Clock, Radio, Plus,
  Building2, Wallet, TrendingUp, ShieldAlert, RefreshCw, LogOut, Mail,
  Loader2, Users, Eye, EyeOff, ArrowLeft, LogIn, KeyRound, Palette, MapPin,
  BarChart3, CalendarDays, Target, Headphones, Phone,
  ChevronDown, ClipboardList, LayoutDashboard, Settings as SettingsIcon,
  PanelLeftClose, PanelLeftOpen, History, FileText, Inbox,
} from "lucide-react";

/* ====================================================================== */
/*  CONFIG — edit these as your org changes                               */
/* ====================================================================== */

// 1. Supabase connection — read from environment variables.
//    Set these in a local `.env` file (for npm run dev) AND in your
//    Vercel project settings (for the live site):
//      VITE_SUPABASE_URL=https://xrekebgnubhjqtpllbcz.supabase.co
//      VITE_SUPABASE_ANON_KEY=your_publishable_key
//    The anon key is safe in frontend code — Row Level Security is what
//    actually controls who can read/write what.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Fails loudly in the console rather than a vague "Invalid API key" later
  console.error(
    "Supabase config missing. Expected VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. " +
    "Locally: check .env exists and restart the dev server. " +
    "On Vercel: check Settings > Environment Variables, then redeploy."
  );
}

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

// Manager-managed status settings (colour + whether it counts toward GP/SOV)
const StatusCfgContext = React.createContext({});
const useStatusCfg = () => React.useContext(StatusCfgContext);

// NetSuite sometimes spells a name differently to the staff list. This maps
// the alias back to the real person so figures land on the right agent.
const AliasContext = React.createContext({});
const useAliases = () => React.useContext(AliasContext);
const resolveName = (name, aliases) => {
  if (!name) return name;
  const hit = aliases[String(name).trim().toLowerCase()];
  return hit || name;
};

/* ---- Postcodes --------------------------------------------------------
   The "area" is the leading letters of a UK postcode — PL is Plymouth,
   EX Exeter, TQ Torquay. That's the right grain for a sales heatmap:
   granular enough to be useful, coarse enough to show a pattern. */
const UK_POSTCODE_RE = /^\s*([A-Z]{1,2})([0-9][A-Z0-9]?)\s*([0-9][A-Z]{2})?\s*$/i;
function postcodeArea(pc) {
  const m = String(pc || "").trim().match(UK_POSTCODE_RE);
  return m ? m[1].toUpperCase() : null;
}
function normalisePostcode(pc) {
  const s = String(pc || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!s) return null;
  return s.length > 3 ? s.slice(0, s.length - 3) + " " + s.slice(-3) : s;
}

/* ---------------------------------------------------------------------- */
/*  DESIGN TOKENS                                                          */
/* ---------------------------------------------------------------------- */

const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
.sw-root {
  --bg:#F7F6FB; --surface:#FFFFFF; --surface-alt:#F7F5FC; --border:#E8E4F2;
  --ink:#211E32; --ink-soft:#6B6584; --ink-faint:#A19BB4;
  --primary:#4C1D8F; --primary-soft:#F1ECFB;
  --gold:#8A6608; --gold-soft:#FBF5E6; --green:#1B7038; --green-soft:#EAF6EE;
  --amber:#A55C0B; --amber-soft:#FCF1E4; --blue:#1D5595; --blue-soft:#EBF1FA;
  --red:#B3352A; --red-soft:#FBEEEC;
  font-family:'Inter',ui-sans-serif,system-ui,sans-serif; color:var(--ink);
  font-feature-settings:'cv05' 1; -webkit-font-smoothing:antialiased;
  background:var(--bg); min-height:100vh;
}
.sw-root *{box-sizing:border-box;}
.sw-display{font-family:'Inter',ui-sans-serif,system-ui,sans-serif;letter-spacing:-.015em;font-feature-settings:'tnum' 1,'cv05' 1;}
.sw-mono{font-family:'Inter',ui-sans-serif,system-ui,sans-serif;font-variant-numeric:tabular-nums;font-feature-settings:'tnum' 1;}
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
.sw-clamp2{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word;}
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

const TONE_MAP = {
  green:   { fg: "var(--green)",   bg: "var(--green-soft)" },
  blue:    { fg: "var(--blue)",    bg: "var(--blue-soft)" },
  amber:   { fg: "var(--amber)",   bg: "var(--amber-soft)" },
  red:     { fg: "var(--red)",     bg: "var(--red-soft)" },
  primary: { fg: "var(--primary)", bg: "var(--primary-soft)" },
  gold:    { fg: "var(--gold)",    bg: "var(--gold-soft)" },
  neutral: { fg: "var(--ink-soft)", bg: "var(--surface-alt)" },
};
const TONE_CHOICES = ["green", "blue", "amber", "red", "primary", "gold", "neutral"];

// Best guess when a status hasn't been configured yet — this is also what
// seeds the colour a manager then sees and can override.
function guessTone(status) {
  const s = String(status || "").toLowerCase();
  if (!s) return "neutral";
  if (/(cease|cancel|reject|lost|fail|void|declin)/.test(s)) return "red";
  if (/(complete|billed|closed won|live|provided|dispatch|deliver)/.test(s)) return "green";
  if (/(awaiting|pending|hold|queue|delay)/.test(s)) return "amber";
  if (/(job number|progress|processing|accepted|submitted|placed|build)/.test(s)) return "blue";
  return "primary";
}

// statusCfg is the manager-managed map: { [status]: {tone, count_gp, count_sov} }
function statusTone(status, ngp, statusCfg) {
  if (ngp) return TONE_MAP.red;                    // doesn't count — always red
  const cfg = statusCfg && statusCfg[status];
  if (cfg && TONE_MAP[cfg.tone]) return TONE_MAP[cfg.tone];
  return TONE_MAP[guessTone(status)] || TONE_MAP.neutral;
}
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
  { key: "qtd", label: "QTD" },
  { key: "ytd", label: "YTD" },
  { key: "all", label: "All" },
];

function periodLabelFor(key) {
  const p = PERIODS.find((x) => x.key === key);
  return p ? p.label : "";
}

/* ---- Targets & pacing -------------------------------------------------
   Pay plan targets are monthly. They get pro-rated by WORKING DAYS so
   someone isn't judged against a full month's number on the 3rd. On day
   10 of a 20-working-day month, half the target is the green line.
   (Counts Mon-Fri; bank holidays aren't accounted for.) */
function workdaysBetween(start, end) {
  let n = 0;
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (d <= last) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}
function workdaysInMonth(d = new Date()) {
  return workdaysBetween(new Date(d.getFullYear(), d.getMonth(), 1), new Date(d.getFullYear(), d.getMonth() + 1, 0));
}
function workdaysElapsedInMonth(d = new Date()) {
  return workdaysBetween(new Date(d.getFullYear(), d.getMonth(), 1), d);
}

// The whole target for the period, not scaled by how far through it we are.
// This is what people are actually chasing; the pro-rated figure below is
// only used to decide whether they're on track today.
function fullPeriodTarget(monthlyTarget, period, now = new Date()) {
  if (!monthlyTarget) return 0;
  const inMonth = workdaysInMonth(now) || 1;
  const perDay = monthlyTarget / inMonth;
  switch (period) {
    case "day": return perDay;
    case "wtd": return perDay * 5;
    case "mtd": return monthlyTarget;
    case "qtd": return monthlyTarget * 3;
    case "ytd": return monthlyTarget * 12;
    default: return 0;   // 'all'
  }
}

// How much of a monthly target should be met by now, for the period shown.
function proRatedTarget(monthlyTarget, period, now = new Date()) {
  if (!monthlyTarget) return 0;
  const inMonth = workdaysInMonth(now) || 1;
  const perDay = monthlyTarget / inMonth;
  switch (period) {
    case "day": return perDay;
    case "wtd": return perDay * workdaysBetween(weekStart(now), now);
    case "mtd": return perDay * workdaysElapsedInMonth(now);
    case "qtd": {
      const qs = fqStart(now);
      const monthsDone = (now.getFullYear() * 12 + now.getMonth()) - (qs.getFullYear() * 12 + qs.getMonth());
      return monthlyTarget * monthsDone + perDay * workdaysElapsedInMonth(now);
    }
    case "ytd": {
      const ys = fyStart(now);
      const monthsDone = (now.getFullYear() * 12 + now.getMonth()) - (ys.getFullYear() * 12 + ys.getMonth());
      return monthlyTarget * monthsDone + perDay * workdaysElapsedInMonth(now);
    }
    default: return 0;   // 'all' — no meaningful target
  }
}

// Green once the pace target is met, amber from 75%, red below.
function paceTone(value, target) {
  if (!target || target <= 0) return null;
  const ratio = value / target;
  if (ratio >= 1) return { key: "green", fg: "var(--green)", bg: "var(--green-soft)" };
  if (ratio >= 0.75) return { key: "amber", fg: "var(--amber)", bg: "var(--amber-soft)" };
  return { key: "red", fg: "var(--red)", bg: "var(--red-soft)" };
}

// Start of the current financial year: 1 April of this year if we're in
// April or later, otherwise 1 April of last year.
function fyStart(now = new Date()) {
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(y, 3, 1, 0, 0, 0, 0);
}
// Financial quarters run Apr-Jun, Jul-Sep, Oct-Dec, Jan-Mar.
function fqStart(now = new Date()) {
  const m = now.getMonth();                       // 0-11
  const fyMonth = (m - 3 + 12) % 12;              // months since April
  const qIndex = Math.floor(fyMonth / 3);         // 0-3
  const startMonth = (3 + qIndex * 3) % 12;
  const year = startMonth > m ? now.getFullYear() - 1 : now.getFullYear();
  return new Date(year, startMonth, 1, 0, 0, 0, 0);
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
    case "qtd": return fqStart(now);
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

/* ---- Brand logo -------------------------------------------------------
   Save the BT Local Business image as `public/logo.jpg` in your project.
   If it isn't there this quietly falls back to the lettermark, so a
   missing file never breaks the page. */
function Logo({ height = 34 }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="rounded-xl flex items-center justify-center sw-display font-bold text-white"
        style={{ background: "var(--primary)", width: height, height }}>S</div>
    );
  }
  return <img src="/logo.jpg" alt="BT Local Business — Coastel Communications"
    style={{ height, width: "auto", display: "block" }} onError={() => setFailed(true)} />;
}

/* ---- Treemap ----------------------------------------------------------
   Splits the space in two at roughly half the total value, alternating
   direction each time. Bigger sellers get bigger boxes. */
const PRODUCT_SHADES = ["#3B1370", "#4C1D8F", "#5E2CA8", "#7040BE", "#8659CE", "#9C74DC", "#B18FE6", "#C4AAEE"];

// GP makeup on the ranked list — one colour per product group
const MIX_ORDER = ["Cloud", "Connectivity", "Mobile", "Other"];
const MIX_COLOURS = { Cloud: "#5E2CA8", Connectivity: "#2A6FB8", Mobile: "#8659CE", Other: "#B4AEC6" };

// Team colours drawn from the Okabe-Ito palette, which stays distinguishable
// under the common forms of colour blindness. Every use is paired with the
// team's initials, so nobody has to rely on colour alone.
const TEAM_PALETTE = [
  { fg: "#0072B2", bg: "#E4F0F8" },   // blue
  { fg: "#D55E00", bg: "#FBEDE4" },   // vermillion
  { fg: "#7B52AB", bg: "#F0EAF7" },   // purple
  { fg: "#009E73", bg: "#E2F4EF" },   // teal-green
  { fg: "#8A6D3B", bg: "#F5EFE3" },   // brown
];
function teamStyle(team, allTeams) {
  if (!team) return { fg: "var(--ink-faint)", bg: "var(--surface-alt)", initials: "—" };
  const i = Math.max(0, (allTeams || []).indexOf(team));
  const p = TEAM_PALETTE[i % TEAM_PALETTE.length];
  const initials = String(team).split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return { ...p, initials };
}

// A small, consistent way of showing which team someone is on
function TeamTag({ team, allTeams }) {
  const s = teamStyle(team, allTeams);
  return (
    <span title={team || "No team"}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        minWidth: 20, height: 15, padding: "0 4px", borderRadius: 3,
        background: s.bg, color: s.fg, fontSize: 9.5, fontWeight: 700,
        letterSpacing: "0.02em", flexShrink: 0,
      }}>
      {s.initials}
    </span>
  );
}

function treemapLayout(items, x, y, w, h, horizontal) {
  if (!items.length) return [];
  if (items.length === 1) return [{ ...items[0], x, y, w, h }];
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total <= 0) return [];
  let acc = 0, splitIdx = 1;
  for (let i = 0; i < items.length; i++) {
    if (acc + items[i].value > total / 2 && i > 0) { splitIdx = i; break; }
    acc += items[i].value;
    splitIdx = i + 1;
  }
  const a = items.slice(0, splitIdx), b = items.slice(splitIdx);
  if (!b.length) return a.map((it) => ({ ...it, x, y, w, h }));
  const aTotal = a.reduce((s, i) => s + i.value, 0);
  const ratio = aTotal / total;
  if (horizontal) {
    const wa = w * ratio;
    return treemapLayout(a, x, y, wa, h, !horizontal)
      .concat(treemapLayout(b, x + wa, y, w - wa, h, !horizontal));
  }
  const ha = h * ratio;
  return treemapLayout(a, x, y, w, ha, !horizontal)
    .concat(treemapLayout(b, x, y + ha, w, h - ha, !horizontal));
}

function StatusPill({ status, ngp }) {
  const statusCfg = useStatusCfg();
  const s = statusTone(status, ngp, statusCfg);
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
function KPICard({ icon: Icon, label, value, sub, accent, target, rawValue }) {
  const tone = target ? paceTone(rawValue, target) : null;
  const pct = target ? Math.min(200, Math.round((rawValue / target) * 100)) : 0;
  return (
    <div className="sw-rise rounded-2xl p-3.5 flex flex-col gap-2 h-full"
      style={{
        background: tone ? tone.bg : "var(--surface)",
        border: `1px solid ${tone ? tone.fg : "var(--border)"}`,
      }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide truncate" style={{ color: "var(--ink-soft)" }}>{label}</span>
        <div className="w-7 h-7 shrink-0 rounded-lg flex items-center justify-center"
          style={{ background: (tone ? tone.fg : accent) + "1a", color: tone ? tone.fg : accent }}><Icon size={14} strokeWidth={2.25} /></div>
      </div>
      <div className="sw-display text-xl font-bold truncate" style={{ color: tone ? tone.fg : "var(--ink)" }}>{value}</div>
      {tone ? (
        <>
          <div className="rounded-full" style={{ height: 5, background: "rgba(0,0,0,0.07)" }}>
            <div className="rounded-full" style={{ width: Math.min(100, pct) + "%", height: "100%", background: tone.fg, transition: "width .3s" }} />
          </div>
          <div className="text-xs truncate" style={{ color: "var(--ink-soft)" }}>
            <b style={{ color: tone.fg }}>{pct}%</b> of pace · {fmtGBP(target)}
          </div>
        </>
      ) : (
        sub && <div className="text-xs truncate" style={{ color: "var(--ink-faint)" }}>{sub}</div>
      )}
    </div>
  );
}

/* Headline figure. Carries a target when the viewer has a pay plan. */
function HeroCard({ label, value, note, accent, target, fullTarget, rawValue, acq, acqLabel }) {
  // Colour reflects pace (are you where you should be today); the number
  // and bar reflect the whole target, so day 1 doesn't read as 1200%.
  const tone = target ? paceTone(rawValue, target) : null;
  const denom = fullTarget || target;
  const pct = denom ? Math.round((rawValue / denom) * 100) : 0;
  const pacePct = denom && target ? Math.min(100, (target / denom) * 100) : 0;
  return (
    <div className="sw-rise rounded-xl p-4 flex flex-col justify-between"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", minHeight: 112 }}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-medium uppercase" style={{ color: "var(--ink-faint)", letterSpacing: "0.04em" }}>{label}</span>
        {acq && (
          <div className="text-right shrink-0">
            <div className="sw-mono" style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)" }}>{acq.value}</div>
            <div style={{ fontSize: 10, color: "var(--ink-faint)" }}>{acqLabel} · {acq.pct.toFixed(0)}%</div>
          </div>
        )}
      </div>
      <div className="sw-display" style={{ fontSize: 29, fontWeight: 600, lineHeight: 1.05, letterSpacing: "-0.025em", color: "var(--ink)" }}>
        {value}
      </div>
      {tone ? (
        <div>
          <div className="rounded-full mb-1.5" style={{ height: 5, background: "var(--surface-alt)", position: "relative" }}>
            <div className="rounded-full" style={{ width: Math.min(100, pct) + "%", height: "100%", background: tone.fg, transition: "width .3s" }} />
            {/* Where you should be today — sits proud of the bar so it reads
                whether it falls on filled or unfilled track. */}
            {pacePct > 0 && pacePct <= 100 && (
              <div title={`On pace today: ${fmtGBP(target)}`}
                style={{ position: "absolute", left: `calc(${pacePct}% - 1px)`, top: -3, bottom: -3, width: 2, background: "var(--ink)", borderRadius: 1 }} />
            )}
          </div>
          <div className="text-xs" style={{ color: "var(--ink-faint)" }}>
            {fmtGBP(denom)} target · {fmtGBP(target)} to pace
          </div>
        </div>
      ) : (
        <div className="text-xs" style={{ color: "var(--ink-faint)" }}>{note}</div>
      )}
    </div>
  );
}

/* Slim campaign figure tucked under a headline card. Full view only —
   it's context, not a headline in its own right. */
function CampaignBar({ label, value, pct }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 mt-1 rounded-lg"
      style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}>
      <span style={{ fontSize: 11, opacity: value ? 1 : 0.4 }}>🎯</span>
      <span className="text-xs" style={{ color: "var(--ink-faint)" }}>{label}</span>
      <span className="sw-mono ml-auto" style={{ fontSize: 12, fontWeight: 600, color: value ? "var(--ink)" : "var(--ink-faint)" }}>{fmtGBP(value)}</span>
      <span className="text-xs" style={{ color: "var(--ink-faint)" }}>{(pct || 0).toFixed(0)}%</span>
    </div>
  );
}

/* One product's SOV, with its target bar if there is one. */
function MiniStat({ label, value, target, fullTarget, accent, bold }) {
  const tone = target ? paceTone(value, target) : null;
  const denom = fullTarget || target;
  const pct = denom ? Math.round((value / denom) * 100) : 0;
  const pacePct = denom && target ? Math.min(100, (target / denom) * 100) : 0;
  return (
    <div className="px-1 py-1">
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-xs truncate" style={{ color: "var(--ink-faint)" }}>{label}</span>
        {tone && <span className="text-xs font-semibold shrink-0" style={{ color: tone.fg, fontSize: 10 }}>{pct}%</span>}
      </div>
      <div className="sw-display truncate" style={{ fontSize: bold ? 17 : 16, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--ink)" }}>{fmtGBP(value)}</div>
      {tone && (
        <div className="rounded-full mt-1" style={{ height: 4, background: "var(--surface-alt)", position: "relative" }}>
          <div className="rounded-full" style={{ width: Math.min(100, pct) + "%", height: "100%", background: tone.fg }} />
          {pacePct > 0 && pacePct <= 100 && (
            <div title={`On pace today: ${fmtGBP(target)}`}
              style={{ position: "absolute", left: `calc(${pacePct}% - 1px)`, top: -2, bottom: -2, width: 2, background: "var(--ink)", borderRadius: 1 }} />
          )}
        </div>
      )}
    </div>
  );
}

/* A single count in the health strip. */
function HealthItem({ label, value, colour, hint }) {
  return (
    <div className="flex items-baseline gap-1.5" title={hint}>
      <span className="sw-display" style={{ fontSize: 15, fontWeight: 600, color: value ? colour : "var(--ink-faint)" }}>{value}</span>
      <span className="text-xs" style={{ color: "var(--ink-faint)" }}>{label}</span>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  CHARTS — small SVG primitives, no chart library needed                 */
/* ---------------------------------------------------------------------- */

// Month-on-month line. series: [{name, colour, points:[{label, value}]}]
function LineChart({ series, height = 190, money = true }) {
  const [hover, setHover] = useState(null);
  const labels = series[0]?.points.map((p) => p.label) || [];
  const all = series.flatMap((s) => s.points.map((p) => p.value));
  const max = Math.max(1, ...all);
  const W = 100, H = 100;                     // drawn in a 0-100 viewBox
  const x = (i) => (labels.length <= 1 ? 50 : (i / (labels.length - 1)) * W);
  const y = (v) => H - (v / max) * (H - 8);

  if (!labels.length) {
    return <div className="text-xs text-center py-12" style={{ color: "var(--ink-faint)" }}>Not enough history yet.</div>;
  }

  return (
    <div>
      <div style={{ position: "relative", height }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: "100%", overflow: "visible" }}>
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <line key={f} x1="0" x2={W} y1={H - f * (H - 8)} y2={H - f * (H - 8)}
              stroke="var(--border)" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
          ))}
          {series.map((s) => (
            <g key={s.name}>
              <polyline
                points={s.points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ")}
                fill="none" stroke={s.colour} strokeWidth="2" vectorEffect="non-scaling-stroke"
                strokeLinejoin="round" strokeLinecap="round" />
              {s.points.map((p, i) => (
                <circle key={i} cx={x(i)} cy={y(p.value)} r={hover === i ? 3.5 : 2.2}
                  fill={s.colour} stroke="var(--surface)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              ))}
            </g>
          ))}
          {labels.map((_, i) => (
            <rect key={i} x={x(i) - (W / labels.length) / 2} y="0" width={W / labels.length} height={H}
              fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
          ))}
        </svg>
      </div>

      <div className="flex justify-between mt-1">
        {labels.map((l, i) => (
          <span key={i} style={{ fontSize: 10, color: hover === i ? "var(--ink)" : "var(--ink-faint)", fontWeight: hover === i ? 700 : 400 }}>{l}</span>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-2 flex-wrap">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--ink-soft)" }}>
            <span style={{ width: 9, height: 3, borderRadius: 2, background: s.colour, display: "inline-block" }} />
            {s.name}
            {hover !== null && (
              <b style={{ color: "var(--ink)" }}>
                {money ? fmtGBP(s.points[hover]?.value) : (s.points[hover]?.value ?? 0).toLocaleString("en-GB")}
              </b>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

// Side-by-side columns per group. groups: [{label, bars:[{name, value, colour}]}]
function ClusteredColumns({ groups, height = 190, money = true }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...groups.flatMap((g) => g.bars.map((b) => b.value)));
  const legend = groups[0]?.bars || [];

  if (!groups.length) {
    return <div className="text-xs text-center py-12" style={{ color: "var(--ink-faint)" }}>Nothing to compare yet.</div>;
  }

  return (
    <div>
      <div className="flex items-end gap-1" style={{ height }}>
        {groups.map((g, gi) => (
          <div key={g.label} className="flex-1 flex flex-col justify-end" style={{ height: "100%" }}
            onMouseEnter={() => setHover(gi)} onMouseLeave={() => setHover(null)}>
            <div className="flex items-end justify-center gap-0.5" style={{ height: "100%" }}>
              {g.bars.map((b) => (
                <div key={b.name} title={`${g.label} · ${b.name}: ${money ? fmtGBP(b.value) : b.value}`}
                  style={{
                    width: `${70 / g.bars.length}%`,
                    height: `${Math.max(1, (b.value / max) * 100)}%`,
                    background: b.colour,
                    borderRadius: "3px 3px 0 0",
                    opacity: hover === null || hover === gi ? 1 : 0.4,
                    transition: "opacity .15s",
                  }} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-1 mt-1">
        {groups.map((g, gi) => (
          <span key={g.label} className="flex-1 text-center" style={{ fontSize: 10, color: hover === gi ? "var(--ink)" : "var(--ink-faint)", fontWeight: hover === gi ? 700 : 400 }}>{g.label}</span>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        {legend.map((b) => (
          <span key={b.name} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--ink-soft)" }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: b.colour, display: "inline-block" }} />
            {b.name}
            {hover !== null && (
              <b style={{ color: "var(--ink)" }}>
                {money ? fmtGBP(groups[hover].bars.find((x) => x.name === b.name)?.value || 0) : (groups[hover].bars.find((x) => x.name === b.name)?.value || 0)}
              </b>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

/* Actual as a column, forecast as a marker across it. Reads as "did we hit
   it" at a glance, which side-by-side bars don't. */
function TargetBars({ groups, height = 210, money = true }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...groups.flatMap((g) => [g.actual, g.target]));
  const fmt = (v) => (money ? fmtGBP(v) : (v || 0).toLocaleString("en-GB"));

  if (!groups.length) {
    return <div className="text-xs text-center py-12" style={{ color: "var(--ink-faint)" }}>Nothing to compare yet.</div>;
  }

  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {groups.map((g, i) => {
          const hit = g.target > 0 && g.actual >= g.target;
          const pct = g.target > 0 ? (g.actual / g.target) * 100 : null;
          const colour = g.target <= 0 ? "var(--blue)" : hit ? "var(--green)" : (pct || 0) >= 75 ? "var(--amber)" : "var(--red)";
          return (
            <div key={g.label} className="flex-1 flex flex-col justify-end" style={{ height: "100%", position: "relative" }}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>

              {/* value sits above the column */}
              <div className="text-center sw-mono" style={{ fontSize: 10, fontWeight: 700, color: colour, marginBottom: 2, opacity: hover === null || hover === i ? 1 : 0.45 }}>
                {fmt(g.actual)}
              </div>

              <div style={{ position: "relative", height: "100%" }}>
                {/* actual */}
                <div style={{
                  position: "absolute", bottom: 0, left: "16%", right: "16%",
                  height: `${Math.max(1, (g.actual / max) * 100)}%`,
                  background: colour, borderRadius: "3px 3px 0 0",
                  opacity: hover === null || hover === i ? 1 : 0.4, transition: "opacity .15s",
                }} />
                {/* forecast marker */}
                {g.target > 0 && (
                  <div style={{
                    position: "absolute", bottom: `${(g.target / max) * 100}%`, left: "6%", right: "6%",
                    height: 0, borderTop: "2px dashed var(--ink)",
                    opacity: hover === null || hover === i ? 0.85 : 0.3,
                  }} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-1.5 mt-1">
        {groups.map((g, i) => (
          <span key={g.label} className="flex-1 text-center" style={{ fontSize: 10, color: hover === i ? "var(--ink)" : "var(--ink-faint)", fontWeight: hover === i ? 700 : 400 }}>{g.label}</span>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--ink-soft)" }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: "var(--green)", display: "inline-block" }} /> Statted
          </span>
          <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--ink-soft)" }}>
            <span style={{ width: 12, height: 0, borderTop: "2px dashed var(--ink)", display: "inline-block" }} /> Forecast
          </span>
        </div>
        {hover !== null && groups[hover].target > 0 && (
          <span className="text-xs sw-mono" style={{ color: "var(--ink-soft)" }}>
            {fmt(groups[hover].actual)} of {fmt(groups[hover].target)}
            <b style={{ marginLeft: 6, color: groups[hover].actual >= groups[hover].target ? "var(--green)" : "var(--red)" }}>
              {groups[hover].actual >= groups[hover].target ? "+" : ""}{fmt(groups[hover].actual - groups[hover].target)}
            </b>
          </span>
        )}
      </div>
    </div>
  );
}

// A percentage with a short explanation — used for cancellation / rejection.
function RateCard({ label, pct, count, of, colour, hint }) {
  return (
    <div className="rounded-xl p-3.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }} title={hint}>
      <div className="text-xs font-medium uppercase" style={{ color: "var(--ink-faint)", letterSpacing: "0.04em" }}>{label}</div>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="sw-display" style={{ fontSize: 23, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--ink)" }}>{pct.toFixed(1)}%</span>
      </div>
      <div className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>{count} of {of}</div>
      <div className="rounded-full mt-2" style={{ height: 3, background: "var(--surface-alt)" }}>
        <div className="rounded-full" style={{ width: Math.min(100, pct) + "%", height: "100%", background: colour }} />
      </div>
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
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const signIn = async () => {
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Enter a valid email address."); return; }
    if (!password) { setError("Enter your password."); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setBusy(false);
    if (error) {
      setError(error.message.includes("Invalid login")
        ? "Email or password not recognised. If you haven't signed in before, the starting password is Welcome2026."
        : error.message);
    }
  };

  return (
    <div className="sw-root flex items-center justify-center p-6" style={{ minHeight: "100vh" }}>
      <style>{STYLE}</style>
      <div className="sw-rise w-full max-w-sm rounded-2xl p-8" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3 mb-6">
          <Logo height={36} />
          <div>
            <div className="sw-display font-bold text-lg leading-tight">SchThrive WebOS</div>
            <div className="text-xs" style={{ color: "var(--ink-faint)" }}>Order tracking · GBP</div>
          </div>
        </div>

        <label className="sw-label">Work email</label>
        <input className="sw-input sw-focus" type="email" value={email} placeholder="you@btlocalbusiness.co.uk"
          onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && signIn()} />

        <label className="sw-label" style={{ marginTop: 12 }}>Password</label>
        <input className="sw-input sw-focus" type="password" value={password} placeholder="••••••••"
          onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && signIn()} />

        {error && <div className="sw-err">{error}</div>}

        <button onClick={signIn} disabled={busy} className="sw-focus w-full py-3 rounded-full font-semibold text-sm mt-4 flex items-center justify-center gap-2"
          style={{ background: "var(--primary)", color: "#fff", opacity: busy ? 0.7 : 1 }}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <LogIn size={15} />} Sign in
        </button>

        <p className="text-xs text-center mt-4" style={{ color: "var(--ink-faint)" }}>
          First time? Use the password you were given — you'll set your own straight after.
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  SET A NEW PASSWORD  (forced on first sign-in, also available anytime)  */
/* ---------------------------------------------------------------------- */

function ChangePasswordScreen({ forced, onDone, onCancel }) {
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setError("");
    if (pw1.length < 8) { setError("Use at least 8 characters."); return; }
    if (pw1 !== pw2) { setError("The two passwords don't match."); return; }
    if (pw1.toLowerCase() === "welcome2026") { setError("Please choose something other than the starting password."); return; }
    setBusy(true);
    const { error: pwErr } = await supabase.auth.updateUser({ password: pw1 });
    if (pwErr) { setBusy(false); setError(pwErr.message); return; }
    const { data: sess } = await supabase.auth.getSession();
    if (sess?.session?.user) {
      await supabase.from("profiles").update({ must_change_password: false }).eq("id", sess.session.user.id);
    }
    setBusy(false);
    onDone();
  };

  return (
    <div className="sw-root flex items-center justify-center p-6" style={{ minHeight: "100vh" }}>
      <style>{STYLE}</style>
      <div className="sw-rise w-full max-w-sm rounded-2xl p-8" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}><KeyRound size={20} /></div>
          <div>
            <div className="sw-display font-bold text-lg leading-tight">{forced ? "Set your password" : "Change password"}</div>
            <div className="text-xs" style={{ color: "var(--ink-faint)" }}>{forced ? "Pick something only you know" : "Update your sign-in password"}</div>
          </div>
        </div>
        {forced && (
          <p className="text-xs mb-4 mt-3 p-3 rounded-lg" style={{ background: "var(--amber-soft)", color: "var(--ink-soft)" }}>
            You're signed in with the shared starting password. Choose your own now so nobody else can open your account.
          </p>
        )}

        <label className="sw-label" style={{ marginTop: 12 }}>New password</label>
        <input className="sw-input sw-focus" type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} placeholder="At least 8 characters" />

        <label className="sw-label" style={{ marginTop: 12 }}>Confirm password</label>
        <input className="sw-input sw-focus" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()} placeholder="Type it again" />

        {error && <div className="sw-err">{error}</div>}

        <button onClick={save} disabled={busy} className="sw-focus w-full py-3 rounded-full font-semibold text-sm mt-4 flex items-center justify-center gap-2"
          style={{ background: "var(--primary)", color: "#fff", opacity: busy ? 0.7 : 1 }}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />} Save password
        </button>

        {!forced && (
          <button onClick={onCancel} className="sw-focus w-full text-xs font-semibold mt-3" style={{ color: "var(--ink-soft)" }}>Cancel</button>
        )}
        {forced && (
          <button onClick={() => supabase.auth.signOut()} className="sw-focus w-full text-xs font-semibold mt-3" style={{ color: "var(--ink-soft)" }}>Sign out instead</button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  DASHBOARD                                                              */
/* ---------------------------------------------------------------------- */

function DashboardView({ orders, netsuite, forecasts, staff, payPlans, onOpenOrder, flashId, profile, loading, onNewOrder }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [agentFilter, setAgentFilter] = useState("All");
  const [ngpMode, setNgpMode] = useState("hide");  // hide | show | only
  const [dataView, setDataView] = useState("claimed");   // forecast | claimed | statted
  const [productFilter, setProductFilter] = useState("All");
  const [focusFilter, setFocusFilter] = useState("All");   // All | aged | attention
  const [sideCard, setSideCard] = useState("plan");        // which summary card is showing
  const [topView, setTopView] = useState(true);            // headline figures only
  const [showAcq, setShowAcq] = useState(false);           // split the headline cards
  const [campaignOnly, setCampaignOnly] = useState(false); // campaign-sourced deals only
  const [acqOnly, setAcqOnly] = useState(false);           // acquisitions only
  const [sortKey, setSortKey] = useState("last_updated");
  const [sortDir, setSortDir] = useState("desc");
  const role = profile?.role || "agent";
  const isOffice = role === "office";
  const is2ic = role === "2ic";
  // office starts on whole-office; 2ic starts scoped to their own team
  const [scope, setScope] = useState(is2ic ? (profile?.team || "office") : "office");
  const [period, setPeriod] = useState("mtd"); // MTD is the default view
  const canFilterByAgent = isOffice || is2ic;

  // ---- NetSuite cross-reference -------------------------------------
  // Orders get a document_number once matched (LBCR, then Opp ID, CUG,
  // company name). That links through to the NetSuite record, which is
  // where the real status and the NGP/NSOV flags live.
  const nsByDoc = useMemo(() => {
    const m = {};
    (netsuite || []).forEach((n) => { if (n.document_number) m[String(n.document_number)] = n; });
    return m;
  }, [netsuite]);
  const nsFor = useCallback((o) => (o && o.document_number ? nsByDoc[String(o.document_number)] : null), [nsByDoc]);
  // The status config is authoritative if a manager has set it; otherwise
  // fall back to the NGP/NSOV flags that came off the NetSuite sheet.
  const statusCfg = useStatusCfg();
  const flagsFor = useCallback((o) => {
    const n = nsFor(o);
    if (!n) return { ngp: false, nsov: false, ns: null };
    const cfg = n.order_status ? statusCfg[n.order_status] : null;
    return {
      ns: n,
      ngp: cfg ? cfg.count_gp === false : n.count_gp === false,
      nsov: cfg ? cfg.count_sov === false : n.count_sov === false,
    };
  }, [nsFor, statusCfg]);
  const isNGP = useCallback((o) => flagsFor(o).ngp, [flagsFor]);
  const isNSOV = useCallback((o) => flagsFor(o).nsov, [flagsFor]);


  // Period first, then team scope — so every figure below reflects both.
  const inPeriod = useMemo(() => filterByPeriod(orders, period), [orders, period]);

  const scoped = useMemo(() => {
    let rows = inPeriod;
    // Team scope
    if (isOffice && scope !== "office") {
      rows = rows.filter((o) => o.closer_team === scope || o.lead_gen_team === scope);
    }
    // Agent filter — applies to the KPI cards as well as the table, so the
    // headline figures always describe the same slice being looked at.
    if (agentFilter !== "All") {
      rows = rows.filter((o) => o.closer_name === agentFilter || o.lead_gen_name === agentFilter);
    }
    return rows;
  }, [inPeriod, isOffice, scope, agentFilter]);

  // Every agent (closer or lead gen) appearing in the currently-scoped orders —
  // this is how a manager/2IC "sorts the list to agents".
  // Teams as they actually appear in the data, so the picker can't go stale
  // if a team is renamed or added.
  const teamOptions = useMemo(() => {
    const s = new Set();
    (staff || []).forEach((x) => { if (x.team && x.sells !== false) s.add(x.team); });
    (orders || []).forEach((o) => { if (o.closer_team) s.add(o.closer_team); });
    SELLING_TEAMS.forEach((t) => s.add(t));
    return Array.from(s).sort();
  }, [staff, orders]);

  const agentOptions = useMemo(() => {
    // Built before the agent filter is applied, so picking one doesn't
    // leave the dropdown with a single option and no way back.
    let rows = inPeriod;
    if (isOffice && scope !== "office") {
      rows = rows.filter((o) => o.closer_team === scope || o.lead_gen_team === scope);
    }
    const names = new Set();
    rows.forEach((o) => { if (o.closer_name) names.add(o.closer_name); if (o.lead_gen_name) names.add(o.lead_gen_name); });
    return Array.from(names).sort();
  }, [inPeriod, isOffice, scope]);

  // ---- Which dataset the table shows ---------------------------------
  // Claimed = what agents submitted. Statted = what NetSuite booked.
  // Forecast = what they said would land. Normalised to one row shape so
  // the same table, filters and sorting work across all three.
  const viewRows = useMemo(() => {
    const from = periodStart(period);
    const inPeriodDate = (d) => {
      if (!from) return true;
      if (!d) return false;
      return new Date(d).getTime() >= from.getTime();
    };
    const teamScope = isOffice && scope !== "office" ? scope : (is2ic ? profile?.team : null);

    if (dataView === "statted") {
      return (netsuite || [])
        .filter((n) => inPeriodDate(n.order_date ? n.order_date + "T00:00:00" : null))
        .filter((n) => !teamScope || n.closer_team === teamScope || n.referrer_team === teamScope)
        .map((n) => ({
          id: "ns-" + n.document_number,
          kind: "statted",
          company_name: n.company_name,
          closer_name: n.closer_name, closer_team: n.closer_team,
          lead_gen_name: n.referrer_name, lead_gen_team: n.referrer_team,
          product: n.prod_for_gs || n.product_group_2 || "—",
          sov: num(n.contract_value),
          gp: num(n.gp_office),
          closer_share: num(n.closer_gp), lead_gen_share: num(n.referrer_gp),
          status: n.order_status,
          date: n.order_date,
          ageDays: n.order_date ? Math.floor((Date.now() - new Date(n.order_date + "T00:00:00").getTime()) / 86400000) : null,
          needsAction: !!(n.order_status && statusCfg[n.order_status]?.needs_attention),
          campaign: !!(n.campaign_source && String(n.campaign_source).trim()),
          campaignName: n.campaign_source || null,
          isAcq: /acquisition/i.test(String(n.class_name || "")),
          ngp: n.count_gp === false, nsov: n.count_sov === false,
          raw: n,
        }));
    }

    if (dataView === "forecast") {
      return (forecasts || [])
        .filter((f) => inPeriodDate(f.forecast_date || f.forecast_week))
        .filter((f) => !teamScope || f.agent_team === teamScope || f.lead_gen_team === teamScope)
        .map((f) => ({
          id: "fc-" + f.id,
          kind: "forecast",
          company_name: f.business_name,
          closer_name: f.agent_name, closer_team: f.agent_team,
          lead_gen_name: f.lead_gen_name, lead_gen_team: f.lead_gen_team,
          product: f.pillar || "—",
          sov: num(f.sov),
          gp: num(f.gp),
          closer_share: null, lead_gen_share: null,
          status: f.status || "Open",
          date: f.forecast_date || f.forecast_week,
          matched: !!f.matched_at,
          actual_gp: num(f.actual_gp),
          campaign: false, campaignName: null, isAcq: false,
          ngp: false, nsov: false,
          raw: f,
        }));
    }

    // claimed
    return scoped.map((o) => {
      const { ns: n, ngp, nsov } = flagsFor(o);
      return {
        id: o.id,
        kind: "claimed",
        company_name: o.company_name,
        closer_name: o.closer_name, closer_team: o.closer_team,
        lead_gen_name: o.lead_gen_name, lead_gen_team: o.lead_gen_team,
        product: o.item_name_grouped || o.product_group_2 || "—",
        sov: num(o.contract_value),
        gp: num(o.gp_office != null ? o.gp_office : o.sales_agent_gp),
        closer_share: num(o.closer_share), lead_gen_share: num(o.lead_gen_share),
        closer_pct: o.closer_pct, lead_gen_pct: o.lead_gen_pct,
        status: (n && n.order_status) ? n.order_status : o.order_status,
        date: o.last_updated,
        dirty: o.dirty_order === "Yes",
        notStatted: isNotStatted(o),
        ageDays: o.submission_date ? Math.floor((Date.now() - new Date(o.submission_date).getTime()) / 86400000) : null,
        needsAction: !!(n && n.order_status && statusCfg[n.order_status]?.needs_attention),
        campaign: !!(n && n.campaign_source && String(n.campaign_source).trim()),
        campaignName: (n || {}).campaign_source || null,
        isAcq: /acquisition/i.test(String(o.deal_type || "")) || !!(n && /acquisition/i.test(String(n.class_name || ""))),
        ngp, nsov,
        raw: o,
      };
    });
  }, [dataView, scoped, netsuite, forecasts, period, isOffice, is2ic, scope, profile, flagsFor, statusCfg]);

  // Every product tag appearing in the current view, for the slicer.
  // Products are often combined ("Cloud Voice + Broadband"), so the
  // filter matches any order CONTAINING the chosen type.
  const productOptions = useMemo(() => {
    const set = new Set();
    viewRows.forEach((r) => {
      String(r.product || "").split(/\s*\+\s*/).forEach((p) => {
        const t = p.trim();
        if (t && t !== "—") set.add(t);
      });
    });
    return Array.from(set).sort();
  }, [viewRows]);

  const filtered = useMemo(() => {
    const f = viewRows.filter((r) => {
      // NGP deals don't count, so they're out of the way by default —
      // but sometimes chasing them is the job, hence "only".
      if (ngpMode === "hide" && r.ngp) return false;
      if (ngpMode === "only" && !r.ngp) return false;
      const q = query.trim().toLowerCase();
      const raw = r.raw || {};
      const mq = !q
        || (r.company_name || "").toLowerCase().includes(q)
        || String(raw.opp_id || "").toLowerCase().includes(q)
        || String(raw.cug || raw.customer_cug || "").toLowerCase().includes(q);
      const ms = statusFilter === "All"
        || (statusFilter === "__not_statted" ? !!r.notStatted : r.status === statusFilter);
      const ma = agentFilter === "All" || r.closer_name === agentFilter || r.lead_gen_name === agentFilter;
      // Product slicer — matches anything CONTAINING the chosen type
      const mp = productFilter === "All"
        || String(r.product || "").toLowerCase().includes(productFilter.toLowerCase());
      const mf = focusFilter === "All"
        || (focusFilter === "aged" ? (r.ageDays != null && r.ageDays >= 90) : !!r.needsAction);
      const mc = !campaignOnly || !!r.campaign;
      const macq = !acqOnly || !!r.isAcq;
      return mq && ms && ma && mp && mf && mc && macq;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return [...f].sort((a, b) => {
      let av, bv;
      switch (sortKey) {
        case "company": av = a.company_name || ""; bv = b.company_name || ""; break;
        case "agent": av = a.closer_name || ""; bv = b.closer_name || ""; break;
        case "sov": av = a.sov; bv = b.sov; break;
        case "gp": av = a.gp; bv = b.gp; break;
        case "status": av = a.status || ""; bv = b.status || ""; break;
        default: av = a.date || ""; bv = b.date || "";
      }
      if (typeof av === "string") return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
  }, [viewRows, query, statusFilter, agentFilter, productFilter, focusFilter, sortKey, sortDir, ngpMode, campaignOnly, acqOnly]);

  // Statuses actually present — Lilac stages plus whatever NetSuite reports
  const statusOptions = useMemo(() => {
    const set = new Set();
    viewRows.forEach((r) => { if (r.status) set.add(r.status); });
    return Array.from(set).sort();
  }, [viewRows]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "company" || key === "agent" || key === "status" ? "asc" : "desc"); }
  };

  // NetSuite decides what actually counts: NGP is out of GP, NSOV is out of SOV.
  // The product slicer applies to the summary figures too, so the cards
  // always describe the same slice the table is showing.
  const productScoped = useMemo(() => {
    if (productFilter === "All") return scoped;
    const needle = productFilter.toLowerCase();
    return scoped.filter((o) => String(o.item_name_grouped || o.product_group_2 || "").toLowerCase().includes(needle));
  }, [scoped, productFilter]);

  const gpCountable = useMemo(() => productScoped.filter((o) => !isNGP(o)), [productScoped, isNGP]);
  const sovCountable = useMemo(() => productScoped.filter((o) => !isNSOV(o)), [productScoped, isNSOV]);

  const sovTotal = useMemo(() => totalSOV(sovCountable), [sovCountable]);
  // Full claimed (every share added up) and the double-count that has to
  // come off it. Shown on the card so the headline figure is explainable.
  const gpWorking = useMemo(() => {
    let claimed = 0, dc = 0;
    gpCountable.forEach((o) => {
      claimed += num(o.closer_share) + num(o.lead_gen_share);
      dc += num(o.gp_same_team_excess);
      // Any share claimed above the deal's real GP is double-counted
      const over = (num(o.closer_share) + num(o.lead_gen_share)) - num(o.gp_office != null ? o.gp_office : o.sales_agent_gp);
      if (over > 0 && !num(o.gp_same_team_excess)) dc += over;
    });
    return { claimed, dc, net: claimed - dc };
  }, [gpCountable]);

  const gpTotal = useMemo(() => {
    // One agent selected -> THEIR share of each deal, not the whole deal.
    // Showing full deal GP for a single agent would credit them with their
    // colleague's cut too.
    if (agentFilter !== "All") {
      return gpCountable.reduce((s, o) => {
        let v = 0;
        if (o.closer_name === agentFilter) v += num(o.closer_share);
        if (o.lead_gen_name === agentFilter) v += num(o.lead_gen_share);
        return s + v;
      }, 0);
    }
    // Office (whole office) -> single-count office GP.
    // A specific team scope -> that team's docked GP.
    if (isOffice && scope !== "office") return teamGP(gpCountable, scope);
    if (is2ic && profile?.team) return teamGP(gpCountable, profile.team);
    // Whole office: everything claimed, less the double-count.
    return gpWorking.net;
  }, [gpCountable, isOffice, is2ic, scope, profile, agentFilter, gpWorking]);
  const ngpCount = useMemo(() => viewRows.filter((r) => r.ngp).length, [viewRows]);
  const agedCount = useMemo(() => viewRows.filter((r) => r.ageDays != null && r.ageDays >= 90).length, [viewRows]);
  const attentionCount = useMemo(() => viewRows.filter((r) => r.needsAction).length, [viewRows]);
  const nsovCount = useMemo(() => productScoped.filter(isNSOV).length, [productScoped, isNSOV]);
  const activeOrders = useMemo(() => productScoped.filter((o) => {
    const n = nsFor(o);
    const live = (n && n.order_status) || o.order_status || "";
    return !/(closed won|complete|billed|cease|cancel)/i.test(live);
  }).length, [productScoped, nsFor]);
  const dirtyCount = useMemo(() => productScoped.filter((o) => o.dirty_order === "Yes").length, [productScoped]);
  const notStattedCount = useMemo(() => productScoped.filter(isNotStatted).length, [productScoped]);

  // ---- Targets for whoever is in scope --------------------------------
  // An agent is measured against their own plan; a team or the whole
  // office against the sum of everyone's plans in that scope. Then it's
  // pro-rated by working days for the period being viewed.
  const targets = useMemo(() => {
    const planById = {};
    (payPlans || []).forEach((p) => { planById[p.id] = p; });

    let people = (staff || []).filter((s) => s.pay_plan_id && s.sells !== false);
    if (isOffice && scope !== "office") people = people.filter((s) => s.team === scope);
    else if (is2ic && profile?.team) people = people.filter((s) => s.team === profile.team);
    else if (!isOffice && !is2ic) {
      // An agent sees just their own target
      const me = (staff || []).find((s) => s.user_id && profile && s.user_id === profile.id);
      people = me && me.pay_plan_id ? [me] : [];
    }
    if (agentFilter !== "All") people = people.filter((s) => s.full_name === agentFilter);

    const monthly = { gp: 0, cloud: 0, conn: 0, mobile: 0 };
    people.forEach((s) => {
      const p = planById[s.pay_plan_id];
      if (!p || p.active === false) return;
      monthly.gp += num(p.target_gp);
      monthly.cloud += num(p.target_cloud_sov);
      monthly.conn += num(p.target_connectivity_sov);
      monthly.mobile += num(p.target_mobile_sov);
    });

    return {
      people: people.length,
      // pace = what should be done by today; full = the whole period's target
      gp: proRatedTarget(monthly.gp, period),
      cloud: proRatedTarget(monthly.cloud, period),
      conn: proRatedTarget(monthly.conn, period),
      mobile: proRatedTarget(monthly.mobile, period),
      full: {
        gp: fullPeriodTarget(monthly.gp, period),
        cloud: fullPeriodTarget(monthly.cloud, period),
        conn: fullPeriodTarget(monthly.conn, period),
        mobile: fullPeriodTarget(monthly.mobile, period),
      },
      monthly,
    };
  }, [payPlans, staff, isOffice, is2ic, scope, profile, period, agentFilter]);

  // Excludes anything flagged NSOV. Connectivity groups Broadband, BT Net
  // and Security together, which is how the office thinks about it.
  const nsSovCards = useMemo(() => {
    const from = periodStart(period);
    // Scale with whatever is selected: period, team scope and agent.
    const teamScope = isOffice && scope !== "office" ? scope : (is2ic ? profile?.team : null);
    const rows = (netsuite || []).filter((r) => {
      if (r.count_sov === false) return false;
      const cfg = r.order_status ? statusCfg[r.order_status] : null;
      if (cfg && cfg.count_sov === false) return false;
      if (teamScope && r.closer_team !== teamScope && r.referrer_team !== teamScope) return false;
      if (agentFilter !== "All" && r.closer_name !== agentFilter && r.referrer_name !== agentFilter) return false;
      if (productFilter !== "All") {
        const hay = [r.prod_for_gs, r.product_group_2, r.item_name_grouped].join(" ").toLowerCase();
        if (!hay.includes(productFilter.toLowerCase())) return false;
      }
      if (!from) return true;
      return r.order_date && new Date(r.order_date + "T00:00:00").getTime() >= from.getTime();
    });
    const bucket = (r) => {
      const s = [r.prod_for_gs, r.product_group_2, r.item_name_grouped].join(" ").toLowerCase();
      if (/mobile|\bsim\b|airtime|handset/.test(s)) return "mobile";
      if (/cloud|dv4|voice/.test(s)) return "cloud";
      if (/broadband|bt ?net|btnet|security|badr|connectivity|fttp|fttc|ethernet|pstn|line/.test(s)) return "connectivity";
      return "other";
    };
    const totals = { cloud: 0, connectivity: 0, mobile: 0, other: 0, all: 0 };
    rows.forEach((r) => {
      const v = num(r.contract_value);
      totals[bucket(r)] += v;
      totals.all += v;
    });
    return totals;
  }, [netsuite, period, statusCfg, isOffice, is2ic, scope, profile, agentFilter, productFilter]);

  // ---- Campaign and acquisition splits --------------------------------
  // Campaign = the deal came from a named campaign source.
  // ACQ = new business rather than a renewal or upgrade.
  // A campaign deal is anything carrying a value in NetSuite's Campaign
  // Source column. The order's own campaign_source is just the submission
  // route ("Lilac Box"), so it isn't used here.
  const isCampaignRow = useCallback((o) => {
    const n = nsFor(o);
    return !!(n && n.campaign_source && String(n.campaign_source).trim());
  }, [nsFor]);

  const isAcqRow = useCallback((o) => {
    if (/acquisition/i.test(String(o.deal_type || ""))) return true;
    const n = nsFor(o);
    return !!(n && /acquisition/i.test(String(n.class_name || "")));
  }, [nsFor]);

  const splits = useMemo(() => {
    let campaignGp = 0, campaignSov = 0, acqGp = 0, acqSov = 0, totalGp = 0;
    gpCountable.forEach((o) => {
      const gp = num(o.gp_office != null ? o.gp_office : o.sales_agent_gp);
      const sov = num(o.contract_value);
      totalGp += gp;
      if (isCampaignRow(o)) { campaignGp += gp; campaignSov += sov; }
      if (isAcqRow(o)) { acqGp += gp; acqSov += sov; }
    });
    return {
      campaignGp, campaignSov, acqGp, acqSov,
      acqPct: totalGp ? (acqGp / totalGp) * 100 : 0,
      campaignPct: totalGp ? (campaignGp / totalGp) * 100 : 0,
    };
  }, [gpCountable, isCampaignRow, isAcqRow]);

  // ---- Ranked agents: claimed against each person's own target --------
  // Replaces the agent dropdown — the ranking is the selector.
  const agentRanking = useMemo(() => {
    const planById = {};
    (payPlans || []).forEach((p) => { planById[p.id] = p; });

    // Who's in scope: the team being viewed, or the whole office
    const teamScope = isOffice && scope !== "office" ? scope : (is2ic ? profile?.team : null);
    const people = (staff || []).filter((s) => {
      if (s.sells === false || s.active === false) return false;
      if (teamScope) return s.team === teamScope;
      return !!s.team;
    });

    // Claimed GP per person, using their own share of each deal, split by
    // product so each row can show what their GP is actually made of.
    const claimed = {};
    const mix = {};
    const bucketOf = (o) => {
      const s = String(o.item_name_grouped || o.product_group_2 || "").toLowerCase();
      if (/mobile|\bsim\b|airtime|handset/.test(s)) return "Mobile";
      if (/cloud|dv4|voice/.test(s)) return "Cloud";
      if (/broadband|bt ?net|btnet|security|badr|fttp|fttc|ethernet|pstn|line|wi-?fi/.test(s)) return "Connectivity";
      return "Other";
    };
    const add = (nm, v, b) => {
      if (!nm || !v) return;
      claimed[nm] = (claimed[nm] || 0) + v;
      if (!mix[nm]) mix[nm] = {};
      mix[nm][b] = (mix[nm][b] || 0) + v;
    };
    gpCountable.forEach((o) => {
      const b = bucketOf(o);
      add(o.closer_name, num(o.closer_share), b);
      add(o.lead_gen_name, num(o.lead_gen_share), b);
    });

    const rows = people.map((s) => {
      const plan = s.pay_plan_id ? planById[s.pay_plan_id] : null;
      const monthly = plan && plan.active !== false ? num(plan.target_gp) : 0;
      return {
        name: s.full_name,
        team: s.team,
        gp: claimed[s.full_name] || 0,
        mix: mix[s.full_name] || {},
        target: fullPeriodTarget(monthly, period),
        pace: proRatedTarget(monthly, period),
      };
    });

    // Anyone with figures who isn't on the staff list still deserves a row
    Object.keys(claimed).forEach((nm) => {
      if (!rows.some((r) => r.name === nm)) {
        if (teamScope) return;
        rows.push({ name: nm, team: null, gp: claimed[nm], mix: mix[nm] || {}, target: 0, pace: 0 });
      }
    });

    // Everyone shows, including those on nothing — that's the point of a
    // ranking. Zero-GP people sort to the bottom, alphabetically.
    return rows.sort((a, b) => (b.gp - a.gp) || a.name.localeCompare(b.name));
  }, [staff, payPlans, gpCountable, isOffice, is2ic, scope, profile, period]);

  // ---- Pay plan measured against what NetSuite actually statted -------
  // The KPI cards use claimed GP; this asks the harder question — has the
  // work landed against what the plan expects by now?
  const planVsStatted = useMemo(() => {
    const from = periodStart(period);
    const teamScope = isOffice && scope !== "office" ? scope : (is2ic ? profile?.team : null);
    let gp = 0, cloud = 0, conn = 0, mobile = 0;

    (netsuite || []).forEach((n) => {
      if (from && (!n.order_date || new Date(n.order_date + "T00:00:00") < from)) return;
      if (teamScope && n.closer_team !== teamScope && n.referrer_team !== teamScope) return;
      if (agentFilter !== "All" && n.closer_name !== agentFilter && n.referrer_name !== agentFilter) return;

      const cfg = n.order_status ? statusCfg[n.order_status] : null;
      const countsGp = cfg ? cfg.count_gp !== false : n.count_gp !== false;
      const countsSov = cfg ? cfg.count_sov !== false : n.count_sov !== false;

      if (countsGp) {
        // An individual is credited with their own share
        if (agentFilter !== "All") {
          if (n.closer_name === agentFilter) gp += num(n.closer_gp);
          if (n.referrer_name === agentFilter) gp += num(n.referrer_gp);
        } else {
          gp += num(n.gp_office);
        }
      }
      if (countsSov) {
        const s = [n.prod_for_gs, n.product_group_2, n.item_name_grouped].join(" ").toLowerCase();
        const v = num(n.contract_value);
        if (/mobile|\bsim\b|airtime|handset/.test(s)) mobile += v;
        else if (/cloud|dv4|voice/.test(s)) cloud += v;
        else if (/broadband|bt ?net|btnet|security|badr|fttp|fttc|ethernet|pstn|line/.test(s)) conn += v;
      }
    });

    return { gp, cloud, conn, mobile };
  }, [netsuite, period, statusCfg, isOffice, is2ic, scope, profile, agentFilter]);

  // ---- Month-on-month, rates and top deals ---------------------------
  // These look at the last six months rather than the period toggle —
  // the point is the trend, which one month can't show.
  const analytics = useMemo(() => {
    const teamScope = isOffice && scope !== "office" ? scope : (is2ic ? profile?.team : null);
    const monthKeys = [];
    const base = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      monthKeys.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("en-GB", { month: "short" }),
      });
    }
    const idx = {};
    monthKeys.forEach((m, i) => { idx[m.key] = i; });
    const monthOf = (dstr) => {
      if (!dstr) return null;
      const d = new Date(dstr);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    };

    const inScope = (closerTeam, refTeam, closerName, refName) => {
      if (teamScope && closerTeam !== teamScope && refTeam !== teamScope) return false;
      if (agentFilter !== "All" && closerName !== agentFilter && refName !== agentFilter) return false;
      return true;
    };

    const claimedGp = new Array(6).fill(0);
    const stattedGp = new Array(6).fill(0);
    const forecastGp = new Array(6).fill(0);

    (orders || []).forEach((o) => {
      if (o.removed_at) return;
      if (!inScope(o.closer_team, o.lead_gen_team, o.closer_name, o.lead_gen_name)) return;
      const i = idx[monthOf(o.submission_date)];
      if (i === undefined) return;
      claimedGp[i] += num(o.gp_office != null ? o.gp_office : o.sales_agent_gp);
    });

    let cancelled = 0, nsTotal = 0, ngpCountAll = 0;
    (netsuite || []).forEach((n) => {
      if (!inScope(n.closer_team, n.referrer_team, n.closer_name, n.referrer_name)) return;
      const i = idx[monthOf(n.order_date ? n.order_date + "T00:00:00" : null)];
      if (i !== undefined && n.count_gp !== false) stattedGp[i] += num(n.gp_office);
      nsTotal += 1;
      if (/cease|cancel|lost|reject/i.test(String(n.order_status || ""))) cancelled += 1;
      if (n.count_gp === false) ngpCountAll += 1;
    });

    (forecasts || []).forEach((f) => {
      if (!inScope(f.agent_team, f.lead_gen_team, f.agent_name, f.lead_gen_name)) return;
      const i = idx[monthOf(f.forecast_date || f.forecast_week)];
      if (i === undefined) return;
      forecastGp[i] += num(f.gp);
    });

    // Top deals in the period on screen
    const top = [...productScoped]
      .map((o) => ({
        company: o.company_name,
        agent: o.closer_name,
        sov: num(o.contract_value),
        gp: num(o.gp_office != null ? o.gp_office : o.sales_agent_gp),
      }))
      .sort((a, b) => b.gp - a.gp)
      .slice(0, 5);

    // Forecast accuracy across the six months
    const fcTotal = forecastGp.reduce((s, v) => s + v, 0);
    const stTotal = stattedGp.reduce((s, v) => s + v, 0);

    return {
      months: monthKeys.map((m) => m.label),
      claimedGp, stattedGp, forecastGp, top,
      cancelled, nsTotal, ngpCountAll,
      cancelRate: nsTotal ? (cancelled / nsTotal) * 100 : 0,
      rejectRate: nsTotal ? (ngpCountAll / nsTotal) * 100 : 0,
      accuracy: fcTotal ? (stTotal / fcTotal) * 100 : 0,
      avgDeal: productScoped.length ? productScoped.reduce((s, o) => s + num(o.gp_office != null ? o.gp_office : o.sales_agent_gp), 0) / productScoped.length : 0,
    };
  }, [orders, netsuite, forecasts, productScoped, isOffice, is2ic, scope, profile, agentFilter]);

  const gpLabel = agentFilter !== "All"
    ? `GP · ${agentFilter.split(" ")[0]}`
    : isOffice && scope !== "office" ? `GP · ${scope}`
    : is2ic && profile?.team ? `GP · ${profile.team}`
    : "GP · Office";
  const periodLabel = useMemo(() => {
    const s = periodStart(period);
    if (!s) return "all time";
    return `since ${s.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: period === "ytd" ? "numeric" : undefined })}`;
  }, [period]);

  const SIDE_CARDS = [
    { key: "plan", label: "Pay plan" },
    { key: "rates", label: "Quality" },
    { key: "deal", label: "Avg deal" },
    { key: "accuracy", label: "Accuracy" },
  ];

  return (
    <div>
      {/* Top view strips it back to the two numbers that matter most */}
      <div className="flex items-center justify-end gap-2 mb-2">
        <button onClick={() => setShowAcq((v) => !v)}
          title="Show acquisition alongside the headline figures"
          className="sw-focus px-2.5 py-1 rounded-lg text-xs"
          style={showAcq
            ? { background: "var(--primary)", color: "#fff", fontWeight: 600 }
            : { background: "var(--surface)", color: "var(--ink-faint)", border: "1px solid var(--border)" }}>
          ACQ split
        </button>
        <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {[[false, "Full"], [true, "Top view"]].map(([v, lbl]) => (
            <button key={String(v)} onClick={() => setTopView(v)}
              className="sw-focus px-2.5 py-1 text-xs"
              style={topView === v
                ? { background: "var(--surface-alt)", color: "var(--ink)", fontWeight: 600 }
                : { background: "transparent", color: "var(--ink-faint)" }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {topView ? (
        /* Just GP and SOV, given room to breathe */
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }} className="mb-3">
          {[
            { label: gpLabel, value: fmtGBP(gpTotal), target: targets.gp, fullTarget: targets.full.gp, raw: gpTotal,
              acq: { value: fmtGBP(splits.acqGp), pct: splits.acqPct }, acqLabel: "ACQ GP",
              note: gpWorking.dc > 0 ? `${fmtGBP(gpWorking.claimed)} claimed − ${fmtGBP(gpWorking.dc)} DC` : "Single-counted GP" },
            { label: "SOV", value: fmtGBP(sovTotal), target: null, raw: 0,
              acq: { value: fmtGBP(splits.acqSov), pct: sovTotal ? (splits.acqSov / sovTotal) * 100 : 0 }, acqLabel: "ACQ SOV",
              note: `${productScoped.length} order${productScoped.length === 1 ? "" : "s"} · ${periodLabelFor(period)}` },
          ].map((c) => {
            const tone = c.target ? paceTone(c.raw, c.target) : null;
            const denom = c.fullTarget || c.target;
            const pct = denom ? Math.round((c.raw / denom) * 100) : 0;
            const pacePct = denom && c.target ? Math.min(100, (c.target / denom) * 100) : 0;
            return (
              <div key={c.label} className="rounded-xl px-6 py-7" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-xs font-medium uppercase" style={{ color: "var(--ink-faint)", letterSpacing: "0.05em" }}>{c.label}</span>
                  {showAcq && c.acq && (
                    <div className="text-right shrink-0">
                      <div className="sw-mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-soft)" }}>{c.acq.value}</div>
                      <div style={{ fontSize: 10, color: "var(--ink-faint)" }}>{c.acqLabel} · {c.acq.pct.toFixed(0)}%</div>
                    </div>
                  )}
                </div>
                <div className="sw-display" style={{ fontSize: 46, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.05, marginTop: 10 }}>
                  {c.value}
                </div>
                {tone && (
                  <div className="rounded-full mt-4" style={{ height: 6, background: "var(--surface-alt)", position: "relative" }}>
                    <div className="rounded-full" style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: tone.fg, transition: "width .3s" }} />
                    {pacePct > 0 && pacePct <= 100 && (
                      <div title={`On pace today: ${fmtGBP(c.target)}`}
                        style={{ position: "absolute", left: `calc(${pacePct}% - 1px)`, top: -3, bottom: -3, width: 2, background: "var(--ink)", borderRadius: 1 }} />
                    )}
                  </div>
                )}
                <div className="text-xs mt-2" style={{ color: "var(--ink-faint)" }}>{c.note}</div>
              </div>
            );
          })}
        </div>
      ) : (
      /* Headline row */
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) minmax(0,1.1fr) minmax(260px,1.15fr)", gap: "0.75rem" }} className="mb-3">

        <div>
          <HeroCard label={gpLabel} value={fmtGBP(gpTotal)} accent="#1F7A3D"
            target={targets.gp} fullTarget={targets.full.gp} rawValue={gpTotal}
            acq={showAcq ? { value: fmtGBP(splits.acqGp), pct: splits.acqPct } : null} acqLabel="ACQ GP"
            note={gpWorking.dc > 0 ? `${fmtGBP(gpWorking.claimed)} claimed − ${fmtGBP(gpWorking.dc)} DC` : "Single-counted"} />
          <CampaignBar label="Campaign GP" value={splits.campaignGp} pct={splits.campaignPct} />
        </div>

        <div>
          <HeroCard label="SOV" value={fmtGBP(sovTotal)} accent="#4C1D8F"
            acq={showAcq ? { value: fmtGBP(splits.acqSov), pct: sovTotal ? (splits.acqSov / sovTotal) * 100 : 0 } : null} acqLabel="ACQ SOV"
            note={`${productScoped.length} order${productScoped.length === 1 ? "" : "s"}`} />
          <CampaignBar label="Campaign SOV" value={splits.campaignSov} pct={sovTotal ? (splits.campaignSov / sovTotal) * 100 : 0} />
        </div>

        <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-baseline justify-between mb-2.5">
            <span className="text-xs font-medium uppercase" style={{ color: "var(--ink-faint)", letterSpacing: "0.04em" }}>SOV by product</span>
            <span className="text-xs" style={{ color: "var(--ink-faint)" }}>NetSuite</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem 1.25rem" }}>
            <MiniStat label="Cloud" value={nsSovCards.cloud} target={targets.cloud} fullTarget={targets.full.cloud} />
            <MiniStat label="Connectivity" value={nsSovCards.connectivity} target={targets.conn} fullTarget={targets.full.conn} />
            <MiniStat label="Mobile" value={nsSovCards.mobile} target={targets.mobile} fullTarget={targets.full.mobile} />
            <MiniStat label="Total" value={nsSovCards.all} bold />
          </div>
        </div>

        {/* One switchable card rather than four competing ones */}
        <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-1 mb-2.5 flex-wrap">
            {SIDE_CARDS.map((c) => (
              <button key={c.key} onClick={() => setSideCard(c.key)}
                className="sw-focus text-xs px-2 py-0.5 rounded"
                style={sideCard === c.key
                  ? { background: "var(--primary-soft)", color: "var(--primary)", fontWeight: 600 }
                  : { color: "var(--ink-faint)" }}>
                {c.label}
              </button>
            ))}
          </div>

          {sideCard === "plan" && (
            targets.people > 0 ? (
              <div className="flex flex-col gap-1.5">
                {[
                  ["GP", planVsStatted.gp, targets.full.gp, targets.gp],
                  ["Cloud", planVsStatted.cloud, targets.full.cloud, targets.cloud],
                  ["Connectivity", planVsStatted.conn, targets.full.conn, targets.conn],
                  ["Mobile", planVsStatted.mobile, targets.full.mobile, targets.mobile],
                ].map(([label, actual, full, pace]) => {
                  const tone = paceTone(actual, pace);
                  const pct = full > 0 ? Math.round((actual / full) * 100) : 0;
                  const pacePct = full > 0 ? Math.min(100, (pace / full) * 100) : 0;
                  return (
                    <div key={label}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs" style={{ color: "var(--ink-faint)" }}>{label}</span>
                        <span className="sw-mono text-xs" style={{ color: "var(--ink-faint)" }}>
                          <b style={{ color: tone ? tone.fg : "var(--ink)" }}>{fmtGBP(actual)}</b>
                          {full > 0 ? ` / ${fmtGBP(full)}` : ""}
                        </span>
                      </div>
                      <div className="rounded-full mt-1" style={{ height: 4, background: "var(--surface-alt)", position: "relative" }}>
                        <div className="rounded-full" style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: tone ? tone.fg : "var(--ink-faint)" }} />
                        {pacePct > 0 && pacePct < 100 && (
                          <div style={{ position: "absolute", left: `${pacePct}%`, top: -1, bottom: -1, width: 2, background: "var(--ink)", opacity: 0.4 }} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs py-4 text-center" style={{ color: "var(--ink-faint)" }}>No pay plan set for this view.</div>
            )
          )}

          {sideCard === "rates" && (
            <div className="flex flex-col gap-3">
              {[
                ["Cancellation", analytics.cancelRate, analytics.cancelled, "NetSuite orders ceased, cancelled or lost"],
                ["Rejection", analytics.rejectRate, analytics.ngpCountAll, "Statted but flagged NGP"],
              ].map(([label, pct, count, hint]) => {
                const colour = pct > 15 ? "var(--red)" : pct > 8 ? "var(--amber)" : "var(--green)";
                return (
                  <div key={label} title={hint}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs" style={{ color: "var(--ink-faint)" }}>{label}</span>
                      <span className="sw-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{pct.toFixed(1)}%</span>
                    </div>
                    <div className="rounded-full mt-1" style={{ height: 4, background: "var(--surface-alt)" }}>
                      <div className="rounded-full" style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: colour }} />
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>{count} of {analytics.nsTotal}</div>
                  </div>
                );
              })}
            </div>
          )}

          {sideCard === "deal" && (
            <div>
              <div className="sw-display" style={{ fontSize: 27, fontWeight: 600, letterSpacing: "-0.025em" }}>{fmtGBP(analytics.avgDeal)}</div>
              <div className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>Average GP per order, {periodLabelFor(period).toLowerCase()}</div>
            </div>
          )}

          {sideCard === "accuracy" && (
            <div>
              <div className="sw-display" style={{ fontSize: 27, fontWeight: 600, letterSpacing: "-0.025em",
                color: analytics.accuracy >= 90 ? "var(--green)" : analytics.accuracy >= 70 ? "var(--amber)" : "var(--red)" }}>
                {analytics.accuracy.toFixed(0)}%
              </div>
              <div className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>Statted against forecast, last six months</div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Health */}
      <div className="flex items-center gap-5 flex-wrap mb-4 px-1">
        <HealthItem label="active" value={activeOrders} colour="var(--blue)" hint="Not yet complete" />
        <HealthItem label="not statted" value={notStattedCount} colour="var(--amber)" hint="No NetSuite match after 12h" />
        <HealthItem label="dirty" value={dirtyCount} colour="var(--red)" hint="Flagged for review" />
        {ngpCount > 0 && <HealthItem label="NGP" value={ngpCount} colour="var(--red)" hint="Excluded from GP" />}
        {nsovCount > 0 && <HealthItem label="NSOV" value={nsovCount} colour="var(--amber)" hint="Excluded from SOV" />}
        <button onClick={onNewOrder}
          className="sw-focus ml-auto px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5"
          style={{ background: "var(--primary)" }}>
          <Plus size={13} /> Submit a Lilac Box
        </button>
      </div>

      {/* Ranked team on the left, orders on the right */}
      <div style={{ display: "grid", gridTemplateColumns: "300px minmax(0, 1fr)", gap: "0.75rem", alignItems: "start" }}>

        {/* LEFT */}
        <div style={{ position: "sticky", top: 12, maxHeight: "calc(100vh - 24px)", overflowY: "auto" }} className="flex flex-col gap-3 pr-0.5">

          {/* The ranking is the agent picker */}
          <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-baseline justify-between mb-3">
              <span className="text-xs font-medium uppercase" style={{ color: "var(--ink-faint)", letterSpacing: "0.04em" }}>
                {isOffice && scope !== "office" ? scope : is2ic && profile?.team ? profile.team : "Office"}
              </span>
              {agentFilter !== "All" && (
                <button onClick={() => setAgentFilter("All")} className="sw-focus text-xs" style={{ color: "var(--primary)" }}>Clear</button>
              )}
            </div>
            {agentRanking.length === 0 ? (
              <div className="text-xs text-center py-6" style={{ color: "var(--ink-faint)" }}>No figures for this period.</div>
            ) : (
              <div style={{ maxHeight: "calc(100vh - 190px)", overflowY: "auto" }}>
                {agentRanking.map((a, i) => {
                  // Traffic light comes from the pay plan pace, exactly as the
                  // KPI cards do — so a name reads the same everywhere.
                  const tone = paceTone(a.gp, a.pace);
                  const dot = tone ? tone.fg : "var(--ink-faint)";
                  const sel = agentFilter === a.name;
                  const total = Object.keys(a.mix).reduce((s, k) => s + a.mix[k], 0);
                  const segs = MIX_ORDER
                    .map((k) => ({ k, v: a.mix[k] || 0 }))
                    .filter((s) => s.v > 0);
                  return (
                    <button key={a.name} onClick={() => setAgentFilter(sel ? "All" : a.name)}
                      className="sw-focus w-full text-left px-2 py-1.5"
                      style={{
                        background: sel ? "var(--primary-soft)" : "transparent",
                        borderTop: i === 0 ? "none" : "1px solid var(--border)",
                      }}
                      title={a.target > 0
                        ? `${fmtGBP(a.gp)} of ${fmtGBP(a.target)} — pace ${fmtGBP(a.pace)}`
                        : fmtGBP(a.gp)}>
                      <div className="flex items-center gap-1.5">
                        <span title={tone ? `${Math.round((a.gp / (a.pace || 1)) * 100)}% of pace` : "No pay plan"}
                          style={{ width: 6, height: 6, borderRadius: 99, background: dot, flexShrink: 0 }} />
                        {scope === "office" && !is2ic && <TeamTag team={a.team} allTeams={teamOptions} />}
                        <span className="truncate" style={{ fontSize: 12, color: sel ? "var(--primary)" : "var(--ink)", fontWeight: sel ? 600 : 500 }}>
                          {a.name}
                        </span>
                        <span className="sw-mono ml-auto shrink-0" style={{ fontSize: 12, fontWeight: 600, color: a.gp ? "var(--ink)" : "var(--ink-faint)" }}>
                          {fmtGBP(a.gp)}
                        </span>
                      </div>
                      {/* What their GP is made of */}
                      <div className="flex mt-1 rounded-full overflow-hidden" style={{ height: 4, background: "var(--surface-alt)" }}>
                        {segs.map((s) => (
                          <div key={s.k} title={`${s.k} ${fmtGBP(s.v)}`}
                            style={{ width: `${(s.v / total) * 100}%`, background: MIX_COLOURS[s.k] }} />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* RIGHT — filters and the order list */}
        <div>
      {/* Filters — one row, consistent control heights */}
      <div className="mb-3 flex items-center gap-1.5 flex-wrap">

        {/* What we're looking at */}
        <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {[["forecast", "Forecast"], ["claimed", "Claimed"], ["statted", "Statted"]].map(([k, lbl]) => (
            <button key={k} onClick={() => { setDataView(k); setStatusFilter("All"); setProductFilter("All"); setFocusFilter("All"); }}
              className="sw-focus px-3 py-2 text-xs"
              style={dataView === k
                ? { background: "var(--primary)", color: "#fff", fontWeight: 600 }
                : { background: "transparent", color: "var(--ink-faint)" }}>
              {lbl}
            </button>
          ))}
        </div>

        {/* Period */}
        <select className="sw-input sw-focus" style={{ width: 108 }} value={period} onChange={(e) => setPeriod(e.target.value)} title={periodLabel}>
          {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>

        {/* Team scope */}
        {isOffice && (
          <select className="sw-input sw-focus" style={{ width: 150 }} value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="office">Whole Office</option>
            {teamOptions.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        {is2ic && (
          <span className="px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
            {profile?.team || "My team"}
          </span>
        )}

        {/* Search */}
        <div className="relative" style={{ flex: 1, minWidth: 170 }}>
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-faint)" }} />
          <input className="sw-input sw-focus" style={{ paddingLeft: 32 }} placeholder="Search company..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>


        <select className="sw-input sw-focus" style={{ width: 150 }} value={productFilter} onChange={(e) => setProductFilter(e.target.value)}>
          <option value="All">All products</option>
          {productOptions.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        <select className="sw-input sw-focus" style={{ width: 155 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="All">All statuses</option>
          {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          {dataView === "claimed" && <option value="__not_statted">⚠ Not Statted</option>}
        </select>

        {/* Exceptions — everything that narrows the list to a problem set */}
        <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {[
            ["hide", "Hide NGP", null, "NGP orders don't count toward GP"],
            ["show", "Show NGP", null, "Include NGP orders in the list"],
            ["only", "Only NGP", ngpCount, "Just the NGP orders"],
          ].map(([k, lbl, n, hint]) => (
            <button key={k} onClick={() => { setNgpMode(k); setFocusFilter("All"); }} title={hint}
              className="sw-focus px-2.5 py-2 text-xs whitespace-nowrap"
              style={ngpMode === k && focusFilter === "All"
                ? { background: k === "only" ? "var(--red)" : "var(--surface-alt)", color: k === "only" ? "#fff" : "var(--ink)", fontWeight: 600 }
                : { background: "transparent", color: "var(--ink-faint)" }}>
              {lbl}{n ? ` (${n})` : ""}
            </button>
          ))}
          <span style={{ width: 1, alignSelf: "stretch", background: "var(--border)" }} />
          <button onClick={() => setFocusFilter(focusFilter === "attention" ? "All" : "attention")}
            title="Orders at a status that needs the agent to act"
            className="sw-focus px-2.5 py-2 text-xs whitespace-nowrap"
            style={focusFilter === "attention"
              ? { background: "var(--amber)", color: "#fff", fontWeight: 600 }
              : { background: "transparent", color: attentionCount ? "var(--amber)" : "var(--ink-faint)" }}>
            Needs action{attentionCount ? ` (${attentionCount})` : ""}
          </button>
          <button onClick={() => setFocusFilter(focusFilter === "aged" ? "All" : "aged")}
            title="Submitted more than 90 days ago"
            className="sw-focus px-2.5 py-2 text-xs whitespace-nowrap"
            style={focusFilter === "aged"
              ? { background: "var(--red)", color: "#fff", fontWeight: 600 }
              : { background: "transparent", color: agedCount ? "var(--red)" : "var(--ink-faint)" }}>
            90+ days{agedCount ? ` (${agedCount})` : ""}
          </button>
        </div>

        {/* Campaign and acquisition slices */}
        <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <button onClick={() => setCampaignOnly((v) => !v)} title="Only deals from a named campaign"
            className="sw-focus px-2.5 py-2 text-xs whitespace-nowrap"
            style={campaignOnly
              ? { background: "var(--primary)", color: "#fff", fontWeight: 600 }
              : { background: "transparent", color: "var(--ink-faint)" }}>
            🎯 Campaign
          </button>
          <span style={{ width: 1, alignSelf: "stretch", background: "var(--border)" }} />
          <button onClick={() => setAcqOnly((v) => !v)} title="Only acquisitions — new business"
            className="sw-focus px-2.5 py-2 text-xs whitespace-nowrap"
            style={acqOnly
              ? { background: "var(--primary)", color: "#fff", fontWeight: 600 }
              : { background: "transparent", color: "var(--ink-faint)" }}>
            ACQ
          </button>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div>
          <table className="w-full text-sm" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "24%" }} />
              <col style={{ width: "17%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "8%" }} />
            </colgroup>
            <thead>
              <tr style={{ background: "var(--surface-alt)" }}>
                {[
                  { label: "Company", key: "company" },
                  { label: "People", key: "agent" },
                  { label: "Product", key: null },
                  { label: "SOV", key: "sov" },
                  { label: "GP", key: "gp" },
                  { label: "Status", key: "status" },
                  { label: dataView === "forecast" ? "Expected" : "Date", key: "date" },
                ].map(({ label, key }) => (
                  <th
                    key={label}
                    onClick={key ? () => toggleSort(key) : undefined}
                    className={`text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide ${key ? "cursor-pointer select-none" : ""}`}
                    style={{ color: "var(--ink-soft)" }}
                  >
                    {label}{key && sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} onClick={() => r.kind === "claimed" && onOpenOrder(r.raw)}
                  className={`transition-colors ${flashId === r.id ? "sw-flash" : ""} ${r.kind === "claimed" ? "cursor-pointer" : ""}`}
                  style={{ borderTop: "1px solid var(--border)", background: r.ngp ? "var(--red-soft)" : "transparent" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-alt)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = r.ngp ? "var(--red-soft)" : "transparent")}>

                  {/* 1: company, with flags kept inline so the row stays short */}
                  <td className="px-3 py-2" style={{ overflow: "hidden" }}>
                    <div className="font-medium text-xs sw-clamp2" style={{ lineHeight: 1.3 }}>
                      {r.campaign && <span title={`Campaign: ${r.campaignName}`} style={{ marginRight: 4 }}>🎯</span>}
                      {r.company_name}
                    </div>
                    {(r.dirty || r.notStatted || r.nsov || r.needsAction || (r.ageDays != null && r.ageDays >= 90) || (r.kind === "forecast" && r.matched)) && (
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {r.dirty && <span className="text-xs font-semibold" style={{ color: "var(--red)", fontSize: 10 }}>DIRTY</span>}
                        {r.notStatted && <span className="text-xs font-semibold" style={{ color: "var(--amber)", fontSize: 10 }}>NOT STATTED</span>}
                        {r.ageDays != null && r.ageDays >= 90 && <span className="text-xs font-semibold" style={{ color: "var(--red)", fontSize: 10 }}>{r.ageDays}d OLD</span>}
                        {r.needsAction && <span className="text-xs font-semibold" style={{ color: "var(--amber)", fontSize: 10 }}>NEEDS ACTION</span>}
                        {r.nsov && <span className="text-xs font-semibold" style={{ color: "var(--amber)", fontSize: 10 }}>NSOV</span>}
                        {r.kind === "forecast" && r.matched && <span className="text-xs font-semibold" style={{ color: "var(--green)", fontSize: 10 }}>LANDED {fmtGBP(r.actual_gp)}</span>}
                      </div>
                    )}
                  </td>

                  {/* 2: people */}
                  <td className="px-3 py-2" style={{ overflow: "hidden" }}>
                    <div className="flex items-center gap-1.5">
                      <TeamTag team={r.closer_team} allTeams={teamOptions} />
                      <span className="text-xs sw-clamp2" style={{ lineHeight: 1.3 }}>{r.closer_name || "—"}</span>
                    </div>
                    {r.lead_gen_name && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <TeamTag team={r.lead_gen_team} allTeams={teamOptions} />
                        <span className="sw-clamp2" style={{ color: "var(--ink-faint)", fontSize: 10, lineHeight: 1.3 }}>{r.lead_gen_name}</span>
                      </div>
                    )}
                  </td>

                  <td className="px-3 py-2 text-xs sw-clamp2" style={{ color: "var(--ink-soft)", lineHeight: 1.3 }}>{r.product}</td>

                  <td className="px-3 py-2 sw-mono text-xs">{fmtGBP(r.sov)}</td>

                  {/* 3: GP with the split underneath */}
                  <td className="px-3 py-2">
                    <div className="sw-mono text-xs font-semibold">{fmtGBP(r.gp)}</div>
                    {r.closer_share != null && r.closer_share > 0 && (
                      <div style={{ color: "var(--ink-faint)", fontSize: 10 }} className="sw-mono">
                        {fmtGBP(r.closer_share)}{r.lead_gen_name && r.lead_gen_share ? ` / ${fmtGBP(r.lead_gen_share)}` : ""}
                      </div>
                    )}
                  </td>

                  {/* Compact status — pill only, no extra lines */}
                  <td className="px-3 py-2">
                    {(() => {
                      const tone = statusTone(r.status, r.ngp, statusCfg);
                      return (
                        <span className="inline-block rounded px-1.5 py-0.5 sw-clamp2"
                          style={{ color: tone.fg, background: tone.bg, fontSize: 10.5, fontWeight: 600, lineHeight: 1.3 }}
                          title={r.status}>
                          {r.status || "—"}
                        </span>
                      );
                    })()}
                  </td>

                  <td className="px-2 py-2 text-xs" style={{ color: "var(--ink-faint)", fontSize: 11, lineHeight: 1.3 }}>{r.date ? fmtDate(r.date) : "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center" style={{ color: "var(--ink-faint)" }}>
                  {loading ? "Loading..." :
                    dataView === "forecast" ? "No forecasts for this period." :
                    dataView === "statted" ? "No NetSuite orders for this period." :
                    "No orders to show yet. Submit one from Submit Lilac Box to see it here."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-1.5 px-4 py-2.5 text-xs" style={{ color: "var(--ink-faint)", borderTop: "1px solid var(--border)" }}><RefreshCw size={11} /> Live — updates as orders change</div>
      </div>

        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  ORDER DETAIL DRAWER                                                    */
/* ---------------------------------------------------------------------- */

function OrderDrawer({ order, ns, onClose, canEdit, onSave, saving, onRemove }) {
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

  const MATCH_LABEL = {
    lbcr: "Matched by Lilac ref (exact)",
    opp_id: "Matched by Opp ID (likely)",
    cug: "Matched by CUG (likely)",
    company_name: "Matched by company name (unconfirmed)",
  };
  const rows = [
    ["Lilac Ref", order.lbcr_ref],
    ["NetSuite", order.document_number
      ? `Doc ${order.document_number}${order.match_method ? ` · ${MATCH_LABEL[order.match_method] || order.match_method}` : ""}`
      : isNotStatted(order) ? "Not Statted (12h+)" : "Awaiting match"],
    ["NetSuite Status", ns ? ns.order_status : null],
    ["Counts toward", ns
      ? [ns.count_gp === false ? null : "GP", ns.count_sov === false ? null : "SOV"].filter(Boolean).join(" + ") || "Neither"
      : null],
    ["NetSuite GP", ns && ns.gp_office != null ? fmtGBP(ns.gp_office) : null],
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
        <div className="mb-4">
          <StatusPill
            status={ns && ns.order_status ? ns.order_status : order.order_status}
            ngp={!!ns && ns.count_gp === false}
          />
        </div>

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

        {/* Cross-reference: what NetSuite actually statted vs what was claimed.
            NetSuite GP excludes any NGP line; SOV comes off the Closer line. */}
        {ns && (() => {
          const nsGp = ns.count_gp === false ? 0 : num(ns.gp_office);
          const nsSov = ns.count_sov === false ? 0 : num(ns.contract_value);
          const gpDiff = nsGp - num(order.sales_agent_gp);
          const sovDiff = nsSov - num(order.contract_value);
          const diffStyle = (d) => ({ color: Math.abs(d) < 0.5 ? "var(--green)" : d < 0 ? "var(--red)" : "var(--amber)" });
          const diffText = (d) => (Math.abs(d) < 0.5 ? "Matches" : `${d > 0 ? "+" : ""}${fmtGBP(d)}`);
          return (
            <div className="rounded-xl mb-5 p-4" style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}>
              <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--ink-soft)" }}>
                NetSuite Cross-Reference
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs" style={{ color: "var(--ink-faint)" }}>NetSuite GP</div>
                  <div className="sw-mono font-semibold text-lg">{fmtGBP(nsGp)}</div>
                  <div className="text-xs mt-0.5" style={diffStyle(gpDiff)}>
                    {diffText(gpDiff)} <span style={{ color: "var(--ink-faint)" }}>vs claimed {fmtGBP(order.sales_agent_gp)}</span>
                  </div>
                  {ns.count_gp === false && <div className="text-xs mt-0.5" style={{ color: "var(--red)" }}>Excluded — NGP status</div>}
                </div>
                <div>
                  <div className="text-xs" style={{ color: "var(--ink-faint)" }}>NetSuite SOV</div>
                  <div className="sw-mono font-semibold text-lg">{fmtGBP(nsSov)}</div>
                  <div className="text-xs mt-0.5" style={diffStyle(sovDiff)}>
                    {diffText(sovDiff)} <span style={{ color: "var(--ink-faint)" }}>vs claimed {fmtGBP(order.contract_value)}</span>
                  </div>
                  {ns.count_sov === false && <div className="text-xs mt-0.5" style={{ color: "var(--amber)" }}>Excluded — NSOV status</div>}
                </div>
              </div>
            </div>
          );
        })()}

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
      postcode: normalisePostcode(f.sitePostcode),
      deal_type: dealTypes.length ? dealTypes.join(", ") : null,
      units: f.units ? (parseFloat(f.units) || null) : null,
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
        <Field label="Site Postcode" name="sitePostcode" value={f.sitePostcode} onChange={set} placeholder="e.g. PL1 1AA" />
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

function TVBoard({ orders, netsuite }) {
  const countdown = useCountdownTo5pm();
  const [period, setPeriod] = useState("mtd");

  // The board runs off NetSuite (the statted, authoritative figures),
  // not raw Lilac submissions. Column Y on the NetSuite sheet decides
  // what counts: NGP removes a deal from GP, NSOV removes it from SOV.
  const allNs = netsuite || [];
  const periodFrom = periodStart(period);
  const inPeriod = useMemo(() => {
    if (!periodFrom) return allNs;
    const t = periodFrom.getTime();
    return allNs.filter((r) => r.order_date && new Date(r.order_date + "T00:00:00").getTime() >= t);
  }, [allNs, periodFrom]);

  const ns = inPeriod;
  const gpRows = ns.filter((r) => r.count_gp !== false);
  const sovRows = ns.filter((r) => r.count_sov !== false);

  const nsDate = (r) => (r.order_date ? new Date(r.order_date + "T00:00:00") : null);
  const daysOldNs = (r) => { const d = nsDate(r); return d ? Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000)) : 9999; };
  const thisWeekNs = (r) => daysOldNs(r) <= 7;
  const todayNs = (r) => daysOldNs(r) === 0;

  const sumGp = (rows) => rows.reduce((s, r) => s + num(r.gp_office), 0);
  const sumSov = (rows) => rows.reduce((s, r) => s + num(r.contract_value), 0);

  const officeGpTotal = sumGp(gpRows);
  const sovPeriod = sumSov(sovRows);

  // Acquisition GP — new business rather than renewals/upgrades.
  // NetSuite puts the deal type in "Class (Item): Name" (column J),
  // which syncs into class_name.
  const acqRows = gpRows.filter((r) => /acquisition/i.test(String(r.class_name || "")));
  const acqGp = sumGp(acqRows);
  const gpToday = sumGp(gpRows.filter(todayNs));

  // Sales by Product Group 2 — bigger box means more GP
  const productBoxes = useMemo(() => {
    const map = {};
    gpRows.forEach((r) => {
      // "Prod for GS" is the reporting grouping NetSuite already maintains
      const key = (r.prod_for_gs || r.product_group_2 || "Unspecified").trim() || "Unspecified";
      map[key] = (map[key] || 0) + num(r.gp_office);
    });
    const items = Object.entries(map)
      .map(([name, value]) => ({ name, value: Number(value) }))
      .filter((i) => i.value > 0)
      .sort((a, b) => b.value - a.value);
    return treemapLayout(items, 0, 0, 100, 100, true);
  }, [gpRows]);
  const productTotal = productBoxes.reduce((s, b) => s + b.value, 0);

  // Team GP: each person's own share, from the NetSuite ledger.
  // The negative Office Doublecount row is already inside gp_office,
  // so team totals stay clean without extra correction here.
  const teamGpFor = (rows, team) => rows.reduce((s, r) => {
    let v = 0;
    if (r.closer_team === team) v += num(r.closer_gp);
    if (r.referrer_team === team) v += num(r.referrer_gp);
    return s + v;
  }, 0);

  const teamRows = SELLING_TEAMS.map((t) => ({
    team: t,
    gp: teamGpFor(gpRows, t),
    gpToday: teamGpFor(gpRows.filter(todayNs), t),
    orders: gpRows.filter((r) => r.closer_team === t || r.referrer_team === t).length,
  })).sort((a, b) => b.gp - a.gp);

  // Agent leaderboard — closer and referrer earnings combined
  const agentMap = {};
  for (const r of gpRows) {
    if (r.closer_name) agentMap[r.closer_name] = (agentMap[r.closer_name] || 0) + num(r.closer_gp);
    if (r.referrer_name) agentMap[r.referrer_name] = (agentMap[r.referrer_name] || 0) + num(r.referrer_gp);
  }
  const leaderboard = Object.entries(agentMap)
    .map(([name, gp]) => ({ name, gp: Number(gp) }))
    .filter((a) => a.gp > 0)
    .sort((a, b) => b.gp - a.gp).slice(0, 12);

  // Order pipeline — NetSuite statuses, the same measure the Claimed page
  // shows, rather than the old Lilac submission stages. Top six by volume
  // so the panel stays readable on a wall.
  const statusCounts = useMemo(() => {
    const m = {};
    ns.forEach((r) => {
      const s = (r.order_status || "Unknown").trim() || "Unknown";
      m[s] = (m[s] || 0) + 1;
    });
    return Object.keys(m)
      .map((status) => ({ status, n: m[status] }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 6);
  }, [ns]);

  // Where we're selling — by postcode area, from the Lilac submissions
  const areaBoxes = useMemo(() => {
    const map = {};
    (orders || []).forEach((o) => {
      if (!o.postcode) return;
      if (periodFrom && o.submission_date && new Date(o.submission_date).getTime() < periodFrom.getTime()) return;
      const area = postcodeArea(o.postcode);
      if (!area) return;
      if (!map[area]) map[area] = { count: 0, gp: 0 };
      map[area].count += 1;
      map[area].gp += num(o.gp_office != null ? o.gp_office : o.sales_agent_gp);
    });
    return Object.keys(map)
      .map((area) => ({ area, count: map[area].count, gp: map[area].gp }))
      .sort((a, b) => b.gp - a.gp);
  }, [orders, periodFrom]);
  const areaMaxGp = areaBoxes.length ? areaBoxes[0].gp : 0;
  const postcodeCoverage = (orders || []).filter((o) => o.postcode).length;

  const excludedGp = ns.filter((r) => r.count_gp === false).length;
  const excludedSov = ns.filter((r) => r.count_sov === false).length;

  const ACCENTS = ["#4C1D8F", "#205EA6", "#1F7A3D"];

  return (
    <div className="sw-root p-4" style={{ minHeight: "100vh" }}>
      <style>{STYLE}</style>
      {/* Slim single-row header: back link, logo, period toggle, countdown */}
      <div className="flex items-center justify-between mb-3 px-1 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <a href="/" className="sw-focus flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-full" style={{ color: "var(--ink-soft)", background: "var(--surface)", border: "1px solid var(--border)" }}>
            <ArrowLeft size={13} /> Dashboard
          </a>
          <Logo height={30} />
          <div>
            <div className="sw-display font-bold text-base leading-none">SchThrive Stats</div>
            <div className="text-xs flex items-center gap-1" style={{ color: "var(--ink-faint)" }}><Radio size={9} className="sw-live-dot" style={{ color: "var(--green)" }} /> Live · GBP</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {PERIODS.filter((p) => p.key !== "all").map((p) => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className="sw-focus px-3 py-1.5 rounded-full text-xs font-bold"
              style={period === p.key
                ? { background: "var(--primary)", color: "#fff" }
                : { background: "var(--surface)", color: "var(--ink-soft)", border: "1px solid var(--border)" }}>
              {p.label}
            </button>
          ))}
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
        <TVStat label={`Office GP · ${periodLabelFor(period)}`} value={fmtGBP(officeGpTotal)} accent="#1F7A3D" />
        <TVStat label={`ACQ GP · ${periodLabelFor(period)}`} value={fmtGBP(acqGp)} accent="#4C1D8F" />
        <TVStat label="GP Today" value={fmtGBP(gpToday)} accent="#205EA6" />
        <TVStat label={`SOV · ${periodLabelFor(period)}`} value={fmtGBP(sovPeriod)} accent="#B3660E" />

        {/* Team vs Team + pipeline — spans columns 1-2 */}
        <div style={{ gridColumn: "span 2", background: "var(--surface)", border: "1px solid var(--border)" }} className="rounded-2xl p-4">
          <div className="sw-display text-sm mb-3" style={{ color: "var(--ink-faint)", fontWeight: 600, letterSpacing: "0.03em" }}>TEAM VS TEAM — GP</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.6rem" }} className="mb-4">
            {teamRows.map((r, i) => (
              <div key={r.team} className="rounded-xl p-3 text-center" style={{ background: "var(--surface-alt)", borderTop: `3px solid ${ACCENTS[i % 3]}` }}>
                <div className="text-xs font-semibold mb-1" style={{ color: "var(--ink-soft)" }}>{r.team}</div>
                <div className="sw-display font-bold text-2xl" style={{ color: ACCENTS[i % 3] }}>{fmtGBP(r.gp)}</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>Today {fmtGBP(r.gpToday)} · {r.orders} orders</div>
              </div>
            ))}
          </div>
          <div className="sw-display font-bold text-sm mb-2" style={{ color: "var(--ink-soft)" }}>ORDER PIPELINE <span style={{ color: "var(--ink-faint)", fontWeight: 400 }}>· NetSuite</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.5rem" }}>
            {statusCounts.map((s) => (
              <div key={s.status} className="rounded-lg p-2 text-center" style={{ background: "var(--surface-alt)" }}>
                <div className="sw-display font-bold text-xl">{s.n}</div>
                <div className="text-xs leading-tight" style={{ color: "var(--ink-soft)" }} title={s.status}>{s.status}</div>
              </div>
            ))}
            {statusCounts.length === 0 && (
              <div className="text-xs text-center py-3" style={{ color: "var(--ink-faint)", gridColumn: "span 3" }}>No NetSuite data yet.</div>
            )}
          </div>
        </div>

        {/* Agent leaderboard — spans columns 3-4, two columns of names inside */}
        <div style={{ gridColumn: "span 2", background: "var(--surface)", border: "1px solid var(--border)" }} className="rounded-2xl p-4">
          <div className="sw-display text-sm mb-3" style={{ color: "var(--ink-faint)", fontWeight: 600, letterSpacing: "0.03em" }}>AGENT LEADERBOARD</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.5rem" }}>
            {leaderboard.map((a, i) => (
              <div key={a.name} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg" style={{ background: i === 0 ? "var(--primary-soft)" : "var(--surface-alt)" }}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="sw-mono text-xs font-bold shrink-0" style={{ color: "var(--ink-faint)", width: 16 }}>{i + 1}</span>
                  <span className="font-medium text-xs truncate">{a.name}</span>
                </div>
                <span className="sw-mono font-bold text-xs shrink-0 ml-1" style={{ color: "var(--green)" }}>{fmtGBP(a.gp)}</span>
              </div>
            ))}
            {leaderboard.length === 0 && <div className="text-xs text-center py-6" style={{ color: "var(--ink-faint)", gridColumn: "span 2" }}>No deals yet.</div>}
          </div>
        </div>

        {/* Sales by product group — box size follows GP */}
        <div style={{ gridColumn: "span 2", background: "var(--surface)", border: "1px solid var(--border)" }} className="rounded-2xl p-4">
          <div className="flex items-baseline justify-between mb-3">
            <div className="sw-display text-sm" style={{ color: "var(--ink-faint)", fontWeight: 600, letterSpacing: "0.03em" }}>SALES BY PRODUCT GROUP — GP</div>
            <div className="text-xs" style={{ color: "var(--ink-faint)" }}>{fmtGBP(productTotal)} total</div>
          </div>
          {productBoxes.length === 0 ? (
            <div className="text-xs text-center py-10" style={{ color: "var(--ink-faint)" }}>No product data for this period.</div>
          ) : (
            <div style={{ position: "relative", width: "100%", height: 210 }}>
              {productBoxes.map((b, i) => {
                const pct = productTotal > 0 ? (b.value / productTotal) * 100 : 0;
                const shade = PRODUCT_SHADES[i % PRODUCT_SHADES.length];
                const roomy = b.w > 14 && b.h > 18;
                return (
                  <div key={b.name}
                    title={`${b.name} — ${fmtGBP(b.value)} (${pct.toFixed(1)}%)`}
                    style={{
                      position: "absolute",
                      left: b.x + "%", top: b.y + "%", width: b.w + "%", height: b.h + "%",
                      padding: 3, boxSizing: "border-box",
                    }}>
                    <div className="rounded-lg h-full w-full flex flex-col justify-center px-2 overflow-hidden"
                      style={{ background: shade, color: "#fff" }}>
                      <div className="font-semibold leading-tight truncate" style={{ fontSize: roomy ? 12 : 10 }}>{b.name}</div>
                      {roomy && (
                        <>
                          <div className="sw-mono font-bold leading-tight" style={{ fontSize: b.w > 25 ? 18 : 13 }}>{fmtGBP(b.value)}</div>
                          <div style={{ fontSize: 10, opacity: 0.85 }}>{pct.toFixed(1)}%</div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Where we're selling — postcode areas, shaded by GP */}
        <div style={{ gridColumn: "span 2", background: "var(--surface)", border: "1px solid var(--border)" }} className="rounded-2xl p-4">
          <div className="flex items-baseline justify-between mb-3">
            <div className="sw-display text-sm" style={{ color: "var(--ink-faint)", fontWeight: 600, letterSpacing: "0.03em" }}>WHERE WE'RE SELLING</div>
            <div className="text-xs" style={{ color: "var(--ink-faint)" }}>
              {areaBoxes.length ? `${areaBoxes.length} postcode areas` : "by postcode area"}
            </div>
          </div>
          {areaBoxes.length === 0 ? (
            <div className="flex items-center justify-center text-center px-4" style={{ height: 210 }}>
              <div>
                <MapPin size={22} style={{ color: "var(--ink-faint)", margin: "0 auto 8px" }} />
                <div className="text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>No postcodes captured yet</div>
                <div className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>
                  The Lilac form now asks for a site postcode — this fills in as orders come through.
                  {postcodeCoverage > 0 && ` ${postcodeCoverage} so far.`}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(74px, 1fr))", gap: "0.4rem", height: 210, overflowY: "auto", alignContent: "start" }}>
              {areaBoxes.map((a) => {
                const intensity = areaMaxGp > 0 ? a.gp / areaMaxGp : 0;
                // Deeper purple = more GP from that area
                const bg = `rgba(76, 29, 143, ${0.12 + intensity * 0.85})`;
                const light = intensity > 0.45;
                return (
                  <div key={a.area} title={`${a.area} — ${fmtGBP(a.gp)} across ${a.count} order${a.count === 1 ? "" : "s"}`}
                    className="rounded-lg p-2 text-center" style={{ background: bg, color: light ? "#fff" : "var(--ink)" }}>
                    <div className="sw-display font-bold text-base leading-none">{a.area}</div>
                    <div className="sw-mono text-xs mt-1" style={{ opacity: 0.9 }}>{fmtGBP(a.gp)}</div>
                    <div className="text-xs" style={{ opacity: 0.75, fontSize: 10 }}>{a.count} order{a.count === 1 ? "" : "s"}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Phase-2 placeholders — a single slim strip, not dead space */}
      <div className="flex items-center gap-2 mt-3 px-1 flex-wrap">
        <span className="text-xs font-semibold" style={{ color: "var(--ink-faint)" }}>Coming soon:</span>
        {["Targets vs Actual", "Quarterly / YTD", "Product Gap"].map((label) => (
          <span key={label} className="text-xs px-2.5 py-1 rounded-full" style={{ background: "var(--surface)", border: "1px dashed var(--border)", color: "var(--ink-faint)" }}>{label}</span>
        ))}
        {(excludedGp > 0 || excludedSov > 0) && (
          <span className="text-xs ml-auto" style={{ color: "var(--ink-faint)" }}>
            Excluded by status: {excludedGp} from GP · {excludedSov} from SOV
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  REPORT HELPERS                                                         */
/* ---------------------------------------------------------------------- */

const FY_MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];

// Which financial-year month a date falls in (0 = April ... 11 = March)
function fyMonthIndex(d) {
  const m = d.getMonth();
  return (m - 3 + 12) % 12;
}
// ISO-ish week number, Monday-based
function weekNumber(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const fday = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fday + 3);
  return 1 + Math.round((t - firstThursday) / (7 * 86400000));
}

function ReportCell({ value, money = true, bold, tone, highlight }) {
  const empty = value === 0 || value == null;
  return (
    <td className="px-2 py-1.5 sw-mono whitespace-nowrap"
      style={{
        fontSize: 12,
        fontWeight: bold ? 700 : 500,
        color: empty ? "var(--ink-faint)" : (tone || "var(--ink)"),
        borderLeft: "1px solid var(--border)",
        background: highlight ? "var(--primary-soft)" : undefined,
        textAlign: "center",
      }}>
      {money ? fmtGBP(value) : (value || 0).toLocaleString("en-GB")}
    </td>
  );
}

function ReportLabel({ children, indent, bold, tone }) {
  return (
    <td className="px-3 py-1.5 whitespace-nowrap"
      style={{
        fontSize: 12,
        fontWeight: bold ? 700 : 600,
        color: tone || "var(--ink-soft)",
        paddingLeft: indent ? 24 : 12,
        position: "sticky", left: 0,
        background: "var(--surface)",
      }}>
      {children}
    </td>
  );
}

/* ---------------------------------------------------------------------- */
/*  SHARED REPORT CONTROLS & CHARTS                                        */
/* ---------------------------------------------------------------------- */

// Team + agent filters, shared by both report pages.
function ReportFilters({ team, setTeam, agent, setAgent, agentOptions, right }) {
  return (
    <div className="flex items-center gap-2 flex-wrap mb-4">
      <span className="text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5" style={{ color: "var(--ink-soft)" }}>
        <Filter size={13} /> Filter
      </span>
      <button onClick={() => setTeam("All")} className="sw-focus px-3 py-1.5 rounded-full text-xs font-semibold"
        style={team === "All" ? { background: "var(--primary)", color: "#fff" } : { background: "var(--surface)", color: "var(--ink-soft)", border: "1px solid var(--border)" }}>
        All teams
      </button>
      {SELLING_TEAMS.map((t) => (
        <button key={t} onClick={() => setTeam(t)} className="sw-focus px-3 py-1.5 rounded-full text-xs font-semibold"
          style={team === t ? { background: "var(--primary)", color: "#fff" } : { background: "var(--surface)", color: "var(--ink-soft)", border: "1px solid var(--border)" }}>
          {t}
        </button>
      ))}
      <select className="sw-input sw-focus" style={{ width: 190 }} value={agent} onChange={(e) => setAgent(e.target.value)}>
        <option value="All">All agents</option>
        {agentOptions.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>
      {right}
    </div>
  );
}

// Treemap of products — click a box to focus everything on that product.
function ProductTreemap({ items, selected, onSelect, height = 220 }) {
  const boxes = useMemo(() => treemapLayout(
    items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value), 0, 0, 100, 100, true
  ), [items]);
  const total = boxes.reduce((s, b) => s + b.value, 0);
  if (!boxes.length) {
    return <div className="text-xs text-center py-12" style={{ color: "var(--ink-faint)" }}>No product data for this selection.</div>;
  }
  return (
    <div style={{ position: "relative", width: "100%", height }}>
      {boxes.map((b, i) => {
        const pct = total > 0 ? (b.value / total) * 100 : 0;
        const isSel = selected === b.name;
        const dimmed = selected && !isSel;
        const roomy = b.w > 14 && b.h > 18;
        return (
          <div key={b.name} onClick={() => onSelect(isSel ? null : b.name)}
            title={`${b.name} — ${fmtGBP(b.value)} (${pct.toFixed(1)}%)`}
            style={{ position: "absolute", left: b.x + "%", top: b.y + "%", width: b.w + "%", height: b.h + "%", padding: 3, boxSizing: "border-box", cursor: "pointer" }}>
            <div className="rounded-lg h-full w-full flex flex-col justify-center px-2 overflow-hidden"
              style={{
                background: PRODUCT_SHADES[i % PRODUCT_SHADES.length],
                color: "#fff",
                opacity: dimmed ? 0.35 : 1,
                outline: isSel ? "2px solid var(--ink)" : "none",
                transition: "opacity .15s",
              }}>
              <div className="font-semibold leading-tight truncate" style={{ fontSize: roomy ? 12 : 10 }}>{b.name}</div>
              {roomy && (<>
                <div className="sw-mono font-bold leading-tight" style={{ fontSize: b.w > 25 ? 18 : 13 }}>{fmtGBP(b.value)}</div>
                <div style={{ fontSize: 10, opacity: 0.85 }}>{pct.toFixed(1)}%</div>
              </>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Horizontal bars per product, with the combined total on the end.
function ProductBars({ items, selected, onSelect, height = 220 }) {
  const rows = useMemo(() => items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value), [items]);
  const total = rows.reduce((s, r) => s + r.value, 0);
  const max = rows.length ? rows[0].value : 0;
  if (!rows.length) {
    return <div className="text-xs text-center py-12" style={{ color: "var(--ink-faint)" }}>No product data for this selection.</div>;
  }
  return (
    <div style={{ height, overflowY: "auto" }} className="pr-1">
      {rows.map((r, i) => {
        const isSel = selected === r.name;
        const dimmed = selected && !isSel;
        const w = max > 0 ? (r.value / max) * 100 : 0;
        return (
          <div key={r.name} onClick={() => onSelect(isSel ? null : r.name)}
            className="mb-1.5" style={{ cursor: "pointer", opacity: dimmed ? 0.4 : 1 }}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-xs font-semibold truncate" style={{ color: isSel ? "var(--primary)" : "var(--ink-soft)" }}>{r.name}</span>
              <span className="sw-mono text-xs font-bold ml-2 shrink-0">{fmtGBP(r.value)}</span>
            </div>
            <div className="rounded-full" style={{ height: 8, background: "var(--surface-alt)" }}>
              <div className="rounded-full" style={{ width: w + "%", height: "100%", background: PRODUCT_SHADES[i % PRODUCT_SHADES.length], transition: "width .2s" }} />
            </div>
          </div>
        );
      })}
      <div className="mt-3 pt-2 flex items-center justify-between" style={{ borderTop: "2px solid var(--border)" }}>
        <span className="text-xs font-bold uppercase" style={{ color: "var(--ink)" }}>Total</span>
        <span className="sw-mono text-sm font-bold" style={{ color: "var(--primary)" }}>{fmtGBP(total)}</span>
      </div>
    </div>
  );
}

// The two charts side by side. Treemap stays product-based (and drives the
// page's product filter); the bar chart is per Sales Agent and drives the
// existing agent filter, so clicking a bar is the same as picking that
// agent from the dropdown.
function ReportCharts({ treemapItems, treemapTitle, productSelected, onProductSelect, barItems, barTitle, agentSelected, onAgentSelect }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.75rem" }} className="mt-4">
      <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-baseline justify-between mb-3">
          <div className="sw-display text-sm" style={{ color: "var(--ink-faint)", fontWeight: 600, letterSpacing: "0.03em" }}>{treemapTitle}</div>
          {productSelected && (
            <button onClick={() => onProductSelect(null)} className="sw-focus text-xs font-semibold" style={{ color: "var(--primary)" }}>
              Clear filter
            </button>
          )}
        </div>
        <ProductTreemap items={treemapItems} selected={productSelected} onSelect={onProductSelect} />
      </div>
      <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-baseline justify-between mb-3">
          <div className="sw-display text-sm" style={{ color: "var(--ink-faint)", fontWeight: 600, letterSpacing: "0.03em" }}>{barTitle}</div>
          {agentSelected && agentSelected !== "All" && (
            <button onClick={() => onAgentSelect("All")} className="sw-focus text-xs font-semibold" style={{ color: "var(--primary)" }}>
              Clear filter
            </button>
          )}
        </div>
        <ProductBars items={barItems} selected={agentSelected === "All" ? null : agentSelected}
          onSelect={(name) => onAgentSelect(name && name !== agentSelected ? name : "All")} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  SALES BREAKDOWN — month or week, from NetSuite                         */
/* ---------------------------------------------------------------------- */

function SalesBreakdownView({ netsuite }) {
  const [grain, setGrain] = useState("month");   // 'month' | 'week'
  const [showAcq, setShowAcq] = useState(false);
  const [sbOpen, setSbOpen] = useState({});      // which rows are opened up
  const [team, setTeam] = useState("All");
  const [agent, setAgent] = useState("All");
  const [product, setProduct] = useState(null);  // set by clicking a chart
  const statusCfg = useStatusCfg();

  const agentOptions = useMemo(() => {
    const s = new Set();
    (netsuite || []).forEach((r) => { if (r.closer_name) s.add(r.closer_name); if (r.referrer_name) s.add(r.referrer_name); });
    return Array.from(s).sort();
  }, [netsuite]);

  const bucketOf = useCallback((r) => {
    const s = [r.prod_for_gs, r.product_group_2, r.item_name_grouped].join(" ").toLowerCase();
    if (/dv4/.test(s)) return "dv4b";
    if (/mobile|\bsim\b|airtime|handset/.test(s)) return "mobile";
    if (/cloud|voice/.test(s)) return "cloud";
    if (/bt ?net|btnet/.test(s)) return "btnet";
    if (/broadband|fttp|fttc|sogea|adsl/.test(s)) return "broadband";
    if (/security|badr/.test(s)) return "security";
    if (/data|ethernet/.test(s)) return "data";
    return "other";
  }, []);

  // Product grouping used by the charts — "Prod for GS" is NetSuite's own
  const groupOf = useCallback((r) => (r.prod_for_gs || r.product_group_2 || "Unspecified").trim() || "Unspecified", []);

  // Apply team / agent / product filters before anything is calculated
  const rowsFiltered = useMemo(() => (netsuite || []).filter((r) => {
    if (team !== "All" && r.closer_team !== team && r.referrer_team !== team) return false;
    if (agent !== "All" && r.closer_name !== agent && r.referrer_name !== agent) return false;
    if (product && groupOf(r) !== product) return false;
    return true;
  }), [netsuite, team, agent, product, groupOf]);

  const counts = (r, kind) => {
    const cfg = r.order_status ? statusCfg[r.order_status] : null;
    if (kind === "sov") {
      if (cfg) return cfg.count_sov !== false;
      return r.count_sov !== false;
    }
    if (cfg) return cfg.count_gp !== false;
    return r.count_gp !== false;
  };

  const isResign = (r) => /resign/i.test(String(r.class_name || ""));
  const isAcq = (r) => /acquisition/i.test(String(r.class_name || ""));
  const isCampaign = (r) => !!(r.campaign_source && String(r.campaign_source).trim());

  // Treemap data — SOV per product group, respecting team/agent but NOT the
  // product filter, so you can still see the whole picture while focused.
  const treemapItems = useMemo(() => {
    const m = {};
    (netsuite || []).forEach((r) => {
      if (team !== "All" && r.closer_team !== team && r.referrer_team !== team) return;
      if (agent !== "All" && r.closer_name !== agent && r.referrer_name !== agent) return;
      if (!counts(r, "sov")) return;
      const k = groupOf(r);
      m[k] = (m[k] || 0) + num(r.contract_value);
    });
    return Object.keys(m).map((name) => ({ name, value: m[name] }));
  }, [netsuite, team, agent, groupOf, statusCfg]);

  // Bar chart data — SOV per Sales Agent (closer's share of the deal).
  // Respects team + product filters but not the agent filter itself, so
  // every agent still shows and you can click one to filter by them.
  const agentBarItems = useMemo(() => {
    const m = {};
    (netsuite || []).forEach((r) => {
      if (team !== "All" && r.closer_team !== team) return;
      if (product && groupOf(r) !== product) return;
      if (!counts(r, "sov") || !r.closer_name) return;
      m[r.closer_name] = (m[r.closer_name] || 0) + num(r.contract_value);
    });
    return Object.keys(m).map((name) => ({ name, value: m[name] }));
  }, [netsuite, team, product, groupOf, statusCfg]);

  // Build the columns: FY months, or the weeks present in the data
  const { columns, keyOf } = useMemo(() => {
    if (grain === "month") {
      return { columns: FY_MONTHS.map((m, i) => ({ key: i, label: m })), keyOf: (d) => fyMonthIndex(d) };
    }
    const weeks = new Set();
    rowsFiltered.forEach((r) => { if (r.order_date) weeks.add(weekNumber(new Date(r.order_date + "T00:00:00"))); });
    const sorted = Array.from(weeks).map(Number).sort((a, b) => a - b);
    return { columns: sorted.map((w) => ({ key: w, label: "W" + w })), keyOf: (d) => weekNumber(d) };
  }, [grain, rowsFiltered]);

  // Aggregate every metric per column
  const data = useMemo(() => {
    const blank = () => {
      const o = {};
      columns.forEach((c) => { o[c.key] = 0; });
      return o;
    };
    const rows = {
      cloudSov: blank(), connSov: blank(), btnetSov: blank(), bbSov: blank(),
      mobileSov: blank(), otherSov: blank(), dv4bSov: blank(), totalSov: blank(),
      resignSov: blank(), resignUnits: blank(), nonResignSov: blank(), nonResignUnits: blank(),
      acqSov: blank(), totalGp: blank(), acqGp: blank(),
      campaignGp: blank(), acqCampaignGp: blank(),
    };

    rowsFiltered.forEach((r) => {
      if (!r.order_date) return;
      const d = new Date(r.order_date + "T00:00:00");
      const k = keyOf(d);
      if (!(k in rows.totalSov)) return;

      const sov = counts(r, "sov") ? num(r.contract_value) : 0;
      const gp = counts(r, "gp") ? num(r.gp_office) : 0;
      const units = num(r.quantity) || 0;
      const b = bucketOf(r);

      if (b === "cloud") rows.cloudSov[k] += sov;
      if (b === "dv4b") rows.dv4bSov[k] += sov;
      if (b === "btnet") rows.btnetSov[k] += sov;
      if (b === "broadband") rows.bbSov[k] += sov;
      if (b === "mobile") rows.mobileSov[k] += sov;
      if (b === "other" || b === "data") rows.otherSov[k] += sov;
      // Connectivity groups broadband, BT Net and security
      if (b === "broadband" || b === "btnet" || b === "security") rows.connSov[k] += sov;

      rows.totalSov[k] += sov;
      rows.totalGp[k] += gp;

      if (isResign(r)) { rows.resignSov[k] += sov; rows.resignUnits[k] += units; }
      else { rows.nonResignSov[k] += sov; rows.nonResignUnits[k] += units; }

      if (isAcq(r)) { rows.acqSov[k] += sov; rows.acqGp[k] += gp; }
      if (isCampaign(r)) {
        rows.campaignGp[k] += gp;
        if (isAcq(r)) rows.acqCampaignGp[k] += gp;
      }
    });
    return rows;
  }, [rowsFiltered, columns, keyOf, statusCfg]);

  // Per-team figures, shown when a team row is opened
  const teamBreakdown = useMemo(() => {
    const blank = () => {
      const o = {};
      columns.forEach((c) => { o[c.key] = 0; });
      return o;
    };
    const teams = {};
    rowsFiltered.forEach((r) => {
      if (!r.order_date) return;
      const k = keyOf(new Date(r.order_date + "T00:00:00"));
      const t = r.closer_team || "Unassigned";
      if (!teams[t]) teams[t] = { team: t, gp: blank(), sov: blank(), cloud: blank(), conn: blank(), mobile: blank() };
      if (!(k in teams[t].gp)) return;
      const sov = counts(r, "sov") ? num(r.contract_value) : 0;
      const gp = counts(r, "gp") ? num(r.gp_office) : 0;
      const b = bucketOf(r);
      teams[t].gp[k] += gp;
      teams[t].sov[k] += sov;
      if (b === "cloud" || b === "dv4b") teams[t].cloud[k] += sov;
      if (b === "broadband" || b === "btnet" || b === "security") teams[t].conn[k] += sov;
      if (b === "mobile") teams[t].mobile[k] += sov;
    });
    return Object.keys(teams).map((k) => teams[k])
      .sort((a, b) => columns.reduce((s, c) => s + b.gp[c.key], 0) - columns.reduce((s, c) => s + a.gp[c.key], 0));
  }, [rowsFiltered, columns, keyOf, bucketOf, statusCfg]);

  const rowTotal = (r) => columns.reduce((s, c) => s + (r[c.key] || 0), 0);
  const rowAvg = (r) => {
    const active = columns.filter((c) => (r[c.key] || 0) !== 0).length;
    return active ? rowTotal(r) / active : 0;
  };
  const pctRow = (numer, denom) => {
    const o = {};
    columns.forEach((c) => {
      const d = denom[c.key] || 0;
      o[c.key] = d ? ((numer[c.key] || 0) / d) * 100 : 0;
    });
    return o;
  };
  const acqPct = pctRow(data.acqGp, data.totalGp);
  const campaignPct = pctRow(data.campaignGp, data.totalGp);
  const acqCampaignPct = pctRow(data.acqCampaignGp, data.campaignGp);

  const MetricRow = ({ label, row, money = true, bold, tone, indent, indent2, pct, isOpen, onToggle }) => (
    <tr style={{ borderTop: "1px solid var(--border)" }}>
      <td className="px-3 py-1.5 whitespace-nowrap"
        style={{
          fontSize: 12, fontWeight: bold ? 700 : 600, color: tone || "var(--ink-soft)",
          paddingLeft: indent2 ? 44 : indent ? 26 : 12,
          position: "sticky", left: 0, background: "var(--surface)",
        }}>
        {onToggle ? (
          <button onClick={onToggle} className="sw-focus flex items-center gap-1.5 text-left">
            <ChevronDown size={12} style={{ color: "var(--ink-faint)", transform: isOpen ? "rotate(0)" : "rotate(-90deg)", transition: "transform .15s" }} />
            <span>{label}</span>
          </button>
        ) : label}
      </td>
      {pct ? (
        <>
          <td className="px-2 py-1.5 sw-mono" style={{ fontSize: 12, textAlign: "center", background: "var(--primary-soft)", borderLeft: "1px solid var(--border)", fontWeight: 700 }}>
            {(columns.reduce((s, c) => s + (row[c.key] || 0), 0) / (columns.filter((c) => (row[c.key] || 0) !== 0).length || 1)).toFixed(2)}%
          </td>
          <td className="px-2 py-1.5 sw-mono" style={{ fontSize: 12, textAlign: "center", background: "var(--primary-soft)", borderLeft: "1px solid var(--border)", color: "var(--ink-faint)" }}>—</td>
        </>
      ) : (
        <>
          <ReportCell value={rowAvg(row)} money={money} bold highlight />
          <ReportCell value={rowTotal(row)} money={money} bold highlight />
        </>
      )}
      {columns.map((c) => (
        pct
          ? <td key={c.key} className="px-2 py-1.5 text-right sw-mono" style={{ fontSize: 12, borderLeft: "1px solid var(--border)", color: (row[c.key] || 0) ? "var(--ink)" : "var(--ink-faint)" }}>
              {(row[c.key] || 0).toFixed(2)}%
            </td>
          : <ReportCell key={c.key} value={row[c.key]} money={money} tone={tone} />
      ))}
    </tr>
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <BarChart3 size={18} style={{ color: "var(--primary)" }} />
        <h2 className="sw-display text-lg font-bold">Sales Breakdown</h2>
        <span className="text-xs" style={{ color: "var(--ink-faint)" }}>Source: NetSuite · excludes NSOV / NGP</span>
        <div className="flex items-center gap-1.5 ml-auto">
          {[["month", "Month by month"], ["week", "Week by week"]].map(([k, lbl]) => (
            <button key={k} onClick={() => setGrain(k)} className="sw-focus px-3 py-1.5 rounded-full text-xs font-semibold"
              style={grain === k ? { background: "var(--primary)", color: "#fff" } : { background: "var(--surface)", color: "var(--ink-soft)", border: "1px solid var(--border)" }}>
              {lbl}
            </button>
          ))}
          <button onClick={() => setShowAcq((v) => !v)} className="sw-focus px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1"
            style={showAcq ? { background: "var(--gold)", color: "#fff" } : { background: "var(--surface)", color: "var(--ink-soft)", border: "1px solid var(--border)" }}>
            {showAcq ? <EyeOff size={12} /> : <Eye size={12} />} ACQ figures
          </button>
        </div>
      </div>

      <ReportFilters team={team} setTeam={setTeam} agent={agent} setAgent={setAgent} agentOptions={agentOptions} />

      {product && (
        <div className="rounded-xl p-2.5 mb-3 flex items-center justify-between" style={{ background: "var(--primary-soft)" }}>
          <span className="text-xs font-semibold" style={{ color: "var(--primary)" }}>
            Focused on {product} — every figure below is just this product.
          </span>
          <button onClick={() => setProduct(null)} className="sw-focus text-xs font-semibold" style={{ color: "var(--primary)" }}>Clear</button>
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)" }}>
                <th className="px-3 py-2 text-left text-xs font-bold uppercase" style={{ color: "var(--ink-soft)", position: "sticky", left: 0, background: "var(--surface-alt)" }}>Metric</th>
                <th className="px-2 py-2 text-center text-xs font-bold" style={{ color: "var(--ink-soft)", background: "var(--primary-soft)" }}>Avg</th>
                <th className="px-2 py-2 text-center text-xs font-bold" style={{ color: "var(--ink-soft)", background: "var(--primary-soft)" }}>Total</th>
                {columns.map((c) => (
                  <th key={c.key} className="px-2 py-2 text-center text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Totals lead; the detail sits behind them */}
              <MetricRow label="Total GP" row={data.totalGp} bold tone="var(--green)" />
              <MetricRow label="Total SOV" row={data.totalSov} bold tone="var(--primary)"
                isOpen={!!sbOpen.products} onToggle={() => setSbOpen((o) => ({ ...o, products: !o.products }))} />
              {sbOpen.products && (
                <>
                  <MetricRow label="Cloud SOV" row={data.cloudSov} indent />
                  <MetricRow label="DV4B SOV" row={data.dv4bSov} indent2 />
                  <MetricRow label="Connectivity SOV" row={data.connSov} indent />
                  <MetricRow label="BT Net SOV" row={data.btnetSov} indent2 />
                  <MetricRow label="Broadband SOV" row={data.bbSov} indent2 />
                  <MetricRow label="Mobile SOV" row={data.mobileSov} indent />
                  <MetricRow label="Other SOV" row={data.otherSov} indent />
                </>
              )}

              <MetricRow label="Resign SOV" row={data.resignSov}
                isOpen={!!sbOpen.resign} onToggle={() => setSbOpen((o) => ({ ...o, resign: !o.resign }))} />
              {sbOpen.resign && (
                <>
                  <MetricRow label="Resign Units" row={data.resignUnits} money={false} indent />
                  <MetricRow label="Non Resign SOV" row={data.nonResignSov} indent />
                  <MetricRow label="Non Resign Units" row={data.nonResignUnits} money={false} indent2 />
                </>
              )}

              <MetricRow label="Campaign GP" row={data.campaignGp}
                isOpen={!!sbOpen.campaign} onToggle={() => setSbOpen((o) => ({ ...o, campaign: !o.campaign }))} />
              {sbOpen.campaign && <MetricRow label="Campaign GP %" row={campaignPct} pct indent />}

              {/* By team, opened on demand */}
              {teamBreakdown.length > 0 && (
                <tr style={{ background: "var(--surface-alt)", borderTop: "2px solid var(--border)" }}>
                  <td colSpan={3 + columns.length} className="px-3 py-1.5 text-xs font-bold uppercase" style={{ color: "var(--primary)" }}>By team</td>
                </tr>
              )}
              {teamBreakdown.map((t) => (
                <React.Fragment key={t.team}>
                  <MetricRow label={t.team} row={t.gp} bold
                    isOpen={!!sbOpen[`team_${t.team}`]} onToggle={() => setSbOpen((o) => ({ ...o, [`team_${t.team}`]: !o[`team_${t.team}`] }))} />
                  {sbOpen[`team_${t.team}`] && (
                    <>
                      <MetricRow label="Total SOV" row={t.sov} indent tone="var(--primary)" />
                      <MetricRow label="Cloud SOV" row={t.cloud} indent2 />
                      <MetricRow label="Connectivity SOV" row={t.conn} indent2 />
                      <MetricRow label="Mobile SOV" row={t.mobile} indent2 />
                    </>
                  )}
                </React.Fragment>
              ))}

              {showAcq && (
                <>
                  <tr style={{ background: "var(--gold-soft)" }}>
                    <td colSpan={3 + columns.length} className="px-3 py-1.5 text-xs font-bold" style={{ color: "var(--gold)" }}>
                      ACQUISITION
                    </td>
                  </tr>
                  <MetricRow label="Acq SOV" row={data.acqSov} tone="var(--gold)" />
                  <MetricRow label="Acq GP" row={data.acqGp} tone="var(--gold)" />
                  <MetricRow label="Acq %" row={acqPct} pct indent tone="var(--gold)" />
                  <MetricRow label="Acq Campaign GP" row={data.acqCampaignGp} tone="var(--gold)" />
                  <MetricRow label="Acq Campaign %" row={acqCampaignPct} pct indent tone="var(--gold)" />
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <ReportCharts treemapItems={treemapItems} treemapTitle="SOV BY PRODUCT" productSelected={product} onProductSelect={setProduct}
        barItems={agentBarItems} barTitle="SOV BY SALES AGENT" agentSelected={agent} onAgentSelect={setAgent} />

      <p className="text-xs mt-3" style={{ color: "var(--ink-faint)" }}>
        Averages ignore months with no activity, so a part-year doesn't drag the figure down.
        Connectivity combines Broadband, BT Net and Security.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  DAY BY DAY — this week and month, from claimed Lilac Boxes             */
/* ---------------------------------------------------------------------- */

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

/* Top-level reporting groups for Day by Day. DV4B rolls into Cloud;
   BT Net, Broadband and Security all roll into Connectivity. */
const DBD_GROUPS = [
  { key: "cloud",        label: "Cloud",        accent: "#5E2CA8", tags: ["Cloud Voice", "DV4 Cloud"] },
  { key: "connectivity", label: "Connectivity", accent: "#205EA6", tags: ["BT Net", "Broadband", "Security", "PSTN/Lines", "Wi-Fi"] },
  { key: "mobile",       label: "Mobile",       accent: "#8659CE", tags: ["Mobile"] },
];

function DayByDayView({ orders }) {
  const now = new Date();
  const wkStart = weekStart(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [team, setTeam] = useState("All");
  const [agent, setAgent] = useState("All");
  const [product, setProduct] = useState(null);
  const [open, setOpen] = useState({});          // any row key -> expanded

  const toggle = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const agentOptions = useMemo(() => {
    const s = new Set();
    (orders || []).forEach((o) => { if (o.closer_name) s.add(o.closer_name); if (o.lead_gen_name) s.add(o.lead_gen_name); });
    return Array.from(s).sort();
  }, [orders]);

  const filtered = useMemo(() => (orders || []).filter((o) => {
    if (o.removed_at || !o.submission_date) return false;
    if (new Date(o.submission_date) < monthStart) return false;
    if (team !== "All" && o.closer_team !== team && o.lead_gen_team !== team) return false;
    if (agent !== "All" && o.closer_name !== agent && o.lead_gen_name !== agent) return false;
    return true;
  }), [orders, team, agent, monthStart]);

  const tagsOf = (o) => String(o.item_name_grouped || o.product_group_2 || "")
    .split(/\s*\+\s*/).map((t) => t.trim()).filter(Boolean);
  const groupOfTag = (tag) => {
    const g = DBD_GROUPS.find((x) => x.tags.includes(tag));
    return g ? g.key : null;
  };

  const blank = () => ({ week: [0, 0, 0, 0, 0], month: 0 });
  const addTo = useCallback((bucket, d, v) => {
    const dt = new Date(d);
    bucket.month += v;
    if (dt >= wkStart) {
      const i = (dt.getDay() + 6) % 7;
      if (i >= 0 && i < 5) bucket.week[i] += v;
    }
  }, [wkStart]);

  const data = useMemo(() => {
    const teams = {};
    const ensure = (t) => {
      if (!teams[t]) {
        teams[t] = { team: t, gp: blank(), totalSov: blank(), groups: {}, subs: {} };
        DBD_GROUPS.forEach((g) => { teams[t].groups[g.key] = blank(); teams[t].subs[g.key] = {}; });
      }
      return teams[t];
    };

    filtered.forEach((o) => {
      const t = ensure(o.closer_team || "Unassigned");
      const d = o.submission_date;
      addTo(t.gp, d, num(o.gp_office != null ? o.gp_office : o.sales_agent_gp));

      const sov = num(o.contract_value);
      addTo(t.totalSov, d, sov);

      const tags = tagsOf(o).filter((tg) => groupOfTag(tg));
      if (!tags.length) return;
      // Split a multi-product deal's SOV evenly so nothing is double counted
      const share = sov / tags.length;
      tags.forEach((tg) => {
        const gk = groupOfTag(tg);
        if (product && product !== gk) return;
        addTo(t.groups[gk], d, share);
        if (!t.subs[gk][tg]) t.subs[gk][tg] = blank();
        addTo(t.subs[gk][tg], d, share);
      });
    });

    return Object.keys(teams).map((k) => teams[k]).sort((a, b) => b.gp.month - a.gp.month);
  }, [filtered, addTo, product]);

  const totals = useMemo(() => {
    const out = { gp: blank(), totalSov: blank(), groups: {}, subs: {} };
    DBD_GROUPS.forEach((g) => { out.groups[g.key] = blank(); out.subs[g.key] = {}; });
    const merge = (dst, src) => {
      dst.month += src.month;
      src.week.forEach((v, i) => { dst.week[i] += v; });
    };
    data.forEach((t) => {
      merge(out.gp, t.gp);
      merge(out.totalSov, t.totalSov);
      DBD_GROUPS.forEach((g) => {
        merge(out.groups[g.key], t.groups[g.key]);
        Object.keys(t.subs[g.key]).forEach((s) => {
          if (!out.subs[g.key][s]) out.subs[g.key][s] = blank();
          merge(out.subs[g.key][s], t.subs[g.key][s]);
        });
      });
    });
    return out;
  }, [data]);

  const chartItems = useMemo(() => DBD_GROUPS.map((g) => ({
    name: g.label,
    value: totals.groups[g.key].month,
  })).filter((i) => i.value > 0), [totals]);

  /* One line of the table. `onToggle` makes it clickable. */
  const Row = ({ label, bucket, bold, tone, depth = 0, onToggle, isOpen, accent }) => {
    const weekTotal = bucket.week.reduce((s, v) => s + v, 0);
    return (
      <tr style={{ borderTop: "1px solid var(--border)" }}>
        <td className="px-3 py-1.5 whitespace-nowrap"
          style={{ position: "sticky", left: 0, background: "var(--surface)", paddingLeft: 12 + depth * 20 }}>
          {onToggle ? (
            <button onClick={onToggle} className="sw-focus flex items-center gap-1.5 text-left">
              <ChevronDown size={12} style={{ color: "var(--ink-faint)", transform: isOpen ? "rotate(0)" : "rotate(-90deg)", transition: "transform .15s" }} />
              {accent && <span style={{ width: 3, height: 12, background: accent, borderRadius: 2, display: "inline-block" }} />}
              <span style={{ fontSize: 12, fontWeight: bold ? 700 : 600, color: tone || "var(--ink-soft)" }}>{label}</span>
            </button>
          ) : (
            <span style={{ fontSize: 12, fontWeight: bold ? 700 : 600, color: tone || "var(--ink-soft)", paddingLeft: onToggle === undefined && depth ? 18 : 0 }}>{label}</span>
          )}
        </td>
        <ForecastCell value={bucket.month} bold highlight />
        {bucket.week.map((v, i) => <ForecastCell key={i} value={v} tone={tone} />)}
        <ForecastCell value={weekTotal} bold highlight />
      </tr>
    );
  };

  /* Cloud / Connectivity / Mobile, each expanding to its own products. */
  const GroupRows = ({ scopeKey, src, depth }) => (
    <>
      {DBD_GROUPS.map((g) => {
        const k = `${scopeKey}_${g.key}`;
        const subs = Object.keys(src.subs[g.key]).sort();
        return (
          <React.Fragment key={g.key}>
            <Row label={`${g.label} SOV`} bucket={src.groups[g.key]} accent={g.accent} depth={depth}
              isOpen={!!open[k]} onToggle={subs.length ? () => toggle(k) : undefined} />
            {open[k] && subs.map((s) => (
              <Row key={s} label={s} bucket={src.subs[g.key][s]} depth={depth + 1} tone="var(--ink-faint)" />
            ))}
          </React.Fragment>
        );
      })}
    </>
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <CalendarDays size={18} style={{ color: "var(--primary)" }} />
        <h2 className="sw-display text-lg font-bold">Day by Day</h2>
        <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
          Claimed Lilac Boxes · w/c {fmtDate(wkStart)}
        </span>
      </div>

      <ReportFilters team={team} setTeam={setTeam} agent={agent} setAgent={setAgent} agentOptions={agentOptions}
        right={product && (
          <button onClick={() => setProduct(null)} className="sw-focus px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1"
            style={{ background: "var(--primary)", color: "#fff" }}>
            {DBD_GROUPS.find((g) => g.key === product)?.label} <X size={12} />
          </button>
        )} />

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)", gap: "0.75rem", alignItems: "start" }}>

        <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)" }}>
                  <th className="px-3 py-2 text-left text-xs font-bold uppercase" style={{ color: "var(--ink-soft)", position: "sticky", left: 0, background: "var(--surface-alt)" }}>Metric</th>
                  <th className="px-2 py-2 text-center text-xs font-bold" style={{ color: "var(--ink-soft)", background: "var(--primary-soft)" }}>Month</th>
                  {DAY_NAMES.map((d) => (
                    <th key={d} className="px-2 py-2 text-center text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>{d.slice(0, 3)}</th>
                  ))}
                  <th className="px-2 py-2 text-center text-xs font-bold" style={{ color: "var(--ink-soft)", background: "var(--primary-soft)" }}>Week</th>
                </tr>
              </thead>
              <tbody>
                {/* All teams */}
                <tr style={{ background: "var(--ink)" }}>
                  <td colSpan={8} className="px-3 py-1.5 text-xs font-bold uppercase" style={{ color: "#fff", position: "sticky", left: 0, background: "var(--ink)" }}>
                    All teams
                  </td>
                </tr>
                <Row label="GP" bucket={totals.gp} bold tone="var(--green)" />
                <Row label="Total SOV" bucket={totals.totalSov} bold tone="var(--primary)"
                  isOpen={!!open.all_sov} onToggle={() => toggle("all_sov")} />
                {open.all_sov && <GroupRows scopeKey="all" src={totals} depth={1} />}

                {/* Per team — GP and Total SOV, expanding into products */}
                {data.length > 0 && (
                  <tr style={{ background: "var(--surface-alt)", borderTop: "2px solid var(--border)" }}>
                    <td colSpan={8} className="px-3 py-1.5 text-xs font-bold uppercase" style={{ color: "var(--primary)", position: "sticky", left: 0, background: "var(--surface-alt)" }}>
                      By team
                    </td>
                  </tr>
                )}
                {data.map((t) => {
                  const tk = `team_${t.team}`;
                  return (
                    <React.Fragment key={t.team}>
                      <Row label={t.team} bucket={t.gp} bold tone="var(--ink)"
                        isOpen={!!open[tk]} onToggle={() => toggle(tk)} />
                      {open[tk] && (
                        <>
                          <Row label="Total SOV" bucket={t.totalSov} depth={1} tone="var(--primary)"
                            isOpen={!!open[`${tk}_sov`]} onToggle={() => toggle(`${tk}_sov`)} />
                          {open[`${tk}_sov`] && <GroupRows scopeKey={tk} src={t} depth={2} />}
                        </>
                      )}
                    </React.Fragment>
                  );
                })}

                {data.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-10 text-center" style={{ color: "var(--ink-faint)" }}>
                    Nothing claimed this month yet.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Charts beside the table */}
        <div className="flex flex-col gap-3">
          <div className="rounded-xl p-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="sw-display text-xs mb-2" style={{ color: "var(--ink-faint)", fontWeight: 600, letterSpacing: "0.03em" }}>SOV SHARE — THIS MONTH</div>
            <ProductTreemap items={chartItems} height={150}
              selected={product ? DBD_GROUPS.find((g) => g.key === product)?.label : null}
              onSelect={(name) => setProduct(name ? (DBD_GROUPS.find((g) => g.label === name)?.key || null) : null)} />
          </div>
          <div className="rounded-xl p-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="sw-display text-xs mb-2" style={{ color: "var(--ink-faint)", fontWeight: 600, letterSpacing: "0.03em" }}>SOV BY PRODUCT</div>
            <ProductBars items={chartItems} height={150}
              selected={product ? DBD_GROUPS.find((g) => g.key === product)?.label : null}
              onSelect={(name) => setProduct(name ? (DBD_GROUPS.find((g) => g.label === name)?.key || null) : null)} />
          </div>
        </div>
      </div>

      <p className="text-xs mt-3" style={{ color: "var(--ink-faint)" }}>
        Click a team or a product to open it up. DV4B counts within Cloud; BT Net, Broadband and Security
        within Connectivity. Orders covering several products split their SOV evenly across them, so the
        product rows always add up to Total SOV.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  PAY PLANS — office-only: monthly targets agents are measured against   */
/* ---------------------------------------------------------------------- */

function PayPlanRow({ plan, agentCount, onSave, onDelete }) {
  const [f, setF] = useState({
    name: plan.name || "",
    target_gp: plan.target_gp ?? 0,
    target_cloud_sov: plan.target_cloud_sov ?? 0,
    target_connectivity_sov: plan.target_connectivity_sov ?? 0,
    target_mobile_sov: plan.target_mobile_sov ?? 0,
    active: plan.active !== false,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = Object.keys(f).some((k) => String(f[k]) !== String(plan[k] ?? (k === "active" ? true : 0)));

  const numField = (key, width = 96) => (
    <input className="sw-input sw-focus" style={{ width, textAlign: "right" }} value={f[key]}
      onChange={(e) => setF((p) => ({ ...p, [key]: e.target.value }))} />
  );

  return (
    <tr style={{ borderTop: "1px solid var(--border)" }}>
      <td className="px-3 py-2">
        <input className="sw-input sw-focus" style={{ minWidth: 150 }} value={f.name}
          onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} />
      </td>
      <td className="px-3 py-2">{numField("target_gp")}</td>
      <td className="px-3 py-2">{numField("target_cloud_sov")}</td>
      <td className="px-3 py-2">{numField("target_connectivity_sov")}</td>
      <td className="px-3 py-2">{numField("target_mobile_sov")}</td>
      <td className="px-3 py-2 text-center">
        <span className="text-xs font-semibold px-2 py-1 rounded-full"
          style={{ background: agentCount ? "var(--primary-soft)" : "var(--surface-alt)", color: agentCount ? "var(--primary)" : "var(--ink-faint)" }}>
          {agentCount}
        </span>
      </td>
      <td className="px-3 py-2 text-center">
        <input type="checkbox" checked={f.active} onChange={(e) => setF((p) => ({ ...p, active: e.target.checked }))} />
      </td>
      <td className="px-3 py-2">
        <button disabled={!dirty || saving}
          onClick={async () => {
            setSaving(true);
            await onSave(plan.id, {
              name: f.name,
              target_gp: parseFloat(f.target_gp) || 0,
              target_cloud_sov: parseFloat(f.target_cloud_sov) || 0,
              target_connectivity_sov: parseFloat(f.target_connectivity_sov) || 0,
              target_mobile_sov: parseFloat(f.target_mobile_sov) || 0,
              active: f.active,
            });
            setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 1500);
          }}
          className="sw-focus text-xs font-semibold px-2.5 py-1.5 rounded-lg"
          style={{ background: dirty ? "var(--primary)" : "var(--surface-alt)", color: dirty ? "#fff" : "var(--ink-faint)" }}
        >{saving ? "..." : "Save"}</button>
      </td>
      <td className="px-2 text-center">
        {saved ? <CheckCircle2 size={14} style={{ color: "var(--green)" }} /> : (
          agentCount === 0 && (
            <button onClick={() => onDelete(plan.id, plan.name)} className="sw-focus text-xs" style={{ color: "var(--red)" }} title="Delete this plan">✕</button>
          )
        )}
      </td>
    </tr>
  );
}

function PayPlansView({ plans, staff, onSave, onAdd, onDelete }) {
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const countByPlan = useMemo(() => {
    const m = {};
    (staff || []).forEach((s) => { if (s.pay_plan_id) m[s.pay_plan_id] = (m[s.pay_plan_id] || 0) + 1; });
    return m;
  }, [staff]);

  const officeTotals = useMemo(() => {
    const t = { gp: 0, cloud: 0, conn: 0, mobile: 0 };
    (staff || []).forEach((s) => {
      const p = (plans || []).find((x) => x.id === s.pay_plan_id);
      if (!p || p.active === false) return;
      t.gp += num(p.target_gp);
      t.cloud += num(p.target_cloud_sov);
      t.conn += num(p.target_connectivity_sov);
      t.mobile += num(p.target_mobile_sov);
    });
    return t;
  }, [staff, plans]);

  const wd = workdaysInMonth();
  const wdDone = workdaysElapsedInMonth();

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Target size={18} style={{ color: "var(--primary)" }} />
        <h2 className="sw-display text-lg font-bold">Pay Plans</h2>
        <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
          Monthly targets · assign to people on the Admin page
        </span>
      </div>

      <p className="text-sm mb-4 p-3 rounded-xl" style={{ background: "var(--primary-soft)", color: "var(--ink-soft)" }}>
        Targets are monthly and get pro-rated by working day, so nobody is judged against a full month on the 3rd.
        This month has <b>{wd} working days</b> and <b>{wdDone}</b> have passed — so right now a card turns
        green at <b>{Math.round((wdDone / wd) * 100)}%</b> of the monthly figure, and amber from 75% of that.
        Team and office targets are just the totals of everyone in scope.
      </p>

      <div className="rounded-2xl overflow-hidden mb-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--surface-alt)" }}>
                {["Plan name", "GP", "Cloud SOV", "Connectivity SOV", "Mobile SOV", "On plan", "Active", "", ""].map((h, i) => (
                  <th key={i} className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(plans || []).map((p) => (
                <PayPlanRow key={p.id} plan={p} agentCount={countByPlan[p.id] || 0} onSave={onSave} onDelete={onDelete} />
              ))}
              <tr style={{ borderTop: "2px solid var(--border)", background: "var(--surface-alt)" }}>
                <td className="px-3 py-2">
                  <input className="sw-input sw-focus" placeholder="New plan name" value={newName}
                    onChange={(e) => setNewName(e.target.value)} />
                </td>
                <td className="px-3 py-2" colSpan={8}>
                  <button disabled={!newName.trim() || adding}
                    onClick={async () => { setAdding(true); await onAdd(newName.trim()); setNewName(""); setAdding(false); }}
                    className="sw-focus text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1"
                    style={{ background: newName.trim() ? "var(--primary)" : "var(--surface)", color: newName.trim() ? "#fff" : "var(--ink-faint)", border: "1px solid var(--border)" }}>
                    <Plus size={12} /> {adding ? "Adding..." : "Add plan"}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="sw-display text-sm mb-3" style={{ color: "var(--ink-faint)", fontWeight: 600, letterSpacing: "0.03em" }}>OFFICE MONTHLY TARGET (all assigned plans)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "0.75rem" }}>
          {[["GP", officeTotals.gp], ["Cloud SOV", officeTotals.cloud], ["Connectivity SOV", officeTotals.conn], ["Mobile SOV", officeTotals.mobile]].map(([lbl, v]) => (
            <div key={lbl} className="rounded-xl p-3" style={{ background: "var(--surface-alt)" }}>
              <div className="text-xs font-semibold uppercase" style={{ color: "var(--ink-soft)" }}>{lbl}</div>
              <div className="sw-display font-bold text-xl">{fmtGBP(v)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  STATUS SETTINGS — office-only: colours + what counts toward GP / SOV   */
/* ---------------------------------------------------------------------- */

function StatusConfigRow({ row, onSave }) {
  const [tone, setTone] = useState(row.tone || "primary");
  const [countGp, setCountGp] = useState(row.count_gp !== false);
  const [countSov, setCountSov] = useState(row.count_sov !== false);
  const [needsAttention, setNeedsAttention] = useState(row.needs_attention === true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const dirty = tone !== row.tone || countGp !== (row.count_gp !== false) || countSov !== (row.count_sov !== false) || needsAttention !== (row.needs_attention === true);
  const preview = TONE_MAP[tone] || TONE_MAP.neutral;

  return (
    <tr style={{ borderTop: "1px solid var(--border)" }}>
      <td className="px-3 py-2">
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{ color: countGp ? preview.fg : "var(--red)", background: countGp ? preview.bg : "var(--red-soft)" }}>
          <span style={{ background: countGp ? preview.fg : "var(--red)" }} className="w-1.5 h-1.5 rounded-full" />
          {row.status}
        </span>
        {row.auto_added && <span className="text-xs ml-2" style={{ color: "var(--ink-faint)" }}>new</span>}
      </td>
      <td className="px-3 py-2">
        <select className="sw-input sw-focus" style={{ width: 110 }} value={tone} onChange={(e) => setTone(e.target.value)}>
          {TONE_CHOICES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </td>
      <td className="px-3 py-2 text-center">
        <input type="checkbox" checked={countGp} onChange={(e) => setCountGp(e.target.checked)} title="Counts toward GP" />
        <div className="text-xs" style={{ color: countGp ? "var(--ink-faint)" : "var(--red)" }}>{countGp ? "counts" : "NGP"}</div>
      </td>
      <td className="px-3 py-2 text-center">
        <input type="checkbox" checked={countSov} onChange={(e) => setCountSov(e.target.checked)} title="Counts toward SOV" />
        <div className="text-xs" style={{ color: countSov ? "var(--ink-faint)" : "var(--amber)" }}>{countSov ? "counts" : "NSOV"}</div>
      </td>
      <td className="px-3 py-2 text-center">
        <input type="checkbox" checked={needsAttention} onChange={(e) => setNeedsAttention(e.target.checked)}
          title="An order sitting at this status needs the agent to do something" />
        <div className="text-xs" style={{ color: needsAttention ? "var(--amber)" : "var(--ink-faint)" }}>{needsAttention ? "chase" : "—"}</div>
      </td>
      <td className="px-3 py-2">
        <button
          disabled={!dirty || saving}
          onClick={async () => {
            setSaving(true);
            await onSave(row.status, { tone, count_gp: countGp, count_sov: countSov, needs_attention: needsAttention, auto_added: false });
            setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 1500);
          }}
          className="sw-focus text-xs font-semibold px-2.5 py-1.5 rounded-lg"
          style={{ background: dirty ? "var(--primary)" : "var(--surface-alt)", color: dirty ? "#fff" : "var(--ink-faint)" }}
        >{saving ? "..." : "Save"}</button>
      </td>
      <td className="px-2 text-center">{saved && <CheckCircle2 size={14} style={{ color: "var(--green)" }} />}</td>
    </tr>
  );
}

function StatusSettingsView({ rows, onSave, newCount }) {
  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (!!a.auto_added !== !!b.auto_added) return a.auto_added ? -1 : 1;  // new ones first
      return String(a.status).localeCompare(String(b.status));
    });
  }, [rows]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Palette size={18} style={{ color: "var(--primary)" }} />
        <h2 className="sw-display text-lg font-bold">Order Statuses</h2>
        <span className="text-xs" style={{ color: "var(--ink-faint)" }}>Office only · applies everywhere immediately</span>
      </div>

      <p className="text-sm mb-4 p-3 rounded-xl" style={{ background: "var(--primary-soft)", color: "var(--ink-soft)" }}>
        Statuses arriving from NetSuite are added here automatically with a best-guess colour, marked <b>new</b> until
        you've checked them. Unticking <b>GP</b> makes a status NGP — those orders drop out of GP totals and are hidden
        from the dashboard unless someone asks to see them. Unticking <b>SOV</b> makes it NSOV.
        {newCount > 0 && <> <b>{newCount} new {newCount === 1 ? "status" : "statuses"}</b> to review.</>}
      </p>

      <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--surface-alt)" }}>
              {["Status", "Colour", "Counts to GP", "Counts to SOV", "Needs action", "", ""].map((h, i) => (
                <th key={i} className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => <StatusConfigRow key={r.status} row={r} onSave={onSave} />)}
            {sorted.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center" style={{ color: "var(--ink-faint)" }}>
                No statuses yet — they'll appear as NetSuite data syncs in.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  COACH SETTINGS — office-only: scenarios and how calls are graded       */
/* ---------------------------------------------------------------------- */

function CoachScenarioRow({ s, onSave, onDelete }) {
  const [f, setF] = useState({ label: s.label || "", blurb: s.blurb || "", persona: s.persona || "", active: s.active !== false });
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = f.label !== s.label || f.blurb !== (s.blurb || "") || f.persona !== s.persona || f.active !== (s.active !== false);

  return (
    <div style={{ borderTop: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2 px-3 py-2">
        <button onClick={() => setOpen((o) => !o)} className="sw-focus flex items-center gap-2 flex-1 text-left">
          <ChevronDown size={14} style={{ color: "var(--ink-faint)", transform: open ? "rotate(0)" : "rotate(-90deg)", transition: "transform .15s" }} />
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{f.label || s.key}</div>
            <div className="text-xs truncate" style={{ color: "var(--ink-faint)" }}>{f.blurb}</div>
          </div>
        </button>
        <label className="flex items-center gap-1.5 text-xs shrink-0" style={{ color: "var(--ink-soft)" }}>
          <input type="checkbox" checked={f.active} onChange={(e) => setF((p) => ({ ...p, active: e.target.checked }))} /> Active
        </label>
        <button disabled={!dirty || saving}
          onClick={async () => { setSaving(true); await onSave(s.id, f); setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 1500); }}
          className="sw-focus text-xs font-semibold px-2.5 py-1.5 rounded-lg shrink-0"
          style={{ background: dirty ? "var(--primary)" : "var(--surface-alt)", color: dirty ? "#fff" : "var(--ink-faint)" }}>
          {saving ? "..." : "Save"}
        </button>
        {saved && <CheckCircle2 size={14} style={{ color: "var(--green)" }} />}
        <button onClick={() => onDelete(s.id, f.label)} className="sw-focus text-xs px-1.5 shrink-0" style={{ color: "var(--red)" }} title="Delete scenario">✕</button>
      </div>
      {open && (
        <div className="px-3 pb-3" style={{ background: "var(--surface-alt)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }} className="pt-2">
            <div><label className="sw-label">Name shown on the picker</label>
              <input className="sw-input sw-focus" value={f.label} onChange={(e) => setF((p) => ({ ...p, label: e.target.value }))} /></div>
            <div><label className="sw-label">One-line description</label>
              <input className="sw-input sw-focus" value={f.blurb} onChange={(e) => setF((p) => ({ ...p, blurb: e.target.value }))} /></div>
          </div>
          <label className="sw-label" style={{ marginTop: 8 }}>The character the AI plays</label>
          <textarea className="sw-input sw-focus" rows={6} value={f.persona} onChange={(e) => setF((p) => ({ ...p, persona: e.target.value }))} />
          <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>
            Write it as instructions to the customer, in second person — "You are a business owner who...".
            The more specific the personality and the more it resists, the more useful the practice.
          </p>
        </div>
      )}
    </div>
  );
}

function CoachSettingsView({ scenarios, settings, onSaveScenario, onAddScenario, onDeleteScenario, onSaveSettings }) {
  const [rubric, setRubric] = useState(settings.rubric || "");
  const [method, setMethod] = useState(settings.what_good_looks_like || "");
  const [savingCfg, setSavingCfg] = useState(false);
  const [savedCfg, setSavedCfg] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  useEffect(() => {
    setRubric(settings.rubric || "");
    setMethod(settings.what_good_looks_like || "");
  }, [settings]);

  const cfgDirty = rubric !== (settings.rubric || "") || method !== (settings.what_good_looks_like || "");

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Headphones size={18} style={{ color: "var(--primary)" }} />
        <h2 className="sw-display text-lg font-bold">Coach Setup</h2>
        <span className="text-xs" style={{ color: "var(--ink-faint)" }}>Scenarios and how calls are graded</span>
      </div>

      <p className="text-sm mb-4 p-3 rounded-xl" style={{ background: "var(--primary-soft)", color: "var(--ink-soft)" }}>
        This is what turns generic sales coaching into coaching on <b>your</b> method. The more specifically
        you describe what good looks like here, the more useful the feedback — and the harsher it can
        fairly be. Changes apply to the next practice call; nothing needs redeploying.
      </p>

      {/* What good looks like */}
      <div className="rounded-2xl p-4 mb-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-2">
          <div className="sw-display text-sm" style={{ color: "var(--ink-faint)", fontWeight: 600, letterSpacing: "0.03em" }}>WHAT GOOD LOOKS LIKE</div>
          <div className="flex items-center gap-2">
            {savedCfg && <CheckCircle2 size={15} style={{ color: "var(--green)" }} />}
            <button disabled={!cfgDirty || savingCfg}
              onClick={async () => { setSavingCfg(true); await onSaveSettings({ rubric, what_good_looks_like: method }); setSavingCfg(false); setSavedCfg(true); setTimeout(() => setSavedCfg(false), 1600); }}
              className="sw-focus text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: cfgDirty ? "var(--primary)" : "var(--surface-alt)", color: cfgDirty ? "#fff" : "var(--ink-faint)" }}>
              {savingCfg ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
        <p className="text-xs mb-2" style={{ color: "var(--ink-faint)" }}>
          Your discovery framework, objection handling, tone, closing. This is judged against on every turn
          and in the end-of-call review.
        </p>
        <textarea className="sw-input sw-focus" rows={12} value={method} onChange={(e) => setMethod(e.target.value)}
          style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }} />

        <div className="sw-display font-bold text-sm mt-4 mb-2" style={{ color: "var(--ink-soft)" }}>SCORING SCALE</div>
        <p className="text-xs mb-2" style={{ color: "var(--ink-faint)" }}>
          Keep the six keywords — the app colours the badges from them — but change what earns each one.
        </p>
        <textarea className="sw-input sw-focus" rows={9} value={rubric} onChange={(e) => setRubric(e.target.value)}
          style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }} />
      </div>

      {/* Scenarios */}
      <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="px-3 py-2 flex items-center justify-between" style={{ background: "var(--surface-alt)" }}>
          <span className="text-xs font-bold uppercase" style={{ color: "var(--ink-soft)" }}>Scenarios</span>
          <span className="text-xs" style={{ color: "var(--ink-faint)" }}>{scenarios.length}</span>
        </div>
        {scenarios.map((s) => (
          <CoachScenarioRow key={s.id} s={s} onSave={onSaveScenario} onDelete={onDeleteScenario} />
        ))}
        <div className="flex items-center gap-2 px-3 py-2" style={{ borderTop: "2px solid var(--border)", background: "var(--surface-alt)" }}>
          <input className="sw-input sw-focus" style={{ maxWidth: 260 }} placeholder="New scenario name"
            value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
          <button disabled={!newLabel.trim()}
            onClick={async () => { await onAddScenario(newLabel.trim()); setNewLabel(""); }}
            className="sw-focus text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1"
            style={{ background: newLabel.trim() ? "var(--primary)" : "var(--surface)", color: newLabel.trim() ? "#fff" : "var(--ink-faint)", border: "1px solid var(--border)" }}>
            <Plus size={12} /> Add scenario
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  OTHER VISUALS — charts that don't earn their place on a daily view     */
/* ---------------------------------------------------------------------- */

function OtherVisualsView({ orders, netsuite, forecasts, staff }) {
  const [period, setPeriod] = useState("mtd");
  const [team, setTeam] = useState("All");

  const teamOptions = useMemo(() => {
    const s = new Set();
    (staff || []).forEach((x) => { if (x.team && x.sells !== false) s.add(x.team); });
    SELLING_TEAMS.forEach((t) => s.add(t));
    return Array.from(s).sort();
  }, [staff]);

  const inTeam = (ct, lt) => team === "All" || ct === team || lt === team;

  const data = useMemo(() => {
    const months = [];
    const base = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("en-GB", { month: "short" }),
      });
    }
    const idx = {};
    months.forEach((m, i) => { idx[m.key] = i; });
    const monthOf = (dstr) => {
      if (!dstr) return null;
      const d = new Date(dstr);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    };

    const claimed = new Array(6).fill(0);
    const statted = new Array(6).fill(0);
    const forecast = new Array(6).fill(0);

    (orders || []).forEach((o) => {
      if (o.removed_at || !inTeam(o.closer_team, o.lead_gen_team)) return;
      const i = idx[monthOf(o.submission_date)];
      if (i !== undefined) claimed[i] += num(o.gp_office != null ? o.gp_office : o.sales_agent_gp);
    });
    (netsuite || []).forEach((n) => {
      if (!inTeam(n.closer_team, n.referrer_team)) return;
      const i = idx[monthOf(n.order_date ? n.order_date + "T00:00:00" : null)];
      if (i !== undefined && n.count_gp !== false) statted[i] += num(n.gp_office);
    });
    (forecasts || []).forEach((f) => {
      if (!inTeam(f.agent_team, f.lead_gen_team)) return;
      const i = idx[monthOf(f.forecast_date || f.forecast_week)];
      if (i !== undefined) forecast[i] += num(f.gp);
    });

    // Top deals in the chosen period
    const from = periodStart(period);
    const top = (orders || [])
      .filter((o) => !o.removed_at && inTeam(o.closer_team, o.lead_gen_team))
      .filter((o) => !from || (o.submission_date && new Date(o.submission_date) >= from))
      .map((o) => ({
        company: o.company_name,
        agent: o.closer_name,
        gp: num(o.gp_office != null ? o.gp_office : o.sales_agent_gp),
        sov: num(o.contract_value),
      }))
      .sort((a, b) => b.gp - a.gp)
      .slice(0, 10);

    const fcTotal = forecast.reduce((s, v) => s + v, 0);
    const stTotal = statted.reduce((s, v) => s + v, 0);

    return {
      months: months.map((m) => m.label),
      claimed, statted, forecast, top,
      accuracy: fcTotal ? (stTotal / fcTotal) * 100 : 0,
    };
  }, [orders, netsuite, forecasts, team, period]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <BarChart3 size={18} style={{ color: "var(--primary)" }} />
        <h2 className="sw-display text-lg" style={{ fontWeight: 600 }}>Other Visuals</h2>
        <span className="text-xs" style={{ color: "var(--ink-faint)" }}>Trends and league tables, off the daily view</span>
        <div className="ml-auto flex items-center gap-2">
          <select className="sw-input sw-focus" style={{ width: 150 }} value={team} onChange={(e) => setTeam(e.target.value)}>
            <option value="All">All teams</option>
            {teamOptions.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="sw-input sw-focus" style={{ width: 110 }} value={period} onChange={(e) => setPeriod(e.target.value)}>
            {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "0.75rem" }} className="mb-3">
        <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-xs font-medium uppercase" style={{ color: "var(--ink-faint)", letterSpacing: "0.04em" }}>Statted vs forecast</span>
            <span className="text-xs" style={{ color: data.accuracy >= 90 ? "var(--green)" : data.accuracy >= 70 ? "var(--amber)" : "var(--red)" }}>
              {data.accuracy.toFixed(0)}% delivered
            </span>
          </div>
          <TargetBars groups={data.months.map((m, i) => ({ label: m, actual: data.statted[i], target: data.forecast[i] }))} />
        </div>

        <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="text-xs font-medium uppercase mb-3" style={{ color: "var(--ink-faint)", letterSpacing: "0.04em" }}>Claimed vs statted</div>
          <LineChart series={[
            { name: "Claimed", colour: "#4C1D8F", points: data.months.map((m, i) => ({ label: m, value: data.claimed[i] })) },
            { name: "Statted", colour: "#1B7038", points: data.months.map((m, i) => ({ label: m, value: data.statted[i] })) },
          ]} />
        </div>
      </div>

      <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="text-xs font-medium uppercase mb-3" style={{ color: "var(--ink-faint)", letterSpacing: "0.04em" }}>
          Top 10 deals · {periodLabelFor(period)}
        </div>
        {data.top.length === 0 ? (
          <div className="text-xs text-center py-6" style={{ color: "var(--ink-faint)" }}>No deals in this period.</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {data.top.map((d, i) => {
              const max = data.top[0].gp || 1;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="sw-mono shrink-0" style={{ fontSize: 11, color: "var(--ink-faint)", width: 16 }}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-medium truncate">{d.company}</span>
                      <span className="sw-mono text-xs font-semibold shrink-0">{fmtGBP(d.gp)}</span>
                    </div>
                    <div className="rounded-full mt-1" style={{ height: 3, background: "var(--surface-alt)" }}>
                      <div className="rounded-full" style={{ width: `${(d.gp / max) * 100}%`, height: "100%", background: "var(--primary)" }} />
                    </div>
                  </div>
                  <span className="text-xs shrink-0 truncate" style={{ color: "var(--ink-faint)", width: 130 }}>{d.agent}</span>
                  <span className="sw-mono text-xs shrink-0" style={{ color: "var(--ink-soft)", width: 86, textAlign: "right" }}>{fmtGBP(d.sov)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  SETTINGS — office-only, holds Statuses and Pay Plans                   */
/* ---------------------------------------------------------------------- */

function SettingsView({ statusRows, onSaveStatus, newCount, plans, staff, onSavePlan, onAddPlan, onDeletePlan,
                       coachScenarios, coachSettings, onSaveCoachScenario, onAddCoachScenario, onDeleteCoachScenario, onSaveCoachSettings,
                       orders, netsuite, forecasts }) {
  const [section, setSection] = useState("statuses");
  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        {[
          { key: "statuses", label: "Order Statuses", icon: Palette, badge: newCount },
          { key: "payplans", label: "Pay Plans", icon: Target, badge: 0 },
          { key: "coach", label: "Coach Setup", icon: Headphones, badge: 0 },
          { key: "visuals", label: "Other Visuals", icon: BarChart3, badge: 0 },
        ].map((s) => (
          <button key={s.key} onClick={() => setSection(s.key)}
            className="sw-focus px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5"
            style={section === s.key
              ? { background: "var(--primary)", color: "#fff" }
              : { background: "var(--surface)", color: "var(--ink-soft)", border: "1px solid var(--border)" }}>
            <s.icon size={14} /> {s.label}
            {s.badge > 0 && <span className="rounded-full px-1.5 text-xs font-bold" style={{ background: "var(--amber)", color: "#fff" }}>{s.badge}</span>}
          </button>
        ))}
      </div>
      {section === "statuses" && <StatusSettingsView rows={statusRows} onSave={onSaveStatus} newCount={newCount} />}
      {section === "payplans" && <PayPlansView plans={plans} staff={staff} onSave={onSavePlan} onAdd={onAddPlan} onDelete={onDeletePlan} />}
      {section === "visuals" && (
        <OtherVisualsView orders={orders} netsuite={netsuite} forecasts={forecasts} staff={staff} />
      )}
      {section === "coach" && (
        <CoachSettingsView scenarios={coachScenarios} settings={coachSettings}
          onSaveScenario={onSaveCoachScenario} onAddScenario={onAddCoachScenario}
          onDeleteScenario={onDeleteCoachScenario} onSaveSettings={onSaveCoachSettings} />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  ADMIN — office-only: manage staff records, roles, teams                */
/* ---------------------------------------------------------------------- */

const ROLE_OPTIONS = ["office", "2ic", "agent"];

function StaffRow({ s, profileForStaff, onSaveStaff, onSaveProfile, onResetPassword, onSetActive, plans }) {
  const [edit, setEdit] = useState({
    full_name: s.full_name || "", uin: s.uin || "", email: s.email || "",
    manager_name: s.manager_name || "", manager_email: s.manager_email || "",
    team: s.team || "", sells: !!s.sells,
    pay_plan_id: s.pay_plan_id || "",
    alt_name: s.alt_name || "",
  });
  const [roleEdit, setRoleEdit] = useState(profileForStaff?.role || "");
  const [teamEdit, setTeamEdit] = useState(profileForStaff?.team || s.team || "");
  const [savingStaff, setSavingStaff] = useState(false);
  const [savingRole, setSavingRole] = useState(false);
  const [saved, setSaved] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  const staffDirty = Object.keys(edit).some((k) => String(edit[k]) !== String(s[k] ?? (k === "sells" ? true : "")));
  const roleDirty = profileForStaff && (roleEdit !== profileForStaff.role || teamEdit !== (profileForStaff.team || ""));

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1500); };

  return (
    <tr style={{ borderTop: "1px solid var(--border)", opacity: s.active === false ? 0.55 : 1 }}>
      <td className="px-3 py-2">
        <input className="sw-input sw-focus" style={{ minWidth: 130 }} value={edit.full_name} onChange={(e) => setEdit((p) => ({ ...p, full_name: e.target.value }))} />
        {s.active === false && <div className="text-xs mt-0.5" style={{ color: "var(--ink-faint)", fontSize: 10 }}>Ex employee</div>}
      </td>
      <td className="px-3 py-2">
        <input className="sw-input sw-focus" style={{ minWidth: 120 }} value={edit.alt_name}
          onChange={(e) => setEdit((p) => ({ ...p, alt_name: e.target.value }))}
          placeholder="if NetSuite differs" title="A second spelling of this person's name, as NetSuite writes it" />
      </td>
      <td className="px-3 py-2"><input className="sw-input sw-focus" style={{ width: 90 }} value={edit.uin} onChange={(e) => setEdit((p) => ({ ...p, uin: e.target.value }))} placeholder="—" /></td>
      <td className="px-3 py-2"><input className="sw-input sw-focus" style={{ minWidth: 170 }} value={edit.email} onChange={(e) => setEdit((p) => ({ ...p, email: e.target.value }))} /></td>
      <td className="px-3 py-2"><input className="sw-input sw-focus" style={{ minWidth: 110 }} value={edit.team} onChange={(e) => setEdit((p) => ({ ...p, team: e.target.value }))} list="team-suggestions" /></td>
      <td className="px-3 py-2 text-center"><input type="checkbox" checked={edit.sells} onChange={(e) => setEdit((p) => ({ ...p, sells: e.target.checked }))} /></td>
      <td className="px-3 py-2">
        <select className="sw-input sw-focus" style={{ minWidth: 130 }} value={edit.pay_plan_id || ""}
          onChange={(e) => setEdit((p) => ({ ...p, pay_plan_id: e.target.value }))}>
          <option value="">No plan</option>
          {(plans || []).filter((p) => p.active !== false).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <button
          disabled={!staffDirty || savingStaff}
          onClick={async () => { setSavingStaff(true); await onSaveStaff(s.id, { ...edit, pay_plan_id: edit.pay_plan_id || null }); setSavingStaff(false); flash(); }}
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
      <td className="px-3 py-2">
        {s.email && (
          resetting ? (
            <div className="flex items-center gap-1">
              <input className="sw-input sw-focus" style={{ width: 130 }} type="text" placeholder="New password"
                value={newPw} onChange={(e) => setNewPw(e.target.value)} autoFocus />
              <button
                disabled={newPw.length < 8 || savingPw}
                onClick={async () => {
                  setSavingPw(true);
                  const ok = await onResetPassword(s.email, newPw);
                  setSavingPw(false);
                  if (ok) { setResetting(false); setNewPw(""); flash(); }
                }}
                className="sw-focus text-xs font-semibold px-2 py-1.5 rounded-lg"
                style={{ background: newPw.length >= 8 ? "var(--primary)" : "var(--surface-alt)", color: newPw.length >= 8 ? "#fff" : "var(--ink-faint)" }}
              >{savingPw ? "..." : "Set"}</button>
              <button onClick={() => { setResetting(false); setNewPw(""); }} className="sw-focus text-xs px-1.5 py-1.5 rounded-lg" style={{ color: "var(--ink-soft)" }}>✕</button>
            </div>
          ) : (
            <button onClick={() => { setResetting(true); setNewPw("Welcome2026"); }}
              className="sw-focus text-xs font-semibold px-2.5 py-1.5 rounded-lg"
              style={{ background: "var(--surface-alt)", color: "var(--ink-soft)", border: "1px solid var(--border)" }}
              title="Set a new password for this person">
              <KeyRound size={11} style={{ display: "inline", marginRight: 3 }} /> Password
            </button>
          )
        )}
      </td>
      <td className="px-3 py-2">
        <button onClick={() => onSetActive(s.id, s.active === false, s.full_name)}
          className="sw-focus text-xs font-semibold px-2.5 py-1.5 rounded-lg whitespace-nowrap"
          style={s.active === false
            ? { background: "var(--green-soft)", color: "var(--green)", border: "1px solid var(--green)" }
            : { background: "var(--surface-alt)", color: "var(--ink-soft)", border: "1px solid var(--border)" }}
          title={s.active === false ? "Bring back — you'll need to set a password after" : "Mark as a leaver and lock their login"}>
          {s.active === false ? "Reinstate" : "Mark leaver"}
        </button>
      </td>
      <td className="px-2 text-center">{saved && <CheckCircle2 size={14} style={{ color: "var(--green)" }} />}</td>
    </tr>
  );
}

function AddStaffRow({ onAdd }) {
  const blank = { full_name: "", alt_name: "", uin: "", email: "", manager_name: "", manager_email: "", team: "", sells: true, active: true };
  const [f, setF] = useState(blank);
  const [saving, setSaving] = useState(false);
  const canAdd = f.full_name.trim().length > 0;
  return (
    <tr style={{ borderTop: "2px solid var(--border)", background: "var(--surface-alt)" }}>
      <td className="px-3 py-2"><input className="sw-input sw-focus" placeholder="Full name" value={f.full_name} onChange={(e) => setF((p) => ({ ...p, full_name: e.target.value }))} /></td>
      <td className="px-3 py-2"><input className="sw-input sw-focus" style={{ width: 120 }} placeholder="Also known as" value={f.alt_name} onChange={(e) => setF((p) => ({ ...p, alt_name: e.target.value }))} /></td>
      <td className="px-3 py-2"><input className="sw-input sw-focus" style={{ width: 90 }} placeholder="UIN" value={f.uin} onChange={(e) => setF((p) => ({ ...p, uin: e.target.value }))} /></td>
      <td className="px-3 py-2"><input className="sw-input sw-focus" placeholder="Email" value={f.email} onChange={(e) => setF((p) => ({ ...p, email: e.target.value }))} /></td>
      <td className="px-3 py-2"><input className="sw-input sw-focus" placeholder="Team" value={f.team} onChange={(e) => setF((p) => ({ ...p, team: e.target.value }))} list="team-suggestions" /></td>
      <td className="px-3 py-2 text-center"><input type="checkbox" checked={f.sells} onChange={(e) => setF((p) => ({ ...p, sells: e.target.checked }))} /></td>
      <td className="px-3 py-2" colSpan={7}>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: f.active ? "var(--ink-soft)" : "var(--amber)" }}
            title="An ex employee still counts toward historical team figures but can't sign in">
            <input type="checkbox" checked={!f.active} onChange={(e) => setF((p) => ({ ...p, active: !e.target.checked }))} />
            Ex employee
          </label>
          <button
            disabled={!canAdd || saving}
            onClick={async () => { setSaving(true); await onAdd(f); setF(blank); setSaving(false); }}
            className="sw-focus text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1"
            style={{ background: canAdd ? "var(--primary)" : "var(--surface)", color: canAdd ? "#fff" : "var(--ink-faint)", border: "1px solid var(--border)" }}
          ><Plus size={12} /> {saving ? "Adding..." : "Add Staff"}</button>
          {!f.active && (
            <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
              Name and team are enough — no email needed.
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

/* Staff who aren't fully set up yet, and NetSuite names nothing matches.
   Both are silent problems — figures quietly land nowhere. */
function AdminIssues({ staff, netsuite, aliases, onAddAlias, onDeleteAlias, plans }) {
  const [newAlias, setNewAlias] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [tab, setTab] = useState("staff");

  const issues = useMemo(() => (staff || []).map((s) => {
    const problems = [];
    if (!s.user_id) problems.push("never signed in");
    if (!s.team) problems.push("no team");
    if (s.sells !== false && !s.pay_plan_id) problems.push("no pay plan");
    if (!s.email) problems.push("no email");
    if (!s.uin) problems.push("no UIN");
    return { ...s, problems };
  }).filter((s) => s.problems.length), [staff]);

  // NetSuite names that match neither a staff record nor an existing alias
  const unmatched = useMemo(() => {
    const known = new Set((staff || []).map((s) => String(s.full_name || "").toLowerCase()));
    const aliased = new Set((aliases || []).map((a) => String(a.alias || "").toLowerCase()));
    const counts = {};
    (netsuite || []).forEach((n) => {
      [n.closer_name, n.referrer_name].forEach((nm) => {
        if (!nm) return;
        const k = String(nm).trim();
        if (!k || known.has(k.toLowerCase()) || aliased.has(k.toLowerCase())) return;
        counts[k] = (counts[k] || 0) + 1;
      });
    });
    return Object.keys(counts).map((name) => ({ name, count: counts[name] })).sort((a, b) => b.count - a.count);
  }, [netsuite, staff, aliases]);

  const sellers = (staff || []).filter((s) => s.sells !== false);

  return (
    <div className="rounded-2xl overflow-hidden mb-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
        <AlertTriangle size={15} style={{ color: unmatched.length || issues.length ? "var(--amber)" : "var(--green)" }} />
        <span className="sw-display font-bold text-sm">Needs attention</span>
        <div className="ml-auto flex items-center gap-1.5">
          {[["staff", `Setup (${issues.length})`], ["names", `Unmatched names (${unmatched.length})`]].map(([k, lbl]) => (
            <button key={k} onClick={() => setTab(k)} className="sw-focus px-3 py-1.5 rounded-full text-xs font-semibold"
              style={tab === k ? { background: "var(--primary)", color: "#fff" } : { background: "var(--surface-alt)", color: "var(--ink-soft)" }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {tab === "staff" && (
        issues.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs" style={{ color: "var(--green)" }}>Everyone is fully set up.</div>
        ) : (
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            <table className="w-full text-sm">
              <tbody>
                {issues.map((s) => (
                  <tr key={s.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td className="px-3 py-1.5 text-xs font-semibold" style={{ minWidth: 150 }}>{s.full_name}</td>
                    <td className="px-3 py-1.5 text-xs" style={{ color: "var(--ink-faint)" }}>{s.team || "—"}</td>
                    <td className="px-3 py-1.5">
                      <div className="flex gap-1.5 flex-wrap">
                        {s.problems.map((p) => (
                          <span key={p} className="text-xs font-semibold px-1.5 py-0.5 rounded"
                            style={{ background: "var(--amber-soft)", color: "var(--amber)", fontSize: 10 }}>{p}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === "names" && (
        <>
          <div className="px-3 py-2 flex items-center gap-2 flex-wrap" style={{ background: "var(--surface-alt)" }}>
            <input className="sw-input sw-focus" style={{ maxWidth: 200 }} placeholder="Name as NetSuite spells it"
              value={newAlias} onChange={(e) => setNewAlias(e.target.value)} />
            <span className="text-xs" style={{ color: "var(--ink-faint)" }}>is really</span>
            <select className="sw-input sw-focus" style={{ maxWidth: 200 }} value={newTarget} onChange={(e) => setNewTarget(e.target.value)}>
              <option value="">Select the agent...</option>
              {sellers.map((s) => <option key={s.full_name} value={s.full_name}>{s.full_name}</option>)}
            </select>
            <button disabled={!newAlias.trim() || !newTarget}
              onClick={async () => { await onAddAlias(newAlias, newTarget); setNewAlias(""); setNewTarget(""); }}
              className="sw-focus px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: newAlias.trim() && newTarget ? "var(--primary)" : "var(--surface)", color: newAlias.trim() && newTarget ? "#fff" : "var(--ink-faint)", border: "1px solid var(--border)" }}>
              Add mapping
            </button>
          </div>

          {unmatched.length > 0 && (
            <div className="px-3 py-2" style={{ borderTop: "1px solid var(--border)" }}>
              <div className="text-xs font-semibold uppercase mb-1.5" style={{ color: "var(--amber)" }}>
                In NetSuite but not in the staff list
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {unmatched.map((u) => (
                  <button key={u.name} onClick={() => setNewAlias(u.name)}
                    className="sw-focus text-xs px-2 py-1 rounded-lg"
                    style={{ background: "var(--amber-soft)", color: "var(--ink)" }}
                    title="Click to start a mapping for this name">
                    {u.name} <span style={{ color: "var(--ink-faint)" }}>×{u.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            <table className="w-full text-sm">
              <tbody>
                {(aliases || []).map((a) => (
                  <tr key={a.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td className="px-3 py-1.5 text-xs">{a.alias}</td>
                    <td className="px-3 py-1.5 text-xs" style={{ color: "var(--ink-faint)" }}>→</td>
                    <td className="px-3 py-1.5 text-xs font-semibold">{a.staff_full_name}</td>
                    <td className="px-3 py-1.5 text-right">
                      <button onClick={() => onDeleteAlias(a.id)} className="sw-focus text-xs" style={{ color: "var(--red)" }}>✕</button>
                    </td>
                  </tr>
                ))}
                {(aliases || []).length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-5 text-center text-xs" style={{ color: "var(--ink-faint)" }}>
                    No mappings yet. Add one above when a NetSuite name doesn't match the staff list.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function AdminView({ staff, profiles, onSaveStaff, onAddStaff, onSaveProfile, onResetPassword, onSetActive, plans,
                    netsuite, aliases, onAddAlias, onDeleteAlias }) {
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
      <AdminIssues staff={staff} netsuite={netsuite} aliases={aliases}
        onAddAlias={onAddAlias} onDeleteAlias={onDeleteAlias} plans={plans} />

      <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--surface-alt)" }}>
                {["Name", "Also known as", "UIN", "Email", "Team", "Sells", "Pay Plan", "", "Role", "", "Password", "Status", ""].map((h, i) => (
                  <th key={i} className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <StaffRow key={s.id} s={s} profileForStaff={s.user_id ? profileByUserId[s.user_id] : null} onSaveStaff={onSaveStaff} onSaveProfile={onSaveProfile} onResetPassword={onResetPassword} onSetActive={onSetActive} plans={plans} />
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
/*  LIVE SALES COACH — AI roleplay practice calls                          */
/*  Isolated by design: the coach function has no database access.         */
/* ---------------------------------------------------------------------- */

const COACH_SCENARIOS = [
  { key: "cold_call",  label: "Cold call",        blurb: "Busy owner who didn't ask for this call" },
  { key: "objection",  label: "Objection handling", blurb: "Interested but pushing back hard" },
  { key: "renewal",    label: "Renewal",           blurb: "Lukewarm customer with a cheaper quote" },
  { key: "gatekeeper", label: "Gatekeeper",        blurb: "Receptionist screening you out" },
  { key: "angry",      label: "Angry customer",    blurb: "Order went wrong, nobody called back" },
];

const SCORE_STYLE = {
  brilliant:  { sym: "!!", label: "Brilliant",  fg: "#0E7C6B", bg: "#DEF5F0" },
  excellent:  { sym: "!",  label: "Excellent",  fg: "var(--green)", bg: "var(--green-soft)" },
  good:       { sym: "",   label: "Good",       fg: "var(--blue)",  bg: "var(--blue-soft)" },
  inaccuracy: { sym: "?!", label: "Inaccuracy", fg: "var(--amber)", bg: "var(--amber-soft)" },
  mistake:    { sym: "?",  label: "Mistake",    fg: "#C4600E",      bg: "#FBE6D2" },
  blunder:    { sym: "??", label: "Blunder",    fg: "var(--red)",   bg: "var(--red-soft)" },
};
const SCORE_POINTS = { brilliant: 3, excellent: 2, good: 1, inaccuracy: -1, mistake: -2, blunder: -4 };

function ScoreBadge({ score }) {
  const s = SCORE_STYLE[score] || SCORE_STYLE.good;
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap"
      style={{ color: s.fg, background: s.bg }}>
      {s.sym && <span className="sw-mono">{s.sym}</span>}{s.label}
    </span>
  );
}

function SalesCoachView() {
  const [scenario, setScenario] = useState("cold_call");
  const [status, setStatus] = useState("idle");      // idle | live | thinking | ended
  const [turns, setTurns] = useState([]);            // {role, text, score, note}
  const [interim, setInterim] = useState("");
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [speakBack, setSpeakBack] = useState(true);
  const [typed, setTyped] = useState("");
  const [history, setHistory] = useState([]);
  const [openSession, setOpenSession] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  const [coachCfg, setCoachCfg] = useState({ rubric: "", what_good_looks_like: "" });

  // Scenarios and the grading rubric are managed in Settings, not in code.
  useEffect(() => {
    supabase.from("coach_scenarios").select("*").eq("active", true).order("sort_order")
      .then(({ data }) => {
        if (data && data.length) {
          setScenarios(data);
          setScenario((cur) => (data.some((s) => s.key === cur) ? cur : data[0].key));
        } else {
          setScenarios(COACH_SCENARIOS);
        }
      });
    supabase.from("coach_settings").select("*").eq("id", 1).maybeSingle()
      .then(({ data }) => { if (data) setCoachCfg(data); });
  }, []);

  const activeScenario = useMemo(
    () => (scenarios || []).find((s) => s.key === scenario) || null,
    [scenarios, scenario]
  );

  const loadHistory = useCallback(async () => {
    const { data } = await supabase
      .from("coach_sessions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(40);
    setHistory(data || []);
  }, []);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  const recogRef = useRef(null);
  const scrollRef = useRef(null);
  const turnsRef = useRef([]);
  useEffect(() => { turnsRef.current = turns; }, [turns]);

  const supported = typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [turns, interim]);

  // ---- talking to the coach function --------------------------------
  const callCoach = useCallback(async (mode, history) => {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    const res = await fetch(`${SUPABASE_URL}/functions/v1/sales-coach`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        mode, scenario, history,
        persona: activeScenario?.persona || null,
        rubric: coachCfg.rubric || null,
        method: coachCfg.what_good_looks_like || null,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Coach unavailable (${res.status}). ${t.slice(0, 160)}`);
    }
    return res.json();
  }, [scenario, activeScenario, coachCfg]);

  const say = useCallback((text) => {
    if (!speakBack || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    u.lang = "en-GB";
    window.speechSynthesis.speak(u);
  }, [speakBack]);

  // ---- submit one agent turn ----------------------------------------
  const submitTurn = useCallback(async (text) => {
    const clean = (text || "").trim();
    if (!clean) return;
    setError("");
    const withAgent = [...turnsRef.current, { role: "agent", text: clean }];
    setTurns(withAgent);
    setInterim("");
    setStatus("thinking");
    try {
      const r = await callCoach("turn", withAgent.map(({ role, text }) => ({ role, text })));
      setTurns((prev) => {
        const copy = [...prev];
        // attach the score to the agent turn we just sent
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].role === "agent" && !copy[i].score) {
            copy[i] = { ...copy[i], score: r.score || "good", note: r.note || "" };
            break;
          }
        }
        return [...copy, { role: "customer", text: r.customer || "..." }];
      });
      say(r.customer);
      setStatus("live");
    } catch (e) {
      setError(e && e.message ? String(e.message) : String(e));
      setStatus("live");
    }
  }, [callCoach, say]);

  // ---- speech recognition -------------------------------------------
  const startListening = useCallback(() => {
    if (!supported) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.lang = "en-GB";
    r.continuous = true;
    r.interimResults = true;

    let buffer = "";
    let silence = null;

    r.onresult = (ev) => {
      let interimText = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        if (res.isFinal) buffer += res[0].transcript + " ";
        else interimText += res[0].transcript;
      }
      setInterim(buffer + interimText);
      // Send the turn after a pause, the way a real conversation hands over
      clearTimeout(silence);
      silence = setTimeout(() => {
        const toSend = buffer.trim();
        buffer = "";
        if (toSend) submitTurn(toSend);
      }, 1400);
    };
    r.onerror = (ev) => {
      if (ev.error === "not-allowed") setError("Microphone blocked — allow access in your browser and try again.");
      else if (ev.error !== "no-speech" && ev.error !== "aborted") setError(`Microphone: ${ev.error}`);
    };
    r.onend = () => { if (recogRef.current === r) { try { r.start(); } catch (_) {} } };

    recogRef.current = r;
    try { r.start(); } catch (_) {}
  }, [supported, submitTurn]);

  const stopListening = useCallback(() => {
    const r = recogRef.current;
    recogRef.current = null;
    if (r) { try { r.onend = null; r.stop(); } catch (_) {} }
    setInterim("");
  }, []);

  useEffect(() => () => stopListening(), [stopListening]);

  // ---- call lifecycle ------------------------------------------------
  const startCall = useCallback(async () => {
    setTurns([]); setSummary(null); setError(""); setInterim("");
    setStatus("thinking");
    try {
      const r = await callCoach("turn", []);
      setTurns([{ role: "customer", text: r.customer || "Hello?" }]);
      say(r.customer);
      setStatus("live");
      startListening();
    } catch (e) {
      setError(e && e.message ? String(e.message) : String(e));
      setStatus("idle");
    }
  }, [callCoach, say, startListening]);

  const endCall = useCallback(async () => {
    stopListening();
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    setStatus("thinking");
    try {
      const finalTurns = turnsRef.current;
      const r = await callCoach("summary", finalTurns.map(({ role, text }) => ({ role, text })));
      setSummary(r);

      // Keep the call so it can be looked back on — and so managers can
      // see progress over time rather than one call in isolation.
      const agentTurns = finalTurns.filter((t) => t.role === "agent" && t.score);
      const tally = agentTurns.reduce((m, t) => { m[t.score] = (m[t.score] || 0) + 1; return m; }, {});
      const pts = agentTurns.reduce((s, t) => s + (SCORE_POINTS[t.score] ?? 0), 0);
      if (agentTurns.length > 0) {
        const { data: sess } = await supabase.auth.getSession();
        await supabase.from("coach_sessions").insert({
          user_id: sess?.session?.user?.id || null,
          user_name: sess?.session?.user?.email || null,
          scenario,
          grade: r.grade || null,
          headline: r.headline || null,
          strengths: r.strengths || [],
          improvements: r.improvements || [],
          moment: r.moment || null,
          points: pts,
          turn_count: agentTurns.length,
          tally,
          transcript: finalTurns,
        });
        loadHistory();
      }
    } catch (e) {
      setError(e && e.message ? String(e.message) : String(e));
    }
    setStatus("ended");
  }, [callCoach, stopListening, scenario, loadHistory]);

  // ---- running score --------------------------------------------------
  const scored = turns.filter((t) => t.role === "agent" && t.score);
  const points = scored.reduce((s, t) => s + (SCORE_POINTS[t.score] ?? 0), 0);
  const tally = scored.reduce((m, t) => { m[t.score] = (m[t.score] || 0) + 1; return m; }, {});

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Headphones size={18} style={{ color: "var(--primary)" }} />
        <h2 className="sw-display text-lg font-bold">Live Sales Coach</h2>
        <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
          Practice call · nothing here touches live customer data
        </span>
      </div>

      {!supported && (
        <div className="rounded-xl p-3 mb-4 text-sm" style={{ background: "var(--amber-soft)", color: "var(--ink-soft)" }}>
          <b>Speech isn't supported in this browser.</b> Use Chrome or Edge for voice.
          You can still practise by typing your side of the call.
        </div>
      )}
      {error && (
        <div className="rounded-xl p-3 mb-4 text-sm" style={{ background: "var(--red-soft)", color: "var(--red)" }}>{error}</div>
      )}

      {/* Scenario picker — only before a call starts */}
      {status === "idle" && (
        <>
          <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--ink-soft)" }}>Choose a scenario</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "0.6rem" }} className="mb-4">
            {(scenarios.length ? scenarios : COACH_SCENARIOS).map((s) => (
              <button key={s.key} onClick={() => setScenario(s.key)}
                className="sw-focus rounded-xl p-3 text-left"
                style={scenario === s.key
                  ? { background: "var(--primary)", color: "#fff", border: "1px solid var(--primary)" }
                  : { background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="font-semibold text-sm">{s.label}</div>
                <div className="text-xs mt-0.5" style={{ color: scenario === s.key ? "rgba(255,255,255,0.8)" : "var(--ink-faint)" }}>{s.blurb}</div>
              </button>
            ))}
          </div>
          <button onClick={startCall} className="sw-focus px-5 py-3 rounded-full font-semibold text-sm flex items-center gap-2"
            style={{ background: "var(--primary)", color: "#fff" }}>
            <Phone size={15} /> Start practice call
          </button>
        </>
      )}

      {/* Live call */}
      {(status === "live" || status === "thinking" || status === "ended") && (
        <>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
              {(scenarios.length ? scenarios : COACH_SCENARIOS).find((s) => s.key === scenario)?.label}
            </span>
            {status !== "ended" && (
              <span className="text-xs flex items-center gap-1" style={{ color: recogRef.current ? "var(--green)" : "var(--ink-faint)" }}>
                <Radio size={10} className={recogRef.current ? "sw-live-dot" : ""} /> {recogRef.current ? "Listening" : "Mic off"}
              </span>
            )}
            {scored.length > 0 && (
              <span className="text-xs sw-mono font-bold px-2.5 py-1 rounded-full"
                style={{ background: points >= 0 ? "var(--green-soft)" : "var(--red-soft)", color: points >= 0 ? "var(--green)" : "var(--red)" }}>
                {points > 0 ? "+" : ""}{points}
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: "var(--ink-soft)" }}>
                <input type="checkbox" checked={speakBack} onChange={(e) => setSpeakBack(e.target.checked)} /> Customer speaks
              </label>
              {status !== "ended" && (
                <button onClick={endCall} className="sw-focus px-3 py-1.5 rounded-full text-xs font-semibold text-white"
                  style={{ background: "var(--red)" }}>End call</button>
              )}
              {status === "ended" && (
                <button onClick={() => { setStatus("idle"); setTurns([]); setSummary(null); }}
                  className="sw-focus px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{ background: "var(--primary)", color: "#fff" }}>New call</button>
              )}
            </div>
          </div>

          <div ref={scrollRef} className="rounded-2xl p-4 mb-3"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", height: 420, overflowY: "auto" }}>
            {turns.map((t, i) => (
              <div key={i} className="mb-3">
                <div className="flex items-start gap-2">
                  <span className="text-xs font-bold shrink-0 px-2 py-0.5 rounded"
                    style={t.role === "agent"
                      ? { background: "var(--primary-soft)", color: "var(--primary)" }
                      : { background: "var(--surface-alt)", color: "var(--ink-soft)" }}>
                    {t.role === "agent" ? "YOU" : "THEM"}
                  </span>
                  <div className="flex-1">
                    <div className="text-sm">{t.text}</div>
                    {t.score && (
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <ScoreBadge score={t.score} />
                        {t.note && <span className="text-xs" style={{ color: "var(--ink-soft)" }}>{t.note}</span>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {interim && (
              <div className="flex items-start gap-2 mb-3" style={{ opacity: 0.55 }}>
                <span className="text-xs font-bold shrink-0 px-2 py-0.5 rounded" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>YOU</span>
                <div className="text-sm italic">{interim}</div>
              </div>
            )}
            {status === "thinking" && (
              <div className="flex items-center gap-2 text-xs" style={{ color: "var(--ink-faint)" }}>
                <Loader2 size={13} className="animate-spin" /> thinking...
              </div>
            )}
          </div>

          {/* Typed fallback — also handy if you'd rather practise silently */}
          {status !== "ended" && (
            <div className="flex items-center gap-2 mb-4">
              <input className="sw-input sw-focus" placeholder="...or type your line and press Enter"
                value={typed} onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && typed.trim()) { submitTurn(typed); setTyped(""); } }} />
              <button onClick={() => { if (typed.trim()) { submitTurn(typed); setTyped(""); } }}
                className="sw-focus px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "var(--primary)" }}>Send</button>
              {supported && (
                recogRef.current
                  ? <button onClick={stopListening} className="sw-focus px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--ink-soft)" }}>Mute</button>
                  : <button onClick={startListening} className="sw-focus px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--green)", color: "#fff" }}>Unmute</button>
              )}
            </div>
          )}
        </>
      )}

      {/* End of call review */}
      {summary && (
        <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "2px solid var(--primary)" }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="sw-display font-bold text-3xl rounded-xl px-4 py-1"
              style={{ background: "var(--primary)", color: "#fff" }}>{summary.grade || "—"}</div>
            <div>
              <div className="sw-display font-bold text-base">Call review</div>
              <div className="text-sm" style={{ color: "var(--ink-soft)" }}>{summary.headline}</div>
            </div>
          </div>

          {scored.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mb-4">
              {Object.keys(SCORE_STYLE).filter((k) => tally[k]).map((k) => (
                <span key={k} className="text-xs font-semibold px-2 py-1 rounded-full"
                  style={{ background: SCORE_STYLE[k].bg, color: SCORE_STYLE[k].fg }}>
                  {tally[k]} × {SCORE_STYLE[k].label}
                </span>
              ))}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.75rem" }}>
            <div className="rounded-xl p-3" style={{ background: "var(--green-soft)" }}>
              <div className="text-xs font-bold uppercase mb-2" style={{ color: "var(--green)" }}>What worked</div>
              {(summary.strengths || []).map((s, i) => (
                <div key={i} className="text-sm mb-1.5" style={{ color: "var(--ink)" }}>• {s}</div>
              ))}
            </div>
            <div className="rounded-xl p-3" style={{ background: "var(--amber-soft)" }}>
              <div className="text-xs font-bold uppercase mb-2" style={{ color: "var(--amber)" }}>Work on this</div>
              {(summary.improvements || []).map((s, i) => (
                <div key={i} className="text-sm mb-1.5" style={{ color: "var(--ink)" }}>• {s}</div>
              ))}
            </div>
          </div>

          {summary.moment && (
            <div className="rounded-xl p-3 mt-3" style={{ background: "var(--surface-alt)" }}>
              <div className="text-xs font-bold uppercase mb-1" style={{ color: "var(--ink-soft)" }}>Turning point</div>
              <div className="text-sm">{summary.moment}</div>
            </div>
          )}
        </div>
      )}

      {/* Previous practice calls — yours, plus your team's if you manage one */}
      {history.length > 0 && status === "idle" && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3">
            <History size={16} style={{ color: "var(--ink-soft)" }} />
            <h3 className="sw-display text-sm" style={{ color: "var(--ink-faint)", fontWeight: 600, letterSpacing: "0.03em" }}>PREVIOUS CALLS</h3>
            <span className="text-xs" style={{ color: "var(--ink-faint)" }}>{history.length} kept</span>
          </div>

          <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {history.map((h) => {
              const isOpen = openSession === h.id;
              const scen = (scenarios.length ? scenarios : COACH_SCENARIOS).find((s) => s.key === h.scenario);
              return (
                <div key={h.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <button onClick={() => setOpenSession(isOpen ? null : h.id)}
                    className="sw-focus w-full flex items-center gap-3 px-4 py-3 text-left">
                    <span className="sw-display font-bold text-lg rounded-lg px-2.5 py-0.5 shrink-0"
                      style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>{h.grade || "—"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{h.headline || "Practice call"}</div>
                      <div className="text-xs" style={{ color: "var(--ink-faint)" }}>
                        {scen?.label || h.scenario} · {fmtDate(h.created_at)} · {h.turn_count} turns
                        {h.user_name ? ` · ${h.user_name}` : ""}
                      </div>
                    </div>
                    <span className="sw-mono text-xs font-bold shrink-0 px-2 py-1 rounded-full"
                      style={{ background: (h.points ?? 0) >= 0 ? "var(--green-soft)" : "var(--red-soft)", color: (h.points ?? 0) >= 0 ? "var(--green)" : "var(--red)" }}>
                      {(h.points ?? 0) > 0 ? "+" : ""}{h.points ?? 0}
                    </span>
                    <ChevronDown size={15} className="shrink-0" style={{ color: "var(--ink-faint)", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4" style={{ background: "var(--surface-alt)" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.6rem" }} className="pt-3 mb-3">
                        <div className="rounded-xl p-3" style={{ background: "var(--green-soft)" }}>
                          <div className="text-xs font-bold uppercase mb-1.5" style={{ color: "var(--green)" }}>What worked</div>
                          {(h.strengths || []).map((s, i) => <div key={i} className="text-xs mb-1">• {s}</div>)}
                        </div>
                        <div className="rounded-xl p-3" style={{ background: "var(--amber-soft)" }}>
                          <div className="text-xs font-bold uppercase mb-1.5" style={{ color: "var(--amber)" }}>Work on this</div>
                          {(h.improvements || []).map((s, i) => <div key={i} className="text-xs mb-1">• {s}</div>)}
                        </div>
                      </div>
                      {h.moment && (
                        <div className="rounded-xl p-3 mb-3" style={{ background: "var(--surface)" }}>
                          <div className="text-xs font-bold uppercase mb-1" style={{ color: "var(--ink-soft)" }}>Turning point</div>
                          <div className="text-xs">{h.moment}</div>
                        </div>
                      )}
                      <div className="rounded-xl p-3" style={{ background: "var(--surface)", maxHeight: 260, overflowY: "auto" }}>
                        <div className="text-xs font-bold uppercase mb-2" style={{ color: "var(--ink-soft)" }}>Transcript</div>
                        {(h.transcript || []).map((t, i) => (
                          <div key={i} className="flex items-start gap-2 mb-2">
                            <span className="text-xs font-bold shrink-0 px-1.5 py-0.5 rounded"
                              style={t.role === "agent" ? { background: "var(--primary-soft)", color: "var(--primary)" } : { background: "var(--surface-alt)", color: "var(--ink-soft)" }}>
                              {t.role === "agent" ? "YOU" : "THEM"}
                            </span>
                            <div className="flex-1">
                              <div className="text-xs">{t.text}</div>
                              {t.score && (
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  <ScoreBadge score={t.score} />
                                  {t.note && <span className="text-xs" style={{ color: "var(--ink-faint)" }}>{t.note}</span>}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  FORECASTING                                                            */
/* ---------------------------------------------------------------------- */

// The pillars actually used on the forecast sheet.
const PILLARS = [
  "ACQ Cloud", "In Life Cloud", "Digital Voice",
  "Future Mobile", "SME Mobile",
  "BTNet", "Broadband", "Broadband Triple", "Ultra",
  "DV4B", "BADR", "Net Security", "CCS", "Other",
];

// ...rolled up into the columns the summary reports on, matching the
// existing forecast sheet (Cloud / Mobile / BTNet / BB / DV4B / Security).
const PILLAR_GROUPS = ["Cloud", "Mobile", "BTNet", "Broadband", "DV4B", "Security"];
const PILLAR_TO_GROUP = {
  "ACQ Cloud": "Cloud", "In Life Cloud": "Cloud", "Digital Voice": "Cloud",
  "Future Mobile": "Mobile", "SME Mobile": "Mobile",
  "BTNet": "BTNet",
  "Broadband": "Broadband", "Broadband Triple": "Broadband", "Ultra": "Broadband",
  "DV4B": "DV4B",
  "BADR": "Security", "Net Security": "Security", "CCS": "Security",
};
const groupForPillar = (p) => PILLAR_TO_GROUP[String(p || "").trim()] || "Other";

const FORECAST_STATUSES = ["Open", "Won", "Lost", "Pushed"];
const VISIT_MODES = ["Visit", "Teams", "Neither"];

// Forecast GP split. A closer working alone keeps the full GP. Bring in
// a lead gen and the closer takes 80% and the lead gen 50% — 130% claimed
// against 100% real, so 30% comes off as double-count.
const CLOSER_SPLIT = 0.80;
const LEADGEN_SPLIT = 0.50;

function mondayOf(d) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
function isoDateStr(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

function ForecastCell({ value, money = true, bold, tone, highlight }) {
  const empty = !value;
  return (
    <td className="px-2 py-1.5 sw-mono whitespace-nowrap"
      style={{
        fontSize: 12, textAlign: "center",
        fontWeight: bold ? 700 : 500,
        color: empty ? "var(--ink-faint)" : (tone || "var(--ink)"),
        borderLeft: "1px solid var(--border)",
        background: highlight ? "var(--primary-soft)" : undefined,
      }}>
      {money ? fmtGBP(value) : (value || 0).toLocaleString("en-GB")}
    </td>
  );
}

/* One line of the forecast breakdown. Clickable when it has children. */
function FcRow({ label, v, sov, units, lines, bold, tone, depth = 0, onToggle, isOpen }) {
  return (
    <tr style={{ borderTop: "1px solid var(--border)" }}>
      <td className="px-3 py-1.5 whitespace-nowrap" style={{ paddingLeft: 12 + depth * 20 }}>
        {onToggle ? (
          <button onClick={onToggle} className="sw-focus flex items-center gap-1.5 text-left">
            <ChevronDown size={12} style={{ color: "var(--ink-faint)", transform: isOpen ? "rotate(0)" : "rotate(-90deg)", transition: "transform .15s" }} />
            <span style={{ fontSize: 12, fontWeight: bold ? 700 : 600, color: tone || "var(--ink-soft)" }}>{label}</span>
          </button>
        ) : (
          <span style={{ fontSize: 12, fontWeight: bold ? 700 : 600, color: tone || "var(--ink-soft)", paddingLeft: depth ? 18 : 0 }}>{label}</span>
        )}
      </td>
      {v == null
        ? <td className="px-2 py-1.5" style={{ borderLeft: "1px solid var(--border)", background: "var(--primary-soft)" }} />
        : <ForecastCell value={v} bold={bold} tone={tone} highlight />}
      {sov == null
        ? <td className="px-2 py-1.5" style={{ borderLeft: "1px solid var(--border)" }} />
        : <ForecastCell value={sov} tone={tone} />}
      <ForecastCell value={units || 0} money={false} tone={tone} />
      <ForecastCell value={lines || 0} money={false} tone={tone} />
    </tr>
  );
}

function ForecastView({ netsuite, profile, staff }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [week, setWeek] = useState(() => isoDateStr(mondayOf(new Date())));
  const [view, setView] = useState("summary");   // summary | detail
  const [teamFilter, setTeamFilter] = useState("All");
  const [agentFilter, setAgentFilter] = useState("All");
  const [pillarFilter, setPillarFilter] = useState(null);   // set by clicking the treemap
  const [fcOpen, setFcOpen] = useState({});                 // expanded rows
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToastLocal] = useState("");
  const { sellers } = useStaff();

  const blankRow = {
    business_name: "", opp_id: "", pillar: "ACQ Cloud", agent_name: "", lead_gen_name: "",
    sov: "", units: "", gp: "", forecast_date: isoDateStr(new Date()),
    next_step: "", signpost_date: "", sr_raised: false, visit_or_teams: "Teams",
    contract_out: false, proposal: "", previously_forecasted: false, notes: "",
  };
  const [draft, setDraft] = useState(blankRow);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("forecasts").select("*").order("forecast_week", { ascending: false });
    setRows(data || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  // Weeks that actually have forecasts, newest first, plus this week
  const weekOptions = useMemo(() => {
    const s = new Set(rows.map((r) => r.forecast_week).filter(Boolean));
    s.add(isoDateStr(mondayOf(new Date())));
    return Array.from(s).sort().reverse();
  }, [rows]);

  const agentOptions = useMemo(() => {
    const s = new Set();
    rows.forEach((r) => { if (r.agent_name) s.add(r.agent_name); if (r.lead_gen_name) s.add(r.lead_gen_name); });
    return Array.from(s).sort();
  }, [rows]);

  // Everything for the selected week, after filters
  const weekRows = useMemo(() => rows.filter((r) => {
    if (r.forecast_week !== week) return false;
    if (teamFilter !== "All" && r.agent_team !== teamFilter && r.lead_gen_team !== teamFilter) return false;
    if (agentFilter !== "All" && r.agent_name !== agentFilter && r.lead_gen_name !== agentFilter) return false;
    if (pillarFilter && groupForPillar(r.pillar) !== pillarFilter) return false;
    return true;
  }), [rows, week, teamFilter, agentFilter, pillarFilter]);

  // ---- Summary: one line per team, pillar SOV/units across ------------
  const summary = useMemo(() => {
    const byTeam = {};
    const byAgent = {};

    const ensureTeam = (t) => {
      if (!byTeam[t]) {
        byTeam[t] = { team: t, gp: 0, leads: {}, pillars: {} };
        PILLAR_GROUPS.forEach((p) => { byTeam[t].pillars[p] = { sov: 0, units: 0 }; byTeam[t].leads[p] = 0; });
        byTeam[t].pillars.Other = { sov: 0, units: 0 };
        byTeam[t].leads.Other = 0;
      }
      return byTeam[t];
    };
    const ensureAgent = (name, team) => {
      if (!byAgent[name]) byAgent[name] = { name, team: team || "\u2014", gp: 0, sov: 0, lines: 0, asLeadGen: 0 };
      if (team && byAgent[name].team === "\u2014") byAgent[name].team = team;
      return byAgent[name];
    };

    let dcTotal = 0;

    weekRows.forEach((r) => {
      const gp = num(r.gp);
      const sov = num(r.sov);
      const g = groupForPillar(r.pillar);
      const hasLeadGen = !!(r.lead_gen_name && String(r.lead_gen_name).trim());

      // Closer alone keeps 100%. With a lead gen it's 80/50, and the
      // extra 30% claimed above the real value comes off as double-count.
      const closerGp = hasLeadGen ? gp * CLOSER_SPLIT : gp;
      const leadGenGp = hasLeadGen ? gp * LEADGEN_SPLIT : 0;
      if (hasLeadGen) dcTotal -= gp * (CLOSER_SPLIT + LEADGEN_SPLIT - 1);

      // The closer's team carries the deal's SOV and units
      const closerTeam = r.agent_team || "Unassigned";
      const ct = ensureTeam(closerTeam);
      ct.gp += closerGp;
      if (!ct.pillars[g]) { ct.pillars[g] = { sov: 0, units: 0 }; ct.leads[g] = 0; }
      ct.pillars[g].sov += sov;
      ct.pillars[g].units += num(r.units);

      const ca = ensureAgent(r.agent_name || "Unknown", r.agent_team);
      ca.gp += closerGp;
      ca.sov += sov;
      ca.lines += 1;

      if (hasLeadGen) {
        const lgTeam = r.lead_gen_team || "Unassigned";
        const lt = ensureTeam(lgTeam);
        lt.gp += leadGenGp;
        if (!lt.leads[g]) lt.leads[g] = 0;
        lt.leads[g] += 1;

        const la = ensureAgent(r.lead_gen_name, r.lead_gen_team);
        la.gp += leadGenGp;
        la.asLeadGen += 1;
      }
    });

    const teams = Object.keys(byTeam).map((k) => byTeam[k]).sort((a, b) => b.gp - a.gp);
    const agents = Object.keys(byAgent).map((k) => byAgent[k]).sort((a, b) => b.gp - a.gp);
    const gpSum = teams.reduce((s, t) => s + t.gp, 0);
    return { teams, agents, gpSum, dc: dcTotal, grand: gpSum + dcTotal };
  }, [weekRows]);

  // ---- Hierarchical breakdown: all teams, then each team -------------
  // Same shape as Day by Day: totals first, opened up on demand.
  const breakdown = useMemo(() => {
    const node = () => ({ gp: 0, sov: 0, units: 0, lines: 0, subs: {} });
    const shell = () => {
      const o = { gp: 0, sov: 0, units: 0, lines: 0, groups: {} };
      PILLAR_GROUPS.forEach((g) => { o.groups[g] = node(); });
      o.groups.Other = node();
      return o;
    };

    const all = shell();
    const teams = {};

    weekRows.forEach((r) => {
      const gp = num(r.gp), sov = num(r.sov), units = num(r.units);
      const hasLg = !!(r.lead_gen_name && String(r.lead_gen_name).trim());
      const closerGp = hasLg ? gp * CLOSER_SPLIT : gp;
      const lgGp = hasLg ? gp * LEADGEN_SPLIT : 0;
      const g = groupForPillar(r.pillar);
      const pillar = String(r.pillar || "Other").trim() || "Other";

      const bump = (o, gpv) => {
        o.gp += gpv; o.sov += sov; o.units += units; o.lines += 1;
        if (!o.groups[g]) o.groups[g] = node();
        const gn = o.groups[g];
        gn.gp += gpv; gn.sov += sov; gn.units += units; gn.lines += 1;
        if (!gn.subs[pillar]) gn.subs[pillar] = { gp: 0, sov: 0, units: 0, lines: 0 };
        const sn = gn.subs[pillar];
        sn.gp += gpv; sn.sov += sov; sn.units += units; sn.lines += 1;
      };

      // The closer's team carries the SOV and units for the deal
      const ct = r.agent_team || "Unassigned";
      if (!teams[ct]) teams[ct] = { team: ct, ...shell() };
      bump(teams[ct], closerGp);
      bump(all, closerGp);

      // A lead gen on another team adds their GP share only
      if (hasLg) {
        const lt = r.lead_gen_team || "Unassigned";
        if (!teams[lt]) teams[lt] = { team: lt, ...shell() };
        teams[lt].gp += lgGp;
        if (!teams[lt].groups[g]) teams[lt].groups[g] = node();
        teams[lt].groups[g].gp += lgGp;
        all.gp += lgGp;
        all.groups[g].gp += lgGp;
      }
    });

    return {
      all,
      teams: Object.keys(teams).map((k) => teams[k]).sort((a, b) => b.gp - a.gp),
    };
  }, [weekRows]);

  // ---- Accuracy: forecast vs what NetSuite actually shows -------------
  // Two different questions, both worth answering:
  //   * did the forecasts land?          -> matched lines
  //   * what actually statted that week? -> all NetSuite in the week
  const accuracy = useMemo(() => {
    const weekStartD = new Date(week);
    const weekEndD = new Date(week);
    weekEndD.setDate(weekEndD.getDate() + 6);
    const inWeek = (dstr) => {
      if (!dstr) return false;
      const d = new Date(dstr + "T00:00:00");
      return d >= weekStartD && d <= weekEndD;
    };

    const matched = weekRows.filter((r) => r.matched_at);
    // Only count as "landed this week" if NetSuite statted it in the week
    const landedThisWeek = matched.filter((r) => inWeek(r.matched_order_date));

    const forecastGp = weekRows.reduce((s, r) => s + num(r.gp), 0);
    const forecastSov = weekRows.reduce((s, r) => s + num(r.sov), 0);
    const matchedGp = matched.reduce((s, r) => s + num(r.actual_gp), 0);
    const matchedSov = matched.reduce((s, r) => s + num(r.actual_sov), 0);

    // Everything NetSuite statted in this week, forecast or not
    let stattedGp = 0, stattedSov = 0, stattedCount = 0;
    (netsuite || []).forEach((n) => {
      if (!inWeek(n.order_date)) return;
      if (teamFilter !== "All" && n.closer_team !== teamFilter && n.referrer_team !== teamFilter) return;
      if (agentFilter !== "All" && n.closer_name !== agentFilter && n.referrer_name !== agentFilter) return;
      stattedCount += 1;
      if (n.count_gp !== false) stattedGp += num(n.gp_office);
      if (n.count_sov !== false) stattedSov += num(n.contract_value);
    });

    return {
      lines: weekRows.length,
      landed: landedThisWeek.length,
      matchedAny: matched.length,
      hitRate: weekRows.length ? (landedThisWeek.length / weekRows.length) * 100 : 0,
      forecastGp, forecastSov, matchedGp, matchedSov,
      stattedGp, stattedSov, stattedCount,
      gpVariance: stattedGp - forecastGp,
      claimedWonUnmatched: weekRows.filter((r) => r.status === "Won" && !r.matched_at).length,
    };
  }, [weekRows, netsuite, week, teamFilter, agentFilter]);

  // ---- Chart data ----------------------------------------------------
  // Each chart shows every option but reflects the OTHER chart's
  // selection, so picking a product re-ranks the agents and picking an
  // agent re-sizes the products. Neither filters itself away.
  const baseRows = useMemo(() => rows.filter((r) => {
    if (r.forecast_week !== week) return false;
    if (teamFilter !== "All" && r.agent_team !== teamFilter && r.lead_gen_team !== teamFilter) return false;
    return true;
  }), [rows, week, teamFilter]);

  const pillarChartItems = useMemo(() => {
    const m = {};
    baseRows.forEach((r) => {
      if (agentFilter !== "All" && r.agent_name !== agentFilter && r.lead_gen_name !== agentFilter) return;
      const g = groupForPillar(r.pillar);
      m[g] = (m[g] || 0) + num(r.gp);
    });
    return Object.keys(m).map((name) => ({ name, value: m[name] }));
  }, [baseRows, agentFilter]);

  const agentChartItems = useMemo(() => {
    const m = {};
    baseRows.forEach((r) => {
      if (pillarFilter && groupForPillar(r.pillar) !== pillarFilter) return;
      if (!r.agent_name) return;
      m[r.agent_name] = (m[r.agent_name] || 0) + num(r.gp);
    });
    return Object.keys(m).map((name) => ({ name, value: m[name] }));
  }, [baseRows, pillarFilter]);


  const addForecast = async () => {
    if (!draft.business_name.trim() || !draft.agent_name) {
      setToastLocal("Business name and agent are both needed.");
      setTimeout(() => setToastLocal(""), 3000);
      return;
    }
    setSaving(true);
    const agentStaff = findStaff(sellers, draft.agent_name);
    const lgStaff = draft.lead_gen_name ? findStaff(sellers, draft.lead_gen_name) : null;
    const wk = new Date(week);
    const { error } = await supabase.from("forecasts").insert({
      forecast_week: week,
      weeknum: weekNumber(wk),
      agent_name: draft.agent_name,
      agent_id: agentStaff?.user_id || null,
      agent_team: agentStaff?.team || null,
      lead_gen_name: draft.lead_gen_name || null,
      lead_gen_id: lgStaff?.user_id || null,
      lead_gen_team: lgStaff?.team || null,
      forecast_date: draft.forecast_date || null,
      pillar: draft.pillar,
      business_name: draft.business_name.trim(),
      opp_id: draft.opp_id.trim() || null,
      sov: parseFloat(draft.sov) || 0,
      units: parseFloat(draft.units) || 0,
      gp: parseFloat(draft.gp) || 0,
      previously_forecasted: draft.previously_forecasted,
      next_step: draft.next_step || null,
      signpost_date: draft.signpost_date || null,
      sr_raised: draft.sr_raised,
      visit_or_teams: draft.visit_or_teams,
      contract_out: draft.contract_out,
      proposal: draft.proposal || null,
      notes: draft.notes || null,
    });
    setSaving(false);
    if (error) {
      setToastLocal(`Couldn't save: ${error.message}`);
      setTimeout(() => setToastLocal(""), 5000);
      return;
    }
    setDraft(blankRow);
    setAdding(false);
    load();
  };

  const runMatch = async () => {
    setSaving(true);
    const { data, error } = await supabase.rpc("match_forecasts");
    setSaving(false);
    setToastLocal(error ? `Match failed: ${error.message}` : `Matched ${data?.total ?? 0} forecast${data?.total === 1 ? "" : "s"} against NetSuite`);
    setTimeout(() => setToastLocal(""), 4000);
    load();
  };

  const updateRow = async (id, patch) => {
    const { error } = await supabase.from("forecasts").update(patch).eq("id", id);
    if (error) { setToastLocal(`Couldn't update: ${error.message}`); setTimeout(() => setToastLocal(""), 4000); return; }
    load();
  };

  const weekLabel = (w) => {
    const d = new Date(w);
    const isThis = w === isoDateStr(mondayOf(new Date()));
    return `w/c ${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}${isThis ? " (this week)" : ""}`;
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <TrendingUp size={18} style={{ color: "var(--primary)" }} />
        <h2 className="sw-display text-lg font-bold">Forecasting</h2>
        <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
          What we expect to land · cross-referenced against NetSuite
        </span>
        <div className="ml-auto flex items-center gap-2">
          <select className="sw-input sw-focus" style={{ width: 190 }} value={week} onChange={(e) => setWeek(e.target.value)}>
            {weekOptions.map((w) => <option key={w} value={w}>{weekLabel(w)}</option>)}
          </select>
          <button onClick={runMatch} disabled={saving}
            className="sw-focus px-3 py-2 rounded-lg text-xs font-semibold"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--ink-soft)" }}>
            {saving ? "..." : "Re-check vs NetSuite"}
          </button>
          <button onClick={() => setAdding((a) => !a)}
            className="sw-focus px-3 py-2 rounded-lg text-xs font-semibold text-white flex items-center gap-1"
            style={{ background: "var(--primary)" }}>
            <Plus size={13} /> Add forecast
          </button>
        </div>
      </div>

      {toast && (
        <div className="rounded-xl p-2.5 mb-3 text-xs font-semibold"
          style={{ background: toast.startsWith("Couldn't") || toast.startsWith("Match failed") ? "var(--red-soft)" : "var(--green-soft)", color: toast.startsWith("Couldn't") || toast.startsWith("Match failed") ? "var(--red)" : "var(--green)" }}>
          {toast}
        </div>
      )}

      {/* Add form */}
      {adding && (
        <div className="rounded-2xl p-4 mb-4" style={{ background: "var(--surface)", border: "1px solid var(--primary)" }}>
          <div className="sw-display font-bold text-sm mb-3">New forecast line — {weekLabel(week)}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.6rem" }}>
            <div><label className="sw-label">Business name *</label>
              <input className="sw-input sw-focus" value={draft.business_name} onChange={(e) => setDraft((d) => ({ ...d, business_name: e.target.value }))} /></div>
            <div><label className="sw-label">Agent *</label>
              <select className="sw-input sw-focus" value={draft.agent_name} onChange={(e) => setDraft((d) => ({ ...d, agent_name: e.target.value }))}>
                <option value="">Select...</option>
                {sellers.map((s) => <option key={s.full_name} value={s.full_name}>{s.full_name}</option>)}
              </select></div>
            <div><label className="sw-label">Lead Gen</label>
              <select className="sw-input sw-focus" value={draft.lead_gen_name} onChange={(e) => setDraft((d) => ({ ...d, lead_gen_name: e.target.value }))}>
                <option value="">None</option>
                {sellers.map((s) => <option key={s.full_name} value={s.full_name}>{s.full_name}</option>)}
              </select></div>
            <div><label className="sw-label">Pillar</label>
              <select className="sw-input sw-focus" value={draft.pillar} onChange={(e) => setDraft((d) => ({ ...d, pillar: e.target.value }))}>
                {PILLARS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select></div>
            <div><label className="sw-label">SOV (£)</label>
              <input className="sw-input sw-focus" value={draft.sov} onChange={(e) => setDraft((d) => ({ ...d, sov: e.target.value }))} /></div>
            <div><label className="sw-label">GP (£)</label>
              <input className="sw-input sw-focus" value={draft.gp} onChange={(e) => setDraft((d) => ({ ...d, gp: e.target.value }))} /></div>
            <div><label className="sw-label">Units</label>
              <input className="sw-input sw-focus" value={draft.units} onChange={(e) => setDraft((d) => ({ ...d, units: e.target.value }))} /></div>
            <div><label className="sw-label">Opp ID</label>
              <input className="sw-input sw-focus" value={draft.opp_id} onChange={(e) => setDraft((d) => ({ ...d, opp_id: e.target.value }))} placeholder="if known" /></div>
            <div><label className="sw-label">Expected date</label>
              <input className="sw-input sw-focus" type="date" value={draft.forecast_date} onChange={(e) => setDraft((d) => ({ ...d, forecast_date: e.target.value }))} /></div>
            <div><label className="sw-label">Signpost date</label>
              <input className="sw-input sw-focus" type="date" value={draft.signpost_date} onChange={(e) => setDraft((d) => ({ ...d, signpost_date: e.target.value }))} /></div>
            <div><label className="sw-label">Visit or Teams</label>
              <select className="sw-input sw-focus" value={draft.visit_or_teams} onChange={(e) => setDraft((d) => ({ ...d, visit_or_teams: e.target.value }))}>
                {VISIT_MODES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select></div>
            <div><label className="sw-label">Next step</label>
              <input className="sw-input sw-focus" value={draft.next_step} onChange={(e) => setDraft((d) => ({ ...d, next_step: e.target.value }))} /></div>
            <div><label className="sw-label">Proposal</label>
              <input className="sw-input sw-focus" value={draft.proposal} onChange={(e) => setDraft((d) => ({ ...d, proposal: e.target.value }))} /></div>
            <div style={{ gridColumn: "span 2" }}><label className="sw-label">Notes</label>
              <input className="sw-input sw-focus" value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} /></div>
          </div>
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer"><input type="checkbox" checked={draft.previously_forecasted} onChange={(e) => setDraft((d) => ({ ...d, previously_forecasted: e.target.checked }))} /> Previously forecasted</label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer"><input type="checkbox" checked={draft.sr_raised} onChange={(e) => setDraft((d) => ({ ...d, sr_raised: e.target.checked }))} /> SR raised</label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer"><input type="checkbox" checked={draft.contract_out} onChange={(e) => setDraft((d) => ({ ...d, contract_out: e.target.checked }))} /> Contract out</label>
            <div className="ml-auto flex gap-2">
              <button onClick={() => { setAdding(false); setDraft(blankRow); }} className="sw-focus px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--ink-soft)" }}>Cancel</button>
              <button onClick={addForecast} disabled={saving} className="sw-focus px-4 py-2 rounded-lg text-xs font-semibold text-white" style={{ background: "var(--primary)" }}>{saving ? "Saving..." : "Add forecast"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Headline accuracy */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem" }} className="mb-4">
        <div className="rounded-2xl p-3.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="text-xs font-semibold uppercase" style={{ color: "var(--ink-soft)" }}>Forecast GP</div>
          {/* Net of the lead-gen double count — this is what actually lands */}
          <div className="sw-display font-bold text-xl">{fmtGBP(summary.grand)}</div>
          <div className="text-xs" style={{ color: "var(--ink-faint)" }}>
            {summary.dc < 0
              ? `${fmtGBP(summary.gpSum)} claimed − ${fmtGBP(Math.abs(summary.dc))} DC`
              : `${accuracy.lines} lines`}
          </div>
        </div>
        <div className="rounded-2xl p-3.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="text-xs font-semibold uppercase" style={{ color: "var(--ink-soft)" }}>Forecast lines</div>
          <div className="sw-display font-bold text-xl">{accuracy.lines}</div>
          <div className="text-xs" style={{ color: "var(--ink-faint)" }}>{fmtGBP(accuracy.forecastSov)} SOV</div>
        </div>
        <div className="rounded-2xl p-3.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="text-xs font-semibold uppercase" style={{ color: "var(--ink-soft)" }}>Statted this week</div>
          <div className="sw-display font-bold text-xl" style={{ color: "var(--green)" }}>{fmtGBP(accuracy.stattedGp)}</div>
          <div className="text-xs" style={{ color: "var(--ink-faint)" }}>{accuracy.stattedCount} NetSuite orders</div>
        </div>
        <div className="rounded-2xl p-3.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="text-xs font-semibold uppercase" style={{ color: "var(--ink-soft)" }}>Forecast vs actual</div>
          <div className="sw-display font-bold text-xl" style={{ color: accuracy.gpVariance >= 0 ? "var(--green)" : "var(--red)" }}>
            {accuracy.gpVariance >= 0 ? "+" : ""}{fmtGBP(accuracy.gpVariance)}
          </div>
          <div className="text-xs" style={{ color: "var(--ink-faint)" }}>statted minus forecast</div>
        </div>
        <div className="rounded-2xl p-3.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="text-xs font-semibold uppercase" style={{ color: "var(--ink-soft)" }}>Forecasts landed</div>
          <div className="sw-display font-bold text-xl" style={{ color: accuracy.hitRate >= 70 ? "var(--green)" : accuracy.hitRate >= 40 ? "var(--amber)" : "var(--red)" }}>
            {accuracy.landed}/{accuracy.lines}
          </div>
          <div className="text-xs" style={{ color: "var(--ink-faint)" }}>{accuracy.hitRate.toFixed(0)}% seen in NetSuite</div>
        </div>
      </div>

      {/* Won on paper, nothing behind it in NetSuite */}
      {accuracy.claimedWonUnmatched > 0 && (
        <div className="rounded-xl p-3 mb-4 flex items-center gap-2" style={{ background: "var(--amber-soft)", border: "1px solid var(--amber)" }}>
          <AlertTriangle size={15} style={{ color: "var(--amber)" }} className="shrink-0" />
          <div className="text-xs" style={{ color: "var(--ink-soft)" }}>
            <b>{accuracy.claimedWonUnmatched} forecast{accuracy.claimedWonUnmatched === 1 ? " is" : "s are"} marked Won but {accuracy.claimedWonUnmatched === 1 ? "hasn't" : "haven't"} been found in NetSuite.</b>{" "}
            Either they haven't statted yet, or the business name and Opp ID don't line up with the NetSuite record.
            Check them in the All forecasts view — the "vs NetSuite" column shows what was found.
          </div>
        </div>
      )}

      {/* View + filters */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {[["summary", "Summary"], ["detail", "All forecasts"]].map(([k, lbl]) => (
          <button key={k} onClick={() => setView(k)} className="sw-focus px-3 py-1.5 rounded-full text-xs font-semibold"
            style={view === k ? { background: "var(--primary)", color: "#fff" } : { background: "var(--surface)", color: "var(--ink-soft)", border: "1px solid var(--border)" }}>
            {lbl}
          </button>
        ))}
        <span className="mx-1" style={{ width: 1, height: 20, background: "var(--border)" }} />
        <button onClick={() => setTeamFilter("All")} className="sw-focus px-3 py-1.5 rounded-full text-xs font-semibold"
          style={teamFilter === "All" ? { background: "var(--ink)", color: "#fff" } : { background: "var(--surface)", color: "var(--ink-soft)", border: "1px solid var(--border)" }}>All teams</button>
        {SELLING_TEAMS.map((t) => (
          <button key={t} onClick={() => setTeamFilter(t)} className="sw-focus px-3 py-1.5 rounded-full text-xs font-semibold"
            style={teamFilter === t ? { background: "var(--ink)", color: "#fff" } : { background: "var(--surface)", color: "var(--ink-soft)", border: "1px solid var(--border)" }}>{t}</button>
        ))}
        <select className="sw-input sw-focus" style={{ width: 180 }} value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}>
          <option value="All">All agents</option>
          {agentOptions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        {pillarFilter && (
          <button onClick={() => setPillarFilter(null)}
            className="sw-focus px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1"
            style={{ background: "var(--primary)", color: "#fff" }}
            title="Clear the product filter">
            {pillarFilter} <X size={12} />
          </button>
        )}
      </div>

      {/* SUMMARY */}
      {view === "summary" && (
        <>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 360px", gap: "0.75rem", alignItems: "start" }} className="mb-4">

          {/* Expandable breakdown — all teams first, then each team */}
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="overflow-x-auto">
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)" }}>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase" style={{ color: "var(--ink-soft)" }}>Metric</th>
                    <th className="px-2 py-2 text-center text-xs font-bold" style={{ color: "var(--ink-soft)", background: "var(--primary-soft)" }}>GP</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>SOV</th>
                    <th className="px-2 py-2 text-center text-xs font-bold" style={{ color: "var(--ink-faint)" }}>Units</th>
                    <th className="px-2 py-2 text-center text-xs font-bold" style={{ color: "var(--ink-faint)" }}>Lines</th>
                  </tr>
                </thead>
                <tbody>
                  {/* All teams */}
                  <tr style={{ background: "var(--ink)" }}>
                    <td colSpan={5} className="px-3 py-1.5 text-xs font-bold uppercase" style={{ color: "#fff" }}>All teams</td>
                  </tr>
                  <FcRow label="GP" v={breakdown.all.gp} sov={null} bold tone="var(--green)" />
                  <FcRow label="Total SOV" v={null} sov={breakdown.all.sov} units={breakdown.all.units} lines={breakdown.all.lines} bold tone="var(--primary)"
                    isOpen={!!fcOpen.all_sov} onToggle={() => setFcOpen((o) => ({ ...o, all_sov: !o.all_sov }))} />
                  {fcOpen.all_sov && PILLAR_GROUPS.map((g) => {
                    const k = `all_${g.key || g}`;
                    const node = breakdown.all.groups[g];
                    if (!node || (!node.gp && !node.sov)) return null;
                    const subs = Object.keys(node.subs).sort();
                    return (
                      <React.Fragment key={g}>
                        <FcRow label={g} v={node.gp} sov={node.sov} units={node.units} lines={node.lines} depth={1}
                          isOpen={!!fcOpen[k]} onToggle={subs.length ? () => setFcOpen((o) => ({ ...o, [k]: !o[k] })) : undefined} />
                        {fcOpen[k] && subs.map((s) => (
                          <FcRow key={s} label={s} v={node.subs[s].gp} sov={node.subs[s].sov}
                            units={node.subs[s].units} lines={node.subs[s].lines} depth={2} tone="var(--ink-faint)" />
                        ))}
                      </React.Fragment>
                    );
                  })}

                  {/* Per team */}
                  {breakdown.teams.length > 0 && (
                    <tr style={{ background: "var(--surface-alt)", borderTop: "2px solid var(--border)" }}>
                      <td colSpan={5} className="px-3 py-1.5 text-xs font-bold uppercase" style={{ color: "var(--primary)" }}>By team</td>
                    </tr>
                  )}
                  {breakdown.teams.map((t) => {
                    const tk = `team_${t.team}`;
                    return (
                      <React.Fragment key={t.team}>
                        <FcRow label={t.team} v={t.gp} sov={t.sov} units={t.units} lines={t.lines} bold
                          isOpen={!!fcOpen[tk]} onToggle={() => setFcOpen((o) => ({ ...o, [tk]: !o[tk] }))} />
                        {fcOpen[tk] && PILLAR_GROUPS.map((g) => {
                          const k = `${tk}_${g}`;
                          const node = t.groups[g];
                          if (!node || (!node.gp && !node.sov)) return null;
                          const subs = Object.keys(node.subs).sort();
                          return (
                            <React.Fragment key={g}>
                              <FcRow label={g} v={node.gp} sov={node.sov} units={node.units} lines={node.lines} depth={1}
                                isOpen={!!fcOpen[k]} onToggle={subs.length ? () => setFcOpen((o) => ({ ...o, [k]: !o[k] })) : undefined} />
                              {fcOpen[k] && subs.map((s) => (
                                <FcRow key={s} label={s} v={node.subs[s].gp} sov={node.subs[s].sov}
                                  units={node.subs[s].units} lines={node.subs[s].lines} depth={2} tone="var(--ink-faint)" />
                              ))}
                            </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}

                  {/* Double count and the figure that actually lands */}
                  <tr style={{ borderTop: "2px solid var(--border)", background: "var(--red-soft)" }}>
                    <td className="px-3 py-1.5 text-xs font-semibold" style={{ color: "var(--red)" }}>
                      DC <span style={{ fontWeight: 400 }}>(lead-gen overlap)</span>
                    </td>
                    <ForecastCell value={summary.dc} bold tone="var(--red)" highlight />
                    <ForecastCell value={0} />
                    <ForecastCell value={0} money={false} />
                    <ForecastCell value={0} money={false} />
                  </tr>
                  <tr style={{ background: "var(--ink)" }}>
                    <td className="px-3 py-2 text-sm font-bold" style={{ color: "#fff" }}>Grand Total</td>
                    <td className="px-2 py-2 sw-mono font-bold text-center" style={{ fontSize: 13, color: "#fff", background: "#3B1370" }}>{fmtGBP(summary.grand)}</td>
                    <td className="px-2 py-2 sw-mono font-bold text-center" style={{ fontSize: 12, color: "#fff" }}>{fmtGBP(breakdown.all.sov)}</td>
                    <td className="px-2 py-2 sw-mono text-center" style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }}>{breakdown.all.units.toLocaleString("en-GB")}</td>
                    <td className="px-2 py-2 sw-mono text-center" style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }}>{breakdown.all.lines}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Charts, pinned beside the table */}
          <div style={{ position: "sticky", top: 12, maxHeight: "calc(100vh - 24px)", overflowY: "auto" }} className="flex flex-col gap-3 pr-0.5">
            <div className="rounded-xl p-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="flex items-baseline justify-between mb-2">
                <span className="sw-display font-bold text-xs" style={{ color: "var(--ink-soft)" }}>GP BY PILLAR</span>
                {pillarFilter && <button onClick={() => setPillarFilter(null)} className="sw-focus text-xs font-semibold" style={{ color: "var(--primary)" }}>Clear</button>}
              </div>
              <ProductTreemap items={pillarChartItems} height={150} selected={pillarFilter} onSelect={setPillarFilter} />
            </div>
            <div className="rounded-xl p-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="sw-display text-xs mb-2" style={{ color: "var(--ink-faint)", fontWeight: 600, letterSpacing: "0.03em" }}>GP BY AGENT</div>
              <ProductBars items={agentChartItems} height={190}
                selected={agentFilter === "All" ? null : agentFilter}
                onSelect={(name) => setAgentFilter(name && name !== agentFilter ? name : "All")} />
            </div>
            <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="px-3 py-2 text-xs font-bold uppercase" style={{ background: "var(--surface-alt)", color: "var(--ink-soft)" }}>Leads passed in</div>
              <table className="w-full">
                <tbody>
                  {summary.teams.map((t) => {
                    const total = Object.keys(t.leads).reduce((s, p) => s + (t.leads[p] || 0), 0);
                    return (
                      <tr key={t.team} style={{ borderTop: "1px solid var(--border)" }}>
                        <td className="px-3 py-1.5 text-xs font-semibold truncate">{t.team}</td>
                        <td className="px-3 py-1.5 sw-mono text-xs font-bold text-right">{total}</td>
                      </tr>
                    );
                  })}
                  {summary.teams.length === 0 && (
                    <tr><td className="px-3 py-4 text-xs text-center" style={{ color: "var(--ink-faint)" }}>None this week.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

          <p className="text-xs mb-3" style={{ color: "var(--ink-faint)" }}>
            Click a team or pillar to open it up. GP splits 80% to the closer and 50% to the lead gen where
            there is one, with the 30% overlap coming off as DC — so the Grand Total is what actually lands.
          </p>
        </>
      )}

      {/* DETAIL */}
      {view === "detail" && (
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-alt)" }}>
                  {["Business", "Agent", "Lead Gen", "Pillar", "SOV", "GP", "Units", "Expected", "Next step", "Status", "vs NetSuite"].map((h) => (
                    <th key={h} className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: "var(--ink-soft)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weekRows.map((r) => {
                  const gpDiff = r.matched_at ? num(r.actual_gp) - num(r.gp) : null;
                  return (
                    <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="px-3 py-2">
                        <div className="font-medium">{r.business_name}</div>
                        {r.opp_id && <div className="text-xs sw-mono" style={{ color: "var(--ink-faint)" }}>{r.opp_id}</div>}
                      </td>
                      <td className="px-3 py-2 text-xs">{r.agent_name}{r.agent_team ? <span style={{ color: "var(--ink-faint)" }}> · {r.agent_team}</span> : null}</td>
                      <td className="px-3 py-2 text-xs" style={{ color: "var(--ink-soft)" }}>{r.lead_gen_name || "—"}</td>
                      <td className="px-3 py-2 text-xs">{r.pillar}</td>
                      <td className="px-3 py-2 sw-mono text-xs">{fmtGBP(r.sov)}</td>
                      <td className="px-3 py-2 sw-mono text-xs font-semibold">{fmtGBP(r.gp)}</td>
                      <td className="px-3 py-2 sw-mono text-xs">{num(r.units) || "—"}</td>
                      <td className="px-3 py-2 text-xs" style={{ color: "var(--ink-faint)" }}>{r.forecast_date ? fmtDate(r.forecast_date) : "—"}</td>
                      <td className="px-3 py-2 text-xs" style={{ color: "var(--ink-soft)" }}>{r.next_step || "—"}</td>
                      <td className="px-3 py-2">
                        <select className="sw-input sw-focus" style={{ width: 96, fontSize: 11, padding: "4px 6px" }}
                          value={r.status || "Open"} onChange={(e) => updateRow(r.id, { status: e.target.value })}>
                          {FORECAST_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        {r.matched_at ? (
                          <div>
                            <div className="text-xs font-semibold" style={{ color: "var(--green)" }}>
                              {fmtGBP(r.actual_gp)} · Doc {r.matched_document_number}
                            </div>
                            <div className="text-xs" style={{ color: "var(--ink-faint)" }}>
                              {r.matched_order_date ? fmtDate(r.matched_order_date) : ""}
                              {r.match_method === "business_name" ? " · by name" : " · by Opp ID"}
                            </div>
                            {r.matched_company && r.matched_company.toUpperCase() !== String(r.business_name || "").toUpperCase() && (
                              <div className="text-xs" style={{ color: "var(--amber)" }}>NS: {r.matched_company}</div>
                            )}
                            <div className="text-xs" style={{ color: Math.abs(gpDiff || 0) < 1 ? "var(--ink-faint)" : (gpDiff || 0) < 0 ? "var(--red)" : "var(--amber)" }}>
                              {Math.abs(gpDiff || 0) < 1 ? "matches forecast" : `${(gpDiff || 0) > 0 ? "+" : ""}${fmtGBP(gpDiff || 0)} vs forecast`}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs" style={{ color: r.status === "Won" ? "var(--amber)" : "var(--ink-faint)" }}>
                            {r.status === "Won" ? "Won, but not found in NetSuite" : "not seen yet"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {weekRows.length === 0 && (
                  <tr><td colSpan={11} className="px-4 py-10 text-center" style={{ color: "var(--ink-faint)" }}>
                    {loading ? "Loading..." : "No forecasts for this week yet."}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  QUOTE BUILDER — customer-facing order confirmation                     */
/* ---------------------------------------------------------------------- */

const LEAD_TIMES = [
  ["Broadband", "Up to 14 working days"],
  ["Cloud Voice Express", "Up to 14 working days"],
  ["Cloud Voice / Cloud Works", "Up to 6 weeks"],
  ["Digital Voice for Business", "Up to 7 working days"],
  ["EE Mobile (Future Mobile)", "Up to 14 working days"],
  ["EE SME", "Up to 7 working days"],
  ["BTNet Leased Line", "Up to 90 working days"],
];

function QuoteBuilderView({ profile, staff }) {
  const me = useMemo(
    () => (staff || []).find((s) => s.user_id && profile && s.user_id === profile.id) || null,
    [staff, profile]
  );

  const [q, setQ] = useState({
    customerName: "",
    companyName: "",
    monthly: "",
    term: "60",
    directPhone: "",
    services: "Cloud Voice Package – 5 Users & 5 × Yealink W73P Handsets\nCloud Voice Unlimited Calling Plan – Unlimited calls to UK local, national & UK mobiles\nSOGEA Broadband – XMbps Download / XMbps Upload – Minimum Guaranteed Access Line Speed (MGALS): XMbps\nBusiness Antivirus, Detect & Respond licences – Covers up to X devices",
    senderName: "",
    senderTitle: "Sales Advisor",
  });
  const [copied, setCopied] = useState("");

  // Prefill from whoever's signed in
  useEffect(() => {
    if (me && !q.senderName) setQ((p) => ({ ...p, senderName: me.full_name || "" }));
  }, [me]);

  const set = (k) => (e) => setQ((p) => ({ ...p, [k]: e.target.value }));
  const serviceLines = q.services.split("\n").map((s) => s.trim()).filter(Boolean);

  const printQuote = () => {
    const node = document.getElementById("sw-quote-doc");
    if (!node) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Order Confirmation — ${q.companyName || "Customer"}</title>
      <meta charset="utf-8" />
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        body { margin:0; font-family:'Inter',Arial,sans-serif; }
        @page { margin: 12mm; }
      </style></head><body>${node.outerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 400);
  };

  const copyText = () => {
    const node = document.getElementById("sw-quote-doc");
    if (!node) return;
    navigator.clipboard?.writeText(node.innerText || "");
    setCopied("Copied — paste straight into an email");
    setTimeout(() => setCopied(""), 2500);
  };

  const H = ({ children }) => (
    <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: "22px 0 8px", letterSpacing: "-0.01em" }}>{children}</div>
  );
  const P = ({ children, dim }) => (
    <p style={{ fontSize: 13, lineHeight: 1.6, color: dim ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.92)", margin: "0 0 10px" }}>{children}</p>
  );
  const Bullet = ({ children }) => (
    <li style={{ fontSize: 13, lineHeight: 1.6, color: "rgba(255,255,255,0.92)", marginBottom: 4 }}>{children}</li>
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <FileText size={18} style={{ color: "var(--primary)" }} />
        <h2 className="sw-display text-lg font-bold">Quote Builder</h2>
        <span className="text-xs" style={{ color: "var(--ink-faint)" }}>Order confirmation to send to the customer</span>
        <div className="ml-auto flex items-center gap-2">
          {copied && <span className="text-xs font-semibold" style={{ color: "var(--green)" }}>{copied}</span>}
          <button onClick={copyText} className="sw-focus px-3 py-2 rounded-lg text-xs font-semibold"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--ink-soft)" }}>Copy text</button>
          <button onClick={printQuote} className="sw-focus px-3 py-2 rounded-lg text-xs font-semibold text-white"
            style={{ background: "var(--primary)" }}>Print / Save PDF</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 320px) minmax(0, 1fr)", gap: "1rem", alignItems: "start" }}>

        {/* Inputs */}
        <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="sw-display text-sm mb-3" style={{ color: "var(--ink-faint)", fontWeight: 600, letterSpacing: "0.03em" }}>DETAILS</div>

          <label className="sw-label">Customer contact name</label>
          <input className="sw-input sw-focus mb-2" value={q.customerName} onChange={set("customerName")} placeholder="e.g. Sarah" />

          <label className="sw-label">Company name</label>
          <input className="sw-input sw-focus mb-2" value={q.companyName} onChange={set("companyName")} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <div>
              <label className="sw-label">£ per month</label>
              <input className="sw-input sw-focus mb-2" value={q.monthly} onChange={set("monthly")} placeholder="249" />
            </div>
            <div>
              <label className="sw-label">Term (months)</label>
              <input className="sw-input sw-focus mb-2" value={q.term} onChange={set("term")} />
            </div>
          </div>

          <label className="sw-label">Services — one per line</label>
          <textarea className="sw-input sw-focus mb-2" rows={7} value={q.services} onChange={set("services")} />

          <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="text-xs font-semibold uppercase mb-2" style={{ color: "var(--ink-soft)" }}>Your details</div>
            <label className="sw-label">Name</label>
            <input className="sw-input sw-focus mb-2" value={q.senderName} onChange={set("senderName")} />
            <label className="sw-label">Job title</label>
            <input className="sw-input sw-focus mb-2" value={q.senderTitle} onChange={set("senderTitle")} />
            <label className="sw-label">Direct telephone</label>
            <input className="sw-input sw-focus" value={q.directPhone} onChange={set("directPhone")} placeholder="01752 XXXXXX" />
          </div>
        </div>

        {/* The document itself */}
        <div id="sw-quote-doc" style={{ background: "#4C1D8F", borderRadius: 16, padding: "34px 38px", color: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 26 }}>
            <div>
              <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-0.02em" }}>Order Confirmation</div>
              <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>
                What happens next{q.companyName ? ` — ${q.companyName}` : ""}
              </div>
            </div>
            <div style={{ background: "#fff", borderRadius: 8, padding: "8px 12px" }}>
              <img src="/logo.jpg" alt="BT Local Business — Coastel Communications" style={{ height: 34, display: "block" }} />
            </div>
          </div>

          <P>Dear {q.customerName || "Customer Name"},</P>
          <P>Firstly, thank you for choosing to place your order with me and BT Local Business. I truly appreciate your trust in us and look forward to supporting you throughout your installation and beyond.</P>
          <P>Below is a clear summary of your agreed package, along with what you can expect over the coming weeks. Please keep this email for reference.</P>
          <P>If at any stage you have questions or need clarification, you can contact me directly on {q.directPhone || "01752 XXXXXX"}.</P>

          <H>Your Agreed Package</H>
          <div style={{ background: "rgba(255,255,255,0.10)", borderRadius: 10, padding: "14px 18px", marginBottom: 12 }}>
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em", color: "rgba(255,255,255,0.65)", marginBottom: 6 }}>Contract &amp; charges</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>£{q.monthly || "X"} <span style={{ fontSize: 13, fontWeight: 400, color: "rgba(255,255,255,0.75)" }}>per month (excl. VAT)</span></div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>{q.term || "60"} month agreement</div>
          </div>

          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em", color: "rgba(255,255,255,0.65)", marginBottom: 6 }}>Services included</div>
          <ul style={{ margin: "0 0 14px", paddingLeft: 18 }}>
            {serviceLines.map((s, i) => <Bullet key={i}>{s}</Bullet>)}
          </ul>

          <P>You will shortly receive a series of automated emails confirming:</P>
          <ul style={{ margin: "0 0 10px", paddingLeft: 18 }}>
            <Bullet>The full product breakdown</Bullet>
            <Bullet>Your official order reference number(s)</Bullet>
            <Bullet>Provisional installation / activation dates</Bullet>
          </ul>
          <P dim>Please review these carefully and let me know if anything appears incorrect.</P>

          <H>Estimated Timescales</H>
          <P dim>Whilst we will always aim to complete your order as efficiently as possible, the following are standard estimated lead times:</P>
          <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 10, overflow: "hidden", marginBottom: 10 }}>
            {LEAD_TIMES.map(([svc, time], i) => (
              <div key={svc} style={{ display: "flex", justifyContent: "space-between", padding: "7px 14px", fontSize: 12.5, background: i % 2 ? "rgba(255,255,255,0.05)" : "transparent" }}>
                <span>{svc}</span><span style={{ color: "rgba(255,255,255,0.78)" }}>{time}</span>
              </div>
            ))}
          </div>
          <P dim>These timescales may vary depending on survey requirements and engineering availability, and are all subject to survey.</P>

          <H>What Happens Next</H>
          <P><b>1. Sales Delivery contact</b> — you may receive a call or email from our Sales Delivery Team to confirm order details, arrange any required engineer visit, and validate installation information. If you spot any discrepancy, tell me or the Sales Delivery agent immediately so we can resolve it before the order progresses.</P>
          <P><b>2. Credit &amp; validation</b> — your order passes through our Credit Referral Department for validation.</P>
          <P><b>3. Aftersales &amp; installation</b> — if your package includes broadband, our Aftersales Team will confirm installation dates and engineer time slots by email. If Openreach attendance is required, you'll receive the appointment window.</P>
          <P><b>4. Cloud setup (if applicable)</b> — for Cloud Voice, Cloud Works or Digital Voice you'll receive a CRF to complete and return, and an invitation to book a Welcome Call with our Cloud Onboarding Team. The order won't progress until both are done.</P>
          <P><b>5. Order completion</b> — once installation is complete a new account number is generated (beginning WW, WM, ST, GP or VP). Each product may generate its own number.</P>

          <H>Important Information</H>
          <P><b>Subject to survey.</b> Any installation or activation date is subject to survey and may change following engineering checks. You'll be notified by email, text or phone if it does.</P>
          <P><b>Minimum Guaranteed Access Line Speed.</b> If, after a 30-day stabilisation period, your service consistently falls below the stated threshold and cannot be resolved, you may have the option to leave without Early Termination Charges by following our Faults Process.</P>

          <H>Ongoing Support</H>
          <P>Thank you again for your business and for taking the time to work through your requirements with me.</P>
          <P>I'm available Monday to Friday, 9:00am–5:00pm. I'm typically unavailable between 11:30am and 3:00pm due to customer appointments, however voicemails and emails will be answered the same working day wherever possible, or by 12:00pm the next working day at the latest.</P>
          <P>I look forward to seeing your services go live and supporting your business moving forward.</P>

          <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.25)" }}>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>Kind regards,</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 8 }}>{q.senderName || "Your name"}</div>
            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.78)" }}>{q.senderTitle}</div>
            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.78)" }}>BT Local Business (Devon, Cornwall, Somerset and Dorset)</div>
            {q.directPhone && <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.78)", marginTop: 6 }}>Direct: {q.directPhone}</div>}
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", marginTop: 6 }}>
              Plymouth 01752 777880 · Exeter 01392 825990 · Taunton 01823 490000 · Bournemouth 01202 868869
            </div>
            <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)", marginTop: 12, lineHeight: 1.5 }}>
              Prices are indicative and will be confirmed when the order is accepted by BT. They may be subject to survey.
              All products and services come with our standard terms and conditions, available online.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  LANDSCAPES — prospect bank, allocated out to be called                 */
/* ---------------------------------------------------------------------- */

const LANDSCAPE_PRODUCTS = ["Mobile", "BTNet", "Broadband", "Cloud"];
const LANDSCAPE_STATUSES = ["New", "Allocated", "Called", "Callback", "Not Interested", "Converted"];
const LANDSCAPE_TONE = {
  "New": "primary", "Allocated": "blue", "Called": "amber",
  "Callback": "gold", "Not Interested": "neutral", "Converted": "green",
};

function LandscapesView({ profile, staff }) {
  const { sellers } = useStaff();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [productFilter, setProductFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [allocFilter, setAllocFilter] = useState("All");
  const [endsWithin, setEndsWithin] = useState("All");
  const [selected, setSelected] = useState([]);
  const [bulkTarget, setBulkTarget] = useState("");

  const canAllocate = profile?.role === "office" || profile?.role === "2ic";
  const me = useMemo(() => (staff || []).find((s) => s.user_id && profile && s.user_id === profile.id) || null, [staff, profile]);

  const blank = { company_name: "", contact_name: "", contact_number: "", product: "Mobile", units: "", current_provider: "", contract_end: "", notes: "" };
  const [draft, setDraft] = useState(blank);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("landscapes").select("*").order("created_at", { ascending: false });
    setRows(data || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const flash = (m) => { setNote(m); setTimeout(() => setNote(""), 3500); };

  const addLandscape = async () => {
    if (!draft.company_name.trim()) { flash("Company name is needed."); return; }
    setSaving(true);
    const { error } = await supabase.from("landscapes").insert({
      company_name: draft.company_name.trim(),
      contact_name: draft.contact_name.trim() || null,
      contact_number: draft.contact_number.trim() || null,
      product: draft.product,
      units: draft.units ? parseFloat(draft.units) || null : null,
      current_provider: draft.current_provider.trim() || null,
      contract_end: draft.contract_end || null,
      notes: draft.notes.trim() || null,
      created_by_name: me?.full_name || profile?.full_name || null,
      created_team: me?.team || null,
      status: "New",
    });
    setSaving(false);
    if (error) { flash(`Couldn't save: ${error.message}`); return; }
    setDraft(blank); setAdding(false); load();
  };

  const allocate = async (ids, agentName) => {
    if (!ids.length || !agentName) return;
    const s = findStaff(sellers, agentName);
    const { error } = await supabase.from("landscapes").update({
      allocated_to: s?.user_id || null,
      allocated_to_name: agentName,
      allocated_team: s?.team || null,
      allocated_at: new Date().toISOString(),
      allocated_by_name: me?.full_name || profile?.full_name || null,
      status: "Allocated",
    }).in("id", ids);
    if (error) { flash(`Couldn't allocate: ${error.message}`); return; }
    flash(`${ids.length} allocated to ${agentName}`);
    setSelected([]); setBulkTarget(""); load();
  };

  const updateRow = async (id, patch) => {
    const { error } = await supabase.from("landscapes").update(patch).eq("id", id);
    if (error) { flash(`Couldn't update: ${error.message}`); return; }
    load();
  };

  const daysUntil = (d) => {
    if (!d) return null;
    return Math.round((new Date(d + "T00:00:00").getTime() - Date.now()) / 86400000);
  };

  const filtered = useMemo(() => rows.filter((r) => {
    const q = query.trim().toLowerCase();
    if (q && !(String(r.company_name || "").toLowerCase().includes(q)
      || String(r.contact_name || "").toLowerCase().includes(q)
      || String(r.current_provider || "").toLowerCase().includes(q))) return false;
    if (productFilter !== "All" && r.product !== productFilter) return false;
    if (statusFilter !== "All" && r.status !== statusFilter) return false;
    if (allocFilter === "__mine" && r.allocated_to !== profile?.id) return false;
    if (allocFilter === "__unallocated" && r.allocated_to_name) return false;
    if (allocFilter !== "All" && allocFilter !== "__mine" && allocFilter !== "__unallocated"
      && r.allocated_to_name !== allocFilter) return false;
    if (endsWithin !== "All") {
      const d = daysUntil(r.contract_end);
      if (d === null) return false;
      if (endsWithin === "overdue" && d >= 0) return false;
      if (endsWithin !== "overdue" && (d < 0 || d > parseInt(endsWithin, 10))) return false;
    }
    return true;
  }), [rows, query, productFilter, statusFilter, allocFilter, endsWithin, profile]);

  const allocatedNames = useMemo(() => {
    const s = new Set();
    rows.forEach((r) => { if (r.allocated_to_name) s.add(r.allocated_to_name); });
    return Array.from(s).sort();
  }, [rows]);

  const stats = useMemo(() => ({
    total: rows.length,
    unallocated: rows.filter((r) => !r.allocated_to_name).length,
    mine: rows.filter((r) => r.allocated_to === profile?.id && r.status !== "Converted").length,
    dueSoon: rows.filter((r) => { const d = daysUntil(r.contract_end); return d !== null && d >= 0 && d <= 90; }).length,
    converted: rows.filter((r) => r.status === "Converted").length,
  }), [rows, profile]);

  const toggleSel = (id) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <MapPin size={18} style={{ color: "var(--primary)" }} />
        <h2 className="sw-display text-lg font-bold">Landscapes</h2>
        <span className="text-xs" style={{ color: "var(--ink-faint)" }}>Prospects gathered, allocated out to be called</span>
        <button onClick={() => setAdding((a) => !a)} className="sw-focus ml-auto px-3 py-2 rounded-lg text-xs font-semibold text-white flex items-center gap-1"
          style={{ background: "var(--primary)" }}><Plus size={13} /> Add landscape</button>
      </div>

      {note && (
        <div className="rounded-xl p-2.5 mb-3 text-xs font-semibold"
          style={{ background: note.startsWith("Couldn't") ? "var(--red-soft)" : "var(--green-soft)", color: note.startsWith("Couldn't") ? "var(--red)" : "var(--green)" }}>{note}</div>
      )}

      {/* Snapshot */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem" }} className="mb-4">
        {[
          ["In the bank", stats.total, "var(--ink)"],
          ["Unallocated", stats.unallocated, "var(--amber)"],
          ["Allocated to me", stats.mine, "var(--primary)"],
          ["Ending in 90 days", stats.dueSoon, "var(--blue)"],
          ["Converted", stats.converted, "var(--green)"],
        ].map(([label, val, colour]) => (
          <div key={label} className="rounded-2xl p-3.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="text-xs font-semibold uppercase" style={{ color: "var(--ink-soft)" }}>{label}</div>
            <div className="sw-display font-bold text-xl" style={{ color: colour }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Add form */}
      {adding && (
        <div className="rounded-2xl p-4 mb-4" style={{ background: "var(--surface)", border: "1px solid var(--primary)" }}>
          <div className="sw-display font-bold text-sm mb-3">New landscape</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.6rem" }}>
            <div><label className="sw-label">Company name *</label>
              <input className="sw-input sw-focus" value={draft.company_name} onChange={(e) => setDraft((d) => ({ ...d, company_name: e.target.value }))} /></div>
            <div><label className="sw-label">Contact name</label>
              <input className="sw-input sw-focus" value={draft.contact_name} onChange={(e) => setDraft((d) => ({ ...d, contact_name: e.target.value }))} /></div>
            <div><label className="sw-label">Contact number</label>
              <input className="sw-input sw-focus" value={draft.contact_number} onChange={(e) => setDraft((d) => ({ ...d, contact_number: e.target.value }))} /></div>
            <div><label className="sw-label">Product</label>
              <select className="sw-input sw-focus" value={draft.product} onChange={(e) => setDraft((d) => ({ ...d, product: e.target.value }))}>
                {LANDSCAPE_PRODUCTS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select></div>
            <div><label className="sw-label">Units</label>
              <input className="sw-input sw-focus" value={draft.units} onChange={(e) => setDraft((d) => ({ ...d, units: e.target.value }))} /></div>
            <div><label className="sw-label">Current provider</label>
              <input className="sw-input sw-focus" value={draft.current_provider} onChange={(e) => setDraft((d) => ({ ...d, current_provider: e.target.value }))} /></div>
            <div><label className="sw-label">Contract end date</label>
              <input className="sw-input sw-focus" type="date" value={draft.contract_end} onChange={(e) => setDraft((d) => ({ ...d, contract_end: e.target.value }))} /></div>
            <div style={{ gridColumn: "span 2" }}><label className="sw-label">Notes</label>
              <input className="sw-input sw-focus" value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} /></div>
          </div>
          <div className="flex gap-2 mt-3 justify-end">
            <button onClick={() => { setAdding(false); setDraft(blank); }} className="sw-focus px-3 py-2 rounded-lg text-xs font-semibold"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--ink-soft)" }}>Cancel</button>
            <button onClick={addLandscape} disabled={saving} className="sw-focus px-4 py-2 rounded-lg text-xs font-semibold text-white"
              style={{ background: "var(--primary)" }}>{saving ? "Saving..." : "Add landscape"}</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-3 p-3 rounded-2xl flex items-center gap-2 flex-wrap" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="relative" style={{ flex: 1, minWidth: 180 }}>
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-faint)" }} />
          <input className="sw-input sw-focus" style={{ paddingLeft: 32 }} placeholder="Search company, contact or provider..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="sw-input sw-focus" style={{ width: 140 }} value={productFilter} onChange={(e) => setProductFilter(e.target.value)}>
          <option value="All">All products</option>
          {LANDSCAPE_PRODUCTS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="sw-input sw-focus" style={{ width: 150 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="All">All statuses</option>
          {LANDSCAPE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="sw-input sw-focus" style={{ width: 170 }} value={allocFilter} onChange={(e) => setAllocFilter(e.target.value)}>
          <option value="All">Anyone</option>
          <option value="__mine">Allocated to me</option>
          <option value="__unallocated">Unallocated</option>
          {allocatedNames.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select className="sw-input sw-focus" style={{ width: 160 }} value={endsWithin} onChange={(e) => setEndsWithin(e.target.value)}>
          <option value="All">Any end date</option>
          <option value="overdue">Already ended</option>
          <option value="30">Ends in 30 days</option>
          <option value="90">Ends in 90 days</option>
          <option value="180">Ends in 6 months</option>
        </select>
      </div>

      {/* Bulk allocate */}
      {canAllocate && selected.length > 0 && (
        <div className="rounded-xl p-3 mb-3 flex items-center gap-2 flex-wrap" style={{ background: "var(--primary-soft)", border: "1px solid var(--primary)" }}>
          <span className="text-xs font-semibold" style={{ color: "var(--primary)" }}>{selected.length} selected</span>
          <select className="sw-input sw-focus" style={{ width: 190 }} value={bulkTarget} onChange={(e) => setBulkTarget(e.target.value)}>
            <option value="">Allocate to...</option>
            {sellers.map((s) => <option key={s.full_name} value={s.full_name}>{s.full_name}</option>)}
          </select>
          <button onClick={() => allocate(selected, bulkTarget)} disabled={!bulkTarget}
            className="sw-focus px-3 py-2 rounded-lg text-xs font-semibold text-white"
            style={{ background: bulkTarget ? "var(--primary)" : "var(--ink-faint)" }}>Allocate</button>
          <button onClick={() => setSelected([])} className="sw-focus text-xs font-semibold ml-auto" style={{ color: "var(--primary)" }}>Clear selection</button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--surface-alt)" }}>
                {canAllocate && <th className="px-2 py-2" style={{ width: 32 }}>
                  <input type="checkbox"
                    checked={filtered.length > 0 && selected.length === filtered.length}
                    onChange={(e) => setSelected(e.target.checked ? filtered.map((r) => r.id) : [])} />
                </th>}
                {["Company", "Contact", "Product", "Provider", "Contract ends", "Allocated to", "Status"].map((h) => (
                  <th key={h} className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: "var(--ink-soft)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const d = daysUntil(r.contract_end);
                const urgent = d !== null && d >= 0 && d <= 90;
                const ended = d !== null && d < 0;
                return (
                  <tr key={r.id} style={{ borderTop: "1px solid var(--border)", background: selected.includes(r.id) ? "var(--primary-soft)" : undefined }}>
                    {canAllocate && <td className="px-2 py-2 text-center">
                      <input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggleSel(r.id)} />
                    </td>}
                    <td className="px-3 py-2" style={{ maxWidth: 200 }}>
                      <div className="text-xs font-medium truncate">{r.company_name}</div>
                      {r.notes && <div className="truncate" style={{ color: "var(--ink-faint)", fontSize: 10 }}>{r.notes}</div>}
                    </td>
                    <td className="px-3 py-2" style={{ maxWidth: 150 }}>
                      <div className="text-xs truncate">{r.contact_name || "—"}</div>
                      {r.contact_number && <div className="sw-mono truncate" style={{ color: "var(--ink-soft)", fontSize: 10.5 }}>{r.contact_number}</div>}
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">
                      {r.product}{r.units ? <span style={{ color: "var(--ink-faint)" }}> ×{num(r.units)}</span> : null}
                    </td>
                    <td className="px-3 py-2 text-xs truncate" style={{ color: "var(--ink-soft)", maxWidth: 130 }}>{r.current_provider || "—"}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">
                      {r.contract_end ? (
                        <span style={{ color: ended ? "var(--red)" : urgent ? "var(--amber)" : "var(--ink)" }}>
                          {fmtDate(r.contract_end)}
                          <span style={{ fontSize: 10, display: "block", color: "var(--ink-faint)" }}>
                            {ended ? `${Math.abs(d)}d ago` : `in ${d}d`}
                          </span>
                        </span>
                      ) : <span style={{ color: "var(--ink-faint)" }}>—</span>}
                    </td>
                    <td className="px-3 py-2">
                      {canAllocate ? (
                        <select className="sw-input sw-focus" style={{ width: 145, fontSize: 11, padding: "4px 6px" }}
                          value={r.allocated_to_name || ""} onChange={(e) => allocate([r.id], e.target.value)}>
                          <option value="">Unallocated</option>
                          {sellers.map((s) => <option key={s.full_name} value={s.full_name}>{s.full_name}</option>)}
                        </select>
                      ) : (
                        <span className="text-xs">{r.allocated_to_name || <span style={{ color: "var(--ink-faint)" }}>Unallocated</span>}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <select className="sw-input sw-focus" style={{ width: 130, fontSize: 11, padding: "4px 6px" }}
                        value={r.status || "New"}
                        onChange={(e) => updateRow(r.id, {
                          status: e.target.value,
                          called_at: e.target.value === "Called" ? new Date().toISOString() : r.called_at,
                        })}>
                        {LANDSCAPE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={canAllocate ? 8 : 7} className="px-4 py-10 text-center" style={{ color: "var(--ink-faint)" }}>
                  {loading ? "Loading..." : "Nothing matches those filters yet."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs mt-3" style={{ color: "var(--ink-faint)" }}>
        Anyone can add a landscape and see the bank. Managers and 2ICs allocate them out; whoever it's
        allocated to can log the outcome. Call-log matching comes later — that's what will confirm the
        call actually happened.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  SALES DISTRIBUTION — who generates for whom                            */
/* ---------------------------------------------------------------------- */

function DistributionView({ orders, netsuite }) {
  const [period, setPeriod] = useState("mtd");
  const [productFilter, setProductFilter] = useState("All");
  const [metric, setMetric] = useState("gp");     // gp | count
  const [hover, setHover] = useState(null);       // {closer, leadGen}

  const productOptions = useMemo(() => {
    const s = new Set();
    (orders || []).forEach((o) => {
      String(o.item_name_grouped || o.product_group_2 || "").split(/\s*\+\s*/)
        .forEach((p) => { const t = p.trim(); if (t) s.add(t); });
    });
    return Array.from(s).sort();
  }, [orders]);

  // Only deals with BOTH a closer and a lead gen — the point is the pairing.
  const pairs = useMemo(() => {
    const from = periodStart(period);
    return (orders || []).filter((o) => {
      if (o.removed_at) return false;
      if (!o.closer_name || !o.lead_gen_name) return false;
      if (from && (!o.submission_date || new Date(o.submission_date) < from)) return false;
      if (productFilter !== "All") {
        const hay = String(o.item_name_grouped || o.product_group_2 || "").toLowerCase();
        if (!hay.includes(productFilter.toLowerCase())) return false;
      }
      return true;
    });
  }, [orders, period, productFilter]);

  const { closers, leadGens, cell, closerTotal, leadGenTotal, grand, teamMatrix, teams } = useMemo(() => {
    const cell = {};
    const closerTotal = {}, leadGenTotal = {};
    const teamMatrix = {};
    const teamSet = new Set();
    let grand = 0;

    pairs.forEach((o) => {
      const c = o.closer_name, l = o.lead_gen_name;
      const v = metric === "gp"
        ? num(o.gp_office != null ? o.gp_office : o.sales_agent_gp)
        : 1;
      const k = `${c}||${l}`;
      cell[k] = (cell[k] || 0) + v;
      closerTotal[c] = (closerTotal[c] || 0) + v;
      leadGenTotal[l] = (leadGenTotal[l] || 0) + v;
      grand += v;

      const ct = o.closer_team || "Unassigned";
      const lt = o.lead_gen_team || "Unassigned";
      teamSet.add(ct); teamSet.add(lt);
      const tk = `${ct}||${lt}`;
      teamMatrix[tk] = (teamMatrix[tk] || 0) + v;
    });

    return {
      cell, closerTotal, leadGenTotal, grand, teamMatrix,
      closers: Object.keys(closerTotal).sort((a, b) => closerTotal[b] - closerTotal[a]),
      leadGens: Object.keys(leadGenTotal).sort((a, b) => leadGenTotal[b] - leadGenTotal[a]),
      teams: Array.from(teamSet).sort(),
    };
  }, [pairs, metric]);

  const maxCell = useMemo(() => Math.max(1, ...Object.keys(cell).map((k) => cell[k])), [cell]);
  const fmt = (v) => (metric === "gp" ? fmtGBP(v) : (v || 0).toLocaleString("en-GB"));

  // Deeper purple the more they've generated together
  const shade = (v) => (v ? `rgba(76, 29, 143, ${0.10 + (v / maxCell) * 0.82})` : "transparent");
  const textOn = (v) => (v && v / maxCell > 0.45 ? "#fff" : "var(--ink)");

  const maxTeamCell = useMemo(() => Math.max(1, ...Object.keys(teamMatrix).map((k) => teamMatrix[k])), [teamMatrix]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Users size={18} style={{ color: "var(--primary)" }} />
        <h2 className="sw-display text-lg font-bold">Sales Distribution</h2>
        <span className="text-xs" style={{ color: "var(--ink-faint)" }}>Who generates business for whom</span>

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            {[["gp", "GP"], ["count", "Deals"]].map(([k, lbl]) => (
              <button key={k} onClick={() => setMetric(k)} className="sw-focus px-3 py-1.5 text-xs font-bold"
                style={metric === k ? { background: "var(--primary)", color: "#fff" } : { background: "transparent", color: "var(--ink-soft)" }}>{lbl}</button>
            ))}
          </div>
          <select className="sw-input sw-focus" style={{ width: 108 }} value={period} onChange={(e) => setPeriod(e.target.value)}>
            {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <select className="sw-input sw-focus" style={{ width: 160 }} value={productFilter} onChange={(e) => setProductFilter(e.target.value)}>
            <option value="All">All products</option>
            {productOptions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {/* Team against team */}
      <div className="rounded-2xl p-4 mb-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-baseline justify-between mb-3">
          <div className="sw-display text-sm" style={{ color: "var(--ink-faint)", fontWeight: 600, letterSpacing: "0.03em" }}>TEAM RELATIONSHIPS</div>
          <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
            {pairs.length} shared deal{pairs.length === 1 ? "" : "s"} · {fmt(grand)} total
          </span>
        </div>
        {teams.length === 0 ? (
          <div className="text-xs text-center py-6" style={{ color: "var(--ink-faint)" }}>No shared deals in this period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th className="px-3 py-1.5 text-left text-xs font-semibold uppercase" style={{ color: "var(--ink-faint)" }}>Lead gen ↓ / Closer →</th>
                  {teams.map((t) => (
                    <th key={t} className="px-3 py-1.5 text-center text-xs font-semibold whitespace-nowrap" style={{ color: "var(--ink-soft)" }}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teams.map((lt) => (
                  <tr key={lt}>
                    <td className="px-3 py-1.5 text-xs font-semibold whitespace-nowrap" style={{ color: "var(--ink-soft)" }}>{lt}</td>
                    {teams.map((ct) => {
                      const v = teamMatrix[`${ct}||${lt}`] || 0;
                      const same = ct === lt;
                      return (
                        <td key={ct} className="px-3 py-1.5 text-center sw-mono"
                          style={{
                            fontSize: 12, fontWeight: v ? 700 : 400,
                            background: v ? `rgba(76, 29, 143, ${0.10 + (v / maxTeamCell) * 0.8})` : "var(--surface-alt)",
                            color: v && v / maxTeamCell > 0.45 ? "#fff" : v ? "var(--ink)" : "var(--ink-faint)",
                            border: same ? "1px dashed var(--border)" : "1px solid var(--surface)",
                          }}
                          title={same ? `${ct} — within the same team` : `${lt} generated for ${ct}`}>
                          {v ? fmt(v) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs mt-2" style={{ color: "var(--ink-faint)" }}>
          Read down for the lead gen, across for the closer. The dashed diagonal is work kept inside one team.
        </p>
      </div>

      {/* Person against person */}
      <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="px-4 py-2.5 flex items-baseline justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="sw-display text-sm" style={{ color: "var(--ink-faint)", fontWeight: 600, letterSpacing: "0.03em" }}>AGENT MATRIX</div>
          <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
            {hover ? `${hover.leadGen} → ${hover.closer}` : "Lead gens down the side, closers across the top"}
          </span>
        </div>

        {closers.length === 0 ? (
          <div className="text-xs text-center py-12" style={{ color: "var(--ink-faint)" }}>
            No deals with both a closer and a lead gen in this period.
          </div>
        ) : (
          <div style={{ overflow: "auto", maxHeight: "70vh" }}>
            <table style={{ borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th style={{ position: "sticky", left: 0, top: 0, zIndex: 3, background: "var(--surface-alt)", minWidth: 150 }}
                    className="px-3 py-2 text-left text-xs font-semibold uppercase">
                    <span style={{ color: "var(--ink-faint)" }}>Lead gen ↓</span>
                  </th>
                  {closers.map((c) => (
                    <th key={c} style={{ position: "sticky", top: 0, zIndex: 2, background: "var(--surface-alt)", minWidth: 74 }}
                      className="px-1 py-2">
                      <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: 11, fontWeight: 600, color: "var(--ink-soft)", whiteSpace: "nowrap", maxHeight: 108, overflow: "hidden" }}>
                        {c}
                      </div>
                    </th>
                  ))}
                  <th style={{ position: "sticky", top: 0, right: 0, zIndex: 3, background: "var(--primary)", minWidth: 82 }}
                    className="px-2 py-2 text-center text-xs font-bold" >
                    <span style={{ color: "#fff" }}>Total</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {leadGens.map((l) => (
                  <tr key={l}>
                    <td style={{ position: "sticky", left: 0, zIndex: 1, background: "var(--surface)", borderTop: "1px solid var(--border)" }}
                      className="px-3 py-1.5 text-xs font-semibold whitespace-nowrap truncate">{l}</td>
                    {closers.map((c) => {
                      const v = cell[`${c}||${l}`] || 0;
                      const self = c === l;
                      return (
                        <td key={c}
                          onMouseEnter={() => setHover({ closer: c, leadGen: l })}
                          onMouseLeave={() => setHover(null)}
                          title={v ? `${l} → ${c}: ${fmt(v)}` : `${l} → ${c}: none`}
                          className="px-1 py-1.5 text-center sw-mono"
                          style={{
                            fontSize: 11,
                            fontWeight: v ? 700 : 400,
                            background: self ? "var(--surface-alt)" : shade(v),
                            color: v ? textOn(v) : "var(--ink-faint)",
                            borderTop: "1px solid var(--border)",
                            outline: hover && hover.closer === c && hover.leadGen === l ? "2px solid var(--ink)" : "none",
                          }}>
                          {v ? fmt(v) : ""}
                        </td>
                      );
                    })}
                    <td style={{ position: "sticky", right: 0, background: "var(--primary-soft)", borderTop: "1px solid var(--border)" }}
                      className="px-2 py-1.5 text-center sw-mono text-xs font-bold">{fmt(leadGenTotal[l])}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ position: "sticky", left: 0, zIndex: 1, background: "var(--primary)", borderTop: "2px solid var(--border)" }}
                    className="px-3 py-2 text-xs font-bold" >
                    <span style={{ color: "#fff" }}>Closer total</span>
                  </td>
                  {closers.map((c) => (
                    <td key={c} className="px-1 py-2 text-center sw-mono text-xs font-bold"
                      style={{ background: "var(--primary-soft)", color: "var(--primary)", borderTop: "2px solid var(--border)" }}>
                      {fmt(closerTotal[c])}
                    </td>
                  ))}
                  <td style={{ position: "sticky", right: 0, background: "var(--primary)", borderTop: "2px solid var(--border)" }}
                    className="px-2 py-2 text-center sw-mono text-xs font-bold">
                    <span style={{ color: "#fff" }}>{fmt(grand)}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs mt-3" style={{ color: "var(--ink-faint)" }}>
        Only deals with both a closer and a lead gen appear here — the whole point is the pairing. Darker
        cells mean more generated together. Blank means that pair hasn't worked on anything in this period,
        which is often the more useful thing to spot.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  SIDEBAR NAVIGATION                                                     */
/* ---------------------------------------------------------------------- */

const SIDEBAR_KEY = "sw-sidebar-pinned";

function SidebarItem({ icon: Icon, label, active, collapsed, badge, indent, onClick, href }) {
  const content = (
    <>
      <Icon size={16} className="shrink-0" />
      {!collapsed && <span className="text-sm font-semibold truncate flex-1 text-left">{label}</span>}
      {!collapsed && badge > 0 && (
        <span className="rounded-full px-1.5 text-xs font-bold shrink-0" style={{ background: "var(--amber)", color: "#fff" }}>{badge}</span>
      )}
    </>
  );
  const style = {
    background: active ? "var(--primary)" : "transparent",
    color: active ? "#fff" : "var(--ink-soft)",
    paddingLeft: indent && !collapsed ? 30 : 12,
  };
  const cls = "sw-focus w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors";
  if (href) {
    return <a href={href} onClick={onClick} title={collapsed ? label : undefined} className={cls} style={style}>{content}</a>;
  }
  return <button onClick={onClick} title={collapsed ? label : undefined} className={cls} style={style}>{content}</button>;
}

function SidebarSection({ icon: Icon, label, collapsed, open, onToggle, childActive, children }) {
  return (
    <div>
      <button onClick={onToggle} title={collapsed ? label : undefined}
        className="sw-focus w-full flex items-center gap-2.5 px-3 py-2 rounded-xl"
        style={{ color: childActive ? "var(--primary)" : "var(--ink-soft)" }}>
        <Icon size={16} className="shrink-0" />
        {!collapsed && <span className="text-sm font-semibold truncate flex-1 text-left">{label}</span>}
        {!collapsed && <ChevronDown size={14} className="shrink-0" style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform .15s" }} />}
      </button>
      {(open || collapsed) && <div className={collapsed ? "" : "flex flex-col gap-0.5 mt-0.5"}>{children}</div>}
    </div>
  );
}

function Sidebar({ tab, setTab, profile, newStatusCount, onChangePassword, onSignOut }) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === "collapsed"; } catch (_) { return false; }
  });
  const [mainOpen, setMainOpen] = useState(true);
  const [submitOpen, setSubmitOpen] = useState(true);
  const [dashOpen, setDashOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const isOffice = profile?.role === "office";

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(SIDEBAR_KEY, next ? "collapsed" : "pinned"); } catch (_) {}
      return next;
    });
  };

  const mainActive = ["dashboard", "forecast", "daybyday"].includes(tab);
  const submitActive = ["new", "landscapes", "quote"].includes(tab);
  const dashboardsActive = ["breakdown", "distribution"].includes(tab);
  const settingsActive = ["admin", "statuses"].includes(tab);

  return (
    <div className="shrink-0 flex flex-col" style={{ width: collapsed ? 64 : 226, borderRight: "1px solid var(--border)", background: "var(--surface)", height: "100vh", position: "sticky", top: 0, transition: "width .15s" }}>
      <div className="flex items-center gap-2 px-3 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <Logo height={28} />
        {!collapsed && (
          <div className="min-w-0">
            <div className="sw-display font-bold text-sm leading-none truncate">SchThrive WebOS</div>
            <div className="text-xs flex items-center gap-1" style={{ color: "var(--ink-faint)" }}>
              <Radio size={8} className="sw-live-dot" style={{ color: "var(--green)" }} /> Live
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
        <SidebarSection icon={ClipboardList} label="Main Views" collapsed={collapsed} open={mainOpen} onToggle={() => setMainOpen((o) => !o)} childActive={mainActive}>
          <SidebarItem icon={ClipboardList} label="Claimed" collapsed={collapsed} active={tab === "dashboard"} indent onClick={() => setTab("dashboard")} />
          <SidebarItem icon={TrendingUp} label="Forecasting" collapsed={collapsed} active={tab === "forecast"} indent onClick={() => setTab("forecast")} />
          <SidebarItem icon={CalendarDays} label="Day by Day" collapsed={collapsed} active={tab === "daybyday"} indent onClick={() => setTab("daybyday")} />
        </SidebarSection>

        <div className="my-1" />

        <SidebarSection icon={Inbox} label="Submission Boxes" collapsed={collapsed} open={submitOpen} onToggle={() => setSubmitOpen((o) => !o)} childActive={submitActive}>
          <SidebarItem icon={Plus} label="Submit Lilac Box" collapsed={collapsed} active={tab === "new"} indent onClick={() => setTab("new")} />
          <SidebarItem icon={MapPin} label="Landscapes" collapsed={collapsed} active={tab === "landscapes"} indent onClick={() => setTab("landscapes")} />
          <SidebarItem icon={FileText} label="Quote Builder" collapsed={collapsed} active={tab === "quote"} indent onClick={() => setTab("quote")} />
        </SidebarSection>

        <div className="my-1" />

        <SidebarSection icon={LayoutDashboard} label="Dashboards" collapsed={collapsed} open={dashOpen} onToggle={() => setDashOpen((o) => !o)} childActive={dashboardsActive}>
          <SidebarItem icon={BarChart3} label="Sales Breakdown" collapsed={collapsed} active={tab === "breakdown"} indent onClick={() => setTab("breakdown")} />
          <SidebarItem icon={Users} label="Sales Distribution" collapsed={collapsed} active={tab === "distribution"} indent onClick={() => setTab("distribution")} />
          <SidebarItem icon={Radio} label="TV Mode" collapsed={collapsed} active={false} indent href="#tv" onClick={() => setTimeout(() => window.location.reload(), 0)} />
        </SidebarSection>

        <div className="my-1" />

        <SidebarItem icon={Headphones} label="Sales Coach" collapsed={collapsed} active={tab === "coach"} onClick={() => setTab("coach")} />

        {isOffice && (
          <>
            <div className="my-1" />
            <SidebarSection icon={SettingsIcon} label="Settings" collapsed={collapsed} open={settingsOpen} onToggle={() => setSettingsOpen((o) => !o)} childActive={settingsActive}>
              <SidebarItem icon={Users} label="Admin" collapsed={collapsed} active={tab === "admin"} indent onClick={() => setTab("admin")} />
              <SidebarItem icon={Palette} label="Settings" collapsed={collapsed} active={tab === "statuses"} indent badge={newStatusCount} onClick={() => setTab("statuses")} />
              <SidebarItem icon={KeyRound} label="Change Password" collapsed={collapsed} active={false} indent onClick={onChangePassword} />
            </SidebarSection>
          </>
        )}
      </div>

      <div className="p-2" style={{ borderTop: "1px solid var(--border)" }}>
        {!collapsed && profile && (
          <div className="px-2 pb-2 text-xs truncate" style={{ color: "var(--ink-faint)" }}>
            {profile.role === "office" ? "Office" : profile.role === "2ic" ? "2IC" : "Agent"}{profile.team ? ` · ${profile.team}` : ""}
          </div>
        )}
        <SidebarItem icon={KeyRound} label="Change Password" collapsed={collapsed} active={false} onClick={onChangePassword} />
        <SidebarItem icon={LogOut} label="Sign Out" collapsed={collapsed} active={false} onClick={onSignOut} />
        <SidebarItem icon={collapsed ? PanelLeftOpen : PanelLeftClose} label={collapsed ? "Expand" : "Collapse"} collapsed={collapsed} active={false} onClick={toggleCollapsed} />
      </div>
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
  const [netsuite, setNetsuite] = useState([]);
  const [statusRows, setStatusRows] = useState([]);
  const [payPlans, setPayPlans] = useState([]);
  const [forecasts, setForecasts] = useState([]);
  const [aliases, setAliases] = useState([]);
  const [coachScenarios, setCoachScenarios] = useState([]);
  const [coachSettings, setCoachSettings] = useState({ rubric: "", what_good_looks_like: "" });
  const [allProfiles, setAllProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("dashboard");
  const [selected, setSelected] = useState(null);
  const [flashId, setFlashId] = useState(null);
  const [toast, setToast] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null); // { company, ref } after a successful save
  const [changingPassword, setChangingPassword] = useState(false);
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

  // Someone marked as a leaver shouldn't be able to keep using a live
  // session. Their password is scrambled server-side too; this closes the
  // door on anyone already signed in.
  useEffect(() => {
    if (!session?.user || !staff.length) return;
    const me = staff.find((s) => s.user_id === session.user.id);
    if (me && me.active === false) {
      setToast("This account is no longer active.");
      setTimeout(() => supabase.auth.signOut(), 1500);
    }
  }, [staff, session]);

  // Load the staff list (for dropdowns) once signed in
  const loadStaff = useCallback(async () => {
    const { data } = await supabase.from("staff").select("*").order("full_name");
    setStaff(data || []);
  }, []);
  useEffect(() => { if (session?.user) loadStaff(); }, [session, loadStaff]);

  // NetSuite records — what the TV board reports on.
  // On the TV route we go through tv_netsuite(), which returns the whole
  // office regardless of who's logged in — a wall display shouldn't shrink
  // to one person's deals just because an agent signed in on it.
  const loadNetsuite = useCallback(async () => {
    if (isTVRoute) {
      const { data } = await supabase.rpc("tv_netsuite");
      setNetsuite(data || []);
      return;
    }
    const PAGE = 1000;
    let all = [];
    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("netsuite_orders")
        .select("*")
        .order("order_date", { ascending: false })
        .range(from, from + PAGE - 1);
      if (error || !data) break;
      all = all.concat(data);
      if (data.length < PAGE) break;
      from += PAGE;
      if (from > 100000) break;
    }
    setNetsuite(all);
  }, [isTVRoute]);
  useEffect(() => { if (session?.user) loadNetsuite(); }, [session, loadNetsuite]);

  // Forecasts — the Claimed page can switch to a forecast view
  const loadForecasts = useCallback(async () => {
    const { data } = await supabase.from("forecasts").select("*").order("forecast_week", { ascending: false });
    setForecasts(data || []);
  }, []);
  useEffect(() => { if (session?.user) loadForecasts(); }, [session, loadForecasts]);

  // Name aliases — NetSuite spellings mapped back to the staff list
  const loadAliases = useCallback(async () => {
    const { data } = await supabase.from("staff_aliases").select("*").order("alias");
    setAliases(data || []);
  }, []);
  useEffect(() => { if (session?.user) loadAliases(); }, [session, loadAliases]);

  const aliasMap = useMemo(() => {
    const m = {};
    // A second name on the staff record is the simplest fix for one person
    // with one odd spelling; the alias table handles anything more.
    staff.forEach((s) => {
      if (s.alt_name && s.full_name) m[String(s.alt_name).trim().toLowerCase()] = s.full_name;
    });
    aliases.forEach((a) => { if (a.alias) m[a.alias.trim().toLowerCase()] = a.staff_full_name; });
    return m;
  }, [aliases, staff]);

  const saveAlias = useCallback(async (id, patch) => {
    const { error } = await supabase.from("staff_aliases").update(patch).eq("id", id);
    if (error) { setToast(`Couldn't save: ${error.message}`); setTimeout(() => setToast(""), 5000); return; }
    loadAliases();
  }, [loadAliases]);

  const addAlias = useCallback(async (alias, staffName) => {
    const { error } = await supabase.from("staff_aliases").insert({ alias: alias.trim(), staff_full_name: staffName });
    if (error) { setToast(`Couldn't add: ${error.message}`); setTimeout(() => setToast(""), 5000); return; }
    setToast(`"${alias}" now maps to ${staffName}`);
    setTimeout(() => setToast(""), 3000);
    loadAliases();
  }, [loadAliases]);

  const deleteAlias = useCallback(async (id) => {
    const { error } = await supabase.from("staff_aliases").delete().eq("id", id);
    if (error) { setToast(`Couldn't delete: ${error.message}`); setTimeout(() => setToast(""), 5000); return; }
    loadAliases();
  }, [loadAliases]);

  // Sales Coach scenarios and grading, editable in Settings
  const loadCoachCfg = useCallback(async () => {
    const [{ data: sc }, { data: st }] = await Promise.all([
      supabase.from("coach_scenarios").select("*").order("sort_order"),
      supabase.from("coach_settings").select("*").eq("id", 1).maybeSingle(),
    ]);
    setCoachScenarios(sc || []);
    if (st) setCoachSettings(st);
  }, []);
  useEffect(() => { if (session?.user) loadCoachCfg(); }, [session, loadCoachCfg]);

  const saveCoachScenario = useCallback(async (id, patch) => {
    const { error } = await supabase.from("coach_scenarios").update(patch).eq("id", id);
    if (error) { setToast(`Couldn't save scenario: ${error.message}`); setTimeout(() => setToast(""), 5000); return; }
    loadCoachCfg();
  }, [loadCoachCfg]);

  const addCoachScenario = useCallback(async (label) => {
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || `scenario_${Date.now()}`;
    const { error } = await supabase.from("coach_scenarios").insert({
      key, label,
      blurb: "Describe the situation in a few words",
      persona: "You are ... (describe the customer the agent will be speaking to, in second person)",
      sort_order: 900,
    });
    if (error) { setToast(`Couldn't add: ${error.message}`); setTimeout(() => setToast(""), 5000); return; }
    loadCoachCfg();
  }, [loadCoachCfg]);

  const deleteCoachScenario = useCallback(async (id, label) => {
    const { error } = await supabase.from("coach_scenarios").delete().eq("id", id);
    if (error) { setToast(`Couldn't delete: ${error.message}`); setTimeout(() => setToast(""), 5000); return; }
    setToast(`Scenario "${label}" deleted`); setTimeout(() => setToast(""), 2500);
    loadCoachCfg();
  }, [loadCoachCfg]);

  const saveCoachSettings = useCallback(async (patch) => {
    const { error } = await supabase.from("coach_settings").update(patch).eq("id", 1);
    if (error) { setToast(`Couldn't save: ${error.message}`); setTimeout(() => setToast(""), 5000); return; }
    setToast("Coach setup saved"); setTimeout(() => setToast(""), 2500);
    loadCoachCfg();
  }, [loadCoachCfg]);

  // Pay plans — monthly targets the KPI cards are measured against
  const loadPayPlans = useCallback(async () => {
    const { data } = await supabase.from("pay_plans").select("*").order("name");
    setPayPlans(data || []);
  }, []);
  useEffect(() => { if (session?.user) loadPayPlans(); }, [session, loadPayPlans]);

  const savePayPlan = useCallback(async (id, patch) => {
    const { error } = await supabase.from("pay_plans").update(patch).eq("id", id);
    if (error) { setToast(`Couldn't save plan: ${error.message}`); setTimeout(() => setToast(""), 5000); return; }
    loadPayPlans();
  }, [loadPayPlans]);

  const addPayPlan = useCallback(async (name) => {
    const { error } = await supabase.from("pay_plans").insert({ name });
    if (error) { setToast(`Couldn't add plan: ${error.message}`); setTimeout(() => setToast(""), 5000); return; }
    setToast(`Plan "${name}" added`);
    setTimeout(() => setToast(""), 2500);
    loadPayPlans();
  }, [loadPayPlans]);

  const deletePayPlan = useCallback(async (id, name) => {
    const { error } = await supabase.from("pay_plans").delete().eq("id", id);
    if (error) { setToast(`Couldn't delete: ${error.message}`); setTimeout(() => setToast(""), 5000); return; }
    setToast(`Plan "${name}" deleted`);
    setTimeout(() => setToast(""), 2500);
    loadPayPlans();
  }, [loadPayPlans]);

  // Status settings — colours and what counts toward GP/SOV
  const loadStatusCfg = useCallback(async () => {
    const { data } = await supabase.from("status_config").select("*");
    setStatusRows(data || []);
    return data || [];
  }, []);
  useEffect(() => { if (session?.user) loadStatusCfg(); }, [session, loadStatusCfg]);

  // Any NetSuite status we haven't seen before gets added automatically
  // (office only — RLS won't let anyone else write). Managers then review
  // the ones marked "new" in Status Settings.
  useEffect(() => {
    if (profile?.role !== "office" || !netsuite.length) return;
    const known = new Set(statusRows.map((r) => r.status));
    const missing = [];
    const seen = new Set();
    netsuite.forEach((n) => {
      const s = n.order_status && String(n.order_status).trim();
      if (!s || known.has(s) || seen.has(s)) return;
      seen.add(s);
      missing.push({
        status: s,
        tone: guessTone(s),
        count_gp: n.count_gp !== false,
        count_sov: n.count_sov !== false,
        auto_added: true,
      });
    });
    if (!missing.length) return;
    supabase.from("status_config").insert(missing).then(() => loadStatusCfg());
  }, [netsuite, statusRows, profile, loadStatusCfg]);

  const saveStatusCfg = useCallback(async (status, patch) => {
    const { error } = await supabase.from("status_config").update(patch).eq("status", status);
    if (error) { setToast(`Couldn't save: ${error.message}`); setTimeout(() => setToast(""), 5000); return; }
    loadStatusCfg();
  }, [loadStatusCfg]);

  const statusCfgMap = useMemo(() => {
    const m = {};
    statusRows.forEach((r) => { m[r.status] = r; });
    return m;
  }, [statusRows]);
  const newStatusCount = useMemo(() => statusRows.filter((r) => r.auto_added).length, [statusRows]);

  // Office users also load every profile, needed for the Admin page's role editor
  const loadAllProfiles = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("*");
    setAllProfiles(data || []);
  }, []);
  useEffect(() => { if (profile?.role === "office") loadAllProfiles(); }, [profile, loadAllProfiles]);

  // Load orders + subscribe to realtime changes
  const loadOrders = useCallback(async () => {
    // The TV board shows the whole office whoever is signed in on it.
    if (isTVRoute) {
      const { data } = await supabase.rpc("tv_orders");
      setOrders(data || []);
      setLoading(false);
      return;
    }
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
  }, [isTVRoute]);

  useEffect(() => {
    if (!session?.user) return;
    loadOrders();
    const channel = supabase.channel("schthrive-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        loadOrders();
        if (payload.new?.id) {
          setFlashId(payload.new.id);
          setTimeout(() => setFlashId((f) => (f === payload.new.id ? null : f)), 1600);
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "netsuite_orders" }, () => loadNetsuite())
      .on("postgres_changes", { event: "*", schema: "public", table: "forecasts" }, () => loadForecasts())
      .subscribe();
    // Safety-net refresh every 60s (keeps the wall-mounted TV honest).
    const poll = setInterval(() => { loadOrders(); loadNetsuite(); loadForecasts(); }, 60000);
    return () => { supabase.removeChannel(channel); clearInterval(poll); };
  }, [session, loadOrders, loadNetsuite, loadForecasts]);

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

  // Who can change a deal:
  //   office (manager) — anything
  //   2ic              — anything in their team, whoever closed it
  //   agent            — only deals they closed themselves
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

  // Set someone's password. The database function checks we're office
  // before doing anything, so nothing sensitive lives in the browser.
  const resetPassword = useCallback(async (email, newPassword) => {
    const { data, error } = await supabase.rpc("admin_set_password", {
      target_email: email,
      new_password: newPassword,
    });
    if (error || !data?.ok) {
      setToast(`Couldn't set password: ${error?.message || data?.error || "unknown error"}`);
      setTimeout(() => setToast(""), 5000);
      return false;
    }
    setToast(`Password set for ${email} — they'll choose their own at next sign-in`);
    setTimeout(() => setToast(""), 4000);
    return true;
  }, []);

  // Mark someone a leaver (or bring them back). The database function also
  // locks their login, so it isn't just a UI flag.
  const setStaffActive = useCallback(async (staffId, makeActive, name) => {
    const { data, error } = await supabase.rpc("admin_set_staff_active", {
      staff_id: staffId, make_active: makeActive,
    });
    if (error || !data?.ok) {
      setToast(`Couldn't update: ${error?.message || data?.error || "unknown error"}`);
      setTimeout(() => setToast(""), 5000);
      return;
    }
    setToast(makeActive
      ? `${name} reinstated — set them a password to let them back in`
      : `${name} marked as a leaver and signed out`);
    setTimeout(() => setToast(""), 4000);
    loadStaff();
  }, [loadStaff]);

  const saveProfileRole = useCallback(async (profileId, patch) => {    const { error } = await supabase.from("profiles").update(patch).eq("id", profileId);
    if (error) { setToast(`Couldn't update role: ${error.message}`); setTimeout(() => setToast(""), 5000); return; }
    loadAllProfiles();
  }, [loadAllProfiles]);

  const staffValue = useMemo(() => ({
    all: staff,
    // Leavers stay in `all` for historical lookups but drop off the
    // Closer / Lead Gen pickers so nobody can be assigned new work.
    sellers: staff.filter((s) => s.sells && s.active !== false),
  }), [staff]);

  // Apply the alias map once, here, so every view sees corrected names
  // rather than each having to remember to resolve them.
  const netsuiteResolved = useMemo(() => {
    if (!Object.keys(aliasMap).length) return netsuite;
    return netsuite.map((n) => {
      const c = resolveName(n.closer_name, aliasMap);
      const r = resolveName(n.referrer_name, aliasMap);
      if (c === n.closer_name && r === n.referrer_name) return n;
      return { ...n, closer_name: c, referrer_name: r };
    });
  }, [netsuite, aliasMap]);

  if (!authReady) return <div className="sw-root flex items-center justify-center" style={{ minHeight: "100vh" }}><style>{STYLE}</style><Loader2 className="animate-spin" style={{ color: "var(--primary)" }} /></div>;
  if (!session) return <LoginScreen />;

  // Still on the shared starting password — must set their own before going further.
  if (profile?.must_change_password) {
    return <ChangePasswordScreen forced onDone={() => setProfile((p) => ({ ...p, must_change_password: false }))} />;
  }
  // Chose "Change password" from the menu
  if (changingPassword) {
    return <ChangePasswordScreen forced={false} onDone={() => setChangingPassword(false)} onCancel={() => setChangingPassword(false)} />;
  }

  // TV wall board route — reuses the logged-in session on that device.
  if (isTVRoute) {
    return (
      <StatusCfgContext.Provider value={statusCfgMap}>
        <StaffContext.Provider value={staffValue}>
          <TVBoard orders={orders} netsuite={netsuiteResolved} />
        </StaffContext.Provider>
      </StatusCfgContext.Provider>
    );
  }

  return (
    <StatusCfgContext.Provider value={statusCfgMap}>
    <StaffContext.Provider value={staffValue}>
    <div className="sw-root" style={{ display: "flex", minHeight: "100vh" }}>
      <style>{STYLE}</style>
      <Sidebar tab={tab} setTab={setTab} profile={profile} newStatusCount={newStatusCount}
        onChangePassword={() => setChangingPassword(true)} onSignOut={signOut} />

      <div style={{ flex: 1, minWidth: 0 }}>
      <main className={`p-6 mx-auto ${["breakdown", "daybyday", "forecast", "landscapes", "dashboard", "distribution", "admin", "statuses"].includes(tab) ? "max-w-none" : "max-w-6xl"}`}>
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
        {tab === "dashboard" && <DashboardView orders={orders} netsuite={netsuiteResolved} forecasts={forecasts} staff={staff} payPlans={payPlans} onNewOrder={() => setTab("new")} onOpenOrder={setSelected} flashId={flashId} profile={profile} loading={loading} />}
        {tab === "new" && <NewSubmissionView onSubmit={handleNewOrder} submitting={submitting} />}
        {tab === "daybyday" && <DayByDayView orders={orders} />}
        {tab === "breakdown" && <SalesBreakdownView netsuite={netsuiteResolved} />}
        {tab === "distribution" && <DistributionView orders={orders} netsuite={netsuiteResolved} />}
        {tab === "forecast" && <ForecastView netsuite={netsuiteResolved} profile={profile} staff={staff} />}
        {tab === "landscapes" && <LandscapesView profile={profile} staff={staff} />}
        {tab === "quote" && <QuoteBuilderView profile={profile} staff={staff} />}
        {tab === "coach" && <SalesCoachView />}
        {tab === "admin" && profile?.role === "office" && <AdminView staff={staff} profiles={allProfiles} onSaveStaff={saveStaff} onAddStaff={addStaff} onSaveProfile={saveProfileRole} onResetPassword={resetPassword} onSetActive={setStaffActive} plans={payPlans}
          netsuite={netsuiteResolved} aliases={aliases} onAddAlias={addAlias} onDeleteAlias={deleteAlias} />}
        {tab === "statuses" && profile?.role === "office" && <SettingsView statusRows={statusRows} onSaveStatus={saveStatusCfg} newCount={newStatusCount} plans={payPlans} staff={staff} onSavePlan={savePayPlan} onAddPlan={addPayPlan} onDeletePlan={deletePayPlan}
          coachScenarios={coachScenarios} coachSettings={coachSettings}
          onSaveCoachScenario={saveCoachScenario} onAddCoachScenario={addCoachScenario}
          onDeleteCoachScenario={deleteCoachScenario} onSaveCoachSettings={saveCoachSettings}
          orders={orders} netsuite={netsuiteResolved} forecasts={forecasts} />}
      </main>

      {selected && <OrderDrawer order={selected} ns={selected.document_number ? netsuite.find((n) => String(n.document_number) === String(selected.document_number)) : null} onClose={() => setSelected(null)} canEdit={canEditOrder(selected)} onSave={saveOrder} saving={savingEdit} onRemove={removeOrder} />}
      {toast && (
        <div className="sw-slide-in fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl flex items-center gap-2 text-sm font-medium text-white" style={{ background: toast.startsWith("Couldn't") ? "var(--red)" : "var(--green)" }}>
          {toast.startsWith("Couldn't") ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />} {toast}
        </div>
      )}
      </div>
    </div>
    </StaffContext.Provider>
    </StatusCfgContext.Provider>
  );
}
