// Low-poly "painted" geometry builder: everything is merged into a few vertex-coloured meshes.
import { T, rng, clamp } from "./util.js";

const _m = new T.Matrix4();
const _q = new T.Quaternion();
const _e = new T.Euler();
const _v = new T.Vector3();
const _s = new T.Vector3();
const _c = new T.Color();
const _c2 = new T.Color();

const cache = {};
function baseGeo(key, make) {
  if (!cache[key]) {
    let g = make();
    if (g.index) g = g.toNonIndexed();
    g.deleteAttribute("uv");
    g.deleteAttribute("normal");
    cache[key] = g.attributes.position.array;
  }
  return cache[key];
}

export class Builder {
  constructor(seed = 7) {
    this.pos = [];
    this.col = [];
    this.skin = null;
    this.r = rng(seed);
    this.grad = null; // {y0,y1,k} darkens toward y0
  }
  enableSkin() {
    this.skin = [];
    return this;
  }
  // tf: {x,y,z, rx,ry,rz, sx,sy,sz}  opts: {jit, bone, grad, mat (Matrix4 applied after)}
  add(arr, color, tf = {}, opts = {}) {
    _e.set(tf.rx || 0, tf.ry || 0, tf.rz || 0, tf.order || "XYZ");
    _q.setFromEuler(_e);
    _s.set(tf.sx ?? 1, tf.sy ?? 1, tf.sz ?? 1);
    _v.set(tf.x || 0, tf.y || 0, tf.z || 0);
    _m.compose(_v, _q, _s);
    if (opts.mat) _m.premultiply(opts.mat);
    const e = _m.elements;
    const jit = opts.jit ?? 0.06;
    const grad = opts.grad ?? this.grad;
    _c.set(color);
    const n = arr.length / 3;
    const T9 = this._t9 || (this._t9 = new Float32Array(9));
    for (let i = 0; i < n; i += 3) {
      const f = 1 - jit + this.r() * jit * 2;
      for (let k = 0; k < 3; k++) {
        const j = (i + k) * 3;
        const x = arr[j], y = arr[j + 1], z = arr[j + 2];
        T9[k * 3] = e[0] * x + e[4] * y + e[8] * z + e[12];
        T9[k * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
        T9[k * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      }
      // drop zero-area triangles (cone apexes etc.): they produce NaN normals that blacken the frame via bloom
      const ux = T9[3] - T9[0], uy = T9[4] - T9[1], uz = T9[5] - T9[2];
      const vx = T9[6] - T9[0], vy = T9[7] - T9[1], vz = T9[8] - T9[2];
      const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
      if (cx * cx + cy * cy + cz * cz < 1e-12) continue;
      for (let k = 0; k < 3; k++) {
        const wx = T9[k * 3], wy = T9[k * 3 + 1], wz = T9[k * 3 + 2];
        this.pos.push(wx, wy, wz);
        let g = 1;
        if (grad) g = 1 - grad.k * (1 - clamp((wy - grad.y0) / (grad.y1 - grad.y0), 0, 1));
        this.col.push(_c.r * f * g, _c.g * f * g, _c.b * f * g);
        if (this.skin) this.skin.push(opts.bone || 0);
      }
    }
    return this;
  }
  box(w, h, d, color, tf, opts) {
    return this.add(baseGeo("box", () => new T.BoxGeometry(1, 1, 1)), color, { ...tf, sx: w * (tf?.sx ?? 1), sy: h * (tf?.sy ?? 1), sz: d * (tf?.sz ?? 1) }, opts);
  }
  // box whose base sits at tf.y
  post(w, h, d, color, tf = {}, opts) {
    return this.box(w, h, d, color, { ...tf, y: (tf.y || 0) + h / 2 }, opts);
  }
  ico(r, color, tf = {}, opts = {}) {
    const det = opts.detail ?? 0;
    return this.add(baseGeo("ico" + det, () => new T.IcosahedronGeometry(1, det)), color, { ...tf, sx: r * (tf.sx ?? 1), sy: r * (tf.sy ?? 1), sz: r * (tf.sz ?? 1) }, opts);
  }
  cyl(rt, rb, h, seg, color, tf = {}, opts) {
    const key = `cyl${rt}_${rb}_${seg}`;
    return this.add(baseGeo(key, () => new T.CylinderGeometry(rt, rb, 1, seg, 1)), color, { ...tf, sy: h * (tf.sy ?? 1) }, opts);
  }
  cone(r, h, seg, color, tf = {}, opts) {
    const key = `cone${seg}`;
    return this.add(baseGeo(key, () => new T.ConeGeometry(1, 1, seg, 1)), color, { ...tf, sx: r * (tf.sx ?? 1), sy: h * (tf.sy ?? 1), sz: r * (tf.sz ?? 1) }, opts);
  }
  sphere(r, wseg, hseg, color, tf = {}, opts) {
    const key = `sph${wseg}_${hseg}`;
    return this.add(baseGeo(key, () => new T.SphereGeometry(1, wseg, hseg)), color, { ...tf, sx: r * (tf.sx ?? 1), sy: r * (tf.sy ?? 1), sz: r * (tf.sz ?? 1) }, opts);
  }
  // raw triangle list helper (flat quad etc.)
  tris(arr, color, opts = {}) {
    return this.add(arr, color, {}, opts);
  }
  get count() {
    return this.pos.length / 3;
  }
  build() {
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("color", new T.Float32BufferAttribute(this.col, 3));
    if (this.skin) {
      const n = this.skin.length;
      const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        si[i * 4] = this.skin[i];
        sw[i * 4] = 1;
      }
      g.setAttribute("skinIndex", new T.BufferAttribute(si, 4));
      g.setAttribute("skinWeight", new T.BufferAttribute(sw, 4));
    }
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

// Shared materials ------------------------------------------------------------------------------
export const U = {
  time: { value: 0 },
  wind: { value: 1 },
  rimColor: { value: new T.Color(0.2, 0.26, 0.4) },
  rimEnemy: { value: new T.Color(0.12, 0.15, 0.24) },
  worldRim: { value: new T.Color(0, 0, 0) },
  fireCol: { value: new T.Color(0, 0, 0) },
  firePos: { value: new T.Vector3() },
  paint: { value: 1 },
  focus: { value: new T.Vector4(-9999, -9999, 0, 0) }, // player: px x, px y, world y, radius px
  focusD: { value: -1 }, // window depth just in front of the player: only nearer surfaces dissolve
};

function painterly(shader, { rim = false, sway = false, canopy = false, enemy = false, ground = false, occlude = false } = {}) {
  shader.uniforms.uTime = U.time;
  shader.uniforms.uWind = U.wind;
  shader.uniforms.rimColor = enemy ? U.rimEnemy : U.rimColor;
  shader.uniforms.fireCol = U.fireCol;
  shader.uniforms.firePos = U.firePos;
  shader.uniforms.uPaint = U.paint;
  shader.uniforms.uFocus = U.focus;
  shader.uniforms.uFocusD = U.focusD;
  shader.uniforms.worldRim = U.worldRim;
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", `#include <common>\nvarying vec3 vWP; uniform float uTime; uniform float uWind;${canopy ? "\nattribute float aSway;" : ""}`)
    .replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
${sway ? `{
  #ifdef USE_INSTANCING
    vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
  #else
    vec3 ip = vec3(0.0);
  #endif
  float h = max(0.0, transformed.y);
  float ph = ip.x * 0.37 + ip.z * 0.29;
  float w = sin(uTime * 1.7 + ph) * 0.6 + sin(uTime * 3.1 + ph * 1.7) * 0.25;
  transformed.x += w * h * h * 0.08 * uWind;
  transformed.z += w * h * h * 0.05 * uWind;
}` : ""}${canopy ? `{
  // merged trees sit in world space: sway by height above their own ground, phased per spot, gently
  float ph = position.x * 0.21 + position.z * 0.17;
  float w = sin(uTime * 0.9 + ph) * 0.7 + sin(uTime * 1.6 + ph * 1.3) * 0.3;
  float h = clamp(aSway, 0.0, 12.0);
  transformed.x += w * h * h * 0.0035 * uWind;
  transformed.z += w * h * h * 0.0022 * uWind;
}` : ""}`
    )
    .replace("#include <worldpos_vertex>", `#include <worldpos_vertex>\n  #ifdef USE_INSTANCING\n vWP = (modelMatrix * instanceMatrix * vec4(transformed,1.0)).xyz;\n  #else\n vWP = (modelMatrix * vec4(transformed,1.0)).xyz;\n  #endif`);
  shader.fragmentShader = shader.fragmentShader
    .replace(
      "#include <common>",
      `#include <common>
varying vec3 vWP; uniform vec3 rimColor; uniform vec3 fireCol; uniform vec3 firePos; uniform float uPaint;
float ph(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float pn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(ph(i),ph(i+vec2(1,0)),f.x),mix(ph(i+vec2(0,1)),ph(i+vec2(1,1)),f.x),f.y); }
uniform vec4 uFocus; uniform float uFocusD; uniform vec3 worldRim;
float bayer4(vec2 p){ vec2 q = mod(floor(p), 4.0); float i = q.x + q.y * 4.0;
  return (i==0.?0.:i==1.?8.:i==2.?2.:i==3.?10.:i==4.?12.:i==5.?4.:i==6.?14.:i==7.?6.:i==8.?3.:i==9.?11.:i==10.?1.:i==11.?9.:i==12.?15.:i==13.?7.:i==14.?13.:5.) / 16.0; }`
    )
    .replace(
      "#include <color_fragment>",
      `#include <color_fragment>
  ${occlude ? `{
    // see-through: canopies and roofs between the camera and your soldier dissolve (screen-door)
    float dpx = length(gl_FragCoord.xy - uFocus.xy);
    // only what really stands between the camera and the soldier: nearer than him and above his head
    if (gl_FragCoord.z < uFocusD && vWP.y > uFocus.z + 1.6 && dpx < uFocus.w) {
      float k = 1.0 - smoothstep(uFocus.w * 0.5, uFocus.w, dpx);
      // ordered 4×4 screen door: an even veil instead of noisy speckle
      if (k * 0.8 > bayer4(gl_FragCoord.xy)) discard;
    }
  }` : ""}
  // painted breakup: broad brush value shifts + fine bristle grain, in world space so it never swims
  float br = pn(vWP.xz * 0.35 + vWP.y * 0.2) * 0.6 + pn(vWP.xz * 2.7 + vWP.y * 1.3) * 0.4;
  diffuseColor.rgb *= mix(1.0, 0.86 + br * 0.26, uPaint);
  ${ground ? `
  // meadow detail: broad tonal patches, sun-dried yellow drifts, darker clover, trodden earth flecks
  float g1 = pn(vWP.xz * 0.07 + 11.0), g2 = pn(vWP.xz * 0.45 + 3.0), g3 = pn(vWP.xz * 3.1), g4 = pn(vWP.xz * 9.0);
  diffuseColor.rgb *= 0.8 + g1 * 0.38;
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.22, 1.14, 0.78), smoothstep(0.58, 0.8, g2) * 0.55);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.72, 0.86, 0.7), smoothstep(0.62, 0.82, g3) * 0.45);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.26, 0.21, 0.15) * (0.7 + g3 * 0.5), smoothstep(0.86, 0.95, g4) * 0.5);` : ""}`
    )
    .replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
  {
    vec3 vdir = isOrthographic ? vec3(0.0,0.0,1.0) : normalize(vViewPosition);
    float rim = pow(1.0 - clamp(dot(normal, vdir), 0.0, 1.0), 2.4);
    ${rim ? `totalEmissiveRadiance += rimColor * rim;` : `totalEmissiveRadiance += worldRim * diffuseColor.rgb * rim * smoothstep(-0.2, 0.8, inverseTransformDirection(normal, viewMatrix).y);`}
    ${enemy ? `diffuseColor.rgb *= 0.86;` : ""}
    float fd = length(firePos - vWP);
    vec3 fv = normalize(firePos - vWP);
    vec3 nW = inverseTransformDirection(normal, viewMatrix);
    float wrapL = clamp(dot(nW, fv) * 0.6 + 0.4, 0.0, 1.0);
    totalEmissiveRadiance += fireCol * diffuseColor.rgb * wrapL * (1.0 / (1.0 + fd * fd * 0.08));
  }`
    );
}

const mats = {};
export function mat(kind = "world") {
  if (mats[kind]) return mats[kind];
  const m = new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0 });
  const opts = { rim: kind === "char" || kind === "enemy", sway: kind === "foliage", canopy: kind === "canopy", enemy: kind === "enemy", ground: kind === "ground", occlude: kind === "foliage" || kind === "canopy" || kind === "world" };
  m.onBeforeCompile = (s) => painterly(s, opts);
  m.customProgramCacheKey = () => "p_" + kind;
  if (kind === "foliage" || kind === "canopy") m.side = 2;
  mats[kind] = m;
  return m;
}

export function meshFrom(builder, kind = "world", { cast = true, recv = true, world = null } = {}) {
  const g = builder.build();
  if (kind === "canopy") {
    // each vertex remembers how high it stands above the ground under it, so hills don't amplify the sway
    const p = g.attributes.position, a = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) a[i] = world ? p.getY(i) - world.rawHeight(p.getX(i), p.getZ(i)) : 0;
    g.setAttribute("aSway", new T.BufferAttribute(a, 1));
  }
  const m = new T.Mesh(g, mat(kind));
  m.castShadow = cast;
  m.receiveShadow = recv;
  return m;
}
