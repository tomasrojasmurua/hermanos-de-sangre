// Props for Normandy: bocage, orchards, stone farms, the Brécourt guns, trenches, paratrooper debris.
// Everything is low-poly with painted vertex colour, merged into a handful of meshes per category.
import { T, rng, lerp } from "./util.js";
import { Builder } from "./geo.js";

const GREENS = [0x3f5a2c, 0x46622f, 0x354e27, 0x4e6a33, 0x2f4824, 0x557238];
const DARKGREEN = [0x2c4021, 0x33492a, 0x283a1f];
// moonlit foliage: deep blue-greens
const NIGHT_G = [0x2f4a3a, 0x35523f, 0x2a4235, 0x3b5a44, 0x26402f, 0x40604a], NIGHT_D = [0x223629, 0x283e30, 0x1f3226];
// June daylight: fresher, yellower leaves; night keeps the deep greens
export function setFoliage(day) {
  const g = day ? [0x56634f, 0x5e6b55, 0x4f5c48, 0x67735c, 0x4a5644, 0x6d785f] : NIGHT_G;
  const d = day ? [0x424e3c, 0x485542, 0x3e4a38] : NIGHT_D;
  GREENS.splice(0, GREENS.length, ...g);
  DARKGREEN.splice(0, DARKGREEN.length, ...d);
}

// ---- hedgerow: earth bank + dense shrub mass + standing trees ------------------------------------
export function hedge(world, B, F, pts, o = {}) {
  const r = rng(o.seed || pts.length * 13 + Math.floor(pts[0][0] * 7));
  const H = o.h ?? 2.6;
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, az] = pts[k], [bx, bz] = pts[k + 1];
    world.raises.push({ ax, az, bx, bz, w: 1.6, h: 0.55 });
    world.addSeg(ax, az, bx, bz, 0.95, H, "hedge");
    const L = Math.hypot(bx - ax, bz - az);
    const n = Math.ceil(L / 0.52);
    const nx = -(bz - az) / L, nz = (bx - ax) / L;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = lerp(ax, bx, t), z = lerp(az, bz, t);
      // three staggered rows of shrubs (hawthorn, hazel, holly) on the earth bank
      for (let row = -1; row <= 1; row++) {
        if (row !== 0 && r() < 0.08) continue;
        const off = row * 0.62 + (r() - 0.5) * 0.35;
        const px = x + nx * off + (r() - 0.5) * 0.3, pz = z + nz * off + (r() - 0.5) * 0.3;
        const s = 0.5 + r() * 0.42;
        const y = world.rawHeight(px, pz);
        const top = row === 0 ? 0.9 + r() * 0.7 : 0.25 + r() * 0.5;
        const col = r() < 0.18 ? r.pick(DARKGREEN) : r.pick(GREENS);
        F.ico(s, col, { x: px, y: y + 0.45 + s * 0.6 + top, z: pz, sy: 0.82 + r() * 0.35, rx: r() * 3, ry: r() * 3 }, { jit: 0.16, grad: { y0: y, y1: y + 2.8, k: 0.32 } });
        // leafy sprigs poking out of the mass
        if (r() < 0.5) {
          const a = r() * 6.28;
          F.cone(0.16, 0.5 + r() * 0.4, 4, r.pick(GREENS), { x: px + Math.cos(a) * s * 0.8, y: y + 0.5 + top + s * 0.9, z: pz + Math.sin(a) * s * 0.8, rx: Math.sin(a) * 0.7, rz: -Math.cos(a) * 0.7 }, { jit: 0.2 });
        }
      }
      // foot of the hedge: ferns, brambles and cow parsley in flower
      for (const side of [-1, 1]) {
        if (r() < 0.35) continue;
        const d = 1.15 + r() * 0.5;
        const px = x + nx * side * d, pz = z + nz * side * d;
        const y = world.rawHeight(px, pz);
        if (r() < 0.55) F.ico(0.28 + r() * 0.22, r.pick([0x4a6232, 0x5b6d38, 0x3c5228, 0x627a3a]), { x: px, y: y + 0.18, z: pz, sy: 0.65, ry: r() * 3 }, { jit: 0.18 });
        else {
          for (let k = 0; k < 3; k++) F.box(0.012, 0.7, 0.012, 0x5d7038, { x: px + (r() - 0.5) * 0.4, y: y + 0.35, z: pz + (r() - 0.5) * 0.4 });
          for (let k = 0; k < 3; k++) F.ico(0.11, 0xe8e3d0, { x: px + (r() - 0.5) * 0.45, y: y + 0.72 + r() * 0.08, z: pz + (r() - 0.5) * 0.45, sy: 0.45 }, { jit: 0.08 });
        }
      }
      // trees rising out of the hedge every so often
      if (o.trees !== false && r() < (o.treeK ?? 0.05)) tree(world, B, F, x + nx * 0.2, z + nz * 0.2, 0.9 + r() * 0.6, r);
    }
  }
}

