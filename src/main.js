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
  { id: "currahee", n: "I", title: "Currahee", sub: "Toccoa · 1942", ready: true },
  { id: "dia-d", n: "III", title: "Día D", sub: "Normandía · junio de 1944", href: "dia-d.html" },
  { id: "bastogne", n: "VII", title: "Bastogne", sub: "Ardenas · diciembre de 1944", href: "hermanos-de-sangre.html" },
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
  G.camSpan = 24;
  G.cam.span = 24;
  const [x0, z0] = W(-40, 6);
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
      <blockquote>«Nosotros estamos solos juntos».<cite>Coronel Robert Sink, Toccoa</cite></blockquote>
    </div>
    <div class="tright">
      ${cont ? `<button class="btn big cont" id="t-cont">Continuar</button>` : ""}
      <div class="chlist" role="list">
        ${LIST.map((c) => `<button class="ch ${c.ready ? "" : "proto"}" data-id="${c.id}" ${c.href ? `data-href="${c.href}"` : ""}><em>${c.n}</em><b>${esc(c.title)}</b><small>${esc(c.sub)}${c.ready ? "" : " · prototipo"}</small></button>`).join("")}
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

// pause menu: settings (separate volumes) and exit
shell.ui.onPause = async () => {
  const G = shell.G;
  if (!G) return;
  G.paused = true;
  const a = shell.audio;
  const lv = a.levels || { music: 0.8, sfx: 0.9, voice: 0.9 };
  const v = await shell.ui.card({
    kicker: "Pausa",
    title: "Hermanos de sangre",
    text: `Música ${Math.round(lv.music * 100)} % · Efectos ${Math.round(lv.sfx * 100)} % · Voces ${Math.round(lv.voice * 100)} %`,
    choices: [
      { label: "Seguir", value: "go" },
      { label: lv.music > 0.05 ? "Silenciar la música" : "Activar la música", value: "music" },
      { label: "Salir al título", value: "title" },
    ],
  });
  if (v === "music") a.setLevels({ music: lv.music > 0.05 ? 0 : 0.8 });
  if (v === "title") {
    G.abortScripts();
    shell.hooks.clear();
    shell.ui.cards.innerHTML = "";
    title();
    return;
  }
  G.paused = false;
};

const qs = new URLSearchParams(location.search);
if (qs.get("m")) {
  // deep link for tests: ?m=subida-1
  save = freshSave();
  if (qs.get("ate")) save.flags.ate = true;
  shell.audio.init();
  playChapter("currahee", qs.get("m"));
} else title();
window.__clearSave = clearSave;
