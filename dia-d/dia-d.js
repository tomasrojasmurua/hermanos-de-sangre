(() => {
  // src/util.js
  var T = window.THREE;
  var clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  var lerp = (a, b, t) => a + (b - a) * t;
  var smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  var damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  var angDiff = (a, b) => {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  };
  function rng(seed = 1) {
    let s = seed >>> 0 || 1;
    const f = () => {
      s = s + 1831565813 >>> 0;
      let t = s;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    f.range = (a, b) => a + f() * (b - a);
    f.pick = (arr) => arr[Math.floor(f() * arr.length)];
    return f;
  }
  var P = new Uint8Array(512);
  {
    const r = rng(1944);
    const p = [...Array(256).keys()];
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) P[i] = p[i & 255];
  }
  var hash2 = (x, y) => P[P[x & 255] + y & 511] / 255;
  function noise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  }
  function fbm(x, y, o = 4) {
    let s = 0, a = 0.5, f = 1, n = 0;
    for (let i = 0; i < o; i++) {
      s += noise(x * f, y * f) * a;
      n += a;
      a *= 0.5;
      f *= 2.03;
    }
    return s / n;
  }
  function segDist(px, pz, ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    const l2 = dx * dx + dz * dz || 1e-6;
    const t = clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1);
    const cx = ax + dx * t, cz = az + dz * t;
    return { d: Math.hypot(px - cx, pz - cz), t, cx, cz };
  }
  function segHit(p1x, p1z, p2x, p2z, q1x, q1z, q2x, q2z) {
    const d1x = p2x - p1x, d1z = p2z - p1z, d2x = q2x - q1x, d2z = q2z - q1z;
    const den = d1x * d2z - d1z * d2x;
    if (Math.abs(den) < 1e-9) return false;
    const ux = q1x - p1x, uz = q1z - p1z;
    const t = (ux * d2z - uz * d2x) / den;
    const u = (ux * d1z - uz * d1x) / den;
    return t > 0 && t < 1 && u > 0 && u < 1;
  }

  // src/geo.js
  var _m = new T.Matrix4();
  var _q = new T.Quaternion();
  var _e = new T.Euler();
  var _v = new T.Vector3();
  var _s = new T.Vector3();
  var _c = new T.Color();
  var _c2 = new T.Color();
  var cache = {};
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
  var Builder = class {
    constructor(seed = 7) {
      this.pos = [];
      this.col = [];
      this.skin = null;
      this.r = rng(seed);
      this.grad = null;
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
  };
  var U = {
    time: { value: 0 },
    wind: { value: 1 },
    rimColor: { value: new T.Color(0.2, 0.26, 0.4) },
    rimEnemy: { value: new T.Color(0.12, 0.15, 0.24) },
    worldRim: { value: new T.Color(0, 0, 0) },
    fireCol: { value: new T.Color(0, 0, 0) },
    firePos: { value: new T.Vector3() },
    paint: { value: 1 },
    focus: { value: new T.Vector4(-9999, -9999, 0, 0) }
    // player: px x, px y, world y, radius px
  };
  function painterly(shader, { rim = false, sway = false, enemy = false, ground = false, occlude = false } = {}) {
    shader.uniforms.uTime = U.time;
    shader.uniforms.uWind = U.wind;
    shader.uniforms.rimColor = enemy ? U.rimEnemy : U.rimColor;
    shader.uniforms.fireCol = U.fireCol;
    shader.uniforms.firePos = U.firePos;
    shader.uniforms.uPaint = U.paint;
    shader.uniforms.uFocus = U.focus;
    shader.uniforms.worldRim = U.worldRim;
    shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>
varying vec3 vWP; uniform float uTime; uniform float uWind;`).replace(
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
}` : ""}`
    ).replace("#include <worldpos_vertex>", `#include <worldpos_vertex>
  #ifdef USE_INSTANCING
 vWP = (modelMatrix * instanceMatrix * vec4(transformed,1.0)).xyz;
  #else
 vWP = (modelMatrix * vec4(transformed,1.0)).xyz;
  #endif`);
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>
varying vec3 vWP; uniform vec3 rimColor; uniform vec3 fireCol; uniform vec3 firePos; uniform float uPaint;
float ph(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float pn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(ph(i),ph(i+vec2(1,0)),f.x),mix(ph(i+vec2(0,1)),ph(i+vec2(1,1)),f.x),f.y); }
uniform vec4 uFocus; uniform vec3 worldRim;
float bayer4(vec2 p){ vec2 q = mod(floor(p), 4.0); float i = q.x + q.y * 4.0;
  return (i==0.?0.:i==1.?8.:i==2.?2.:i==3.?10.:i==4.?12.:i==5.?4.:i==6.?14.:i==7.?6.:i==8.?3.:i==9.?11.:i==10.?1.:i==11.?9.:i==12.?15.:i==13.?7.:i==14.?13.:5.) / 16.0; }`
    ).replace(
      "#include <color_fragment>",
      `#include <color_fragment>
  ${occlude ? `{
    // see-through: canopies and roofs between the camera and your soldier dissolve (screen-door)
    float dpx = length(gl_FragCoord.xy - uFocus.xy);
    if (vWP.y > uFocus.z + 2.3 && dpx < uFocus.w) {
      float k = 1.0 - smoothstep(uFocus.w * 0.5, uFocus.w, dpx);
      float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
      if (k * 0.85 > n) discard;
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
    ).replace(
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
  var mats = {};
  function mat(kind = "world") {
    if (mats[kind]) return mats[kind];
    const m = new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0 });
    const opts = { rim: kind === "char" || kind === "enemy", sway: kind === "foliage", enemy: kind === "enemy", ground: kind === "ground", occlude: kind === "foliage" || kind === "world" };
    m.onBeforeCompile = (s) => painterly(s, opts);
    m.customProgramCacheKey = () => "p_" + kind;
    if (kind === "foliage") m.side = 2;
    mats[kind] = m;
    return m;
  }
  function meshFrom(builder, kind = "world", { cast = true, recv = true } = {}) {
    const m = new T.Mesh(builder.build(), mat(kind));
    m.castShadow = cast;
    m.receiveShadow = recv;
    return m;
  }

  // src/render.js
  function pickQuality() {
    const q2 = new URLSearchParams(location.search).get("q");
    const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1 && innerWidth < 1100;
    const Q = {
      low: { name: "low", dpr: 1, scale: 0.8, shadow: 0, bloom: false, grass: 0.45, props: 0.6 },
      mid: { name: "mid", dpr: 1.5, scale: 1, shadow: 1024, bloom: true, grass: 0.75, props: 0.85 },
      high: { name: "high", dpr: 2, scale: 1, shadow: 2048, bloom: true, grass: 1, props: 1 }
    };
    return Q[q2] || (mobile ? Q.mid : Q.high);
  }
  var VS = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
  var BRIGHT = `uniform sampler2D tex; uniform float thr; varying vec2 vUv;
void main(){ vec3 c = texture2D(tex, vUv).rgb; if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0); c = min(c, vec3(16.0)); float l = max(max(c.r,c.g),c.b);
  gl_FragColor = vec4(c * smoothstep(thr, thr + 0.8, l), 1.0); }`;
  var BLUR = `uniform sampler2D tex; uniform vec2 dir; varying vec2 vUv;
void main(){ vec3 s = texture2D(tex, vUv).rgb * 0.227;
  s += texture2D(tex, vUv + dir * 1.385).rgb * 0.316; s += texture2D(tex, vUv - dir * 1.385).rgb * 0.316;
  s += texture2D(tex, vUv + dir * 3.231).rgb * 0.070; s += texture2D(tex, vUv - dir * 3.231).rgb * 0.070;
  gl_FragColor = vec4(s, 1.0); }`;
  var FINAL = `uniform sampler2D tex; uniform sampler2D bloom; uniform float useBloom; uniform vec2 res; uniform float time;
