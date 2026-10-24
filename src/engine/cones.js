// Stealth readability: each nearby German projects a view cone on the ground, clipped by hedges and
// walls (rays against the world's line of sight). Amber while calm, red once he has seen you.
import { T } from "./util.js";

const RAYS = 15;
const CALM = new T.Color(0xf2c14e), ALERT = new T.Color(0xd9442b);

export class Cones {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    this.mat = new T.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, opacity: 1, depthWrite: false, side: 2, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.ringGeo = ringGeo(0.55, 0.72, 28);
    this.ring = new T.Mesh(this.ringGeo, new T.MeshBasicMaterial({ color: 0xe8dca8, transparent: true, opacity: 0.7, depthWrite: false, depthTest: false, side: 2 }));
    this.ring.renderOrder = 20;
    scene.add(this.ring);
  }
  _make() {
    const g = new T.BufferGeometry();
    const n = 1 + RAYS * 2; // apex + inner ring (75%) + outer ring
    g.setAttribute("position", new T.BufferAttribute(new Float32Array(n * 3), 3).setUsage(35048));
    g.setAttribute("color", new T.BufferAttribute(new Float32Array(n * 4), 4).setUsage(35048));
    const idx = [];
    for (let i = 0; i < RAYS - 1; i++) {
      const a = 1 + i, b2 = 2 + i, oa = 1 + RAYS + i, ob = 2 + RAYS + i;
      idx.push(0, a, b2, a, oa, b2, b2, oa, ob);
    }
    g.setIndex(idx);
    const m = new T.Mesh(g, this.mat);
    m.frustumCulled = false;
    m.renderOrder = 3;
    this.scene.add(m);
    return { m, g, rays: new Float32Array(RAYS), t: 0 };
  }
  update(game, dt) {
    const p = game.player;
    if (p) {
      this.ring.visible = p.alive;
      this.ring.position.set(p.x, game.world.height(p.x, p.z) + 0.06, p.z);
      this.ring.material.opacity = 0.62 + Math.sin(game.t * 3) * 0.08;
    }
    let k = 0;
    const drawn = [];
    const show = game.night && p && !game.title;
    if (show) {
      for (const e of game.soldiers) {
        if (e.side !== "de" || !e.alive || !e.ai || e.surrendered || e.ai.mode === "scripted") continue;
        // one cone per patrol: skip a man walking right beside a comrade already drawn
        if (drawn.some((o) => Math.hypot(o.x - e.x, o.z - e.z) < 3.2)) continue;
        drawn.push(e);
        if (Math.hypot(e.x - p.x, e.z - p.z) > 34) continue;
        const [sx, sy] = game.project(e.x, e.y, e.z);
        if (sx < -60 || sx > innerWidth + 60 || sy < -60 || sy > innerHeight + 60) continue;
        const c = this.pool[k] || (this.pool[k] = this._make());
        k++;
        c.m.visible = true;
        this._fill(game, e, c, dt);
      }
    }
    for (let i = k; i < this.pool.length; i++) this.pool[i].m.visible = false;
  }
  _fill(game, e, c, dt) {
    const w = game.world;
    const p = game.player;
    const range = e.ai.mode === "alert" ? 16 : p && p.crouch ? 8 : 14;
    const fov = e.ai.mode === "alert" ? 1.6 : 1.05;
    // re-cast rays a few times per second (they are cheap but not free)
    c.t -= dt;
    if (c.range !== range) c.t = 0;
    if (c.t <= 0) {
      c.t = 0.12;
      const ey = e.eye;
      for (let i = 0; i < RAYS; i++) {
        const a = e.ry - fov + (2 * fov * i) / (RAYS - 1);
        const sx = Math.sin(a), sz = Math.cos(a);
        let lo = 0.5, hi = range;
        // binary search the first blocked distance (eye to a crouching man's head)
        if (w.los(e.x, ey, e.z, e.x + sx * hi, w.height(e.x + sx * hi, e.z + sz * hi) + 1.0, e.z + sz * hi)) lo = hi;
        else
          for (let s = 0; s < 6; s++) {
            const mid = (lo + hi) / 2;
            const tx = e.x + sx * mid, tz = e.z + sz * mid;
            if (w.los(e.x, ey, e.z, tx, w.height(tx, tz) + 1.0, tz)) lo = mid;
            else hi = mid;
          }
        c.rays[i] = c.range === range && c.rays[i] ? c.rays[i] + (lo - c.rays[i]) * 0.5 : lo;
      }
      c.range = range;
    }
    const pos = c.g.attributes.position.array, col = c.g.attributes.color.array;
    const alert = e.ai.mode === "alert";
    const cc = alert ? ALERT : CALM;
    const aw = Math.min(1, e.aware);
    const A = alert ? 0.14 : 0.06 + aw * 0.06;
    const y0 = w.height(e.x, e.z) + 0.07;
    pos[0] = e.x;
    pos[1] = y0;
    pos[2] = e.z;
    col[0] = cc.r; col[1] = cc.g; col[2] = cc.b; col[3] = A;
    for (let i = 0; i < RAYS; i++) {
      const a = e.ry - fov + (2 * fov * i) / (RAYS - 1);
      const d = c.rays[i];
      for (const [k, f, al] of [[1 + i, 0.75, A], [1 + RAYS + i, 1, 0]]) {
        const x = e.x + Math.sin(a) * d * f, z = e.z + Math.cos(a) * d * f;
        pos[k * 3] = x;
        pos[k * 3 + 1] = w.height(x, z) + 0.07;
        pos[k * 3 + 2] = z;
        col[k * 4] = cc.r; col[k * 4 + 1] = cc.g; col[k * 4 + 2] = cc.b; col[k * 4 + 3] = al;
      }
    }
    c.g.attributes.position.needsUpdate = true;
    c.g.attributes.color.needsUpdate = true;
  }
}

function ringGeo(r0, r1, n) {
  const p = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    p.push(Math.cos(a) * r0, 0, Math.sin(a) * r0, Math.cos(a) * r1, 0, Math.sin(a) * r1);
    if (i < n) {
      const k = i * 2;
      idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(p, 3));
  g.setIndex(idx);
  return g;
}
