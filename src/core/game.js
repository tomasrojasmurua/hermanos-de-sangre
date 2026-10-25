// Core loop: soldiers, player control, AI, combat, grenades, camera, scripting helpers.
import { T, clamp, lerp, damp, angDiff, rng, smooth } from "../engine/util.js";
import { buildSoldier, animate, muzzle } from "./actors.js";
import { U } from "../engine/geo.js";
import { WEAPONS } from "../data/weapons.js";

export { WEAPONS };
const _v = new T.Vector3(), _v2 = new T.Vector3(), _dir = new T.Vector3();

let SID = 0;
export class Soldier {
  constructor(g, o) {
    this.g = g;
    this.id = o.id || "s" + SID++;
    this.name = o.name || "";
    this.short = o.short || o.name || "";
    this.rank = o.rank || "";
    this.side = o.side || "us";
    this.portrait = o.portrait || {};
    const build = { kit: o.kit || (this.side === "us" ? "para" : "heer"), weapon: o.weapon === "knife" ? "none" : o.weapon, rank: o.rankKey, seed: o.seed ?? Math.floor(Math.random() * 1e6), mustache: o.mustache, skin: o.skin, paint: o.paint, medic: o.medic };
    this.opts = { ...o, build };
    this.a = buildSoldier(build);
    g.scene.add(this.a.root);
    this.x = o.x || 0;
    this.z = o.z || 0;
    this.y = g.world.height(this.x, this.z);
    this.ry = o.ry || 0;
    this.hp = o.hp ?? 100;
    this.maxHp = this.hp;
    this.alive = true;
    this.crouch = !!o.crouch;
    this.st = { move: 0, crouch: this.crouch ? 1 : 0, aim: 0, fire: 0, throw: 0, dead: 0, stab: 0, heal: 0, prone: 0 };
    this.wkind = o.weapon || "m1";
    const w = WEAPONS[this.wkind] || {};
    this.clip = o.clip ?? w.clip ?? 0;
    this.reserve = o.reserve ?? (w.clip ? w.clip * 3 : 0);
    this.cool = 0;
    this.reloadT = 0;
    this.burst = 0;
    this.grenades = o.grenades ?? 0;
    this.bandages = o.bandages ?? 0;
    this.bleeding = false;
    this.healT = 0;
    this.speed = o.speed || 3.6;
    this.ai = o.ai || null;
    this.protect = o.protect || 0; // 0 = can die, 1 = goes down wounded instead, 2 = ignores damage (scripted)
    this.down = false;
    this.aware = 0;
    this.target = null;
    this.seenT = 0;
    this.lastKnown = null;
    this.flashT = 0; // visible because just fired
    this.hitFlash = 0;
    this.say = o.say || null;
    this.kills = 0;
    this.tag = o.tag || null;
    this.a.root.position.set(this.x, this.y, this.z);
    // soft contact shadow: keeps every man readable on the ground even without shadow maps
    if (!Soldier.blobGeo) {
      Soldier.blobGeo = new T.CircleGeometry(0.55, 14).rotateX(-Math.PI / 2);
      Soldier.blobMat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false });
    }
    this.blob = new T.Mesh(Soldier.blobGeo, Soldier.blobMat);
    this.blob.renderOrder = 2;
    g.scene.add(this.blob);
  }
  get eye() {
    return this.y + (this.alive ? (this.down ? 0.4 : this.crouch ? 1.0 : 1.55) : 0.3);
  }
  get chest() {
    return this.y + (this.down ? 0.3 : this.crouch ? 0.75 : 1.2);
  }
  face(x, z, dt, k = 10) {
    const want = Math.atan2(x - this.x, z - this.z);
    this.ry += angDiff(this.ry, want) * Math.min(1, k * dt);
  }
  remove() {
    this.g.scene.remove(this.a.root);
    this.g.scene.remove(this.blob);
  }
  setWeapon(kind, clip, reserve) {
    const o = this.opts;
    this.g.scene.remove(this.a.root);
    this.a = buildSoldier({ ...o.build, weapon: kind === "knife" ? "none" : kind });
    this.g.scene.add(this.a.root);
    this.wkind = kind;
    this.clip = clip ?? WEAPONS[kind]?.clip ?? 0;
    this.reserve = reserve ?? 0;
    this.a.root.position.set(this.x, this.y, this.z);
  }
}

