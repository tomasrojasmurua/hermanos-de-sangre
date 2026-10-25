// Modo base en Toccoa: «La semana». Planificas las tardes del pelotón de Winters y vives la semana
// en el campamento: lo que elegiste se ve hacer, y Sobel, Sink y el sábado ponen el resto.
import { clamp, damp, rng } from "../../engine/util.js";
import { cast } from "../../core/roster.js";
import { Week } from "../../core/week.js";
import { planWeek, WeekHUD } from "../../core/weekui.js";
import { bugle, stamp, typewriter, shovel, count } from "../../engine/camp-audio.js";
import { W, UV, ANG_RIGHT } from "./places.js";
import { ACTS, CHOICES, WEEK1, WEEK2, CHATTER, TALK } from "./semana-data.js";

const NAMED = ["lipton", "guarnere", "malarkey", "toye", "muck", "tipper", "christenson", "gordon", "wynn", "martin", "talbert"];
const FACE_CAM = ANG_RIGHT + Math.PI / 2; // looking screen-down, toward the camera
const FACE_UP = FACE_CAM + Math.PI;
const POSES = ["jack", "push", "salute", "dig", "sit", "heal"];

// ---- the camp as a stage: the platoon, Winters, Sobel; walking, poses, camera, a scaled clock ------
class Camp {
  constructor(ctx, hud) {
    const { G, shell, roster } = ctx;
    this.ctx = ctx;
    this.G = G;
    this.hud = hud;
    this.clock = 0;
    this.dph = 0;
    this.r = rng(31 + (ctx.flags.weekN || 0));
    G.soldiers.slice().forEach((s) => s.remove());
    G.soldiers = [];
    G.player = null;
    const ids = NAMED.concat(roster.activeRecruits().map((x) => x.id));
    this.men = ids.map((id, i) => {
      const c = cast(id) || roster.get(id);
      const s = G.add({ id, name: c.name, short: c.short, side: "us", kit: "hbt", weapon: "none", skin: c.skin, mustache: c.mustache, seed: 200 + i });
      s.named = !!cast(id);
      s.st.phase = this.r() * 6;
      s._off = this.r() * 0.25;
      return s;
    });
    const mk = (id, seed, extra = {}) => {
      const c = cast(id);
      return G.add({ id, name: c.name, short: c.short, side: "us", kit: "hbt", rankKey: "lt", weapon: "none", skin: c.skin, seed, ...extra });
    };
    this.win = mk("winters", 1);
    this.sobel = mk("sobel", 7);
    this.extras = [];
    this.moves = new Map();
    this.cam = { x: G.cam.x, z: G.cam.z };
    this.off = shell.hook((dt) => this.tick(dt));
  }
  get speed() {
    return this.hud ? this.hud.speed : 1;
  }
  tick(dt) {
    if (dt <= 0) return;
    const G = this.G, sp = this.speed;
    this.clock += dt * sp;
    for (const [s, m] of this.moves) {
      if (G.moveTo(s, m.x, m.z, dt * sp, m.k, 0.12)) {
        s.st.move = 0;
        if (m.ry != null) s.ry = m.ry;
        this.moves.delete(s);
        m.res();
      }
    }
    // drill in unison: one clock, a small personal lag so a rank isn't a machine
    this.dph += dt * sp * 5.2;
    for (const s of this.G.soldiers) if (s.st.jack || s.st.push || s.st.dig) s.st.dph = this.dph * (s._rate || 1) - (s._off || 0);
    G.cam.x = damp(G.cam.x, this.cam.x, 1.4, dt);
    G.cam.z = damp(G.cam.z, this.cam.z, 1.4, dt);
    this.hud && this.hud.placeTags(G);
  }
  wait(sec) {
    const end = this.clock + sec;
    return this.G.until(() => this.clock >= end);
  }
  look(u, v, span) {
    const [x, z] = W(u, v);
    this.cam.x = x;
    this.cam.z = z;
    // a long way: cut rather than pan across the whole camp
    if (Math.hypot(x - this.G.cam.x, z - this.G.cam.z) > 18) {
      this.G.cam.x = x;
      this.G.cam.z = z;
    }
    if (span) this.G.camSpan = span;
  }
  place(s, u, v, ry = FACE_CAM) {
    const [x, z] = W(u, v);
    s.x = x;
    s.z = z;
    s.y = this.G.world.height(x, z);
    s.ry = ry;
    s.st.move = 0;
    this.moves.delete(s);
    this.show([s], true);
  }
  walk(s, u, v, { k = 0.45, ry = null } = {}) {
    const [x, z] = W(u, v);
    this.show([s], true);
    return new Promise((res) => this.moves.set(s, { x, z, k, ry, res }));
  }
  pose(list, st = {}) {
    for (const s of list) {
      for (const p of POSES) s.st[p] = 0;
      s.proneLock = false;
      Object.assign(s.st, st);
      if (st.prone) s.proneLock = true;
    }
  }
  show(list, on) {
    for (const s of list) {
      s.a.root.visible = on;
      if (s.blob) s.blob.visible = on;
    }
  }
  everyone() {
    return this.men.concat([this.win, this.sobel], this.extras);
  }
  // the platoon in ranks of eight on the parade ground, facing the camera
  ranks(list = this.men, u0 = -82, v0 = 3.4) {
    list.forEach((s, i) => this.place(s, u0 + (i % 8) * 1.9, v0 - Math.floor(i / 8) * 2.7, FACE_CAM));
  }
  scatter(list, u0, u1, v0, v1, ry) {
    for (const s of list) this.place(s, u0 + this.r() * (u1 - u0), v0 + this.r() * (v1 - v0), ry ?? this.r() * 6.28);
  }
  pick(list) {
    return list[Math.floor(this.r() * list.length)];
  }
  // a line from a random man (only at normal speed: fast-forward skips the chatter)
  chat(lines) {
    if (this.speed > 1 || !lines?.length) return;
    const [who, text] = this.pick(lines);
    this.ctx.ui.say(who || this.pick(this.men.filter((s) => s.named)).short, text, 2.4);
  }
  remove() {
    this.off();
    this.moves.clear();
    this.pose(this.everyone());
    this.show(this.everyone(), true);
  }
}

