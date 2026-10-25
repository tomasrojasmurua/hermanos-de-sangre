// Toccoa, Georgia, verano de 1942: barracones de papel alquitranado, la torre de saltos de diez metros,
// el depósito de agua, ambulancias Dodge, pinos de hoja larga y arcilla roja.
import { T, rng, lerp } from "../../engine/util.js";
import { Builder } from "../../engine/geo.js";

const PINE = [0x4f6534, 0x5a6f3a, 0x46602f, 0x627842, 0x3f5729];
const CLAY = 0xa4583a;

// longleaf pine: tall bare trunk, crown of drooping tufts high up
export function pine(world, B, F, x, z, s = 1, r = rng(Math.floor(x * 13 + z * 7))) {
  const y = world.rawHeight(x, z);
  const h = (8 + r() * 5) * s;
  const lean = (r() - 0.5) * 0.06;
  B.cyl(0.12 * s, 0.24 * s, h, 6, r() < 0.5 ? 0x5e4634 : 0x6a4f3a, { x, y: y + h / 2, z, rz: lean }, { jit: 0.12 });
  const crowns = 5 + Math.floor(r() * 3);
  for (let i = 0; i < crowns; i++) {
    const a = r() * 6.28, d = (0.3 + r() * 0.9) * s;
    const hy = y + h * (0.74 + r() * 0.3);
    F.ico((0.75 + r() * 0.5) * s, r.pick(PINE), { x: x + Math.cos(a) * d, y: hy, z: z + Math.sin(a) * d, sy: 0.62, rx: r() * 3, ry: r() * 3 }, { jit: 0.16, grad: { y0: y + h * 0.6, y1: y + h * 1.1, k: 0.4 } });
  }
  // a couple of dead lower branches
  for (let i = 0; i < 2; i++) {
    const a = r() * 6.28;
    B.cyl(0.02, 0.04, 1.0 * s, 4, 0x5e4634, { x: x + Math.cos(a) * 0.4, y: y + h * (0.4 + r() * 0.2), z: z + Math.sin(a) * 0.4, rz: Math.cos(a) * 1.1, rx: Math.sin(a) * 1.1 }, { jit: 0.1 });
  }
  world.addSeg(x - 0.01, z, x + 0.01, z, 0.3 * s, 2, "trunk");
}

export function scrub(world, F, x, z, s = 1, r = rng(Math.floor(x * 5 + z * 11))) {
  const y = world.rawHeight(x, z);
  for (let i = 0; i < 3 + Math.floor(r() * 3); i++)
    F.ico(s * (0.35 + r() * 0.35), r.pick([0x5f7238, 0x6c7a3c, 0x55682f, 0x7a8244]), { x: x + (r() - 0.5) * s * 1.4, y: y + s * 0.3, z: z + (r() - 0.5) * s * 1.4, sy: 0.75, ry: r() * 3 }, { jit: 0.18, grad: { y0: y, y1: y + 1, k: 0.35 } });
}

