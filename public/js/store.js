/* App state. Local-first: everything is cached on the device so screens open instantly; Supabase is the
   source of truth (profile and chats private to the student, protected by row-level security). */
import { CH, DEFAULT_POLICY, KIND } from "./engine/engine.js";
import { setChameleonMood } from "./chameleon/chameleon.js";
import * as db from "./db.js";

const LS = {
  get(k, d) { try { const v = localStorage.getItem("hmm." + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("hmm." + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem("hmm." + k); } catch {} },
};

// Starting profile until the Learning Snapshot (S02) is built: the demo student from the user stories.
const STARTER_PROFILE = {
  name: "Mouna", program: "BAI", langs: ["English", "Darija"],
  hintPace: "Small steps", challenge: "Gentle", tone: "Encouraging",
  snap: { stuck: "freeze" }, skills: { solve: 0, explain: 0, argue: 0 },
  sessions: 0, history: [], noticed: null, lastChange: "",
};

// Fallback sample task if the database has none (labelled "Sample" in the UI).
const SAMPLE_TASK = { id: "00000000-0000-4000-8000-000000000101", course: "MATH 1101", kind: "problem",
  topic: "Find the derivative of x² · sin x", title: "the product rule", sample: true };

export const store = {
  role: "student",
  policy: DEFAULT_POLICY,
  tasks: [SAMPLE_TASK],
  get courses() { return db.cachedCourses(); },
  _profile: null,

  get profile() { return this._profile || db.cachedProfile() || STARTER_PROFILE; },
  async saveProfile(p) { this._profile = p; setChameleonMood(p.challenge.toLowerCase()); await db.saveProfile(p); },

  // Pull fresh profile, policy and tasks (cached values were already shown).
  async sync() {
    const [policy, tasks, profile] = await Promise.all([
      db.getPolicy().catch(() => DEFAULT_POLICY),
      db.myCourses().catch(() => []).then(() => db.getTasks()).catch(() => []),
      this.role === "student" ? db.loadProfile().catch(() => null) : null,
    ]);
    this.policy = policy;
    if (db.isConfigured()) this.tasks = tasks.map((t) => ({ ...t, title: t.id === SAMPLE_TASK.id ? SAMPLE_TASK.title : t.topic }));
    if (this.role === "student") {
      if (profile) this._profile = profile;
      else if (await db.currentUser()) await this.saveProfile({ ...STARTER_PROFILE }); // first sign-in
      setChameleonMood(this.profile.challenge.toLowerCase());
    }
  },

  // The live session is cached after every turn (works offline) and saved privately to Supabase.
  get session() { return LS.get("session", null); },
  saveSession(s) { LS.set("session", s); db.savePrivateSession(s).then(() => LS.set("session", s)).catch(() => {}); },
  clearSession() { LS.del("session"); },

  startSession(char, task) {
    const P = this.profile;
    const max = Math.min(task.max_hints ?? task.maxHints ?? this.policy.maxHints, this.policy.maxHints);
    const s = {
      char, task: { id: task.id, course: task.course, topic: task.topic, title: task.title, instructions: task.instructions || "", sample: task.sample },
      pace: P.hintPace, level: P.challenge, tone: P.tone, maxHints: max,
      hints: 0, answerReq: 0, meter: 0, step: "", points: [], counters: [],
      msgs: [], note: "", changes: [], start: Date.now(),
    };
    this.saveSession(s);
    return s;
  },
  taskFor(char) { return this.tasks.find((t) => KIND[t.kind] === char) || null; },
  // A free session the student starts inside one of their courses, on their own topic.
  startFree(char, course, topic) {
    const kind = Object.keys(KIND).find((k) => KIND[k] === char);
    return this.startSession(char, { id: null, course, kind, topic, title: `your ${kind === "claim" ? "claim" : "question"} · ${course}` });
  },
  charInfo: CH,
};