// ---- scenes -------------------------------------------------------------------------------------------
async function calisthenics(camp, { leader = true } = {}) {
  const { audio } = camp.ctx;
  camp.ranks();
  camp.pose(camp.men, { jack: 1 });
  camp.place(camp.win, -75.3, -5.2, FACE_UP);
  camp.pose([camp.win], { jack: leader ? 1 : 0 });
  camp.show([camp.win], leader);
  camp.show([camp.sobel], false);
  camp.look(-75, 0, 15);
  // the count: one shout per half cycle
  let last = -1;
  const off = camp.ctx.shell.hook(() => {
    const beat = Math.floor(camp.dph / Math.PI);
    if (beat !== last) {
      last = beat;
      if (camp.speed === 1) count(audio, beat, { ...xz(-75, 0), n: 8 });
    }
  });
  return () => {
    off();
    camp.pose(camp.men.concat(camp.win));
  };
}
const xz = (u, v) => {
  const [x, z] = W(u, v);
  return { x, z };
};

async function afternoon(camp, act, away) {
  const { ui, roster } = camp.ctx;
  const men = camp.men;
  camp.pose(camp.everyone());
  camp.show([camp.sobel], false);
  camp.show([camp.win], !away);
  let stop = () => {};
  if (act === "calistenia") stop = await calisthenics(camp, { leader: !away });
  else if (act === "armas") {
    // two rows sitting on the clay by the benches; Winters standing in front with a rifle drill
    men.forEach((s, i) => camp.place(s, -80 + (i % 12) * 1.3, -10 - Math.floor(i / 12) * 1.6, FACE_UP));
    camp.pose(men, { sit: 1, heal: 0.6 });
    camp.place(camp.win, -73, -6.2, FACE_CAM);
    camp.look(-73, -9, 13);
  } else if (act === "taquillas") {
    // outside the huts: boots, blankets, rifles; hunched over the work
    men.forEach((s, i) => camp.place(s, -82 + (i % 12) * 2.4 + camp.r() * 0.5, 15.5 + Math.floor(i / 12) * 1.4, FACE_CAM + (camp.r() - 0.5)));
    camp.pose(men, { heal: 1 });
    men.filter((_, i) => i % 3 === 0).forEach((s) => camp.pose([s], { sit: 1, heal: 1 }));
    camp.place(camp.win, -70, 12.5, FACE_UP);
    camp.look(-70, 12.5, 14);
  } else if (act === "descanso") {
    camp.scatter(men, -86, -56, 13, 17.5);
    men.forEach((s, i) => camp.pose([s], i % 4 === 0 ? { prone: 1 } : { sit: 1 }));
    camp.place(camp.win, -66, 13, FACE_CAM);
    camp.pose([camp.win], { sit: 1 });
    camp.look(-70, 12.5, 15);
  } else if (act === "hombres") {
    // a ring of men round Winters by the mess hall
    const ring = men.filter((s) => s.named).sort(() => camp.r() - 0.5).slice(0, 5);
    const rest = men.filter((s) => !ring.includes(s));
    camp.scatter(rest, -86, -60, 13, 17.5);
    camp.pose(rest, { sit: 1 });
    ring.forEach((s, i) => {
      const a = (i / ring.length) * Math.PI * 2;
      camp.place(s, -58 + Math.cos(a) * 2.2, -9 + Math.sin(a) * 2.2);
      s.face(...W(-58, -9), 1, 1);
    });
    camp.pose(ring, { sit: 1 });
    camp.place(camp.win, -58, -9);
    camp.win.face(...W(-58, -12), 1, 1);
    camp.look(-60, -6, 11);
    const talker = ring.find((s) => TALK[s.id]);
    for (const s of ring) roster.bond("winters", s.id, 5);
    if (talker) {
      await camp.wait(0.8);
      ui.say(talker.short, TALK[talker.id], 4);
      if (camp.speed === 1) await camp.ctx.G.until(() => !ui.talking);
    }
  }
  if (away) camp.show([camp.win], false);
  if (away) camp.chat(CHATTER.away);
  else camp.chat(CHATTER[act]);
  return stop;
}