// tar-paper barracks hut on concrete blocks, with a short stair and screened windows
export function barracks(world, B, x, z, ang, w = 18, d = 6.5) {
  const y = world.rawHeight(x, z);
  const tf = (lx, ly, lz, ex = {}) => ({ x: x + lx * Math.cos(ang) + lz * Math.sin(ang), y: y + ly, z: z - lx * Math.sin(ang) + lz * Math.cos(ang), ry: ang, ...ex });
  for (let i = 0; i <= 6; i++) for (const s of [-1, 1]) B.box(0.35, 0.5, 0.35, 0x9a948a, tf(-w / 2 + 0.4 + (i * (w - 0.8)) / 6, 0.25, (s * (d - 0.6)) / 2));
  B.box(w, 2.7, d, 0x2e302c, tf(0, 0.5 + 1.35, 0), { jit: 0.05 });
  // batten strips over the tar paper
  for (let i = 0; i <= 12; i++) for (const s of [-1, 1]) B.box(0.06, 2.7, 0.04, 0x4a4a42, tf(-w / 2 + (i * w) / 12, 1.85, (s * d) / 2 + s * 0.02));
  // windows (screened, white frames)
  for (let i = 0; i < 6; i++)
    for (const s of [-1, 1]) {
      const lx = -w / 2 + 1.6 + i * ((w - 3.2) / 5);
      B.box(1.0, 0.9, 0.05, 0x1d2022, tf(lx, 2.0, (s * d) / 2 + s * 0.04));
      B.box(1.12, 0.06, 0.06, 0xd8d2c4, tf(lx, 2.48, (s * d) / 2 + s * 0.05));
      B.box(1.12, 0.06, 0.06, 0xd8d2c4, tf(lx, 1.52, (s * d) / 2 + s * 0.05));
      B.box(0.9, 0.06, 0.4, 0x3a3c36, tf(lx, 2.6, (s * d) / 2 + s * 0.22, { rx: s * 0.4 })); // awning flap
    }
  // pitched roof in rolled tar paper
  const rh = 1.3, half = d / 2;
  const slope = Math.atan2(rh, half), len = Math.hypot(rh, half) + 0.3;
  for (const s of [-1, 1]) {
    const lz = (s * half) / 2;
    B.box(w + 0.5, 0.12, len, 0x262826, { x: x + lz * Math.sin(ang), y: y + 3.2 + rh / 2, z: z + lz * Math.cos(ang), ry: ang, rx: s * slope, order: "YXZ" }, { jit: 0.05 });
  }
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) B.box(0.15, rh / 4, d * (1 - (k + 0.5) / 4), 0x2e302c, tf((s * (w - 0.15)) / 2, 3.2 + (rh / 4) * (k + 0.5), 0));
  // door + wooden stair at the gable end
  B.box(0.05, 2, 1.1, 0x6e5a42, tf(w / 2 + 0.03, 1.5, 0));
  for (let k = 0; k < 3; k++) B.box(0.4, 0.12, 1.3, 0x8a7458, tf(w / 2 + 0.3 + k * 0.3, 0.45 - k * 0.15, 0));
  // stove pipe
  B.cyl(0.12, 0.12, 1.3, 6, 0x2a2a2a, tf(-w / 4, 4.3, 0.8));
  world.addRect(x, z, w / 2 + 0.2, d / 2 + 0.2, -ang, 4, "house");
}

export function messHall(world, B, x, z, ang) {
  barracks(world, B, x, z, ang, 22, 9);
  const y = world.rawHeight(x, z);
  B.cyl(0.18, 0.18, 2.2, 6, 0x2a2a2a, { x: x + 3, y: y + 5, z });
}

export function waterTower(world, B, x, z) {
  const y = world.rawHeight(x, z);
  const H = 14;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.box(0.3, H, 0.3, 0x6e5e4a, { x: x + sx * 1.8, y: y + H / 2, z: z + sz * 1.8, rx: -sz * 0.04, rz: sx * 0.04 }, { jit: 0.08 });
  for (let k = 1; k < 4; k++) {
    const hy = y + (H / 4) * k;
    for (const [a, b2] of [[0, 1], [1, 0]]) {
      B.box(a ? 3.8 : 0.12, 0.12, b2 ? 3.8 : 0.12, 0x6e5e4a, { x, y: hy, z: z + 1.8 });
      B.box(a ? 3.8 : 0.12, 0.12, b2 ? 3.8 : 0.12, 0x6e5e4a, { x, y: hy, z: z - 1.8 });
      B.box(0.12, 0.12, 3.8, 0x6e5e4a, { x: x + 1.8, y: hy, z });
      B.box(0.12, 0.12, 3.8, 0x6e5e4a, { x: x - 1.8, y: hy, z });
    }
  }
  B.cyl(2.6, 2.6, 4, 12, 0x7a6a52, { x, y: y + H + 2, z }, { jit: 0.06 });
  for (let i = 0; i < 4; i++) B.cyl(2.65, 2.65, 0.12, 12, 0x3e3a34, { x, y: y + H + 0.5 + i * 1.1, z });
  B.cone(2.8, 1.4, 12, 0x4a463e, { x, y: y + H + 4.7, z });
  world.addRect(x, z, 2.1, 2.1, 0, 3, "tower");
}

