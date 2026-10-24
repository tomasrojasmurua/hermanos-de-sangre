// Plantilla persistente: cada hombre arrastra forma, moral, cansancio, heridas y relaciones
// entre momentos, modos y capítulos. La historia grande la decide el libro (fate: "book").
import { COMPANY, RECRUIT_NAMES } from "../data/company.js";
import { clamp } from "../engine/util.js";

export function newRoster() {
  const men = {};
  for (const c of COMPANY) {
    men[c.id] = {
      id: c.id,
      stats: { ...c.stats },
      morale: 70,
      fatigue: 0,
      wounds: [], // [{what, chapter}]
      scars: [], // marcas de lo vivido: [{what, chapter}]
      rel: {}, // id -> -100..100
      xp: {}, // entrenamiento acumulado por stat
      washedOut: false,
    };
  }
  const recruits = RECRUIT_NAMES.map((n, i) => ({ id: "r" + i, name: "Recluta " + n, short: n, morale: 60, fatigue: 0, stats: { fit: 46 + ((i * 7) % 20), aim: 50, stealth: 50, lead: 30, nerve: 50 }, washedOut: false, invented: true }));
  return { men, recruits, company: { morale: 60, sobelTension: 20, passes: 0 } };
}

export function cast(id) {
  return COMPANY.find((c) => c.id === id);
}

export class Roster {
  constructor(data) {
    this.d = data || newRoster();
  }
  get(id) {
    return this.d.men[id] || this.d.recruits.find((r) => r.id === id);
  }
  // training raises a stat a little; tiredness makes it stick less
  train(id, stat, amount) {
    const m = this.get(id);
    if (!m) return;
    const k = 1 - clamp(m.fatigue / 140, 0, 0.6);
    m.stats[stat] = clamp(m.stats[stat] + amount * k, 0, 100);
    m.xp = m.xp || {};
    m.xp[stat] = (m.xp[stat] || 0) + amount;
  }
  tire(id, amount) {
    const m = this.get(id);
    if (m) m.fatigue = clamp(m.fatigue + amount, 0, 100);
  }
  rest(id, amount) {
    this.tire(id, -amount);
  }
  mood(id, amount) {
    const m = this.get(id);
    if (m) m.morale = clamp(m.morale + amount, 0, 100);
  }
  bond(a, b, amount) {
    const A = this.get(a), Bm = this.get(b);
    if (!A || !Bm) return;
    A.rel = A.rel || {};
    Bm.rel = Bm.rel || {};
    A.rel[b] = clamp((A.rel[b] || 0) + amount, -100, 100);
    Bm.rel[a] = clamp((Bm.rel[a] || 0) + amount, -100, 100);
  }
  scar(id, what, chapter) {
    const m = this.get(id);
    if (m) (m.scars = m.scars || []).push({ what, chapter });
  }
  washOut(id) {
    const m = this.get(id);
    // only unnamed recruits can leave: named men follow the book
    if (m && m.invented) m.washedOut = true;
  }
  activeRecruits() {
    return this.d.recruits.filter((r) => !r.washedOut);
  }
  companyMood(amount) {
    this.d.company.morale = clamp(this.d.company.morale + amount, 0, 100);
  }
  tension(amount) {
    this.d.company.sobelTension = clamp(this.d.company.sobelTension + amount, 0, 100);
  }
}
