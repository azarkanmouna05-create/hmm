# Going from class demo to real use

The same app serves both. Demo accounts are flagged in the database, and their data is always stored as
*sample* and kept apart from real students' data.

## Already safe for real use (migration `supabase/002_real_use.sql`)
- Everyone who signs up is a **student**. Professor/admin roles come only from `role_assignments`, which
  only admins can edit. Nobody can make themselves staff by choosing a clever email.
- Only **university emails** can sign up (`policy.allowed_domains`, default `aui.ma`).
- Students' chats, reflections and profiles are private to them (row-level security).
- Professors see class patterns only for groups of at least `min_group` students, computed in the
  database. Real professors see real students only; the demo professor sees demo data only.
- The AI only answers signed-in users; the AI key never leaves the server.

## Before real students use it (checklist)
1. Vercel → Environment Variables → `DEMO_LOGINS` = `off` → Redeploy. This hides the one-tap demo buttons.
2. Supabase → Authentication → Email → turn **Confirm email ON**, so accounts must prove they own the address.
3. Supabase → SQL Editor: add real staff, e.g.
   `insert into role_assignments (email, role) values ('real.professor@aui.ma', 'professor');`
   (or from the Admin screen once it is built).
4. Optionally remove the demo accounts: Authentication → Users → delete the three demo emails.
5. Consider a paid Gemini tier, or another provider, for capacity (free tier is shared and rate-limited).
6. Long-term: replace email+password with the university's single sign-on (SSO).
