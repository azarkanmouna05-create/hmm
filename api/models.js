/* GET /api/models — diagnostic: which chat models this deployment's AI key can use.
   Returns model names only (never the key). Listing models does not use generation quota. */
const BASE = process.env.AI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai";
const KEY = process.env.AI_API_KEY || process.env.GEMINI_API_KEY || "";

export async function GET() {
  if (!KEY) return Response.json({ error: "AI is not configured (missing AI_API_KEY)." }, { status: 503 });
  const r = await fetch(`${BASE}/models`, { headers: { Authorization: `Bearer ${KEY}` }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) return Response.json({ error: `provider ${r.status}`, detail: (await r.text()).slice(0, 600) }, { status: 502 });
  const data = await r.json();
  const ids = (data.data || []).map((m) => String(m.id).replace(/^models\//, "")).sort();
  return Response.json({ configured: process.env.AI_MODEL || null, models: ids });
}