async function morningAway(camp, act) {
  // the company is out on the hill or the course: an empty camp, the run heard far off
  const { audio } = camp.ctx;
  camp.show(camp.everyone(), false);
  if (act === "currahee") {
    camp.look(-30, 2, 22);
    if (camp.speed === 1) setTimeout(() => audio.chant("currahee", 10, ...W(40, 0)), 900);
  } else camp.look(-104, 26, 16);
}

// Sink watches Winters' calisthenics (the book, first week in Toccoa)
async function sink(camp, week) {
  const { G, ui, roster, flags } = camp.ctx;
  const sc = { id: "sink", name: "Cor. Robert Sink", short: "Sink", skin: 0xd6a080 };
  const s = G.add({ ...sc, side: "us", kit: "hbt", rankKey: "lt", weapon: "none", seed: 9 });
  camp.extras.push(s);
  camp.place(s, -86, 9, FACE_CAM);
  await camp.walk(s, -80.5, -7.2, { k: 0.5 });
  s.face(camp.win.x, camp.win.z, 1, 1);
  await camp.wait(1.2);
  camp.pose([camp.win]);
  camp.win.face(s.x, s.z, 1, 1);
  await G.lines([
    ["Sink", "Teniente, ¿cuántas veces ha hecho ejercicios de calistenia esta compañía?", 3.4],
    ["Winters", "Tres veces, señor.", 1.8],
    ["Sink", "Muchas gracias.", 1.6],
  ]);
  camp.walk(s, -90, 26, { k: 0.4 }).then(() => camp.show([s], false));
  await camp.wait(1);
  await ui.card({
    kicker: "Toccoa · Unos días más tarde",
    title: "Teniente primero",
    text: "Sin consultarlo con Sobel, el coronel Sink asciende a Winters a teniente primero.\n\nDesde aquel día, Winters es para Sobel un hombre marcado. El jefe de la compañía le dará todos los trabajos sucios que encuentre.",
    next: "Seguir",
  });
  camp.ctx.audio.paper();
  roster.tension(15);
  flags.firstLt = true;
  camp.hud.update({ sobel: 15 });
}

