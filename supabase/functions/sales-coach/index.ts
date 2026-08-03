// ============================================================
// SchThrive WebOS — Sales Coach
//
// Runs the roleplay customer and scores each of the agent's turns.
//
// DATA ISOLATION: this function has NO database access. It never
// imports the Supabase client, never reads orders, staff, NetSuite
// or anything else. It receives a scenario name and the conversation
// so far, and returns the customer's next line plus a score. That's
// the whole surface area.
//
// Deploy:  supabase functions deploy sales-coach
// Secrets: supabase secrets set CLOUDFLARE_ACCOUNT_ID=...
//          supabase secrets set CLOUDFLARE_API_TOKEN=...
// ============================================================

// Provider and model are read from secrets, so you can switch them with a
// `supabase secrets set` and no code change or app redeploy.
//
//   AI_PROVIDER = cloudflare (default) | anthropic
//   CF_MODEL    = which Cloudflare model to use
//
// IMPORTANT: only Cloudflare's *hosted* models draw on the free neuron
// allocation. Proxied models (anything named gpt-*, claude-*) bill to that
// provider's own account and get nothing free. Llama, Mistral, Qwen and
// Gemma are hosted.
const PROVIDER = (Deno.env.get("AI_PROVIDER") || "cloudflare").toLowerCase();

// 70B gives much better roleplay and scoring; 8B stretches the daily
// allowance several times further if you're running out.
//   cheaper: @cf/meta/llama-3.1-8b-instruct
const CF_MODEL = Deno.env.get("CF_MODEL") || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-haiku-4-5-20251001";

// Trim runaway transcripts so a stuck loop can't drain the allowance.
const MAX_TURNS = 40;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SCENARIOS: Record<string, string> = {
  cold_call:
    "You are the owner of a small independent business — a garage, a dental practice, a builder's merchant, pick one and stay consistent. " +
    "You did NOT ask for this call. You are busy and mildly irritated at being interrupted. You will hang up if the caller " +
    "is boring, robotic, or launches into a pitch without earning it. You warm up if they are human, brief, and give you a " +
    "reason to care. You have a real problem with your current phone and broadband provider but you will not volunteer it " +
    "unless asked a good question.",
  objection:
    "You are a business owner who has heard the pitch and is interested but hesitant. You raise real objections: you're mid-contract, " +
    "you've been burned by a switch before, the price sounds high, you need to speak to your business partner. Push back genuinely. " +
    "Concede only if the agent actually addresses the objection rather than talking over it.",
  renewal:
    "You are an existing customer whose contract is ending. You are lukewarm — not unhappy, not delighted. You have had one billing " +
    "issue that annoyed you and you will mention it if pressed. A competitor has quoted you cheaper. You will stay if the agent gives " +
    "you a reason beyond price, but you will test them on it.",
  gatekeeper:
    "You are a receptionist or office manager screening calls. You are polite but practised at deflecting sales calls. " +
    "You ask who's calling and what it's regarding. You offer to take a message. You only put the caller through if they give you " +
    "something specific and credible, and you do not respond well to being tricked or patronised.",
  angry:
    "You are an existing customer who is genuinely annoyed — an order went wrong, nobody called you back, and you have had to chase twice. " +
    "You open hostile. You are not unreasonable, but you want acknowledgement before solutions. If the agent gets defensive or jumps " +
    "to a fix without listening, you escalate. If they listen properly, you calm down.",
};

