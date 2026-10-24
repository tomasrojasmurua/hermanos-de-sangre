// Música adaptativa por capas, sintetizada con Web Audio. Cada tema tiene capas (pad, bajo, caja, timbal,
// trémolo, lead) cuyo volumen sigue a una intensidad 0..1 que cambia suave, sin cortes.
// Los cambios de tema se cruzan (crossfade). El silencio también es un estado válido.
//   music.set("drive", 0.4)     tema + intensidad objetivo
//   music.intensity(0.8)        solo la intensidad
//   music.sting("summit")       un motivo corto encima de todo
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

// progressions as MIDI roots per bar; chords are triads built on them (minor unless noted)
const THEMES = {
  calm: { bpm: 66, prog: [[50, "m"], [46, "M"], [53, "M"], [48, "M"]], layers: { pad: [0, 0.55], lead: [0.2, 0.5] } },
  camp: { bpm: 84, prog: [[50, "M"], [55, "M"], [50, "M"], [57, "M"]], layers: { pad: [0, 0.4], bass: [0.1, 0.4], lead: [0, 0.45], snare: [0.6, 0.2] } },
  drive: { bpm: 96, prog: [[50, "m"], [46, "M"], [53, "M"], [48, "M"]], layers: { pad: [0, 0.35], bass: [0.15, 0.55], snare: [0, 0.6], timp: [0.45, 0.6], trem: [0.6, 0.35], lead: [0.8, 0.35] } },
  tension: { bpm: 72, prog: [[45, "m"], [45, "m"], [46, "M"], [44, "dim"]], layers: { pad: [0, 0.35], trem: [0.1, 0.45], timp: [0.4, 0.5], bass: [0.6, 0.4] } },
  combat: { bpm: 120, prog: [[45, "m"], [41, "M"], [43, "M"], [40, "M"]], layers: { pad: [0, 0.3], bass: [0, 0.6], snare: [0, 0.6], timp: [0, 0.7], trem: [0.3, 0.45] } },
  silence: { bpm: 60, prog: [[50, "m"]], layers: {} },
};
const CH = { m: [0, 3, 7], M: [0, 4, 7], dim: [0, 3, 6] };

