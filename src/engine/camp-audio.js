// Sonidos del campamento, sintetizados como el resto (sin archivos): corneta de armónicos naturales,
// sello de goma, máquina de escribir, pala, cantimplora y conteo coral de la instrucción.
// Los toques (diana, rancho, formar, silencio) son llamadas tradicionales del ejército, de dominio público.

// a field bugle in G has no valves: only its natural harmonics, D4 G4 B4 D5 G5
// (written g c e G C, as bugle calls are notated in C)
const H = { g: 293.66, c: 392, e: 493.88, G: 587.33, C: 783.99 };
// [note, beats] — each call with its own tempo
const CALLS = {
  // Reveille, first strain (dotted, bright)
  diana: { bpm: 120, notes: [["g", 0.5], ["c", 0.5], ["e", 0.75], ["c", 0.25], ["g", 0.5], ["c", 0.5], ["e", 1], ["c", 0.5], ["e", 0.5], ["c", 0.5], ["e", 0.5], ["G", 0.75], ["e", 0.25], ["c", 1.5]] },
  // Mess call (shortened)
  rancho: { bpm: 112, notes: [["G", 0.5], ["G", 0.5], ["e", 0.5], ["c", 0.5], ["G", 0.5], ["G", 0.5], ["e", 1], ["c", 0.5], ["e", 0.5], ["G", 1.5]] },
  // Taps (silencio): all 24 notes, slow, with the long holds
  retreta: { bpm: 54, notes: [
    ["g", 0.75], ["g", 0.25], ["c", 3], ["g", 0.75], ["c", 0.25], ["e", 3],
    ["g", 0.5], ["c", 0.5], ["e", 1.5], ["g", 0.5], ["c", 0.5], ["e", 1.5], ["g", 0.5], ["c", 0.5], ["e", 2.5],
    ["c", 0.75], ["e", 0.25], ["G", 3], ["e", 0.75], ["c", 0.25], ["g", 3], ["g", 0.75], ["g", 0.25], ["c", 4.5],
  ] },
  // Assembly (formar)
  formar: { bpm: 116, notes: [["c", 0.5], ["c", 0.5], ["e", 0.5], ["G", 0.5], ["e", 0.5], ["c", 0.5], ["g", 1.5]] },
};

// total seconds of a call (for waiting on it and ducking the music under it)
export function bugleLen(kind, short = false) {
  const c = CALLS[kind];
  if (!c) return 0;
  const notes = short ? c.notes.slice(0, 3) : c.notes;
  return notes.reduce((t, n) => t + n[1], 0) * (60 / c.bpm);
}

// short = only the opening (fast-forward); level scales it (−6 dB ≈ 0.5)
export function bugle(audio, kind = "diana", { x, z, short = false, level = 1 } = {}) {
  if (!audio.on || !CALLS[kind]) return 0;
  const c = audio.ctx;
  const call = CALLS[kind];
  const notes = short ? call.notes.slice(0, 3) : call.notes;
  const len = bugleLen(kind, short);
  // the bugler is at the flagpole, across the camp: far, panned, with the hill answering
  const p = x !== undefined ? audio._pos(x, z) : { d: 30, pan: -0.3 };
  const out = audio._out(Math.max(18, p.d), p.pan);
  // the score steps aside for the real bugle (two bugles in two keys is the worst thing in a camp)
  audio.duck(len + 1.5, 0.15, 0.3);
  const spb = 60 / call.bpm;
  let t = c.currentTime + 0.05;
  const A = 0.12 * level;
  for (const [n, beats] of notes) {
    const f = H[n], dur = beats * spb;
    const end = t + dur + 0.015; // a hair of legato: the next note's attack covers the gap
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(f * 0.985, t); // lip up into the note
    o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
    // vibrato only on long notes, and only once the note has settled
    const vib = c.createOscillator();
    vib.frequency.value = 5.2;
    const vg = c.createGain();
    vg.gain.setValueAtTime(0, t);
    if (dur > 0.6) vg.gain.linearRampToValueAtTime(f * 0.005, Math.min(t + dur, t + 0.25 + dur * 0.4));
    vib.connect(vg).connect(o.frequency);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 1.2;
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(f * 4.2, t + 0.05); // brass brightens as it speaks
    lp.frequency.exponentialRampToValueAtTime(f * 2.6, end);
    const pk = c.createBiquadFilter(); // the brassy «blat» around 1.2 kHz
    pk.type = "peaking";
    pk.frequency.value = 1200;
    pk.Q.value = 1.5;
    pk.gain.value = 5;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(A, t + 0.03);
    g.gain.linearRampToValueAtTime(A * 0.82, t + Math.max(0.05, dur * 0.8));
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    o.connect(lp).connect(pk).connect(g).connect(out);
    // tongue: a breath of noise on each attack
    audio._noise(out, t, 0.025, { type: "bandpass", f0: f * 3, q: 2, gain: 0.03 * level });
    o.start(t);
    vib.start(t);
    o.stop(end + 0.05);
    vib.stop(end + 0.05);
    t += dur;
  }
  return len;
}

