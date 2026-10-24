// Effects: soft particles, tracers, muzzle flashes, explosions, flak in the sky, flares, burning fires.
import { T, rng, clamp } from "./util.js";

// ------------------------------------------------------------------------------------------------
// Particle pool rendered as round soft points. Colours are HDR (values > 1 glow through bloom).
export class Particles {
  constructor(scene, max = 1500, { additive = false, soft = 1 } = {}) {
    this.max = max;
    this.n = 0;
    this.p = new Float32Array(max * 3);
    this.c = new Float32Array(max * 4);
    this.s = new Float32Array(max);
    this.d = []; // simulation data
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.BufferAttribute(this.p, 3).setUsage(35048));
    g.setAttribute("color", new T.BufferAttribute(this.c, 4).setUsage(35048));
    g.setAttribute("size", new T.BufferAttribute(this.s, 1).setUsage(35048));
    this.u = { scale: { value: 40 }, soft: { value: soft } };
    const m = new T.ShaderMaterial({
      uniforms: this.u,
      transparent: true,
      depthWrite: false,
      blending: additive ? 2 : 1,
      vertexShader: `attribute float size; attribute vec4 color; uniform float scale; varying vec4 vC;
        void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = max(1.0, size * scale); }`,
      fragmentShader: `varying vec4 vC; uniform float soft;
        void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; if (r > 1.0) discard;
          float a = mix(1.0 - step(0.85, r), 1.0 - r * r, soft); gl_FragColor = vec4(vC.rgb, vC.a * a); }`,
    });
    this.mesh = new T.Points(g, m);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 8 : 7;
    scene.add(this.mesh);
    this.geo = g;
  }
  // o: {x,y,z, vx,vy,vz, life, s0,s1, c0:[r,g,b,a], c1:[...], grav, drag, floor, fadeIn}
  emit(o) {
    if (this.d.length >= this.max) this.d.shift();
    this.d.push({ ...o, t: 0, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0 });
  }
  update(dt) {
    const d = this.d;
    let k = 0;
    for (let i = 0; i < d.length; i++) {
      const q = d[i];
      q.t += dt;
      if (q.t >= q.life) continue;
      const drag = q.drag || 0;
      q.vy -= (q.grav || 0) * dt;
      const f = Math.exp(-drag * dt);
      q.vx *= f;
      q.vy *= f;
      q.vz *= f;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.z += q.vz * dt;
      if (q.floor !== undefined && q.y < q.floor) {
        q.y = q.floor;
        q.vy *= -0.2;
        q.vx *= 0.5;
        q.vz *= 0.5;
      }
      const u = q.t / q.life;
      const fi = q.mist ? Math.sin(u * Math.PI) * 0.16 : q.fadeIn ? clamp(q.t / q.fadeIn, 0, 1) : 1;
      this.p[k * 3] = q.x;
      this.p[k * 3 + 1] = q.y;
      this.p[k * 3 + 2] = q.z;
      const c0 = q.c0, c1 = q.c1 || q.c0;
      this.c[k * 4] = c0[0] + (c1[0] - c0[0]) * u;
      this.c[k * 4 + 1] = c0[1] + (c1[1] - c0[1]) * u;
      this.c[k * 4 + 2] = c0[2] + (c1[2] - c0[2]) * u;
      this.c[k * 4 + 3] = q.mist ? fi : (c0[3] + (c1[3] - c0[3]) * u) * fi;
      this.s[k] = q.s0 + ((q.s1 ?? q.s0) - q.s0) * u;
      d[k++] = q;
    }
    d.length = k;
    this.n = k;
    this.geo.setDrawRange(0, k);
    const a = this.geo.attributes;
    a.position.needsUpdate = a.color.needsUpdate = a.size.needsUpdate = true;
  }
}

