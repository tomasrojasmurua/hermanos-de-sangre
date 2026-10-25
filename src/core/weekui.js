// Interfaz del modo base: el tablero de la semana (planificar con dos pulgares en horizontal),
// la cinta de días y los medidores mientras la semana se vive, y etiquetas sobre los hombres.
import { METERS } from "./week.js";
import { esc } from "../engine/ui.js";
import { stamp, meterTick } from "../engine/camp-audio.js";

const CSS = `
.wk{position:absolute;inset:0;z-index:22;display:grid;grid-template-columns:1fr min(36vw,300px);grid-template-rows:auto 1fr auto;gap:8px 12px;
  padding:calc(8px + var(--safe-t)) calc(12px + env(safe-area-inset-right,0px)) calc(8px + var(--safe-b)) calc(12px + env(safe-area-inset-left,0px));
  background:linear-gradient(90deg,rgba(14,12,9,.84),rgba(14,12,9,.6) 60%,rgba(14,12,9,.84));pointer-events:auto;color:#efe6d2;animation:wkIn .45s ease}
@keyframes wkIn{from{opacity:0}to{opacity:1}}
.wk .hd{grid-column:1/3;display:flex;align-items:center;gap:14px;min-width:0;padding-right:54px}
.wk .hd .t{flex:0 0 auto}
.wk .hd .t small{display:block;font:12px 'Special Elite',monospace;letter-spacing:.12em;text-transform:uppercase;color:#e3c27a}
.wk .hd .t b{display:block;font:400 22px/1 'IM Fell English SC',serif;color:#f4ecd9}
.wk .meters{flex:1;display:flex;gap:8px;justify-content:flex-end;min-width:0}
.mtr{flex:0 1 96px;min-width:60px}
.mtr span{display:flex;justify-content:space-between;gap:4px;font:600 12.5px 'Barlow Condensed',sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#d8cfbb;white-space:nowrap}
.mtr span em{font-style:normal;color:#f4ecd9}
.mtr span em s{text-decoration:none;color:#e3c27a}
.mtr i{display:block;position:relative;height:8px;margin-top:3px;background:rgba(255,255,255,.14);border-radius:4px;overflow:visible}
.mtr i b{position:absolute;left:0;top:0;bottom:0;border-radius:4px;background:#c9bd96;transition:width .5s}
.mtr i u{position:absolute;top:-4px;width:4px;height:16px;margin-left:-2px;background:#e3c27a;border-radius:1px;transition:left .35s;box-shadow:0 0 0 1px rgba(0,0,0,.6)}
.mtr.bad i b{background:#b8503f}.mtr.good i b{background:#8fae6a}
.mtr .pop{position:absolute;left:calc(100% + 4px);top:-5px;font:700 14px 'Barlow Condensed';animation:pop 1.6s ease forwards;pointer-events:none;text-shadow:0 1px 3px #000}
@keyframes pop{0%{opacity:0;transform:translateX(-4px)}20%{opacity:1;transform:none}80%{opacity:1}100%{opacity:0}}
.wk .board{display:grid;grid-template-columns:repeat(var(--n),1fr);gap:6px;min-height:0}
.day{display:grid;grid-template-rows:auto .62fr 1fr auto;gap:5px;min-width:0}
.day h4{margin:0;text-align:center;font:600 13px 'Barlow Condensed';letter-spacing:.12em;text-transform:uppercase;color:#d8cfbb}
.cell{position:relative;border-radius:3px;padding:5px 5px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;min-height:0;
  font:400 14.5px/1.05 'IM Fell English',Georgia,serif;color:#2a241b;background:radial-gradient(ellipse at 30% 20%,#f1eadb,#d9cdb3);box-shadow:0 2px 6px rgba(0,0,0,.45);overflow:hidden}
.cell small{display:block;margin-top:3px;font:12px 'Special Elite',monospace;letter-spacing:.02em;color:#6d6252}
.cell .ic{font-size:19px;line-height:1;margin-bottom:2px}
.cell.fixed{background:rgba(201,188,159,.55);color:#2a241b;box-shadow:none;font-size:13.5px}
.cell.fixed small{color:#3d352a;margin-bottom:12px}
.cell.fixed::after{content:'SOBEL';position:absolute;right:2px;bottom:3px;transform:rotate(-12deg);font:700 10.5px 'Special Elite';letter-spacing:.08em;color:#a3302a;border:1.5px solid #a3302a;padding:0 3px;opacity:.8}
.cell.free{cursor:pointer;border:2px dashed rgba(35,29,22,.45);background:rgba(241,234,219,.92)}
.cell.free.empty{color:#6d6252}
.cell.free.sel{outline:3px solid #e3c27a;outline-offset:1px;border-style:solid}
.cell.none{background:rgba(241,234,219,.18);box-shadow:none;color:#bfb6a2}
.night{margin:0;text-align:center;font:600 12px/1.1 'Barlow Condensed';letter-spacing:.04em;color:#b9c4d8;min-height:14px}
.wk .pal{grid-row:2/4;grid-column:2;display:flex;flex-direction:column;gap:6px;min-height:0}
.act{appearance:none;display:grid;grid-template-columns:30px 1fr;align-items:center;gap:2px 8px;text-align:left;padding:5px 10px;min-height:46px;border-radius:3px;cursor:pointer;
  border:1px solid rgba(241,234,219,.35);background:rgba(241,234,219,.08);color:#f4ecd9}
.act .ic{grid-row:1/3;font-size:21px;text-align:center}
.act b{font:400 17px/1 'IM Fell English SC',serif}
.act small{font:13px/1.15 'Barlow Condensed',sans-serif;letter-spacing:.02em;color:#d8cfbb}
.act:active,.act.hit{background:rgba(227,194,122,.28)}
.wk .go{margin-top:auto;min-height:50px;font:600 17px 'Barlow Condensed';letter-spacing:.08em;text-transform:uppercase;border:0;border-radius:2px;cursor:pointer;background:#e9e0cb;color:#1d1a16;box-shadow:0 3px 0 #8a7c5c}
.wk .go.off{opacity:.4}
.wk .hint{grid-column:1;font:15px 'IM Fell English',serif;font-style:italic;color:#e4dccb;align-self:center}
/* during the week: a ribbon of days, the meters and a fast-forward button */
.wkh{position:absolute;inset:0;z-index:12;pointer-events:none}
.wkh .rib{position:absolute;left:calc(12px + env(safe-area-inset-left,0px));top:calc(8px + var(--safe-t));display:flex;gap:4px;pointer-events:none}
.wkh .rib i{font:600 12px 'Barlow Condensed';letter-spacing:.1em;text-transform:uppercase;color:#d8cfbb;background:rgba(14,12,9,.6);padding:4px 7px;border-radius:2px;font-style:normal}
.wkh .rib i.now{background:#e9e0cb;color:#1d1a16}.wkh .rib i.past{opacity:.5}
.wkh .blk{position:absolute;left:calc(12px + env(safe-area-inset-left,0px));top:calc(36px + var(--safe-t));max-width:46vw;background:rgba(14,12,9,.62);padding:5px 10px;border-radius:2px;color:#f4ecd9}
.wkh .blk small{display:block;font:11.5px 'Special Elite';letter-spacing:.1em;text-transform:uppercase;color:#e3c27a}
.wkh .blk b{font:400 19px/1.1 'IM Fell English SC',serif}
.wkh .meters{position:absolute;right:calc(64px + env(safe-area-inset-right,0px));top:calc(10px + var(--safe-t));display:flex;gap:8px;background:rgba(14,12,9,.5);padding:5px 9px;border-radius:3px;opacity:.88}
.wkh .meters .mtr{flex:0 0 74px;min-width:0}
.wkh .ff{position:absolute;right:calc(14px + env(safe-area-inset-right,0px));bottom:calc(14px + var(--safe-b));width:58px;height:58px;border-radius:50%;pointer-events:auto;cursor:pointer;
  border:2px solid rgba(241,234,219,.5);background:rgba(14,12,9,.6);color:#f4ecd9;font:600 15px/1 'Barlow Condensed';letter-spacing:.02em}
.wkh .ff.on{background:#e9e0cb;color:#1d1a16}
.wkh .ff small{display:block;font:11px 'Barlow Condensed';margin-top:2px}
.wtag{position:absolute;transform:translate(-50%,-100%);font:600 13px 'Barlow Condensed';letter-spacing:.04em;padding:2px 8px;border-radius:10px;white-space:nowrap;pointer-events:none;
  background:rgba(14,12,9,.7);color:#f4ecd9}
.wtag.no{background:#a3302a;color:#fff;border:1.5px solid #ffd7c9}
`;
let styled = false;
function style() {
  if (styled) return;
  styled = true;
  const s = document.createElement("style");
  s.textContent = CSS;
  document.head.appendChild(s);
}