// Sobel's order of the day: Winters taken off his men for the afternoon
async function dirtyJob(camp, week, day, what) {
  const { ui, audio, roster } = camp.ctx;
  typewriter(audio, 22);
  await ui.card({
    kicker: "Compañía E · Orden del día",
    title: "Asunto: servicio",
    text: `1. El teniente R. D. Winters ${what} esta tarde (${day.label.toLowerCase()}).\n\nH. M. Sobel, teniente primero, jefe de la compañía.`,
    next: "A la orden",
    cls: "order",
  });
  stamp(audio);
  week.away[day.key] = true;
  roster.tension(4);
  camp.hud.update({ sobel: 4 });
}

// twenty push-ups for a minor infraction (the book's standard punishment)
async function pushups(camp) {
  const { ui } = camp.ctx;
  const vis = camp.men.filter((s) => s.a.root.visible);
  const s = camp.pick(vis.filter((x) => x.named)) || vis[0];
  if (!s) return;
  camp.show([camp.sobel], true);
  camp.place(camp.sobel, UV2(s).u - 1.2, UV2(s).v - 1.4, FACE_UP);
  camp.sobel.face(s.x, s.z, 1, 1);
  ui.say("Sobel", `¡${s.short}! ¿Eso es lo que usted llama firmes? ¡Veinte flexiones!`, 2.6);
  await camp.wait(1.2);
  camp.pose([s], { push: 1 });
  s._rate = 0.8;
  camp.hud.tag("push", s, "20 flexiones");
  await camp.wait(3.2);
  camp.pose([s]);
  s._rate = 1;
  camp.hud.untag("push");
  camp.show([camp.sobel], false);
  camp.ctx.roster.mood(s.id, -3);
}
const UV2 = (s) => {
  const [u, v] = UV(s.x, s.z);
  return { u, v };
};

