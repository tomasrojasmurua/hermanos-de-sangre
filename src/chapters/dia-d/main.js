// Boot: title, part runner, checkpoints (autosave), death handling, frame loop.
import { T, clamp, damp } from "../../engine/util.js";
import { U, Builder, meshFrom } from "../../engine/geo.js";
import { Renderer, pickQuality } from "../../engine/render.js";
import { FX } from "../../engine/fx.js";
import { Audio } from "../../engine/audio.js";
import { Input } from "../../engine/input.js";
import { UI, esc } from "../../engine/ui.js";
import { Game } from "../../core/game.js";
import { buildNight, buildBrecourt, gradeNight, gradeDawn, W } from "./dday.js";
import { nightScript, brecourtScript, OUTRO, nightAmbience } from "./story.js";
import * as P from "../../core/props.js";
import { Cones } from "../../engine/cones.js";

const SAVE_KEY = "hds_dia_d_v1";
const loadSave = () => {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY)) || null;
  } catch {
    return null;
  }
};
const writeSave = (s) => {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {}
};

const q = pickQuality();
const canvas = document.getElementById("c");
const R = new Renderer(canvas, q);
const audio = new Audio();
const uiRoot = document.getElementById("ui");
const ui = new UI(uiRoot);
const input = new Input(uiRoot);
ui.bindInput(input);
const camera = new T.OrthographicCamera(-10, 10, 10, -10, 1, 260);

let G = null; // current Game
let scene = null;
let lvl = null;
let save = loadSave() || { part: "night", cp: "n0", lead: "winters" };
if (save.lead === "lipton") save.lead = "winters"; // the old permadeath branch no longer exists
let running = false;

function disposeScene(sc) {
  if (!sc) return;
  sc.traverse((o) => {
    if (o.geometry && !o.geometry._shared) o.geometry.dispose();
  });
}

