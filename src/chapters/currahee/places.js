// Un solo mundo para todo el capítulo: el campamento de Toccoa al pie y el monte Currahee al este,
// unidos por el camino de arcilla. La llegada, las carreras y el regreso ocurren en el mismo lugar,
// así que entre momentos solo se mueve la cámara.
import { T, rng, fbm, smooth, clamp } from "../../engine/util.js";
import { Builder, meshFrom, U } from "../../engine/geo.js";
import { World, buildGround, scatter } from "../../core/world.js";
import * as P from "../../core/props.js";
import * as TP from "./props.js";
import { setGrade } from "../../engine/render.js";
import { sky, lights, tuft, signTexture } from "../../engine/stage.js";

// level frame: u = screen right, v = screen up (camera yaw π/4). The run goes left → right.
const RV = [Math.SQRT1_2, -Math.SQRT1_2], FV = [-Math.SQRT1_2, -Math.SQRT1_2];
const O = [-RV[0] * 34, -RV[1] * 34];
export const W = (u, v) => [O[0] + RV[0] * u + FV[0] * v, O[1] + RV[1] * u + FV[1] * v];
export const UV = (x, z) => {
  const dx = x - O[0], dz = z - O[1];
  return [dx * RV[0] + dz * RV[1], dx * FV[0] + dz * FV[1]];
};
export const ANG_RIGHT = Math.atan2(RV[0], RV[1]);

// Currahee: in the book ~300 m above the parade ground; here a 34 m hill so it reads at this scale
export const SUMMIT = [176, 0];
const HILL = (u, v) => 34 * Math.exp(-((u - SUMMIT[0]) ** 2) / (2 * 62 ** 2) - (v * v) / (2 * 46 ** 2));

// the road: camp gate → foot → switchbacks → bald summit (u, v)
export const ROUTE = [
  [-58, 1.5], [-40, 0], [-20, 1], [0, -1], [22, 2], [44, -3],
  [62, 9], [80, -9], [98, 10], [114, -10], [128, 9], [142, -8], [154, 6], [164, -4], [172, 1], [176, 0],
];

export function routeWorld() {
  return ROUTE.map(([u, v]) => W(u, v));
}