// Saturday morning: Sobel walks the ranks — «orejas sucias», then «taquillas sucias»
async function inspection(camp, week) {
  const { G, ui, audio, roster, music } = camp.ctx;
  camp.ranks();
  camp.pose(camp.everyone());
  camp.place(camp.win, -84.5, -5.2, FACE_UP + 0.5);
  camp.pose([camp.win], { salute: 0 });
  camp.place(camp.sobel, -86, -3.6, ANG_RIGHT);
  camp.look(-80, 0, 13);
  music.intensity(0.08);
  audio.duck(30, 0.25, 0.8);
  await ui.chapter("Sábado · 08:00", "Inspección", "Sobel pasa revista.", 2600);
  const order = week.state.order;
  const ears = 3 + (camp.r() < 0.5 ? 1 : 0);
  const lockers = Math.round(clamp((72 - order) / 72, 0, 1) * 6);
  const pool = camp.men.slice().sort(() => camp.r() - 0.5);
  const denied = pool.slice(0, ears + lockers);
  const reason = new Map(denied.map((s, i) => [s, i < ears ? "ears" : "locker"]));
  // walk the ranks in order: front row first
  const stops = camp.men.filter((s) => reason.has(s));
  // Sobel started with ears: the first stops are always ears, the rest lockers
  stops.forEach((s, i) => reason.set(s, i < ears ? "ears" : "locker"));
  let interceded = false;
  // Winters gets one chance to speak up: at the first «locker» stop (or the last stop if there are none)
  const pleaFor = stops.find((s) => reason.get(s) === "locker") || stops[stops.length - 1];
  for (const s of stops) {
    const { u, v } = UV2(s);
    await camp.walk(camp.sobel, u, v - 1.15, { k: 0.6 });
    camp.sobel.face(s.x, s.z, 1, 1);
    camp.look(u, v, 12);
    await camp.wait(0.4);
    const why = reason.get(s) === "ears" ? "¡Orejas sucias!" : "¡Taquilla sucia!";
    ui.say("Sobel", `${why} ${s.short}, sin pase este fin de semana.`, 2.2);
    stamp(audio);
    camp.hud.tag("d" + s.id, s, "Sin pase", "no");
    roster.mood(s.id, -8);
    await camp.wait(1.1);
    // Winters may speak up for him (invented)
    if (!interceded && s === pleaFor) {
      interceded = true;
      const v2 = await ui.card({
        kicker: "Inspección",
        title: `Sobel apunta a ${s.short}`,
        text: reason.get(s) === "locker" ? `Viste a ${s.short} anoche con la taquilla en orden. Sobel ya ha decidido.` : `${s.short} se lavó esta mañana; lo viste en las duchas. Sobel ya ha decidido.`,
        choices: [
          { label: "Interceder", sub: "Hablar por él delante de la compañía. Sobel no cederá, pero los hombres lo verán.", value: "speak" },
          { label: "Callar", sub: "Es inútil discutir con él delante de la compañía.", value: "quiet" },
        ],
      });
      audio.pencil();
      if (v2 === "speak") {
        await G.lines([
          ["Winters", reason.get(s) === "locker" ? `Mi teniente, la taquilla de ${s.short} estaba en orden. Lo comprobé anoche.` : `Mi teniente, ${s.short} se lavó esta mañana. Lo vi yo mismo.`, 2.8],
          ["Sobel", "¿Discute usted mis órdenes delante de la compañía, teniente? Sin pase. Y usted, tome nota.", 3.2],
        ]);
        roster.tension(8);
        roster.mood(s.id, 10);
        roster.bond("winters", s.id, 10);
        for (const m of camp.men) roster.mood(m.id, 2);
        camp.hud.update({ sobel: 8, moral: 2 });
      } else {
        roster.mood(s.id, -4);
        camp.hud.update();
      }
    }
  }
  await camp.walk(camp.sobel, -66, -3.6, { k: 0.6 });
  audio.whistle(camp.sobel.x, camp.sobel.z, false);
  ui.say("Sobel", "¡Rompan filas!", 1.6);
  await camp.wait(1.8);
  camp.hud.clearTags();
  music.intensity(0.35);
  return denied;
}

// Saturday afternoon: who goes to town, who stays in the barracks; Sunday night, who comes back late
async function weekend(camp, week, denied) {
  const { ui, roster, flags } = camp.ctx;
  const out = camp.men.filter((s) => !denied.includes(s));
  for (const s of out) {
    roster.mood(s.id, 6);
    roster.rest(s.id, 20);
  }
  for (const s of denied) roster.rest(s.id, 12);
  roster.rest("winters", 12);
  // the latest back is a man in a good mood with a pass (invented who; the book says what happens)
  const late = out.filter((s) => !s.named || camp.r() < 0.3).sort((a, b) => (roster.get(b.id).morale || 0) - (roster.get(a.id).morale || 0))[0];
  flags.late = late && camp.r() < 0.75 ? late.id : null;
  const lateS = flags.late ? camp.men.find((s) => s.id === flags.late) : null;
  await ui.card({
    kicker: "Sábado por la tarde · Domingo",
    title: "Pases de fin de semana",
    text: [
      `${out.length} hombres del pelotón salen de pase hacia Toccoa: un batido en la farmacia, una película, una carta echada al correo. ${denied.length} se quedan en el barracón por orden de Sobel.`,
      lateS ? `El domingo por la noche, ${lateS.short} vuelve al campamento con retraso. Sobel lo apunta. Mañana lo pagará.` : "El domingo por la noche, todos vuelven a su hora. Sobel lo comprueba igualmente.",
    ],
    next: "Seguir",
  });
  camp.ctx.audio.paper();
}

