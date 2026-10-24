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
    this.master.gain.value = 0.9;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 5;
    this.master.connect(comp).connect(c.destination);
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
    this.verb.connect(this.verbGain).connect(this.master);
    this.on = true;
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
    node.connect(this.master);
    const send = c.createGain();
    send.gain.value = Math.min(0.9, 0.15 + dist * 0.015);
    g.connect(send).connect(this.verb);
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
    s.connect(f).connect(g).connect(this.master);
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
    g.connect(this.master);
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
}
