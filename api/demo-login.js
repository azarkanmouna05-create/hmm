/* POST /api/demo-login {role} — one-tap demo sign-in for the class presentation.
   Demo accounts use a fixed, publicly known password (Mouna's choice: "it's just a demo"). Anyone who reads
   this repo could sign in to the three demo accounts; they hold sample data only. Set DEMO_PASSWORD in Vercel
   to override it, or DEMO_LOGINS=off to turn the buttons off. The first tap creates the account. */
const SB_URL = process.env.SUPABASE_URL || "";
const SB_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";
const PW = process.env.DEMO_PASSWORD || "hmm-demo-2026";
const OFF = process.env.DEMO_LOGINS === "off";
const ACCOUNTS = { student: "mouna@aui.ma", professor: "dr.salma.prof@aui.ma", admin: "it.admin@aui.ma" };

export async function GET() {
  return Response.json({ enabled: !OFF && !!(SB_URL && SB_KEY) });
}

export async function POST(request) {
  if (OFF || !SB_URL || !SB_KEY) return Response.json({ error: "Demo sign-in is turned off." }, { status: 404 });
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
