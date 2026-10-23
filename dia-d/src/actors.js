// Soldiers: one skinned mesh per man (rigid skinning, one draw call), procedural animation.
import { T, rng, clamp, lerp } from "./util.js";
import { Builder, mat } from "./geo.js";

export const PAL = {
  para: { coat: 0x8a7f55, coat2: 0x766c48, pants: 0x7d744f, boots: 0x5a3c26, helmet: 0x5f5d40, net: 0x46452f, skin: 0xd6a07c, gear: 0xa49c74, paint: 0x2b2a22 },
  heer: { coat: 0x6e7468, coat2: 0x5d6358, pants: 0x585e54, boots: 0x1d1d1c, helmet: 0x4a4f48, net: 0x3c4139, skin: 0xd3a283, gear: 0x232320, paint: null },
  fj: { coat: 0x6f7158, coat2: 0x5a5c45, pants: 0x55594c, boots: 0x22211f, helmet: 0x4a4f49, net: 0x3d4239, skin: 0xd09e80, gear: 0x2a2a26, paint: null },
};

// bone layout
const B = { hips: 0, spine: 1, chest: 2, head: 3, shL: 4, elL: 5, shR: 6, elR: 7, thL: 8, knL: 9, thR: 10, knR: 11, gun: 12 };

export function buildSoldier(opts = {}) {
  const pal = PAL[opts.kit || "para"];
  const seed = opts.seed ?? Math.floor(Math.random() * 1e6);
  const r = rng(seed);
  const enemy = opts.kit !== "para";
  const bones = [];
  const mk = (parent, x, y, z) => {
    const b = new T.Bone();
    b.position.set(x, y, z);
    if (parent) parent.add(b);
    bones.push(b);
    return b;
  };
  const hips = mk(null, 0, 0.95, 0);
  const spine = mk(hips, 0, 0.12, 0);
  const chest = mk(spine, 0, 0.3, 0);
  const head = mk(chest, 0, 0.27, 0.01);
  const shL = mk(chest, 0.25, 0.17, 0);
  const elL = mk(shL, 0, -0.3, 0);
  const shR = mk(chest, -0.25, 0.17, 0);
  const elR = mk(shR, 0, -0.3, 0);
  const thL = mk(hips, 0.11, -0.04, 0);
  const knL = mk(thL, 0, -0.43, 0);
  const thR = mk(hips, -0.11, -0.04, 0);
  const knR = mk(thR, 0, -0.43, 0);
  const gun = mk(elR, 0, -0.26, 0.02);
  hips.updateMatrixWorld(true);

  const b = new Builder(seed).enableSkin();
  const W = (bone) => ({ mat: bone.matrixWorld, bone: bones.indexOf(bone), jit: 0.05 });
  // legs
  for (const [th, kn, s] of [[thL, knL, 1], [thR, knR, -1]]) {
    b.box(0.17, 0.44, 0.19, pal.pants, { y: -0.21 }, W(th));
    b.box(0.19, 0.08, 0.2, pal.coat2, { y: -0.02, z: 0.0 }, W(th)); // cargo pocket line
    if (opts.kit === "para") b.box(0.07, 0.15, 0.06, pal.coat2, { x: s * 0.095, y: -0.24, z: 0.02 }, W(th));
    b.box(0.155, 0.4, 0.17, pal.pants, { y: -0.18 }, W(kn));
    b.box(0.16, 0.18, 0.2, pal.boots, { y: -0.36, z: 0.02 }, W(kn));
    b.box(0.15, 0.06, 0.29, pal.boots, { y: -0.45, z: 0.05 }, W(kn));
  }
  // torso
  b.box(0.42, 0.24, 0.24, pal.pants, { y: 0.02 }, W(hips));
  b.box(0.44, 0.07, 0.26, pal.gear, { y: 0.1 }, W(hips)); // belt
  if (opts.kit === "para") {
    for (const s of [-1, 1]) b.box(0.08, 0.1, 0.07, pal.gear, { x: s * 0.16, y: 0.1, z: 0.13 }, W(hips)); // ammo pouches
    b.box(0.09, 0.14, 0.08, 0x5d5a46, { x: 0.2, y: 0.04, z: -0.1 }, W(hips)); // canteen
  } else {
    for (const s of [-1, 1]) b.box(0.1, 0.08, 0.06, pal.gear, { x: s * 0.13, y: 0.11, z: 0.14 }, W(hips));
  }
  b.box(0.44, 0.34, 0.26, pal.coat, { y: 0.14 }, W(spine));
  b.box(0.48, 0.3, 0.28, pal.coat, { y: 0.11 }, W(chest));
  b.box(0.2, 0.12, 0.05, pal.coat2, { x: 0.11, y: 0.1, z: 0.14 }, W(chest)); // chest pockets
  b.box(0.2, 0.12, 0.05, pal.coat2, { x: -0.11, y: 0.1, z: 0.14 }, W(chest));
  if (opts.kit === "para") {
    // suspenders + musette bag + reserve chute look
    for (const s of [-1, 1]) b.box(0.05, 0.42, 0.29, pal.gear, { x: s * 0.13, y: 0.04 }, W(chest));
    b.box(0.34, 0.3, 0.14, 0x6b6648, { y: 0.06, z: -0.19 }, W(chest)); // musette bag
    b.box(0.08, 0.05, 0.02, 0xb8b1a0, { x: 0.255, y: 0.02, z: 0.0, ry: Math.PI / 2 }, W(shL)); // flag patch
  } else {
    b.box(0.5, 0.05, 0.3, pal.gear, { y: 0.24 }, W(chest)); // Y-strap top
    b.box(0.18, 0.12, 0.1, 0x3e4038, { x: -0.14, y: -0.02, z: -0.16 }, W(chest)); // bread bag
    if (opts.kit === "heer") b.cyl(0.07, 0.07, 0.24, 6, 0x4d5148, { x: 0.18, y: -0.05, z: -0.14, rx: 0.05 }, W(chest)); // gas mask can
  }
  b.box(0.16, 0.08, 0.16, pal.skin, { y: 0.27 }, W(chest)); // neck
  // head + face
  const face = opts.skin ?? pal.skin;
  b.box(0.22, 0.26, 0.24, face, { y: 0.12 }, W(head));
  b.box(0.2, 0.06, 0.04, 0x2a2420, { y: 0.15, z: 0.12 }, W(head)); // brow shadow
  b.box(0.035, 0.035, 0.02, 0x1a1715, { x: 0.05, y: 0.13, z: 0.125 }, W(head));
  b.box(0.035, 0.035, 0.02, 0x1a1715, { x: -0.05, y: 0.13, z: 0.125 }, W(head));
  b.box(0.04, 0.07, 0.05, face, { y: 0.08, z: 0.13 }, { ...W(head), jit: 0.1 }); // nose
  b.box(0.09, 0.02, 0.02, 0x7a4a3a, { y: 0.03, z: 0.122 }, W(head)); // mouth
  if (opts.kit === "para" && opts.paint !== false) {
    b.box(0.225, 0.035, 0.02, pal.paint, { y: 0.1, z: 0.122, rz: 0.15 }, W(head));
    b.box(0.18, 0.03, 0.02, pal.paint, { y: 0.19, z: 0.122, rz: -0.2 }, W(head));
  }
  if (opts.mustache) b.box(0.1, 0.025, 0.02, 0x3a2a1e, { y: 0.055, z: 0.13 }, W(head));
  // helmet: M1 (round) vs Stahlhelm (flared skirt) vs FJ (no brim)
  if (opts.kit === "para") {
    b.sphere(0.165, 8, 5, pal.helmet, { y: 0.21, sy: 0.82, sz: 1.06 }, W(head));
    b.cyl(0.18, 0.185, 0.03, 10, pal.helmet, { y: 0.17 }, W(head));
    b.sphere(0.168, 7, 4, pal.net, { y: 0.215, sy: 0.8, sz: 1.06 }, { ...W(head), jit: 0.15 });
    if (opts.rank === "lt") b.box(0.03, 0.08, 0.02, 0xe8e2d0, { y: 0.27, z: -0.165 }, W(head));
    if (opts.rank === "sgt") b.box(0.09, 0.025, 0.02, 0xe8e2d0, { y: 0.27, z: -0.165 }, W(head));
    if (opts.medic) b.box(0.08, 0.08, 0.02, 0xd8d0c0, { y: 0.26, z: 0.17 }, W(head));
    b.box(0.03, 0.17, 0.03, pal.gear, { x: 0.12, y: 0.06, z: 0.03 }, W(head)); // chin strap
    b.box(0.03, 0.17, 0.03, pal.gear, { x: -0.12, y: 0.06, z: 0.03 }, W(head));
  } else if (opts.kit === "heer") {
    b.sphere(0.16, 8, 5, pal.helmet, { y: 0.22, sy: 0.85, sz: 1.05 }, W(head));
    b.cyl(0.16, 0.215, 0.1, 10, pal.helmet, { y: 0.14, z: -0.01 }, W(head)); // flared skirt
  } else {
    b.sphere(0.158, 8, 5, pal.helmet, { y: 0.2, sy: 0.9, sz: 1.02 }, W(head));
    b.cyl(0.162, 0.165, 0.07, 10, pal.helmet, { y: 0.15 }, W(head));
  }
  // arms
  for (const [sh, el] of [[shL, elL], [shR, elR]]) {
    b.box(0.14, 0.33, 0.15, pal.coat, { y: -0.13 }, W(sh));
    b.box(0.13, 0.28, 0.14, pal.coat, { y: -0.12 }, W(el));
    b.box(0.11, 0.1, 0.12, face, { y: -0.3 }, W(el));
  }
  // weapon on its own bone
  const wpn = opts.weapon || (enemy ? "k98" : "m1");
  const G = W(gun);
  if (wpn === "m1" || wpn === "k98") {
    const wood = wpn === "m1" ? 0x6b4429 : 0x5a3a24;
    b.box(0.05, 0.08, 0.68, wood, { z: 0.1 }, G);
    b.box(0.06, 0.12, 0.2, wood, { z: -0.3, y: -0.03 }, G);
    b.box(0.03, 0.03, 0.42, 0x2a2b2c, { y: 0.05, z: 0.5 }, G);
    if (wpn === "k98") b.box(0.02, 0.03, 0.06, 0x2a2b2c, { x: -0.05, y: 0.05, z: 0.05 }, G); // bolt
  } else if (wpn === "thompson") {
    b.box(0.05, 0.08, 0.36, 0x5a3a24, { z: -0.16 }, G);
    b.box(0.05, 0.08, 0.32, 0x2a2b2c, { z: 0.14 }, G);
    b.box(0.04, 0.18, 0.06, 0x2a2b2c, { y: -0.1, z: 0.06 }, G);
    b.box(0.03, 0.03, 0.2, 0x2a2b2c, { y: 0.02, z: 0.38 }, G);
  } else if (wpn === "mp40") {
    b.box(0.05, 0.08, 0.42, 0x1f2022, { z: 0.12 }, G);
    b.box(0.03, 0.22, 0.04, 0x1f2022, { y: -0.13, z: 0.1 }, G);
    b.box(0.02, 0.02, 0.26, 0x1f2022, { z: -0.2 }, G);
  } else if (wpn === "mg42") {
    b.box(0.07, 0.09, 0.72, 0x222324, { z: 0.22 }, G);
    b.box(0.06, 0.12, 0.22, 0x3a2c22, { z: -0.24, y: -0.02 }, G);
    b.cyl(0.035, 0.035, 0.36, 6, 0x2d2e2f, { z: 0.72, rx: Math.PI / 2 }, G);
  } else if (wpn === "medic") {
    b.box(0.2, 0.16, 0.1, 0xd8d0b8, { y: 0.05, z: 0.05 }, G);
  }
  const geo = b.build();
  const m = new T.SkinnedMesh(geo, mat(enemy ? "enemy" : "char"));
  m.castShadow = true;
  m.receiveShadow = true;
  m.frustumCulled = false;
  m.add(hips);
  m.bind(new T.Skeleton(bones));
  const root = new T.Group();
  // a touch larger than life: on a phone the silhouette matters more than the anatomy
  m.scale.setScalar(1.28);
  root.add(m);
  // rest pose snapshot
  const rest = bones.map((bb) => bb.position.clone());
  return { root, mesh: m, bones, rest, B, weapon: wpn, kit: opts.kit || "para" };
}