// Sobel's rubber stamp: a thud, with a mid-range body so a phone speaker still hears it
export function stamp(audio, k = 1) {
  if (!audio.on) return;
  const o = audio._out(0, 0.05);
  const t = audio.ctx.currentTime;
  audio._tone(o, t, 0.12, 120, { f1: 55, gain: 0.45 * k, attack: 0.002 });
  audio._noise(o, t, 0.08, { type: "bandpass", f0: 480, q: 2, gain: 0.22 * k });
  audio._noise(o, t, 0.09, { type: "lowpass", f0: 900, gain: 0.25 * k });
  audio._noise(o, t + 0.01, 0.05, { type: "bandpass", f0: 2600, q: 1.5, gain: 0.06 * k });
}

// the company office typewriter: n keystrokes and the carriage bell at the end
export function typewriter(audio, n = 14) {
  if (!audio.on) return;
  const o = audio._out(0, -0.1);
  let t = audio.ctx.currentTime + 0.02;
  for (let i = 0; i < n; i++) {
    audio._noise(o, t, 0.035, { type: "bandpass", f0: 2200 + Math.random() * 900, q: 2.5, gain: 0.16 });
    audio._noise(o, t, 0.03, { type: "bandpass", f0: 420 + Math.random() * 120, q: 2, gain: 0.18 }); // the typebar's body
    t += 0.07 + Math.random() * 0.09 + (Math.random() < 0.15 ? 0.15 : 0);
  }
  audio._tone(o, t + 0.05, 0.6, 2350, { gain: 0.05 }); // ding
  audio._noise(o, t + 0.12, 0.22, { type: "bandpass", f0: 1400, f1: 700, q: 1, gain: 0.08 });
}

// entrenching tool into Georgia clay: never the same stroke twice, now and then the blade rings on a stone
export function shovel(audio, x, z) {
  if (!audio.on) return;
  const p = audio._pos(x, z);
  const o = audio._out(p.d, p.pan);
  const t = audio.ctx.currentTime;
  const v = 0.7 + Math.random() * 0.6, f = 1800 * (0.75 + Math.random() * 0.5);
  audio._noise(o, t, 0.16, { type: "bandpass", f0: f, f1: f * 0.4, q: 1.2, gain: 0.14 * v });
  audio._noise(o, t + 0.18 + Math.random() * 0.1, 0.25, { type: "lowpass", f0: 500, gain: 0.12 * v });
  if (Math.random() < 0.25) audio._tone(o, t + 0.02, 0.05, 2800, { gain: 0.04 });
}

// a canteen weighed in the hand: silence if it's full; a slosh if someone drank
export function slosh(audio) {
  if (!audio.on) return;
  const c = audio.ctx;
  const o = audio._out(0, 0.1);
  const t = c.currentTime;
  const s = c.createBufferSource();
  s.buffer = audio.noise;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 3;
  bp.frequency.setValueAtTime(600, t);
  bp.frequency.exponentialRampToValueAtTime(300, t + 0.5);
  const g = c.createGain();
  g.gain.value = 0;
  const lfo = c.createOscillator();
  lfo.frequency.value = 6;
  const lg = c.createGain();
  lg.gain.value = 0.12;
  lfo.connect(lg).connect(g.gain);
  s.connect(bp).connect(g).connect(o);
  s.start(t);
  lfo.start(t);
  s.stop(t + 0.55);
  lfo.stop(t + 0.55);
}

// the rank counting a drill aloud: «¡Uno! ¡Dos! ¡Tres! ¡Cuatro!» as a choir of formant shouts
const COUNT = [[["u", 0.12], ["o", 0.16, 1800]], [["o", 0.2, 2400]], [["e", 0.2, 1300]], [["u", 0.1, 2400], ["a", 0.1, 1300], ["o", 0.14, 2400]]];
export function count(audio, i, { x, z, n = 10, gain = 0.12 } = {}) {
  if (!audio.on) return;
  audio.say(COUNT[i % 4], { x, z, voices: n, pitch: n > 1 ? 140 : 120, gain, spread: 0.015 });
}

// two short tones when a meter moves: up and bright if it's good news, down and dull if not
export function meterTick(audio, good) {
  if (!audio.on) return;
  const o = audio._out(0, 0.2);
  const t = audio.ctx.currentTime;
  const [a, b] = good ? [880, 1175] : [620, 466];
  audio._tone(o, t, 0.06, a, { gain: 0.03 });
  audio._tone(o, t + 0.07, 0.08, b, { gain: 0.03 });
}
