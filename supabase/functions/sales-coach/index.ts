// supabase/functions/sales-coach/index.ts
//
// Sales roleplay coach — v2.
//
// The big change here is GRADING CALIBRATION. The first version listed
// the grades but never said which one is normal, so the model treated
// grading as fault-finding and marked almost everything as a mistake.
// It now anchors on "good" and has to justify anything worse.
//
// Also: separate stage sets for lead gen and closer calls, a difficulty
// dial on the customer, and bonus moves (the mobile question and friends)
// that get spotted and rewarded.
//
// Deploy:  supabase functions deploy sales-coach

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROVIDER = Deno.env.get("AI_PROVIDER") || "cloudflare";
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const TURN_MODEL = Deno.env.get("ANTHROPIC_TURN_MODEL") || "claude-haiku-4-5-20251001";
const SUMMARY_MODEL = Deno.env.get("ANTHROPIC_SUMMARY_MODEL") || "claude-sonnet-5";
const CF_ACCOUNT = Deno.env.get("CLOUDFLARE_ACCOUNT_ID") || "";
const CF_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN") || "";

async function askModel(system: string, user: string, model: string, maxTokens = 900) {
  if (PROVIDER === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    return (data.content || []).map((c: any) => c.text || "").join("\n");
  }
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
    {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${CF_TOKEN}` },
      body: JSON.stringify({
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        max_tokens: maxTokens,
      }),
    },
  );
  if (!res.ok) throw new Error(`Cloudflare ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data?.result?.response || "";
}

function parseJSON(raw: string) {
  const cleaned = String(raw || "").replace(/```json|```/g, "").trim();
  try { return JSON.parse(cleaned); } catch { /* try harder */ }
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* give up */ } }
  return null;
}

/* ------------------------------------------------------------------ */
/*  How hard the customer is                                           */
/* ------------------------------------------------------------------ */

const DIFFICULTY: Record<string, string> = {
  easy: `You are in a good mood and genuinely open to the conversation. You answer questions willingly and volunteer detail. You only object when something honestly doesn't add up.`,

  normal: `You are a normal business owner taking a call. Mildly guarded for the first exchange or two because you get a lot of these, then perfectly friendly once you can see the agent knows what they're doing. You ANSWER questions properly — with real detail, not one-word replies. You are curious about anything that might save you money or hassle. You raise an objection only occasionally, when one would genuinely occur to you.`,

  hard: `You are busy and have been let down by suppliers before, so you give shorter answers at first and want the agent to get to the point. You still engage properly and answer questions — you are demanding, not obstructive. You never become rude, and you stay on the call as long as the agent is being professional.`,
};

// The single biggest failure mode is a customer who fights every turn and
// tries to end the call. This is non-negotiable regardless of difficulty.
const CONVERSATION_RULES = `
KEEPING THE CALL ALIVE — THESE OVERRIDE YOUR MOOD

This is practice. A call that ends after three turns teaches nothing, so:
- NEVER try to get off the phone. Do not say you're busy, have to go, have a
  meeting, or ask them to call back, unless the agent has been genuinely rude.
- NEVER end the call yourself. "ended" stays false unless the agent has
  abandoned it or been offensive.
- ANSWER the questions you're asked. If an agent asks who your mobiles are
  with, tell them. If they ask when your contract ends, give a date. Invent
  plausible details about your business and keep them consistent — that is
  the raw material the agent needs to practise with.
- Give the agent something to work with. A flat "no" or "we're fine" with
  nothing attached is a dead end. If you deflect, attach a reason they can
  actually engage with.
- ONE objection at a time, and not every turn. Most turns should simply
  move the conversation forward.
- Match their energy. If they're professional and warm, be warm back.
- You are allowed to be interested. A realistic customer sometimes says
  "actually, that is a bit annoying" or "go on then, what would that cost?"

You are here to give the agent a REALISTIC conversation, not to defeat them.`;

