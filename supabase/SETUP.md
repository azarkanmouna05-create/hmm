# Connect Supabase (about 10 minutes, one time)

1. **Create the project.** supabase.com → New project → name `hmm` → region **West EU (Paris)** or **Central EU (Frankfurt)**, closest to Ifrane → let it generate a database password (save it in your password manager) → tick **Enable automatic RLS** if offered → Create.
2. **Create the tables.** Left menu → **SQL Editor** → New query → paste the whole of `supabase/schema.sql` → **Run**. You should see "Success. No rows returned".
3. **Skip email confirmation (for the demo).** Left menu → **Authentication** → Sign In / Providers → Email → turn **off** "Confirm email" → Save.
4. **Give Vercel the two public values.** Supabase → Project Settings → **API** (or "Data API"/"API Keys"):
   - copy the **Project URL** (looks like `https://abcd1234.supabase.co`)
   - copy the **publishable / anon** key (NOT the secret / service_role key)

   Vercel → your `hmm` project → Settings → **Environment Variables** → add:
   - `SUPABASE_URL` = the Project URL
   - `SUPABASE_ANON_KEY` = the publishable/anon key

   Then Deployments → ⋯ on the latest → **Redeploy**.
5. **Make the demo accounts.** Open the app → "New here? Create your account":
   - `mouna@aui.ma` → student
   - `dr.salma.prof@aui.ma` → professor
   - `it.admin@aui.ma` → admin

   (The role comes from the email automatically. Pick any passwords.)

Never put the **secret / service_role** key anywhere in this project. The app doesn't need it.
