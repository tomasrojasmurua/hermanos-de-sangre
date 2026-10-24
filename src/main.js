// Hermanos de Sangre: el juego completo. Título, elección de capítulo y el director.
import { Shell } from "./core/shell.js";
import { Director } from "./core/director.js";
import { loadSave, freshSave, writeSave, clearSave } from "./core/save.js";
import { esc } from "./engine/ui.js";
import { CURRAHEE } from "./chapters/currahee/chapter.js";
import { W } from "./chapters/currahee/places.js";

const CHAPTERS = { currahee: CURRAHEE };
// chapters not yet ported to the director open their own prototype page
const LIST = [
  { id: "currahee", n: "1942", title: "Currahee", sub: "Toccoa, Georgia", ready: true },
  { id: "dia-d", n: "1944", title: "Día D", sub: "Normandía, junio", href: "dia-d.html" },
  { id: "bastogne", n: "1944", title: "Bastogne", sub: "Ardenas, diciembre", href: "hermanos-de-sangre.html" },
];

const shell = new Shell();
let save = loadSave();

async function playChapter(id, from) {
  if (!save) save = freshSave();
  const d = new Director(shell, save);
  const res = await d.playChapter(CHAPTERS[id], from);
  if (res.done) title();
}

function title() {
  const ui = shell.ui;
  ui.show(false);
  shell.build("toccoa", CURRAHEE.places.toccoa);
  const G = shell.G;
  G.player = null;
  G.camSpan = 20;
  G.cam.span = 20;
  const [x0, z0] = W(-90, 14);
  G.cam.x = x0;
  G.cam.z = z0;
  shell.music.set("calm", 0.3);
  const off = shell.hook((dt, rdt) => {
    G.cam.x += rdt * 0.9;
    G.cam.z -= rdt * 0.9;
  });
  const cont = save && save.moment && CHAPTERS[save.chapter];
  const w = document.createElement("div");
  w.className = "title";
  w.innerHTML = `
    <div class="tleft">
      <div class="eyebrow">Compañía E · 506.º Regimiento de Infantería Paracaidista</div>
      <h1>Hermanos<br><span>de sangre</span></h1>
      <blockquote>«Nosotros estamos solos juntos».<cite>Coronel Robert Sink, Fort Benning, diciembre de 1942</cite></blockquote>
    </div>
    <div class="tright">
      ${cont ? `<button class="btn big cont" id="t-cont">Continuar</button>` : ""}
      <div class="chlist" role="list">
        ${LIST.map((c) => `<button class="ch ${c.ready ? "" : "proto"}" data-id="${c.id}" ${c.href ? `data-href="${c.href}"` : ""}><em>${c.n}</em><b>${esc(c.title)}</b><small>${esc(c.sub)}</small>${c.ready ? "" : `<span class="tag">prototipo</span>`}</button>`).join("")}
      </div>
      <div class="foot">Basado en «Hermanos de sangre», de Stephen E. Ambrose · Usa audífonos</div>
    </div>`;
  ui.cards.appendChild(w);
  const go = (fn) => {
    shell.audio.init();
    shell.audio.resume();
    shell.music.start();
    shell.audio.paper();
    off();
    w.remove();
    fn();
  };
  const c = w.querySelector("#t-cont");
  if (c) c.onclick = () => go(() => playChapter(save.chapter, save.moment));
  w.querySelectorAll(".ch").forEach((b) => {
    b.onclick = () => {
      if (b.dataset.href) {
        location.href = b.dataset.href;
        return;
      }
      go(() => {
        save = freshSave();
        writeSave(save);
        playChapter(b.dataset.id);
      });
    };
  });
}

// settings live in the general save and apply before the first sound
function applySettings() {
  const st = (save && save.settings) || freshSave().settings;
  shell.audio.setLevels({ music: st.music, sfx: st.sfx, voice: st.voice });
  shell.audio.vibrateOn = st.vibrate !== false;
}
applySettings();

// pause menu: separate volumes for music, effects and voices, vibration, and exit
const STEPS = [1, 0.7, 0.4, 0];
const pct = (v) => (v > 0 ? `${Math.round(v * 100)} %` : "apagado");
shell.ui.onPause = async () => {
  const G = shell.G;
  if (!G || G.paused) return;
  G.paused = true;
  shell.audio.pauseMix(true);
  if (!save) save = freshSave();
  const st = save.settings;
  for (;;) {
    const v = await shell.ui.card({
      kicker: "Pausa",
      title: "Hermanos de sangre",
      text: "Toca una opción para cambiarla.",
      choices: [
        { label: "Seguir", value: "go" },
        { label: `Música: ${pct(st.music)}`, value: "music" },
        { label: `Efectos: ${pct(st.sfx)}`, value: "sfx" },
        { label: `Voces: ${pct(st.voice)}`, value: "voice" },
        { label: `Vibración: ${st.vibrate !== false ? "sí" : "no"}`, value: "vibrate" },
        { label: "Salir al título", value: "title" },
      ],
    });
    if (v === "music" || v === "sfx" || v === "voice") {
      const i = STEPS.findIndex((x) => Math.abs(x - st[v]) < 0.05);
      st[v] = STEPS[(i + 1) % STEPS.length];
      applySettings();
      writeSave(save);
      shell.audio.paper();
      continue;
    }
    if (v === "vibrate") {
      st.vibrate = st.vibrate === false;
      applySettings();
      writeSave(save);
      shell.audio.vibrate(30);
      continue;
    }
    if (v === "title") {
      G.abortScripts();
      shell.hooks.clear();
      shell.music.onBeat = null;
      shell.ui.cards.innerHTML = "";
      shell.ui.subQ = [];
      shell.ui.subT = 0;
      shell.ui.sub.classList.add("hidden");
      document.getElementById("runhud")?.remove();
      delete document.body.dataset.run;
      shell.audio.pauseMix(false);
      title();
      return;
    }
    break;
  }
  shell.audio.pauseMix(false);
  G.paused = false;
};

const qs = new URLSearchParams(location.search);
if (qs.get("m")) {
  // deep link for tests: ?m=subida-1
  save = freshSave();
  if (qs.get("ate")) save.flags.ate = true;
  shell.audio.init();
  shell.music.start();
  playChapter("currahee", qs.get("m"));
} else title();
window.__clearSave = clearSave;
