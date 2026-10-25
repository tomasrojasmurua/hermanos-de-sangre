// Modo base: la semana de una unidad como datos. Las mañanas las fija el mando (fixed), las tardes
// las elige el jugador (free). Cada actividad mueve la plantilla persistente (forma, cansancio,
// moral, puntería, mando, lazos) y dos valores de la compañía: el orden para la inspección y la
// tensión con el jefe. Genérico: Toccoa lo usa ahora; Aldbourne o Mourmelon pueden usarlo después.
import { clamp } from "../engine/util.js";

// stats shown on the meters: 0..100
export const METERS = [
  { id: "forma", label: "Forma", good: 1 },
  { id: "cansancio", label: "Fatiga", good: -1 },
  { id: "moral", label: "Moral", good: 1 },
  { id: "orden", label: "Orden", good: 1 },
  { id: "sobel", label: "Sobel", good: -1 },
];

export class Week {
  // cfg: { roster, men: [ids], lead: "winters", days: [{key, label, am, pm}], acts: {id: {...}}, state }
  //   day.am / day.pm: {act, fixed: true} for the commander's blocks, "free" for the player's, null for nothing
  //   act.fx: {fit, fatigue, morale, order, tension, aim, lead, bond}  (per block, at full effect)
  constructor(cfg) {
    Object.assign(this, cfg);
    this.state = cfg.state || { order: 40 };
    this.plan = {}; // day key -> act id for free afternoons
    this.away = {}; // day key -> true when the leader is taken off his men (dirty jobs)
    this.log = [];
  }
  freeDays() {
    return this.days.filter((d) => d.pm === "free");
  }
  slot(day, half) {
    const s = day[half];
    if (s === "free") return this.plan[day.key] ? { act: this.plan[day.key], fixed: false } : null;
    return s || null;
  }
  avg(fn) {
    let n = 0, t = 0;
    for (const id of this.men) {
      const m = this.roster.get(id);
      if (!m || m.washedOut) continue;
      t += fn(m);
      n++;
    }
    return n ? t / n : 0;
  }
  stats() {
    return {
      forma: this.avg((m) => m.stats.fit),
      cansancio: this.avg((m) => m.fatigue || 0),
      moral: this.avg((m) => m.morale ?? 60),
      orden: this.state.order,
      sobel: this.roster.d.company.sobelTension,
    };
  }
  // what the meters would move by if this activity ran now (for the arrows in the planner)
  preview(actId, k = 1) {
    const fx = this.acts[actId]?.fx || {};
    const tired = this.stats().cansancio;
    const gain = 1 - clamp(tired / 140, 0, 0.6);
    return {
      forma: (fx.fit || 0) * k * gain,
      cansancio: (fx.fatigue || 0) * k,
      moral: (fx.morale || 0) * k,
      orden: (fx.order || 0) * k,
      sobel: fx.tension || 0,
    };
  }
  // run one block on the roster; k scales it (a leader away on a dirty job: the men train at 60 %)
  apply(actId, k = 1, { who = null } = {}) {
    const fx = this.acts[actId]?.fx || {};
    const before = this.stats();
    const ids = who || this.men;
    for (const id of ids) {
      const m = this.roster.get(id);
      if (!m || m.washedOut) continue;
      if (fx.fit) this.roster.train(id, "fit", fx.fit * k);
      if (fx.aim) this.roster.train(id, "aim", fx.aim * k);
      if (fx.lead && !m.invented) this.roster.train(id, "lead", fx.lead * k);
      if (fx.fatigue) this.roster.tire(id, fx.fatigue * (fx.fatigue > 0 ? 1 : k));
      if (fx.morale) this.roster.mood(id, fx.morale * k);
    }
    if (fx.fatigue && this.lead) this.roster.tire(this.lead, fx.fatigue * 0.8);
    if (fx.order) this.state.order = clamp(this.state.order + fx.order * k, 0, 100);
    if (fx.tension) this.roster.tension(fx.tension);
    return this.delta(before);
  }
  // overnight: the men sleep some of it off and the barracks get a little untidier
  night({ rest = 12, mess = 6 } = {}) {
    const before = this.stats();
    for (const id of this.men.concat(this.lead ? [this.lead] : [])) this.roster.rest(id, rest);
    this.state.order = clamp(this.state.order - mess, 0, 100);
    return this.delta(before);
  }
  delta(before) {
    const now = this.stats(), d = {};
    for (const k in now) d[k] = now[k] - before[k];
    return d;
  }
  // where the meters end the week if nothing unexpected happens: replays the plan on a copy
  project(plan = this.plan) {
    const R = new this.roster.constructor(JSON.parse(JSON.stringify(this.roster.d)));
    const w = new Week({ ...this, roster: R, state: { ...this.state } });
    w.plan = { ...plan };
    for (const d of this.days) {
      for (const half of ["am", "pm"]) {
        const s = w.slot(d, half);
        if (s && w.acts[s.act]?.fx) w.apply(s.act, this.away[d.key] && half === "pm" ? 0.6 : 1);
      }
      if (!d.noNight) w.night();
    }
    return w.stats();
  }
  // a direct nudge from an event: {fatigue, morale, order, tension, fit} on everyone (or `who`)
  nudge(fx, who) {
    const id = "_n" + Math.random();
    this.acts[id] = { fx };
    const d = this.apply(id, 1, { who });
    delete this.acts[id];
    return d;
  }
}
