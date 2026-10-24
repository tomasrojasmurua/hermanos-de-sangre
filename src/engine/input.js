// Touch controls: floating joystick on the left, buttons on the right. Keyboard fallback for desktop.
import { clamp } from "./util.js";

export class Input {
  constructor(root) {
    this.mx = 0; // -1..1 screen-space stick
    this.my = 0;
    this.held = {}; // button -> bool
    this.pressed = {}; // edge-triggered this frame
    this.stick = null;
    this.keys = {};
    const base = document.createElement("div");
    base.className = "stick hidden";
    base.innerHTML = '<div class="knob"></div>';
    root.appendChild(base);
    this.stickEl = base;
    this.knob = base.firstChild;
    this.R = 52;
    const zone = document.createElement("div");
    zone.className = "stickzone";
    root.appendChild(zone);
    this.zone = zone;
    zone.addEventListener("pointerdown", (e) => this._down(e));
    window.addEventListener("pointermove", (e) => this._move(e), { passive: true });
    window.addEventListener("pointerup", (e) => this._up(e));
    window.addEventListener("pointercancel", (e) => this._up(e));
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      const b = KEYMAP[e.code];
      if (b) this.press(b);
    });
    window.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
      const b = KEYMAP[e.code];
      if (b) this.release(b);
    });
  }
  _down(e) {
    if (this.stick) return;
    e.preventDefault();
    this.stick = { id: e.pointerId, x: e.clientX, y: e.clientY };
    this.stickEl.classList.remove("hidden");
    this.stickEl.style.transform = `translate(${e.clientX - this.R}px, ${e.clientY - this.R}px)`;
    this.knob.style.transform = "translate(0px,0px)";
    this.mx = this.my = 0;
  }
  _move(e) {
    const s = this.stick;
    if (!s || e.pointerId !== s.id) return;
    let dx = e.clientX - s.x, dy = e.clientY - s.y;
    const l = Math.hypot(dx, dy);
    if (l > this.R) {
      // drag the base along so the stick never "runs out"
      const k = (l - this.R) / l;
      s.x += dx * k;
      s.y += dy * k;
      dx = e.clientX - s.x;
      dy = e.clientY - s.y;
      this.stickEl.style.transform = `translate(${s.x - this.R}px, ${s.y - this.R}px)`;
    }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    this.mx = clamp(dx / this.R, -1, 1);
    this.my = clamp(dy / this.R, -1, 1);
  }
  _up(e) {
    if (!this.stick || e.pointerId !== this.stick.id) return;
    this.stick = null;
    this.mx = this.my = 0;
    this.stickEl.classList.add("hidden");
  }
  press(b) {
    if (!this.held[b]) this.pressed[b] = true;
    this.held[b] = true;
  }
  release(b) {
    this.held[b] = false;
  }
  // movement in screen space, merged with keyboard
  axis() {
    let x = this.mx, y = this.my;
    const k = this.keys;
    if (k.KeyA || k.ArrowLeft) x -= 1;
    if (k.KeyD || k.ArrowRight) x += 1;
    if (k.KeyW || k.ArrowUp) y -= 1;
    if (k.KeyS || k.ArrowDown) y += 1;
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    return { x, y, l: Math.min(1, l) };
  }
  consume(b) {
    const v = !!this.pressed[b];
    this.pressed[b] = false;
    return v;
  }
  endFrame() {
    this.pressed = {};
  }
}

const KEYMAP = { Space: "fire", KeyJ: "fire", KeyC: "crouch", KeyG: "grenade", KeyH: "heal", KeyE: "act", KeyR: "reload", Enter: "act", KeyQ: "call" };