// the 10 m mock tower: a man in harness slides down a cable to the ground (book, Toccoa)
export function jumpTower(world, B, x, z, ang) {
  const y = world.rawHeight(x, z);
  const H = 10;
  const tf = (lx, ly, lz, ex = {}) => ({ x: x + lx * Math.cos(ang) + lz * Math.sin(ang), y: y + ly, z: z - lx * Math.sin(ang) + lz * Math.cos(ang), ry: ang, ...ex });
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.box(0.25, H + 1.2, 0.25, 0x7a664c, tf(sx * 1.4, (H + 1.2) / 2, sz * 1.4), { jit: 0.08 });
  for (let k = 1; k <= 5; k++) for (const s of [-1, 1]) {
    B.box(2.9, 0.1, 0.1, 0x7a664c, tf(0, k * 2, s * 1.4, { rz: k % 2 ? 0.6 : -0.6 }));
    B.box(0.1, 0.1, 2.9, 0x7a664c, tf(s * 1.4, k * 2, 0, { rx: k % 2 ? 0.6 : -0.6 }));
  }
  B.box(3.2, 0.18, 3.2, 0x8a7458, tf(0, H, 0));
  for (const s of [-1, 1]) B.box(3.2, 1, 0.08, 0x8a7458, tf(0, H + 0.6, s * 1.6));
  // stairs zig-zag
  for (let k = 0; k < 10; k++) B.box(0.8, 0.08, 0.3, 0x8a7458, tf(1.9, k + 0.5, -1.2 + (k % 2) * 2.4));
  // the cable to a post 30 m away
  const len = 30;
  const ex = x + Math.sin(ang + Math.PI / 2) * len, ez = z + Math.cos(ang + Math.PI / 2) * len;
  const ey = world.rawHeight(ex, ez) + 1.6;
  const mx = (x + ex) / 2, mz = (z + ez) / 2, my = (y + H + 0.6 + ey) / 2;
  const dl = Math.hypot(ex - x, ez - z), dy = ey - (y + H + 0.6);
  B.box(0.03, 0.03, Math.hypot(dl, dy), 0x2a2a2a, { x: mx, y: my, z: mz, ry: Math.atan2(ex - x, ez - z), rx: -Math.atan2(dy, dl), order: "YXZ" });
  B.post(0.3, 2, 0.3, 0x6e5e4a, { x: ex, y: ey - 1.6, z: ez });
  // sawdust pit at the end
  B.box(4, 0.08, 4, 0xc8b48a, { x: ex - Math.sin(ang + Math.PI / 2) * 2, y: ey - 1.58, z: ez - Math.cos(ang + Math.PI / 2) * 2, ry: ang });
  world.addRect(x, z, 1.7, 1.7, -ang, 3, "tower");
}

export function flagpole(world, B, x, z) {
  const y = world.rawHeight(x, z);
  B.cyl(0.06, 0.1, 12, 6, 0xd8d2c4, { x, y: y + 6, z });
  B.sphere(0.14, 6, 4, 0xd0b060, { x, y: y + 12.1, z });
  // a flag hanging limp in the heat: stripes and the blue canton
  for (let i = 0; i < 7; i++) B.box(0.03, 0.14, 1.8, i % 2 ? 0xe8e2d4 : 0xa8322a, { x, y: y + 11.6 - i * 0.14, z: z + 0.95, rx: 0.06 * i });
  B.box(0.035, 0.56, 0.8, 0x2c3a6a, { x, y: y + 11.4, z: z + 0.45 });
  B.box(1.4, 0.25, 1.4, 0xbab4a6, { x, y: y + 0.12, z });
}

