// Mission scripts for the Día D chapter. Each part is an async script that can resume from a checkpoint.
import { T, clamp, rng } from "../../engine/util.js";
import { W, CAST, GUNS, TRENCH } from "./dday.js";
import { Builder, meshFrom } from "../../engine/geo.js";
import * as P from "../../core/props.js";

const ANG = Math.atan2(-Math.SQRT1_2, -Math.SQRT1_2);
const dirTo = (a, b) => Math.atan2(b[0] - a[0], b[1] - a[1]);

// spawn helper in level coordinates
function spawn(g, o, u, v, extra = {}) {
  const [x, z] = W(u, v);
  return g.add({ ...o, ...extra, x, z, ry: extra.ry ?? ANG });
}
const german = (g, u, v, o = {}) =>
  spawn(g, { side: "de", kit: o.kit || "heer", name: "Alemán", weapon: o.weapon || "k98", hp: 100, grenades: o.grenades ?? 0, seed: Math.floor(u * 100 + v) }, u, v, o);

// ambient night: planes, flak, distant bell, falling chutes
export function nightAmbience(g) {
  const r = rng(3);
  const planes = [];
  let nextPlane = 3, nextFlak = 2, nextBell = 6;
  // formations are seen as their shadows racing over the fields (meshes at altitude would fill an ortho camera)
  const pB = new Builder(90);
  P.c47(pB, {});
  const pg = pB.build();
  const pos = pg.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, 0);
  const geo = pg;
  const shadowMat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false });
  const chutes = [];
  const cB = new Builder(91);
  cB.sphere(1.1, 8, 4, 0xc9c2a8, { y: 1.3, sy: 0.55 });
  cB.box(0.3, 0.7, 0.25, 0x4a4a3a, { y: 0 });
  const cgeo = cB.build();
  g.ambient = (dt) => {
    nextPlane -= dt;
    nextFlak -= dt;
    nextBell -= dt;
    if (nextPlane <= 0) {
      nextPlane = 22 + r() * 16;
      const ang = ANG + Math.PI / 2 + (r() - 0.5) * 0.6;
      const p = g.player || { x: 0, z: 0 };
      for (let i = 0; i < 3; i++) {
        const m = new T.Mesh(geo, shadowMat);
        const off = (i - 1) * 11;
        m.position.set(p.x - Math.sin(ang) * 70 + Math.cos(ang) * off, 0, p.z - Math.cos(ang) * 70 - Math.sin(ang) * off - i * 7);
        m.rotation.y = ang;
        m.userData.v = [Math.sin(ang) * 30, Math.cos(ang) * 30];
        m.renderOrder = 3;
        g.scene.add(m);
        planes.push(m);
      }
      g.audio.plane(9, 0.4);
      // a stick of chutes far to the side
      for (let i = 0; i < 6; i++) {
        const m = new T.Mesh(cgeo, g.scene.userData.chMat || (g.scene.userData.chMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));
        const [x, z] = W(30 + r() * 60, -40 - r() * 15);
        m.position.set(x, 12 + i * 2, z);
        m.userData.vy = -2.2;
        g.scene.add(m);
        chutes.push(m);
      }
    }
    for (let i = planes.length - 1; i >= 0; i--) {
      const m = planes[i];
      m.position.x += m.userData.v[0] * dt;
      m.position.z += m.userData.v[1] * dt;
      m.position.y = g.world.height(m.position.x, m.position.z) + 0.25;
      if (Math.abs(m.position.x) > 160 || Math.abs(m.position.z) > 160) {
        g.scene.remove(m);
        planes.splice(i, 1);
      }
    }
    for (let i = chutes.length - 1; i >= 0; i--) {
      const m = chutes[i];
      m.position.y += m.userData.vy * dt;
      m.rotation.z = Math.sin(g.t + i) * 0.1;
      if (m.position.y < g.world.height(m.position.x, m.position.z)) {
        g.scene.remove(m);
        chutes.splice(i, 1);
      }
    }
    if (nextFlak <= 0) {
      nextFlak = 2.5 + r() * 5;
      const [x, z] = r() < 0.5 ? W(20 + r() * 70, -45) : W(10 + r() * 80, 45);
      g.fx.flak(x, z, 5 + Math.floor(r() * 5));
      g.audio.distantFlak();
    }
    if (nextBell <= 0) {
      nextBell = 4.2;
      g.audio.bell(g.lvl.church[0], g.lvl.church[1]);
    }
    if (g.lvl.church) g.fx.fires.length || g.fx.addFire(g.lvl.church[0], g.world.height(...g.lvl.church) + 12, g.lvl.church[1], 2.2);
    g.lvl.fire && (g.lvl.fire.intensity = 50 + Math.sin(g.t * 9) * 8 + Math.sin(g.t * 23) * 5);
  };
}