export function buildToccoa(ctx) {
  const { scene, q } = ctx;
  P.setFoliage(true);
  const world = new World(260);
  world.base = (x, z) => {
    const [u, v] = UV(x, z);
    const camp = smooth(-20, -45, u); // the camp sits on a levelled plain
    const n = (fbm(x * 0.02 + 5, z * 0.02 - 2, 3) - 0.5) * 3.2 * (1 - camp * 0.8);
    const ridges = (fbm(x * 0.05, z * 0.05, 2) - 0.5) * 4 * smooth(70, 140, u);
    return n + HILL(u, v) + ridges * (1 - smooth(0, 8, Math.abs(v - roadV(u))) * 0) + smooth(30, 70, Math.abs(v)) * 6;
  };
  const B = new Builder(51), Fo = new Builder(52);
  const r = rng(19);
  const route = routeWorld();
  for (let k = 0; k < route.length - 1; k++) world.carves.push({ ax: route[k][0], az: route[k][1], bx: route[k + 1][0], bz: route[k + 1][1], w: 2.2, d: 0.35 });
  // parade ground: a levelled square of bare clay
  world.carves.push({ ax: W(-78, 0)[0], az: W(-78, 0)[1], bx: W(-60, 0)[0], bz: W(-60, 0)[1], w: 10, d: 0.05 });
  world.bakeHeights(0.5);

  // ---- the camp ------------------------------------------------------------------------------
  const campAng = ANG_RIGHT - Math.PI / 2; // huts' long axis along the screen
  for (let i = 0; i < 4; i++) {
    TP.barracks(world, B, ...W(-96 + i * 22, 20), campAng);
    TP.barracks(world, B, ...W(-96 + i * 22, -20), campAng);
  }
  TP.barracks(world, B, ...W(-96 + 4 * 22, 20), campAng);
  TP.messHall(world, B, ...W(-50, -32), campAng);
  TP.barracks(world, B, ...W(-84, 34), campAng, 14, 6); // HQ
  TP.waterTower(world, B, ...W(-112, -6));
  TP.jumpTower(world, B, ...W(-108, 34), campAng);
  TP.flagpole(world, B, ...W(-69, 11));
  TP.benches(world, B, ...W(-69, -11), campAng, 5);
  for (const [u, v] of [[-90, 9], [-48, 13], [-56, -12], [-100, -12], [-36, 22]]) TP.crates(world, B, ...W(u, v));
  for (const [u, v] of [[-88, -9], [-87, -10], [-46, -24], [-45, -25.2], [-30, 14]]) TP.oilDrum(world, B, ...W(u, v));
  P.fence(world, B, [W(-124, -44), W(-124, 44), W(-36, 44)], { rails: true });
  P.fence(world, B, [W(-124, -44), W(-36, -44)], { rails: true });
  P.fence(world, B, [W(-36, 44), W(-36, 6)], { rails: true });
  P.fence(world, B, [W(-36, -6), W(-36, -44)], { rails: true });
  // the gate and the camp sign
  const gate = W(-36, 0);
  TP.sign(world, B, ...W(-34, 6), campAng);
  const sgn = new T.Mesh(new T.PlaneGeometry(3.4, 0.9), new T.MeshStandardMaterial({ map: signTexture("CAMP TOCCOA · 506th P.I.R.", { bg: "#e4dcc6", fg: "#2c3a2a", font: "bold 22px Georgia, serif" }), roughness: 0.9 }));
  const sp = W(-34, 6);
  sgn.position.set(sp[0], world.height(...sp) + 1.9, sp[1]);
  sgn.rotation.y = campAng + Math.PI / 2;
  scene.add(sgn);
  for (let i = 0; i < 10; i++) P.pole(world, B, ...W(-120 + i * 9, 41), 6);

  // ---- vegetation: longleaf pines, scrub oak, dry grass; denser on the mountain -----------------
  // distance to the real road polyline (it switchbacks, so v alone is not enough)
  const RW = routeWorld();
  // nearest road point; `side` > 0 means the spot is between the road and the camera (screen-down)
  let roadSide = 0;
  const roadDist = (x, z) => {
    let best = 1e9;
    for (let i = 1; i < RW.length; i++) {
      const [ax, az] = RW[i - 1], [bx, bz] = RW[i];
      const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
      const ox = x - ax - dx * t, oz = z - az - dz * t, d = Math.hypot(ox, oz);
      if (d < best) {
        best = d;
        roadSide = (ox + oz) * 0.707;
      }
    }
    return best;
  };
  const onRoad = (u, v) => Math.abs(v - roadV(u)) < 4.2 || roadDist(...W(u, v)) < 3.6;
  const inCamp = (u, v) => u < -34 && u > -126 && Math.abs(v) < 46;
  for (let i = 0, tries = 0; i < Math.floor(620 * q.props) && tries < 9000; tries++) {
    const u = -130 + r() * 330, v = (r() - 0.5) * 120;
    if (inCamp(u, v) || onRoad(u, v)) continue;
    const dens = u > 40 ? 0.85 : 0.35;
    if (r() > dens) continue;
    const [x, z] = W(u, v);
    if (Math.abs(world.height(x, z) - world.rawHeight(x, z)) > 0.5) continue;
    i++;
    // pines are tall: keep them back from the road so they never wall off the column from the camera
    const rd = roadDist(x, z);
    const far = rd > (roadSide > 0 ? 19 : 13);
    if (far && r() < 0.75) TP.pine(world, B, Fo, x, z, 0.8 + r() * 0.45, r);
    else if (far) TP.scrub(world, Fo, x, z, 0.7 + r() * 0.8, r);
    // near the road only low scrub, and none right on the camera side of it
    else if (rd > (roadSide > 0 ? 9 : 5)) TP.scrub(world, Fo, x, z, 0.45 + r() * 0.3, r);
  }
  // shade pines inside the camp, a few spared by the bulldozers
  for (const [u, v] of [[-118, 12], [-104, -30], [-60, 30], [-40, -38], [-122, -36], [-76, 40]]) TP.pine(world, B, Fo, ...W(u, v), 1.05);
  // road-side detail: ditches with rocks, scrub, a fallen pine
  for (let i = 0; i < Math.floor(260 * q.props); i++) {
    const u = -30 + r() * 205, side = r() < 0.5 ? 1 : -1, v = roadV(u) + side * (2.9 + r() * 3.5);
    const [x, z] = W(u, v);
    const k = r();
    const y = world.rawHeight(x, z);
    if (k < 0.45) B.ico(0.18 + r() * 0.35, r.pick([0x8a6a54, 0x9a7a60, 0x7a6252]), { x, y: y + 0.08, z, sy: 0.6, ry: r() * 3 }, { jit: 0.2 });
    else if (k < 0.8) TP.scrub(world, Fo, x, z, 0.45 + r() * 0.4, r);
    else B.cyl(0.08, 0.12, 2 + r() * 2, 5, 0x5e4634, { x, y: y + 0.12, z, rz: Math.PI / 2, ry: r() * 3 }, { jit: 0.12 });
  }
  // summit: bald granite and a survey cairn
  const [smx, smz] = W(...SUMMIT);
  for (let i = 0; i < 26; i++) {
    const a = r() * 6.28, d = 4 + r() * 9;
    const x = smx + Math.cos(a) * d, z = smz + Math.sin(a) * d;
    B.ico(0.4 + r() * 1.0, r.pick([0x8c8478, 0x9a9284, 0x7a7266]), { x, y: world.rawHeight(x, z) + 0.1, z, sy: 0.55, ry: r() * 3 }, { jit: 0.16 });
  }
  for (let i = 0; i < 6; i++) B.ico(0.45 - i * 0.05, 0x9a9284, { x: smx + 3.2, y: world.rawHeight(smx, smz) + 0.2 + i * 0.35, z: smz - 2.2, sy: 0.6, ry: i }, { jit: 0.12 });

  // ---- ground: red Georgia clay on the road and parade ground, dry summer grass, pine needles ----
  const clay = new T.Color().setRGB(0.66, 0.36, 0.24, "srgb");
  const clayDark = new T.Color().setRGB(0.52, 0.28, 0.19, "srgb");
  const needles = new T.Color().setRGB(0.5, 0.38, 0.24, "srgb");
  const ground = buildGround(world, (x, z, h, c) => {
    const [u, v] = UV(x, z);
    const n = fbm(x * 0.12, z * 0.12, 3);
    c.setRGB((0.56 + n * 0.12) * 0.9, (0.55 + n * 0.12) * 0.86, (0.3 + n * 0.06) * 0.85, "srgb"); // dry grass
    c.lerp(needles, smooth(50, 110, u) * 0.45 * (0.6 + fbm(x * 0.3, z * 0.3, 2) * 0.8));
    const road = smooth(2.8, 1.4, Math.abs(v - roadV(u))) * (u > -60 ? 1 : 0);
    const parade = inCamp(u, v) ? Math.max(smooth(12, 9, Math.abs(v)) * smooth(-48, -52, u) * smooth(-90, -86, u), 0.35 + n * 0.2) : 0;
    const k = Math.max(road, parade);
    c.lerp(n > 0.5 ? clay : clayDark, k * 0.92);
  }, 0.8);
  scene.add(ground);
  scene.add(meshFrom(B, "world"), meshFrom(Fo, "canopy", { world }));
  const N = Math.floor(9000 * q.grass);
  scene.add(scatter(world, (b) => tuft(b, 0xa09a5a), N, (x, z, rr, col) => {
    const [u, v] = UV(x, z);
    if (onRoad(u, v) || (inCamp(u, v) && rr() < 0.85)) return null;
    col.setRGB(0.85 + rr() * 0.3, 0.8 + rr() * 0.25, 0.6 + rr() * 0.2);
    return { scale: 0.7 + rr() * 0.9, sy: 0.8 + rr() * 0.9, color: col };
  }, "foliage", 53));
  scene.add(scatter(world, (b) => { b.ico(0.06, 0xf0e8d0, { y: 0.36 }); b.box(0.01, 0.36, 0.01, 0x7a7a40, { y: 0.18 }); }, Math.floor(1100 * q.grass), (x, z, rr, col) => {
    const [u, v] = UV(x, z);
    if (onRoad(u, v) || inCamp(u, v)) return null;
    col.setRGB(1, rr() < 0.5 ? 0.85 : 1, rr() < 0.5 ? 0.5 : 1);
    return { scale: 0.8 + rr() * 0.5, color: col };
  }, "foliage", 54));

  // ---- light: August in Georgia — high hot sun, hazy, the one chapter allowed to be warm ----
  scene.background = new T.Color(0xd8cdb4);
  scene.fog = new T.Fog(0xd9ccb0, 70, 150);
  sky(scene, 0xa9bccb, 0xe2d6bc);
  const L = lights(scene, { sky: 0xd4dce0, ground: 0x6a5a40, hemi: 1.15, sunCol: 0xfff0d6, sun: 2.7, dir: [-0.42, 0.78, -0.46], shadow: q.shadow });
  U.worldRim.value.setRGB(0.1, 0.09, 0.06);
  U.rimColor.value.setRGB(0.16, 0.13, 0.08);
  U.fireCol.value.setRGB(0, 0, 0);
  setGrade(ctx.R.post, { topGlow: [0, 0, 0], exposure: 1.12, sat: 0.9, con: 1.05, shT: [0.92, 0.94, 1.04], hiT: [1.06, 1.0, 0.9], lift: [0.03, 0.022, 0.012], vig: 0.26, grain: 0.04, bloomK: 0.35, desat: 0 });

  // shared ambulance geometry for the moving trucks
  const ab = new Builder(60);
  TP.ambulance(ab);
  const ambGeo = ab.build();
  return { world, L, route, gate, ambGeo, summit: W(...SUMMIT) };
}

// lateral position of the road at u (piecewise linear through ROUTE)
export function roadV(u) {
  if (u <= ROUTE[0][0]) return ROUTE[0][1];
  for (let i = 0; i < ROUTE.length - 1; i++) {
    const [u0, v0] = ROUTE[i], [u1, v1] = ROUTE[i + 1];
    if (u <= u1) return v0 + ((v1 - v0) * (u - u0)) / (u1 - u0 || 1);
  }
  return ROUTE[ROUTE.length - 1][1];
}
export { clamp };
