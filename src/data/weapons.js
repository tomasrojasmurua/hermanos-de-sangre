// Armas: cargador, cadencia, daño, alcance, precisión, recarga, sonido y color de trazadora (solo datos).
export const WEAPONS = {
  knife: { melee: true },
  m1: { clip: 8, rate: 0.3, dmg: 60, range: 42, acc: 0.78, reload: 1.9, sound: "m1", tracer: [3.4, 2.1, 0.8] },
  k98: { clip: 5, rate: 1.5, dmg: 60, range: 45, acc: 0.6, reload: 2.6, sound: "k98", tracer: [3.2, 1.6, 0.6] },
  thompson: { clip: 20, rate: 0.1, dmg: 26, range: 22, acc: 0.42, reload: 2.4, sound: "thompson", tracer: [3.4, 2.1, 0.8] },
  mp40: { clip: 32, rate: 0.12, dmg: 22, range: 24, acc: 0.34, reload: 2.4, sound: "mp40", tracer: [3.2, 1.6, 0.6] },
  mg42: { clip: 50, rate: 0.055, dmg: 24, range: 55, acc: 0.2, reload: 4, sound: "mg", tracer: [3.6, 1.4, 0.45] },
};