// Dodge WC54 field ambulance: boxy olive body, red crosses on white squares
export function ambulance(B, o = {}) {
  const c = 0x5a5e3e;
  B.box(1.9, 1.2, 1.9, c, { y: 1.1, z: 1.6 }); // cab & hood
  B.box(1.7, 0.6, 1.3, c, { y: 0.95, z: 2.9 }); // hood
  B.box(1.6, 0.5, 0.05, 0x2a2c24, { y: 1.95, z: 2.55 }); // windshield
  B.box(2.1, 1.9, 3.4, c, { y: 1.55, z: -0.9 }); // box body
  for (const s of [-1, 1]) {
    B.box(0.04, 0.8, 0.8, 0xe8e2d4, { x: s * 1.06, y: 1.7, z: -0.9 });
    B.box(0.05, 0.55, 0.16, 0xa8322a, { x: s * 1.07, y: 1.7, z: -0.9 });
    B.box(0.05, 0.16, 0.55, 0xa8322a, { x: s * 1.07, y: 1.7, z: -0.9 });
  }
  B.box(0.8, 0.8, 0.04, 0xe8e2d4, { y: 2.6, z: -0.2, rx: -0.3 });
  for (const [sx, sz] of [[-1, 2.3], [1, 2.3], [-1, -1.6], [1, -1.6]]) B.cyl(0.42, 0.42, 0.3, 10, 0x222220, { x: sx * 0.95, y: 0.42, z: sz, rz: Math.PI / 2 });
  B.box(1.95, 0.12, 0.2, 0x3a3c32, { y: 0.55, z: 3.55 }); // bumper
  for (const s of [-1, 1]) B.box(0.2, 0.2, 0.06, 0xe8dcb0, { x: s * 0.6, y: 1.05, z: 3.56 }); // lamps
}

export function sign(world, B, x, z, ang) {
  const y = world.rawHeight(x, z);
  for (const s of [-1, 1]) B.post(0.15, 2.2, 0.15, 0x6e5a42, { x: x + Math.cos(ang) * s * 1.6, y, z: z - Math.sin(ang) * s * 1.6 });
}

export function benches(world, B, x, z, ang, n = 4) {
  for (let i = 0; i < n; i++) {
    const lx = (i - n / 2) * 2.4;
    const px = x + lx * Math.cos(ang), pz = z - lx * Math.sin(ang);
    const y = world.rawHeight(px, pz);
    B.box(2, 0.08, 0.35, 0x8a7458, { x: px, y: y + 0.45, z: pz, ry: ang });
    for (const s of [-1, 1]) B.box(0.08, 0.45, 0.3, 0x6e5a42, { x: px + Math.cos(ang) * s * 0.85, y: y + 0.22, z: pz - Math.sin(ang) * s * 0.85, ry: ang });
  }
}

export function crates(world, B, x, z, r = rng(Math.floor(x * 3 + z))) {
  const y = world.rawHeight(x, z);
  for (let i = 0; i < 3; i++) B.box(0.7, 0.5, 0.5, r.pick([0x7a6a4a, 0x6e5e42, 0x857250]), { x: x + (r() - 0.5) * 1.4, y: y + 0.25 + (i === 2 ? 0.5 : 0), z: z + (r() - 0.5) * 1.2, ry: r() * 3 }, { jit: 0.1 });
}

export function oilDrum(world, B, x, z) {
  const y = world.rawHeight(x, z);
  B.cyl(0.3, 0.3, 0.9, 8, 0x4a5236, { x, y: y + 0.45, z }, { jit: 0.1 });
  B.cyl(0.31, 0.31, 0.05, 8, 0x30342a, { x, y: y + 0.6, z });
}

export { CLAY };