// Speech-to-text mangles words constantly; the customer must not react to
// artefacts as if they were what the agent said.
const TRANSCRIPTION_TOLERANCE = `
THE AGENT'S WORDS COME FROM SPEECH RECOGNITION

What you receive is an imperfect machine transcript of someone speaking.
It WILL contain errors — missing words, wrong homophones, mangled product
names, no punctuation.

- Read for INTENT, not literal text. If something is garbled, work out what
  they most likely meant and respond to that.
- Product names are the most commonly mangled: "beat ee net"/"BT net" is
  BT Net, "dee vee four" is DV4, "open reach" is Openreach, "sim"/"sims"
  are SIM cards. Assume the sensible reading.
- NEVER grade an agent down for a transcription artefact. Grammar, half
  words and odd phrasing are the microphone's fault, not theirs.
- Only ask them to repeat if a whole turn is genuinely unintelligible — and
  then do it naturally ("sorry, you cut out there"), not robotically.
- If you are unsure between two readings, assume the competent one.`;

/* ------------------------------------------------------------------ */
/*  Grading — the part that was wrong                                  */
/* ------------------------------------------------------------------ */

const GRADING_CALIBRATION = `
HOW TO GRADE — READ THIS CAREFULLY

"good" is the DEFAULT and should be the most common grade by a wide margin.
A competent, unremarkable turn is "good". You do not need to find something
wrong with it. Most turns in a decent call are "good".

Use the grades like this:
  brilliant   — rare. A genuinely excellent move that changes the call:
                a perfectly judged question, or handling an objection so
                well the customer's position visibly shifts. Expect at most
                one or two in a whole call, often none.
  excellent   — noticeably strong. A well-chosen open question, a benefit
                tied precisely to something the customer said, a clean ask.
  good        — competent and appropriate. THE DEFAULT. Use this whenever
                the agent has done something reasonable, even if it wasn't
                the theoretically optimal move.
  inaccuracy  — a small, clear misstep that costs a little ground. A closed
                question where an open one was needed, a slightly early
                pitch. Only when there is something specific to point at.
  mistake     — clearly poor technique with a real cost: pitching before
                any discovery, talking over the customer, ignoring a direct
                question.
  blunder     — rare and serious: being rude, inventing facts about
                pricing or products, or abandoning the call.

RULES YOU MUST FOLLOW
- Do NOT mark a turn down for being merely adequate. Adequate is "good".
- Do NOT mark down for phrasing you would have worded differently.
- Do NOT mark down for not covering everything at once — calls are
  sequential and the agent has more turns coming.
- Do NOT mark down an opening turn for being brief; brief openings are correct.
- Only use "mistake" or "blunder" when you can name the specific damage done.
- If you are hesitating between two grades, choose the more generous one.`;

/* ------------------------------------------------------------------ */
/*  Prompts                                                            */
/* ------------------------------------------------------------------ */

function stageBlock(stage: any, index: number, total: number) {
  if (!stage) return "No stage structure — run a natural conversation.";
  return `
CURRENT STAGE: ${stage.label} (${index + 1} of ${total})
  The agent is trying to: ${stage.goal || "—"}
  Let the call move on when: ${stage.advance_when || "the agent has achieved the goal above"}
  Objections that fit here: ${stage.objections || "any that arise naturally"}
  This is going badly if: ${stage.fail_when || "—"}
  Aim for at most ${stage.max_turns || 6} exchanges here before things move on.`;
}

function bonusBlock(bonuses: any[]) {
  if (!bonuses.length) return "";
  return `
MOVES WORTH SPOTTING
If the agent's last turn does any of these, list its key in "bonuses_hit".
Judge by meaning, not exact wording.
${bonuses.map((b) => `  ${b.key} — ${b.label}: ${b.description}`).join("\n")}`;
}

