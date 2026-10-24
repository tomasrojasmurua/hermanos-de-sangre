// Director de escenas: un capítulo es una lista de momentos descritos como datos.
//   { id, mode, place, title?, card?, run(ctx) -> Promise<result>, next?(result, ctx) -> momentId }
// Entre momentos del mismo lugar se mantiene el mundo y la cámara (transición "camera");
// si cambia el lugar o el tiempo, entra una tarjeta narrativa (transición "card").
// Guarda al empezar cada momento y al cerrar el capítulo.
import { writeSave } from "./save.js";
import { Roster } from "./roster.js";
import { enterMode } from "./modes.js";

export class Director {
  constructor(shell, save) {
    this.shell = shell;
    this.save = save;
    this.roster = new Roster(save.roster);
    save.roster = this.roster.d;
  }
  persist() {
    this.save.roster = this.roster.d;
    writeSave(this.save);
  }
  async playChapter(ch, fromMoment) {
    const ids = ch.moments.map((m) => m.id);
    const [startId, startSub] = (fromMoment || "").split(":");
    let i = Math.max(0, startId ? ids.indexOf(startId) : 0);
    let resumeSub = startSub || null;
    let prevPlace = null;
    this.save.chapter = ch.id;
    while (i >= 0 && i < ch.moments.length) {
      const m = ch.moments[i];
      this.save.moment = m.id;
      this.persist();
      const sameStage = this.shell.stage && this.shell.stage.id === m.place && prevPlace === m.place;
      if (!sameStage && m.place) {
        await this.shell.ui.fade(true, prevPlace ? 700 : 10);
        this.shell.build(m.place, ch.places[m.place]);
        this.shell.R.post.fade.value = 1;
      }
      const G = this.shell.G;
      G.save = this.save;
      const ctx = this.ctx(ch, m, G);
      ctx.resume = resumeSub;
      resumeSub = null;
      enterMode(this.shell, m.mode, ctx);
      if (!sameStage) this.shell.ui.fade(false, 900);
      let result;
      try {
        result = await m.run(ctx);
      } catch (e) {
        if (e && e.message === "abort") return { aborted: true };
        console.error(e);
        throw e;
      }
      if (result && result.retry) continue; // replay the same moment (historical survivor fell)
      prevPlace = m.place;
      const nextId = m.next ? m.next(result, ctx) : null;
      i = nextId ? ids.indexOf(nextId) : i + 1;
    }
    this.save.chapters[ch.id] = { ...(this.save.chapters[ch.id] || {}), done: true };
    this.save.moment = null;
    this.persist();
    return { done: true };
  }
  ctx(ch, m, G) {
    const shell = this.shell;
    return {
      chapter: ch,
      moment: m,
      G,
      shell,
      ui: shell.ui,
      audio: shell.audio,
      music: shell.music,
      input: shell.input,
      roster: this.roster,
      save: this.save,
      flags: this.save.flags,
      lvl: G.lvl,
      director: this,
      checkpoint: (sub) => {
        this.save.moment = sub ? m.id + ":" + sub : m.id;
        this.persist();
      },
    };
  }
}