function meterHTML() {
  return METERS.map((m) => `<div class="mtr" data-m="${m.id}"><span>${m.label}<em></em></span><i><b></b><u></u></i></div>`).join("");
}
function setMeters(root, st, proj) {
  for (const m of METERS) {
    const e = root.querySelector(`.mtr[data-m="${m.id}"]`);
    if (!e) continue;
    const v = Math.max(0, Math.min(100, st[m.id]));
    e.querySelector("b").style.width = v.toFixed(1) + "%";
    const u = e.querySelector("u");
    if (proj) {
      const pv = Math.max(0, Math.min(100, proj[m.id]));
      u.style.display = "";
      u.style.left = pv.toFixed(1) + "%";
      // the number reads «now → at the end of the week»
      e.querySelector("em").innerHTML = Math.round(pv) === Math.round(v) ? `${Math.round(v)}` : `${Math.round(v)}<s>→${Math.round(pv)}</s>`;
    } else {
      u.style.display = "none";
      e.querySelector("em").textContent = Math.round(v);
    }
    const goodness = m.good > 0 ? v : 100 - v;
    e.classList.toggle("bad", goodness < 35);
    e.classList.toggle("good", goodness > 70);
  }
}
export function popMeters(root, d, audio) {
  // numbers pop only over the live scene, never under a paper card
  if (document.querySelector("#cards .dim")) return;
  let any = 0, score = 0;
  for (const m of METERS) {
    const v = d[m.id];
    if (!v || Math.abs(v) < 0.5) continue;
    const e = root.querySelector(`.mtr[data-m="${m.id}"] i`);
    if (!e) continue;
    const p = document.createElement("div");
    p.className = "pop";
    const good = Math.sign(v) === m.good;
    p.style.color = good ? "#b7d98f" : "#f0a08f";
    p.textContent = (v > 0 ? "+" : "−") + Math.abs(Math.round(v));
    e.appendChild(p);
    setTimeout(() => p.remove(), 1700);
    any++;
    score += good ? 1 : -1;
  }
  if (any && audio) meterTick(audio, score >= 0);
}

