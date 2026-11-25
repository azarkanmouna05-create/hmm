# Process borrowed from the YouTube course (notes, not report text)

Source: the "build a mobile app with Claude Code" course Mouna supplied (transcript).
Decision (Mouna, 2026-11-25): **keep the PWA**. We are not switching to Expo/React Native; we reuse the course's *process*, not its stack.
These are structured notes for Mouna to rewrite in her own words.

## 1. The course's 5-step app design framework, mapped to hmm.

| Step (course) | What it means | hmm. |
|---|---|---|
| Core function | The one thing that remains if you strip everything else | Socratic questioning that never gives the answer |
| Core loop | Action → reward, ideally under ~30 s | Student answers → next smaller question + the "why" note; the meter/hint dots move |
| Accessory features | Things that support the loop without changing it | Reflection, Thinking Profile, Talmid/Rival, professor insights, admin rules |
| Surface area check | Keep screens few (course suggests ~5–7 per role) | Student: Home, Session, Reflection, Profile (+ Snapshot once). Professor: 3. Admin: 2. |
| Retention hook | An unfinished state that brings the user back | "hmm. noticed…" asking for a Yes/No, due tasks, profile that visibly changes after each session |

**Tension to note:** the course rewards its core loop with confetti, chimes and bounces. hmm.'s design direction explicitly says *no confetti, no cartoon jumps*. Our reward is quieter: a visible change (chameleon hue, profile line "hmm. now takes bigger steps"). This is a deliberate design choice and is worth justifying in the report.

## 2. Testing loop (course: computer → phone mirror → real phone)
For a PWA this becomes:
1. Desktop Chrome at phone size (automated screenshots: done each milestone)
2. Real phone in the browser: open the Vercel link
3. Real phone **installed**: Add to Home Screen, open from the icon (full-screen, offline shell)

## 3. Order of work (course) vs ours
Course: MVP idea → build → design → test → add database + auth → test → security audit → test → deploy.
Ours matches this, except: we deployed early (Vercel), so every push is already live.

## 4. Security audit
The course runs a security-audit prompt twice in fresh conversations after the database is added (the second pass catches issues the first fix introduced).
Plan: do this after step 3 (Supabase), and again before the final demo. Record both runs in AI_USAGE_LOG.md.

## 5. Project notes file
The course runs `/init` to create a CLAUDE.md (a project summary the AI reads first). We'll add one once the structure settles (after step 3).