export function tree(world, B, F, x, z, s = 1, r = rng(Math.floor(x * 31 + z * 17))) {
  const y = world.rawHeight(x, z);
  const h = (4.5 + r() * 2.5) * s;
  B.cyl(0.18 * s, 0.32 * s, h * 0.7, 6, 0x4a3d30, { x, y: y + h * 0.35, z, rz: (r() - 0.5) * 0.1 }, { jit: 0.1 });
  B.cyl(0.08 * s, 0.12 * s, 1.6 * s, 5, 0x4a3d30, { x: x + 0.5 * s, y: y + h * 0.62, z, rz: -0.8 }, { jit: 0.1 });
  const crowns = 8 + Math.floor(r() * 4);
  const tone = 0.88 + r() * 0.24, warm = r() < 0.3;
  for (let i = 0; i < crowns; i++) {
    const a = r() * 6.28, d = (0.4 + r() * 1.3) * s;
    const hy = h * (0.66 + r() * 0.36);
    const c = new T.Color(r.pick(GREENS)).multiplyScalar(tone);
    if (warm) c.offsetHSL(0.02, 0, 0);
    F.ico((0.85 + r() * 0.6) * s, c.getHex(), { x: x + Math.cos(a) * d, y: y + hy, z: z + Math.sin(a) * d, sy: 0.78, rx: r() * 3, ry: r() * 3 }, { jit: 0.14, grad: { y0: y + h * 0.45, y1: y + h * 1.15, k: 0.38 } });
  }
  world.addSeg(x - 0.01, z, x + 0.01, z, 0.35 * s, 1.5, "trunk");
}

export function appleTree(world, B, F, x, z, s = 1, r = rng(Math.floor(x * 11 + z * 29))) {
  const y = world.rawHeight(x, z);
  const lean = (r() - 0.5) * 0.35;
  B.cyl(0.13 * s, 0.2 * s, 1.5 * s, 6, 0x5a4a3a, { x, y: y + 0.75 * s, z, rz: lean }, { jit: 0.1 });
  for (let i = 0; i < 3; i++) {
    const a = r() * 6.28;
    B.cyl(0.05 * s, 0.09 * s, 1.3 * s, 5, 0x5a4a3a, { x: x + Math.cos(a) * 0.4 * s, y: y + 1.8 * s, z: z + Math.sin(a) * 0.4 * s, rx: Math.sin(a) * 0.7, rz: -Math.cos(a) * 0.7 }, { jit: 0.1 });
  }
  for (let i = 0; i < 5; i++) {
    const a = r() * 6.28, d = r() * 1.1 * s;
    F.ico((0.85 + r() * 0.5) * s, r.pick([0x4f6a30, 0x5a7536, 0x46612c]), { x: x + Math.cos(a) * d, y: y + (2.2 + r() * 0.6) * s, z: z + Math.sin(a) * d, sy: 0.75, ry: r() * 3 }, { jit: 0.12 });
  }
  // a few small green apples
  for (let i = 0; i < 6; i++) {
    const a = r() * 6.28, d = 0.6 + r() * 0.8;
    B.ico(0.07, 0x9aa64a, { x: x + Math.cos(a) * d * s, y: y + (1.7 + r() * 0.5) * s, z: z + Math.sin(a) * d * s }, { jit: 0.1 });
  }
  world.addSeg(x - 0.01, z, x + 0.01, z, 0.22 * s, 1.4, "trunk");
}

export function fence(world, B, pts, o = {}) {
  const r = rng(7);
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, az] = pts[k], [bx, bz] = pts[k + 1];
    const L = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(L / 2.4));
    const ang = Math.atan2(bx - ax, bz - az);
    for (let i = 0; i <= n; i++) {
      const x = lerp(ax, bx, i / n), z = lerp(az, bz, i / n);
      const y = world.rawHeight(x, z);
      B.post(0.09, 1.25, 0.09, 0x6b5a46, { x, y: y - 0.05, z, rz: (r() - 0.5) * 0.12 }, { jit: 0.15 });
      if (i < n) {
        const mx = lerp(ax, bx, (i + 0.5) / n), mz = lerp(az, bz, (i + 0.5) / n);
        const my = world.rawHeight(mx, mz);
        for (const hh of o.rails ? [0.5, 0.95] : [0.55, 0.95]) B.box(0.03, o.rails ? 0.08 : 0.015, L / n, o.rails ? 0x7a6650 : 0x3a3a38, { x: mx, y: my + hh, z: mz, ry: ang }, { jit: 0.1 });
      }
    }
  }
}

export function gate(world, B, x, z, ang) {
  const y = world.rawHeight(x, z);
  B.post(0.18, 1.5, 0.18, 0x5c4c3c, { x: x - Math.cos(ang) * 1.7, y, z: z + Math.sin(ang) * 1.7 });
  // gate left half-open on its hinge
  const a2 = ang + 0.9;
  const hx = x + Math.cos(ang) * 1.7, hz = z - Math.sin(ang) * 1.7;
  B.post(0.18, 1.5, 0.18, 0x5c4c3c, { x: hx, y, z: hz });
  for (let i = 0; i < 4; i++) B.box(2.6, 0.09, 0.06, 0x8a7a62, { x: hx - Math.cos(a2) * 1.3, y: y + 0.35 + i * 0.27, z: hz + Math.sin(a2) * 1.3, ry: a2 }, { jit: 0.1 });
  B.box(2.8, 0.09, 0.06, 0x8a7a62, { x: hx - Math.cos(a2) * 1.3, y: y + 0.75, z: hz + Math.sin(a2) * 1.3, ry: a2, rz: 0.34 }, { jit: 0.1 });
}

