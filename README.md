# hmm. — from hmm. to aha

A Socratic AI study companion. The AI never gives the final answer. It asks until the student gets there.
Systems Analysis semester project (AUI), built as an installable web app (PWA).

## Run it on your computer
You need [Node.js](https://nodejs.org) (LTS). Then, in this folder:

```bash
npm run dev
```

Open http://localhost:4173. The chameleon playground is at http://localhost:4173/#/dev/chameleon.

## Folder map
```
public/                  everything the browser loads
  index.html             app shell
  manifest.webmanifest   makes it installable (name, icon, colours)
  sw.js                  service worker: offline app shell, never caches /api
  styles/tokens.css      design tokens (colours, fonts, spacing) from Figma E1/E2
  styles/base.css        layout + editorial components
  styles/chameleon.css   chameleon look + motion
  js/app.js              tiny router
  js/chameleon/          chameleon drawing (chameleon.js) + roaming pet behaviour (pet.js)
  js/screens/            one file per screen (S03 Home so far)
  fonts/, icons/         self-hosted fonts (SIL OFL) and app icons
api/                     (step 2) serverless functions: adaptive engine, keeps the AI key secret
```

## Build steps
1. ✅ Repo, PWA shell, design tokens, animated chameleon
2. Student Home + Socrates session with real AI
3. Snapshot, Reflection, Thinking Profile
4. Talmid + Rival
5. Professor screens
6. Admin screens
7. Sample data + deploy

## Credits
Fonts: Newsreader, Inter, Pixelify Sans, all SIL Open Font License, via Fontsource.
