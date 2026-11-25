/* App state. Step 2: profile + sessions live on this device (localStorage).
   Step 3 moves them to Supabase (private to the student, protected by row-level security). */
import { CH, DEFAULT_POLICY, KIND } from "./engine/engine.js";
import { setChameleonMood } from "./chameleon/chameleon.js";

const LS = {
  get(k, d) { try { const v = localStorage.getItem("hmm." + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("hmm." + k, JSON.stringify(v)); } catch {} },
};

// Until the Learning Snapshot exists (step 3): the demo student from the user stories.
const DEMO_PROFILE = {
  name: "Mouna", program: "BAI", langs: ["English", "Darija"],
  hintPace: "Small steps", challenge: "Gentle", tone: "Encouraging",
  snap: { stuck: "freeze" }, skills: { solve: 0, explain: 0, argue: 0 },
  sessions: 0, history: [], noticed: null, lastChange: "",
};

// Sample task (labelled as sample in the UI until professors create real ones in step 5).
export const SAMPLE_TASKS = [
  { id: "t-math-1", course: "MATH 1101", kind: "problem", topic: "Find the derivative of x² · sin x", title: "the product rule",
    headline: "Why does the product rule add two terms instead of one?", due: "Mon", mins: 12, sample: true },
];

export const store = {
  policy: DEFAULT_POLICY,
  get profile() { return LS.get("profile", null) || DEMO_PROFILE; },
  saveProfile(p) { LS.set("profile", p); setChameleonMood(p.challenge.toLowerCase()); },

  // The live session is saved after every turn, so "your session is saved" is true even offline.
  get session() { return LS.get("session", null); },
  saveSession(s) { LS.set("session", s); },
  clearSession() { try { localStorage.removeItem("hmm.session"); } catch {} },

  startSession(char, task) {
    const P = this.profile;
    const s = {
      char, task, pace: P.hintPace, level: P.challenge, tone: P.tone,
      maxHints: Math.min(task.maxHints ?? this.policy.maxHints, this.policy.maxHints),
      hints: 0, answerReq: 0, meter: 0, step: "", points: [], counters: [],
      msgs: [], note: "", changes: [], start: Date.now(),
    };
    this.saveSession(s);
    return s;
  },
  taskFor(char) { return SAMPLE_TASKS.find((t) => KIND[t.kind] === char) || null; },
  charInfo: CH,
};