// ---- Normandy stone buildings -------------------------------------------------------------------
// gabled roof done properly (used by buildings that need a clean silhouette)
export function roof(B, x, y, z, ang, w, d, rh, color) {
  const half = d / 2;
  const slope = Math.atan2(rh, half);
  const len = Math.hypot(rh, half) + 0.25;
  for (const s of [-1, 1]) {
    const lz = (s * half) / 2;
    B.box(w + 0.5, 0.18, len, color, {
      x: x + lz * Math.sin(ang), y: y + rh / 2, z: z + lz * Math.cos(ang),
      ry: ang, rx: s * slope, order: "YXZ",
    }, { jit: 0.07 });
  }
}

export function stoneHouse(world, B, x, z, ang, w = 8, d = 6, o = {}) {
  const y = world.rawHeight(x, z) - 0.25;
  const r = rng(Math.floor(x * 7 + z * 3));
  const H = o.h || 4;
  const stone = o.stone || 0x988d7a;
  const tf = (lx, ly, lz) => ({ x: x + lx * Math.cos(ang) + lz * Math.sin(ang), y: y + ly, z: z - lx * Math.sin(ang) + lz * Math.cos(ang), ry: ang });
  B.box(w, H, d, stone, tf(0, H / 2, 0), { jit: 0.07, grad: { y0: y, y1: y + H, k: 0.3 } });
  for (let i = 0; i < 16; i++) {
    const face = r() < 0.5 ? 1 : -1;
    B.box(0.5 + r() * 0.9, 0.25, 0.06, r() < 0.5 ? 0x7e7462 : 0xb0a592, tf((r() - 0.5) * (w - 1), 0.3 + r() * (H - 0.6), (face * d) / 2 + face * 0.02), { jit: 0.1 });
  }
  const rh = o.rh || 3;
  // gable fill: stacked boxes
  for (const s of [-1, 1]) for (let k = 0; k < 5; k++) B.box(0.25, rh / 5, d * (1 - (k + 0.5) / 5), stone, tf((s * (w - 0.25)) / 2, H + (rh / 5) * (k + 0.5), 0), { jit: 0.06 });
  roof(B, x, y + H - 0.05, z, ang, w, d, rh, o.roof || 0x3c3f46);
  if (o.chimney !== false) B.box(0.75, 2, 0.75, 0x8a7f6c, tf(w / 2 - 1.1, H + rh - 0.3, 0.7), { jit: 0.08 });
  for (const lx of o.windows || [-w / 3, w / 3]) {
    for (const s of [-1, 1]) {
      B.box(0.95, 1.05, 0.08, o.lit ? 0x8a5a2a : 0x17181c, tf(lx, H * 0.56, (s * d) / 2 + s * 0.03));
      B.box(0.42, 1.1, 0.06, o.shutter || 0x4f6250, tf(lx - 0.7, H * 0.56, (s * d) / 2 + s * 0.05));
      B.box(0.42, 1.1, 0.06, o.shutter || 0x4f6250, tf(lx + 0.7, H * 0.56, (s * d) / 2 + s * 0.05));
    }
  }
  B.box(1.1, 2.1, 0.12, 0x4a3a2c, tf(o.doorX ?? 0, 1.05, d / 2 + 0.04));
  world.addRect(x, z, w / 2 + 0.15, d / 2 + 0.15, -ang, H + rh * 0.7, "house");
}

export function barn(world, B, x, z, ang, w = 10, d = 7) {
  const y = world.rawHeight(x, z) - 0.2;
  const tf = (lx, ly, lz) => ({ x: x + lx * Math.cos(ang) + lz * Math.sin(ang), y: y + ly, z: z - lx * Math.sin(ang) + lz * Math.cos(ang), ry: ang });
  // timber frame + cob walls
  B.box(w, 3.2, d, 0xa49274, tf(0, 1.6, 0), { jit: 0.08, grad: { y0: y, y1: y + 3.2, k: 0.3 } });
  for (let i = 0; i <= 5; i++) {
    const lx = -w / 2 + (w / 5) * i;
    for (const s of [-1, 1]) B.box(0.16, 3.2, 0.06, 0x4b3a2a, tf(lx, 1.6, (s * d) / 2 + s * 0.03));
  }
  for (const s of [-1, 1]) B.box(w, 0.14, 0.06, 0x4b3a2a, tf(0, 1.7, (s * d) / 2 + s * 0.035));
  for (const s of [-1, 1]) for (let k = 0; k < 5; k++) B.box(0.2, 0.7, d * (1 - (k + 0.5) / 5), 0xa49274, tf((s * (w - 0.2)) / 2, 3.2 + 0.7 * (k + 0.5), 0));
  roof(B, x, y + 3.15, z, ang, w, d, 3.5, 0x5b4a36);
  B.box(2.6, 2.6, 0.12, 0x3b2e22, tf(0, 1.3, d / 2 + 0.05));
  world.addRect(x, z, w / 2 + 0.1, d / 2 + 0.1, -ang, 5, "house");
}

