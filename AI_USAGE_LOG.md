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
