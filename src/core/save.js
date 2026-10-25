// Guardado general con versión de formato. Un solo registro para todo el juego:
// { v, chapter, moment, roster, flags, chapters: {id: {done, best}}, settings }
// Migra el guardado antiguo del Día D (hds_dia_d_v1).
import { newRoster } from "./roster.js";

export const SAVE_KEY = "hds_save";
export const SAVE_VERSION = 2;

const safeGet = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const safeSet = (k, v) => {
  try {
    localStorage.setItem(k, v);
    return true;
  } catch {
    return false;
  }
};

export function freshSave() {
  return {
    v: SAVE_VERSION,
    chapter: "currahee",
    moment: null,
    roster: newRoster(),
    flags: {},
    chapters: {},
    settings: { music: 0.8, sfx: 0.9, voice: 0.9, vibrate: true },
    updated: Date.now(),
  };
}

// each step takes a save of version n and returns version n+1
const MIGRATIONS = {
  // v1 = the Día D prototype's own key: {part, cp, lead, fallen}
  1: (old) => {
    const s = freshSave();
    s.chapter = "dia-d";
    s.moment = old.part === "brecourt" ? "brecourt:" + (old.cp || "b0") : "noche:" + (old.cp || "n0");
    s.chapters.currahee = { done: false };
    // rule: historical survivors cannot die for good, so a "Lipton took over" save is not carried over
    s.flags.migratedFromV1 = true;
    return s;
  },
};

export function migrate(s) {
  let cur = s;
  while (cur && (cur.v || 1) < SAVE_VERSION) {
    const v = cur.v || 1;
    const step = MIGRATIONS[v];
    if (!step) return freshSave();
    cur = step(cur);
  }
  return cur;
}

export function loadSave() {
  const raw = safeGet(SAVE_KEY);
  if (raw) {
    try {
      return migrate(JSON.parse(raw));
    } catch {
      /* corrupted: fall through */
    }
  }
  const legacy = safeGet("hds_dia_d_v1");
  if (legacy) {
    try {
      const m = migrate({ ...JSON.parse(legacy), v: 1 });
      writeSave(m);
      return m;
    } catch {}
  }
  return null;
}

export function writeSave(s) {
  s.v = SAVE_VERSION;
  s.updated = Date.now();
  // mid-moment (a week being lived) the roster and flags are frozen at the moment's start, so saving a
  // setting from the pause menu never stores half a week: resuming replays the moment cleanly
  if (s.frozen) {
    const { frozen, ...rest } = s;
    return safeSet(SAVE_KEY, JSON.stringify({ ...rest, ...JSON.parse(frozen) }));
  }
  return safeSet(SAVE_KEY, JSON.stringify(s));
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {}
}