export function church(world, B, x, z, ang) {
  const y = world.rawHeight(x, z) - 0.3;
  const tf = (lx, ly, lz) => ({ x: x + lx * Math.cos(ang) + lz * Math.sin(ang), y: y + ly, z: z - lx * Math.sin(ang) + lz * Math.cos(ang), ry: ang });
  B.box(18, 8, 9, 0x8f8574, tf(0, 4, 0), { jit: 0.06 });
  roof(B, x, y + 7.9, z, ang, 18, 9, 4.5, 0x3a3c42);
  B.box(5, 16, 5, 0x928878, tf(-10, 8, 0), { jit: 0.06 });
  B.cone(3.9, 9, 4, 0x3a3c42, { ...tf(-10, 20.5, 0), ry: ang + Math.PI / 4 });
  for (const s of [-1, 1]) B.box(0.9, 2.6, 0.1, 0x14151a, tf(-10 + s * 0.0, 12.5, s * 2.53));
  world.addRect(x, z, 11, 5, -ang, 12, "house");
}

// ---- military ----------------------------------------------------------------------------------
export function sandbags(world, B, pts, rows = 2) {
  const r = rng(Math.floor(pts[0][0] * 9));
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, az] = pts[k], [bx, bz] = pts[k + 1];
    const L = Math.hypot(bx - ax, bz - az);
    const ang = Math.atan2(bx - ax, bz - az);
    const n = Math.max(1, Math.round(L / 0.55));
    for (let row = 0; row < rows; row++)
      for (let i = 0; i < n; i++) {
        const t = (i + (row % 2) * 0.5) / n;
        if (t > 1) continue;
        const x = lerp(ax, bx, t), z = lerp(az, bz, t);
        B.box(0.32, 0.2, 0.56, r.pick([0x8c7d5c, 0x7d6f52, 0x968764]), { x, y: world.rawHeight(x, z) + 0.1 + row * 0.19, z, ry: ang + (r() - 0.5) * 0.15, rz: (r() - 0.5) * 0.1 }, { jit: 0.1 });
      }
  }
}

export function gun105(B, x, y, z, ang, o = {}) {
  // leFH 18 field howitzer: split trail, shield, long barrel, spoked wheels
  const tf = (lx, ly, lz, extra = {}) => ({ x: x + lx * Math.cos(ang) + lz * Math.sin(ang), y: y + ly, z: z - lx * Math.sin(ang) + lz * Math.cos(ang), ry: ang, ...extra });
  const c = o.wrecked ? 0x2b2a27 : 0x6a7060;
  for (const s of [-1, 1]) {
    B.cyl(0.62, 0.62, 0.16, 12, 0x2e2f2a, tf(s * 0.95, 0.62, 0, { rz: Math.PI / 2 }), { jit: 0.05 });
    B.cyl(0.18, 0.18, 0.2, 8, 0x4a4b40, tf(s * 0.95, 0.62, 0, { rz: Math.PI / 2 }));
    B.box(0.16, 0.16, 3.4, c, tf(s * 0.45, 0.32, -1.8, { ry: ang + s * 0.22 }), { jit: 0.06 });
    B.box(0.4, 0.12, 0.3, c, tf(s * 0.82, 0.15, -3.4));
  }
  B.box(1.9, 0.12, 0.22, c, tf(0, 0.62, 0)); // axle
  B.box(2.0, 1.1, 0.07, c, tf(0, 1.15, 0.25, { rx: -0.12 }), { jit: 0.05 }); // shield
  B.box(0.55, 0.45, 1.5, c, tf(0, 1.0, 0.2)); // cradle
  if (!o.wrecked) {
    B.cyl(0.11, 0.13, 3.1, 8, 0x4b4d42, tf(0, 1.2, 1.7, { rx: Math.PI / 2 - (o.elev || 0.18) }));
    B.cyl(0.15, 0.15, 0.35, 8, 0x3d3f36, tf(0, 1.48, 3.15, { rx: Math.PI / 2 - (o.elev || 0.18) }));
  } else {
    // breech blown open "like a half-peeled banana"
    for (let i = 0; i < 4; i++) B.box(0.08, 0.06, 1.1, 0x23221f, tf(Math.cos(i * 1.57) * 0.18, 1.25 + Math.sin(i * 1.57) * 0.18, 1.1, { rx: Math.PI / 2 - 0.2 + Math.sin(i * 1.57) * 0.5, rz: Math.cos(i * 1.57) * 0.5 }));
  }
  // shells and casings
  for (let i = 0; i < 6; i++) B.cyl(0.055, 0.06, 0.45, 6, i % 2 ? 0xb08a3a : 0x6d6a5a, tf(-1.6 + i * 0.12, 0.05, -0.8 - (i % 3) * 0.2, { rz: Math.PI / 2, ry: ang + i }));
  B.box(0.9, 0.35, 0.5, 0x5a5640, tf(1.6, 0.17, -1.2)); // ammo box
}

