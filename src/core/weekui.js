// Interfaz del modo base: el tablero de la semana (planificar con dos pulgares en horizontal),
// la cinta de días y los medidores mientras la semana se vive, y etiquetas sobre los hombres.
import { METERS } from "./week.js";
import { esc } from "../engine/ui.js";

const CSS = `
.wk{position:absolute;inset:0;z-index:22;display:grid;grid-template-columns:1fr min(36vw,300px);grid-template-rows:auto 1fr auto;gap:8px 12px;
  padding:calc(8px + var(--safe-t)) calc(12px + env(safe-area-inset-right,0px)) calc(8px + var(--safe-b)) calc(12px + env(safe-area-inset-left,0px));
  background:linear-gradient(90deg,rgba(14,12,9,.82),rgba(14,12,9,.55) 60%,rgba(14,12,9,.82));pointer-events:auto;color:#efe6d2;animation:wkIn .45s ease}
@keyframes wkIn{from{opacity:0}to{opacity:1}}
.wk .hd{grid-column:1/3;display:flex;align-items:center;gap:14px;min-width:0}
.wk .hd .t{flex:0 0 auto}
.wk .hd .t small{display:block;font:12px 'Special Elite',monospace;letter-spacing:.12em;text-transform:uppercase;color:#e3c27a}
.wk .hd .t b{display:block;font:400 22px/1 'IM Fell English SC',serif;color:#f4ecd9}
.wk .meters{flex:1;display:flex;gap:8px;justify-content:flex-end;min-width:0}
.mtr{flex:0 1 92px;min-width:58px}
.mtr span{display:flex;justify-content:space-between;font:600 12px 'Barlow Condensed',sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#d8cfbb}
.mtr span em{font-style:normal;color:#f4ecd9}
.mtr i{display:block;position:relative;height:7px;margin-top:3px;background:rgba(255,255,255,.14);border-radius:4px;overflow:visible}
.mtr i b{position:absolute;left:0;top:0;bottom:0;border-radius:4px;background:#c9bd96;transition:width .5s}
.mtr i u{position:absolute;top:-3px;width:3px;height:13px;margin-left:-1px;background:#f4ecd9;border-radius:1px;transition:left .35s;box-shadow:0 0 0 1px rgba(0,0,0,.5)}
.mtr.bad i b{background:#b8503f}.mtr.good i b{background:#8fae6a}
.mtr .pop{position:absolute;right:0;top:-18px;font:700 13px 'Barlow Condensed';animation:pop 1.6s ease forwards;pointer-events:none}
@keyframes pop{0%{opacity:0;transform:translateY(6px)}20%{opacity:1;transform:none}80%{opacity:1}100%{opacity:0;transform:translateY(-6px)}}
.wk .board{display:grid;grid-template-columns:repeat(var(--n),1fr);gap:6px;min-height:0}
.day{display:grid;grid-template-rows:auto 1fr 1fr;gap:5px;min-width:0}
.day h4{margin:0;text-align:center;font:600 13px 'Barlow Condensed';letter-spacing:.12em;text-transform:uppercase;color:#d8cfbb}
.cell{position:relative;border-radius:3px;padding:6px 5px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;min-height:0;
  font:400 14px/1.05 'IM Fell English',Georgia,serif;color:#2a241b;background:radial-gradient(ellipse at 30% 20%,#f1eadb,#d9cdb3);box-shadow:0 2px 6px rgba(0,0,0,.45);overflow:hidden}
.cell small{display:block;margin-top:3px;font:11px 'Special Elite',monospace;letter-spacing:.04em;color:#6d6252}
.cell .ic{font-size:20px;line-height:1;margin-bottom:3px}
.cell.fixed{background:radial-gradient(ellipse at 30% 20%,#e6dcc6,#c9bc9f)}
.cell.fixed::after{content:'SOBEL';position:absolute;right:-6px;bottom:6px;transform:rotate(-14deg);font:700 10px 'Special Elite';letter-spacing:.1em;color:#a3302a;border:1.5px solid #a3302a;padding:1px 4px;opacity:.75}
.cell.fixed.cmd::after{content:var(--stamp)}
.cell.free{cursor:pointer;border:2px dashed rgba(35,29,22,.45);background:rgba(241,234,219,.82)}
.cell.free.empty{color:#6d6252}
.cell.free.sel{outline:3px solid #e3c27a;outline-offset:1px;border-style:solid}
.cell.away::before{content:'Winters: ' attr(data-away);position:absolute;left:0;right:0;top:0;background:#7b2a22;color:#f4ecd9;font:600 10px 'Barlow Condensed';letter-spacing:.06em;padding:1px 0}
.cell.none{background:rgba(241,234,219,.18);box-shadow:none;color:#bfb6a2}
.cell.done{opacity:.45}.cell.now{outline:3px solid #e3c27a}
.wk .pal{grid-row:2/4;grid-column:2;display:flex;flex-direction:column;gap:6px;min-height:0}
.act{appearance:none;display:grid;grid-template-columns:30px 1fr;align-items:center;gap:2px 8px;text-align:left;padding:5px 10px;min-height:46px;border-radius:3px;cursor:pointer;
  border:1px solid rgba(241,234,219,.35);background:rgba(241,234,219,.08);color:#f4ecd9}
.act .ic{grid-row:1/3;font-size:21px;text-align:center}
.act b{font:400 17px/1 'IM Fell English SC',serif}
.act small{font:12.5px/1.15 'Barlow Condensed',sans-serif;letter-spacing:.02em;color:#d8cfbb}
.act:active,.act.hit{background:rgba(227,194,122,.28)}
.wk .go{margin-top:auto;min-height:50px;font:600 17px 'Barlow Condensed';letter-spacing:.08em;text-transform:uppercase;border:0;border-radius:2px;cursor:pointer;background:#e9e0cb;color:#1d1a16;box-shadow:0 3px 0 #8a7c5c}
.wk .go:disabled{opacity:.4}
.wk .hint{grid-column:1;font:15px 'IM Fell English',serif;font-style:italic;color:#e4dccb;align-self:center}
/* during the week: a ribbon of days, the meters and a fast-forward button */
.wkh{position:absolute;inset:0;z-index:12;pointer-events:none}
.wkh .rib{position:absolute;left:calc(12px + env(safe-area-inset-left,0px));top:calc(8px + var(--safe-t));display:flex;gap:4px;pointer-events:none}
.wkh .rib i{font:600 12px 'Barlow Condensed';letter-spacing:.1em;text-transform:uppercase;color:#d8cfbb;background:rgba(14,12,9,.6);padding:4px 7px;border-radius:2px;font-style:normal}
.wkh .rib i.now{background:#e9e0cb;color:#1d1a16}.wkh .rib i.past{opacity:.5}
.wkh .blk{position:absolute;left:calc(12px + env(safe-area-inset-left,0px));top:calc(36px + var(--safe-t));max-width:46vw;background:rgba(14,12,9,.62);padding:6px 10px;border-radius:2px;color:#f4ecd9}
.wkh .blk small{display:block;font:11.5px 'Special Elite';letter-spacing:.12em;text-transform:uppercase;color:#e3c27a}
.wkh .blk b{font:400 20px/1.1 'IM Fell English SC',serif}
.wkh .meters{position:absolute;right:calc(70px + env(safe-area-inset-right,0px));top:calc(10px + var(--safe-t));display:flex;gap:8px;background:rgba(14,12,9,.55);padding:6px 10px;border-radius:3px}
.wkh .meters .mtr{flex:0 0 70px;min-width:0}
.wkh .ff{position:absolute;right:calc(14px + env(safe-area-inset-right,0px));bottom:calc(14px + var(--safe-b));width:56px;height:56px;border-radius:50%;pointer-events:auto;cursor:pointer;
  border:2px solid rgba(241,234,219,.5);background:rgba(14,12,9,.6);color:#f4ecd9;font:600 15px 'Barlow Condensed';letter-spacing:.04em}
.wkh .ff.on{background:#e9e0cb;color:#1d1a16}
.wkh .ff kbd{display:block;font:10px 'Barlow Condensed';opacity:.7}
.wtag{position:absolute;transform:translate(-50%,-100%);font:600 13px 'Barlow Condensed';letter-spacing:.04em;padding:2px 8px;border-radius:10px;white-space:nowrap;pointer-events:none;
  background:rgba(14,12,9,.7);color:#f4ecd9}
.wtag.no{background:#a3302a;color:#fff;border:1.5px solid #ffd7c9}
.wtag.yes{background:#4d6b3a;color:#fff}
@media (pointer:fine){.wkh .ff kbd{display:block}}
@media (pointer:coarse){.wkh .ff kbd{display:none}}
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
    e.querySelector("em").textContent = Math.round(v);
    const u = e.querySelector("u");
    if (proj) {
      u.style.display = "";
      u.style.left = Math.max(0, Math.min(100, proj[m.id])).toFixed(1) + "%";
    } else u.style.display = "none";
    // colour: is this meter in a good or a bad place?
    const goodness = m.good > 0 ? v : 100 - v;
    e.classList.toggle("bad", goodness < 35);
    e.classList.toggle("good", goodness > 70);
  }
}
export function popMeters(root, d) {
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
  }
}

// ---- the planner ----------------------------------------------------------------------------------
// resolves with the plan {dayKey: actId} once every free afternoon has something
export function planWeek(ui, week, { title, kicker, hint, choices, audio, labels = {} }) {
  style();
  return new Promise((resolve) => {
    const w = document.createElement("div");
    w.className = "wk";
    const days = week.days;
    w.innerHTML = `
      <div class="hd"><div class="t"><small>${esc(kicker)}</small><b>${esc(title)}</b></div><div class="meters">${meterHTML()}</div></div>
      <div class="board" style="--n:${days.length}">${days.map((d) => `<div class="day" data-k="${d.key}"><h4>${esc(d.short || d.label)}</h4>${cellHTML(d, "am")}${cellHTML(d, "pm")}</div>`).join("")}</div>
      <div class="pal">${choices.map((id) => { const a = week.acts[id]; return `<button class="act" data-a="${id}"><span class="ic">${a.icon}</span><b>${esc(a.label)}</b><small>${esc(a.hint)}</small></button>`; }).join("")}
        <button class="go" disabled>Empezar la semana</button></div>
      <div class="hint">${esc(hint || "")}</div>`;
    function cellHTML(d, half) {
      const s = d[half];
      if (s === "free") return `<div class="cell free empty" data-d="${d.key}" role="button"><span class="ic">·</span>Tarde libre<small>elige</small></div>`;
      if (!s) return `<div class="cell none">${half === "am" ? "" : "—"}</div>`;
      const a = week.acts[s.act];
      const stamp = s.by ? ` cmd" style="--stamp:'${s.by}'` : "";
      return `<div class="cell fixed${stamp}"><span class="ic">${a.icon}</span>${esc(a.label)}<small>${half === "am" ? "mañana" : labels.pm || "tarde"}</small></div>`;
    }
    const free = week.freeDays().map((d) => d.key);
    let sel = free.find((k) => !week.plan[k]) || free[0];
    const refresh = () => {
      for (const k of free) {
        const c = w.querySelector(`.cell.free[data-d="${k}"]`);
        const a = week.acts[week.plan[k]];
        c.classList.toggle("empty", !a);
        c.classList.toggle("sel", k === sel);
        c.innerHTML = a ? `<span class="ic">${a.icon}</span>${esc(a.label)}<small>tarde</small>` : `<span class="ic">·</span>Tarde libre<small>elige</small>`;
      }
      const all = free.every((k) => week.plan[k]);
      w.querySelector(".go").disabled = !all;
      setMeters(w, week.stats(), week.project());
    };
    w.querySelectorAll(".cell.free").forEach((c) => (c.onclick = () => {
      sel = c.dataset.d;
      audio?.paper();
      refresh();
    }));
    w.querySelectorAll(".act").forEach((b) => (b.onclick = () => {
      if (!sel) sel = free.find((k) => !week.plan[k]) || free[free.length - 1];
      week.plan[sel] = b.dataset.a;
      audio?.pencil();
      b.classList.remove("hit");
      void b.offsetWidth;
      b.classList.add("hit");
      setTimeout(() => b.classList.remove("hit"), 200);
      // next empty afternoon, so five taps fill the week
      const i = free.indexOf(sel);
      sel = free.slice(i + 1).concat(free.slice(0, i)).find((k) => !week.plan[k]) || sel;
      refresh();
    }));
    w.querySelector(".go").onclick = () => {
      removeEventListener("keydown", key);
      audio?.paper();
      w.remove();
      resolve({ ...week.plan });
    };
    // keyboard: 1–5 picks an activity, Enter starts (desktop)
    const key = (e) => {
      const n = +e.key;
      if (n >= 1 && n <= choices.length) w.querySelectorAll(".act")[n - 1].click();
      if (e.key === "Enter" && !w.querySelector(".go").disabled) {
        removeEventListener("keydown", key);
        w.querySelector(".go").click();
      }
    };
    addEventListener("keydown", key);
    ui.cards.appendChild(w);
    refresh();
  });
}

// ---- the HUD while the week plays -----------------------------------------------------------------
export class WeekHUD {
  constructor(ui, week) {
    style();
    this.week = week;
    this.speed = 1;
    const e = (this.el = document.createElement("div"));
    e.className = "wkh";
    e.innerHTML = `<div class="rib">${week.days.map((d) => `<i data-k="${d.key}">${esc(d.short || d.label.slice(0, 3))}</i>`).join("")}</div>
      <div class="blk"><small></small><b></b></div>
      <div class="meters">${meterHTML()}</div>
      <button class="ff" aria-label="Acelerar">⏩<kbd>F</kbd></button>`;
    e.querySelector(".ff").onclick = () => this.toggle();
    this._key = (ev) => ev.code === "KeyF" && this.toggle();
    addEventListener("keydown", this._key);
    ui.root.appendChild(e);
    this.tags = new Map();
    this.update();
  }
  toggle() {
    this.speed = this.speed > 1 ? 1 : 3;
    this.el.querySelector(".ff").classList.toggle("on", this.speed > 1);
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
    if (delta) popMeters(this.el, delta);
  }
  // labels over men's heads (the game HUD is hidden in this mode)
  tag(key, s, text, cls = "") {
    let t = this.tags.get(key);
    if (!t) {
      t = { el: document.createElement("div"), s };
      t.el.className = "wtag " + cls;
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
