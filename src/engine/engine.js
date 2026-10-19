// The compositor. A scene is a back-to-front list of layers (baked texture
// cards, procedural shader cards, per-frame Canvas2D cards) placed in a 2.5D
// parallax space and seen through one camera. Design space is always
// 1920x1080 px with y down; the render scale only changes pixel density.

import { createGL, compile, setUniforms, texFromSource, updateTexFromSource, configureTex, createTarget, deleteTarget, bindTarget, drawQuad } from './gl.js';
import { HEADER, NOISE, INK } from './glsl.js';
import { makeRng, makeNoise } from './rng.js';

export const W = 1920, H = 1080;
const FAR = 1e5;

// ---------------------------------------------------------------- shaders
const CARD_VS = HEADER + /* glsl */ `
in vec2 aPos;
uniform vec4 uDrawRect;   // rest-space rect this card covers (x,y,w,h)
uniform float uZ;         // depth: 1 = picture plane, larger = farther
uniform vec4 uCam;        // pan x, pan y, dolly, zoom
uniform float uRoll;
uniform vec2 uDesign;
out vec2 vUV;             // 0..1 across the draw rect, y down
out vec2 vP;              // rest-space position in design px, y down
void main() {
  vec2 P = uDrawRect.xy + aPos * uDrawRect.zw;
  vUV = aPos; vP = P;
  vec2 C = uDesign * 0.5;
  float zz = max(uZ - uCam.z, 1e-3);
  vec2 S = C + ((P - C) * uZ - uCam.xy) / zz * uCam.w;
  vec2 d = S - C; float c = cos(uRoll), s = sin(uRoll);
  S = C + vec2(c * d.x - s * d.y, s * d.x + c * d.y);
  vec2 ndc = S / uDesign * 2.0 - 1.0; ndc.y = -ndc.y;
  gl_Position = vec4(ndc, 0.0, 1.0);
}`;

const FULL_VS = HEADER + /* glsl */ `
in vec2 aPos;
uniform vec2 uDesign;
out vec2 vUV;   // GL orientation (y up) for sampling targets
out vec2 vP;    // design px, y down
void main() { vUV = aPos; vP = vec2(aPos.x, 1.0 - aPos.y) * uDesign; gl_Position = vec4(aPos * 2.0 - 1.0, 0.0, 1.0); }`;

const BAKE_VS = HEADER + /* glsl */ `
in vec2 aPos;
uniform vec2 uSize;
out vec2 vUV; out vec2 vP;
void main() { vUV = aPos; vP = aPos * uSize; gl_Position = vec4(aPos * 2.0 - 1.0, 0.0, 1.0); }`;

const COMMON_UNIFORMS = /* glsl */ `
uniform float uTime;      // scene-local seconds
uniform vec4 uCam;
uniform float uRS;        // render scale (pixel density)
uniform vec2 uDesign;
uniform float uOpacity;
`;

const TEX_FS = HEADER + NOISE + COMMON_UNIFORMS + /* glsl */ `
in vec2 vUV; in vec2 vP;
uniform sampler2D uTex;
uniform vec4 uRect;        // source rect (same as draw rect for plain cards)
uniform vec4 uSway;        // amp px, freq Hz, spatial scale px, falloff power
uniform vec4 uSwayAnchor;  // anchor x, y, radius px, lean bias
uniform vec4 uTint;        // rgb multiply, a = amount
out vec4 o;
void main() {
  vec2 uv = vUV;
  if (uSway.x > 0.0) {
    float w = pow(clamp(distance(vP, uSwayAnchor.xy) / uSwayAnchor.z, 0.0, 1.0), uSway.w);
    vec2 q = vP / uSway.z;
    float tt = uTime * uSway.y;
    float base = sin(tt * 6.2831853 + dot(q, vec2(0.9, 0.35)));
    float gust = snoise3(vec3(q * 0.7, tt * 0.35));
    float flut = snoise3(vec3(q * 3.1 + 7.0, tt * 1.7));
    vec2 d = uSway.x * w * vec2(0.62 * base + 0.38 * gust + uSwayAnchor.w + 0.12 * flut, 0.22 * snoise3(vec3(q + 9.0, tt * 0.5)) + 0.08 * flut);
    uv -= d / uRect.zw;
  }
  vec4 c = texture(uTex, uv);
  vec2 inb = step(vec2(0.0), uv) * step(uv, vec2(1.0));
  c *= inb.x * inb.y;
  c.rgb = mix(c.rgb, c.rgb * uTint.rgb, uTint.a);
  o = c * uOpacity;
}`;

