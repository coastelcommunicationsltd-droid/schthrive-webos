import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Search, Filter, X, AlertTriangle, CheckCircle2, Clock, Radio, Plus,
  Building2, Wallet, TrendingUp, ShieldAlert, RefreshCw, LogOut, Mail,
  Loader2, Users, Eye, EyeOff, ArrowLeft, LogIn, KeyRound, Palette, MapPin,
  BarChart3, CalendarDays, Target, Headphones, Phone,
  ChevronDown, ClipboardList, LayoutDashboard, Settings as SettingsIcon,
  History, FileText, Inbox, Menu, Lock, Trophy,
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
// Names arrive from three systems with inconsistent spacing, so every
// lookup goes through the same key: trimmed, single-spaced, lowercased.
const nameKey = (n) => String(n || "").trim().replace(/\s+/g, " ").toLowerCase();

const resolveName = (name, aliases) => {
  if (!name) return name;
  const hit = aliases[nameKey(name)];
  return hit || name;
};

// A leaver's name still needs to appear on real historical orders — hiding
// the row would hide real business data — but softened to first name plus
// last initial rather than shown in full.
function obscureName(name, leaverNames) {
  if (!name || !leaverNames || !leaverNames.has(name)) return name;
  const parts = String(name).trim().split(/\s+/);
  if (parts.length < 2) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

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

/* Selects get an explicit height in a lot of places (filter bars, table
   cells). The 9px vertical padding above then leaves less room than the
   text needs and clips the descenders, so selects manage their own
   vertical space and let the browser centre the text. */
.sw-root select.sw-input{
  padding-top:0; padding-bottom:0;
  line-height:normal;
  padding-right:26px;                 /* clear of the chevron */
  appearance:none; -webkit-appearance:none; -moz-appearance:none;
  background-image:url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236B6584' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat:no-repeat;
  background-position:right 8px center;
  background-size:12px;
  text-overflow:ellipsis;
}
/* Any input given a fixed height needs the same treatment */
.sw-root input.sw-input[style*="height"]{ padding-top:0; padding-bottom:0; line-height:normal; }
.sw-label{display:block;font-size:12px;font-weight:600;color:var(--ink-soft);margin-bottom:5px;}
.sw-req{color:var(--red);margin-left:2px;}
.sw-err{color:var(--red);font-size:12px;margin-top:4px;}
.sw-clamp2{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word;}

/* ---- Micro-interactions ----------------------------------------------
   Quick, subtle, and consistent: clickable cards lift a pixel on hover,
   freshly mounted table rows rise in. Both are disabled for anyone who
   prefers reduced motion. */
.sw-lift{transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease,background .15s ease;}
.sw-lift:hover{transform:translateY(-1px);box-shadow:0 3px 10px rgba(33,30,50,.07);}
.sw-lift:active{transform:translateY(0);}
.sw-anim-rows tbody tr{animation:sw-rise .18s ease-out both;}
.sw-anim-rows tbody tr:nth-child(2){animation-delay:30ms;}
.sw-anim-rows tbody tr:nth-child(3){animation-delay:60ms;}
.sw-anim-rows tbody tr:nth-child(4){animation-delay:90ms;}
.sw-anim-rows tbody tr:nth-child(5){animation-delay:120ms;}
.sw-anim-rows tbody tr:nth-child(6){animation-delay:150ms;}
.sw-anim-rows tbody tr:nth-child(7){animation-delay:180ms;}
.sw-anim-rows tbody tr:nth-child(8){animation-delay:210ms;}
.sw-anim-rows tbody tr:nth-child(9){animation-delay:240ms;}
.sw-anim-rows tbody tr:nth-child(10){animation-delay:270ms;}
.sw-anim-rows tbody tr:nth-child(11){animation-delay:300ms;}
.sw-anim-rows tbody tr:nth-child(12){animation-delay:330ms;}
.sw-bar-anim{transition:width .25s ease;}
/* Headline cards rise in with a short cascade when the view mounts */
.sw-stagger > *{animation:sw-rise .25s ease-out both;}
.sw-stagger > *:nth-child(2){animation-delay:40ms;}
.sw-stagger > *:nth-child(3){animation-delay:80ms;}
.sw-stagger > *:nth-child(4){animation-delay:120ms;}
/* A select that's mid-save breathes instead of just going dead */
@keyframes sw-saving-pulse{0%,100%{opacity:.55;}50%{opacity:.85;}}
.sw-saving{animation:sw-saving-pulse .9s ease-in-out infinite;}
/* Hover wash — inline row tints (lilac) win over this, by design */
.sw-hover-rows tbody tr{transition:background .15s ease;}
.sw-hover-rows tbody tr:hover{background:var(--surface-alt);}
@media (prefers-reduced-motion: reduce){
  .sw-lift,.sw-lift:hover{transition:none;transform:none;box-shadow:none;}
  .sw-anim-rows tbody tr{animation:none;}
  .sw-bar-anim{transition:none;}
  .sw-stagger > *{animation:none;}
  .sw-saving{animation:none;opacity:.6;}
  .sw-hover-rows tbody tr{transition:none;}
}

/* ---- Mobile ----------------------------------------------------------
   Below 900px the two- and four-column layouts stack, the sidebar becomes
   a slide-over, and the order list drops its less critical columns rather
   than shrinking everything to unreadable. Marker classes are applied in
   the components so this stays in one place. */
@media (max-width: 900px) {
  .sw-cols { grid-template-columns: 1fr !important; }
  .sw-cols-2 { grid-template-columns: 1fr 1fr !important; }
  .sw-hide-sm { display: none !important; }
  .sw-sticky-col { position: static !important; max-height: none !important; }
  .sw-main { padding: 12px !important; }
  .sw-filter-row { gap: 6px !important; padding: 8px !important; }
  .sw-filter-row > * { flex: 1 1 auto; min-width: 0; }
  .sw-hero-num { font-size: 30px !important; }
  table.sw-orders { table-layout: auto !important; }
  table.sw-orders col { width: auto !important; }
}
@media (max-width: 560px) {
  .sw-cols-2 { grid-template-columns: 1fr !important; }
  .sw-hide-xs { display: none !important; }
  .sw-hero-num { font-size: 26px !important; }
}

/* The top bar collapses to a hamburger below 900px */
@media (max-width: 900px) {
  .sw-menu-btn { display: inline-flex !important; }
}
.sw-menu-btn { display: none; }
.sw-menu-panel { max-height: 70vh; overflow-y: auto; }
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

/* ---- Totals strip above an orders list -------------------------------
   Two thin cards — Total GP and Total SOV — spanning the full width of
   the list column, so the figures always describe exactly the rows
   showing underneath. Deliberately inline grid/flex styles: this is a
   critical layout and must not depend on Tailwind JIT picking classes up
   after a file replacement. */
function ListTotalsStrip({ gp, sov, count, label }) {
  const Card = ({ title, value, colour }) => (
    <div
      className="rounded-lg"
      style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        padding: "6px 12px", minWidth: 0,
        display: "flex", alignItems: "baseline", gap: 8,
      }}>
      <span className="text-xs font-semibold uppercase"
        style={{ color: "var(--ink-faint)", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
        {title}
      </span>
      <span className="sw-mono"
        style={{ marginLeft: "auto", color: colour, fontWeight: 700, fontSize: 15, whiteSpace: "nowrap" }}>
        {fmtGBP(value)}
      </span>
    </div>
  );
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: count != null ? 4 : "0.5rem" }}>
        <Card title="Total GP" value={gp} colour="var(--green)" />
        <Card title="Total SOV" value={sov} colour="var(--primary)" />
      </div>
      {count != null && (
        <div className="text-xs" style={{ color: "var(--ink-faint)", marginBottom: "0.5rem" }}>
          {count.toLocaleString("en-GB")} {count === 1 ? "order" : "orders"}{label ? ` · ${label}` : ""}
        </div>
      )}
    </div>
  );
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

/* Financial years available to pick. FY 24-25 is the earliest because that
   is where the NetSuite history starts; the list runs forward to whatever
   FY we are currently in. A "financial year 2024" means Apr 2024 -> Mar 2025. */
const FY_FIRST_YEAR = 2024;
/* FY_MONTHS ("Apr"..."Mar") is declared once with the report helpers below
   and reused here — only referenced at render time, so the ordering is fine. */
function fyYearOf(d = new Date()) {
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
}
function fyLabel(y) {
  return `FY ${String(y).slice(2)}-${String(y + 1).slice(2)}`;
}
function fyList() {
  const last = fyYearOf();
  const out = [];
  for (let y = last; y >= FY_FIRST_YEAR; y--) out.push(y);
  return out;
}
/* Calendar month/year for the Nth month of a financial year (0 = April). */
function fyMonthDate(y, mi) {
  const cal = (3 + mi) % 12;
  return new Date(mi <= 8 ? y : y + 1, cal, 1, 0, 0, 0, 0);
}

/* FY week numbering. Week 1 is the week containing 1 April, and weeks run
   Monday to Sunday like the rest of the app. A date in late March can
   therefore belong to week 52/53 of the previous FY. */
function fyWeekStart(y) {
  return weekStart(new Date(y, 3, 1, 12, 0, 0, 0));
}
function fyWeekOf(d) {
  const day = new Date(d);
  if (Number.isNaN(day.getTime())) return null;
  let y = fyYearOf(day);
  let w1 = fyWeekStart(y);
  const ws = weekStart(day);
  // 1 April can fall mid-week, so a date early in April may still sit in
  // the last week of the outgoing FY.
  if (ws.getTime() < w1.getTime()) { y -= 1; w1 = fyWeekStart(y); }
  const week = Math.floor((ws.getTime() - w1.getTime()) / 604800000) + 1;
  return { fy: y, week, start: ws };
}

/* A period key is one of the shorthand keys above, or:
     fy:2024        whole financial year 2024-25
     fy:2024:m:3    July 2024 (month index 3 within that FY)
   parsePeriod turns any of them into { from, to } — `to` is exclusive and
   null means "up to now / no upper bound". */
/* The last 18 calendar months, newest first — so a specific month is one
   click rather than picking a financial year and then a month within it. */
function recentMonths(count = 18) {
  const out = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: `m:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
    });
  }
  return out;
}

function parsePeriod(key) {
  const s = String(key || "all");
  // A specific calendar month
  const cm = /^m:(\d{4})-(\d{2})$/.exec(s);
  if (cm) {
    const y = parseInt(cm[1], 10);
    const mo = parseInt(cm[2], 10) - 1;
    return {
      from: new Date(y, mo, 1, 0, 0, 0, 0),
      to: new Date(y, mo + 1, 1, 0, 0, 0, 0),
    };
  }
  const m = /^fy:(\d{4})(?::m:(\d{1,2}))?$/.exec(s);
  if (m) {
    const y = parseInt(m[1], 10);
    if (m[2] != null) {
      const mi = Math.max(0, Math.min(11, parseInt(m[2], 10)));
      const from = fyMonthDate(y, mi);
      const to = new Date(from.getFullYear(), from.getMonth() + 1, 1, 0, 0, 0, 0);
      return { from, to };
    }
    return { from: new Date(y, 3, 1, 0, 0, 0, 0), to: new Date(y + 1, 3, 1, 0, 0, 0, 0) };
  }
  return { from: periodStart(s), to: null };
}
function periodLabelFor(key) {
  const s = String(key || "all");
  const cm = /^m:(\d{4})-(\d{2})$/.exec(s);
  if (cm) {
    return new Date(parseInt(cm[1], 10), parseInt(cm[2], 10) - 1, 1)
      .toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  }
  const m = /^fy:(\d{4})(?::m:(\d{1,2}))?$/.exec(s);
  if (m) {
    const y = parseInt(m[1], 10);
    if (m[2] != null) return `${FY_MONTHS[parseInt(m[2], 10)] || ""} ${fyLabel(y)}`;
    return fyLabel(y);
  }
  const p = PERIODS.find((x) => x.key === s);
  return p ? p.label : "";
}
/* One predicate that every view uses, so a date is tested the same way
   everywhere. Handles the closed-ended FY and FY-month ranges as well as
   the open-ended MTD/YTD style keys. */
function periodTest(key) {
  const { from, to } = parsePeriod(key);
  if (!from && !to) return () => true;
  const f = from ? from.getTime() : null;
  const t = to ? to.getTime() : null;
  return (d) => {
    if (!d) return false;
    const v = new Date(d).getTime();
    if (Number.isNaN(v)) return false;
    if (f != null && v < f) return false;
    if (t != null && v >= t) return false;
    return true;
  };
}

/* Period picker used across the app: the shorthand keys, then every
   financial year, then — once an FY is chosen — every month within it.
   The month select only appears for an FY, so the control stays small on
   the views that only ever want MTD/YTD. */
function PeriodSelect({ value, onChange, width = 148, monthWidth = 104, style = {} }) {
  const months = useMemo(() => recentMonths(18), []);
  const m = /^fy:(\d{4})(?::m:(\d{1,2}))?$/.exec(String(value || ""));
  const fy = m ? m[1] : null;
  const mi = m && m[2] != null ? m[2] : "";
  const base = { height: 32, fontSize: 12.5, ...style };
  return (
    <>
      <select className="sw-input sw-focus" style={{ width, ...base }}
        value={fy ? `fy:${fy}` : String(value || "all")}
        onChange={(e) => onChange(e.target.value)}
        title={periodLabelFor(value)}>
        {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        <optgroup label="Month">
          {months.map((mm) => <option key={mm.key} value={mm.key}>{mm.label}</option>)}
        </optgroup>
        <optgroup label="Financial year">
          {fyList().map((y) => <option key={y} value={`fy:${y}`}>{fyLabel(y)}</option>)}
        </optgroup>
      </select>
      {fy && (
        <select className="sw-input sw-focus" style={{ width: monthWidth, ...base }}
          value={mi === "" ? "" : String(mi)}
          onChange={(e) => onChange(e.target.value === "" ? `fy:${fy}` : `fy:${fy}:m:${e.target.value}`)}
          title="Month within the financial year">
          <option value="">Whole year</option>
          {FY_MONTHS.map((lbl, i) => (
            <option key={i} value={i}>{lbl} {String(i <= 8 ? fy : Number(fy) + 1).slice(2)}</option>
          ))}
        </select>
      )}
    </>
  );
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
  const { from, to } = parsePeriod(period);
  if (!from && !to) return orders;
  const test = periodTest(period);
  return orders.filter((o) => test(o.submission_date));
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

/* Blend from the base purple toward green as commission tiers are passed,
   so progress reads at a glance without needing the numbers. */
function tierBlend(step, total) {
  if (total <= 0) return "#4C1D8F";
  const t = Math.min(1, Math.max(0, step / total));
  const from = [76, 29, 143];    // --primary
  const to   = [27, 112, 56];    // --green
  const mix = from.map((c, i) => Math.round(c + (to[i] - c) * t));
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
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
/*  COMMISSION TIERS                                                       */
/* ---------------------------------------------------------------------- */

const METRIC_UNITS = ["money", "percent", "count"];

// Common KPIs, offered as suggestions when adding one. Not a fixed list —
// anything can be typed in, and the key is what the figure is looked up by.
const METRIC_PRESETS = [
  { key: "acq_pct", label: "ACQ %", unit: "percent" },
  { key: "cloud_sov", label: "New Cloud SOV", unit: "money" },
  { key: "connectivity_sov", label: "New Connectivity SOV", unit: "money" },
  { key: "mobile_sov", label: "Mobile SOV", unit: "money" },
  { key: "leads", label: "Leads Total", unit: "count" },
];

function fmtMetric(value, unit) {
  if (value == null || value === "") return "—";
  if (unit === "money") return fmtGBP(value);
  if (unit === "percent") return `${num(value)}%`;
  return num(value).toLocaleString("en-GB");
}

/* Which tier does a set of actuals land in?
   A tier is met when GP falls inside the band and every threshold on it is
   satisfied. Returns the best-paying met tier, plus the next one up so an
   agent can see what they're reaching for. Returns nulls rather than
   throwing when there's no plan or no tiers — that's a normal state. */
function evaluateTiers(tiers, actuals) {
  if (!tiers || !tiers.length) return { met: null, next: null, shortfalls: [] };
  const gp = num(actuals.gp);

  const inBand = (t) => gp >= num(t.gp_min) && (t.gp_max == null || gp <= num(t.gp_max));
  const unmet = (t) => Object.keys(t.thresholds || {})
    .filter((k) => num(actuals[k]) < num(t.thresholds[k]))
    .map((k) => ({ key: k, needed: num(t.thresholds[k]), have: num(actuals[k]) }));

  const sorted = [...tiers].sort((a, b) => num(a.gp_min) - num(b.gp_min));
  let met = null;
  let shortfalls = [];

  for (const t of sorted) {
    if (!inBand(t)) continue;
    const gaps = unmet(t);
    if (gaps.length === 0) {
      if (!met || num(t.payment_pct) > num(met.payment_pct)) met = t;
    } else {
      shortfalls = gaps;   // in the band but missing KPIs — worth surfacing
    }
  }

  // The next band up, whether or not the current one is met
  const next = sorted.find((t) => num(t.gp_min) > gp) || null;
  return { met, next, shortfalls };
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

function DashboardView({ orders, netsuite, forecasts, staff, profiles, payPlans, planTiers, planMetrics, onOpenOrder, flashId, profile, loading, onNewOrder }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [agentFilter, setAgentFilter] = useState("All");
  const [ngpMode, setNgpMode] = useState("hide");  // hide | show | only
  const [nsovMode, setNsovMode] = useState("show");  // show | only (NSOV still counts toward GP, so it isn't hidden by default)
  const [dataView, setDataView] = useState("claimed");   // forecast | claimed | statted
  const [productFilter, setProductFilter] = useState("All");
  const [focusFilter, setFocusFilter] = useState("All");   // All | aged | attention
  const [sideCard, setSideCard] = useState("plan");        // which summary card is showing
  const [topView, setTopView] = useState(true);            // headline figures only
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

    // The Suffex column is the authority — it's what the report itself
    // marks. A row can carry NGP, NSOV or both; NGP contains "GP" as a
    // substring so the two are matched explicitly rather than by include().
    const suffex = String(n.status_flags || "").toUpperCase();
    const suffexNgp = /\bNGP\b/.test(suffex);
    const suffexNsov = /\bNSOV\b/.test(suffex);

    if (suffex) return { ns: n, ngp: suffexNgp, nsov: suffexNsov };

    // No Suffex on this row, so fall back to the status config and the
    // flags the sheet sync worked out.
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
    const inPeriodDate = periodTest(period);
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
      // Non SOV means exactly that: excluded from SOV but still counting
      // toward GP. Anything also carrying NGP belongs in the Non GP filter,
      // not here.
      if (nsovMode === "only" && (!r.nsov || r.ngp)) return false;
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
        || (focusFilter === "aged" ? (r.ageDays != null && r.ageDays >= 90)
          : focusFilter === "aged60" ? (r.ageDays != null && r.ageDays >= 60)
          : !!r.needsAction);
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
  }, [viewRows, query, statusFilter, agentFilter, productFilter, focusFilter, sortKey, sortDir, ngpMode, nsovMode, campaignOnly, acqOnly]);

  // Totals for the strip sitting directly above the list. These follow the
  // VISIBLE rows — every filter, the search box and the dataset toggle — so
  // the two figures always add up to what's on screen. NGP is out of GP and
  // NSOV is out of SOV, matching the rules the KPI cards use.
  const listTotals = useMemo(() => {
    let gp = 0, sov = 0;
    filtered.forEach((r) => {
      if (!r.nsov) sov += num(r.sov);
      if (r.ngp) return;
      // One agent selected -> credit them their own share only, never the
      // whole deal (that would include their colleague's cut). Forecast rows
      // carry no split, so they fall back to the deal figure.
      if (agentFilter !== "All" && (r.closer_share != null || r.lead_gen_share != null)) {
        if (r.closer_name === agentFilter) gp += num(r.closer_share);
        if (r.lead_gen_name === agentFilter) gp += num(r.lead_gen_share);
      } else {
        gp += num(r.gp);
      }
    });
    return { gp, sov };
  }, [filtered, agentFilter]);

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
  // 60+ is inclusive of the 90+ set — it's "at least this old", not a band,
  // so the two counts deliberately overlap.
  const aged60Count = useMemo(() => viewRows.filter((r) => r.ageDays != null && r.ageDays >= 60).length, [viewRows]);
  const attentionCount = useMemo(() => viewRows.filter((r) => r.needsAction).length, [viewRows]);
  // Counts only pure-NSOV rows, matching the filter above
  const nsovCount = useMemo(() => productScoped.filter((o) => isNSOV(o) && !isNGP(o)).length, [productScoped, isNSOV, isNGP]);
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
    const inP = periodTest(period);
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
      return inP(r.order_date ? r.order_date + "T00:00:00" : null);
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

  // ---- Which commission tier the current scope is hitting -------------
  // Returns nulls when there's no plan or no tiers — a normal state, not
  // an error, so nothing downstream needs a guard beyond checking `met`.
  const tierStanding = useMemo(() => {
    if (agentFilter === "All") return null;
    const person = (staff || []).find((s) => s.full_name === agentFilter);
    if (!person || !person.pay_plan_id) return null;
    const tiers = (planTiers || []).filter((t) => t.plan_id === person.pay_plan_id);
    if (!tiers.length) return null;
    const plan = (payPlans || []).find((p) => p.id === person.pay_plan_id);
    const mets = (planMetrics || []).filter((m) => m.plan_id === person.pay_plan_id);

    const actuals = {
      gp: gpTotal,
      acq_pct: splits.acqPct,
      cloud_sov: nsSovCards.cloud,
      connectivity_sov: nsSovCards.connectivity,
      mobile_sov: nsSovCards.mobile,
      leads: 0,   // wired up when lead counts land
    };
    return { ...evaluateTiers(tiers, actuals), plan, metrics: mets, actuals };
  }, [agentFilter, staff, planTiers, planMetrics, payPlans, gpTotal, splits, nsSovCards]);

  // ---- Ranked agents: claimed against each person's own target --------
  // Replaces the agent dropdown — the ranking is the selector.
  // Whose name gets softened wherever an order shows it
  const leaverNames = useMemo(
    () => new Set((staff || []).filter((s) => s.active === false).map((s) => s.full_name)),
    [staff]
  );

  const agentRanking = useMemo(() => {
    const planById = {};
    (payPlans || []).forEach((p) => { planById[p.id] = p; });

    // Everyone who's left, by name — checked before adding any row, so a
    // leaver's historical figures can never resurface as a named entry.
    const leaverNames = new Set((staff || []).filter((s) => s.active === false).map((s) => s.full_name));

    // Managers and office users don't belong in a ranking of agents —
    // their figures are the team's, so they'd double up against the people
    // who actually closed the work.
    const excludedRoles = new Set();
    (profiles || []).forEach((p) => {
      if (p.role === "office" || p.role === "sd" || p.role === "sd_2ic") excludedRoles.add(p.id);
    });
    // Teams are named after their manager, so anyone whose name IS a team
    // name is a manager. This works for every role, whereas the profile
    // check above only has data when an office user is signed in.
    const teamNames = new Set((staff || []).map((s) => nameKey(s.team)).filter(Boolean));
    const isManager = (s) => {
      if (s.user_id && excludedRoles.has(s.user_id)) return true;
      if (s.full_name && teamNames.has(nameKey(s.full_name))) return true;
      return false;
    };

    // Who's in scope: the team being viewed, or the whole office
    const teamScope = isOffice && scope !== "office" ? scope : (is2ic ? profile?.team : null);
    const people = (staff || []).filter((s) => {
      if (s.sells === false || s.active === false) return false;
      if (isManager(s)) return false;
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
    // Every staff spelling — full name and alt name — maps to the canonical
    // name, so GP written under either lands on the same person.
    const canonBy = {};
    (staff || []).forEach((s) => {
      if (!s.full_name) return;
      canonBy[nameKey(s.full_name)] = s.full_name;
      if (s.alt_name) canonBy[nameKey(s.alt_name)] = s.full_name;
    });
    const canon = (nm) => canonBy[nameKey(nm)] || nm;

    const add = (nm, v, b) => {
      if (!nm || !v) return;
      const k = canon(nm);
      claimed[k] = (claimed[k] || 0) + v;
      if (!mix[k]) mix[k] = {};
      mix[k][b] = (mix[k][b] || 0) + v;
    };
    gpCountable.forEach((o) => {
      const b = bucketOf(o);
      add(o.closer_name, num(o.closer_share), b);
      add(o.lead_gen_name, num(o.lead_gen_share), b);
    });

    // Statted GP per person — the figure the bar is actually measured
    // against, since that's what the pay plan judges.
    const inP = periodTest(period);
    const statted = {};
    (netsuite || []).forEach((n) => {
      if (!inP(n.order_date ? n.order_date + "T00:00:00" : null)) return;
      const cfg = n.order_status ? statusCfg[n.order_status] : null;
      const countsGp = cfg ? cfg.count_gp !== false : n.count_gp !== false;
      if (!countsGp) return;
      if (n.closer_name) {
        const k = canon(n.closer_name);
        statted[k] = (statted[k] || 0) + num(n.closer_gp);
      }
      if (n.referrer_name) {
        const k = canon(n.referrer_name);
        statted[k] = (statted[k] || 0) + num(n.referrer_gp);
      }
    });

    // Commission tiers for the bar: each threshold marked along it, and
    // the rate they're currently earning shown at the end.
    const tiersFor = (planId) => (planTiers || [])
      .filter((t) => t.plan_id === planId)
      .sort((a, b) => num(a.gp_min) - num(b.gp_min))
      .map((t) => ({
        label: t.label || "",
        gp: fullPeriodTarget(num(t.gp_min), period),
        pct: num(t.payment_pct),
      }))
      .filter((t) => t.gp > 0);

    const rows = people.map((s) => {
      const plan = s.pay_plan_id ? planById[s.pay_plan_id] : null;
      const hasPlan = !!(plan && plan.active !== false);
      const monthly = hasPlan ? num(plan.target_gp) : 0;
      const tiers = hasPlan ? tiersFor(plan.id) : [];
      const gpStatted = statted[s.full_name] || 0;
      const gpClaimed = claimed[s.full_name] || 0;
      // The best tier reached, on the same figure the bar draws — otherwise
      // the percentage and the bar can disagree with each other.
      const earned = Math.max(gpClaimed, gpStatted);
      const reached = [...tiers].reverse().find((t) => earned >= t.gp) || null;
      return {
        name: s.full_name,
        team: s.team,
        gp: gpClaimed,
        statted: gpStatted,
        mix: mix[s.full_name] || {},
        target: fullPeriodTarget(monthly, period),
        pace: proRatedTarget(monthly, period),
        hasPlan,
        tiers,
        reached,
      };
    });

    // Anyone with figures who isn't on the staff list still deserves a row
    // — but never a leaver. Their GP still flows into the team/office
    // totals elsewhere; they just don't get a named row here.
    const managerNames = new Set((staff || []).filter(isManager).map((s) => nameKey(s.full_name)));
    Object.keys(claimed).forEach((nm) => {
      if (leaverNames.has(nm)) return;
      if (managerNames.has(nameKey(nm))) return;
      if (!rows.some((r) => r.name === nm)) {
        if (teamScope) return;
        rows.push({
          name: nm, team: null, gp: claimed[nm], statted: statted[nm] || 0,
          mix: mix[nm] || {}, target: 0, pace: 0, hasPlan: false,
          tiers: [], reached: null,
        });
      }
    });

    // Everyone shows, including those on nothing — that's the point of a
    // ranking. Zero-GP people sort to the bottom, alphabetically.
    return rows.sort((a, b) => (b.gp - a.gp) || a.name.localeCompare(b.name));
  }, [staff, payPlans, planTiers, profiles, gpCountable, netsuite, statusCfg, isOffice, is2ic, scope, profile, period]);

  // ---- Pay plan measured against what NetSuite actually statted -------
  // The KPI cards use claimed GP; this asks the harder question — has the
  // work landed against what the plan expects by now?
  const planVsStatted = useMemo(() => {
    const inP = periodTest(period);
    const teamScope = isOffice && scope !== "office" ? scope : (is2ic ? profile?.team : null);
    let gp = 0, cloud = 0, conn = 0, mobile = 0;

    (netsuite || []).forEach((n) => {
      if (!inP(n.order_date ? n.order_date + "T00:00:00" : null)) return;
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
    const { from, to } = parsePeriod(period);
    if (!from) return "all time";
    const d = (x) => x.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    if (to) return `${d(from)} to ${d(new Date(to.getTime() - 86400000))}`;
    return `since ${from.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: period === "ytd" ? "numeric" : undefined })}`;
  }, [period]);

  const SIDE_CARDS = [
    { key: "plan", label: "Pay plan" },
    ...(tierStanding ? [{ key: "tier", label: "Commission" }] : []),
    { key: "rates", label: "Quality" },
    { key: "deal", label: "Avg deal" },
    { key: "accuracy", label: "Accuracy" },
  ];

  return (
    <div>
      {/* Top view strips it back to the two numbers that matter most */}
      <div className="flex items-center justify-end mb-2">
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
        <div className="sw-cols-2 mb-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
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
                  {c.acq && (
                    <div className="text-right shrink-0">
                      <div className="sw-mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-soft)" }}>{c.acq.value}</div>
                      <div style={{ fontSize: 10, color: "var(--ink-faint)" }}>{c.acqLabel} · {c.acq.pct.toFixed(0)}%</div>
                    </div>
                  )}
                </div>
                <div className="sw-display sw-hero-num" style={{ fontSize: 46, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.05, marginTop: 10 }}>
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
      <div className="sw-cols-2 mb-3" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) minmax(0,1.1fr) minmax(260px,1.15fr)", gap: "0.75rem" }}>

        <div>
          <HeroCard label={gpLabel} value={fmtGBP(gpTotal)} accent="#1F7A3D"
            target={targets.gp} fullTarget={targets.full.gp} rawValue={gpTotal}
            acq={{ value: fmtGBP(splits.acqGp), pct: splits.acqPct }} acqLabel="ACQ GP"
            note={gpWorking.dc > 0 ? `${fmtGBP(gpWorking.claimed)} claimed − ${fmtGBP(gpWorking.dc)} DC` : "Single-counted"} />
          <CampaignBar label="Campaign GP" value={splits.campaignGp} pct={splits.campaignPct} />
        </div>

        <div>
          <HeroCard label="SOV" value={fmtGBP(sovTotal)} accent="#4C1D8F"
            acq={{ value: fmtGBP(splits.acqSov), pct: sovTotal ? (splits.acqSov / sovTotal) * 100 : 0 }} acqLabel="ACQ SOV"
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
                  ["GP", gpTotal, targets.full.gp, targets.gp],
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

          {sideCard === "tier" && tierStanding && (
            <div>
              <div className="flex items-baseline justify-between">
                <span className="sw-display" style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.025em", color: tierStanding.met ? "var(--green)" : "var(--ink)" }}>
                  {tierStanding.met ? `${num(tierStanding.met.payment_pct)}%` : "—"}
                </span>
                <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
                  {tierStanding.met ? tierStanding.met.label || "Tier met" : "No tier met"}
                </span>
              </div>
              {tierStanding.met && (
                <div className="text-xs mt-0.5" style={{ color: "var(--green)" }}>
                  {fmtGBP(num(tierStanding.actuals.gp) * num(tierStanding.met.payment_pct) / 100)} on {fmtGBP(tierStanding.actuals.gp)} GP
                </div>
              )}

              {tierStanding.shortfalls.length > 0 && (
                <div className="mt-2 flex flex-col gap-1">
                  {tierStanding.shortfalls.map((sf) => {
                    const m = tierStanding.metrics.find((x) => x.key === sf.key);
                    return (
                      <div key={sf.key} className="flex items-baseline justify-between gap-2">
                        <span className="text-xs" style={{ color: "var(--amber)" }}>{m ? m.label : sf.key}</span>
                        <span className="sw-mono text-xs" style={{ color: "var(--ink-faint)" }}>
                          {fmtMetric(sf.have, m?.unit)} / {fmtMetric(sf.needed, m?.unit)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {tierStanding.next && (
                <div className="text-xs mt-2" style={{ color: "var(--ink-faint)" }}>
                  Next band {tierStanding.next.label ? `(${tierStanding.next.label})` : ""} at {fmtGBP(tierStanding.next.gp_min)} GP
                  — {num(tierStanding.next.payment_pct)}%
                </div>
              )}
              <div className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>{tierStanding.plan?.name}</div>
            </div>
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
      <div className="sw-cols" style={{ display: "grid", gridTemplateColumns: "minmax(320px, 1fr) minmax(0, 2fr)", gap: "0.75rem", alignItems: "start" }}>

        {/* LEFT */}
        <div className="sw-sticky-col flex flex-col gap-3 pr-0.5" style={{ position: "sticky", top: 66, maxHeight: "calc(100vh - 78px)", overflowY: "auto" }}>

          {/* The ranking is the agent picker */}
          <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-baseline justify-between mb-3">
              <span className="text-sm font-medium uppercase" style={{ color: "var(--ink-faint)", letterSpacing: "0.04em" }}>
                {isOffice && scope !== "office" ? scope : is2ic && profile?.team ? profile.team : "Office"}
              </span>
              {agentFilter !== "All" && (
                <button onClick={() => setAgentFilter("All")} className="sw-focus text-xs" style={{ color: "var(--primary)" }}>Clear</button>
              )}
            </div>
            {agentRanking.length === 0 ? (
              <div className="text-xs text-center py-6" style={{ color: "var(--ink-faint)" }}>No figures for this period.</div>
            ) : (
              <div style={{ maxHeight: "calc(100vh - 210px)", overflowY: "auto" }}>
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
                      className="sw-focus w-full text-left px-2.5 py-2"
                      style={{
                        background: sel ? "var(--primary-soft)" : "transparent",
                        borderTop: i === 0 ? "none" : "1px solid var(--border)",
                      }}
                      title={a.target > 0
                        ? `${fmtGBP(a.gp)} of ${fmtGBP(a.target)} — pace ${fmtGBP(a.pace)}`
                        : fmtGBP(a.gp)}>
                      <div className="flex items-center gap-1.5">
                        <span title={tone ? `${Math.round((a.gp / (a.pace || 1)) * 100)}% of pace` : "No pay plan"}
                          style={{ width: 7, height: 7, borderRadius: 99, background: dot, flexShrink: 0 }} />
                        {scope === "office" && !is2ic && <TeamTag team={a.team} allTeams={teamOptions} />}
                        <span className="truncate" style={{ fontSize: 13.5, color: sel ? "var(--primary)" : "var(--ink)", fontWeight: sel ? 600 : 500 }}>
                          {a.name}
                        </span>
                        <span className="sw-mono ml-auto shrink-0" style={{ fontSize: 13.5, fontWeight: 600, color: a.gp ? "var(--ink)" : "var(--ink-faint)" }}>
                          {fmtGBP(a.gp)}
                        </span>
                      </div>
                      {/* GP against the pay plan's tiers. The bar is split at
                          each threshold and each passed segment shades further
                          from purple toward green, so progress is legible
                          without reading the numbers. Clear the top tier and
                          the whole bar goes green. */}
                      {a.hasPlan ? (() => {
                        const earned = Math.max(num(a.gp), num(a.statted));
                        const top = a.tiers.length ? a.tiers[a.tiers.length - 1].gp : a.target;
                        const allHit = top > 0 && earned >= top;
                        const scaleMax = allHit ? earned : Math.max(top, earned, 1);
                        const n = a.tiers.length;

                        // Segment boundaries: 0, each threshold, then the end
                        const bounds = [0, ...a.tiers.map((t) => t.gp)];
                        const segments = [];
                        bounds.forEach((from, i) => {
                          const to = i + 1 < bounds.length ? bounds[i + 1] : scaleMax;
                          const filledTo = Math.min(earned, to);
                          if (filledTo <= from) return;
                          segments.push({
                            left: (from / scaleMax) * 100,
                            width: ((filledTo - from) / scaleMax) * 100,
                            colour: allHit ? "var(--green)" : tierBlend(i, Math.max(1, n)),
                          });
                        });

                        return (
                          <div className="flex items-center gap-2 mt-1.5">
                            <div style={{ flex: 1, height: 7, background: "var(--surface-alt)", borderRadius: 4, position: "relative", overflow: "hidden" }}
                              title={`${fmtGBP(earned)} of ${fmtGBP(top || a.target)}${a.statted !== a.gp ? ` · ${fmtGBP(a.gp)} claimed, ${fmtGBP(a.statted)} statted` : ""}`}>
                              {segments.map((s, si) => (
                                <div key={si} style={{
                                  position: "absolute", left: `${s.left}%`, width: `${s.width}%`,
                                  top: 0, bottom: 0, background: s.colour,
                                }} />
                              ))}
                              {/* Threshold notches, hidden once they're all behind */}
                              {!allHit && a.tiers.map((t, ti) => {
                                const left = Math.min(100, (t.gp / scaleMax) * 100);
                                const hit = earned >= t.gp;
                                return (
                                  <div key={ti}
                                    title={`${t.label || "Tier"} — ${fmtGBP(t.gp)} pays ${t.pct}%`}
                                    style={{
                                      position: "absolute", left: `calc(${left}% - 1px)`, top: 0, bottom: 0,
                                      width: 2,
                                      background: hit ? "rgba(255,255,255,0.9)" : "var(--ink-faint)",
                                      opacity: hit ? 1 : 0.55,
                                    }} />
                                );
                              })}
                            </div>
                            <span className="sw-mono shrink-0" style={{
                              fontSize: 11, fontWeight: 700, width: 32, textAlign: "right",
                              color: allHit ? "var(--green)" : a.reached ? tierBlend(a.tiers.findIndex((t) => t === a.reached) + 1, Math.max(1, n)) : "var(--ink-faint)",
                            }}
                              title={a.reached
                                ? `${a.reached.label || "Tier"} — earning ${a.reached.pct}% of statted GP`
                                : a.tiers.length ? `Next tier at ${fmtGBP(a.tiers[0].gp)}` : "No tiers set on this plan"}>
                              {a.reached ? `${a.reached.pct}%` : "—"}
                            </span>
                          </div>
                        );
                      })() : (
                        <div className="mt-1.5" style={{ height: 3, background: "var(--red)", opacity: 0.6, borderRadius: 2 }}
                          title="No pay plan set" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* RIGHT — filters and the order list */}
        <div>
      {/* Filters — grouped into a single clean toolbar: scope on top,
          refinement below, one consistent control height throughout. */}
      <div className="rounded-xl mb-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>

        {/* Row 1 — what we're looking at */}
        <div className="sw-filter-row flex items-center gap-2 px-3 py-2.5 flex-wrap">
          <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)", height: 32 }}>
            {[["forecast", "Forecast"], ["claimed", "Claimed"], ["statted", "Statted"]].map(([k, lbl]) => (
              <button key={k} onClick={() => { setDataView(k); setStatusFilter("All"); setProductFilter("All"); setFocusFilter("All"); }}
                className="sw-focus px-3 text-xs"
                style={dataView === k
                  ? { background: "var(--primary)", color: "#fff", fontWeight: 600, height: "100%" }
                  : { background: "transparent", color: "var(--ink-faint)", height: "100%" }}>
                {lbl}
              </button>
            ))}
          </div>

          <PeriodSelect value={period} onChange={setPeriod} width={148} />
          {/* Spells out the resolved range — matters once a specific FY or
              FY month is picked, where "MTD" style wording says nothing. */}
          {String(period).startsWith("fy:") && (
            <span className="text-xs sw-hide-sm whitespace-nowrap" style={{ color: "var(--ink-faint)" }} title={periodLabel}>
              {periodLabel}
            </span>
          )}

          {isOffice && (
            <select className="sw-input sw-focus" style={{ width: 178, height: 32, fontSize: 12.5 }} value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="office">Whole Office</option>
              {teamOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          {is2ic && (
            <span className="flex items-center px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap" style={{ height: 32, background: "var(--primary-soft)", color: "var(--primary)" }}>
              {profile?.team || "My team"}
            </span>
          )}

          <div className="relative" style={{ flex: 1, minWidth: 180 }}>
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-faint)" }} />
            <input className="sw-input sw-focus" style={{ paddingLeft: 28, height: 32, fontSize: 12.5 }} placeholder="Search company..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>

        {/* Row 2 — narrow it down */}
        <div className="sw-filter-row flex items-center gap-2 px-3 py-2.5 flex-wrap" style={{ borderTop: "1px solid var(--border)" }}>
          <select className="sw-input sw-focus" style={{ width: 140, height: 32, fontSize: 12.5 }} value={productFilter} onChange={(e) => setProductFilter(e.target.value)}>
            <option value="All">All products</option>
            {productOptions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>

          <select className="sw-input sw-focus" style={{ width: 152, height: 32, fontSize: 12.5 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="All">All statuses</option>
            {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            {dataView === "claimed" && <option value="__not_statted">Not Statted</option>}
          </select>

            {/* Exceptions — one consistent segmented group */}
          {ngpCount > 0 && (
          <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)", height: 32 }}>
            {[
              ["hide", "Hide Non GP", null, "Non-GP orders don't count toward GP"],
              ["show", "Show Non GP", null, "Include Non-GP orders in the list"],
              ["only", "Only Non GP", ngpCount, "Just the Non-GP orders"],
            ].map(([k, lbl, n, hint]) => (
              <button key={k} onClick={() => { setNgpMode(k); setFocusFilter("All"); }} title={hint}
                className="sw-focus px-2 text-xs whitespace-nowrap"
                style={ngpMode === k && focusFilter === "All"
                  ? { background: "var(--surface-alt)", color: "var(--ink)", fontWeight: 600, height: "100%" }
                  : { background: "transparent", color: "var(--ink-faint)", height: "100%" }}>
                {lbl}{n ? <b style={{ fontWeight: 700 }}> ({n})</b> : ""}
              </button>
            ))}
          </div>
          )}

          <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)", height: 32 }}>
            {/* Only worth showing when there's actually something flagged */}
            {nsovCount > 0 && (
              <>
                <button onClick={() => { setNsovMode(nsovMode === "only" ? "show" : "only"); setFocusFilter("All"); }}
                  title="Show only orders whose Suffex says NSOV without NGP — excluded from SOV but still counting toward GP. They appear in the list normally otherwise."
                  className="sw-focus px-2 text-xs whitespace-nowrap"
                  style={nsovMode === "only" && focusFilter === "All"
                    ? { background: "var(--amber-soft)", color: "var(--amber)", fontWeight: 600, height: "100%" }
                    : { background: "transparent", color: "var(--ink-soft)", height: "100%" }}>
                  Only Non SOV<b style={{ fontWeight: 700 }}> ({nsovCount})</b>
                </button>
                <span style={{ width: 1, alignSelf: "stretch", background: "var(--border)" }} />
              </>
            )}
            <button onClick={() => setFocusFilter(focusFilter === "attention" ? "All" : "attention")}
              title="Orders at a status that needs the agent to act"
              className="sw-focus px-2 text-xs whitespace-nowrap"
              style={focusFilter === "attention"
                ? { background: "var(--amber-soft)", color: "var(--amber)", fontWeight: 600, height: "100%" }
                : { background: "transparent", color: attentionCount ? "var(--ink-soft)" : "var(--ink-faint)", height: "100%" }}>
              Need Actions{attentionCount ? <b style={{ fontWeight: 700 }}> ({attentionCount})</b> : ""}
            </button>
            <span style={{ width: 1, alignSelf: "stretch", background: "var(--border)" }} />
            <button onClick={() => setFocusFilter(focusFilter === "aged60" ? "All" : "aged60")}
              title="Submitted more than 60 days ago (includes the 90d+ ones)"
              className="sw-focus px-2 text-xs whitespace-nowrap"
              style={focusFilter === "aged60"
                ? { background: "var(--amber-soft)", color: "var(--amber)", fontWeight: 600, height: "100%" }
                : { background: "transparent", color: aged60Count ? "var(--ink-soft)" : "var(--ink-faint)", height: "100%" }}>
              60d+{aged60Count ? <b style={{ fontWeight: 700 }}> ({aged60Count})</b> : ""}
            </button>
            <span style={{ width: 1, alignSelf: "stretch", background: "var(--border)" }} />
            <button onClick={() => setFocusFilter(focusFilter === "aged" ? "All" : "aged")}
              title="Submitted more than 90 days ago"
              className="sw-focus px-2 text-xs whitespace-nowrap"
              style={focusFilter === "aged"
                ? { background: "var(--red-soft)", color: "var(--red)", fontWeight: 600, height: "100%" }
                : { background: "transparent", color: agedCount ? "var(--ink-soft)" : "var(--ink-faint)", height: "100%" }}>
              90d+{agedCount ? <b style={{ fontWeight: 700 }}> ({agedCount})</b> : ""}
            </button>
          </div>

          <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)", height: 32 }}>
            <button onClick={() => setCampaignOnly((v) => !v)} title="Only deals from a named campaign"
              className="sw-focus px-2 text-xs whitespace-nowrap flex items-center gap-1"
              style={campaignOnly
                ? { background: "var(--primary-soft)", color: "var(--primary)", fontWeight: 600, height: "100%" }
                : { background: "transparent", color: "var(--ink-faint)", height: "100%" }}>
              🎯
            </button>
            <span style={{ width: 1, alignSelf: "stretch", background: "var(--border)" }} />
            <button onClick={() => setAcqOnly((v) => !v)} title="Only acquisitions — new business"
              className="sw-focus px-2 text-xs whitespace-nowrap"
              style={acqOnly
                ? { background: "var(--primary-soft)", color: "var(--primary)", fontWeight: 600, height: "100%" }
                : { background: "transparent", color: "var(--ink-faint)", height: "100%" }}>
              ACQ
            </button>
          </div>
        </div>
      </div>

      {/* Totals for the list below — follows every filter on the page */}
      <ListTotalsStrip gp={listTotals.gp} sov={listTotals.sov} count={filtered.length}
        label={dataView === "statted" ? "statted" : dataView === "forecast" ? "forecast" : "claimed"} />

      <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div>
          <table className="w-full text-sm sw-orders" style={{ tableLayout: "fixed" }}>
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
                  { label: "Company", key: "company", hide: "" },
                  { label: "People", key: "agent", hide: "" },
                  { label: "Product", key: null, hide: "sw-hide-sm" },
                  { label: "SOV", key: "sov", hide: "sw-hide-xs" },
                  { label: "GP", key: "gp", hide: "" },
                  { label: "Status", key: "status", hide: "" },
                  { label: dataView === "forecast" ? "Expected" : "Date", key: "date", hide: "sw-hide-sm" },
                ].map(({ label, key, hide }) => (
                  <th
                    key={label}
                    onClick={key ? () => toggleSort(key) : undefined}
                    className={`text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide ${hide} ${key ? "cursor-pointer select-none" : ""}`}
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
                      <span className="text-xs sw-clamp2" style={{ lineHeight: 1.3 }}>{obscureName(r.closer_name, leaverNames) || "—"}</span>
                    </div>
                    {r.lead_gen_name && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <TeamTag team={r.lead_gen_team} allTeams={teamOptions} />
                        <span className="sw-clamp2" style={{ color: "var(--ink-faint)", fontSize: 10, lineHeight: 1.3 }}>{obscureName(r.lead_gen_name, leaverNames)}</span>
                      </div>
                    )}
                  </td>

                  <td className="px-3 py-2 text-xs sw-clamp2 sw-hide-sm" style={{ color: "var(--ink-soft)", lineHeight: 1.3 }}>{r.product}</td>

                  <td className="px-3 py-2 sw-mono text-xs sw-hide-xs">{fmtGBP(r.sov)}</td>

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

                  <td className="px-2 py-2 text-xs sw-hide-sm" style={{ color: "var(--ink-faint)", fontSize: 11, lineHeight: 1.3 }}>{r.date ? fmtDate(r.date) : "—"}</td>
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
  // Full-record amendment — every field on the row, not just SOV/GP
  const [editingAll, setEditingAll] = useState(false);
  const [form, setForm] = useState({});
  const [allErr, setAllErr] = useState("");

  useEffect(() => {
    setEditing(false);
    setEditingAll(false);
    setRemoving(false);
    setRemoveReason("");
    setAllErr("");
    if (order) { setSov(String(order.contract_value ?? "")); setGp(String(order.sales_agent_gp ?? "")); setEditErr(""); }
  }, [order?.id]);

  if (!order) return null;

  /* Every field an amendment is allowed to touch. Deliberately excludes the
     derived GP splits (closer_share, gp_office, team figures) — those are
     recomputed from GP + the two percentages so they can never drift out of
     step with each other. Also excludes id / lbcr_ref / removed_at. */
  const EDIT_FIELDS = [
    { k: "company_name", label: "Company", w: 2 },
    { k: "opp_id", label: "Opp ID" },
    { k: "document_number", label: "NetSuite Doc No." },
    { k: "order_status", label: "Order status" },
    { k: "contract_value", label: "SOV (£)", num: true },
    { k: "sales_agent_gp", label: "GP (£)", num: true },
    { k: "closer_name", label: "Closer" },
    { k: "closer_team", label: "Closer team" },
    { k: "closer_pct", label: "Closer %", num: true },
    { k: "lead_gen_name", label: "Lead gen" },
    { k: "lead_gen_team", label: "Lead gen team" },
    { k: "lead_gen_pct", label: "Lead gen %", num: true },
    { k: "product_group_2", label: "Product group" },
    { k: "item_name_grouped", label: "Items" },
    { k: "cug", label: "CUG" },
    { k: "quantity", label: "Quantity", num: true },
    { k: "partner", label: "Partner" },
    { k: "partner_role", label: "Partner role" },
    { k: "admin_agent", label: "Admin agent" },
    { k: "allocated_to_name", label: "Allocated to" },
    { k: "delivery_status", label: "Delivery status" },
    { k: "schedule_5", label: "Schedule 5" },
    { k: "campaign_source", label: "Campaign source" },
    { k: "dirty_order", label: "Dirty order", options: ["No", "Yes"] },
    { k: "submission_date", label: "Submission date", date: true },
    { k: "drive_link", label: "Drive link", w: 2 },
    { k: "description", label: "Description", w: 2, textarea: true },
  ];

  const openEditAll = () => {
    const f = {};
    EDIT_FIELDS.forEach(({ k, date }) => {
      const v = order[k];
      f[k] = v == null ? "" : date ? String(v).slice(0, 10) : String(v);
    });
    setForm(f);
    setAllErr("");
    setEditingAll(true);
  };

  const saveAll = async () => {
    setAllErr("");
    for (const fld of EDIT_FIELDS) {
      const v = String(form[fld.k] ?? "").trim();
      if (fld.num && v !== "" && !/^-?\d*\.?\d+$/.test(v)) {
        setAllErr(`${fld.label} must be a number.`); return;
      }
    }
    const cPct = form.closer_pct === "" ? 0 : num(form.closer_pct);
    const lPct = form.lead_gen_pct === "" ? 0 : num(form.lead_gen_pct);
    const hasLeadGen = !!String(form.lead_gen_name || "").trim();
    if (cPct + (hasLeadGen ? lPct : 0) === 0) { setAllErr("Splits can't both be zero."); return; }

    const patch = {};
    EDIT_FIELDS.forEach(({ k, num: isNum, date }) => {
      const raw = String(form[k] ?? "").trim();
      if (isNum) patch[k] = raw === "" ? null : num(raw);
      else if (date) patch[k] = raw === "" ? null : new Date(raw + "T00:00:00").toISOString();
      else patch[k] = raw === "" ? null : raw;
    });
    // Splits are always derived, never typed — same rule the import uses.
    Object.assign(patch, recomputeGP({
      gp: patch.sales_agent_gp,
      closerPct: cPct,
      leadGenPct: lPct,
      sameTeam: hasLeadGen && patch.closer_team === patch.lead_gen_team,
      hasLeadGen,
    }));
    patch.last_updated = new Date().toISOString();
    await onSave(order.id, patch);
    setEditingAll(false);
  };

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
    ["Allocated to", order.allocated_to_name], ["Delivery", order.delivery_status],
    ["Product Group", order.product_group_2],
    ["Closer", order.closer_name ? `${order.closer_name}${order.closer_team ? ` (${order.closer_team})` : ""}` : null],
    ["Lead Gen", order.lead_gen_name ? `${order.lead_gen_name}${order.lead_gen_team ? ` (${order.lead_gen_team})` : ""}` : null],
  ];

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0" style={{ background: "rgba(29,26,46,0.35)" }} onClick={onClose} />
      <div className={`sw-slide-in relative w-full h-full overflow-y-auto p-6 ${editingAll ? "max-w-2xl" : "max-w-md"}`} style={{ background: "var(--surface)", borderLeft: "1px solid var(--border)" }}>
        <button onClick={onClose} className="sw-focus absolute top-5 right-5 p-1.5 rounded-lg" style={{ color: "var(--ink-soft)" }}><X size={18} /></button>
        <div className="mb-1"><IdChip>{order.opp_id}</IdChip></div>
        <h2 className="sw-display text-xl font-bold mt-2 mb-1">{order.company_name}</h2>
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <StatusPill
            status={ns && ns.order_status ? ns.order_status : order.order_status}
            ngp={!!ns && ns.count_gp === false}
          />
          {canEdit && !editingAll && (
            <button onClick={openEditAll} className="sw-focus text-xs font-semibold px-2.5 py-1 rounded-lg"
              style={{ color: "var(--primary)", background: "var(--primary-soft)" }}>
              Edit
            </button>
          )}
        </div>

        {/* Full amendment. Everything on the record in one form — the GP
            splits are recomputed on save rather than typed, so they can't
            drift from GP and the percentages. */}
        {canEdit && editingAll && (
          <div className="rounded-xl mb-5 p-4" style={{ background: "var(--surface-alt)", border: "1px solid var(--primary)" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--primary)" }}>Amend order</span>
              <span className="text-xs" style={{ color: "var(--ink-faint)" }}>{order.lbcr_ref || ""}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
              {EDIT_FIELDS.map((fld) => (
                <div key={fld.k} style={{ gridColumn: fld.w === 2 ? "span 2" : "span 1", minWidth: 0 }}>
                  <label className="sw-label">{fld.label}</label>
                  {fld.options ? (
                    <select className="sw-input sw-focus" style={{ height: 32, fontSize: 12 }}
                      value={form[fld.k] ?? ""} onChange={(e) => setForm((p) => ({ ...p, [fld.k]: e.target.value }))}>
                      <option value="">—</option>
                      {fld.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : fld.textarea ? (
                    <textarea className="sw-input sw-focus" rows={3} style={{ fontSize: 12 }}
                      value={form[fld.k] ?? ""} onChange={(e) => setForm((p) => ({ ...p, [fld.k]: e.target.value }))} />
                  ) : (
                    <input className="sw-input sw-focus" type={fld.date ? "date" : "text"} style={{ height: 32, fontSize: 12 }}
                      value={form[fld.k] ?? ""} onChange={(e) => setForm((p) => ({ ...p, [fld.k]: e.target.value }))} />
                  )}
                </div>
              ))}
            </div>

            <div className="text-xs mt-3" style={{ color: "var(--ink-soft)" }}>
              Splits recalculate on save: Closer {num(form.closer_pct)}% = {fmtGBP(num(form.sales_agent_gp) * num(form.closer_pct) / 100)}
              {String(form.lead_gen_name || "").trim()
                ? ` · Lead Gen ${num(form.lead_gen_pct)}% = ${fmtGBP(num(form.sales_agent_gp) * num(form.lead_gen_pct) / 100)}`
                : ""}
            </div>
            {allErr && <div className="sw-err mt-2">{allErr}</div>}
            <div className="flex gap-2 mt-3">
              <button onClick={saveAll} disabled={saving}
                className="sw-focus flex-1 py-2 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-1.5"
                style={{ background: "var(--primary)", opacity: saving ? 0.7 : 1 }}>
                {saving ? <Loader2 size={13} className="animate-spin" /> : null} Save amendment
              </button>
              <button onClick={() => setEditingAll(false)} className="sw-focus px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--ink-soft)" }}>Cancel</button>
            </div>
            <p className="text-xs mt-2" style={{ color: "var(--ink-faint)" }}>
              The Lilac Box auto-update can still overwrite these fields until the migration is finished.
            </p>
          </div>
        )}

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

        {/* Google Drive folder — where the PDF of the Lilac Box and any
            supporting documents live. */}
        <div className="rounded-xl mb-4 p-3" style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold uppercase" style={{ color: "var(--ink-soft)", letterSpacing: "0.04em" }}>Documents</span>
            {order.drive_link && (
              <a href={order.drive_link} target="_blank" rel="noreferrer" className="sw-focus text-xs font-semibold" style={{ color: "var(--primary)" }}>
                Open in Drive ↗
              </a>
            )}
          </div>
          {canEdit ? (
            <input className="sw-input sw-focus" style={{ height: 32, fontSize: 12 }}
              defaultValue={order.drive_link || ""} placeholder="Paste the Google Drive folder link"
              onBlur={(e) => { if (e.target.value !== (order.drive_link || "")) onSave(order.id, { drive_link: e.target.value || null }); }} />
          ) : (
            <div className="text-xs" style={{ color: order.drive_link ? "var(--ink-soft)" : "var(--ink-faint)" }}>
              {order.drive_link || "No folder linked yet"}
            </div>
          )}
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
  const periodFrom = parsePeriod(period).from;
  const inPeriod = useMemo(() => {
    const inP = periodTest(period);
    if (period === "all") return allNs;
    return allNs.filter((r) => inP(r.order_date ? r.order_date + "T00:00:00" : null));
  }, [allNs, period]);

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

function DayByDayView({ orders, staff, netsuite }) {
  const aliases = useAliases();
  const statusCfg = useStatusCfg();

  // NGP means claimed but already rejected — it shouldn't count toward
  // anyone's GP or SOV, but it does need to be visible so agents can see
  // what fell out and chase it.
  const nsByDoc = useMemo(() => {
    const m = {};
    (netsuite || []).forEach((n) => { if (n.document_number) m[String(n.document_number)] = n; });
    return m;
  }, [netsuite]);

  const isNgpOrder = useCallback((o) => {
    const n = o.document_number ? nsByDoc[String(o.document_number)] : null;
    if (!n) return false;
    const suffex = String(n.status_flags || "").toUpperCase();
    if (suffex) return /\bNGP\b/.test(suffex);
    const cfg = n.order_status ? statusCfg[n.order_status] : null;
    return cfg ? cfg.count_gp === false : n.count_gp === false;
  }, [nsByDoc, statusCfg]);

  // Resolve the team from the staff record, not the team stored on the
  // order — that was written at submission time and can be stale or blank.
  const teamByName = useMemo(() => {
    const m = {};
    (staff || []).forEach((s) => {
      if (!s.full_name || !s.team) return;
      m[nameKey(s.full_name)] = s.team;
      if (s.alt_name) m[nameKey(s.alt_name)] = s.team;
    });
    return m;
  }, [staff]);

  const teamOf = useCallback((name, fallback) => {
    if (!name) return fallback || "Unassigned";
    const canon = resolveName(name, aliases);
    return teamByName[nameKey(canon)] || teamByName[nameKey(name)] || fallback || "Unassigned";
  }, [teamByName, aliases]);

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
    if (team !== "All" && teamOf(o.closer_name, o.closer_team) !== team && teamOf(o.lead_gen_name, o.lead_gen_team) !== team) return false;
    if (agent !== "All" && o.closer_name !== agent && o.lead_gen_name !== agent) return false;
    return true;
  }), [orders, team, agent, monthStart, teamOf]);

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
    const dcBucket = blank();
    const ngpBucket = { gp: blank(), sov: blank(), teams: {} };
    const ensure = (t) => {
      if (!teams[t]) {
        teams[t] = { team: t, gp: blank(), totalSov: blank(), groups: {}, subs: {} };
        DBD_GROUPS.forEach((g) => { teams[t].groups[g.key] = blank(); teams[t].subs[g.key] = {}; });
      }
      return teams[t];
    };

    filtered.forEach((o) => {
      const t = ensure(teamOf(o.closer_name, o.closer_team));
      const d = o.submission_date;

      // Rejected work is tracked on its own line and kept out of every
      // total — it was claimed, but it isn't going to pay.
      if (isNgpOrder(o)) {
        addTo(ngpBucket.gp, d, num(o.gp_office != null ? o.gp_office : o.sales_agent_gp));
        addTo(ngpBucket.sov, d, num(o.contract_value));
        const tn = teamOf(o.closer_name, o.closer_team);
        if (!ngpBucket.teams[tn]) ngpBucket.teams[tn] = { gp: blank(), sov: blank() };
        addTo(ngpBucket.teams[tn].gp, d, num(o.gp_office != null ? o.gp_office : o.sales_agent_gp));
        addTo(ngpBucket.teams[tn].sov, d, num(o.contract_value));
        return;
      }

      // Each side claims their own share; anything claimed above the deal's
      // real GP is the overlap and comes off as DC.
      const dealGp = num(o.gp_office != null ? o.gp_office : o.sales_agent_gp);
      const closerGp = num(o.closer_share) || dealGp;
      const leadGenGp = num(o.lead_gen_share);
      addTo(t.gp, d, closerGp);
      if (o.lead_gen_name && leadGenGp) {
        const lt = ensure(teamOf(o.lead_gen_name, o.lead_gen_team));
        addTo(lt.gp, d, leadGenGp);
      }
      const overlap = (closerGp + leadGenGp) - dealGp;
      if (overlap > 0) addTo(dcBucket, d, -overlap);

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

    const list = Object.keys(teams).map((k) => teams[k]).sort((a, b) => b.gp.month - a.gp.month);
    list.dc = dcBucket;
    list.ngp = ngpBucket;
    return list;
  }, [filtered, addTo, product, teamOf, isNgpOrder]);

  const totals = useMemo(() => {
    const out = { gp: blank(), totalSov: blank(), groups: {}, subs: {}, claimed: blank() };
    DBD_GROUPS.forEach((g) => { out.groups[g.key] = blank(); out.subs[g.key] = {}; });
    const merge = (dst, src) => {
      dst.month += src.month;
      src.week.forEach((v, i) => { dst.week[i] += v; });
    };
    data.forEach((t) => {
      merge(out.gp, t.gp);
      merge(out.claimed, t.gp);
      merge(out.totalSov, t.totalSov);
      DBD_GROUPS.forEach((g) => {
        merge(out.groups[g.key], t.groups[g.key]);
        Object.keys(t.subs[g.key]).forEach((s) => {
          if (!out.subs[g.key][s]) out.subs[g.key][s] = blank();
          merge(out.subs[g.key][s], t.subs[g.key][s]);
        });
      });
    });
    out.ngp = data.ngp || { gp: blank(), sov: blank(), teams: {} };
    // Take the overlap back off so the office GP is the real figure
    const dcB = data.dc || blank();
    out.gp.month += dcB.month;
    dcB.week.forEach((v, i) => { out.gp.week[i] += v; });
    out.dc = dcB;
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

      <div className="sw-cols" style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)", gap: "0.75rem", alignItems: "start" }}>

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

                {/* Reconciles the team rows above to the office GP at the top */}
                {totals.dc && totals.dc.month !== 0 && (
                  <Row label="DC (lead-gen overlap)" bucket={totals.dc} tone="var(--red)" />
                )}

                {/* Claimed but already rejected — excluded from everything
                    above, shown here so it can be chased. */}
                {totals.ngp && totals.ngp.gp.month !== 0 && (
                  <>
                    <Row label="NGP — rejected GP" bucket={totals.ngp.gp} tone="var(--red)"
                      isOpen={!!open.ngp} onToggle={() => toggle("ngp")} />
                    {open.ngp && (
                      <>
                        <Row label="Rejected SOV" bucket={totals.ngp.sov} depth={1} tone="var(--ink-faint)" />
                        {Object.keys(totals.ngp.teams).sort().map((tn) => (
                          <React.Fragment key={tn}>
                            <Row label={`${tn} — GP`} bucket={totals.ngp.teams[tn].gp} depth={1} tone="var(--red)" />
                            <Row label={`${tn} — SOV`} bucket={totals.ngp.teams[tn].sov} depth={2} tone="var(--ink-faint)" />
                          </React.Fragment>
                        ))}
                      </>
                    )}
                  </>
                )}

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

/* One commission band. Thresholds are whatever KPIs the plan declares. */
/* Pay plan editor. Tiers run as COLUMNS across the targets, so it reads
   like the commission table it came from: each tier is a band with its own
   GP and KPI thresholds, and the commission rate applied to statted GP. */
/* Pay plan editor. The plan's own targets sit in the left column exactly
   as before; commission tiers are added as extra columns beside them, each
   with its own thresholds and a commission rate applied to statted GP. */
function PayPlanForm({ plan, agentCount, tiers, metrics, error, staff, onSave, onDelete,
                      onSaveTier, onAddTier, onDeleteTier, onAddMetric, onDeleteMetric, onAssignPlan }) {
  const [addingPerson, setAddingPerson] = useState("");
  const [movingId, setMovingId] = useState(null);
  const onPlan = useMemo(() => (staff || []).filter((s) => s.pay_plan_id === plan.id && s.active !== false), [staff, plan.id]);
  const notOnPlan = useMemo(() => (staff || []).filter((s) => s.sells !== false && s.active !== false && s.pay_plan_id !== plan.id), [staff, plan.id]);
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({
    name: plan.name || "", plan_kind: plan.plan_kind || "closer",
    description: plan.description || "",
    effective_from: plan.effective_from || "", effective_to: plan.effective_to || "",
    target_gp: plan.target_gp ?? 0,
    target_cloud_sov: plan.target_cloud_sov ?? 0,
    target_connectivity_sov: plan.target_connectivity_sov ?? 0,
    target_mobile_sov: plan.target_mobile_sov ?? 0,
    active: plan.active !== false,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [addingMetric, setAddingMetric] = useState(false);
  const [newMetric, setNewMetric] = useState({ key: "", label: "", unit: "money" });

  const dirty = Object.keys(f).some((k) => String(f[k]) !== String(plan[k] ?? (k === "active" ? true : k === "plan_kind" ? "closer" : "")));
  const planMetrics = useMemo(() => metrics.filter((m) => m.plan_id === plan.id), [metrics, plan.id]);
  const planTiers = useMemo(
    () => tiers.filter((t) => t.plan_id === plan.id).sort((a, b) => num(a.gp_min) - num(b.gp_min)),
    [tiers, plan.id]
  );

  /* A tier cell. Saves on blur so you can tab across a row. */
  const TierCell = ({ tier, field, metricKey, unit, placeholder }) => {
    const current = metricKey ? (tier.thresholds || {})[metricKey] ?? "" : tier[field] ?? "";
    const [v, setV] = useState(String(current));
    useEffect(() => { setV(String(current)); }, [current]);
    const commit = () => {
      if (String(v) === String(current)) return;
      if (metricKey) {
        const th = { ...(tier.thresholds || {}) };
        if (v === "") delete th[metricKey]; else th[metricKey] = parseFloat(v) || 0;
        onSaveTier(tier.id, { thresholds: th });
      } else {
        onSaveTier(tier.id, { [field]: v === "" ? (field === "gp_max" ? null : 0) : parseFloat(v) || 0 });
      }
    };
    return (
      <div className="relative">
        {unit === "money" && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--ink-faint)" }}>£</span>}
        <input className="sw-input sw-focus" value={v} placeholder={placeholder}
          onChange={(e) => setV(e.target.value)} onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          style={{ height: 32, fontSize: 12.5, paddingLeft: unit === "money" ? 17 : 8, paddingRight: unit === "percent" ? 17 : 8 }} />
        {unit === "percent" && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--ink-faint)" }}>%</span>}
      </div>
    );
  };

  const TierName = ({ tier }) => {
    const [v, setV] = useState(tier.label || "");
    useEffect(() => { setV(tier.label || ""); }, [tier.label]);
    return (
      <input className="sw-input sw-focus" value={v} placeholder="Tier name"
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { if (v !== (tier.label || "")) onSaveTier(tier.id, { label: v }); }}
        style={{ height: 30, fontSize: 12, fontWeight: 600, textAlign: "center" }} />
    );
  };

  // Base column input — the plan's own target, unchanged from before
  const baseField = (key) => (
    <div className="relative">
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--ink-faint)" }}>£</span>
      <input className="sw-input sw-focus" style={{ height: 32, paddingLeft: 17, fontSize: 12.5 }}
        value={f[key]} onChange={(e) => setF((p) => ({ ...p, [key]: e.target.value }))} />
    </div>
  );

  // repeat(0, …) is invalid CSS and would invalidate the whole rule, so the
  // no-tiers case is spelled out separately.
  const cols = planTiers.length
    ? `170px 150px repeat(${planTiers.length}, minmax(120px, 1fr)) 34px`
    : "170px 150px 1fr 34px";
  const lbl = { fontSize: 12, color: "var(--ink-soft)", display: "flex", alignItems: "center" };

  return (
    <div className="flex flex-col gap-3">

      <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-4 py-3 gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
          <input className="sw-input sw-focus" style={{ fontWeight: 600, fontSize: 14, maxWidth: 300 }}
            value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} />
          <span className="text-xs font-semibold px-2 py-1 rounded-full shrink-0" style={{ background: agentCount ? "var(--primary-soft)" : "var(--surface-alt)", color: agentCount ? "var(--primary)" : "var(--ink-faint)" }}>
            {agentCount} on this plan
          </span>
        </div>

      {/* Who's on this plan, movable straight from here — saves hopping
          back and forth to the agent's own record. */}
      {onAssignPlan && (
        <div className="rounded-xl p-4 mt-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium uppercase" style={{ color: "var(--ink-faint)", letterSpacing: "0.04em" }}>People on this plan</span>
            <span className="text-xs" style={{ color: "var(--ink-faint)" }}>{onPlan.length}</span>
          </div>

          {onPlan.length === 0 ? (
            <div className="text-xs py-2" style={{ color: "var(--ink-faint)" }}>Nobody yet.</div>
          ) : (
            <div className="flex flex-col gap-1 mb-2">
              {onPlan.map((s) => (
                <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: "var(--surface-alt)" }}>
                  <span className="text-xs flex-1 truncate">{s.full_name}</span>
                  <span className="text-xs" style={{ color: "var(--ink-faint)" }}>{s.team || "—"}</span>
                  <button
                    disabled={movingId === s.id}
                    onClick={async () => { setMovingId(s.id); await onAssignPlan(s.id, null, todayStr()); setMovingId(null); }}
                    className="sw-focus text-xs" style={{ color: "var(--red)" }} title="Take off this plan">
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <select className="sw-input sw-focus" style={{ flex: 1, height: 30, fontSize: 12.5 }}
              value={addingPerson} onChange={(e) => setAddingPerson(e.target.value)}>
              <option value="">Move someone onto this plan…</option>
              {notOnPlan.map((s) => <option key={s.id} value={s.id}>{s.full_name}{s.pay_plan_id ? " (switching)" : ""}</option>)}
            </select>
            <button disabled={!addingPerson}
              onClick={async () => { const id = addingPerson; setAddingPerson(""); await onAssignPlan(id, plan.id, todayStr()); }}
              className="sw-focus text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: addingPerson ? "var(--primary)" : "var(--surface-alt)", color: addingPerson ? "#fff" : "var(--ink-faint)" }}>
              Add
            </button>
          </div>
        </div>
      )}

        {/* Plan settings — unchanged */}
        <div className="px-4 py-3" style={{ display: "grid", gridTemplateColumns: "170px 1fr", gap: "0.5rem 0.75rem", alignItems: "center" }}>
          <label style={lbl}>Plan type</label>
          <select className="sw-input sw-focus" style={{ maxWidth: 180 }} value={f.plan_kind} onChange={(e) => setF((p) => ({ ...p, plan_kind: e.target.value }))}>
            <option value="closer">Closer</option>
            <option value="lead_gen">Lead Gen</option>
            <option value="other">Other</option>
          </select>

          <label style={lbl}>In force from</label>
          <div className="flex items-center gap-2 flex-wrap">
            <input type="date" className="sw-input sw-focus" style={{ maxWidth: 160 }} value={f.effective_from || ""}
              onChange={(e) => setF((p) => ({ ...p, effective_from: e.target.value }))} />
            <span className="text-xs" style={{ color: "var(--ink-faint)" }}>until</span>
            <input type="date" className="sw-input sw-focus" style={{ maxWidth: 160 }} value={f.effective_to || ""}
              onChange={(e) => setF((p) => ({ ...p, effective_to: e.target.value }))} />
            <span className="text-xs" style={{ color: "var(--ink-faint)" }}>{f.effective_to ? "" : "blank while current"}</span>
          </div>

          <label style={lbl}>Notes</label>
          <input className="sw-input sw-focus" value={f.description} placeholder="What this plan is for"
            onChange={(e) => setF((p) => ({ ...p, description: e.target.value }))} />
        </div>

        {/* Targets, with tiers as extra columns beside them */}
        <div className="px-4 pb-3" style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: cols, gap: "0.5rem", alignItems: "center", minWidth: 460 }}>

            {/* Header */}
            <div />
            <div className="text-xs font-semibold uppercase text-center" style={{ color: "var(--ink-faint)", letterSpacing: "0.03em" }}>Plan target</div>
            {planTiers.length === 0 ? (
              <button onClick={() => onAddTier(plan.id)}
                className="sw-focus rounded-lg text-xs font-semibold"
                style={{ height: 30, background: "var(--primary-soft)", color: "var(--primary)", border: "1px dashed var(--primary)" }}>
                + Add your first tier
              </button>
            ) : (
              planTiers.map((t) => <TierName key={t.id} tier={t} />)
            )}
            <button onClick={() => onAddTier(plan.id)} title="Add a tier"
              className="sw-focus rounded-lg text-sm font-bold"
              style={{ height: 30, background: "var(--primary-soft)", color: "var(--primary)" }}>+</button>

            {/* Commission — tiers only; the base column has no rate */}
            <label style={{ ...lbl, fontWeight: 600, color: "var(--green)" }}>Commission rate</label>
            <div className="text-xs text-center" style={{ color: "var(--ink-faint)" }}>—</div>
            {planTiers.map((t) => (
              <TierCell key={t.id} tier={t} field="payment_pct" unit="percent" placeholder="0" />
            ))}
            {planTiers.length === 0 && <div />}
            <div />

            {/* GP */}
            <label style={{ ...lbl, fontWeight: 600 }}>Headline GP target</label>
            {baseField("target_gp")}
            {planTiers.map((t) => <TierCell key={t.id} tier={t} field="gp_min" unit="money" placeholder="from" />)}
            {planTiers.length === 0 && <div />}
            <div />

            <label style={{ ...lbl, color: "var(--ink-faint)" }}>GP upper limit</label>
            <div className="text-xs text-center" style={{ color: "var(--ink-faint)" }}>—</div>
            {planTiers.map((t) => <TierCell key={t.id} tier={t} field="gp_max" unit="money" placeholder="no cap" />)}
            {planTiers.length === 0 && <div />}
            <div />

            {/* Fixed product targets */}
            <label style={lbl}>Cloud SOV target</label>
            {baseField("target_cloud_sov")}
            {planTiers.map((t) => <TierCell key={t.id} tier={t} metricKey="cloud_sov" unit="money" placeholder="—" />)}
            {planTiers.length === 0 && <div />}
            <div />

            <label style={lbl}>Connectivity SOV target</label>
            {baseField("target_connectivity_sov")}
            {planTiers.map((t) => <TierCell key={t.id} tier={t} metricKey="connectivity_sov" unit="money" placeholder="—" />)}
            {planTiers.length === 0 && <div />}
            <div />

            <label style={lbl}>Mobile SOV target</label>
            {baseField("target_mobile_sov")}
            {planTiers.map((t) => <TierCell key={t.id} tier={t} metricKey="mobile_sov" unit="money" placeholder="—" />)}
            {planTiers.length === 0 && <div />}
            <div />

            {/* Any extra KPIs this plan declares */}
            {planMetrics.filter((m) => !["cloud_sov", "connectivity_sov", "mobile_sov"].includes(m.key)).map((m) => (
              <React.Fragment key={m.id}>
                <label style={lbl}>
                  {m.label}
                  <button onClick={() => onDeleteMetric(m.id)} className="sw-focus ml-1.5" style={{ color: "var(--red)", fontSize: 11 }} title="Remove this KPI">✕</button>
                </label>
                <div className="text-xs text-center" style={{ color: "var(--ink-faint)" }}>—</div>
                {planTiers.map((t) => <TierCell key={t.id} tier={t} metricKey={m.key} unit={m.unit} placeholder="—" />)}
                {planTiers.length === 0 && <div />}
                <div />
              </React.Fragment>
            ))}

            {/* Remove tier */}
            {planTiers.length > 0 && (
              <>
                <div />
                <div />
                {planTiers.map((t) => (
                  <button key={t.id} onClick={() => onDeleteTier(t.id)}
                    className="sw-focus text-xs rounded-lg" style={{ height: 26, color: "var(--red)", border: "1px solid var(--border)", background: "var(--surface)" }}>
                    Remove
                  </button>
                ))}
                <div />
              </>
            )}
          </div>

          {error && (
            <div className="rounded-lg p-2.5 mt-3 flex items-start gap-2" style={{ background: "var(--red-soft)", border: "1px solid var(--red)" }}>
              <AlertTriangle size={14} style={{ color: "var(--red)", flexShrink: 0, marginTop: 1 }} />
              <span className="text-xs" style={{ color: "var(--ink)" }}>{error}</span>
            </div>
          )}

          <div className="flex items-center gap-3 mt-3">
            <button onClick={() => setAddingMetric((v) => !v)} className="sw-focus text-xs font-semibold" style={{ color: "var(--primary)" }}>
              {addingMetric ? "Cancel" : "+ Add KPI row"}
            </button>
            <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
              Blank in a tier column means that tier doesn't require it.
            </span>
          </div>

          {addingMetric && (
            <div className="flex items-end gap-2 mt-2 flex-wrap">
              <select className="sw-input sw-focus" style={{ width: 180 }} value=""
                onChange={(e) => {
                  const p = METRIC_PRESETS.find((x) => x.key === e.target.value);
                  if (p) setNewMetric({ key: p.key, label: p.label, unit: p.unit });
                }}>
                <option value="">Pick a common KPI…</option>
                {METRIC_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
              <input className="sw-input sw-focus" style={{ width: 150 }} placeholder="Row label" value={newMetric.label}
                onChange={(e) => setNewMetric((p) => ({ ...p, label: e.target.value }))} />
              <input className="sw-input sw-focus" style={{ width: 130 }} placeholder="key_name" value={newMetric.key}
                onChange={(e) => setNewMetric((p) => ({ ...p, key: e.target.value.replace(/\s+/g, "_").toLowerCase() }))} />
              <select className="sw-input sw-focus" style={{ width: 110 }} value={newMetric.unit}
                onChange={(e) => setNewMetric((p) => ({ ...p, unit: e.target.value }))}>
                {METRIC_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              <button disabled={!newMetric.key || !newMetric.label}
                onClick={async () => { await onAddMetric(plan.id, newMetric.key, newMetric.label, newMetric.unit); setNewMetric({ key: "", label: "", unit: "money" }); setAddingMetric(false); }}
                className="sw-focus text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: newMetric.key && newMetric.label ? "var(--primary)" : "var(--surface)", color: newMetric.key && newMetric.label ? "#fff" : "var(--ink-faint)" }}>
                Add row
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-4 py-3" style={{ borderTop: "1px solid var(--border)", background: "var(--surface-alt)" }}>
          <label className="flex items-center gap-2 text-xs mr-auto" style={{ color: "var(--ink-soft)" }}>
            <input type="checkbox" checked={f.active} onChange={(e) => setF((p) => ({ ...p, active: e.target.checked }))} />
            Active — available to assign
          </label>
          {saved && <span className="text-xs" style={{ color: "var(--green)" }}>Saved</span>}
          <button disabled={!dirty || saving}
            onClick={async () => {
              setSaving(true);
              await onSave(plan.id, {
                name: f.name, plan_kind: f.plan_kind, description: f.description,
                effective_from: f.effective_from || null, effective_to: f.effective_to || null,
                target_gp: parseFloat(f.target_gp) || 0,
                target_cloud_sov: parseFloat(f.target_cloud_sov) || 0,
                target_connectivity_sov: parseFloat(f.target_connectivity_sov) || 0,
                target_mobile_sov: parseFloat(f.target_mobile_sov) || 0,
                active: f.active,
              });
              setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 1600);
            }}
            className="sw-focus text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: dirty ? "var(--primary)" : "var(--surface)", color: dirty ? "#fff" : "var(--ink-faint)", border: "1px solid var(--border)" }}>
            {saving ? "Saving..." : "Save plan"}
          </button>
          {agentCount === 0 && (
            <button onClick={() => onDelete(plan.id, plan.name)} className="sw-focus text-xs" style={{ color: "var(--red)" }}>Delete</button>
          )}
        </div>
      </div>
    </div>
  );
}

function PayPlansView({ plans, staff, tiers, metrics, tablesMissing, error, onSave, onAdd, onDelete,
                       onSaveTier, onAddTier, onDeleteTier, onAddMetric, onDeleteMetric, onAssignPlan }) {
  const [selectedId, setSelectedId] = useState(null);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [openForecast, setOpenForecast] = useState(null);
  // Forecast figures vs what NetSuite actually statted, and a filter to
  // only the deals that have landed.
  const [valueMode, setValueMode] = useState("forecast");   // forecast | statted
  const [soldOnly, setSoldOnly] = useState(false);

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
  const selected = (plans || []).find((p) => p.id === selectedId) || null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Target size={18} style={{ color: "var(--primary)" }} />
        <h2 className="sw-display text-lg" style={{ fontWeight: 600 }}>Pay Plans</h2>
        <span className="text-xs" style={{ color: "var(--ink-faint)" }}>Monthly targets · assign to people on the Admin page</span>
      </div>

      {tablesMissing && (
        <div className="rounded-xl p-3 mb-3 flex items-start gap-2" style={{ background: "var(--amber-soft)", border: "1px solid var(--amber)" }}>
          <AlertTriangle size={15} style={{ color: "var(--amber)", flexShrink: 0, marginTop: 1 }} />
          <div className="text-sm" style={{ color: "var(--ink-soft)" }}>
            <b>Tiers aren't set up yet.</b> Run <code>add_pay_plan_tiers.sql</code> in the Supabase SQL editor,
            then reload this page. Until then the Add tier button has nowhere to save to.
          </div>
        </div>
      )}

      <p className="text-sm mb-4 p-3 rounded-xl" style={{ background: "var(--primary-soft)", color: "var(--ink-soft)" }}>
        Targets are monthly and pro-rated by working day. This month has <b>{wd} working days</b>, <b>{wdDone}</b> have
        passed — a card turns green at <b>{Math.round((wdDone / wd) * 100)}%</b> of target, amber from 75% of that.
      </p>

      <div className="sw-cols mb-4" style={{ display: "grid", gridTemplateColumns: "260px minmax(0, 1fr)", gap: "0.75rem", alignItems: "start" }}>

        {/* LIST */}
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          {(plans || []).map((p) => {
            const sel = p.id === selectedId;
            return (
              <button key={p.id} onClick={() => { setSelectedId(p.id); setAdding(false); }}
                className="sw-focus w-full text-left px-3 py-2.5"
                style={{ background: sel ? "var(--primary-soft)" : "transparent", borderBottom: "1px solid var(--border)", opacity: p.active === false ? 0.55 : 1 }}>
                <div className="text-xs truncate" style={{ color: sel ? "var(--primary)" : "var(--ink)", fontWeight: sel ? 600 : 500 }}>{p.name}</div>
                <div className="text-xs truncate" style={{ color: "var(--ink-faint)", fontSize: 10.5 }}>
                  {fmtGBP(p.target_gp)} GP · {countByPlan[p.id] || 0} people
                  {p.effective_to ? ` · ended ${fmtDate(p.effective_to)}` : ""}
                </div>
              </button>
            );
          })}
          {(plans || []).length === 0 && (
            <div className="text-xs text-center py-8" style={{ color: "var(--ink-faint)" }}>No plans yet.</div>
          )}
          {adding ? (
            <div className="p-2 flex items-center gap-1.5" style={{ borderTop: "1px solid var(--border)" }}>
              <input className="sw-input sw-focus" style={{ height: 32, fontSize: 12 }} placeholder="Plan name" value={newName}
                onChange={(e) => setNewName(e.target.value)} autoFocus />
              <button disabled={!newName.trim()}
                onClick={async () => { await onAdd(newName.trim()); setNewName(""); setAdding(false); }}
                className="sw-focus text-xs font-semibold px-2.5 py-1.5 rounded-lg shrink-0"
                style={{ background: newName.trim() ? "var(--primary)" : "var(--surface)", color: newName.trim() ? "#fff" : "var(--ink-faint)" }}>
                Add
              </button>
            </div>
          ) : (
            <button onClick={() => { setAdding(true); setSelectedId(null); }}
              className="sw-focus w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold"
              style={{ color: "var(--primary)", borderTop: "1px solid var(--border)" }}>
              <Plus size={13} /> Add plan
            </button>
          )}
        </div>

        {/* DETAIL */}
        <div>
          {selected ? (
            <PayPlanForm key={selected.id} plan={selected} agentCount={countByPlan[selected.id] || 0}
              tiers={tiers || []} metrics={metrics || []} error={error} staff={staff}
              onSave={onSave} onDelete={onDelete}
              onSaveTier={onSaveTier} onAddTier={onAddTier} onDeleteTier={onDeleteTier}
              onAddMetric={onAddMetric} onDeleteMetric={onDeleteMetric} onAssignPlan={onAssignPlan} />
          ) : (
            <div className="rounded-xl p-10 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="text-sm" style={{ color: "var(--ink-faint)" }}>Select a plan from the list to edit its targets.</div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="sw-display text-sm mb-3" style={{ color: "var(--ink-faint)", fontWeight: 600, letterSpacing: "0.03em" }}>OFFICE MONTHLY TARGET (all assigned plans)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "0.75rem" }}>
          {[["GP", officeTotals.gp], ["Cloud SOV", officeTotals.cloud], ["Connectivity SOV", officeTotals.conn], ["Mobile SOV", officeTotals.mobile]].map(([lbl, v]) => (
            <div key={lbl} className="rounded-xl p-3" style={{ background: "var(--surface-alt)" }}>
              <div className="text-xs" style={{ color: "var(--ink-faint)" }}>{lbl}</div>
              <div className="sw-display" style={{ fontSize: 19, fontWeight: 600 }}>{fmtGBP(v)}</div>
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

function StatusConfigRow({ row, onSave, showAttention }) {
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
      {showAttention && (
        <td className="px-3 py-2 text-center">
          <input type="checkbox" checked={needsAttention} onChange={(e) => setNeedsAttention(e.target.checked)}
            title="An order sitting at this status needs the agent to do something" />
          <div className="text-xs" style={{ color: needsAttention ? "var(--amber)" : "var(--ink-faint)" }}>{needsAttention ? "chase" : "—"}</div>
        </td>
      )}
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
  const [showAttention, setShowAttention] = useState(false);   // collapsed by default
  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (!!a.auto_added !== !!b.auto_added) return a.auto_added ? -1 : 1;  // new ones first
      return String(a.status).localeCompare(String(b.status));
    });
  }, [rows]);
  const attentionCount = useMemo(() => rows.filter((r) => r.needs_attention).length, [rows]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Palette size={18} style={{ color: "var(--primary)" }} />
        <h2 className="sw-display text-lg" style={{ fontWeight: 600 }}>Order Statuses</h2>
        <span className="text-xs" style={{ color: "var(--ink-faint)" }}>Office only · applies everywhere immediately</span>
      </div>

      <p className="text-sm mb-4 p-3 rounded-xl" style={{ background: "var(--primary-soft)", color: "var(--ink-soft)" }}>
        Statuses arriving from NetSuite are added here automatically with a best-guess colour, marked <b>new</b> until
        you've checked them. Unticking <b>GP</b> makes a status NGP — those orders drop out of GP totals and are hidden
        from the dashboard unless someone asks to see them. Unticking <b>SOV</b> makes it NSOV.
        {newCount > 0 && <> <b>{newCount} new {newCount === 1 ? "status" : "statuses"}</b> to review.</>}
      </p>

      <button onClick={() => setShowAttention((v) => !v)}
        className="sw-focus flex items-center gap-1.5 text-xs font-medium mb-2"
        style={{ color: "var(--ink-faint)" }}>
        <ChevronDown size={13} style={{ transform: showAttention ? "rotate(0)" : "rotate(-90deg)", transition: "transform .15s" }} />
        Needs action{attentionCount > 0 ? ` (${attentionCount} set)` : ""}
      </button>

      <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--surface-alt)" }}>
              {["Status", "Colour", "Counts to GP", "Counts to SOV", ...(showAttention ? ["Needs action"] : []), "", ""].map((h, i) => (
                <th key={i} className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => <StatusConfigRow key={r.status} row={r} onSave={onSave} showAttention={showAttention} />)}
            {sorted.length === 0 && (
              <tr><td colSpan={showAttention ? 7 : 6} className="px-4 py-10 text-center" style={{ color: "var(--ink-faint)" }}>
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
  const [f, setF] = useState({
    label: s.label || "", blurb: s.blurb || "", persona: s.persona || "",
    call_role: s.call_role || "closer", difficulty: s.difficulty || "normal",
    active: s.active !== false,
  });
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = f.label !== s.label || f.blurb !== (s.blurb || "") || f.persona !== s.persona
    || f.call_role !== (s.call_role || "closer") || f.difficulty !== (s.difficulty || "normal")
    || f.active !== (s.active !== false);

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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }} className="mt-2">
            <div>
              <label className="sw-label">Which stage set it uses</label>
              <select className="sw-input sw-focus" value={f.call_role} onChange={(e) => setF((p) => ({ ...p, call_role: e.target.value }))}>
                <option value="closer">Closer stages</option>
                <option value="lead_gen">Lead gen stages</option>
              </select>
              <div className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>
                Ignored if this scenario has stages of its own.
              </div>
            </div>
            <div>
              <label className="sw-label">Default difficulty</label>
              <select className="sw-input sw-focus" value={f.difficulty} onChange={(e) => setF((p) => ({ ...p, difficulty: e.target.value }))}>
                <option value="easy">Receptive</option>
                <option value="normal">Normal</option>
                <option value="hard">Tough</option>
              </select>
              <div className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>
                The agent can still override this before a call.
              </div>
            </div>
          </div>

          <label className="sw-label" style={{ marginTop: 8 }}>The character the AI plays</label>
          <textarea className="sw-input sw-focus" rows={8} value={f.persona} onChange={(e) => setF((p) => ({ ...p, persona: e.target.value }))} />
          <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>
            Write it in second person — "You are a business owner who...". Give them a real business, a
            specific irritation, and something they will only reveal if asked properly. A persona with
            nothing to hide gives the agent nothing to find.
          </p>
        </div>
      )}
    </div>
  );
}

/* One call stage. Managers edit these, so what the coach expects at each
   point is visible and changeable rather than buried in a prompt.
   Grouped into three: what the agent is doing, what the customer does
   back, and how the turn should be judged. */
function StageRow({ s, onSave, onDelete }) {
  const [f, setF] = useState({
    label: s.label || "", goal: s.goal || "", advance_when: s.advance_when || "",
    objections: s.objections || "", fail_when: s.fail_when || "",
    coaching_note: s.coaching_note || "",
    customer_context: s.customer_context || "", reveals: s.reveals || "",
    good_example: s.good_example || "", poor_example: s.poor_example || "",
    mood_shift: s.mood_shift || "", never_do: s.never_do || "",
    max_turns: s.max_turns ?? 6, active: s.active !== false,
  });
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("agent");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = Object.keys(f).some((k) => String(f[k]) !== String(s[k] ?? (k === "active" ? true : k === "max_turns" ? 6 : "")));

  // How much of this stage has actually been filled in — an empty stage
  // still runs, it just gives the model less to work with.
  const detailFields = ["goal", "advance_when", "objections", "fail_when",
    "customer_context", "reveals", "good_example", "poor_example", "mood_shift", "never_do"];
  const filled = detailFields.filter((k) => String(f[k] || "").trim()).length;

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const Field = ({ label, k, rows = 2, hint, placeholder }) => (
    <div className="mb-2.5">
      <label className="sw-label">{label}</label>
      <textarea className="sw-input sw-focus" rows={rows} value={f[k]} placeholder={placeholder}
        onChange={set(k)} style={{ fontSize: 12, lineHeight: 1.45 }} />
      {hint && <div className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>{hint}</div>}
    </div>
  );

  const TABS = [
    { key: "agent", label: "Agent" },
    { key: "customer", label: "Customer" },
    { key: "grading", label: "Grading" },
  ];

  return (
    <div className="rounded-xl mb-2" style={{ background: "var(--surface)", border: "1px solid var(--border)", opacity: f.active ? 1 : 0.6 }}>
      <div className="flex items-center gap-2 px-3 py-2">
        <button onClick={() => setOpen((v) => !v)} className="sw-focus flex items-center gap-2 flex-1 text-left min-w-0">
          <ChevronDown size={13} style={{ color: "var(--ink-faint)", flexShrink: 0, transform: open ? "rotate(0)" : "rotate(-90deg)", transition: "transform .15s" }} />
          <input className="sw-input sw-focus" style={{ maxWidth: 200, height: 30, fontSize: 13, fontWeight: 600 }}
            value={f.label} onClick={(e) => e.stopPropagation()} onChange={set("label")} />
          <span className="text-xs shrink-0" style={{ color: filled >= 6 ? "var(--green)" : filled >= 3 ? "var(--amber)" : "var(--ink-faint)" }}
            title={`${filled} of ${detailFields.length} detail fields filled in`}>
            {filled}/{detailFields.length}
          </span>
        </button>
        <label className="flex items-center gap-1.5 text-xs shrink-0" style={{ color: "var(--ink-soft)" }} title="Include this stage in calls">
          <input type="checkbox" checked={f.active} onChange={(e) => setF((p) => ({ ...p, active: e.target.checked }))} /> On
        </label>
        <button disabled={!dirty || saving}
          onClick={async () => {
            setSaving(true);
            await onSave(s.id, { ...f, max_turns: parseInt(f.max_turns, 10) || 6 });
            setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 1500);
          }}
          className="sw-focus text-xs font-semibold px-2.5 py-1.5 rounded-lg shrink-0"
          style={{ background: dirty ? "var(--primary)" : "var(--surface-alt)", color: dirty ? "#fff" : "var(--ink-faint)" }}>
          {saving ? "..." : saved ? "✓" : "Save"}
        </button>
        <button onClick={() => onDelete(s.id, f.label)} className="sw-focus text-xs px-1.5 shrink-0" style={{ color: "var(--red)" }} title="Delete stage">✕</button>
      </div>

      {open && (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex items-center gap-1 px-3 pt-2">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className="sw-focus px-2.5 py-1 rounded-lg text-xs"
                style={tab === t.key
                  ? { background: "var(--primary-soft)", color: "var(--primary)", fontWeight: 600 }
                  : { color: "var(--ink-faint)" }}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="px-3 pb-3 pt-2">
            {tab === "agent" && (
              <>
                <Field label="What the agent should achieve here" k="goal" rows={2}
                  placeholder="e.g. Understand what they currently have and when it renews." />
                <Field label="Move on when" k="advance_when" rows={2}
                  hint="The customer only advances the call when this is genuinely met."
                  placeholder="e.g. They've learned the provider, the pain and a renewal date." />
                <Field label="Coaching note shown during the call" k="coaching_note" rows={2}
                  hint="A short prompt the agent sees while this stage is live."
                  placeholder="e.g. Open questions. Let them talk. You're looking for a reason to continue." />
                <div style={{ maxWidth: 180 }}>
                  <label className="sw-label">Soft turn limit</label>
                  <input className="sw-input sw-focus" value={f.max_turns} onChange={set("max_turns")} />
                </div>
              </>
            )}

            {tab === "customer" && (
              <>
                <Field label="What the customer knows and is thinking" k="customer_context" rows={3}
                  hint="Their situation at this point in the call, in their words."
                  placeholder="e.g. You've had the same provider six years. It mostly works but the broadband drops weekly and nobody calls back." />
                <Field label="What they'll give up if asked well" k="reveals" rows={3}
                  hint="Information the customer volunteers in response to good questions — this is what the agent is digging for."
                  placeholder="e.g. Contract ends in March. 12 staff, 4 mobiles on a separate contract. The last outage cost a day's trading." />
                <Field label="Objections available here" k="objections" rows={2}
                  hint="Raised when they'd naturally come up — not all at once."
                  placeholder="e.g. We're happy as we are. / Why do you need to know that?" />
                <Field label="How their mood should shift" k="mood_shift" rows={2}
                  hint="What warms them up, and what closes them down."
                  placeholder="e.g. Warms up if they ask about the outages. Goes short if pitched to before being understood." />
                <Field label="The customer must never" k="never_do" rows={2}
                  placeholder="e.g. Volunteer the renewal date unprompted. Offer to buy without being asked." />
              </>
            )}

            {tab === "grading" && (
              <>
                <Field label="This is going badly if" k="fail_when" rows={2}
                  placeholder="e.g. The agent pitches before understanding anything, or asks only closed questions." />
                <Field label="A strong turn here sounds like" k="good_example" rows={3}
                  hint="Calibrates the top of the scale — the model marks against this."
                  placeholder={"e.g. \"What made you look at this now, rather than at renewal?\""} />
                <Field label="A weak turn here sounds like" k="poor_example" rows={3}
                  hint="Calibrates the bottom. Be specific — vague examples make grading vague."
                  placeholder={"e.g. \"So we do broadband, mobile, cloud voice and BT Net — any of those interest you?\""} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StagesEditor({ stages, scenarios, onSave, onAdd, onDelete }) {
  const [scope, setScope] = useState("");   // "" = all scenarios
  const forScope = useMemo(
    () => (stages || []).filter((s) => (scope ? s.scenario_key === scope : !s.scenario_key))
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    [stages, scope]
  );

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xs font-medium uppercase" style={{ color: "var(--ink-faint)", letterSpacing: "0.04em" }}>Call stages for</span>
        <select className="sw-input sw-focus" style={{ width: 220, height: 32, fontSize: 12.5 }} value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="">All scenarios (default)</option>
          {(scenarios || []).map((s) => <option key={s.key} value={s.key}>{s.label} only</option>)}
        </select>
        <button onClick={() => onAdd(scope || null, forScope.length)}
          className="sw-focus text-xs font-semibold px-3 py-1.5 rounded-lg ml-auto"
          style={{ background: "var(--primary)", color: "#fff" }}>
          + Add stage
        </button>
      </div>

      <p className="text-sm mb-3 p-3 rounded-xl" style={{ background: "var(--primary-soft)", color: "var(--ink-soft)" }}>
        Stages give a call its spine. The customer still speaks naturally, but won't let the agent move on until
        the stage goal is genuinely met — so practice is consistent and you can see how far people get.
        A scenario with no stages of its own uses the default set.
      </p>

      {forScope.length === 0 ? (
        <div className="rounded-xl p-8 text-center text-sm" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--ink-faint)" }}>
          {scope
            ? "No stages specific to this scenario — it uses the default set. Add one to override."
            : "No stages yet. Run add_coach_stages.sql to load the starter set, or add them here."}
        </div>
      ) : (
        forScope.map((s) => <StageRow key={s.id} s={s} onSave={onSave} onDelete={onDelete} />)
      )}
    </div>
  );
}

/* How the coach works, drawn where it's edited. Managers change these
   settings without necessarily knowing what they feed — this makes the
   path from a settings box to the model's behaviour visible. */
function CoachFlowDiagram() {
  const [open, setOpen] = useState(false);

  const Box = ({ x, y, w, h = 46, fill, stroke, title, sub, titleColour, subColour }) => (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={7} fill={fill} stroke={stroke} strokeWidth="1" />
      <text x={x + w / 2} y={sub ? y + 18 : y + h / 2} textAnchor="middle" dominantBaseline="central"
        style={{ fontSize: 12, fontWeight: 600, fill: titleColour }}>{title}</text>
      {sub && (
        <text x={x + w / 2} y={y + 33} textAnchor="middle" dominantBaseline="central"
          style={{ fontSize: 10.5, fill: subColour }}>{sub}</text>
      )}
    </g>
  );

  // Purple = what you configure, teal = what the system does,
  // amber = the agent's side, grey = where it ends up.
  const cfg = { fill: "var(--primary-soft)", stroke: "var(--primary)", titleColour: "var(--primary)", subColour: "var(--ink-soft)" };
  const sys = { fill: "var(--surface-alt)", stroke: "var(--ink-faint)", titleColour: "var(--ink)", subColour: "var(--ink-soft)" };
  const act = { fill: "var(--amber-soft)", stroke: "var(--amber)", titleColour: "var(--amber)", subColour: "var(--ink-soft)" };

  return (
    <div className="rounded-2xl mb-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <button onClick={() => setOpen((v) => !v)}
        className="sw-focus w-full flex items-center gap-2 px-4 py-2.5 text-left">
        <ChevronDown size={13} style={{ color: "var(--ink-faint)", transform: open ? "rotate(0)" : "rotate(-90deg)", transition: "transform .15s" }} />
        <span className="text-xs font-medium uppercase" style={{ color: "var(--ink-faint)", letterSpacing: "0.04em" }}>
          How the coach uses these settings
        </span>
        <span className="text-xs ml-auto" style={{ color: "var(--ink-faint)" }}>
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4">
          <svg width="100%" viewBox="0 0 680 340" role="img" style={{ display: "block" }}>
            <title>How Coach Setup settings drive a practice call</title>
            <desc>
              Scenarios, stages, grading and bonuses are compiled into a prompt by the Edge Function.
              The agent speaks, the customer replies in character, each turn is graded and the stage
              advances. At the end a review is produced and saved to history.
            </desc>
            <defs>
              <marker id="cfarrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </marker>
            </defs>

            <text x="20" y="16" style={{ fontSize: 10.5, fill: "var(--ink-faint)" }}>You configure</text>

            <Box x={20}  y={26} w={150} title="Scenarios" sub="Persona, difficulty" {...cfg} />
            <Box x={182} y={26} w={150} title="Stages" sub="Goal, reveals, examples" {...cfg} />
            <Box x={344} y={26} w={150} title="Grading" sub="Rubric, what good is" {...cfg} />
            <Box x={506} y={26} w={154} title="Bonuses" sub="e.g. mobile question" {...cfg} />

            <line x1="340" y1="76" x2="340" y2="98" stroke="var(--ink-faint)" strokeWidth="1.5" markerEnd="url(#cfarrow)" />

            <Box x={200} y={102} w={280} h={42} title="Compiled into the prompt" {...sys} />

            <line x1="340" y1="148" x2="340" y2="170" stroke="var(--ink-faint)" strokeWidth="1.5" markerEnd="url(#cfarrow)" />

            <rect x={40} y={174} width={600} height={96} rx={10} fill="none"
              stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" />
            <text x="56" y="190" style={{ fontSize: 10.5, fill: "var(--ink-faint)" }}>Each turn</text>

            <Box x={68}  y={200} w={170} h={44} title="Agent speaks" sub="Voice or typed" {...act} />
            <Box x={442} y={200} w={170} h={44} title="Customer replies" sub="In character, in stage" {...sys} />

            <line x1="238" y1="222" x2="434" y2="222" stroke="var(--ink-faint)" strokeWidth="1.5" markerEnd="url(#cfarrow)" />
            <text x="336" y="214" textAnchor="middle" style={{ fontSize: 10.5, fill: "var(--ink-faint)" }}>graded, stage may advance</text>

            <path d="M527 244 L527 258 L153 258 L153 248" fill="none"
              stroke="var(--ink-faint)" strokeWidth="1.5" markerEnd="url(#cfarrow)" />

            <line x1="340" y1="274" x2="340" y2="292" stroke="var(--ink-faint)" strokeWidth="1.5" markerEnd="url(#cfarrow)" />

            <Box x={140} y={296} w={190} h={40} title="Call review" {...sys} />
            <Box x={350} y={296} w={190} h={40} title="Saved to history" {...sys} />
            <line x1="330" y1="316" x2="342" y2="316" stroke="var(--ink-faint)" strokeWidth="1.5" markerEnd="url(#cfarrow)" />
          </svg>

          <p className="text-xs mt-2" style={{ color: "var(--ink-faint)" }}>
            Everything the customer does comes from these boxes — there is no behaviour hidden in code.
            If a call feels wrong, the fix is here. The <b>End-of-call feedback</b> field below shapes the
            review specifically, separately from how individual turns are graded.
          </p>
        </div>
      )}
    </div>
  );
}

function CoachSettingsView({ scenarios, settings, stages, onSaveScenario, onAddScenario, onDeleteScenario, onSaveSettings,
                            onSaveStage, onAddStage, onDeleteStage }) {
  const [rubric, setRubric] = useState(settings.rubric || "");
  const [method, setMethod] = useState(settings.what_good_looks_like || "");
  const [feedback, setFeedback] = useState(settings.feedback_guidance || "");
  const [savingCfg, setSavingCfg] = useState(false);
  const [savedCfg, setSavedCfg] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  useEffect(() => {
    setRubric(settings.rubric || "");
    setMethod(settings.what_good_looks_like || "");
    setFeedback(settings.feedback_guidance || "");
  }, [settings]);

  const cfgDirty = rubric !== (settings.rubric || "") || method !== (settings.what_good_looks_like || "")
    || feedback !== (settings.feedback_guidance || "");

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Headphones size={18} style={{ color: "var(--primary)" }} />
        <h2 className="sw-display text-lg font-bold">Coach Setup</h2>
        <span className="text-xs" style={{ color: "var(--ink-faint)" }}>Scenarios and how calls are graded</span>
      </div>

      <CoachFlowDiagram />

      <p className="text-sm mb-4 p-3 rounded-xl" style={{ background: "var(--primary-soft)", color: "var(--ink-soft)" }}>
        This is what turns generic sales coaching into coaching on <b>your</b> method. The more specifically
        you describe what good looks like here, the more useful the feedback — and the harsher it can
        fairly be. Changes apply to the next practice call; nothing needs redeploying.
      </p>

      {/* Stages, method and scenarios side by side — they're edited
          together and each is narrow enough to work in a column. */}
      <div className="sw-cols" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1fr)", gap: "1rem", alignItems: "start" }}>

      {/* Call stages */}
      <div className="rounded-2xl p-4" style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}>
        <StagesEditor stages={stages} scenarios={scenarios}
          onSave={onSaveStage} onAdd={onAddStage} onDelete={onDeleteStage} />
      </div>

      {/* What good looks like */}
      <div className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-2">
          <div className="sw-display text-sm" style={{ color: "var(--ink-faint)", fontWeight: 600, letterSpacing: "0.03em" }}>WHAT GOOD LOOKS LIKE</div>
          <div className="flex items-center gap-2">
            {savedCfg && <CheckCircle2 size={15} style={{ color: "var(--green)" }} />}
            <button disabled={!cfgDirty || savingCfg}
              onClick={async () => { setSavingCfg(true); await onSaveSettings({ rubric, what_good_looks_like: method, feedback_guidance: feedback }); setSavingCfg(false); setSavedCfg(true); setTimeout(() => setSavedCfg(false), 1600); }}
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
        <textarea className="sw-input sw-focus" rows={14} value={method} onChange={(e) => setMethod(e.target.value)}
          style={{ fontSize: 12, lineHeight: 1.5 }} />

        <div className="sw-display font-bold text-sm mt-4 mb-2" style={{ color: "var(--ink-soft)" }}>SCORING SCALE</div>
        <p className="text-xs mb-2" style={{ color: "var(--ink-faint)" }}>
          Keep the six keywords — the app colours the badges from them — but change what earns each one.
        </p>
        <textarea className="sw-input sw-focus" rows={10} value={rubric} onChange={(e) => setRubric(e.target.value)}
          style={{ fontSize: 12, lineHeight: 1.5 }} />

        <div className="sw-display font-bold text-sm mt-4 mb-2" style={{ color: "var(--ink-soft)" }}>END-OF-CALL FEEDBACK</div>
        <p className="text-xs mb-2" style={{ color: "var(--ink-faint)" }}>
          Shapes the "How to improve this call" advice specifically — its tone, what it should always mention,
          what to leave alone. Use this when the review is technically right but not saying the thing you'd say.
        </p>
        <textarea className="sw-input sw-focus" rows={8} value={feedback} onChange={(e) => setFeedback(e.target.value)}
          placeholder={"e.g. Always name the exact question they should have asked instead.\nDon't comment on filler words or nerves.\nIf they didn't ask the mobile question, say so every time.\nKeep it to three points — the most important one first."}
          style={{ fontSize: 12, lineHeight: 1.5 }} />
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
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  OTHER VISUALS — charts that don't earn their place on a daily view     */
/* ---------------------------------------------------------------------- */

/* ---------------------------------------------------------------------- */
/*  SETTINGS — office-only, holds Statuses and Pay Plans                   */
/* ---------------------------------------------------------------------- */

/* Developer view — what feeds this app, how fresh it is, and where it
   comes from. Office-only. The point is that when a number looks wrong,
   the first question is always "when did that last sync?" and there was
   nowhere to answer it. */
const DATA_SOURCES = [
  {
    key: "orders", table: "orders", label: "Lilac Box orders",
    source: "Submitted in this app", cadence: "Live (Realtime)",
    freshField: "last_updated", dateField: "submission_date",
    note: "Written directly by agents. Realtime push plus a 2-minute safety poll.",
  },
  {
    key: "netsuite_orders", table: "netsuite_orders", label: "NetSuite orders",
    source: "NetSuite workbook → Apps Script", cadence: "Hourly trigger",
    freshField: "synced_at", dateField: "order_date",
    note: "The GP and SOV authority. Forecasts and Lilac claims are matched against these.",
  },
  {
    key: "unplaced_orders", table: "unplaced_orders", label: "Unplaced / to be placed",
    source: "Saved search customsearch723 → RESTlet → Edge Function", cadence: "Hourly (pg_cron)",
    freshField: "synced_at", dateField: "order_date",
    rawField: "data",
    note: "Direct API pull, no spreadsheet. Rows that leave the search are deleted, so this is a live snapshot rather than a log. Every column the search returns is kept in `data`.",
  },
  {
    key: "forecasts", table: "forecasts", label: "Forecasts",
    source: "Submitted in this app", cadence: "Live (Realtime)",
    freshField: "created_at", dateField: "forecast_week",
    note: "Weekly agent submissions. match_forecasts() links them to NetSuite by Opp ID, then by fuzzy company name.",
  },
  {
    key: "staff", table: "staff", label: "Staff",
    source: "Sales Agents page", cadence: "On change",
    freshField: null, dateField: null,
    note: "Names, teams, pay plans, leavers. Alt names resolve NetSuite spellings back to a person.",
  },
  {
    key: "coach_sessions", table: "coach_sessions", label: "Coach sessions",
    source: "Sales Coach", cadence: "On completion",
    freshField: "created_at", dateField: "created_at",
    note: "Practice call transcripts and scores.",
  },
  {
    key: "coach_stages", table: "coach_stages", label: "Coach stages",
    source: "Settings → Coach Setup", cadence: "On change",
    freshField: null, dateField: null,
    note: "The call spine the roleplay follows. Editing these changes how the coach behaves.",
  },
  {
    key: "pay_plan_tiers", table: "pay_plan_tiers", label: "Pay plan tiers",
    source: "Sales Agents → Pay Plans", cadence: "On change",
    freshField: null, dateField: null,
    note: "Commission thresholds behind the ranked list bars on Claimed.",
  },
];

function DeveloperView() {
  const [rows, setRows] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [openKey, setOpenKey] = useState(null);      // which table is expanded
  const [sample, setSample] = useState({});          // key -> { rows, cols, loading, error }
  const [limit, setLimit] = useState(200);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    const out = {};
    for (const s of DATA_SOURCES) {
      try {
        const { count, error: cErr } = await supabase
          .from(s.table).select("*", { count: "exact", head: true });
        if (cErr) throw cErr;

        let newest = null;
        if (s.freshField) {
          const { data } = await supabase
            .from(s.table).select(s.freshField)
            .order(s.freshField, { ascending: false }).limit(1);
          newest = data && data[0] ? data[0][s.freshField] : null;
        }
        out[s.key] = { count: count ?? 0, newest, ok: true };
      } catch (e) {
        out[s.key] = { count: null, newest: null, ok: false, error: String(e?.message || e) };
      }
    }
    setRows(out);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  /* Raw rows for whichever table is expanded. Capped, and ordered newest
     first where the table has something to order by — pulling an unbounded
     table into the browser is how you hang the tab. */
  const loadSample = useCallback(async (s, n) => {
    setSample((p) => ({ ...p, [s.key]: { ...(p[s.key] || {}), loading: true, error: "" } }));
    try {
      let q = supabase.from(s.table).select("*").limit(n);
      if (s.freshField) q = q.order(s.freshField, { ascending: false });
      else if (s.dateField) q = q.order(s.dateField, { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      const list = data || [];
      // Column order from the widest row, so sparse rows don't hide fields
      const seen = [];
      list.forEach((r) => Object.keys(r).forEach((k) => { if (!seen.includes(k)) seen.push(k); }));

      /* Where a table keeps a raw blob (unplaced_orders.data holds every
         column the saved search returns), list what's inside it — that's
         the fastest way to answer "did my new column actually arrive?" */
      const rawKeys = [];
      if (s.rawField) {
        list.forEach((r) => {
          const blob = r[s.rawField];
          if (blob && typeof blob === "object") {
            Object.keys(blob).forEach((k) => { if (!rawKeys.includes(k)) rawKeys.push(k); });
          }
        });
        rawKeys.sort();
      }

      setSample((p) => ({ ...p, [s.key]: { rows: list, cols: seen, rawKeys, loading: false, error: "" } }));
    } catch (e) {
      setSample((p) => ({ ...p, [s.key]: { rows: [], cols: [], loading: false, error: String(e?.message || e) } }));
    }
  }, []);

  const toggleOpen = useCallback((s) => {
    setOpenKey((cur) => {
      const next = cur === s.key ? null : s.key;
      if (next && !sample[s.key]) loadSample(s, limit);
      return next;
    });
  }, [sample, loadSample, limit]);

  /* CSV export. Values are quoted and internal quotes doubled, which is the
     bit people usually miss — a company name with a comma in it otherwise
     shifts every column after it. */
  const exportCsv = useCallback(async (s) => {
    setSample((p) => ({ ...p, [s.key]: { ...(p[s.key] || {}), exporting: true } }));
    try {
      // Export everything, not just what's on screen, paging past the 1000 cap
      const PAGE = 1000;
      let all = [];
      for (let from = 0; ; from += PAGE) {
        let q = supabase.from(s.table).select("*").range(from, from + PAGE - 1);
        if (s.freshField) q = q.order(s.freshField, { ascending: false });
        else if (s.dateField) q = q.order(s.dateField, { ascending: false });
        const { data, error } = await q;
        if (error) throw error;
        all = all.concat(data || []);
        if (!data || data.length < PAGE) break;
        if (all.length >= 50000) break;   // sanity cap
      }

      /* Flatten any raw blob into real columns. Exporting unplaced_orders
         with `data` as one JSON cell is nearly useless in a spreadsheet —
         this gives every source column its own column instead. */
      const flat = all.map((r) => {
        if (!s.rawField || !r[s.rawField] || typeof r[s.rawField] !== "object") return r;
        const { [s.rawField]: blob, ...rest } = r;
        const prefixed = {};
        Object.keys(blob).forEach((k) => { prefixed[`src: ${k}`] = blob[k]; });
        return { ...rest, ...prefixed };
      });

      const cols = [];
      flat.forEach((r) => Object.keys(r).forEach((k) => { if (!cols.includes(k)) cols.push(k); }));
      const cell = (v) => {
        if (v == null) return "";
        const str = typeof v === "object" ? JSON.stringify(v) : String(v);
        return `"${str.replace(/"/g, '""')}"`;
      };
      const csv = [cols.join(","), ...flat.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");

      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${s.table}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSample((p) => ({ ...p, [s.key]: { ...(p[s.key] || {}), exporting: false } }));
    } catch (e) {
      setSample((p) => ({ ...p, [s.key]: { ...(p[s.key] || {}), exporting: false, error: String(e?.message || e) } }));
    }
  }, []);





  // How stale is stale? Anything synced hourly should be under two hours.
  const ageOf = (iso) => {
    if (!iso) return null;
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (Number.isNaN(mins)) return null;
    return mins;
  };
  const ageLabel = (mins) => {
    if (mins == null) return "—";
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
    return `${Math.floor(mins / 1440)}d ago`;
  };
  const ageTone = (mins, cadence) => {
    if (mins == null) return "var(--ink-faint)";
    const hourly = /hour/i.test(cadence);
    if (hourly) return mins <= 120 ? "var(--green)" : mins <= 360 ? "var(--amber)" : "var(--red)";
    return mins <= 1440 ? "var(--green)" : "var(--amber)";
  };

  const summary = useMemo(() => {
    const list = DATA_SOURCES.map((s) => ({ s, r: rows[s.key] })).filter((x) => x.r);
    const failing = list.filter((x) => !x.r.ok).length;
    const stale = list.filter((x) => {
      if (!x.r.ok || !x.s.freshField) return false;
      const m = ageOf(x.r.newest);
      return m != null && /hour/i.test(x.s.cadence) && m > 360;
    }).length;
    const totalRows = list.reduce((n, x) => n + (x.r.count || 0), 0);
    return { failing, stale, totalRows, checked: list.length };
  }, [rows]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <ShieldAlert size={18} style={{ color: "var(--primary)" }} />
        <h2 className="sw-display text-lg font-bold">Developer</h2>
        <span className="text-xs" style={{ color: "var(--ink-faint)" }}>What feeds this app and how fresh it is</span>
        <button onClick={load} disabled={loading}
          className="sw-focus ml-auto text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--ink-soft)" }}>
          <RefreshCw size={12} /> {loading ? "Checking..." : "Recheck"}
        </button>
      </div>

      {/* Sticky one-line health summary — small on purpose, it should be
          glanceable rather than another dashboard to read. */}
      <div style={{ position: "sticky", top: 62, zIndex: 5 }} className="mb-3">
        <div className="rounded-xl px-3 py-2 flex items-center gap-3 flex-wrap"
          style={{
            background: summary.failing ? "var(--red-soft)" : summary.stale ? "var(--amber-soft)" : "var(--surface)",
            border: `1px solid ${summary.failing ? "var(--red)" : summary.stale ? "var(--amber)" : "var(--border)"}`,
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}>
          <span style={{
            width: 8, height: 8, borderRadius: 99, flexShrink: 0,
            background: summary.failing ? "var(--red)" : summary.stale ? "var(--amber)" : "var(--green)",
          }} />
          <span className="text-xs font-semibold" style={{ color: "var(--ink)" }}>
            {loading ? "Checking sources…"
              : summary.failing ? `${summary.failing} source${summary.failing > 1 ? "s" : ""} unreachable`
              : summary.stale ? `${summary.stale} source${summary.stale > 1 ? "s" : ""} behind schedule`
              : "All sources reporting"}
          </span>
          <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
            {summary.checked}/{DATA_SOURCES.length} checked · {summary.totalRows.toLocaleString()} rows total
          </span>
          <span className="text-xs ml-auto sw-mono" style={{ color: "var(--ink-faint)" }}>
            {DATA_SOURCES.filter((s) => rows[s.key]?.ok && s.freshField).map((s) => {
              const m = ageOf(rows[s.key].newest);
              return (
                <span key={s.key} style={{ marginLeft: 10, color: ageTone(m, s.cadence) }}>
                  {s.label.split(" ")[0]} {ageLabel(m)}
                </span>
              );
            })}
          </span>
        </div>
      </div>

      {err && (
        <div className="rounded-xl p-3 mb-3 text-xs" style={{ background: "var(--red-soft)", color: "var(--ink)" }}>{err}</div>
      )}

      <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)" }}>
                {["Table", "Where it comes from", "How often", "Rows", "Last update"].map((h, i) => (
                  <th key={i} className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide ${i >= 3 ? "text-right" : "text-left"}`}
                    style={{ color: "var(--ink-soft)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DATA_SOURCES.map((s) => {
                const r = rows[s.key];
                const mins = r?.ok ? ageOf(r.newest) : null;
                const isOpen = openKey === s.key;
                const sm = sample[s.key] || {};
                return (
                  <React.Fragment key={s.key}>
                  <tr style={{ borderTop: "1px solid var(--border)", background: isOpen ? "var(--surface-alt)" : "transparent", cursor: "pointer" }}
                    onClick={() => toggleOpen(s)}>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <ChevronDown size={12} style={{ color: "var(--ink-faint)", flexShrink: 0, transform: isOpen ? "rotate(0)" : "rotate(-90deg)", transition: "transform .15s" }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{s.label}</div>
                          <div className="sw-mono" style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>{s.table}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5" style={{ maxWidth: 300 }}>
                      <div className="text-xs" style={{ color: "var(--ink-soft)" }}>{s.source}</div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--ink-faint)", lineHeight: 1.4 }}>{s.note}</div>
                    </td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: "var(--ink-soft)", whiteSpace: "nowrap" }}>{s.cadence}</td>
                    <td className="px-3 py-2.5 sw-mono text-xs text-right" style={{ fontWeight: 600 }}>
                      {r ? (r.ok ? (r.count ?? 0).toLocaleString() : "—") : "…"}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-right" style={{ whiteSpace: "nowrap" }}>
                      {!r ? <span style={{ color: "var(--ink-faint)" }}>checking…</span>
                        : !r.ok ? <span style={{ color: "var(--red)", fontWeight: 600 }} title={r.error}>unreachable</span>
                        : !s.freshField ? <span style={{ color: "var(--ink-faint)" }}>n/a</span>
                        : <span className="sw-mono" style={{ color: ageTone(mins, s.cadence), fontWeight: 600 }}>{ageLabel(mins)}</span>}
                    </td>
                  </tr>

                  {isOpen && (
                    <tr style={{ background: "var(--surface-alt)" }}>
                      <td colSpan={5} className="px-3 pb-3" style={{ borderTop: "none" }}>
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-xs font-semibold uppercase" style={{ color: "var(--ink-faint)", letterSpacing: "0.04em" }}>
                            Raw rows
                          </span>
                          <select className="sw-input sw-focus" style={{ width: 108, height: 26, fontSize: 11.5 }}
                            value={limit}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => { const n = parseInt(e.target.value, 10); setLimit(n); loadSample(s, n); }}>
                            {[50, 200, 500, 1000].map((n) => <option key={n} value={n}>Show {n}</option>)}
                          </select>
                          <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
                            {sm.loading ? "loading…" : `${(sm.rows || []).length} shown of ${(r?.count ?? 0).toLocaleString()}`}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); exportCsv(s); }}
                            disabled={sm.exporting}
                            className="sw-focus ml-auto text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                            style={{ background: "var(--primary)", color: "#fff" }}>
                            <FileText size={12} /> {sm.exporting ? "Exporting…" : "Export as CSV"}
                          </button>
                        </div>

                        {sm.error && (
                          <div className="rounded-lg p-2 mb-2 text-xs" style={{ background: "var(--red-soft)", color: "var(--ink)" }}>{sm.error}</div>
                        )}

                        {(sm.rawKeys || []).length > 0 && (
                          <div className="rounded-lg p-2.5 mb-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                            <div className="text-xs font-semibold uppercase mb-1.5" style={{ color: "var(--ink-faint)", letterSpacing: "0.04em" }}>
                              Columns arriving from the source ({sm.rawKeys.length})
                            </div>
                            <div className="flex items-center gap-1 flex-wrap">
                              {sm.rawKeys.map((k) => (
                                <span key={k} className="sw-mono rounded px-1.5 py-0.5"
                                  style={{ fontSize: 10.5, background: "var(--surface-alt)", color: "var(--ink-soft)" }}>{k}</span>
                              ))}
                            </div>
                            <div className="text-xs mt-1.5" style={{ color: "var(--ink-faint)" }}>
                              If a column you added upstream isn't here, the sync hasn't picked it up — check the label matches exactly.
                            </div>
                          </div>
                        )}

                        <div className="rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--border)", maxHeight: 420, overflow: "auto" }}>
                          {sm.loading ? (
                            <div className="text-xs text-center py-8" style={{ color: "var(--ink-faint)" }}>Loading rows…</div>
                          ) : (sm.rows || []).length === 0 ? (
                            <div className="text-xs text-center py-8" style={{ color: "var(--ink-faint)" }}>No rows.</div>
                          ) : (
                            <table className="text-xs" style={{ borderCollapse: "collapse", whiteSpace: "nowrap" }}>
                              <thead>
                                <tr style={{ background: "var(--surface-alt)", position: "sticky", top: 0 }}>
                                  {(sm.cols || []).map((c) => (
                                    <th key={c} className="px-2 py-1.5 text-left sw-mono"
                                      style={{ fontSize: 10.5, color: "var(--ink-soft)", borderBottom: "1px solid var(--border)", fontWeight: 600 }}>
                                      {c}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {(sm.rows || []).map((row, ri) => (
                                  <tr key={ri} style={{ borderTop: "1px solid var(--border)" }}>
                                    {(sm.cols || []).map((c) => {
                                      const v = row[c];
                                      const str = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
                                      return (
                                        <td key={c} className="px-2 py-1 sw-mono"
                                          style={{ fontSize: 10.5, color: str === "" ? "var(--ink-faint)" : "var(--ink-soft)", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis" }}
                                          title={str}>
                                          {str === "" ? "—" : str.length > 60 ? str.slice(0, 60) + "…" : str}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                        <div className="text-xs mt-1.5" style={{ color: "var(--ink-faint)" }}>
                          The export sends the whole table, not just the rows on screen.
                          {s.rawField ? " Source columns are flattened out of the JSON blob and prefixed \"src:\", so each gets its own column." : ""}
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs mt-3" style={{ color: "var(--ink-faint)" }}>
        Row counts come from the database directly, so they reflect what the app can actually see —
        including anything row-level security is hiding. "Last update" reads the newest sync timestamp
        in each table: green means on schedule, amber means running late, red means something has stopped.
        A source showing as unreachable usually means its migration hasn't been run.
      </p>
    </div>
  );
}

function SettingsView({ statusRows, onSaveStatus, newCount,
                       coachScenarios, coachSettings, onSaveCoachScenario, onAddCoachScenario, onDeleteCoachScenario, onSaveCoachSettings,
                       coachStages, onSaveStage, onAddStage, onDeleteStage }) {
  const [section, setSection] = useState("statuses");
  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        {[
          { key: "statuses", label: "Order Statuses", icon: Palette, badge: newCount },
          { key: "coach", label: "Coach Setup", icon: Headphones, badge: 0 },
          { key: "developer", label: "Developer", icon: ShieldAlert, badge: 0 },
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
      {section === "statuses" && (
        <StatusSettingsView rows={statusRows} onSave={onSaveStatus} newCount={newCount} />
      )}
      {section === "coach" && (
        <CoachSettingsView scenarios={coachScenarios} settings={coachSettings} stages={coachStages}
          onSaveStage={onSaveStage} onAddStage={onAddStage} onDeleteStage={onDeleteStage}
          onSaveScenario={onSaveCoachScenario} onAddScenario={onAddCoachScenario}
          onDeleteScenario={onDeleteCoachScenario} onSaveSettings={onSaveCoachSettings} />
      )}
      {section === "developer" && <DeveloperView />}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  ADMIN — office-only: manage staff records, roles, teams                */
/* ---------------------------------------------------------------------- */

const ROLE_OPTIONS = ["office", "2ic", "agent", "sd", "sd_2ic"];
const ROLE_LABELS = { office: "Office", "2ic": "2IC", agent: "Agent", sd: "Sales Delivery", sd_2ic: "Sales Delivery 2IC" };

function StaffDetailForm({ s, profileForStaff, onSaveStaff, onSaveProfile, onResetPassword, onSetActive, plans,
                          planHistory, onAssignPlan, onDeleteAssignment }) {
  const [assigning, setAssigning] = useState(false);
  const [newPlan, setNewPlan] = useState("");
  const [newFrom, setNewFrom] = useState(new Date().toISOString().slice(0, 10));
  const myHistory = useMemo(
    () => (planHistory || []).filter((h) => h.staff_id === s.id)
      .sort((a, b) => String(b.effective_from).localeCompare(String(a.effective_from))),
    [planHistory, s.id]
  );
  const [f, setF] = useState({
    full_name: s.full_name || "", alt_name: s.alt_name || "", uin: s.uin || "", email: s.email || "",
    team: s.team || "", sells: !!s.sells, pay_plan_id: s.pay_plan_id || "",
  });
  const [roleEdit, setRoleEdit] = useState(profileForStaff?.role || "");
  const [teamEdit, setTeamEdit] = useState(profileForStaff?.team || s.team || "");
  const [savingStaff, setSavingStaff] = useState(false);
  const [savingRole, setSavingRole] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [saved, setSaved] = useState("");

  const staffDirty = Object.keys(f).some((k) => String(f[k]) !== String(s[k] ?? (k === "sells" ? true : "")));
  const roleDirty = profileForStaff && (roleEdit !== profileForStaff.role || teamEdit !== (profileForStaff.team || ""));
  const flash = (m) => { setSaved(m); setTimeout(() => setSaved(""), 1800); };

  const Row = ({ label, children }) => (
    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "0.75rem", alignItems: "center" }} className="py-2">
      <label className="text-xs" style={{ color: "var(--ink-faint)" }}>{label}</label>
      {children}
    </div>
  );

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div>
          <div className="text-sm font-semibold">{s.full_name}</div>
          {s.active === false && <div className="text-xs" style={{ color: "var(--amber)" }}>Ex employee — login locked</div>}
        </div>
        <button onClick={() => onSetActive(s.id, s.active === false, s.full_name)}
          className="sw-focus text-xs font-semibold px-3 py-1.5 rounded-lg"
          style={s.active === false
            ? { background: "var(--green-soft)", color: "var(--green)", border: "1px solid var(--green)" }
            : { background: "var(--surface-alt)", color: "var(--ink-soft)", border: "1px solid var(--border)" }}>
          {s.active === false ? "Reinstate" : "Mark leaver"}
        </button>
      </div>

      <div className="px-4 py-2" style={{ divide: "y" }}>
        <Row label="Full name">
          <input className="sw-input sw-focus" value={f.full_name} onChange={(e) => setF((p) => ({ ...p, full_name: e.target.value }))} />
        </Row>
        <Row label="Also known as">
          <input className="sw-input sw-focus" value={f.alt_name} onChange={(e) => setF((p) => ({ ...p, alt_name: e.target.value }))}
            placeholder="if NetSuite spells it differently" />
        </Row>
        <Row label="Team">
          <input className="sw-input sw-focus" value={f.team} onChange={(e) => setF((p) => ({ ...p, team: e.target.value }))} list="team-suggestions" />
        </Row>
        <Row label="UIN">
          <input className="sw-input sw-focus" value={f.uin} onChange={(e) => setF((p) => ({ ...p, uin: e.target.value }))} />
        </Row>
        <Row label="Email">
          <input className="sw-input sw-focus" value={f.email} onChange={(e) => setF((p) => ({ ...p, email: e.target.value }))} />
        </Row>
        <Row label="Pay plan">
          <select className="sw-input sw-focus" value={f.pay_plan_id || ""} onChange={(e) => setF((p) => ({ ...p, pay_plan_id: e.target.value }))}>
            <option value="">No plan</option>
            {(plans || []).filter((p) => p.active !== false).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Row>
        <Row label="Sells">
          <label className="flex items-center gap-2 text-xs" style={{ color: "var(--ink-soft)" }}>
            <input type="checkbox" checked={f.sells} onChange={(e) => setF((p) => ({ ...p, sells: e.target.checked }))} />
            Appears in Closer / Lead Gen pickers
          </label>
        </Row>
      </div>

      <div className="flex items-center gap-2 px-4 py-3" style={{ borderTop: "1px solid var(--border)", background: "var(--surface-alt)" }}>
        <button disabled={!staffDirty || savingStaff}
          onClick={async () => { setSavingStaff(true); await onSaveStaff(s.id, { ...f, pay_plan_id: f.pay_plan_id || null }); setSavingStaff(false); flash("Saved"); }}
          className="sw-focus text-xs font-semibold px-3 py-1.5 rounded-lg"
          style={{ background: staffDirty ? "var(--primary)" : "var(--surface)", color: staffDirty ? "#fff" : "var(--ink-faint)", border: "1px solid var(--border)" }}>
          {savingStaff ? "Saving..." : "Save details"}
        </button>
        {saved && <span className="text-xs" style={{ color: "var(--green)" }}>{saved}</span>}
      </div>

      {/* What they've been on, and when */}
      <div className="px-4 py-3" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium uppercase" style={{ color: "var(--ink-faint)", letterSpacing: "0.04em" }}>Pay plan history</span>
          <button onClick={() => setAssigning((v) => !v)} className="sw-focus text-xs font-semibold" style={{ color: "var(--primary)" }}>
            {assigning ? "Cancel" : "+ Change plan"}
          </button>
        </div>

        {assigning && (
          <div className="flex items-end gap-2 mb-2 flex-wrap">
            <select className="sw-input sw-focus" style={{ width: 220 }} value={newPlan} onChange={(e) => setNewPlan(e.target.value)}>
              <option value="">No plan</option>
              {(plans || []).filter((p) => p.active !== false).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="date" className="sw-input sw-focus" style={{ width: 150 }} value={newFrom} onChange={(e) => setNewFrom(e.target.value)} />
            <button disabled={!newFrom}
              onClick={async () => { await onAssignPlan(s.id, newPlan || null, newFrom); setAssigning(false); }}
              className="sw-focus text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: newFrom ? "var(--primary)" : "var(--surface-alt)", color: newFrom ? "#fff" : "var(--ink-faint)" }}>
              Apply from this date
            </button>
          </div>
        )}

        {myHistory.length === 0 ? (
          <div className="text-xs" style={{ color: "var(--ink-faint)" }}>
            No plan history. Assigning one above starts the record — figures still work without a plan, they just
            won't be measured against a target.
          </div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {myHistory.map((h) => {
                const p = (plans || []).find((x) => x.id === h.pay_plan_id);
                return (
                  <tr key={h.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td className="py-1.5 text-xs font-medium">{p ? p.name : "No plan"}</td>
                    <td className="py-1.5 text-xs" style={{ color: "var(--ink-faint)" }}>
                      {fmtDate(h.effective_from)} → {h.effective_to ? fmtDate(h.effective_to) : "current"}
                    </td>
                    <td className="py-1.5 text-right">
                      <button onClick={() => onDeleteAssignment(h.id)} className="sw-focus text-xs" style={{ color: "var(--red)" }}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Role + password — only meaningful once they've signed in at least once */}
      <div className="px-4 py-3" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="text-xs font-medium uppercase mb-2" style={{ color: "var(--ink-faint)", letterSpacing: "0.04em" }}>Access</div>
        {profileForStaff ? (
          <div className="flex items-center gap-2 flex-wrap">
            <select className="sw-input sw-focus" style={{ width: 120 }} value={roleEdit} onChange={(e) => setRoleEdit(e.target.value)}>
              {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <button disabled={!roleDirty || savingRole}
              onClick={async () => { setSavingRole(true); await onSaveProfile(profileForStaff.id, { role: roleEdit, team: teamEdit }); setSavingRole(false); flash("Role saved"); }}
              className="sw-focus text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: roleDirty ? "var(--green)" : "var(--surface-alt)", color: roleDirty ? "#fff" : "var(--ink-faint)" }}>
              {savingRole ? "..." : "Save role"}
            </button>

            <span style={{ width: 1, height: 20, background: "var(--border)" }} />

            {s.email && (
              resetting ? (
                <>
                  <input className="sw-input sw-focus" style={{ width: 140 }} placeholder="New password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoFocus />
                  <button disabled={newPw.length < 8 || savingPw}
                    onClick={async () => { setSavingPw(true); const ok = await onResetPassword(s.email, newPw); setSavingPw(false); if (ok) { setResetting(false); setNewPw(""); flash("Password set"); } }}
                    className="sw-focus text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={{ background: newPw.length >= 8 ? "var(--primary)" : "var(--surface)", color: newPw.length >= 8 ? "#fff" : "var(--ink-faint)" }}>
                    Set
                  </button>
                  <button onClick={() => { setResetting(false); setNewPw(""); }} className="sw-focus text-xs" style={{ color: "var(--ink-faint)" }}>Cancel</button>
                </>
              ) : (
                <button onClick={() => { setResetting(true); setNewPw("Welcome2026"); }}
                  className="sw-focus text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1"
                  style={{ background: "var(--surface)", color: "var(--ink-soft)", border: "1px solid var(--border)" }}>
                  <KeyRound size={11} /> Reset password
                </button>
              )
            )}
          </div>
        ) : (
          <div className="text-xs" style={{ color: "var(--ink-faint)" }}>Not signed in yet — role and password appear here after their first login.</div>
        )}
      </div>
    </div>
  );
}

function AddStaffForm({ onAdd, onCancel }) {
  const [f, setF] = useState({ full_name: "", alt_name: "", uin: "", email: "", team: "", sells: true, active: true });
  const [saving, setSaving] = useState(false);
  const canAdd = f.full_name.trim().length > 0;

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--primary)" }}>
      <div className="px-4 py-3 text-sm font-semibold" style={{ borderBottom: "1px solid var(--border)" }}>New staff member</div>
      <div className="px-4 py-2">
        {[
          ["Full name", "full_name"], ["Also known as", "alt_name"], ["Team", "team"],
          ["UIN", "uin"], ["Email", "email"],
        ].map(([label, key]) => (
          <div key={key} style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "0.75rem", alignItems: "center" }} className="py-2">
            <label className="text-xs" style={{ color: "var(--ink-faint)" }}>{label}</label>
            <input className="sw-input sw-focus" value={f[key]} onChange={(e) => setF((p) => ({ ...p, [key]: e.target.value }))}
              list={key === "team" ? "team-suggestions" : undefined} />
          </div>
        ))}
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "0.75rem", alignItems: "center" }} className="py-2">
          <label className="text-xs" style={{ color: "var(--ink-faint)" }}>Sells</label>
          <input type="checkbox" checked={f.sells} onChange={(e) => setF((p) => ({ ...p, sells: e.target.checked }))} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "0.75rem", alignItems: "center" }} className="py-2">
          <label className="text-xs" style={{ color: "var(--ink-faint)" }}>Ex employee</label>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: f.active ? "var(--ink-soft)" : "var(--amber)" }}>
            <input type="checkbox" checked={!f.active} onChange={(e) => setF((p) => ({ ...p, active: !e.target.checked }))} />
            Adding someone who's already left — name and team is enough
          </label>
        </div>
      </div>
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderTop: "1px solid var(--border)", background: "var(--surface-alt)" }}>
        <button onClick={onCancel} className="sw-focus text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--ink-soft)" }}>Cancel</button>
        <button disabled={!canAdd || saving}
          onClick={async () => { setSaving(true); await onAdd(f); setSaving(false); }}
          className="sw-focus text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1"
          style={{ background: canAdd ? "var(--primary)" : "var(--surface)", color: canAdd ? "#fff" : "var(--ink-faint)" }}>
          <Plus size={12} /> {saving ? "Adding..." : "Add staff"}
        </button>
      </div>
    </div>
  );
}

/* Staff who aren't fully set up yet, and NetSuite names nothing matches.
   Both are silent problems — figures quietly land nowhere. */
function AdminIssues({ staff, netsuite, aliases, onAddAlias, onDeleteAlias, plans }) {
  const [newAlias, setNewAlias] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [tab, setTab] = useState("staff");
  const [open, setOpen] = useState(false);   // collapsed by default

  const issues = useMemo(() => (staff || []).filter((s) => s.active !== false).map((s) => {
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
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: open ? "1px solid var(--border)" : "none" }}>
        <button onClick={() => setOpen((v) => !v)} className="sw-focus flex items-center gap-2 flex-1 text-left">
          <ChevronDown size={13} style={{ color: "var(--ink-faint)", transform: open ? "rotate(0)" : "rotate(-90deg)", transition: "transform .15s" }} />
          <AlertTriangle size={14} style={{ color: unmatched.length || issues.length ? "var(--amber)" : "var(--green)" }} />
          <span className="text-sm font-semibold">Needs attention</span>
          <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
            {issues.length + unmatched.length === 0 ? "all clear" : `${issues.length + unmatched.length} to review`}
          </span>
        </button>
        {open && (
          <div className="flex items-center gap-1.5">
            {[["staff", `Setup (${issues.length})`], ["names", `Unmatched names (${unmatched.length})`]].map(([k, lbl]) => (
              <button key={k} onClick={() => setTab(k)} className="sw-focus px-3 py-1.5 rounded-full text-xs font-semibold"
                style={tab === k ? { background: "var(--primary)", color: "#fff" } : { background: "var(--surface-alt)", color: "var(--ink-soft)" }}>
                {lbl}
              </button>
            ))}
          </div>
        )}
      </div>

      {open && tab === "staff" && (
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

      {open && tab === "names" && (
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
                    netsuite, aliases, onAddAlias, onDeleteAlias, planHistory, onAssignPlan, onDeleteAssignment,
                    planTiers, planMetrics, planTablesMissing, planError,
                    onSavePlan, onAddPlan, onDeletePlan, onSaveTier, onAddTier, onDeleteTier, onAddMetric, onDeleteMetric }) {
  const teamOptions = useMemo(() => Array.from(new Set(staff.map((s) => s.team).filter(Boolean))), [staff]);
  const profileByUserId = useMemo(() => {
    const m = {};
    for (const p of profiles) m[p.id] = p;
    return m;
  }, [profiles]);

  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [openForecast, setOpenForecast] = useState(null);
  // Forecast figures vs what NetSuite actually statted, and a filter to
  // only the deals that have landed.
  const [valueMode, setValueMode] = useState("forecast");   // forecast | statted
  const [soldOnly, setSoldOnly] = useState(false);

  const sorted = useMemo(
    () => [...staff].sort((a, b) => (a.active === false) - (b.active === false) || String(a.full_name).localeCompare(String(b.full_name))),
    [staff]
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((s) => String(s.full_name).toLowerCase().includes(q) || String(s.team || "").toLowerCase().includes(q));
  }, [sorted, query]);

  const selected = staff.find((s) => s.id === selectedId) || null;

  return (
    <div>
      <datalist id="team-suggestions">{teamOptions.map((t) => <option key={t} value={t} />)}</datalist>
      <div className="flex items-center gap-2 mb-4">
        <Users size={18} style={{ color: "var(--primary)" }} />
        <h2 className="sw-display text-lg" style={{ fontWeight: 600 }}>Staff & Roles</h2>
        <span className="text-xs" style={{ color: "var(--ink-faint)" }}>Office only · changes take effect immediately</span>
      </div>

      <AdminIssues staff={staff} netsuite={netsuite} aliases={aliases}
        onAddAlias={onAddAlias} onDeleteAlias={onDeleteAlias} plans={plans} />

      {/* Two big columns: agents on the left, pay plans on the right — set
          up once, in one place, rather than hopping between pages. */}
      <div className="sw-cols" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.15fr) minmax(0, 1fr)", gap: "1rem", alignItems: "start" }}>

      <div>
      <div className="sw-cols" style={{ display: "grid", gridTemplateColumns: "240px minmax(0, 1fr)", gap: "0.75rem", alignItems: "start" }}>

        {/* LIST */}
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="p-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-faint)" }} />
              <input className="sw-input sw-focus" style={{ paddingLeft: 26, height: 32, fontSize: 12.5 }}
                placeholder="Search staff..." value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>
          <div style={{ maxHeight: "calc(100vh - 320px)", overflowY: "auto" }}>
            {filtered.map((s) => {
              const sel = s.id === selectedId;
              return (
                <button key={s.id} onClick={() => { setSelectedId(s.id); setAdding(false); }}
                  className="sw-focus w-full text-left px-3 py-2"
                  style={{ background: sel ? "var(--primary-soft)" : "transparent", borderBottom: "1px solid var(--border)", opacity: s.active === false ? 0.55 : 1 }}>
                  <div className="text-xs truncate" style={{ color: sel ? "var(--primary)" : "var(--ink)", fontWeight: sel ? 600 : 500 }}>
                    {s.full_name}{s.active === false && <span style={{ color: "var(--ink-faint)", fontWeight: 400 }}> · ex</span>}
                  </div>
                  <div className="text-xs truncate" style={{ color: "var(--ink-faint)", fontSize: 10.5 }}>{s.team || "No team"}</div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-xs text-center py-8" style={{ color: "var(--ink-faint)" }}>No matches.</div>
            )}
          </div>
          <button onClick={() => { setAdding(true); setSelectedId(null); }}
            className="sw-focus w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold"
            style={{ color: "var(--primary)", borderTop: "1px solid var(--border)" }}>
            <Plus size={13} /> Add staff
          </button>
        </div>

        {/* DETAIL */}
        <div>
          {adding && <AddStaffForm onAdd={async (f) => { await onAddStaff(f); setAdding(false); }} onCancel={() => setAdding(false)} />}
          {!adding && selected && (
            <StaffDetailForm key={selected.id} s={selected}
              profileForStaff={selected.user_id ? profileByUserId[selected.user_id] : null}
              onSaveStaff={onSaveStaff} onSaveProfile={onSaveProfile}
              onResetPassword={onResetPassword} onSetActive={onSetActive} plans={plans}
              planHistory={planHistory} onAssignPlan={onAssignPlan} onDeleteAssignment={onDeleteAssignment} />
          )}
          {!adding && !selected && (
            <div className="rounded-xl p-10 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="text-sm" style={{ color: "var(--ink-faint)" }}>Select someone from the list to edit their details.</div>
            </div>
          )}
        </div>
      </div>

      <p className="text-xs mt-3" style={{ color: "var(--ink-faint)" }}>
        Adding someone creates their staff record so they're ready to go. Their role dropdown appears once
        they've logged in for the first time — that's when their account links up automatically.
      </p>
      </div>

      <PayPlansView plans={plans} staff={staff}
        tiers={planTiers} metrics={planMetrics}
        tablesMissing={planTablesMissing} error={planError}
        onSave={onSavePlan} onAdd={onAddPlan} onDelete={onDeletePlan}
        onSaveTier={onSaveTier} onAddTier={onAddTier} onDeleteTier={onDeleteTier}
        onAddMetric={onAddMetric} onDeleteMetric={onDeleteMetric}
        onAssignPlan={onAssignPlan} />
      </div>
    </div>
  );
}

/* Browser speech recognition has no domain vocabulary, so BT product names
   come back mangled and the coach then responds to nonsense. These fix the
   mishearings that actually occur; order matters, longest first. */
const SPEECH_FIXES = [
  [/\bb\.?\s?t\.?\s?net\b/gi, "BT Net"],
  [/\bbeat[ie]e?\s?net\b/gi, "BT Net"],
  [/\bbtnet\b/gi, "BT Net"],
  [/\bd\.?\s?v\.?\s?(four|4)\s?b?\b/gi, "DV4"],
  [/\bdee\s?vee\s?(four|4)\b/gi, "DV4"],
  [/\bdigital\s?voice\b/gi, "Digital Voice"],
  [/\bcloud\s?voice\b/gi, "Cloud Voice"],
  [/\bopen\s?reach\b/gi, "Openreach"],
  [/\bf\.?\s?t\.?\s?t\.?\s?p\b/gi, "FTTP"],
  [/\bfibre\s?to\s?the\s?premises\b/gi, "FTTP"],
  [/\be\.?\s?e\.?\b/g, "EE"],
  [/\bs\.?\s?i\.?\s?m\b/gi, "SIM"],
  [/\bbroad\s?band\b/gi, "broadband"],
  [/\bp\.?\s?s\.?\s?t\.?\s?n\b/gi, "PSTN"],
  [/\bbad\s?r\b/gi, "BADR"],
  [/\bb\.?\s?l\.?\s?b\.?\b/gi, "BT Local Business"],
];

function tidyTranscript(text) {
  let out = String(text || "");
  for (const [re, to] of SPEECH_FIXES) out = out.replace(re, to);
  return out.replace(/\s+/g, " ").trim();
}

/* Pick the alternative that mentions the most known terms — the top result
   isn't always the one that got the product names right. */
function bestAlternative(result) {
  const known = /(BT Net|DV4|Digital Voice|Cloud Voice|Openreach|FTTP|EE|SIM|broadband|PSTN|BADR|mobile|contract)/gi;
  let best = result[0]?.transcript || "";
  let bestScore = (tidyTranscript(best).match(known) || []).length;
  for (let i = 1; i < result.length; i++) {
    const t = result[i]?.transcript || "";
    const score = (tidyTranscript(t).match(known) || []).length;
    if (score > bestScore) { best = t; bestScore = score; }
  }
  return best;
}

/* ---------------------------------------------------------------------- */
/*  VOICE SELECTION                                                        */
/* ---------------------------------------------------------------------- */

/* Browser voices vary wildly. The flat, robotic ones are the offline
   system voices; the network ones (Google, Microsoft "Natural"/"Online")
   are markedly better. Voices carry no gender flag, so it comes from the
   name — imperfect, but the well-known ones cover most installs. */
const FEMALE_NAMES = /\b(zira|hazel|susan|samantha|karen|serena|fiona|moira|tessa|libby|sonia|aria|jenny|michelle|ana|amelie|catherine|linda|heather|female|woman)\b/i;
const MALE_NAMES   = /\b(david|george|mark|daniel|alex|oliver|ryan|guy|brandon|christopher|eric|roger|thomas|james|william|male|man)\b/i;

function voiceGender(v) {
  const n = String(v.name || "");
  if (FEMALE_NAMES.test(n)) return "female";
  if (MALE_NAMES.test(n)) return "male";
  return null;
}

// Higher is better. Network voices and the "Natural" family sound most human.
function voiceQuality(v) {
  const n = String(v.name || "").toLowerCase();
  let score = 0;
  if (v.localService === false) score += 40;      // network voice
  if (/natural|neural/.test(n)) score += 30;
  if (/google/.test(n)) score += 25;
  if (/online/.test(n)) score += 10;
  if (/^en-GB/i.test(v.lang)) score += 15;        // right accent for the patch
  else if (/^en/i.test(v.lang)) score += 5;
  if (/compact|espeak/.test(n)) score -= 30;      // the really robotic ones
  return score;
}

/* Pick at random, but only from the better half of what's installed, and
   honour a preferred gender so the customer isn't always the same person.
   Returns null when nothing usable is available. */
function pickRandomVoice(voices, preferGender) {
  const english = (voices || []).filter((v) => /^en/i.test(v.lang));
  if (!english.length) return null;

  const ranked = [...english].sort((a, b) => voiceQuality(b) - voiceQuality(a));
  const pool = ranked.slice(0, Math.max(3, Math.ceil(ranked.length / 2)));

  const wanted = pool.filter((v) => voiceGender(v) === preferGender);
  const from = wanted.length ? wanted : pool;
  return from[Math.floor(Math.random() * from.length)];
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

// Plain-English meaning of each grade, shown as a legend on the call review
// so the badges aren't just colours.
const SCORE_LEGEND = {
  brilliant:  "Changed the call — rare",
  excellent:  "Strong technique, well executed",
  good:       "Competent and appropriate — the norm",
  inaccuracy: "Small misstep, easily recovered",
  mistake:    "Poor technique with a real cost",
  blunder:    "Serious error that could lose the deal",
};

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
  // Where the call has got to. The Edge Function decides when to advance;
  // this just follows it so the agent can see progress.
  const [stageIndex, setStageIndex] = useState(0);
  const [stageList, setStageList] = useState([]);
  const [stageNote, setStageNote] = useState("");
  const [coachingNote, setCoachingNote] = useState("");
  const [difficulty, setDifficulty] = useState("normal"); // easy | normal | hard
  const [bonusesHit, setBonusesHit] = useState([]);
  const [typed, setTyped] = useState("");
  const [history, setHistory] = useState([]);
  const [openSession, setOpenSession] = useState(null);
  const [rolling, setRolling] = useState(false);   // rollback in progress
  const [listening, setListening] = useState(false);
  const [micNote, setMicNote] = useState("");
  const [scenarios, setScenarios] = useState([]);
  const [coachCfg, setCoachCfg] = useState({ rubric: "", what_good_looks_like: "", feedback_guidance: "" });

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

  // A scenario carries a default difficulty — adopt it when one is picked,
  // but only outside a live call so it can't shift mid-conversation.
  useEffect(() => {
    if (status !== "idle") return;
    if (activeScenario?.difficulty) setDifficulty(activeScenario.difficulty);
  }, [activeScenario, status]);

  const loadHistory = useCallback(async () => {
    const { data } = await supabase
      .from("coach_sessions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(40);
    setHistory(data || []);
  }, []);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Best calls first — a leaderboard is more useful than reverse-chronological
  // when the point is learning from what went well. Interrupted calls sort
  // below finished ones at the same score, being less instructive.
  const rankedHistory = useMemo(() => {
    return [...(history || [])].sort((a, b) => {
      const pa = a.points ?? 0, pb = b.points ?? 0;
      if (pb !== pa) return pb - pa;
      if (!!a.interrupted !== !!b.interrupted) return a.interrupted ? 1 : -1;
      return String(b.created_at).localeCompare(String(a.created_at));
    });
  }, [history]);

  const selectedSession = useMemo(
    () => (history || []).find((h) => h.id === openSession) || null,
    [history, openSession]
  );

  const recogRef = useRef(null);
  const scrollRef = useRef(null);
  const turnsRef = useRef([]);
  useEffect(() => { turnsRef.current = turns; }, [turns]);
  const stageIdxRef = useRef(0);
  useEffect(() => { stageIdxRef.current = stageIndex; }, [stageIndex]);
  const stageNoteRef = useRef("");
  useEffect(() => { stageNoteRef.current = stageNote; }, [stageNote]);
  const bonusesRef = useRef([]);
  useEffect(() => { bonusesRef.current = bonusesHit; }, [bonusesHit]);
  const undoRef = useRef(null);

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
        feedbackGuidance: coachCfg.feedback_guidance || null,
        stageIndex: stageIdxRef.current,
        difficulty,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Coach unavailable (${res.status}). ${t.slice(0, 160)}`);
    }
    return res.json();
  }, [scenario, activeScenario, coachCfg, difficulty]);

  // Speech synthesis has two traps: getVoices() is populated asynchronously
  // in Chrome, so the first call can find nothing and silently do nothing;
  // and audio needs a user gesture to unlock. Both are handled here.
  const [voices, setVoices] = useState([]);
  const [speaking, setSpeaking] = useState(false);
  // The voice for this call — chosen fresh each time so the customer isn't
  // always the same person. Pitch and rate are nudged per call too, which
  // does more for realism than the voice choice alone.
  const voiceRef = useRef(null);
  const [voiceLabel, setVoiceLabel] = useState("");
  const proseRef = useRef({ rate: 1.0, pitch: 1.0 });

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const load = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length) setVoices(v);
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  // Roll a new customer voice. Called at the start of every session.
  const rollVoice = useCallback(() => {
    const list = (typeof window !== "undefined" && window.speechSynthesis)
      ? (voices.length ? voices : window.speechSynthesis.getVoices())
      : [];
    const gender = Math.random() < 0.5 ? "female" : "male";
    const v = pickRandomVoice(list, gender);
    voiceRef.current = v || null;
    // Small variation so two calls with the same voice still differ
    proseRef.current = {
      rate: 0.95 + Math.random() * 0.2,    // 0.95 – 1.15
      pitch: 0.9 + Math.random() * 0.35,   // 0.90 – 1.25
    };
    setVoiceLabel(v ? `${v.name}` : "");
    return v;
  }, [voices]);

  const say = useCallback((text) => {
    if (!speakBack || typeof window === "undefined" || !window.speechSynthesis) return;
    if (!text) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text));
      const v = voiceRef.current;
      if (v) u.voice = v;
      u.lang = v?.lang || "en-GB";
      u.rate = proseRef.current.rate;
      u.pitch = proseRef.current.pitch;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      // Chrome occasionally leaves the queue paused after a cancel()
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      window.speechSynthesis.speak(u);
    } catch {
      setSpeaking(false);
    }
  }, [speakBack]);

  // Browsers block audio until the user has interacted. Speaking a silent
  // utterance on the first click unlocks it so the real reply is audible.
  const unlockSpeech = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    try {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      window.speechSynthesis.speak(u);
    } catch { /* nothing to do */ }
  }, []);

  // ---- submit one agent turn ----------------------------------------
  const submitTurn = useCallback(async (text, rawHeard) => {
    const clean = (text || "").trim();
    if (!clean) return;
    setError("");
    // Remember where we were, so "try that again" can put everything back —
    // the stage can advance on a turn and bonuses can be awarded, so
    // restoring the messages alone would leave those stuck forward.
    undoRef.current = {
      turns: turnsRef.current,
      stageIndex: stageIdxRef.current,
      stageNote: stageNoteRef.current,
      bonuses: bonusesRef.current,
      lastText: clean,
    };
    const withAgent = [...turnsRef.current, { role: "agent", text: clean, heard: rawHeard || null }];
    setTurns(withAgent);
    setInterim("");
    setStatus("thinking");
    try {
      const r = await callCoach("turn", withAgent.map(({ role, text }) => ({ role, text })));
      if (Array.isArray(r.stages) && r.stages.length) setStageList(r.stages);
      if (typeof r.stageIndex === "number") setStageIndex(r.stageIndex);
      setStageNote(r.stageNote || "");
      setCoachingNote(r.coachingNote || "");
      if (Array.isArray(r.bonuses) && r.bonuses.length) {
        setBonusesHit((prev) => {
          const seen = new Set(prev.map((b) => b.key));
          return [...prev, ...r.bonuses.filter((b) => !seen.has(b.key))];
        });
      }
      setTurns((prev) => {
        const copy = [...prev];
        // attach the score to the agent turn we just sent
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].role === "agent" && !copy[i].score) {
            copy[i] = { ...copy[i], score: r.score || "good", note: r.note || "", bonuses: r.bonuses || [] };
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
    r.maxAlternatives = 4;   // the top guess often mangles product names

    let buffer = "";
    let silence = null;

    r.onresult = (ev) => {
      let interimText = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        if (res.isFinal) buffer += bestAlternative(res) + " ";
        else interimText += res[0].transcript;
      }
      setInterim(buffer + interimText);
      // Send the turn after a pause, the way a real conversation hands over
      clearTimeout(silence);
      silence = setTimeout(() => {
        const raw = buffer.trim();
        const toSend = tidyTranscript(buffer);
        buffer = "";
        if (toSend) submitTurn(toSend, raw !== toSend ? raw : null);
      }, 1400);
    };
    r.onstart = () => { setListening(true); setMicNote(""); };
    r.onspeechstart = () => setMicNote("hearing you");
    r.onspeechend = () => setMicNote("");
    r.onerror = (ev) => {
      // "no-speech" and "aborted" fire constantly in normal use and aren't
      // worth surfacing; the rest are things the user can act on.
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        setListening(false);
        setError("Microphone blocked. Click the padlock in the address bar, allow the microphone, then reload.");
      } else if (ev.error === "audio-capture") {
        setListening(false);
        setError("No microphone found. Check it's plugged in and not in use by another app.");
      } else if (ev.error !== "no-speech" && ev.error !== "aborted") {
        setMicNote(`mic: ${ev.error}`);
      }
    };
    // Chrome stops recognition roughly every minute; restart unless muted.
    r.onend = () => {
      if (recogRef.current === r) {
        try { r.start(); } catch (_) { setListening(false); }
      } else {
        setListening(false);
      }
    };

    recogRef.current = r;
    try {
      r.start();
    } catch (_) {
      // start() throws if called while already running — harmless
      setListening(true);
    }
  }, [supported, submitTurn]);

  const stopListening = useCallback(() => {
    const r = recogRef.current;
    recogRef.current = null;
    if (r) { try { r.onend = null; r.stop(); } catch (_) {} }
    setInterim("");
    setListening(false);
    setMicNote("");
  }, []);

  useEffect(() => () => stopListening(), [stopListening]);

  // ---- call lifecycle ------------------------------------------------
  const startCall = useCallback(async () => {
    unlockSpeech();   // must happen inside the click for audio to be allowed
    rollVoice();      // a different customer each time
    setTurns([]); setSummary(null); setError(""); setInterim("");
    setStageIndex(0); stageIdxRef.current = 0; setStageNote(""); setCoachingNote(""); setBonusesHit([]);
    undoRef.current = null;
    setStatus("thinking");
    try {
      const r = await callCoach("turn", []);
      if (Array.isArray(r.stages) && r.stages.length) setStageList(r.stages);
      setTurns([{ role: "customer", text: r.customer || "Hello?" }]);
      say(r.customer);
      setStatus("live");
      startListening();
    } catch (e) {
      setError(e && e.message ? String(e.message) : String(e));
      setStatus("idle");
    }
  }, [callCoach, say, startListening, unlockSpeech, rollVoice]);

  /* Take back the last thing said and try it again. Restores the stage and
     any bonuses awarded on that turn, and drops both the agent's turn and
     the customer's reply to it. The text comes back in the box so it can be
     edited rather than retyped. One level of undo, not a full history. */
  const rollbackTurn = useCallback(() => {
    const snap = undoRef.current;
    if (!snap) return;
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    setRolling(true);
    setTurns(snap.turns);
    setStageIndex(snap.stageIndex);
    stageIdxRef.current = snap.stageIndex;
    setStageNote(snap.stageNote || "");
    setBonusesHit(snap.bonuses || []);
    setTyped(snap.lastText || "");
    setInterim("");
    setStatus("live");
    undoRef.current = null;
    setTimeout(() => setRolling(false), 400);
  }, []);

  /* Walk away mid-call. The transcript is still worth keeping — knowing
     someone bails at the objection stage repeatedly is a coaching signal —
     so it's saved and flagged as interrupted. No summary, since the call
     never finished. */
  const leaveCall = useCallback(async () => {
    stopListening();
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    const finalTurns = turnsRef.current;
    const agentTurns = finalTurns.filter((t) => t.role === "agent" && t.score);

    if (agentTurns.length > 0) {
      const tally = {};
      let pts = 0;
      agentTurns.forEach((t) => {
        tally[t.score] = (tally[t.score] || 0) + 1;
        pts += SCORE_POINTS[t.score] ?? 0;
      });
      try {
        const { data: sess } = await supabase.auth.getSession();
        await supabase.from("coach_sessions").insert({
          user_id: sess?.session?.user?.id || null,
          user_name: sess?.session?.user?.email || null,
          scenario,
          grade: null,
          headline: "Call left before finishing",
          strengths: [], improvements: [], moment: null,
          points: pts,
          turn_count: agentTurns.length,
          tally,
          stages_reached: stageList.slice(0, stageIndex + 1).map((s) => s.label),
          final_stage: stageList[stageIndex]?.label || null,
          completed: false,
          interrupted: true,
          bonuses: bonusesHit.map((b) => b.label),
          transcript: finalTurns,
        });
        loadHistory();
      } catch {
        // An abandoned practice call isn't worth blocking the exit for
      }
    }

    setStatus("idle");
    setTurns([]);
    setSummary(null);
    setInterim("");
    setTyped("");
    setStageIndex(0); stageIdxRef.current = 0;
    setStageNote(""); setCoachingNote(""); setBonusesHit([]);
    undoRef.current = null;
  }, [scenario, stageList, stageIndex, bonusesHit, stopListening, loadHistory]);

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
          // How far through the call they actually got
          stages_reached: stageList.slice(0, stageIndex + 1).map((s) => s.label),
          final_stage: stageList[stageIndex]?.label || null,
          bonuses: bonusesHit.map((b) => b.label),
          completed: stageList.length > 0 && stageIndex >= stageList.length - 1,
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
          {/* Difficulty leads the row as a narrower card — it's a setting
              rather than a choice of what to practise, so it shouldn't
              compete with the scenarios for width. */}
          <div style={{ display: "grid", gridTemplateColumns: "150px repeat(auto-fit, minmax(190px, 1fr))", gap: "0.6rem" }} className="mb-4">
            <div className="rounded-xl p-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              title={difficulty === "easy" ? "Open to the conversation and happy to answer."
                : difficulty === "hard" ? "Sceptical and short at first — you'll have to earn it."
                : "A normal busy business owner. Guarded, but civil and reasonable."}>
              <div className="text-xs font-medium uppercase mb-2" style={{ color: "var(--ink-faint)", letterSpacing: "0.04em" }}>Customer</div>
              <div className="flex flex-col rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                {[["easy", "Receptive"], ["normal", "Normal"], ["hard", "Tough"]].map(([k, lbl]) => (
                  <button key={k} onClick={() => setDifficulty(k)}
                    className="sw-focus px-2 py-1.5 text-xs"
                    style={difficulty === k
                      ? { background: "var(--primary)", color: "#fff", fontWeight: 600 }
                      : { background: "transparent", color: "var(--ink-faint)" }}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

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
      {(status === "live" || status === "thinking" || (status === "ended" && !summary)) && (
        <>
          {/* Where the call has got to. The customer decides when you've
              earned the next stage, so this is progress, not a menu. */}
          {stageList.length > 0 && (
            <div className="rounded-xl p-3 mb-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                {stageList.map((s, i) => {
                  const done = i < stageIndex;
                  const now = i === stageIndex;
                  return (
                    <React.Fragment key={s.key || i}>
                      {i > 0 && <div style={{ flex: 1, height: 2, minWidth: 10, background: done || now ? "var(--primary)" : "var(--border)" }} />}
                      <span className="text-xs px-2 py-1 rounded-full whitespace-nowrap"
                        style={now
                          ? { background: "var(--primary)", color: "#fff", fontWeight: 600 }
                          : done
                            ? { background: "var(--green-soft)", color: "var(--green)", fontWeight: 500 }
                            : { background: "var(--surface-alt)", color: "var(--ink-faint)" }}>
                        {done ? "✓ " : ""}{s.label}
                      </span>
                    </React.Fragment>
                  );
                })}
              </div>
              {coachingNote && (
                <div className="text-xs mb-1" style={{ color: "var(--primary)" }}>{coachingNote}</div>
              )}
              {stageNote && (
                <div className="text-xs" style={{ color: "var(--ink-soft)" }}>{stageNote}</div>
              )}
              {bonusesHit.length > 0 && (
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {bonusesHit.map((b) => (
                    <span key={b.key} className="text-xs font-semibold px-1.5 py-0.5 rounded"
                      style={{ background: "var(--green-soft)", color: "var(--green)" }}>★ {b.label}</span>
                  ))}
                </div>
              )}
            </div>
          )}

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
              <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: "var(--ink-soft)" }}
                title={voiceLabel ? `Voice: ${voiceLabel}` : "No speech voice available in this browser"}>
                <input type="checkbox" checked={speakBack} onChange={(e) => setSpeakBack(e.target.checked)} /> Customer speaks
                {speaking && (
                  <span style={{ display: "inline-flex", gap: 2, alignItems: "flex-end", height: 10, marginLeft: 2 }}>
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="sw-live-dot"
                        style={{ width: 2, height: 4 + i * 3, background: "var(--green)", borderRadius: 1, animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </span>
                )}
              </label>
              {speakBack && (
                <button onClick={() => { const v = rollVoice(); if (v) say("Hello, thanks for calling."); }}
                  className="sw-focus text-xs px-2 py-1 rounded-lg" style={{ color: "var(--ink-faint)", border: "1px solid var(--border)" }}
                  title={voiceLabel ? `Currently ${voiceLabel} — click for a different voice` : "Try a different voice"}>
                  Change voice
                </button>
              )}
              {status !== "ended" && undoRef.current && (
                <button onClick={rollbackTurn} disabled={rolling}
                  className="sw-focus text-xs px-2.5 py-1 rounded-lg flex items-center gap-1"
                  style={{ color: "var(--ink-soft)", border: "1px solid var(--border)" }}
                  title="Take back your last answer and try it again">
                  <History size={12} /> Try that again
                </button>
              )}
              {status !== "ended" && (
                <button onClick={() => leaveCall()}
                  className="sw-focus text-xs px-2.5 py-1 rounded-lg flex items-center gap-1"
                  style={{ color: "var(--ink-faint)", border: "1px solid var(--border)" }}
                  title="Leave without finishing — saved as an interrupted call">
                  <ArrowLeft size={12} /> Back
                </button>
              )}
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
                    {t.heard && (
                      <div className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}
                        title="What the microphone heard before product names were corrected">
                        heard: “{t.heard}”
                      </div>
                    )}
                    {t.score && (
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <ScoreBadge score={t.score} />
                        {t.note && <span className="text-xs" style={{ color: "var(--ink-soft)" }}>{t.note}</span>}
                        {(t.bonuses || []).map((b) => (
                          <span key={b.key} className="text-xs font-semibold px-1.5 py-0.5 rounded whitespace-nowrap"
                            style={{ background: "var(--green-soft)", color: "var(--green)" }}
                            title={`+${b.points} — a move we want to see`}>
                            ★ {b.label} +{b.points}
                          </span>
                        ))}
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
              {supported ? (
                listening
                  ? <button onClick={stopListening} className="sw-focus px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5"
                      style={{ background: "var(--green-soft)", border: "1px solid var(--green)", color: "var(--green)" }}>
                      <span style={{ width: 7, height: 7, borderRadius: 99, background: "var(--green)", display: "inline-block" }} />
                      {micNote || "Listening"} · Mute
                    </button>
                  : <button onClick={startListening} className="sw-focus px-3 py-2 rounded-lg text-sm font-semibold"
                      style={{ background: "var(--green)", color: "#fff" }}>Start mic</button>
              ) : (
                <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
                  Voice isn't supported in this browser — try Chrome or Edge
                </span>
              )}
            </div>
          )}
        </>
      )}

      {/* End of call review */}
      {summary && (
        <div>
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <button onClick={() => leaveCall()}
              className="sw-focus flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--ink-soft)" }}>
              <ArrowLeft size={14} /> Back to scenarios
            </button>
            <div className="sw-display font-bold text-3xl rounded-xl px-4 py-1"
              style={{ background: "var(--primary)", color: "#fff" }}>{summary.grade || "—"}</div>
            <div className="flex-1 min-w-0">
              <div className="sw-display font-bold text-base">Call review</div>
              <div className="text-sm" style={{ color: "var(--ink-soft)" }}>{summary.headline}</div>
            </div>
          </div>

          {scored.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mb-3">
              {Object.keys(SCORE_STYLE).filter((k) => tally[k]).map((k) => (
                <span key={k} className="text-xs font-semibold px-2 py-1 rounded-full"
                  style={{ background: SCORE_STYLE[k].bg, color: SCORE_STYLE[k].fg }}>
                  {tally[k]} × {SCORE_STYLE[k].label}
                </span>
              ))}
            </div>
          )}

          {/* Transcript on the left to read back through, advice and the
              scoring legend on the right to read it against. */}
          <div className="sw-cols" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "0.75rem", alignItems: "start" }}>

            <div className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="text-xs font-bold uppercase mb-2" style={{ color: "var(--ink-soft)" }}>Transcript</div>
              <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
                {turns.map((t, i) => (
                  <div key={i} className="flex items-start gap-2 mb-2.5">
                    <span className="text-xs font-bold shrink-0 px-1.5 py-0.5 rounded"
                      style={t.role === "agent"
                        ? { background: "var(--primary-soft)", color: "var(--primary)" }
                        : { background: "var(--surface-alt)", color: "var(--ink-soft)" }}>
                      {t.role === "agent" ? "YOU" : "THEM"}
                    </span>
                    <div className="flex-1">
                      <div className="text-sm">{t.text}</div>
                      {t.score && (
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <ScoreBadge score={t.score} />
                          {t.note && <span className="text-xs" style={{ color: "var(--ink-soft)" }}>{t.note}</span>}
                          {(t.bonuses || []).map((b) => (
                            <span key={b.key} className="text-xs font-semibold px-1.5 py-0.5 rounded"
                              style={{ background: "var(--green-soft)", color: "var(--green)" }}>★ {b.label}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "2px solid var(--primary)" }}>
                <div className="text-xs font-bold uppercase mb-2" style={{ color: "var(--ink-soft)" }}>How to improve this call</div>

                <div className="rounded-xl p-3 mb-2" style={{ background: "var(--green-soft)" }}>
                  <div className="text-xs font-bold uppercase mb-1.5" style={{ color: "var(--green)" }}>What worked</div>
                  {(summary.strengths || []).length === 0
                    ? <div className="text-xs" style={{ color: "var(--ink-faint)" }}>Nothing flagged.</div>
                    : (summary.strengths || []).map((s, i) => (
                        <div key={i} className="text-sm mb-1.5">• {s}</div>
                      ))}
                </div>

                <div className="rounded-xl p-3" style={{ background: "var(--amber-soft)" }}>
                  <div className="text-xs font-bold uppercase mb-1.5" style={{ color: "var(--amber)" }}>Work on this</div>
                  {(summary.improvements || []).length === 0
                    ? <div className="text-xs" style={{ color: "var(--ink-faint)" }}>Nothing flagged.</div>
                    : (summary.improvements || []).map((s, i) => (
                        <div key={i} className="text-sm mb-1.5">• {s}</div>
                      ))}
                </div>

                {summary.moment && (
                  <div className="rounded-xl p-3 mt-2" style={{ background: "var(--surface-alt)" }}>
                    <div className="text-xs font-bold uppercase mb-1" style={{ color: "var(--ink-soft)" }}>Turning point</div>
                    <div className="text-sm">{summary.moment}</div>
                  </div>
                )}

                {summary.next_focus && (
                  <div className="rounded-xl p-3 mt-2" style={{ background: "var(--primary-soft)" }}>
                    <div className="text-xs font-bold uppercase mb-1" style={{ color: "var(--primary)" }}>Practise next</div>
                    <div className="text-sm">{summary.next_focus}</div>
                  </div>
                )}

                {Array.isArray(summary.stage_feedback) && summary.stage_feedback.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs font-bold uppercase mb-1.5" style={{ color: "var(--ink-soft)" }}>Stage by stage</div>
                    {summary.stage_feedback.map((s, i) => (
                      <div key={i} className="rounded-lg px-2.5 py-2 mb-1" style={{ background: "var(--surface-alt)" }}>
                        <div className="text-xs font-semibold">{s.stage}</div>
                        <div className="text-xs" style={{ color: "var(--ink-soft)" }}>{s.comment}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* What the badges on each turn actually mean */}
              <div className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="text-xs font-bold uppercase mb-2" style={{ color: "var(--ink-soft)" }}>Scoring</div>
                <div className="flex flex-col gap-1.5">
                  {Object.keys(SCORE_STYLE).map((k) => (
                    <div key={k} className="flex items-center gap-2">
                      <ScoreBadge score={k} />
                      <span className="sw-mono text-xs shrink-0" style={{ color: (SCORE_POINTS[k] ?? 0) >= 0 ? "var(--green)" : "var(--red)", width: 26 }}>
                        {(SCORE_POINTS[k] ?? 0) > 0 ? "+" : ""}{SCORE_POINTS[k] ?? 0}
                      </span>
                      <span className="text-xs" style={{ color: "var(--ink-faint)" }}>{SCORE_LEGEND[k] || ""}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 mt-1" style={{ borderTop: "1px solid var(--border)", paddingTop: 6 }}>
                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded"
                      style={{ background: "var(--green-soft)", color: "var(--green)" }}>★</span>
                    <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
                      A move worth making — configured in Coach Setup
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Previous practice calls — list on the left to pick from, detail on
          the right. Ranked by points so the best are worth revisiting. */}
      {history.length > 0 && status === "idle" && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3">
            <History size={16} style={{ color: "var(--ink-soft)" }} />
            <h3 className="sw-display text-sm" style={{ color: "var(--ink-faint)", fontWeight: 600, letterSpacing: "0.03em" }}>PREVIOUS CALLS</h3>
            <span className="text-xs" style={{ color: "var(--ink-faint)" }}>{history.length} kept · ranked by points</span>
          </div>

          <div className="sw-cols" style={{ display: "grid", gridTemplateColumns: "320px minmax(0, 1fr)", gap: "0.75rem", alignItems: "start" }}>

            {/* LIST — ranked by points */}
            <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)", maxHeight: "70vh", overflowY: "auto" }}>
              {rankedHistory.map((h, i) => {
                const sel = openSession === h.id;
                const scen = (scenarios.length ? scenarios : COACH_SCENARIOS).find((s) => s.key === h.scenario);
                return (
                  <button key={h.id} onClick={() => setOpenSession(sel ? null : h.id)}
                    className="sw-focus w-full text-left px-3 py-2.5"
                    style={{ background: sel ? "var(--primary-soft)" : "transparent", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                    <div className="flex items-center gap-2">
                      <span className="sw-mono text-xs shrink-0" style={{ color: "var(--ink-faint)", width: 16 }}>{i + 1}</span>
                      {h.interrupted && <span title="Left before finishing" style={{ fontSize: 11 }}>⏸</span>}
                      <span className="text-xs truncate flex-1" style={{ color: sel ? "var(--primary)" : "var(--ink)", fontWeight: sel ? 600 : 500 }}>
                        {scen?.label || h.scenario}
                      </span>
                      <span className="sw-mono text-xs font-bold shrink-0 px-1.5 py-0.5 rounded"
                        style={{
                          background: (h.points ?? 0) >= 0 ? "var(--green-soft)" : "var(--red-soft)",
                          color: (h.points ?? 0) >= 0 ? "var(--green)" : "var(--red)",
                        }}>
                        {(h.points ?? 0) > 0 ? "+" : ""}{h.points ?? 0}
                      </span>
                    </div>
                    <div className="text-xs truncate mt-0.5" style={{ color: "var(--ink-faint)", fontSize: 10.5 }}>
                      {fmtDate(h.created_at)} · {h.turn_count} turns
                      {h.user_name ? ` · ${h.user_name}` : ""}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* DETAIL */}
            <div>
              {selectedSession ? (
                <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="sw-display font-bold text-lg rounded-lg px-2.5 py-0.5"
                        style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
                        {selectedSession.grade || "—"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold">
                          {selectedSession.interrupted && <span title="Left before finishing" style={{ marginRight: 5 }}>⏸</span>}
                          {selectedSession.headline || "Practice call"}
                        </div>
                        <div className="text-xs" style={{ color: "var(--ink-faint)" }}>
                          {(scenarios.length ? scenarios : COACH_SCENARIOS).find((s) => s.key === selectedSession.scenario)?.label || selectedSession.scenario}
                          {" · "}{fmtDate(selectedSession.created_at)}
                          {selectedSession.user_name ? ` · ${selectedSession.user_name}` : ""}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Stats across the top */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "0.5rem" }} className="px-4 py-3">
                    {[
                      ["Points", `${(selectedSession.points ?? 0) > 0 ? "+" : ""}${selectedSession.points ?? 0}`,
                        (selectedSession.points ?? 0) >= 0 ? "var(--green)" : "var(--red)"],
                      ["Turns", selectedSession.turn_count ?? 0, "var(--ink)"],
                      ["Reached", selectedSession.final_stage || "—", selectedSession.completed ? "var(--green)" : "var(--amber)"],
                      ["Outcome", selectedSession.interrupted ? "Interrupted" : selectedSession.completed ? "Completed" : "Ended early",
                        selectedSession.interrupted ? "var(--amber)" : selectedSession.completed ? "var(--green)" : "var(--ink-soft)"],
                    ].map(([label, value, colour]) => (
                      <div key={label} className="rounded-lg px-2.5 py-2" style={{ background: "var(--surface-alt)" }}>
                        <div className="text-xs" style={{ color: "var(--ink-faint)" }}>{label}</div>
                        <div className="sw-display truncate" style={{ fontSize: 15, fontWeight: 600, color: colour }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  {selectedSession.tally && Object.keys(selectedSession.tally).length > 0 && (
                    <div className="px-4 pb-3 flex items-center gap-1.5 flex-wrap">
                      {Object.keys(selectedSession.tally).map((k) => (
                        <span key={k} className="flex items-center gap-1">
                          <ScoreBadge score={k} />
                          <span className="sw-mono text-xs" style={{ color: "var(--ink-faint)" }}>×{selectedSession.tally[k]}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {(selectedSession.strengths?.length > 0 || selectedSession.improvements?.length > 0) && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.6rem" }} className="px-4 pb-3">
                      {selectedSession.strengths?.length > 0 && (
                        <div className="rounded-xl p-3" style={{ background: "var(--green-soft)" }}>
                          <div className="text-xs font-bold uppercase mb-1.5" style={{ color: "var(--green)" }}>What worked</div>
                          {(selectedSession.strengths || []).map((s, i) => <div key={i} className="text-xs mb-1">• {s}</div>)}
                        </div>
                      )}
                      {selectedSession.improvements?.length > 0 && (
                        <div className="rounded-xl p-3" style={{ background: "var(--amber-soft)" }}>
                          <div className="text-xs font-bold uppercase mb-1.5" style={{ color: "var(--amber)" }}>Work on this</div>
                          {(selectedSession.improvements || []).map((s, i) => <div key={i} className="text-xs mb-1">• {s}</div>)}
                        </div>
                      )}
                    </div>
                  )}

                  {selectedSession.moment && (
                    <div className="px-4 pb-3">
                      <div className="rounded-xl p-3" style={{ background: "var(--surface-alt)" }}>
                        <div className="text-xs font-bold uppercase mb-1" style={{ color: "var(--ink-soft)" }}>Turning point</div>
                        <div className="text-xs">{selectedSession.moment}</div>
                      </div>
                    </div>
                  )}

                  {/* Transcript */}
                  <div className="px-4 pb-4">
                    <div className="text-xs font-bold uppercase mb-2" style={{ color: "var(--ink-soft)" }}>Transcript</div>
                    <div className="rounded-xl p-3" style={{ background: "var(--surface-alt)", maxHeight: 420, overflowY: "auto" }}>
                      {(selectedSession.transcript || []).length === 0 ? (
                        <div className="text-xs" style={{ color: "var(--ink-faint)" }}>No transcript kept for this call.</div>
                      ) : (selectedSession.transcript || []).map((t, i) => (
                        <div key={i} className="flex items-start gap-2 mb-2">
                          <span className="text-xs font-bold shrink-0 px-1.5 py-0.5 rounded"
                            style={t.role === "agent"
                              ? { background: "var(--primary-soft)", color: "var(--primary)" }
                              : { background: "var(--surface)", color: "var(--ink-soft)" }}>
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
                </div>
              ) : (
                <div className="rounded-xl p-10 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <div className="text-sm" style={{ color: "var(--ink-faint)" }}>Pick a call on the left to see how it went.</div>
                </div>
              )}
            </div>
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

function ForecastCell({ value, money = true, bold, tone, highlight, noBorder }) {
  const empty = !value;
  return (
    <td className="px-2 py-2.5 sw-mono whitespace-nowrap"
      style={{
        fontSize: 15, textAlign: "center",
        fontWeight: bold ? 700 : 500,
        color: empty ? "var(--ink-faint)" : (tone || "var(--ink)"),
        borderLeft: noBorder ? "none" : "1px solid var(--border)",
        background: highlight ? "var(--primary-soft)" : undefined,
      }}>
      {money ? fmtGBP(value) : (value || 0).toLocaleString("en-GB")}
    </td>
  );
}

/* One line of the forecast breakdown. Clickable when it has children. */
/* Forecast product columns. Each carries SOV and units, and each can be
   opened to show the pillar groups that make it up — so Connectivity can
   be split into BT Net, Broadband and Security without the table always
   being that wide. */
const FC_PRODUCT_COLS = [
  { key: "Cloud", label: "Cloud", accent: "var(--primary)", parts: ["Cloud", "DV4B"] },
  { key: "Mobile", label: "Mobile", accent: "var(--gold)", parts: ["Mobile"] },
  { key: "Connectivity", label: "Connectivity", accent: "var(--blue)", parts: ["BTNet", "Broadband", "Security"] },
];

/* Which forecast pillar group counts toward which column. Driven by the
   same PILLAR_TO_GROUP map the rest of the page uses, so a pillar can't
   land in one place here and another there. */
const FC_GROUP_TO_COL = {};
FC_PRODUCT_COLS.forEach((c) => c.parts.forEach((g) => { FC_GROUP_TO_COL[g] = c.key; }));

function fcProductCol(pillar) {
  return FC_GROUP_TO_COL[groupForPillar(pillar)] || null;
}

function FcRow({ label, v, sov, prods, cols, bold, tone, depth = 0, onFocus, focused }) {
  return (
    <tr style={{
      borderTop: "1px solid var(--border)",
      background: focused ? "var(--primary-soft)" : "transparent",
    }}>
      <td className="px-3 py-2.5 whitespace-nowrap" style={{ paddingLeft: 12 + depth * 20 }}>
        {onFocus ? (
          <button onClick={onFocus} className="sw-focus text-left"
            title={focused ? "Clear this filter" : `Filter everything below to ${label}`}
            style={{ fontSize: 15, fontWeight: bold ? 700 : 600, color: focused ? "var(--primary)" : (tone || "var(--ink-soft)"), textDecoration: focused ? "underline" : "none" }}>
            {label}
          </button>
        ) : (
          <span style={{ fontSize: 15, fontWeight: bold ? 700 : 600, color: tone || "var(--ink-soft)" }}>{label}</span>
        )}
      </td>
      {v == null
        ? <td className="px-2 py-1.5" style={{ borderLeft: "1px solid var(--border)", background: "var(--primary-soft)" }} />
        : <ForecastCell value={v} bold={bold} tone={tone} highlight />}
      {sov == null
        ? <td className="px-2 py-1.5" style={{ borderLeft: "1px solid var(--border)" }} />
        : <ForecastCell value={sov} tone={tone} />}
      {cols.map((c) => {
        const cell = (prods && prods[c.key]) || { sov: 0, units: 0 };
        return (
          <React.Fragment key={c.key}>
            <ForecastCell value={cell.sov} tone={tone} />
            <ForecastCell value={cell.units} money={false} tone="var(--ink-faint)" noBorder />
          </React.Fragment>
        );
      })}
    </tr>
  );
}

/* Loose company-name comparison, matching what the database matcher does —
   used only to decide whether NetSuite's name is worth showing separately. */
function sameCompanyish(a, b) {
  const n = (s) => String(s || "").toLowerCase()
    .replace(/^.*\b(t\/?a|trading as)\b\s*/, "")
    .replace(/\b(ltd|limited|plc|llp|inc|co|company|holdings|group|uk|the|mr|mrs|miss|ms|dr|and|&)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ").trim();
  return n(a) === n(b);
}

/* One forecast, opened up. Shows what was forecast, what NetSuite actually
   has where a match was found, and the gap between them. Managers can
   correct or remove a line from here rather than only from the row. */
/* One forecast, opened up. Shows what was forecast, what NetSuite actually
   has where a match was found, and the gap between them. Managers can edit
   every field here — including the week, so a slipping deal can be moved
   rather than deleted and re-entered. */
function ForecastDrawer({ row, canManage, weeks, sellers, embedded, onSave, onDelete, onClose }) {
  const blank = {
    business_name: "", opp_id: "", pillar: "", agent_name: "", lead_gen_name: "",
    forecast_week: "", forecast_date: "", sov: 0, gp: 0, units: 0,
    status: "Open", next_step: "", signpost_date: "", proposal: "", notes: "",
    previously_forecasted: false, sr_raised: false, visit_or_teams: false, contract_out: false,
  };
  const from = (r) => {
    const o = {};
    Object.keys(blank).forEach((k) => {
      o[k] = r[k] ?? blank[k];
      if (typeof blank[k] === "boolean") o[k] = !!r[k];
    });
    return o;
  };

  const [f, setF] = useState(() => from(row));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  useEffect(() => { setF(from(row)); setConfirmDel(false); }, [row.id]);   // eslint-disable-line

  const dirty = Object.keys(blank).some((k) => String(f[k] ?? "") !== String(from(row)[k] ?? ""));
  const gpDiff = row.matched_at ? num(row.actual_gp) - num(row.gp) : null;
  const sovDiff = row.matched_at ? num(row.actual_sov) - num(row.sov) : null;
  const conf = num(row.matched_confidence);
  const weak = row.matched_at && conf > 0 && conf < 0.6;

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const setBool = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.checked }));

  const Field = ({ label, k, type = "text", hint, options }) => (
    <div className="mb-2">
      <label className="sw-label">{label}</label>
      {options ? (
        <select className="sw-input sw-focus" value={f[k]} onChange={set(k)} disabled={!canManage}>
          {options.map((o) => (
            typeof o === "string"
              ? <option key={o} value={o}>{o}</option>
              : <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : (
        <input className="sw-input sw-focus" type={type} value={f[k] || ""} onChange={set(k)} disabled={!canManage} />
      )}
      {hint && <div className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>{hint}</div>}
    </div>
  );

  const Check = ({ label, k }) => (
    <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--ink-soft)", cursor: canManage ? "pointer" : "default" }}>
      <input type="checkbox" checked={!!f[k]} onChange={setBool(k)} disabled={!canManage} /> {label}
    </label>
  );

  const Diff = ({ label, forecast, actual, diff }) => (
    <div className="rounded-lg p-2.5" style={{ background: "var(--surface-alt)" }}>
      <div className="text-xs mb-1" style={{ color: "var(--ink-faint)" }}>{label}</div>
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span className="sw-mono" style={{ fontSize: 12.5 }}>{fmtGBP(forecast)}</span>
        <span style={{ color: "var(--ink-faint)" }}>→</span>
        <span className="sw-mono" style={{ fontSize: 12.5, fontWeight: 700 }}>{fmtGBP(actual)}</span>
      </div>
      <div className="sw-mono mt-0.5" style={{
        fontSize: 11.5, fontWeight: 600,
        color: Math.abs(diff) < 1 ? "var(--green)" : diff < 0 ? "var(--red)" : "var(--amber)",
      }}>
        {Math.abs(diff) < 1 ? "on forecast" : `${diff > 0 ? "+" : ""}${fmtGBP(diff)}`}
      </div>
    </div>
  );

  const body = (
    <div className="flex flex-col gap-3">

      {/* Did it land? */}
      {row.matched_at ? (
        <div className="rounded-xl p-3" style={{ background: "var(--surface)", border: `1px solid ${weak ? "var(--amber)" : "var(--green)"}` }}>
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            <CheckCircle2 size={14} style={{ color: weak ? "var(--amber)" : "var(--green)" }} />
            <span className="text-xs font-bold uppercase" style={{ color: weak ? "var(--amber)" : "var(--green)", letterSpacing: "0.04em" }}>
              Found in NetSuite
            </span>
            <span className="text-xs ml-auto" style={{ color: "var(--ink-faint)" }}>
              {(row.matched_by || row.match_method) === "opp_id" ? "on Opp ID" : "on name"}
              {conf > 0 && conf < 1 ? ` · ${Math.round(conf * 100)}% alike` : ""}
            </span>
          </div>

          {row.matched_company && !sameCompanyish(row.matched_company, row.business_name) && (
            <div className="rounded-lg p-2 mb-2" style={{ background: weak ? "var(--amber-soft)" : "var(--surface-alt)" }}>
              <div className="text-xs" style={{ color: "var(--ink-faint)" }}>NetSuite has this as</div>
              <div className="text-xs font-semibold">{row.matched_company}</div>
              {weak && <div className="text-xs mt-1" style={{ color: "var(--amber)" }}>Loose match — worth checking it's the same deal.</div>}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <Diff label="GP" forecast={row.gp} actual={row.actual_gp} diff={gpDiff} />
            <Diff label="SOV" forecast={row.sov} actual={row.actual_sov} diff={sovDiff} />
          </div>

          <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: "var(--ink-faint)" }}>
            {row.matched_document && <span className="sw-mono">Doc {row.matched_document}</span>}
            {row.matched_order_date && <span>Ordered {fmtDate(row.matched_order_date)}</span>}
          </div>
        </div>
      ) : (
        <div className="rounded-xl p-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="text-xs font-bold uppercase mb-1" style={{ color: "var(--ink-faint)", letterSpacing: "0.04em" }}>Not found in NetSuite</div>
          <div className="text-xs" style={{ color: "var(--ink-soft)" }}>
            {row.status === "Won"
              ? "Marked won, but nothing matching has appeared. Either it hasn't been placed yet, or the name is too different to match — filling in the Opp ID would settle it."
              : "Nothing matching yet. Expected until the order is placed."}
          </div>
        </div>
      )}

      {/* The deal */}
      <div className="rounded-xl p-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="text-xs font-bold uppercase mb-2" style={{ color: "var(--ink-soft)", letterSpacing: "0.04em" }}>The deal</div>
        <Field label="Business" k="business_name" />
        <Field label="Opp ID" k="opp_id" hint="Fill this in and the NetSuite match becomes exact rather than by name." />
        <Field label="Product" k="pillar" options={["", ...PILLARS]} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
          <Field label="GP" k="gp" />
          <Field label="SOV" k="sov" />
          <Field label="Units" k="units" />
        </div>
      </div>

      {/* Who and when */}
      <div className="rounded-xl p-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="text-xs font-bold uppercase mb-2" style={{ color: "var(--ink-soft)", letterSpacing: "0.04em" }}>Who and when</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
          <Field label="Agent" k="agent_name" options={["", ...(sellers || []).map((s) => s.full_name)]} />
          <Field label="Lead gen" k="lead_gen_name" options={["", ...(sellers || []).map((s) => s.full_name)]} />
        </div>

        <Field label="Forecast week" k="forecast_week"
          options={["", ...(weeks || [])].map((w) => (w ? { value: w, label: `w/c ${fmtDate(w)}` } : { value: "", label: "—" }))}
          hint="Move a slipping deal to a later week rather than deleting and re-entering it — the history stays with the same record." />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
          <Field label="Expected date" k="forecast_date" type="date" />
          <Field label="Signpost date" k="signpost_date" type="date" />
        </div>
      </div>

      {/* Progress */}
      <div className="rounded-xl p-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="text-xs font-bold uppercase mb-2" style={{ color: "var(--ink-soft)", letterSpacing: "0.04em" }}>Progress</div>
        <Field label="Status" k="status" options={FORECAST_STATUSES} />
        <Field label="Next step" k="next_step" />
        <Field label="Proposal" k="proposal" />

        <div className="flex items-center gap-3 flex-wrap mt-1 mb-2">
          <Check label="Previously forecast" k="previously_forecasted" />
          <Check label="SR raised" k="sr_raised" />
          <Check label="Visit or Teams" k="visit_or_teams" />
          <Check label="Contract out" k="contract_out" />
        </div>

        <label className="sw-label">Notes</label>
        <textarea className="sw-input sw-focus" rows={3} value={f.notes || ""} onChange={set("notes")} disabled={!canManage} />
      </div>

      {canManage && (
        <div className="flex items-center gap-2">
          <button disabled={!dirty || saving}
            onClick={async () => {
              setSaving(true);
              await onSave(row.id, {
                business_name: String(f.business_name || "").trim(),
                opp_id: String(f.opp_id || "").trim() || null,
                pillar: f.pillar || null,
                agent_name: f.agent_name || null,
                lead_gen_name: f.lead_gen_name || null,
                forecast_week: f.forecast_week || null,
                forecast_date: f.forecast_date || null,
                signpost_date: f.signpost_date || null,
                gp: parseFloat(f.gp) || 0,
                sov: parseFloat(f.sov) || 0,
                units: parseFloat(f.units) || 0,
                status: f.status || "Open",
                next_step: f.next_step || null,
                proposal: f.proposal || null,
                notes: f.notes || null,
                previously_forecasted: !!f.previously_forecasted,
                sr_raised: !!f.sr_raised,
                visit_or_teams: !!f.visit_or_teams,
                contract_out: !!f.contract_out,
              });
              setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 1600);
            }}
            className="sw-focus flex-1 py-2 rounded-lg text-sm font-semibold"
            style={{ background: dirty ? "var(--primary)" : "var(--surface)", color: dirty ? "#fff" : "var(--ink-faint)", border: "1px solid var(--border)" }}>
            {saving ? "Saving..." : saved ? "Saved" : "Save changes"}
          </button>

          {confirmDel ? (
            <>
              <button onClick={async () => { await onDelete(row.id); if (onClose) onClose(); }}
                className="sw-focus py-2 px-3 rounded-lg text-sm font-semibold text-white" style={{ background: "var(--red)" }}>
                Really delete
              </button>
              <button onClick={() => setConfirmDel(false)} className="sw-focus text-xs" style={{ color: "var(--ink-faint)" }}>Cancel</button>
            </>
          ) : (
            <button onClick={() => setConfirmDel(true)}
              className="sw-focus py-2 px-3 rounded-lg text-sm" style={{ color: "var(--red)", border: "1px solid var(--border)" }}>
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );

  // Inline on the All forecasts page; a slide-over everywhere else
  if (embedded) {
    return (
      <div>
        <div className="flex items-start gap-2 mb-3">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sw-display font-bold text-base truncate">{row.business_name}</div>
            <div className="text-xs" style={{ color: "var(--ink-faint)" }}>
              {row.agent_name}{row.agent_team ? ` · ${row.agent_team}` : ""}
              {row.forecast_week ? ` · w/c ${fmtDate(row.forecast_week)}` : ""}
            </div>
          </div>
          {onClose && <button onClick={onClose} className="sw-focus" style={{ color: "var(--ink-faint)" }}><X size={16} /></button>}
        </div>
        {body}
      </div>
    );
  }

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(20,16,40,0.35)", zIndex: 60, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "min(520px, 100%)", height: "100%", background: "var(--bg)", overflowY: "auto", boxShadow: "-8px 0 24px rgba(0,0,0,0.12)" }}>
        <div className="flex items-start gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sw-display font-bold text-base truncate">{row.business_name}</div>
            <div className="text-xs" style={{ color: "var(--ink-faint)" }}>
              {row.agent_name}{row.agent_team ? ` · ${row.agent_team}` : ""}
              {row.lead_gen_name ? ` · LG ${row.lead_gen_name}` : ""}
            </div>
          </div>
          <button onClick={onClose} className="sw-focus" style={{ color: "var(--ink-faint)" }}><X size={18} /></button>
        </div>
        <div className="p-4">{body}</div>
      </div>
    </div>
  );
}

function ForecastView({ netsuite, profile, staff }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [week, setWeek] = useState(() => isoDateStr(mondayOf(new Date())));
  const [view, setView] = useState("summary");   // summary | detail
  const [teamFilter, setTeamFilter] = useState("All");
  const [agentFilter, setAgentFilter] = useState("All");
  const [pillarFilter, setPillarFilter] = useState(null);   // product group filter
  const [openCols, setOpenCols] = useState({});             // product columns broken into parts
  const [adding, setAdding] = useState(false);
  const [openForecast, setOpenForecast] = useState(null);
  // Forecast figures vs what NetSuite actually statted, and a filter to
  // only the deals that have landed.
  const [valueMode, setValueMode] = useState("forecast");   // forecast | statted
  const [soldOnly, setSoldOnly] = useState(false);
  const [showDeals, setShowDeals] = useState(false);
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
  /* All-forecasts view has its own filters — it spans every week, so it
     can't share the summary's single-week picker. */
  const [dWeek, setDWeek] = useState("All");
  const [dTeam, setDTeam] = useState("All");
  const [dAgent, setDAgent] = useState("All");
  const [dPillar, setDPillar] = useState("All");
  const [dSold, setDSold] = useState(false);
  const [dQuery, setDQuery] = useState("");

  const dTeams = useMemo(() => {
    const s = new Set();
    (rows || []).forEach((r) => { if (r.agent_team) s.add(r.agent_team); if (r.lead_gen_team) s.add(r.lead_gen_team); });
    return Array.from(s).sort();
  }, [rows]);

  // Agents narrow to the chosen team, so the list stays usable
  const dAgents = useMemo(() => {
    const s = new Set();
    (rows || []).forEach((r) => {
      if (dTeam !== "All" && r.agent_team !== dTeam && r.lead_gen_team !== dTeam) return;
      if (r.agent_name) s.add(r.agent_name);
      if (r.lead_gen_name) s.add(r.lead_gen_name);
    });
    return Array.from(s).sort();
  }, [rows, dTeam]);

  const detailRows = useMemo(() => {
    const q = dQuery.trim().toLowerCase();
    return (rows || []).filter((r) => {
      if (dWeek !== "All" && r.forecast_week !== dWeek) return false;
      if (dTeam !== "All" && r.agent_team !== dTeam && r.lead_gen_team !== dTeam) return false;
      if (dAgent !== "All" && r.agent_name !== dAgent && r.lead_gen_name !== dAgent) return false;
      if (dPillar !== "All" && groupForPillar(r.pillar) !== dPillar) return false;
      if (dSold && !r.matched_at) return false;
      if (q && !String(r.business_name || "").toLowerCase().includes(q)
            && !String(r.opp_id || "").toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => String(b.forecast_week || "").localeCompare(String(a.forecast_week || ""))
      || num(b.gp) - num(a.gp));
  }, [rows, dWeek, dTeam, dAgent, dPillar, dSold, dQuery]);

  const detailTotals = useMemo(() => {
    const t = { count: 0, gp: 0, sov: 0, units: 0, landed: 0, actualGp: 0, won: 0 };
    detailRows.forEach((r) => {
      t.count += 1;
      t.gp += num(r.gp);
      t.sov += num(r.sov);
      t.units += num(r.units);
      if (r.matched_at) { t.landed += 1; t.actualGp += num(r.actual_gp); }
      if (r.status === "Won") t.won += 1;
    });
    return t;
  }, [detailRows]);


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
    if (soldOnly && !r.matched_at) return false;
    return true;
  }), [rows, week, teamFilter, agentFilter, pillarFilter, soldOnly]);

  /* The product columns as rendered: an open column is replaced by its
     parts, so the table widens only when asked. */
  const shownProductCols = useMemo(() => {
    const out = [];
    FC_PRODUCT_COLS.forEach((c) => {
      if (openCols[c.key] && c.parts.length > 1) {
        c.parts.forEach((g) => out.push({ key: g, label: g, accent: c.accent, part: true, parent: c.key }));
      } else {
        out.push({ key: c.key, label: c.label, accent: c.accent, part: false, parent: c.key, canOpen: c.parts.length > 1 });
      }
    });
    return out;
  }, [openCols]);

  /* Forecasted deals grouped by team, for the cards under the table. The
     table answers "how much" — this answers "off the back of what", which
     is the question managers actually ask next. */
  const teamDeals = useMemo(() => {
    const byTeam = {};
    weekRows.forEach((r) => {
      const t = r.agent_team || r.lead_gen_team || "Unassigned";
      if (!byTeam[t]) byTeam[t] = { team: t, deals: [], gp: 0, sov: 0, units: 0, landed: 0, actualGp: 0 };
      byTeam[t].deals.push(r);
      byTeam[t].gp += num(r.gp);
      byTeam[t].sov += num(r.sov);
      byTeam[t].units += num(r.units);
      if (r.matched_at) { byTeam[t].landed += 1; byTeam[t].actualGp += num(r.actual_gp); }
    });
    return Object.values(byTeam)
      .map((t) => ({ ...t, deals: [...t.deals].sort((a, b) => num(b.gp) - num(a.gp)) }))
      .sort((a, b) => b.gp - a.gp);
  }, [weekRows]);

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
  /* Statted mode reads NetSuite for the week directly, so it shows every
     order the office actually booked — not just the ones a forecast
     happened to match. "Sold" is the filter for the matched subset. */
  const stattedRows = useMemo(() => {
    const ws = new Date(week);
    const we = new Date(week);
    we.setDate(we.getDate() + 6);
    return (netsuite || []).filter((n) => {
      if (!n.order_date) return false;
      const d = new Date(String(n.order_date).slice(0, 10) + "T00:00:00");
      if (d < ws || d > we) return false;
      if (n.count_gp === false) return false;
      if (teamFilter !== "All" && n.closer_team !== teamFilter && n.referrer_team !== teamFilter) return false;
      if (agentFilter !== "All" && n.closer_name !== agentFilter && n.referrer_name !== agentFilter) return false;
      if (pillarFilter && groupForPillar(n.item_name_grouped || n.product_group_2) !== pillarFilter) return false;
      return true;
    });
  }, [netsuite, week, teamFilter, agentFilter, pillarFilter]);

  const breakdown = useMemo(() => {
    const statted = valueMode === "statted";
    // SOV and units for each column, plus each pillar group so a column
    // can be opened into its parts without a second pass over the rows.
    const blankProds = () => {
      const o = {};
      FC_PRODUCT_COLS.forEach((c) => { o[c.key] = { sov: 0, units: 0 }; });
      PILLAR_GROUPS.forEach((g) => { o[g] = { sov: 0, units: 0 }; });
      return o;
    };
    const node = () => ({ gp: 0, sov: 0, units: 0, lines: 0, prods: blankProds(), subs: {} });
    const shell = () => {
      const o = { gp: 0, sov: 0, units: 0, lines: 0, prods: blankProds(), groups: {} };
      PILLAR_GROUPS.forEach((g) => { o.groups[g] = node(); });
      o.groups.Other = node();
      return o;
    };

    const all = shell();
    const teams = {};

    // In statted mode the source is NetSuite itself, mapped onto the same
    // shape a forecast row has, so everything below is unchanged.
    const source = statted
      ? stattedRows.map((n) => ({
          gp: num(n.gp_office),
          sov: num(n.contract_value),
          units: num(n.quantity),
          pillar: n.item_name_grouped || n.product_group_2 || "Other",
          agent_team: n.closer_team,
          lead_gen_team: n.referrer_team,
          lead_gen_name: n.referrer_name,
          closer_share: num(n.closer_gp),
          lead_gen_share: num(n.referrer_gp),
        }))
      : weekRows;

    source.forEach((r) => {
      const gp = num(r.gp);
      const sov = num(r.sov);
      const units = num(r.units);
      const hasLg = !!(r.lead_gen_name && String(r.lead_gen_name).trim());
      const closerGp = hasLg ? gp * CLOSER_SPLIT : gp;
      const lgGp = hasLg ? gp * LEADGEN_SPLIT : 0;
      const g = groupForPillar(r.pillar);
      const pillar = String(r.pillar || "Other").trim() || "Other";

      // Which of the three product columns this line's SOV lands in
      const pcol = fcProductCol(r.pillar);

      const bump = (o, gpv) => {
        o.gp += gpv; o.sov += sov; o.units += units; o.lines += 1;
        if (pcol) { o.prods[pcol].sov += sov; o.prods[pcol].units += units; }
        if (o.prods[g]) { o.prods[g].sov += sov; o.prods[g].units += units; }
        if (!o.groups[g]) o.groups[g] = node();
        const gn = o.groups[g];
        gn.gp += gpv; gn.sov += sov; gn.units += units; gn.lines += 1;
        if (pcol) { gn.prods[pcol].sov += sov; gn.prods[pcol].units += units; }
        if (gn.prods[g]) { gn.prods[g].sov += sov; gn.prods[g].units += units; }
        if (!gn.subs[pillar]) gn.subs[pillar] = { gp: 0, sov: 0, units: 0, lines: 0, prods: blankProds() };
        const sn = gn.subs[pillar];
        sn.gp += gpv; sn.sov += sov; sn.units += units; sn.lines += 1;
        if (pcol) { sn.prods[pcol].sov += sov; sn.prods[pcol].units += units; }
        if (sn.prods[g]) { sn.prods[g].sov += sov; sn.prods[g].units += units; }
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
  }, [weekRows, valueMode, stattedRows]);

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
      landed: matched.length,
      landedThisWeek: landedThisWeek.length,
      matchedAny: matched.length,
      hitRate: weekRows.length ? (matched.length / weekRows.length) * 100 : 0,
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
    // Stay open — agents usually add several in a row, and reopening the
    // form each time is the slow part. The agent and week carry over so
    // only the deal details need retyping.
    setDraft((p) => ({
      ...blankRow,
      agent_name: p.agent_name,
      lead_gen_name: p.lead_gen_name,
      pillar: p.pillar,
    }));
    setToastLocal("Order forecasted");
    setTimeout(() => setToastLocal(""), 2500);
    load();
  };

  const deleteForecast = async (id) => {
    const { error } = await supabase.from("forecasts").delete().eq("id", id);
    if (error) {
      setToastLocal(`Couldn't delete: ${error.message}`);
      setTimeout(() => setToastLocal(""), 5000);
      return;
    }
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
          {/* Summary vs the full list. Lives up here now the filter bar
              below has gone — the table's own headers do the filtering. */}
          <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)", height: 34 }}>
            {[["summary", "Summary"], ["detail", "All forecasts"]].map(([k, lbl]) => (
              <button key={k} onClick={() => setView(k)}
                className="sw-focus px-3 text-xs whitespace-nowrap"
                style={view === k
                  ? { background: "var(--primary)", color: "#fff", fontWeight: 600, height: "100%" }
                  : { background: "transparent", color: "var(--ink-faint)", height: "100%" }}>
                {lbl}
              </button>
            ))}
          </div>
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


      {/* SUMMARY */}
      {view === "summary" && (
        <>
        {/* Headline figures on the left, the matrix to their right —
            read the totals first, then how they break down. */}
        <div className="sw-cols mb-4" style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1fr) minmax(0, 3.4fr)", gap: "0.75rem", alignItems: "start" }}>
          {/* Three cards, stacked. Forecast lines and Statted this week are
              gone — lines is on the GP card, and statted is now readable
              straight off the table's Statted toggle. */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.6rem" }}>
            <div className="rounded-2xl p-3.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="text-sm font-semibold uppercase" style={{ color: "var(--ink-soft)" }}>Forecast GP</div>
              {/* Net of the lead-gen double count — this is what actually lands */}
              <div className="sw-display font-bold" style={{ fontSize: 30, letterSpacing: "-0.025em" }}>{fmtGBP(summary.grand)}</div>
              <div className="text-sm" style={{ color: "var(--ink-faint)" }}>
                {accuracy.lines} line{accuracy.lines === 1 ? "" : "s"} · {fmtGBP(accuracy.forecastSov)} SOV
              </div>
              {summary.dc < 0 && (
                <div className="text-xs" style={{ color: "var(--ink-faint)" }}>
                  {fmtGBP(summary.gpSum)} claimed − {fmtGBP(Math.abs(summary.dc))} DC
                </div>
              )}
            </div>

            <div className="rounded-2xl p-3.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="text-sm font-semibold uppercase" style={{ color: "var(--ink-soft)" }}>Forecasts landed</div>
              <div className="sw-display font-bold" style={{ fontSize: 30, letterSpacing: "-0.025em", color: accuracy.hitRate >= 70 ? "var(--green)" : accuracy.hitRate >= 40 ? "var(--amber)" : "var(--red)" }}>
                {accuracy.landed}/{accuracy.lines}
              </div>
              <div className="text-sm" style={{ color: "var(--ink-faint)" }}>{accuracy.hitRate.toFixed(0)}% seen in NetSuite</div>
            </div>

            <div className="rounded-2xl p-3.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="text-sm font-semibold uppercase" style={{ color: "var(--ink-soft)" }}>Forecast vs actual</div>
              <div className="sw-display font-bold" style={{ fontSize: 30, letterSpacing: "-0.025em", color: accuracy.gpVariance >= 0 ? "var(--green)" : "var(--red)" }}>
                {accuracy.gpVariance >= 0 ? "+" : ""}{fmtGBP(accuracy.gpVariance)}
              </div>
              <div className="text-sm" style={{ color: "var(--ink-faint)" }}>statted minus forecast</div>
            </div>
          </div>

        <div>

          {/* Forecast vs what actually statted, and a filter to only the
              deals that have landed. */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)", height: 30 }}>
              {[["forecast", "Forecast"], ["statted", "Statted"]].map(([k, lbl]) => (
                <button key={k} onClick={() => setValueMode(k)}
                  className="sw-focus px-3 text-xs whitespace-nowrap"
                  title={k === "statted"
                    ? "What NetSuite actually booked, for the deals that matched"
                    : "What was forecast at the start of the week"}
                  style={valueMode === k
                    ? { background: "var(--primary)", color: "#fff", fontWeight: 600, height: "100%" }
                    : { background: "transparent", color: "var(--ink-faint)", height: "100%" }}>
                  {lbl}
                </button>
              ))}
            </div>

            <button onClick={() => setSoldOnly((v) => !v)}
              className="sw-focus px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5"
              title="Only forecasts that have been found in NetSuite"
              style={{
                height: 30,
                background: soldOnly ? "var(--green)" : "transparent",
                color: soldOnly ? "#fff" : (accuracy.landed ? "var(--green)" : "var(--ink-faint)"),
                border: `1px solid ${soldOnly ? "var(--green)" : "var(--border)"}`,
              }}>
              <CheckCircle2 size={12} /> Sold{accuracy.landed ? ` (${accuracy.landed})` : ""}
            </button>

            {valueMode === "statted" && (
              <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
                Every order NetSuite booked this week, forecast or not. Use <b>Sold</b> for just the forecast ones.
              </span>
            )}
            {soldOnly && valueMode !== "statted" && (
              <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
                Landed deals only, at their forecast values.
              </span>
            )}
          </div>

          {/* Breakdown. Column headings do the filtering, and each product
              can be opened into the pillars that make it up. */}
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="overflow-x-auto">
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)" }}>
                    <th className="px-3 py-2 text-left text-sm font-semibold uppercase" style={{ color: "var(--ink-soft)" }} rowSpan={2}>Metric</th>
                    <th className="px-2 py-2 text-center text-sm font-bold" colSpan={2}
                      style={{ color: "var(--primary)", background: "var(--primary-soft)", borderLeft: "1px solid var(--border)" }}>
                      {valueMode === "statted" ? "Office total (statted)" : "Office total"}
                    </th>
                    {/* One grouped heading per product, each spanning its
                        SOV and units pair. The + opens it into its parts. */}
                    {shownProductCols.map((c) => {
                      const on = pillarFilter === c.key;
                      const parentOpen = openCols[c.parent];
                      return (
                        <th key={c.key} colSpan={2} className="px-2 py-2 text-center"
                          style={{
                            borderLeft: "2px solid var(--border)",
                            background: on ? "var(--primary-soft)" : (c.part ? "var(--surface)" : "transparent"),
                          }}>
                          <span className="inline-flex items-center gap-1">
                            <button onClick={() => setPillarFilter(on ? null : c.key)}
                              className="sw-focus font-bold"
                              title={on ? "Clear this filter" : `Show only ${c.label}`}
                              style={{ fontSize: 15, color: c.accent, textDecoration: on ? "underline" : "none" }}>
                              {c.label}
                            </button>
                            {(c.canOpen || parentOpen) && (
                              <button
                                onClick={() => setOpenCols((o) => ({ ...o, [c.parent]: !o[c.parent] }))}
                                className="sw-focus"
                                title={parentOpen ? "Close this back up" : "Break this down"}
                                style={{
                                  fontSize: 11, fontWeight: 700, lineHeight: 1,
                                  width: 15, height: 15, borderRadius: 4,
                                  border: "1px solid var(--border)", color: "var(--ink-faint)",
                                  background: "var(--surface)",
                                }}>
                                {parentOpen ? "−" : "+"}
                              </button>
                            )}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                  <tr style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)" }}>
                    <th className="px-2 py-1.5 text-center text-xs font-bold"
                      style={{ color: "var(--green)", background: "var(--primary-soft)", borderLeft: "1px solid var(--border)" }}>GP</th>
                    <th className="px-2 py-1.5 text-center text-sm font-bold"
                      style={{ color: "var(--ink-soft)", background: "var(--primary-soft)" }}>SOV</th>
                    {shownProductCols.map((c) => (
                      <React.Fragment key={c.key}>
                        <th className="px-2 py-1.5 text-center text-sm font-semibold"
                          style={{ color: "var(--ink-faint)", borderLeft: "2px solid var(--border)" }}>SOV</th>
                        <th className="px-2 py-1.5 text-center text-sm font-semibold"
                          style={{ color: "var(--ink-faint)" }}>Units</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* summary.grand is the forecast net of DC, so it only
                      applies in forecast mode — statted GP comes from the
                      breakdown, which is already built from actuals. */}
                  <FcRow label="Office total"
                    v={valueMode === "statted" ? breakdown.all.gp : summary.grand}
                    sov={breakdown.all.sov}
                    prods={breakdown.all.prods} cols={shownProductCols} bold tone="var(--primary)" />

                  {/* Per team */}
                  {breakdown.teams.map((t) => (
                    <FcRow key={t.team} label={t.team} v={t.gp} sov={t.sov} prods={t.prods} cols={shownProductCols} bold
                      focused={teamFilter === t.team}
                      onFocus={() => setTeamFilter(teamFilter === t.team ? "All" : t.team)} />
                  ))}

                  {/* What the overlap costs. The teams above add to more
                      than the office total; this reconciles them. Only
                      meaningful on forecast figures — NetSuite's actuals
                      are already single-counted. */}
                  {valueMode === "forecast" && (
                  <tr style={{ borderTop: "2px solid var(--border)", background: "var(--red-soft)" }}>
                    <td className="px-3 py-2.5 font-semibold" style={{ color: "var(--red)", fontSize: 14 }}>
                      DC <span style={{ fontWeight: 400 }}>(teams claim {fmtGBP(summary.gpSum)})</span>
                    </td>
                    <ForecastCell value={summary.dc} bold tone="var(--red)" highlight />
                    <td className="px-2 py-2" />
                    {shownProductCols.map((c) => (
                      <React.Fragment key={c.key}>
                        <td className="px-2 py-2" style={{ borderLeft: "2px solid var(--border)" }} />
                        <td className="px-2 py-2" />
                      </React.Fragment>
                    ))}
                  </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        </div>

          <p className="text-xs mb-3" style={{ color: "var(--ink-faint)" }}>
            Click a team to open it up, a product heading to filter, or <b>+</b> on a heading to split it into
            its parts. GP splits 80% to the closer and 50% to the lead gen where there is one, with the 30%
            overlap coming off as DC — so the office total is what actually lands.
          </p>
          {/* Forecasted deals by team — the orders feeding the table above.
              Hidden by default: it's detail you go looking for, not
              something needed on every visit. */}
          <div className="flex items-baseline gap-2 mb-2 flex-wrap">
            <label className="flex items-center gap-1.5 text-sm font-semibold uppercase" style={{ color: "var(--ink-faint)", letterSpacing: "0.04em", cursor: "pointer" }}>
              <input type="checkbox" checked={showDeals} onChange={(e) => setShowDeals(e.target.checked)} />
              Deals feeding this
            </label>
            <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
              {weekRows.length} deal{weekRows.length === 1 ? "" : "s"}
            </span>
            {(teamFilter !== "All" || agentFilter !== "All" || pillarFilter) && (
              <>
                {teamFilter !== "All" && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
                    {teamFilter}
                  </span>
                )}
                {agentFilter !== "All" && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
                    {agentFilter}
                  </span>
                )}
                {pillarFilter && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
                    {pillarFilter}
                  </span>
                )}
                <button onClick={() => { setTeamFilter("All"); setAgentFilter("All"); setPillarFilter(null); }}
                  className="sw-focus text-xs font-semibold" style={{ color: "var(--primary)" }}>
                  Clear filters
                </button>
              </>
            )}
          </div>
          {showDeals && (
          <div className="sw-cols" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "0.75rem" }}>
            {teamDeals.map((t) => (
              <div key={t.team} className="rounded-xl overflow-hidden"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="px-3 py-2.5" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-alt)" }}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="sw-display truncate" style={{ fontSize: 13, fontWeight: 600 }}>{t.team}</span>
                    <span className="sw-mono shrink-0" style={{ fontSize: 14, fontWeight: 700, color: "var(--green)" }}>{fmtGBP(t.gp)}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
                      {t.deals.length} deal{t.deals.length === 1 ? "" : "s"}
                    </span>
                    <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
                      SOV <b className="sw-mono" style={{ color: "var(--ink-soft)" }}>{fmtGBP(t.sov)}</b>
                    </span>
                    {t.units > 0 && (
                      <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
                        {t.units} unit{t.units === 1 ? "" : "s"}
                      </span>
                    )}
                    {t.landed > 0 && (
                      <span className="text-xs font-semibold" style={{ color: "var(--green)" }}
                        title={`${fmtGBP(t.actualGp)} actual GP found in NetSuite`}>
                        {t.landed} landed · {fmtGBP(t.actualGp)}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ maxHeight: 300, overflowY: "auto" }}>
                  {t.deals.map((d) => {
                    const conf = num(d.matched_confidence);
                    const weak = d.matched_at && conf > 0 && conf < 0.6;
                    const gpDiff = d.matched_at ? num(d.actual_gp) - num(d.gp) : null;
                    return (
                      <button key={d.id} onClick={() => setOpenForecast(d)}
                        className="sw-focus w-full text-left px-3 py-2"
                        style={{
                          borderTop: "1px solid var(--border)",
                          background: d.matched_at ? (weak ? "var(--amber-soft)" : "var(--green-soft)") : "transparent",
                        }}>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate flex items-center gap-1" style={{ fontSize: 12.5, fontWeight: 600, minWidth: 0 }}>
                            {d.matched_at && (
                              <CheckCircle2 size={11} style={{ color: weak ? "var(--amber)" : "var(--green)", flexShrink: 0 }} />
                            )}
                            {d.business_name || "—"}
                          </span>
                          <span className="sw-mono shrink-0" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--green)" }}>
                            {fmtGBP(d.gp)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="rounded px-1.5 py-0.5" style={{ fontSize: 10, background: "var(--primary-soft)", color: "var(--primary)", fontWeight: 600 }}>
                            {d.pillar || "—"}
                          </span>
                          {d.status && d.status !== "Open" && (
                            <span className="rounded px-1.5 py-0.5" style={{
                              fontSize: 10, fontWeight: 600,
                              background: d.status === "Won" ? "var(--green-soft)" : d.status === "Lost" ? "var(--red-soft)" : "var(--surface-alt)",
                              color: d.status === "Won" ? "var(--green)" : d.status === "Lost" ? "var(--red)" : "var(--ink-soft)",
                            }}>{d.status}</span>
                          )}
                          <span className="sw-mono ml-auto shrink-0" style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>
                            {fmtGBP(d.sov)} SOV{num(d.units) ? ` · ${num(d.units)}u` : ""}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="truncate" style={{ color: "var(--ink-faint)", fontSize: 10.5 }}>
                            {d.agent_name || "—"}{d.lead_gen_name ? ` · LG ${d.lead_gen_name}` : ""}
                          </span>
                          {d.opp_id && (
                            <span className="sw-mono shrink-0" style={{ fontSize: 10, color: "var(--ink-faint)" }}>{d.opp_id}</span>
                          )}
                        </div>

                        {/* Where it's got to, or what NetSuite found */}
                        {d.matched_at ? (
                          <div className="mt-1 rounded px-1.5 py-1" style={{ background: "rgba(255,255,255,0.55)" }}>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span style={{ fontSize: 10, fontWeight: 700, color: weak ? "var(--amber)" : "var(--green)" }}>
                                LANDED
                              </span>
                              <span className="sw-mono" style={{ fontSize: 10.5 }}>{fmtGBP(d.actual_gp)} actual</span>
                              <span className="sw-mono" style={{
                                fontSize: 10.5, fontWeight: 600,
                                color: Math.abs(gpDiff || 0) < 1 ? "var(--ink-faint)" : (gpDiff || 0) < 0 ? "var(--red)" : "var(--amber)",
                              }}>
                                {Math.abs(gpDiff || 0) < 1 ? "on forecast" : `${(gpDiff || 0) > 0 ? "+" : ""}${fmtGBP(gpDiff || 0)}`}
                              </span>
                            </div>
                            {d.matched_company && !sameCompanyish(d.matched_company, d.business_name) && (
                              <div className="truncate" style={{ fontSize: 10, color: "var(--ink-faint)" }}>
                                NS: {d.matched_company}
                              </div>
                            )}
                          </div>
                        ) : (
                          (d.next_step || d.signpost_date) && (
                            <div className="mt-1 truncate" style={{ color: "var(--ink-soft)", fontSize: 10.5 }}>
                              {d.next_step || "Next step not set"}
                              {d.signpost_date ? ` · ${fmtDate(d.signpost_date)}` : ""}
                            </div>
                          )
                        )}
                      </button>
                    );
                  })}
                  {t.deals.length === 0 && (
                    <div className="px-3 py-6 text-center text-xs" style={{ color: "var(--ink-faint)" }}>Nothing forecast.</div>
                  )}
                </div>
              </div>
            ))}
          </div>
          )}

          {showDeals && teamDeals.length === 0 && (
            <div className="rounded-xl py-10 text-center text-xs"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--ink-faint)" }}>
              No deals forecast for this week.
            </div>
          )}

        </>
      )}

      {/* DETAIL */}
      {/* ALL FORECASTS — list on the left, the record open on the right */}
      {view === "detail" && (
        <div>
          {/* Filters. This view spans every week, so it needs its own set
              rather than inheriting the summary's single-week picker. */}
          <div className="rounded-xl mb-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 px-3 py-2.5 flex-wrap">
              <select className="sw-input sw-focus" style={{ width: 152, height: 32, fontSize: 12.5 }}
                value={dWeek} onChange={(e) => setDWeek(e.target.value)}>
                <option value="All">All weeks</option>
                {weekOptions.map((w) => <option key={w} value={w}>{weekLabel(w)}</option>)}
              </select>

              <select className="sw-input sw-focus" style={{ width: 152, height: 32, fontSize: 12.5 }}
                value={dTeam} onChange={(e) => { setDTeam(e.target.value); setDAgent("All"); }}>
                <option value="All">All teams</option>
                {dTeams.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>

              <select className="sw-input sw-focus" style={{ width: 160, height: 32, fontSize: 12.5 }}
                value={dAgent} onChange={(e) => setDAgent(e.target.value)}>
                <option value="All">All agents</option>
                {dAgents.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>

              <select className="sw-input sw-focus" style={{ width: 160, height: 32, fontSize: 12.5 }}
                value={dPillar} onChange={(e) => setDPillar(e.target.value)}>
                <option value="All">All products</option>
                {PILLAR_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                <option value="Other">Other</option>
              </select>

              <button onClick={() => setDSold((v) => !v)}
                className="sw-focus px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                style={{
                  height: 32,
                  background: dSold ? "var(--green)" : "transparent",
                  color: dSold ? "#fff" : "var(--green)",
                  border: `1px solid ${dSold ? "var(--green)" : "var(--border)"}`,
                }}>
                <CheckCircle2 size={12} /> Sold only
              </button>

              <div className="relative" style={{ flex: 1, minWidth: 160 }}>
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-faint)" }} />
                <input className="sw-input sw-focus" style={{ paddingLeft: 28, height: 32, fontSize: 12.5 }}
                  placeholder="Search business or Opp ID..." value={dQuery} onChange={(e) => setDQuery(e.target.value)} />
              </div>

              <span className="text-xs shrink-0" style={{ color: "var(--ink-faint)" }}>
                {detailRows.length} of {rows.length}
              </span>
            </div>
          </div>

          {/* Totals for whatever the filters have left */}
          <div className="sw-cols-2 mb-2" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.6rem" }}>
            {[
              ["Forecasts", detailTotals.count, "var(--ink)", `${detailTotals.won} marked won`],
              ["Forecast GP", fmtGBP(detailTotals.gp), "var(--green)", `${fmtGBP(detailTotals.sov)} SOV`],
              ["Landed", `${detailTotals.landed}/${detailTotals.count}`,
                detailTotals.count && detailTotals.landed / detailTotals.count >= 0.5 ? "var(--green)" : "var(--amber)",
                `${fmtGBP(detailTotals.actualGp)} actual`],
              ["Units", detailTotals.units, "var(--ink)", "across all lines"],
            ].map(([label, value, colour, sub]) => (
              <div key={label} className="rounded-xl p-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="text-xs font-semibold uppercase" style={{ color: "var(--ink-faint)", letterSpacing: "0.04em" }}>{label}</div>
                <div className="sw-display font-bold" style={{ fontSize: 22, letterSpacing: "-0.02em", color: colour }}>{value}</div>
                <div className="text-xs" style={{ color: "var(--ink-faint)" }}>{sub}</div>
              </div>
            ))}
          </div>

          <div className="sw-cols" style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: "0.75rem", alignItems: "start" }}>

            {/* LIST */}
            <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--surface-alt)" }}>
                      {["Business", "Agent", "Product", "GP", "SOV", "Week", "Next step", "Status"].map((h) => (
                        <th key={h} className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: "var(--ink-soft)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detailRows.map((r) => {
                      const conf = num(r.matched_confidence);
                      const weak = r.matched_at && conf > 0 && conf < 0.6;
                      const sel = openForecast?.id === r.id;
                      return (
                        <tr key={r.id} onClick={() => setOpenForecast(r)}
                          style={{
                            borderTop: "1px solid var(--border)",
                            cursor: "pointer",
                            background: sel ? "var(--primary-soft)"
                              : r.matched_at ? (weak ? "var(--amber-soft)" : "var(--green-soft)") : "transparent",
                            boxShadow: sel ? "inset 3px 0 0 var(--primary)" : undefined,
                          }}>
                          <td className="px-3 py-2" style={{ maxWidth: 220 }}>
                            <div className="font-medium text-xs flex items-center gap-1 truncate">
                              {r.matched_at && <CheckCircle2 size={11} style={{ color: weak ? "var(--amber)" : "var(--green)", flexShrink: 0 }} />}
                              {r.business_name}
                            </div>
                            {r.opp_id && <div className="text-xs sw-mono" style={{ color: "var(--ink-faint)", fontSize: 10 }}>{r.opp_id}</div>}
                          </td>
                          <td className="px-3 py-2 text-xs" style={{ maxWidth: 130 }}>
                            <div className="truncate">{r.agent_name}</div>
                            {r.lead_gen_name && <div className="truncate" style={{ color: "var(--ink-faint)", fontSize: 10 }}>LG {r.lead_gen_name}</div>}
                          </td>
                          <td className="px-3 py-2 text-xs" style={{ color: "var(--ink-soft)" }}>{r.pillar}</td>
                          <td className="px-3 py-2 sw-mono text-xs font-semibold">{fmtGBP(r.gp)}</td>
                          <td className="px-3 py-2 sw-mono text-xs sw-hide-xs" style={{ color: "var(--ink-soft)" }}>{fmtGBP(r.sov)}</td>
                          <td className="px-3 py-2 text-xs whitespace-nowrap" style={{ color: "var(--ink-faint)" }}>
                            {r.forecast_week ? fmtDate(r.forecast_week) : "—"}
                          </td>
                          {/* Condensed — the full text is in the panel */}
                          <td className="px-3 py-2 text-xs sw-hide-sm" style={{ color: "var(--ink-soft)", maxWidth: 150 }}>
                            <div className="truncate" title={r.next_step || ""}>{r.next_step || "—"}</div>
                          </td>
                          <td className="px-3 py-2">
                            <span className="rounded px-1.5 py-0.5 whitespace-nowrap" style={{
                              fontSize: 10, fontWeight: 600,
                              background: r.status === "Won" ? "var(--green-soft)" : r.status === "Lost" ? "var(--red-soft)" : "var(--surface-alt)",
                              color: r.status === "Won" ? "var(--green)" : r.status === "Lost" ? "var(--red)" : "var(--ink-soft)",
                            }}>{r.status || "Open"}</span>
                          </td>
                        </tr>
                      );
                    })}
                    {detailRows.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-10 text-center" style={{ color: "var(--ink-faint)" }}>
                        {loading ? "Loading..." : "Nothing matches these filters."}
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* EDIT PANEL */}
            <div className="sw-sticky-col" style={{ position: "sticky", top: 66, maxHeight: "calc(100vh - 84px)", overflowY: "auto" }}>
              {openForecast ? (
                <div className="rounded-xl p-3" style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}>
                  <ForecastDrawer
                    row={rows.find((r) => r.id === openForecast.id) || openForecast}
                    canManage={profile?.role === "office" || profile?.role === "2ic"}
                    weeks={weekOptions}
                    sellers={sellers}
                    embedded
                    onSave={updateRow}
                    onDelete={deleteForecast}
                    onClose={() => setOpenForecast(null)} />
                </div>
              ) : (
                <div className="rounded-xl p-8 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <div className="text-sm" style={{ color: "var(--ink-faint)" }}>Pick a forecast to open it.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Slide-over on the summary page only — the All forecasts page
          shows the same component inline in its right-hand column. */}
      {openForecast && view === "summary" && (
        <ForecastDrawer
          row={rows.find((r) => r.id === openForecast.id) || openForecast}
          canManage={profile?.role === "office" || profile?.role === "2ic"}
          weeks={weekOptions}
          sellers={sellers}
          onSave={updateRow}
          onDelete={deleteForecast}
          onClose={() => setOpenForecast(null)} />
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

      <div className="sw-cols" style={{ display: "grid", gridTemplateColumns: "minmax(260px, 320px) minmax(0, 1fr)", gap: "1rem", alignItems: "start" }}>

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
  const [openForecast, setOpenForecast] = useState(null);
  // Forecast figures vs what NetSuite actually statted, and a filter to
  // only the deals that have landed.
  const [valueMode, setValueMode] = useState("forecast");   // forecast | statted
  const [soldOnly, setSoldOnly] = useState(false);
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

/* Placement states from column P of the Unplaced Rep sheet. Matched on
   pattern rather than exact text, because the sheet's formulas word these
   slightly differently over time. Order matters — first match wins. */
/* Placement states. Two sources write this column with different
   conventions — the old sheet sync wrote human text ("Out for Sig"), the
   direct NetSuite sync writes snake_case ("out_for_sig") — so underscores
   are normalised to spaces before matching and both shapes work.
   Order matters: "placed this week" must be tested before "placed", and
   "unplaced" before anything that merely contains "placed". */
const PLACEMENT_BUCKETS = [
  { key: "out_for_sig",  label: "Out for Sig",  test: /out\s*for\s*sig|awaiting\s*sig|signature/i, tone: "var(--blue)" },
  { key: "placed_tw",    label: "Placed TW",    test: /placed\s*(this\s*week|t\.?w\b)|this\s*week/i, tone: "var(--green)" },
  { key: "placed_lw",    label: "Placed LW",    test: /placed\s*(last\s*week|l\.?w\b)|last\s*week/i, tone: "var(--gold)" },
  { key: "placed_older", label: "Placed (older)", test: /placed\s*older|older/i,                   tone: "var(--ink-faint)" },
  { key: "unplaced",     label: "Unplaced",     test: /unplaced|not\s*placed|^$/i,                  tone: "var(--amber)" },
];

function placementOf(status) {
  // Underscores to spaces, so out_for_sig and "Out for Sig" both match
  const s = String(status || "").replace(/[_-]+/g, " ").trim();
  const hit = PLACEMENT_BUCKETS.find((b) => b.test.test(s));
  return hit ? hit.key : "other";
}

// Out for Sig and Unplaced are both "still to place" — the board is about
// that work, so they're treated as one thing.
const TO_BE_PLACED = ["unplaced", "out_for_sig"];
const isToBePlaced = (status) => TO_BE_PLACED.includes(placementOf(status));

/* Product groups for delivery, matched against "Item: Product Group 2"
   (column H). Order matters — the first match wins, so the more specific
   patterns sit above the general ones. */
// Broadband, Data Networks and VAS all roll up into Connectivity, which
// is what delivery actually reports on. The three stay visible as smaller
// cards beneath it.
const SD_CONNECTIVITY = ["broadband", "dns", "vas"];

const SD_PRODUCTS = [
  { key: "cloud",     label: "Cloud",      test: /cloud|dv4|digital\s*voice|ip\s*-\s*cv|\bvoice\b/i },
  { key: "mobile",    label: "Mobile",     test: /mobile|\bsim\b|airtime|handset|\bee\b/i },
  { key: "btnet",     label: "BTNet",      test: /bt\s*net|btnet|leased\s*line|ethernet/i },
  { key: "broadband", label: "Broadband",  test: /broadband|fttp|fttc|adsl|fibre|\bbb\b/i },
  { key: "security",  label: "Security",   test: /security|badr|ccs|cyber|firewall/i },
  { key: "dns",       label: "Data Networks & Services",
    test: /data\s*network|networks?\s*(and|&)\s*services|\bdns\b|wan|lan|wi-?fi|switch|router/i },
  { key: "vas",       label: "VAS",        test: /\bvas\b|value\s*add|maintenance|support|licen[cs]e/i },
];

function sdProductOf(product) {
  const p = String(product || "");
  const hit = SD_PRODUCTS.find((x) => x.test.test(p));
  return hit ? hit.key : "other";
}

/* ---------------------------------------------------------------------- */
/*  SALES DELIVERY — allocation and progress on claimed orders             */
/* ---------------------------------------------------------------------- */

/* Counts up to its value on mount and eases between values when they
   change. 380ms, cubic ease-out, and rendered with tabular figures by
   the surrounding sw-display so the card never shifts width mid-count.
   People who prefer reduced motion get the final number straight away. */
function CountUp({ value, duration = 380 }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const target = Math.round(num(value));
    if (typeof window !== "undefined" && window.matchMedia
        && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      from.current = target;
      setShown(target);
      return;
    }
    let raf;
    const base = from.current;
    const start = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(base + (target - base) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{shown}</>;
}

function DeliveryView({ orders, netsuite, staff, profile, deliveryTeam, unplaced = [], onAllocate, onSaveOrder, onOpenOrder }) {
  const statusCfg = useStatusCfg();
  const [period, setPeriod] = useState("ytd");     // delivery works across the year
  const [view, setView] = useState("unplaced");    // unplaced | claimed
  const [productFilter, setProductFilter] = useState("All");
  // The board is about work still to place, so that's where it opens.
  const [placementView, setPlacementView] = useState("to_be_placed");
  const [dirtyOnly, setDirtyOnly] = useState(false);
  const [agedOnly, setAgedOnly] = useState(false);
  // Ranked column can switch to an activity matrix
  const [rankView, setRankView] = useState("ranked");        // ranked | throughput
  const [flowMode, setFlowMode] = useState("week");          // week (per day) | weeks (per week)
  const [flowFy, setFlowFy] = useState(() => String(fyYearOf()));
  // 0 = this week, 1 = last week, and so on back
  const [weekBack, setWeekBack] = useState(0);
  const [query, setQuery] = useState("");
  const [agentFilter, setAgentFilter] = useState("All");
  const [stateFilter, setStateFilter] = useState("All");
  const [busyId, setBusyId] = useState(null);

  const isManager = profile?.role === "office" || profile?.role === "sd";
  const canAllocate = isManager || profile?.role === "sd_2ic";

  // NetSuite's Admin Agent is who actually picked the order up. If nobody
  // has been allocated here, fall back to that rather than showing it as
  // unallocated work Tracy needs to hand out.
  const nsByDoc = useMemo(() => {
    const m = {};
    (netsuite || []).forEach((n) => { if (n.document_number) m[String(n.document_number)] = n; });
    return m;
  }, [netsuite]);

  // NetSuite carries the live status once an order is matched; before that
  // the order's own status is all there is.
  const statusOf = useCallback((o) => {
    const n = o.document_number ? nsByDoc[String(o.document_number)] : null;
    return (n && n.order_status) || o.order_status || "";
  }, [nsByDoc]);

  const allocationOf = useCallback((o) => {
    if (o.allocated_to_name) return { name: o.allocated_to_name, fromNetsuite: false };
    const n = o.document_number ? nsByDoc[String(o.document_number)] : null;
    const admin = n && n.admin_agent && String(n.admin_agent).trim();
    if (admin && !/unassigned/i.test(admin)) return { name: admin, fromNetsuite: true };
    return { name: null, fromNetsuite: false };
  }, [nsByDoc]);

  // The delivery team's members — who work can be allocated to
  const team = useMemo(
    () => (staff || []).filter((s) => s.team === deliveryTeam && s.active !== false)
      .sort((a, b) => String(a.full_name).localeCompare(String(b.full_name))),
    [staff, deliveryTeam]
  );

  const inPeriod = useMemo(() => {
    const inP = periodTest(period);
    return (orders || []).filter((o) => {
      if (o.removed_at) return false;
      if (!inP(o.submission_date)) return false;
      return true;
    });
  }, [orders, period]);

  // Count per delivery agent, plus what's still waiting
  const ranking = useMemo(() => {
    const counts = {};
    let unallocated = 0;
    inPeriod.forEach((o) => {
      const alloc = allocationOf(o);
      if (!alloc.name) { unallocated += 1; return; }
      const k = alloc.name;
      if (!counts[k]) counts[k] = { total: 0, open: 0, done: 0 };
      counts[k].total += 1;
      if (/complete|closed|billed|won/i.test(statusOf(o))) counts[k].done += 1;
      else counts[k].open += 1;
    });
    const rows = team.map((s) => ({
      name: s.full_name,
      ...(counts[s.full_name] || { total: 0, open: 0, done: 0 }),
    }));
    // Anyone allocated work who isn't on the team list still shows
    Object.keys(counts).forEach((nm) => {
      if (!rows.some((r) => r.name === nm)) rows.push({ name: nm, ...counts[nm] });
    });
    return { rows: rows.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)), unallocated };
  }, [inPeriod, team, allocationOf, statusOf]);

  const statusOptions = useMemo(() => {
    const s = new Set();
    inPeriod.forEach((o) => { const st = statusOf(o); if (st) s.add(st); });
    return Array.from(s).sort();
  }, [inPeriod, statusOf]);

  /* ---- Unplaced / progressing --------------------------------------
     Two sources feed this. The Unplaced Rep sheet is the authority on
     what NetSuite still has open. Lilac submissions that haven't reached
     NetSuite yet sit alongside as unallocated — once NetSuite picks them
     up they drop out, because the sheet then covers them. */
  // Orders flagged dirty, by NetSuite ref, so a sheet row can inherit it
  const dirtyDocs = useMemo(() => {
    const s = new Set();
    (orders || []).forEach((o) => {
      if (o.dirty_order === "Yes" && o.document_number) s.add(String(o.document_number));
    });
    return s;
  }, [orders]);

  const unplacedRows = useMemo(() => {
    const inP = periodTest(period);
    const inRange = (d) => inP(d);
    // 90+ is worked out from the NetSuite date rather than trusting the
    // sheet's own flag, which is a formula that can lag.
    const daysOld = (d) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null);

    const rows = (unplaced || [])
      .filter((u) => !u.order_date || inRange(u.order_date))
      .map((u) => ({
        id: `up_${u.id}`,
        kind: "netsuite",
        company: u.company_name || "—",
        product: u.product || "—",
        item: u.item_name || null,
        placed: u.placed_status || "—",
        agent: u.admin_agent || null,
        seller: u.agent_name || null,
        manager: u.manager || null,
        sov: num(u.contract_value),
        gp: num(u.gross_amount),
        aged: (daysOld(u.order_date) ?? 0) > 89,
        ageDays: daysOld(u.order_date),
        dirty: u.document_number ? dirtyDocs.has(String(u.document_number)) : false,
        status: u.order_status || null,
        date: u.order_date,
        doc: u.document_number,
        raw: u,
      }));

    // Lilac boxes with no NetSuite match yet — still to be picked up
    const awaiting = (orders || [])
      .filter((o) => {
        if (o.removed_at) return false;
        if (!inRange(o.submission_date)) return false;
        const n = o.document_number ? nsByDoc[String(o.document_number)] : null;
        return !n;   // once NetSuite has it, the sheet covers it
      })
      .map((o) => ({
        id: `lb_${o.id}`,
        kind: "lilac",
        company: o.company_name || "—",
        product: o.product_group_2 || o.item_name_grouped || "—",
        item: o.item_name_grouped || null,
        placed: "Awaiting NetSuite",
        agent: o.allocated_to_name || null,
        seller: o.closer_name || null,
        manager: o.closer_team || null,
        sov: num(o.contract_value),
        gp: num(o.gp_office != null ? o.gp_office : o.sales_agent_gp),
        aged: (daysOld(o.submission_date) ?? 0) > 89,
        ageDays: daysOld(o.submission_date),
        dirty: o.dirty_order === "Yes",
        status: o.order_status || null,
        date: o.submission_date,
        doc: o.document_number,
        order: o,
      }));

    // Lilac submissions lead — they're the ones waiting on delivery to
    // action — then unallocated work, then newest first. This holds when
    // the list is filtered to an individual, so their action items are
    // always at the top.
    return [...awaiting, ...rows].sort((a, b) => {
      const aLilac = a.kind === "lilac", bLilac = b.kind === "lilac";
      if (aLilac !== bLilac) return aLilac ? -1 : 1;
      if (!a.agent !== !b.agent) return a.agent ? 1 : -1;
      return String(b.date || "").localeCompare(String(a.date || ""));
    });
  }, [unplaced, orders, period, nsByDoc, dirtyDocs]);

  const unplacedAged = useMemo(() => unplacedRows.filter((r) => r.aged).length, [unplacedRows]);

  /* Placement summary, and the same split by product underneath it.
     Built from the rows currently in scope so the period filter applies. */
  const placement = useMemo(() => {
    const cols = [...SD_PRODUCTS.map((p) => p.key), "other"];
    const blank = () => {
      const o = { count: 0, sov: 0, byProduct: {} };
      cols.forEach((c) => { o.byProduct[c] = { count: 0, sov: 0 }; });
      return o;
    };
    const out = {};
    PLACEMENT_BUCKETS.forEach((b) => { out[b.key] = blank(); });
    out.other = blank();

    unplacedRows.forEach((r) => {
      const bucket = out[placementOf(r.placed)] || out.other;
      const prod = sdProductOf(r.product);
      const sov = num(r.sov);
      bucket.count += 1;
      bucket.sov += sov;
      bucket.byProduct[prod].count += 1;
      bucket.byProduct[prod].sov += sov;
    });
    return { buckets: out, cols };
  }, [unplacedRows]);

  // One place to sum a product (or roll-up of products), either for a
  // single placement bucket or across all of them — the same reduce was
  // copy-pasted four times through the card grid below.
  /* Product figures follow whichever placement state is selected, so
     picking "Placed TW" reworks the product cards to show that week's
     placements rather than leaving them on the whole-period totals. An
     explicit bucketKey still wins, for the placement cards themselves. */
  const bucketsInScope = useMemo(() => {
    if (placementView === "all") return PLACEMENT_BUCKETS.map((b) => b.key);
    if (placementView === "to_be_placed") return TO_BE_PLACED;
    return [placementView];
  }, [placementView]);

  const sumProducts = useCallback((keys, bucketKey = null) => {
    const bucketKeys = bucketKey ? [bucketKey] : bucketsInScope;
    return bucketKeys.reduce((acc, bk) => keys.reduce((s, k) => {
      const x = placement.buckets[bk]?.byProduct[k];
      if (!x) return s;
      return { count: s.count + x.count, sov: s.sov + x.sov };
    }, acc), { count: 0, sov: 0 });
  }, [placement, bucketsInScope]);

  const productOptions = useMemo(() => {
    const present = new Set(unplacedRows.map((r) => sdProductOf(r.product)));
    return [...SD_PRODUCTS, { key: "other", label: "Other" }].filter((p) => present.has(p.key));
  }, [unplacedRows]);

  const dirtyCountUnplaced = useMemo(() => unplacedRows.filter((r) => r.dirty).length, [unplacedRows]);
  const unplacedFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return unplacedRows.filter((r) => {
      if (q && !String(r.company).toLowerCase().includes(q)
            && !String(r.doc || "").toLowerCase().includes(q)) return false;
      // Lilac submissions haven't reached NetSuite, so they carry no
      // placement status — they're still work to place, so the default
      // view must include them.
      if (placementView === "to_be_placed" && !isToBePlaced(r.placed) && r.kind !== "lilac") return false;
      if (placementView !== "all" && placementView !== "to_be_placed"
          && placementOf(r.placed) !== placementView) return false;
      if (productFilter !== "All") {
        const pk = sdProductOf(r.product);
        // Connectivity is a roll-up, so it matches any of its parts
        const ok = productFilter === "connectivity" ? SD_CONNECTIVITY.includes(pk) : pk === productFilter;
        if (!ok) return false;
      }
      if (dirtyOnly && !r.dirty) return false;
      if (agedOnly && !r.aged) return false;
      if (agentFilter === "__unallocated") { if (r.agent) return false; }
      else if (agentFilter !== "All" && r.agent !== agentFilter) return false;
      return true;
    });
  }, [unplacedRows, query, productFilter, placementView, agentFilter, dirtyOnly, agedOnly]);
  // Totals for the strip above the unplaced list — the rows actually
  // showing, so the product, placement, agent and dirty/aged filters all
  // count towards it.
  const unplacedTotals = useMemo(() => ({
    gp: unplacedFiltered.reduce((s, r) => s + num(r.gp), 0),
    sov: unplacedFiltered.reduce((s, r) => s + num(r.sov), 0),
  }), [unplacedFiltered]);


  // Everything below follows the placement filter, so the workload counts
  // and the table always describe the same set of orders.
  const scopedForWork = useMemo(() => {
    if (placementView === "all") return unplacedRows;
    if (placementView === "to_be_placed") return unplacedRows.filter((r) => r.kind === "lilac" || isToBePlaced(r.placed));
    return unplacedRows.filter((r) => placementOf(r.placed) === placementView);
  }, [unplacedRows, placementView]);

  // Workload by admin agent, from column K
  const unplacedByAgent = useMemo(() => {
    const m = {};
    let none = 0;
    scopedForWork.forEach((r) => {
      if (!r.agent) { none += 1; return; }
      m[r.agent] = (m[r.agent] || 0) + 1;
    });
    return {
      rows: Object.keys(m).map((name) => ({ name, total: m[name] }))
        .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)),
      none,
    };
  }, [scopedForWork]);

  const shownWeekStart = useMemo(() => {
    const ws = weekStart();
    return new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() - weekBack * 7);
  }, [weekBack]);

  const weekBackOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const ws = weekStart();
    const d = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() - i * 7);
    const fri = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 4);
    const fmt = (x) => x.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    return {
      value: i,
      label: i === 0 ? "This week" : i === 1 ? "Last week" : `${fmt(d)} – ${fmt(fri)}`,
    };
  }), []);

  /* Activity: what each admin agent RECEIVED versus what they PLACED.
     Received is dated off the NetSuite order date; placed off order_placed.
     The database now parses that text into order_placed_at via a trigger,
     so that column is used where present and the text is only parsed here
     as a fallback for rows synced before the migration. */
  const flow = useMemo(() => {
    /* NetSuite gives dates DAY-FIRST (4/8/2026 is 4 August). new Date()
       reads that as US month-first and returns 8 April — a valid date, so
       it never errors, it just silently lands in the wrong month. That has
       to be tried LAST, not first, or slash-separated dates are quietly
       wrong wherever the day happens to be 12 or below. */
    const parseDate = (v) => {
      if (!v) return null;
      const str = String(v).trim();
      if (!str || /^(yes|no|y|n|true|false)$/i.test(str)) return null;

      let d = null;

      // dd/mm/yyyy, optionally followed by a time
      const m = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/.exec(str);
      if (m) {
        const day = Number(m[1]);
        const mon = Number(m[2]);
        const yr = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
        if (mon >= 1 && mon <= 12 && day >= 1 && day <= 31) {
          d = new Date(yr, mon - 1, day);
        }
      }

      // ISO or anything else the browser can read — unambiguous, so safe
      if (!d) d = new Date(str);

      if (!d || Number.isNaN(d.getTime()) || d.getFullYear() < 1990) return null;
      return d;
    };

    const y = parseInt(flowFy, 10);
    const perDay = flowMode === "week";
    let cols = [];
    if (perDay) {
      // Monday to Friday only — nobody places orders at the weekend, and two
      // permanently empty columns just made the matrix harder to read.
      const ws = shownWeekStart;
      cols = Array.from({ length: 5 }, (_, i) => {
        const d = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + i);
        return { key: `d${i}`, label: ["Mon", "Tue", "Wed", "Thu", "Fri"][i], date: d };
      });
    } else {
      const w1 = fyWeekStart(y);
      const end = new Date(Math.min(Date.now(), new Date(y + 1, 3, 1).getTime()));
      const last = Math.max(1, Math.floor((weekStart(end).getTime() - w1.getTime()) / 604800000) + 1);
      const first = Math.max(1, last - 12);   // last 13 weeks keeps it readable
      for (let w = first; w <= last; w++) cols.push({ key: `w${w}`, label: `W${w}`, week: w });
    }

    const colKeyFor = (d) => {
      if (!d) return null;
      if (perDay) {
        const ws = shownWeekStart;
        const i = Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - ws.getTime()) / 86400000);
        // Anything landing on Sat or Sun is rolled into the Friday, so a
        // weekend-dated order isn't silently lost from the totals.
        if (i === 5 || i === 6) return "d4";
        return i >= 0 && i < 5 ? `d${i}` : null;
      }
      const fw = fyWeekOf(d);
      if (!fw || fw.fy !== y) return null;
      return `w${fw.week}`;
    };

    const by = {};
    let placedUnparsed = 0, placedDated = 0;
    const touch = (name) => {
      const k = name || "Unallocated";
      if (!by[k]) by[k] = { name: k, recv: {}, placed: {}, recvTotal: 0, placedTotal: 0 };
      return by[k];
    };
    (unplaced || []).forEach((u) => {
      const r = touch(u.admin_agent || null);
      // "New Order Date" from the saved search is the real order date.
      // Read it straight from the raw blob so this works whether or not
      // the sync has promoted it into order_date yet, then fall back.
      const rk = colKeyFor(parseDate(
        (u.data && (u.data["New Order Date"] || u.data["Order Date"])) || u.order_date
      ));
      if (rk) { r.recv[rk] = (r.recv[rk] || 0) + 1; r.recvTotal += 1; }
      const pd = u.order_placed_at ? parseDate(u.order_placed_at) : parseDate(u.order_placed);
      if (pd) {
        placedDated += 1;
        const pk = colKeyFor(pd);
        if (pk) { r.placed[pk] = (r.placed[pk] || 0) + 1; r.placedTotal += 1; }
      } else if (u.order_placed && !/^(yes|no|y|n|true|false)$/i.test(String(u.order_placed).trim())) {
        placedUnparsed += 1;
      }
    });

    const rows = Object.values(by)
      .filter((r) => r.recvTotal > 0 || r.placedTotal > 0)
      .sort((a, b) => (b.recvTotal + b.placedTotal) - (a.recvTotal + a.placedTotal) || a.name.localeCompare(b.name));
    const colTotals = {};
    cols.forEach((c) => {
      colTotals[c.key] = {
        recv: rows.reduce((s, r) => s + (r.recv[c.key] || 0), 0),
        placed: rows.reduce((s, r) => s + (r.placed[c.key] || 0), 0),
      };
    });
    return { cols, rows, colTotals, placedUnparsed, placedDated };
  }, [unplaced, flowMode, flowFy, shownWeekStart]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inPeriod.filter((o) => {
      if (q && !String(o.company_name || "").toLowerCase().includes(q)
            && !String(o.lbcr_ref || "").toLowerCase().includes(q)) return false;
      const alloc = allocationOf(o);
      if (agentFilter === "__unallocated") { if (alloc.name) return false; }
      else if (agentFilter !== "All" && alloc.name !== agentFilter) return false;
      if (stateFilter !== "All" && statusOf(o) !== stateFilter) return false;
      return true;
    }).sort((a, b) => {
      // When looking at one person's list, their Lilac Submitted orders
      // lead — that's the work waiting on them.
      if (agentFilter !== "All" && agentFilter !== "__unallocated") {
        const aLilac = /lilac/i.test(statusOf(a)), bLilac = /lilac/i.test(statusOf(b));
        if (aLilac !== bLilac) return aLilac ? -1 : 1;
      }
      return String(b.submission_date || "").localeCompare(String(a.submission_date || ""));
    });
  }, [inPeriod, query, agentFilter, stateFilter, allocationOf, statusOf]);

  // Totals for the strip above the claimed list — the filtered rows, not the
  // whole period, so search/allocation/state filters are reflected.
  const listTotals = useMemo(() => ({
    gp: filtered.reduce((s, o) => s + num(o.gp_office != null ? o.gp_office : o.sales_agent_gp), 0),
    sov: filtered.reduce((s, o) => s + num(o.contract_value), 0),
  }), [filtered]);

  const totals = useMemo(() => {
    const gp = inPeriod.reduce((s, o) => s + num(o.gp_office != null ? o.gp_office : o.sales_agent_gp), 0);
    const sov = inPeriod.reduce((s, o) => s + num(o.contract_value), 0);
    const aged = inPeriod.filter((o) => o.submission_date
      && Math.floor((Date.now() - new Date(o.submission_date).getTime()) / 86400000) >= 90).length;
    return {
      all: inPeriod.length, gp, sov,
      unallocated: ranking.unallocated,
      aged,
      dirty: inPeriod.filter((o) => o.dirty_order === "Yes").length,
    };
  }, [inPeriod, ranking]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <Inbox size={18} style={{ color: "var(--primary)" }} />
        <h2 className="sw-display text-lg" style={{ fontWeight: 600 }}>Sales Delivery</h2>
        <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
          {deliveryTeam} · allocation and progress
        </span>
        <div className="ml-auto flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)", height: 32 }}>
          {[["unplaced", `To be placed (${scopedForWork.length})`], ["claimed", "Claimed orders"]].map(([k, lbl]) => (
            <button key={k} onClick={() => setView(k)}
              className="sw-focus px-3 text-xs whitespace-nowrap"
              style={view === k
                ? { background: "var(--primary)", color: "#fff", fontWeight: 600, height: "100%", transition: "background .15s ease, color .15s ease" }
                : { background: "transparent", color: "var(--ink-faint)", height: "100%", transition: "background .15s ease, color .15s ease" }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Placement: where everything has got to, and what it's worth */}
      {view === "unplaced" ? (
        <div className="mb-3">
          {/* Products fill the row; the four placement states sit as a
              compact 2×2 block on the right. Inline grid styles on
              purpose — critical layout, no Tailwind JIT dependence. */}
          <div className="sw-cols" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(230px, 264px)", gap: "0.75rem", alignItems: "stretch" }}>

          {/* One card per product rather than a matrix — easier to scan and
              each one is clickable to filter the list. */}
          {/* Product cards. The three that make up Connectivity sit stacked
              to its left, so the relationship is visible without a matrix. */}
          <div className="sw-cols-2" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem", alignItems: "stretch", alignContent: "start" }}>
            {[
              { key: "cloud",  label: "Cloud" },
              { key: "mobile", label: "Mobile" },
              { key: "connectivity", label: "Connectivity", rollup: SD_CONNECTIVITY },
              { key: "__connectivity_parts", label: "" },
              { key: "btnet",    label: "BTNet" },
              { key: "security", label: "Security" },
              { key: "other",    label: "Other" },
            ].map((p) => {
              // The stacked column of Connectivity's parts
              if (p.key === "__connectivity_parts") {
                const anyPart = SD_CONNECTIVITY.some((k) => sumProducts([k]).count > 0);
                if (!anyPart) return null;
                return (
                  <div key={p.key} className="flex flex-col gap-2" style={{ justifyContent: "stretch" }}>
                    {SD_CONNECTIVITY.map((k) => {
                      const def = SD_PRODUCTS.find((x) => x.key === k);
                      if (!def) return null;
                      const t = sumProducts([k]);
                      const sel = productFilter === k;
                      return (
                        <button key={k} onClick={() => setProductFilter(sel ? "All" : k)}
                          className="sw-focus sw-lift rounded-xl px-3 py-2 text-left"
                          style={{
                            flex: 1, minHeight: 0,
                            background: "var(--surface)",
                            border: `1px solid ${sel ? "var(--primary)" : "var(--border)"}`,
                            opacity: t.count ? 1 : 0.5,
                          }}>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-xs truncate" style={{ color: sel ? "var(--primary)" : "var(--ink-faint)" }}>{def.label}</span>
                            <span className="sw-display shrink-0" style={{ fontSize: 16, fontWeight: 600 }}>{t.count || 0}</span>
                          </div>
                          <div className="sw-mono" style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>{fmtGBP(t.sov)}</div>
                        </button>
                      );
                    })}
                  </div>
                );
              }

              const keys = p.rollup || [p.key];
              const totalsForProduct = sumProducts(keys);
              if (totalsForProduct.count === 0) return null;
              const sel = productFilter === p.key;
              return (
                <button key={p.key} onClick={() => setProductFilter(sel ? "All" : p.key)}
                  className="sw-focus sw-lift rounded-xl p-3.5 text-left"
                  style={{ background: "var(--surface)", border: `1px solid ${sel ? "var(--primary)" : "var(--border)"}` }}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-medium uppercase truncate" style={{ color: sel ? "var(--primary)" : "var(--ink-faint)", letterSpacing: "0.04em" }}>
                      {p.label}
                    </span>
                    <span className="sw-display shrink-0" style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em" }}>
                      {totalsForProduct.count}
                    </span>
                  </div>
                  <div className="sw-mono text-xs" style={{ color: "var(--ink-soft)" }}>{fmtGBP(totalsForProduct.sov)}</div>

                  <div className="flex mt-2 rounded-full overflow-hidden" style={{ height: 5, background: "var(--surface-alt)" }}>
                    {PLACEMENT_BUCKETS.map((b) => {
                      const c = sumProducts(keys, b.key);
                      if (!c.count) return null;
                      return (
                        <div key={b.key} title={`${b.label}: ${c.count} · ${fmtGBP(c.sov)}`}
                          style={{ width: `${(c.count / totalsForProduct.count) * 100}%`, background: b.tone }} />
                      );
                    })}
                  </div>
                  <div className="flex flex-col gap-0.5 mt-1.5">
                    {PLACEMENT_BUCKETS.map((b) => {
                      const c = sumProducts(keys, b.key);
                      if (!c.count) return null;
                      return (
                        <div key={b.key} className="flex items-center gap-1.5">
                          <span style={{ width: 6, height: 6, borderRadius: 99, background: b.tone, flexShrink: 0 }} />
                          <span className="text-xs truncate" style={{ color: "var(--ink-faint)" }}>{b.label}</span>
                          <span className="sw-mono ml-auto text-xs shrink-0" style={{ color: "var(--ink-soft)", fontWeight: 600 }}>{c.count}</span>
                          <span className="sw-mono text-xs shrink-0" style={{ color: "var(--ink-faint)", width: 62, textAlign: "right" }}>{fmtGBP(c.sov)}</span>
                        </div>
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Placement states — 2×2, scaled down to sit beside the products.
              placed_older is deliberately not shown: it's a catch-all for
              anything placed more than a fortnight ago, and a fifth card
              would break the grid. It's still counted in All statuses. */}
          <div className="sw-cols-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: "0.75rem" }}>
            {PLACEMENT_BUCKETS.filter((b) => b.key !== "placed_older").map((b) => {
              const d = placement.buckets[b.key];
              const active = placementView === b.key;
              return (
                <button key={b.key}
                  onClick={() => setPlacementView(active ? "to_be_placed" : b.key)}
                  className="sw-focus sw-lift rounded-xl text-left"
                  style={{ padding: "10px 12px", background: "var(--surface)", border: `1px solid ${active ? b.tone : "var(--border)"}` }}>
                  <div className="font-medium uppercase" style={{ fontSize: 10.5, color: "var(--ink-faint)", letterSpacing: "0.04em" }}>{b.label}</div>
                  <div className="sw-display" style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.025em", color: b.tone }}>{d.count}</div>
                  <div className="sw-mono" style={{ fontSize: 11, color: "var(--ink-soft)" }}>{fmtGBP(d.sov)}</div>
                </button>
              );
            })}
          </div>

          </div>

          <p className="text-xs mt-2 px-1" style={{ color: "var(--ink-faint)" }}>
            Connectivity is Broadband, Data Networks &amp; Services and VAS combined — the three cards to its
            right. Click any card to filter; anything with nothing outstanding is hidden.
          </p>
        </div>
      ) : (

      /* Headline counts — this branch only renders on the Claimed view,
         so the old view === "unplaced" ternaries in here were dead code
         and have gone. Cards cascade in and the counts ease up.
         One card holding a 2x2 grid of the four figures, rather than four
         cards strung across a row. Inline grid on purpose — critical
         layout, no Tailwind JIT dependence. */
      <div className="sw-stagger rounded-xl mb-3 p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: "1px", background: "var(--border)" }}>
          {[
            ["Orders in period", totals.all, "var(--ink)", null, true],
            ["Unallocated", totals.unallocated,
              totals.unallocated ? "var(--amber)" : "var(--ink-faint)",
              "Not yet handed to anyone", false],
            ["Over 90 days", totals.aged,
              totals.aged ? "var(--red)" : "var(--ink-faint)",
              "Sitting unplaced for more than 90 days", false],
            ["Dirty orders", totals.dirty,
              totals.dirty ? "var(--red)" : "var(--ink-faint)",
              "Flagged for review", false],
          ].map(([label, value, colour, hint, isMoney]) => (
            <div key={label} style={{ background: "var(--surface)", padding: "10px 14px" }} title={hint || undefined}>
              <div className="text-xs font-medium uppercase" style={{ color: "var(--ink-faint)", letterSpacing: "0.04em" }}>{label}</div>
              <div className="sw-display" style={{ fontSize: 25, fontWeight: 600, letterSpacing: "-0.025em", color: colour }}>
                <CountUp value={value} />
              </div>
              {isMoney ? (
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
                    GP <b className="sw-mono" style={{ color: "var(--ink-soft)" }}>{fmtGBP(totals.gp)}</b>
                  </span>
                  <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
                    SOV <b className="sw-mono" style={{ color: "var(--ink-soft)" }}>{fmtGBP(totals.sov)}</b>
                  </span>
                </div>
              ) : (
                <div className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>{hint}</div>
              )}
            </div>
          ))}
        </div>
      </div>
      )}

      {/* Filters */}
      <div className="rounded-xl mb-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="sw-filter-row flex items-center gap-2 px-3 py-2.5 flex-wrap">
          <PeriodSelect value={period} onChange={setPeriod} width={148} />
          <select className="sw-input sw-focus" style={{ width: 178, height: 32, fontSize: 12.5 }} value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}>
            <option value="All">Everyone</option>
            <option value="__unallocated">Unallocated only</option>
            {ranking.rows.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
          </select>
          {view === "unplaced" ? (
            <>
              <select className="sw-input sw-focus" style={{ width: 190, height: 32, fontSize: 12.5 }}
                value={productFilter} onChange={(e) => setProductFilter(e.target.value)}>
                <option value="All">All products</option>
                <option value="connectivity">Connectivity (all)</option>
                {productOptions.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
              <select className="sw-input sw-focus" style={{ width: 180, height: 32, fontSize: 12.5 }}
                value={placementView} onChange={(e) => setPlacementView(e.target.value)}>
                <option value="to_be_placed">To be placed</option>
                {PLACEMENT_BUCKETS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
                <option value="all">All statuses</option>
              </select>
            </>
          ) : (
            <select className="sw-input sw-focus" style={{ width: 170, height: 32, fontSize: 12.5 }} value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
              <option value="All">All statuses</option>
              {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          {view === "unplaced" && (
            <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)", height: 32 }}>
              <button onClick={() => setAgedOnly((v) => !v)}
                title="Orders where the NetSuite date is more than 89 days ago"
                className="sw-focus px-2 text-xs whitespace-nowrap"
                style={agedOnly
                  ? { background: "var(--red)", color: "#fff", fontWeight: 600, height: "100%", transition: "background .15s ease, color .15s ease" }
                  : { background: "transparent", color: unplacedAged ? "var(--red)" : "var(--ink-faint)", height: "100%", transition: "background .15s ease, color .15s ease" }}>
                90+ days{unplacedAged ? <b style={{ fontWeight: 700 }}> ({unplacedAged})</b> : ""}
              </button>
              <span style={{ width: 1, alignSelf: "stretch", background: "var(--border)" }} />
              <button onClick={() => setDirtyOnly((v) => !v)}
                title="Orders flagged as dirty on the Lilac Box"
                className="sw-focus px-2 text-xs whitespace-nowrap"
                style={dirtyOnly
                  ? { background: "var(--amber)", color: "#fff", fontWeight: 600, height: "100%", transition: "background .15s ease, color .15s ease" }
                  : { background: "transparent", color: dirtyCountUnplaced ? "var(--amber)" : "var(--ink-faint)", height: "100%", transition: "background .15s ease, color .15s ease" }}>
                Dirty{dirtyCountUnplaced ? <b style={{ fontWeight: 700 }}> ({dirtyCountUnplaced})</b> : ""}
              </button>
            </div>
          )}

          <div className="relative" style={{ flex: 1, minWidth: 180 }}>
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-faint)" }} />
            <input className="sw-input sw-focus" style={{ paddingLeft: 28, height: 32, fontSize: 12.5 }}
              placeholder="Search company or ref..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Ranked column is a quarter of the page; the orders list takes the
          rest. Inline grid on purpose — critical layout, no Tailwind JIT. */}
      <div className="sw-cols" style={{
        display: "grid",
        // Activity needs room for the day / week matrix, so the column
        // widens for it and drops back to a quarter for the ranked list.
        gridTemplateColumns: rankView === "throughput"
          ? "minmax(420px, 1.7fr) minmax(0, 2.3fr)"
          : "minmax(190px, 1fr) minmax(0, 3fr)",
        gap: "0.75rem", alignItems: "start",
      }}>

        {/* Team workload — doubles as the agent picker */}
        <div className="sw-sticky-col flex flex-col gap-3 pr-0.5" style={{ position: "sticky", top: 66, maxHeight: "calc(100vh - 78px)", overflowY: "auto" }}>
          <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-baseline justify-between mb-2 gap-2">
              <span className="text-sm font-medium uppercase" style={{ color: "var(--ink-faint)", letterSpacing: "0.04em" }}>{deliveryTeam}</span>
              {agentFilter !== "All" && rankView === "ranked" && (
                <button onClick={() => setAgentFilter("All")} className="sw-focus text-xs" style={{ color: "var(--primary)" }}>Clear</button>
              )}
            </div>

            <div className="flex items-center rounded-lg overflow-hidden mb-3" style={{ border: "1px solid var(--border)", height: 28 }}>
              {[["ranked", "Ranked"], ["throughput", "Activity"]].map(([k, lbl]) => (
                <button key={k} onClick={() => setRankView(k)}
                  className="sw-focus px-2.5 text-xs whitespace-nowrap" style={{ flex: 1, ...(rankView === k
                    ? { background: "var(--primary)", color: "#fff", fontWeight: 600, height: "100%" }
                    : { background: "transparent", color: "var(--ink-faint)", height: "100%" }) }}>
                  {lbl}
                </button>
              ))}
            </div>

            {rankView === "throughput" ? (
              <div>
                <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                  <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)", height: 26 }}>
                    {[["week", "By day"], ["weeks", "Per week"]].map(([k, lbl]) => (
                      <button key={k} onClick={() => setFlowMode(k)}
                        className="sw-focus px-2 text-xs whitespace-nowrap" style={flowMode === k
                          ? { background: "var(--primary-soft)", color: "var(--primary)", fontWeight: 600, height: "100%" }
                          : { background: "transparent", color: "var(--ink-faint)", height: "100%" }}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                  {flowMode === "week" && (
                    <select className="sw-input sw-focus" style={{ width: 128, height: 26, fontSize: 11.5 }}
                      value={weekBack} onChange={(e) => setWeekBack(parseInt(e.target.value, 10))}
                      title="Which week to show">
                      {weekBackOptions.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
                    </select>
                  )}
                  {flowMode === "weeks" && (
                    <select className="sw-input sw-focus" style={{ width: 96, height: 26, fontSize: 11.5 }}
                      value={flowFy} onChange={(e) => setFlowFy(e.target.value)}>
                      {fyList().map((y) => <option key={y} value={y}>{fyLabel(y)}</option>)}
                    </select>
                  )}
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table className="w-full" style={{ fontSize: 11.5, borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th className="text-left" style={{ padding: "3px 4px 5px 0", color: "var(--ink-faint)", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>Agent</th>
                        <th style={{ padding: "3px 5px 5px 0" }} />
                        {flow.cols.map((c) => (
                          <th key={c.key} style={{ padding: "3px 3px 5px", color: "var(--ink-faint)", fontWeight: 600, fontSize: 10, textAlign: "center", minWidth: 30 }}>
                            {c.label}
                          </th>
                        ))}
                        <th style={{ padding: "3px 0 5px 6px", color: "var(--ink-faint)", fontWeight: 600, fontSize: 10, textAlign: "right" }}>Tot</th>
                      </tr>
                    </thead>
                    <tbody>
                      {flow.rows.map((r) => (
                        <React.Fragment key={r.name}>
                          {/* Received on top, placed underneath, so the gap
                              between the two reads down each column */}
                          <tr>
                            <td rowSpan={2} style={{ padding: "4px 4px 4px 0", borderTop: "1px solid var(--border)", verticalAlign: "middle", maxWidth: 104 }}>
                              <div className="truncate" style={{ fontSize: 12, fontWeight: 500 }}>{r.name}</div>
                            </td>
                            {/* Which line is which — the two rows were only
                                told apart by colour before. */}
                            <td style={{ padding: "2px 5px 0 0", borderTop: "1px solid var(--border)", textAlign: "right", color: "var(--blue)", fontSize: 10, fontWeight: 600, whiteSpace: "nowrap" }}>
                              Received
                            </td>
                            {flow.cols.map((c) => (
                              <td key={c.key} className="sw-mono" style={{ padding: "2px 3px 0", textAlign: "center", borderTop: "1px solid var(--border)", color: (r.recv[c.key] || 0) ? "var(--blue)" : "var(--ink-faint)" }}>
                                {r.recv[c.key] || "·"}
                              </td>
                            ))}
                            <td className="sw-mono" style={{ padding: "2px 0 0 6px", textAlign: "right", borderTop: "1px solid var(--border)", color: "var(--blue)", fontWeight: 600 }}>{r.recvTotal}</td>
                          </tr>
                          <tr>
                            <td style={{ padding: "0 5px 4px 0", textAlign: "right", color: "var(--green)", fontSize: 10, fontWeight: 600, whiteSpace: "nowrap" }}>
                              Placed
                            </td>
                            {flow.cols.map((c) => (
                              <td key={c.key} className="sw-mono" style={{ padding: "0 3px 4px", textAlign: "center", color: (r.placed[c.key] || 0) ? "var(--green)" : "var(--ink-faint)" }}>
                                {r.placed[c.key] || "·"}
                              </td>
                            ))}
                            <td className="sw-mono" style={{ padding: "0 0 4px 6px", textAlign: "right", color: "var(--green)", fontWeight: 600 }}>{r.placedTotal}</td>
                          </tr>
                        </React.Fragment>
                      ))}
                      {flow.rows.length === 0 && (
                        <tr><td colSpan={flow.cols.length + 3} className="text-xs text-center py-6" style={{ color: "var(--ink-faint)" }}>
                          Nothing in this window.
                        </td></tr>
                      )}
                    </tbody>
                    {flow.rows.length > 0 && (
                      <tfoot>
                        <tr>
                          <td style={{ padding: "5px 4px 1px 0", borderTop: "2px solid var(--border)", fontSize: 10, textTransform: "uppercase", color: "var(--ink-faint)", fontWeight: 600 }}>All</td>
                          <td style={{ padding: "5px 5px 1px 0", borderTop: "2px solid var(--border)", textAlign: "right", color: "var(--blue)", fontSize: 10, fontWeight: 600, whiteSpace: "nowrap" }}>Received</td>
                          {flow.cols.map((c) => (
                            <td key={c.key} className="sw-mono" style={{ padding: "5px 3px 1px", textAlign: "center", borderTop: "2px solid var(--border)", color: "var(--blue)", fontWeight: 700 }}>{flow.colTotals[c.key].recv || "·"}</td>
                          ))}
                          <td className="sw-mono" style={{ padding: "5px 0 1px 6px", textAlign: "right", borderTop: "2px solid var(--border)", color: "var(--blue)", fontWeight: 700 }}>
                            {flow.rows.reduce((s, r) => s + r.recvTotal, 0)}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ padding: "1px 4px 4px 0" }} />
                          <td style={{ padding: "1px 5px 4px 0", textAlign: "right", color: "var(--green)", fontSize: 10, fontWeight: 600, whiteSpace: "nowrap" }}>Placed</td>
                          {flow.cols.map((c) => (
                            <td key={c.key} className="sw-mono" style={{ padding: "1px 3px 4px", textAlign: "center", color: "var(--green)", fontWeight: 700 }}>{flow.colTotals[c.key].placed || "·"}</td>
                          ))}
                          <td className="sw-mono" style={{ padding: "1px 0 4px 6px", textAlign: "right", color: "var(--green)", fontWeight: 700 }}>
                            {flow.rows.reduce((s, r) => s + r.placedTotal, 0)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                <div className="text-xs mt-2" style={{ color: "var(--ink-faint)" }}>
                  <span style={{ color: "var(--blue)", fontWeight: 600 }}>Received</span> off the NetSuite date ·{" "}
                  <span style={{ color: "var(--green)", fontWeight: 600 }}>Placed</span> off the order-placed date
                  {flowMode === "weeks" ? " · FY weeks run Apr–Mar, Mon–Sun" : ""}
                </div>
                {flow.placedUnparsed > 0 && (
                  <div className="text-xs mt-1.5 rounded-lg px-2 py-1.5" style={{ background: "var(--amber-soft)", color: "var(--amber)" }}>
                    {flow.placedUnparsed} row{flow.placedUnparsed === 1 ? "" : "s"} have an "Order placed" value that isn't a
                    date, so they can't be counted here. The sheet syncs that column as text.
                  </div>
                )}
              </div>
            ) : (
            <div>
            {view === "unplaced" && (
              <div className="text-xs mb-2" style={{ color: "var(--ink-faint)" }}>
                {placementView === "to_be_placed" ? "Orders to be placed"
                  : placementView === "all" ? "All orders"
                  : PLACEMENT_BUCKETS.find((b) => b.key === placementView)?.label || ""}
                {" · "}{scopedForWork.length}
              </div>
            )}

            {(view === "unplaced" ? unplacedByAgent.none : ranking.unallocated) > 0 && (
              <button onClick={() => setAgentFilter(agentFilter === "__unallocated" ? "All" : "__unallocated")}
                className="sw-focus w-full text-left px-2.5 py-2 rounded-lg mb-2"
                style={{ background: agentFilter === "__unallocated" ? "var(--amber)" : "var(--amber-soft)" }}>
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: 13, fontWeight: 600, color: agentFilter === "__unallocated" ? "#fff" : "var(--amber)" }}>Unallocated</span>
                  <span className="sw-mono" style={{ fontSize: 13.5, fontWeight: 700, color: agentFilter === "__unallocated" ? "#fff" : "var(--amber)" }}>
                    {view === "unplaced" ? unplacedByAgent.none : ranking.unallocated}
                  </span>
                </div>
              </button>
            )}

            {(view === "unplaced" ? unplacedByAgent.rows : ranking.rows).length === 0 ? (
              <div className="text-xs text-center py-6" style={{ color: "var(--ink-faint)" }}>
                {view === "unplaced"
                  ? "Nothing unplaced — or the Unplaced Rep sync hasn't run yet."
                  : `Nobody on ${deliveryTeam} yet — set their team on the Admin page.`}
              </div>
            ) : view === "unplaced" ? (
              <div>
                {unplacedByAgent.rows.map((r, i) => {
                  const sel = agentFilter === r.name;
                  const max = Math.max(1, ...unplacedByAgent.rows.map((x) => x.total));
                  return (
                    <button key={r.name} onClick={() => setAgentFilter(sel ? "All" : r.name)}
                      className="sw-focus w-full text-left px-2.5 py-2"
                      style={{ background: sel ? "var(--primary-soft)" : "transparent", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                      <div className="flex items-center gap-2">
                        <span className="truncate" style={{ fontSize: 13.5, color: sel ? "var(--primary)" : "var(--ink)", fontWeight: sel ? 600 : 500 }}>{r.name}</span>
                        <span className="sw-mono ml-auto shrink-0" style={{ fontSize: 13.5, fontWeight: 600 }}>{r.total}</span>
                      </div>
                      <div className="rounded-full mt-1" style={{ height: 5, background: "var(--surface-alt)" }}>
                        <div className="rounded-full sw-bar-anim" style={{ width: `${(r.total / max) * 100}%`, height: "100%", background: "var(--primary)" }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div>
                {ranking.rows.map((r, i) => {
                  const sel = agentFilter === r.name;
                  const max = Math.max(1, ...ranking.rows.map((x) => x.total));
                  return (
                    <button key={r.name} onClick={() => setAgentFilter(sel ? "All" : r.name)}
                      className="sw-focus w-full text-left px-2.5 py-2"
                      style={{ background: sel ? "var(--primary-soft)" : "transparent", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                      <div className="flex items-center gap-2">
                        <span className="truncate" style={{ fontSize: 13.5, color: sel ? "var(--primary)" : "var(--ink)", fontWeight: sel ? 600 : 500 }}>{r.name}</span>
                        <span className="sw-mono ml-auto shrink-0" style={{ fontSize: 13.5, fontWeight: 600 }}>{r.total}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className="rounded-full flex-1" style={{ height: 5, background: "var(--surface-alt)", overflow: "hidden", display: "flex" }}>
                          <div className="sw-bar-anim" style={{ width: `${(r.done / max) * 100}%`, background: "var(--green)" }} />
                          <div className="sw-bar-anim" style={{ width: `${(r.open / max) * 100}%`, background: "var(--blue)" }} />
                        </div>
                        <span className="text-xs shrink-0" style={{ color: "var(--ink-faint)", fontSize: 10.5 }}>
                          {r.open} open · {r.done} done
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <p className="text-xs mt-3" style={{ color: "var(--ink-faint)" }}>
              {view === "unplaced"
                ? "Open orders per admin agent, from the Unplaced Rep sheet. Click a name to filter."
                : "Blue is open work, green is complete. Click a name to filter the list."}
            </p>
            </div>
            )}
          </div>
        </div>

        {/* Unplaced — the NetSuite sheet plus Lilac boxes not yet picked up */}
        {view === "unplaced" ? (
        <div>
        {/* Totals for the list below — follows every filter above it */}
        <ListTotalsStrip gp={unplacedTotals.gp} sov={unplacedTotals.sov} count={unplacedFiltered.length} />

        <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <table className="w-full text-sm sw-orders sw-anim-rows" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "20%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "5%" }} />
            </colgroup>
            <thead>
              <tr style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)" }}>
                {[["Company", ""], ["Product", ""], ["Order status", ""], ["Placed?", ""], ["Admin agent", ""], ["SOV", "sw-hide-xs"], ["GP", ""], ["NetSuite ref", "sw-hide-sm"], ["Date", "sw-hide-sm"]].map(([h, hide], i) => (
                  <th key={i} className={`text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide ${hide}`}
                    style={{ color: "var(--ink-soft)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {unplacedFiltered.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid var(--border)", background: r.kind === "lilac" ? "var(--primary-soft)" : undefined }}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-xs sw-clamp2" style={{ lineHeight: 1.3 }}>
                      {r.kind === "lilac" && (
                        <span title="Submitted in the app, not yet in NetSuite"
                          style={{ fontSize: 9.5, fontWeight: 700, color: "var(--primary)", background: "var(--primary-soft)", padding: "1px 4px", borderRadius: 3, marginRight: 4 }}>
                          LILAC
                        </span>
                      )}
                      {r.aged && (
                        <span title="Over 90 days old"
                          style={{ fontSize: 9.5, fontWeight: 700, color: "var(--red)", background: "var(--red-soft)", padding: "1px 4px", borderRadius: 3, marginRight: 4 }}>
                          90d+
                        </span>
                      )}
                      {r.company}
                    </div>
                    {r.item && <div style={{ fontSize: 10, color: "var(--ink-faint)" }}>{r.item}</div>}
                  </td>
                  <td className="px-3 py-2 text-xs sw-clamp2" style={{ color: "var(--ink-soft)", lineHeight: 1.3 }}>{r.product}</td>
                  <td className="px-2 py-2">
                    {(() => {
                      const tone = TONE_MAP[(statusCfg[r.status] || {}).tone] || TONE_MAP.neutral;
                      return (
                        <span className="inline-block rounded px-1.5 py-0.5 sw-clamp2"
                          style={{ fontSize: 10.5, fontWeight: 600, lineHeight: 1.3, color: tone.fg, background: tone.bg }}
                          title={r.status || ""}>
                          {r.status || "—"}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-2 py-2">
                    {(() => {
                      const b = PLACEMENT_BUCKETS.find((x) => x.test.test(String(r.placed || "")));
                      const tone = r.kind === "lilac"
                        ? { fg: "var(--amber)", bg: "var(--amber-soft)" }
                        : b ? { fg: b.tone, bg: "var(--surface-alt)" }
                            : { fg: "var(--ink-soft)", bg: "var(--surface-alt)" };
                      return (
                        <span className="inline-block rounded px-1.5 py-0.5 sw-clamp2"
                          style={{ fontSize: 10.5, fontWeight: 600, lineHeight: 1.3, color: tone.fg, background: tone.bg }}>
                          {r.placed}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-2 py-2 text-xs" style={{ lineHeight: 1.3 }}>
                    {r.kind === "lilac" && canAllocate ? (
                      /* Not in NetSuite yet, so allocation happens here */
                      <select className={`sw-input sw-focus${busyId === r.order.id ? " sw-saving" : ""}`} style={{ height: 30, fontSize: 11.5 }}
                        value={r.agent || ""}
                        disabled={busyId === r.order.id}
                        onChange={async (e) => {
                          setBusyId(r.order.id);
                          const person = team.find((t) => t.full_name === e.target.value) || null;
                          await onAllocate(r.order.id, person, e.target.value);
                          setBusyId(null);
                        }}>
                        <option value="">Unallocated</option>
                        {team.map((t) => <option key={t.id} value={t.full_name}>{t.full_name}</option>)}
                        {r.agent && !team.some((t) => t.full_name === r.agent) && (
                          <option value={r.agent}>{r.agent}</option>
                        )}
                      </select>
                    ) : r.agent ? (
                      /* NetSuite owns this allocation — read only here */
                      <span className="sw-clamp2" title={r.kind === "netsuite" ? "Allocated in NetSuite — change it there" : undefined}>
                        {r.agent}
                        {r.kind === "netsuite" && (
                          <Lock size={10} className="inline ml-1" style={{ color: "var(--ink-faint)", verticalAlign: -1 }} />
                        )}
                      </span>
                    ) : (
                      <span className="inline-block rounded px-1.5 py-0.5"
                        style={{ fontSize: 10, fontWeight: 700, color: "var(--amber)", background: "var(--amber-soft)" }}>
                        UNALLOCATED
                      </span>
                    )}
                    {r.seller && <div style={{ fontSize: 10, color: "var(--ink-faint)" }}>{r.seller}</div>}
                  </td>
                  <td className="px-2 py-2 sw-mono text-xs sw-hide-xs">{fmtGBP(r.sov)}</td>
                  <td className="px-2 py-2 sw-mono text-xs" style={{ color: "var(--green)", fontWeight: 600 }}>{fmtGBP(r.gp)}</td>
                  <td className="px-2 py-2 sw-mono text-xs sw-hide-sm" style={{ color: "var(--ink-faint)", fontSize: 10.5 }}>{r.doc || "—"}</td>
                  <td className="px-2 py-2 text-xs sw-hide-sm" style={{ color: "var(--ink-faint)", fontSize: 11, lineHeight: 1.3 }}>
                    {r.date ? fmtDate(r.date) : "—"}
                  </td>
                </tr>
              ))}
              {unplacedFiltered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center" style={{ color: "var(--ink-faint)" }}>
                  {unplacedRows.length === 0
                    ? "Nothing here yet — run the Unplaced Rep sync from the NetSuite workbook."
                    : "No rows match these filters."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
        ) : (
        <div>
        {/* Totals for the list below — follows the search and filters */}
        <ListTotalsStrip gp={listTotals.gp} sov={listTotals.sov} count={filtered.length} />

        <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <table className="w-full text-sm sw-orders sw-anim-rows sw-hover-rows" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "19%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "19%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "7%" }} />
            </colgroup>
            <thead>
              <tr style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)" }}>
                {[
                  ["Company", ""], ["Closer", ""], ["Allocated to", ""], ["Product", "sw-hide-sm"],
                  ["SOV", "sw-hide-xs"], ["GP", ""], ["Status", ""], ["Drive", "sw-hide-sm"],
                ].map(([h, hide], i) => (
                  <th key={i} className={`text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide ${hide}`}
                    style={{ color: "var(--ink-soft)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const alloc = allocationOf(o);
                const isLilac = /lilac/i.test(statusOf(o));
                return (
                <tr key={o.id} style={{ borderTop: "1px solid var(--border)", background: isLilac ? "var(--primary-soft)" : undefined }}>
                  <td className="px-3 py-2">
                    <button onClick={() => onOpenOrder(o)} className="sw-focus text-left">
                      <div className="font-medium text-xs sw-clamp2" style={{ lineHeight: 1.3 }}>{o.company_name}</div>
                      {o.lbcr_ref && <div className="sw-mono" style={{ fontSize: 10, color: "var(--ink-faint)" }}>{o.lbcr_ref}</div>}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-xs sw-clamp2" style={{ color: "var(--ink-soft)", lineHeight: 1.3 }}>{o.closer_name || "—"}</td>

                  <td className="px-2 py-2">
                    {canAllocate && !alloc.fromNetsuite ? (
                      <select className={`sw-input sw-focus${busyId === o.id ? " sw-saving" : ""}`} style={{ height: 32, fontSize: 12 }}
                        value={alloc.name || ""}
                        disabled={busyId === o.id}
                        onChange={async (e) => {
                          setBusyId(o.id);
                          const person = team.find((t) => t.full_name === e.target.value) || null;
                          await onAllocate(o.id, person, e.target.value);
                          setBusyId(null);
                        }}>
                        <option value="">Unallocated</option>
                        {team.map((t) => <option key={t.id} value={t.full_name}>{t.full_name}</option>)}
                        {alloc.name && !team.some((t) => t.full_name === alloc.name) && (
                          <option value={alloc.name}>{alloc.name}</option>
                        )}
                      </select>
                    ) : (
                      <span className="text-xs" title={alloc.fromNetsuite ? "Allocated in NetSuite — change it there" : undefined}>
                        {alloc.name || <span style={{ color: "var(--ink-faint)" }}>Unallocated</span>}
                        {alloc.fromNetsuite && (
                          <Lock size={10} className="inline ml-1" style={{ color: "var(--ink-faint)", verticalAlign: -1 }} />
                        )}
                      </span>
                    )}
                  </td>

                  <td className="px-3 py-2 text-xs sw-clamp2 sw-hide-sm" style={{ color: "var(--ink-soft)", lineHeight: 1.3 }}>
                    {o.item_name_grouped || o.product_group_2 || "—"}
                  </td>

                  <td className="px-3 py-2 sw-mono text-xs sw-hide-xs">{fmtGBP(o.contract_value)}</td>

                  <td className="px-3 py-2 sw-mono text-xs" style={{ fontWeight: 600 }}>
                    {fmtGBP(o.gp_office != null ? o.gp_office : o.sales_agent_gp)}
                  </td>

                  <td className="px-2 py-2">
                    {(() => {
                      const st = statusOf(o);
                      const tone = TONE_MAP[(statusCfg[st] || {}).tone] || TONE_MAP.neutral;
                      return (
                        <span className="inline-block rounded px-1.5 py-0.5 sw-clamp2"
                          style={{ color: tone.fg, background: tone.bg, fontSize: 10.5, fontWeight: 600, lineHeight: 1.3, transition: "background .2s ease, color .2s ease" }}
                          title={st}>
                          {st || "—"}
                        </span>
                      );
                    })()}
                  </td>

                  <td className="px-2 py-2 sw-hide-sm">
                    {o.drive_link ? (
                      <a href={o.drive_link} target="_blank" rel="noreferrer"
                        className="sw-focus text-xs font-semibold" style={{ color: "var(--primary)" }}>Open</a>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--ink-faint)" }}>—</span>
                    )}
                  </td>

                  <td className="px-2 py-2 text-xs sw-hide-sm" style={{ color: "var(--ink-faint)", fontSize: 11 }}>
                    {o.submission_date ? fmtDate(o.submission_date) : "—"}
                  </td>
                </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center" style={{ color: "var(--ink-faint)" }}>
                  No orders match.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  SALES DISTRIBUTION — who generates for whom                            */
/* ---------------------------------------------------------------------- */

/* ---------------------------------------------------------------------- */
/*  TOPS — top 3 agents, WTD / MTD / YTD                                    */
/* ---------------------------------------------------------------------- */

/* ---- The "New Net 24-25" list ----------------------------------------
   The Tops board is scored off the NetSuite New Net list, never off Lilac
   claims — so it always agrees with what the business has actually booked.
   Two things define that list:
     1. FY 24-25 onwards (NEW_NET_FIRST_FY), which is where the export starts.
     2. Net-new revenue only: anything the report treats as a resign or a
        renewal is out, as is anything flagged NGP.
   >>> If the report's own definition differs, change ONLY this block. <<< */
const NEW_NET_FIRST_FY = 2024;
const NEW_NET_EXCLUDED = /resign|renew/i;
function isNewNet(n, statusCfg) {
  if (!n || !n.order_date) return false;
  // FY floor
  const d = new Date(n.order_date + "T00:00:00");
  if (Number.isNaN(d.getTime()) || fyYearOf(d) < NEW_NET_FIRST_FY) return false;
  // NGP never scores — the status config wins over the sheet's own flag
  const cfg = statusCfg && n.order_status ? statusCfg[n.order_status] : null;
  const countsGp = cfg ? cfg.count_gp !== false : n.count_gp !== false;
  if (!countsGp) return false;
  if (/\bNGP\b/.test(String(n.status_flags || "").toUpperCase())) return false;
  // Resigns and renewals aren't new net
  if (NEW_NET_EXCLUDED.test(String(n.class_name || ""))) return false;
  return true;
}

/* Product tree for the Tops board. Leaf keys match bucketOfNs below.
   Cloud carries DV4B as its own line; Connectivity carries Broadband,
   BT Net and Security (plus Data Networks, which sits with them on the
   NetSuite sheet). Roll-ups sum their children, so a parent column and
   its child columns always reconcile. */
const TOPS_TREE = [
  { key: "cloud", label: "Cloud", accent: "#5E2CA8", children: [
    { key: "cloud_voice", label: "Cloud Voice", accent: "#7C4DBE" },
    { key: "dv4b", label: "DV4B", accent: "#9B6FD6" },
  ] },
  { key: "connectivity", label: "Connectivity", accent: "#205EA6", children: [
    { key: "broadband", label: "Broadband", accent: "#3D7CC9" },
    { key: "btnet", label: "BT Net", accent: "#5A97DC" },
    { key: "security", label: "Security", accent: "#77B0EA" },
    { key: "data", label: "Data Networks", accent: "#95C5F5" },
  ] },
  { key: "mobile", label: "Mobile", accent: "#8659CE", children: [] },
];
const TOPS_LEAVES = { cloud: ["cloud_voice", "dv4b"], connectivity: ["broadband", "btnet", "security", "data"], mobile: ["mobile"] };
/* Flat list in display order: each parent followed by its children. */
const TOPS_COLUMNS = TOPS_TREE.flatMap((g) => [
  { key: g.key, label: g.label, accent: g.accent, parent: null },
  ...g.children.map((c) => ({ key: c.key, label: c.label, accent: c.accent, parent: g.key })),
]);
/* Which leaf bucket a NetSuite row belongs to. Order matters — DV4 is
   tested before Cloud so DV4B doesn't get swallowed by the cloud rule. */
function bucketOfNs(r) {
  const s = [r.prod_for_gs, r.product_group_2, r.item_name_grouped].join(" ").toLowerCase();
  if (/dv4/.test(s)) return "dv4b";
  if (/mobile|\bsim\b|airtime|handset/.test(s)) return "mobile";
  if (/cloud|voice/.test(s)) return "cloud_voice";
  if (/bt ?net|btnet/.test(s)) return "btnet";
  if (/broadband|fttp|fttc|sogea|adsl/.test(s)) return "broadband";
  if (/security|badr/.test(s)) return "security";
  if (/data|ethernet/.test(s)) return "data";
  return "other";
}

/* A top-3 board. The winner gets the full width and a bigger figure;
   second and third sit beneath as a pair. Celebrating first place is the
   point of the card — a flat list of three does not do that. */
function PodiumCard({ board, big = false }) {
  const [first, second, third] = board.rows;
  const max = first ? first.value || 1 : 1;

  const MEDAL = [
    { ink: "#7A5C00", bg: "rgba(184,134,11,0.16)", ring: "rgba(184,134,11,0.45)" },
    { ink: "#5A5A5A", bg: "rgba(138,138,138,0.16)", ring: "rgba(138,138,138,0.4)" },
    { ink: "#7A4A1F", bg: "rgba(160,100,42,0.16)", ring: "rgba(160,100,42,0.4)" },
  ];

  const Runner = ({ r, i }) => (
    <div className="rounded-lg" style={{ background: "var(--surface-alt)", padding: "8px 9px", minWidth: 0 }}>
      <div className="flex items-center gap-1.5">
        <span className="shrink-0" style={{
          width: 16, height: 16, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 9.5, fontWeight: 700, color: MEDAL[i].ink, background: MEDAL[i].bg,
        }}>{i + 1}</span>
        <span className="truncate" style={{ fontSize: 11.5, fontWeight: 500, minWidth: 0 }}>{r.name}</span>
      </div>
      <div className="sw-mono" style={{ fontSize: 12.5, fontWeight: 600, marginTop: 3 }}>{fmtGBP(r.value)}</div>
      <div className="rounded-full" style={{ height: 2.5, background: "var(--border)", marginTop: 5, overflow: "hidden" }}>
        <div className="rounded-full sw-bar-anim"
          style={{ width: `${Math.max(6, (r.value / max) * 100)}%`, height: "100%", background: board.accent, opacity: 0.6 }} />
      </div>
    </div>
  );

  return (
    <div className="sw-lift overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14 }}>
      <div style={{ position: "relative", padding: "11px 14px 10px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: board.accent }} />
        <div className="flex items-baseline justify-between gap-2">
          <span className="sw-display truncate" style={{ fontSize: big ? 14 : 13, fontWeight: 600, color: board.accent, letterSpacing: "-0.01em" }}>
            {board.parent ? <span style={{ opacity: 0.55 }}>↳ </span> : null}{board.label}
          </span>
          <span className="sw-mono shrink-0" style={{ fontSize: big ? 15 : 14, fontWeight: 600 }}>{fmtGBP(board.total)}</span>
        </div>
        <div style={{ fontSize: 10.5, color: "var(--ink-faint)", letterSpacing: "0.04em", textTransform: "uppercase", marginTop: 2 }}>
          {board.key === "gp" ? "GP" : "SOV"}{board.sellers ? ` · ${board.sellers} selling` : ""}
        </div>
      </div>

      {!first ? (
        <div className="text-xs text-center py-7" style={{ color: "var(--ink-faint)" }}>Nothing this period.</div>
      ) : (
        <div style={{ padding: "12px 14px 14px" }}>
          {/* Winner — full width, ringed, larger figure */}
          <div className="rounded-xl" style={{
            background: MEDAL[0].bg, border: `1px solid ${MEDAL[0].ring}`,
            padding: big ? "12px 13px" : "10px 12px", marginBottom: 8,
          }}>
            <div className="flex items-center gap-2">
              <Trophy size={big ? 16 : 14} style={{ color: MEDAL[0].ink, flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="truncate" style={{ fontSize: big ? 14.5 : 13.5, fontWeight: 600 }}>{first.name}</div>
                <div className="truncate" style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>{first.team}</div>
              </div>
              <span className="sw-mono shrink-0" style={{ fontSize: big ? 19 : 16, fontWeight: 700, letterSpacing: "-0.02em" }}>
                {fmtGBP(first.value)}
              </span>
            </div>
            <div className="rounded-full" style={{ height: 3.5, background: "rgba(0,0,0,0.07)", marginTop: 8, overflow: "hidden" }}>
              <div className="rounded-full sw-bar-anim" style={{ width: "100%", height: "100%", background: board.accent }} />
            </div>
          </div>

          {/* Second and third, side by side */}
          {(second || third) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {second ? <Runner r={second} i={1} /> : <div />}
              {third ? <Runner r={third} i={2} /> : <div />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TopsView({ netsuite, staff }) {
  const aliases = useAliases();
  const statusCfg = useStatusCfg();

  // Period defaults to MTD and stays there until it's actually changed —
  // the board is a "how are we doing this month" screen first.
  const [period, setPeriod] = useState("mtd");
  const [split, setSplit] = useState("both");        // both | table | cards
  // Which product columns the everyone-table shows. Parents on, children
  // off, so the default is readable and can be drilled into.
  const [cols, setCols] = useState(() => ({ gp: true, sov: true, cloud: true, connectivity: true, mobile: true }));
  const [sortBy, setSortBy] = useState("sov");
  /* Column order is held separately from which are ticked, so hiding a
     column and bringing it back doesn't lose where you put it. */
  const [colOrder, setColOrder] = useState(() => ["gp", "sov", ...TOPS_COLUMNS.map((c) => c.key)]);
  const [dragKey, setDragKey] = useState(null);

  const teamByName = useMemo(() => {
    const m = {};
    (staff || []).forEach((s) => {
      if (!s.full_name || !s.team) return;
      m[nameKey(s.full_name)] = s.team;
      if (s.alt_name) m[nameKey(s.alt_name)] = s.team;
    });
    return m;
  }, [staff]);
  const canon = useCallback((n) => resolveName(n, aliases), [aliases]);
  const teamOf = useCallback((n, fb) => {
    if (!n) return fb || "—";
    return teamByName[nameKey(canon(n))] || teamByName[nameKey(n)] || fb || "—";
  }, [teamByName, canon]);

  /* One pass over the New Net rows builds everything: per-person GP, SOV
     and SOV per product leaf. Both halves of the page read off this, so
     the cards and the table can never disagree. */
  const people = useMemo(() => {
    const inP = periodTest(period);
    const by = {};
    const touch = (name, team) => {
      const c = canon(name);
      const k = nameKey(c);
      if (!k) return null;
      if (!by[k]) by[k] = { name: c, team: teamOf(name, team), gp: 0, sov: 0, deals: 0, prod: {} };
      return by[k];
    };
    (netsuite || []).forEach((n) => {
      if (!isNewNet(n, statusCfg)) return;
      if (!inP(n.order_date ? n.order_date + "T00:00:00" : null)) return;
      const sov = n.count_sov === false ? 0 : num(n.contract_value);
      const leaf = bucketOfNs(n);
      // The closer carries the deal's SOV; the lead gen is credited GP
      // only, so office SOV isn't counted twice across the two of them.
      const c = touch(n.closer_name, n.closer_team);
      if (c) {
        c.gp += num(n.closer_gp);
        c.sov += sov;
        c.deals += 1;
        c.prod[leaf] = (c.prod[leaf] || 0) + sov;
      }
      if (n.referrer_name) {
        const r = touch(n.referrer_name, n.referrer_team);
        if (r) { r.gp += num(n.referrer_gp); r.deals += 1; }
      }
    });
    // Roll children up into their parents once, at the end.
    Object.values(by).forEach((p) => {
      Object.entries(TOPS_LEAVES).forEach(([parent, leaves]) => {
        p.prod[parent] = leaves.reduce((s, k) => s + (p.prod[k] || 0), 0);
      });
    });
    return Object.values(by).filter((p) => p.gp > 0 || p.sov > 0);
  }, [netsuite, statusCfg, period, canon, teamOf]);

  const grand = useMemo(() => ({
    gp: people.reduce((s, p) => s + p.gp, 0),
    sov: people.reduce((s, p) => s + p.sov, 0),
  }), [people]);

  /* Boards are deliberately independent of the table's column tickboxes —
     the podium is the celebration half of the page and shouldn't empty out
     because someone was tidying up the table next to it. GP and SOV always
     lead, then whichever products have anything in them. */
  const podium = useCallback((valueOf) => {
    const rows = people
      .map((p) => ({ name: p.name, team: p.team, value: valueOf(p) }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);
    return { rows: rows.slice(0, 3), total: rows.reduce((s, r) => s + r.value, 0), sellers: rows.length };
  }, [people]);

  const headlineBoards = useMemo(() => ([
    { key: "gp",  label: "Top GP",  accent: "var(--green)",   ...podium((p) => p.gp) },
    { key: "sov", label: "Top SOV", accent: "var(--primary)", ...podium((p) => p.sov) },
  ]), [podium]);

  const boards = useMemo(
    () => TOPS_COLUMNS.map((c) => ({ ...c, ...podium((p) => p.prod[c.key] || 0) })),
    [podium]
  );

  // GP and SOV behave like any other column now — orderable and hideable
  const ALL_COLS = useMemo(() => ([
    { key: "gp", label: "GP", accent: "var(--green)", value: (p) => p.gp },
    { key: "sov", label: "SOV", accent: "var(--primary)", value: (p) => p.sov },
    ...TOPS_COLUMNS.map((c) => ({ ...c, value: (p) => p.prod[c.key] || 0 })),
  ]), []);

  const activeCols = useMemo(() => {
    const byKey = {};
    ALL_COLS.forEach((c) => { byKey[c.key] = c; });
    return colOrder.map((k) => byKey[k]).filter((c) => c && cols[c.key]);
  }, [ALL_COLS, colOrder, cols]);

  const moveCol = useCallback((key, dir) => {
    setColOrder((order) => {
      const i = order.indexOf(key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= order.length) return order;
      const next = [...order];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }, []);

  const dropOn = useCallback((targetKey) => {
    setColOrder((order) => {
      if (!dragKey || dragKey === targetKey) return order;
      const next = order.filter((k) => k !== dragKey);
      const at = next.indexOf(targetKey);
      if (at < 0) return order;
      next.splice(at, 0, dragKey);
      return next;
    });
    setDragKey(null);
  }, [dragKey]);

  const tableRows = useMemo(() => {
    const v = (p) => (sortBy === "gp" ? p.gp : sortBy === "sov" ? p.sov : (p.prod[sortBy] || 0));
    return [...people].sort((a, b) => v(b) - v(a));
  }, [people, sortBy]);


  const toggleCol = (k) => setCols((c) => ({ ...c, [k]: !c[k] }));
  // Tinted rank chips read as quieter than solid gold/silver/bronze fills
  const MEDAL_INK = ["#7A5C00", "#5A5A5A", "#7A4A1F"];
  const MEDAL_BG = ["rgba(184,134,11,0.16)", "rgba(138,138,138,0.16)", "rgba(160,100,42,0.16)"];
  const showTable = split === "both" || split === "table";
  const showCards = split === "both" || split === "cards";

  const SortHead = ({ k, label, align = "right", accent }) => (
    <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wide"
      style={{ textAlign: align, color: sortBy === k ? (accent || "var(--primary)") : "var(--ink-soft)", cursor: "pointer", whiteSpace: "nowrap" }}
      onClick={() => setSortBy(k)} title={`Sort by ${label}`}>
      {label}{sortBy === k ? " ▾" : ""}
    </th>
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <Trophy size={18} style={{ color: "var(--primary)" }} />
        <h2 className="sw-display text-lg font-bold">Tops</h2>
        <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
          NetSuite New Net, {fyLabel(NEW_NET_FIRST_FY)} onwards · products ranked on SOV
        </span>
      </div>

      {/* Period + what's on screen. Period sits first because it governs
          both halves; it stays on MTD until deliberately changed. */}
      <div className="rounded-xl mb-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2 px-3 py-2.5 flex-wrap">
          <PeriodSelect value={period} onChange={setPeriod} width={148} />
          <span className="text-xs" style={{ color: "var(--ink-faint)" }}>{periodLabelFor(period)}</span>

          <div className="flex items-center rounded-lg overflow-hidden ml-auto" style={{ border: "1px solid var(--border)", height: 32 }}>
            {[["both", "Both"], ["table", "Everyone"], ["cards", "Top 3"]].map(([k, lbl]) => (
              <button key={k} onClick={() => setSplit(k)}
                className="sw-focus px-3 text-xs whitespace-nowrap"
                style={split === k
                  ? { background: "var(--primary)", color: "#fff", fontWeight: 600, height: "100%" }
                  : { background: "transparent", color: "var(--ink-faint)", height: "100%" }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Half the page each when both are on. Inline grid on purpose —
          critical layout, no Tailwind JIT dependence. */}
      <div className="sw-cols" style={{
        display: "grid",
        gridTemplateColumns: split === "both" ? "minmax(0, 1fr) minmax(0, 1fr)" : "minmax(0, 1fr)",
        gap: "0.75rem", alignItems: "start",
      }}>

        {/* ---- Everyone, with the columns you pick ---- */}
        {showTable && (
        <div>
          {/* Column picker sits directly above the table it controls.
              Drag a chip to reorder, or use the arrows — the table follows.
              This does not touch the top-3 boards. */}
          <div className="rounded-xl mb-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="px-3 py-2.5">
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-xs font-semibold uppercase" style={{ color: "var(--ink-faint)", letterSpacing: "0.04em" }}>
                  Table columns
                </span>
                <button onClick={() => {
                    setCols({ gp: true, sov: true, cloud: true, connectivity: true, mobile: true });
                    setColOrder(["gp", "sov", ...TOPS_COLUMNS.map((c) => c.key)]);
                  }}
                  className="sw-focus text-xs" style={{ color: "var(--primary)" }}>Reset</button>
              </div>

              {/* Ticked columns, in table order — drag to rearrange */}
              <div className="flex items-center gap-1.5 flex-wrap mb-2">
                {activeCols.map((c, i) => (
                  <span key={c.key}
                    draggable
                    onDragStart={() => setDragKey(c.key)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => dropOn(c.key)}
                    onDragEnd={() => setDragKey(null)}
                    className="flex items-center gap-1 rounded-lg px-1.5 py-1"
                    style={{
                      border: `1px solid ${dragKey === c.key ? c.accent : "var(--border)"}`,
                      background: dragKey === c.key ? "var(--surface-alt)" : "var(--surface)",
                      cursor: "grab", opacity: dragKey === c.key ? 0.5 : 1,
                    }}
                    title="Drag to reorder">
                    <span style={{ fontSize: 11, color: "var(--ink-faint)", cursor: "grab" }}>⠿</span>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: c.accent }}>{c.label}</span>
                    <button onClick={() => moveCol(c.key, -1)} disabled={i === 0}
                      className="sw-focus" style={{ fontSize: 10, color: i === 0 ? "var(--border)" : "var(--ink-faint)", padding: "0 1px" }}
                      title="Move left">◀</button>
                    <button onClick={() => moveCol(c.key, 1)} disabled={i === activeCols.length - 1}
                      className="sw-focus" style={{ fontSize: 10, color: i === activeCols.length - 1 ? "var(--border)" : "var(--ink-faint)", padding: "0 1px" }}
                      title="Move right">▶</button>
                    <button onClick={() => toggleCol(c.key)} className="sw-focus"
                      style={{ fontSize: 11, color: "var(--ink-faint)", paddingLeft: 2 }} title="Hide this column">✕</button>
                  </span>
                ))}
                {activeCols.length === 0 && (
                  <span className="text-xs" style={{ color: "var(--ink-faint)" }}>No columns — tick some below.</span>
                )}
              </div>

              {/* Everything available, including anything hidden */}
              <div className="flex items-center gap-x-3 gap-y-1.5 flex-wrap" style={{ borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                <div className="flex items-center gap-2.5 rounded-lg px-2 py-1" style={{ border: "1px solid var(--border)" }}>
                  {[["gp", "GP", "var(--green)"], ["sov", "SOV", "var(--primary)"]].map(([k, lbl, accent]) => (
                    <label key={k} className="flex items-center gap-1.5" style={{ cursor: "pointer" }}>
                      <input type="checkbox" checked={!!cols[k]} onChange={() => toggleCol(k)} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: accent }}>{lbl}</span>
                    </label>
                  ))}
                </div>
                {TOPS_TREE.map((g) => (
                  <div key={g.key} className="flex items-center gap-2.5 rounded-lg px-2 py-1"
                    style={{ border: "1px solid var(--border)" }}>
                    <label className="flex items-center gap-1.5" style={{ cursor: "pointer" }}>
                      <input type="checkbox" checked={!!cols[g.key]} onChange={() => toggleCol(g.key)} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: g.accent }}>{g.label}</span>
                    </label>
                    {g.children.map((c) => (
                      <label key={c.key} className="flex items-center gap-1" style={{ cursor: "pointer" }}>
                        <input type="checkbox" checked={!!cols[c.key]} onChange={() => toggleCol(c.key)} />
                        <span style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>{c.label}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <ListTotalsStrip gp={grand.gp} sov={grand.sov} count={people.length} label={periodLabelFor(period)} />

          <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div style={{ overflowX: "auto" }}>
              <table className="w-full text-sm sw-orders">
                <thead>
                  <tr style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)" }}>
                    <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Agent</th>
                    {activeCols.map((c) => <SortHead key={c.key} k={c.key} label={c.label} accent={c.accent} />)}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((p, i) => {
                    // The podium only means something on the column being
                    // sorted by, and only when that person actually has a
                    // figure in it — a medal against zero looks silly.
                    const sortVal = sortBy === "gp" ? p.gp : sortBy === "sov" ? p.sov : (p.prod[sortBy] || 0);
                    const place = i < 3 && sortVal > 0 ? i : -1;
                    const MEDAL = [
                      { ink: "#7A5C00", bg: "rgba(184,134,11,0.16)", tint: "rgba(184,134,11,0.06)" },
                      { ink: "#5A5A5A", bg: "rgba(138,138,138,0.16)", tint: "rgba(138,138,138,0.05)" },
                      { ink: "#7A4A1F", bg: "rgba(160,100,42,0.16)", tint: "rgba(160,100,42,0.05)" },
                    ];
                    return (
                      <tr key={p.name} style={{
                        borderTop: "1px solid var(--border)",
                        background: place >= 0 ? MEDAL[place].tint : "transparent",
                      }}>
                        <td className="px-3 py-2" style={place === 0 ? { boxShadow: "inset 2px 0 0 #B8860B" } : undefined}>
                          <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
                            {place >= 0 ? (
                              <span className="shrink-0" style={{
                                width: 19, height: 19, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 10, fontWeight: 700, color: MEDAL[place].ink, background: MEDAL[place].bg,
                              }}>{i + 1}</span>
                            ) : (
                              <span className="sw-mono shrink-0 text-center" style={{ fontSize: 11, color: "var(--ink-faint)", width: 19 }}>{i + 1}</span>
                            )}
                            <div style={{ minWidth: 0 }}>
                              <div className="truncate flex items-center gap-1.5" style={{ fontSize: 13, fontWeight: place === 0 ? 700 : 600 }}>
                                {p.name}
                                {place === 0 && <Trophy size={11} style={{ color: MEDAL[0].ink, flexShrink: 0 }} />}
                              </div>
                              <div className="text-xs truncate" style={{ color: "var(--ink-faint)" }}>{p.team}</div>
                            </div>
                          </div>
                        </td>
                        {activeCols.map((c) => {
                          const v = c.value(p);
                          const isSorted = sortBy === c.key;
                          return (
                            <td key={c.key} className="px-2 py-2 sw-mono text-xs text-right"
                              style={{
                                color: v > 0 ? (isSorted ? "var(--ink)" : "var(--ink-soft)") : "var(--ink-faint)",
                                fontWeight: isSorted ? 700 : (c.key === "gp" || c.key === "sov" ? 600 : 400),
                                background: isSorted ? "var(--surface-alt)" : "transparent",
                              }}>
                              {v > 0 ? fmtGBP(v) : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {tableRows.length === 0 && (
                    <tr><td colSpan={1 + activeCols.length} className="px-4 py-10 text-center" style={{ color: "var(--ink-faint)" }}>
                      Nothing on the New Net list for this period.
                    </td></tr>
                  )}
                </tbody>
                {tableRows.length > 0 && (
                  <tfoot>
                    <tr style={{ borderTop: "2px solid var(--border)", background: "var(--surface-alt)" }}>
                      <td className="px-3 py-2 text-xs font-semibold uppercase" style={{ color: "var(--ink-soft)", letterSpacing: "0.04em" }}>Total</td>
                      {activeCols.map((c) => (
                        <td key={c.key} className="px-2 py-2 sw-mono text-xs text-right" style={{ fontWeight: 700, color: c.accent }}>
                          {fmtGBP(people.reduce((s, p) => s + c.value(p), 0))}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
        )}

        {/* ---- Top 3 boards ---- */}
        {showCards && (
        <div>
          {/* GP and SOV always lead — they're the two figures everyone
              actually cares about, and they don't depend on the table's
              column tickboxes. */}
          <div className="sw-cols-2" style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", alignItems: "start", marginBottom: "0.75rem",
          }}>
            {headlineBoards.map((b) => <PodiumCard key={b.key} board={b} big />)}
          </div>

          {/* Products beneath. Anything with sales shows; empty ones are
              hidden rather than rendering a card saying nothing. */}
          <div className="sw-cols-2" style={{
            display: "grid",
            gridTemplateColumns: split === "cards" ? "repeat(auto-fit, minmax(260px, 1fr))" : "repeat(auto-fit, minmax(230px, 1fr))",
            gap: "0.75rem", alignItems: "start",
          }}>
            {boards.filter((b) => b.rows.length > 0).map((b) => (
              <PodiumCard key={b.key} board={b} />
            ))}
          </div>

          {boards.filter((b) => b.rows.length > 0).length === 0 && headlineBoards.every((b) => b.rows.length === 0) && (
            <div className="rounded-xl text-xs text-center py-10" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--ink-faint)" }}>
              Nothing on the New Net list for this period.
            </div>
          )}
        </div>
        )}
      </div>

      <p className="text-xs mt-3 px-1" style={{ color: "var(--ink-faint)" }}>
        Product boards rank on SOV; the table carries GP and SOV as well, and any column heading sorts it.
        Cloud is Cloud Voice plus DV4B; Connectivity is Broadband, BT Net, Security and Data Networks — parents
        always equal the sum of their children. SOV is credited to the closer so the office isn't counted twice,
        while GP is split between closer and lead gen. Scored on NetSuite New Net only, never Lilac claims.
      </p>
    </div>
  );
}

function DistributionView({ orders, netsuite, staff }) {
  const aliases = useAliases();

  // Resolve an agent's team from the staff record rather than trusting the
  // team stored on the order — that's what was leaving people "Unassigned"
  // when their NetSuite spelling differed from the staff list.
  const teamByName = useMemo(() => {
    const m = {};
    (staff || []).forEach((s) => {
      if (!s.full_name || !s.team) return;
      m[nameKey(s.full_name)] = s.team;
      if (s.alt_name) m[nameKey(s.alt_name)] = s.team;
    });
    return m;
  }, [staff]);

  const canonName = useCallback((n) => resolveName(n, aliases), [aliases]);
  const teamOf = useCallback((name, fallback) => {
    if (!name) return fallback || "Unassigned";
    const canon = canonName(name);
    return teamByName[nameKey(canon)] || teamByName[nameKey(name)] || fallback || "Unassigned";
  }, [teamByName, canonName]);

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
    const inP = periodTest(period);
    return (orders || []).filter((o) => {
      if (o.removed_at) return false;
      if (!o.closer_name || !o.lead_gen_name) return false;
      if (!inP(o.submission_date)) return false;
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
      const c = canonName(o.closer_name), l = canonName(o.lead_gen_name);
      const v = metric === "gp"
        ? num(o.gp_office != null ? o.gp_office : o.sales_agent_gp)
        : 1;
      const k = `${c}||${l}`;
      cell[k] = (cell[k] || 0) + v;
      closerTotal[c] = (closerTotal[c] || 0) + v;
      leadGenTotal[l] = (leadGenTotal[l] || 0) + v;
      grand += v;

      const ct = teamOf(o.closer_name, o.closer_team);
      const lt = teamOf(o.lead_gen_name, o.lead_gen_team);
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
  }, [pairs, metric, canonName, teamOf]);

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
          <PeriodSelect value={period} onChange={setPeriod} width={148} />
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
/*  TOP BAR NAVIGATION                                                     */
/* ---------------------------------------------------------------------- */

function NavLink({ icon: Icon, label, active, badge, onClick, href, tint }) {
  /* `tint` gives a tab a faint coloured backing when it isn't the active
     one, so Claimed and Sales Delivery read as one group and Forecasting
     as another without needing separators. */
  const TINTS = {
    purple: { bg: "var(--primary-soft)", fg: "var(--primary)" },
    green: { bg: "var(--green-soft)", fg: "var(--green)" },
  };
  const t = tint ? TINTS[tint] : null;
  const style = {
    background: active ? (t ? t.fg : "var(--primary)") : (t ? t.bg : "transparent"),
    color: active ? "#fff" : (t ? t.fg : "var(--ink-soft)"),
    height: 34,
  };
  const cls = "sw-focus flex items-center gap-1.5 px-3 rounded-lg text-sm font-medium whitespace-nowrap";
  const body = (
    <>
      {Icon && <Icon size={14} className="shrink-0" />}
      {label}
      {badge > 0 && (
        <span className="rounded-full px-1.5 text-xs font-bold" style={{ background: "var(--amber)", color: "#fff" }}>{badge}</span>
      )}
    </>
  );
  if (href) return <a href={href} onClick={onClick} className={cls} style={style}>{body}</a>;
  return <button onClick={onClick} className={cls} style={style}>{body}</button>;
}

/* A nav group that opens on click. Closes when you pick something, click
   away, or press Escape. */
function NavMenu({ icon: Icon, label, childActive, badge, items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen((v) => !v)}
        className="sw-focus flex items-center gap-1.5 px-3 rounded-lg text-sm font-medium whitespace-nowrap"
        style={{
          height: 34,
          background: childActive ? "var(--primary-soft)" : "transparent",
          color: childActive ? "var(--primary)" : "var(--ink-soft)",
        }}>
        {Icon && <Icon size={14} className="shrink-0" />}
        {label}
        {badge > 0 && (
          <span className="rounded-full px-1.5 text-xs font-bold" style={{ background: "var(--amber)", color: "#fff" }}>{badge}</span>
        )}
        <ChevronDown size={13} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s", opacity: 0.6 }} />
      </button>

      {open && (
        <div className="rounded-xl overflow-hidden"
          style={{
            position: "absolute", top: 40, left: 0, minWidth: 210, zIndex: 60,
            background: "var(--surface)", border: "1px solid var(--border)",
            boxShadow: "0 8px 28px rgba(29,26,46,0.12)",
          }}>
          {items.map((it) => (
            it.href ? (
              <a key={it.label} href={it.href} onClick={() => { setOpen(false); it.onClick && it.onClick(); }}
                className="sw-focus flex items-center gap-2 px-3 py-2 text-sm"
                style={{ color: "var(--ink-soft)" }}>
                {it.icon && <it.icon size={14} />} {it.label}
              </a>
            ) : (
              <button key={it.label} onClick={() => { setOpen(false); it.onClick(); }}
                className="sw-focus w-full flex items-center gap-2 px-3 py-2 text-sm text-left"
                style={{
                  background: it.active ? "var(--primary-soft)" : "transparent",
                  color: it.active ? "var(--primary)" : "var(--ink-soft)",
                  fontWeight: it.active ? 600 : 400,
                }}>
                {it.icon && <it.icon size={14} />} {it.label}
                {it.badge > 0 && (
                  <span className="ml-auto rounded-full px-1.5 text-xs font-bold" style={{ background: "var(--amber)", color: "#fff" }}>{it.badge}</span>
                )}
              </button>
            )
          ))}
        </div>
      )}
    </div>
  );
}

function TopBar({ tab, setTab, profile, newStatusCount, onChangePassword, onSignOut, mobileOpen, setMobileOpen }) {
  const isOffice = profile?.role === "office";
  const isDelivery = profile?.role === "sd" || profile?.role === "sd_2ic";
  const canSeeDelivery = isOffice || isDelivery;
  const go = (t) => () => { setTab(t); setMobileOpen(false); };

  const dashboards = [
    { label: "Tops", icon: Trophy, active: tab === "tops", onClick: go("tops") },
    { label: "Day by Day", icon: CalendarDays, active: tab === "daybyday", onClick: go("daybyday") },
    { label: "Sales Breakdown", icon: BarChart3, active: tab === "breakdown", onClick: go("breakdown") },
    { label: "Sales Distribution", icon: Users, active: tab === "distribution", onClick: go("distribution") },
    { label: "TV Mode", icon: Radio, href: "#tv", onClick: () => setTimeout(() => window.location.reload(), 0) },
  ];
  const submissions = [
    { label: "Submit Lilac Box", icon: Plus, active: tab === "new", onClick: go("new") },
    { label: "Landscapes", icon: MapPin, active: tab === "landscapes", onClick: go("landscapes") },
    { label: "Quote Builder", icon: FileText, active: tab === "quote", onClick: go("quote") },
  ];
  const settings = [
    { label: "Sales Agents", icon: Users, active: tab === "admin", onClick: go("admin") },
    { label: "Settings", icon: Palette, active: tab === "statuses", badge: newStatusCount, onClick: go("statuses") },
    { label: "Change Password", icon: KeyRound, onClick: () => { onChangePassword(); setMobileOpen(false); } },
  ];

  const dashActive = ["tops", "daybyday", "breakdown", "distribution"].includes(tab);
  const subActive = ["new", "landscapes", "quote"].includes(tab);
  const setActive = ["admin", "statuses"].includes(tab);

  return (
    <header style={{ position: "sticky", top: 0, zIndex: 50, background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2 px-4" style={{ height: 54 }}>

        <div className="flex items-center gap-2.5 shrink-0">
          <Logo height={26} />
          <span className="sw-display sw-hide-sm" style={{ fontWeight: 600, fontSize: 14, letterSpacing: "-0.015em" }}>SchThrive</span>
        </div>

        <span className="sw-hide-sm" style={{ width: 1, height: 22, background: "var(--border)", marginLeft: 6, marginRight: 2 }} />

        {/* Desktop nav */}
        <nav className="sw-hide-sm flex items-center gap-1">
          <NavLink icon={ClipboardList} label="Claimed" active={tab === "dashboard"} onClick={go("dashboard")} tint="purple" />
          {canSeeDelivery && (
            <NavLink icon={Inbox} label="Sales Delivery" active={tab === "delivery"} onClick={go("delivery")} tint="purple" />
          )}
          <NavLink icon={TrendingUp} label="Forecasting" active={tab === "forecast"} onClick={go("forecast")} tint="green" />
          <NavMenu icon={LayoutDashboard} label="Dashboards" childActive={dashActive} items={dashboards} />
          <NavMenu icon={Inbox} label="Submission Boxes" childActive={subActive} items={submissions} />
          <NavLink icon={Headphones} label="Sales Coach" active={tab === "coach"} onClick={go("coach")} />
          {isOffice && (
            <NavMenu icon={SettingsIcon} label="Settings" childActive={setActive} badge={newStatusCount} items={settings} />
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          <span className="sw-hide-sm text-xs" style={{ color: "var(--ink-faint)" }}>
            {ROLE_LABELS[profile?.role] || "Agent"}
            {profile?.team ? ` · ${profile.team}` : ""}
          </span>
          <button onClick={onSignOut} title="Sign out" className="sw-focus p-1.5 rounded-lg" style={{ color: "var(--ink-faint)" }}>
            <LogOut size={16} />
          </button>
          {/* Mobile toggle */}
          <button onClick={() => setMobileOpen(!mobileOpen)} className="sw-menu-btn sw-focus p-1.5 rounded-lg"
            style={{ color: "var(--ink-soft)" }} aria-label="Menu">
            <Menu size={18} />
          </button>
        </div>
      </div>

      {/* Mobile nav — everything flat, no nested menus to fight with */}
      {mobileOpen && (
        <div className="sw-menu-panel px-3 pb-3" style={{ borderTop: "1px solid var(--border)" }}>
          {[
            { heading: null, items: [
              { label: "Claimed", icon: ClipboardList, active: tab === "dashboard", onClick: go("dashboard") },
              ...(canSeeDelivery ? [{ label: "Sales Delivery", icon: Inbox, active: tab === "delivery", onClick: go("delivery") }] : []),
              { label: "Forecasting", icon: TrendingUp, active: tab === "forecast", onClick: go("forecast") },
            ] },
            { heading: "Dashboards", items: dashboards },
            { heading: "Submission Boxes", items: submissions },
            { heading: null, items: [{ label: "Sales Coach", icon: Headphones, active: tab === "coach", onClick: go("coach") }] },
            ...(isOffice ? [{ heading: "Settings", items: settings }] : []),
          ].map((group, gi) => (
            <div key={gi} className="mt-2">
              {group.heading && (
                <div className="text-xs font-medium uppercase px-1 mb-1" style={{ color: "var(--ink-faint)", letterSpacing: "0.04em" }}>{group.heading}</div>
              )}
              {group.items.map((it) => (
                it.href ? (
                  <a key={it.label} href={it.href} onClick={() => { setMobileOpen(false); it.onClick && it.onClick(); }}
                    className="sw-focus flex items-center gap-2 px-2 py-2 rounded-lg text-sm" style={{ color: "var(--ink-soft)" }}>
                    {it.icon && <it.icon size={14} />} {it.label}
                  </a>
                ) : (
                  <button key={it.label} onClick={it.onClick}
                    className="sw-focus w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-left"
                    style={{
                      background: it.active ? "var(--primary-soft)" : "transparent",
                      color: it.active ? "var(--primary)" : "var(--ink-soft)",
                      fontWeight: it.active ? 600 : 400,
                    }}>
                    {it.icon && <it.icon size={14} />} {it.label}
                    {it.badge > 0 && (
                      <span className="ml-auto rounded-full px-1.5 text-xs font-bold" style={{ background: "var(--amber)", color: "#fff" }}>{it.badge}</span>
                    )}
                  </button>
                )
              ))}
            </div>
          ))}
        </div>
      )}
    </header>
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
  const [planTiers, setPlanTiers] = useState([]);
  const [planMetrics, setPlanMetrics] = useState([]);
  const [planHistory, setPlanHistory] = useState([]);
  const [planTablesMissing, setPlanTablesMissing] = useState(false);
  const [planError, setPlanError] = useState("");
  const [forecasts, setForecasts] = useState([]);
  const [aliases, setAliases] = useState([]);
  // Several datasets are only needed on one tab. Loading them all at sign-in
  // made first paint noticeably slower, so they're fetched the first time
  // their tab is opened and cached from then on.
  const loadedOnce = useRef({});
  const loadWhenNeeded = useCallback((key, needed, fn) => {
    if (!needed || loadedOnce.current[key]) return;
    loadedOnce.current[key] = true;
    fn();
  }, []);
  const [appSettings, setAppSettings] = useState({});
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
  const [menuOpen, setMenuOpen] = useState(false);   // mobile sidebar
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

  // Small key/value settings — currently just which team does delivery
  const loadAppSettings = useCallback(async () => {
    const { data } = await supabase.from("app_settings").select("*");
    const m = {};
    (data || []).forEach((r) => { m[r.key] = r.value; });
    setAppSettings(m);
  }, []);
  useEffect(() => { if (session?.user) loadAppSettings(); }, [session, loadAppSettings]);

  const deliveryTeam = appSettings.delivery_team || "Tracy Webber";

  // Unplaced / progressing orders from the NetSuite workbook
  const [unplaced, setUnplaced] = useState([]);
  const loadUnplaced = useCallback(async () => {
    const { data } = await supabase.from("unplaced_orders").select("*")
      .order("order_date", { ascending: false }).limit(5000);
    setUnplaced(data || []);
  }, []);
  useEffect(() => {
    loadWhenNeeded("unplaced", session?.user && tab === "delivery", loadUnplaced);
  }, [session, tab, loadUnplaced, loadWhenNeeded]);

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
      if (s.alt_name && s.full_name) m[nameKey(s.alt_name)] = s.full_name;
      // The staff name itself, normalised — catches double spaces in the data
      if (s.full_name) m[nameKey(s.full_name)] = s.full_name;
    });
    aliases.forEach((a) => { if (a.alias) m[nameKey(a.alias)] = a.staff_full_name; });
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

  // Call stages for the coach
  const [coachStages, setCoachStages] = useState([]);
  const loadCoachStages = useCallback(async () => {
    const { data } = await supabase.from("coach_stages").select("*").order("sort_order");
    setCoachStages(data || []);
  }, []);
  useEffect(() => {
    loadWhenNeeded("coachStages", session?.user && (tab === "coach" || tab === "statuses"), loadCoachStages);
  }, [session, tab, loadCoachStages, loadWhenNeeded]);

  const saveCoachStage = useCallback(async (id, patch) => {
    const { error } = await supabase.from("coach_stages").update(patch).eq("id", id);
    if (error) { setToast(`Couldn't save stage: ${error.message}`); setTimeout(() => setToast(""), 8000); return; }
    loadCoachStages();
  }, [loadCoachStages]);

  const addCoachStage = useCallback(async (scenarioKey, count) => {
    const { error } = await supabase.from("coach_stages").insert({
      scenario_key: scenarioKey,
      key: `stage_${Date.now().toString(36)}`,
      label: "New stage",
      max_turns: 6,
      sort_order: (count + 1) * 10,
    });
    if (error) { setToast(`Couldn't add stage: ${error.message}`); setTimeout(() => setToast(""), 8000); return; }
    loadCoachStages();
  }, [loadCoachStages]);

  const deleteCoachStage = useCallback(async (id, label) => {
    if (!window.confirm(`Delete the "${label}" stage?`)) return;
    await supabase.from("coach_stages").delete().eq("id", id);
    loadCoachStages();
  }, [loadCoachStages]);

  // Sales Coach scenarios and grading, editable in Settings
  const loadCoachCfg = useCallback(async () => {
    const [{ data: sc }, { data: st }] = await Promise.all([
      supabase.from("coach_scenarios").select("*").order("sort_order"),
      supabase.from("coach_settings").select("*").eq("id", 1).maybeSingle(),
    ]);
    setCoachScenarios(sc || []);
    if (st) setCoachSettings(st);
  }, []);
  useEffect(() => {
    loadWhenNeeded("coachCfg", session?.user && (tab === "coach" || tab === "statuses"), loadCoachCfg);
  }, [session, tab, loadCoachCfg, loadWhenNeeded]);

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
  // Plans themselves drive the KPI targets, so they load with everything
  // else. Tiers, KPIs and assignment history are only read on the settings
  // and admin pages, so they wait until one of those is opened.
  const loadPayPlans = useCallback(async () => {
    const { data } = await supabase.from("pay_plans").select("*").order("name");
    setPayPlans(data || []);
  }, []);

  const loadPlanDetail = useCallback(async () => {
    const [tiers, metrics, history] = await Promise.all([
      supabase.from("pay_plan_tiers").select("*").order("sort_order"),
      supabase.from("pay_plan_metrics").select("*").order("sort_order"),
      supabase.from("staff_pay_plans").select("*").order("effective_from", { ascending: false }),
    ]);
    setPlanTiers(tiers.data || []);
    setPlanMetrics(metrics.data || []);
    setPlanHistory(history.data || []);
    // Say so once rather than silently rendering an empty tier list that
    // looks like a broken button.
    setPlanTablesMissing(!!tiers.error);
  }, []);

  // --- Tier / metric / assignment editing -----------------------------
  // A missing table or an RLS refusal both surface as opaque Postgres
  // errors, so they're translated into something actionable here.
  const explainDbError = useCallback((error, what) => {
    const msg = String(error?.message || error || "");
    if (/relation .* does not exist|Could not find the table|schema cache/i.test(msg)) {
      return `${what} needs the pay plan tables. Run add_pay_plan_tiers.sql in the Supabase SQL editor, then reload.`;
    }
    if (/row-level security|permission denied|violates row-level/i.test(msg)) {
      return `${what} was blocked by the database's security rules. This usually means the
        migration created the tables but not their access policies — run add_coach_v2.sql
        and add_pay_plan_tiers_v2.sql again with the app closed in other tabs.`;
    }
    return `${what} failed: ${msg}`;
  }, []);

  const savePlanTier = useCallback(async (id, patch) => {
    const { error } = await supabase.from("pay_plan_tiers").update(patch).eq("id", id);
    if (error) { setToast(explainDbError(error, "Saving the tier")); setTimeout(() => setToast(""), 12000); return; }
    loadPlanDetail();
  }, [loadPlanDetail, explainDbError]);

  const addPlanTier = useCallback(async (planId) => {
    setPlanError("");
    if (!planId) { setPlanError("Select a plan on the left first."); return; }
    const { error } = await supabase.from("pay_plan_tiers")
      .insert({ plan_id: planId, label: "New tier", gp_min: 0, payment_pct: 0, sort_order: 999 });
    if (error) {
      // Shown inline next to the button, not as a toast that vanishes
      setPlanError(explainDbError(error, "Adding a tier"));
      return;
    }
    loadPlanDetail();
  }, [loadPlanDetail, explainDbError]);

  const deletePlanTier = useCallback(async (id) => {
    await supabase.from("pay_plan_tiers").delete().eq("id", id);
    loadPlanDetail();
  }, [loadPlanDetail]);

  const addPlanMetric = useCallback(async (planId, key, label, unit) => {
    const { error } = await supabase.from("pay_plan_metrics").insert({ plan_id: planId, key, label, unit, sort_order: 100 });
    if (error) { setToast(explainDbError(error, "Adding a KPI")); setTimeout(() => setToast(""), 12000); return; }
    loadPlanDetail();
  }, [loadPlanDetail, explainDbError]);

  const deletePlanMetric = useCallback(async (id) => {
    await supabase.from("pay_plan_metrics").delete().eq("id", id);
    loadPlanDetail();
  }, [loadPlanDetail]);

  const assignPlan = useCallback(async (staffId, planId, from) => {
    // Close off whatever they were on, then open the new one
    await supabase.from("staff_pay_plans")
      .update({ effective_to: from })
      .eq("staff_id", staffId).is("effective_to", null);
    const { error } = await supabase.from("staff_pay_plans")
      .insert({ staff_id: staffId, pay_plan_id: planId || null, effective_from: from });
    if (error) { setToast(`Couldn't assign: ${error.message}`); setTimeout(() => setToast(""), 5000); return; }
    await supabase.from("staff").update({ pay_plan_id: planId || null }).eq("id", staffId);
    loadPlanDetail(); loadStaff();
  }, [loadPlanDetail, loadStaff]);

  const deleteAssignment = useCallback(async (id) => {
    await supabase.from("staff_pay_plans").delete().eq("id", id);
    loadPlanDetail();
  }, [loadPlanDetail]);
  useEffect(() => { if (session?.user) loadPayPlans(); }, [session, loadPayPlans]);
  useEffect(() => {
    // The ranked list on Claimed needs the tiers too, not just settings
    loadWhenNeeded("planDetail", session?.user && ["dashboard", "statuses", "admin", "payplans"].includes(tab), loadPlanDetail);
  }, [session, tab, loadPlanDetail, loadWhenNeeded]);

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

  // A sheet sync writes hundreds of rows in quick succession, and reloading
  // on each one was re-paging the whole table over and over. Coalesce a
  // burst into a single refresh.
  const reloadTimers = useRef({});
  const debouncedReload = useCallback((key, fn, wait = 1200) => {
    clearTimeout(reloadTimers.current[key]);
    reloadTimers.current[key] = setTimeout(fn, wait);
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    loadOrders();
    const channel = supabase.channel("schthrive-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        debouncedReload("orders", loadOrders);
        if (payload.new?.id) {
          setFlashId(payload.new.id);
          setTimeout(() => setFlashId((f) => (f === payload.new.id ? null : f)), 1600);
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "netsuite_orders" }, () => debouncedReload("netsuite", loadNetsuite))
      .on("postgres_changes", { event: "*", schema: "public", table: "forecasts" }, () => debouncedReload("forecasts", loadForecasts))
      .subscribe();
    // Safety-net refresh every 60s (keeps the wall-mounted TV honest).
    // Realtime does the work; this is a safety net for a dropped socket.
    // Skipped while the tab is hidden — there's nobody watching, and a wall
    // display left open shouldn't poll all night for no reason.
    const poll = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      loadOrders(); loadNetsuite(); loadForecasts();
    }, 120000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
      Object.values(reloadTimers.current).forEach(clearTimeout);
    };
  }, [session, loadOrders, loadNetsuite, loadForecasts, debouncedReload]);

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
  // Allocate an order to someone on the delivery team
  const allocateOrder = useCallback(async (orderId, person, name) => {
    const patch = {
      allocated_to: person?.id || null,
      allocated_to_name: name || null,
      allocated_at: name ? new Date().toISOString() : null,
      allocated_by_name: profile?.full_name || null,
      last_updated: new Date().toISOString(),
    };
    // Moving it to someone puts it in play unless it's already further on
    const { error } = await supabase.from("orders").update(patch).eq("id", orderId);
    if (error) { setToast(`Couldn't allocate: ${error.message}`); setTimeout(() => setToast(""), 5000); return; }
    loadOrders();
  }, [profile, loadOrders]);

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
  /* Who may amend a Lilac Box:
       office            — anything
       sd / sd_2ic       — anything (Sales Delivery handle order amendments)
       2ic               — anything closed by their own team
       the closer        — their own orders
     Matched on closer_id where it exists, falling back to the name, because
     older rows predate closer_id being stamped on submission. */
  const canEditOrder = useCallback((o) => {
    if (!o || !profile) return false;
    if (profile.role === "office" || profile.role === "sd" || profile.role === "sd_2ic") return true;
    if (profile.role === "2ic" && profile.team && (o.closer_team === profile.team || o.lead_gen_team === profile.team)) return true;
    if (o.closer_id && session?.user && o.closer_id === session.user.id) return true;
    if (profile.full_name && o.closer_name && nameKey(o.closer_name) === nameKey(profile.full_name)) return true;
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
    <div className="sw-root" style={{ minHeight: "100vh" }}>
      <style>{STYLE}</style>

      <TopBar tab={tab} setTab={setTab} profile={profile} newStatusCount={newStatusCount}
        onChangePassword={() => { setChangingPassword(true); setMenuOpen(false); }} onSignOut={signOut}
        mobileOpen={menuOpen} setMobileOpen={setMenuOpen} />

      <div style={{ minWidth: 0 }}>
      <main className={`sw-main p-6 mx-auto ${["breakdown", "daybyday", "forecast", "landscapes", "dashboard", "distribution", "admin", "statuses", "delivery", "tops"].includes(tab) ? "max-w-none" : "max-w-6xl"}`}>
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
        {tab === "dashboard" && <DashboardView orders={orders} netsuite={netsuiteResolved} forecasts={forecasts} staff={staff} profiles={allProfiles} payPlans={payPlans} planTiers={planTiers} planMetrics={planMetrics} onNewOrder={() => setTab("new")} onOpenOrder={setSelected} flashId={flashId} profile={profile} loading={loading} />}
        {tab === "new" && <NewSubmissionView onSubmit={handleNewOrder} submitting={submitting} />}
        {tab === "tops" && <TopsView netsuite={netsuiteResolved} staff={staff} />}
        {tab === "daybyday" && <DayByDayView orders={orders} staff={staff} netsuite={netsuiteResolved} />}
        {tab === "breakdown" && <SalesBreakdownView netsuite={netsuiteResolved} />}
        {tab === "distribution" && <DistributionView orders={orders} netsuite={netsuiteResolved} staff={staff} />}
        {tab === "delivery" && (profile?.role === "office" || profile?.role === "sd" || profile?.role === "sd_2ic") && (
          <DeliveryView orders={orders} netsuite={netsuiteResolved} staff={staff} profile={profile} unplaced={unplaced}
            deliveryTeam={deliveryTeam} onAllocate={allocateOrder} onSaveOrder={saveOrder} onOpenOrder={setSelected} />
        )}
        {tab === "forecast" && <ForecastView netsuite={netsuiteResolved} profile={profile} staff={staff} />}
        {tab === "landscapes" && <LandscapesView profile={profile} staff={staff} />}
        {tab === "quote" && <QuoteBuilderView profile={profile} staff={staff} />}
        {tab === "coach" && <SalesCoachView />}
        {tab === "admin" && profile?.role === "office" && <AdminView staff={staff} profiles={allProfiles} onSaveStaff={saveStaff} onAddStaff={addStaff} onSaveProfile={saveProfileRole} onResetPassword={resetPassword} onSetActive={setStaffActive} plans={payPlans}
          netsuite={netsuiteResolved} aliases={aliases} onAddAlias={addAlias} onDeleteAlias={deleteAlias}
          planHistory={planHistory} onAssignPlan={assignPlan} onDeleteAssignment={deleteAssignment}
          planTiers={planTiers} planMetrics={planMetrics} planTablesMissing={planTablesMissing} planError={planError}
          onSavePlan={savePayPlan} onAddPlan={addPayPlan} onDeletePlan={deletePayPlan}
          onSaveTier={savePlanTier} onAddTier={addPlanTier} onDeleteTier={deletePlanTier}
          onAddMetric={addPlanMetric} onDeleteMetric={deletePlanMetric} />}
        {tab === "statuses" && profile?.role === "office" && <SettingsView statusRows={statusRows} onSaveStatus={saveStatusCfg} newCount={newStatusCount}
          coachScenarios={coachScenarios} coachSettings={coachSettings}
          onSaveCoachScenario={saveCoachScenario} onAddCoachScenario={addCoachScenario}
          onDeleteCoachScenario={deleteCoachScenario} onSaveCoachSettings={saveCoachSettings}
          coachStages={coachStages} onSaveStage={saveCoachStage} onAddStage={addCoachStage} onDeleteStage={deleteCoachStage} />}
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
