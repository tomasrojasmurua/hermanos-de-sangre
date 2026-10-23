// Renderer + one cheap post pass (tone map, grade, bloom, vignette, grain, hurt, warm flash).
// Quality picks itself for phones and adapts resolution to hold the frame rate.
import { T, clamp } from "./util.js";

export function pickQuality() {
  const q = new URLSearchParams(location.search).get("q");
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && innerWidth < 1100);
  const Q = {
    low: { name: "low", dpr: 1, scale: 0.8, shadow: 0, bloom: false, grass: 0.45, props: 0.6 },
    mid: { name: "mid", dpr: 1.5, scale: 1, shadow: 1024, bloom: true, grass: 0.75, props: 0.85 },
    high: { name: "high", dpr: 2, scale: 1, shadow: 2048, bloom: true, grass: 1, props: 1 },
  };
  return Q[q] || (mobile ? Q.mid : Q.high);
}

const VS = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
const BRIGHT = `uniform sampler2D tex; uniform float thr; varying vec2 vUv;
void main(){ vec3 c = texture2D(tex, vUv).rgb; if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0); c = min(c, vec3(16.0)); float l = max(max(c.r,c.g),c.b);
  gl_FragColor = vec4(c * smoothstep(thr, thr + 0.8, l), 1.0); }`;
const BLUR = `uniform sampler2D tex; uniform vec2 dir; varying vec2 vUv;
void main(){ vec3 s = texture2D(tex, vUv).rgb * 0.227;
  s += texture2D(tex, vUv + dir * 1.385).rgb * 0.316; s += texture2D(tex, vUv - dir * 1.385).rgb * 0.316;
  s += texture2D(tex, vUv + dir * 3.231).rgb * 0.070; s += texture2D(tex, vUv - dir * 3.231).rgb * 0.070;
  gl_FragColor = vec4(s, 1.0); }`;
const FINAL = `uniform sampler2D tex; uniform sampler2D bloom; uniform float useBloom; uniform vec2 res; uniform float time;
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

export class Renderer {
  constructor(canvas, quality) {
    this.q = quality;
    const r = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", stencil: false });
    r.outputColorSpace = "srgb-linear";
    r.toneMapping = 0;
    r.shadowMap.enabled = quality.shadow > 0;
    r.shadowMap.type = 2; // PCFSoft
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
      tex: { value: null }, bloom: { value: null }, useBloom: { value: quality.bloom ? 1 : 0 }, res: { value: new T.Vector2() }, time: { value: 0 },
      exposure: { value: 1 }, sat: { value: 0.9 }, con: { value: 1.05 }, shT: { value: new T.Color(0.9, 0.95, 1.1) }, hiT: { value: new T.Color(1.05, 1, 0.92) },
      lift: { value: new T.Color(0.01, 0.015, 0.03) }, topGlow: { value: new T.Color(0, 0, 0) }, vig: { value: 0.55 }, grain: { value: 0.05 }, hurt: { value: 0 }, flash: { value: 0 }, fade: { value: 0 }, bloomK: { value: 0.55 }, desat: { value: 0 },
    };
    this.mFinal = new T.ShaderMaterial({ vertexShader: VS, fragmentShader: FINAL, uniforms: this.post, depthTest: false });
    this.resize();
    window.addEventListener("resize", () => (this.pendingResize = true));
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
  render(scene, camera, t) {
    const r = this.r;
    // resizing clears the canvas: only ever do it right before drawing a full frame
    if (this.pendingResize) {
      this.pendingResize = false;
      this.resize();
    }
    r.setRenderTarget(this.rt);
    r.render(scene, camera);
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
}

export function setGrade(post, g) {
  for (const k in g) {
    const u = post[k];
    if (!u) continue;
    if (u.value && u.value.isColor) u.value.setRGB(...g[k]);
    else u.value = g[k];
  }
}
