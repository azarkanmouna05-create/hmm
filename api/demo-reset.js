/* POST /api/demo-reset — "Start the demo over" from the login screen. Signs in as the DEMO admin on the server
   and runs reset_demo(): default rules, fresh sample data, demo student back to the Learning Snapshot.
   Real students' data is never touched. Off when DEMO_LOGINS=off. */
const SB_URL = process.env.SUPABASE_URL || "";
const SB_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";
const PW = process.env.DEMO_PASSWORD || "hmm-demo-2026";
const OFF = process.env.DEMO_LOGINS === "off";

export async function POST() {
  if (OFF || !SB_URL || !SB_KEY) return Response.json({ error: "Demo is turned off." }, { status: 404 });
  const h = { apikey: SB_KEY, "Content-Type": "application/json" };
  const body = JSON.stringify({ email: "it.admin@aui.ma", password: PW });
  let r = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: h, body });
  if (r.status === 400) { await fetch(`${SB_URL}/auth/v1/signup`, { method: "POST", headers: h, body }); r = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: h, body }); }
  if (!r.ok) return Response.json({ error: "Couldn’t reach the demo admin." }, { status: 502 });
  const { access_token } = await r.json();
  const x = await fetch(`${SB_URL}/rest/v1/rpc/reset_demo`, { method: "POST", headers: { ...h, Authorization: `Bearer ${access_token}` }, body: "{}" });
  if (!x.ok) return Response.json({ error: "Reset failed: " + (await x.text()).slice(0, 200) }, { status: 502 });
  return Response.json({ ok: true });
}
