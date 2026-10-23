// World model: height field (with carved trenches/craters), colliders, line of sight.
import { T, clamp, smooth, fbm, segDist, segHit, rng } from "./util.js";
import { Builder, mat } from "./geo.js";

export class World {
  constructor(size = 140, opts = {}) {
    this.size = size;
    this.half = size / 2;
    this.segs = []; // {ax,az,bx,bz,r,h,kind}
    this.rects = []; // {x,z,hw,hd,ang,h,cos,sin}
    this.carves = []; // {ax,az,bx,bz,w,d} trenches / ditches / craters(a==b)
    this.raises = []; // banks under hedges
    this.base = opts.base || ((x, z) => (fbm(x * 0.018 + 3, z * 0.018 - 5, 3) - 0.5) * 2.4);
    this.group = new T.Group();
  }
  // ---- terrain ----
  rawHeight(x, z) {
    let h = this.base(x, z);
    for (const r of this.raises) {
      const s = segDist(x, z, r.ax, r.az, r.bx, r.bz);
      if (s.d < r.w) h += r.h * smooth(r.w, r.w * 0.25, s.d);
    }
    for (const c of this.carves) {
      const s = c.ax === c.bx && c.az === c.bz ? { d: Math.hypot(x - c.ax, z - c.az) } : segDist(x, z, c.ax, c.az, c.bx, c.bz);
      if (s.d < c.w + 0.6) {
        if (c.crater) {
          const k = s.d / c.w;
          h += k < 1 ? -c.d * (1 - k * k) : 0.25 * c.d * Math.max(0, 1 - (s.d - c.w) / 0.6);
        } else h -= c.d * smooth(c.w, c.w * 0.55, s.d);
      }
    }
    return h;
  }
  bakeHeights(step = 0.5) {
    const n = Math.ceil(this.size / step) + 1;
    this.hStep = step;
    this.hN = n;
    this.hData = new Float32Array(n * n);
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) this.hData[j * n + i] = this.rawHeight(i * step - this.half, j * step - this.half);
  }
  height(x, z) {
    if (!this.hData) return this.rawHeight(x, z);
    const s = this.hStep, n = this.hN;
    const fx = clamp((x + this.half) / s, 0, n - 1.001), fz = clamp((z + this.half) / s, 0, n - 1.001);
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    const d = this.hData;
    return (d[j * n + i] * (1 - u) + d[j * n + i + 1] * u) * (1 - v) + (d[(j + 1) * n + i] * (1 - u) + d[(j + 1) * n + i + 1] * u) * v;
  }
  // ---- colliders ----
  addSeg(ax, az, bx, bz, r, h, kind = "hedge") {
    const s = { ax, az, bx, bz, r, h, kind, minx: Math.min(ax, bx) - r, maxx: Math.max(ax, bx) + r, minz: Math.min(az, bz) - r, maxz: Math.max(az, bz) + r };
    this.segs.push(s);
    return s;
  }
  addRect(x, z, hw, hd, ang, h, kind = "solid") {
    const r = { x, z, hw, hd, ang, h, kind, cos: Math.cos(ang), sin: Math.sin(ang), rad: Math.hypot(hw, hd) };
    this.rects.push(r);
    return r;
  }
  collide(x, z, rad) {
    for (let it = 0; it < 2; it++) {
      for (const s of this.segs) {
        if (x < s.minx - rad || x > s.maxx + rad || z < s.minz - rad || z > s.maxz + rad) continue;
        const q = segDist(x, z, s.ax, s.az, s.bx, s.bz);
        const m = s.r + rad;
        if (q.d < m) {
          const nx = q.d > 1e-5 ? (x - q.cx) / q.d : 1, nz = q.d > 1e-5 ? (z - q.cz) / q.d : 0;
          x = q.cx + nx * m;
          z = q.cz + nz * m;
        }
      }
      for (const r of this.rects) {
        const dx = x - r.x, dz = z - r.z;
        if (dx * dx + dz * dz > (r.rad + rad) * (r.rad + rad)) continue;
        let lx = dx * r.cos + dz * r.sin, lz = -dx * r.sin + dz * r.cos;
        const ex = r.hw + rad, ez = r.hd + rad;
        if (Math.abs(lx) < ex && Math.abs(lz) < ez) {
          const px = ex - Math.abs(lx), pz = ez - Math.abs(lz);
          if (px < pz) lx = Math.sign(lx || 1) * ex;
          else lz = Math.sign(lz || 1) * ez;
          x = r.x + lx * r.cos - lz * r.sin;
          z = r.z + lx * r.sin + lz * r.cos;
        }
      }
    }
    const lim = this.half - 2;
    return [clamp(x, -lim, lim), clamp(z, -lim, lim)];
  }
  // Line of sight between two eye points (world y). Hedges/walls/houses block if the line passes under their top;
  // terrain blocks too, which is what makes trenches and banks real cover.
  los(ax, ay, az, bx, by, bz) {
    for (const s of this.segs) {
      if (Math.max(ax, bx) < s.minx || Math.min(ax, bx) > s.maxx || Math.max(az, bz) < s.minz || Math.min(az, bz) > s.maxz) continue;
      // offset test lines by r on both sides is overkill; test center line
      if (segHit(ax, az, bx, bz, s.ax, s.az, s.bx, s.bz)) {
        const t = this._tOn(ax, az, bx, bz, s.ax, s.az, s.bx, s.bz);
        const y = ay + (by - ay) * t;
        const gx = ax + (bx - ax) * t, gz = az + (bz - az) * t;
        if (y < this.height(gx, gz) + s.h) return false;
      }
    }
    for (const r of this.rects) {
      if (r.h < 0.5) continue;
      const c = [
        [-r.hw, -r.hd], [r.hw, -r.hd], [r.hw, r.hd], [-r.hw, r.hd],
      ].map(([lx, lz]) => [r.x + lx * r.cos - lz * r.sin, r.z + lx * r.sin + lz * r.cos]);
      for (let k = 0; k < 4; k++) {
        const p = c[k], q = c[(k + 1) % 4];
        if (segHit(ax, az, bx, bz, p[0], p[1], q[0], q[1])) {
          const t = this._tOn(ax, az, bx, bz, p[0], p[1], q[0], q[1]);
          const y = ay + (by - ay) * t;
          if (y < this.height(r.x, r.z) + r.h) return false;
        }
      }
    }
    const d = Math.hypot(bx - ax, bz - az);
    const n = Math.min(24, Math.ceil(d / 1.2));
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      if (ay + (by - ay) * t < this.height(x, z) + 0.05) return false;
    }
    return true;
  }
  _tOn(ax, az, bx, bz, cx, cz, dx, dz) {
    const d1x = bx - ax, d1z = bz - az, d2x = dx - cx, d2z = dz - cz;
    const den = d1x * d2z - d1z * d2x || 1e-9;
    return ((cx - ax) * d2z - (cz - az) * d2x) / den;
  }
  // nearest blocking element within r that would shelter you from a direction (for the cover HUD hint)
  nearCover(x, z, r = 1.6) {
    for (const s of this.segs) {
      if (s.h < 0.8) continue;
      if (segDist(x, z, s.ax, s.az, s.bx, s.bz).d < r + s.r) return s;
    }
    for (const r2 of this.rects) {
      if (r2.h < 0.8) continue;
      if (Math.hypot(x - r2.x, z - r2.z) < r2.rad + r) return r2;
    }
    return null;
  }
}

