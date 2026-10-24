// Chapter: Día D. Part 1 — the night jump near Sainte-Mère-Église (stealth, a bayonet and a cricket).
// Part 2 — Brécourt Manor, 08:30 (raw assault on the 105 mm battery). Based on Ambrose, ch. «¡Seguidme!».
import { T, rng, clamp, lerp, fbm, smooth } from "../../engine/util.js";
import { Builder, meshFrom, U, mat } from "../../engine/geo.js";
import { World, buildGround, scatter } from "../../core/world.js";
import * as P from "../../core/props.js";
import { setGrade } from "../../engine/render.js";
import { sky, lights, tuft, signTexture } from "../../engine/stage.js";

// level frame: u = forward (screen up), v = lateral (screen right). Camera yaw π/4.
const F = [-Math.SQRT1_2, -Math.SQRT1_2], R = [Math.SQRT1_2, -Math.SQRT1_2];
const S0 = [35.35, 35.35];
export const W = (u, v) => [S0[0] + F[0] * u + R[0] * v, S0[1] + F[1] * u + R[1] * v];
const WL = (list) => list.map(([u, v]) => W(u, v));
const ANG = Math.atan2(F[0], F[1]); // facing "forward" (toward +u)

export { CAST } from "../../data/dia-d-cast.js";

// earth showing on the hedge banks (brown, scuffed), strongest at the foot of the hedge
const BANK_N = new T.Color().setRGB(0.24, 0.21, 0.19, "srgb");
const BANK_D = new T.Color().setRGB(0.36, 0.29, 0.21, "srgb");
function bankK(world, x, z) {
  let best = 9;
  for (const r of world.raises) {
    if (x < Math.min(r.ax, r.bx) - 2 || x > Math.max(r.ax, r.bx) + 2 || z < Math.min(r.az, r.bz) - 2 || z > Math.max(r.az, r.bz) + 2) continue;
    const dx = r.bx - r.ax, dz = r.bz - r.az;
    const l2 = dx * dx + dz * dz || 1e-6;
    const t = Math.max(0, Math.min(1, ((x - r.ax) * dx + (z - r.az) * dz) / l2));
    best = Math.min(best, Math.hypot(x - r.ax - dx * t, z - r.az - dz * t));
  }
  return smooth(1.9, 0.9, best) * 0.75 * (0.7 + fbm(x * 0.9, z * 0.9, 2) * 0.6);
}

