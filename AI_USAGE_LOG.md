# AI usage log — hmm.

Running record of AI tools used on this project: what was asked, what I accepted or rejected, and why.
Entries are factual. The reasoning column is mine to review and rewrite in my own words for the report.

| # | Date | Tool | Task / prompt (summary) | Output | Accepted / rejected / changed | Why |
|---|------|------|-------------------------|--------|-------------------------------|-----|
| 1 | 2026-11 | ChatGPT | Explore mascot ideas: an ambient "living" companion instead of a cursor-follower | Concept list (wander, sit, approach, sleep); suggested SVG + CSS + JS | Accepted the concept and the proximity-not-cursor idea; changed the animal from cat to chameleon | Chameleon = adaptation, which is the core idea of the product |
| 2 | 2026-11-25 | Claude Code (Figma MCP) | Read Figma frames "E1 · Home (editorial)" and "Mascot / Chameleon" to extract tokens and layout | Design specs: colours, type sizes, spacing | Accepted as source of truth for tokens | Keeps app and Figma consistent |
| 3 | 2026-11-25 | Claude Code | Step 1: PWA shell, design tokens, Home screen (S03) from E1, animated chameleon component | Code in `public/` | Accepted, with changes (see notes) | — |

### Notes for entry 3 (decisions Claude Code made; review these)
- **Vanilla JS, no framework or build step.** Fewer moving parts to install or break, fast on mobile, and each file can be read and explained in the architecture section. Trade-off: a little more manual DOM code than React would need.
- **The chameleon was redrawn as code (SVG), not exported from Figma.** Figma asset downloads were blocked in the build environment, and the animation needs separate parts (eye, eyelid, tail, legs) anyway. It was redrawn to match the Figma mascot (green body, light stripes, casque, turret eye, orange spiral tail).
- **Bugs caught by screenshot review and fixed:** (a) walking legs detached from the body because a CSS animation overrode the SVG position; (b) the "tough" colour made pink stripes, which read as childish, so stripes now shift to gold; (c) the pet sometimes teleported instead of walking in, so it now only enters from a side where the path is free of text.
- **Not done in step 1:** Figma frame E2 couldn't be read (Figma Starter plan tool-call limit reached), so the Socrates dialogue in step 2 relies on the E2 structure listing plus my brief. Arabic-script font for Darija/Arabic is not added yet.
- **YouTube motion tutorial:** couldn't be accessed from the build environment; motion follows the written spec in the Figma "Pet behaviour" note.

| # | Date | Tool | Task / prompt (summary) | Output | Accepted / rejected / changed | Why |
|---|------|------|-------------------------|--------|-------------------------------|-----|
| 4 | 2026-11-25 | Claude Code | Step 2: port prototype logic (buildPrompt, META protocol, derive, profile-update rule) into `public/js/engine/engine.js`; serverless `api/think.js`; Socrates dialogue screen (S04a) from E2 | Code | Accepted, with changes (see notes) | — |

### Notes for entry 4
- **Prompt text is reused from my prototype unchanged.** Only the structure moved, so the same rules (never the answer, worked example of a *similar* problem after 2+ answer requests) apply.
- **The prompt is now built on the server, not in the browser.** A student could otherwise edit the rules in dev tools. The server also enforces admin rules: characters turned off per course (403), hint cap, allowed languages, challenge range.
- **Provider-agnostic.** The server calls any OpenAI-compatible endpoint; Gemini is the default. To switch provider, change three environment variables.
- **Testing done:** rule enforcement tested directly against the API (Rival blocked in MATH 1101, hint cap, missing key → "hmm. can't think right now"). The session flow (turns, hints, "why" note, settings change, session restored after reload) was tested against a *local test stub* that returns obviously fake text. **Not yet tested against real Gemini**: that happens once the key is in Vercel.

