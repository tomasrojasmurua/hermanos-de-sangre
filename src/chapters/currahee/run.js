// Las carreras a Currahee: modo acción. Tú eres Winters y cierras la columna de Sobel.
// Vas al paso de la columna; los que flaquean se van quedando atrás entre las filas: alcánzalos antes de que
// te pasen. Respira al compás, esprinta cuando haga falta (gasta aliento) y no te salgas del camino.
// Si se te pasan demasiados o Sobel te pilla fuera del camino tres veces, la compañía vuelve a empezar.
import { T, clamp, damp, rng } from "../../engine/util.js";
import { Route, Column } from "../../core/column.js";
import { cast } from "../../core/roster.js";
import { routeWorld, W, UV, SUMMIT } from "./places.js";
import { esc } from "../../engine/ui.js";
import { runFit } from "./semana-data.js";

const NAMED = ["lipton", "guarnere", "malarkey", "toye", "muck", "tipper", "christenson", "gordon", "wynn", "martin", "talbert", "nixon"];

const SOBEL_LINES = [
  "¡Los japos os joderán vivos!",
  "¡Adelante, Silver!",
  "¡Más rápido! ¡Esto no es un paseo!",
  "¡El que suba a la ambulancia, se va hoy mismo!",
  "¡Arriba esas rodillas, Compañía E!",
];

// panting in the ranks (invented, see docs/inventado.md): said by the most tired man near you
const GASP = {
  up: [
    "No siento las piernas…",
    "¿Cuánto falta para la cima?",
    "Me arde el pecho.",
    "Un paso más. Uno más.",
    "Si paro, no vuelvo a arrancar.",
    "Ese hombre no se cansa nunca…",
    "Respira… respira…",
    "Daría la paga del mes por un trago de agua.",
    "Tengo los pulmones en la garganta.",
    "Mira arriba no… mira tus botas.",
  ],
  down: [
    "Cuidado, en la bajada se te van las rodillas.",
    "Ya se ve el campamento…",
    "Bajar duele más que subir.",
    "No te caigas ahora, que nos arrastras a todos.",
    "Tres millas más… solo tres.",
  ],
  sick: [
    "Los espaguetis… me vuelven a subir.",
    "No debí repetir plato.",
    "Sabía que había trampa. Lo sabía.",
    "Si vomito, que sea fuera de la ambulancia.",
  ],
  fading: ["No puedo más…", "Las piernas no me responden…", "Sigan… ya los alcanzo…", "Dame un segundo… solo uno…"],
  winters: ["Sigue. No pares.", "Respira con la cadencia.", "Que no te vean flaquear."],
};

