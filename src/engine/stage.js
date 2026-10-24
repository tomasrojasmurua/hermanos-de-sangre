// Ayudantes genéricos para montar un escenario: cielo, luces, mata de hierba y textura de cartel.
import { T } from "./util.js";

export function sky(scene, top, bottom) {
  const g = new T.SphereGeometry(400, 16, 8);
  const m = new T.ShaderMaterial({
    side: 1, depthWrite: false, fog: false,
    uniforms: { top: { value: new T.Color(top) }, bot: { value: new T.Color(bottom) } },
    vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: "uniform vec3 top; uniform vec3 bot; varying vec3 vP; void main(){ float h = normalize(vP).y; gl_FragColor = vec4(mix(bot, top, smoothstep(-0.2, 0.6, h)), 1.0); }",
  });
  const s = new T.Mesh(g, m);
  s.renderOrder = -10;
  scene.add(s);
  return s;
}

export function lights(scene, o) {
  const hemi = new T.HemisphereLight(o.sky, o.ground, o.hemi);
  scene.add(hemi);
  const sun = new T.DirectionalLight(o.sunCol, o.sun);
  sun.position.set(o.dir[0] * 60, o.dir[1] * 60, o.dir[2] * 60);
  sun.castShadow = o.shadow > 0;
  if (sun.castShadow) {
    sun.shadow.mapSize.set(o.shadow, o.shadow);
    const c = sun.shadow.camera;
    c.left = -36; c.right = 36; c.top = 36; c.bottom = -36; c.near = 1; c.far = 180;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.04;
  }
  scene.add(sun);
  scene.add(sun.target);
  return { hemi, sun, dir: o.dir };
}

// grass clump: wide blades fanning out from a root, darker at the base
export function tuft(b, col = 0x5f7a3a) {
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const h = 0.32 + Math.random() * 0.3, w = 0.07 + Math.random() * 0.04, lean = 0.12 + Math.random() * 0.16;
    const m = new T.Matrix4().makeRotationY(a);
    b.tris([-w, 0, 0, w, 0, 0, w * 0.2, h, lean], col, { mat: m, jit: 0.2, grad: { y0: 0, y1: 0.5, k: 0.22 } });
  }
}

export function signTexture(text, o = {}) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const x = c.getContext("2d");
  x.fillStyle = o.bg || "#b9b2a2";
  x.fillRect(0, 0, 256, 64);
  x.fillStyle = o.fg || "#2a2a28";
  x.font = o.font || "bold 26px Georgia, serif";
  x.textAlign = "center";
  x.fillText(text, 128, 42);
  const t = new T.CanvasTexture(c);
  t.colorSpace = "srgb";
  return t;
}

