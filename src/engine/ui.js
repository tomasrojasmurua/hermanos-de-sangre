// HUD and paper cards. DOM on top of the canvas; everything sized for thumbs (min 44px targets).
import { clamp } from "./util.js";

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const ICON = {
  fire: '<svg viewBox="0 0 24 24"><path d="M3 13h11l2-2h5v3h-4l-1 1v4h-3v-3H3z" fill="currentColor"/></svg>',
  knife: '<svg viewBox="0 0 24 24"><path d="M4 20 15 9l2 2L6 22zM15 9l5-6 1 1-4 7z" fill="currentColor"/></svg>',
  crouch: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="2.4" fill="currentColor"/><path d="M8 21l2-6-2-3 3-3h3l2 4h3v2h-4l-1-2-2 2 2 3-1 3z" fill="currentColor"/></svg>',
  grenade: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="14" rx="5.5" ry="6.5" fill="currentColor"/><rect x="10" y="4" width="4" height="4" rx="1" fill="currentColor"/><path d="M14 5h4v2h-3" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>',
  bandage: '<svg viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="8" rx="4" fill="currentColor" transform="rotate(-35 12 12)"/><path d="M10 12h4M12 10v4" stroke="#222" stroke-width="1.8"/></svg>',
  call: '<svg viewBox="0 0 24 24"><path d="M6 15c0-4 3-7 6-7s6 3 6 7" stroke="currentColor" stroke-width="2" fill="none"/><rect x="9" y="14" width="6" height="5" rx="1" fill="currentColor"/><path d="M3 9l2 1M21 9l-2 1M12 3v2" stroke="currentColor" stroke-width="1.6"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" fill="currentColor"/><rect x="14" y="5" width="4" height="14" fill="currentColor"/></svg>',
};

export function portraitSVG(p = {}) {
  const skin = p.skin || "#d6a07c", helm = p.helmet || "#4d5136", paint = p.paint === false ? "" : `<path d="M15 33 L45 30" stroke="#2b2a22" stroke-width="3" opacity=".75"/>`;
  return `<svg viewBox="0 0 60 60"><rect width="60" height="60" fill="${p.bg || "#2a2b25"}"/>
  <rect x="17" y="46" width="26" height="14" fill="${p.coat || "#77704f"}"/>
  <rect x="25" y="40" width="10" height="8" fill="${skin}"/>
  <rect x="18" y="20" width="24" height="24" rx="4" fill="${skin}"/>
  <rect x="22" y="29" width="4" height="3" fill="#1a1715"/><rect x="34" y="29" width="4" height="3" fill="#1a1715"/>
  <rect x="27" y="38" width="7" height="2" fill="#7a4a3a"/>${paint}
  <path d="M12 26 Q30 2 48 26 Z" fill="${helm}"/><rect x="11" y="24" width="38" height="4" rx="2" fill="${helm}"/>
  ${p.rank === "lt" ? '<rect x="28" y="9" width="4" height="9" fill="#e8e2d0"/>' : p.rank === "sgt" ? '<rect x="24" y="12" width="12" height="3" fill="#e8e2d0"/>' : ""}</svg>`;
}