function turnSystem(o: {
  persona: string; method: string; rubric: string; difficulty: string;
  callRole: string; stage: any; stageIndex: number; stageCount: number;
  stagesSummary: string; bonuses: any[];
}) {
  const roleContext = o.callRole === "lead_gen"
    ? `This is a LEAD GENERATION call. The agent is calling cold to find out whether there is an opportunity worth passing to a closer. They are NOT trying to sell or price anything today — they are qualifying, and setting up a proper conversation with a colleague.`
    : `This is a CLOSER call. The customer has already spoken to a lead gen and knows roughly why this call is happening. The product area is broadly established. This call is about confirming detail, pricing it, handling pushback and getting agreement.`;

  return `You are roleplaying a BUSINESS CUSTOMER on a practice sales call so a BT Local Business agent can rehearse. Stay in character in the "customer" field at all times.

${roleContext}

WHO YOU ARE
${o.persona || "A small business owner in Devon or Cornwall. You run a busy firm and handle your own suppliers."}

YOUR MOOD
${DIFFICULTY[o.difficulty] || DIFFICULTY.normal}

HOW THE CALL IS STRUCTURED
${o.stagesSummary}
${stageBlock(o.stage, o.stageIndex, o.stageCount)}

${CONVERSATION_RULES}

${TRANSCRIPTION_TOLERANCE}

PLAYING THE CUSTOMER
- Speak like a real person on the phone: one or two sentences, contractions, British English.
- Never coach or explain inside the customer's speech.

WHAT GOOD LOOKS LIKE (for grading, not for you to say aloud)
${o.method || "Open questions before pitching. Listen more than you talk. Tie benefits to what they actually said. Always agree a concrete next step."}

${GRADING_CALIBRATION}
${o.rubric ? `\nADDITIONAL HOUSE RULES\n${o.rubric}` : ""}
${bonusBlock(o.bonuses)}

RETURN ONLY JSON — no prose, no code fences:
{
  "customer": "what you say next",
  "score": "brilliant|excellent|good|inaccuracy|mistake|blunder",
  "note": "one short sentence to the agent — say what worked, not just what didn't",
  "bonuses_hit": ["keys of any moves above that the agent just made"],
  "advance": true or false,
  "stage_note": "if advancing, what earned it; if not, what is still needed",
  "ended": false
}`;
}

function summarySystem(rubric: string, method: string, stagesSummary: string, callRole: string) {
  return `You are a sales coach reviewing a practice ${callRole === "lead_gen" ? "lead generation" : "closing"} call by a BT Local Business agent.

Be specific, warm and genuinely useful. Quote what they actually said. Assume they are competent and looking to improve, not failing — most agents doing this are doing a reasonable job and need sharpening, not rescuing.

The agent's turns are a SPEECH RECOGNITION transcript and contain errors. Judge what they meant, never how it was transcribed. Do not comment on grammar, half-finished words or phrasing artefacts — those are the microphone's.

THE CALL STRUCTURE
${stagesSummary}

WHAT GOOD LOOKS LIKE
${method || "Open questions before pitching. Listen more than you talk. Tie benefits to stated problems. Always agree a concrete next step."}
${rubric ? `\nHOUSE RULES\n${rubric}` : ""}

GRADE FAIRLY: C is a solid, ordinary call. B is good. A is genuinely excellent.
D and E are for calls with real problems, not merely imperfect ones.

RETURN ONLY JSON — no prose, no code fences:
{
  "grade": "A|B|C|D|E",
  "headline": "one sentence summing up the call",
  "strengths": ["two or three specific things they did well, quoting them"],
  "improvements": ["two or three specific changes, with what to say instead"],
  "moment": "the turn that most changed the call, and why",
  "stage_feedback": [{"stage": "stage label", "comment": "how they handled it"}],
  "next_focus": "the one thing to work on before the next call"
}`;
}