function setupPart(part) {
  disposeScene(scene);
  scene = new T.Scene();
  const ctx = { scene, q };
  lvl = part === "night" ? buildNight(ctx) : buildBrecourt(ctx);
  (part === "night" ? gradeNight : gradeDawn)(R.post);
  const fx = new FX(scene, lvl.world);
  G && G.abortScripts();
  G = new Game({ scene, camera, world: lvl.world, fx, audio, ui, input, renderer: R });
  G.lvl = lvl;
  G.save = save;
  G.cones = new Cones(scene);
  G.part = part;
  G.checkpoint = (p, cp) => {
    const first = save.cp === cp && save.part === p;
    save = { ...save, part: p, cp };
    G.save = save;
    writeSave(save);
    if (!first) ui.toast("Punto de control", 1400);
  };
  G.qte = (label, secs, target, short) =>
    new Promise((res) => {
      input.pressed.qte = false;
      ui.qte(label, secs, short);
      G.slow = 0.4;
      G.qteTarget = target || null;
      const end = G.t + secs * 0.4;
      G.until(() => input.consume("qte") || input.consume("fire") || G.t > end).then(() => {
        const ok = G.t <= end;
        ui.qteHide();
        G.qteTarget = null;
        G.slow = 1;
        res(ok);
      }, () => ui.qteHide());
    });
  G.wreckGun = (i) => {
    const gp = lvl.gunPos[i];
    if (!gp || gp.wrecked) return;
    gp.wrecked = true;
    G.flags.wrecked = (G.flags.wrecked || 0) + 1;
    scene.remove(gp.mesh);
    const b = new Builder(70 + i);
    const y = lvl.world.height(gp[0], gp[1]);
    P.gun105(b, gp[0], y, gp[1], Math.atan2(-Math.SQRT1_2, -Math.SQRT1_2) + 0.35, { wrecked: true });
    const m = meshFrom(b, "world");
    scene.add(m);
    G.fx.addFire(gp[0], y + 1, gp[1], 0.5);
    setTimeout(() => (G.fx.fires = G.fx.fires.filter((f) => f.x !== gp[0])), 9000);
  };
  G.deathCard = async ({ guaranteed, who }) => {
    G.slow = 0.25;
    R.post.desat.value = 0.8;
    audio.sting("grief");
    await new Promise((r) => setTimeout(r, 1600));
    G.paused = true;
    const nm = (who || G.player).name;
    if (guaranteed) {
      await ui.card({
        kicker: "Aún no",
        title: `${nm} no cae aquí`,
        text: "La historia necesita a este hombre vivo. Vuelves al último punto de control.",
        next: "Reintentar",
      });
      restart();
    } else {
      const v = await ui.card({
        kicker: "Brécourt Manor",
        title: `${nm} ha caído`,
        text: "No hay vuelta atrás. Los hombres le ven caer en la trinchera y por un momento nadie dispara. Alguien tiene que llevarlos de vuelta.",
        choices: [
          { label: "Lipton toma el mando", sub: "La partida sigue sin él. Para siempre.", value: "go" },
          { label: "Volver al punto de control", sub: "Solo para este prototipo.", value: "retry" },
        ],
      });
      if (v === "go" && save.lead !== "lipton") {
        save = { ...save, lead: "lipton", fallen: [...(save.fallen || []), "winters"] };
        writeSave(save);
      }
      restart();
    }
  };
  // frame-level hooks
  const baseUpdate = G.update.bind(G);
  G.update = (dt) => {
    baseUpdate(dt);
    G.cones.update(G, dt);
    if (!G.paused) {
      G.ambient && G.ambient(dt * G.slow);
      if (G.flickers) for (const l of G.flickers) l.intensity = 14 + Math.sin(G.t * 44) * 2.5 + Math.sin(G.t * 27) * 2;
      if (G.surrenderWalk)
        for (const s of G.surrenderWalk) {
          if (!s.alive || !s.walkOff) continue;
          s.surrendered = true;
          s.st.surr = 1;
          const arrived = G.moveTo(s, s.walkOff[0], s.walkOff[1], dt * G.slow, 0.5, 1);
          if (arrived) s.remove(), (s.alive = false), (s.walkOff = null);
        }
      if (G.manorFire && G.player) {
        G._mf = (G._mf || 0) - dt;
        if (G._mf <= 0) {
          G._mf = 0.07;
          const p = G.player;
          const [mx, mz] = W(87, 8);
          const tx = p.x + (Math.random() - 0.5) * 9, tz = p.z + (Math.random() - 0.5) * 9;
          G.fx.tracers.shoot(mx, lvl.world.height(mx, mz) + 1, mz, tx, lvl.world.height(tx, tz) + 0.2 + Math.random(), tz, [3.6, 1.4, 0.45], 80, 2.4, null);
          if (Math.random() < 0.3) setTimeout(() => G.fx.dirt(tx, tz, 0.5), 250);
          if (Math.random() < 0.08) audio.mg(mx, mz);
          if (Math.random() < 0.06) audio.whizz(0.6);
        }
      }
    }
    if (G.qteTarget) {
      const q = G.qteTarget;
      const [sx, sy] = G.project(q.x, q.y + 1, q.z);
      ui.mark("qring", sx, sy + 32, "", "qring");
    }
    if (G.player && (input.mx || input.my || input.keys.KeyW || input.keys.KeyA || input.keys.KeyS || input.keys.KeyD)) ui.ghostOff();
    if (G.pingT > 0) {
      G.pingT -= dt;
      const [sx, sy] = G.project(G.ping.x, lvl.world.height(G.ping.x, G.ping.z) + 1.5, G.ping.z);
      ui.mark("ping", sx, sy, "♪", "ping");
    }
  };
  return G;
}

async function runPart(part, cp) {
  running = true;
  const g = setupPart(part);
  audio.listener = { x: 0, z: 0 };
  ui.show(true);
  ui.setCrouch(false);
  R.post.fade.value = 1;
  try {
    let next;
    if (part === "night") {
      audio.startWind(0.22);
      audio.setWind(0.22);
      next = await nightScript(g, cp);
    } else {
      audio.startWind(0.12);
      audio.setWind(0.12);
      next = await brecourtScript(g, cp);
    }
    if (next === "brecourt") {
      await ui.fade(true, 1200);
      g.paused = true;
      await ui.card({
        kicker: "Le Grand Chemin · 6 de junio · 08:30",
        title: "Brécourt Manor",
        text: [
          "Al amanecer, la Compañía E es apenas un puñado: dos ametralladoras ligeras, un bazuca sin munición, un mortero, nueve fusileros y dos oficiales.",
          "A unos cientos de metros, tras los setos de una granja, cuatro cañones de 105 mm disparan sobre la playa Utah. Los defienden unos cincuenta paracaidistas alemanes, comunicados por trincheras.",
          "El capitán Hester se lo dice a Winters sin rodeos: hay que acabar con esa batería. Winters tiene trece hombres.",
        ],
        next: "«¡Seguidme!»",
      });
      save = { ...save, part: "brecourt", cp: "b0" };
      writeSave(save);
      await ui.fade(false, 10);
      return runPart("brecourt", "b0");
    }
    if (next === "end") {
      await ui.fade(true, 1400);
      g.paused = true;
      audio.sting("dawn");
      await ui.card({ kicker: "Normandía · 6 de junio de 1944", title: "Fin del Día D", text: OUTRO(g), next: "Seguir" });
      const k = g.flags.kills || 0;
      await ui.card({
        kicker: "Lo que queda",
        title: "Brécourt, en números",
        text: `Cañones destruidos: 4 de 4. Alemanes abatidos por tu mano: ${k}. Toye: ${g.flags.toyeSaved ? "ileso, con la culata destrozada" : "herido, pero sigue en pie"}. Malarkey: ${g.flags.luger ? "volvió sin la Luger y con la cara llena de barro" : "nunca supo qué había en aquella funda"}. ${save.lead === "lipton" ? "Winters: caído en la trinchera." : "Winters: vivo."}\n\nEste es el prototipo del modo soldado. Siguiente capítulo: Carentan.`,
        next: "Volver al título",
      });
      save = { part: "night", cp: "n0", lead: "winters" };
      writeSave(save);
      running = false;
      title();
    }
  } catch (e) {
    if (e && e.message === "abort") return;
    console.error(e);
  }
}

