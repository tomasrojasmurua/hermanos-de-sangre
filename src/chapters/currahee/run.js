// Las carreras a Currahee: modo acción. Tú eres Winters dentro de la columna de Sobel.
// Respira al compás de la cadencia, no te quedes atrás de las ambulancias, y vuelve por los que flaquean.
import { T, clamp, damp, rng } from "../../engine/util.js";
import { Route, Column } from "../../core/column.js";
import { cast } from "../../core/roster.js";
import { routeWorld, W, UV, SUMMIT } from "./places.js";
import { esc } from "../../engine/ui.js";

const NAMED = ["lipton", "guarnere", "malarkey", "toye", "muck", "tipper", "christenson", "gordon", "wynn", "martin", "talbert", "nixon"];

const SOBEL_LINES = [
  "¡Los japos os joderán vivos!",
  "¡Adelante, Silver!",
  "¡Más rápido! ¡Esto no es un paseo!",
  "¡El que suba a la ambulancia, se va hoy mismo!",
  "¡Arriba esas rodillas, Compañía E!",
];

function hud(ui, input) {
  let el = document.getElementById("runhud");
  if (el) el.remove();
  el = document.createElement("div");
  el.id = "runhud";
  el.innerHTML = `
    <div class="aliento" aria-label="Aliento"><span class="lbl">Aliento</span><span class="bar"><i></i></span></div>
    <div class="pace" aria-label="Tu lugar en la columna">
      <span class="end amb" title="Ambulancias">✚</span><span class="track"><i class="danger"></i><b class="me"></b></span><span class="end head">Sobel</span>
    </div>
    <button class="breath" data-b="breath" aria-label="Respirar al compás"><span class="ring"></span><span class="core"><b>Respirar</b><small>al compás</small></span></button>`;
  ui.root.querySelector("#hud").appendChild(el);
  const b = el.querySelector(".breath");
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    input.press("breath");
    b.classList.add("down");
  });
  const up = () => {
    input.release("breath");
    b.classList.remove("down");
  };
  b.addEventListener("pointerup", up);
  b.addEventListener("pointercancel", up);
  return {
    el,
    bar: el.querySelector(".aliento i"),
    ali: el.querySelector(".aliento"),
    me: el.querySelector(".pace .me"),
    pace: el.querySelector(".pace"),
    ring: el.querySelector(".breath .ring"),
    btn: b,
    remove: () => el.remove(),
  };
}