export function camoNet(F, x, y, z, ang, w = 7, d = 7) {
  const r = rng(Math.floor(x * 13));
  for (let i = 0; i < 16; i++) {
    const lx = (r() - 0.5) * w, lz = (r() - 0.5) * d;
    const sag = 1 - (Math.abs(lx) / w + Math.abs(lz) / d);
    F.box(0.9 + r() * 0.7, 0.05, 0.9 + r() * 0.7, r.pick([0x4c5a32, 0x5a6038, 0x3f4a2a, 0x6b6440]), { x: x + lx * Math.cos(ang) + lz * Math.sin(ang), y: y + 2.3 + sag * 0.9, z: z - lx * Math.sin(ang) + lz * Math.cos(ang), ry: r() * 3, rx: (r() - 0.5) * 0.3 }, { jit: 0.15 });
  }
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) F.cyl(0.04, 0.05, 2.6, 4, 0x5a4a3a, { x: x + (sx * w * 0.45) * Math.cos(ang) + sz * d * 0.45 * Math.sin(ang), y: y + 1.3, z: z - sx * w * 0.45 * Math.sin(ang) + sz * d * 0.45 * Math.cos(ang) });
}

// trench: carve the ground + plank revetment + sandbag lips
export function trench(world, B, pts, w = 0.9, d = 1.5) {
  for (let k = 0; k < pts.length - 1; k++) world.carves.push({ ax: pts[k][0], az: pts[k][1], bx: pts[k + 1][0], bz: pts[k + 1][1], w, d });
  return () => {
    // after heights are baked: revetment planks + parapet
    const r = rng(Math.floor(pts[0][0] * 17));
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, az] = pts[k], [bx, bz] = pts[k + 1];
      const L = Math.hypot(bx - ax, bz - az);
      const ang = Math.atan2(bx - ax, bz - az);
      const nx = -(bz - az) / L, nz = (bx - ax) / L;
      const n = Math.max(1, Math.round(L / 1.1));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const x = lerp(ax, bx, t), z = lerp(az, bz, t);
        for (const s of [-1, 1]) {
          const px = x + nx * s * (w * 0.62), pz = z + nz * s * (w * 0.62);
          const top = world.rawHeight(x + nx * s * (w + 0.7), z + nz * s * (w + 0.7));
          B.box(0.06, d * 0.9, 1.05, r.pick([0x5e4c38, 0x6b5640, 0x524331]), { x: px, y: top - d * 0.45, z: pz, ry: ang }, { jit: 0.12 });
          if (r() < 0.7) B.box(0.34, 0.2, 0.56, r.pick([0x8c7d5c, 0x7d6f52]), { x: x + nx * s * (w + 0.35), y: top + 0.08, z: z + nz * s * (w + 0.35), ry: ang + (r() - 0.5) * 0.2 }, { jit: 0.1 });
        }
        if (r() < 0.12) B.box(0.5, 0.3, 0.35, 0x5a5640, { x, y: world.rawHeight(x, z) + 0.15, z, ry: r() * 3 }); // ammo crate
      }
    }
  };
}

// ---- paratroopers, aircraft, animals ------------------------------------------------------------
export function canopy(B, x, y, z, o = {}) {
  // a collapsed silk canopy: a low crumpled dome with radial folds, rigging lines to the harness
  const r = rng(Math.floor(x * 19 + z * 7));
  const col = o.color || 0xc9c6b8;
  const dark = new T.Color(col).multiplyScalar(0.72).getHex();
  if (o.hang) {
    // caught in a tree: draped over the crown, panels hanging down
    B.sphere(1.9, 10, 4, col, { x, y, z, sy: 0.32, rx: (r() - 0.5) * 0.5, rz: (r() - 0.5) * 0.5 }, { jit: 0.1 });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * 6.28 + r() * 0.4;
      B.box(0.7, 1.4 + r() * 0.8, 0.05, i % 2 ? col : dark, { x: x + Math.cos(a) * 1.6, y: y - 0.7, z: z + Math.sin(a) * 1.6, ry: -a + Math.PI / 2, rx: 0.15 }, { jit: 0.1 });
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * 6.28;
      B.box(0.012, 2.8, 0.012, 0xa8a294, { x: x + Math.cos(a) * 0.9, y: y - 1.6, z: z + Math.sin(a) * 0.9, rx: Math.sin(a) * 0.32, rz: -Math.cos(a) * 0.32 });
    }
    return;
  }
  const ang = o.ang || 0;
  const cx = x + Math.sin(ang) * 2.2, cz = z + Math.cos(ang) * 2.2;
  B.sphere(1.8, 12, 4, col, { x: cx, y: y + 0.02, z: cz, sx: 1.25, sy: 0.16, sz: 1.0, ry: ang }, { jit: 0.12 });
  // folds: alternating light/dark gores fanning out from the apex
  for (let i = 0; i < 10; i++) {
    const a = ang + (i / 10) * 6.28;
    const L = 1.5 + r() * 0.6;
    B.box(0.32, 0.1 + r() * 0.12, L, i % 2 ? col : dark, { x: cx + Math.sin(a) * L * 0.5, y: y + 0.14 + r() * 0.06, z: cz + Math.cos(a) * L * 0.5, ry: a, rz: (r() - 0.5) * 0.3 }, { jit: 0.08 });
  }
  // rigging lines converging on the harness
  for (let i = 0; i < 8; i++) {
    const a = ang + Math.PI + (i / 8 - 0.5) * 1.6;
    const ex = cx + Math.sin(a) * 1.6, ez = cz + Math.cos(a) * 1.6;
    const mx = (ex + x) / 2, mz = (ez + z) / 2;
    const L = Math.hypot(ex - x, ez - z);
    B.box(0.012, 0.012, L, 0xa8a294, { x: mx, y: y + 0.05, z: mz, ry: Math.atan2(ex - x, ez - z) });
  }
}

