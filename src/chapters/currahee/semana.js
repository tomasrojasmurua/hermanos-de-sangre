// Modo base en Toccoa: «La semana». Planificas las tardes del pelotón de Winters y vives la semana
// en el campamento: lo que elegiste se ve hacer, y Sobel, Sink y el sábado ponen el resto.
import { T, clamp, damp, rng } from "../../engine/util.js";
import { cast } from "../../core/roster.js";
import { Week } from "../../core/week.js";
import { planWeek, WeekHUD } from "../../core/weekui.js";
import { bugle, stamp, typewriter, shovel, slosh, count } from "../../engine/camp-audio.js";
import { W, UV, ANG_RIGHT } from "./places.js";
import { ACTS, CHOICES, WEEK1, WEEK2, CHATTER, TALK, runFit } from "./semana-data.js";

const NAMED = ["lipton", "guarnere", "malarkey", "toye", "muck", "tipper", "christenson", "gordon", "wynn", "martin", "talbert"];
const FACE_CAM = ANG_RIGHT + Math.PI / 2; // looking screen-down, toward the camera
const FACE_UP = FACE_CAM + Math.PI;
const POSES = ["jack", "push", "salute", "dig", "sit", "heal"];
const FLAG = [-69, 11]; // the flagpole: where the bugler stands

