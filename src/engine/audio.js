// Procedural audio: no files to download, everything is synthesised (wind, planes, bells, guns, crickets).
export class Audio {
  constructor() {
    this.ctx = null;
    this.on = false;
    this.listener = { x: 0, z: 0 };
  }
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return;
    }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 3.0; // measured: master sat near −36 dB RMS on a phone-quiet mix; the compressor catches the peaks
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 5;
    comp.attack.value = 0.003;
    comp.knee.value = 6;
    comp.release.value = 0.15;
    // brick-wall-ish limiter after the glue compressor: nothing reaches 0 dBFS
    const lim = c.createDynamicsCompressor();
    lim.threshold.value = -2;
    lim.ratio.value = 20;
    lim.knee.value = 0;
    lim.attack.value = 0.001;
    lim.release.value = 0.08;
    this.master.connect(comp).connect(lim).connect(c.destination);
    // separate buses so music, effects and voice have their own volume (settings)
    this.sfxBus = c.createGain();
    this.musicBus = c.createGain();
    this.voiceBus = c.createGain();
    this.ambBus = c.createGain();
    for (const b of [this.sfxBus, this.musicBus, this.voiceBus, this.ambBus]) b.connect(this.master);
    this.ambBus.gain.value = 0.5; // cicadas sat 8 dB over the music: the bed sits under, not over
    this.meters = {};
    for (const [k, b] of Object.entries({ sfx: this.sfxBus, music: this.musicBus, voice: this.voiceBus, amb: this.ambBus, master: lim })) {
      const an = c.createAnalyser();
      an.fftSize = 1024;
      b.connect(an);
      this.meters[k] = an;
    }
    this.levels = this.levels || { music: 0.8, sfx: 0.9, voice: 0.9 };
    this.applyLevels();
    // shared noise buffer
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b = 0.97 * b + 0.03 * w;
      d[i] = w * 0.6 + b * 2.2;
    }
    // reverb (cheap): convolver with decaying noise
    const ir = c.createBuffer(2, c.sampleRate * 1.8, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const q = ir.getChannelData(ch);
      for (let i = 0; i < q.length; i++) q[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / q.length, 3);
    }
    this.verb = c.createConvolver();
    this.verb.buffer = ir;
    this.verbGain = c.createGain();
    this.verbGain.gain.value = 0.35;
    this.verb.connect(this.verbGain).connect(this.sfxBus);
    // open air: a short tail plus one clear slap-back off the hillside (no hall)
    this.echo = c.createDelay(1);
    this.echo.delayTime.value = 0.32;
    const fb = c.createGain();
    fb.gain.value = 0.22;
    const elp = c.createBiquadFilter();
    elp.type = "lowpass";
    elp.frequency.value = 2200;
    this.echo.connect(elp).connect(fb).connect(this.echo);
    this.echoOut = c.createGain();
    this.echoOut.gain.value = 0;
    elp.connect(this.echoOut).connect(this.sfxBus);
    this.space("open");
    this.on = true;
    // a bed asked for before the first touch starts now
    if (this.wantBed) this.startBed(this.wantBed);
  }
  // acoustic space of the current place: "open" (fields, hills: slap echo, little tail) or "room"
  space(kind) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.spaceKind = kind;
    this.verbGain.gain.setTargetAtTime(kind === "room" ? 0.35 : 0.12, t, 0.3);
    this.echoOut.gain.setTargetAtTime(kind === "room" ? 0 : 0.5, t, 0.3);
  }
  // music steps aside while someone talks
  duck(sec = 2, depth = 0.5) {
    if (!this.on) return;
    const t = this.ctx.currentTime, lv = this.levels.music;
    this.musicBus.gain.cancelScheduledValues(t);
    this.musicBus.gain.setTargetAtTime(lv * depth, t, 0.08);
    this.musicBus.gain.setTargetAtTime(lv, t + sec, 0.3);
  }
  // rhythm feedback: a soft thump and a buzz when you hit the beat, a sour drop when you miss
  hit(ok) {
    if (!this.on) return;
    const t = this.ctx.currentTime;
    if (ok) {
      this._tone(this.sfxBus, t, 0.08, 180, { gain: 0.15 });
      this.vibrate(12);
    } else {
      this._tone(this.sfxBus, t, 0.14, 300, { type: "triangle", f1: 200, gain: 0.08 });
      this.vibrate([20, 30, 20]);
    }
  }
  // the guide pulse of the cadence lives on the effects bus: you hear it even with the music muted
  tick(t, v = 0.8) {
    if (!this.on) return;
    this._noise(this.sfxBus, t, 0.05, { type: "bandpass", f0: 2400, q: 1.4, gain: 0.08 * v });
    this._tone(this.sfxBus, t, 0.05, 210, { f1: 140, gain: 0.07 * v });
  }
  heartAt(v = 0.6, t) {
    if (!this.on) return;
    t = t ?? this.ctx.currentTime;
    this._tone(this.sfxBus, t, 0.12, 62, { f1: 48, gain: 0.22 * v });
    this._tone(this.sfxBus, t + 0.18, 0.1, 58, { f1: 46, gain: 0.15 * v });
  }
  resume() {
    this.ctx && this.ctx.state !== "running" && this.ctx.resume();
  }
  _out(dist = 0, pan = 0) {
    const c = this.ctx;
    const g = c.createGain();
    const att = 1 / (1 + dist * dist * 0.004);
    g.gain.value = att;
    let node = g;
    if (c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p);
      node = p;
    }
    node.connect(this._bus || this.sfxBus);
    const send = c.createGain();
    send.gain.value = Math.min(0.9, 0.15 + dist * 0.015);
    g.connect(send).connect(this.verb);
    if (this.echo && dist > 4) {
      // far sounds come back off the hill
      const es = c.createGain();
      es.gain.value = Math.min(0.6, dist * 0.012) * (this._bus === this.voiceBus ? this.levels.voice / 0.9 : 1);
      g.connect(es).connect(this.echo);
    }
    return g;
  }
  _pos(x, z) {
    const dx = x - this.listener.x, dz = z - this.listener.z;
    return { d: Math.hypot(dx, dz), pan: (dx - dz) * 0.03 };
  }
  _noise(dest, t0, dur, { type = "lowpass", f0 = 1000, f1 = null, q = 0.8, gain = 1, attack = 0.002, rate = 1 } = {}) {
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    s.playbackRate.value = rate;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f0, t0);
    if (f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f).connect(g).connect(dest);
    s.start(t0, Math.random() * 1.5);
    s.stop(t0 + dur + 0.05);
  }
  _tone(dest, t0, dur, freq, { type = "sine", gain = 0.3, f1 = null, attack = 0.005 } = {}) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(dest);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }
  // ---------------------------------------------------------------------------------------------
  shot(x, z, kind = "m1") {
    if (!this.on) return;
    const { d, pan } = this._pos(x, z);
    const o = this._out(d, pan);
    const t = this.ctx.currentTime;
    const hi = kind === "mp40" || kind === "thompson" ? 0.7 : 1;
    this._noise(o, t, 0.22 * hi, { f0: 4200, f1: 600, gain: 0.9, rate: 1.2 });
    this._noise(o, t, 0.5, { f0: 260, f1: 60, gain: 0.8, type: "lowpass" });
    this._tone(o, t, 0.12, 120, { f1: 50, gain: 0.5 });
    if (d > 25) this._noise(o, t + d / 340, 0.8, { f0: 400, f1: 120, gain: 0.25 });
  }
  mg(x, z) {
    // MG42 "zipper": burst of very fast shots
    if (!this.on) return;
    const { d, pan } = this._pos(x, z);
    const o = this._out(d, pan);
    const t = this.ctx.currentTime;
    for (let i = 0; i < 9; i++) {
      this._noise(o, t + i * 0.05, 0.09, { f0: 2400, f1: 400, gain: 0.7 });
      this._tone(o, t + i * 0.05, 0.06, 95, { f1: 50, gain: 0.35 });
    }
  }
  ping() {
    if (!this.on) return;
    const o = this._out(0, 0.2);
    const t = this.ctx.currentTime;
    this._tone(o, t, 0.6, 2350, { type: "triangle", gain: 0.18, f1: 2300 });
    this._tone(o, t, 0.4, 3480, { type: "sine", gain: 0.08 });
  }
  reload() {
    if (!this.on) return;
    const o = this._out(0, 0.2);
    const t = this.ctx.currentTime;
    this._noise(o, t, 0.05, { f0: 3000, type: "bandpass", q: 3, gain: 0.5 });
    this._noise(o, t + 0.35, 0.06, { f0: 2400, type: "bandpass", q: 3, gain: 0.6 });
    this._noise(o, t + 0.55, 0.08, { f0: 1800, type: "bandpass", q: 2, gain: 0.7 });
  }
  boom(x, z, size = 1) {
    if (!this.on) return;
    const { d, pan } = this._pos(x, z);
    const o = this._out(d * 0.6, pan);
    const t = this.ctx.currentTime + d / 340;
    this._noise(o, t, 1.6 * size, { f0: 900, f1: 40, gain: 1.4 });
    this._tone(o, t, 0.9, 70, { f1: 28, gain: 0.9 });
    this._noise(o, t + 0.05, 2.5, { f0: 300, f1: 60, gain: 0.35 });
  }
  whizz(near = 1) {
    if (!this.on) return;
    const o = this._out(0, (Math.random() - 0.5) * 1.6);
    const t = this.ctx.currentTime;
    this._noise(o, t, 0.18, { type: "bandpass", f0: 5200, f1: 1600, q: 5, gain: 0.5 * near });
    if (Math.random() < 0.5) this._noise(o, t + 0.02, 0.05, { type: "highpass", f0: 3000, gain: 0.3 * near });
  }
  cricket(x = this.listener.x, z = this.listener.z, twice = false) {
    if (!this.on) return;
    const { d, pan } = this._pos(x, z);
    const o = this._out(d, pan);
    const t = this.ctx.currentTime;
    const one = (tt) => {
      this._tone(o, tt, 0.03, 3100, { type: "square", gain: 0.12 });
      this._tone(o, tt + 0.09, 0.03, 2600, { type: "square", gain: 0.1 });
    };
    one(t);
    if (twice) one(t + 0.32);
  }
  bell(x, z) {
    if (!this.on) return;
    const { d, pan } = this._pos(x, z);
    const o = this._out(d * 0.5, pan);
    const t = this.ctx.currentTime;
    for (const [f, g] of [[196, 0.25], [392, 0.12], [588, 0.07], [933, 0.04]]) this._tone(o, t, 3.8, f, { gain: g, attack: 0.004 });
  }
  footstep(soft = 1) {
    if (!this.on) return;
    const o = this._out(0, (Math.random() - 0.5) * 0.3);
    const t = this.ctx.currentTime;
    this._noise(o, t, 0.08, { f0: 900 + Math.random() * 400, type: "lowpass", gain: 0.12 * soft });
  }
  stab() {
    if (!this.on) return;
    const o = this._out(0, 0);
    const t = this.ctx.currentTime;
    this._noise(o, t, 0.12, { f0: 600, type: "lowpass", gain: 0.6 });
    this._noise(o, t + 0.05, 0.3, { f0: 300, type: "lowpass", gain: 0.3 });
  }
  heartbeat(k = 1) {
    if (!this.on) return;
    const o = this._out(0, 0);
    const t = this.ctx.currentTime;
    this._tone(o, t, 0.12, 55, { gain: 0.5 * k, f1: 40 });
    this._tone(o, t + 0.22, 0.14, 50, { gain: 0.35 * k, f1: 38 });
  }
  shout(x, z) {
    if (!this.on) return;
    const { d, pan } = this._pos(x, z);
    const o = this._out(d, pan);
    const t = this.ctx.currentTime;
    // formant-ish bark
    this._tone(o, t, 0.25, 220, { type: "sawtooth", gain: 0.12, f1: 170 });
    this._noise(o, t, 0.25, { type: "bandpass", f0: 900, q: 4, gain: 0.2 });
  }
  // continuous beds --------------------------------------------------------------------------------
  startWind(level = 0.2) {
    if (!this.on || this.wind) return;
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.playbackRate.value = 0.5;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 420;
    const g = c.createGain();
    g.gain.value = level;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.09;
    const lg = c.createGain();
    lg.gain.value = 180;
    lfo.connect(lg).connect(f.frequency);
    s.connect(f).connect(g).connect(this.ambBus);
    s.start();
    lfo.start();
    this.wind = { s, g, f };
  }
  setWind(level) {
    this.wind && this.wind.g.gain.setTargetAtTime(level, this.ctx.currentTime, 1.5);
  }
  plane(dur = 9, level = 0.35) {
    if (!this.on) return;
    const c = this.ctx, t = c.currentTime;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + dur * 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.ambBus);
    for (const f of [58, 61.5, 116]) {
      const o = c.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(f * 1.04, t);
      o.frequency.linearRampToValueAtTime(f * 0.96, t + dur);
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 380;
      o.connect(lp).connect(g);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
  }
  distantFlak() {
    if (!this.on) return;
    const o = this._out(60, (Math.random() - 0.5));
    const t = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) this._noise(o, t + i * 0.13, 0.4, { f0: 300, f1: 80, gain: 0.6 });
  }
  sting(kind = "low") {
    // short music sting: a low cello-ish swell for grief / tension
    if (!this.on) return;
    const o = this._out(0, 0);
    const t = this.ctx.currentTime;
    const notes = kind === "grief" ? [110, 130.8, 164.8] : kind === "dawn" ? [146.8, 220, 293.7] : [98, 116.5];
    notes.forEach((f, i) => this._tone(o, t + i * 0.4, 4.5, f, { type: "triangle", gain: 0.09, attack: 1.2 }));
  }

  // ---- buses & metering ---------------------------------------------------------------------------
  applyLevels() {
    if (!this.on && !this.musicBus) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(this.levels.music, t, 0.1);
    this.sfxBus.gain.setTargetAtTime(this.levels.sfx, t, 0.1);
    this.ambBus.gain.setTargetAtTime(this.levels.sfx * 0.5, t, 0.1); // the bed sits under the music
    this.voiceBus.gain.setTargetAtTime(this.levels.voice, t, 0.1);
  }
  setLevels(l) {
    Object.assign(this.levels || (this.levels = {}), l);
    if (this.ctx) this.applyLevels();
  }
  // rms / peak (dBFS) of each bus right now, for the sound QA
  meter() {
    const out = {};
    if (!this.meters) return out;
    const buf = new Float32Array(1024);
    for (const [k, an] of Object.entries(this.meters)) {
      an.getFloatTimeDomainData(buf);
      let s = 0, p = 0;
      for (const v of buf) {
        s += v * v;
        p = Math.max(p, Math.abs(v));
      }
      const rms = Math.sqrt(s / buf.length);
      out[k] = { rms: rms > 1e-6 ? 20 * Math.log10(rms) : -120, peak: p > 1e-6 ? 20 * Math.log10(p) : -120 };
    }
    return out;
  }
  // ---- voices: short formant-synthesised shouts (no recorded dialogue) --------------------------------
  // vowels: a e i o u ; returns end time
  vowel(dest, t, dur, v, pitch, gain = 0.2, glide = 0) {
    const F = { a: [800, 1150, 2900], e: [480, 1720, 2520], i: [300, 2200, 2950], o: [500, 900, 2600], u: [330, 760, 2400] }[v] || [600, 1000, 2600];
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(pitch, t);
    if (glide) o.frequency.linearRampToValueAtTime(pitch * (1 + glide), t + dur);
    const vib = c.createOscillator();
    vib.frequency.value = 5.5;
    const vg = c.createGain();
    vg.gain.value = pitch * 0.015;
    vib.connect(vg).connect(o.frequency);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.03);
    g.gain.setValueAtTime(gain, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const amps = [1, 0.5, 0.25];
    F.forEach((f, k) => {
      const bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = f;
      bp.Q.value = 7 + k * 3;
      const ag = c.createGain();
      ag.gain.value = amps[k] * 3;
      o.connect(bp).connect(ag).connect(g);
    });
    g.connect(dest);
    o.start(t);
    vib.start(t);
    o.stop(t + dur + 0.05);
    vib.stop(t + dur + 0.05);
    return t + dur;
  }
  // a shouted word as vowel syllables with consonant noise bursts: [[vowel, dur, consonantNoise?], ...]
  say(syl, { x, z, pitch = 150, gain = 0.18, voices = 1, spread = 0.03, delay = 0 } = {}) {
    if (!this.on) return;
    const p = x !== undefined ? this._pos(x, z) : { d: 0, pan: 0 };
    this._bus = this.voiceBus;
    const out = this._out(p.d, p.pan);
    this._bus = null;
    for (let k = 0; k < voices; k++) {
      let t = this.ctx.currentTime + delay + Math.random() * spread * voices;
      const pk = pitch * (1 + (Math.random() - 0.5) * 0.18 * (voices > 1 ? 1 : 0));
      for (const [v, d, cons] of syl) {
        if (cons) this._noise(out, t, 0.05, { type: "bandpass", f0: cons, q: 2, gain: gain * 1.4 / Math.sqrt(voices) });
        t = this.vowel(out, t + (cons ? 0.03 : 0), d, v, pk, gain / Math.sqrt(voices), -0.06);
      }
    }
  }
  // a spoken line as formant babble: the vowels of the first words, with the consonants' colour.
  // Not words, just the shape and pitch of a voice under the subtitle (no recorded dialogue).
  speak(text, { x, z, pitch = 150, gain = 0.26, max = 9 } = {}) {
    if (!this.on || !text) return;
    const shout = /[¡!]/.test(text), quiet = /^\(/.test(text);
    const clean = text.replace(/\([^)]*\)/g, "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const syl = [];
    const CONS = (c) => ("szcx".includes(c) ? 4600 : "rl".includes(c) ? 1300 : "ptkqbdg".includes(c) ? 2400 : "mnñ".includes(c) ? 0 : 1700);
    let prev = "";
    for (const ch of clean) {
      if ("aeiou".includes(ch)) {
        if (syl.length >= max) break;
        syl.push([ch, 0.07 + Math.random() * 0.06, prev ? CONS(prev) || undefined : undefined]);
        prev = "";
      } else if (/[a-zñ]/.test(ch)) prev = ch;
      else if (ch === "," || ch === "." || ch === "?") {
        if (syl.length) syl[syl.length - 1][1] += 0.12;
      }
    }
    if (!syl.length) return;
    syl[syl.length - 1][1] += shout ? 0.16 : 0.08; // the last syllable is held
    this.say(syl, { x, z, pitch: pitch * (shout ? 1.12 : quiet ? 0.92 : 1), gain: gain * (shout ? 1.3 : quiet ? 0.45 : 1) });
  }
  chant(word = "currahee", n = 8, x, z) {
    const W = {
      currahee: [["u", 0.16, 2600], ["a", 0.18, 1400], ["i", 0.42, 900]],
      firmes: [["i", 0.16, 3200], ["e", 0.28, 4200]],
      adelante: [["a", 0.1], ["e", 0.12, 1800], ["a", 0.14, 1800], ["e", 0.22, 2400]],
      silver: [["i", 0.16, 4500], ["e", 0.3, 1400]],
      granada: [["a", 0.12, 1200], ["a", 0.14, 1600], ["a", 0.24, 1800]],
      sanitario: [["a", 0.1, 4500], ["i", 0.1, 1800], ["a", 0.12, 2400], ["i", 0.1, 1600], ["o", 0.22]],
      vamos: [["a", 0.14, 900], ["o", 0.24, 4200]],
      arriba: [["a", 0.1], ["i", 0.14, 1600], ["a", 0.22, 900]],
    }[word] || [["a", 0.3]];
    this.say(W, { x, z, voices: n, pitch: n > 1 ? 135 : 160, gain: n > 1 ? 0.26 : 0.2, spread: 0.02 });
  }
  whistle(x, z, long = false) {
    if (!this.on) return;
    const p = x !== undefined ? this._pos(x, z) : { d: 0, pan: 0 };
    const o = this._out(p.d, p.pan);
    const t = this.ctx.currentTime;
    const c = this.ctx;
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 2900;
    const trill = c.createOscillator();
    trill.frequency.value = 28;
    const tg = c.createGain();
    tg.gain.value = 140;
    trill.connect(tg).connect(osc.frequency);
    const g = c.createGain();
    const dur = long ? 1.1 : 0.45;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.14, t + 0.02);
    g.gain.setValueAtTime(0.14, t + dur - 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(o);
    osc.start(t);
    trill.start(t);
    osc.stop(t + dur + 0.05);
    trill.stop(t + dur + 0.05);
    this._noise(o, t, dur, { type: "highpass", f0: 5000, gain: 0.03 });
  }
  breath(k = 0.5, pan = 0, loud = 1) {
    // ragged breathing; k 0..1 exhaustion
    if (!this.on) return;
    this._bus = this.voiceBus;
    const o = this._out(0, pan);
    this._bus = null;
    const t = this.ctx.currentTime;
    this._noise(o, t, 0.28 + k * 0.12, { type: "bandpass", f0: 1100 + k * 500, f1: 700, q: 1.2, gain: (0.08 + k * 0.12) * loud, attack: 0.04 });
  }
  stride(soft = 1, pan = 0, at) {
    // boots on dry red clay; `at` schedules it on the audio clock (in step with the cadence)
    if (!this.on) return;
    const o = this._out(0, pan);
    const t = at ?? this.ctx.currentTime;
    this._noise(o, t, 0.07, { f0: 700 + Math.random() * 300, type: "lowpass", gain: 0.18 * soft });
    this._noise(o, t + 0.01, 0.05, { f0: 2600, type: "bandpass", q: 1, gain: 0.05 * soft });
  }
  engine(x, z, dur = 3) {
    // idling Dodge ambulance
    if (!this.on) return;
    const p = this._pos(x, z);
    const o = this._out(p.d, p.pan);
    const t = this.ctx.currentTime;
    this._tone(o, t, dur, 34, { type: "sawtooth", gain: 0.06, attack: 0.3 });
    this._noise(o, t, dur, { f0: 220, type: "lowpass", gain: 0.12, attack: 0.3 });
  }
  // a looping bed for each place (cicadas & hot wind for Georgia; crickets at night)
  startBed(kind) {
    this.wantBed = kind;
    if (!this.on || (this.bed && this.bedKind === kind)) return;
    this.stopBed();
    this.bedKind = kind;
    const c = this.ctx;
    const g = c.createGain();
    g.gain.value = 0;
    g.connect(this.ambBus);
    const nodes = [];
    if (kind === "georgia" || kind === "georgia-noon") {
      // cicada drone: bandpassed noise with a slow pulsing swell
      for (const [f, q, lv] of [[4300, 9, 0.05], [5600, 12, 0.03], [3600, 6, 0.02]]) {
        const s = c.createBufferSource();
        s.buffer = this.noise;
        s.loop = true;
        const bp = c.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = f;
        bp.Q.value = q;
        const sg = c.createGain();
        sg.gain.value = lv;
        const lfo = c.createOscillator();
        lfo.frequency.value = 0.13 + Math.random() * 0.1;
        const lg = c.createGain();
        lg.gain.value = lv * 0.8;
        lfo.connect(lg).connect(sg.gain);
        const am = c.createOscillator();
        am.frequency.value = 38 + Math.random() * 8;
        const amg = c.createGain();
        amg.gain.value = lv * 0.5;
        am.connect(amg).connect(sg.gain);
        s.connect(bp).connect(sg).connect(g);
        s.start(0, Math.random() * 1.9); // random loop offset per layer so the 2 s buffer never lines up
        lfo.start();
        am.start();
        nodes.push(s, lfo, am);
      }
    }
    if (kind === "mess") {
      // a mess hall: low murmur of a hundred men, and now and then a fork on a tin tray
      for (const [f, lv, rt] of [[420, 0.09, 0.7], [760, 0.05, 0.9]]) {
        const m = c.createBufferSource();
        m.buffer = this.noise;
        m.loop = true;
        m.playbackRate.value = rt;
        const bp = c.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = f;
        bp.Q.value = 1.6;
        const mg = c.createGain();
        mg.gain.value = lv;
        const lfo = c.createOscillator();
        lfo.frequency.value = 2.7 + Math.random();
        const lg = c.createGain();
        lg.gain.value = lv * 0.5;
        lfo.connect(lg).connect(mg.gain);
        m.connect(bp).connect(mg).connect(g);
        m.start(0, Math.random() * 1.9);
        lfo.start();
        nodes.push(m, lfo);
      }
      const clink = () => {
        if (!this.bed || this.bedKind !== "mess") return;
        const t = this.ctx.currentTime;
        this._tone(g, t, 0.18, 2200 + Math.random() * 1800, { type: "triangle", gain: 0.02 + Math.random() * 0.02 });
        setTimeout(clink, 300 + Math.random() * 1400);
      };
      setTimeout(clink, 500);
    }
    const s = c.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.playbackRate.value = 0.4;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 300;
    const wg = c.createGain();
    wg.gain.value = 0.12;
    s.connect(lp).connect(wg).connect(g);
    s.start();
    nodes.push(s);
    g.gain.setTargetAtTime(1, c.currentTime, 1.5);
    this.bed = { g, nodes };
  }
  stopBed() {
    if (!this.bed) return;
    const { g, nodes } = this.bed;
    g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.8);
    setTimeout(() => nodes.forEach((n) => { try { n.stop(); } catch {} }), 3000);
    this.bed = null;
    this.bedKind = null;
  }
  setBed(level) {
    this.bed && this.bed.g.gain.setTargetAtTime(level, this.ctx.currentTime, 1.2);
  }
  paper() {
    // UI: a page turned
    if (!this.on) return;
    const o = this._out(0, 0);
    const t = this.ctx.currentTime;
    this._noise(o, t, 0.18, { type: "bandpass", f0: 3200, f1: 1800, q: 0.8, gain: 0.08, attack: 0.03 });
    this._noise(o, t + 0.12, 0.08, { type: "highpass", f0: 4000, gain: 0.04 });
  }
  pencil() {
    if (!this.on) return;
    const o = this._out(0, 0.1);
    const t = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) this._noise(o, t + i * 0.07, 0.06, { type: "bandpass", f0: 5200, q: 3, gain: 0.04 });
  }
  vibrate(ms = 30) {
    try {
      this.vibrateOn !== false && navigator.vibrate && navigator.vibrate(ms);
    } catch {}
  }
}