// ================================================================================================
export async function nightScript(g, from = "n0") {
  const ui = g.ui;
  g.night = true;
  nightAmbience(g);
  const wreck = W(35, 18);
  g.fx.addFire(wreck[0], g.world.height(...wreck) + 0.8, wreck[1], 1.2);
  g.lights.push({ x: wreck[0], z: wreck[1], r: 9 });
  const wl = new T.PointLight(0xff8a40, 14, 16, 1.6);
  wl.position.set(wreck[0], g.world.height(...wreck) + 2, wreck[1]);
  g.scene.add(wl);
  g.flickers = [wl];
  for (const f of g.lvl.extraFires || []) {
    const [x, z] = W(f.u, f.v);
    const y = g.world.height(x, z) + f.y;
    g.fx.addFire(x, y, z, f.s);
    if (f.light) {
      const l = new T.PointLight(0xff8a3d, 16, 14, 1.4);
      l.position.set(x, y + 1.5, z);
      g.scene.add(l);
      g.flickers.push(l);
      g.lights.push({ x, z, r: f.light });
    }
  }

  const order = ["n0", "n1", "n2", "n3"];
  const at = (k) => order.indexOf(from) <= order.indexOf(k);
  const start = { n0: [4.5, -2.5], n1: [21, -11.5], n2: [47.5, 6.4], n3: [66, -19] }[from];
  const win = spawn(g, { ...CAST.winters, weapon: "knife", grenades: from === "n0" ? 0 : 1, bandages: 1, hp: 100 }, ...start);
  win.protect = 0;
  g.setPlayer(win);
  g.cam.x = win.x;
  g.cam.z = win.z;

  // Germans of the night ------------------------------------------------------------------------
  const mgNest = [german(g, 25, 21.5, { weapon: "mg42" }), german(g, 25.5, 19)];
  for (const s of mgNest) {
    s.ai = { mode: "guard", noAlert: true, static: true, baseRy: dirTo(W(25, 21), W(10, 21)), sweep: 0.6 };
    s.ry = s.ai.baseRy;
    s.hidden = false;
  }
  const p1 = [german(g, 30, -18), german(g, 31.5, -17)];
  p1[0].ai = { mode: "patrol", path: [W(30, -18), W(40, -8, ), W(38, 4).concat(2.5), W(28, -6), W(26, -18).concat(3)].map((p) => p) };
  p1[1].ai = { mode: "patrol", path: [W(31.5, -17), W(41.5, -7), W(39.5, 5).concat(2.5), W(29.5, -5), W(27.5, -17).concat(3)] };
  const smoker = german(g, 72.5, -2.2, { weapon: "k98" });
  smoker.ai = { mode: "guard", smoke: true, baseRy: dirTo(W(72.5, -2), W(60, -2)), sweep: 1.4 };
  smoker.ry = smoker.ai.baseRy;
  const p2 = german(g, 58, -8);
  p2.ai = { mode: "patrol", path: [W(58, -10).concat(2), W(60, 20).concat(3)], speedK: 0.38 };
  const post = [german(g, 88, -13, { weapon: "mg42" }), german(g, 89.5, -11)];
  post[0].ai = { mode: "guard", baseRy: dirTo(W(88, -13), W(96, -13)), sweep: 1.2 };
  post[1].ai = { mode: "guard", smoke: true, baseRy: dirTo(W(89.5, -11), W(78, -4)), sweep: 2.2 };
  post.forEach((s) => (s.ry = s.ai.baseRy));
  const p3 = german(g, 84, 16);
  p3.ai = { mode: "patrol", path: [W(84, 18).concat(2.5), W(82, -2).concat(2), W(78, 10)], speedK: 0.36 };

  // Lipton, hiding in the sunken lane ------------------------------------------------------------
  const lip = spawn(g, { ...CAST.lipton, weapon: "knife", crouch: true }, 66.5, -21.3, { ry: ANG + Math.PI * 0.8 });
  lip.hidden = true;
  lip.protect = 1;
  let lipFound = !at("n2") || from === "n3";
  if (from === "n3") {
    lip.x = win.x - 1.5;
    lip.z = win.z + 1;
    lip.hidden = false;
    lip.ai = { mode: "follow", slot: 1, fire: false };
  }

  // trauma and alert reactions -----------------------------------------------------------------
  let firstKill = true;
  g.onStab = async (e) => {
    g.flags.kills = (g.flags.kills || 0) + 1;
    if (firstKill) {
      firstKill = false;
      g.slow = 0.35;
      g.audio.heartbeat(1);
      setTimeout(() => g.audio.heartbeat(0.8), 900);
      ui.sayNow("", "No llegó a verle la cara. Sí le oyó respirar.", 3.4);
      g.renderer.post.desat.value = 0.6;
      await g.wait(1.2);
      g.slow = 1;
      g.renderer.post.desat.value = 0;
    }
  };
  g.onAlert = (s) => {
    if (g.flags.toldAlert) return;
    g.flags.toldAlert = true;
    ui.toast("Te han visto. Corta la línea de visión tras un seto y agáchate.", 3600);
  };
  g.onPlayerDeath = () => g.deathCard({ guaranteed: true });

  // ---------------------------------------------------------------------------------------------
  if (at("n0")) {
    g.checkpoint("night", "n0");
    // the landing
    g.lockMove = true;
    win.proneLock = true;
    g.cam.span = 26;
    g.ambientFlakNow && g.ambientFlakNow();
    await g.wait(0.6);
    g.audio.plane(8, 0.55);
    await g.lines([
      ["Winters", "Volamos demasiado rápido. Demasiado bajo.", 2.6],
      ["Winters", "Ahí va mi bolsa de pierna. Y todo mi equipo con ella.", 3.2],
    ]);
    win.proneLock = false;
    g.actions = [{ x: win.x, z: win.z, r: 3, label: "Soltar el arnés", enabled: () => !g.flags.free, run: () => (g.flags.free = true) }];
    g.setObjective("Suéltate del arnés", win.x, win.z);
    await g.until(() => g.flags.free);
    g.audio.reload();
    g.lockMove = false;
    g.actions = [];
    ui.toast("Arrastra a la izquierda para moverte. Solo tienes la bayoneta.", 3800);
    await g.wait(1.2);
    // a paratrooper of the 82nd lands close by
    const para = spawn(g, { name: "Paracaidista de la 82.ª", short: "82.ª", portrait: {}, weapon: "m1", seed: 82 }, 9.5, 5, { ry: ANG + 2 });
    para.protect = 2;
    para.ai = { mode: "hold", fire: false };
    para.proneLock = true;
    const chB = new Builder(5);
    P.canopy(chB, para.x + 1.2, g.world.height(para.x, para.z), para.z + 0.5, { ang: 0.4 });
    const chM = meshFrom(chB, "world");
    g.scene.add(chM);
    g.fx.dirt(para.x, para.z, 1.5);
    g.audio.footstep(1.5);
    g.setObjective("Ayuda al paracaidista que acaba de caer", para.x, para.z);
    g.actions = [{ x: para.x, z: para.z, r: 2.2, label: "Cortar sus correas", enabled: () => !g.flags.helped, run: () => (g.flags.helped = true) }];
    await g.until(() => g.flags.helped);
    g.actions = [];
    para.proneLock = false;
    win.st.stab = 1;
    await g.lines([
      ["Winters", "¿Tienes una granada?", 2],
      ["82.ª", "Tome, mi teniente.", 1.8],
    ]);
    win.grenades = 1;
    ui.toast("+1 granada", 1600);
    await g.lines([["Winters", "Volvamos. Tengo que encontrar mi equipo.", 2.6]]);
    para.ai = { mode: "follow", slot: 1, fire: false };
    const bag = g.lvl.bag;
    g.setObjective("Recupera tu bolsa de pierna, junto al seto", bag[0], bag[1]);
    await g.until(() => Math.hypot(win.x - bag[0], win.z - bag[1]) < 10);
    // the MG nest behind the hedge opens up: suppressive bursts around the bag
    const mg = mgNest[0];
    mg.ai.mode = "scripted";
    for (let k = 0; k < 4; k++) {
      for (let i = 0; i < 7; i++) {
        const tx = bag[0] + (Math.random() - 0.5) * 6, tz = bag[1] + (Math.random() - 0.5) * 6;
        g.fx.tracers.shoot(mg.x, mg.y + 0.9, mg.z, tx, g.world.height(tx, tz) + Math.random() * 1.5, tz, [3.6, 1.4, 0.45], 75, 2.4, null);
        setTimeout(() => g.fx.dirt(tx, tz, 0.5), 200 + i * 40);
      }
      g.audio.mg(mg.x, mg.z);
      if (k === 0) setTimeout(() => g.audio.whizz(0.9), 300);
      g.fx.shake = Math.min(1, g.fx.shake + 0.25);
      await g.wait(0.45);
    }
    mg.ai.mode = "guard";
    ui.sayNow("Winters", "¡A la mierda el equipo!", 2.2);
    await g.wait(1.4);
    await g.lines([["82.ª", "Me voy a buscar a la 82.ª. Suerte, mi teniente.", 2.6]]);
    para.ai = { mode: "move", path: [W(-2, 20), W(-5, 24)], speedK: 1.1, fire: false, onArrive: (s) => s.remove() };
    g.setObjective("Aléjate de las ametralladoras: cruza la cancela", ...W(20, -11.8));
    await g.until(() => Math.hypot(win.x - W(21, -11.8)[0], win.z - W(21, -11.8)[1]) < 3.2);
    g.scene.remove(chM);
  }
  if (at("n1")) {
    g.checkpoint("night", "n1");
    ui.toast("Agáchate para moverte en silencio. De noche solo te ven de cerca.", 4200);
    g.setObjective("Cruza el huerto sin que te vean", ...W(46, 6.2));
    g.trigger(...W(27, -12), 6, () => ui.say("", "Una patrulla. Dos hombres. Hablan bajo, en alemán.", 3));
    g.trigger(...W(33, 12), 6, () => ui.say("Winters", "El avión arde. Si me acerco a la luz, me verán.", 3));
    g.trigger(...W(25, -18), 5, () => ui.say("", "Un paracaidista cuelga de las ramas. No se mueve.", 3.2));
    await g.until(() => Math.hypot(win.x - W(47, 6.2)[0], win.z - W(47, 6.2)[1]) < 3);
  }
  if (at("n2")) {
    g.checkpoint("night", "n2");
    g.setObjective("Busca a tus hombres: usa la chicharra");
    ui.say("Winters", "Clic-clac. Si alguien de los nuestros está cerca, contestará.", 3.2);
    g.onCall = () => {
      g.audio.cricket(win.x, win.z, false);
      g.noise(win.x, win.z, 3, win);
      if (lipFound) return;
      const d = g.dist(win, lip);
      if (d < 40) {
        setTimeout(() => {
          g.audio.cricket(lip.x, lip.z, true);
          g.pingT = 3.2;
          g.ping = { x: lip.x + (Math.random() - 0.5) * 4, z: lip.z + (Math.random() - 0.5) * 4 };
          g.setObjective("Alguien ha contestado. Ve hacia el sonido", g.ping.x, g.ping.z);
        }, 700);
      } else setTimeout(() => ui.toast("Nadie contesta. Avanza y vuelve a probar."), 900);
    };
    g.trigger(...W(56, -16), 5, () => ui.say("", "El camino hundido entre los setos. Aquí abajo nadie te ve.", 3.2));
    await g.until(() => g.dist(win, lip) < 3.2);
    lipFound = true;
    lip.hidden = false;
    lip.face(win.x, win.z, 1, 1);
    await g.lines([
      ["Lipton", "Clic-clac, clic-clac. ¿Mi teniente?", 2.4],
      ["Lipton", "Perdí el fusil con la bolsa. Tengo dos granadas y un juego de demolición.", 3.6],
    ]);
    lip.ai = { mode: "follow", slot: 1, fire: false };
    g.onCall = null;
  }
  if (at("n3")) {
    g.checkpoint("night", "n3");
    g.setObjective("Llega a la carretera de Sainte-Marie-du-Mont", ...W(94, 13));
    g.trigger(...W(80, -6), 7, () => ui.say("Lipton", "Una ametralladora en el cruce. Por la derecha, pegados al seto.", 3.2));
    await g.until(() => Math.hypot(win.x - W(94, 13)[0], win.z - W(94, 13)[1]) < 4.5);
    // the others are already waiting in the ditch
    const grp = [
      spawn(g, { ...CAST.guarnere, weapon: "m1", crouch: true }, 95.5, 15.5),
      spawn(g, { ...CAST.malarkey, weapon: "m1", crouch: true }, 96.5, 13.5),
      spawn(g, { ...CAST.toye, weapon: "m1", crouch: true }, 95.8, 17.2),
      spawn(g, { ...CAST.wynn, weapon: "m1", crouch: true }, 97, 16.2),
    ];
    grp.forEach((s) => {
      s.ai = { mode: "hold", fire: false };
      s.protect = 1;
      s.face(win.x, win.z, 1, 1);
    });
    g.lockMove = true;
    await g.lines([
      ["Guarnere", "Mi teniente. Malarkey, Toye y Popeye. Nadie más.", 2.8],
      ["Lipton", "He visto un cartel en la carretera, aquí al lado: Sainte-Mère-Église.", 3.4],
      ["Winters", "Bien. Sé dónde está ese pueblo. Podemos seguir desde aquí.", 3.2],
      ["Guarnere", "Que vengan los alemanes. Tengo una cuenta pendiente con ellos.", 3],
    ]);
    g.lockMove = false;
    return "brecourt";
  }
  return "brecourt";
}