// ---- procedural animation ------------------------------------------------------------------------
// st: {move: 0..1 (speed), crouch: 0..1, aim: 0..1, fire: recoil 0..1, throw: 0..1, dead: 0..1, phase, prone, wounded, look}
export function animate(a, st, dt) {
  const b = a.bones, Bi = a.B;
  st.phase = (st.phase || 0) + dt * (st.move > 0.01 ? lerp(6.5, 10.5, clamp(st.move, 0, 1)) * (st.crouch > 0.5 ? 0.75 : 1) : 0);
  const p = st.phase, mv = clamp(st.move, 0, 1), cr = st.crouch || 0, aim = st.aim || 0;
  const sw = Math.sin(p), cw = Math.cos(p);
  for (let i = 0; i < b.length; i++) {
    b[i].rotation.set(0, 0, 0);
    b[i].position.copy(a.rest[i]);
  }
  const hips = b[Bi.hips];
  // gait
  const stride = 0.75 * mv;
  hips.position.y = a.rest[Bi.hips].y - cr * 0.34 + Math.abs(cw) * 0.05 * mv - (st.prone || 0) * 0.62;
  hips.rotation.y = sw * 0.12 * mv;
  b[Bi.thL].rotation.x = -sw * stride - cr * 1.05;
  b[Bi.thR].rotation.x = sw * stride - cr * 1.05;
  b[Bi.knL].rotation.x = Math.max(0, cw) * stride * 1.3 + cr * 1.5;
  b[Bi.knR].rotation.x = Math.max(0, -cw) * stride * 1.3 + cr * 1.5;
  b[Bi.spine].rotation.x = 0.1 * mv + cr * 0.42;
  b[Bi.chest].rotation.y = -sw * 0.1 * mv;
  b[Bi.head].rotation.x = -cr * 0.25 + (st.look || 0);
  // arms: port arms (rifle across chest) -> aim (shouldered)
  const port = { shLx: -0.55, shLz: -0.35, elL: -1.35, shRx: -0.35, shRz: 0.25, elR: -1.25 };
  const aimP = { shLx: -1.45, shLz: -0.5, elL: -0.35, shRx: -1.35, shRz: 0.1, elR: -0.4 };
  const k = aim;
  b[Bi.shL].rotation.x = lerp(port.shLx + sw * 0.1 * mv, aimP.shLx, k);
  b[Bi.shL].rotation.z = lerp(port.shLz, aimP.shLz, k);
  b[Bi.elL].rotation.x = lerp(port.elL, aimP.elL, k);
  b[Bi.shR].rotation.x = lerp(port.shRx - sw * 0.1 * mv, aimP.shRx, k);
  b[Bi.shR].rotation.z = lerp(port.shRz, aimP.shRz, k);
  b[Bi.elR].rotation.x = lerp(port.elR, aimP.elR, k);
  b[Bi.gun].rotation.x = lerp(1.15, 1.5, k);
  b[Bi.gun].rotation.y = lerp(0.55, 0.0, k);
  b[Bi.gun].rotation.z = lerp(0.2, 0, k);
  if (aim > 0.5) {
    b[Bi.chest].rotation.y += 0.22;
    b[Bi.head].rotation.y = -0.18;
  }
  // recoil
  if (st.fire > 0) {
    b[Bi.chest].rotation.x -= st.fire * 0.12;
    b[Bi.shR].rotation.x += st.fire * 0.25;
    b[Bi.shL].rotation.x += st.fire * 0.2;
  }
  // throw
  if (st.throw > 0) {
    const t = st.throw; // 1 -> 0
    const wind = t > 0.5 ? (1 - t) * 2 : t * 2;
    b[Bi.shL].rotation.x = -2.6 * wind + 0.6 * (1 - wind);
    b[Bi.elL].rotation.x = -0.6 * wind;
    b[Bi.chest].rotation.y = 0.5 * wind - 0.3;
  }
  // knife / bayonet stab
  if (st.stab > 0) {
    const t = st.stab;
    b[Bi.shR].rotation.x = -1.6 * Math.sin(t * Math.PI);
    b[Bi.elR].rotation.x = -0.2;
    b[Bi.chest].rotation.x += 0.2 * Math.sin(t * Math.PI);
  }
  // bandaging: hunched, hands together
  if (st.heal > 0) {
    b[Bi.spine].rotation.x += 0.45 * st.heal;
    b[Bi.shL].rotation.x = -0.9;
    b[Bi.shR].rotation.x = -0.9;
    b[Bi.elL].rotation.x = -1.5;
    b[Bi.elR].rotation.x = -1.5;
    b[Bi.shL].rotation.z = -0.6;
    b[Bi.shR].rotation.z = 0.6;
  }
  // prone / crawling (wounded)
  if (st.prone > 0) {
    const pr = st.prone;
    hips.rotation.x = 1.35 * pr;
    b[Bi.thL].rotation.x *= 1 - pr;
    b[Bi.thR].rotation.x *= 1 - pr;
    b[Bi.knL].rotation.x *= 1 - pr;
    b[Bi.knR].rotation.x *= 1 - pr;
    b[Bi.head].rotation.x -= 1.0 * pr;
  }
  // surrender: hands up, head down
  if (st.surr > 0) {
    b[Bi.shL].rotation.x = -2.9;
    b[Bi.shR].rotation.x = -2.9;
    b[Bi.shL].rotation.z = -0.25;
    b[Bi.shR].rotation.z = 0.25;
    b[Bi.elL].rotation.x = -0.4;
    b[Bi.elR].rotation.x = -0.4;
    b[Bi.head].rotation.x = 0.35;
    b[Bi.gun].scale.setScalar(0.001);
  } else b[Bi.gun].scale.setScalar(1);
  // death: crumple sideways
  if (st.dead > 0) {
    const d = st.dead;
    hips.position.y = lerp(hips.position.y, 0.16, d);
    hips.rotation.x = lerp(hips.rotation.x, -1.45 * (st.deadDir || 1), d);
    hips.rotation.z = lerp(0, 0.35 * (st.deadSide || 1), d);
    b[Bi.shL].rotation.x = lerp(b[Bi.shL].rotation.x, -2.3, d);
    b[Bi.shR].rotation.x = lerp(b[Bi.shR].rotation.x, -1.0, d);
    b[Bi.knL].rotation.x = lerp(b[Bi.knL].rotation.x, 0.6, d);
    b[Bi.head].rotation.y = 0.5 * d;
  }
}

// muzzle point in world space
const _v = new T.Vector3();
export function muzzle(a, out) {
  const g = a.bones[a.B.gun];
  g.updateWorldMatrix(true, false);
  _v.set(0, 0.05, a.weapon === "thompson" ? 0.5 : a.weapon === "mp40" ? 0.4 : a.weapon === "mg42" ? 0.95 : 0.72);
  return (out || new T.Vector3()).copy(_v).applyMatrix4(g.matrixWorld);
}
