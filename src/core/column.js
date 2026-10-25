// Columna en marcha o a la carrera por una ruta: la compañía avanza a un ritmo, el jugador corre dentro
// de ella con su aliento, respira al compás de la cadencia, y puede volver por los rezagados.
// Reutilizable para Currahee, la marcha a Atlanta o las marchas nocturnas de Inglaterra.
import { T, clamp, damp, rng, lerp } from "../engine/util.js";

export class Route {
  constructor(pts) {
    this.p = pts;
    this.len = [0];
    for (let i = 1; i < pts.length; i++) this.len.push(this.len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    this.total = this.len[this.len.length - 1];
  }
  at(s) {
    // beyond the ends the road carries straight on, so a long column behind the start isn't piled up
    if (s < 0 || s > this.total) {
      const end = s < 0 ? 0 : this.total, a = this.at(end), k = s - end;
      return { x: a.x + a.dx * k, z: a.z + a.dz * k, dx: a.dx, dz: a.dz };
    }
    let i = 1;
    while (i < this.len.length - 1 && this.len[i] < s) i++;
    const a = this.p[i - 1], b = this.p[i];
    const L = this.len[i] - this.len[i - 1] || 1;
    const t = (s - this.len[i - 1]) / L;
    const dx = (b[0] - a[0]) / L, dz = (b[1] - a[1]) / L;
    return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, dx, dz };
  }
  // arc length of the closest point. With a hint only segments within ±win metres of it are searched,
  // so a route that doubles back on itself (up the hill and down the same road) stays on the right leg.
  // head: optional unit vector of travel; on a road that doubles back, the leg running the same way wins
  project(x, z, hint = null, win = 30, head = null) {
    let best = hint ?? 0, bd = 1e9;
    for (let i = 1; i < this.p.length; i++) {
      if (hint != null && (this.len[i] < hint - win || this.len[i - 1] > hint + win)) continue;
      const a = this.p[i - 1], b = this.p[i];
      const L = this.len[i] - this.len[i - 1] || 1;
      const t = clamp(((x - a[0]) * (b[0] - a[0]) + (z - a[1]) * (b[1] - a[1])) / (L * L), 0, 1);
      const px = a[0] + (b[0] - a[0]) * t, pz = a[1] + (b[1] - a[1]) * t;
      const sa = this.len[i - 1] + t * L;
      // the way down is the same road as the way up: on identical points keep continuity with last frame (and lean forward)
      let d = (x - px) ** 2 + (z - pz) ** 2 + (hint != null ? 0.02 * (sa - hint) ** 2 + 0.01 * Math.max(0, hint - sa) : 0);
      if (head) d += 3 * Math.max(0, -((b[0] - a[0]) * head[0] + (b[1] - a[1]) * head[1]) / L);
      if (d < bd) {
        bd = d;
        best = sa;
      }
    }
    const a = this.at(best);
    return { s: best, off: Math.hypot(x - a.x, z - a.z) };
  }
}