export class Music {
  constructor(audio) {
    this.a = audio;
    this.cur = null;
    this.want = { theme: "calm", level: 0.2 };
    this.level = 0;
    this.targetLevel = 0.2;
    this.started = false;
  }
  start() {
    if (this.started || !this.a.on) return;
    this.started = true;
    this._switch(this.want.theme);
  }
  set(theme, level) {
    this.want = { theme, level: level ?? this.targetLevel };
    this.targetLevel = this.want.level;
    if (!this.started) return;
    if (!this.cur || this.cur.name !== theme) this._switch(theme);
  }
  intensity(v) {
    this.targetLevel = Math.max(0, Math.min(1, v));
  }
  _switch(name) {
    const c = this.a.ctx;
    const t = c.currentTime;
    if (this.cur) {
      const old = this.cur;
      old.bus.gain.setTargetAtTime(0.0001, t, 1.2);
      setTimeout(() => old.bus.disconnect(), 6000);
      old.dead = true;
    }
    const def = THEMES[name] || THEMES.calm;
    const bus = c.createGain();
    bus.gain.setValueAtTime(0.0001, t);
    bus.gain.setTargetAtTime(1.8, t + 0.2, 1.4); // measured: the music sat under the cicadas
    bus.connect(this.a.musicBus);
    const layers = {};
    for (const k of Object.keys(def.layers)) {
      const g = c.createGain();
      g.gain.value = 0;
      g.connect(bus);
      layers[k] = g;
    }
    // a soft room so synth layers don't sound dry
    this.cur = { name, def, bus, layers, beat: 0, next: t + 0.15, spb: 60 / def.bpm };
    this.level = Math.min(this.level, this.targetLevel);
  }
  update(dt) {
    if (!this.started || !this.cur) return;
    const c = this.a.ctx;
    const cur = this.cur;
    // intensity follows its target slowly: never a hard cut
    this.level += (this.targetLevel - this.level) * Math.min(1, dt * 0.6);
    const t = c.currentTime;
    for (const [k, g] of Object.entries(cur.layers)) {
      const [from, vol] = cur.def.layers[k];
      const on = Math.max(0, Math.min(1, (this.level - from) / 0.25));
      g.gain.setTargetAtTime(on * vol * 0.5, t, 0.4);
    }
    // schedule ahead on the audio clock
    while (cur.next < t + 0.25) {
      this._beat(cur, cur.next);
      cur.next += cur.spb;
      cur.beat++;
    }
  }
  _beat(cur, t) {
    const b = cur.beat, bar = Math.floor(b / 4), inBar = b % 4;
    const [root, q] = cur.def.prog[bar % cur.def.prog.length];
    const chord = CH[q].map((i) => root + i);
    const L = cur.layers;
    const spb = cur.spb;
    if (L.pad && inBar === 0) for (const n of chord) this._pad(L.pad, t, spb * 4.1, NOTE(n + 12));
    if (L.bass) {
      if (cur.name === "drive" || cur.name === "combat") this._pluck(L.bass, t, spb * 0.9, NOTE(root - 12), 0.7);
      else if (inBar === 0 || inBar === 2) this._pluck(L.bass, t, spb * 1.8, NOTE(root - 12), 0.6);
    }
    if (L.snare) {
      // military cadence: ta . ta-ta | ta . trrr
      const pat = cur.name === "camp" ? [1, 0, 0.5, 0] : [1, 0.35, 0.7, 0.35];
      this._snare(L.snare, t, pat[inBar]);
      if (inBar === 3 && bar % 2 === 1) for (let i = 1; i < 4; i++) this._snare(L.snare, t + (spb / 4) * i, 0.3);
      if (inBar === 1 || inBar === 3) this._snare(L.snare, t + spb / 2, 0.25);
    }
    if (L.timp && (inBar === 0 || (cur.name === "combat" && inBar === 2))) this._timp(L.timp, t, NOTE(root - 12));
    if (L.trem && inBar === 0) this._trem(L.trem, t, spb * 4, NOTE(chord[2] + 24));
    if (L.lead && inBar === 0 && bar % 2 === 0) {
      // bugle-like phrase built from the chord tones (a horn call, never a melody that tires)
      const ph = [chord[0] + 24, chord[1] + 24, chord[2] + 24, chord[1] + 24];
      ph.forEach((n, i) => this._horn(L.lead, t + i * spb * 0.5, spb * (i === 3 ? 1.4 : 0.45), NOTE(n)));
    }
  }
  _pad(dest, t, dur, f) {
    const c = this.a.ctx;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.06, t + dur * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;
    lp.connect(g).connect(dest);
    for (const d of [-6, 6]) {
      const o = c.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      o.detune.value = d;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
  }
  _pluck(dest, t, dur, f, v) {
    const c = this.a.ctx;
    const o = c.createOscillator();
    o.type = "triangle";
    o.frequency.value = f;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22 * v, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  _snare(dest, t, v) {
    if (!v) return;
    const c = this.a.ctx;
    const s = c.createBufferSource();
    s.buffer = this.a.noise;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2400;
    bp.Q.value = 0.7;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32 * v, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    s.connect(bp).connect(g).connect(dest);
    s.start(t, Math.random());
    s.stop(t + 0.16);
    const o = c.createOscillator();
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.05);
    const og = c.createGain();
    og.gain.setValueAtTime(0.12 * v, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(og).connect(dest);
    o.start(t);
    o.stop(t + 0.08);
  }
  _timp(dest, t, f) {
    const c = this.a.ctx;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(f * 1.5, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + 1.5);
  }
  _trem(dest, t, dur, f) {
    const c = this.a.ctx;
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = f;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2200;
    const g = c.createGain();
    g.gain.value = 0;
    const lfo = c.createOscillator();
    lfo.frequency.value = 9;
    const lg = c.createGain();
    lg.gain.value = 0.02;
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(1, t + dur * 0.3);
    env.gain.linearRampToValueAtTime(0.0001, t + dur);
    lfo.connect(lg).connect(g.gain);
    o.connect(lp).connect(g).connect(env).connect(dest);
    o.start(t);
    lfo.start(t);
    o.stop(t + dur + 0.05);
    lfo.stop(t + dur + 0.05);
  }
  _horn(dest, t, dur, f) {
    const c = this.a.ctx;
    const o = c.createOscillator();
    o.type = "square";
    o.frequency.value = f;
    const vib = c.createOscillator();
    vib.frequency.value = 5;
    const vg = c.createGain();
    vg.gain.value = f * 0.006;
    vib.connect(vg).connect(o.frequency);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(700, t);
    lp.frequency.linearRampToValueAtTime(1500, t + 0.08);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.05);
    g.gain.setValueAtTime(0.07, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g).connect(dest);
    o.start(t);
    vib.start(t);
    o.stop(t + dur + 0.05);
    vib.stop(t + dur + 0.05);
  }
  // cadence timing for rhythm actions: breaths fall on every other beat
  // returns {phase: 0..1 toward the next breath, err: seconds from the nearest breath, period}
  breath() {
    const cur = this.cur;
    if (!this.started || !cur) {
      const t = performance.now() / 1000, per = 1.25;
      const ph = (t % per) / per;
      return { phase: ph, err: Math.min(ph, 1 - ph) * per, period: per };
    }
    const t = this.a.ctx.currentTime;
    const per = cur.spb * 2;
    // beat index cur.beat is scheduled at cur.next; even beats are breaths
    const nextBeatT = cur.next, nextBeat = cur.beat;
    const lastEvenIdx = nextBeat % 2 === 0 ? nextBeat - 2 : nextBeat - 1;
    const lastEvenT = nextBeatT - (nextBeat - lastEvenIdx) * cur.spb;
    let ph = (t - lastEvenT) / per;
    ph -= Math.floor(ph);
    return { phase: ph, err: Math.min(ph, 1 - ph) * per, period: per };
  }
  // one-off motif over the bed (summit, arrival, grief)
  sting(kind) {
    if (!this.started) return;
    const c = this.a.ctx;
    const t = c.currentTime + 0.05;
    const dest = this.a.musicBus;
    const seq = { summit: [62, 66, 69, 74], arrival: [62, 69, 67, 66], grief: [57, 60, 64, 62], wash: [57, 56] }[kind] || [62];
    seq.forEach((n, i) => this._horn(dest, t + i * 0.42, i === seq.length - 1 ? 1.8 : 0.4, NOTE(n)));
  }
}