export function legBag(B, x, y, z, ang = 0) {
  B.box(0.32, 0.3, 0.95, 0x6a6448, { x, y: y + 0.15, z, ry: ang, rz: 0.1 }, { jit: 0.08 });
  B.box(0.34, 0.06, 0.2, 0x8f8a66, { x, y: y + 0.31, z, ry: ang }, { jit: 0.05 });
}

export function bundle(B, x, y, z, color = 0x8a5040) {
  // A-5 supply container with its coloured chute
  B.cyl(0.32, 0.32, 1.7, 8, 0x5f5e48, { x, y: y + 0.32, z, rz: Math.PI / 2 }, { jit: 0.06 });
  canopy(B, x + 1.2, y, z + 0.8, { color, ang: 1.2 });
}

export function c47(B, o = {}) {
  // Skytrain silhouette (built at origin, nose toward +z)
  const c = 0x2c2f2b;
  B.cyl(1.05, 0.7, 13, 8, c, { z: 0, rx: Math.PI / 2 });
  B.sphere(1.05, 8, 5, c, { z: 6.6, sz: 1.5 });
  B.cyl(0.7, 0.2, 4, 8, c, { z: -8.2, rx: Math.PI / 2 });
  B.box(29, 0.28, 3.4, c, { y: -0.2, z: 1.5 });
  B.box(9, 0.18, 2, c, { y: 0.3, z: -9.2 });
  B.box(0.2, 3, 2.4, c, { y: 1.6, z: -9.3 });
  for (const s of [-1, 1]) {
    B.cyl(0.6, 0.6, 2.6, 8, c, { x: s * 5.2, y: -0.2, z: 3, rx: Math.PI / 2 });
    B.box(0.12, 0.12, 0.12, o.lit ? 0xff6030 : c, { x: s * 5.2, y: -0.2, z: 1.6 });
  }
  // invasion stripes (pale) on wings
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) B.box(1.1, 0.3, 3.45, 0x8a8a84, { x: s * (7 + i * 2.2), y: -0.2, z: 1.5 });
}

export function c47Wreck(world, B, x, z, ang) {
  const y = world.rawHeight(x, z);
  const tf = (lx, ly, lz, ex = {}) => ({ x: x + lx * Math.cos(ang) + lz * Math.sin(ang), y: y + ly, z: z - lx * Math.sin(ang) + lz * Math.cos(ang), ry: ang, ...ex });
  const c = 0x2a2b27;
  B.cyl(1.05, 0.95, 7, 8, c, tf(0, 0.9, 0, { rx: Math.PI / 2, rz: 0.15 }), { jit: 0.1 });
  B.cyl(0.85, 0.3, 4.5, 8, 0x1d1e1b, tf(0.8, 0.7, -6.2, { rx: Math.PI / 2 - 0.12, rz: 0.4 }), { jit: 0.1 });
  B.box(10, 0.25, 3, c, tf(5.5, 0.35, 0.8, { rz: -0.1 }), { jit: 0.1 });
  B.box(4, 0.25, 2.6, 0x1a1b18, tf(-4.5, 0.25, 0.8, { rz: 0.3 }), { jit: 0.1 });
  B.box(0.2, 2.6, 2.1, c, tf(1.2, 1.5, -8, { rz: 0.5 }));
  for (let i = 0; i < 10; i++) B.box(0.3 + Math.random() * 0.8, 0.05, 0.3 + Math.random() * 0.6, 0x1d1e1b, tf((Math.random() - 0.5) * 12, 0.05, (Math.random() - 0.5) * 12, { ry: Math.random() * 3 }));
  world.addRect(x, z, 2, 6, -ang, 2, "wreck");
}