// ================================================================================================
// PART 1 · NIGHT
// ================================================================================================
export function buildNight(ctx) {
  const { scene, q } = ctx;
  P.setFoliage(false);
  const world = new World(150);
  world.base = (x, z) => (fbm(x * 0.02 + 7, z * 0.02 - 1, 3) - 0.5) * 2.0;
  const B = new Builder(11), Fo = new Builder(12), Bf = new Builder(13);
  const r = rng(6);
  // ---- hedges (bocage) in (u,v)
  const H = (list, o) => P.hedge(world, B, Fo, WL(list), o);
  H([[-8, -27], [108, -27]], { treeK: 0.07 });
  H([[-8, 27], [108, 27]], { treeK: 0.07 });
  H([[-7, -27], [-7, 27]]);
  H([[107, -27], [107, 27]]);
  H([[20, -27], [20, -14]]); H([[20, -9.5], [20, 27]], { treeK: 0.08 });
  H([[46, -27], [46, 4]], { treeK: 0.06 }); H([[46, 8.5], [46, 27]]);
  H([[74, -27], [74, -23.2]]); H([[74, -18.8], [74, -4.5]]); H([[74, 0], [74, 27]], { treeK: 0.06 });
  H([[100, -27], [100, 5]]); H([[100, 9.5], [100, 27]]);
  // outer fields beyond the corridor (background, also blocks the view)
  H([[-8, -50], [108, -50]], { trees: true, treeK: 0.1 });
  H([[-8, 50], [108, 50]], { trees: true, treeK: 0.1 });
  H([[30, -27], [30, -50]]); H([[70, -27], [70, -50]]); H([[40, 27], [40, 50]]); H([[85, 27], [85, 50]]);
  P.gate(world, B, ...W(20, -11.8), ANG + Math.PI / 2);
  P.gate(world, B, ...W(46, 6.2), ANG + Math.PI / 2);
  P.gate(world, B, ...W(100, 7.2), ANG + Math.PI / 2);
  // sunken lane in field 3 (cover for the patient)
  world.carves.push({ ax: W(48, -21)[0], az: W(48, -21)[1], bx: W(72, -21)[0], bz: W(72, -21)[1], w: 1.7, d: 0.85 });
  // road at u≈96 with ditches
  world.carves.push({ ax: W(93.5, -27)[0], az: W(93.5, -27)[1], bx: W(93.5, 27)[0], bz: W(93.5, 27)[1], w: 0.7, d: 0.55 });
  // town edge (Sainte-Mère-Église) to the right of the corridor, burning church
  const church = W(36, 64);
  // shell craters from the naval bombardment that fell short
  for (const [u, v] of [[33, -10], [58, 14], [84, -18]]) world.carves.push({ ax: W(u, v)[0], az: W(u, v)[1], bx: W(u, v)[0], bz: W(u, v)[1], w: 1.6, d: 0.7, crater: true });
  world.bakeHeights(0.5);
  // ---- props
  P.church(world, B, church[0], church[1], ANG + 0.3);
  P.stoneHouse(world, B, ...W(20, 58), ANG + 0.2, 9, 6, { lit: true });
  P.stoneHouse(world, B, ...W(52, 60), ANG - 0.1, 8, 6);
  P.stoneHouse(world, B, ...W(8, 62), ANG, 7, 6);
  for (const [u, v] of [[4, -16], [12, 14], [9, -22], [26, -2], [30, 8], [34, -16], [38, -4], [40, 6], [24, 12], [28, -10], [42, -14], [36, 22]]) P.appleTree(world, B, Fo, ...W(u + r() * 2, v + r() * 2), 0.9 + r() * 0.35);
  for (const [u, v] of [[52, 18], [60, -6], [66, 20], [80, -10], [86, 10], [92, -22], [56, -14]]) P.tree(world, B, Fo, ...W(u, v), 0.7 + r() * 0.6);
  P.cow(world, B, ...W(10, -12), ANG + 1.2);
  P.cow(world, B, ...W(14, 8), ANG - 0.4);
  P.cow(world, B, ...W(58, 2), ANG + 2.1, { dead: true });
  P.cow(world, B, ...W(84, 18), ANG + 0.6);
  P.canopy(B, ...(() => { const [x, z] = W(4.2, -2.6); return [x, world.height(x, z), z]; })(), { ang: ANG + 0.6 });
  const bag = W(16.5, 21);
  P.legBag(B, bag[0], world.height(...bag), bag[1], 0.4);
  P.c47Wreck(world, B, ...W(35, 18), ANG + 0.9);
  const hang = W(25.5, -21);
  P.tree(world, B, Fo, hang[0], hang[1], 1.1);
  P.hangingPara(B, hang[0] + 0.8, world.height(...hang) + 4.3, hang[1] + 0.4);
  P.bundle(B, ...(() => { const [x, z] = W(42, -21); return [x, world.height(x, z), z]; })(), 0x3e3530);
  P.bundle(B, ...(() => { const [x, z] = W(81, 22); return [x, world.height(x, z), z]; })(), 0x4a5f80);
  P.cart(world, B, ...W(62, 10), ANG + 0.7);
  for (const [u, v] of [[56, -2], [64, 4], [70, -12]]) {
    const [x, z] = W(u, v);
    B.cyl(1.2, 1.5, 1.6, 8, 0xa38f5c, { x, y: world.height(x, z) + 0.7, z }, { jit: 0.1 });
    B.cone(1.25, 1.1, 8, 0x9a8656, { x, y: world.height(x, z) + 2.05, z }, { jit: 0.1 });
    world.addRect(x, z, 1.4, 1.4, 0, 2.4, "hay");
  }
  for (let i = 0; i < 9; i++) P.pole(world, B, ...W(97.5, -24 + i * 6.2), 6);
  P.fence(world, B, WL([[90, -27], [90, -14]]));
  // Sainte-Mère-Église road sign (low concrete marker, the one Lipton read with his fingers)
  const sg = W(94.8, 4.5);
  B.box(1.6, 0.55, 0.3, 0xa9a292, { x: sg[0], y: world.height(...sg) + 0.28, z: sg[1], ry: ANG + Math.PI / 2 });
  world.addRect(sg[0], sg[1], 0.8, 0.2, -(ANG + Math.PI / 2), 0.6, "sign");
  const signM = new T.Mesh(new T.PlaneGeometry(1.5, 0.38), new T.MeshStandardMaterial({ map: signTexture("STE MÈRE-ÉGLISE"), roughness: 0.9 }));
  signM.position.set(sg[0] + Math.sin(ANG + Math.PI / 2) * 0.16, world.height(...sg) + 0.3, sg[1] + Math.cos(ANG + Math.PI / 2) * 0.16);
  signM.rotation.y = ANG + Math.PI / 2;
  scene.add(signM);
  P.clutter(world, B, Fo, Math.floor(720 * q.props), (x, z) => {
    const dx = x - S0[0], dz = z - S0[1];
    const u = dx * F[0] + dz * F[1];
    return Math.abs(u - 96.5) > 2.5;
  }, { seed: 61, war: 0.45 });
  // ---- ground colouring: bocage fields have their own tone; trodden lanes; dark under hedges
  const fieldTone = (u) => (u < 20 ? 0 : u < 46 ? 1 : u < 74 ? 2 : 3);
  const tones = [[0.3, 0.38, 0.29], [0.28, 0.37, 0.28], [0.32, 0.39, 0.3], [0.31, 0.38, 0.31]];
  const ground = buildGround(world, (x, z, h, c) => {
    const dx = x - S0[0], dz = z - S0[1];
    const u = dx * F[0] + dz * F[1], v = dx * R[0] + dz * R[1];
    const t = tones[fieldTone(u)];
    const n = fbm(x * 0.15, z * 0.15, 3);
    c.setRGB(t[0] * (0.8 + n * 0.45), t[1] * (0.8 + n * 0.45), t[2] * (0.8 + n * 0.4), "srgb");
    const road = smooth(2.6, 1.4, Math.abs(u - 96.5));
    const lane = smooth(2.2, 1.0, Math.abs(v + 21)) * (u > 46 && u < 74 ? 1 : 0);
    const mud = Math.max(road, lane * 0.8);
    c.lerp(new T.Color().setRGB(0.33, 0.3, 0.27, "srgb"), mud * 0.85);
    if (h < -0.4) c.multiplyScalar(0.8);
    c.lerp(BANK_N, bankK(world, x, z));
  }, 0.7);
  scene.add(ground);
  const mB = meshFrom(B, "world"), mF = meshFrom(Fo, "foliage");
  scene.add(mB, mF);
  // grass, flowers, stones (instanced)
  const N = Math.floor(9000 * q.grass);
  scene.add(scatter(world, (b) => tuft(b, 0x5f7c5c), N, (x, z, rr, col) => {
    const dx = x - S0[0], dz = z - S0[1];
    const u = dx * F[0] + dz * F[1];
    if (Math.abs(u - 96.5) < 2) return null;
    if (fbm(x * 0.22, z * 0.22, 2) < 0.45 && rr() < 0.75) return null;
    col.setRGB(0.75 + rr() * 0.4, 0.8 + rr() * 0.4, 0.6 + rr() * 0.3);
    return { scale: 0.7 + rr() * 0.9, sy: 0.8 + rr() * 0.8, color: col };
  }, "foliage", 21));
  scene.add(scatter(world, (b) => { b.ico(0.06, 0xd8d4c4, { y: 0.35 }); b.box(0.01, 0.35, 0.01, 0x4a6030, { y: 0.17 }); }, Math.floor(1400 * q.grass), (x, z, rr, col) => {
    col.setRGB(1, 1, rr() < 0.3 ? 0.6 : 1);
    return { scale: 0.8 + rr() * 0.6, color: col };
  }, "foliage", 22));
  scene.add(scatter(world, (b) => b.ico(0.18, 0x6c6a62, { y: 0.05, sy: 0.6 }, { jit: 0.2 }), 260, (x, z, rr, col) => ({ scale: 0.5 + rr() * 1.4, color: col.setRGB(0.8 + rr() * 0.3, 0.8 + rr() * 0.3, 0.8 + rr() * 0.3) }), "world", 23));
  // ---- sky & light: blue moonlit night (cold, never black)
  scene.background = new T.Color(0x0d1626);
  scene.fog = new T.Fog(0x1a2640, 56, 112);
  sky(scene, 0x0c1630, 0x1c2a44);
  const L = lights(scene, { sky: 0x2a3d68, ground: 0x0c1018, hemi: 0.85, sunCol: 0xa9bfe2, sun: 2.4, dir: [-0.35, 0.8, 0.45], shadow: q.shadow });
  U.worldRim.value.setRGB(0.55, 0.68, 0.95);
  U.rimColor.value.setRGB(0.28, 0.26, 0.2);
  U.rimEnemy.value.setRGB(0.16, 0.18, 0.21);
  // warm accents in the cold: a haystack set alight by tracer, and farms burning on the horizon
  const extraFires = [{ u: 70, v: -12, y: 1.6, s: 1.1, light: 9 }, { u: 58, v: 20, y: 0.3, s: 0.7, light: 7 }, { u: 108, v: -42, y: 0, s: 2.2 }, { u: -12, v: 46, y: 0, s: 2.4 }];
  // church fire: warm light far off to the right
  // (no point light for the far church: its glow is particles + bloom, lights are precious on phones)
  const fire = null;
  U.fireCol.value.setRGB(0, 0, 0);
  // stars
  const sg2 = new T.BufferGeometry();
  const sp = [];
  for (let i = 0; i < 500; i++) {
    const a = Math.random() * Math.PI * 2, e = 0.15 + Math.random() * 1.2;
    sp.push(Math.cos(a) * Math.cos(e) * 350, Math.sin(e) * 350, Math.sin(a) * Math.cos(e) * 350);
  }
  sg2.setAttribute("position", new T.Float32BufferAttribute(sp, 3));
  const stars = new T.Points(sg2, new T.PointsMaterial({ color: 0x9fb0d0, size: 1.4, sizeAttenuation: false, fog: false }));
  scene.add(stars);
  return { world, L, church, fire, bag, extraFires };
}

