// Modos de juego: qué interfaz se ve y qué base musical suena. Cada momento declara su modo;
// el contenido del momento hace el resto. Cambiar de modo nunca recarga el mundo.
export const MODES = {
  narrative: { hud: false, music: { theme: "calm", level: 0.25 } },
  action: { hud: true, music: { theme: "drive", level: 0.5 } },
  stealth: { hud: true, music: { theme: "tension", level: 0.25 } },
  line: { hud: true, music: { theme: "tension", level: 0.4 } },
  base: { hud: false, music: { theme: "camp", level: 0.35 } },
  assault: { hud: true, music: { theme: "tension", level: 0.5 } },
};

export function enterMode(shell, mode, ctx) {
  const m = MODES[mode] || MODES.narrative;
  document.body.dataset.mode = mode;
  shell.ui.show(m.hud);
  // the place's ambience is layered under every moment there (silence is a valid bed too)
  const bed = ctx.moment.bed ?? ctx.chapter.beds?.[ctx.moment.place];
  if (bed) shell.audio.startBed(bed);
  else if (bed === null) shell.audio.stopBed();
  shell.audio.space(bed === "mess" ? "room" : "open");
  if (ctx.moment.music !== false) shell.music.set(ctx.moment.music?.theme || m.music.theme, ctx.moment.music?.level ?? m.music.level);
}