// Monday: the late man digs a 6 × 6 × 6 ft hole after a full day's training, then fills it in (the book)
async function hole(camp, id) {
  const { ui, audio, roster } = camp.ctx;
  const s = camp.men.find((m) => m.id === id);
  if (!s) return;
  camp.show(camp.everyone(), false);
  camp.place(s, -58, 9, FACE_CAM);
  camp.place(camp.sobel, -60.5, 7, FACE_CAM);
  camp.sobel.face(s.x, s.z, 1, 1);
  camp.pose([s], { dig: 1 });
  camp.look(-59, 8, 10);
  ui.say("Sobel", `Seis pies por seis por seis, ${s.short}. Con su herramienta de trinchera.`, 3);
  for (let i = 0; i < 5; i++) {
    shovel(audio, s.x, s.z);
    await camp.wait(0.9);
  }
  ui.say("Sobel", "Bien. Ahora, rellénelo.", 2.2);
  for (let i = 0; i < 3; i++) {
    shovel(audio, s.x, s.z);
    await camp.wait(0.9);
  }
  camp.pose([s]);
  roster.mood(s.id, -10);
  roster.tire(s.id, 15);
}

// Wednesday night: the first night march, 18 km with full kit, no water (the book); Winters' call is invented
async function nightMarch(camp, week) {
  const { ui, audio, roster } = camp.ctx;
  bugle(audio, "retreta");
  await ui.fade(true, 1200);
  audio.cricket();
  const v = await ui.card({
    kicker: "Miércoles · 21:00",
    title: "La primera marcha nocturna",
    text: "Dieciocho kilómetros con el equipo completo. Sin descansos, sin cigarrillos y sin agua. Al llegar, Sobel comprobará que cada cantimplora siga llena.",
    choices: [
      { label: "Cumplir la orden", sub: "Nadie bebe. Llegarán destrozados, pero con las cantimploras llenas.", value: "order" },
      { label: "Hacer la vista gorda", sub: "Un trago a escondidas para los que no pueden más. Si Sobel lo nota, lo pagará el pelotón.", value: "drink" },
    ],
  });
  audio.pencil();
  let text;
  if (v === "order") {
    week.nudge({ fatigue: 14, morale: -3 });
    roster.tension(-2);
    text = "Llegan al amanecer arrastrando los pies. Sobel desenrosca las cantimploras una por una. Todas llenas. No dice nada.";
  } else {
    week.nudge({ fatigue: 8, morale: 3 });
    const caught = camp.r() < 0.45 + (roster.d.company.sobelTension - 40) / 120;
    if (caught) {
      week.nudge({ fatigue: 10, morale: -6 });
      roster.tension(6);
      text = "Sobel sopesa una cantimplora, la vacía sobre la arcilla y ordena dos horas de marcha con la mochila cargada en el campo de revista. Para todo el pelotón.";
    } else text = "Las cantimploras pesan lo justo. Sobel las desenrosca una por una y no encuentra nada. Los hombres no lo olvidan.";
  }
  await ui.card({
    kicker: "Jueves · Amanecer",
    title: "Las cantimploras",
    text,
    quote: { t: "Estábamos destrozados, hechos polvo y pensábamos que si no bebíamos un poco de agua caeríamos fulminados.", src: "Burton «Pat» Christenson" },
    next: "Seguir",
  });
  audio.paper();
  await ui.fade(false, 900);
  camp.hud.update();
}