export class Game {
  constructor({ scene, camera, world, fx, audio, ui, input, renderer }) {
    Object.assign(this, { scene, camera, world, fx, audio, ui, input, renderer });
    this.soldiers = [];
    this.t = 0;
    this.player = null;
    this.paused = false;
    this.slow = 1;
    this.gen = 0;
    this.waiters = [];
    this.grenades = [];
    this.cam = { x: 0, z: 0, tx: 0, tz: 0, yaw: Math.PI / 4, pitch: 0.74, span: 12.5, vel: 0, look: { x: 0, z: 0 }, focus: null };
    this.objective = null; // {text, x, z}
    this.night = false;
    this.lights = []; // world light sources that expose soldiers at night [{x,z,r}]
    this.noises = [];
    this.triggers = [];
    this.onPlayerDeath = null;
    this.flags = {};
    this.r = rng(77);
    this.trail = [];
    this.hurtV = 0;
    this.diff = 1;
    fx.tracers.onHit = (tr) => this._tracerHit(tr);
  }
  // ---- entities ---------------------------------------------------------------------------------
  add(o) {
    const s = new Soldier(this, o);
    this.soldiers.push(s);
    return s;
  }
  byId(id) {
    return this.soldiers.find((s) => s.id === id);
  }
  enemies() {
    return this.soldiers.filter((s) => s.side === "de" && s.alive);
  }
  allies() {
    return this.soldiers.filter((s) => s.side === "us" && s.alive && s !== this.player);
  }
  setPlayer(s) {
    if (this.player) this.player.isPlayer = false;
    this.player = s;
    s.isPlayer = true;
    s.ai = null;
    this.ui.setWho(s);
    this.trail = [];
  }
  dist(a, b) {
    return Math.hypot(a.x - b.x, a.z - b.z);
  }
  // ---- scripting helpers ------------------------------------------------------------------------
  until(fn) {
    const gen = this.gen;
    return new Promise((res, rej) => this.waiters.push({ fn, res, rej, gen }));
  }
  wait(sec) {
    const end = this.t + sec;
    return this.until(() => this.t >= end);
  }
  abortScripts() {
    this.gen++;
    for (const w of this.waiters) w.rej(new Error("abort"));
    this.waiters = [];
  }
  async lines(list) {
    for (const [who, text, dur] of list) {
      this.ui.say(who, text, dur);
    }
    await this.until(() => !this.ui.talking);
  }
  setObjective(text, x, z) {
    this.objective = text ? { text, x, z } : null;
  }
  trigger(x, z, r, fn, once = true) {
    this.triggers.push({ x, z, r, fn, once });
  }
  noise(x, z, r, src) {
    this.noises.push({ x, z, r, src, t: this.t });
  }
  // ---- per-frame --------------------------------------------------------------------------------
  update(rdt) {
    const dt = this.paused ? 0 : rdt * this.slow;
    this.t += dt;
    U.time.value += rdt;
    if (!this.paused) {
      for (let i = this.waiters.length - 1; i >= 0; i--) {
        const w = this.waiters[i];
        if (w.gen !== this.gen) continue;
        let ok = false;
        try {
          ok = w.fn();
        } catch (e) {
          console.error(e);
        }
        if (ok) {
          this.waiters.splice(i, 1);
          w.res();
        }
      }
      this.updatePlayer(dt);
      this.noises = this.noises.filter((n) => this.t - n.t < 0.2);
      for (const s of this.soldiers) if (s !== this.player) this.updateAI(s, dt);
      this.updateGrenades(dt);
      for (const tr of this.triggers) {
        if (tr.done || !this.player) continue;
        if (Math.hypot(this.player.x - tr.x, this.player.z - tr.z) < tr.r) {
          if (tr.once) tr.done = true;
          tr.fn();
        }
      }
      this.triggers = this.triggers.filter((t) => !t.done);
    }
    for (const s of this.soldiers) this.updateBody(s, dt);
    this.fx.update(dt);
    this.updateCamera(rdt);
    this.updateHUD(rdt);
    this.input.endFrame();
  }
  // ---- player -----------------------------------------------------------------------------------
  updatePlayer(dt) {
    const p = this.player;
    if (!p || !p.alive) return;
    if (p.driven) return; // moved by a mode of its own (the Currahee column's tail)
    const inp = this.input;
    const ax = inp.axis();
    // screen axis -> world (camera yaw)
    const cy = Math.cos(this.cam.yaw), sy = Math.sin(this.cam.yaw);
    let wx = ax.x * cy + ax.y * sy;
    let wz = -ax.x * sy + ax.y * cy;
    if (inp.consume("crouch")) {
      p.crouch = !p.crouch;
      this.ui.setCrouch(p.crouch);
    }
    const busy = p.healT > 0 || p.st.stab > 0.2 || this.lockMove;
    const sp = busy ? 0 : p.speed * (p.crouch ? 0.52 : 1) * (p.hp < 30 ? 0.8 : 1) * ax.l;
    if (sp > 0.05) {
      const nx = p.x + wx * sp * dt, nz = p.z + wz * sp * dt;
      const [cx, cz] = this.world.collide(nx, nz, 0.33);
      p.x = cx;
      p.z = cz;
      if (!(p.aimT > 0)) p.face(p.x + wx, p.z + wz, dt, 12);
      p.st.move = damp(p.st.move, (sp / p.speed) * (p.crouch ? 0.7 : 1), 12, dt);
      // footsteps make noise when standing & moving fast at night
      p.stepT = (p.stepT || 0) - dt * sp;
      if (p.stepT <= 0) {
        p.stepT = 1.6;
        if (!this.quietSteps) this.audio.footstep(p.crouch ? 0.4 : 1);
        if (!p.crouch && ax.l > 0.6) this.noise(p.x, p.z, 7, p);
      }
      const last = this.trail[this.trail.length - 1];
      if (!last || Math.hypot(last.x - p.x, last.z - p.z) > 0.9) {
        this.trail.push({ x: p.x, z: p.z, c: p.crouch });
        if (this.trail.length > 90) this.trail.shift();
      }
    } else p.st.move = damp(p.st.move, 0, 12, dt);
    p.aimT = Math.max(0, (p.aimT || 0) - dt);
    // weapon
    this.weaponTick(p, dt);
    if (p.wkind === "knife") {
      if (inp.consume("fire")) this.tryStab(p);
    } else if (inp.held.fire && p.reloadT <= 0) {
      const tgt = this.pickTarget(p);
      if (tgt) {
        p.face(tgt.x, tgt.z, dt, 30);
        p.aimT = 0.6;
      }
      if (p.cool <= 0) {
        if (p.clip > 0) this.fire(p, tgt);
        else if (p.reserve > 0) this.startReload(p);
        else if (inp.consume("fire")) {
          this.ui.toast("Sin munición");
          this.audio.reload();
        }
      }
    }
    if (inp.consume("reload") && p.clip < (WEAPONS[p.wkind]?.clip || 0) && p.reserve > 0) this.startReload(p);
    if (inp.consume("grenade")) {
      if (p.grenades > 0) this.throwGrenade(p, this.pickGrenadeSpot(p));
      else this.ui.toast("No te quedan granadas");
    }
    if (inp.consume("heal")) {
      if (p.bandages <= 0) this.ui.toast("No te quedan vendas");
      else if (p.hp >= p.maxHp && !p.bleeding) this.ui.toast("No estás herido");
      else if (p.healT <= 0) p.healT = 2.6;
    }
    if (p.healT > 0) {
      p.healT -= dt;
      p.st.heal = damp(p.st.heal, 1, 8, dt);
      if (p.healT <= 0) {
        p.bandages--;
        p.bleeding = false;
        p.hp = Math.min(p.maxHp, p.hp + 40);
        this.ui.toast("Vendado");
      }
    } else p.st.heal = damp(p.st.heal, 0, 8, dt);
    if (p.bleeding) this.damage(p, dt * 1.4, null, true);
    p.st.aim = damp(p.st.aim, p.aimT > 0 ? 1 : 0, 14, dt);
    p.st.crouch = damp(p.st.crouch, p.crouch ? 1 : 0, 10, dt);
    // contextual action
    const act = this.actions?.find((a) => a.enabled() && Math.hypot(p.x - a.x, p.z - a.z) < (a.r || 1.8));
    this.curAct = act || null;
    this.ui.setAct(act ? act.label : null);
    if (act && inp.consume("act")) act.run();
    if (inp.consume("call") && this.onCall) this.onCall();
  }
  weaponTick(s, dt) {
    s.cool -= dt;
    s.st.fire = Math.max(0, s.st.fire - dt * 8);
    if (s.reloadT > 0) {
      s.reloadT -= dt;
      if (s.reloadT <= 0) {
        const w = WEAPONS[s.wkind];
        const n = Math.min(w.clip - s.clip, s.reserve);
        s.clip += n;
        s.reserve -= n;
      }
    }
  }
  startReload(s) {
    const w = WEAPONS[s.wkind];
    if (!w || s.reloadT > 0 || s.reserve <= 0) return;
    s.reloadT = w.reload;
    if (s.isPlayer) this.audio.reload();
  }
  pickTarget(p) {
    let best = null, bs = 1e9;
    const fwdx = Math.sin(p.ry), fwdz = Math.cos(p.ry);
    for (const e of this.soldiers) {
      if (e.side === p.side || !e.alive || e.surrendered) continue;
      const dx = e.x - p.x, dz = e.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > (WEAPONS[p.wkind]?.range || 30)) continue;
      if (!this.world.los(p.x, p.eye, p.z, e.x, e.eye, e.z)) continue;
      const ang = (dx * fwdx + dz * fwdz) / (d || 1);
      const score = d * (1.6 - ang * 0.6);
      if (score < bs) {
        bs = score;
        best = e;
      }
    }
    return best;
  }
  fire(s, tgt) {
    const w = WEAPONS[s.wkind];
    s.clip--;
    s.cool = w.rate * (s.isPlayer ? 1 : 1 + this.r() * 0.6);
    s.st.fire = 1;
    s.flashT = 1.2;
    muzzle(s.a, _v);
    _dir.set(Math.sin(s.ry), 0, Math.cos(s.ry));
    this.fx.muzzle(_v, _dir, s.wkind === "mg42");
    if (w.sound === "mg") {
      if ((s.mgSnd = (s.mgSnd || 0) - 1) <= 0) {
        this.audio.mg(s.x, s.z);
        s.mgSnd = 8;
      }
    } else this.audio.shot(s.x, s.z, w.sound);
    this.noise(s.x, s.z, this.night ? 45 : 60, s);
    if (s.isPlayer && s.wkind === "m1" && s.clip === 0) {
      setTimeout(() => this.audio.ping(), 60);
      this.startReload(s);
    }
    // resolve hit now, tracer shows it
    let tx, ty, tz, hit = false;
    if (tgt && tgt.alive) {
      const d = this.dist(s, tgt);
      let p = w.acc * smooth(w.range * 1.1, w.range * 0.25, d);
      p *= tgt.crouch ? 0.7 : 1;
      p *= s.st.move > 0.3 ? 0.75 : 1;
      if (tgt.down) p *= 0.5;
      // partial cover: chest blocked but head visible
      const chestVis = this.world.los(s.x, s.eye, s.z, tgt.x, tgt.chest, tgt.z);
      if (!chestVis) p *= 0.35;
      if (s.side === "de" && tgt.isPlayer) p *= 0.5 * this.diff;
      if (s.side === "de" && !tgt.isPlayer) p *= 0.4;
      if (s.isPlayer) p = Math.min(0.95, p * 1.15 + 0.08);
      hit = this.r() < p;
      const miss = hit ? 0.15 : 0.8 + this.r() * 1.6;
      const a = this.r() * Math.PI * 2;
      tx = tgt.x + Math.cos(a) * miss;
      tz = tgt.z + Math.sin(a) * miss;
      ty = hit ? tgt.chest : tgt.y + this.r() * 1.6;
      // shots at the player that miss close by are heard whizzing
      if (tgt.isPlayer && !hit && miss < 2.2) setTimeout(() => this.audio.whizz(1 - miss / 2.4), (d / 70) * 1000);
    } else {
      const d = 30;
      tx = s.x + Math.sin(s.ry) * d;
      tz = s.z + Math.cos(s.ry) * d;
      ty = s.eye - 0.2;
    }
    if (s.side === "de" || this.r() < (s.wkind === "mg42" ? 0.7 : 0.45) || s.isPlayer)
      this.fx.tracers.shoot(_v.x, _v.y, _v.z, tx, ty, tz, w.tracer, s.isPlayer ? 90 : 75, s.wkind === "mg42" ? 2.4 : 1.6, { hit: hit ? tgt : null, src: s, dmg: w.dmg });
    else if (hit) this._tracerHit({ data: { hit: tgt, src: s, dmg: w.dmg }, bx: tx, by: ty, bz: tz });
  }
  _tracerHit(tr) {
    const d = tr.data;
    if (!d) return;
    if (d.hit && d.hit.alive) {
      const amt = d.hit.isPlayer ? 16 + this.r() * 12 : d.dmg * (0.75 + this.r() * 0.5);
      this.damage(d.hit, amt, d.src);
      this.fx.blood(tr.bx, tr.by, tr.bz);
    } else if (tr.by < this.world.height(tr.bx, tr.bz) + 0.6) this.fx.dirt(tr.bx, tr.bz, 0.6);
  }
  damage(s, amt, src, silent = false) {
    if (!s.alive || s.invuln) return;
    if (s.protect === 2) return;
    s.hp -= amt;
    if (!silent) {
      s.hitFlash = 1;
      if (s.isPlayer) {
        this.hurtV = Math.min(1, this.hurtV + 0.6);
        this.ui.flashHurt();
        this.fx.shake = Math.min(1, this.fx.shake + 0.35);
        if (!s.bleeding && this.r() < 0.4) {
          s.bleeding = true;
          this.ui.toast("Estás sangrando: véndate");
        }
      }
      if (s.side === "de" && s.ai) {
        s.aware = 1;
        if (src) s.lastKnown = { x: src.x, z: src.z };
      }
    }
    if (s.hp <= 0) {
      if (s.protect === 1) {
        s.hp = 1;
        if (!s.down) {
          s.down = true;
          s.onDown && s.onDown();
        }
        return;
      }
      this.kill(s, src);
    }
  }
  kill(s, src) {
    if (!s.alive) return;
    s.alive = false;
    s.down = false;
    s.st.deadDir = this.r() < 0.5 ? 1 : -1;
    s.st.deadSide = this.r() < 0.5 ? 1 : -1;
    if (src) src.kills++;
    if (s.side === "de" && src === this.player) this.onEnemyKilled && this.onEnemyKilled(s);
    if (s.isPlayer) this.onPlayerDeath && this.onPlayerDeath(s, src);
    else s.onDeath && s.onDeath(s, src);
  }
  tryStab(p) {
    let best = null, bd = 2.1;
    for (const e of this.enemies()) {
      const d = this.dist(p, e);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    p.st.stab = 1;
    if (!best) return;
    p.face(best.x, best.z, 1, 1);
    // from behind or unaware: silent kill. Facing and alert: a struggle you can lose
    const toP = Math.atan2(p.x - best.x, p.z - best.z);
    const behind = Math.abs(angDiff(best.ry, toP)) > 1.7;
    if (behind || best.aware < 1) {
      this.audio.stab();
      best.st.dead = 0;
      this.kill(best, p);
      this.onStab && this.onStab(best);
    } else if (this.r() < 0.5) {
      this.audio.stab();
      this.kill(best, p);
      this.onStab && this.onStab(best);
    } else {
      this.damage(p, 22, best);
    }
  }
  // ---- grenades ---------------------------------------------------------------------------------
  pickGrenadeSpot(p) {
    // nearest visible-ish enemy cluster within throwing range, else 12 m ahead
    let best = null, bs = 0;
    for (const e of this.enemies()) {
      const d = this.dist(p, e);
      if (d < 4 || d > 22) continue;
      let n = 0;
      for (const f of this.enemies()) if (Math.hypot(f.x - e.x, f.z - e.z) < 5) n++;
      const sc = n * 10 - d;
      if (sc > bs) {
        bs = sc;
        best = e;
      }
    }
    if (best) return { x: best.x + (this.r() - 0.5), z: best.z + (this.r() - 0.5) };
    return { x: p.x + Math.sin(p.ry) * 12, z: p.z + Math.cos(p.ry) * 12 };
  }
  throwGrenade(s, at, fuse = 3) {
    s.grenades--;
    s.st.throw = 1;
    s.face(at.x, at.z, 1, 1);
    const sx = s.x, sz = s.z, sy = s.y + 1.8;
    const dx = at.x - sx, dz = at.z - sz;
    const d = Math.hypot(dx, dz);
    const tt = 0.6 + d * 0.045;
    const ty = this.world.height(at.x, at.z);
    const g = {
      x: sx, y: sy, z: sz,
      vx: dx / tt, vz: dz / tt, vy: (ty - sy + 0.5 * 14 * tt * tt) / tt,
      fuse, owner: s, mesh: null,
    };
    const m = new T.Mesh(new T.SphereGeometry(0.09, 6, 4), new T.MeshStandardMaterial({ color: s.side === "us" ? 0x3d4430 : 0x3a3a36, roughness: 0.7 }));
    if (s.side === "de") {
      // stick grenade
      m.geometry = new T.CylinderGeometry(0.035, 0.035, 0.36, 5);
    }
    m.castShadow = true;
    this.scene.add(m);
    g.mesh = m;
    this.grenades.push(g);
    this.noise(at.x, at.z, 12, s);
    if (s.side === "de" && this.onEnemyGrenade) this.onEnemyGrenade(g);
    return g;
  }
  updateGrenades(dt) {
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.fuse -= dt;
      g.vy -= 14 * dt;
      const nx = g.x + g.vx * dt, nz = g.z + g.vz * dt;
      const [cx, cz] = this.world.collide(nx, nz, 0.1);
      if (cx !== nx || cz !== nz) {
        g.vx *= -0.3;
        g.vz *= -0.3;
      }
      g.x = cx;
      g.z = cz;
      g.y += g.vy * dt;
      const fy = this.world.height(g.x, g.z) + 0.08;
      if (g.y < fy) {
        g.y = fy;
        g.vy *= -0.25;
        g.vx *= 0.45;
        g.vz *= 0.45;
      }
      g.mesh.position.set(g.x, g.y, g.z);
      g.mesh.rotation.x += dt * 9;
      if (g.fuse <= 0) {
        this.scene.remove(g.mesh);
        this.grenades.splice(i, 1);
        this.explode(g.x, g.z, 1, g.owner, g.dud);
      }
    }
  }
  explode(x, z, size = 1, owner = null, dud = false) {
    const p = this.player;
    const near = p ? clamp(1 - Math.hypot(p.x - x, p.z - z) / 40, 0.15, 1) : 1;
    this.fx.explosion(x, z, size, near);
    this.audio.boom(x, z, size);
    this.noise(x, z, 50, owner);
    if (dud) return;
    const y = this.world.height(x, z) + 0.6;
    for (const s of this.soldiers) {
      if (!s.alive) continue;
      const d = Math.hypot(s.x - x, s.z - z);
      if (d > 6 * size) continue;
      // trench walls and hedges absorb the blast
      const cover = this.world.los(x, y, z, s.x, s.chest, s.z) ? 1 : 0.25;
      const dmg = (d < 2.6 * size ? 120 : 60 * (1 - d / (6 * size))) * cover;
      if (s.blastProof) continue;
      this.damage(s, dmg, owner);
    }
    if (this.onExplosion) this.onExplosion(x, z, owner);
  }
  // ---- AI ---------------------------------------------------------------------------------------
  // ai: {mode: 'patrol'|'guard'|'follow'|'hold'|'move'|'fight'|'scripted', path:[[x,z]...], ...}
  updateAI(s, dt) {
    if (!s.alive) return;
    const ai = s.ai;
    if (!ai) return;
    this.weaponTick(s, dt);
    if (s.down) {
      s.st.move = 0;
      s.st.prone = damp(s.st.prone, 1, 3, dt);
      s.downT = (s.downT || 0) + dt;
      if (s.downT > (s.downFor || 9) && s.protect === 1) {
        // patched up by a buddy: back on his feet, slower and in pain
        s.down = false;
        s.downT = 0;
        s.hp = 45;
        s.speed *= 0.85;
      }
      return;
    }
    if (s.surrendered) {
      s.st.move = 0;
      s.st.aim = 0;
      return;
    }
    if (s.side === "de") this.enemyAI(s, dt);
    else this.allyAI(s, dt);
    s.st.crouch = damp(s.st.crouch, s.crouch ? 1 : 0, 8, dt);
    s.st.aim = damp(s.st.aim, s.aimT > 0 ? 1 : 0, 10, dt);
    s.aimT = Math.max(0, (s.aimT || 0) - dt);
  }
  moveTo(s, x, z, dt, speedK = 1, stopAt = 0.4) {
    const dx = x - s.x, dz = z - s.z;
    const d = Math.hypot(dx, dz);
    if (d < stopAt) {
      s.st.move = damp(s.st.move, 0, 10, dt);
      return true;
    }
    const sp = s.speed * speedK * (s.crouch ? 0.55 : 1);
    const st = Math.min(d, sp * dt);
    const [cx, cz] = this.world.collide(s.x + (dx / d) * st, s.z + (dz / d) * st, 0.33);
    // stuck? slide along the obstacle, and try the other side if that doesn't work either
    if (Math.hypot(cx - s.x, cz - s.z) < st * 0.25) {
      s.stuckT = (s.stuckT || 0) + dt;
      s.stuckTotal = (s.stuckTotal || 0) + dt;
      if (s.stuckTotal > 3) {
        // give up: close enough is close enough for a scripted move (never deadlock a scene)
        s.stuckTotal = 0;
        s.st.move = 0;
        return true;
      }
      if (s.stuckT > 0.7) {
        s.stuckT = 0;
        s.stuckSide = -(s.stuckSide || 1);
      }
      const side = (s.stuckSide = s.stuckSide || (this.r() < 0.5 ? 1 : -1));
      const [ux, uz] = this.world.collide(s.x - (dz / d) * st * side, s.z + (dx / d) * st * side, 0.33);
      s.x = ux;
      s.z = uz;
    } else {
      s.x = cx;
      s.z = cz;
      s.stuckTotal = Math.max(0, (s.stuckTotal || 0) - dt * 0.5);
    }
    // a man running in a column looks down the road, not at the exact spot he is closing on
    if (!(s.aimT > 0)) {
      const fa = s.faceAlong;
      if (fa) s.face(s.x + fa[0] * 4, s.z + fa[1] * 4, dt, 8);
      else s.face(x, z, dt, 8);
    }
    s.st.move = damp(s.st.move, speedK * (s.crouch ? 0.7 : 1), 10, dt);
    return false;
  }
  canSee(s, t) {
    // eyes, view cone, range and darkness
    const dx = t.x - s.x, dz = t.z - s.z;
    const d = Math.hypot(dx, dz);
    let range = this.night ? (t.crouch ? 8 : 15) : t.crouch ? 30 : 46;
    if (t.flashT > 0) range = this.night ? 34 : 60;
    for (const L of this.lights) if (Math.hypot(t.x - L.x, t.z - L.z) < L.r) range *= 1.8;
    if (t.down) range *= 0.6;
    if (d > range) return 0;
    const ang = Math.abs(angDiff(s.ry, Math.atan2(dx, dz)));
    const fov = s.ai?.mode === "alert" ? 1.6 : 1.05;
    if (ang > fov && d > (t.crouch ? 1.6 : 3)) return 0;
    if (!this.world.los(s.x, s.eye, s.z, t.x, t.eye, t.z)) return 0;
    return 1 - d / range;
  }
  enemyAI(s, dt) {
    const ai = s.ai;
    if (ai.mode === "scripted") return;
    // perception (staggered)
    ai.pt = (ai.pt || this.r() * 0.2) - dt;
    if (ai.pt <= 0) {
      ai.pt = 0.15;
      let best = null, bv = 0;
      for (const t of this.soldiers) {
        if (t.side === s.side || !t.alive || t.hidden) continue;
        const v = this.canSee(s, t);
        if (v > bv) {
          bv = v;
          best = t;
        }
      }
      if (best) {
        const rate = (this.night ? 0.9 : 2.2) * (0.35 + bv * 2.2) * (best.st.move > 0.3 ? 1.4 : 0.7) * (ai.mode === "alert" ? 3 : 1);
        s.aware = Math.min(1.5, s.aware + rate * 0.15);
        s.lastKnown = { x: best.x, z: best.z };
        if (s.aware >= 1) {
          s.target = best;
          s.seenT = this.t;
        }
      } else {
        if (s.target && this.t - s.seenT > 0.6) s.target = null;
        if (ai.mode !== "alert") s.aware = Math.max(0, s.aware - 0.06 * 0.15 * 3);
      }
      // hearing
      for (const n of this.noises) {
        if (n.src && n.src.side === s.side) continue;
        const d = Math.hypot(n.x - s.x, n.z - s.z);
        if (d < n.r) {
          s.aware = Math.max(s.aware, n.r > 30 ? 1 : s.aware + 0.35);
          s.lastKnown = { x: n.x, z: n.z };
          ai.heardT = this.t;
        }
      }
    }
    if (s.aware >= 1 && ai.mode !== "alert" && !ai.noAlert) {
      ai.prev = ai.prev || ai.mode;
      ai.mode = "alert";
      ai.alertT = this.t;
      this.audio.shout(s.x, s.z);
      if (this.onAlert) this.onAlert(s);
      // tell neighbours
      for (const o of this.enemies()) if (o !== s && this.dist(o, s) < 18) {
        o.aware = Math.max(o.aware, 0.9);
        o.lastKnown = s.lastKnown;
      }
    }
    const mode = ai.mode;
    if (mode === "patrol" || mode === "guard") {
      if (s.aware > 0.35 && s.lastKnown) {
        // suspicious: stop, turn, take a few steps
        s.face(s.lastKnown.x, s.lastKnown.z, dt, 3);
        if (s.aware > 0.6 && !ai.static) this.moveTo(s, s.lastKnown.x, s.lastKnown.z, dt, 0.35, 2);
        else s.st.move = damp(s.st.move, 0, 8, dt);
        return;
      }
      if (mode === "guard") {
        s.st.move = damp(s.st.move, 0, 8, dt);
        ai.lookT = (ai.lookT || 0) - dt;
        if (ai.lookT <= 0) {
          ai.lookT = 2.5 + this.r() * 3;
          ai.lookA = (ai.baseRy ?? s.ry) + (this.r() - 0.5) * (ai.sweep ?? 1.6);
        }
        if (ai.lookA !== undefined) s.ry += angDiff(s.ry, ai.lookA) * Math.min(1, dt * 2);
        if (ai.smoke) this.updateSmoker(s, dt);
        return;
      }
      const path = ai.path;
      const wp = path[ai.i || 0];
      if (ai.waitT > 0) {
        ai.waitT -= dt;
        s.st.move = damp(s.st.move, 0, 8, dt);
        if (ai.lookA !== undefined) s.ry += angDiff(s.ry, ai.lookA) * Math.min(1, dt * 2);
        return;
      }
      if (this.moveTo(s, wp[0], wp[1], dt, ai.speedK || 0.42, 0.5)) {
        ai.i = ((ai.i || 0) + 1) % path.length;
        if (wp[2]) {
          ai.waitT = wp[2];
          ai.lookA = s.ry + (this.r() - 0.5) * 2.4;
        }
      }
      return;
    }
    if (mode === "alert") {
      const t = s.target;
      if (t && t.alive && this.canSee(s, t) > 0) {
        s.face(t.x, t.z, dt, 8);
        s.aimT = 0.8;
        s.crouch = ai.crouchFight ?? s.crouch;
        s.st.move = damp(s.st.move, 0, 8, dt);
        const reactT = this.t - (ai.alertT || 0);
        if (s.cool <= 0 && s.reloadT <= 0 && reactT > (ai.react ?? 0.55)) {
          if (s.clip <= 0) this.startReload(s);
          else {
            const w = WEAPONS[s.wkind];
            if (s.wkind === "mg42" || s.wkind === "mp40") {
              if (s.burst <= 0) {
                s.burst = s.wkind === "mg42" ? 7 + Math.floor(this.r() * 8) : 4;
              }
              this.fire(s, t);
              s.burst--;
              if (s.burst <= 0) s.cool = 0.9 + this.r() * 1.2;
            } else {
              this.fire(s, t);
              s.cool = w.rate * (1.4 + this.r() * 1.6);
            }
          }
        }
        // grenade when the target hides close
        if (s.grenades > 0 && this.dist(s, t) < 16 && this.dist(s, t) > 5 && this.r() < dt * 0.05) this.throwGrenade(s, { x: t.x, z: t.z });
      } else if (s.lastKnown && !ai.static) {
        // advance carefully toward last known, then search
        s.crouch = false;
        const arrived = this.moveTo(s, s.lastKnown.x, s.lastKnown.z, dt, 0.6, 2.5);
        if (arrived) {
          ai.searchT = (ai.searchT || 0) + dt;
          s.ry += dt * 1.2;
          if (ai.searchT > 6 && this.night) {
            ai.mode = ai.prev || "patrol";
            ai.searchT = 0;
            s.aware = 0.2;
            s.target = null;
          }
        }
      } else s.st.move = damp(s.st.move, 0, 8, dt);
    }
  }
  updateSmoker(s, dt) {
    // a guard smoking: tiny ember, visible at night — gives the player a read on where he looks
    if (this.r() < dt * 1.5) {
      _v2.set(s.x + Math.sin(s.ry) * 0.25, s.y + 1.5, s.z + Math.cos(s.ry) * 0.25);
      this.fx.glow.emit({ x: _v2.x, y: _v2.y, z: _v2.z, life: 0.5, s0: 0.12, s1: 0.06, c0: [3, 0.9, 0.2, 1], c1: [1.5, 0.3, 0, 0] });
    }
  }
  allyAI(s, dt) {
    const ai = s.ai;
    const p = this.player;
    // shooting at visible enemies when allowed
    let shooting = false;
    if (ai.fire !== false && s.wkind !== "knife" && s.wkind !== "medic") {
      ai.pt = (ai.pt || this.r() * 0.3) - dt;
      if (ai.pt <= 0) {
        ai.pt = 0.3;
        s.target = null;
        let bd = WEAPONS[s.wkind]?.range || 30;
        for (const e of this.enemies()) {
          if (e.surrendered) continue;
          const d = this.dist(s, e);
          if (d < bd && this.world.los(s.x, s.eye, s.z, e.x, e.eye, e.z) && (e.ai?.mode === "alert" || !this.night || ai.engage)) {
            bd = d;
            s.target = e;
          }
        }
      }
      const t = s.target;
      if (t && t.alive) {
        shooting = true;
        s.face(t.x, t.z, dt, 8);
        s.aimT = 0.6;
        if (s.cool <= 0 && s.reloadT <= 0) {
          if (s.clip <= 0) {
            if (s.reserve <= 0) s.reserve = 24; // allies never run dry in this prototype
            this.startReload(s);
          } else {
            const w = WEAPONS[s.wkind];
            if (s.wkind === "mg42" || s.wkind === "thompson") {
              if (s.burst <= 0) s.burst = 5 + Math.floor(this.r() * 6);
              this.fire(s, t);
              s.burst--;
              if (s.burst <= 0) s.cool = 0.8 + this.r();
            } else {
              this.fire(s, t);
              s.cool = w.rate * (2 + this.r() * 3);
            }
          }
        }
      }
    }
    if (ai.mode === "follow" && p) {
      const idx = Math.max(0, this.trail.length - 1 - (ai.slot || 1) * 3);
      const pt = this.trail[idx] || p;
      const d = this.dist(s, p);
      s.crouch = p.crouch;
      if (d > 2.2 + (ai.slot || 1) * 1.2) this.moveTo(s, pt.x, pt.z, dt, d > 8 ? 1.15 : 0.9, 0.6);
      else s.st.move = damp(s.st.move, 0, 8, dt);
      if (!shooting && s.st.move < 0.1) s.face(p.x + Math.sin(p.ry) * 6, p.z + Math.cos(p.ry) * 6, dt, 2);
    } else if (ai.mode === "move" || ai.mode === "hold") {
      if (ai.mode === "move") {
        const wp = ai.path[ai.i || 0];
        if (wp) {
          s.crouch = ai.crouch ?? false;
          if (this.moveTo(s, wp[0], wp[1], dt, ai.speedK || 1, 0.5)) {
            ai.i = (ai.i || 0) + 1;
            if (ai.i >= ai.path.length) {
              ai.mode = "hold";
              ai.onArrive && ai.onArrive(s);
            }
          }
        }
      } else {
        s.crouch = ai.crouch ?? true;
        s.st.move = damp(s.st.move, 0, 8, dt);
        if (!shooting && ai.look) s.face(ai.look[0], ai.look[1], dt, 3);
      }
    } else s.st.move = damp(s.st.move, 0, 8, dt);
  }
  // ---- bodies -----------------------------------------------------------------------------------
  updateBody(s, dt) {
    s.flashT = Math.max(0, s.flashT - dt);
    s.y = damp(s.y, this.world.height(s.x, s.z) + (s.lift || 0), 20, dt); // lift: standing on a platform
    if (!s.alive) s.st.dead = Math.min(1, s.st.dead + dt * 2.6);
    s.st.throw = Math.max(0, s.st.throw - dt * 2.2);
    s.st.stab = Math.max(0, s.st.stab - dt * 3);
    if (!s.down) s.st.prone = damp(s.st.prone, s.proneLock ? 1 : 0, 4, dt);
    s.hitFlash = Math.max(0, s.hitFlash - dt * 4);
    animate(s.a, s.st, dt);
    const r = s.a.root;
    r.position.set(s.x, s.y, s.z);
    r.rotation.y = s.ry;
    if (s.blob) {
      s.blob.position.set(s.x, s.y + 0.04, s.z);
      const k = s.alive ? (s.down || s.st.prone > 0.5 ? 1.5 : 1) : 1.7;
      s.blob.scale.set(k, 1, k * (s.alive ? 1 : 1.4));
      s.blob.rotation.y = s.ry;
    }
    // only animate what is near the camera when the frame is tight
  }
  // ---- camera -----------------------------------------------------------------------------------
  updateCamera(dt) {
    const c = this.cam, p = this.player;
    const aspect = innerWidth / innerHeight;
    if (p) {
      const lx = Math.sin(p.ry) * (p.st.move > 0.2 ? 2.5 : 1), lz = Math.cos(p.ry) * (p.st.move > 0.2 ? 2.5 : 1);
      c.look.x = damp(c.look.x, lx, 2, dt);
      c.look.z = damp(c.look.z, lz, 2, dt);
      let tx = p.x + c.look.x, tz = p.z + c.look.z;
      if (c.focus) {
        tx = lerp(tx, c.focus.x, c.focus.k ?? 0.5);
        tz = lerp(tz, c.focus.z, c.focus.k ?? 0.5);
      }
      // glide with capped speed (no snaps)
      const dx = tx - c.x, dz = tz - c.z;
      const d = Math.hypot(dx, dz);
      c.vel = Math.min(c.snap ? 999 : 14, c.vel + dt * 20);
      const step = Math.min(d, Math.max(d * (1 - Math.exp(-dt * 4)), 0) , c.vel * dt);
      if (d > 1e-4) {
        c.x += (dx / d) * step;
        c.z += (dz / d) * step;
      }
      if (d < 0.05) c.vel = 0;
      c.snap = false;
    }
    const cam = this.camera;
    // span = metres visible across a portrait screen; landscape shows a little more height instead
    let hw, hh;
    if (aspect < 1) {
      hw = c.span / 2;
      hh = hw / aspect;
    } else {
      hh = c.span * 0.42;
      hw = hh * aspect;
    }
    cam.top = hh;
    cam.bottom = -hh;
    cam.left = -hw;
    cam.right = hw;
    const sh = this.fx.shake;
    const shx = (this.r() - 0.5) * sh * 0.5, shz = (this.r() - 0.5) * sh * 0.5;
    const y0 = this.world.height(c.x, c.z);
    const D = 60;
    cam.position.set(c.x + shx + Math.sin(c.yaw) * Math.cos(c.pitch) * D, y0 + Math.sin(c.pitch) * D, c.z + shz + Math.cos(c.yaw) * Math.cos(c.pitch) * D);
    cam.lookAt(c.x + shx, y0, c.z + shz);
    cam.updateProjectionMatrix();
    // particle size scale for ortho: pixels per world unit
    this.fx.setScale(this.renderer.h / (hh * 2));
  }
  project(x, y, z) {
    _v2.set(x, y, z).project(this.camera);
    return [(_v2.x * 0.5 + 0.5) * innerWidth, (-_v2.y * 0.5 + 0.5) * innerHeight, _v2.z];
  }
  // ---- HUD --------------------------------------------------------------------------------------
  updateHUD(dt) {
    const p = this.player, ui = this.ui;
    this.hurtV = Math.max(0, this.hurtV - dt * 1.2);
    const post = this.renderer.post;
    post.hurt.value = Math.max(this.hurtV * 0.8, p && p.alive ? clamp((40 - p.hp) / 40, 0, 1) * (0.35 + Math.sin(this.t * 6) * 0.1) : 0);
    post.flash.value = this.fx.flash;
    if (p) {
      ui.setHealth(p.hp, p.bleeding, p.healT > 0);
      ui.setWeapon(p.wkind, p.clip, p.reserve, p.reloadT > 0);
      ui.setInv(p.grenades, p.bandages, !!this.onCall);
      if (this.objective && this.objective.x !== undefined) {
        const o = this.objective;
        const d = Math.hypot(o.x - p.x, o.z - p.z);
        const [sx, sy] = this.project(o.x, this.world.height(o.x, o.z), o.z);
        const [px, py] = this.project(p.x, p.y, p.z);
        const ang = Math.atan2(sy - py, sx - px);
        ui.setObjective(o.text, d, ang);
        // ground marker when on screen
        if (sx > 0 && sx < innerWidth && sy > 90 && sy < innerHeight - 150 && d > 3) ui.mark("obj", sx, sy, '<i class="pin"></i>', "objm");
      } else ui.setObjective(this.objective?.text || null);
      // enemy awareness marks
      for (const e of this.soldiers) {
        if (e.side !== "de" || !e.alive || !e.ai || e.surrendered) continue;
        if (this.dist(e, p) > 30) continue;
        const [sx, sy] = this.project(e.x, e.y + 2.15, e.z);
        if (e.ai.mode === "alert" && this.night) ui.mark("e" + e.id, sx, sy, "!", "alert");
        else if (e.aware > 0.15 && e.ai.mode !== "alert") ui.mark("e" + e.id, sx, sy, `<b style="--k:${clamp(e.aware, 0, 1).toFixed(2)}">?</b>`, "sus");
      }
      // ally names: only the three nearest (plus anyone wounded), so labels never pile up
      const near = this.soldiers.filter((a) => a.side === "us" && a !== p && a.alive && !a.noLabel && this.dist(a, p) < 9).sort((a, b) => this.dist(a, p) - this.dist(b, p));
      const placed = [];
      near.forEach((a, i) => {
        if (i > 2 && !a.down) return;
        let [sx, sy] = this.project(a.x, a.y + 2.35, a.z);
        sx = Math.max(40, Math.min(innerWidth - 40, sx));
        // stack labels that would overlap
        for (let k = 0; k < 4; k++) {
          const hit = placed.find((q) => Math.abs(q[0] - sx) < 72 && Math.abs(q[1] - sy) < 15);
          if (!hit) break;
          sy = hit[1] - 15;
        }
        placed.push([sx, sy]);
        ui.mark("a" + a.id, sx, sy, a.down ? `${a.short} <em>herido</em>` : a.short, a.down ? "ally down" : "ally");
      });
      // grenades on the ground near the player
      for (const g of this.grenades) {
        if (g.owner.side !== "de") continue;
        const [sx, sy] = this.project(g.x, g.y + 0.6, g.z);
        ui.mark("g" + g.mesh.id, sx, sy, "✹", "nade");
      }
    }
    ui.updateSubs(dt);
    ui.sweepMarks();
  }
}