/* ------------------------------------------------------------------ */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = await req.json();
    const {
      mode, scenario, history = [], persona, rubric, method,
      stageIndex = 0, difficulty = "normal",
    } = body;

    // The agent no longer picks lead-gen vs closer. A scenario carries its
    // own stages; if it hasn't got any, its call_role decides which of the
    // default sets applies, defaulting to closer.
    let callRole = "closer";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Scenario-specific stages win; otherwise the default set for this role
    let stages: any[] = [];
    const { data: specific } = await supabase
      .from("coach_stages").select("*")
      .eq("scenario_key", scenario).eq("active", true).order("sort_order");
    if (specific && specific.length) {
      stages = specific;
    } else {
      const { data: scen } = await supabase
        .from("coach_scenarios").select("call_role").eq("key", scenario).maybeSingle();
      if (scen?.call_role) callRole = scen.call_role;

      const { data: general } = await supabase
        .from("coach_stages").select("*")
        .is("scenario_key", null).eq("call_role", callRole).eq("active", true).order("sort_order");
      stages = general || [];
    }

    const { data: bonusRows } = await supabase
      .from("coach_bonuses").select("*").eq("active", true).order("sort_order");
    const bonuses = (bonusRows || []).filter((b) => !b.call_role || b.call_role === callRole);

    const stagesSummary = stages.length
      ? stages.map((s, i) => `  ${i + 1}. ${s.label} — ${s.goal || ""}`).join("\n")
      : "  (no stages configured — run a natural conversation)";

    if (mode === "summary") {
      const transcript = history
        .map((t: any) => `${t.role === "agent" ? "AGENT" : "CUSTOMER"}: ${t.text}`).join("\n");
      const raw = await askModel(
        summarySystem(rubric, method, stagesSummary, callRole),
        `Here is the full call. Review it.\n\n${transcript}`,
        SUMMARY_MODEL, 1600,
      );
      const parsed = parseJSON(raw) || {
        grade: "C", headline: "Practice call complete.",
        strengths: [], improvements: [], moment: "", stage_feedback: [], next_focus: "",
      };
      return new Response(JSON.stringify(parsed), { headers: { ...CORS, "content-type": "application/json" } });
    }

    const idx = Math.min(Math.max(0, stageIndex), Math.max(0, stages.length - 1));
    const stage = stages.length ? stages[idx] : null;

    const transcript = history.length
      ? history.map((t: any) => `${t.role === "agent" ? "AGENT" : "YOU"}: ${t.text}`).join("\n")
      : "(the agent has just dialled — answer the phone as the customer)";

    const raw = await askModel(
      turnSystem({
        persona, method, rubric, difficulty, callRole,
        stage, stageIndex: idx, stageCount: stages.length, stagesSummary, bonuses,
      }),
      transcript, TURN_MODEL, 800,
    );

    const parsed = parseJSON(raw) || {};
    const advance = parsed.advance === true && idx < stages.length - 1;
    const hit = Array.isArray(parsed.bonuses_hit) ? parsed.bonuses_hit : [];
    const hitDetail = hit
      .map((k: string) => bonuses.find((b) => b.key === k))
      .filter(Boolean)
      .map((b: any) => ({ key: b.key, label: b.label, points: b.points }));

    return new Response(JSON.stringify({
      customer: parsed.customer || "Sorry, could you say that again?",
      score: parsed.score || "good",
      note: parsed.note || "",
      bonuses: hitDetail,
      advance,
      stageIndex: advance ? idx + 1 : idx,
      stageLabel: stages.length ? (stages[advance ? idx + 1 : idx]?.label || "") : "",
      stageNote: parsed.stage_note || "",
      coachingNote: stages.length ? (stages[advance ? idx + 1 : idx]?.coaching_note || "") : "",
      ended: parsed.ended === true,
      stages: stages.map((s) => ({ key: s.key, label: s.label })),
    }), { headers: { ...CORS, "content-type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500, headers: { ...CORS, "content-type": "application/json" },
    });
  }
});