// opts: { variant: "first" | "spaghetti", pace, drain, ate }
export async function currahee(ctx, opts) {
  const { G, ui, audio, music, input, roster, shell } = ctx;
  const lvl = G.lvl;
  const r = rng(opts.variant === "first" ? 11 : 23);
  const up = routeWorld();
  const route = new Route(up.concat(up.slice(0, -1).reverse()));
  const summitS = route.len[up.length - 1];
  G.soldiers.slice().forEach((s) => s.remove());
  G.soldiers = [];
  // a failed attempt is undone completely (nobody washed out, nobody tired)
  const before = JSON.stringify(roster.d);
  // ---- the company in PT kit: named men, then the recruits who are still here
  const start = 10;
  const men = [];
  const order = NAMED.concat(roster.activeRecruits().map((x) => x.id));
  order.forEach((id, i) => {
    const c = cast(id) || roster.get(id);
    const rec = roster.get(id);
    const sol = G.add({ id, name: c.name, short: c.short, side: "us", kit: "pt", weapon: "none", skin: c.skin, mustache: c.mustache, seed: 100 + i, speed: 5.2 });
    const fit = (rec?.stats?.fit ?? 60) - (rec?.fatigue ?? 0) * 0.25;
    men.push({ sol, id, named: !!cast(id), fit, immune: id === "nixon" ? false : false });
  });
  const sobelC = cast("sobel");
  const sobel = G.add({ id: "sobel", name: sobelC.name, short: "Sobel", side: "us", kit: "pt", weapon: "none", skin: sobelC.skin, seed: 7, speed: 5.4 });
  const winC = cast("winters");
  const win = G.add({ ...winC, id: "winters", side: "us", kit: "pt", weapon: "none", seed: 1, speed: 4.6 });
  win.portrait = { rank: "lt", skin: "#dba886", helmet: "#3b2a1e" };
  G.setPlayer(win);
  // ambulances
  const ambMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
  const ambs = [0, 1].slice(0, opts.variant === "spaghetti" ? 2 : 1).map(() => {
    const m = new T.Mesh(lvl.ambGeo, ambMat);
    m.castShadow = true;
    G.scene.add(m);
    return m;
  });
  // ---- the column
  const grade = (s, dir) => {
    const a = route.at(s), b = route.at(s + 2 * dir);
    return (G.world.height(b.x, b.z) - G.world.height(a.x, a.z)) / 2;
  };
  const basePace = opts.pace;
  let sickT = {};
  const col = new Column(G, {
    route,
    men,
    player: win,
    leader: sobel,
    start,
    seed: opts.variant === "first" ? 5 : 9,
    drain: opts.drain,
    grade,
    pace: (s) => {
      // Sobel pushes harder on the climb and eases a touch on the summit
      const k = s < 30 ? 0.7 : s > summitS - 8 && s < summitS + 6 ? 0.75 : 1;
      return basePace * k;
    },
    sick: (m) => (opts.variant === "spaghetti" ? (sickT[m.id] > 0 ? 0.016 : 0) * (m.player ? (opts.ate ? 1 : 0.4) : 1) : 0),
    onStraggle: (m) => {
      audio.breath(1, 0);
      if (!flagged.has(m.id)) ui.toast(`${m.sol.short} se está quedando atrás`, 1800);
      flagged.add(m.id);
    },
    onRecover: (m) => {
      audio.say([["a", 0.12, 900], ["o", 0.22, 4200]], { x: win.x, z: win.z, pitch: 140 }); // «¡vamos!»
      ui.say("Winters", r() < 0.5 ? `Vamos, ${m.sol.short}. Conmigo.` : `Un paso más, ${m.sol.short}. Y otro.`, 1.8);
      roster.bond("winters", m.id, 6);
      roster.mood(m.id, 4);
      helped.add(m.id);
    },
    onLost: (m) => {
      if (m.named) {
        // the book decides who stays: a named man is carried by his buddies, never washed out
        const buddy = col.men.find((o) => o !== m && o.named && o.state === "ok");
        m.state = "ok";
        m.stam = 0.4;
        m.lag = 0;
        carried.push([m.id, buddy?.id]);
        ui.say(buddy ? buddy.sol.short : "", buddy ? `Arriba, ${m.sol.short}. Agárrate de mí.` : "", 2);
        roster.mood(m.id, -6);
        if (buddy) roster.bond(m.id, buddy.id, 8);
        return;
      }
      lost.push(m.id);
      roster.washOut(m.id);
      m.sol.st.slump = 1;
      m.sol.st.move = 0;
      audio.engine(m.sol.x, m.sol.z, 2);
      music.sting("wash");
      ui.toast(`${m.sol.short} sube a la ambulancia. Esa misma tarde lo echan.`, 3200);
      setTimeout(() => m.sol.remove(), 900);
    },
  });
  const flagged = new Set(), helped = new Set(), lost = [], carried = [];
  window.__run = { col, win, music, summitS, route }; // for test bots (tools/currahee)
  // place everyone in their slot before the whistle
  for (const m of col.men) {
    const sl = col.slot(m.rank, m.lane);
    m.sol.x = sl.x;
    m.sol.z = sl.z;
    m.sol.ry = Math.atan2(sl.dx, sl.dz);
  }
  const h0 = route.at(start);
  sobel.x = h0.x;
  sobel.z = h0.z;
  const ws = col.slot(1, 1.9);
  win.x = ws.x;
  win.z = ws.z;
  win.ry = Math.atan2(ws.dx, ws.dz);
  G.cam.x = win.x;
  G.cam.z = win.z;
  G.camSpan = 15;
  G.objective = null;
  // ---- HUD
  document.body.dataset.run = "1";
  const H = hud(ui, input);
  ui.setWho(win);
  // ---- go
  G.lockMove = true;
  audio.whistle(sobel.x, sobel.z, true);
  await G.wait(0.6);
  ui.say("Sobel", opts.variant === "first" ? "¡Compañía E! ¡A Currahee, paso ligero!" : "¡Cambio de órdenes! ¡Todos a correr!", 2.2);
  await G.wait(1.4);
  G.lockMove = false;
  music.set("drive", 0.45);
  audio.startBed && audio.setBed(0.6);
  G.setObjective("Corre con la columna hasta la cima", ...lvl.summit);
  if (opts.variant === "first") ui.toast("Arrastra a la izquierda para correr. Toca «Respirar» cuando el anillo se cierre.", 4200);
  let nextLine = 6, phaseUp = true, summitDone = false, behindT = 0, stepT = 0, lastBreathOk = false, tipsShown = 0;
  let failed = false;
  const tick = (dt, rdt) => {
    if (dt <= 0) return;
    col.update(dt, ctx);
    const P = col.p;
    // breathing on the cadence
    const b = music.breath();
    H.ring.style.transform = `scale(${(1.7 - b.phase * 0.7).toFixed(3)})`;
    H.ring.style.opacity = (0.25 + b.phase * 0.75).toFixed(2);
    H.btn.classList.toggle("window", b.err < 0.16);
    if (input.consume("breath") || input.consume("fire")) {
      const ok = col.breathe(b.err < 0.16);
      audio.breath(ok ? 0.35 : 0.9, 0);
      H.btn.classList.remove("ok", "miss");
      void H.btn.offsetWidth;
      H.btn.classList.add(ok ? "ok" : "miss");
      if (ok && !lastBreathOk && opts.variant === "first" && tipsShown === 0) {
        tipsShown = 1;
        ui.toast("Así. Respirar al compás te devuelve el aliento.", 2000);
      }
      lastBreathOk = ok;
    }
    // stamina display
    H.bar.style.transform = `scaleX(${P.stam.toFixed(3)})`;
    H.ali.classList.toggle("low", P.stam < 0.25);
    win.st.slump = damp(win.st.slump || 0, P.stam < 0.2 ? 0.7 : 0, 3, dt);
    // where you are in the column
    const rel = clamp(P.rel ?? 0.5, -0.15, 1.15);
    H.me.style.left = `${(clamp(rel, 0, 1) * 100).toFixed(1)}%`;
    H.pace.classList.toggle("warn", rel < 0.12);
    // footsteps of the column, the player's own breath
    stepT -= dt * (0.6 + win.st.move * 2.2);
    if (stepT <= 0) {
      stepT = 0.33;
      audio.stride(0.8 + win.st.move * 0.4, 0);
      if (r() < 0.6) audio.stride(0.45, (r() - 0.5) * 1.2);
    }
    if (P.stam < 0.35 && r() < dt * (1.6 - P.stam * 2)) audio.breath(1 - P.stam, 0);
    music.intensity(0.45 + (1 - P.stam) * 0.3 + (phaseUp ? 0.1 : 0) + col.flagged().length * 0.05);
    // Sobel shouts
    nextLine -= dt;
    if (nextLine <= 0) {
      nextLine = 9 + r() * 6;
      const line = SOBEL_LINES[Math.floor(r() * SOBEL_LINES.length)];
      ui.say("Sobel", line, 2.2);
      audio.say(line.includes("Silver") ? [["a", 0.1], ["e", 0.12, 1800], ["a", 0.14, 1800], ["e", 0.18, 2400], ["i", 0.16, 4500], ["e", 0.3, 1400]] : [["a", 0.14, 1600], ["o", 0.12, 2400], ["a", 0.26, 1200]], { x: sobel.x, z: sobel.z, pitch: 175, gain: 0.16 });
    }
    // spaghetti: men retching by the road
    if (opts.variant === "spaghetti") {
      for (const m of col.men) {
        sickT[m.id] = Math.max(0, (sickT[m.id] || 0) - dt);
        if (m.state !== "lost" && r() < dt * 0.012 && col.s > 40) {
          sickT[m.id] = 4;
          vomit(G, m.sol);
        }
      }
      sickT.winters = Math.max(0, (sickT.winters || 0) - dt);
      if (opts.ate && r() < dt * 0.008 && col.s > 60) {
        sickT.winters = 3;
        vomit(G, win);
        ui.toast("Los espaguetis vuelven a ver la luz.", 1800);
      }
    }
    // summit
    if (phaseUp && col.s >= summitS) {
      phaseUp = false;
      col.dir = 1; // route already loops back down: keep advancing along it
      summitDone = true;
      music.sting("summit");
      G.camSpan = 22;
      setTimeout(() => (G.camSpan = 15), 3500);
      audio.chant("currahee", 10, sobel.x, sobel.z);
      ui.sayNow("", "La cima. Abajo, el campamento parece de juguete. Ahora, de vuelta.", 3);
      G.setObjective("De vuelta al campamento", ...W(-62, 0));
      if (opts.variant === "first") ui.toast("Bajando cuesta menos aliento. Que nadie quede atrás.", 3000);
    }
    // markers for the men who are fading
    for (const m of col.flagged()) {
      let [sx, sy] = G.project(m.sol.x, m.sol.y + 2.3, m.sol.z);
      const off = sx < 30 || sx > innerWidth - 30 || sy < 70 || sy > innerHeight - 30;
      sx = clamp(sx, 40, innerWidth - 40);
      sy = clamp(sy, 84, innerHeight - 40);
      ui.mark("st" + m.id, sx, sy, `<span>${off ? "◀ " : ""}${esc(m.sol.short)}</span>`, "strag");
    }
    // the action button when a fading man is within reach
    const near = col.flagged().find((m) => Math.hypot(m.sol.x - win.x, m.sol.z - win.z) < 2.6);
    ui.setAct(near ? `Empujar a ${near.sol.short}` : null);
    if (near && input.consume("act")) col.helpNearest(2.6);
    // too far behind: the ambulances are right behind you
    if (rel < 0.02) {
      behindT += dt;
      if (behindT > 0.4 && behindT - dt <= 0.4) ui.toast("¡La ambulancia te alcanza! Corre.", 1600);
      if (behindT > 4.5) failed = true;
    } else behindT = Math.max(0, behindT - dt * 2);
    win.speed *= 1; // set by column
  };
  const unhook = shell.hook(tick);
  // the run ends back at the parade ground
  await G.until(() => failed || col.s >= route.total - 2);
  unhook();
  G.objective = null;
  ui.setAct(null);
  H.remove();
  delete document.body.dataset.run;
  window.__run = null;
  ambs.forEach((m) => G.scene.remove(m));
  if (failed) {
    Object.assign(roster.d, JSON.parse(before));
    G.lockMove = true;
    music.intensity(0.15);
    await ui.card({ kicker: "Currahee", title: "Winters no sube a la ambulancia", text: "Winters no puede quedarse atrás: sus hombres lo miran. Respira al compás, corre pegado a la columna y vuelve a intentarlo.", next: "Otra vez" });
    G.lockMove = false;
    return { retry: true };
  }
  // stop and stand to attention
  G.lockMove = true;
  audio.whistle(sobel.x, sobel.z, false);
  ui.say("Sobel", "¡Firmes! ¡Firmes!", 1.8);
  music.intensity(0.2);
  for (const m of col.men) m.sol.st.move = 0;
  await G.wait(2.2);
  G.lockMove = false;
  // consequences: everyone who finished gets fitter and more tired; the player more so
  const finished = col.men.filter((m) => m.state !== "lost");
  for (const m of finished) {
    roster.train(m.id, "fit", opts.variant === "first" ? 1.5 : 2.2);
    roster.tire(m.id, opts.variant === "first" ? 25 : 35);
  }
  roster.train("winters", "fit", 2.5);
  roster.tire("winters", 30);
  roster.companyMood(lost.length ? -3 * lost.length : 4);
  roster.tension(opts.variant === "spaghetti" ? 10 : 5);
  return { lost, helped: [...helped], carried, stam: col.p.stam, flagged: [...flagged] };
}

function vomit(G, s) {
  const fx = G.fx;
  for (let i = 0; i < 10; i++)
    fx.smoke.emit({ x: s.x + Math.sin(s.ry) * 0.3, y: s.y + 1.3, z: s.z + Math.cos(s.ry) * 0.3, vx: Math.sin(s.ry) * 1.5 + (Math.random() - 0.5), vy: 0.5, vz: Math.cos(s.ry) * 1.5 + (Math.random() - 0.5), life: 0.7, s0: 0.1, s1: 0.06, c0: [0.72, 0.6, 0.38, 1], c1: [0.6, 0.48, 0.3, 0.8], grav: 9, floor: G.world.height(s.x, s.z) + 0.02 });
  s.st.slump = 1;
}

export { UV, SUMMIT };