export class UI {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
    <div id="hud" class="hidden">
      <div id="who"><div class="por"></div><div class="info"><b class="nm"></b><span class="rk"></span>
        <div class="hp"><i></i></div><div class="status"></div></div></div>
      <button id="pauseBtn" class="round" aria-label="Pausa">${ICON.pause}</button>
      <div id="obj"><span class="arrow">➤</span><span class="txt"></span><span class="m"></span></div>
      <div id="marks"></div>
      <div id="sub" class="hidden"><b></b><span></span></div>
      <div id="btns">
        <button class="b act hidden" data-b="act"><span class="lbl"></span></button>
        <button class="b call hidden" data-b="call">${ICON.call}<small>Chicharra</small></button>
        <button class="b heal" data-b="heal">${ICON.bandage}<em class="n">0</em></button>
        <button class="b nade" data-b="grenade">${ICON.grenade}<em class="n">0</em></button>
        <button class="b crouch" data-b="crouch">${ICON.crouch}</button>
        <button class="b fire" data-b="fire"><span class="ic">${ICON.fire}</span><span class="ammo"></span><i class="rl"></i></button>
      </div>
      <div id="toast"></div>
      <div id="qte" class="hidden"><div class="lbl"><span></span><i class="bar"></i></div><button class="b" data-b="qte"><span class="t2"></span></button></div>
      <div class="ghost"><i></i><span>Arrastra para moverte</span></div>
    </div>
    <div id="cards"></div>
    <div id="fade"></div>`;
    this.hud = $("#hud", root);
    this.btns = $("#btns", root);
    this.marks = $("#marks", root);
    this.sub = $("#sub", root);
    this.obj = $("#obj", root);
    this.cards = $("#cards", root);
    this.toastEl = $("#toast", root);
    this.fadeEl = $("#fade", root);
    this.qteEl = $("#qte", root);
    this._marks = new Map();
    this.input = null;
    this.subQ = [];
    this.subT = 0;
  }
  bindInput(input) {
    this.input = input;
    const handle = (e, down) => {
      const b = e.target.closest("[data-b]");
      if (!b) return;
      e.preventDefault();
      const k = b.dataset.b;
      if (down) {
        input.press(k);
        b.classList.add("down");
        b.setPointerCapture?.(e.pointerId);
      } else {
        input.release(k);
        b.classList.remove("down");
      }
    };
    for (const zone of [this.btns, this.qteEl]) {
      zone.addEventListener("pointerdown", (e) => handle(e, true));
      zone.addEventListener("pointerup", (e) => handle(e, false));
      zone.addEventListener("pointercancel", (e) => handle(e, false));
      zone.addEventListener("contextmenu", (e) => e.preventDefault());
    }
    $("#pauseBtn", this.root).addEventListener("click", () => this.onPause && this.onPause());
  }
  show(on = true) {
    this.hud.classList.toggle("hidden", !on);
  }
  setWho(s) {
    $("#who .por", this.root).innerHTML = portraitSVG(s.portrait);
    $("#who .nm", this.root).textContent = s.name;
    $("#who .rk", this.root).textContent = s.rank || "";
  }
  setHealth(h, bleeding, healing) {
    const i = $("#who .hp i", this.root);
    i.style.transform = `scaleX(${clamp(h / 100, 0, 1)})`;
    i.parentElement.classList.toggle("low", h < 35);
    const st = $("#who .status", this.root);
    const t = healing ? "Vendándose…" : bleeding ? "Sangra" : "";
    if (st.textContent !== t) st.textContent = t;
    st.classList.toggle("bleed", !!bleeding && !healing);
  }
  setWeapon(kind, clip, reserve, reloading) {
    const f = $(".b.fire", this.btns);
    const ic = kind === "knife" ? ICON.knife : ICON.fire;
    if (f._k !== kind) {
      f.querySelector(".ic").innerHTML = ic;
      f._k = kind;
    }
    const a = kind === "knife" ? "" : `${clip}<small>/${reserve}</small>`;
    const am = f.querySelector(".ammo");
    if (am._v !== a) {
      am.innerHTML = a;
      am._v = a;
    }
    f.classList.toggle("empty", kind !== "knife" && clip === 0 && reserve === 0);
    f.classList.toggle("reloading", !!reloading);
  }
  setInv(gren, band, canCall) {
    const n = $(".b.nade .n", this.btns), h = $(".b.heal .n", this.btns);
    if (n.textContent !== String(gren)) n.textContent = gren;
    if (h.textContent !== String(band)) h.textContent = band;
    $(".b.nade", this.btns).classList.toggle("off", gren <= 0);
    $(".b.heal", this.btns).classList.toggle("off", band <= 0);
    $(".b.call", this.btns).classList.toggle("hidden", !canCall);
  }
  setCrouch(on) {
    $(".b.crouch", this.btns).classList.toggle("on", on);
  }
  setAct(label) {
    const a = $(".b.act", this.btns);
    if (!label) {
      a.classList.add("hidden");
      return;
    }
    a.classList.remove("hidden");
    const l = a.querySelector(".lbl");
    if (l.textContent !== label) l.textContent = label;
  }
  setObjective(text, distM, angScreen) {
    if (!text) {
      this.obj.classList.add("hidden");
      return;
    }
    this.obj.classList.remove("hidden");
    const t = this.obj.querySelector(".txt");
    if (t.textContent !== text) {
      t.textContent = text;
      this.obj.classList.remove("new");
      void this.obj.offsetWidth;
      this.obj.classList.add("new");
    }
    const a = this.obj.querySelector(".arrow"), m = this.obj.querySelector(".m");
    if (distM == null) {
      a.style.visibility = "hidden";
      m.textContent = "";
    } else {
      a.style.visibility = "visible";
      a.style.transform = `rotate(${angScreen}rad)`;
      m.textContent = distM < 4 ? "" : Math.round(distM) + " m";
    }
  }
  // world-anchored markers: key -> {x,y (screen), text, cls}
  ghostOff() {
    const g = this.root.querySelector(".ghost");
    if (g && !g.classList.contains("off")) g.classList.add("off");
  }
  mark(key, sx, sy, html, cls = "") {
    if (cls.startsWith("ally")) sx = Math.max(34, Math.min(innerWidth - 34, sx));
    let m = this._marks.get(key);
    if (!m) {
      m = el("div", "mk " + cls);
      this.marks.appendChild(m);
      this._marks.set(key, m);
    }
    if (m._h !== html) {
      m.innerHTML = html;
      m._h = html;
    }
    if (m._c !== cls) {
      m.className = "mk " + cls;
      m._c = cls;
    }
    m.style.transform = `translate(${sx | 0}px, ${sy | 0}px) translate(-50%,-100%)`;
    m._seen = true;
  }
  sweepMarks() {
    for (const [k, m] of this._marks) {
      if (!m._seen) {
        m.remove();
        this._marks.delete(k);
      } else m._seen = false;
    }
  }
  // subtitles: queue of {who, text, dur}
  say(who, text, dur) {
    this.subQ.push({ who, text, dur: dur || Math.max(2.4, text.length * 0.065) });
  }
  sayNow(who, text, dur) {
    this.subQ = [];
    this.subT = 0;
    this.say(who, text, dur);
  }
  updateSubs(dt) {
    if (this.subT > 0) {
      this.subT -= dt;
      if (this.subT <= 0) this.sub.classList.add("hidden");
    }
    if (this.subT <= 0 && this.subQ.length) {
      const s = this.subQ.shift();
      this.sub.querySelector("b").textContent = s.who ? s.who : "";
      this.sub.querySelector("b").style.display = s.who ? "" : "none";
      this.sub.querySelector("span").textContent = s.text;
      this.sub.classList.remove("hidden");
      this.sub.classList.remove("pop");
      void this.sub.offsetWidth;
      this.sub.classList.add("pop");
      this.subT = s.dur;
    }
  }
  get talking() {
    return this.subT > 0 || this.subQ.length > 0;
  }
  toast(t, ms = 2400) {
    this.toastEl.textContent = t;
    this.toastEl.classList.add("on");
    clearTimeout(this._tt);
    this._tt = setTimeout(() => this.toastEl.classList.remove("on"), ms);
  }
  fade(on, ms = 900) {
    this.fadeEl.style.transitionDuration = ms + "ms";
    this.fadeEl.style.opacity = on ? 1 : 0;
    return new Promise((r) => setTimeout(r, ms));
  }
  qte(label, secs, short) {
    this.qteEl.classList.remove("hidden");
    this.qteEl.querySelector(".lbl span").textContent = label;
    this.qteEl.querySelector(".t2").textContent = short || "\u00a1YA!";
    const bar = this.qteEl.querySelector(".bar");
    bar.style.transition = "none";
    bar.style.transform = "scaleX(1)";
    void bar.offsetWidth;
    bar.style.transition = `transform ${secs}s linear`;
    bar.style.transform = "scaleX(0)";
  }
  qteHide() {
    this.qteEl.classList.add("hidden");
  }
  // paper card. o: {kicker, title, text (string|array), quote:{t,src}, choices:[{label,sub,value}], next:"Continuar", cls}
  card(o) {
    return new Promise((resolve) => {
      const w = el("div", "dim " + (o.cls || ""));
      const pages = Array.isArray(o.text) ? o.text : [o.text || ""];
      let pi = 0;
      const render = () => {
        const last = pi === pages.length - 1;
        w.innerHTML = `<div class="paper">
          ${o.kicker ? `<div class="kicker">${esc(o.kicker)}</div>` : ""}
          ${o.title ? `<h3>${esc(o.title)}</h3>` : ""}
          <p>${esc(pages[pi])}</p>
          ${last && o.quote ? `<blockquote>${esc(o.quote.t)}<cite>${esc(o.quote.src)}</cite></blockquote>` : ""}
          ${last && o.choices ? `<div class="choices">${o.choices.map((c, i) => `<button class="choice" data-i="${i}" style="animation-delay:${0.1 + i * 0.12}s"><b>${esc(c.label)}</b>${c.sub ? `<small>${esc(c.sub)}</small>` : ""}</button>`).join("")}</div>` : `<button class="next">${esc(last ? o.next || "Continuar" : "Seguir")}</button>`}
          ${pages.length > 1 ? `<div class="pager">${pages.map((_, i) => `<i class="${i === pi ? "on" : ""}"></i>`).join("")}</div>` : ""}
        </div>`;
        const nx = w.querySelector(".next");
        if (nx)
          nx.onclick = () => {
            if (!last) {
              pi++;
              render();
            } else {
              w.remove();
              resolve(null);
            }
          };
        w.querySelectorAll(".choice").forEach((b) => (b.onclick = () => {
          w.remove();
          resolve(o.choices[+b.dataset.i].value ?? +b.dataset.i);
        }));
      };
      render();
      this.cards.appendChild(w);
    });
  }
  // chapter title over the live scene
  async chapter(kicker, title, sub, ms = 4200) {
    const w = el("div", "chap", `<div class="k">${esc(kicker)}</div><h2>${esc(title)}</h2><p>${esc(sub)}</p>`);
    this.cards.appendChild(w);
    await new Promise((r) => setTimeout(r, ms));
    w.classList.add("out");
    setTimeout(() => w.remove(), 1200);
  }
  flashHurt() {
    this.hud.classList.remove("hurt");
    void this.hud.offsetWidth;
    this.hud.classList.add("hurt");
  }
}