const REFLECT_FS = HEADER + NOISE + COMMON_UNIFORMS + /* glsl */ `
in vec2 vUV; in vec2 vP;
uniform sampler2D uTex;
uniform vec4 uRect;      // source card rect
uniform vec4 uRefl;      // waterline y, strength, fade length px, smear px
uniform vec4 uRipple;    // amplitude px, wavelength px, speed, streak breakup 0..1
uniform vec3 uReflTint;  // multiply on reflected colour
uniform vec3 uWaterTone; // paper/water colour the reflection fades into (premult over)
out vec4 o;
vec4 src(vec2 q) {
  vec2 uv = (q - uRect.xy) / uRect.zw;
  vec2 inb = step(vec2(0.0), uv) * step(uv, vec2(1.0));
  return texture(uTex, uv) * inb.x * inb.y;
}
void main() {
  float dy = vP.y - uRefl.x;
  if (dy < 0.0) discard;
  float L = max(uRefl.z, 1.0);
  float wl = max(uRipple.y, 1.0);
  float grow = 1.0 + dy / L * 1.6;
  float tt = uTime * uRipple.z;
  float rx = uRipple.x * grow * (0.65 * snoise(vec2(vP.y / wl, tt + vP.x / (wl * 30.0))) + 0.35 * sin(vP.y / wl * 9.0 + tt * 4.0 + snoise(vec2(vP.x / 300.0, vP.y / 90.0)) * 2.0));
  float ry = uRipple.x * 0.25 * snoise(vec2(vP.x / (wl * 10.0), vP.y / wl + tt));
  vec2 ps = vec2(vP.x + rx, uRefl.x - dy + ry);
  vec4 acc = vec4(0.0); float ws = 0.0;
  float sm = uRefl.w * (0.35 + dy / L);
  for (int i = -4; i <= 4; i++) {
    float fi = float(i);
    float w = exp(-fi * fi / 8.0);
    acc += src(ps + vec2(0.0, fi * sm * 0.5)) * w; ws += w;
  }
  acc /= ws;
  float fade = exp(-dy / L);
  float br = snoise(vec2(vP.x / 520.0 + tt * 0.05, vP.y / (wl * 0.6))) * 0.5 + 0.5;
  float streak = smoothstep(0.58, 0.92, br) * uRipple.w;
  float k = uRefl.y * fade * (1.0 - streak);
  acc.rgb *= uReflTint;
  o = acc * k * uOpacity;
}`;

const SHADER_HEAD = HEADER + NOISE + INK + COMMON_UNIFORMS + /* glsl */ `
in vec2 vUV; in vec2 vP;
uniform vec4 uRect;
out vec4 o;
`;
const SHADER_FOOT = /* glsl */ `
void main() { vec4 c = shade(vP, vUV); o = c * uOpacity; }`;

const BAKE_HEAD = HEADER + NOISE + INK + /* glsl */ `
in vec2 vUV; in vec2 vP;
uniform vec2 uSize;
out vec4 o;
`;
const BAKE_FOOT = /* glsl */ `
void main() { o = shade(vP, vUV); }`;

const PAPER_BAKE_FS = HEADER + NOISE + INK + /* glsl */ `
in vec2 vUV; in vec2 vP;
uniform vec2 uSize;
out vec4 o;
void main() { float f = paperField(vec2(vP.x, vP.y)); o = vec4(f * 0.5 + 0.5, 0.0, 0.0, 1.0); }`;

