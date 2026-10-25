// Autopilot for tests: steers Winters to a slot in the column, breathes on the window, helps stragglers.
// mode: "good" (keeps up and helps), "lazy" (falls behind to test the fail path)
window.__bot = function (mode = "good") {
  const S = window.__shell;
  S.hook(() => {
    const R = window.__run;
    if (!R) return;
    const { col, win, music } = R;
    const inp = S.input;
    let tx, tz;
    const fl = col.flagged()[0];
    if (mode === "good" && fl) { tx = fl.sol.x; tz = fl.sol.z; }
    else { const sl = col.slot(mode === "lazy" ? 40 : 2, 1.6); tx = sl.x; tz = sl.z; }
    let dx = tx - win.x, dz = tz - win.z;
    const d = Math.hypot(dx, dz);
    if (mode === "lazy") { inp.mx = 0; inp.my = 0; }
    else if (d < 0.4) { inp.mx = inp.my = 0; }
    else {
      dx /= d; dz /= d;
      const k = Math.min(1, d / 1.5);
      inp.mx = (dx * 0.707 - dz * 0.707) * k;
      inp.my = (dx * 0.707 + dz * 0.707) * k;
    }
    const b = music.breath();
    if (mode === "good" && b.err < 0.08 && !window.__bb) { inp.press("breath"); window.__bb = 1; setTimeout(() => { inp.release("breath"); window.__bb = 0; }, 260); }
    if (mode === "good" && fl && Math.hypot(fl.sol.x - win.x, fl.sol.z - win.z) < 2.4) inp.press("act"), inp.release("act");
  });
};
// clicks through paper cards (first choice / next) so a whole chapter can run unattended
window.__autocards = function (pick = 0) {
  setInterval(() => {
    const c = document.querySelector("#cards .paper");
    if (!c) return;
    const key = c.innerText.slice(0, 80);
    if (c.dataset.botT === key) return;
    c.dataset.botT = key;
    setTimeout(() => {
      const ch = c.querySelectorAll(".choice");
      if (ch.length) ch[Math.min(pick, ch.length - 1)].click();
      else c.querySelector(".next")?.click();
    }, 1200);
  }, 300);
};
// the bot reattaches itself to each new run
window.__autobot = function (mode = "good") {
  let last = null;
  setInterval(() => {
    if (window.__run && window.__run !== last) {
      last = window.__run;
      window.__G().slow = window.__botSlow || 3;
      if (!window.__botOn) { window.__botOn = 1; window.__bot(mode); }
    }
  }, 500);
};
// audio levels: samples every 100 ms, keeps per-bus max peak and mean rms (dBFS)
window.__meterStart = function () {
  const acc = {};
  window.__meterAcc = acc;
  setInterval(() => {
    const m = window.__shell.audio.meter();
    for (const [k, v] of Object.entries(m)) {
      const a = (acc[k] = acc[k] || { peak: -120, rmsSum: 0, n: 0, clip: 0 });
      a.peak = Math.max(a.peak, v.peak);
      if (v.rms > -100) { a.rmsSum += v.rms; a.n++; }
      if (v.peak > -0.3) a.clip++;
    }
  }, 100);
};
window.__meterReport = () => JSON.stringify(Object.fromEntries(Object.entries(window.__meterAcc || {}).map(([k, a]) => [k, { peak: +a.peak.toFixed(1), rms: a.n ? +(a.rmsSum / a.n).toFixed(1) : null, clip: a.clip }])));
// fills the week planner: a fixed plan (by activity index, cycling) then «Empezar»; ff=true fast-forwards
window.__autoweek = function (order = [0, 3, 2, 1, 4], ff = false) {
  setInterval(() => {
    const w = document.querySelector(".wk");
    if (w && !w.dataset.bot) {
      w.dataset.bot = 1;
      const acts = w.querySelectorAll(".act");
      let i = 0;
      const step = () => {
        const go = w.querySelector(".go");
        if (!go.classList.contains("off")) return setTimeout(() => go.click(), 1500);
        acts[order[i++ % order.length]].click();
        setTimeout(step, 500);
      };
      setTimeout(step, 1500);
    }
    const f = document.querySelector(".wkh .ff");
    if (ff && f && !f.classList.contains("on")) f.click(); // ×3
  }, 400);
};