// ---- ground mesh -------------------------------------------------------------------------------
// colorFn(x,z,h) -> THREE.Color-like {r,g,b}
export function buildGround(world, colorFn, step = 1.0) {
  const s = world.size;
  const n = Math.round(s / step);
  const g = new T.PlaneGeometry(s, s, n, n);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const c = new T.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const h = world.height(x, z);
    p.setY(i, h);
    colorFn(x, z, h, c);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new T.BufferAttribute(col, 3));
  const ng = g.toNonIndexed();
  ng.computeVertexNormals();
  const m = new T.Mesh(ng, mat("ground"));
  m.receiveShadow = true;
  return m;
}

// ---- instanced scatter (grass tufts, flowers, stones) --------------------------------------------
export function scatter(world, builderFn, count, placeFn, kind = "foliage", seed = 3, cast = false) {
  const b = new Builder(seed);
  builderFn(b);
  const geo = b.build();
  if (kind === "foliage") {
    // grass lights like the ground under it: normals straight up (no black slivers at night)
    const n = geo.attributes.normal;
    for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  }
  const im = new T.InstancedMesh(geo, mat(kind), count);
  const r = rng(seed);
  const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), sc = new T.Vector3();
  const col = new T.Color();
  let k = 0;
  for (let tries = 0; tries < count * 6 && k < count; tries++) {
    const x = (r() - 0.5) * world.size * 0.96, z = (r() - 0.5) * world.size * 0.96;
    const res = placeFn(x, z, r, col);
    if (!res) continue;
    const y = world.height(x, z);
    e.set(res.tilt ? (r() - 0.5) * res.tilt : 0, r() * Math.PI * 2, res.tilt ? (r() - 0.5) * res.tilt : 0);
    q.setFromEuler(e);
    const s0 = res.scale || 1;
    sc.set(s0 * (res.sx || 1), s0 * (res.sy || 1), s0 * (res.sx || 1));
    v.set(x, y - (res.sink || 0), z);
    m4.compose(v, q, sc);
    im.setMatrixAt(k, m4);
    im.setColorAt(k, res.color || col.setRGB(1, 1, 1));
    k++;
  }
  im.count = k;
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.castShadow = cast;
  im.receiveShadow = true;
  im.frustumCulled = false;
  return im;
}
