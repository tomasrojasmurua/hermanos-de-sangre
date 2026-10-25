// Sonidos del campamento, sintetizados como el resto (sin archivos): corneta de armónicos naturales,
// sello de goma, máquina de escribir, pala y conteo coral de la instrucción.
// Los toques (diana, rancho, retreta) son llamadas tradicionales del ejército, de dominio público.

// a field bugle in G has no valves: only the natural harmonics G4 C5 E5 G5 (and C6)
const H = { g: 392, c: 523.25, e: 659.25, G: 783.99, C: 1046.5 };
// [note, beats] — simplified period calls
const CALLS = {
  // first bars of Reveille
  diana: [["g", 0.5], ["c", 0.5], ["e", 0.5], ["c", 0.5], ["g", 0.5], ["c", 0.5], ["e", 1], ["c", 0.5], ["e", 0.5], ["G", 0.5], ["e", 0.5], ["c", 1.5]],
  // Mess call (shortened)
  rancho: [["G", 0.5], ["G", 0.5], ["e", 0.5], ["c", 0.5], ["G", 0.5], ["G", 0.5], ["e", 1], ["c", 0.5], ["e", 0.5], ["G", 1.5]],
  // Taps
  retreta: [["g", 0.75], ["g", 0.25], ["c", 2], ["g", 0.75], ["c", 0.25], ["e", 2], ["g", 0.5], ["c", 0.5], ["e", 1], ["g", 0.5], ["c", 0.5], ["e", 1], ["c", 0.5], ["e", 0.5], ["G", 2.5]],
  // Assembly (formar)
  formar: [["c", 0.5], ["c", 0.5], ["e", 0.5], ["G", 0.5], ["e", 0.5], ["c", 0.5], ["g", 1.5]],
};

export function bugle(audio, kind = "diana", { x, z, bpm = 112 } = {}) {
  if (!audio.on || !CALLS[kind]) return 0;
  const c = audio.ctx;
  // the bugler is across the camp: far, panned, with the hill answering
  const p = x !== undefined ? audio._pos(x, z) : { d: 30, pan: -0.3 };
  const out = audio._out(Math.max(18, p.d), p.pan);
  const spb = 60 / bpm;
  let t = c.currentTime + 0.05;
  for (const [n, beats] of CALLS[kind]) {
    const f = H[n], dur = beats * spb;
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(f * 0.985, t); // lip up into the note
    o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
    const vib = c.createOscillator();
    vib.frequency.value = 5.2;
    const vg = c.createGain();
    vg.gain.value = dur > 0.6 ? f * 0.006 : 0;
    vib.connect(vg).connect(o.frequency);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 1.2;
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(f * 4.2, t + 0.05); // brass brightens as it speaks
    lp.frequency.exponentialRampToValueAtTime(f * 2.6, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.03);
    g.gain.setValueAtTime(0.1, t + dur * 0.75);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.98);
    o.connect(lp).connect(g).connect(out);
    o.start(t);
    vib.start(t);
    o.stop(t + dur + 0.05);
    vib.stop(t + dur + 0.05);
    t += dur;
  }
  return t - c.currentTime;
}

// Sobel's rubber stamp on the schedule: a dull thud and the paper under it
export function stamp(audio) {
  if (!audio.on) return;
  const o = audio._out(0, 0.05);
  const t = audio.ctx.currentTime;
  audio._tone(o, t, 0.12, 120, { f1: 55, gain: 0.5, attack: 0.002 });
  audio._noise(o, t, 0.09, { type: "lowpass", f0: 900, gain: 0.3 });
  audio._noise(o, t + 0.01, 0.05, { type: "bandpass", f0: 2600, q: 1.5, gain: 0.06 });
}

// Evans at the company typewriter: n keystrokes and the carriage bell at the end
export function typewriter(audio, n = 14) {
  if (!audio.on) return;
  const o = audio._out(0, -0.1);
  let t = audio.ctx.currentTime + 0.02;
  for (let i = 0; i < n; i++) {
    audio._noise(o, t, 0.035, { type: "bandpass", f0: 2200 + Math.random() * 900, q: 2.5, gain: 0.16 });
    audio._tone(o, t, 0.03, 180 + Math.random() * 40, { gain: 0.08 });
    t += 0.07 + Math.random() * 0.09 + (Math.random() < 0.15 ? 0.15 : 0);
  }
  audio._tone(o, t + 0.05, 0.6, 2350, { gain: 0.05 }); // ding
  audio._noise(o, t + 0.12, 0.22, { type: "bandpass", f0: 1400, f1: 700, q: 1, gain: 0.08 });
}

// entrenching tool into Georgia clay
export function shovel(audio, x, z) {
  if (!audio.on) return;
  const p = audio._pos(x, z);
  const o = audio._out(p.d, p.pan);
  const t = audio.ctx.currentTime;
  audio._noise(o, t, 0.16, { type: "bandpass", f0: 1800, f1: 700, q: 1.2, gain: 0.14 });
  audio._noise(o, t + 0.2, 0.25, { type: "lowpass", f0: 500, gain: 0.12 });
}

// the rank counting a drill aloud: «¡Uno! ¡Dos! ¡Tres! ¡Cuatro!» as a choir of formant shouts
const COUNT = [[["u", 0.12], ["o", 0.16, 1800]], [["o", 0.2, 2400]], [["e", 0.2, 1300]], [["u", 0.1, 2400], ["a", 0.1, 1300], ["o", 0.14, 2400]]];
export function count(audio, i, { x, z, n = 10 } = {}) {
  if (!audio.on) return;
  audio.say(COUNT[i % 4], { x, z, voices: n, pitch: 140, gain: 0.2, spread: 0.015 });
}