// ------------------------------------------------------------------------------------------------
// Tracers: short glowing streaks travelling at bullet speed (scaled down so the eye can follow).
export class Tracers {
  constructor(scene, max = 120) {
    this.max = max;
    this.list = [];
    const g = new T.BufferGeometry();
    this.a = new Float32Array(max * 4 * 3);
    this.b = new Float32Array(max * 4 * 3);
    this.col = new Float32Array(max * 4 * 3);
    const cc = new Float32Array(max * 4 * 2);
    const idx = [];
    for (let i = 0; i < max; i++) {
      cc.set([0, -1, 0, 1, 1, -1, 1, 1], i * 8);
      const l = i * 4;
      idx.push(l, l + 2, l + 1, l + 1, l + 2, l + 3);
    }
    g.setAttribute("position", new T.BufferAttribute(this.a, 3).setUsage(35048));
    g.setAttribute("aB", new T.BufferAttribute(this.b, 3).setUsage(35048));
    g.setAttribute("aCol", new T.BufferAttribute(this.col, 3).setUsage(35048));
    g.setAttribute("aC", new T.BufferAttribute(cc, 2));
    g.setIndex(idx);
    this.u = { width: { value: 0.07 } };
    const m = new T.ShaderMaterial({
      uniforms: this.u,
      transparent: true,
      depthWrite: false,
      blending: 2,
      vertexShader: `attribute vec3 aB; attribute vec2 aC; attribute vec3 aCol; uniform float width; varying vec2 vC; varying vec3 vCol;
        void main(){ vec4 A = modelViewMatrix * vec4(position,1.0), B = modelViewMatrix * vec4(aB,1.0);
          vec2 d = B.xy - A.xy; float l = length(d); d = l > 1e-4 ? d / l : vec2(1.0,0.0);
          vec4 P = mix(A, B, aC.x); P.xy += vec2(-d.y, d.x) * aC.y * width * mix(0.4, 1.0, aC.x);
          vC = aC; vCol = aCol; gl_Position = projectionMatrix * P; }`,
      fragmentShader: `varying vec2 vC; varying vec3 vCol;
        void main(){ float core = 1.0 - abs(vC.y); float a = vC.x * vC.x * core * core;
          vec3 col = vCol * a + vec3(1.0, 0.8, 0.5) * pow(core, 8.0) * vC.x * vC.x * vC.x * 0.8; gl_FragColor = vec4(col, a * 0.85); }`,
    });
    this.mesh = new T.Mesh(g, m);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 9;
    scene.add(this.mesh);
    this.geo = g;
    this.onHit = null;
  }
  // col: [r,g,b] hdr ; speed in m/s (visual) ; len streak length
  shoot(ax, ay, az, bx, by, bz, col = [5, 2.6, 0.9], speed = 70, len = 2.2, data = null) {
    if (this.list.length >= this.max) this.list.shift();
    const d = Math.max(0.5, Math.hypot(bx - ax, by - ay, bz - az));
    this.list.push({ ax, ay, az, bx, by, bz, t: 0, d, col, speed, len, hit: false, data });
  }
  update(dt) {
    let k = 0;
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const r = L[i];
      r.t += dt;
      const o = clamp((r.t * r.speed) / r.d, 0, 1);
      const l = Math.max(0, o - r.len / r.d);
      if (o >= 1 && !r.hit) {
        r.hit = true;
        this.onHit && this.onHit(r);
      }
      if (l >= 1) continue;
      const x0 = r.ax + (r.bx - r.ax) * l, y0 = r.ay + (r.by - r.ay) * l, z0 = r.az + (r.bz - r.az) * l;
      const x1 = r.ax + (r.bx - r.ax) * o, y1 = r.ay + (r.by - r.ay) * o, z1 = r.az + (r.bz - r.az) * o;
      for (let v = 0; v < 4; v++) {
        const p = (k * 4 + v) * 3;
        this.a[p] = x0;
        this.a[p + 1] = y0;
        this.a[p + 2] = z0;
        this.b[p] = x1;
        this.b[p + 1] = y1;
        this.b[p + 2] = z1;
        this.col[p] = r.col[0];
        this.col[p + 1] = r.col[1];
        this.col[p + 2] = r.col[2];
      }
      L[k++] = r;
    }
    L.length = k;
    this.geo.setDrawRange(0, k * 6);
    const a = this.geo.attributes;
    a.position.needsUpdate = a.aB.needsUpdate = a.aCol.needsUpdate = true;
  }
}

// ------------------------------------------------------------------------------------------------
// A small pool of point lights reused for muzzle flashes and blasts (never more than 3 live).
export class FlashLights {
  constructor(scene, n = 3) {
    this.l = [];
    for (let i = 0; i < n; i++) {
      const p = new T.PointLight(0xffa860, 0, 14, 1.6);
      p.castShadow = false;
      scene.add(p);
      this.l.push({ p, t: 0, dur: 1, i0: 0 });
    }
    this.k = 0;
  }
  flash(x, y, z, intensity = 8, dur = 0.08, dist = 10, color = 0xffa860) {
    // prefer a free light, else the weakest
    let best = this.l[0];
    for (const q of this.l) if (q.t <= 0 || q.p.intensity < best.p.intensity) best = q;
    best.p.position.set(x, y, z);
    best.p.color.setHex(color);
    best.p.distance = dist;
    best.t = dur;
    best.dur = dur;
    best.i0 = intensity;
    best.p.intensity = intensity;
  }
  update(dt) {
    for (const q of this.l) {
      if (q.t > 0) {
        q.t -= dt;
        q.p.intensity = q.i0 * clamp(q.t / q.dur, 0, 1) ** 1.5;
      } else q.p.intensity = 0;
    }
  }
}