const POST_FS = HEADER + NOISE + INK + /* glsl */ `
in vec2 vUV; in vec2 vP;
uniform sampler2D uSrc;
uniform sampler2D uPaper;
uniform vec4 uGrade;     // exposure, contrast, saturation, paper texture amount
uniform vec3 uTintMul;   // overall colour multiply
uniform vec4 uLift;      // rgb lift toward, a = amount (fade toward a paper colour)
uniform float uVignette;
uniform float uDither;
uniform float uDoGrade;  // 1: apply exposure/contrast/saturation/tint/lift
uniform float uDoFinal;  // 1: apply paper fibre, vignette, dither
uniform vec4 uInk;       // final-stage ink unify: x pigment wicking, y edge wobble (px), z wick radius (px)
out vec4 o;
void main() {
  vec2 uv = vUV;
  vec2 srcTexel = 1.0 / vec2(textureSize(uSrc, 0));
  float dens = float(textureSize(uSrc, 0).x) / 1920.0;
  if (uDoFinal > 0.5 && uInk.y > 0.0) {
    // edges wobble along the paper fibres, as if the ink had soaked into them
    vec2 pu = vec2(vUV.x, 1.0 - vUV.y);
    vec2 pt = 1.0 / vec2(textureSize(uPaper, 0));
    float gx = texture(uPaper, pu + vec2(pt.x * 2.0, 0.0)).r - texture(uPaper, pu - vec2(pt.x * 2.0, 0.0)).r;
    float gy = texture(uPaper, pu + vec2(0.0, pt.y * 2.0)).r - texture(uPaper, pu - vec2(0.0, pt.y * 2.0)).r;
    uv += vec2(gx, -gy) * uInk.y * 20.0 * srcTexel * dens;
  }
  vec3 c = texture(uSrc, uv).rgb;
  if (uDoFinal > 0.5 && uInk.x > 0.0) {
    // pigment creeps a little way into the lighter paper around dark strokes
    vec3 mn = c, acc = vec3(0.0);
    float rad = max(uInk.z, 0.5) * dens;
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.7853982 + 0.39;
      vec3 s = texture(uSrc, uv + vec2(cos(a), sin(a)) * rad * srcTexel).rgb;
      acc += s; mn = min(mn, s);
    }
    acc /= 8.0;
    vec3 wick = min(c, mix(acc, mn, 0.35) + 0.025);
    c = mix(c, wick, uInk.x);
  }
  if (uDoGrade > 0.5) {
    c *= uGrade.x;
    float L = luma(c);
    c = mix(vec3(L), c, uGrade.z);
    c = (c - 0.62) * uGrade.y + 0.62;
    c *= uTintMul;
    c = mix(c, uLift.rgb, uLift.a);
  }
  if (uDoFinal > 0.5) {
    float pf = texture(uPaper, vec2(vUV.x, 1.0 - vUV.y)).r * 2.0 - 1.0;
    float dark = 1.0 - luma(c);
    c *= 1.0 + uGrade.w * pf * (0.45 + 1.1 * dark);
    vec2 d = (vUV - 0.5) * vec2(1.0, 0.82);
    float v = smoothstep(0.30, 0.92, length(d) * 1.3);
    c *= 1.0 - uVignette * v;
    float n = hash12(gl_FragCoord.xy + 0.37) + hash12(gl_FragCoord.xy * 1.37 + 11.1) - 1.0;
    c += n * uDither / 255.0;
  }
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

// Packs a float RGB frame into planar YUV 4:2:0 (BT.709, limited range), 4 bytes per texel,
// rows in memory order (Y plane, then U, then V), top image row first. Output size (W/4) x (1.5 H).
const YUV_FS = HEADER + NOISE + /* glsl */ `
in vec2 vUV; in vec2 vP;
uniform sampler2D uSrc;
uniform ivec2 uSize;   // frame size in px
out vec4 o;
vec3 px(int x, int y) { return clamp(texelFetch(uSrc, ivec2(x, uSize.y - 1 - y), 0).rgb, 0.0, 1.0); }
float Yof(vec3 c) { return 16.0 + 219.0 * dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float byteAt(int idx) {
  int W = uSize.x, H = uSize.y;
  int npx = W * H;
  float d = (hash12(vec2(float(idx % 4093), float(idx / 4093)) + 0.31) - 0.5) + (hash12(vec2(float(idx / 3001), float(idx % 3001)) * 1.7 + 4.2) - 0.5);
  if (idx < npx) {
    return clamp(floor(Yof(px(idx % W, idx / W)) + 0.5 + d * 0.5), 0.0, 255.0);
  }
  int j = idx - npx;
  int q = npx / 4;
  bool isV = j >= q;
  if (isV) j -= q;
  int hw = W / 2;
  int x = (j % hw) * 2, y = (j / hw) * 2;
  vec3 c = (px(x, y) + px(x + 1, y) + px(x, y + 1) + px(x + 1, y + 1)) * 0.25;
  float Yn = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float v = isV ? 128.0 + 224.0 * (c.r - Yn) / 1.5748 : 128.0 + 224.0 * (c.b - Yn) / 1.8556;
  return clamp(floor(v + 0.5 + d * 0.5), 0.0, 255.0);
}
void main() {
  ivec2 f = ivec2(gl_FragCoord.xy);
  int base = (f.y * (uSize.x / 4) + f.x) * 4;
  o = vec4(byteAt(base), byteAt(base + 1), byteAt(base + 2), byteAt(base + 3)) / 255.0;
}`;

const COPY_FS = HEADER + /* glsl */ `
in vec2 vUV; in vec2 vP;
uniform sampler2D uSrc; uniform float uGain;
out vec4 o;
void main() { o = texture(uSrc, vUV) * uGain; }`;

// ---------------------------------------------------------------- helpers
const isFn = (v) => typeof v === 'function';
const val = (v, t, layer) => (isFn(v) ? v(t, layer) : v);

function blendFor(gl, mode) {
  gl.enable(gl.BLEND);
  if (mode === 'multiply') gl.blendFunc(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA);
  else if (mode === 'screen') gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
  else if (mode === 'add') gl.blendFunc(gl.ONE, gl.ONE);
  else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
}

// ---------------------------------------------------------------- engine
export class Engine {
  constructor(canvas, { scale = 1 } = {}) {
    this.canvas = canvas;
    this.scale = scale;
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(H * scale);
    this.pw = canvas.width; this.ph = canvas.height;
    const gl = (this.gl = createGL(canvas));
    this.progCache = new Map();
    this.cardTex = this.program(CARD_VS, TEX_FS, 'card-tex');
    this.cardReflect = this.program(CARD_VS, REFLECT_FS, 'card-reflect');
    this.post = this.program(FULL_VS, POST_FS, 'post');
    this.copy = this.program(FULL_VS, COPY_FS, 'copy');
    this.targets = {
      sceneA: createTarget(gl, this.pw, this.ph),
      sceneB: createTarget(gl, this.pw, this.ph),
      comp: createTarget(gl, this.pw, this.ph),
      accum: createTarget(gl, this.pw, this.ph),
      tmp: createTarget(gl, this.pw, this.ph),
    };
    // static paper fibre field in screen space, baked once
    const paper = createTarget(gl, this.pw, this.ph, { float: false });
    const pp = this.program(BAKE_VS, PAPER_BAKE_FS, 'paper-bake');
    bindTarget(gl, paper);
    gl.disable(gl.BLEND);
    gl.useProgram(pp.prog);
    setUniforms(gl, pp, { uSize: [W, H] });
    drawQuad(gl);
    this.paperTex = paper;
    this.defaultGrade = { exposure: 1, contrast: 1, saturation: 1, paper: 0.045, tint: [1, 1, 1], lift: [0.93, 0.9, 0.84, 0], vignette: 0.10, dither: 1.0, ink: [0, 0, 1.6, 0] };
    this.gradeOverride = null;   // tools can force grade values (e.g. to A/B the ink pass)
  }

  program(vs, fs, label) {
    const key = vs + '\u0000' + fs;
    let p = this.progCache.get(key);
    if (!p) { p = compile(this.gl, vs, fs, label); this.progCache.set(key, p); }
    return p;
  }

  // ---------------- baking (build time) ----------------
  // Draw with Canvas2D in design px. Returns a texture card source.
  bakeCanvas(w, h, draw, { scale = 1, mipmap = true, keepCanvas = false } = {}) {
    const k = scale * this.scale;
    const pw = Math.max(1, Math.round(w * k)), ph = Math.max(1, Math.round(h * k));
    const cv = new OffscreenCanvas(pw, ph);
    const ctx = cv.getContext('2d');
    ctx.setTransform(pw / w, 0, 0, ph / h, 0, 0);
    draw(ctx, { w, h, pw, ph, k: pw / w });
    const tex = texFromSource(this.gl, cv, { mipmap });
    return { tex, w, h, pw, ph, canvas: keepCanvas ? cv : null };
  }

  // Wrap any image source (canvas you drew yourself) as a texture.
  texture(src, { mipmap = true, w, h } = {}) {
    const tex = texFromSource(this.gl, src, { mipmap });
    return { tex, w: w ?? src.width / this.scale, h: h ?? src.height / this.scale, pw: src.width, ph: src.height };
  }

  // Procedural GLSL bake. `frag` defines: vec4 shade(vec2 p, vec2 uv) returning PREMULTIPLIED rgba,
  // with p in design px over [0,w]x[0,h] (y down). Extra samplers/uniforms come through opts.
  bakeShader(w, h, frag, { scale = 1, uniforms = {}, mipmap = true, float = false } = {}) {
    const gl = this.gl;
    const k = scale * this.scale;
    const pw = Math.max(1, Math.round(w * k)), ph = Math.max(1, Math.round(h * k));
    const target = createTarget(gl, pw, ph, { float, mipmap });
    const p = this.program(BAKE_VS, BAKE_HEAD + frag + BAKE_FOOT, 'bake');
    bindTarget(gl, target);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(p.prog);
    setUniforms(gl, p, { uSize: [w, h], ...uniforms });
    drawQuad(gl);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(target.fb);
    if (mipmap) { gl.bindTexture(gl.TEXTURE_2D, target.tex); gl.generateMipmap(gl.TEXTURE_2D); }
    return { tex: target.tex, w, h, pw, ph };
  }

  // Run a GLSL pass over an existing texture card (e.g. ink granulation, edge darkening).
  // `frag` defines vec4 shade(vec2 p, vec2 uv) and can sample uSrc (premultiplied) and use uTexel.
  processTex(src, frag, { uniforms = {}, mipmap = true, scale = 1 } = {}) {
    const head = 'uniform sampler2D uSrc;\nuniform vec2 uTexel;\n';
    return this.bakeShader(src.w, src.h, head + frag, {
      scale: (src.pw / src.w / this.scale) * scale, mipmap,
      uniforms: { uSrc: src.tex, uTexel: [1 / src.pw, 1 / src.ph], ...uniforms },
    });
  }

  freeTex(t) { if (t && t.tex) this.gl.deleteTexture(t.tex); }

  // ---------------- layer constructors ----------------
  // Texture card. rect = [x, y, w, h] in rest-space design px at depth z.
  texLayer(src, opts = {}) {
    const rect = opts.rect || [0, 0, src.w, src.h];
    return { kind: 'tex', src, rect, z: 1, opacity: 1, blend: 'normal', ...opts };
  }
  // Procedural card drawn every frame. frag defines vec4 shade(vec2 p, vec2 uv) -> premultiplied rgba.
  shaderLayer(frag, opts = {}) {
    const p = this.program(CARD_VS, SHADER_HEAD + frag + SHADER_FOOT, opts.name || 'shader-layer');
    return { kind: 'shader', prog: p, rect: [-W * 0.25, -H * 0.25, W * 1.5, H * 1.5], z: 1, opacity: 1, blend: 'normal', uniforms: {}, ...opts };
  }
  // Canvas2D card redrawn every frame: draw(ctx, t, layer) in rest-space design px.
  canvasLayer(draw, opts = {}) {
    const rect = opts.rect || [-W * 0.1, -H * 0.1, W * 1.2, H * 1.2];
    const res = (opts.res ?? 1) * this.scale;
    const pw = Math.max(1, Math.round(rect[2] * res)), ph = Math.max(1, Math.round(rect[3] * res));
    const cv = new OffscreenCanvas(pw, ph);
    const ctx = cv.getContext('2d');
    const tex = texFromSource(this.gl, cv, { mipmap: false });
    return { kind: 'canvas', draw, rect, z: 1, opacity: 1, blend: 'normal', cv, ctx, src: { tex, w: rect[2], h: rect[3], pw, ph }, ...opts };
  }

  // ---------------- scenes ----------------
  async buildScene(mod, opts = {}) {
    const def = mod.default || mod;
    const api = this.api(def.id || 'scene');
    const t0 = performance.now();
    const built = await def.build(api, opts);
    const scene = { def, id: def.id, layers: built.layers, camera: built.camera, grade: built.grade, update: built.update, dispose: built.dispose, api, buildMs: performance.now() - t0, meta: built.meta || {} };
    return scene;
  }

  api(seedBase) {
    const eng = this;
    return {
      W, H, engine: eng, gl: eng.gl, scale: eng.scale,
      rng: (s = 1) => makeRng(seedBase + ':' + s),
      noise: (s = 1) => makeNoise(seedBase + ':n:' + s),
      bakeCanvas: eng.bakeCanvas.bind(eng),
      bakeShader: eng.bakeShader.bind(eng),
      processTex: eng.processTex.bind(eng),
      texture: eng.texture.bind(eng),
      tex: eng.texLayer.bind(eng),
      shader: eng.shaderLayer.bind(eng),
      canvas: eng.canvasLayer.bind(eng),
    };
  }

  disposeScene(scene) {
    if (!scene) return;
    const gl = this.gl;
    const seen = new Set();
    for (const L of scene.layers) {
      if (L.src && L.src.tex && !seen.has(L.src.tex)) { seen.add(L.src.tex); gl.deleteTexture(L.src.tex); }
      if (L.textures) for (const k in L.textures) { const t = L.textures[k]; const tx = t && (t.tex || t); if (tx && !seen.has(tx)) { seen.add(tx); gl.deleteTexture(tx); } }
    }
    if (scene.dispose) scene.dispose();
  }

  cameraAt(scene, t) {
    const c = scene.camera ? scene.camera(t) : null;
    return { x: 0, y: 0, dolly: 0, zoom: 1, roll: 0, ...(c || {}) };
  }

  // Render one scene at local time t into a target (float). Clears to the scene's paper.
  // camAdd (optional) offsets the scene camera: x, y, dolly, roll add; zoom multiplies.
  renderScene(scene, t, target, camAdd) {
    if (scene.update) scene.update(t);
    const base = this.cameraAt(scene, t);
    const cam = camAdd ? {
      x: base.x + (camAdd.x || 0), y: base.y + (camAdd.y || 0), dolly: base.dolly + (camAdd.dolly || 0),
      zoom: base.zoom * (camAdd.zoom ?? 1), roll: base.roll + (camAdd.roll || 0),
    } : base;
    this.renderLayers(scene.layers, t, target, cam, { clear: scene.meta.clear || [0.92, 0.89, 0.83] });
    return cam;
  }

  // Draw a list of layers into a target with a camera. clear: rgb array to clear first, or null to draw over.
  renderLayers(layers, t, target, cam, { clear = null } = {}) {
    const gl = this.gl;
    cam = { x: 0, y: 0, dolly: 0, zoom: 1, roll: 0, ...(cam || {}) };
    const camU = [cam.x, cam.y, cam.dolly, cam.zoom];
    bindTarget(gl, target);
    if (clear) { gl.clearColor(clear[0], clear[1], clear[2], 1); gl.clear(gl.COLOR_BUFFER_BIT); }
    for (const L of layers) {
      if (L.visible !== undefined && !val(L.visible, t, L)) continue;
      const op = val(L.opacity, t, L);
      if (op <= 0.0005) continue;
      if (L.update) L.update(t, L);
      const z = val(L.z, t, L);
      const rect = val(L.rect, t, L);
      const common = { uTime: t, uCam: camU, uRoll: cam.roll, uDesign: [W, H], uRS: this.scale, uZ: z, uOpacity: op };
      if (L.kind === 'canvas') {
        const ctx = L.ctx;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, L.cv.width, L.cv.height);
        ctx.setTransform(L.cv.width / rect[2], 0, 0, L.cv.height / rect[3], -rect[0] * L.cv.width / rect[2], -rect[1] * L.cv.height / rect[3]);
        L.draw(ctx, t, L);
        updateTexFromSource(gl, L.src.tex, L.cv, { mipmap: false });
        bindTarget(gl, target);
      }
      if (L.kind === 'tex' || L.kind === 'canvas') {
        const sway = L.sway;
        const tint = L.tint ? [...L.tint.slice(0, 3), L.tint[3] ?? 1] : [1, 1, 1, 0];
        if (L.reflect) {
          const R = val(L.reflect, t, L);
          const wy = R.y;
          const depth = R.height ?? Math.max(10, (wy - rect[1]) * 1.15);
          gl.useProgram(this.cardReflect.prog);
          blendFor(gl, R.blend || 'normal');
          setUniforms(gl, this.cardReflect, {
            ...common, uOpacity: op * (R.opacity ?? 1),
            uDrawRect: [rect[0] - 40, wy, rect[2] + 80, depth], uRect: rect, uTex: L.src.tex,
            uRefl: [wy, R.strength ?? 0.5, R.fade ?? 220, R.smear ?? 6],
            uRipple: [R.amp ?? 3, R.wavelength ?? 9, R.speed ?? 0.6, R.breakup ?? 0.45],
            uReflTint: R.tint || [1, 1, 1], uWaterTone: R.tone || [0.9, 0.88, 0.84],
          });
          drawQuad(gl);
        }
        gl.useProgram(this.cardTex.prog);
        blendFor(gl, L.blend);
        setUniforms(gl, this.cardTex, {
          ...common, uDrawRect: rect, uRect: rect, uTex: L.src.tex,
          uSway: sway ? [sway.amp ?? 4, sway.freq ?? 0.25, sway.scale ?? 400, sway.power ?? 1.6] : [0, 0, 1, 1],
          uSwayAnchor: sway ? [sway.anchor?.[0] ?? rect[0] + rect[2] / 2, sway.anchor?.[1] ?? rect[1] + rect[3], sway.radius ?? Math.max(rect[2], rect[3]), sway.bias ?? 0] : [0, 0, 1, 0],
          uTint: tint,
        });
        drawQuad(gl);
      } else if (L.kind === 'shader') {
        gl.useProgram(L.prog.prog);
        blendFor(gl, L.blend);
        const u = {};
        for (const k in L.uniforms) u[k] = val(L.uniforms[k], t, L);
        const unit = setUniforms(gl, L.prog, { ...common, uDrawRect: rect, uRect: rect, ...u });
        if (L.textures) {
          const tx = {};
          for (const k in L.textures) tx[k] = L.textures[k].tex || L.textures[k];
          setUniforms(gl, L.prog, tx, unit);
        }
        drawQuad(gl);
      }
    }
    gl.disable(gl.BLEND);
    return cam;
  }

  gradeAt(scene, t) {
    const g = scene && scene.grade ? (isFn(scene.grade) ? scene.grade(t) : scene.grade) : {};
    return { ...this.defaultGrade, ...g, ...(this.gradeOverride || {}) };
  }

  // Post pass. stages: grade (exposure/contrast/saturation/tint/lift), final (paper fibre, vignette, dither).
  postPass(src, dst, grade, { doGrade = true, doFinal = true } = {}) {
    const gl = this.gl;
    const g = { ...this.defaultGrade, ...(grade || {}) };
    bindTarget(gl, dst);
    gl.disable(gl.BLEND);
    gl.useProgram(this.post.prog);
    setUniforms(gl, this.post, {
      uDesign: [W, H], uSrc: src.tex, uPaper: this.paperTex.tex,
      uGrade: [g.exposure, g.contrast, g.saturation, g.paper],
      uTintMul: g.tint, uLift: g.lift, uVignette: g.vignette, uDither: g.dither,
      uDoGrade: doGrade ? 1 : 0, uDoFinal: doFinal ? 1 : 0, uInk: g.ink || [0, 0, 1.6, 0],
    });
    drawQuad(gl);
  }

  // Grade + final pass straight to the canvas (stills).
  present(srcTarget, grade) { this.postPass(srcTarget, null, grade); }

  // Convert a float target to planar yuv420p bytes (BT.709 limited range) on the GPU.
  readYUV(src, out) {
    const gl = this.gl;
    if (!this.yuvProg) this.yuvProg = this.program(FULL_VS, YUV_FS, 'yuv-pack');
    const pw = this.pw / 4, ph = this.ph * 1.5;
    if (!this.yuvTarget) this.yuvTarget = createTarget(gl, pw, ph, { float: false });
    bindTarget(gl, this.yuvTarget);
    gl.disable(gl.BLEND);
    gl.useProgram(this.yuvProg.prog);
    setUniforms(gl, this.yuvProg, { uDesign: [W, H], uSrc: src.tex });
    gl.uniform2i(this.yuvProg.uniforms.uSize.loc, this.pw, this.ph);
    drawQuad(gl);
    const buf = out || new Uint8Array(pw * ph * 4);
    gl.readPixels(0, 0, pw, ph, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    return buf;
  }
  // Copy/accumulate helper (gain-weighted add when blending is on).
  blit(src, dst, gain = 1, add = false) {
    const gl = this.gl;
    bindTarget(gl, dst);
    if (add) { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); } else gl.disable(gl.BLEND);
    gl.useProgram(this.copy.prog);
    setUniforms(gl, this.copy, { uDesign: [W, H], uSrc: src.tex, uGain: gain });
    drawQuad(gl);
    gl.disable(gl.BLEND);
  }

  clear(target, rgba = [0, 0, 0, 0]) {
    const gl = this.gl;
    bindTarget(gl, target);
    gl.clearColor(...rgba);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  // Render a single scene still (with optional sub-frame motion blur) and present it.
  renderSceneFrame(scene, t, { samples = 1, shutter = 0.5, fps = 60 } = {}) {
    if (samples <= 1) {
      this.renderScene(scene, t, this.targets.sceneA);
      this.present(this.targets.sceneA, this.gradeAt(scene, t));
      return;
    }
    this.clear(this.targets.accum);
    for (let i = 0; i < samples; i++) {
      const ts = t + ((i + 0.5) / samples - 0.5) * (shutter / fps);
      this.renderScene(scene, ts, this.targets.sceneA);
      this.blit(this.targets.sceneA, this.targets.accum, 1 / samples, true);
    }
    this.present(this.targets.accum, this.gradeAt(scene, t));
  }

  info() {
    const gl = this.gl;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    return { renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), float: gl.__floatOK, maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE), size: [this.pw, this.ph] };
  }
}