const TURN_SYSTEM = `You are running a sales training roleplay for a UK B2B telecoms sales agent (BT Local Business — phone, broadband, mobile, cloud voice).

You do two things each turn:
1. Play the CUSTOMER. Stay in character. Be realistic, not helpful. Real prospects are distracted, sceptical, and don't follow a script. Keep replies SHORT — one to three sentences, like real speech. Never coach or break character in this part.
2. Score the AGENT'S most recent turn, like chess move annotations.

Scoring scale — use one of these exact words:
brilliant   = rare, genuinely excellent, changed the call
excellent   = strong technique, well executed
good        = solid and on track (most turns are this or below)
inaccuracy  = slightly off, missed opening, weak phrasing
mistake     = real error: talking over, pitching too early, closed question where open was needed
blunder     = serious: arguing, lying, unprompted price, insulting, losing the call

Be honest. Coaching that flatters is useless. Do not hand out "brilliant" for mere competence.

Output ONLY a JSON object. No markdown, no code fences, no explanation before or after. Never use a double-quote character inside any value — use single quotes if you need to quote something:
{"customer":"what the customer says next","score":"good","note":"one short sentence on why, addressed to the agent as 'you'"}`;

const SUMMARY_SYSTEM = `You are a sales coach reviewing a completed practice call by a UK B2B telecoms agent.

Be specific and honest. Reference actual things they said. Vague praise helps nobody.

Output ONLY a JSON object. No markdown, no code fences, no explanation before or after. Never use a double-quote character inside any value — use single quotes if you need to quote something:
{"grade":"A","headline":"one sentence overall verdict","strengths":["specific thing they did well"],"improvements":["specific thing to change, with what to say instead"],"moment":"the turning point of the call and why it mattered"}

grade must be A, B, C or D. Give two or three items in each list.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    // Must be signed in — this spends a shared daily allowance.
    if (!req.headers.get("Authorization")) return json({ error: "Not signed in" }, 401);

    const body = await req.json();
    const mode = body.mode === "summary" ? "summary" : "turn";
    const scenarioKey: string = body.scenario || "cold_call";
    let history: Array<{ role: string; text: string }> = body.history || [];
    if (history.length > MAX_TURNS) history = history.slice(-MAX_TURNS);

    const scenario = SCENARIOS[scenarioKey] || SCENARIOS.cold_call;

    // The transcript is the ONLY thing that goes to the model.
    const transcript = history
      .map((h) => `${h.role === "agent" ? "AGENT" : "CUSTOMER"}: ${h.text}`)
      .join("\n");

    const system =
      mode === "summary"
        ? SUMMARY_SYSTEM
        : `${TURN_SYSTEM}\n\nYOUR CHARACTER FOR THIS CALL:\n${scenario}`;

    const userContent =
      mode === "summary"
        ? `Here is the full call transcript. Review it.\n\n${transcript}`
        : transcript.length
        ? `Conversation so far:\n\n${transcript}\n\nRespond as the customer and score the agent's last turn.`
        : `The agent hasn't spoken yet. Open the call as the customer would — you've just picked up the phone. Score "good" with an empty note.`;

    const raw = PROVIDER === "cloudflare"
      ? await callCloudflare(system, userContent)
      : await callAnthropic(system, userContent);

    if (raw.error) return json({ error: raw.error }, raw.status || 502);

    const parsed = extractJson(raw.text || "");
    if (parsed && parsed.customer) return json(parsed, 200);
    if (parsed && (parsed.grade || parsed.headline)) return json(parsed, 200);

    // Open models frequently produce almost-valid JSON — a stray unescaped
    // quote inside the dialogue is enough to fail strict parsing. Pull the
    // fields out directly with regex rather than requiring the whole
    // object to be perfectly formed.
    const loose = extractLoose(raw.text || "", mode);
    if (loose) return json(loose, 200);

    // Genuine last resort — still better than silence.
    return json(
      mode === "summary"
        ? { grade: "C", headline: "Summary couldn't be parsed", strengths: [], improvements: [], moment: (raw.text || "").slice(0, 400) }
        : { customer: firstSentences(raw.text || "") || "Sorry, could you say that again?", score: "good", note: "" },
      200
    );
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

// ---------------------------------------------------------------
// Providers
// ---------------------------------------------------------------