export function cow(world, B, x, z, ang, o = {}) {
  // Normande cow: cream body with brown patches and "spectacles"; lying down or dead on its side
  const y = world.rawHeight(x, z);
  const r = rng(Math.floor(x * 41 + z * 23));
  const tf = (lx, ly, lz, ex = {}) => ({ x: x + lx * Math.cos(ang) + lz * Math.sin(ang), y: y + ly, z: z - lx * Math.sin(ang) + lz * Math.cos(ang), ry: ang, ...ex });
  const cream = 0xd8cfbb, brown = 0x6b4630;
  if (o.dead) {
    B.box(0.95, 0.85, 2.0, cream, tf(0, 0.45, 0, { rz: Math.PI / 2 - 0.1 }), { jit: 0.05 });
    B.box(0.5, 0.88, 0.8, brown, tf(0.0, 0.47, 0.3, { rz: Math.PI / 2 - 0.1 }));
    B.box(0.45, 0.5, 0.65, cream, tf(0.2, 0.3, 1.25, { rz: 1.4 }));
    for (const lz of [-0.7, 0.6]) for (const s of [0, 0.3]) B.box(0.14, 0.75, 0.14, cream, tf(0.65 + s, 0.75, lz, { rz: Math.PI / 2 - 0.5 }));
    return;
  }
  B.box(1.0, 0.8, 2.0, cream, tf(0, 0.55, 0), { jit: 0.05 });
  B.box(1.02, 0.6, 0.7, brown, tf(0, 0.62, -0.3 + r() * 0.5));
  B.box(0.5, 0.55, 0.7, cream, tf(0, 0.85, 1.3, { rx: 0.4 }));
  B.box(0.52, 0.2, 0.25, brown, tf(0, 0.95, 1.45, { rx: 0.4 }));
  B.box(0.6, 0.06, 0.06, 0xcfc6ae, tf(0, 1.12, 1.2));
  for (const lx of [-0.35, 0.35]) for (const lz of [-0.7, 0.7]) B.box(0.16, 0.25, 0.4, cream, tf(lx, 0.12, lz));
  world.addRect(x, z, 0.6, 1.2, -ang, 1.1, "cow");
}

export function hangingPara(B, x, y, z) {
  // a paratrooper hanging dead from a tree: silhouette only, no gore
  canopy(B, x, y + 2.4, z, { hang: true });
  B.box(0.4, 0.6, 0.25, 0x6a6447, { x, y: y - 0.6, z });
  B.box(0.32, 0.6, 0.22, 0x5e5a42, { x, y: y - 1.15, z, rz: 0.06 });
  B.sphere(0.17, 6, 4, 0x4d5136, { x, y: y - 0.15, z, rx: 0.4 });
}

export function cart(world, B, x, z, ang) {
  const y = world.rawHeight(x, z);
  const tf = (lx, ly, lz, ex = {}) => ({ x: x + lx * Math.cos(ang) + lz * Math.sin(ang), y: y + ly, z: z - lx * Math.sin(ang) + lz * Math.cos(ang), ry: ang, ...ex });
  B.box(1.6, 0.12, 2.6, 0x6e5a42, tf(0, 0.8, 0), { jit: 0.1 });
  for (const s of [-1, 1]) B.box(0.08, 0.5, 2.6, 0x5e4a36, tf(s * 0.78, 1.05, 0));
  for (const s of [-1, 1]) B.cyl(0.6, 0.6, 0.1, 10, 0x4b3a2a, tf(s * 0.9, 0.6, 0.2, { rz: Math.PI / 2 }));
  B.box(0.1, 0.1, 2.4, 0x5e4a36, tf(0.25, 0.45, 2.1, { rx: 0.3 }));
  B.box(0.1, 0.1, 2.4, 0x5e4a36, tf(-0.25, 0.45, 2.1, { rx: 0.3 }));
  world.addRect(x, z, 0.9, 1.4, -ang, 1.2, "cart");
}

export function pole(world, B, x, z, h = 6) {
  const y = world.rawHeight(x, z);
  B.cyl(0.1, 0.13, h, 5, 0x4a3d30, { x, y: y + h / 2, z, rz: 0.03 });
  B.box(1.2, 0.1, 0.1, 0x4a3d30, { x, y: y + h - 0.4, z });
}

export function well(world, B, x, z) {
  const y = world.rawHeight(x, z);
  B.cyl(0.8, 0.85, 0.9, 10, 0x8f8574, { x, y: y + 0.45, z }, { jit: 0.1 });
  B.cyl(0.6, 0.6, 0.92, 10, 0x15161a, { x, y: y + 0.47, z });
  for (const s of [-1, 1]) B.post(0.12, 1.8, 0.12, 0x4b3a2a, { x: x + s * 0.7, y, z });
  B.box(1.6, 0.1, 0.1, 0x4b3a2a, { x, y: y + 1.75, z });
  world.addRect(x, z, 0.85, 0.85, 0, 1, "well");
}

