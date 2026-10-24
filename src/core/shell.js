// El "caparazón" del juego: renderer, cámara, controles, interfaz, audio, música y el bucle de cuadros.
// Monta escenarios (stages) a partir de un constructor de lugar y entrega un Game listo para un modo.
// No sabe nada de ningún capítulo.
import { T, damp } from "../engine/util.js";
import { U } from "../engine/geo.js";
import { Renderer, pickQuality } from "../engine/render.js";
import { FX } from "../engine/fx.js";
import { Audio } from "../engine/audio.js";
import { Music } from "../engine/music.js";
import { Input } from "../engine/input.js";
import { UI } from "../engine/ui.js";
import { Cones } from "../engine/cones.js";
import { Game } from "./game.js";

const _fd = new T.Vector3();

export class Shell {
  constructor() {
    this.q = pickQuality();
    this.R = new Renderer(document.getElementById("c"), this.q);
    this.audio = new Audio();
    this.music = new Music(this.audio);
    this.uiRoot = document.getElementById("ui");
    this.ui = new UI(this.uiRoot);
    this.input = new Input(this.uiRoot);
    this.ui.bindInput(this.input);
    // every subtitle gets a voice: pitch per speaker, placed where he stands
    const PITCH = { Sobel: 178, Winters: 132, Lipton: 140, Guarnere: 150, Tipper: 158, Nixon: 126 };
    this.ui.onLine = (who, text) => {
      if (!who) return;
      const s = this.G && this.G.soldiers.find((o) => o.short === who);
      let h = 0;
      for (const c of who) h = (h * 31 + c.charCodeAt(0)) % 997;
      this.audio.duck(Math.min(4, 0.6 + text.length * 0.05), 0.55);
      this.audio.speak(text, { pitch: PITCH[who] || 118 + (h % 50), x: s?.x, z: s?.z });
    };
    this.camera = new T.OrthographicCamera(-10, 10, 10, -10, 1, 260);
    this.G = null;
    this.scene = null;
    this.stage = null;
    this.hooks = new Set(); // per-frame callbacks (dt) from the current mode
    this.last = performance.now();
    this.simAcc = 0;
    const qs = new URLSearchParams(location.search);
    if (qs.get("fps")) {
      this.fpsEl = document.createElement("div");
      this.fpsEl.className = "fps";
      document.body.appendChild(this.fpsEl);
    }
    // audio needs a user gesture: the first touch anywhere unlocks it
    const unlock = () => {
      // iOS: play through the silent switch like a game, not like a ringtone
      try {
        if (navigator.audioSession) navigator.audioSession.type = "playback";
      } catch {}
      this.audio.init();
      this.audio.resume();
      this.music.start();
    };
    for (const ev of ["pointerdown", "touchend", "click"]) window.addEventListener(ev, unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    requestAnimationFrame((t) => this.frame(t));
    window.__shell = this;
    window.__G = () => this.G;
    window.__R = this.R;
  }
  // build (or rebuild) the world for a place. builder(ctx) -> {world, L, ...}
  build(placeId, builder) {
    if (this.stage && this.stage.id === placeId) return this.stage;
    if (this.G) this.G.abortScripts();
    if (this.scene)
      this.scene.traverse((o) => {
        if (o.geometry && !o.geometry._shared) o.geometry.dispose();
      });
    this.scene = new T.Scene();
    const lvl = builder({ scene: this.scene, q: this.q, R: this.R });
    const fx = new FX(this.scene, lvl.world);
    const G = new Game({ scene: this.scene, camera: this.camera, world: lvl.world, fx, audio: this.audio, ui: this.ui, input: this.input, renderer: this.R });
    G.lvl = lvl;
    G.cones = new Cones(this.scene);
    this.G = G;
    this.stage = { id: placeId, lvl, G };
    this.hooks.clear();
    return this.stage;
  }
  hook(fn) {
    this.hooks.add(fn);
    return () => this.hooks.delete(fn);
  }
  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    const real = Math.min(0.25, (now - this.last) / 1000);
    this.last = now;
    this.simAcc += real;
    const steps = Math.min(5, Math.max(1, Math.round(this.simAcc / 0.034)));
    const dt = Math.min(0.05, this.simAcc / steps);
    this.simAcc = 0;
    const G = this.G;
    this.music.update(real);
    if (!G) return;
    for (let i = 0; i < steps; i++) {
      G.update(dt);
      G.cones.update(G, dt);
      for (const h of this.hooks) h(G.paused ? 0 : dt * G.slow, dt);
    }
    const R = this.R;
    R.post.fade.value = damp(R.post.fade.value, this.fadeTo || 0, 2, real);
    // the ear is the player, or the camera's centre when nobody is being played (narrative)
    this.audio.listener = G.player ? { x: G.player.x, z: G.player.z } : { x: G.cam.x, z: G.cam.z };
    const want = G.camSpan || 12.5;
    if (Math.abs(G.cam.span - want) > 0.05) G.cam.span = damp(G.cam.span, want, G.camSpanK || 0.8, real);
    const L = G.lvl.L;
    if (L && L.sun.castShadow) {
      const c = G.cam;
      const fx = c.x - Math.sin(c.yaw) * 7, fz = c.z - Math.cos(c.yaw) * 7;
      const y = G.world.height(fx, fz);
      L.sun.position.set(fx + L.dir[0] * 60, y + L.dir[1] * 60, fz + L.dir[2] * 60);
      L.sun.target.position.set(fx, y, fz);
      L.sun.target.updateMatrixWorld();
    }
    if (G.player && G.player.alive && !G.noFocus) {
      const [sx, sy] = G.project(G.player.x, G.player.y + 1, G.player.z);
      U.focus.value.set((sx / innerWidth) * R.w, (1 - sy / innerHeight) * R.h, G.player.y, (G.focusR || 95) * (R.h / innerHeight));
      // depth of a point 1.5 m in front of the soldier, toward the camera (orthographic: depth is linear)
      this.camera.getWorldDirection(_fd);
      const [, , nz] = G.project(G.player.x - _fd.x * 1.5, G.player.y + 1 - _fd.y * 1.5, G.player.z - _fd.z * 1.5);
      U.focusD.value = nz * 0.5 + 0.5;
    } else {
      U.focus.value.set(-9999, -9999, 0, 0);
      U.focusD.value = -1;
    }
    R.render(this.scene, this.camera, now / 1000);
    R.adapt(real);
    if (this.fpsEl) this.fpsEl.textContent = `${Math.round(R.fps)} fps · ${this.q.name} · res ${Math.round(R.dyn * 100)}% · ${R.r.info.render.calls} dc`;
  }
}