async function callCloudflare(system: string, user: string): Promise<any> {
  const account = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
  const token = Deno.env.get("CLOUDFLARE_API_TOKEN");
  if (!account || !token) {
    return { error: "CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN not set on the function", status: 500 };
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${CF_MODEL}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: 600,
        temperature: 0.8,
      }),
    }
  );

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) {
    const detail = data?.errors?.[0]?.message || `HTTP ${res.status}`;
    // 10,000 neurons/day, reset at midnight UTC — worth saying plainly.
    const friendly = /neuron|quota|limit|exceed|capacity/i.test(String(detail))
      ? "Daily free allowance used up — it resets at midnight UTC."
      : String(detail);
    return { error: friendly, status: 502 };
  }
  return { text: extractCfText(data.result) };
}

// Cloudflare's response shape varies by model. Usually result.response is
// a plain string, but some models nest it, or return an OpenAI-style
// content array. Blindly doing String(result.response) on an object gives
// the literal text "[object Object]" — this checks the actual shape
// instead, so the roleplay never breaks like that again.
function extractCfText(result: any): string {
  if (!result) return "";
  const r = result.response;
  if (typeof r === "string") return r;
  if (r && typeof r === "object") {
    if (typeof r.response === "string") return r.response;
    if (typeof r.content === "string") return r.content;
    if (typeof r.text === "string") return r.text;
    if (Array.isArray(r)) {
      return r.map((b: any) => (typeof b === "string" ? b : b?.text || "")).join("");
    }
  }
  if (Array.isArray(result.output)) {
    return result.output.map((b: any) => b?.content || b?.text || "").join("");
  }
  // Last resort: readable JSON rather than a useless "[object Object]".
  return JSON.stringify(result);
}

async function callAnthropic(system: string, user: string): Promise<any> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return { error: "ANTHROPIC_API_KEY not set on the function", status: 500 };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1000,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) return { error: `Model call failed (${res.status})`, status: 502 };
  const data = await res.json();
  return {
    text: (data.content || []).map((b: any) => (b.type === "text" ? b.text : "")).join("").trim(),
  };
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

// Open models like to wrap JSON in prose or fences. Take the outermost
// braces and try that.
function extractJson(text: string): any | null {
  const cleaned = String(text).replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

function firstSentences(text: string, n = 2) {
  const clean = String(text).replace(/```(?:json)?/gi, "").replace(/[{}"]/g, " ").trim();
  return clean.split(/(?<=[.!?])\s+/).slice(0, n).join(" ").slice(0, 280);
}

// Pulls "customer"/"score"/"note" (or "grade"/"headline"/etc) straight out
// of near-JSON text with regex, tolerant of a broken quote or trailing
// comma elsewhere in the object that would fail a strict JSON.parse.
function extractLoose(text: string, mode: string): any | null {
  const t = String(text).replace(/```(?:json)?/gi, "");
  const field = (name: string): string | null => {
    // Matches "name": "value" — value may run to the next ", "key": pattern
    // or the end, and tolerates an unescaped quote inside by being greedy
    // up to the LAST quote before the next known key or closing brace.
    const m = t.match(new RegExp(`"${name}"\\s*:\\s*"([\\s\\S]*?)"\\s*(?:,\\s*"(?:customer|score|note|grade|headline|strengths|improvements|moment)"|\\})`, "i"));
    return m ? m[1].replace(/\\"/g, '"').replace(/\\n/g, " ").trim() : null;
  };

  if (mode === "summary") {
    const grade = field("grade");
    const headline = field("headline");
    if (!grade && !headline) return null;
    return {
      grade: (grade || "C").toUpperCase().slice(0, 1),
      headline: headline || "Call reviewed.",
      strengths: [], improvements: [],
      moment: field("moment") || "",
    };
  }

  const customer = field("customer");
  if (!customer) return null;
  const scoreRaw = (field("score") || "good").toLowerCase();
  const validScores = ["brilliant", "excellent", "good", "inaccuracy", "mistake", "blunder"];
  return {
    customer,
    score: validScores.includes(scoreRaw) ? scoreRaw : "good",
    note: field("note") || "",
  };
}

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}