function restart() {
  ui.cards.innerHTML = "";
  G.abortScripts();
  R.post.desat.value = 0;
  runPart(save.part, save.cp);
}

// ---- title --------------------------------------------------------------------------------------
const PLANE_SVG = `<svg viewBox="0 0 96 40"><path d="M4 20 Q10 16 30 17 L44 3 L52 3 L46 17 L70 18 L80 10 L86 10 L84 19 Q92 20 92 21 Q92 22 84 23 L86 30 L80 30 L70 23 L46 24 L52 37 L44 37 L30 24 Q10 25 4 21 Z"/></svg>`;
const CHUTE_SVG = `<svg viewBox="0 0 22 30"><path d="M1 9 Q11 -3 21 9 Q16 7 11 9 Q6 7 1 9 Z" fill="#c9c6b8" opacity=".9"/><path d="M2 9 L11 24 M20 9 L11 24 M11 9 L11 24" stroke="#9aa0a8" stroke-width=".6"/><rect x="9.5" y="23" width="3" height="6" rx="1" fill="#1a1e26"/></svg>`;
function title() {
  ui.show(false);
  setupPart("night");
  G.paused = false;
  G.title = true;
  nightAmbience(G);
  // slow drift over the bocage at night, no player
  G.cam.span = 26;
  const [x0, z0] = W(30, 6);
  G.cam.x = x0;
  G.cam.z = z0;
  const has = save && !(save.part === "night" && save.cp === "n0");
  const w = document.createElement("div");
  w.className = "title";
  w.innerHTML = `<div class="eyebrow">Compañía E · 506.º Paracaidista · 101.ª Aerotransportada</div>
    <div class="logo"><h1>Hermanos<br><span>de sangre</span></h1><div class="sub">Capítulo III · Día D</div></div>
    <div class="tbtns">${has ? `<button class="btn big cont">Continuar</button>` : ""}<button class="btn ${has ? "ghost" : "big"} start">${has ? "Empezar de nuevo" : "Comenzar"}</button></div>
    <blockquote>Saltaron a muy poca altura desde aviones que volaban demasiado rápido, cargados con más equipo del que nunca habían llevado.<cite>Basado en «Hermanos de sangre», de Stephen E. Ambrose</cite></blockquote>
    <div class="foot">Usa auriculares · Prototipo del modo soldado · <a class="chap7" href="bastogne.html">Capítulo VII · Bastogne</a></div>
    <div class="tsky"><div class="moon"></div>${[0, 1, 2].map((i) => `<div class="plane" style="top:${18 + i * 4}%;animation-delay:${-i * 1.2 - 3}s;width:${96 - i * 14}px">${PLANE_SVG}</div>`).join("")}
    ${[0, 1, 2, 3, 4, 5].map((i) => `<div class="flak" style="left:${12 + i * 14}%;animation-delay:${i * 0.37}s"></div>`).join("")}
    ${[0, 1, 2, 3].map((i) => `<div class="chute" style="left:${8 + i * 21}%;top:${10 + (i % 2) * 6}%;animation-delay:${-i * 3.4}s">${CHUTE_SVG}</div>`).join("")}</div>`;
  ui.cards.appendChild(w);
  const go = async (fresh) => {
    audio.init();
    audio.resume();
    w.remove();
    if (fresh) {
      save = { part: "night", cp: "n0", lead: "winters" };
      writeSave(save);
      await ui.card({
        kicker: "Normandía · 6 de junio de 1944 · 01:10",
        title: "«¡Seguidme!»",
        text: [
          "Los hombres saltaron desde demasiado poca altura, en aviones que volaban demasiado rápido. Las bolsas de pierna, una idea británica que nadie había probado, se soltaron al abrirse los paracaídas y cayeron a la oscuridad.",
          "El teniente Richard Winters cae a las afueras de Sainte-Mère-Église. Ve el incendio junto a la iglesia y oye su campana. Ha perdido el fusil. Solo le queda la bayoneta, metida en la bota.",
        ],
        next: "Saltar",
      });
    }
    runPart(save.part, save.cp);
  };
  w.querySelector(".start").onclick = () => go(true);
  const c = w.querySelector(".cont");
  if (c) c.onclick = () => go(false);
}