// ---- the planner ----------------------------------------------------------------------------------
// resolves with the plan {dayKey: actId} once every free afternoon has something
export function planWeek(ui, week, { title, kicker, hint, choices, audio }) {
  style();
  return new Promise((resolve) => {
    const w = document.createElement("div");
    w.className = "wk";
    const days = week.days;
    w.innerHTML = `
      <div class="hd"><div class="t"><small>${esc(kicker)}</small><b>${esc(title)}</b></div><div class="meters">${meterHTML()}</div></div>
      <div class="board" style="--n:${days.length}">${days.map((d) => `<div class="day" data-k="${d.key}"><h4>${esc(d.short || d.label)}</h4>${cellHTML(d, "am")}${cellHTML(d, "pm")}<p class="night">${esc(d.nightLabel || "")}</p></div>`).join("")}</div>
      <div class="pal">${choices.map((id) => { const a = week.acts[id]; return `<button class="act" data-a="${id}"><span class="ic">${a.icon}</span><b>${esc(a.label)}</b><small>${esc(a.hint)}</small></button>`; }).join("")}
        <button class="go off">Empezar la semana</button></div>
      <div class="hint">${esc(hint || "")}</div>`;
    function cellHTML(d, half) {
      const s = d[half];
      if (s === "free") return `<div class="cell free empty" data-d="${d.key}" role="button"><span class="ic">·</span>Tarde libre<small>elige</small></div>`;
      if (!s) return `<div class="cell none">${half === "am" ? "" : "—"}</div>`;
      const a = week.acts[s.act];
      return `<div class="cell fixed"><span class="ic">${a.icon}</span>${esc(a.label)}<small>${esc(a.sub || (half === "am" ? "mañana" : "tarde"))}</small></div>`;
    }
    const free = week.freeDays().map((d) => d.key);
    let sel = free.find((k) => !week.plan[k]) || free[0];
    const done = () => free.every((k) => week.plan[k]);
    const refresh = () => {
      for (const k of free) {
        const c = w.querySelector(`.cell.free[data-d="${k}"]`);
        const a = week.acts[week.plan[k]];
        c.classList.toggle("empty", !a);
        c.classList.toggle("sel", k === sel && !done());
        c.innerHTML = a ? `<span class="ic">${a.icon}</span>${esc(a.label)}<small>tarde</small>` : `<span class="ic">·</span>Tarde libre<small>elige</small>`;
      }
      w.querySelector(".go").classList.toggle("off", !done());
      setMeters(w, week.stats(), week.project());
    };
    w.querySelectorAll(".cell.free").forEach((c) => (c.onclick = () => {
      sel = c.dataset.d;
      audio?.paper();
      audio?.vibrate(8);
      w.querySelectorAll(".cell.free").forEach((x) => x.classList.toggle("sel", x.dataset.d === sel));
    }));
    w.querySelectorAll(".act").forEach((b) => (b.onclick = () => {
      if (!sel) sel = free.find((k) => !week.plan[k]) || free[free.length - 1];
      const was = done();
      week.plan[sel] = b.dataset.a;
      audio?.pencil();
      audio?.vibrate(8);
      b.classList.remove("hit");
      void b.offsetWidth;
      b.classList.add("hit");
      setTimeout(() => b.classList.remove("hit"), 200);
      // next empty afternoon, so five taps fill the week
      const i = free.indexOf(sel);
      sel = free.slice(i + 1).concat(free.slice(0, i)).find((k) => !week.plan[k]) || sel;
      refresh();
      if (!was && done() && audio) stamp(audio, 1.3); // the schedule is complete: Sobel would sign it
    }));
    const go = w.querySelector(".go");
    go.onclick = () => {
      if (!done()) {
        // not yet: point at the first empty afternoon
        audio?.vibrate([20, 40, 20]);
        sel = free.find((k) => !week.plan[k]);
        refresh();
        const c = w.querySelector(`.cell.free[data-d="${sel}"]`);
        c.animate([{ transform: "translateX(0)" }, { transform: "translateX(-4px)" }, { transform: "translateX(4px)" }, { transform: "translateX(0)" }], { duration: 260 });
        return;
      }
      removeEventListener("keydown", key);
      audio?.paper();
      w.remove();
      resolve({ ...week.plan });
    };
    // keyboard: 1–5 picks an activity, Enter starts (desktop)
    const key = (e) => {
      const n = +e.key;
      if (n >= 1 && n <= choices.length) w.querySelectorAll(".act")[n - 1].click();
      if (e.key === "Enter") go.click();
    };
    addEventListener("keydown", key);
    ui.cards.appendChild(w);
    refresh();
    // Sobel's mornings land on the board one stamp at a time
    if (audio) w.querySelectorAll(".cell.fixed").forEach((_, i) => setTimeout(() => stamp(audio, 0.6), 250 + i * 120));
  });
}