// cfg: { route, men: [{sol, id, named, fit}], player, leader, pace(sCompany)->m/s, onStraggle, onRecover,
//        onLost(man), ambulances: [mesh], beat: () => {phase, ok}, roster }
export class Column {
  constructor(G, cfg) {
    this.G = G;
    this.cfg = cfg;
    this.route = cfg.route;
    this.s = cfg.start ?? 0; // arc length of the head of the column (the leader)
    this.dir = 1; // 1 up the route, -1 back down
    this.r = rng(cfg.seed || 3);
    this.men = cfg.men.map((m, i) => ({
      ...m,
      rank: Math.floor(i / 2),
      lane: i % 2 ? 0.75 : -0.75,
      stam: 1,
      lag: 0, // metres fallen behind his slot
      state: "ok", // ok | flag | lost
      helpT: 0,
      wob: this.r() * 6,
    }));
    this.p = { stam: 1, s: this.s - 3, hint: 0, breathT: 0, combo: 0 };
    this.spacing = 1.5;
    this.events = [];
    this.lostCount = 0;
  }
  // where a man of rank k should be right now
  slot(k, lane) {
    const s = this.s - this.dir * (2.2 + k * this.spacing);
    const a = this.route.at(s);
    const nx = -a.dz, nz = a.dx; // normal
    return { s, x: a.x + nx * lane, z: a.z + nz * lane, dx: a.dx * this.dir, dz: a.dz * this.dir };
  }
  tailS() {
    const last = Math.max(...this.men.map((m) => m.rank));
    return this.s - this.dir * (2.2 + (last + 2) * this.spacing);
  }
  update(dt, ctx) {
    if (dt <= 0) return;
    const G = this.G, cfg = this.cfg;
    const pace = cfg.pace(this.s, this.dir);
    this.s += pace * dt * this.dir;
    // leader
    const L = cfg.leader;
    if (L) {
      const a = this.route.at(this.s);
      L.faceAlong = [a.dx * this.dir, a.dz * this.dir];
      G.moveTo(L, a.x, a.z, dt, (pace / L.speed) * 1.35, 0.15);
      L.st.move = clamp(pace / 3.6, 0, 1);
    }
    // the men
    for (const m of this.men) {
      if (m.state === "lost") continue;
      const sl = this.slot(m.rank, m.lane);
      // personal stamina: drains with pace beyond what his fitness carries, worse uphill and when tired
      const climb = Math.max(0, (cfg.grade ? cfg.grade(this.s, this.dir) : 0));
      const demand = (pace / 3.6) ** 2 * (1 + climb * 3) * (cfg.drain || 1);
      const carry = 0.55 + (m.fit / 100) * 0.7 + (m.help || 0);
      m.stam = clamp(m.stam - (demand - carry) * dt * 0.06 - (cfg.sick?.(m) || 0) * dt, 0, 1);
      // a closer can only chase so many at once: the rest grit their teeth until someone is caught
      m.immuneT = Math.max(0, (m.immuneT || 0) - dt);
      if (m.state === "ok" && m.stam < 0.18 && !m.immune && !(m.immuneT > 0) && (!cfg.maxFlag || this.flagged().length < cfg.maxFlag)) {
        m.state = "flag";
        cfg.onStraggle && cfg.onStraggle(m);
      }
      if (m.state === "flag") {
        m.lag += dt * (0.9 + (0.18 - m.stam) * 4);
        m.sol.st.slump = damp(m.sol.st.slump || 0, 1, 3, dt);
        // caught up by the ambulance at the tail
        if ((this.slot(m.rank, 0).s - this.dir * m.lag - this.ambS()) * this.dir < (this.cfg.ambReach ?? 0.6)) {
          m.state = "lost";
          this.lostCount++;
          cfg.onLost && cfg.onLost(m);
          continue;
        }
      } else {
        m.lag = Math.max(0, m.lag - dt * 0.8);
        m.sol.st.slump = damp(m.sol.st.slump || 0, 0, 2, dt);
      }
      const target = this.route.at(sl.s - this.dir * m.lag);
      const nx = -target.dz, nz = target.dx;
      // a man who flags stumbles out to the edge of the road, so catching him takes a move across
      m.lat = damp(m.lat ?? m.lane, m.state === "flag" && cfg.tail ? Math.sign(m.lane) * 1.9 : m.lane, 1.4, dt);
      const tx = target.x + nx * m.lat + Math.sin(G.t * 0.7 + m.wob) * 0.12, tz = target.z + nz * m.lat;
      const d = Math.hypot(tx - m.sol.x, tz - m.sol.z);
      const want = pace * (m.state === "flag" ? 0.55 : 1) + d * 1.6;
      m.sol.faceAlong = [target.dx * this.dir, target.dz * this.dir];
      G.moveTo(m.sol, tx, tz, dt, clamp(want / m.sol.speed, 0, 1.6), 0.05);
      m.sol.st.move = clamp(want / 3.6, 0, 1.1) * (m.state === "flag" ? 0.75 : 1);
    }
    // ambulances crawl at the tail
    const amb = cfg.ambulances || [];
    amb.forEach((mesh, i) => {
      const s = this.ambS() - this.dir * i * 7;
      const a = this.route.at(s);
      mesh.position.set(a.x, G.world.height(a.x, a.z), a.z);
      mesh.rotation.y = Math.atan2(a.dx * this.dir, a.dz * this.dir);
    });
    if (this.cfg.tail) this.updateTail(dt, pace);
    else this.updatePlayer(dt, pace, ctx);
  }
  ambS() {
    // the truck's centre sits a gap plus half its length behind the last rank, so it never drives through men
    return this.tailS() - this.dir * (this.cfg.ambGap ?? 4.5);
  }
  updatePlayer(dt, pace, ctx) {
    const p = this.cfg.player, G = this.G, P = this.p;
    if (!p) return;
    // track along the route continuously: a narrow window around last frame's arc length, so the
    // two legs that meet at the summit never get confused; widen only if the player left the road
    // heading from the last frames (smoothed), so the way up and the way down are told apart
    if (P.px != null) {
      const vx = (p.x - P.px) / dt, vz = (p.z - P.pz) / dt;
      P.vx = damp(P.vx || 0, vx, 4, dt);
      P.vz = damp(P.vz || 0, vz, 4, dt);
    }
    P.px = p.x;
    P.pz = p.z;
    const sp = Math.hypot(P.vx || 0, P.vz || 0);
    const hd = sp > 0.6 ? [P.vx / sp, P.vz / sp] : null;
    let pr = this.route.project(p.x, p.z, P.s, 6, hd);
    if (pr.off > 6) pr = this.route.project(p.x, p.z, P.s, 30, hd);
    P.s = pr.s;
    // cruise: with the stick part-way the player runs at the column's pace (holding a thumb
    // half-pressed on glass is hard; holding a rhythm should be the skill). Pushing the stick to
    // the rim sprints, and only running faster than the column costs breath.
    const l = this.cfg.input ? this.cfg.input.axis().l : 1;
    // even spent, Winters can sprint a little faster than the column, so going back for a man is never a trap
    const sprint = Math.max(pace * 1.12, lerp(2.9, 5.0, clamp(P.stam * 1.4, 0, 1)));
    const cruise = Math.min(sprint, pace * 1.06);
    const want = l < 0.85 ? cruise / Math.max(0.3, l) : sprint;
    p.speed = Math.min(want, 9);
    const v = p.st.move * p.speed;
    const climb = Math.max(0, this.cfg.grade ? this.cfg.grade(P.s, this.dir) : 0);
    const excess = Math.max(0, v - pace * 1.08);
    const cost = (excess / 2) ** 1.5 * (1 + climb * 1.5) * (this.cfg.drain || 1) * 0.12 + (this.cfg.sick?.({ id: p.id, player: true }) || 0) + climb * 0.2 * (this.cfg.drain || 1); // the hill itself: ~1 %/s net on the climb if you never breathe
    P.stam = clamp(P.stam - cost * dt + (this.cfg.regen ?? 0.012) * dt, 0, 1);
    P.breathT = Math.max(0, P.breathT - dt);
    // position relative to the column: ahead of the leader, inside, or near the ambulances
    const head = this.s, amb = this.ambS();
    P.rel = (P.s - amb) / (head - amb || 1) * this.dir;
    if (this.dir < 0) P.rel = (amb - P.s) / (amb - head || 1);
  }
  // ---- tail mode: the player closes the column. He is driven along the road at the column's pace;
  // the stick moves him up or back through the column and across the road; a sprint button spends breath.
  // A man who flags drifts back through the ranks: touch him and he recovers; if he gets behind you,
  // he has passed you (cfg.onPass). Leaving the road is reported through P.off (metres from the centre).
  updateTail(dt, pace) {
    const p = this.cfg.player, G = this.G, P = this.p, inp = this.cfg.input;
    if (!p) return;
    if (P.s == null || P.lat == null) {
      P.s = this.tailS();
      P.lat = 0;
    }
    // the stick, in world space, split into along-the-road and across-the-road
    const ax = inp ? inp.axis() : { x: 0, y: 0, l: 0 };
    const cy = Math.cos(G.cam.yaw), sy = Math.sin(G.cam.yaw);
    const wx = ax.x * cy + ax.y * sy, wz = -ax.x * sy + ax.y * cy;
    const a = this.route.at(P.s);
    const fx = a.dx * this.dir, fz = a.dz * this.dir, nx = -fz, nz = fx;
    const along = wx * fx + wz * fz, across = wx * nx + wz * nz;
    // breath: low breath slows him below the column's pace (he starts to drop back)
    const spent = P.stam < 0.1 ? 0.88 : P.stam < 0.25 ? 0.95 : 1;
    const sprint = inp && inp.held.sprint && P.stam > 0.04;
    const rel = along * (sprint ? 3.2 : 1.6); // m/s relative to the column
    const v = Math.max(0.4, pace * spent + (sprint && Math.abs(along) < 0.2 ? 2.4 : rel));
    P.s += v * dt * this.dir;
    P.lat += across * (sprint ? 3.6 : 2.6) * dt;
    const b = this.route.at(P.s);
    const bnx = -b.dz * this.dir, bnz = b.dx * this.dir;
    p.x = b.x + bnx * P.lat;
    p.z = b.z + bnz * P.lat;
    p.faceAlong = [b.dx * this.dir, b.dz * this.dir];
    p.face(p.x + b.dx * this.dir * 4 + bnx * across * 2, p.z + b.dz * this.dir * 4 + bnz * across * 2, dt, 8);
    p.st.move = clamp(v / 3.6, 0, 1.2);
    P.off = Math.abs(P.lat);
    P.sprinting = sprint;
    // breath: the hill and the sprint cost it, breathing on the beat gives it back (breathe())
    const climb = Math.max(0, this.cfg.grade ? this.cfg.grade(P.s, this.dir) : 0);
    const cost = climb * 0.17 * (this.cfg.drain || 1) + (sprint ? 0.16 : 0) + (rel > 0.3 ? 0.03 : 0) + (this.cfg.sick?.({ id: p.id, player: true }) || 0);
    P.stam = clamp(P.stam - cost * dt + (this.cfg.regen ?? 0.012) * dt, 0, 1);
    P.breathT = Math.max(0, P.breathT - dt);
    // where he is: 0 = at the ambulance, 1 = at the head
    const head = this.s, amb = this.ambS();
    P.rel = ((P.s - amb) * this.dir) / ((head - amb) * this.dir || 1);
    P.dAmb = (P.s - amb) * this.dir - (this.cfg.ambReach ?? 0.6); // metres of road between him and the truck's bumper
    // stragglers: caught on touch; passed once they are behind him
    for (const m of this.men) {
      if (m.state !== "flag") continue;
      const ms = this.slot(m.rank, 0).s - this.dir * m.lag;
      const d = Math.hypot(m.sol.x - p.x, m.sol.z - p.z);
      if (d < 1.25) {
        // a hand on his back and a word: he finds his legs again, and won't fold for a while
        m.state = "ok";
        m.stam = 0.8;
        m.help = (m.help || 0) + 0.25;
        m.immuneT = 25;
        m.helped = (m.helped || 0) + 1;
        m.passed = false;
        P.stam = clamp(P.stam - 0.04, 0, 1);
        this.cfg.onRecover && this.cfg.onRecover(m);
      } else if (!m.passed && (P.s - ms) * this.dir > 2.2) {
        m.passed = true;
        this.cfg.onPass && this.cfg.onPass(m);
      }
    }
  }
  // the player breathes on the cadence: ok → stamina back, off-beat → a stitch
  breathe(onBeat) {
    const P = this.p;
    if (onBeat) {
      P.combo = Math.min(6, P.combo + 1);
      P.stam = clamp(P.stam + 0.025 + P.combo * 0.006, 0, 1);
      P.breathT = 0.4;
      return true;
    }
    P.combo = 0;
    P.stam = clamp(P.stam - 0.025, 0, 1);
    return false;
  }
  // a hand on the back of a man who is fading
  helpNearest(maxD = 2.4) {
    const p = this.cfg.player;
    let best = null, bd = maxD;
    for (const m of this.men) {
      if (m.state !== "flag") continue;
      const d = Math.hypot(m.sol.x - p.x, m.sol.z - p.z);
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    if (!best) return null;
    best.state = "ok";
    best.stam = 0.62;
    best.help = (best.help || 0) + 0.18;
    best.helped = (best.helped || 0) + 1;
    this.p.stam = clamp(this.p.stam - (this.p.stam < 0.3 ? 0.08 : 0.14), 0, 1);
    this.cfg.onRecover && this.cfg.onRecover(best);
    return best;
  }
  flagged() {
    return this.men.filter((m) => m.state === "flag");
  }
}