// ------------------------------------------------------------------------------------------------
// FX hub with the composite effects the game asks for.
export class FX {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.smoke = new Particles(scene, 900, { additive: false, soft: 1 });
    this.glow = new Particles(scene, 700, { additive: true, soft: 1 });
    this.tracers = new Tracers(scene, 140);
    this.lights = new FlashLights(scene, 3);
    this.flash = 0; // drives the post shader (warm, never white)
    this.shake = 0;
    this.r = rng(5);
    this.fires = [];
    this.skyTracers = [];
  }
  muzzle(p, dir, big = false) {
    const r = this.r;
    this.glow.emit({ x: p.x, y: p.y, z: p.z, life: 0.06, s0: big ? 1.0 : 0.7, s1: 0.3, c0: [4, 2.2, 0.7, 1], c1: [2, 0.6, 0.1, 0] });
    for (let i = 0; i < 3; i++)
      this.glow.emit({ x: p.x, y: p.y, z: p.z, vx: dir.x * (6 + r() * 6) + (r() - 0.5) * 2, vy: (r() - 0.3) * 2, vz: dir.z * (6 + r() * 6) + (r() - 0.5) * 2, life: 0.08 + r() * 0.05, s0: 0.25, s1: 0.05, c0: [4, 1.8, 0.5, 1], c1: [1.5, 0.4, 0.05, 0], drag: 6 });
    this.smoke.emit({ x: p.x, y: p.y, z: p.z, vx: dir.x * 1.2, vy: 0.4, vz: dir.z * 1.2, life: 0.9, s0: 0.25, s1: 0.9, c0: [0.5, 0.5, 0.52, 0.25], c1: [0.5, 0.5, 0.52, 0], drag: 1.6 });
    this.lights.flash(p.x, p.y + 0.2, p.z, big ? 10 : 6, 0.06, 9);
  }
  dirt(x, z, k = 1) {
    const r = this.r;
    const y = this.world.height(x, z);
    for (let i = 0; i < 5 * k; i++)
      this.smoke.emit({ x, y: y + 0.05, z, vx: (r() - 0.5) * 2.2, vy: 2 + r() * 2.5, vz: (r() - 0.5) * 2.2, life: 0.6 + r() * 0.3, s0: 0.12, s1: 0.06, c0: [0.22, 0.17, 0.12, 1], c1: [0.2, 0.16, 0.12, 0.6], grav: 9, floor: y });
    this.smoke.emit({ x, y: y + 0.2, z, vy: 0.5, life: 1.0, s0: 0.3, s1: 1.1, c0: [0.36, 0.32, 0.27, 0.35], c1: [0.4, 0.37, 0.33, 0], drag: 1 });
  }
  blood(x, y, z) {
    const r = this.r;
    for (let i = 0; i < 6; i++)
      this.smoke.emit({ x, y, z, vx: (r() - 0.5) * 2, vy: r() * 1.5, vz: (r() - 0.5) * 2, life: 0.5, s0: 0.1, s1: 0.06, c0: [0.32, 0.03, 0.02, 0.9], c1: [0.2, 0.02, 0.02, 0], grav: 9 });
  }
  // shell / grenade burst: warm core, dark earth, rising smoke column. flash is warm and capped.
  explosion(x, z, size = 1, near = 1) {
    const r = this.r;
    const y = this.world.height(x, z);
    this.glow.emit({ x, y: y + 0.5, z, life: 0.18, s0: 6 * size, s1: 3 * size, c0: [3.2, 1.4, 0.4, 1], c1: [1.2, 0.35, 0.05, 0] });
    for (let i = 0; i < 18 * size; i++)
      this.glow.emit({ x, y: y + 0.4, z, vx: (r() - 0.5) * 14 * size, vy: 3 + r() * 9 * size, vz: (r() - 0.5) * 14 * size, life: 0.35 + r() * 0.4, s0: 0.22, s1: 0.06, c0: [3, 1.3, 0.35, 1], c1: [1.2, 0.3, 0.05, 0], grav: 14, drag: 0.6 });
    for (let i = 0; i < 26 * size; i++)
      this.smoke.emit({ x: x + (r() - 0.5), y: y + 0.3, z: z + (r() - 0.5), vx: (r() - 0.5) * 8 * size, vy: 4 + r() * 8 * size, vz: (r() - 0.5) * 8 * size, life: 1 + r() * 0.8, s0: 0.25 + r() * 0.2, s1: 0.15, c0: [0.17, 0.13, 0.1, 1], c1: [0.17, 0.14, 0.11, 0.8], grav: 11, floor: y, drag: 0.4 });
    for (let i = 0; i < 10 * size; i++)
      this.smoke.emit({ x: x + (r() - 0.5) * 2, y: y + 0.5 + r(), z: z + (r() - 0.5) * 2, vx: (r() - 0.5) * 1.5, vy: 1 + r() * 1.5, vz: (r() - 0.5) * 1.5, life: 4 + r() * 3, s0: 1.4 * size, s1: 4.5 * size, c0: [0.2, 0.19, 0.18, 0.75], c1: [0.42, 0.41, 0.42, 0], drag: 0.5, fadeIn: 0.2 });
    this.lights.flash(x, y + 1.5, z, 40 * size, 0.35, 26 * size, 0xff9a50);
    this.flash = Math.min(1, this.flash + 0.55 * near);
    this.shake = Math.min(1.2, this.shake + 0.7 * near);
  }
  // distant flak: arcing tracer chains up into the night sky
  flak(x, z, n = 6) {
    const r = this.r;
    const ang = r() * Math.PI * 2;
    const dx = Math.cos(ang) * 0.35, dz = Math.sin(ang) * 0.35;
    for (let i = 0; i < n; i++) {
      this.skyTracers.push({ x, y: this.world.height(x, z) + 1.5, z, vx: dx * 30 + (r() - 0.5) * 3, vy: 55 + r() * 10, vz: dz * 30 + (r() - 0.5) * 3, t: -i * 0.09, life: 1.8 });
    }
  }
  burst(x, y, z) {
    const r = this.r;
    this.glow.emit({ x, y, z, life: 0.2, s0: 4, s1: 1, c0: [3, 1.6, 0.6, 1], c1: [1, 0.3, 0, 0] });
    this.smoke.emit({ x, y, z, life: 3.5, s0: 2.5, s1: 4.5, c0: [0.12, 0.12, 0.13, 0.7], c1: [0.2, 0.2, 0.22, 0], drag: 0.5 });
  }
  addFire(x, y, z, size = 1) {
    this.fires.push({ x, y, z, size, t: this.r() * 10 });
  }
  update(dt) {
    const r = this.r;
    for (const f of this.fires) {
      f.t += dt;
      if (r() < dt * 22 * f.size)
        this.glow.emit({ x: f.x + (r() - 0.5) * f.size, y: f.y, z: f.z + (r() - 0.5) * f.size, vx: (r() - 0.5) * 0.4, vy: 1.4 + r() * 1.6 * f.size, vz: (r() - 0.5) * 0.4, life: 0.5 + r() * 0.5, s0: 0.7 * f.size, s1: 0.15, c0: [2.6, 1.0, 0.25, 0.9], c1: [1.2, 0.25, 0.04, 0] });
      if (r() < dt * 5 * f.size)
        this.smoke.emit({ x: f.x, y: f.y + f.size, z: f.z, vx: 0.6, vy: 1.2, vz: 0.2, life: 6, s0: 1.2 * f.size, s1: 5 * f.size, c0: [0.09, 0.08, 0.08, 0.55], c1: [0.16, 0.16, 0.18, 0], drag: 0.2, fadeIn: 0.5 });
    }
    // sky tracers (flak): emit glowing points along their path
    for (let i = this.skyTracers.length - 1; i >= 0; i--) {
      const s = this.skyTracers[i];
      s.t += dt;
      if (s.t < 0) continue;
      s.vy -= 9.8 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      this.glow.emit({ x: s.x, y: s.y, z: s.z, life: 0.25, s0: 0.5, s1: 0.2, c0: [4, 2.4, 0.8, 1], c1: [2, 0.6, 0.1, 0] });
      if (s.t > s.life) {
        if (r() < 0.4) this.burst(s.x, s.y, s.z);
        this.skyTracers.splice(i, 1);
      }
    }
    this.smoke.update(dt);
    this.glow.update(dt);
    this.tracers.update(dt);
    this.lights.update(dt);
    this.flash *= Math.exp(-dt * 5);
    this.shake *= Math.exp(-dt * 4);
  }
  setScale(s) {
    this.smoke.u.scale.value = s;
    this.glow.u.scale.value = s;
  }
}