// Thursday: the fitness test; Sobel does his thirty push-ups in public (Tipper's account)
async function sobelTest(camp) {
  const { G, ui, music } = camp.ctx;
  camp.ranks();
  camp.pose(camp.everyone());
  camp.place(camp.sobel, -75.3, -6, FACE_UP);
  camp.place(camp.win, -86, -4, FACE_UP + 0.6);
  camp.look(-75, -3, 12);
  music.intensity(0.06);
  ui.say("", "Casi todos hacen cuarenta flexiones; la prueba pide treinta. Todos saben que Sobel se detiene siempre en veinte.", 4);
  await camp.wait(2.5);
  camp.pose([camp.sobel], { push: 1 });
  camp.sobel._rate = 0.55;
  for (const [n, d] of [["Veinte…", 2.2], ["Veinticuatro… veinticinco…", 2.6], ["…veintiocho…", 2.2], ["¡Treinta!", 1.4]]) {
    ui.sayNow("", n, d);
    await camp.wait(d);
    camp.sobel._rate *= 0.82;
  }
  camp.pose([camp.sobel]);
  camp.sobel._rate = 1;
  await G.lines([
    ["", "Lo consigue. Nadie sonríe.", 2.4],
    ["Tipper", "(en voz baja) Nos consolamos con la idea de que seguía siendo un cabrón a pesar de todo.", 3.6],
  ]);
  music.intensity(0.35);
}