ui.onPause = async () => {
  if (!G || G.title) return;
  G.paused = true;
  const v = await ui.card({
    kicker: "Pausa",
    title: "Hermanos de sangre",
    text: "Controles: arrastra en la mitad izquierda para moverte. Disparo con apuntado asistido, agacharse, granada, venda y acción.\n\nDe noche te ven si entras en su campo de visión, si te mueves de pie o si estás cerca de una luz. Los setos cortan la vista; las trincheras y los terraplenes cubren.",
    choices: [
      { label: "Seguir", value: "go" },
      { label: "Volver al punto de control", value: "cp" },
      { label: "Salir al título", value: "title" },
    ],
  });
  if (v === "cp") restart();
  else if (v === "title") {
    G.abortScripts();
    title();
  } else G.paused = false;
};

// ---- loop ---------------------------------------------------------------------------------------
let last = performance.now();
const fpsEl = new URLSearchParams(location.search).get("fps") ? document.createElement("div") : null;
if (fpsEl) {
  fpsEl.className = "fps";
  document.body.appendChild(fpsEl);
}
let simAcc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const real = Math.min(0.25, (now - last) / 1000);
  last = now;
  // fixed sub-steps keep the simulation real-time on slow phones (render once per frame)
  simAcc += real;
  const steps = Math.min(5, Math.max(1, Math.round(simAcc / 0.034)));
  const dt = Math.min(0.05, simAcc / steps);
  simAcc = 0;
  if (!G) return;
  if (G.title) {
    G.cam.x += dt * 0.6;
    G.cam.z -= dt * 0.25;
    U.time.value += dt;
    G.fx.update(dt);
    G.ambient && G.ambient(dt);
    G.updateCamera(0);
    R.post.fade.value = damp(R.post.fade.value, 0, 1.5, dt);
  } else {
    for (let i = 0; i < steps; i++) G.update(dt);
    R.post.fade.value = damp(R.post.fade.value, 0, 2, real);
    if (G.player) audio.listener = { x: G.player.x, z: G.player.z };
    const want = G.camSpan || 12.5;
    if (Math.abs(G.cam.span - want) > 0.05) G.cam.span = damp(G.cam.span, want, 0.8, real);
  }
  // shadow camera follows the view
  const L = lvl.L;
  if (L && L.sun.castShadow) {
    const c = G.cam;
    // centre the shadow map a little up-screen: the view sees farther ahead than behind
    const fx = c.x - Math.sin(c.yaw) * 7, fz = c.z - Math.cos(c.yaw) * 7;
    const y = lvl.world.height(fx, fz);
    L.sun.position.set(fx + L.dir[0] * 60, y + L.dir[1] * 60, fz + L.dir[2] * 60);
    L.sun.target.position.set(fx, y, fz);
    L.sun.target.updateMatrixWorld();
  }
  // see-through focus around the soldier you control
  if (G.player && G.player.alive && !G.title) {
    const [sx, sy] = G.project(G.player.x, G.player.y + 1, G.player.z);
    U.focus.value.set((sx / innerWidth) * R.w, (1 - sy / innerHeight) * R.h, G.player.y, 95 * (R.h / innerHeight));
  } else U.focus.value.set(-9999, -9999, 0, 0);
  R.render(scene, camera, now / 1000);
  R.adapt(real);
  if (fpsEl) fpsEl.textContent = `${Math.round(R.fps)} fps · ${q.name} · res ${Math.round(R.dyn * 100)}% · ${R.r.info.render.calls} dc`;
}
const QS = new URLSearchParams(location.search);
if (QS.get("cp")) {
  // debug / deep link: ?part=brecourt&cp=b2
  audio.init();
  save = { part: QS.get("part") || (QS.get("cp")[0] === "b" ? "brecourt" : "night"), cp: QS.get("cp"), lead: QS.get("lead") || "winters" };
  runPart(save.part, save.cp);
} else title();
requestAnimationFrame(frame);
window.__G = () => G;
window.__R = R;