function hud(ui, input) {
  let el = document.getElementById("runhud");
  if (el) el.remove();
  el = document.createElement("div");
  el.id = "runhud";
  el.innerHTML = `
    <div class="aliento" aria-label="Aliento"><span class="lbl">Aliento</span><span class="bar"><i></i></span></div>
    <div class="pace" aria-label="Tu lugar en la columna">
      <span class="end amb">✚ Ambulancia</span><span class="track"><i class="danger"></i><b class="me"></b></span><span class="end head">Sobel</span>
    </div>
    <div class="tally"><span>Se te pasan <b class="pas"></b></span><span>Faltas <b class="fal"></b></span></div>
    <div class="offroad">¡Al camino!</div>
    <button class="sprint" data-b="sprint" aria-label="Esprintar">Esprint<small>gasta aliento</small><kbd>Mayús</kbd></button>
    <button class="breath" data-b="breath" aria-label="Respirar al compás"><span class="target"></span><span class="ring"></span><span class="core"><b>Respirar</b><small class="hint">al compás</small><em class="combo"></em></span><kbd>Espacio</kbd></button>`;
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
  // sprint is held, not tapped
  const sp = el.querySelector(".sprint");
  sp.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    input.held.sprint = true;
    sp.classList.add("down");
  });
  const spUp = () => {
    input.held.sprint = false;
    sp.classList.remove("down");
  };
  sp.addEventListener("pointerup", spUp);
  sp.addEventListener("pointercancel", spUp);
  sp.addEventListener("pointerleave", spUp);
  return {
    sprint: sp,
    tally: el.querySelector(".tally"),
    pas: el.querySelector(".tally .pas"),
    fal: el.querySelector(".tally .fal"),
    offroad: el.querySelector(".offroad"),
    el,
    bar: el.querySelector(".aliento i"),
    ali: el.querySelector(".aliento"),
    me: el.querySelector(".pace .me"),
    pace: el.querySelector(".pace"),
    ring: el.querySelector(".breath .ring"),
    combo: el.querySelector(".breath .combo"),
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
    const fit = runFit(rec); // the week in camp shows here (semana-data.js)
    men.push({ sol, id, named: !!cast(id), fit });
  });
  const sobelC = cast("sobel");
  const sobel = G.add({ id: "sobel", name: sobelC.name, short: "Sobel", side: "us", kit: "pt", weapon: "none", skin: sobelC.skin, seed: 7, speed: 5.4 });
  const winC = cast("winters");
  const win = G.add({ ...winC, id: "winters", side: "us", kit: "pt", weapon: "none", seed: 1, speed: 4.6 });
  win.portrait = { rank: "lt", skin: "#dba886", helmet: "#3b2a1e" };
  if (ctx.flags.firstLt) {
    // promoted by Sink in the first week (semana.js)
    win.name = "Tte. Richard Winters";
    win.rank = "Teniente primero · jefe de pelotón";
  }
  G.setPlayer(win);
  // ambulances
  const ambMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
  const ambs = [0, 1].slice(0, opts.variant === "spaghetti" ? 2 : 1).map(() => {
    const m = new T.Mesh(lvl.ambGeo, ambMat);
    m.castShadow = true;
    G.scene.add(m);
    return m;
  });
  if (!lvl.ambGeo.boundingBox) lvl.ambGeo.computeBoundingBox();
  const bb = lvl.ambGeo.boundingBox;
  const ambHalf = Math.max(bb.max.z - bb.min.z, bb.max.x - bb.min.x) / 2;
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
    input,
    tail: true, // Winters closes the column
    maxFlag: opts.variant === "first" ? 2 : 3,
    ambulances: ambs,
    ambGap: 5 + ambHalf, // room for Winters between the last rank and the truck
    ambReach: ambHalf + 0.6,
    pace: (s) => {
      // Sobel pushes harder on the climb and eases a touch on the summit
      const k = s < 30 ? 0.7 : s > summitS - 8 && s < summitS + 6 ? 0.75 : 1;
      return basePace * k;
    },
    sick: (m) => (opts.variant === "spaghetti" ? (sickT[m.id] > 0 ? 0.016 : 0) * (m.player ? (opts.ate ? 1 : 0.4) : 1) : 0),
    onStraggle: (m) => {
      audio.breath(1, 0);
      m.sol.noLabel = true;
      if (!flagged.has(m.id)) ui.toast(`${m.sol.short} se está quedando atrás`, 1800);
      if (!ui.talking) ui.say(m.sol.short, pickG("fading"), 1.8);
      flagged.add(m.id);
    },
    onRecover: (m) => {
      m.sol.noLabel = false;
      ui.say("Winters", r() < 0.5 ? `Vamos, ${m.sol.short}. Conmigo.` : `Un paso más, ${m.sol.short}. Y otro.`, 1.8);
      roster.bond("winters", m.id, 6);
      roster.mood(m.id, 4);
      helped.add(m.id);
    },
    onPass: (m) => {
      passed++;
      audio.vibrate([60, 40, 60]);
      ui.toast(`${m.sol.short} se te ha pasado (${passed} de ${maxPass})`, 2000);
      H.tally.classList.remove("flash");
      void H.tally.offsetWidth;
      H.tally.classList.add("flash");
      if (passed >= maxPass) failWhy = failWhy || "pasados";
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
      audio.duck(3, 0.5);
      ui.toast(`${m.sol.short} sube a la ambulancia. Esa misma tarde lo echan.`, 3200);
      setTimeout(() => m.sol.remove(), 900);
    },
  });
  const flagged = new Set(), helped = new Set(), lost = [], carried = [];
  const maxPass = opts.variant === "first" ? 3 : 4, maxFaults = 3;
  let passed = 0, faults = 0, failWhy = null, offT = 0;
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
  win.driven = true; // the column's tail moves him (core/column.js updateTail)
  col.p.s = col.tailS();
  col.p.lat = 0; // between the two files
  const ws = route.at(col.p.s);
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
  audio.setBed(0.32);
  G.setObjective(opts.variant === "first" ? "Cierra la columna hasta la cima" : "Que nadie de tu pelotón suba a la ambulancia", ...lvl.summit);
  const touch = matchMedia("(pointer: coarse)").matches;
  if (opts.variant === "first") {
    ui.toast("Cierras la columna. Los que flaquean se quedan atrás: alcánzalos antes de que te pasen.", 4200);
    setTimeout(() => ui.toast(touch ? "Suelta el stick y vas al paso. Adelante para subir por la columna, atrás para dejarte caer. «Respirar» al compás; «Esprint» gasta aliento." : "Sin teclas vas al paso · W/S sube o baja por la columna · A/D de lado · Espacio respira al compás · Mayús esprinta", 5200), 4500);
    setTimeout(() => ui.toast("No te salgas del camino: Sobel lo ve todo.", 3000), 10500);
  } else ui.toast("Cierras la columna. Que no se te pase nadie.", 3200);
  const fadeGap = opts.variant === "first" ? 40 : 30;
  let nextFade = opts.variant === "first" ? 55 : 40;
  let lastLine = null, windT = 0, bag = [], tutHelp = false, ambT = 0, silentT = 0, nextLine = 6, phaseUp = true, summitDone = false, behindT = 0, stepT = 0, lastBreathOk = false, tipsShown = 0;
  let failed = false;
  let gaspT = 9;
  const gBag = {};
  const pickG = (k) => {
    if (!gBag[k] || !gBag[k].length) gBag[k] = GASP[k].slice().sort(() => r() - 0.5);
    return gBag[k].pop();
  };
  const tick = (dt, rdt) => {
    if (dt <= 0) return;
    if (input.axis().l > 0.2) ui.ghostOff();
    col.update(dt, ctx);
    const P = col.p;
    // breathing on the cadence
    const b = music.breath();
    // the ring closes onto the fixed target ring: tap when they meet
    H.ring.style.transform = `scale(${(1.35 - b.phase * 0.35).toFixed(3)})`;
    H.ring.style.opacity = (0.25 + b.phase * 0.75).toFixed(2);
    H.btn.classList.toggle("window", b.err < 0.16);
    if (input.consume("breath") || input.consume("fire")) {
      const ok = col.breathe(b.err < 0.16);
      audio.breath(ok ? 0.25 + 0.1 / (1 + col.p.combo) : 0.9, 0, 1.6);
      audio.hit(ok);
      H.combo.textContent = ok && col.p.combo >= 2 ? `×${col.p.combo}` : "";
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
    const warn = P.dAmb != null ? P.dAmb < 1.6 : rel < 0.12;
    if (warn && !H.pace.classList.contains("warn")) audio.vibrate([40, 60, 40]);
    H.pace.classList.toggle("warn", warn);
    // the ambulance idles audibly behind you
    ambT -= dt;
    if (ambT <= 0 && ambs[0]) {
      ambT = 2.4;
      const a = ambs[0].position;
      if (Math.hypot(a.x - win.x, a.z - win.z) < 26) audio.engine(a.x, a.z, 2.6);
    }
    // footsteps of the column, the player's own breath
    if (P.stam < 0.35 && r() < dt * (1.6 - P.stam * 2)) audio.breath(1 - P.stam, 0);
    silentT = Math.max(0, silentT - dt);
    if (!silentT) music.intensity(0.45 + (1 - P.stam) * 0.3 + (phaseUp ? 0.1 : 0) + col.flagged().length * 0.05);
    // Sobel shouts
    nextLine -= dt;
    if (nextLine <= 0) {
      nextLine = 14 + r() * 6;
      if (!bag.length) {
        bag = SOBEL_LINES.slice().sort(() => r() - 0.5);
        if (bag[bag.length - 1] === lastLine) bag.unshift(bag.pop()); // never the same line twice in a row
      }
      const line = bag.pop();
      lastLine = line;
      ui.say("Sobel", line, 2.2);
    }
    // tired men: a gasp from the most spent man near Winters, between Sobel's shouts, never over them
    gaspT -= dt;
    if (gaspT <= 0 && !ui.talking && nextLine > 3) {
      gaspT = 7 + r() * 6;
      if (P.stam < 0.3 && r() < 0.5) ui.say("Winters", pickG("winters"), 1.8);
      else {
        const near = col.men.filter((m) => m.state === "ok" && Math.hypot(m.sol.x - win.x, m.sol.z - win.z) < 11).sort((a, b) => a.stam - b.stam)[0];
        if (near) {
          const kind = opts.variant === "spaghetti" && r() < 0.45 ? "sick" : phaseUp ? "up" : "down";
          ui.say(near.sol.short, pickG(kind), 2);
          audio.breath(0.7, 0);
        }
      }
    }
    // men fade at intervals, weaker ones more often, anywhere in the column (near the head they take longer to reach you)
    if (col.s > nextFade) {
      nextFade += fadeGap * (0.75 + r() * 0.5);
      const pool = col.men.filter((m) => m.state === "ok" && !m.passed).sort((a, b) => a.fit + r() * 25 - (b.fit + r() * 25));
      const weak = pool[0];
      if (weak) {
        weak.stam = 0.15;
        if (!tutHelp && opts.variant === "first") {
          tutHelp = true;
          setTimeout(() => ui.toast(`${weak.sol.short} flaquea y se queda atrás. Ve a su encuentro y tócalo.`, 3600), 1200);
        }
      }
    }
    // the road: Sobel sees everyone who cuts across or wanders off it
    const offRoad = P.off > 2.5;
    H.offroad.classList.toggle("on", offRoad);
    if (offRoad) {
      offT += dt;
      if (offT > 1.6) {
        offT = -1.5; // a grace period before the next fault
        faults++;
        P.stam = clamp(P.stam - 0.15, 0, 1);
        audio.vibrate([80, 50, 80]);
        ui.sayNow("Sobel", faults < maxFaults ? `¡Winters! ¡Ese no es el camino! ¡Al sendero!` : "¡Winters! ¡Ya basta!", 2);
        if (faults >= maxFaults) failWhy = failWhy || "faltas";
      }
    } else offT = Math.max(offT < 0 ? offT : 0, offT - dt);
    H.pas.textContent = "●".repeat(passed) + "○".repeat(Math.max(0, maxPass - passed));
    H.fal.textContent = "⚑".repeat(faults) + "·".repeat(Math.max(0, maxFaults - faults));
    H.pas.classList.toggle("hit", passed > 0);
    H.fal.classList.toggle("hit", faults > 0);
    H.sprint.classList.toggle("off", P.stam < 0.05);
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
      // silence as a tool: the music drops away and leaves the wind and the men shouting the name
      music.intensity(0.05);
      silentT = 4;
      audio.duck(4, 0.05, 0.3);
      audio.startWind(0.05);
      audio.setWind(0.3);
      windT = setTimeout(() => audio.setWind(0.08), 5000);
      G.camSpan = 22;
      setTimeout(() => (G.camSpan = 15), 3500);
      audio.chant("currahee", 10, sobel.x, sobel.z);
      ui.sayNow("", "La cima. Abajo, el campamento parece de juguete. Ahora, de vuelta.", 3);
      G.setObjective("De vuelta al campamento", ...W(-62, 0));
      if (opts.variant === "first") setTimeout(() => ui.toast("Bajando cuesta menos aliento. Que nadie quede atrás.", 3000), 3200);
    }
    // markers for the men who are fading
    for (const m of col.flagged()) {
      let [sx, sy] = G.project(m.sol.x, m.sol.y + 2.3, m.sol.z);
      const off = sx < 30 || sx > innerWidth - 30 || sy < 70 || sy > innerHeight - 30;
      sx = clamp(sx, 40, innerWidth - 40);
      sy = clamp(sy, 108, innerHeight - 40); // below the position bar
      ui.mark("st" + m.id, sx, sy, `<span>${off ? "◀ " : ""}${esc(m.sol.short)}</span>`, "strag");
    }
    // too far behind: the ambulance is right behind you
    if (P.dAmb != null ? P.dAmb < 0.4 : rel < 0.02) {
      behindT += dt;
      if (behindT > 0.4 && behindT - dt <= 0.4) ui.toast("¡La ambulancia te alcanza! Corre.", 1600);
      if (behindT > 4.5) failWhy = failWhy || "ambulancia";
    } else behindT = Math.max(0, behindT - dt * 2);
    if (failWhy) failed = true;
  };
  const unhook = shell.hook(tick);
  // the column's boots fall on the cadence (two steps a beat), the breath beats carry a guide pulse
  // on the effects bus, and a heartbeat comes in when Winters is running out of air
  G.quietSteps = true;
  G.focusR = Math.min(innerHeight * 0.3, 120); // the whole column, not just Winters, shows through the pines
  music.onBeat = (t, b, spb) => {
    if (G.paused) return;
    const P = col.p, mv = win.st.move;
    if (mv > 0.2) {
      audio.stride(0.7 + mv * 0.4 + (b % 2 === 0 ? 0.3 : 0), 0, t);
      audio.stride(0.6 + mv * 0.3, 0, t + spb / 2);
    }
    audio.stride(0.6, -0.5, t + 0.04);
    audio.stride(0.5, 0.5, t + spb / 2 + 0.03);
    if (b % 2 === 0) audio.tick(t, 0.8);
    if (P.stam < 0.35) audio.heartAt(P.stam < 0.2 ? 0.8 : 0.55, t);
  };
  // the run ends back at the parade ground; leaving it any way (abort included) cleans up
  try {
    await G.until(() => failed || col.s >= route.total - 2);
  } finally {
    win.driven = false;
    input.held.sprint = false;
    for (const m of col.men) if (m.sol) m.sol.faceAlong = null;
    sobel.faceAlong = null;
    unhook();
    music.onBeat = null;
    G.quietSteps = false;
    G.focusR = 0;
    clearTimeout(windT);
    audio.setWind(0);
  }
  G.objective = null;
  ui.setAct(null);
  H.remove();
  delete document.body.dataset.run;
  window.__run = null;
  ambs.forEach((m) => G.scene.remove(m));
  if (failed) {
    // Sobel's way: the whole company goes back to the bottom and runs it again (nobody washed out, nobody tired)
    Object.assign(roster.d, JSON.parse(before));
    G.lockMove = true;
    music.intensity(0.15);
    audio.whistle(sobel.x, sobel.z, true);
    const why = {
      pasados: [`Se te han pasado ${passed} hombres`, "«¡Compañía, alto! ¿A esto le llaman correr? ¡Abajo todos! ¡Otra vez desde el principio!»\n\nWinters cierra la columna: el que flaquea tiene que encontrarlo a él antes que a la ambulancia. Ve a su encuentro y tócalo; suelta el stick para volver al paso."],
      faltas: ["Fuera del camino", "«¡Winters! ¿Se cree que esto es un paseo por el campo? ¡Compañía, abajo! ¡Desde el principio!»\n\nSobel no perdona un atajo. Mantente en el sendero rojo."],
      ambulancia: ["La ambulancia te alcanza", "«¡Su teniente se ha dejado alcanzar por la ambulancia! ¡Abajo todos! ¡Otra vez!»\n\nCuando te quedes sin aliento, respira al compás; esprinta solo para alcanzar a un hombre."],
    }[failWhy || "ambulancia"];
    await ui.card({ kicker: "Currahee · Sobel", title: why[0], text: why[1], next: "Otra vez desde abajo" });
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