// ---- the week -----------------------------------------------------------------------------------------
export async function semana(ctx, n) {
  const { G, ui, audio, music, roster, flags } = ctx;
  flags.weekN = n;
  const days = n === 1 ? WEEK1 : WEEK2;
  const men = NAMED.concat(roster.activeRecruits().map((x) => x.id));
  const week = new Week({ roster, men, lead: "winters", days, acts: ACTS, state: { order: flags.order ?? 40 } });
  const start = week.stats();
  const hud = { speed: 1, placeTags() {}, update() {}, tag() {}, untag() {}, clearTags() {} };
  const camp = new Camp(ctx, hud);
  // backdrop while planning: the men loafing outside the huts at dusk
  camp.scatter(camp.men, -86, -58, 13, 17.5);
  camp.men.forEach((s, i) => camp.pose([s], i % 3 ? { sit: 1 } : {}));
  camp.place(camp.win, -70, 10, FACE_CAM);
  camp.show([camp.sobel], false);
  camp.look(-72, 12, 16);
  G.cam.x = camp.cam.x;
  G.cam.z = camp.cam.z;
  music.set("camp", 0.32);
  if (n === 1) {
    const r1 = flags.run1 || { lost: 0, helped: 0 };
    await ui.card({
      kicker: "Toccoa · La primera semana",
      title: "Las tardes son tuyas",
      text: [
        `Aquel primer día la compañía perdió a varios hombres. ${r1.lost ? `De los reclutas que corrían contigo, ${r1.lost} ${r1.lost === 1 ? "subió" : "subieron"} a la ambulancia.` : "De los que corrían contigo, ninguno subió a la ambulancia."} ${r1.helped ? `Volviste por ${r1.helped} ${r1.helped === 1 ? "hombre" : "hombres"}; ellos no lo olvidan.` : ""}`,
        "Sobel manda la compañía y decide las mañanas: Currahee tres veces por semana, la pista de obstáculos, la instrucción. Tú mandas un pelotón. Las tardes son tuyas.\n\nEl sábado, Sobel pasa revista. Y la forma con que tus hombres lleguen a la próxima carrera depende de lo que hagas ahora.",
      ],
      next: "Planificar la semana",
    });
  } else {
    await ui.card({
      kicker: "Toccoa · La segunda semana",
      title: "Otra semana de Sobel",
      text: "Ya corren todo el camino de ida y vuelta. El miércoles hay marcha nocturna; el jueves, prueba física para todos, oficiales incluidos.\n\nCuidado con el cansancio: la próxima carrera puede llegar antes de lo que esperas.",
      next: "Planificar la semana",
    });
  }
  audio.paper();
  const plan = await planWeek(ui, week, {
    kicker: n === 1 ? "Semana 1 · Julio de 1942" : "Semana 2 · Agosto de 1942",
    title: "El horario del pelotón",
    hint: n === 1 ? "Toca una tarde y elige qué hace tu pelotón. La raya blanca de cada medidor marca cómo acabará la semana." : "El miércoles por la noche hay marcha. El cansancio pasa a la próxima carrera.",
    choices: CHOICES,
    audio,
  });
  week.plan = plan;
  const H = new WeekHUD(ui, week);
  camp.hud = H;
  window.__week = { week, camp, H }; // for test bots (tools/currahee)
  let denied = [];
  try {
    for (const d of days) {
      // Sobel's order arrives the morning after Sink's visit; a second one if he's angry enough
      if (n === 1 && flags.firstLt && d.key === "mie" && !week.away.mie) await dirtyJob(camp, week, d, "inspeccionará las letrinas");
      if (n === 1 && d.key === "vie" && roster.d.company.sobelTension >= 50) await dirtyJob(camp, week, d, "hará el servicio de oficial de comedor");
      if (n === 2 && d.key === "mar" && roster.d.company.sobelTension >= 55) await dirtyJob(camp, week, d, "hará el servicio de oficial de comedor");
      for (const half of ["am", "pm"]) {
        const s = week.slot(d, half);
        if (!s) continue;
        const act = s.act, A = ACTS[act];
        const away = half === "pm" && week.away[d.key];
        H.day(d.key, `${d.label} · ${half === "am" ? "mañana" : "tarde"}${away ? " · Winters de servicio" : ""}`, A.label);
        if (half === "am" && d.key === "lun" && camp.speed === 1) bugle(audio, "diana");
        if (half === "am" && act === "inspeccion") {
          denied = await inspection(camp, week);
          continue;
        }
        if (act === "pases") {
          await weekend(camp, week, denied);
          continue;
        }
        let stop = () => {};
        if (act === "calWin") stop = await calisthenics(camp);
        else if (act === "prueba") await sobelTest(camp);
        else if (half === "am") await morningAway(camp, act);
        else stop = await afternoon(camp, act, away);
        if (A.line && half === "am" && camp.speed === 1 && act !== "prueba") ui.say("", A.line, 2.2);
        await camp.wait(half === "am" ? 2.4 : 3);
        H.update(week.apply(act, away ? 0.6 : 1));
        if (n === 1 && act === "calWin" && !flags.firstLt) await sink(camp, week);
        if (n === 1 && d.key === "lun" && half === "pm") await pushups(camp);
        await camp.wait(half === "am" ? 1.6 : 2.6);
        stop();
      }
      if (n === 2 && d.key === "lun" && flags.late) {
        H.day(d.key, "Lunes · noche", "El hoyo");
        await hole(camp, flags.late);
        flags.late = null;
      }
      if (d.night === "marcha") {
        H.day(d.key, `${d.label} · noche`, "Marcha nocturna");
        await nightMarch(camp, week);
      }
      if (!d.noNight) {
        H.update(week.night());
        music.intensity(0.25 + week.stats().moral * 0.003);
      }
    }
  } finally {
    camp.remove();
    H.remove();
    window.__week = null;
  }
  flags.order = week.state.order;
  // the week in numbers, and what it means for the next run
  const end = week.stats();
  const rows = [["Forma", "forma"], ["Fatiga", "cansancio"], ["Moral", "moral"], ["Sobel", "sobel"]]
    .map(([l, k]) => `${l}: ${Math.round(start[k])} → ${Math.round(end[k])}`).join("\n");
  const tired = end.cansancio > 55 ? "Llegan reventados. Si ahora tocara correr, más de uno flaquearía." : end.cansancio > 30 ? "Cansados, pero enteros." : "Descansados y en forma.";
  await ui.card({ kicker: n === 1 ? "Fin de la primera semana" : "Jueves por la noche", title: "El pelotón", text: `${rows}\n\n${tired}`, next: "Seguir" });
  audio.paper();
  return { end };
}