uniform float exposure; uniform float sat; uniform float con; uniform vec3 shT; uniform vec3 hiT; uniform vec3 lift;
uniform vec3 topGlow; uniform float vig; uniform float grain; uniform float hurt; uniform float flash; uniform float fade; uniform float bloomK; uniform float desat;
varying vec2 vUv;
vec3 aces(vec3 x){ const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0); }
float hash(vec2 p){ p = fract(p*vec2(443.897,441.423)); p += dot(p, p.yx+19.19); return fract((p.x+p.y)*p.x); }
void main(){
  vec3 col = texture2D(tex, vUv).rgb;
  if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
  col = min(col, vec3(24.0));
  if (useBloom > 0.5) { vec3 bl = texture2D(bloom, vUv).rgb; if (!(any(isnan(bl)) || any(isinf(bl)))) col += bl * bloomK; }
  col *= exposure * (1.0 + flash * 0.3);
  col += vec3(1.0, 0.45, 0.13) * flash * 0.06;
  col = aces(max(col, vec3(0.0)));
  col = pow(col, vec3(1.0/2.2));
  float l = dot(col, vec3(0.299,0.587,0.114));
  col = mix(vec3(l), col, sat * (1.0 - desat));
  col *= mix(shT, hiT, smoothstep(0.05, 0.85, l));
  col = (col - 0.45) * con + 0.45;
  col += lift * (1.0 - smoothstep(0.0, 0.5, l));
  col += topGlow * smoothstep(0.62, 1.0, vUv.y) * (0.8 + 0.2 * sin(time * 1.3));
  vec2 q = vUv - 0.5; q.x *= res.x / res.y * 0.8;
  float e = dot(q, q);
  col *= 1.0 - vig * smoothstep(0.08, 0.55, e * 1.9);
  col = mix(col, vec3(0.42, 0.03, 0.02), hurt * smoothstep(0.04, 0.38, e * 1.8));
  col += (hash(vUv * res + fract(time) * 91.0) - 0.5) * grain * (0.45 + l);
  col = mix(col, vec3(0.0), fade);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;
  var Renderer = class {
    constructor(canvas2, quality) {
      this.q = quality;
      const r = new T.WebGLRenderer({ canvas: canvas2, antialias: false, powerPreference: "high-performance", stencil: false });
      r.outputColorSpace = "srgb-linear";
      r.toneMapping = 0;
      r.shadowMap.enabled = quality.shadow > 0;
      r.shadowMap.type = 2;
      r.setPixelRatio(1);
      this.r = r;
      this.dyn = 1;
      const hf = r.capabilities.isWebGL2 ? 1016 : 1009;
      this.rt = new T.WebGLRenderTarget(4, 4, { type: hf, depthBuffer: true });
      this.rtA = new T.WebGLRenderTarget(4, 4, { type: hf, depthBuffer: false });
      this.rtB = new T.WebGLRenderTarget(4, 4, { type: hf, depthBuffer: false });
      this.cam2 = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      this.quad = new T.Mesh(new T.PlaneGeometry(2, 2));
      this.quad.frustumCulled = false;
      this.sc2 = new T.Scene();
      this.sc2.add(this.quad);
      this.mBright = new T.ShaderMaterial({ vertexShader: VS, fragmentShader: BRIGHT, uniforms: { tex: { value: null }, thr: { value: 1.1 } }, depthTest: false });
      this.mBlur = new T.ShaderMaterial({ vertexShader: VS, fragmentShader: BLUR, uniforms: { tex: { value: null }, dir: { value: new T.Vector2() } }, depthTest: false });
      this.post = {
        tex: { value: null },
        bloom: { value: null },
        useBloom: { value: quality.bloom ? 1 : 0 },
        res: { value: new T.Vector2() },
        time: { value: 0 },
        exposure: { value: 1 },
        sat: { value: 0.9 },
        con: { value: 1.05 },
        shT: { value: new T.Color(0.9, 0.95, 1.1) },
        hiT: { value: new T.Color(1.05, 1, 0.92) },
        lift: { value: new T.Color(0.01, 0.015, 0.03) },
        topGlow: { value: new T.Color(0, 0, 0) },
        vig: { value: 0.55 },
        grain: { value: 0.05 },
        hurt: { value: 0 },
        flash: { value: 0 },
        fade: { value: 0 },
        bloomK: { value: 0.55 },
        desat: { value: 0 }
      };
      this.mFinal = new T.ShaderMaterial({ vertexShader: VS, fragmentShader: FINAL, uniforms: this.post, depthTest: false });
      this.resize();
      window.addEventListener("resize", () => this.pendingResize = true);
      this.fps = 60;
      this._acc = 0;
      this._n = 0;
      this._low = 0;
      this._high = 0;
    }
    resize() {
      const w = innerWidth, h = innerHeight;
      const pr = Math.min(window.devicePixelRatio || 1, this.q.dpr) * this.q.scale * this.dyn;
      this.w = Math.max(2, Math.floor(w * pr));
      this.h = Math.max(2, Math.floor(h * pr));
      this.r.setSize(this.w, this.h, false);
      this.r.domElement.style.width = w + "px";
      this.r.domElement.style.height = h + "px";
      this.rt.setSize(this.w, this.h);
      const bw = Math.max(2, this.w >> 2), bh = Math.max(2, this.h >> 2);
      this.rtA.setSize(bw, bh);
      this.rtB.setSize(bw, bh);
      this.bw = bw;
      this.bh = bh;
      this.post.res.value.set(this.w, this.h);
      this.pixelRatio = pr;
    }
    pass(m, target) {
      this.quad.material = m;
      this.r.setRenderTarget(target);
      this.r.render(this.sc2, this.cam2);
    }
    render(scene2, camera2, t) {
      const r = this.r;
      if (this.pendingResize) {
        this.pendingResize = false;
        this.resize();
      }
      r.setRenderTarget(this.rt);
      r.render(scene2, camera2);
      if (this.q.bloom) {
        this.mBright.uniforms.tex.value = this.rt.texture;
        this.pass(this.mBright, this.rtA);
        for (let i = 0; i < 2; i++) {
          this.mBlur.uniforms.tex.value = this.rtA.texture;
          this.mBlur.uniforms.dir.value.set(1 / this.bw, 0);
          this.pass(this.mBlur, this.rtB);
          this.mBlur.uniforms.tex.value = this.rtB.texture;
          this.mBlur.uniforms.dir.value.set(0, 1 / this.bh);
          this.pass(this.mBlur, this.rtA);
        }
        this.post.bloom.value = this.rtA.texture;
      }
      this.post.tex.value = this.rt.texture;
      this.post.time.value = t;
      this.pass(this.mFinal, null);
    }
    // call once per frame with real dt: drops/raises internal resolution in steps
    adapt(dt) {
      this._acc += dt;
      this._n++;
      if (this._acc < 1) return;
      this.fps = this._n / this._acc;
      this._acc = 0;
      this._n = 0;
      if (this.fps < 27) {
        this._low++;
        this._high = 0;
      } else if (this.fps > 52) {
        this._high++;
        this._low = 0;
      } else this._low = this._high = 0;
      if (this._low >= 2 && this.dyn > 0.55) {
        this.dyn = Math.max(0.55, this.dyn - 0.12);
        this._low = 0;
        this.pendingResize = true;
      } else if (this._high >= 6 && this.dyn < 1) {
        this.dyn = Math.min(1, this.dyn + 0.06);
        this._high = 0;
        this.pendingResize = true;
      }
    }
  };
  function setGrade(post, g) {
    for (const k in g) {
      const u = post[k];
      if (!u) continue;
      if (u.value && u.value.isColor) u.value.setRGB(...g[k]);
      else u.value = g[k];
    }
  }

  // src/fx.js
  var Particles = class {
    constructor(scene2, max = 1500, { additive = false, soft = 1 } = {}) {
      this.max = max;
      this.n = 0;
      this.p = new Float32Array(max * 3);
      this.c = new Float32Array(max * 4);
      this.s = new Float32Array(max);
      this.d = [];
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
          float a = mix(1.0 - step(0.85, r), 1.0 - r * r, soft); gl_FragColor = vec4(vC.rgb, vC.a * a); }`
      });
      this.mesh = new T.Points(g, m);
      this.mesh.frustumCulled = false;
      this.mesh.renderOrder = additive ? 8 : 7;
      scene2.add(this.mesh);
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
        const q2 = d[i];
        q2.t += dt;
        if (q2.t >= q2.life) continue;
        const drag = q2.drag || 0;
        q2.vy -= (q2.grav || 0) * dt;
        const f = Math.exp(-drag * dt);
        q2.vx *= f;
        q2.vy *= f;
        q2.vz *= f;
        q2.x += q2.vx * dt;
        q2.y += q2.vy * dt;
        q2.z += q2.vz * dt;
        if (q2.floor !== void 0 && q2.y < q2.floor) {
          q2.y = q2.floor;
          q2.vy *= -0.2;
          q2.vx *= 0.5;
          q2.vz *= 0.5;
        }
        const u = q2.t / q2.life;
        const fi = q2.mist ? Math.sin(u * Math.PI) * 0.16 : q2.fadeIn ? clamp(q2.t / q2.fadeIn, 0, 1) : 1;
        this.p[k * 3] = q2.x;
        this.p[k * 3 + 1] = q2.y;
        this.p[k * 3 + 2] = q2.z;
        const c0 = q2.c0, c1 = q2.c1 || q2.c0;
        this.c[k * 4] = c0[0] + (c1[0] - c0[0]) * u;
        this.c[k * 4 + 1] = c0[1] + (c1[1] - c0[1]) * u;
        this.c[k * 4 + 2] = c0[2] + (c1[2] - c0[2]) * u;
        this.c[k * 4 + 3] = q2.mist ? fi : (c0[3] + (c1[3] - c0[3]) * u) * fi;
        this.s[k] = q2.s0 + ((q2.s1 ?? q2.s0) - q2.s0) * u;
        d[k++] = q2;
      }
      d.length = k;
      this.n = k;
      this.geo.setDrawRange(0, k);
      const a = this.geo.attributes;
      a.position.needsUpdate = a.color.needsUpdate = a.size.needsUpdate = true;
    }
  };
  var Tracers = class {
    constructor(scene2, max = 120) {
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
          vec3 col = vCol * a + vec3(1.0, 0.8, 0.5) * pow(core, 8.0) * vC.x * vC.x * vC.x * 0.8; gl_FragColor = vec4(col, a * 0.85); }`
      });
      this.mesh = new T.Mesh(g, m);
      this.mesh.frustumCulled = false;
      this.mesh.renderOrder = 9;
      scene2.add(this.mesh);
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
        const o = clamp(r.t * r.speed / r.d, 0, 1);
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
  };
  var FlashLights = class {
    constructor(scene2, n = 3) {
      this.l = [];
      for (let i = 0; i < n; i++) {
        const p = new T.PointLight(16754784, 0, 14, 1.6);
        p.castShadow = false;
        scene2.add(p);
        this.l.push({ p, t: 0, dur: 1, i0: 0 });
      }
      this.k = 0;
    }
    flash(x, y, z, intensity = 8, dur = 0.08, dist = 10, color = 16754784) {
      let best = this.l[0];
      for (const q2 of this.l) if (q2.t <= 0 || q2.p.intensity < best.p.intensity) best = q2;
      best.p.position.set(x, y, z);
      best.p.color.setHex(color);
      best.p.distance = dist;
      best.t = dur;
      best.dur = dur;
      best.i0 = intensity;
      best.p.intensity = intensity;
    }
    update(dt) {
      for (const q2 of this.l) {
        if (q2.t > 0) {
          q2.t -= dt;
          q2.p.intensity = q2.i0 * clamp(q2.t / q2.dur, 0, 1) ** 1.5;
        } else q2.p.intensity = 0;
      }
    }
  };
  var FX = class {
    constructor(scene2, world) {
      this.scene = scene2;
      this.world = world;
      this.smoke = new Particles(scene2, 900, { additive: false, soft: 1 });
      this.glow = new Particles(scene2, 700, { additive: true, soft: 1 });
      this.tracers = new Tracers(scene2, 140);
      this.lights = new FlashLights(scene2, 3);
      this.flash = 0;
      this.shake = 0;
      this.r = rng(5);
      this.fires = [];
      this.skyTracers = [];
    }
    muzzle(p, dir, big = false) {
      const r = this.r;
      this.glow.emit({ x: p.x, y: p.y, z: p.z, life: 0.06, s0: big ? 1 : 0.7, s1: 0.3, c0: [4, 2.2, 0.7, 1], c1: [2, 0.6, 0.1, 0] });
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
      this.smoke.emit({ x, y: y + 0.2, z, vy: 0.5, life: 1, s0: 0.3, s1: 1.1, c0: [0.36, 0.32, 0.27, 0.35], c1: [0.4, 0.37, 0.33, 0], drag: 1 });
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
      this.lights.flash(x, y + 1.5, z, 40 * size, 0.35, 26 * size, 16751184);
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
          this.glow.emit({ x: f.x + (r() - 0.5) * f.size, y: f.y, z: f.z + (r() - 0.5) * f.size, vx: (r() - 0.5) * 0.4, vy: 1.4 + r() * 1.6 * f.size, vz: (r() - 0.5) * 0.4, life: 0.5 + r() * 0.5, s0: 0.7 * f.size, s1: 0.15, c0: [2.6, 1, 0.25, 0.9], c1: [1.2, 0.25, 0.04, 0] });
        if (r() < dt * 5 * f.size)
          this.smoke.emit({ x: f.x, y: f.y + f.size, z: f.z, vx: 0.6, vy: 1.2, vz: 0.2, life: 6, s0: 1.2 * f.size, s1: 5 * f.size, c0: [0.09, 0.08, 0.08, 0.55], c1: [0.16, 0.16, 0.18, 0], drag: 0.2, fadeIn: 0.5 });
      }
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
  };

  // src/audio.js
  var Audio = class {
    constructor() {
      this.ctx = null;
      this.on = false;
      this.listener = { x: 0, z: 0 };
    }
    init() {
      if (this.ctx) return;
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        return;
      }
      const c = this.ctx;
      this.master = c.createGain();
      this.master.gain.value = 0.9;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.ratio.value = 5;
      this.master.connect(comp).connect(c.destination);
      const len = c.sampleRate * 2;
      this.noise = c.createBuffer(1, len, c.sampleRate);
      const d = this.noise.getChannelData(0);
      let b = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b = 0.97 * b + 0.03 * w;
        d[i] = w * 0.6 + b * 2.2;
      }
      const ir = c.createBuffer(2, c.sampleRate * 1.8, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const q2 = ir.getChannelData(ch);
        for (let i = 0; i < q2.length; i++) q2[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / q2.length, 3);
      }
      this.verb = c.createConvolver();
      this.verb.buffer = ir;
      this.verbGain = c.createGain();
      this.verbGain.gain.value = 0.35;
      this.verb.connect(this.verbGain).connect(this.master);
      this.on = true;
    }
    resume() {
      this.ctx && this.ctx.state !== "running" && this.ctx.resume();
    }
    _out(dist = 0, pan = 0) {
      const c = this.ctx;
      const g = c.createGain();
      const att = 1 / (1 + dist * dist * 4e-3);
      g.gain.value = att;
      let node = g;
      if (c.createStereoPanner) {
        const p = c.createStereoPanner();
        p.pan.value = Math.max(-1, Math.min(1, pan));
        g.connect(p);
        node = p;
      }
      node.connect(this.master);
      const send = c.createGain();
      send.gain.value = Math.min(0.9, 0.15 + dist * 0.015);
      g.connect(send).connect(this.verb);
      return g;
    }
    _pos(x, z) {
      const dx = x - this.listener.x, dz = z - this.listener.z;
      return { d: Math.hypot(dx, dz), pan: (dx - dz) * 0.03 };
    }
    _noise(dest, t0, dur, { type = "lowpass", f0 = 1e3, f1 = null, q: q2 = 0.8, gain = 1, attack = 2e-3, rate = 1 } = {}) {
      const c = this.ctx;
      const s = c.createBufferSource();
      s.buffer = this.noise;
      s.playbackRate.value = rate;
      const f = c.createBiquadFilter();
      f.type = type;
      f.frequency.setValueAtTime(f0, t0);
      if (f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
      f.Q.value = q2;
      const g = c.createGain();
      g.gain.setValueAtTime(1e-4, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
      g.gain.exponentialRampToValueAtTime(1e-4, t0 + dur);
      s.connect(f).connect(g).connect(dest);
      s.start(t0, Math.random() * 1.5);
      s.stop(t0 + dur + 0.05);
    }
    _tone(dest, t0, dur, freq, { type = "sine", gain = 0.3, f1 = null, attack = 5e-3 } = {}) {
      const c = this.ctx;
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(1e-4, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
      g.gain.exponentialRampToValueAtTime(1e-4, t0 + dur);
      o.connect(g).connect(dest);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    }
    // ---------------------------------------------------------------------------------------------
    shot(x, z, kind = "m1") {
      if (!this.on) return;
      const { d, pan } = this._pos(x, z);
      const o = this._out(d, pan);
      const t = this.ctx.currentTime;
      const hi = kind === "mp40" || kind === "thompson" ? 0.7 : 1;
      this._noise(o, t, 0.22 * hi, { f0: 4200, f1: 600, gain: 0.9, rate: 1.2 });
      this._noise(o, t, 0.5, { f0: 260, f1: 60, gain: 0.8, type: "lowpass" });
      this._tone(o, t, 0.12, 120, { f1: 50, gain: 0.5 });
      if (d > 25) this._noise(o, t + d / 340, 0.8, { f0: 400, f1: 120, gain: 0.25 });
    }
    mg(x, z) {
      if (!this.on) return;
      const { d, pan } = this._pos(x, z);
      const o = this._out(d, pan);
      const t = this.ctx.currentTime;
      for (let i = 0; i < 9; i++) {
        this._noise(o, t + i * 0.05, 0.09, { f0: 2400, f1: 400, gain: 0.7 });
        this._tone(o, t + i * 0.05, 0.06, 95, { f1: 50, gain: 0.35 });
      }
    }
    ping() {
      if (!this.on) return;
      const o = this._out(0, 0.2);
      const t = this.ctx.currentTime;
      this._tone(o, t, 0.6, 2350, { type: "triangle", gain: 0.18, f1: 2300 });
      this._tone(o, t, 0.4, 3480, { type: "sine", gain: 0.08 });
    }
    reload() {
      if (!this.on) return;
      const o = this._out(0, 0.2);
      const t = this.ctx.currentTime;
      this._noise(o, t, 0.05, { f0: 3e3, type: "bandpass", q: 3, gain: 0.5 });
      this._noise(o, t + 0.35, 0.06, { f0: 2400, type: "bandpass", q: 3, gain: 0.6 });
      this._noise(o, t + 0.55, 0.08, { f0: 1800, type: "bandpass", q: 2, gain: 0.7 });
    }
    boom(x, z, size = 1) {
      if (!this.on) return;
      const { d, pan } = this._pos(x, z);
      const o = this._out(d * 0.6, pan);
      const t = this.ctx.currentTime + d / 340;
      this._noise(o, t, 1.6 * size, { f0: 900, f1: 40, gain: 1.4 });
      this._tone(o, t, 0.9, 70, { f1: 28, gain: 0.9 });
      this._noise(o, t + 0.05, 2.5, { f0: 300, f1: 60, gain: 0.35 });
    }
    whizz(near = 1) {
      if (!this.on) return;
      const o = this._out(0, (Math.random() - 0.5) * 1.6);
      const t = this.ctx.currentTime;
      this._noise(o, t, 0.18, { type: "bandpass", f0: 5200, f1: 1600, q: 5, gain: 0.5 * near });
      if (Math.random() < 0.5) this._noise(o, t + 0.02, 0.05, { type: "highpass", f0: 3e3, gain: 0.3 * near });
    }
    cricket(x = this.listener.x, z = this.listener.z, twice = false) {
      if (!this.on) return;
      const { d, pan } = this._pos(x, z);
      const o = this._out(d, pan);
      const t = this.ctx.currentTime;
      const one = (tt) => {
        this._tone(o, tt, 0.03, 3100, { type: "square", gain: 0.12 });
        this._tone(o, tt + 0.09, 0.03, 2600, { type: "square", gain: 0.1 });
      };
      one(t);
      if (twice) one(t + 0.32);
    }
    bell(x, z) {
      if (!this.on) return;
      const { d, pan } = this._pos(x, z);
      const o = this._out(d * 0.5, pan);
      const t = this.ctx.currentTime;
      for (const [f, g] of [[196, 0.25], [392, 0.12], [588, 0.07], [933, 0.04]]) this._tone(o, t, 3.8, f, { gain: g, attack: 4e-3 });
    }
    footstep(soft = 1) {
      if (!this.on) return;
      const o = this._out(0, (Math.random() - 0.5) * 0.3);
      const t = this.ctx.currentTime;
      this._noise(o, t, 0.08, { f0: 900 + Math.random() * 400, type: "lowpass", gain: 0.12 * soft });
    }
    stab() {
      if (!this.on) return;
      const o = this._out(0, 0);
      const t = this.ctx.currentTime;
      this._noise(o, t, 0.12, { f0: 600, type: "lowpass", gain: 0.6 });
      this._noise(o, t + 0.05, 0.3, { f0: 300, type: "lowpass", gain: 0.3 });
    }
    heartbeat(k = 1) {
      if (!this.on) return;
      const o = this._out(0, 0);
      const t = this.ctx.currentTime;
      this._tone(o, t, 0.12, 55, { gain: 0.5 * k, f1: 40 });
      this._tone(o, t + 0.22, 0.14, 50, { gain: 0.35 * k, f1: 38 });
    }
    shout(x, z) {
      if (!this.on) return;
      const { d, pan } = this._pos(x, z);
      const o = this._out(d, pan);
      const t = this.ctx.currentTime;
      this._tone(o, t, 0.25, 220, { type: "sawtooth", gain: 0.12, f1: 170 });
      this._noise(o, t, 0.25, { type: "bandpass", f0: 900, q: 4, gain: 0.2 });
    }
    // continuous beds --------------------------------------------------------------------------------
    startWind(level = 0.2) {
      if (!this.on || this.wind) return;
      const c = this.ctx;
      const s = c.createBufferSource();
      s.buffer = this.noise;
      s.loop = true;
      s.playbackRate.value = 0.5;
      const f = c.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 420;
      const g = c.createGain();
      g.gain.value = level;
      const lfo = c.createOscillator();
      lfo.frequency.value = 0.09;
      const lg = c.createGain();
      lg.gain.value = 180;
      lfo.connect(lg).connect(f.frequency);
      s.connect(f).connect(g).connect(this.master);
      s.start();
      lfo.start();
      this.wind = { s, g, f };
    }
    setWind(level) {
      this.wind && this.wind.g.gain.setTargetAtTime(level, this.ctx.currentTime, 1.5);
    }
    plane(dur = 9, level = 0.35) {
      if (!this.on) return;
      const c = this.ctx, t = c.currentTime;
      const g = c.createGain();
      g.gain.setValueAtTime(1e-4, t);
      g.gain.exponentialRampToValueAtTime(level, t + dur * 0.45);
      g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
      g.connect(this.master);
      for (const f of [58, 61.5, 116]) {
        const o = c.createOscillator();
        o.type = "sawtooth";
        o.frequency.setValueAtTime(f * 1.04, t);
        o.frequency.linearRampToValueAtTime(f * 0.96, t + dur);
        const lp = c.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 380;
        o.connect(lp).connect(g);
        o.start(t);
        o.stop(t + dur + 0.1);
      }
    }
    distantFlak() {
      if (!this.on) return;
      const o = this._out(60, Math.random() - 0.5);
      const t = this.ctx.currentTime;
      for (let i = 0; i < 4; i++) this._noise(o, t + i * 0.13, 0.4, { f0: 300, f1: 80, gain: 0.6 });
    }
    sting(kind = "low") {
      if (!this.on) return;
      const o = this._out(0, 0);
      const t = this.ctx.currentTime;
      const notes = kind === "grief" ? [110, 130.8, 164.8] : kind === "dawn" ? [146.8, 220, 293.7] : [98, 116.5];
      notes.forEach((f, i) => this._tone(o, t + i * 0.4, 4.5, f, { type: "triangle", gain: 0.09, attack: 1.2 }));
    }
  };

  // src/input.js
  var Input = class {
    constructor(root) {
      this.mx = 0;
      this.my = 0;
      this.held = {};
      this.pressed = {};
      this.stick = null;
      this.keys = {};
      const base = document.createElement("div");
      base.className = "stick hidden";
      base.innerHTML = '<div class="knob"></div>';
      root.appendChild(base);
      this.stickEl = base;
      this.knob = base.firstChild;
      this.R = 52;
      const zone = document.createElement("div");
      zone.className = "stickzone";
      root.appendChild(zone);
      this.zone = zone;
      zone.addEventListener("pointerdown", (e) => this._down(e));
      window.addEventListener("pointermove", (e) => this._move(e), { passive: true });
      window.addEventListener("pointerup", (e) => this._up(e));
      window.addEventListener("pointercancel", (e) => this._up(e));
      window.addEventListener("keydown", (e) => {
        if (e.repeat) return;
        this.keys[e.code] = true;
        const b = KEYMAP[e.code];
        if (b) this.press(b);
      });
      window.addEventListener("keyup", (e) => {
        this.keys[e.code] = false;
        const b = KEYMAP[e.code];
        if (b) this.release(b);
      });
    }
    _down(e) {
      if (this.stick) return;
      e.preventDefault();
      this.stick = { id: e.pointerId, x: e.clientX, y: e.clientY };
      this.stickEl.classList.remove("hidden");
      this.stickEl.style.transform = `translate(${e.clientX - this.R}px, ${e.clientY - this.R}px)`;
      this.knob.style.transform = "translate(0px,0px)";
      this.mx = this.my = 0;
    }
    _move(e) {
      const s = this.stick;
      if (!s || e.pointerId !== s.id) return;
      let dx = e.clientX - s.x, dy = e.clientY - s.y;
      const l = Math.hypot(dx, dy);
      if (l > this.R) {
        const k = (l - this.R) / l;
        s.x += dx * k;
        s.y += dy * k;
        dx = e.clientX - s.x;
        dy = e.clientY - s.y;
        this.stickEl.style.transform = `translate(${s.x - this.R}px, ${s.y - this.R}px)`;
      }
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.mx = clamp(dx / this.R, -1, 1);
      this.my = clamp(dy / this.R, -1, 1);
    }
    _up(e) {
      if (!this.stick || e.pointerId !== this.stick.id) return;
      this.stick = null;
      this.mx = this.my = 0;
      this.stickEl.classList.add("hidden");
    }
    press(b) {
      if (!this.held[b]) this.pressed[b] = true;
      this.held[b] = true;
    }
    release(b) {
      this.held[b] = false;
    }
    // movement in screen space, merged with keyboard
    axis() {
      let x = this.mx, y = this.my;
      const k = this.keys;
      if (k.KeyA || k.ArrowLeft) x -= 1;
      if (k.KeyD || k.ArrowRight) x += 1;
      if (k.KeyW || k.ArrowUp) y -= 1;
      if (k.KeyS || k.ArrowDown) y += 1;
      const l = Math.hypot(x, y);
      if (l > 1) {
        x /= l;
        y /= l;
      }
      return { x, y, l: Math.min(1, l) };
    }
    consume(b) {
      const v = !!this.pressed[b];
      this.pressed[b] = false;
      return v;
    }
    endFrame() {
      this.pressed = {};
    }
  };
  var KEYMAP = { Space: "fire", KeyJ: "fire", KeyC: "crouch", KeyG: "grenade", KeyH: "heal", KeyE: "act", KeyR: "reload", Enter: "act", KeyQ: "call" };

  // src/ui.js
  var $ = (s, r = document) => r.querySelector(s);
  var el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== void 0) e.innerHTML = html;
    return e;
  };
  var esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  var ICON = {
    fire: '<svg viewBox="0 0 24 24"><path d="M3 13h11l2-2h5v3h-4l-1 1v4h-3v-3H3z" fill="currentColor"/></svg>',
    knife: '<svg viewBox="0 0 24 24"><path d="M4 20 15 9l2 2L6 22zM15 9l5-6 1 1-4 7z" fill="currentColor"/></svg>',
    crouch: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="2.4" fill="currentColor"/><path d="M8 21l2-6-2-3 3-3h3l2 4h3v2h-4l-1-2-2 2 2 3-1 3z" fill="currentColor"/></svg>',
    grenade: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="14" rx="5.5" ry="6.5" fill="currentColor"/><rect x="10" y="4" width="4" height="4" rx="1" fill="currentColor"/><path d="M14 5h4v2h-3" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>',
    bandage: '<svg viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="8" rx="4" fill="currentColor" transform="rotate(-35 12 12)"/><path d="M10 12h4M12 10v4" stroke="#222" stroke-width="1.8"/></svg>',
    call: '<svg viewBox="0 0 24 24"><path d="M6 15c0-4 3-7 6-7s6 3 6 7" stroke="currentColor" stroke-width="2" fill="none"/><rect x="9" y="14" width="6" height="5" rx="1" fill="currentColor"/><path d="M3 9l2 1M21 9l-2 1M12 3v2" stroke="currentColor" stroke-width="1.6"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" fill="currentColor"/><rect x="14" y="5" width="4" height="14" fill="currentColor"/></svg>'
  };
  function portraitSVG(p = {}) {
    const skin = p.skin || "#d6a07c", helm = p.helmet || "#4d5136", paint = p.paint === false ? "" : `<path d="M15 33 L45 30" stroke="#2b2a22" stroke-width="3" opacity=".75"/>`;
    return `<svg viewBox="0 0 60 60"><rect width="60" height="60" fill="${p.bg || "#2a2b25"}"/>
  <rect x="17" y="46" width="26" height="14" fill="${p.coat || "#77704f"}"/>
  <rect x="25" y="40" width="10" height="8" fill="${skin}"/>
  <rect x="18" y="20" width="24" height="24" rx="4" fill="${skin}"/>
  <rect x="22" y="29" width="4" height="3" fill="#1a1715"/><rect x="34" y="29" width="4" height="3" fill="#1a1715"/>
  <rect x="27" y="38" width="7" height="2" fill="#7a4a3a"/>${paint}
  <path d="M12 26 Q30 2 48 26 Z" fill="${helm}"/><rect x="11" y="24" width="38" height="4" rx="2" fill="${helm}"/>
  ${p.rank === "lt" ? '<rect x="28" y="9" width="4" height="9" fill="#e8e2d0"/>' : p.rank === "sgt" ? '<rect x="24" y="12" width="12" height="3" fill="#e8e2d0"/>' : ""}</svg>`;
  }
  var UI = class {
    constructor(root) {
      this.root = root;
      root.innerHTML = `
    <div id="hud" class="hidden">
      <div id="who"><div class="por"></div><div class="info"><b class="nm"></b><span class="rk"></span>
        <div class="hp"><i></i></div><div class="status"></div></div></div>
      <button id="pauseBtn" class="round" aria-label="Pausa">${ICON.pause}</button>
      <div id="obj"><span class="arrow">\u27A4</span><span class="txt"></span><span class="m"></span></div>
      <div id="marks"></div>
      <div id="sub" class="hidden"><b></b><span></span></div>
      <div id="btns">
        <button class="b act hidden" data-b="act"><span class="lbl"></span></button>
        <button class="b call hidden" data-b="call">${ICON.call}<small>Chicharra</small></button>
        <button class="b heal" data-b="heal">${ICON.bandage}<em class="n">0</em></button>
        <button class="b nade" data-b="grenade">${ICON.grenade}<em class="n">0</em></button>
        <button class="b crouch" data-b="crouch">${ICON.crouch}</button>
        <button class="b fire" data-b="fire"><span class="ic">${ICON.fire}</span><span class="ammo"></span><i class="rl"></i></button>
      </div>
      <div id="toast"></div>
      <div id="qte" class="hidden"><div class="lbl"><span></span><i class="bar"></i></div><button class="b" data-b="qte"><span class="t2"></span></button></div>
      <div class="ghost"><i></i><span>Arrastra para moverte</span></div>
    </div>
    <div id="cards"></div>
    <div id="fade"></div>`;
      this.hud = $("#hud", root);
      this.btns = $("#btns", root);
      this.marks = $("#marks", root);
      this.sub = $("#sub", root);
      this.obj = $("#obj", root);
      this.cards = $("#cards", root);
      this.toastEl = $("#toast", root);
      this.fadeEl = $("#fade", root);
      this.qteEl = $("#qte", root);
      this._marks = /* @__PURE__ */ new Map();
      this.input = null;
      this.subQ = [];
      this.subT = 0;
    }
    bindInput(input2) {
      this.input = input2;
      const handle = (e, down) => {
        const b = e.target.closest("[data-b]");
        if (!b) return;
        e.preventDefault();
        const k = b.dataset.b;
        if (down) {
          input2.press(k);
          b.classList.add("down");
          b.setPointerCapture?.(e.pointerId);
        } else {
          input2.release(k);
          b.classList.remove("down");
        }
      };
      for (const zone of [this.btns, this.qteEl]) {
        zone.addEventListener("pointerdown", (e) => handle(e, true));
        zone.addEventListener("pointerup", (e) => handle(e, false));
        zone.addEventListener("pointercancel", (e) => handle(e, false));
        zone.addEventListener("contextmenu", (e) => e.preventDefault());
      }
      $("#pauseBtn", this.root).addEventListener("click", () => this.onPause && this.onPause());
    }
    show(on = true) {
      this.hud.classList.toggle("hidden", !on);
    }
    setWho(s) {
      $("#who .por", this.root).innerHTML = portraitSVG(s.portrait);
      $("#who .nm", this.root).textContent = s.name;
      $("#who .rk", this.root).textContent = s.rank || "";
    }
    setHealth(h, bleeding, healing) {
      const i = $("#who .hp i", this.root);
      i.style.transform = `scaleX(${clamp(h / 100, 0, 1)})`;
      i.parentElement.classList.toggle("low", h < 35);
      const st = $("#who .status", this.root);
      const t = healing ? "Vend\xE1ndose\u2026" : bleeding ? "Sangra" : "";
      if (st.textContent !== t) st.textContent = t;
      st.classList.toggle("bleed", !!bleeding && !healing);
    }
    setWeapon(kind, clip, reserve, reloading) {
      const f = $(".b.fire", this.btns);
      const ic = kind === "knife" ? ICON.knife : ICON.fire;
      if (f._k !== kind) {
        f.querySelector(".ic").innerHTML = ic;
        f._k = kind;
      }
      const a = kind === "knife" ? "" : `${clip}<small>/${reserve}</small>`;
      const am = f.querySelector(".ammo");
      if (am._v !== a) {
        am.innerHTML = a;
        am._v = a;
      }
      f.classList.toggle("empty", kind !== "knife" && clip === 0 && reserve === 0);
      f.classList.toggle("reloading", !!reloading);
    }
    setInv(gren, band, canCall) {
      const n = $(".b.nade .n", this.btns), h = $(".b.heal .n", this.btns);
      if (n.textContent !== String(gren)) n.textContent = gren;
      if (h.textContent !== String(band)) h.textContent = band;
      $(".b.nade", this.btns).classList.toggle("off", gren <= 0);
      $(".b.heal", this.btns).classList.toggle("off", band <= 0);
      $(".b.call", this.btns).classList.toggle("hidden", !canCall);
    }
    setCrouch(on) {
      $(".b.crouch", this.btns).classList.toggle("on", on);
    }
    setAct(label) {
      const a = $(".b.act", this.btns);
      if (!label) {
        a.classList.add("hidden");
        return;
      }
      a.classList.remove("hidden");
      const l = a.querySelector(".lbl");
      if (l.textContent !== label) l.textContent = label;
    }
    setObjective(text, distM, angScreen) {
      if (!text) {
        this.obj.classList.add("hidden");
        return;
      }
      this.obj.classList.remove("hidden");
      const t = this.obj.querySelector(".txt");
      if (t.textContent !== text) {
        t.textContent = text;
        this.obj.classList.remove("new");
        void this.obj.offsetWidth;
        this.obj.classList.add("new");
      }
      const a = this.obj.querySelector(".arrow"), m = this.obj.querySelector(".m");
      if (distM == null) {
        a.style.visibility = "hidden";
        m.textContent = "";
      } else {
        a.style.visibility = "visible";
        a.style.transform = `rotate(${angScreen}rad)`;
        m.textContent = distM < 4 ? "" : Math.round(distM) + " m";
      }
    }
    // world-anchored markers: key -> {x,y (screen), text, cls}
    ghostOff() {
      const g = this.root.querySelector(".ghost");
      if (g && !g.classList.contains("off")) g.classList.add("off");
    }
    mark(key, sx, sy, html, cls = "") {
      if (cls.startsWith("ally")) sx = Math.max(34, Math.min(innerWidth - 34, sx));
      let m = this._marks.get(key);
      if (!m) {
        m = el("div", "mk " + cls);
        this.marks.appendChild(m);
        this._marks.set(key, m);
      }
      if (m._h !== html) {
        m.innerHTML = html;
        m._h = html;
      }
      if (m._c !== cls) {
        m.className = "mk " + cls;
        m._c = cls;
      }
      m.style.transform = `translate(${sx | 0}px, ${sy | 0}px) translate(-50%,-100%)`;
      m._seen = true;
    }
    sweepMarks() {
      for (const [k, m] of this._marks) {
        if (!m._seen) {
          m.remove();
          this._marks.delete(k);
        } else m._seen = false;
      }
    }
    // subtitles: queue of {who, text, dur}
    say(who, text, dur) {
      this.subQ.push({ who, text, dur: dur || Math.max(2.4, text.length * 0.065) });
    }
    sayNow(who, text, dur) {
      this.subQ = [];
      this.subT = 0;
      this.say(who, text, dur);
    }
    updateSubs(dt) {
      if (this.subT > 0) {
        this.subT -= dt;
        if (this.subT <= 0) this.sub.classList.add("hidden");
      }
      if (this.subT <= 0 && this.subQ.length) {
        const s = this.subQ.shift();
        this.sub.querySelector("b").textContent = s.who ? s.who : "";
        this.sub.querySelector("b").style.display = s.who ? "" : "none";
        this.sub.querySelector("span").textContent = s.text;
        this.sub.classList.remove("hidden");
        this.sub.classList.remove("pop");
        void this.sub.offsetWidth;
        this.sub.classList.add("pop");
        this.subT = s.dur;
      }
    }
    get talking() {
      return this.subT > 0 || this.subQ.length > 0;
    }
    toast(t, ms = 2400) {
      this.toastEl.textContent = t;
      this.toastEl.classList.add("on");
      clearTimeout(this._tt);
      this._tt = setTimeout(() => this.toastEl.classList.remove("on"), ms);
    }
    fade(on, ms = 900) {
      this.fadeEl.style.transitionDuration = ms + "ms";
      this.fadeEl.style.opacity = on ? 1 : 0;
      return new Promise((r) => setTimeout(r, ms));
    }
    qte(label, secs, short) {
      this.qteEl.classList.remove("hidden");
      this.qteEl.querySelector(".lbl span").textContent = label;
      this.qteEl.querySelector(".t2").textContent = short || "\xA1YA!";
      const bar = this.qteEl.querySelector(".bar");
      bar.style.transition = "none";
      bar.style.transform = "scaleX(1)";
      void bar.offsetWidth;
      bar.style.transition = `transform ${secs}s linear`;
      bar.style.transform = "scaleX(0)";
    }
    qteHide() {
      this.qteEl.classList.add("hidden");
    }
    // paper card. o: {kicker, title, text (string|array), quote:{t,src}, choices:[{label,sub,value}], next:"Continuar", cls}
    card(o) {
      return new Promise((resolve) => {
        const w = el("div", "dim " + (o.cls || ""));
        const pages = Array.isArray(o.text) ? o.text : [o.text || ""];
        let pi = 0;
        const render = () => {
          const last2 = pi === pages.length - 1;
          w.innerHTML = `<div class="paper">
          ${o.kicker ? `<div class="kicker">${esc(o.kicker)}</div>` : ""}
          ${o.title ? `<h3>${esc(o.title)}</h3>` : ""}
          <p>${esc(pages[pi])}</p>
          ${last2 && o.quote ? `<blockquote>${esc(o.quote.t)}<cite>${esc(o.quote.src)}</cite></blockquote>` : ""}
          ${last2 && o.choices ? `<div class="choices">${o.choices.map((c, i) => `<button class="choice" data-i="${i}" style="animation-delay:${0.1 + i * 0.12}s"><b>${esc(c.label)}</b>${c.sub ? `<small>${esc(c.sub)}</small>` : ""}</button>`).join("")}</div>` : `<button class="next">${esc(last2 ? o.next || "Continuar" : "Seguir")}</button>`}
          ${pages.length > 1 ? `<div class="pager">${pages.map((_, i) => `<i class="${i === pi ? "on" : ""}"></i>`).join("")}</div>` : ""}
        </div>`;
          const nx = w.querySelector(".next");
          if (nx)
            nx.onclick = () => {
              if (!last2) {
                pi++;
                render();
              } else {
                w.remove();
                resolve(null);
              }
            };
          w.querySelectorAll(".choice").forEach((b) => b.onclick = () => {
            w.remove();
            resolve(o.choices[+b.dataset.i].value ?? +b.dataset.i);
          });
        };
        render();
        this.cards.appendChild(w);
      });
    }
    // chapter title over the live scene
    async chapter(kicker, title2, sub, ms = 4200) {
      const w = el("div", "chap", `<div class="k">${esc(kicker)}</div><h2>${esc(title2)}</h2><p>${esc(sub)}</p>`);
      this.cards.appendChild(w);
      await new Promise((r) => setTimeout(r, ms));
      w.classList.add("out");
      setTimeout(() => w.remove(), 1200);
    }
    flashHurt() {
      this.hud.classList.remove("hurt");
      void this.hud.offsetWidth;
      this.hud.classList.add("hurt");
    }
  };

  // src/actors.js
  var PAL = {
    para: { coat: 9076565, coat2: 7760968, pants: 8221775, boots: 5913638, helmet: 6249792, net: 4605231, skin: 14065788, gear: 10787956, paint: 2828834 },
    heer: { coat: 7238760, coat2: 6120280, pants: 5791316, boots: 1907996, helmet: 4869960, net: 3948857, skin: 13869699, gear: 2302752, paint: null },
    fj: { coat: 7303512, coat2: 5921861, pants: 5593420, boots: 2236703, helmet: 4869961, net: 4014649, skin: 13672064, gear: 2763302, paint: null }
  };
  var B = { hips: 0, spine: 1, chest: 2, head: 3, shL: 4, elL: 5, shR: 6, elR: 7, thL: 8, knL: 9, thR: 10, knR: 11, gun: 12 };
  function buildSoldier(opts = {}) {
    const pal = PAL[opts.kit || "para"];
    const seed = opts.seed ?? Math.floor(Math.random() * 1e6);
    const r = rng(seed);
    const enemy = opts.kit !== "para";
    const bones = [];
    const mk = (parent, x, y, z) => {
      const b2 = new T.Bone();
      b2.position.set(x, y, z);
      if (parent) parent.add(b2);
      bones.push(b2);
      return b2;
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
    const W2 = (bone) => ({ mat: bone.matrixWorld, bone: bones.indexOf(bone), jit: 0.05 });
    for (const [th, kn, s] of [[thL, knL, 1], [thR, knR, -1]]) {
      b.box(0.17, 0.44, 0.19, pal.pants, { y: -0.21 }, W2(th));
      b.box(0.19, 0.08, 0.2, pal.coat2, { y: -0.02, z: 0 }, W2(th));
      if (opts.kit === "para") b.box(0.07, 0.15, 0.06, pal.coat2, { x: s * 0.095, y: -0.24, z: 0.02 }, W2(th));
      b.box(0.155, 0.4, 0.17, pal.pants, { y: -0.18 }, W2(kn));
      b.box(0.16, 0.18, 0.2, pal.boots, { y: -0.36, z: 0.02 }, W2(kn));
      b.box(0.15, 0.06, 0.29, pal.boots, { y: -0.45, z: 0.05 }, W2(kn));
    }
    b.box(0.42, 0.24, 0.24, pal.pants, { y: 0.02 }, W2(hips));
    b.box(0.44, 0.07, 0.26, pal.gear, { y: 0.1 }, W2(hips));
    if (opts.kit === "para") {
      for (const s of [-1, 1]) b.box(0.08, 0.1, 0.07, pal.gear, { x: s * 0.16, y: 0.1, z: 0.13 }, W2(hips));
      b.box(0.09, 0.14, 0.08, 6117958, { x: 0.2, y: 0.04, z: -0.1 }, W2(hips));
    } else {
      for (const s of [-1, 1]) b.box(0.1, 0.08, 0.06, pal.gear, { x: s * 0.13, y: 0.11, z: 0.14 }, W2(hips));
    }
    b.box(0.44, 0.34, 0.26, pal.coat, { y: 0.14 }, W2(spine));
    b.box(0.48, 0.3, 0.28, pal.coat, { y: 0.11 }, W2(chest));
    b.box(0.2, 0.12, 0.05, pal.coat2, { x: 0.11, y: 0.1, z: 0.14 }, W2(chest));
    b.box(0.2, 0.12, 0.05, pal.coat2, { x: -0.11, y: 0.1, z: 0.14 }, W2(chest));
    if (opts.kit === "para") {
      for (const s of [-1, 1]) b.box(0.05, 0.42, 0.29, pal.gear, { x: s * 0.13, y: 0.04 }, W2(chest));
      b.box(0.34, 0.3, 0.14, 7038536, { y: 0.06, z: -0.19 }, W2(chest));
      b.box(0.08, 0.05, 0.02, 12104096, { x: 0.255, y: 0.02, z: 0, ry: Math.PI / 2 }, W2(shL));
    } else {
      b.box(0.5, 0.05, 0.3, pal.gear, { y: 0.24 }, W2(chest));
      b.box(0.18, 0.12, 0.1, 4079672, { x: -0.14, y: -0.02, z: -0.16 }, W2(chest));
      if (opts.kit === "heer") b.cyl(0.07, 0.07, 0.24, 6, 5067080, { x: 0.18, y: -0.05, z: -0.14, rx: 0.05 }, W2(chest));
    }
    b.box(0.16, 0.08, 0.16, pal.skin, { y: 0.27 }, W2(chest));
    const face = opts.skin ?? pal.skin;
    b.box(0.22, 0.26, 0.24, face, { y: 0.12 }, W2(head));
    b.box(0.2, 0.06, 0.04, 2761760, { y: 0.15, z: 0.12 }, W2(head));
    b.box(0.035, 0.035, 0.02, 1709845, { x: 0.05, y: 0.13, z: 0.125 }, W2(head));
    b.box(0.035, 0.035, 0.02, 1709845, { x: -0.05, y: 0.13, z: 0.125 }, W2(head));
    b.box(0.04, 0.07, 0.05, face, { y: 0.08, z: 0.13 }, { ...W2(head), jit: 0.1 });
    b.box(0.09, 0.02, 0.02, 8014394, { y: 0.03, z: 0.122 }, W2(head));
    if (opts.kit === "para" && opts.paint !== false) {
      b.box(0.225, 0.035, 0.02, pal.paint, { y: 0.1, z: 0.122, rz: 0.15 }, W2(head));
      b.box(0.18, 0.03, 0.02, pal.paint, { y: 0.19, z: 0.122, rz: -0.2 }, W2(head));
    }
    if (opts.mustache) b.box(0.1, 0.025, 0.02, 3811870, { y: 0.055, z: 0.13 }, W2(head));
    if (opts.kit === "para") {
      b.sphere(0.165, 8, 5, pal.helmet, { y: 0.21, sy: 0.82, sz: 1.06 }, W2(head));
      b.cyl(0.18, 0.185, 0.03, 10, pal.helmet, { y: 0.17 }, W2(head));
      b.sphere(0.168, 7, 4, pal.net, { y: 0.215, sy: 0.8, sz: 1.06 }, { ...W2(head), jit: 0.15 });
      if (opts.rank === "lt") b.box(0.03, 0.08, 0.02, 15262416, { y: 0.27, z: -0.165 }, W2(head));
      if (opts.rank === "sgt") b.box(0.09, 0.025, 0.02, 15262416, { y: 0.27, z: -0.165 }, W2(head));
      if (opts.medic) b.box(0.08, 0.08, 0.02, 14209216, { y: 0.26, z: 0.17 }, W2(head));
      b.box(0.03, 0.17, 0.03, pal.gear, { x: 0.12, y: 0.06, z: 0.03 }, W2(head));
      b.box(0.03, 0.17, 0.03, pal.gear, { x: -0.12, y: 0.06, z: 0.03 }, W2(head));
    } else if (opts.kit === "heer") {
      b.sphere(0.16, 8, 5, pal.helmet, { y: 0.22, sy: 0.85, sz: 1.05 }, W2(head));
      b.cyl(0.16, 0.215, 0.1, 10, pal.helmet, { y: 0.14, z: -0.01 }, W2(head));
    } else {
      b.sphere(0.158, 8, 5, pal.helmet, { y: 0.2, sy: 0.9, sz: 1.02 }, W2(head));
      b.cyl(0.162, 0.165, 0.07, 10, pal.helmet, { y: 0.15 }, W2(head));
    }
    for (const [sh, el2] of [[shL, elL], [shR, elR]]) {
      b.box(0.14, 0.33, 0.15, pal.coat, { y: -0.13 }, W2(sh));
      b.box(0.13, 0.28, 0.14, pal.coat, { y: -0.12 }, W2(el2));
      b.box(0.11, 0.1, 0.12, face, { y: -0.3 }, W2(el2));
    }
    const wpn = opts.weapon || (enemy ? "k98" : "m1");
    const G2 = W2(gun);
    if (wpn === "m1" || wpn === "k98") {
      const wood = wpn === "m1" ? 7029801 : 5913124;
      b.box(0.05, 0.08, 0.68, wood, { z: 0.1 }, G2);
      b.box(0.06, 0.12, 0.2, wood, { z: -0.3, y: -0.03 }, G2);
      b.box(0.03, 0.03, 0.42, 2763564, { y: 0.05, z: 0.5 }, G2);
      if (wpn === "k98") b.box(0.02, 0.03, 0.06, 2763564, { x: -0.05, y: 0.05, z: 0.05 }, G2);
    } else if (wpn === "thompson") {
      b.box(0.05, 0.08, 0.36, 5913124, { z: -0.16 }, G2);
      b.box(0.05, 0.08, 0.32, 2763564, { z: 0.14 }, G2);
      b.box(0.04, 0.18, 0.06, 2763564, { y: -0.1, z: 0.06 }, G2);
      b.box(0.03, 0.03, 0.2, 2763564, { y: 0.02, z: 0.38 }, G2);
    } else if (wpn === "mp40") {
      b.box(0.05, 0.08, 0.42, 2039842, { z: 0.12 }, G2);
      b.box(0.03, 0.22, 0.04, 2039842, { y: -0.13, z: 0.1 }, G2);
      b.box(0.02, 0.02, 0.26, 2039842, { z: -0.2 }, G2);
    } else if (wpn === "mg42") {
      b.box(0.07, 0.09, 0.72, 2237220, { z: 0.22 }, G2);
      b.box(0.06, 0.12, 0.22, 3812386, { z: -0.24, y: -0.02 }, G2);
      b.cyl(0.035, 0.035, 0.36, 6, 2960943, { z: 0.72, rx: Math.PI / 2 }, G2);
    } else if (wpn === "medic") {
      b.box(0.2, 0.16, 0.1, 14209208, { y: 0.05, z: 0.05 }, G2);
    }
    const geo = b.build();
    const m = new T.SkinnedMesh(geo, mat(enemy ? "enemy" : "char"));
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    m.add(hips);
    m.bind(new T.Skeleton(bones));
    const root = new T.Group();
    m.scale.setScalar(1.28);
    root.add(m);
    const rest = bones.map((bb) => bb.position.clone());
    return { root, mesh: m, bones, rest, B, weapon: wpn, kit: opts.kit || "para" };
  }
  function animate(a, st, dt) {
    const b = a.bones, Bi = a.B;
    st.phase = (st.phase || 0) + dt * (st.move > 0.01 ? lerp(6.5, 10.5, clamp(st.move, 0, 1)) * (st.crouch > 0.5 ? 0.75 : 1) : 0);
    const p = st.phase, mv = clamp(st.move, 0, 1), cr = st.crouch || 0, aim = st.aim || 0;
    const sw = Math.sin(p), cw = Math.cos(p);
    for (let i = 0; i < b.length; i++) {
      b[i].rotation.set(0, 0, 0);
      b[i].position.copy(a.rest[i]);
    }
    const hips = b[Bi.hips];
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
    b[Bi.gun].rotation.y = lerp(0.55, 0, k);
    b[Bi.gun].rotation.z = lerp(0.2, 0, k);
    if (aim > 0.5) {
      b[Bi.chest].rotation.y += 0.22;
      b[Bi.head].rotation.y = -0.18;
    }
    if (st.fire > 0) {
      b[Bi.chest].rotation.x -= st.fire * 0.12;
      b[Bi.shR].rotation.x += st.fire * 0.25;
      b[Bi.shL].rotation.x += st.fire * 0.2;
    }
    if (st.throw > 0) {
      const t = st.throw;
      const wind = t > 0.5 ? (1 - t) * 2 : t * 2;
      b[Bi.shL].rotation.x = -2.6 * wind + 0.6 * (1 - wind);
      b[Bi.elL].rotation.x = -0.6 * wind;
      b[Bi.chest].rotation.y = 0.5 * wind - 0.3;
    }
    if (st.stab > 0) {
      const t = st.stab;
      b[Bi.shR].rotation.x = -1.6 * Math.sin(t * Math.PI);
      b[Bi.elR].rotation.x = -0.2;
      b[Bi.chest].rotation.x += 0.2 * Math.sin(t * Math.PI);
    }
    if (st.heal > 0) {
      b[Bi.spine].rotation.x += 0.45 * st.heal;
      b[Bi.shL].rotation.x = -0.9;
      b[Bi.shR].rotation.x = -0.9;
      b[Bi.elL].rotation.x = -1.5;
      b[Bi.elR].rotation.x = -1.5;
      b[Bi.shL].rotation.z = -0.6;
      b[Bi.shR].rotation.z = 0.6;
    }
    if (st.prone > 0) {
      const pr = st.prone;
      hips.rotation.x = 1.35 * pr;
      b[Bi.thL].rotation.x *= 1 - pr;
      b[Bi.thR].rotation.x *= 1 - pr;
      b[Bi.knL].rotation.x *= 1 - pr;
      b[Bi.knR].rotation.x *= 1 - pr;
      b[Bi.head].rotation.x -= 1 * pr;
    }
    if (st.surr > 0) {
      b[Bi.shL].rotation.x = -2.9;
      b[Bi.shR].rotation.x = -2.9;
      b[Bi.shL].rotation.z = -0.25;
      b[Bi.shR].rotation.z = 0.25;
      b[Bi.elL].rotation.x = -0.4;
      b[Bi.elR].rotation.x = -0.4;
      b[Bi.head].rotation.x = 0.35;
      b[Bi.gun].scale.setScalar(1e-3);
    } else b[Bi.gun].scale.setScalar(1);
    if (st.dead > 0) {
      const d = st.dead;
      hips.position.y = lerp(hips.position.y, 0.16, d);
      hips.rotation.x = lerp(hips.rotation.x, -1.45 * (st.deadDir || 1), d);
      hips.rotation.z = lerp(0, 0.35 * (st.deadSide || 1), d);
      b[Bi.shL].rotation.x = lerp(b[Bi.shL].rotation.x, -2.3, d);
      b[Bi.shR].rotation.x = lerp(b[Bi.shR].rotation.x, -1, d);
      b[Bi.knL].rotation.x = lerp(b[Bi.knL].rotation.x, 0.6, d);
      b[Bi.head].rotation.y = 0.5 * d;
    }
  }
  var _v2 = new T.Vector3();
  function muzzle(a, out) {
    const g = a.bones[a.B.gun];
    g.updateWorldMatrix(true, false);
    _v2.set(0, 0.05, a.weapon === "thompson" ? 0.5 : a.weapon === "mp40" ? 0.4 : a.weapon === "mg42" ? 0.95 : 0.72);
    return (out || new T.Vector3()).copy(_v2).applyMatrix4(g.matrixWorld);
  }

  // src/game.js
  var WEAPONS = {
    knife: { melee: true },
    m1: { clip: 8, rate: 0.3, dmg: 60, range: 42, acc: 0.78, reload: 1.9, sound: "m1", tracer: [3.4, 2.1, 0.8] },
    k98: { clip: 5, rate: 1.5, dmg: 60, range: 45, acc: 0.6, reload: 2.6, sound: "k98", tracer: [3.2, 1.6, 0.6] },
    thompson: { clip: 20, rate: 0.1, dmg: 26, range: 22, acc: 0.42, reload: 2.4, sound: "thompson", tracer: [3.4, 2.1, 0.8] },
    mp40: { clip: 32, rate: 0.12, dmg: 22, range: 24, acc: 0.34, reload: 2.4, sound: "mp40", tracer: [3.2, 1.6, 0.6] },
    mg42: { clip: 50, rate: 0.055, dmg: 24, range: 55, acc: 0.2, reload: 4, sound: "mg", tracer: [3.6, 1.4, 0.45] }
  };
  var _v3 = new T.Vector3();
  var _v22 = new T.Vector3();
  var _dir = new T.Vector3();
  var SID = 0;
  var Soldier = class _Soldier {
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
      this.protect = o.protect || 0;
      this.down = false;
      this.aware = 0;
      this.target = null;
      this.seenT = 0;
      this.lastKnown = null;
      this.flashT = 0;
      this.hitFlash = 0;
      this.say = o.say || null;
      this.kills = 0;
      this.tag = o.tag || null;
      this.a.root.position.set(this.x, this.y, this.z);
      if (!_Soldier.blobGeo) {
        _Soldier.blobGeo = new T.CircleGeometry(0.55, 14).rotateX(-Math.PI / 2);
        _Soldier.blobMat = new T.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.38, depthWrite: false });
      }
      this.blob = new T.Mesh(_Soldier.blobGeo, _Soldier.blobMat);
      this.blob.renderOrder = 2;
      g.scene.add(this.blob);
    }
    get eye() {
      return this.y + (this.alive ? this.down ? 0.4 : this.crouch ? 1 : 1.55 : 0.3);
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
  };
  var Game = class {
    constructor({ scene: scene2, camera: camera2, world, fx, audio: audio2, ui: ui2, input: input2, renderer }) {
      Object.assign(this, { scene: scene2, camera: camera2, world, fx, audio: audio2, ui: ui2, input: input2, renderer });
      this.soldiers = [];
      this.t = 0;
      this.player = null;
      this.paused = false;
      this.slow = 1;
      this.gen = 0;
      this.waiters = [];
      this.grenades = [];
      this.cam = { x: 0, z: 0, tx: 0, tz: 0, yaw: Math.PI / 4, pitch: 0.74, span: 12.5, vel: 0, look: { x: 0, z: 0 }, focus: null };
      this.objective = null;
      this.night = false;
      this.lights = [];
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
      const inp = this.input;
      const ax = inp.axis();
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
        p.st.move = damp(p.st.move, sp / p.speed * (p.crouch ? 0.7 : 1), 12, dt);
        p.stepT = (p.stepT || 0) - dt * sp;
        if (p.stepT <= 0) {
          p.stepT = 1.6;
          this.audio.footstep(p.crouch ? 0.4 : 1);
          if (!p.crouch && ax.l > 0.6) this.noise(p.x, p.z, 7, p);
        }
        const last2 = this.trail[this.trail.length - 1];
        if (!last2 || Math.hypot(last2.x - p.x, last2.z - p.z) > 0.9) {
          this.trail.push({ x: p.x, z: p.z, c: p.crouch });
          if (this.trail.length > 90) this.trail.shift();
        }
      } else p.st.move = damp(p.st.move, 0, 12, dt);
      p.aimT = Math.max(0, (p.aimT || 0) - dt);
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
            this.ui.toast("Sin munici\xF3n");
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
        else if (p.hp >= p.maxHp && !p.bleeding) this.ui.toast("No est\xE1s herido");
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
      muzzle(s.a, _v3);
      _dir.set(Math.sin(s.ry), 0, Math.cos(s.ry));
      this.fx.muzzle(_v3, _dir, s.wkind === "mg42");
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
      let tx, ty, tz, hit = false;
      if (tgt && tgt.alive) {
        const d = this.dist(s, tgt);
        let p = w.acc * smooth(w.range * 1.1, w.range * 0.25, d);
        p *= tgt.crouch ? 0.7 : 1;
        p *= s.st.move > 0.3 ? 0.75 : 1;
        if (tgt.down) p *= 0.5;
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
        if (tgt.isPlayer && !hit && miss < 2.2) setTimeout(() => this.audio.whizz(1 - miss / 2.4), d / 70 * 1e3);
      } else {
        const d = 30;
        tx = s.x + Math.sin(s.ry) * d;
        tz = s.z + Math.cos(s.ry) * d;
        ty = s.eye - 0.2;
      }
      if (s.side === "de" || this.r() < (s.wkind === "mg42" ? 0.7 : 0.45) || s.isPlayer)
        this.fx.tracers.shoot(_v3.x, _v3.y, _v3.z, tx, ty, tz, w.tracer, s.isPlayer ? 90 : 75, s.wkind === "mg42" ? 2.4 : 1.6, { hit: hit ? tgt : null, src: s, dmg: w.dmg });
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
            this.ui.toast("Est\xE1s sangrando: v\xE9ndate");
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
        x: sx,
        y: sy,
        z: sz,
        vx: dx / tt,
        vz: dz / tt,
        vy: (ty - sy + 0.5 * 14 * tt * tt) / tt,
        fuse,
        owner: s,
        mesh: null
      };
      const m = new T.Mesh(new T.SphereGeometry(0.09, 6, 4), new T.MeshStandardMaterial({ color: s.side === "us" ? 4015152 : 3815990, roughness: 0.7 }));
      if (s.side === "de") {
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
      const [cx, cz] = this.world.collide(s.x + dx / d * st, s.z + dz / d * st, 0.33);
      if (Math.hypot(cx - s.x, cz - s.z) < st * 0.25) {
        s.stuckT = (s.stuckT || 0) + dt;
        s.stuckTotal = (s.stuckTotal || 0) + dt;
        if (s.stuckTotal > 3) {
          s.stuckTotal = 0;
          s.st.move = 0;
          return true;
        }
        if (s.stuckT > 0.7) {
          s.stuckT = 0;
          s.stuckSide = -(s.stuckSide || 1);
        }
        const side = s.stuckSide = s.stuckSide || (this.r() < 0.5 ? 1 : -1);
        const [ux, uz] = this.world.collide(s.x - dz / d * st * side, s.z + dx / d * st * side, 0.33);
        s.x = ux;
        s.z = uz;
      } else {
        s.x = cx;
        s.z = cz;
        s.stuckTotal = Math.max(0, (s.stuckTotal || 0) - dt * 0.5);
      }
      if (!(s.aimT > 0)) s.face(x, z, dt, 8);
      s.st.move = damp(s.st.move, speedK * (s.crouch ? 0.7 : 1), 10, dt);
      return false;
    }
    canSee(s, t) {
      const dx = t.x - s.x, dz = t.z - s.z;
      const d = Math.hypot(dx, dz);
      let range = this.night ? t.crouch ? 8 : 15 : t.crouch ? 30 : 46;
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
        for (const o of this.enemies()) if (o !== s && this.dist(o, s) < 18) {
          o.aware = Math.max(o.aware, 0.9);
          o.lastKnown = s.lastKnown;
        }
      }
      const mode = ai.mode;
      if (mode === "patrol" || mode === "guard") {
        if (s.aware > 0.35 && s.lastKnown) {
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
          if (ai.lookA !== void 0) s.ry += angDiff(s.ry, ai.lookA) * Math.min(1, dt * 2);
          if (ai.smoke) this.updateSmoker(s, dt);
          return;
        }
        const path = ai.path;
        const wp = path[ai.i || 0];
        if (ai.waitT > 0) {
          ai.waitT -= dt;
          s.st.move = damp(s.st.move, 0, 8, dt);
          if (ai.lookA !== void 0) s.ry += angDiff(s.ry, ai.lookA) * Math.min(1, dt * 2);
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
          if (s.grenades > 0 && this.dist(s, t) < 16 && this.dist(s, t) > 5 && this.r() < dt * 0.05) this.throwGrenade(s, { x: t.x, z: t.z });
        } else if (s.lastKnown && !ai.static) {
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
      if (this.r() < dt * 1.5) {
        _v22.set(s.x + Math.sin(s.ry) * 0.25, s.y + 1.5, s.z + Math.cos(s.ry) * 0.25);
        this.fx.glow.emit({ x: _v22.x, y: _v22.y, z: _v22.z, life: 0.5, s0: 0.12, s1: 0.06, c0: [3, 0.9, 0.2, 1], c1: [1.5, 0.3, 0, 0] });
      }
    }
    allyAI(s, dt) {
      const ai = s.ai;
      const p = this.player;
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
              if (s.reserve <= 0) s.reserve = 24;
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
      s.y = damp(s.y, this.world.height(s.x, s.z), 20, dt);
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
        const k = s.alive ? s.down || s.st.prone > 0.5 ? 1.5 : 1 : 1.7;
        s.blob.scale.set(k, 1, k * (s.alive ? 1 : 1.4));
        s.blob.rotation.y = s.ry;
      }
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
        const dx = tx - c.x, dz = tz - c.z;
        const d = Math.hypot(dx, dz);
        c.vel = Math.min(c.snap ? 999 : 14, c.vel + dt * 20);
        const step = Math.min(d, Math.max(d * (1 - Math.exp(-dt * 4)), 0), c.vel * dt);
        if (d > 1e-4) {
          c.x += dx / d * step;
          c.z += dz / d * step;
        }
        if (d < 0.05) c.vel = 0;
        c.snap = false;
      }
      const cam = this.camera;
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
      this.fx.setScale(this.renderer.h / (hh * 2));
    }
    project(x, y, z) {
      _v22.set(x, y, z).project(this.camera);
      return [(_v22.x * 0.5 + 0.5) * innerWidth, (-_v22.y * 0.5 + 0.5) * innerHeight, _v22.z];
    }
    // ---- HUD --------------------------------------------------------------------------------------
    updateHUD(dt) {
      const p = this.player, ui2 = this.ui;
      this.hurtV = Math.max(0, this.hurtV - dt * 1.2);
      const post = this.renderer.post;
      post.hurt.value = Math.max(this.hurtV * 0.8, p && p.alive ? clamp((40 - p.hp) / 40, 0, 1) * (0.35 + Math.sin(this.t * 6) * 0.1) : 0);
      post.flash.value = this.fx.flash;
      if (p) {
        ui2.setHealth(p.hp, p.bleeding, p.healT > 0);
        ui2.setWeapon(p.wkind, p.clip, p.reserve, p.reloadT > 0);
        ui2.setInv(p.grenades, p.bandages, !!this.onCall);
        if (this.objective && this.objective.x !== void 0) {
          const o = this.objective;
          const d = Math.hypot(o.x - p.x, o.z - p.z);
          const [sx, sy] = this.project(o.x, this.world.height(o.x, o.z), o.z);
          const [px, py] = this.project(p.x, p.y, p.z);
          const ang = Math.atan2(sy - py, sx - px);
          ui2.setObjective(o.text, d, ang);
          if (sx > 0 && sx < innerWidth && sy > 90 && sy < innerHeight - 150 && d > 3) ui2.mark("obj", sx, sy, '<i class="pin"></i>', "objm");
        } else ui2.setObjective(this.objective?.text || null);
        for (const e of this.soldiers) {
          if (e.side !== "de" || !e.alive || !e.ai || e.surrendered) continue;
          if (this.dist(e, p) > 30) continue;
          const [sx, sy] = this.project(e.x, e.y + 2.15, e.z);
          if (e.ai.mode === "alert" && this.night) ui2.mark("e" + e.id, sx, sy, "!", "alert");
          else if (e.aware > 0.15 && e.ai.mode !== "alert") ui2.mark("e" + e.id, sx, sy, `<b style="--k:${clamp(e.aware, 0, 1).toFixed(2)}">?</b>`, "sus");
        }
        const near = this.soldiers.filter((a) => a.side === "us" && a !== p && a.alive && this.dist(a, p) < 9).sort((a, b) => this.dist(a, p) - this.dist(b, p));
        const placed = [];
        near.forEach((a, i) => {
          if (i > 2 && !a.down) return;
          let [sx, sy] = this.project(a.x, a.y + 2.35, a.z);
          sx = Math.max(40, Math.min(innerWidth - 40, sx));
          for (let k = 0; k < 4; k++) {
            const hit = placed.find((q2) => Math.abs(q2[0] - sx) < 72 && Math.abs(q2[1] - sy) < 15);
            if (!hit) break;
            sy = hit[1] - 15;
          }
          placed.push([sx, sy]);
          ui2.mark("a" + a.id, sx, sy, a.down ? `${a.short} <em>herido</em>` : a.short, a.down ? "ally down" : "ally");
        });
        for (const g of this.grenades) {
          if (g.owner.side !== "de") continue;
          const [sx, sy] = this.project(g.x, g.y + 0.6, g.z);
          ui2.mark("g" + g.mesh.id, sx, sy, "\u2739", "nade");
        }
      }
      ui2.updateSubs(dt);
      ui2.sweepMarks();
    }
  };

  // src/world.js
  var World = class {
    constructor(size = 140, opts = {}) {
      this.size = size;
      this.half = size / 2;
      this.segs = [];
      this.rects = [];
      this.carves = [];
      this.raises = [];
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
          const q2 = segDist(x, z, s.ax, s.az, s.bx, s.bz);
          const m = s.r + rad;
          if (q2.d < m) {
            const nx = q2.d > 1e-5 ? (x - q2.cx) / q2.d : 1, nz = q2.d > 1e-5 ? (z - q2.cz) / q2.d : 0;
            x = q2.cx + nx * m;
            z = q2.cz + nz * m;
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
          [-r.hw, -r.hd],
          [r.hw, -r.hd],
          [r.hw, r.hd],
          [-r.hw, r.hd]
        ].map(([lx, lz]) => [r.x + lx * r.cos - lz * r.sin, r.z + lx * r.sin + lz * r.cos]);
        for (let k = 0; k < 4; k++) {
          const p = c[k], q2 = c[(k + 1) % 4];
          if (segHit(ax, az, bx, bz, p[0], p[1], q2[0], q2[1])) {
            const t = this._tOn(ax, az, bx, bz, p[0], p[1], q2[0], q2[1]);
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
  };
  function buildGround(world, colorFn, step = 1) {
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
  function scatter(world, builderFn, count, placeFn, kind = "foliage", seed = 3, cast = false) {
    const b = new Builder(seed);
    builderFn(b);
    const geo = b.build();
    if (kind === "foliage") {
      const n = geo.attributes.normal;
      for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
    }
    const im = new T.InstancedMesh(geo, mat(kind), count);
    const r = rng(seed);
    const m4 = new T.Matrix4(), q2 = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), sc = new T.Vector3();
    const col = new T.Color();
    let k = 0;
    for (let tries = 0; tries < count * 6 && k < count; tries++) {
      const x = (r() - 0.5) * world.size * 0.96, z = (r() - 0.5) * world.size * 0.96;
      const res = placeFn(x, z, r, col);
      if (!res) continue;
      const y = world.height(x, z);
      e.set(res.tilt ? (r() - 0.5) * res.tilt : 0, r() * Math.PI * 2, res.tilt ? (r() - 0.5) * res.tilt : 0);
      q2.setFromEuler(e);
      const s0 = res.scale || 1;
      sc.set(s0 * (res.sx || 1), s0 * (res.sy || 1), s0 * (res.sx || 1));
      v.set(x, y - (res.sink || 0), z);
      m4.compose(v, q2, sc);
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

  // src/props.js
  var GREENS = [4151852, 4612655, 3493415, 5138995, 3098660, 5599800];
  var DARKGREEN = [2900001, 3361066, 2636319];
  var NIGHT_G = [3099194, 3494463, 2769461, 3889732, 2506799, 4218954];
  var NIGHT_D = [2242089, 2637360, 2044454];
  function setFoliage(day) {
    const g = day ? [5661519, 6187861, 5200968, 6779740, 4871748, 7174239] : NIGHT_G;
    const d = day ? [4345404, 4740418, 4082232] : NIGHT_D;
    GREENS.splice(0, GREENS.length, ...g);
    DARKGREEN.splice(0, DARKGREEN.length, ...d);
  }
  function hedge(world, B2, F2, pts, o = {}) {
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
        for (let row = -1; row <= 1; row++) {
          if (row !== 0 && r() < 0.08) continue;
          const off = row * 0.62 + (r() - 0.5) * 0.35;
          const px = x + nx * off + (r() - 0.5) * 0.3, pz = z + nz * off + (r() - 0.5) * 0.3;
          const s = 0.5 + r() * 0.42;
          const y = world.rawHeight(px, pz);
          const top = row === 0 ? 0.9 + r() * 0.7 : 0.25 + r() * 0.5;
          const col = r() < 0.18 ? r.pick(DARKGREEN) : r.pick(GREENS);
          F2.ico(s, col, { x: px, y: y + 0.45 + s * 0.6 + top, z: pz, sy: 0.82 + r() * 0.35, rx: r() * 3, ry: r() * 3 }, { jit: 0.16, grad: { y0: y, y1: y + 2.8, k: 0.32 } });
          if (r() < 0.5) {
            const a = r() * 6.28;
            F2.cone(0.16, 0.5 + r() * 0.4, 4, r.pick(GREENS), { x: px + Math.cos(a) * s * 0.8, y: y + 0.5 + top + s * 0.9, z: pz + Math.sin(a) * s * 0.8, rx: Math.sin(a) * 0.7, rz: -Math.cos(a) * 0.7 }, { jit: 0.2 });
          }
        }
        for (const side of [-1, 1]) {
          if (r() < 0.35) continue;
          const d = 1.15 + r() * 0.5;
          const px = x + nx * side * d, pz = z + nz * side * d;
          const y = world.rawHeight(px, pz);
          if (r() < 0.55) F2.ico(0.28 + r() * 0.22, r.pick([4874802, 5991736, 3953192, 6453818]), { x: px, y: y + 0.18, z: pz, sy: 0.65, ry: r() * 3 }, { jit: 0.18 });
          else {
            for (let k2 = 0; k2 < 3; k2++) F2.box(0.012, 0.7, 0.012, 6123576, { x: px + (r() - 0.5) * 0.4, y: y + 0.35, z: pz + (r() - 0.5) * 0.4 });
            for (let k2 = 0; k2 < 3; k2++) F2.ico(0.11, 15262672, { x: px + (r() - 0.5) * 0.45, y: y + 0.72 + r() * 0.08, z: pz + (r() - 0.5) * 0.45, sy: 0.45 }, { jit: 0.08 });
          }
        }
        if (o.trees !== false && r() < (o.treeK ?? 0.05)) tree(world, B2, F2, x + nx * 0.2, z + nz * 0.2, 0.9 + r() * 0.6, r);
      }
    }
  }
  function tree(world, B2, F2, x, z, s = 1, r = rng(Math.floor(x * 31 + z * 17))) {
    const y = world.rawHeight(x, z);
    const h = (4.5 + r() * 2.5) * s;
    B2.cyl(0.18 * s, 0.32 * s, h * 0.7, 6, 4865328, { x, y: y + h * 0.35, z, rz: (r() - 0.5) * 0.1 }, { jit: 0.1 });
    B2.cyl(0.08 * s, 0.12 * s, 1.6 * s, 5, 4865328, { x: x + 0.5 * s, y: y + h * 0.62, z, rz: -0.8 }, { jit: 0.1 });
    const crowns = 8 + Math.floor(r() * 4);
    const tone = 0.88 + r() * 0.24, warm = r() < 0.3;
    for (let i = 0; i < crowns; i++) {
      const a = r() * 6.28, d = (0.4 + r() * 1.3) * s;
      const hy = h * (0.66 + r() * 0.36);
      const c = new T.Color(r.pick(GREENS)).multiplyScalar(tone);
      if (warm) c.offsetHSL(0.02, 0, 0);
      F2.ico((0.85 + r() * 0.6) * s, c.getHex(), { x: x + Math.cos(a) * d, y: y + hy, z: z + Math.sin(a) * d, sy: 0.78, rx: r() * 3, ry: r() * 3 }, { jit: 0.14, grad: { y0: y + h * 0.45, y1: y + h * 1.15, k: 0.38 } });
    }
    world.addSeg(x - 0.01, z, x + 0.01, z, 0.35 * s, 1.5, "trunk");
  }
  function appleTree(world, B2, F2, x, z, s = 1, r = rng(Math.floor(x * 11 + z * 29))) {
    const y = world.rawHeight(x, z);
    const lean = (r() - 0.5) * 0.35;
    B2.cyl(0.13 * s, 0.2 * s, 1.5 * s, 6, 5917242, { x, y: y + 0.75 * s, z, rz: lean }, { jit: 0.1 });
    for (let i = 0; i < 3; i++) {
      const a = r() * 6.28;
      B2.cyl(0.05 * s, 0.09 * s, 1.3 * s, 5, 5917242, { x: x + Math.cos(a) * 0.4 * s, y: y + 1.8 * s, z: z + Math.sin(a) * 0.4 * s, rx: Math.sin(a) * 0.7, rz: -Math.cos(a) * 0.7 }, { jit: 0.1 });
    }
    for (let i = 0; i < 5; i++) {
      const a = r() * 6.28, d = r() * 1.1 * s;
      F2.ico((0.85 + r() * 0.5) * s, r.pick([5204528, 5928246, 4612396]), { x: x + Math.cos(a) * d, y: y + (2.2 + r() * 0.6) * s, z: z + Math.sin(a) * d, sy: 0.75, ry: r() * 3 }, { jit: 0.12 });
    }
    for (let i = 0; i < 6; i++) {
      const a = r() * 6.28, d = 0.6 + r() * 0.8;
      B2.ico(0.07, 10135114, { x: x + Math.cos(a) * d * s, y: y + (1.7 + r() * 0.5) * s, z: z + Math.sin(a) * d * s }, { jit: 0.1 });
    }
    world.addSeg(x - 0.01, z, x + 0.01, z, 0.22 * s, 1.4, "trunk");
  }
  function fence(world, B2, pts, o = {}) {
    const r = rng(7);
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, az] = pts[k], [bx, bz] = pts[k + 1];
      const L = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.round(L / 2.4));
      const ang = Math.atan2(bx - ax, bz - az);
      for (let i = 0; i <= n; i++) {
        const x = lerp(ax, bx, i / n), z = lerp(az, bz, i / n);
        const y = world.rawHeight(x, z);
        B2.post(0.09, 1.25, 0.09, 7035462, { x, y: y - 0.05, z, rz: (r() - 0.5) * 0.12 }, { jit: 0.15 });
        if (i < n) {
          const mx = lerp(ax, bx, (i + 0.5) / n), mz = lerp(az, bz, (i + 0.5) / n);
          const my = world.rawHeight(mx, mz);
          for (const hh of o.rails ? [0.5, 0.95] : [0.55, 0.95]) B2.box(0.03, o.rails ? 0.08 : 0.015, L / n, o.rails ? 8021584 : 3815992, { x: mx, y: my + hh, z: mz, ry: ang }, { jit: 0.1 });
        }
      }
    }
  }
  function gate(world, B2, x, z, ang) {
    const y = world.rawHeight(x, z);
    B2.post(0.18, 1.5, 0.18, 6048828, { x: x - Math.cos(ang) * 1.7, y, z: z + Math.sin(ang) * 1.7 });
    const a2 = ang + 0.9;
    const hx = x + Math.cos(ang) * 1.7, hz = z - Math.sin(ang) * 1.7;
    B2.post(0.18, 1.5, 0.18, 6048828, { x: hx, y, z: hz });
    for (let i = 0; i < 4; i++) B2.box(2.6, 0.09, 0.06, 9075298, { x: hx - Math.cos(a2) * 1.3, y: y + 0.35 + i * 0.27, z: hz + Math.sin(a2) * 1.3, ry: a2 }, { jit: 0.1 });
    B2.box(2.8, 0.09, 0.06, 9075298, { x: hx - Math.cos(a2) * 1.3, y: y + 0.75, z: hz + Math.sin(a2) * 1.3, ry: a2, rz: 0.34 }, { jit: 0.1 });
  }
  function roof(B2, x, y, z, ang, w, d, rh, color) {
    const half = d / 2;
    const slope = Math.atan2(rh, half);
    const len = Math.hypot(rh, half) + 0.25;
    for (const s of [-1, 1]) {
      const lz = s * half / 2;
      B2.box(w + 0.5, 0.18, len, color, {
        x: x + lz * Math.sin(ang),
        y: y + rh / 2,
        z: z + lz * Math.cos(ang),
        ry: ang,
        rx: s * slope,
        order: "YXZ"
      }, { jit: 0.07 });
    }
  }
  function stoneHouse(world, B2, x, z, ang, w = 8, d = 6, o = {}) {
    const y = world.rawHeight(x, z) - 0.25;
    const r = rng(Math.floor(x * 7 + z * 3));
    const H = o.h || 4;
    const stone = o.stone || 9997690;
    const tf = (lx, ly, lz) => ({ x: x + lx * Math.cos(ang) + lz * Math.sin(ang), y: y + ly, z: z - lx * Math.sin(ang) + lz * Math.cos(ang), ry: ang });
    B2.box(w, H, d, stone, tf(0, H / 2, 0), { jit: 0.07, grad: { y0: y, y1: y + H, k: 0.3 } });
    for (let i = 0; i < 16; i++) {
      const face = r() < 0.5 ? 1 : -1;
      B2.box(0.5 + r() * 0.9, 0.25, 0.06, r() < 0.5 ? 8287330 : 11576722, tf((r() - 0.5) * (w - 1), 0.3 + r() * (H - 0.6), face * d / 2 + face * 0.02), { jit: 0.1 });
    }
    const rh = o.rh || 3;
    for (const s of [-1, 1]) for (let k = 0; k < 5; k++) B2.box(0.25, rh / 5, d * (1 - (k + 0.5) / 5), stone, tf(s * (w - 0.25) / 2, H + rh / 5 * (k + 0.5), 0), { jit: 0.06 });
    roof(B2, x, y + H - 0.05, z, ang, w, d, rh, o.roof || 3948358);
    if (o.chimney !== false) B2.box(0.75, 2, 0.75, 9076588, tf(w / 2 - 1.1, H + rh - 0.3, 0.7), { jit: 0.08 });
    for (const lx of o.windows || [-w / 3, w / 3]) {
      for (const s of [-1, 1]) {
        B2.box(0.95, 1.05, 0.08, o.lit ? 9067050 : 1513500, tf(lx, H * 0.56, s * d / 2 + s * 0.03));
        B2.box(0.42, 1.1, 0.06, o.shutter || 5202512, tf(lx - 0.7, H * 0.56, s * d / 2 + s * 0.05));
        B2.box(0.42, 1.1, 0.06, o.shutter || 5202512, tf(lx + 0.7, H * 0.56, s * d / 2 + s * 0.05));
      }
    }
    B2.box(1.1, 2.1, 0.12, 4864556, tf(o.doorX ?? 0, 1.05, d / 2 + 0.04));
    world.addRect(x, z, w / 2 + 0.15, d / 2 + 0.15, -ang, H + rh * 0.7, "house");
  }
  function barn(world, B2, x, z, ang, w = 10, d = 7) {
    const y = world.rawHeight(x, z) - 0.2;
    const tf = (lx, ly, lz) => ({ x: x + lx * Math.cos(ang) + lz * Math.sin(ang), y: y + ly, z: z - lx * Math.sin(ang) + lz * Math.cos(ang), ry: ang });
    B2.box(w, 3.2, d, 10785396, tf(0, 1.6, 0), { jit: 0.08, grad: { y0: y, y1: y + 3.2, k: 0.3 } });
    for (let i = 0; i <= 5; i++) {
      const lx = -w / 2 + w / 5 * i;
      for (const s of [-1, 1]) B2.box(0.16, 3.2, 0.06, 4930090, tf(lx, 1.6, s * d / 2 + s * 0.03));
    }
    for (const s of [-1, 1]) B2.box(w, 0.14, 0.06, 4930090, tf(0, 1.7, s * d / 2 + s * 0.035));
    for (const s of [-1, 1]) for (let k = 0; k < 5; k++) B2.box(0.2, 0.7, d * (1 - (k + 0.5) / 5), 10785396, tf(s * (w - 0.2) / 2, 3.2 + 0.7 * (k + 0.5), 0));
    roof(B2, x, y + 3.15, z, ang, w, d, 3.5, 5982774);
    B2.box(2.6, 2.6, 0.12, 3878434, tf(0, 1.3, d / 2 + 0.05));
    world.addRect(x, z, w / 2 + 0.1, d / 2 + 0.1, -ang, 5, "house");
  }
  function church(world, B2, x, z, ang) {
    const y = world.rawHeight(x, z) - 0.3;
    const tf = (lx, ly, lz) => ({ x: x + lx * Math.cos(ang) + lz * Math.sin(ang), y: y + ly, z: z - lx * Math.sin(ang) + lz * Math.cos(ang), ry: ang });
    B2.box(18, 8, 9, 9405812, tf(0, 4, 0), { jit: 0.06 });
    roof(B2, x, y + 7.9, z, ang, 18, 9, 4.5, 3816514);
    B2.box(5, 16, 5, 9603192, tf(-10, 8, 0), { jit: 0.06 });
    B2.cone(3.9, 9, 4, 3816514, { ...tf(-10, 20.5, 0), ry: ang + Math.PI / 4 });
    for (const s of [-1, 1]) B2.box(0.9, 2.6, 0.1, 1316122, tf(-10 + s * 0, 12.5, s * 2.53));
    world.addRect(x, z, 11, 5, -ang, 12, "house");
  }
  function sandbags(world, B2, pts, rows = 2) {
    const r = rng(Math.floor(pts[0][0] * 9));
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, az] = pts[k], [bx, bz] = pts[k + 1];
      const L = Math.hypot(bx - ax, bz - az);
      const ang = Math.atan2(bx - ax, bz - az);
      const n = Math.max(1, Math.round(L / 0.55));
      for (let row = 0; row < rows; row++)
        for (let i = 0; i < n; i++) {
          const t = (i + row % 2 * 0.5) / n;
          if (t > 1) continue;
          const x = lerp(ax, bx, t), z = lerp(az, bz, t);
          B2.box(0.32, 0.2, 0.56, r.pick([9207132, 8220498, 9865060]), { x, y: world.rawHeight(x, z) + 0.1 + row * 0.19, z, ry: ang + (r() - 0.5) * 0.15, rz: (r() - 0.5) * 0.1 }, { jit: 0.1 });
        }
    }
  }
  function gun105(B2, x, y, z, ang, o = {}) {
    const tf = (lx, ly, lz, extra = {}) => ({ x: x + lx * Math.cos(ang) + lz * Math.sin(ang), y: y + ly, z: z - lx * Math.sin(ang) + lz * Math.cos(ang), ry: ang, ...extra });
    const c = o.wrecked ? 2828839 : 6975584;
    for (const s of [-1, 1]) {
      B2.cyl(0.62, 0.62, 0.16, 12, 3026730, tf(s * 0.95, 0.62, 0, { rz: Math.PI / 2 }), { jit: 0.05 });
      B2.cyl(0.18, 0.18, 0.2, 8, 4868928, tf(s * 0.95, 0.62, 0, { rz: Math.PI / 2 }));
      B2.box(0.16, 0.16, 3.4, c, tf(s * 0.45, 0.32, -1.8, { ry: ang + s * 0.22 }), { jit: 0.06 });
      B2.box(0.4, 0.12, 0.3, c, tf(s * 0.82, 0.15, -3.4));
    }
    B2.box(1.9, 0.12, 0.22, c, tf(0, 0.62, 0));
    B2.box(2, 1.1, 0.07, c, tf(0, 1.15, 0.25, { rx: -0.12 }), { jit: 0.05 });
    B2.box(0.55, 0.45, 1.5, c, tf(0, 1, 0.2));
    if (!o.wrecked) {
      B2.cyl(0.11, 0.13, 3.1, 8, 4934978, tf(0, 1.2, 1.7, { rx: Math.PI / 2 - (o.elev || 0.18) }));
      B2.cyl(0.15, 0.15, 0.35, 8, 4013878, tf(0, 1.48, 3.15, { rx: Math.PI / 2 - (o.elev || 0.18) }));
    } else {
      for (let i = 0; i < 4; i++) B2.box(0.08, 0.06, 1.1, 2302495, tf(Math.cos(i * 1.57) * 0.18, 1.25 + Math.sin(i * 1.57) * 0.18, 1.1, { rx: Math.PI / 2 - 0.2 + Math.sin(i * 1.57) * 0.5, rz: Math.cos(i * 1.57) * 0.5 }));
    }
    for (let i = 0; i < 6; i++) B2.cyl(0.055, 0.06, 0.45, 6, i % 2 ? 11569722 : 7170650, tf(-1.6 + i * 0.12, 0.05, -0.8 - i % 3 * 0.2, { rz: Math.PI / 2, ry: ang + i }));
    B2.box(0.9, 0.35, 0.5, 5920320, tf(1.6, 0.17, -1.2));
  }
  function camoNet(F2, x, y, z, ang, w = 7, d = 7) {
    const r = rng(Math.floor(x * 13));
    for (let i = 0; i < 16; i++) {
      const lx = (r() - 0.5) * w, lz = (r() - 0.5) * d;
      const sag = 1 - (Math.abs(lx) / w + Math.abs(lz) / d);
      F2.box(0.9 + r() * 0.7, 0.05, 0.9 + r() * 0.7, r.pick([5003826, 5922872, 4147754, 7038016]), { x: x + lx * Math.cos(ang) + lz * Math.sin(ang), y: y + 2.3 + sag * 0.9, z: z - lx * Math.sin(ang) + lz * Math.cos(ang), ry: r() * 3, rx: (r() - 0.5) * 0.3 }, { jit: 0.15 });
    }
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) F2.cyl(0.04, 0.05, 2.6, 4, 5917242, { x: x + sx * w * 0.45 * Math.cos(ang) + sz * d * 0.45 * Math.sin(ang), y: y + 1.3, z: z - sx * w * 0.45 * Math.sin(ang) + sz * d * 0.45 * Math.cos(ang) });
  }
  function trench(world, B2, pts, w = 0.9, d = 1.5) {
    for (let k = 0; k < pts.length - 1; k++) world.carves.push({ ax: pts[k][0], az: pts[k][1], bx: pts[k + 1][0], bz: pts[k + 1][1], w, d });
    return () => {
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
            B2.box(0.06, d * 0.9, 1.05, r.pick([6179896, 7034432, 5391153]), { x: px, y: top - d * 0.45, z: pz, ry: ang }, { jit: 0.12 });
            if (r() < 0.7) B2.box(0.34, 0.2, 0.56, r.pick([9207132, 8220498]), { x: x + nx * s * (w + 0.35), y: top + 0.08, z: z + nz * s * (w + 0.35), ry: ang + (r() - 0.5) * 0.2 }, { jit: 0.1 });
          }
          if (r() < 0.12) B2.box(0.5, 0.3, 0.35, 5920320, { x, y: world.rawHeight(x, z) + 0.15, z, ry: r() * 3 });
        }
      }
    };
  }
  function canopy(B2, x, y, z, o = {}) {
    const r = rng(Math.floor(x * 19 + z * 7));
    const col = o.color || 13223608;
    const dark = new T.Color(col).multiplyScalar(0.72).getHex();
    if (o.hang) {
      B2.sphere(1.9, 10, 4, col, { x, y, z, sy: 0.32, rx: (r() - 0.5) * 0.5, rz: (r() - 0.5) * 0.5 }, { jit: 0.1 });
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * 6.28 + r() * 0.4;
        B2.box(0.7, 1.4 + r() * 0.8, 0.05, i % 2 ? col : dark, { x: x + Math.cos(a) * 1.6, y: y - 0.7, z: z + Math.sin(a) * 1.6, ry: -a + Math.PI / 2, rx: 0.15 }, { jit: 0.1 });
      }
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * 6.28;
        B2.box(0.012, 2.8, 0.012, 11051668, { x: x + Math.cos(a) * 0.9, y: y - 1.6, z: z + Math.sin(a) * 0.9, rx: Math.sin(a) * 0.32, rz: -Math.cos(a) * 0.32 });
      }
      return;
    }
    const ang = o.ang || 0;
    const cx = x + Math.sin(ang) * 2.2, cz = z + Math.cos(ang) * 2.2;
    B2.sphere(1.8, 12, 4, col, { x: cx, y: y + 0.02, z: cz, sx: 1.25, sy: 0.16, sz: 1, ry: ang }, { jit: 0.12 });
    for (let i = 0; i < 10; i++) {
      const a = ang + i / 10 * 6.28;
      const L = 1.5 + r() * 0.6;
      B2.box(0.32, 0.1 + r() * 0.12, L, i % 2 ? col : dark, { x: cx + Math.sin(a) * L * 0.5, y: y + 0.14 + r() * 0.06, z: cz + Math.cos(a) * L * 0.5, ry: a, rz: (r() - 0.5) * 0.3 }, { jit: 0.08 });
    }
    for (let i = 0; i < 8; i++) {
      const a = ang + Math.PI + (i / 8 - 0.5) * 1.6;
      const ex = cx + Math.sin(a) * 1.6, ez = cz + Math.cos(a) * 1.6;
      const mx = (ex + x) / 2, mz = (ez + z) / 2;
      const L = Math.hypot(ex - x, ez - z);
      B2.box(0.012, 0.012, L, 11051668, { x: mx, y: y + 0.05, z: mz, ry: Math.atan2(ex - x, ez - z) });
    }
  }
  function legBag(B2, x, y, z, ang = 0) {
    B2.box(0.32, 0.3, 0.95, 6972488, { x, y: y + 0.15, z, ry: ang, rz: 0.1 }, { jit: 0.08 });
    B2.box(0.34, 0.06, 0.2, 9407078, { x, y: y + 0.31, z, ry: ang }, { jit: 0.05 });
  }
  function bundle(B2, x, y, z, color = 9064512) {
    B2.cyl(0.32, 0.32, 1.7, 8, 6250056, { x, y: y + 0.32, z, rz: Math.PI / 2 }, { jit: 0.06 });
    canopy(B2, x + 1.2, y, z + 0.8, { color, ang: 1.2 });
  }
  function c47(B2, o = {}) {
    const c = 2895659;
    B2.cyl(1.05, 0.7, 13, 8, c, { z: 0, rx: Math.PI / 2 });
    B2.sphere(1.05, 8, 5, c, { z: 6.6, sz: 1.5 });
    B2.cyl(0.7, 0.2, 4, 8, c, { z: -8.2, rx: Math.PI / 2 });
    B2.box(29, 0.28, 3.4, c, { y: -0.2, z: 1.5 });
    B2.box(9, 0.18, 2, c, { y: 0.3, z: -9.2 });
    B2.box(0.2, 3, 2.4, c, { y: 1.6, z: -9.3 });
    for (const s of [-1, 1]) {
      B2.cyl(0.6, 0.6, 2.6, 8, c, { x: s * 5.2, y: -0.2, z: 3, rx: Math.PI / 2 });
      B2.box(0.12, 0.12, 0.12, o.lit ? 16736304 : c, { x: s * 5.2, y: -0.2, z: 1.6 });
    }
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) B2.box(1.1, 0.3, 3.45, 9079428, { x: s * (7 + i * 2.2), y: -0.2, z: 1.5 });
  }
  function c47Wreck(world, B2, x, z, ang) {
    const y = world.rawHeight(x, z);
    const tf = (lx, ly, lz, ex = {}) => ({ x: x + lx * Math.cos(ang) + lz * Math.sin(ang), y: y + ly, z: z - lx * Math.sin(ang) + lz * Math.cos(ang), ry: ang, ...ex });
    const c = 2763559;
    B2.cyl(1.05, 0.95, 7, 8, c, tf(0, 0.9, 0, { rx: Math.PI / 2, rz: 0.15 }), { jit: 0.1 });
    B2.cyl(0.85, 0.3, 4.5, 8, 1908251, tf(0.8, 0.7, -6.2, { rx: Math.PI / 2 - 0.12, rz: 0.4 }), { jit: 0.1 });
    B2.box(10, 0.25, 3, c, tf(5.5, 0.35, 0.8, { rz: -0.1 }), { jit: 0.1 });
    B2.box(4, 0.25, 2.6, 1710872, tf(-4.5, 0.25, 0.8, { rz: 0.3 }), { jit: 0.1 });
    B2.box(0.2, 2.6, 2.1, c, tf(1.2, 1.5, -8, { rz: 0.5 }));
    for (let i = 0; i < 10; i++) B2.box(0.3 + Math.random() * 0.8, 0.05, 0.3 + Math.random() * 0.6, 1908251, tf((Math.random() - 0.5) * 12, 0.05, (Math.random() - 0.5) * 12, { ry: Math.random() * 3 }));
    world.addRect(x, z, 2, 6, -ang, 2, "wreck");
  }
  function cow(world, B2, x, z, ang, o = {}) {
    const y = world.rawHeight(x, z);
    const r = rng(Math.floor(x * 41 + z * 23));
    const tf = (lx, ly, lz, ex = {}) => ({ x: x + lx * Math.cos(ang) + lz * Math.sin(ang), y: y + ly, z: z - lx * Math.sin(ang) + lz * Math.cos(ang), ry: ang, ...ex });
    const cream = 14208955, brown = 7030320;
    if (o.dead) {
      B2.box(0.95, 0.85, 2, cream, tf(0, 0.45, 0, { rz: Math.PI / 2 - 0.1 }), { jit: 0.05 });
      B2.box(0.5, 0.88, 0.8, brown, tf(0, 0.47, 0.3, { rz: Math.PI / 2 - 0.1 }));
      B2.box(0.45, 0.5, 0.65, cream, tf(0.2, 0.3, 1.25, { rz: 1.4 }));
      for (const lz of [-0.7, 0.6]) for (const s of [0, 0.3]) B2.box(0.14, 0.75, 0.14, cream, tf(0.65 + s, 0.75, lz, { rz: Math.PI / 2 - 0.5 }));
      return;
    }
    B2.box(1, 0.8, 2, cream, tf(0, 0.55, 0), { jit: 0.05 });
    B2.box(1.02, 0.6, 0.7, brown, tf(0, 0.62, -0.3 + r() * 0.5));
    B2.box(0.5, 0.55, 0.7, cream, tf(0, 0.85, 1.3, { rx: 0.4 }));
    B2.box(0.52, 0.2, 0.25, brown, tf(0, 0.95, 1.45, { rx: 0.4 }));
    B2.box(0.6, 0.06, 0.06, 13616814, tf(0, 1.12, 1.2));
    for (const lx of [-0.35, 0.35]) for (const lz of [-0.7, 0.7]) B2.box(0.16, 0.25, 0.4, cream, tf(lx, 0.12, lz));
    world.addRect(x, z, 0.6, 1.2, -ang, 1.1, "cow");
  }
  function hangingPara(B2, x, y, z) {
    canopy(B2, x, y + 2.4, z, { hang: true });
    B2.box(0.4, 0.6, 0.25, 6972487, { x, y: y - 0.6, z });
    B2.box(0.32, 0.6, 0.22, 6183490, { x, y: y - 1.15, z, rz: 0.06 });
    B2.sphere(0.17, 6, 4, 5067062, { x, y: y - 0.15, z, rx: 0.4 });
  }
  function cart(world, B2, x, z, ang) {
    const y = world.rawHeight(x, z);
    const tf = (lx, ly, lz, ex = {}) => ({ x: x + lx * Math.cos(ang) + lz * Math.sin(ang), y: y + ly, z: z - lx * Math.sin(ang) + lz * Math.cos(ang), ry: ang, ...ex });
    B2.box(1.6, 0.12, 2.6, 7232066, tf(0, 0.8, 0), { jit: 0.1 });
    for (const s of [-1, 1]) B2.box(0.08, 0.5, 2.6, 6179382, tf(s * 0.78, 1.05, 0));
    for (const s of [-1, 1]) B2.cyl(0.6, 0.6, 0.1, 10, 4930090, tf(s * 0.9, 0.6, 0.2, { rz: Math.PI / 2 }));
    B2.box(0.1, 0.1, 2.4, 6179382, tf(0.25, 0.45, 2.1, { rx: 0.3 }));
    B2.box(0.1, 0.1, 2.4, 6179382, tf(-0.25, 0.45, 2.1, { rx: 0.3 }));
    world.addRect(x, z, 0.9, 1.4, -ang, 1.2, "cart");
  }
  function pole(world, B2, x, z, h = 6) {
    const y = world.rawHeight(x, z);
    B2.cyl(0.1, 0.13, h, 5, 4865328, { x, y: y + h / 2, z, rz: 0.03 });
    B2.box(1.2, 0.1, 0.1, 4865328, { x, y: y + h - 0.4, z });
  }
  function well(world, B2, x, z) {
    const y = world.rawHeight(x, z);
    B2.cyl(0.8, 0.85, 0.9, 10, 9405812, { x, y: y + 0.45, z }, { jit: 0.1 });
    B2.cyl(0.6, 0.6, 0.92, 10, 1381914, { x, y: y + 0.47, z });
    for (const s of [-1, 1]) B2.post(0.12, 1.8, 0.12, 4930090, { x: x + s * 0.7, y, z });
    B2.box(1.6, 0.1, 0.1, 4930090, { x, y: y + 1.75, z });
    world.addRect(x, z, 0.85, 0.85, 0, 1, "well");
  }
  function clutter(world, B2, F2, n, ok, o = {}) {
    const r = rng(o.seed || 77);
    const war = o.war ?? 0.25;
    for (let i = 0, tries = 0; i < n && tries < n * 8; tries++) {
      const x = (r() - 0.5) * world.size * 0.92, z = (r() - 0.5) * world.size * 0.92;
      if (!ok(x, z)) continue;
      let blocked = false;
      for (const s of world.segs) if (s.kind === "hedge" && segD(x, z, s) < s.r + 0.8) {
        blocked = true;
        break;
      }
      if (blocked) continue;
      i++;
      const y = world.rawHeight(x, z);
      const k = r();
      if (k < 0.28) {
        const s = 0.45 + r() * 0.5;
        for (let j = 0; j < 3 + Math.floor(r() * 3); j++) F2.ico(s * (0.6 + r() * 0.5), r.pick(GREENS), { x: x + (r() - 0.5) * s * 1.6, y: y + s * 0.45, z: z + (r() - 0.5) * s * 1.6, sy: 0.75, ry: r() * 3 }, { jit: 0.16, grad: { y0: y, y1: y + 1.2, k: 0.35 } });
        if (s > 0.7) world.addSeg(x - 0.01, z, x + 0.01, z, s * 0.7, 1, "bush");
      } else if (k < 0.42) {
        for (let j = 0; j < 9; j++) {
          const px = x + (r() - 0.5) * 1.4, pz = z + (r() - 0.5) * 1.4;
          F2.cone(0.09, 0.7 + r() * 0.5, 3, r.pick([8163144, 7241792, 9345618]), { x: px, y: world.rawHeight(px, pz) + 0.35, z: pz, rx: (r() - 0.5) * 0.4, rz: (r() - 0.5) * 0.4 }, { jit: 0.2 });
        }
      } else if (k < 0.52) {
        for (let j = 0; j < 1 + Math.floor(r() * 3); j++) B2.ico(0.18 + r() * 0.3, r.pick([8025965, 9078392, 6973279]), { x: x + (r() - 0.5), y: y + 0.05, z: z + (r() - 0.5), sy: 0.55, ry: r() * 3 }, { jit: 0.2 });
      } else if (k < 0.6) {
        const a = r() * 3.14;
        B2.cyl(0.07 + r() * 0.06, 0.1 + r() * 0.06, 1.4 + r() * 1.6, 5, 5917242, { x, y: y + 0.1, z, rz: Math.PI / 2, ry: a }, { jit: 0.12 });
        if (r() < 0.5) B2.cyl(0.03, 0.04, 0.7, 4, 5917242, { x: x + Math.cos(a) * 0.3, y: y + 0.25, z: z - Math.sin(a) * 0.3, rz: 0.9, ry: a + 1 }, { jit: 0.12 });
      } else if (k < 0.7) {
        for (let j = 0; j < 3; j++) B2.ico(0.16 + r() * 0.1, 4865326, { x: x + (r() - 0.5) * 1.5, y, z: z + (r() - 0.5) * 1.5, sy: 0.5 }, { jit: 0.2 });
      } else if (k < 0.82) {
        const col = r.pick([12071466, 14731338, 5927608, 15262416]);
        for (let j = 0; j < 8; j++) {
          const px = x + (r() - 0.5) * 1.6, pz = z + (r() - 0.5) * 1.6;
          const py = world.rawHeight(px, pz);
          F2.box(0.012, 0.42, 0.012, 5664826, { x: px, y: py + 0.21, z: pz });
          F2.ico(0.055, col, { x: px, y: py + 0.44, z: pz, sy: 0.6 }, { jit: 0.1 });
        }
      } else if (r() < war) {
        const w = r();
        if (w < 0.3) B2.sphere(0.17, 7, 4, 5067062, { x, y: y + 0.08, z, sy: 0.75, rx: r() * 0.8, rz: r() * 0.8 });
        else if (w < 0.55) {
          const a = r() * 3.14;
          B2.box(0.05, 0.07, 1.05, 5913638, { x, y: y + 0.05, z, ry: a });
          B2.box(0.03, 0.03, 0.45, 2763564, { x: x + Math.sin(a) * 0.4, y: y + 0.09, z: z + Math.cos(a) * 0.4, ry: a });
        } else if (w < 0.75) B2.box(0.3, 0.2, 0.18, 5920320, { x, y: y + 0.1, z, ry: r() * 3 });
        else if (w < 0.88) B2.box(0.22, 0.06, 0.12, 9075280, { x, y: y + 0.03, z, ry: r() * 3 });
        else canopy(B2, x, y, z, { ang: r() * 6, color: r() < 0.5 ? 13222568 : 10133632 });
      } else {
        for (let j = 0; j < 2; j++) B2.ico(0.16, 8025965, { x: x + (r() - 0.5), y: y + 0.04, z: z + (r() - 0.5), sy: 0.5 }, { jit: 0.2 });
      }
    }
  }
  function segD(x, z, s) {
    const dx = s.bx - s.ax, dz = s.bz - s.az;
    const l2 = dx * dx + dz * dz || 1e-6;
    const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / l2));
    return Math.hypot(x - (s.ax + dx * t), z - (s.az + dz * t));
  }

  // src/dday.js
  var F = [-Math.SQRT1_2, -Math.SQRT1_2];
  var R = [Math.SQRT1_2, -Math.SQRT1_2];
  var S0 = [35.35, 35.35];
  var W = (u, v) => [S0[0] + F[0] * u + R[0] * v, S0[1] + F[1] * u + R[1] * v];
  var WL = (list) => list.map(([u, v]) => W(u, v));
  var ANG = Math.atan2(F[0], F[1]);
  var CAST = {
    winters: { id: "winters", name: "Tte. Richard Winters", short: "Winters", rank: "Compa\xF1\xEDa E \xB7 1.er pelot\xF3n", rankKey: "lt", portrait: { rank: "lt", skin: "#dba886" }, skin: 14395526 },
    lipton: { id: "lipton", name: "Sgto. Carwood Lipton", short: "Lipton", rank: "Sargento", rankKey: "sgt", portrait: { rank: "sgt", skin: "#d39f7d" }, skin: 13868925, mustache: true },
    guarnere: { id: "guarnere", name: "Sgto. Bill Guarnere", short: "Guarnere", rank: "Sargento", rankKey: "sgt", portrait: { rank: "sgt", skin: "#cf9874" }, skin: 13604980 },
    malarkey: { id: "malarkey", name: "Don Malarkey", short: "Malarkey", rank: "Soldado", portrait: { skin: "#e0b08f" }, skin: 14725263 },
    toye: { id: "toye", name: "Joe Toye", short: "Toye", rank: "Soldado", portrait: { skin: "#d7a483" }, skin: 14132355 },
    wynn: { id: "wynn", name: "\xABPopeye\xBB Wynn", short: "Wynn", rank: "Soldado", portrait: { skin: "#d9a07a" }, skin: 14262394 },
    compton: { id: "compton", name: "Tte. Buck Compton", short: "Compton", rank: "Teniente", rankKey: "lt", portrait: { rank: "lt", skin: "#d6a07c" }, skin: 14065788 },
    plesha: { id: "plesha", name: "John Plesha", short: "Plesha", portrait: {} },
    hendrix: { id: "hendrix", name: "Walter Hendrix", short: "Hendrix", portrait: {} },
    liebgott: { id: "liebgott", name: "Joe Liebgott", short: "Liebgott", portrait: {} },
    hall: { id: "hall", name: "John D. Hall", short: "Hall", rank: "Compa\xF1\xEDa A", portrait: { skin: "#d2a281" }, skin: 13804161 }
  };
  function sky(scene2, top, bottom) {
    const g = new T.SphereGeometry(400, 16, 8);
    const m = new T.ShaderMaterial({
      side: 1,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: new T.Color(top) }, bot: { value: new T.Color(bottom) } },
      vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform vec3 top; uniform vec3 bot; varying vec3 vP; void main(){ float h = normalize(vP).y; gl_FragColor = vec4(mix(bot, top, smoothstep(-0.2, 0.6, h)), 1.0); }"
    });
    const s = new T.Mesh(g, m);
    s.renderOrder = -10;
    scene2.add(s);
    return s;
  }
  function lights(scene2, o) {
    const hemi = new T.HemisphereLight(o.sky, o.ground, o.hemi);
    scene2.add(hemi);
    const sun = new T.DirectionalLight(o.sunCol, o.sun);
    sun.position.set(o.dir[0] * 60, o.dir[1] * 60, o.dir[2] * 60);
    sun.castShadow = o.shadow > 0;
    if (sun.castShadow) {
      sun.shadow.mapSize.set(o.shadow, o.shadow);
      const c = sun.shadow.camera;
      c.left = -36;
      c.right = 36;
      c.top = 36;
      c.bottom = -36;
      c.near = 1;
      c.far = 180;
      sun.shadow.bias = -6e-4;
      sun.shadow.normalBias = 0.04;
    }
    scene2.add(sun);
    scene2.add(sun.target);
    return { hemi, sun, dir: o.dir };
  }
  function tuft(b, col = 6257210) {
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + Math.random() * 0.5;
      const h = 0.32 + Math.random() * 0.3, w = 0.07 + Math.random() * 0.04, lean = 0.12 + Math.random() * 0.16;
      const m = new T.Matrix4().makeRotationY(a);
      b.tris([-w, 0, 0, w, 0, 0, w * 0.2, h, lean], col, { mat: m, jit: 0.2, grad: { y0: 0, y1: 0.5, k: 0.22 } });
    }
  }
  var BANK_N = new T.Color().setRGB(0.24, 0.21, 0.19, "srgb");
  var BANK_D = new T.Color().setRGB(0.36, 0.29, 0.21, "srgb");
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
  function signTexture(text) {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 64;
    const x = c.getContext("2d");
    x.fillStyle = "#b9b2a2";
    x.fillRect(0, 0, 256, 64);
    x.fillStyle = "#2a2a28";
    x.font = "bold 26px Georgia, serif";
    x.textAlign = "center";
    x.fillText(text, 128, 42);
    const t = new T.CanvasTexture(c);
    t.colorSpace = "srgb";
    return t;
  }
  function buildNight(ctx) {
    const { scene: scene2, q: q2 } = ctx;
    setFoliage(false);
    const world = new World(150);
    world.base = (x, z) => (fbm(x * 0.02 + 7, z * 0.02 - 1, 3) - 0.5) * 2;
    const B2 = new Builder(11), Fo = new Builder(12), Bf = new Builder(13);
    const r = rng(6);
    const H = (list, o) => hedge(world, B2, Fo, WL(list), o);
    H([[-8, -27], [108, -27]], { treeK: 0.07 });
    H([[-8, 27], [108, 27]], { treeK: 0.07 });
    H([[-7, -27], [-7, 27]]);
    H([[107, -27], [107, 27]]);
    H([[20, -27], [20, -14]]);
    H([[20, -9.5], [20, 27]], { treeK: 0.08 });
    H([[46, -27], [46, 4]], { treeK: 0.06 });
    H([[46, 8.5], [46, 27]]);
    H([[74, -27], [74, -23.2]]);
    H([[74, -18.8], [74, -4.5]]);
    H([[74, 0], [74, 27]], { treeK: 0.06 });
    H([[100, -27], [100, 5]]);
    H([[100, 9.5], [100, 27]]);
    H([[-8, -50], [108, -50]], { trees: true, treeK: 0.1 });
    H([[-8, 50], [108, 50]], { trees: true, treeK: 0.1 });
    H([[30, -27], [30, -50]]);
    H([[70, -27], [70, -50]]);
    H([[40, 27], [40, 50]]);
    H([[85, 27], [85, 50]]);
    gate(world, B2, ...W(20, -11.8), ANG + Math.PI / 2);
    gate(world, B2, ...W(46, 6.2), ANG + Math.PI / 2);
    gate(world, B2, ...W(100, 7.2), ANG + Math.PI / 2);
    world.carves.push({ ax: W(48, -21)[0], az: W(48, -21)[1], bx: W(72, -21)[0], bz: W(72, -21)[1], w: 1.7, d: 0.85 });
    world.carves.push({ ax: W(93.5, -27)[0], az: W(93.5, -27)[1], bx: W(93.5, 27)[0], bz: W(93.5, 27)[1], w: 0.7, d: 0.55 });
    const church2 = W(36, 64);
    for (const [u, v] of [[33, -10], [58, 14], [84, -18]]) world.carves.push({ ax: W(u, v)[0], az: W(u, v)[1], bx: W(u, v)[0], bz: W(u, v)[1], w: 1.6, d: 0.7, crater: true });
    world.bakeHeights(0.5);
    church(world, B2, church2[0], church2[1], ANG + 0.3);
    stoneHouse(world, B2, ...W(20, 58), ANG + 0.2, 9, 6, { lit: true });
    stoneHouse(world, B2, ...W(52, 60), ANG - 0.1, 8, 6);
    stoneHouse(world, B2, ...W(8, 62), ANG, 7, 6);
    for (const [u, v] of [[4, -16], [12, 14], [9, -22], [26, -2], [30, 8], [34, -16], [38, -4], [40, 6], [24, 12], [28, -10], [42, -14], [36, 22]]) appleTree(world, B2, Fo, ...W(u + r() * 2, v + r() * 2), 0.9 + r() * 0.35);
    for (const [u, v] of [[52, 18], [60, -6], [66, 20], [80, -10], [86, 10], [92, -22], [56, -14]]) tree(world, B2, Fo, ...W(u, v), 0.7 + r() * 0.6);
    cow(world, B2, ...W(10, -12), ANG + 1.2);
    cow(world, B2, ...W(14, 8), ANG - 0.4);
    cow(world, B2, ...W(58, 2), ANG + 2.1, { dead: true });
    cow(world, B2, ...W(84, 18), ANG + 0.6);
    canopy(B2, ...(() => {
      const [x, z] = W(4.2, -2.6);
      return [x, world.height(x, z), z];
    })(), { ang: ANG + 0.6 });
    const bag = W(16.5, 21);
    legBag(B2, bag[0], world.height(...bag), bag[1], 0.4);
    c47Wreck(world, B2, ...W(35, 18), ANG + 0.9);
    const hang = W(25.5, -21);
    tree(world, B2, Fo, hang[0], hang[1], 1.1);
    hangingPara(B2, hang[0] + 0.8, world.height(...hang) + 4.3, hang[1] + 0.4);
    bundle(B2, ...(() => {
      const [x, z] = W(42, -21);
      return [x, world.height(x, z), z];
    })(), 4076848);
    bundle(B2, ...(() => {
      const [x, z] = W(81, 22);
      return [x, world.height(x, z), z];
    })(), 4874112);
    cart(world, B2, ...W(62, 10), ANG + 0.7);
    for (const [u, v] of [[56, -2], [64, 4], [70, -12]]) {
      const [x, z] = W(u, v);
      B2.cyl(1.2, 1.5, 1.6, 8, 10719068, { x, y: world.height(x, z) + 0.7, z }, { jit: 0.1 });
      B2.cone(1.25, 1.1, 8, 10126934, { x, y: world.height(x, z) + 2.05, z }, { jit: 0.1 });
      world.addRect(x, z, 1.4, 1.4, 0, 2.4, "hay");
    }
    for (let i = 0; i < 9; i++) pole(world, B2, ...W(97.5, -24 + i * 6.2), 6);
    fence(world, B2, WL([[90, -27], [90, -14]]));
    const sg = W(94.8, 4.5);
    B2.box(1.6, 0.55, 0.3, 11117202, { x: sg[0], y: world.height(...sg) + 0.28, z: sg[1], ry: ANG + Math.PI / 2 });
    world.addRect(sg[0], sg[1], 0.8, 0.2, -(ANG + Math.PI / 2), 0.6, "sign");
    const signM = new T.Mesh(new T.PlaneGeometry(1.5, 0.38), new T.MeshStandardMaterial({ map: signTexture("STE M\xC8RE-\xC9GLISE"), roughness: 0.9 }));
    signM.position.set(sg[0] + Math.sin(ANG + Math.PI / 2) * 0.16, world.height(...sg) + 0.3, sg[1] + Math.cos(ANG + Math.PI / 2) * 0.16);
    signM.rotation.y = ANG + Math.PI / 2;
    scene2.add(signM);
    clutter(world, B2, Fo, Math.floor(720 * q2.props), (x, z) => {
      const dx = x - S0[0], dz = z - S0[1];
      const u = dx * F[0] + dz * F[1];
      return Math.abs(u - 96.5) > 2.5;
    }, { seed: 61, war: 0.45 });
    const fieldTone = (u) => u < 20 ? 0 : u < 46 ? 1 : u < 74 ? 2 : 3;
    const tones = [[0.3, 0.38, 0.29], [0.28, 0.37, 0.28], [0.32, 0.39, 0.3], [0.31, 0.38, 0.31]];
    const ground = buildGround(world, (x, z, h, c) => {
      const dx = x - S0[0], dz = z - S0[1];
      const u = dx * F[0] + dz * F[1], v = dx * R[0] + dz * R[1];
      const t = tones[fieldTone(u)];
      const n = fbm(x * 0.15, z * 0.15, 3);
      c.setRGB(t[0] * (0.8 + n * 0.45), t[1] * (0.8 + n * 0.45), t[2] * (0.8 + n * 0.4), "srgb");
      const road = smooth(2.6, 1.4, Math.abs(u - 96.5));
      const lane = smooth(2.2, 1, Math.abs(v + 21)) * (u > 46 && u < 74 ? 1 : 0);
      const mud = Math.max(road, lane * 0.8);
      c.lerp(new T.Color().setRGB(0.33, 0.3, 0.27, "srgb"), mud * 0.85);
      if (h < -0.4) c.multiplyScalar(0.8);
      c.lerp(BANK_N, bankK(world, x, z));
    }, 0.7);
    scene2.add(ground);
    const mB = meshFrom(B2, "world"), mF = meshFrom(Fo, "foliage");
    scene2.add(mB, mF);
    const N = Math.floor(9e3 * q2.grass);
    scene2.add(scatter(world, (b) => tuft(b, 6257756), N, (x, z, rr, col) => {
      const dx = x - S0[0], dz = z - S0[1];
      const u = dx * F[0] + dz * F[1];
      if (Math.abs(u - 96.5) < 2) return null;
      if (fbm(x * 0.22, z * 0.22, 2) < 0.45 && rr() < 0.75) return null;
      col.setRGB(0.75 + rr() * 0.4, 0.8 + rr() * 0.4, 0.6 + rr() * 0.3);
      return { scale: 0.7 + rr() * 0.9, sy: 0.8 + rr() * 0.8, color: col };
    }, "foliage", 21));
    scene2.add(scatter(world, (b) => {
      b.ico(0.06, 14210244, { y: 0.35 });
      b.box(0.01, 0.35, 0.01, 4874288, { y: 0.17 });
    }, Math.floor(1400 * q2.grass), (x, z, rr, col) => {
      col.setRGB(1, 1, rr() < 0.3 ? 0.6 : 1);
      return { scale: 0.8 + rr() * 0.6, color: col };
    }, "foliage", 22));
    scene2.add(scatter(world, (b) => b.ico(0.18, 7105122, { y: 0.05, sy: 0.6 }, { jit: 0.2 }), 260, (x, z, rr, col) => ({ scale: 0.5 + rr() * 1.4, color: col.setRGB(0.8 + rr() * 0.3, 0.8 + rr() * 0.3, 0.8 + rr() * 0.3) }), "world", 23));
    scene2.background = new T.Color(857638);
    scene2.fog = new T.Fog(1713728, 56, 112);
    sky(scene2, 792112, 1845828);
    const L = lights(scene2, { sky: 2768232, ground: 790552, hemi: 0.85, sunCol: 11124706, sun: 2.4, dir: [-0.35, 0.8, 0.45], shadow: q2.shadow });
    U.worldRim.value.setRGB(0.55, 0.68, 0.95);
    U.rimColor.value.setRGB(0.28, 0.26, 0.2);
    U.rimEnemy.value.setRGB(0.16, 0.18, 0.21);
    const extraFires = [{ u: 70, v: -12, y: 1.6, s: 1.1, light: 9 }, { u: 58, v: 20, y: 0.3, s: 0.7, light: 7 }, { u: 108, v: -42, y: 0, s: 2.2 }, { u: -12, v: 46, y: 0, s: 2.4 }];
    const fire = null;
    U.fireCol.value.setRGB(0, 0, 0);
    const sg2 = new T.BufferGeometry();
    const sp = [];
    for (let i = 0; i < 500; i++) {
      const a = Math.random() * Math.PI * 2, e = 0.15 + Math.random() * 1.2;
      sp.push(Math.cos(a) * Math.cos(e) * 350, Math.sin(e) * 350, Math.sin(a) * Math.cos(e) * 350);
    }
    sg2.setAttribute("position", new T.Float32BufferAttribute(sp, 3));
    const stars = new T.Points(sg2, new T.PointsMaterial({ color: 10465488, size: 1.4, sizeAttenuation: false, fog: false }));
    scene2.add(stars);
    return { world, L, church: church2, fire, bag, extraFires };
  }
  function gradeNight(post) {
    setGrade(post, { topGlow: [0.09, 0.035, 0.012], exposure: 1.55, sat: 0.6, con: 1.1, shT: [0.8, 0.92, 1.26], hiT: [1, 1, 1.02], lift: [0.012, 0.022, 0.05], vig: 0.62, grain: 0.06, bloomK: 0.7 });
  }
  var GUNS = [[60, -9], [67, 4], [73, 16], [80, 28]];
  var TRENCH = [[52, -16], [56, -12], [60, -9], [63, -3], [67, 4], [70, 10], [73, 16], [76, 22], [80, 28], [84, 33]];
  function buildBrecourt(ctx) {
    const { scene: scene2, q: q2 } = ctx;
    setFoliage(true);
    const world = new World(150);
    world.base = (x, z) => (fbm(x * 0.018 - 3, z * 0.018 + 9, 3) - 0.5) * 1.8;
    const B2 = new Builder(31), Fo = new Builder(32);
    const r = rng(9);
    const H = (list, o) => hedge(world, B2, Fo, WL(list), o);
    H([[-6, -24.5], [57, -24.5]], { treeK: 0.08 });
    H([[-6, -18], [35.5, -18]], { treeK: 0.06 });
    H([[38, -18], [41.5, -18]], { trees: false });
    H([[44, -18], [52.5, -18]], { trees: false });
    H([[62, -24.5], [104, -24.5]], { treeK: 0.06 });
    H([[-6, 40], [104, 40]], { treeK: 0.06 });
    H([[-7, -24.5], [-7, 40]]);
    H([[105, -24.5], [105, 40]]);
    H([[88, -24.5], [88, 6]], { treeK: 0.1 });
    H([[88, 12], [88, 40]], { treeK: 0.1 });
    H([[10, -18], [10, 10]]);
    H([[10, 15], [10, 40]]);
    const finishTrench = trench(world, B2, WL(TRENCH), 0.85, 1.55);
    const spur1 = trench(world, B2, WL([[60, -9], [57, -2]]), 0.75, 1.4);
    const spur2 = trench(world, B2, WL([[67, 4], [71, -2]]), 0.75, 1.4);
    const spur3 = trench(world, B2, WL([[73, 16], [77, 12]]), 0.75, 1.4);
    for (const [u, v] of GUNS) world.carves.push({ ax: W(u, v)[0], az: W(u, v)[1], bx: W(u, v)[0], bz: W(u, v)[1], w: 3.2, d: 0.9, crater: true });
    for (const [u, v] of [[30, 6], [44, 18], [38, -6], [52, 26]]) world.carves.push({ ax: W(u, v)[0], az: W(u, v)[1], bx: W(u, v)[0], bz: W(u, v)[1], w: 1.8, d: 0.8, crater: true });
    world.bakeHeights(0.5);
    finishTrench();
    spur1();
    spur2();
    spur3();
    const gunPos = GUNS.map(([u, v]) => W(u, v));
    gunPos.forEach(([x, z], i) => {
      const y = world.height(x, z);
      const gB = new Builder(40 + i);
      gun105(gB, x, y, z, ANG + 0.35, {});
      const m = meshFrom(gB, "world");
      m.userData.gun = i;
      scene2.add(m);
      gunPos[i].mesh = m;
      world.addRect(x, z, 1.1, 1.6, -(ANG + 0.35), 1.4, "gun");
      camoNet(Fo, x, y, z, ANG + 0.35, 7, 7);
      sandbags(world, B2, WL([[GUNS[i][0] - 3, GUNS[i][1] - 3], [GUNS[i][0] - 3.4, GUNS[i][1] + 2], [GUNS[i][0] + 1, GUNS[i][1] + 4.2]]), 3);
    });
    stoneHouse(world, B2, ...W(96, 16), ANG + 0.1, 12, 7, { h: 5.5, rh: 3.6, windows: [-4, 0, 4], shutter: 6969928 });
    barn(world, B2, ...W(94, 30), ANG + 0.15 + Math.PI / 2, 10, 7);
    stoneHouse(world, B2, ...W(97, 0), ANG - 0.2, 7, 5.5, { h: 3.6, rh: 2.6 });
    well(world, B2, ...W(92, 10));
    cart(world, B2, ...W(90, 22), ANG + 1.9);
    for (const [u, v] of [[92, -10], [100, 6], [96, -6], [101, 26], [99, 36]]) appleTree(world, B2, Fo, ...W(u, v), 1);
    for (const [u, v] of [[20, 30], [24, -10], [36, 34], [30, 18], [6, 22], [2, -10]]) tree(world, B2, Fo, ...W(u, v), 0.7 + r() * 0.6);
    cow(world, B2, ...W(28, 30), ANG + 1);
    cow(world, B2, ...W(34, 26), ANG + 2.6);
    cow(world, B2, ...W(46, 32), ANG + 0.3, { dead: true });
    canopy(B2, ...(() => {
      const [x, z] = W(26, 12);
      return [x, world.height(x, z), z];
    })(), { ang: 1.2 });
    canopy(B2, ...(() => {
      const [x, z] = W(6, -12);
      return [x, world.height(x, z), z];
    })(), { ang: 2.1, color: 12169632 });
    legBag(B2, ...(() => {
      const [x, z] = W(4, 2);
      return [x, world.height(x, z), z];
    })(), 0.9);
    const lipTree = W(47, 2);
    tree(world, B2, Fo, lipTree[0], lipTree[1], 1.15);
    clutter(world, B2, Fo, Math.floor(760 * q2.props), (x, z) => {
      if (world.height(x, z) < -0.3) return false;
      for (const [u, v] of GUNS) {
        const [gx, gz] = W(u, v);
        if (Math.hypot(x - gx, z - gz) < 7) return false;
      }
      return true;
    }, { seed: 62, war: 0.35 });
    const ground = buildGround(world, (x, z, h, c) => {
      const n = fbm(x * 0.13, z * 0.13, 3);
      c.setRGB(0.4 * (0.84 + n * 0.36), 0.45 * (0.84 + n * 0.36), 0.33 * (0.82 + n * 0.32), "srgb");
      if (h < -0.35) c.lerp(new T.Color().setRGB(0.42, 0.34, 0.24, "srgb"), clamp((-h - 0.35) * 0.9, 0, 0.9));
      c.lerp(BANK_D, bankK(world, x, z));
    }, 0.7);
    scene2.add(ground);
    scene2.add(meshFrom(B2, "world"), meshFrom(Fo, "foliage"));
    const N = Math.floor(11e3 * q2.grass);
    scene2.add(scatter(world, (b) => tuft(b, 8030810), N, (x, z, rr, col) => {
      if (world.height(x, z) < -0.5) return null;
      if (fbm(x * 0.22, z * 0.22, 2) < 0.45 && rr() < 0.75) return null;
      col.setRGB(0.8 + rr() * 0.35, 0.85 + rr() * 0.35, 0.65 + rr() * 0.3);
      return { scale: 0.7 + rr() * 1, sy: 0.9 + rr() * 0.9, color: col };
    }, "foliage", 41));
    scene2.add(scatter(world, (b) => {
      b.ico(0.07, 15129722, { y: 0.4 });
      b.box(0.01, 0.4, 0.01, 5599290, { y: 0.2 });
    }, Math.floor(1800 * q2.grass), (x, z, rr, col) => {
      const k = rr();
      col.setRGB(1, k < 0.4 ? 1 : 0.95, k < 0.4 ? 0.4 : 1);
      return { scale: 0.8 + rr() * 0.6, color: col };
    }, "foliage", 42));
    scene2.add(scatter(world, (b) => b.ico(0.18, 8025965, { y: 0.05, sy: 0.6 }, { jit: 0.2 }), 300, (x, z, rr, col) => ({ scale: 0.5 + rr() * 1.4, color: col.setRGB(1, 1, 1) }), "world", 43));
    scene2.background = new T.Color(12108482);
    scene2.fog = new T.Fog(12831945, 54, 104);
    sky(scene2, 11122366, 13816518);
    const L = lights(scene2, { sky: 11845828, ground: 4606526, hemi: 1.2, sunCol: 15394006, sun: 2.2, dir: [-0.58, 0.36, -0.72], shadow: q2.shadow });
    U.worldRim.value.setRGB(0.12, 0.12, 0.1);
    U.rimColor.value.setRGB(0.12, 0.11, 0.08);
    U.rimEnemy.value.setRGB(0.06, 0.07, 0.09);
    U.fireCol.value.setRGB(0, 0, 0);
    return { world, L, gunPos, lipTree };
  }
  function gradeDawn(post) {
    setGrade(post, { topGlow: [0, 0, 0], exposure: 1, sat: 0.64, con: 1.06, shT: [0.88, 0.95, 1.08], hiT: [1.03, 1, 0.95], lift: [0.02, 0.025, 0.03], vig: 0.5, grain: 0.045, bloomK: 0.4 });
  }

  // src/story.js
  var ANG2 = Math.atan2(-Math.SQRT1_2, -Math.SQRT1_2);
  var dirTo = (a, b) => Math.atan2(b[0] - a[0], b[1] - a[1]);
  function spawn(g, o, u, v, extra = {}) {
    const [x, z] = W(u, v);
    return g.add({ ...o, ...extra, x, z, ry: extra.ry ?? ANG2 });
  }
  var german = (g, u, v, o = {}) => spawn(g, { side: "de", kit: o.kit || "heer", name: "Alem\xE1n", weapon: o.weapon || "k98", hp: 100, grenades: o.grenades ?? 0, seed: Math.floor(u * 100 + v) }, u, v, o);
  function nightAmbience(g) {
    const r = rng(3);
    const planes = [];
    let nextPlane = 3, nextFlak = 2, nextBell = 6;
    const pB = new Builder(90);
    c47(pB, {});
    const pg = pB.build();
    const pos = pg.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, 0);
    const geo = pg;
    const shadowMat = new T.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.32, depthWrite: false });
    const chutes = [];
    const cB = new Builder(91);
    cB.sphere(1.1, 8, 4, 13222568, { y: 1.3, sy: 0.55 });
    cB.box(0.3, 0.7, 0.25, 4868666, { y: 0 });
    const cgeo = cB.build();
    g.ambient = (dt) => {
      nextPlane -= dt;
      nextFlak -= dt;
      nextBell -= dt;
      if (nextPlane <= 0) {
        nextPlane = 22 + r() * 16;
        const ang = ANG2 + Math.PI / 2 + (r() - 0.5) * 0.6;
        const p = g.player || { x: 0, z: 0 };
        for (let i = 0; i < 3; i++) {
          const m = new T.Mesh(geo, shadowMat);
          const off = (i - 1) * 11;
          m.position.set(p.x - Math.sin(ang) * 70 + Math.cos(ang) * off, 0, p.z - Math.cos(ang) * 70 - Math.sin(ang) * off - i * 7);
          m.rotation.y = ang;
          m.userData.v = [Math.sin(ang) * 30, Math.cos(ang) * 30];
          m.renderOrder = 3;
          g.scene.add(m);
          planes.push(m);
        }
        g.audio.plane(9, 0.4);
        for (let i = 0; i < 6; i++) {
          const m = new T.Mesh(cgeo, g.scene.userData.chMat || (g.scene.userData.chMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));
          const [x, z] = W(30 + r() * 60, -40 - r() * 15);
          m.position.set(x, 12 + i * 2, z);
          m.userData.vy = -2.2;
          g.scene.add(m);
          chutes.push(m);
        }
      }
      for (let i = planes.length - 1; i >= 0; i--) {
        const m = planes[i];
        m.position.x += m.userData.v[0] * dt;
        m.position.z += m.userData.v[1] * dt;
        m.position.y = g.world.height(m.position.x, m.position.z) + 0.25;
        if (Math.abs(m.position.x) > 160 || Math.abs(m.position.z) > 160) {
          g.scene.remove(m);
          planes.splice(i, 1);
        }
      }
      for (let i = chutes.length - 1; i >= 0; i--) {
        const m = chutes[i];
        m.position.y += m.userData.vy * dt;
        m.rotation.z = Math.sin(g.t + i) * 0.1;
        if (m.position.y < g.world.height(m.position.x, m.position.z)) {
          g.scene.remove(m);
          chutes.splice(i, 1);
        }
      }
      if (nextFlak <= 0) {
        nextFlak = 2.5 + r() * 5;
        const [x, z] = r() < 0.5 ? W(20 + r() * 70, -45) : W(10 + r() * 80, 45);
        g.fx.flak(x, z, 5 + Math.floor(r() * 5));
        g.audio.distantFlak();
      }
      if (nextBell <= 0) {
        nextBell = 4.2;
        g.audio.bell(g.lvl.church[0], g.lvl.church[1]);
      }
      if (g.lvl.church) g.fx.fires.length || g.fx.addFire(g.lvl.church[0], g.world.height(...g.lvl.church) + 12, g.lvl.church[1], 2.2);
      g.lvl.fire && (g.lvl.fire.intensity = 50 + Math.sin(g.t * 9) * 8 + Math.sin(g.t * 23) * 5);
    };
  }
  async function nightScript(g, from = "n0") {
    const ui2 = g.ui;
    g.night = true;
    nightAmbience(g);
    const wreck = W(35, 18);
    g.fx.addFire(wreck[0], g.world.height(...wreck) + 0.8, wreck[1], 1.2);
    g.lights.push({ x: wreck[0], z: wreck[1], r: 9 });
    const wl = new T.PointLight(16747072, 14, 16, 1.6);
    wl.position.set(wreck[0], g.world.height(...wreck) + 2, wreck[1]);
    g.scene.add(wl);
    g.flickers = [wl];
    for (const f of g.lvl.extraFires || []) {
      const [x, z] = W(f.u, f.v);
      const y = g.world.height(x, z) + f.y;
      g.fx.addFire(x, y, z, f.s);
      if (f.light) {
        const l = new T.PointLight(16747069, 16, 14, 1.4);
        l.position.set(x, y + 1.5, z);
        g.scene.add(l);
        g.flickers.push(l);
        g.lights.push({ x, z, r: f.light });
      }
    }
    const order = ["n0", "n1", "n2", "n3"];
    const at = (k) => order.indexOf(from) <= order.indexOf(k);
    const start = { n0: [4.5, -2.5], n1: [21, -11.5], n2: [47.5, 6.4], n3: [66, -19] }[from];
    const win = spawn(g, { ...CAST.winters, weapon: "knife", grenades: from === "n0" ? 0 : 1, bandages: 1, hp: 100 }, ...start);
    win.protect = 0;
    g.setPlayer(win);
    g.cam.x = win.x;
    g.cam.z = win.z;
    const mgNest = [german(g, 25, 21.5, { weapon: "mg42" }), german(g, 25.5, 19)];
    for (const s of mgNest) {
      s.ai = { mode: "guard", noAlert: true, static: true, baseRy: dirTo(W(25, 21), W(10, 21)), sweep: 0.6 };
      s.ry = s.ai.baseRy;
      s.hidden = false;
    }
    const p1 = [german(g, 30, -18), german(g, 31.5, -17)];
    p1[0].ai = { mode: "patrol", path: [W(30, -18), W(40, -8), W(38, 4).concat(2.5), W(28, -6), W(26, -18).concat(3)].map((p) => p) };
    p1[1].ai = { mode: "patrol", path: [W(31.5, -17), W(41.5, -7), W(39.5, 5).concat(2.5), W(29.5, -5), W(27.5, -17).concat(3)] };
    const smoker = german(g, 72.5, -2.2, { weapon: "k98" });
    smoker.ai = { mode: "guard", smoke: true, baseRy: dirTo(W(72.5, -2), W(60, -2)), sweep: 1.4 };
    smoker.ry = smoker.ai.baseRy;
    const p2 = german(g, 58, -8);
    p2.ai = { mode: "patrol", path: [W(58, -10).concat(2), W(60, 20).concat(3)], speedK: 0.38 };
    const post = [german(g, 88, -13, { weapon: "mg42" }), german(g, 89.5, -11)];
    post[0].ai = { mode: "guard", baseRy: dirTo(W(88, -13), W(96, -13)), sweep: 1.2 };
    post[1].ai = { mode: "guard", smoke: true, baseRy: dirTo(W(89.5, -11), W(78, -4)), sweep: 2.2 };
    post.forEach((s) => s.ry = s.ai.baseRy);
    const p3 = german(g, 84, 16);
    p3.ai = { mode: "patrol", path: [W(84, 18).concat(2.5), W(82, -2).concat(2), W(78, 10)], speedK: 0.36 };
    const lip = spawn(g, { ...CAST.lipton, weapon: "knife", crouch: true }, 66.5, -21.3, { ry: ANG2 + Math.PI * 0.8 });
    lip.hidden = true;
    lip.protect = 1;
    let lipFound = !at("n2") || from === "n3";
    if (from === "n3") {
      lip.x = win.x - 1.5;
      lip.z = win.z + 1;
      lip.hidden = false;
      lip.ai = { mode: "follow", slot: 1, fire: false };
    }
    let firstKill = true;
    g.onStab = async (e) => {
      g.flags.kills = (g.flags.kills || 0) + 1;
      if (firstKill) {
        firstKill = false;
        g.slow = 0.35;
        g.audio.heartbeat(1);
        setTimeout(() => g.audio.heartbeat(0.8), 900);
        ui2.sayNow("", "No lleg\xF3 a verle la cara. S\xED le oy\xF3 respirar.", 3.4);
        g.renderer.post.desat.value = 0.6;
        await g.wait(1.2);
        g.slow = 1;
        g.renderer.post.desat.value = 0;
      }
    };
    g.onAlert = (s) => {
      if (g.flags.toldAlert) return;
      g.flags.toldAlert = true;
      ui2.toast("Te han visto. Corta la l\xEDnea de visi\xF3n tras un seto y ag\xE1chate.", 3600);
    };
    g.onPlayerDeath = () => g.deathCard({ guaranteed: true });
    if (at("n0")) {
      g.checkpoint("night", "n0");
      g.lockMove = true;
      win.proneLock = true;
      g.cam.span = 26;
      g.ambientFlakNow && g.ambientFlakNow();
      await g.wait(0.6);
      g.audio.plane(8, 0.55);
      await g.lines([
        ["Winters", "Volamos demasiado r\xE1pido. Demasiado bajo.", 2.6],
        ["Winters", "Ah\xED va mi bolsa de pierna. Y todo mi equipo con ella.", 3.2]
      ]);
      win.proneLock = false;
      g.actions = [{ x: win.x, z: win.z, r: 3, label: "Soltar el arn\xE9s", enabled: () => !g.flags.free, run: () => g.flags.free = true }];
      g.setObjective("Su\xE9ltate del arn\xE9s", win.x, win.z);
      await g.until(() => g.flags.free);
      g.audio.reload();
      g.lockMove = false;
      g.actions = [];
      ui2.toast("Arrastra a la izquierda para moverte. Solo tienes la bayoneta.", 3800);
      await g.wait(1.2);
      const para = spawn(g, { name: "Paracaidista de la 82.\xAA", short: "82.\xAA", portrait: {}, weapon: "m1", seed: 82 }, 9.5, 5, { ry: ANG2 + 2 });
      para.protect = 2;
      para.ai = { mode: "hold", fire: false };
      para.proneLock = true;
      const chB = new Builder(5);
      canopy(chB, para.x + 1.2, g.world.height(para.x, para.z), para.z + 0.5, { ang: 0.4 });
      const chM = meshFrom(chB, "world");
      g.scene.add(chM);
      g.fx.dirt(para.x, para.z, 1.5);
      g.audio.footstep(1.5);
      g.setObjective("Ayuda al paracaidista que acaba de caer", para.x, para.z);
      g.actions = [{ x: para.x, z: para.z, r: 2.2, label: "Cortar sus correas", enabled: () => !g.flags.helped, run: () => g.flags.helped = true }];
      await g.until(() => g.flags.helped);
      g.actions = [];
      para.proneLock = false;
      win.st.stab = 1;
      await g.lines([
        ["Winters", "\xBFTienes una granada?", 2],
        ["82.\xAA", "Tome, mi teniente.", 1.8]
      ]);
      win.grenades = 1;
      ui2.toast("+1 granada", 1600);
      await g.lines([["Winters", "Volvamos. Tengo que encontrar mi equipo.", 2.6]]);
      para.ai = { mode: "follow", slot: 1, fire: false };
      const bag = g.lvl.bag;
      g.setObjective("Recupera tu bolsa de pierna, junto al seto", bag[0], bag[1]);
      await g.until(() => Math.hypot(win.x - bag[0], win.z - bag[1]) < 10);
      const mg = mgNest[0];
      mg.ai.mode = "scripted";
      for (let k = 0; k < 4; k++) {
        for (let i = 0; i < 7; i++) {
          const tx = bag[0] + (Math.random() - 0.5) * 6, tz = bag[1] + (Math.random() - 0.5) * 6;
          g.fx.tracers.shoot(mg.x, mg.y + 0.9, mg.z, tx, g.world.height(tx, tz) + Math.random() * 1.5, tz, [3.6, 1.4, 0.45], 75, 2.4, null);
          setTimeout(() => g.fx.dirt(tx, tz, 0.5), 200 + i * 40);
        }
        g.audio.mg(mg.x, mg.z);
        if (k === 0) setTimeout(() => g.audio.whizz(0.9), 300);
        g.fx.shake = Math.min(1, g.fx.shake + 0.25);
        await g.wait(0.45);
      }
      mg.ai.mode = "guard";
      ui2.sayNow("Winters", "\xA1A la mierda el equipo!", 2.2);
      await g.wait(1.4);
      await g.lines([["82.\xAA", "Me voy a buscar a la 82.\xAA. Suerte, mi teniente.", 2.6]]);
      para.ai = { mode: "move", path: [W(-2, 20), W(-5, 24)], speedK: 1.1, fire: false, onArrive: (s) => s.remove() };
      g.setObjective("Al\xE9jate de las ametralladoras: cruza la cancela", ...W(20, -11.8));
      await g.until(() => Math.hypot(win.x - W(21, -11.8)[0], win.z - W(21, -11.8)[1]) < 3.2);
      g.scene.remove(chM);
    }
    if (at("n1")) {
      g.checkpoint("night", "n1");
      ui2.toast("Ag\xE1chate para moverte en silencio. De noche solo te ven de cerca.", 4200);
      g.setObjective("Cruza el huerto sin que te vean", ...W(46, 6.2));
      g.trigger(...W(27, -12), 6, () => ui2.say("", "Una patrulla. Dos hombres. Hablan bajo, en alem\xE1n.", 3));
      g.trigger(...W(33, 12), 6, () => ui2.say("Winters", "El avi\xF3n arde. Si me acerco a la luz, me ver\xE1n.", 3));
      g.trigger(...W(25, -18), 5, () => ui2.say("", "Un paracaidista cuelga de las ramas. No se mueve.", 3.2));
      await g.until(() => Math.hypot(win.x - W(47, 6.2)[0], win.z - W(47, 6.2)[1]) < 3);
    }
    if (at("n2")) {
      g.checkpoint("night", "n2");
      g.setObjective("Busca a tus hombres: usa la chicharra");
      ui2.say("Winters", "Clic-clac. Si alguien de los nuestros est\xE1 cerca, contestar\xE1.", 3.2);
      g.onCall = () => {
        g.audio.cricket(win.x, win.z, false);
        g.noise(win.x, win.z, 3, win);
        if (lipFound) return;
        const d = g.dist(win, lip);
        if (d < 40) {
          setTimeout(() => {
            g.audio.cricket(lip.x, lip.z, true);
            g.pingT = 3.2;
            g.ping = { x: lip.x + (Math.random() - 0.5) * 4, z: lip.z + (Math.random() - 0.5) * 4 };
            g.setObjective("Alguien ha contestado. Ve hacia el sonido", g.ping.x, g.ping.z);
          }, 700);
        } else setTimeout(() => ui2.toast("Nadie contesta. Avanza y vuelve a probar."), 900);
      };
      g.trigger(...W(56, -16), 5, () => ui2.say("", "El camino hundido entre los setos. Aqu\xED abajo nadie te ve.", 3.2));
      await g.until(() => g.dist(win, lip) < 3.2);
      lipFound = true;
      lip.hidden = false;
      lip.face(win.x, win.z, 1, 1);
      await g.lines([
        ["Lipton", "Clic-clac, clic-clac. \xBFMi teniente?", 2.4],
        ["Lipton", "Perd\xED el fusil con la bolsa. Tengo dos granadas y un juego de demolici\xF3n.", 3.6]
      ]);
      lip.ai = { mode: "follow", slot: 1, fire: false };
      g.onCall = null;
    }
    if (at("n3")) {
      g.checkpoint("night", "n3");
      g.setObjective("Llega a la carretera de Sainte-Marie-du-Mont", ...W(94, 13));
      g.trigger(...W(80, -6), 7, () => ui2.say("Lipton", "Una ametralladora en el cruce. Por la derecha, pegados al seto.", 3.2));
      await g.until(() => Math.hypot(win.x - W(94, 13)[0], win.z - W(94, 13)[1]) < 4.5);
      const grp = [
        spawn(g, { ...CAST.guarnere, weapon: "m1", crouch: true }, 95.5, 15.5),
        spawn(g, { ...CAST.malarkey, weapon: "m1", crouch: true }, 96.5, 13.5),
        spawn(g, { ...CAST.toye, weapon: "m1", crouch: true }, 95.8, 17.2),
        spawn(g, { ...CAST.wynn, weapon: "m1", crouch: true }, 97, 16.2)
      ];
      grp.forEach((s) => {
        s.ai = { mode: "hold", fire: false };
        s.protect = 1;
        s.face(win.x, win.z, 1, 1);
      });
      g.lockMove = true;
      await g.lines([
        ["Guarnere", "Mi teniente. Malarkey, Toye y Popeye. Nadie m\xE1s.", 2.8],
        ["Lipton", "He visto un cartel en la carretera, aqu\xED al lado: Sainte-M\xE8re-\xC9glise.", 3.4],
        ["Winters", "Bien. S\xE9 d\xF3nde est\xE1 ese pueblo. Podemos seguir desde aqu\xED.", 3.2],
        ["Guarnere", "Que vengan los alemanes. Tengo una cuenta pendiente con ellos.", 3]
      ]);
      g.lockMove = false;
      return "brecourt";
    }
    return "brecourt";
  }
  async function brecourtScript(g, from = "b0") {
    const ui2 = g.ui;
    g.night = false;
    const order = ["b0", "b1", "b2", "b3", "b4"];
    const at = (k) => order.indexOf(from) <= order.indexOf(k);
    g.gunsFiring = [true, true, true, true];
    let nextGun = 2, nextMist = 0;
    g.ambient = (dt) => {
      nextGun -= dt;
      nextMist -= dt;
      if (nextGun <= 0) {
        nextGun = 4 + Math.random() * 5;
        const live = g.gunsFiring.map((v, i) => v ? i : -1).filter((i) => i >= 0);
        if (live.length) {
          const i = live[Math.floor(Math.random() * live.length)];
          const [gx, gz] = g.lvl.gunPos[i];
          const a = ANG2 + 0.35;
          const mx = gx + Math.sin(a) * 3.3, mz = gz + Math.cos(a) * 3.3, my = g.world.height(gx, gz) + 1.7;
          g.fx.glow.emit({ x: mx, y: my, z: mz, life: 0.14, s0: 4.5, s1: 2, c0: [3, 1.5, 0.45, 1], c1: [1, 0.3, 0.05, 0] });
          for (let k = 0; k < 14; k++)
            g.fx.smoke.emit({ x: mx, y: my, z: mz, vx: Math.sin(a) * (4 + Math.random() * 6) + (Math.random() - 0.5) * 2, vy: 0.6 + Math.random(), vz: Math.cos(a) * (4 + Math.random() * 6) + (Math.random() - 0.5) * 2, life: 3 + Math.random() * 2, s0: 1.2, s1: 4.5, c0: [0.62, 0.6, 0.56, 0.6], c1: [0.7, 0.7, 0.7, 0], drag: 1.2, fadeIn: 0.05 });
          g.fx.lights.flash(mx, my + 1, mz, 30, 0.2, 22, 16756848);
          g.audio.boom(gx, gz, 1.3);
          const p = g.player;
          if (p) g.fx.shake = Math.min(1, g.fx.shake + 0.4 * Math.max(0.15, 1 - Math.hypot(p.x - gx, p.z - gz) / 50));
        }
      }
      if (nextMist <= 0 && g.player) {
        nextMist = 0.35;
        const p = g.player;
        const x = p.x + (Math.random() - 0.5) * 40, z = p.z + (Math.random() - 0.5) * 40;
        g.fx.smoke.emit({ x, y: g.world.height(x, z) + 0.6, z, vx: 0.35, vy: 0.02, vz: -0.15, life: 14, s0: 7, s1: 11, c0: [0.86, 0.88, 0.88, 0], c1: [0.86, 0.88, 0.9, 0], fadeIn: 0, mist: 1 });
      }
    };
    const lead = g.save.lead || "winters";
    const leadCast = lead === "winters" ? CAST.winters : CAST.lipton;
    const st = { b0: [4, -21], b1: [50, -21.2], b2: [59, -10.5], b3: [72, 14.5], b4: [70, 12] }[from];
    const win = spawn(g, { ...leadCast, weapon: "m1", clip: 8, reserve: from === "b0" ? 32 : 24, grenades: 3, bandages: 2 }, ...st);
    g.setPlayer(win);
    g.cam.x = win.x;
    g.cam.z = win.z;
    g.leader = win;
    const mk = (c, u, v, o = {}) => {
      const s = spawn(g, { ...c, weapon: o.weapon || "m1", crouch: true }, u, v);
      s.protect = o.protect ?? 1;
      s.ai = { mode: "hold", engage: true, crouch: true, look: W(u + 10, v + 4) };
      s.onDown = () => ui2.say(s.short, "\xA1Me han dado! \xA1Estoy bien, seguid!", 2.2);
      return s;
    };
    const off = (k) => k ? 0 : 0;
    const team = {};
    if (lead !== "lipton") team.lipton = mk(CAST.lipton, st[0] - 2, st[1] + 0.8);
    team.compton = mk(CAST.compton, st[0] - 3, st[1] - 0.8, { weapon: "thompson" });
    team.guarnere = mk(CAST.guarnere, st[0] - 4.2, st[1] + 0.6);
    team.malarkey = mk(CAST.malarkey, st[0] - 5.5, st[1] - 0.6);
    team.toye = mk(CAST.toye, st[0] - 6.8, st[1] + 0.5);
    team.wynn = mk(CAST.wynn, st[0] - 8, st[1] - 0.5);
    const mgA = mk(CAST.plesha, st[0] - 9.5, st[1], { weapon: "mg42" });
    const mgB = mk(CAST.liebgott, st[0] - 11, st[1] + 0.3, { weapon: "thompson" });
    const followAll = () => Object.values(team).concat([mgA, mgB]).forEach((s, i) => s.alive && (s.ai = { mode: "follow", slot: 1 + i, engage: true }));
    const de = [];
    const fj = (u, v, o = {}) => {
      const s = german(g, u, v, { kit: "fj", weapon: o.weapon || "k98", grenades: o.grenades ?? 1 });
      s.ai = { mode: "guard", static: true, react: 0.4, crouchFight: true, baseRy: dirTo(W(u, v), W(u - 20, v - 6)), sweep: 1.4 };
      s.crouch = true;
      s.ry = s.ai.baseRy;
      s.gun = o.gun;
      de.push(s);
      return s;
    };
    const alive = (s) => s && s.alive && !s.surrendered;
    if (at("b2")) {
      fj(55.5, -13, { weapon: "mg42", gun: 0, grenades: 0 });
      fj(58, -11, { gun: 0 });
      fj(61, -7.5, { gun: 0, grenades: 2 });
      fj(57.5, -3, { gun: 0 });
    }
    if (at("b3")) {
      fj(64, -1.5, { gun: 1, weapon: "mp40" });
      fj(67.5, 5, { gun: 1 });
      fj(70.5, -1, { gun: 1 });
      fj(70, 9.5, { gun: 2, weapon: "mg42", grenades: 0 });
      fj(73.5, 16.5, { gun: 2 });
      fj(76.5, 12.5, { gun: 2 });
    }
    const g4 = [fj(80, 28, { gun: 3 }), fj(83, 32, { gun: 3 }), fj(77, 23, { gun: 3, weapon: "mp40" })];
    const manorMG = fj(87, 8, { weapon: "mg42" });
    manorMG.ai.react = 1;
    manorMG.protect = 2;
    const gunClear = (i) => {
      const c = de.filter((s) => s.gun === i && alive(s)).length === 0;
      if (c) g.gunsFiring[i] = false;
      return c;
    };
    const near = (p, r) => Math.hypot(win.x - W(...p)[0], win.z - W(...p)[1]) < r;
    g.onPlayerDeath = (s) => g.deathCard({ guaranteed: !g.flags.permadeath, who: s });
    g.onEnemyKilled = () => {
      g.flags.kills = (g.flags.kills || 0) + 1;
    };
    let toyeDone = false;
    g.onEnemyGrenade = (gr) => {
      const toye = team.toye;
      if (toyeDone || !toye || !toye.alive || g.dist(toye, win) > 9) return;
      toyeDone = true;
      gr.x = toye.x + 0.4;
      gr.z = toye.z + 0.3;
      gr.vx = gr.vz = 0;
      gr.vy = 2;
      gr.y = toye.y + 2;
      gr.fuse = 2.4;
      g.qte("\xA1JOE, CUIDADO!", 1.7, toye, "\xA1JOE!").then((ok) => {
        if (ok) {
          toye.blastProof = true;
          toye.st.prone = 1;
          toye.proneLock = true;
          ui2.sayNow(leadCast.short, "\xA1Joe, cuidado!", 1.4);
          setTimeout(() => {
            toye.blastProof = false;
            toye.proneLock = false;
            ui2.say("Toye", "Me ha destrozado la culata del fusil. Ni un rasgu\xF1o.", 2.8);
            g.flags.toyeSaved = true;
          }, 2600);
        } else {
          setTimeout(() => ui2.say("Toye", "Estoy bien\u2026 estoy bien. Seguid.", 2.4), 2800);
        }
      });
    };
    if (at("b0")) {
      g.checkpoint("brecourt", "b0");
      followAll();
      g.setObjective("Avanza por el camino hundido hacia la bater\xEDa", ...W(33, -21.2));
      ui2.say(leadCast.short, "Dejad el equipo. Solo armas, munici\xF3n y granadas.", 2.8);
      ui2.say(leadCast.short, "Agachados. El seto nos tapa hasta el final.", 2.6);
      await g.until(() => near([33, -21.2], 3.5));
      g.lockMove = true;
      await g.lines([[leadCast.short, "Plesha, Liebgott: ametralladoras en los huecos del seto. Fuego a mi se\xF1al.", 3.6]]);
      g.lockMove = false;
      mgA.ai = { mode: "move", path: [W(36.7, -20), W(36.7, -18.3)], speedK: 1, crouch: true, engage: true, onArrive: (s) => s.ai = { mode: "hold", engage: true, crouch: true, look: W(56, -10) } };
      mgB.ai = { mode: "move", path: [W(42.8, -20), W(42.8, -18.3)], speedK: 1, crouch: true, engage: true, onArrive: (s) => s.ai = { mode: "hold", engage: true, crouch: true, look: W(58, -6) } };
      if (team.lipton) team.lipton.ai = { mode: "move", path: [W(44.5, -19.5), W(46, -12), W(47, 2)], speedK: 1.2, onArrive: (s) => {
        s.ai = { mode: "hold", engage: true, crouch: false, look: W(60, -6) };
        ui2.say("Lipton", "Desde el \xE1rbol los veo a todos en la trinchera.", 2.6);
      } };
      g.setObjective("Llega a la posici\xF3n de asalto", ...W(50, -21.2));
      await g.until(() => near([50, -21.2], 3));
    }
    if (at("b1")) {
      g.checkpoint("brecourt", "b1");
      followAll();
      for (const s of [mgA, mgB]) s.ai = { mode: "hold", engage: true, crouch: true, look: W(58, -8) };
      if (from === "b1") {
        mgA.x = W(36.7, -18.3)[0];
        mgA.z = W(36.7, -18.3)[1];
        mgB.x = W(42.8, -18.3)[0];
        mgB.z = W(42.8, -18.3)[1];
      }
      g.lockMove = true;
      await g.lines([[leadCast.short, "\xA1Fuego de cobertura! \xA1Ahora!", 1.6]]);
      g.lockMove = false;
      de.forEach((s) => s.aware = 1);
      const c = team.compton;
      c.ai = { mode: "move", path: [W(53, -17.5)], speedK: 1.3, crouch: false, engage: true };
      team.guarnere.ai = { mode: "move", path: [W(52.5, -19.5)], speedK: 1.25, engage: true };
      team.malarkey.ai = { mode: "move", path: [W(51.8, -20.5)], speedK: 1.25, engage: true };
      g.setObjective("Asalta el primer ca\xF1\xF3n", ...W(GUNS[0][0], GUNS[0][1]));
      const tC = g.t + 7;
      await g.until(() => g.dist(c, { x: W(53, -17.5)[0], z: W(53, -17.5)[1] }) < 1.5 || near([55, -15], 3) || g.t > tC);
      ui2.say("Compton", "\xA1Granada!", 1.2);
      c.grenades = 1;
      g.throwGrenade(c, { x: W(56.5, -12.5)[0], z: W(56.5, -12.5)[1] }, 1.6);
      await g.wait(0.6);
      const wynn = team.wynn;
      if (wynn.alive) {
        wynn.down = true;
        wynn.st.prone = 1;
        setTimeout(() => ui2.say("Wynn", "Lo siento, mi teniente. La he cagado.", 2.6), 1200);
      }
      team.toye.ai = { mode: "follow", slot: 1, engage: true };
      team.guarnere.ai = { mode: "follow", slot: 2, engage: true };
      for (const s of de) if (s.gun === 0) s.grenades = Math.max(s.grenades, 1);
      await g.until(() => gunClear(0) && near(GUNS[0], 7));
      g.lockMove = true;
      await g.lines([
        [leadCast.short, "\xA1El primer ca\xF1\xF3n es nuestro! Tres hombres aqu\xED. Los dem\xE1s, conmigo.", 3]
      ]);
      g.lockMove = false;
    }
    if (at("b2")) {
      g.checkpoint("brecourt", "b2");
      if (!g.flags.permadeath) {
        g.flags.permadeath = true;
        await ui2.card({
          kicker: "Br\xE9court Manor \xB7 08:45",
          title: "Desde aqu\xED, quien cae no vuelve",
          text: "La compa\xF1\xEDa ya ha tenido su bautismo de fuego. A partir de este momento, si el hombre que llevas muere, no habr\xE1 vuelta atr\xE1s: la historia seguir\xE1 con otro.",
          next: "Entendido"
        });
      }
      const mal = team.malarkey;
      if (mal && mal.alive) {
        await g.wait(2);
        const v = await ui2.card({
          kicker: "La funda negra",
          title: "Malarkey ve una Luger",
          text: "Bajo el fuego que barre el borde de la trinchera, Malarkey ve a un alem\xE1n muerto a diez metros, en campo abierto, con una funda de cuero negro al cinto. Ya est\xE1 apoyando el pie para saltar.",
          choices: [
            { label: "Dejarle ir", sub: "Quiz\xE1 lo tomen por un m\xE9dico.", value: "go" },
            { label: "\xAB\xA1Idiota, vuelve aqu\xED!\xBB", sub: "Nadie sale por un trofeo.", value: "stop" }
          ]
        });
        if (v === "go") {
          const [x, z] = W(56, -4);
          mal.ai = { mode: "move", path: [[x, z], W(59.5, -10.5)], speedK: 1.4, fire: false, onArrive: (s) => s.ai = { mode: "follow", slot: 3, engage: true } };
          setTimeout(() => {
            ui2.say("Malarkey", "Era el estuche de una mira de ca\xF1\xF3n\u2026 \xA1maldita sea!", 2.6);
            for (let i = 0; i < 8; i++) setTimeout(() => g.fx.dirt(mal.x + (Math.random() - 0.5) * 3, mal.z + (Math.random() - 0.5) * 3, 0.6), i * 120);
          }, 3200);
          g.flags.luger = true;
        } else {
          ui2.say("Malarkey", "Vale, vale\u2026 Pero era una Luger.", 2.2);
          mal.ai = { mode: "follow", slot: 3, engage: true };
        }
      }
      g.setObjective("Avanza por la trinchera: segundo ca\xF1\xF3n", ...W(GUNS[1][0], GUNS[1][1]));
      await g.until(() => gunClear(1) && near(GUNS[1], 8));
      const pr = [];
      for (let i = 0; i < 4; i++) {
        const s = german(g, 69 + i * 0.8, -1.5 - i * 0.6, { kit: "fj" });
        s.surrendered = true;
        s.ai = { mode: "scripted" };
        s.st.aim = 0;
        pr.push(s);
      }
      ui2.say("Alem\xE1n", "Nicht schie\xDFen! \xA1No matar! \xA1No matar!", 2.4);
      await g.wait(1.2);
      pr.forEach((s, i) => {
        s.ai = { mode: "scripted" };
        s.walkOff = W(40 - i, -21);
      });
      g.surrenderWalk = pr;
      ui2.say(leadCast.short, "Atr\xE1s, a retaguardia. Que nadie dispare.", 2.4);
      const hall = spawn(g, { ...CAST.hall, weapon: "m1" }, 56, -14);
      hall.protect = 0;
      hall.ai = { mode: "move", path: [W(60, -9), W(65.5, 1.5)], speedK: 1.3, engage: true, onArrive: (s) => s.ai = { mode: "hold", engage: true, crouch: true, look: W(70, 10) } };
      await g.wait(2.5);
      await g.lines([["Hall", "Soldado Hall, Compa\xF1\xEDa A. Me he perdido de los m\xEDos. \xBFPuedo ir con ustedes?", 3.2], [leadCast.short, "Bienvenido. Tercer ca\xF1\xF3n.", 1.8]]);
      g.setObjective("Toma el tercer ca\xF1\xF3n", ...W(GUNS[2][0], GUNS[2][1]));
      hall.protect = 0;
      hall.ai = { mode: "move", path: [W(66, 0.5), W(69.6, 3.2), W(70, 8.5)], speedK: 1.5, crouch: false, fire: false };
      const mg3 = de.find((s) => s.gun === 2 && s.wkind === "mg42");
      const tHall = g.t + 9;
      await g.until(() => !hall.alive || g.dist(hall, { x: W(70, 8.5)[0], z: W(70, 8.5)[1] }) < 1.8 || g.t > tHall);
      if (hall.alive) {
        if (mg3 && mg3.alive) {
          mg3.face(hall.x, hall.z, 1, 1);
          for (let i = 0; i < 6; i++) setTimeout(() => mg3.alive && g.fire(mg3, hall), i * 60);
        }
        setTimeout(() => g.kill(hall, mg3), 380);
      }
      await g.wait(0.8);
      g.slow = 0.4;
      g.audio.sting("grief");
      ui2.sayNow("", "John D. Hall, Compa\xF1\xEDa A. Llevaba diez minutos con ellos.", 3.6);
      await g.wait(1.6);
      g.slow = 1;
      g.flags.hallDead = true;
      await g.until(() => gunClear(2) && near(GUNS[2], 8));
      g.lockMove = true;
      await g.lines([[leadCast.short, "Tres ca\xF1ones. Once hombres. Estamos demasiado dispersos.", 3]]);
      g.lockMove = false;
    }
    if (at("b3")) {
      g.checkpoint("brecourt", "b3");
      const hes = spawn(g, { name: "Cap. Clarence Hester", short: "Hester", weapon: "m1" }, 60, -10);
      hes.protect = 2;
      hes.ai = { mode: "move", path: [W(63.5, -2.5), W(65.5, 8.5)], speedK: 1.2, fire: false, onArrive: (s) => s.ai = { mode: "hold", fire: false, crouch: true } };
      await g.until(() => g.dist(hes, win) < 4 || g.t > 0 && hes.ai.mode === "hold");
      await g.lines([["Hester", "Tres cartuchos de TNT. Uno por ca\xF1\xF3n, con una granada alemana dentro.", 3.2]]);
      g.tnt = 3;
      const planted = [false, false, false];
      const gp = g.lvl.gunPos;
      g.actions = [0, 1, 2].map((i) => ({
        x: gp[i][0],
        z: gp[i][1],
        r: 2.8,
        label: "Colocar TNT",
        enabled: () => !planted[i],
        run: async () => {
          planted[i] = true;
          g.lockMove = true;
          win.st.heal = 1;
          g.audio.reload();
          await g.wait(1.4);
          g.lockMove = false;
          ui2.toast("\xA1Mecha encendida! Al\xE9jate.", 1800);
          await g.wait(5);
          g.explode(gp[i][0], gp[i][1], 1.3, win, false);
          g.wreckGun(i);
        }
      }));
      g.setObjective("Inutiliza los ca\xF1ones con TNT (3)");
      const sp = [];
      for (let i = 0; i < 4; i++) {
        const s = spawn(g, { name: i ? "Compa\xF1\xEDa D" : "Tte. Ronald Speirs", short: i ? "D" : "Speirs", weapon: i ? "m1" : "thompson" }, 70 + i, 6 + i);
        s.protect = 2;
        s.ai = { mode: "move", path: [W(76, 18 + i), W(79 + i * 0.5, 25)], speedK: 1.2, engage: true };
        sp.push(s);
      }
      ui2.say("Speirs", `El cuarto es nuestro, ${leadCast.short}. Usted oc\xFApese de esos.`, 2.8);
      await g.until(() => planted.every(Boolean) && g.flags.wrecked >= 3);
      g4.forEach((s) => s.alive && g.kill(s, sp[0]));
      g.explode(...W(GUNS[3][0], GUNS[3][1]), 1.3, sp[0], true);
      g.wreckGun(3);
      g.actions = [];
    }
    if (at("b4")) {
      g.checkpoint("brecourt", "b4");
      manorMG.ai = { mode: "alert", static: true, react: 0.2 };
      manorMG.aware = 1.5;
      manorMG.target = win;
      g.manorFire = true;
      g.setObjective("\xA1Retirada! Vuelve al camino hundido. T\xFA, el \xFAltimo", ...W(40, -21.2));
      ui2.say(leadCast.short, "\xA1Ametralladoras primero, luego los fusileros! \xA1Atr\xE1s!", 2.6);
      const back = Object.values(team).concat([mgA, mgB]).filter((s) => s.alive);
      back.forEach((s, i) => s.ai = { mode: "move", path: [W(56, -14), W(52, -21), W(38 - i * 1.2, -21.2)], speedK: 1.25, engage: false, fire: false, onArrive: (q2) => q2.ai = { mode: "hold", crouch: true, fire: false } });
      await g.until(() => near([40, -21.2], 4));
      g.manorFire = false;
      return "end";
    }
    return "end";
  }
  var OUTRO = (g) => {
    const lead = g.save.lead === "lipton" ? "Lipton" : "Winters";
    const lines = [
      "A las 11:30, tres horas despu\xE9s de recibir la orden, la Compa\xF1\xEDa E se retira de Br\xE9court. Doce hombres, con Speirs y unos pocos de la Compa\xF1\xEDa D al final, han destruido una bater\xEDa que bat\xEDa la calzada y la playa Utah.",
      g.save.lead === "lipton" ? "Richard Winters no volvi\xF3 de aquella trinchera. Lipton sac\xF3 a los hombres de all\xED y nunca habl\xF3 de c\xF3mo. En una caja junto al segundo ca\xF1\xF3n quedaban los mapas con todas las posiciones alemanas de la pen\xEDnsula." : "En una caja junto al segundo ca\xF1\xF3n, Winters ha encontrado los mapas con las posiciones alemanas de toda la pen\xEDnsula. Los tanques podr\xE1n salir de la playa.",
      `Nadie se siente un h\xE9roe. Est\xE1n cansados, sucios, con los moratones del salto y la boca seca. Esa noche, ${lead} se arrodilla y da gracias por haber sobrevivido al D\xEDa D.`
    ];
    return lines;
  };

  // src/cones.js
  var RAYS = 15;
  var CALM = new T.Color(15909198);
  var ALERT = new T.Color(14238763);
  var Cones = class {
    constructor(scene2) {
      this.scene = scene2;
      this.pool = [];
      this.mat = new T.MeshBasicMaterial({ color: 16777215, vertexColors: true, transparent: true, opacity: 1, depthWrite: false, side: 2, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      this.ringGeo = ringGeo(0.55, 0.72, 28);
      this.ring = new T.Mesh(this.ringGeo, new T.MeshBasicMaterial({ color: 15260840, transparent: true, opacity: 0.7, depthWrite: false, depthTest: false, side: 2 }));
      this.ring.renderOrder = 20;
      scene2.add(this.ring);
    }
    _make() {
      const g = new T.BufferGeometry();
      const n = 1 + RAYS * 2;
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
      c.t -= dt;
      if (c.range !== range) c.t = 0;
      if (c.t <= 0) {
        c.t = 0.12;
        const ey = e.eye;
        for (let i = 0; i < RAYS; i++) {
          const a = e.ry - fov + 2 * fov * i / (RAYS - 1);
          const sx = Math.sin(a), sz = Math.cos(a);
          let lo = 0.5, hi = range;
          if (w.los(e.x, ey, e.z, e.x + sx * hi, w.height(e.x + sx * hi, e.z + sz * hi) + 1, e.z + sz * hi)) lo = hi;
          else
            for (let s = 0; s < 6; s++) {
              const mid = (lo + hi) / 2;
              const tx = e.x + sx * mid, tz = e.z + sz * mid;
              if (w.los(e.x, ey, e.z, tx, w.height(tx, tz) + 1, tz)) lo = mid;
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
      col[0] = cc.r;
      col[1] = cc.g;
      col[2] = cc.b;
      col[3] = A;
      for (let i = 0; i < RAYS; i++) {
        const a = e.ry - fov + 2 * fov * i / (RAYS - 1);
        const d = c.rays[i];
        for (const [k, f, al] of [[1 + i, 0.75, A], [1 + RAYS + i, 1, 0]]) {
          const x = e.x + Math.sin(a) * d * f, z = e.z + Math.cos(a) * d * f;
          pos[k * 3] = x;
          pos[k * 3 + 1] = w.height(x, z) + 0.07;
          pos[k * 3 + 2] = z;
          col[k * 4] = cc.r;
          col[k * 4 + 1] = cc.g;
          col[k * 4 + 2] = cc.b;
          col[k * 4 + 3] = al;
        }
      }
      c.g.attributes.position.needsUpdate = true;
      c.g.attributes.color.needsUpdate = true;
    }
  };
  function ringGeo(r0, r1, n) {
    const p = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const a = i / n * Math.PI * 2;
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

  // src/main.js
  var SAVE_KEY = "hds_dia_d_v1";
  var loadSave = () => {
    try {
      return JSON.parse(localStorage.getItem(SAVE_KEY)) || null;
    } catch {
      return null;
    }
  };
  var writeSave = (s) => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    } catch {
    }
  };
  var q = pickQuality();
  var canvas = document.getElementById("c");
  var R2 = new Renderer(canvas, q);
  var audio = new Audio();
  var uiRoot = document.getElementById("ui");
  var ui = new UI(uiRoot);
  var input = new Input(uiRoot);
  ui.bindInput(input);
  var camera = new T.OrthographicCamera(-10, 10, 10, -10, 1, 260);
  var G = null;
  var scene = null;
  var lvl = null;
  var save = loadSave() || { part: "night", cp: "n0", lead: "winters" };
  var running = false;
  function disposeScene(sc) {
    if (!sc) return;
    sc.traverse((o) => {
      if (o.geometry && !o.geometry._shared) o.geometry.dispose();
    });
  }
  function setupPart(part) {
    disposeScene(scene);
    scene = new T.Scene();
    const ctx = { scene, q };
    lvl = part === "night" ? buildNight(ctx) : buildBrecourt(ctx);
    (part === "night" ? gradeNight : gradeDawn)(R2.post);
    const fx = new FX(scene, lvl.world);
    G && G.abortScripts();
    G = new Game({ scene, camera, world: lvl.world, fx, audio, ui, input, renderer: R2 });
    G.lvl = lvl;
    G.save = save;
    G.cones = new Cones(scene);
    G.part = part;
    G.checkpoint = (p, cp) => {
      const first = save.cp === cp && save.part === p;
      save = { ...save, part: p, cp };
      G.save = save;
      writeSave(save);
      if (!first) ui.toast("Punto de control", 1400);
    };
    G.qte = (label, secs, target, short) => new Promise((res) => {
      input.pressed.qte = false;
      ui.qte(label, secs, short);
      G.slow = 0.4;
      G.qteTarget = target || null;
      const end = G.t + secs * 0.4;
      G.until(() => input.consume("qte") || input.consume("fire") || G.t > end).then(() => {
        const ok = G.t <= end;
        ui.qteHide();
        G.qteTarget = null;
        G.slow = 1;
        res(ok);
      }, () => ui.qteHide());
    });
    G.wreckGun = (i) => {
      const gp = lvl.gunPos[i];
      if (!gp || gp.wrecked) return;
      gp.wrecked = true;
      G.flags.wrecked = (G.flags.wrecked || 0) + 1;
      scene.remove(gp.mesh);
      const b = new Builder(70 + i);
      const y = lvl.world.height(gp[0], gp[1]);
      gun105(b, gp[0], y, gp[1], Math.atan2(-Math.SQRT1_2, -Math.SQRT1_2) + 0.35, { wrecked: true });
      const m = meshFrom(b, "world");
      scene.add(m);
      G.fx.addFire(gp[0], y + 1, gp[1], 0.5);
      setTimeout(() => G.fx.fires = G.fx.fires.filter((f) => f.x !== gp[0]), 9e3);
    };
    G.deathCard = async ({ guaranteed, who }) => {
      G.slow = 0.25;
      R2.post.desat.value = 0.8;
      audio.sting("grief");
      await new Promise((r) => setTimeout(r, 1600));
      G.paused = true;
      const nm = (who || G.player).name;
      if (guaranteed) {
        await ui.card({
          kicker: "A\xFAn no",
          title: `${nm} no cae aqu\xED`,
          text: "La historia necesita a este hombre vivo esta noche. Vuelves al \xFAltimo punto de control: lo que ocurra a partir de Br\xE9court ya no tendr\xE1 vuelta atr\xE1s.",
          next: "Reintentar"
        });
        restart();
      } else {
        const v = await ui.card({
          kicker: "Br\xE9court Manor",
          title: `${nm} ha ca\xEDdo`,
          text: "No hay vuelta atr\xE1s. Los hombres le ven caer en la trinchera y por un momento nadie dispara. Alguien tiene que llevarlos de vuelta.",
          choices: [
            { label: "Lipton toma el mando", sub: "La partida sigue sin \xE9l. Para siempre.", value: "go" },
            { label: "Volver al punto de control", sub: "Solo para este prototipo.", value: "retry" }
          ]
        });
        if (v === "go" && save.lead !== "lipton") {
          save = { ...save, lead: "lipton", fallen: [...save.fallen || [], "winters"] };
          writeSave(save);
        }
        restart();
      }
    };
    const baseUpdate = G.update.bind(G);
    G.update = (dt) => {
      baseUpdate(dt);
      G.cones.update(G, dt);
      if (!G.paused) {
        G.ambient && G.ambient(dt * G.slow);
        if (G.flickers) for (const l of G.flickers) l.intensity = 14 + Math.sin(G.t * 44) * 2.5 + Math.sin(G.t * 27) * 2;
        if (G.surrenderWalk)
          for (const s of G.surrenderWalk) {
            if (!s.alive || !s.walkOff) continue;
            s.surrendered = true;
            s.st.surr = 1;
            const arrived = G.moveTo(s, s.walkOff[0], s.walkOff[1], dt * G.slow, 0.5, 1);
            if (arrived) s.remove(), s.alive = false, s.walkOff = null;
          }
        if (G.manorFire && G.player) {
          G._mf = (G._mf || 0) - dt;
          if (G._mf <= 0) {
            G._mf = 0.07;
            const p = G.player;
            const [mx, mz] = W(87, 8);
            const tx = p.x + (Math.random() - 0.5) * 9, tz = p.z + (Math.random() - 0.5) * 9;
            G.fx.tracers.shoot(mx, lvl.world.height(mx, mz) + 1, mz, tx, lvl.world.height(tx, tz) + 0.2 + Math.random(), tz, [3.6, 1.4, 0.45], 80, 2.4, null);
            if (Math.random() < 0.3) setTimeout(() => G.fx.dirt(tx, tz, 0.5), 250);
            if (Math.random() < 0.08) audio.mg(mx, mz);
            if (Math.random() < 0.06) audio.whizz(0.6);
          }
        }
      }
      if (G.qteTarget) {
        const q2 = G.qteTarget;
        const [sx, sy] = G.project(q2.x, q2.y + 1, q2.z);
        ui.mark("qring", sx, sy + 32, "", "qring");
      }
      if (G.player && (input.mx || input.my || input.keys.KeyW || input.keys.KeyA || input.keys.KeyS || input.keys.KeyD)) ui.ghostOff();
      if (G.pingT > 0) {
        G.pingT -= dt;
        const [sx, sy] = G.project(G.ping.x, lvl.world.height(G.ping.x, G.ping.z) + 1.5, G.ping.z);
        ui.mark("ping", sx, sy, "\u266A", "ping");
      }
    };
    return G;
  }
  async function runPart(part, cp) {
    running = true;
    const g = setupPart(part);
    audio.listener = { x: 0, z: 0 };
    ui.show(true);
    ui.setCrouch(false);
    R2.post.fade.value = 1;
    try {
      let next;
      if (part === "night") {
        audio.startWind(0.22);
        audio.setWind(0.22);
        next = await nightScript(g, cp);
      } else {
        audio.startWind(0.12);
        audio.setWind(0.12);
        next = await brecourtScript(g, cp);
      }
      if (next === "brecourt") {
        await ui.fade(true, 1200);
        g.paused = true;
        await ui.card({
          kicker: "Le Grand Chemin \xB7 6 de junio \xB7 08:30",
          title: "Br\xE9court Manor",
          text: [
            "Al amanecer, la Compa\xF1\xEDa E es apenas un pu\xF1ado: dos ametralladoras ligeras, un bazuca sin munici\xF3n, un mortero, nueve fusileros y dos oficiales.",
            "A unos cientos de metros, tras los setos de una granja, cuatro ca\xF1ones de 105 mm disparan sobre la playa Utah. Los defienden unos cincuenta paracaidistas alemanes, comunicados por trincheras.",
            "El capit\xE1n Hester se lo dice a Winters sin rodeos: hay que acabar con esa bater\xEDa. Winters tiene trece hombres."
          ],
          next: "\xAB\xA1Seguidme!\xBB"
        });
        save = { ...save, part: "brecourt", cp: "b0" };
        writeSave(save);
        await ui.fade(false, 10);
        return runPart("brecourt", "b0");
      }
      if (next === "end") {
        await ui.fade(true, 1400);
        g.paused = true;
        audio.sting("dawn");
        await ui.card({ kicker: "Normand\xEDa \xB7 6 de junio de 1944", title: "Fin del D\xEDa D", text: OUTRO(g), next: "Seguir" });
        const k = g.flags.kills || 0;
        await ui.card({
          kicker: "Lo que queda",
          title: "Br\xE9court, en n\xFAmeros",
          text: `Ca\xF1ones destruidos: 4 de 4. Alemanes abatidos por tu mano: ${k}. Toye: ${g.flags.toyeSaved ? "ileso, con la culata destrozada" : "herido, pero sigue en pie"}. Malarkey: ${g.flags.luger ? "volvi\xF3 sin la Luger y con la cara llena de barro" : "nunca supo qu\xE9 hab\xEDa en aquella funda"}. ${save.lead === "lipton" ? "Winters: ca\xEDdo en la trinchera." : "Winters: vivo."}

Este es el prototipo del modo soldado. Siguiente cap\xEDtulo: Carentan.`,
          next: "Volver al t\xEDtulo"
        });
        save = { part: "night", cp: "n0", lead: "winters" };
        writeSave(save);
        running = false;
        title();
      }
    } catch (e) {
      if (e && e.message === "abort") return;
      console.error(e);
    }
  }
  function restart() {
    ui.cards.innerHTML = "";
    G.abortScripts();
    R2.post.desat.value = 0;
    runPart(save.part, save.cp);
  }
  var PLANE_SVG = `<svg viewBox="0 0 96 40"><path d="M4 20 Q10 16 30 17 L44 3 L52 3 L46 17 L70 18 L80 10 L86 10 L84 19 Q92 20 92 21 Q92 22 84 23 L86 30 L80 30 L70 23 L46 24 L52 37 L44 37 L30 24 Q10 25 4 21 Z"/></svg>`;
  var CHUTE_SVG = `<svg viewBox="0 0 22 30"><path d="M1 9 Q11 -3 21 9 Q16 7 11 9 Q6 7 1 9 Z" fill="#c9c6b8" opacity=".9"/><path d="M2 9 L11 24 M20 9 L11 24 M11 9 L11 24" stroke="#9aa0a8" stroke-width=".6"/><rect x="9.5" y="23" width="3" height="6" rx="1" fill="#1a1e26"/></svg>`;
  function title() {
    ui.show(false);
    setupPart("night");
    G.paused = false;
    G.title = true;
    nightAmbience(G);
    G.cam.span = 26;
    const [x0, z0] = W(30, 6);
    G.cam.x = x0;
    G.cam.z = z0;
    const has = save && !(save.part === "night" && save.cp === "n0");
    const w = document.createElement("div");
    w.className = "title";
    w.innerHTML = `<div class="eyebrow">Compa\xF1\xEDa E \xB7 506.\xBA Paracaidista \xB7 101.\xAA Aerotransportada</div>
    <div class="logo"><h1>Hermanos<br><span>de sangre</span></h1><div class="sub">Cap\xEDtulo III \xB7 D\xEDa D</div></div>
    <div class="tbtns">${has ? `<button class="btn big cont">Continuar</button>` : ""}<button class="btn ${has ? "ghost" : "big"} start">${has ? "Empezar de nuevo" : "Comenzar"}</button></div>
    <blockquote>Saltaron a muy poca altura desde aviones que volaban demasiado r\xE1pido, cargados con m\xE1s equipo del que nunca hab\xEDan llevado.<cite>Basado en \xABHermanos de sangre\xBB, de Stephen E. Ambrose</cite></blockquote>
    <div class="foot">Usa auriculares \xB7 Prototipo del modo soldado \xB7 <a class="chap7" href="bastogne.html">Cap\xEDtulo VII \xB7 Bastogne</a></div>
    <div class="tsky"><div class="moon"></div>${[0, 1, 2].map((i) => `<div class="plane" style="top:${18 + i * 4}%;animation-delay:${-i * 1.2 - 3}s;width:${96 - i * 14}px">${PLANE_SVG}</div>`).join("")}
    ${[0, 1, 2, 3, 4, 5].map((i) => `<div class="flak" style="left:${12 + i * 14}%;animation-delay:${i * 0.37}s"></div>`).join("")}
    ${[0, 1, 2, 3].map((i) => `<div class="chute" style="left:${8 + i * 21}%;top:${10 + i % 2 * 6}%;animation-delay:${-i * 3.4}s">${CHUTE_SVG}</div>`).join("")}</div>`;
    ui.cards.appendChild(w);
    const go = async (fresh) => {
      audio.init();
      audio.resume();
      w.remove();
      if (fresh) {
        save = { part: "night", cp: "n0", lead: "winters" };
        writeSave(save);
        await ui.card({
          kicker: "Normand\xEDa \xB7 6 de junio de 1944 \xB7 01:10",
          title: "\xAB\xA1Seguidme!\xBB",
          text: [
            "Los hombres saltaron desde demasiado poca altura, en aviones que volaban demasiado r\xE1pido. Las bolsas de pierna, una idea brit\xE1nica que nadie hab\xEDa probado, se soltaron al abrirse los paraca\xEDdas y cayeron a la oscuridad.",
            "El teniente Richard Winters cae a las afueras de Sainte-M\xE8re-\xC9glise. Ve el incendio junto a la iglesia y oye su campana. Ha perdido el fusil. Solo le queda la bayoneta, metida en la bota."
          ],
          next: "Saltar"
        });
      }
      runPart(save.part, save.cp);
    };
    w.querySelector(".start").onclick = () => go(true);
    const c = w.querySelector(".cont");
    if (c) c.onclick = () => go(false);
  }
  ui.onPause = async () => {
    if (!G || G.title) return;
    G.paused = true;
    const v = await ui.card({
      kicker: "Pausa",
      title: "Hermanos de sangre",
      text: "Controles: arrastra en la mitad izquierda para moverte. Disparo con apuntado asistido, agacharse, granada, venda y acci\xF3n.\n\nDe noche te ven si entras en su campo de visi\xF3n, si te mueves de pie o si est\xE1s cerca de una luz. Los setos cortan la vista; las trincheras y los terraplenes cubren.",
      choices: [
        { label: "Seguir", value: "go" },
        { label: "Volver al punto de control", value: "cp" },
        { label: "Salir al t\xEDtulo", value: "title" }
      ]
    });
    if (v === "cp") restart();
    else if (v === "title") {
      G.abortScripts();
      title();
    } else G.paused = false;
  };
  var last = performance.now();
  var fpsEl = new URLSearchParams(location.search).get("fps") ? document.createElement("div") : null;
  if (fpsEl) {
    fpsEl.className = "fps";
    document.body.appendChild(fpsEl);
  }
  var simAcc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const real = Math.min(0.25, (now - last) / 1e3);
    last = now;
    simAcc += real;
    const steps = Math.min(5, Math.max(1, Math.round(simAcc / 0.034)));
    const dt = Math.min(0.05, simAcc / steps);
    simAcc = 0;
    if (!G) return;
    if (G.title) {
      G.cam.x += dt * 0.6;
      G.cam.z -= dt * 0.25;
      U.time.value += dt;
      G.fx.update(dt);
      G.ambient && G.ambient(dt);
      G.updateCamera(0);
      R2.post.fade.value = damp(R2.post.fade.value, 0, 1.5, dt);
    } else {
      for (let i = 0; i < steps; i++) G.update(dt);
      R2.post.fade.value = damp(R2.post.fade.value, 0, 2, real);
      if (G.player) audio.listener = { x: G.player.x, z: G.player.z };
      const want = G.camSpan || 12.5;
      if (Math.abs(G.cam.span - want) > 0.05) G.cam.span = damp(G.cam.span, want, 0.8, real);
    }
    const L = lvl.L;
    if (L && L.sun.castShadow) {
      const c = G.cam;
      const fx = c.x - Math.sin(c.yaw) * 7, fz = c.z - Math.cos(c.yaw) * 7;
      const y = lvl.world.height(fx, fz);
      L.sun.position.set(fx + L.dir[0] * 60, y + L.dir[1] * 60, fz + L.dir[2] * 60);
      L.sun.target.position.set(fx, y, fz);
      L.sun.target.updateMatrixWorld();
    }
    if (G.player && G.player.alive && !G.title) {
      const [sx, sy] = G.project(G.player.x, G.player.y + 1, G.player.z);
      U.focus.value.set(sx / innerWidth * R2.w, (1 - sy / innerHeight) * R2.h, G.player.y, 95 * (R2.h / innerHeight));
    } else U.focus.value.set(-9999, -9999, 0, 0);
    R2.render(scene, camera, now / 1e3);
    R2.adapt(real);
    if (fpsEl) fpsEl.textContent = `${Math.round(R2.fps)} fps \xB7 ${q.name} \xB7 res ${Math.round(R2.dyn * 100)}% \xB7 ${R2.r.info.render.calls} dc`;
  }
  var QS = new URLSearchParams(location.search);
  if (QS.get("cp")) {
    audio.init();
    save = { part: QS.get("part") || (QS.get("cp")[0] === "b" ? "brecourt" : "night"), cp: QS.get("cp"), lead: QS.get("lead") || "winters" };
    runPart(save.part, save.cp);
  } else title();
  requestAnimationFrame(frame);
  window.__G = () => G;
  window.__R = R2;
})();