// ---- loose clutter: what makes a field feel lived-in and fought-over ----------------------------
export function clutter(world, B, F, n, ok, o = {}) {
  const r = rng(o.seed || 77);
  const war = o.war ?? 0.25;
  for (let i = 0, tries = 0; i < n && tries < n * 8; tries++) {
    const x = (r() - 0.5) * world.size * 0.92, z = (r() - 0.5) * world.size * 0.92;
    if (!ok(x, z)) continue;
    let blocked = false;
    for (const s of world.segs) if (s.kind === "hedge" && segD(x, z, s) < s.r + 0.8) { blocked = true; break; }
    if (blocked) continue;
    i++;
    const y = world.rawHeight(x, z);
    const k = r();
    if (k < 0.28) {
      // bush: a few lumps of hawthorn / bramble
      const s = 0.45 + r() * 0.5;
      for (let j = 0; j < 3 + Math.floor(r() * 3); j++) F.ico(s * (0.6 + r() * 0.5), r.pick(GREENS), { x: x + (r() - 0.5) * s * 1.6, y: y + s * 0.45, z: z + (r() - 0.5) * s * 1.6, sy: 0.75, ry: r() * 3 }, { jit: 0.16, grad: { y0: y, y1: y + 1.2, k: 0.35 } });
      if (s > 0.7) world.addSeg(x - 0.01, z, x + 0.01, z, s * 0.7, 1.0, "bush");
    } else if (k < 0.42) {
      // tall grass / reeds patch
      for (let j = 0; j < 9; j++) {
        const px = x + (r() - 0.5) * 1.4, pz = z + (r() - 0.5) * 1.4;
        F.cone(0.09, 0.7 + r() * 0.5, 3, r.pick([0x7c8f48, 0x6e8040, 0x8e9a52]), { x: px, y: world.rawHeight(px, pz) + 0.35, z: pz, rx: (r() - 0.5) * 0.4, rz: (r() - 0.5) * 0.4 }, { jit: 0.2 });
      }
    } else if (k < 0.52) {
      // rocks
      for (let j = 0; j < 1 + Math.floor(r() * 3); j++) B.ico(0.18 + r() * 0.3, r.pick([0x7a776d, 0x8a8678, 0x6a675f]), { x: x + (r() - 0.5), y: y + 0.05, z: z + (r() - 0.5), sy: 0.55, ry: r() * 3 }, { jit: 0.2 });
    } else if (k < 0.6) {
      // fallen branch / log
      const a = r() * 3.14;
      B.cyl(0.07 + r() * 0.06, 0.1 + r() * 0.06, 1.4 + r() * 1.6, 5, 0x5a4a3a, { x, y: y + 0.1, z, rz: Math.PI / 2, ry: a }, { jit: 0.12 });
      if (r() < 0.5) B.cyl(0.03, 0.04, 0.7, 4, 0x5a4a3a, { x: x + Math.cos(a) * 0.3, y: y + 0.25, z: z - Math.sin(a) * 0.3, rz: 0.9, ry: a + 1 }, { jit: 0.12 });
    } else if (k < 0.7) {
      // molehills and churned earth
      for (let j = 0; j < 3; j++) B.ico(0.16 + r() * 0.1, 0x4a3d2e, { x: x + (r() - 0.5) * 1.5, y: y, z: z + (r() - 0.5) * 1.5, sy: 0.5 }, { jit: 0.2 });
    } else if (k < 0.82) {
      // wild flowers: poppies, buttercups, cornflowers
      const col = r.pick([0xb8322a, 0xe0c84a, 0x5a72b8, 0xe8e2d0]);
      for (let j = 0; j < 8; j++) {
        const px = x + (r() - 0.5) * 1.6, pz = z + (r() - 0.5) * 1.6;
        const py = world.rawHeight(px, pz);
        F.box(0.012, 0.42, 0.012, 0x56703a, { x: px, y: py + 0.21, z: pz });
        F.ico(0.055, col, { x: px, y: py + 0.44, z: pz, sy: 0.6 }, { jit: 0.1 });
      }
    } else if (r() < war) {
      // the war: dropped kit
      const w = r();
      if (w < 0.3) B.sphere(0.17, 7, 4, 0x4d5136, { x, y: y + 0.08, z, sy: 0.75, rx: r() * 0.8, rz: r() * 0.8 }); // helmet
      else if (w < 0.55) {
        const a = r() * 3.14;
        B.box(0.05, 0.07, 1.05, 0x5a3c26, { x, y: y + 0.05, z, ry: a });
        B.box(0.03, 0.03, 0.45, 0x2a2b2c, { x: x + Math.sin(a) * 0.4, y: y + 0.09, z: z + Math.cos(a) * 0.4, ry: a });
      } else if (w < 0.75) B.box(0.3, 0.2, 0.18, 0x5a5640, { x, y: y + 0.1, z, ry: r() * 3 }); // ammo can
      else if (w < 0.88) B.box(0.22, 0.06, 0.12, 0x8a7a50, { x, y: y + 0.03, z, ry: r() * 3 }); // ration box
      else canopy(B, x, y, z, { ang: r() * 6, color: r() < 0.5 ? 0xc9c2a8 : 0x9aa080 });
    } else {
      for (let j = 0; j < 2; j++) B.ico(0.16, 0x7a776d, { x: x + (r() - 0.5), y: y + 0.04, z: z + (r() - 0.5), sy: 0.5 }, { jit: 0.2 });
    }
  }
}
function segD(x, z, s) {
  const dx = s.bx - s.ax, dz = s.bz - s.az;
  const l2 = dx * dx + dz * dz || 1e-6;
  const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / l2));
  return Math.hypot(x - (s.ax + dx * t), z - (s.az + dz * t));
}
