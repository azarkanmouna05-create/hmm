/* POST /api/demo-login {role} — one-tap demo sign-in for the class presentation.
   The demo password lives only in Vercel (DEMO_PASSWORD); it is never sent to the browser. The first tap
   creates the account (role comes from the email, as for everyone). Turn off by removing DEMO_PASSWORD. */
const SB_URL = process.env.SUPABASE_URL || "";
const SB_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";
const PW = process.env.DEMO_PASSWORD || "";
const ACCOUNTS = { student: "mouna@aui.ma", professor: "dr.salma.prof@aui.ma", admin: "it.admin@aui.ma" };

export async function GET() {
  return Response.json({ enabled: !!(SB_URL && SB_KEY && PW.length >= 8) });
}

export async function POST(request) {
  if (!SB_URL || !SB_KEY || PW.length < 8) return Response.json({ error: "Demo sign-in is turned off." }, { status: 404 });
  const { role } = await request.json().catch(() => ({}));
  const email = ACCOUNTS[role];
  if (!email) return Response.json({ error: "Unknown demo role" }, { status: 400 });

  const h = { apikey: SB_KEY, "Content-Type": "application/json" };
  const body = JSON.stringify({ email, password: PW });
  const signIn = () => fetch(`${SB_URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: h, body });

  let r = await signIn();
  if (r.status === 400) {                                  // first use: the account doesn't exist yet
    await fetch(`${SB_URL}/auth/v1/signup`, { method: "POST", headers: h, body });
    r = await signIn();
  }
  if (!r.ok) return Response.json({ error: "Demo sign-in failed. Was this account made with a different password?" }, { status: 502 });
  const s = await r.json();
  return Response.json({ access_token: s.access_token, refresh_token: s.refresh_token });
}