// ================================================================================================
export async function brecourtScript(g, from = "b0") {
  const ui = g.ui;
  g.night = false;
  const order = ["b0", "b1", "b2", "b3", "b4"];
  const at = (k) => order.indexOf(from) <= order.indexOf(k);
  // the battery firing on Utah beach, and dawn mist drifting over the fields
  g.gunsFiring = [true, true, true, true];
  let nextGun = 2, nextMist = 0;
  g.ambient = (dt) => {
    nextGun -= dt;
    nextMist -= dt;
    if (nextGun <= 0) {
      nextGun = 4 + Math.random() * 5;
      const live = g.gunsFiring.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
      if (live.length) {
        const i = live[Math.floor(Math.random() * live.length)];
        const [gx, gz] = g.lvl.gunPos[i];
        const a = ANG + 0.35;
        const mx = gx + Math.sin(a) * 3.3, mz = gz + Math.cos(a) * 3.3, my = g.world.height(gx, gz) + 1.7;
        g.fx.glow.emit({ x: mx, y: my, z: mz, life: 0.14, s0: 4.5, s1: 2, c0: [3, 1.5, 0.45, 1], c1: [1, 0.3, 0.05, 0] });
        for (let k = 0; k < 14; k++)
          g.fx.smoke.emit({ x: mx, y: my, z: mz, vx: Math.sin(a) * (4 + Math.random() * 6) + (Math.random() - 0.5) * 2, vy: 0.6 + Math.random(), vz: Math.cos(a) * (4 + Math.random() * 6) + (Math.random() - 0.5) * 2, life: 3 + Math.random() * 2, s0: 1.2, s1: 4.5, c0: [0.62, 0.6, 0.56, 0.6], c1: [0.7, 0.7, 0.7, 0], drag: 1.2, fadeIn: 0.05 });
        g.fx.lights.flash(mx, my + 1, mz, 30, 0.2, 22, 0xffb070);
        g.audio.boom(gx, gz, 1.3);
        const p = g.player;
        if (p) g.fx.shake = Math.min(1, g.fx.shake + 0.4 * Math.max(0.15, 1 - Math.hypot(p.x - gx, p.z - gz) / 50));
      }
    }
    if (nextMist <= 0 && g.player) {
      nextMist = 0.35;
      const p = g.player;
      const x = p.x + (Math.random() - 0.5) * 40, z = p.z + (Math.random() - 0.5) * 40;
      g.fx.smoke.emit({ x, y: g.world.height(x, z) + 0.6, z, vx: 0.35, vy: 0.02, vz: -0.15, life: 14, s0: 7, s1: 11, c0: [0.86, 0.88, 0.88, 0], c1: [0.86, 0.88, 0.9, 0], fadeIn: 0 , mist: 1 });
    }
  };
  const lead = g.save.lead || "winters";
  const leadCast = lead === "winters" ? CAST.winters : CAST.lipton;
  const st = { b0: [4, -21], b1: [50, -21.2], b2: [59, -10.5], b3: [72, 14.5], b4: [70, 12] }[from];
  const win = spawn(g, { ...leadCast, weapon: "m1", clip: 8, reserve: from === "b0" ? 32 : 24, grenades: 3, bandages: 2 }, ...st);
  g.setPlayer(win);
  g.cam.x = win.x;
  g.cam.z = win.z;
  g.leader = win;

  // the company ---------------------------------------------------------------------------------
  const mk = (c, u, v, o = {}) => {
    const s = spawn(g, { ...c, weapon: o.weapon || "m1", crouch: true }, u, v);
    s.protect = o.protect ?? 1;
    s.ai = { mode: "hold", engage: true, crouch: true, look: W(u + 10, v + 4) };
    s.onDown = () => ui.say(s.short, "¡Me han dado! ¡Estoy bien, seguid!", 2.2);
    return s;
  };
  const off = (k) => (k ? 0 : 0);
  const team = {};
  if (lead !== "lipton") team.lipton = mk(CAST.lipton, st[0] - 2, st[1] + 0.8);
  team.compton = mk(CAST.compton, st[0] - 3, st[1] - 0.8, { weapon: "thompson" });
  team.guarnere = mk(CAST.guarnere, st[0] - 4.2, st[1] + 0.6);
  team.malarkey = mk(CAST.malarkey, st[0] - 5.5, st[1] - 0.6);
  team.toye = mk(CAST.toye, st[0] - 6.8, st[1] + 0.5);
  team.wynn = mk(CAST.wynn, st[0] - 8, st[1] - 0.5);
  const mgA = mk(CAST.plesha, st[0] - 9.5, st[1], { weapon: "mg42" });
  const mgB = mk(CAST.liebgott, st[0] - 11, st[1] + 0.3, { weapon: "thompson" });
  void off;
  // keep everyone near the leader until the plan is in motion
  const followAll = () => Object.values(team).concat([mgA, mgB]).forEach((s, i) => s.alive && (s.ai = { mode: "follow", slot: 1 + i, engage: true }));

  // the battery's defenders (Fallschirmjäger of von der Heydte's regiment)
  const de = [];
  const fj = (u, v, o = {}) => {
    const s = german(g, u, v, { kit: "fj", weapon: o.weapon || "k98", grenades: o.grenades ?? 1 });
    s.ai = { mode: "guard", static: true, react: 0.4, crouchFight: true, baseRy: dirTo(W(u, v), W(u - 20, v - 6)), sweep: 1.4 };
    s.crouch = true;
    s.ry = s.ai.baseRy;
    s.gun = o.gun;
    de.push(s);
    return s;
  };
  const alive = (s) => s && s.alive && !s.surrendered;
  if (at("b2")) {
    fj(55.5, -13, { weapon: "mg42", gun: 0, grenades: 0 });
    fj(58, -11, { gun: 0 });
    fj(61, -7.5, { gun: 0, grenades: 2 });
    fj(57.5, -3, { gun: 0 });
  }
  if (at("b3")) {
    fj(64, -1.5, { gun: 1, weapon: "mp40" });
    fj(67.5, 5, { gun: 1 });
    fj(70.5, -1, { gun: 1 });
    fj(70, 9.5, { gun: 2, weapon: "mg42", grenades: 0 });
    fj(73.5, 16.5, { gun: 2 });
    fj(76.5, 12.5, { gun: 2 });
  }
  const g4 = [fj(80, 28, { gun: 3 }), fj(83, 32, { gun: 3 }), fj(77, 23, { gun: 3, weapon: "mp40" })];
  // the manor MG that hammers the field during the withdrawal
  const manorMG = fj(87, 8, { weapon: "mg42" });
  manorMG.ai.react = 1;
  manorMG.protect = 2;

  const gunClear = (i) => {
    const c = de.filter((s) => s.gun === i && alive(s)).length === 0;
    if (c) g.gunsFiring[i] = false;
    return c;
  };
  const near = (p, r) => Math.hypot(win.x - W(...p)[0], win.z - W(...p)[1]) < r;

  g.onPlayerDeath = (s) => g.deathCard({ guaranteed: !g.flags.permadeath, who: s });
  g.onEnemyKilled = () => {
    g.flags.kills = (g.flags.kills || 0) + 1;
  };
  let toyeDone = false;
  g.onEnemyGrenade = (gr) => {
    // first German grenade into the trench while Toye is close: the "Joe, cuidado" moment
    const toye = team.toye;
    if (toyeDone || !toye || !toye.alive || g.dist(toye, win) > 9) return;
    toyeDone = true;
    gr.x = toye.x + 0.4;
    gr.z = toye.z + 0.3;
    gr.vx = gr.vz = 0;
    gr.vy = 2;
    gr.y = toye.y + 2;
    gr.fuse = 2.4;
    g.qte("¡JOE, CUIDADO!", 1.7, toye, "¡JOE!").then((ok) => {
      if (ok) {
        toye.blastProof = true;
        toye.st.prone = 1;
        toye.proneLock = true;
        ui.sayNow(leadCast.short, "¡Joe, cuidado!", 1.4);
        setTimeout(() => {
          toye.blastProof = false;
          toye.proneLock = false;
          ui.say("Toye", "Me ha destrozado la culata del fusil. Ni un rasguño.", 2.8);
          g.flags.toyeSaved = true;
        }, 2600);
      } else {
        setTimeout(() => ui.say("Toye", "Estoy bien… estoy bien. Seguid.", 2.4), 2800);
      }
    });
  };

  // --------------------------------------------------------------------------------------------
  if (at("b0")) {
    g.checkpoint("brecourt", "b0");
    followAll();
    g.setObjective("Avanza por el camino hundido hacia la batería", ...W(33, -21.2));
    ui.say(leadCast.short, "Dejad el equipo. Solo armas, munición y granadas.", 2.8);
    ui.say(leadCast.short, "Agachados. El seto nos tapa hasta el final.", 2.6);
    await g.until(() => near([33, -21.2], 3.5));
    // set the base of fire in the slits of the hedge
    g.lockMove = true;
    await g.lines([[leadCast.short, "Plesha, Liebgott: ametralladoras en los huecos del seto. Fuego a mi señal.", 3.6]]);
    g.lockMove = false;
    mgA.ai = { mode: "move", path: [W(36.7, -20), W(36.7, -18.3)], speedK: 1, crouch: true, engage: true, onArrive: (s) => (s.ai = { mode: "hold", engage: true, crouch: true, look: W(56, -10) }) };
    mgB.ai = { mode: "move", path: [W(42.8, -20), W(42.8, -18.3)], speedK: 1, crouch: true, engage: true, onArrive: (s) => (s.ai = { mode: "hold", engage: true, crouch: true, look: W(58, -6) }) };
    if (team.lipton) team.lipton.ai = { mode: "move", path: [W(44.5, -19.5), W(46, -12), W(47, 2)], speedK: 1.2, onArrive: (s) => { s.ai = { mode: "hold", engage: true, crouch: false, look: W(60, -6) }; ui.say("Lipton", "Desde el árbol los veo a todos en la trinchera.", 2.6); } };
    g.setObjective("Llega a la posición de asalto", ...W(50, -21.2));
    await g.until(() => near([50, -21.2], 3));
  }
  if (at("b1")) {
    g.checkpoint("brecourt", "b1");
    followAll();
    for (const s of [mgA, mgB]) s.ai = { mode: "hold", engage: true, crouch: true, look: W(58, -8) };
    if (from === "b1") {
      mgA.x = W(36.7, -18.3)[0]; mgA.z = W(36.7, -18.3)[1];
      mgB.x = W(42.8, -18.3)[0]; mgB.z = W(42.8, -18.3)[1];
    }
    g.lockMove = true;
    await g.lines([[leadCast.short, "¡Fuego de cobertura! ¡Ahora!", 1.6]]);
    g.lockMove = false;
    de.forEach((s) => (s.aware = 1));
    // Compton, Guarnere and Malarkey go first, Compton's grenade straight as a baseball throw
    const c = team.compton;
    c.ai = { mode: "move", path: [W(53, -17.5)], speedK: 1.3, crouch: false, engage: true };
    team.guarnere.ai = { mode: "move", path: [W(52.5, -19.5)], speedK: 1.25, engage: true };
    team.malarkey.ai = { mode: "move", path: [W(51.8, -20.5)], speedK: 1.25, engage: true };
    g.setObjective("Asalta el primer cañón", ...W(GUNS[0][0], GUNS[0][1]));
    const tC = g.t + 7;
    await g.until(() => g.dist(c, { x: W(53, -17.5)[0], z: W(53, -17.5)[1] }) < 1.5 || near([55, -15], 3) || g.t > tC);
    ui.say("Compton", "¡Granada!", 1.2);
    c.grenades = 1;
    g.throwGrenade(c, { x: W(56.5, -12.5)[0], z: W(56.5, -12.5)[1] }, 1.6);
    await g.wait(0.6);
    // Wynn is hit in the backside and keeps apologising
    const wynn = team.wynn;
    if (wynn.alive) {
      wynn.down = true;
      wynn.st.prone = 1;
      setTimeout(() => ui.say("Wynn", "Lo siento, mi teniente. La he cagado.", 2.6), 1200);
    }
    team.toye.ai = { mode: "follow", slot: 1, engage: true };
    team.guarnere.ai = { mode: "follow", slot: 2, engage: true };
    for (const s of de) if (s.gun === 0) s.grenades = Math.max(s.grenades, 1);
    await g.until(() => gunClear(0) && near(GUNS[0], 7));
    g.lockMove = true;
    await g.lines([
      [leadCast.short, "¡El primer cañón es nuestro! Tres hombres aquí. Los demás, conmigo.", 3],
    ]);
    g.lockMove = false;
  }
  if (at("b2")) {
    g.checkpoint("brecourt", "b2");
    if (!g.flags.permadeath) {
      g.flags.permadeath = true;
      await ui.card({
        kicker: "Brécourt Manor · 08:45",
        title: "Desde aquí, quien cae no vuelve",
        text: "La compañía ya ha tenido su bautismo de fuego. A partir de este momento, si el hombre que llevas muere, no habrá vuelta atrás: la historia seguirá con otro.",
        next: "Entendido",
      });
    }
    // Malarkey and the black holster
    const mal = team.malarkey;
    if (mal && mal.alive) {
      await g.wait(2);
      const v = await ui.card({
        kicker: "La funda negra",
        title: "Malarkey ve una Luger",
        text: "Bajo el fuego que barre el borde de la trinchera, Malarkey ve a un alemán muerto a diez metros, en campo abierto, con una funda de cuero negro al cinto. Ya está apoyando el pie para saltar.",
        choices: [
          { label: "Dejarle ir", sub: "Quizá lo tomen por un médico.", value: "go" },
          { label: "«¡Idiota, vuelve aquí!»", sub: "Nadie sale por un trofeo.", value: "stop" },
        ],
      });
      if (v === "go") {
        const [x, z] = W(56, -4);
        mal.ai = { mode: "move", path: [[x, z], W(59.5, -10.5)], speedK: 1.4, fire: false, onArrive: (s) => (s.ai = { mode: "follow", slot: 3, engage: true }) };
        setTimeout(() => {
          ui.say("Malarkey", "Era el estuche de una mira de cañón… ¡maldita sea!", 2.6);
          for (let i = 0; i < 8; i++) setTimeout(() => g.fx.dirt(mal.x + (Math.random() - 0.5) * 3, mal.z + (Math.random() - 0.5) * 3, 0.6), i * 120);
        }, 3200);
        g.flags.luger = true;
      } else {
        ui.say("Malarkey", "Vale, vale… Pero era una Luger.", 2.2);
        mal.ai = { mode: "follow", slot: 3, engage: true };
      }
    }
    g.setObjective("Avanza por la trinchera: segundo cañón", ...W(GUNS[1][0], GUNS[1][1]));
    await g.until(() => gunClear(1) && near(GUNS[1], 8));
    // six men come down the connecting trench with their hands up
    const pr = [];
    for (let i = 0; i < 4; i++) {
      const s = german(g, 69 + i * 0.8, -1.5 - i * 0.6, { kit: "fj" });
      s.surrendered = true;
      s.ai = { mode: "scripted" };
      s.st.aim = 0;
      pr.push(s);
    }
    ui.say("Alemán", "Nicht schießen! ¡No matar! ¡No matar!", 2.4);
    await g.wait(1.2);
    pr.forEach((s, i) => {
      s.ai = { mode: "scripted" };
      s.walkOff = W(40 - i, -21);
    });
    g.surrenderWalk = pr;
    ui.say(leadCast.short, "Atrás, a retaguardia. Que nadie dispare.", 2.4);
    // Hall from Able company joins
    const hall = spawn(g, { ...CAST.hall, weapon: "m1" }, 56, -14);
    hall.protect = 0;
    hall.ai = { mode: "move", path: [W(60, -9), W(65.5, 1.5)], speedK: 1.3, engage: true, onArrive: (s) => (s.ai = { mode: "hold", engage: true, crouch: true, look: W(70, 10) }) };
    await g.wait(2.5);
    await g.lines([["Hall", "Soldado Hall, Compañía A. Me he perdido de los míos. ¿Puedo ir con ustedes?", 3.2], [leadCast.short, "Bienvenido. Tercer cañón.", 1.8]]);
    // Hall charges ahead and is killed by the MG at gun three
    g.setObjective("Toma el tercer cañón", ...W(GUNS[2][0], GUNS[2][1]));
    hall.protect = 0;
    hall.ai = { mode: "move", path: [W(66, 0.5), W(69.6, 3.2), W(70, 8.5)], speedK: 1.5, crouch: false, fire: false };
    const mg3 = de.find((s) => s.gun === 2 && s.wkind === "mg42");
    const tHall = g.t + 9;
    await g.until(() => !hall.alive || g.dist(hall, { x: W(70, 8.5)[0], z: W(70, 8.5)[1] }) < 1.8 || g.t > tHall);
    if (hall.alive) {
      if (mg3 && mg3.alive) {
        mg3.face(hall.x, hall.z, 1, 1);
        for (let i = 0; i < 6; i++) setTimeout(() => mg3.alive && g.fire(mg3, hall), i * 60);
      }
      setTimeout(() => g.kill(hall, mg3), 380);
    }
    await g.wait(0.8);
    g.slow = 0.4;
    g.audio.sting("grief");
    ui.sayNow("", "John D. Hall, Compañía A. Llevaba diez minutos con ellos.", 3.6);
    await g.wait(1.6);
    g.slow = 1;
    g.flags.hallDead = true;
    await g.until(() => gunClear(2) && near(GUNS[2], 8));
    g.lockMove = true;
    await g.lines([[leadCast.short, "Tres cañones. Once hombres. Estamos demasiado dispersos.", 3]]);
    g.lockMove = false;
  }
  if (at("b3")) {
    g.checkpoint("brecourt", "b3");
    // Hester brings TNT; Speirs' men take the fourth gun on their own
    const hes = spawn(g, { name: "Cap. Clarence Hester", short: "Hester", weapon: "m1" }, 60, -10);
    hes.protect = 2;
    hes.ai = { mode: "move", path: [W(63.5, -2.5), W(65.5, 8.5)], speedK: 1.2, fire: false, onArrive: (s) => (s.ai = { mode: "hold", fire: false, crouch: true }) };
    await g.until(() => g.dist(hes, win) < 4 || g.t > 0 && hes.ai.mode === "hold");
    await g.lines([["Hester", "Tres cartuchos de TNT. Uno por cañón, con una granada alemana dentro.", 3.2]]);
    g.tnt = 3;
    const planted = [false, false, false];
    const gp = g.lvl.gunPos;
    g.actions = [0, 1, 2].map((i) => ({
      x: gp[i][0], z: gp[i][1], r: 2.8, label: "Colocar TNT",
      enabled: () => !planted[i],
      run: async () => {
        planted[i] = true;
        g.lockMove = true;
        win.st.heal = 1;
        g.audio.reload();
        await g.wait(1.4);
        g.lockMove = false;
        ui.toast("¡Mecha encendida! Aléjate.", 1800);
        await g.wait(5);
        g.explode(gp[i][0], gp[i][1], 1.3, win, false);
        g.wreckGun(i);
      },
    }));
    g.setObjective("Inutiliza los cañones con TNT (3)");
    const sp = [];
    for (let i = 0; i < 4; i++) {
      const s = spawn(g, { name: i ? "Compañía D" : "Tte. Ronald Speirs", short: i ? "D" : "Speirs", weapon: i ? "m1" : "thompson" }, 70 + i, 6 + i);
      s.protect = 2;
      s.ai = { mode: "move", path: [W(76, 18 + i), W(79 + i * 0.5, 25)], speedK: 1.2, engage: true };
      sp.push(s);
    }
    ui.say("Speirs", `El cuarto es nuestro, ${leadCast.short}. Usted ocúpese de esos.`, 2.8);
    await g.until(() => planted.every(Boolean) && g.flags.wrecked >= 3);
    g4.forEach((s) => s.alive && g.kill(s, sp[0]));
    g.explode(...W(GUNS[3][0], GUNS[3][1]), 1.3, sp[0], true);
    g.wreckGun(3);
    g.actions = [];
  }
  if (at("b4")) {
    g.checkpoint("brecourt", "b4");
    // the heavy MGs from the hedges around the manor open up: withdraw, last man out
    manorMG.ai = { mode: "alert", static: true, react: 0.2 };
    manorMG.aware = 1.5;
    manorMG.target = win;
    g.manorFire = true;
    g.setObjective("¡Retirada! Vuelve al camino hundido. Tú, el último", ...W(40, -21.2));
    ui.say(leadCast.short, "¡Ametralladoras primero, luego los fusileros! ¡Atrás!", 2.6);
    const back = Object.values(team).concat([mgA, mgB]).filter((s) => s.alive);
    back.forEach((s, i) => (s.ai = { mode: "move", path: [W(56, -14), W(52, -21), W(38 - i * 1.2, -21.2)], speedK: 1.25, engage: false, fire: false, onArrive: (q) => (q.ai = { mode: "hold", crouch: true, fire: false }) }));
    await g.until(() => near([40, -21.2], 4));
    g.manorFire = false;
    return "end";
  }
  return "end";
}

// =================================================================================================
export const OUTRO = (g) => {
  const lead = g.save.lead === "lipton" ? "Lipton" : "Winters";
  const lines = [
    "A las 11:30, tres horas después de recibir la orden, la Compañía E se retira de Brécourt. Doce hombres, con Speirs y unos pocos de la Compañía D al final, han destruido una batería que batía la calzada y la playa Utah.",
    g.save.lead === "lipton"
      ? "Richard Winters no volvió de aquella trinchera. Lipton sacó a los hombres de allí y nunca habló de cómo. En una caja junto al segundo cañón quedaban los mapas con todas las posiciones alemanas de la península."
      : "En una caja junto al segundo cañón, Winters ha encontrado los mapas con las posiciones alemanas de toda la península. Los tanques podrán salir de la playa.",
    `Nadie se siente un héroe. Están cansados, sucios, con los moratones del salto y la boca seca. Esa noche, ${lead} se arrodilla y da gracias por haber sobrevivido al Día D.`,
  ];
  return lines;
};