export function gradeNight(post) {
  setGrade(post, { topGlow: [0.09, 0.035, 0.012], exposure: 1.55, sat: 0.6, con: 1.1, shT: [0.8, 0.92, 1.26], hiT: [1.0, 1.0, 1.02], lift: [0.012, 0.022, 0.05], vig: 0.62, grain: 0.06, bloomK: 0.7 });
}

// ================================================================================================
// PART 2 · BRÉCOURT MANOR (08:30)
// ================================================================================================
export const GUNS = [[60, -9], [67, 4], [73, 16], [80, 28]];
export const TRENCH = [[52, -16], [56, -12], [60, -9], [63, -3], [67, 4], [70, 10], [73, 16], [76, 22], [80, 28], [84, 33]];

export function buildBrecourt(ctx) {
  const { scene, q } = ctx;
  P.setFoliage(true);
  const world = new World(150);
  world.base = (x, z) => (fbm(x * 0.018 - 3, z * 0.018 + 9, 3) - 0.5) * 1.8;
  const B = new Builder(31), Fo = new Builder(32);
  const r = rng(9);
  const H = (list, o) => P.hedge(world, B, Fo, WL(list), o);
  // the long hedgerow that leads to the battery (the base of fire sits along it)
  // double hedge = sunken lane the assault group uses to close in unseen; gaps are the MG firing slits
  H([[-6, -24.5], [57, -24.5]], { treeK: 0.08 });
  H([[-6, -18], [35.5, -18]], { treeK: 0.06 }); H([[38, -18], [41.5, -18]], { trees: false }); H([[44, -18], [52.5, -18]], { trees: false });
  H([[62, -24.5], [104, -24.5]], { treeK: 0.06 });
  H([[-6, 40], [104, 40]], { treeK: 0.06 });
  H([[-7, -24.5], [-7, 40]]);
  H([[105, -24.5], [105, 40]]);
  // the far hedgerow behind the guns (and around the manor)
  H([[88, -24.5], [88, 6]], { treeK: 0.1 });
  H([[88, 12], [88, 40]], { treeK: 0.1 });
  // jumping-off hedge (Le Grand Chemin side)
  H([[10, -18], [10, 10]]); H([[10, 15], [10, 40]]);
  // trench network
  const finishTrench = P.trench(world, B, WL(TRENCH), 0.85, 1.55);
  const spur1 = P.trench(world, B, WL([[60, -9], [57, -2]]), 0.75, 1.4);
  const spur2 = P.trench(world, B, WL([[67, 4], [71, -2]]), 0.75, 1.4);
  const spur3 = P.trench(world, B, WL([[73, 16], [77, 12]]), 0.75, 1.4);
  // gun pits
  for (const [u, v] of GUNS) world.carves.push({ ax: W(u, v)[0], az: W(u, v)[1], bx: W(u, v)[0], bz: W(u, v)[1], w: 3.2, d: 0.9, crater: true });
  // a few old craters across the field
  for (const [u, v] of [[30, 6], [44, 18], [38, -6], [52, 26]]) world.carves.push({ ax: W(u, v)[0], az: W(u, v)[1], bx: W(u, v)[0], bz: W(u, v)[1], w: 1.8, d: 0.8, crater: true });
  world.bakeHeights(0.5);
  finishTrench(); spur1(); spur2(); spur3();
  // guns under nets
  const gunPos = GUNS.map(([u, v]) => W(u, v));
  gunPos.forEach(([x, z], i) => {
    const y = world.height(x, z);
    const gB = new Builder(40 + i);
    P.gun105(gB, x, y, z, ANG + 0.35, {});
    const m = meshFrom(gB, "world");
    m.userData.gun = i;
    scene.add(m);
    gunPos[i].mesh = m;
    world.addRect(x, z, 1.1, 1.6, -(ANG + 0.35), 1.4, "gun");
    P.camoNet(Fo, x, y, z, ANG + 0.35, 7, 7);
    P.sandbags(world, B, WL([[GUNS[i][0] - 3, GUNS[i][1] - 3], [GUNS[i][0] - 3.4, GUNS[i][1] + 2], [GUNS[i][0] + 1, GUNS[i][1] + 4.2]]), 3);
  });
  // Brécourt Manor and its outbuildings beyond the guns
  P.stoneHouse(world, B, ...W(96, 16), ANG + 0.1, 12, 7, { h: 5.5, rh: 3.6, windows: [-4, 0, 4], shutter: 0x6a5a48 });
  P.barn(world, B, ...W(94, 30), ANG + 0.15 + Math.PI / 2, 10, 7);
  P.stoneHouse(world, B, ...W(97, 0), ANG - 0.2, 7, 5.5, { h: 3.6, rh: 2.6 });
  P.well(world, B, ...W(92, 10));
  P.cart(world, B, ...W(90, 22), ANG + 1.9);
  // field dressing: cows grazing at a distance, apple trees near the manor, posts
  for (const [u, v] of [[92, -10], [100, 6], [96, -6], [101, 26], [99, 36]]) P.appleTree(world, B, Fo, ...W(u, v), 1);
  for (const [u, v] of [[20, 30], [24, -10], [36, 34], [30, 18], [6, 22], [2, -10]]) P.tree(world, B, Fo, ...W(u, v), 0.7 + r() * 0.6);
  P.cow(world, B, ...W(28, 30), ANG + 1);
  P.cow(world, B, ...W(34, 26), ANG + 2.6);
  P.cow(world, B, ...W(46, 32), ANG + 0.3, { dead: true });
  P.canopy(B, ...(() => { const [x, z] = W(26, 12); return [x, world.height(x, z), z]; })(), { ang: 1.2 });
  P.canopy(B, ...(() => { const [x, z] = W(6, -12); return [x, world.height(x, z), z]; })(), { ang: 2.1, color: 0xb9b1a0 });
  P.legBag(B, ...(() => { const [x, z] = W(4, 2); return [x, world.height(x, z), z]; })(), 0.9);
  // the tree Lipton climbs
  const lipTree = W(47, 2);
  P.tree(world, B, Fo, lipTree[0], lipTree[1], 1.15);
  P.clutter(world, B, Fo, Math.floor(760 * q.props), (x, z) => {
    if (world.height(x, z) < -0.3) return false;
    for (const [u, v] of GUNS) { const [gx, gz] = W(u, v); if (Math.hypot(x - gx, z - gz) < 7) return false; }
    return true;
  }, { seed: 62, war: 0.35 });
  // ground
  const ground = buildGround(world, (x, z, h, c) => {
    const n = fbm(x * 0.13, z * 0.13, 3);
    c.setRGB(0.4 * (0.84 + n * 0.36), 0.45 * (0.84 + n * 0.36), 0.33 * (0.82 + n * 0.32), "srgb");
    if (h < -0.35) c.lerp(new T.Color().setRGB(0.42, 0.34, 0.24, "srgb"), clamp((-h - 0.35) * 0.9, 0, 0.9));
    c.lerp(BANK_D, bankK(world, x, z));
  }, 0.7);
  scene.add(ground);
  scene.add(meshFrom(B, "world"), meshFrom(Fo, "foliage"));
  const N = Math.floor(11000 * q.grass);
  scene.add(scatter(world, (b) => tuft(b, 0x7a8a5a), N, (x, z, rr, col) => {
    if (world.height(x, z) < -0.5) return null;
    if (fbm(x * 0.22, z * 0.22, 2) < 0.45 && rr() < 0.75) return null;
    col.setRGB(0.8 + rr() * 0.35, 0.85 + rr() * 0.35, 0.65 + rr() * 0.3);
    return { scale: 0.7 + rr() * 1.0, sy: 0.9 + rr() * 0.9, color: col };
  }, "foliage", 41));
  scene.add(scatter(world, (b) => { b.ico(0.07, 0xe6dc7a, { y: 0.4 }); b.box(0.01, 0.4, 0.01, 0x55703a, { y: 0.2 }); }, Math.floor(1800 * q.grass), (x, z, rr, col) => {
    const k = rr();
    col.setRGB(1, k < 0.4 ? 1 : 0.95, k < 0.4 ? 0.4 : 1);
    return { scale: 0.8 + rr() * 0.6, color: col };
  }, "foliage", 42));
  scene.add(scatter(world, (b) => b.ico(0.18, 0x7a776d, { y: 0.05, sy: 0.6 }, { jit: 0.2 }), 300, (x, z, rr, col) => ({ scale: 0.5 + rr() * 1.4, color: col.setRGB(1, 1, 1) }), "world", 43));
  // dawn light: low sun ahead through mist, long shadows toward the camera; cool ground fill
  scene.background = new T.Color(0xb8c2c2);
  scene.fog = new T.Fog(0xc3ccc9, 54, 104);
  sky(scene, 0xa9b6be, 0xd2d2c6);
  const L = lights(scene, { sky: 0xb4c0c4, ground: 0x464a3e, hemi: 1.2, sunCol: 0xeae4d6, sun: 2.2, dir: [-0.58, 0.36, -0.72], shadow: q.shadow });
  U.worldRim.value.setRGB(0.12, 0.12, 0.1);
  U.rimColor.value.setRGB(0.12, 0.11, 0.08);
  U.rimEnemy.value.setRGB(0.06, 0.07, 0.09);
  U.fireCol.value.setRGB(0, 0, 0);
  return { world, L, gunPos, lipTree };
}

export function gradeDawn(post) {
  setGrade(post, { topGlow: [0, 0, 0], exposure: 1.0, sat: 0.64, con: 1.06, shT: [0.88, 0.95, 1.08], hiT: [1.03, 1.0, 0.95], lift: [0.02, 0.025, 0.03], vig: 0.5, grain: 0.045, bloomK: 0.4 });
}