// ---- the camp as a stage: the platoon, Winters, Sobel; walking, poses, camera, a scaled clock ------
class Camp {
  constructor(ctx, hud) {
    const { G, shell, roster } = ctx;
    this.ctx = ctx;
    this.G = G;
    this.hud = hud;
    this.clock = 0;
    this.dph = 0;
    this.r = rng(31 + (ctx.flags.weekN || 0) * 7 + (ctx.flags.talked?.length || 0));
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
    this.sobel._step = 1.25; // Sobel's flat feet are the loudest on the clay
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
    const G = this.G, sp = this.speed, audio = this.ctx.audio;
    this.clock += dt * sp;
    for (const [s, m] of this.moves) {
      const px = s.x, pz = s.z;
      const done = G.moveTo(s, m.x, m.z, dt * sp, m.k, 0.12);
      // boots on the clay: a step every ~0.75 m, near and loud or far and soft
      s._walked = (s._walked || 0) + Math.hypot(s.x - px, s.z - pz);
      if (s._walked > 0.75) {
        s._walked = 0;
        const p = audio.on && sp === 1 ? audio._pos(s.x, s.z) : null;
        const soft = p ? clamp((s._step || 0.8) * (1.1 - p.d / 28), 0, 1.3) : 0;
        if (soft > 0.05) audio.stride(soft, clamp(p.pan, -0.8, 0.8));
      }
      if (done) {
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
  // a subtitle that keeps pace with fast-forward (it replaces the queue instead of piling up)
  say(who, text, dur = 2.4) {
    if (this.speed > 1) this.ctx.ui.sayNow(who, text, dur / this.speed);
    else this.ctx.ui.say(who, text, dur);
  }
  async lines(list) {
    for (const [who, text, dur] of list) {
      this.say(who, text, dur);
      await this.wait(dur + 0.15);
    }
  }
  // a decision always comes at normal speed
  card(o) {
    if (this.hud?.setSpeed && this.hud.speed > 3 && o.choices) this.hud.setSpeed(1);
    return this.ctx.ui.card(o);
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
    s.y = this.G.world.height(x, z) + (s.lift || 0);
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
  // the instructor's platform on the parade ground (Winters led calisthenics from one, the book says)
  platform(on) {
    if (on && !this.plat) {
      const m = new T.Mesh(new T.BoxGeometry(2.4, 0.7, 1.8), new T.MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.95, flatShading: true }));
      const [x, z] = W(-75.3, -6.2);
      m.position.set(x, this.G.world.height(x, z) + 0.35, z);
      m.rotation.y = ANG_RIGHT;
      m.castShadow = m.receiveShadow = true;
      this.G.scene.add(m);
      this.plat = m;
    }
    if (this.plat) this.plat.visible = on;
    this.win.lift = on ? 0.7 : 0;
  }
  // a mound of red clay beside a man digging: grows, then shrinks as he fills it back in
  mound(u, v, k) {
    if (!this.dirt) {
      const m = new T.Mesh(new T.ConeGeometry(1, 0.7, 9), new T.MeshStandardMaterial({ color: 0x9a5236, roughness: 1, flatShading: true }));
      m.castShadow = m.receiveShadow = true;
      this.G.scene.add(m);
      this.dirt = m;
    }
    const [x, z] = W(u, v);
    this.dirt.visible = k > 0.02;
    this.dirt.scale.set(0.3 + k * 1.1, 0.1 + k, 0.3 + k * 1.1);
    this.dirt.position.set(x, this.G.world.height(x, z) + 0.35 * (0.1 + k) - 0.05, z);
  }
  remove() {
    this.off();
    this.moves.clear();
    this.pose(this.everyone());
    this.platform(false);
    if (this.dirt) this.dirt.visible = false;
    this.show(this.everyone(), true);
  }
}

// ---- scenes -------------------------------------------------------------------------------------------
async function calisthenics(camp, { leader = true, company = false } = {}) {
  const { audio, ui } = camp.ctx;
  camp.ranks();
  camp.pose(camp.men, { jack: 1 });
  camp.platform(company); // the company session: Winters on the platform
  camp.place(camp.win, -75.3, company ? -6.2 : -5.2, FACE_UP);
  camp.pose([camp.win], { jack: leader ? 1 : 0 });
  camp.show([camp.win], leader);
  camp.show([camp.sobel], false);
  camp.look(-75, 1.2, 15);
  // the count: once per full jack, four reps then two quiet, and never over somebody talking
  let last = -1;
  const off = camp.ctx.shell.hook(() => {
    const c = Math.floor(camp.dph / (Math.PI * 2));
    if (c === last) return;
    last = c;
    const i = c % 6;
    if (i < 4 && camp.speed === 1 && !ui.talking) count(audio, i, { ...xz(-75, 1), n: 8, gain: 0.11 });
  });
  return () => {
    off();
    camp.pose(camp.men.concat(camp.win));
    camp.platform(false);
  };
}
const xz = (u, v) => {
  const [x, z] = W(u, v);
  return { x, z };
};

async function afternoon(camp, act, away) {
  const { ui, roster, flags } = camp.ctx;
  const men = camp.men;
  camp.pose(camp.everyone());
  camp.show([camp.sobel], false);
  let stop = () => {};
  if (act === "calistenia") stop = await calisthenics(camp, { leader: !away });
  else if (act === "armas") {
    // two rows sitting on the clay at the edge of the parade ground; Winters standing in front
    men.forEach((s, i) => camp.place(s, -80 + (i % 12) * 1.3, -6 - Math.floor(i / 12) * 1.6, FACE_UP));
    camp.pose(men, { sit: 1, heal: 0.6 });
    camp.place(camp.win, -73, -2.4, FACE_CAM);
    camp.look(-73, -4.6, 12.5);
  } else if (act === "taquillas") {
    // outside the huts: boots, blankets, rifles; hunched over the work
    men.forEach((s, i) => camp.place(s, -82 + (i % 12) * 2.4 + camp.r() * 0.5, 15.5 + Math.floor(i / 12) * 1.4, FACE_CAM + (camp.r() - 0.5)));
    camp.pose(men, { heal: 1 });
    men.filter((_, i) => i % 3 === 0).forEach((s) => camp.pose([s], { sit: 1, heal: 1 }));
    camp.place(camp.win, -70, 12.5, FACE_UP);
    camp.look(-70, 15.5, 13);
  } else if (act === "descanso") {
    camp.scatter(men, -86, -56, 13, 17.5);
    men.forEach((s, i) => camp.pose([s], i % 4 === 0 ? { prone: 1 } : { sit: 1 }));
    camp.place(camp.win, -66, 13, FACE_CAM);
    camp.pose([camp.win], { sit: 1 });
    camp.look(-70, 15.5, 13.5);
  } else if (act === "hombres") {
    // a ring of men; with Winters there, round him; without him, a card game among themselves
    flags.talked = flags.talked || [];
    const named = men.filter((s) => s.named);
    const fresh = named.filter((s) => TALK[s.id] && !flags.talked.includes(s.id));
    const talker = away ? null : fresh[0] || camp.pick(named);
    const ring = [talker, ...named.filter((s) => s !== talker).sort(() => camp.r() - 0.5)].filter(Boolean).slice(0, 5);
    const rest = men.filter((s) => !ring.includes(s));
    camp.scatter(rest, -86, -60, 13, 17.5);
    camp.pose(rest, { sit: 1 });
    ring.forEach((s, i) => {
      const a = (i / ring.length) * Math.PI * 2;
      camp.place(s, -58 + Math.cos(a) * 2.2, -9 + Math.sin(a) * 2.2);
      s.face(...W(-58, -9), 1, 1);
    });
    camp.pose(ring, { sit: 1 });
    camp.look(-60, -6.5, 11);
    if (!away) {
      camp.place(camp.win, -58, -9);
      camp.win.face(...W(-58, -12), 1, 1);
      for (const s of ring) roster.bond("winters", s.id, 5);
      if (talker && TALK[talker.id]) {
        flags.talked.push(talker.id);
        await camp.wait(0.8);
        camp.say(talker.short, TALK[talker.id], 4);
        if (camp.speed === 1) await camp.ctx.G.until(() => !ui.talking);
      }
    }
  }
  if (away) camp.show([camp.win], false);
  if (away) camp.chat(CHATTER.away);
  else camp.chat(CHATTER[act]);
  return stop;
}

// the company is out on the hill or the course: a brief look at the empty camp, the run heard far off
async function morningAway(camp, act) {
  const { audio } = camp.ctx;
  camp.show(camp.everyone(), false);
  if (act === "currahee") {
    camp.look(-30, 2, 22);
    if (camp.speed === 1) audio.chant("currahee", 10, ...W(40, 0));
  } else camp.look(-104, 26, 16);
}

// Sink watches Winters' calisthenics (the book, first week in Toccoa)
async function sink(camp) {
  const { G, ui, roster, flags, music, audio } = camp.ctx;
  const sc = { id: "sink", name: "Cor. Robert Sink", short: "Sink", skin: 0xd6a080 };
  const s = G.add({ ...sc, side: "us", kit: "hbt", rankKey: "lt", weapon: "none", seed: 9 });
  s._step = 1;
  camp.place(s, -86, 9, FACE_CAM);
  await camp.walk(s, -80.5, -7.2, { k: 0.5 });
  s.face(camp.win.x, camp.win.z, 1, 1);
  await camp.wait(1.2);
  camp.pose([camp.win]);
  camp.win.face(s.x, s.z, 1, 1);
  await camp.lines([
    ["Sink", "Teniente, ¿cuántas veces ha hecho ejercicios de calistenia esta compañía?", 3.4],
    ["Winters", "Tres veces, señor.", 1.8],
    ["Sink", "Muchas gracias.", 1.6],
  ]);
  // he walks off and is gone (not left standing about the camp for the rest of the week)
  camp.walk(s, -92, 24, { k: 0.5 }).then(() => {
    s.remove();
    G.soldiers = G.soldiers.filter((x) => x !== s);
  });
  await camp.wait(1);
  music.sting("arrival");
  await ui.card({
    kicker: "Toccoa · Unos días más tarde",
    title: "Teniente primero",
    text: "Sin consultarlo con Sobel, el coronel Sink asciende a Winters a teniente primero.\n\nDesde aquel mismo día, Winters es para Sobel un hombre marcado. El jefe de la compañía le dará todos los trabajos sucios que encuentre.",
    next: "Seguir",
  });
  audio.paper();
  roster.tension(15);
  flags.firstLt = true;
  camp.hud.update({ sobel: 15 });
}

// Sobel's order of the day: Winters taken off his men for the afternoon, and who he leaves in charge
async function dirtyJob(camp, week, day, what, signed) {
  const { audio, roster } = camp.ctx;
  camp.hud.day(day.key, `${day.label} · mañana`, "Orden del día");
  typewriter(audio, 22);
  if (what.includes("comedor")) bugle(audio, "rancho", { ...xz(...FLAG), short: camp.speed > 1, level: 0.7 });
  const v = await camp.card({
    kicker: "Compañía E · Orden del día",
    title: "Asunto: servicio",
    text: `1. El teniente R. D. Winters ${what} esta tarde (${day.label.toLowerCase()}).\n\n${signed}\n\n¿Quién se queda al frente del pelotón?`,
    choices: [
      { label: "Lipton", sub: "Sereno y ordenado. Los hombres trabajarán casi igual que contigo.", value: "lipton" },
      { label: "Guarnere", sub: "Los hombres se reirán más. Puede acabar en pelea, y Sobel se enteraría.", value: "guarnere" },
    ],
  });
  stamp(audio);
  week.away[day.key] = true;
  if (v === "lipton") {
    week.awayK[day.key] = 0.8;
    roster.train("lipton", "lead", 2);
  } else {
    week.awayK[day.key] = 0.6;
    week.nudge({ morale: 3 });
    week.fight = week.fight || {};
    week.fight[day.key] = camp.r() < 0.35;
  }
  roster.tension(4);
  camp.hud.update({ sobel: 4 });
}

// twenty push-ups for a minor infraction (the book's standard punishment)
async function pushups(camp) {
  const { audio, roster } = camp.ctx;
  const vis = camp.men.filter((s) => s.a.root.visible);
  const s = camp.pick(vis.filter((x) => x.named)) || vis[0];
  if (!s) return;
  camp.show([camp.sobel], true);
  camp.place(camp.sobel, UV2(s).u - 1.2, UV2(s).v - 1.4, FACE_UP);
  camp.sobel.face(s.x, s.z, 1, 1);
  camp.say("Sobel", `¡${s.short}! ¿Eso es lo que usted llama firmes? ¡Veinte flexiones!`, 2.6);
  await camp.wait(1.2);
  camp.pose([s], { push: 1 });
  s._rate = 0.8;
  camp.hud.tag("push", s, "20 flexiones");
  // he counts them himself, out of breath
  for (let i = 0; i < 4; i++) {
    if (camp.speed === 1) {
      count(audio, i, { x: s.x, z: s.z, n: 1, gain: 0.1 });
      audio.breath(0.35 + i * 0.12, 0, 1);
    }
    await camp.wait(0.8);
  }
  camp.pose([s]);
  s._rate = 1;
  camp.hud.untag("push");
  camp.show([camp.sobel], false);
  roster.mood(s.id, -3);
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
  camp.place(camp.sobel, -86, -3.6, ANG_RIGHT);
  camp.look(-80, 1.6, 13);
  // silence as a tool: no score, the cicadas pulled back, only boots and Sobel's voice
  music.set("silence", 0);
  audio.setBed(0.45);
  if (camp.speed === 1) await camp.wait(bugle(audio, "formar", { ...xz(...FLAG), level: 0.8 }) * 0.6);
  await ui.chapter("Sábado · 08:00", "Inspección", "Sobel pasa revista.", 2400);
  // the platoon comes to attention: one word from Winters and two dozen heels together
  if (camp.speed === 1) {
    audio.chant("firmes", 1, camp.win.x, camp.win.z);
    setTimeout(() => { for (let i = 0; i < 20; i++) audio.stride(0.55, Math.random() * 1.2 - 0.6, audio.ctx.currentTime + Math.random() * 0.07); }, 650);
  }
  await camp.wait(1.2);
  const order = week.state.order;
  const ears = 3 + (camp.r() < 0.5 ? 1 : 0);
  const lockers = Math.round(clamp((72 - order) / 72, 0, 1) * 6);
  const denied = camp.men.slice().sort(() => camp.r() - 0.5).slice(0, ears + lockers);
  // walk the ranks in order (front row first); Sobel starts with ears, then switches to lockers
  const stops = camp.men.filter((s) => denied.includes(s));
  const reason = new Map(stops.map((s, i) => [s, i < ears ? "ears" : "locker"]));
  const pleaFor = stops.find((s) => reason.get(s) === "locker") || stops[stops.length - 1];
  for (const s of stops) {
    const { u, v } = UV2(s);
    await camp.walk(camp.sobel, u, v - 1.15, { k: 0.6 });
    camp.sobel.face(s.x, s.z, 1, 1);
    camp.look(u, v + 1.4, 12);
    await camp.wait(0.4);
    const why = reason.get(s) === "ears" ? "¡Orejas sucias!" : "¡Taquilla sucia!";
    camp.say("Sobel", `${why} ${s.short}, sin pase este fin de semana.`, 2.2);
    stamp(audio, 0.8);
    camp.hud.tag("d" + s.id, s, "Sin pase", "no");
    roster.mood(s.id, -8);
    await camp.wait(1.1);
  }
  await camp.walk(camp.sobel, -66, -3.6, { k: 0.6 });
  audio.whistle(camp.sobel.x, camp.sobel.z, false);
  camp.say("Sobel", "¡Rompan filas!", 1.6);
  await camp.wait(1.8);
  camp.hud.clearTags();
  // afterwards, out of the men's sight: what Winters does about it (invented; he never defied Sobel openly)
  if (pleaFor) await plea(camp, week, pleaFor, reason.get(pleaFor));
  music.set("camp", 0.3);
  audio.setBed(1);
  return denied;
}

async function plea(camp, week, s, why) {
  const { audio, roster } = camp.ctx;
  const seen = why === "locker" ? `Anoche viste la taquilla de ${s.short}, y estaba en orden.` : `Esta mañana viste a ${s.short} en las duchas.`;
  const v = await camp.card({
    kicker: "Después de la inspección",
    title: `${s.short} se queda sin pase`,
    text: `${seen} Sobel ya ha decidido, y Winters no le lleva la contraria delante de la compañía.`,
    choices: [
      { label: "Hablar con Sobel en privado", sub: "Sobel no cederá. Los hombres se enterarán por los rumores.", value: "talk" },
      { label: `Ayudar a ${s.short} con la taquilla`, sub: "Sin una palabra. Para que el sábado que viene no tenga excusa.", value: "help" },
      { label: "Dejarlo estar", sub: "No es el momento.", value: "let" },
    ],
  });
  audio.pencil();
  if (v === "talk") {
    camp.show(camp.men, false);
    camp.place(camp.sobel, -62, 7.5, FACE_UP);
    camp.place(camp.win, -63.2, 6.3, FACE_UP);
    camp.win.face(camp.sobel.x, camp.sobel.z, 1, 1);
    camp.sobel.face(camp.win.x, camp.win.z, 1, 1);
    camp.look(-62.5, 8, 9);
    await camp.lines([
      ["Winters", why === "locker" ? `Mi teniente, con permiso. La taquilla de ${s.short} estaba en orden; lo comprobé anoche.` : `Mi teniente, con permiso. ${s.short} se lavó esta mañana; lo vi yo mismo.`, 3.2],
      ["Sobel", "¿Me está diciendo cómo mandar mi compañía, teniente? Puede retirarse.", 2.8],
    ]);
    roster.tension(6);
    roster.mood(s.id, 6);
    roster.bond("winters", s.id, 8);
    for (const m of camp.men) roster.mood(m.id, 1);
    camp.hud.update({ sobel: 6, moral: 1 });
  } else if (v === "help") {
    roster.mood(s.id, 5);
    roster.bond("winters", s.id, 10);
    week.state.order = clamp(week.state.order + 6, 0, 100);
    roster.tension(1);
    camp.hud.update({ orden: 6 });
  } else {
    roster.mood(s.id, -4);
    camp.hud.update();
  }
}

// Saturday afternoon and Sunday: beer at the canteen for those with a pass; Sunday night, who comes back late
async function weekend(camp, week, denied) {
  const { roster, flags, music, audio } = camp.ctx;
  const out = camp.men.filter((s) => !denied.includes(s));
  for (const s of out) {
    roster.mood(s.id, 6);
    roster.rest(s.id, 10);
  }
  for (const s of denied) roster.rest(s.id, 6);
  roster.rest("winters", 8);
  // the latest back is a man in a good mood with a pass (invented who; the book says what happens next)
  const late = out.filter((s) => !s.named || camp.r() < 0.3).sort((a, b) => (roster.get(b.id).morale || 0) - (roster.get(a.id).morale || 0))[0];
  flags.late = late && camp.r() < 0.75 ? late.id : null;
  const lateS = flags.late ? camp.men.find((s) => s.id === flags.late) : null;
  music.set("calm", 0.3);
  await camp.card({
    kicker: "Sábado por la tarde · Domingo",
    title: "Pases de fin de semana",
    text: [
      `${out.length} hombres del pelotón tienen pase. No hay ningún pueblo cerca, así que es cerveza en la cantina, montones de cerveza, canciones y alguna pelea antes de volver dando tumbos al barracón. ${denied.length} se quedan castigados por orden de Sobel.`,
      lateS ? `El domingo por la noche, ${lateS.short} se presenta tarde a la lista. Sobel lo apunta. Mañana lo pagará.` : "El domingo por la noche, todos están a su hora en la lista. Sobel lo comprueba igualmente.",
    ],
    next: "Seguir",
  });
  audio.paper();
  music.set("camp", 0.3);
}

// Monday: the late man digs a 6 × 6 × 6 ft hole after a full day's training, then fills it in (the book)
async function hole(camp, id) {
  const { audio, roster } = camp.ctx;
  const s = camp.men.find((m) => m.id === id);
  if (!s) return;
  camp.show(camp.everyone(), false);
  camp.place(s, -58, 9, FACE_CAM);
  camp.place(camp.sobel, -60.5, 7, FACE_CAM);
  camp.sobel.face(s.x, s.z, 1, 1);
  camp.pose([s], { dig: 1 });
  camp.look(-59, 9.5, 10);
  camp.say("Sobel", `Seis pies por seis por seis, ${s.short}. Con su herramienta de trinchera.`, 3);
  const dig = async (n, from, to) => {
    for (let i = 0; i < n; i++) {
      if (camp.speed === 1 || i % 2 === 0) shovel(audio, s.x, s.z);
      camp.mound(-56.8, 9.6, from + (to - from) * ((i + 1) / n));
      await camp.wait(0.8 + camp.r() * 0.6);
    }
  };
  await dig(6, 0, 1);
  camp.say("", "Horas después. Ya ha oscurecido.", 2);
  await camp.wait(1);
  camp.say("Sobel", "Bien. Ahora, rellénelo.", 2.2);
  await dig(4, 1, 0);
  camp.mound(-56.8, 9.6, 0);
  camp.pose([s]);
  roster.mood(s.id, -10);
  roster.tire(s.id, 15);
}

// Wednesday night: the first night march, 18 km with full kit, no water (the book); Winters' call is invented
async function nightMarch(camp, week) {
  const { ui, audio, roster } = camp.ctx;
  audio.startBed("night");
  bugle(audio, "formar", { ...xz(...FLAG), short: camp.speed > 1, level: 0.6 });
  const v = await camp.card({
    kicker: "Miércoles · 21:00",
    title: "La primera marcha nocturna",
    cls: "night",
    text: "Dieciocho kilómetros con el equipo completo. Sin descansos, sin cigarrillos y sin agua. Al llegar, Sobel comprobará que cada cantimplora siga llena.",
    choices: [
      { label: "Cumplir la orden", sub: "Nadie bebe. Llegarán destrozados, pero con las cantimploras llenas.", value: "order" },
      { label: "Hacer la vista gorda", sub: "Un trago a escondidas para los que no pueden más. Si Sobel lo nota, lo pagará el pelotón.", value: "drink" },
    ],
  });
  audio.pencil();
  // the march itself, in the dark: boots, breath getting harder
  await ui.fade(true, 700);
  if (camp.speed === 1) {
    const t0 = audio.ctx.currentTime;
    for (let i = 0; i < 26; i++) audio.stride(0.5, Math.random() * 1.4 - 0.7, t0 + i * (60 / 112) * 0.5 + Math.random() * 0.03);
    for (let i = 0; i < 4; i++) setTimeout(() => audio.breath(0.3 + i * 0.17, Math.random() * 0.8 - 0.4, 1), i * 1000);
    await new Promise((r) => setTimeout(r, 3600));
  }
  let text, caught = false;
  if (v === "order") {
    week.nudge({ fatigue: 14, morale: -3 });
    roster.tension(-2);
    text = "Llegan pasada la medianoche, arrastrando los pies. Sobel desenrosca las cantimploras una por una y las sopesa. Todas llenas. No dice nada.";
  } else {
    week.nudge({ fatigue: 8, morale: 3 });
    caught = camp.r() < 0.45 + (roster.d.company.sobelTension - 40) / 120;
    if (caught) {
      week.nudge({ fatigue: 10, morale: -6 });
      roster.tension(6);
      text = "Llegan pasada la medianoche. Sobel sopesa una cantimplora, la oye chapotear, la vacía sobre la arcilla y ordena dos horas de marcha con la mochila cargada en el campo de revista. Para todo el pelotón.";
    } else text = "Llegan pasada la medianoche. Sobel sopesa las cantimploras una por una y no encuentra nada. Los hombres no lo olvidan.";
  }
  if (caught) slosh(audio);
  await ui.fade(false, 10); // the night card is dark enough on its own
  await camp.card({
    kicker: "Jueves · Pasada la medianoche",
    title: "Las cantimploras",
    cls: "night",
    text,
    quote: { t: "Estábamos destrozados, hechos polvo y pensábamos que si no bebíamos un poco de agua caeríamos fulminados.", src: "Burton «Pat» Christenson" },
    next: "Seguir",
  });
  audio.paper();
  audio.startBed("georgia");
  camp.hud.update();
}

// Thursday night (week 2): Sobel goes through the barracks with a flashlight (invented; the punishment is the book's)
async function barracks(camp, week) {
  const { audio, roster } = camp.ctx;
  audio.startBed("night");
  const ok = week.state.order >= 55;
  stamp(audio, 0.6);
  await camp.card({
    kicker: "Jueves · 22:30",
    title: "Revista de barracones",
    cls: "night",
    text: ok
      ? "Sobel entra en el barracón con una linterna. Pasa la luz por las mantas, las botas, las taquillas. Todo en su sitio. Se va sin decir nada."
      : "Sobel entra en el barracón con una linterna. Una taquilla abierta, un par de botas sin lustrar. «Dos horas de marcha con la mochila cargada en el campo de revista. Ahora.» El pelotón se acuesta pasada la una.",
    next: "Seguir",
  });
  if (ok) roster.tension(-3);
  else {
    week.nudge({ fatigue: 10, morale: -4 });
    roster.tension(3);
  }
  audio.paper();
  audio.startBed("georgia");
  camp.hud.update();
}

// Thursday: the fitness test; Sobel does his thirty push-ups in public (Tipper's account)
async function sobelTest(camp) {
  const { ui, music, audio } = camp.ctx;
  camp.ranks();
  camp.pose(camp.everyone());
  camp.place(camp.sobel, -75.3, -6, FACE_UP);
  camp.place(camp.win, -86, -4, FACE_UP + 0.6);
  camp.look(-75, -1.2, 12);
  music.set("silence", 0);
  camp.say("", "La prueba pide treinta flexiones; los hombres ya están tan en forma que a nadie le preocupa. Pero todos saben que Sobel se detiene siempre en veinte.", 4.2);
  await camp.wait(2.8);
  camp.pose([camp.sobel], { push: 1 });
  camp.sobel._rate = 0.55;
  const steps = [["Veinte…", 2.2], ["Veinticuatro… veinticinco…", 2.6], ["…veintiocho…", 2.2], ["¡Treinta!", 1.4]];
  for (let i = 0; i < steps.length; i++) {
    const [n, d] = steps[i];
    ui.sayNow("", n, d / camp.speed);
    if (camp.speed === 1) {
      audio.breath(0.4 + i * 0.15, 0, 1.2); // he's straining
      count(audio, i, { ...xz(-80, 1), n: 12, gain: 0.05 }); // the men count under their breath
    }
    await camp.wait(d);
    camp.sobel._rate *= 0.82;
  }
  camp.pose([camp.sobel]);
  camp.sobel._rate = 1;
  camp.say("", "Silencio. Cabezas que se sacuden. Nadie sonríe.", 2.4);
  await camp.wait(2.4);
  await camp.card({
    kicker: "La prueba física",
    title: "Treinta",
    text: "A los veinticuatro le temblaban los brazos y tenía la cara roja como un tomate, pero siguió. Era evidente que a Sobel no le faltaba determinación.",
    quote: { t: "Nos consolamos con la idea de que continuaba siendo un cabrón a pesar de todo.", src: "Ed Tipper" },
    next: "Seguir",
  });
  audio.paper();
  music.set("camp", 0.3);
}

// ---- the week -----------------------------------------------------------------------------------------
export async function semana(ctx, n) {
  const { G, ui, audio, music, roster, flags, save } = ctx;
  flags.weekN = n;
  // a pause-menu save during the week stores the week's starting state, never half a week
  save.frozen = JSON.stringify({ roster: roster.d, flags });
  const days = n === 1 ? WEEK1 : WEEK2;
  const men = NAMED.concat(roster.activeRecruits().map((x) => x.id));
  const week = new Week({ roster, men, lead: "winters", days, acts: ACTS, state: { order: flags.order ?? 40 } });
  // what will happen whatever the plan, so the projection doesn't lie: Sink's visit and Sobel's first order
  if (n === 1 && !flags.firstLt)
    week.scripted = (d, w) => {
      if (d.key === "mar") w.roster.tension(15);
      if (d.key === "vie") {
        w.away.vie = true;
        w.awayK.vie = w.awayK.vie ?? 0.7;
        w.roster.tension(4);
      }
    };
  const start = week.stats();
  const hud = { speed: 1, placeTags() {}, update() {}, tag() {}, untag() {}, clearTags() {}, day() {} };
  const camp = new Camp(ctx, hud);
  // backdrop while planning: the men loafing outside the huts
  camp.scatter(camp.men, -86, -58, 13, 17.5);
  camp.men.forEach((s, i) => camp.pose([s], i % 3 ? { sit: 1 } : {}));
  camp.place(camp.win, -70, 10, FACE_CAM);
  camp.show([camp.sobel], false);
  camp.look(-72, 14, 16);
  G.cam.x = camp.cam.x;
  G.cam.z = camp.cam.z;
  music.set("camp", 0.3);
  if (n === 1) {
    const r1 = flags.run1 || { lost: 0, helped: 0 };
    await ui.card({
      kicker: "Toccoa · La primera semana",
      title: "Las tardes son tuyas",
      text: [
        `Aquel primer día la compañía perdió a varios hombres. ${r1.lost ? `De los reclutas que corrían contigo, ${r1.lost} ${r1.lost === 1 ? "subió" : "subieron"} a la ambulancia.` : "De los que corrían contigo, ninguno subió a la ambulancia."} ${r1.helped ? `Volviste por ${r1.helped} ${r1.helped === 1 ? "hombre" : "hombres"}; ellos no lo olvidan.` : ""}`,
        "Sobel manda la compañía y decide las mañanas: Currahee tres veces por semana, la pista de obstáculos, la instrucción. Tú mandas un pelotón, y las tardes son tuyas.\n\nForma y fatiga deciden quién aguanta la próxima carrera; la moral ayuda a aguantar.",
        "Orden: cómo estarán las taquillas el sábado. Cuanto más bajo, más pases negará Sobel.\n\nSobel: su roce con Winters. Cuanto más alto, más trabajos sucios le caerán, y esas tardes el pelotón entrenará sin ti.",
      ],
      next: "Planificar la semana",
    });
  } else {
    await ui.card({
      kicker: "Toccoa · La segunda semana",
      title: "Otra semana de Sobel",
      text: "Ya corren todo el camino de ida y vuelta. El miércoles hay marcha nocturna; el jueves, prueba física para todos, oficiales incluidos, y por la noche Sobel revisará los barracones.\n\nCuidado con la fatiga: la próxima carrera puede llegar antes de lo que esperas.",
      next: "Planificar la semana",
    });
  }
  audio.paper();
  const plan = await planWeek(ui, week, {
    kicker: n === 1 ? "Semana 1 · Julio de 1942" : "Semana 2 · Julio–agosto de 1942",
    title: "El horario del pelotón",
    hint: n === 1 ? "Toca una tarde y elige qué hace tu pelotón. La raya ámbar de cada medidor marca cómo acabará la semana." : "El jueves por la noche, Sobel revisa los barracones: el Orden vuelve a contar.",
    choices: CHOICES,
    audio,
  });
  week.plan = plan;
  const H = new WeekHUD(ui, week, audio);
  camp.hud = H;
  window.__week = { week, camp, H }; // for test bots (tools/currahee)
  let denied = [];
  try {
    for (const d of days) {
      // Sobel's orders: the first from the day of the promotion, more if the friction keeps growing
      const ten = roster.d.company.sobelTension;
      if (n === 1 && flags.firstLt && d.key === "vie") await dirtyJob(camp, week, d, "inspeccionará las letrinas", "H. M. Sobel, teniente primero, jefe de la compañía.");
      if (n === 2 && d.key === "lun" && ten >= 40) await dirtyJob(camp, week, d, "hará el servicio de oficial de comedor", "H. M. Sobel, jefe de la compañía.");
      if (n === 2 && d.key === "mie" && ten >= 48) await dirtyJob(camp, week, d, "inspeccionará las letrinas", "H. M. Sobel, jefe de la compañía.");
      for (const half of ["am", "pm"]) {
        const s = week.slot(d, half);
        if (!s) continue;
        const act = s.act, A = ACTS[act];
        const away = half === "pm" && week.away[d.key];
        H.day(d.key, `${d.label} · ${half === "am" ? "mañana" : "tarde"}${away ? " · Winters de servicio" : ""}`, A.long || A.label);
        // reveille every morning (the whole call on Monday, its opening on the other days)
        if (half === "am" && act !== "inspeccion") bugle(audio, "diana", { ...xz(...FLAG), short: d.key !== "lun" || camp.speed > 1, level: d.key === "lun" ? 1 : 0.6 });
        if (half === "am" && act === "inspeccion") {
          denied = await inspection(camp, week);
          continue;
        }
        if (act === "pases") {
          await weekend(camp, week, denied);
          continue;
        }
        let stop = () => {};
        const brief = half === "am" && (act === "currahee" || act === "pista");
        if (act === "calWin") stop = await calisthenics(camp, { company: true });
        else if (act === "prueba") await sobelTest(camp);
        else if (brief) await morningAway(camp, act);
        else stop = await afternoon(camp, act, away);
        if (A.line && half === "am" && act !== "prueba") camp.say("", A.line, brief ? 1.8 : 2.4);
        await camp.wait(brief ? 1 : half === "am" ? 2.4 : 3);
        H.update(week.apply(act, half === "pm" ? week.k(d.key) : 1));
        if (n === 1 && act === "calWin" && !flags.firstLt) {
          stop(); // the count stops when the colonel walks up
          await sink(camp);
        }
        if (n === 1 && d.key === "lun" && half === "pm") await pushups(camp);
        if (half === "pm" && week.fight?.[d.key]) {
          camp.say("", "Pelea en el barracón mientras Winters está de servicio. Sobel se entera.", 3);
          roster.tension(4);
          H.update({ sobel: 4 });
        }
        await camp.wait(brief ? 0.6 : half === "am" ? 1.6 : 2.6);
        stop();
      }
      if (n === 2 && d.key === "lun" && flags.late) {
        H.day(d.key, "Lunes · después de la instrucción", "El hoyo");
        await hole(camp, flags.late);
        flags.late = null;
      }
      if (d.night === "marcha") {
        H.day(d.key, `${d.label} · noche`, "Marcha nocturna");
        await nightMarch(camp, week);
      }
      if (d.night === "revista") {
        H.day(d.key, `${d.label} · noche`, "Revista de barracones");
        await barracks(camp, week);
      }
      if (!d.noNight) {
        H.update(week.night());
        music.intensity(0.1 + week.stats().moral * 0.006);
      }
    }
  } finally {
    camp.remove();
    H.remove();
    window.__week = null;
    delete save.frozen;
  }
  flags.order = week.state.order;
  // the week in numbers, and what it means for the next run (same formula as the run itself)
  const end = week.stats();
  const rows = [["Forma", "forma"], ["Fatiga", "cansancio"], ["Moral", "moral"], ["Sobel", "sobel"]]
    .map(([l, k]) => `${l}: ${Math.round(start[k])} → ${Math.round(end[k])}`).join("\n");
  const risk = men.filter((id) => {
    const m = roster.get(id);
    return m && !m.washedOut && runFit(m) < 56;
  }).length;
  const tired = risk >= 6 ? `Llegan reventados: ${risk} hombres flaquearían si ahora tocara correr.` : risk > 0 ? `Cansados pero enteros. ${risk === 1 ? "Un hombre podría" : `${risk} hombres podrían`} flaquear en la próxima carrera.` : "Descansados y en forma: nadie debería flaquear en la próxima carrera.";
  bugle(audio, "retreta", { ...xz(...FLAG), level: 0.5 });
  await ui.card({ kicker: n === 1 ? "Fin de la primera semana" : "Jueves por la noche", title: "El pelotón", text: `${rows}\n\n${tired}`, next: "Seguir" });
  audio.paper();
  return { end };
}
