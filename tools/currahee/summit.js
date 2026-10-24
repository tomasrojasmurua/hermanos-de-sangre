// jump the column to just below the summit and log the player's tracking every 0.5 s of game time
window.__summit = function () {
  const R = window.__run, col = R.col, win = R.win;
  col.s = R.summitS - 20;
  for (const m of col.men) { const sl = col.slot(m.rank, m.lane); m.sol.x = sl.x; m.sol.z = sl.z; }
  const ws = col.slot(2, 1.6); win.x = ws.x; win.z = ws.z; col.p.s = ws.s;
  window.__slog = [];
  let t = 0;
  window.__shell.hook((dt) => {
    t += dt;
    if (t < 0.5) return;
    t = 0;
    const sl = col.slot(2, 1.6);
    window.__slog.push([+(col.s - R.summitS).toFixed(1), +(col.p.s - R.summitS).toFixed(1), +(col.ambS() - R.summitS).toFixed(1), +(col.p.rel || 0).toFixed(2), +Math.hypot(sl.x - win.x, sl.z - win.z).toFixed(1), +col.p.stam.toFixed(2)].join(" "));
  });
};
