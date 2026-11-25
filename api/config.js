/* GET /api/config — public client config. The Supabase URL and PUBLISHABLE (anon) key are designed to be
   public: everything they can reach is guarded by row-level security in the database. The AI key and any
   Supabase secret/service key are never exposed here. */
export function GET() {
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";
  return Response.json({ supabaseUrl, supabaseKey, configured: !!(supabaseUrl && supabaseKey) },
    { headers: { "Cache-Control": "public, max-age=300" } });
}