| # | Date | Tool | Task / prompt (summary) | Output | Accepted / rejected / changed | Why |
|---|------|------|-------------------------|--------|-------------------------------|-----|
| 5 | 2026-11-25 | Claude Code + Gemini (live) | Deploy to Vercel; first real-AI acceptance test of US2 (Socrates) on the deployed app | Transcript in `docs/tests/us2-socrates-live-2026-11-25.md` | Accepted with 2 fixes | See notes |

### Notes for entry 5
- **Setup issues found and fixed:** `gemini-2.5-flash` is retired for new keys (404). The free tier has per-model quotas (429) and was overloaded (503). Fix: a model **fallback chain** (3.8-flash → 3.7-flash → 3.5-flash-lite → flash-lite-latest → gemma-4-31b) and a `/api/models` diagnostic.
- **US2 result (real Gemini, 8 turns):** never revealed the final answer despite 3 requests, including "exam in 1 hour". It switched to a similar problem after the 2nd request. The hint was a bigger clue. It confirmed the correct answer and asked "why does this work?". Darija mixed in naturally.
- **Defect 1:** 4 of 8 replies had no META line, so the "why" note was blank. The "why" is the core of hmm., so the server now writes a rule-based note from what the engine instructed whenever the model omits it. It is flagged `fallback: true` so it's transparent.
- **Defect 2:** "worked example" was interpreted as "ask a similar question". Changed one prompt sentence to require *showing* the steps and result of the similar problem, never the student's own.
- **Limitation to report:** free-tier capacity. Several students at once may hit quota/overload; the app then shows "hmm. can't think right now, your session is saved".

| # | Date | Tool | Task / prompt (summary) | Output | Accepted / rejected / changed | Why |
|---|------|------|-------------------------|--------|-------------------------------|-----|
| 6 | 2026-11-25 | Claude Code | Supabase: schema with row-level security + privacy floor; auth; S01 Login; role routing; /api/think requires sign-in | `supabase/schema.sql`, `public/js/db.js`, `api/config.js`, login screen | Accepted | See notes |

### Notes for entry 6
- **Privacy is enforced by the database, not the app.** Owner-only tables hold profiles, chats and reflections. The anonymised aggregate table can't be read directly; professors use `class_insights()`, which returns nothing but `{hidden:true}` below the admin's minimum group size.
- **Tested before deploying,** on a local Postgres with Supabase's auth functions mocked. Results:
  - roles come from the email
  - a professor sees 0 private chats
  - a student can't spoof another anon id (RLS error)
  - a student can't call `class_insights` or change policy
  - 4 students → hidden, 5 → patterns
  - an admin can change max hints
- **Security choice (from the course's audit idea):** the AI endpoint now requires a signed-in user, so strangers can't burn the AI quota.
- **Role from email** is a *demo* rule copied from my prototype. A real deployment would take roles from the university's directory (SSO). Worth noting in the ethics/limitations section.

| # | Date | Tool | Task / prompt (summary) | Output | Accepted / rejected / changed | Why |
|---|------|------|-------------------------|--------|-------------------------------|-----|
| 7 | 2026-11-25 | Claude Code | Real-use safety (002), courses with join codes (003), one-tap demo sign-in, classmates as themselves; live end-to-end test | migrations, My courses + course page, `supabase/tests/run.sh` | Accepted | See notes |

### Notes for entry 7
- **My decisions (Mouna):** keep a one-tap demo with a fixed demo password ("it's just a demo"), but make the real app safe outside the demo; students join courses with a **join code** from the professor; classmates take part in the demo **as themselves**.
- **Live checks on the real Supabase project:** demo roles/courses correct; a Gmail sign-up is refused; demo student joined → MATH 1101 course page → own question with Socrates → real Gemini reply in EN + Darija, refused to give the answer, "why" note shown; the chat was saved privately (4 messages), and the professor account got `[]` when trying to read private sessions.
- **Repeatable DB tests:** `supabase/tests/run.sh` rebuilds a local Postgres, applies all scripts in order, and prints expected vs actual for every privacy rule.