// ---- the HUD while the week plays -----------------------------------------------------------------
const SPEEDS = [1, 3, 8];
export class WeekHUD {
  constructor(ui, week, audio) {
    style();
    this.week = week;
    this.audio = audio;
    this.speed = 1;
    const e = (this.el = document.createElement("div"));
    e.className = "wkh";
    e.innerHTML = `<div class="rib">${week.days.map((d) => `<i data-k="${d.key}">${esc(d.short || d.label.slice(0, 3))}</i>`).join("")}</div>
      <div class="blk"><small></small><b></b></div>
      <div class="meters">${meterHTML()}</div>
      <button class="ff" aria-label="Acelerar">⏩<small>×1</small></button>`;
    e.querySelector(".ff").onclick = () => this.toggle();
    this._key = (ev) => ev.code === "KeyF" && this.toggle();
    addEventListener("keydown", this._key);
    ui.root.appendChild(e);
    this.tags = new Map();
    this.update();
  }
  // ×1 → ×3 → ×8 (skip to the next decision) → ×1
  toggle() {
    this.setSpeed(SPEEDS[(SPEEDS.indexOf(this.speed) + 1) % SPEEDS.length]);
  }
  setSpeed(v) {
    this.speed = v;
    const f = this.el.querySelector(".ff");
    f.classList.toggle("on", v > 1);
    f.innerHTML = `${v > 3 ? "⏭" : "⏩"}<small>×${v}</small>`;
  }
  day(key, small, big) {
    let past = true;
    for (const i of this.el.querySelectorAll(".rib i")) {
      const now = i.dataset.k === key;
      if (now) past = false;
      i.classList.toggle("now", now);
      i.classList.toggle("past", past && !now);
    }
    this.el.querySelector(".blk small").textContent = small || "";
    this.el.querySelector(".blk b").textContent = big || "";
  }
  update(delta) {
    setMeters(this.el, this.week.stats());
    if (delta) popMeters(this.el, delta, this.speed === 1 ? this.audio : null);
  }
  // labels over men's heads (the game HUD is hidden in this mode)
  tag(key, s, text, cls = "") {
    let t = this.tags.get(key);
    if (!t) {
      t = { el: document.createElement("div"), s };
      this.el.appendChild(t.el);
      this.tags.set(key, t);
    }
    t.s = s;
    t.el.className = "wtag " + cls;
    t.el.textContent = text;
  }
  untag(key) {
    const t = this.tags.get(key);
    if (t) t.el.remove();
    this.tags.delete(key);
  }
  clearTags() {
    for (const k of [...this.tags.keys()]) this.untag(k);
  }
  placeTags(G) {
    for (const t of this.tags.values()) {
      const [x, y] = G.project(t.s.x, t.s.y + 2.15, t.s.z);
      t.el.style.left = x.toFixed(0) + "px";
      t.el.style.top = y.toFixed(0) + "px";
    }
  }
  remove() {
    removeEventListener("keydown", this._key);
    this.el.remove();
  }
}
