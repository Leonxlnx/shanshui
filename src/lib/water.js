// Water: lakes, rivers, reflections, glitter paths and waterfalls (v2 draft).
import { clamp, mix } from '../engine/rng.js';
import { PAPER, INK, tone, rgba, stroke, dots, smoothPath } from './brush.js';
import { inkify } from './inkfx.js';

const c01 = (c) => c.map((v) => v / 255);

// ---------------------------------------------------------------- shared GLSL
export const WATER_GLSL = /* glsl */ `
// Perspective coordinates on a flat water plane. D = px below the horizon line.
// At D == D0 one world unit is one screen px; features compress toward the horizon.
// The depth axis uses a softened perspective (painters compress less than a
// camera): screen px per world unit grows like (D / D0) ^ uPersp.
uniform float uPersp;
vec2 waterWorld(vec2 p, float yH, float cx, float D0, float e) {
  float D = max(p.y - yH, 0.0) + e;
  float g = uPersp;
  float z = abs(g - 1.0) < 0.01 ? -D0 * log(D / D0) : D0 / (g - 1.0) * pow(D0 / D, g - 1.0);
  return vec2((p.x - cx) * pow(D0 / D, min(g, 1.0)), z);
}
// sparse thin horizontal brush lines in world space (0..1)
float waterLines(vec2 w, float seed, float len, float thick, float thr) {
  float n = snoise(vec2(w.x / len + seed, w.y / thick));
  float m = snoise(vec2(w.x / (len * 0.43) - seed * 1.7, w.y / (thick * 5.0) + 4.0));
  float k = snoise(vec2(w.x / (len * 3.1) + seed * 0.3, w.y / (thick * 23.0) - 2.0));
  return smoothstep(thr, thr + 0.22, n) * smoothstep(0.0, 0.5, m) * smoothstep(-0.1, 0.4, k);
}
vec2 worley2(vec2 p) {
  vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y)); vec2 r = g + hash22(i + g) - f; float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return sqrt(vec2(d1, d2));
}
// paper craquelure / wrinkle network seen through flat washes (0..1)
float crackle(vec2 p) {
  vec2 q = p / 13.0 + 0.6 * vec2(fbm(p / 40.0, 2), fbm(p / 40.0 + 5.2, 2));
  vec2 w = worley2(q);
  float e = 1.0 - smoothstep(0.0, 0.1, w.y - w.x);
  return e * smoothstep(-0.2, 0.5, snoise(p / 90.0 + 3.0));
}
// soft blotchy wash texture (rest space), ~[-1,1]
float washBlotch(vec2 p) {
  return fbm(p * vec2(0.05, 0.075), 4) * 0.6 + fbm(p * vec2(0.014, 0.024) + 9.0, 3) * 0.4;
}`;

// ---------------------------------------------------------------- presets
const LAKE_PRESETS = {
  plain: { paper: [239, 231, 220], density: [0.07, 0.13, 0.14, 0.4], fog: [60, 0.75, 0, 0], mottle: 0.07, grain: 0.035, blotch: 0.16, crackle: 0.07, bands: 0.05, dark: 0.04, light: 0.45, drift: 6, tint: [1, 1, 1, 0] },
  still: { paper: [239, 231, 220], density: [0.08, 0.06, 0.04, 0.5], fog: [50, 0.6, 0, 0], mottle: 0.04, grain: 0.015, dark: 0.04, light: 0.5, drift: 4, tint: [1, 1, 1, 0] },
  night: { paper: [237, 228, 215], density: [0.20, 0.25, 0.34, 0.55], fog: [40, 0.45, 0, 0], mottle: 0.05, grain: 0.035, blotch: 0.2, crackle: 0.07, bands: 0.02, dark: 0.04, light: 0.3, drift: 7, tint: [1, 1, 1, 0] },
  golden: { paper: [250, 233, 203], density: [0.05, 0.08, 0.10, 0.5], fog: [60, 0.7, 0, 0], mottle: 0.05, grain: 0.02, dark: 0.06, light: 0.6, drift: 6, tint: [1.0, 0.97, 0.88, 0.6] },
};

function lakeUniforms(o) {
  const pr = LAKE_PRESETS[o.variant || 'plain'] || LAKE_PRESETS.plain;
  const paper = o.paper || pr.paper;
  return {
    uBox: [o.x0 ?? -480, o.y, o.x1 ?? 2400, o.yBottom ?? 1080],
    uP: [o.cx ?? 960, o.D0 ?? 260, o.e ?? 14, o.seed ?? 1.7],
    uPaperC: c01(paper),
    uInkC: c01(o.ink || INK),
    uDen: o.density || pr.density,
    uFog: o.fog || pr.fog,
    uTexA: [o.mottle ?? pr.mottle, o.dark ?? pr.dark, o.light ?? pr.light, o.drift ?? pr.drift],
    uTexB: [o.grain ?? pr.grain, o.blotch ?? pr.blotch ?? 0.12, o.crackle ?? pr.crackle ?? 0.05, o.bands ?? pr.bands ?? 0.03],
    uTint: o.tint || pr.tint,
    uPersp: o.persp ?? 1.25,
  };
}

const LAKE_FS = WATER_GLSL + /* glsl */ `
uniform vec4 uBox, uP, uDen, uFog, uTexA, uTexB, uTint;
uniform vec3 uPaperC, uInkC;
uniform sampler2D uMask; uniform vec4 uMaskRect; uniform float uHasMask;
vec4 shade(vec2 p, vec2 uv) {
  float D = p.y - uBox.y;
  float a = smoothstep(-1.0, 1.5, D);
  if (uHasMask > 0.5) {
    vec2 mu = (p - uMaskRect.xy) / uMaskRect.zw;
    a *= (mu.x < 0.0 || mu.y < 0.0 || mu.x > 1.0 || mu.y > 1.0) ? 0.0 : texture(uMask, mu).a;
  }
  if (a <= 0.001) return vec4(0.0);
  D = max(D, 0.0);
  float d = clamp(D / max(uBox.w - uBox.y, 1.0), 0.0, 1.0);
  vec2 w = waterWorld(p, uBox.y, uP.x, uP.y, uP.z);
  float t = uTime;
  float den = d < uDen.w ? mix(uDen.x, uDen.y, smoothstep(0.0, uDen.w, d)) : mix(uDen.y, uDen.z, smoothstep(uDen.w, 1.0, d));
  float detail = smoothstep(3.0, 40.0, D);
  // soft horizontal wash bands drifting slowly (long in x, short in depth)
  float m = fbm(vec2(w.x / 1400.0 + t * uTexA.w / 1400.0, w.y / 60.0) + uP.w, 4);
  float mb = fbm(vec2(w.x / 520.0 - t * uTexA.w / 900.0, w.y / 16.0) + uP.w * 1.9, 3);
  den *= 1.0 + m * uTexA.x * 6.0 + mb * uTexB.w * 4.5 * detail;
  // blotchy wash + pigment grain + paper wrinkles (static in paint space)
  float bl = washBlotch(p + uP.w * 100.0);
  den *= 1.0 + bl * uTexB.y * 2.8;
  float gr = vnoise(p * 0.9) * 0.6 + vnoise(p * 0.31 + 7.0) * 0.4 - 0.5;
  den += gr * uTexB.x * (0.3 + den);
  den += crackle(p + uP.w * 37.0) * uTexB.z * (0.2 + den);
  // very sparse dark wind streaks
  float dl = waterLines(w + vec2(t * uTexA.w, 0.0), uP.w + 3.1, 220.0, 2.4, 0.66);
  den += dl * uTexA.y * detail;
  den = clamp(den, 0.0, 1.0);
  vec3 col = mix(uPaperC, uInkC, den);
  col = mix(col, col * uTint.rgb, uTint.a);
  // sparse light streaks: paper showing through the wash
  float ll = waterLines(w + vec2(-t * uTexA.w * 0.6, 0.0), uP.w + 7.7, 110.0, 1.8, 0.66);
  col = mix(col, uPaperC * 1.01, ll * uTexA.z * detail);  // fog over the far water
  col = mix(col, uPaperC, uFog.y * exp(-D / max(uFog.x, 1.0)));
  // optional fade to paper toward the bottom
  col = mix(col, uPaperC, uFog.w * smoothstep(uBox.w - uFog.z, uBox.w, p.y));
  return vec4(col * a, a);
}`;

const OVERLAY_FS = WATER_GLSL + /* glsl */ `
uniform vec4 uBox, uP;
uniform vec4 uG0, uG1, uG2, uG3, uG4;
uniform vec3 uGC;
uniform vec4 uSheen; uniform vec3 uSheenC;
uniform vec4 uOcc[8]; uniform float uOccN;
uniform sampler2D uMask; uniform vec4 uMaskRect; uniform float uHasMask;

float occlusion(vec2 p) {
  float m = 1.0;
  for (int i = 0; i < 8; i++) {
    if (float(i) >= uOccN) break;
    vec4 o = uOcc[i];
    float inx = smoothstep(o.x - o.w, o.x + o.w, p.x) * (1.0 - smoothstep(o.y - o.w, o.y + o.w, p.x));
    m *= 1.0 - inx * (1.0 - smoothstep(o.z - 1.0, o.z + 1.5, p.y));
  }
  return m;
}

// Glitter path: a solid core broken into perspective rows, each row ending in
// tapered horizontal fingers of random length (moon / sun on rippled water).
float glitter(vec2 p, vec2 w, float D, float d) {
  float cx = mix(uG0.x, uG0.y, d);
  float hw = mix(uG0.z, uG0.w, d);
  float ext = mix(uG1.x, uG1.y, d);
  float rh = uG1.z;
  float tw = uTime * uG2.x;
  float x = p.x - cx;
  float g = 0.0;
  for (int layer = 0; layer < 2; layer++) {
    float lf = float(layer);
    float r = w.y / (rh * (1.0 + 0.37 * lf)) - uTime * uG2.y + lf * 0.5;
    r += 0.25 * snoise(vec2(w.y / (rh * 5.0), 3.3 + lf * 7.0));
    float aa = clamp(fwidth(r) * 1.2, 0.03, 0.5);
    for (int k = -1; k <= 1; k++) {
      float i = floor(r) + float(k);
      float f = r - i;
      float sd = i * 1.0 + lf * 517.0;
      float h1 = hash11(sd * 1.731 + 0.3), h2 = hash11(sd * 2.117 + 5.1), h3 = hash11(sd * 3.917 + 2.0), h4 = hash11(sd * 5.31 + 7.0);
      float wob = (hash11(sd * 8.1 + 4.0) - 0.5) * hw * 0.5 + snoise(vec2(sd * 0.21, tw * 0.5)) * hw * 0.15;
      float core = hw * (layer == 0 ? 0.55 + 0.75 * h3 : 0.2 + 0.6 * h3);
      float extk = ext * (layer == 0 ? 1.0 : 0.7);
      float L = core + extk * pow(h1, 1.8) * (0.6 + 0.4 * snoise(vec2(sd * 0.71, tw)));
      float R = core + extk * pow(h2, 1.8) * (0.6 + 0.4 * snoise(vec2(sd * 0.53 + 9.0, tw)));
      float xs = x - wob;
      float E = xs < 0.0 ? L : R;
      float s = clamp((abs(xs) - core) / max(E - core, 1.0), 0.0, 1.0);
      float sc = clamp(abs(xs) / max(core, 1.0), 0.0, 1.0);
      float inside = abs(xs) < E ? 1.0 : 0.0;
      // lens: thick in the middle, thinning across the core, then a tapered spike
      float th = (layer == 0 ? 0.9 : 0.42) * mix(1.0, 0.5, sc * sc) * pow(1.0 - s, 1.5) * (0.75 + 0.3 * h4);
      float vc = 0.5 + (h4 - 0.5) * 0.3;
      float rag = 0.1 * snoise(vec2(p.x / 7.0, sd * 3.1)) + 0.06 * snoise(vec2(p.x / 2.5, sd * 1.7));
      float sl = (1.0 - smoothstep(th - aa, th + aa, abs(f - vc) + rag * step(0.05, th))) * inside;
      float gap = step(1.0 - uG2.z, hash11(sd * 7.31 + 1.0)) * (1.0 - s);
      g = max(g, sl * (1.0 - 0.6 * gap) * mix(1.0, 0.8, s) * (layer == 0 ? 1.0 : 0.85));
    }
  }
  // sparkles: short dashes twinkling around the column
  if (uG2.w > 0.0) {
    float rr = w.y / rh * 1.3 - uTime * uG2.y + 0.37;
    float i = floor(rr), f = fract(rr);
    float cw = 22.0;
    float cell = floor((x + 4000.0) / cw);
    float h = hash12(vec2(i, cell));
    float on = step(0.84, h) * exp(-pow(x / (hw + ext * 0.9 + 1.0), 2.0));
    float ph = hash12(vec2(cell, i + 3.0));
    float tw2 = pow(0.5 + 0.5 * sin(uTime * (1.0 + 1.4 * ph) + ph * 40.0), 3.0);
    float cxl = fract((x + 4000.0) / cw);
    float dash = (1.0 - smoothstep(0.12, 0.3, abs(f - 0.5))) * (1.0 - smoothstep(0.2, 0.45, abs(cxl - 0.5)));
    g = max(g, on * tw2 * dash * uG2.w);
  }
  float glow = uG3.z * exp(-D / max(uG3.y, 1.0)) * exp(-pow(x / max(uG3.x, 1.0), 2.0));
  float spill = uG4.y * exp(-pow(x / max(uG4.x, 1.0), 2.0));
  return max(max(g, glow), spill);
}
vec4 shade(vec2 p, vec2 uv) {
  float D = p.y - uBox.y;
  if (D < -1.0) return vec4(0.0);
  float a = smoothstep(-1.0, 1.5, D) * occlusion(p);
  if (uHasMask > 0.5) {
    vec2 mu = (p - uMaskRect.xy) / uMaskRect.zw;
    a *= (mu.x < 0.0 || mu.y < 0.0 || mu.x > 1.0 || mu.y > 1.0) ? 0.0 : texture(uMask, mu).a;
  }
  if (a <= 0.001) return vec4(0.0);
  D = max(D, 0.0);
  float d = clamp(D / max(uBox.w - uBox.y, 1.0), 0.0, 1.0);
  vec2 w = waterWorld(p, uBox.y, uP.x, uP.y, uP.z);
  float detail = smoothstep(3.0, 40.0, D);
  vec4 o = vec4(0.0);
  if (uSheen.x > 0.0) {
    float ll = waterLines(w + vec2(-uTime * uSheen.w, 0.0), uP.w + 7.7, uSheen.y, uSheen.z, 0.66);
    float sa = ll * uSheen.x * detail;
    o = vec4(uSheenC * sa, sa);
  }
  if (uG1.w > 0.0) {
    float g = glitter(p, w, D, d) * uG1.w;
    g *= 1.0 - smoothstep(uBox.w - uG3.w, uBox.w, p.y);
    g *= 0.9 + 0.1 * vnoise(p * vec2(0.06, 0.4));
    g = clamp(g, 0.0, 1.0);
    o = vec4(uGC * g, g) + o * (1.0 - g);
  }
  return o * a;
}`;

/**
 * Lake surface (base layer, drawn under reflections).
 */
export function makeLake(api, opts = {}) {
  const o = { ...opts };
  const u = lakeUniforms(o);
  const rect = o.rect || [u.uBox[0], o.y - 4, u.uBox[2] - u.uBox[0], (o.yBottom ?? 1080) - o.y + 300];
  const mask = o.mask || null;
  return api.shader(LAKE_FS, {
    name: o.name || 'lake', z: o.z ?? 1.5, rect,
    uniforms: { ...u, uMaskRect: mask ? mask.rect : [0, 0, 1, 1], uHasMask: mask ? 1 : 0 },
    textures: mask ? { uMask: mask.src } : undefined,
    opacity: o.opacity ?? 1,
  });
}

/**
 * Overlay above reflections: bright sheen lines + glitter path.
 */
export function makeGlitter(api, opts = {}) {
  const o = { ...opts };
  const u = lakeUniforms(o);
  const g = o.glitter || {};
  const kind = g.kind || 'moon';
  const col = g.color || (kind === 'gold' ? [252, 232, 178] : kind === 'sun' ? [236, 160, 132] : [246, 238, 222]);
  const rect = o.rect || [u.uBox[0], o.y - 4, u.uBox[2] - u.uBox[0], (o.yBottom ?? 1080) - o.y + 300];
  const occ = new Float32Array(32);
  const occN = Math.min(8, (o.occluders || []).length);
  for (let i = 0; i < occN; i++) { const c = o.occluders[i]; occ.set([c[0], c[1], c[2], c[3] ?? 6], i * 4); }
  const mask = o.mask || null;
  const sheen = o.sheen ?? 0.25;
  return api.shader(OVERLAY_FS, {
    name: o.name || 'lake-overlay', z: o.z ?? 1.5, rect,
    uniforms: {
      uBox: u.uBox, uP: u.uP, uPersp: u.uPersp,
      uG0: [g.x ?? 960, g.x1 ?? g.x ?? 960, g.w0 ?? 30, g.w1 ?? 50],
      uG1: [g.ext0 ?? 30, g.ext1 ?? 70, g.row ?? 7, g.intensity ?? (o.glitter ? 1 : 0)],
      uG2: [g.twinkle ?? 0.35, g.drift ?? 0.25, g.gaps ?? 0.1, g.sparkle ?? 0.6],
      uG3: [g.glowW ?? 160, g.glowH ?? 18, g.glow ?? 0.6, g.fadeNear ?? 120],
      uG4: [g.spillW ?? 220, g.spill ?? 0.08, 0, 0],
      uGC: c01(col),
      uSheen: [sheen, o.sheenLen ?? 420, o.sheenThick ?? 2.2, o.drift ?? 4],
      uSheenC: c01(u.uPaperC.map((v) => v * 255 * 1.01)),
      uOcc: occ, uOccN: occN,
      uMaskRect: mask ? mask.rect : [0, 0, 1, 1], uHasMask: mask ? 1 : 0,
    },
    textures: mask ? { uMask: mask.src } : undefined,
  });
}

// ---------------------------------------------------------------- reflections
const REFL_BAKE_FS = /* glsl */ `
uniform sampler2D uSrc;
uniform vec4 uSrcRect;   // source card rect (x, y, w, h) in design px
uniform vec4 uR;         // waterline y (design), stretch, smear px, output height
uniform vec4 uR2;        // horizontal blur px, x origin of output (design), -, -
vec4 src(vec2 q) {
  vec2 uv = (q - uSrcRect.xy) / uSrcRect.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(0.0);
  return texture(uSrc, uv);
}
vec4 shade(vec2 p, vec2 uv) {
  float dy = p.y;
  float x = p.x + uR2.y;
  float sy = uR.x - dy / uR.y;
  float sm = uR.z * (0.25 + 1.6 * dy / uR.w);
  vec4 acc = vec4(0.0); float ws = 0.0;
  for (int i = -8; i <= 8; i++) {
    float fi = float(i) / 8.0;
    float w = exp(-fi * fi * 2.5);
    for (int j = -1; j <= 1; j++) {
      float wj = j == 0 ? 1.0 : 0.5;
      acc += src(vec2(x + float(j) * uR2.x, sy + fi * sm)) * w * wj; ws += w * wj;
    }
  }
  return acc / ws;
}`;

const REFL_FS = WATER_GLSL + /* glsl */ `
uniform sampler2D uRefl;
uniform vec4 uRRect;   // reflection texture rect: x, waterline y, w, h (design px)
uniform vec4 uRip;     // amp px, row px, speed, breakup
uniform vec4 uRk;      // strength, fade px, gap px, seed
uniform vec3 uRTint;
uniform vec3 uLineC;
vec4 shade(vec2 p, vec2 uv) {
  float dy = p.y - uRRect.y;
  if (dy < 0.0) return vec4(0.0);
  float H = uRRect.w;
  float t = uTime * uRip.z;
  // rows grow slightly with distance from the waterline (perspective)
  float rowH = uRip.y * (0.7 + dy / H * 0.9);
  float r = dy / rowH;
  float i = floor(r);
  float grow = 0.25 + 1.2 * dy / H;
  float dx = uRip.x * grow * (0.75 * snoise(vec2(i * 0.37 + uRk.w, t)) + 0.25 * snoise(vec2(p.y / 40.0, t * 0.6 + p.x / 300.0)));
  vec2 q = vec2((p.x + dx - uRRect.x) / uRRect.z, dy / H);
  vec4 c = (q.x < 0.0 || q.x > 1.0 || q.y > 1.0) ? vec4(0.0) : texture(uRefl, q);
  float fade = exp(-dy / max(uRk.y, 1.0)) * (1.0 - smoothstep(0.75, 1.0, dy / H));
  // thin bright breakup lines crossing the reflection
  vec2 w = vec2(p.x, dy);
  float br = waterLines(vec2(p.x - uTime * 5.0, dy), uRk.w + 1.3, 46.0, 1.3 + dy * 0.008, 0.42) * uRip.w * smoothstep(4.0, 30.0, dy);
  float k = uRk.x * fade * smoothstep(uRk.z - 0.5, uRk.z + 1.0, dy);
  c.rgb *= uRTint;
  vec4 o = c * k;
  o = o * (1.0 - br) + vec4(uLineC, 1.0) * br * c.a * k;
  return o;
}`;

/**
 * Soft painted reflection of a texture card (stretched, smeared, serrated by
 * ripples, crossed by bright breakup lines). Draw it right after the lake base
 * (before the card itself) at the same z as the card for correct parallax.
 */
export function makeReflection(api, src, opts = {}) {
  const rect = opts.rect || [0, 0, src.w, src.h];
  const y = opts.y ?? rect[1] + rect[3];
  const stretch = opts.stretch ?? 1.35;
  const objH = Math.max(10, y - rect[1]);
  const H = Math.ceil(opts.height ?? objH * stretch * 1.05);
  const padX = opts.padX ?? 30;
  const W = rect[2] + padX * 2;
  const bscale = opts.bakeScale ?? 0.5;
  const tex = api.bakeShader(W, H, REFL_BAKE_FS, {
    scale: bscale,
    uniforms: { uSrc: src, uSrcRect: rect, uR: [y, stretch, opts.smear ?? 6, H], uR2: [opts.hblur ?? 1.2, rect[0] - padX, 0, 0] },
  });
  const paper = opts.paper || PAPER;
  const layer = api.shader(REFL_FS, {
    name: opts.name || 'reflection', z: opts.z ?? 1.5,
    rect: [rect[0] - padX, y, W, H],
    uniforms: {
      uRRect: [rect[0] - padX, y, W, H],
      uRip: [opts.amp ?? 3.5, opts.row ?? 3, opts.speed ?? 0.5, opts.breakup ?? 0.6],
      uRk: [opts.strength ?? 0.7, opts.fade ?? 260, opts.gap ?? 2, opts.seed ?? 3.3],
      uRTint: opts.tint || [1, 1, 1],
      uLineC: c01(paper.map((v) => Math.min(255, v * 1.01))),
    },
    textures: { uRefl: tex },
    opacity: opts.opacity ?? 1,
  });
  layer.reflTex = tex;
  return layer;
}

/** Recommended engine card-reflect settings (cheap alternative to makeReflection). */
export function reflectFor(y, mode = 'still', over = {}) {
  const P = {
    still: { strength: 0.55, fade: 240, smear: 5, amp: 1.4, wavelength: 7, speed: 0.35, breakup: 0.35 },
    ripple: { strength: 0.5, fade: 200, smear: 9, amp: 3, wavelength: 9, speed: 0.6, breakup: 0.5 },
    night: { strength: 0.62, fade: 300, smear: 8, amp: 2.2, wavelength: 8, speed: 0.45, breakup: 0.42 },
  };
  return { y, ...(P[mode] || P.still), ...over };
}

// ---------------------------------------------------------------- waterfalls
// Curtain geometry (all design px): the lip runs from L=(xL,yL) to R=(xR,yR),
// arched upward by `arch`. Below the lip each edge bends by bendL/bendR within
// the first part of the drop (rate `curve`) and drifts by driftL/driftR over
// the full height H (positive = rightward). u in 0..1 across, v in 0..1 down.
const FALLS_GLSL = /* glsl */ `
uniform vec4 uL0;   // xL, yL, xR, yR
uniform vec4 uL1;   // H, bendL, bendR, curve
uniform vec4 uL2;   // driftL, driftR, arch, seed
vec3 curtainUV(vec2 p) {
  // lip height evaluated at the pixel's x (no fixed-point iteration: stable for strong bends)
  float u0 = clamp((p.x - uL0.x) / max(uL0.z - uL0.x, 1.0), 0.0, 1.0);
  float yl = mix(uL0.y, uL0.w, u0) - uL2.z * 4.0 * u0 * (1.0 - u0);
  float v = (p.y - yl) / uL1.x;
  float vv = max(v, 0.0);
  float b = 1.0 - exp(-vv * uL1.w);
  float xl = uL0.x + uL1.y * b + uL2.x * vv;
  float xr = uL0.z + uL1.z * b + uL2.y * vv;
  float u = (p.x - xl) / max(xr - xl, 1.0);
  return vec3(u, v, xr - xl);
}`;

const CURTAIN_FS = FALLS_GLSL + /* glsl */ `
uniform vec4 uS0;   // bottom speed px/s, start speed fraction, streak scale px, streak darkness
uniform vec4 uS1;   // edge raggedness, fade start (v), opacity, sheet bands
uniform vec4 uS2;   // thin-water amount (rock shows through), top brightening, strands, mist at foot
uniform vec4 uS3;   // line width px, edge sharpness px, -, -
uniform vec3 uWC;   // water colour
uniform vec3 uSC;   // streak ink colour
// constant-width soft line along the zero set of a noise field (finite-difference
// gradient keeps the width in px, so steep crossings never thin into dotted aliasing)
float hairline(float X, float T, float f, float seed, float tf, float hw) {
  float n = snoise(vec2(X * f + seed, T * tf));
  float n1 = snoise(vec2((X + 1.0) * f + seed, T * tf));
  float g = max(abs(n1 - n), 0.02 * f);
  return 1.0 - smoothstep(0.0, 1.0, abs(n) / (g * hw));
}
float launchT(float s) {
  float vb = uS0.x, v0 = uS0.x * uS0.y;
  float g = max((vb * vb - v0 * v0) / (2.0 * max(uL1.x, 1.0)), 1.0);
  return (-v0 + sqrt(v0 * v0 + 2.0 * g * max(s, 0.0))) / g;
}
vec4 shade(vec2 p, vec2 uv) {
  vec3 c = curtainUV(p);
  float u = c.x, v = c.y, wpx = c.z;
  if (v < -0.02 || v > 1.25 || u < -0.35 || u > 1.35) return vec4(0.0);
  float seed = uL2.w;
  float s = max(v, 0.0) * uL1.x;
  float T = uTime - launchT(s);            // launch time of the water at this point
  float W0 = uL0.z - uL0.x;
  float X = u * W0;                        // across, px at the lip (lines fan out with the curtain)
  float sc = uS0.z;
  // ---- hairlines: a few soft grey brush lines following the fall, broken into
  // long dashes (width from the known noise scale; fwidth would dash curves)
  float f1 = 1.0 / (sc * 3.6), f2 = 1.0 / (sc * 2.1);
  float lw = uS3.x * 0.5;
  float l1 = hairline(X, T, f1, seed, 0.10, lw);
  float l2 = hairline(X, T, f2, seed * 3.1 + 11.0, 0.16, lw * 0.75);
  float k1 = smoothstep(-0.2, 0.5, snoise(vec2(X / (sc * 5.0) + 7.0, T * 0.45)));
  float k2 = smoothstep(0.25, 0.7, snoise(vec2(X / (sc * 3.0) + 17.0, T * 0.8)));
  float broad = smoothstep(0.35, 0.95, snoise(vec2(X / (sc * 7.0) + 29.0, T * 0.25))) * 0.18;
  float lines = max(max(l1 * k1, l2 * 0.5 * k2), broad);
  // ---- gaps between sheets: dark rock seen between parting sheets (crisp, darkest near the top)
  float gap = 0.0;
  for (int k = 0; k < 4; k++) {
    if (float(k) >= uS1.w) break;
    float fk = float(k);
    float ck = 0.2 + 0.6 * hash11(seed * 3.3 + fk * 1.7);
    float wk = (2.0 + 4.0 * hash11(seed * 5.1 + fk * 2.9)) / W0;
    float wob = 0.012 * snoise(vec2(fk * 4.0 + seed, T * 0.35));
    float vEnd = 0.35 + 0.5 * hash11(seed * 9.7 + fk);
    float dk = abs(u - ck - wob) / (wk * (0.6 + 0.8 * smoothstep(0.0, vEnd, v)));
    float bk = 1.0 - smoothstep(0.5, 1.0, dk);
    float life = smoothstep(0.0, 0.06, v) * (1.0 - smoothstep(vEnd * 0.7, vEnd, v));
    float brk = smoothstep(-0.4, 0.2, snoise(vec2(fk * 9.0 + seed, T * 1.1)));
    gap = max(gap, bk * life * brk);
  }
  // ---- edges: ragged and slowly changing, with beads of rock showing through
  float ea = uS1.x;
  float eL = ea * (0.05 * snoise(vec2(T * 0.7, seed + 3.0)) + 0.025 * snoise(vec2(T * 2.3 + X * 0.02, seed + 5.0)));
  float eR = ea * (0.05 * snoise(vec2(T * 0.7, seed + 9.0)) + 0.025 * snoise(vec2(T * 2.3 - X * 0.02, seed + 13.0)));
  float px = uS3.y / max(wpx, 1.0);
  float body = smoothstep(eL - px, eL + px, u) * (1.0 - smoothstep(1.0 + eR - px, 1.0 + eR + px, u));
  float ed = min(u - eL, 1.0 + eR - u) * wpx;                     // px from the nearest edge
  float bead = smoothstep(0.3, 0.7, snoise(vec2(X / 9.0 + 51.0, T * 0.6))) * smoothstep(0.0, 2.0, ed) * (1.0 - smoothstep(4.0, 9.0, ed)) * uS3.z;
  // separated strands just outside the edges
  float outside = max(-u, u - 1.0);
  float strand = 0.0;
  if (outside > -0.06 && uS2.z > 0.0) {
    float st = hairline(X, T, 1.0 / (sc * 2.4), 41.0 + seed, 0.12, 1.1) * smoothstep(-0.1, 0.4, snoise(vec2(X / 14.0 + 5.0, T * 0.7)));
    strand = st * (1.0 - smoothstep(0.0, 0.12, outside)) * uS2.z * step(0.0, outside);
  }
  // ---- thin water: translucent grey patches (rock behind)
  float thinN = snoise(vec2(X / (sc * 6.0) + 61.0, T * 0.45));
  float thin = smoothstep(0.2, 0.8, thinN) * uS2.x;
  // ---- top: water appears over the lip, bottom: dissolves into mist
  float top = smoothstep(-0.004, 0.012, v);
  float fadeN = 0.06 * snoise(vec2(X / 30.0, T * 0.8 + 3.0));
  float bottom = 1.0 - smoothstep(uS1.y, 1.05, v + fadeN);
  float hole = max(gap, bead);
  float a = max(body * (1.0 - 0.45 * thin) * (1.0 - 0.85 * hole), strand) * top * bottom * uS1.z;
  float soften = mix(1.0, 0.3, smoothstep(uS1.y - 0.25, 1.0, v));     // detail dissolves in the spray
  // cylindrical shading: the sheet turns away from the light near its sides
  float side = uS2.w * (smoothstep(0.45, 0.0, u) * 1.0 + smoothstep(0.6, 1.0, u) * 0.45);
  float grain = (vnoise(p * 0.8) - 0.5) * 0.06 + (vnoise(p * vec2(0.25, 0.04) + seed) - 0.5) * 0.08;
  float dark = clamp(lines * uS0.w * soften + thin * 0.15 + hole * 0.45 + side * (0.6 + 0.8 * thin) + grain, 0.0, 1.0);
  dark *= 1.0 - uS2.y * exp(-v * 16.0);
  vec3 col = mix(uWC, uSC, dark);
  if (uS3.w > 1.5) return vec4(vec3(1.0 - l1, 1.0 - l2, 1.0 - bead), 1.0);
  if (uS3.w > 0.5) return vec4(vec3(fract(T * 4.0), fract(X / 10.0), 0.0), 1.0);
  return vec4(col * a, a);
}`;

const SPRAY_FS = /* glsl */ `
uniform vec4 uP0;   // centre x, impact y, half width, rise height
uniform vec4 uP1;   // amount, speed, seed, droplets
uniform vec4 uP2;   // shade (grey in billows), spread, -, -
uniform vec3 uMC;   // mist colour
uniform vec3 uIC;   // shade ink colour
vec4 shade(vec2 p, vec2 uv) {
  float t = uTime * uP1.y;
  vec2 q = (p - uP0.xy) / vec2(uP0.z, uP0.w);
  // envelope: dome rising above the impact line, spreading sideways, hanging below
  float up = -q.y;                                 // >0 above the impact line
  float wid = 1.0 + uP2.y * clamp(up, 0.0, 1.5) + 0.35 * clamp(-up, 0.0, 2.0);
  float ex = exp(-pow(q.x / wid, 2.0) * 1.6);
  float ey = up > 0.0 ? exp(-pow(up, 1.5) * 1.6) : exp(-pow(-up * 0.7, 2.0));
  float env = ex * ey;
  if (env < 0.01) return vec4(0.0);
  // billows rise and churn
  vec3 r = vec3(p.x / (uP0.z * 0.55), (p.y + t * uP0.w * 0.35) / (uP0.w * 0.45), t * 0.25 + uP1.z);
  float n = fbm3(r, 5);
  float n2 = fbm3(r * vec3(2.3, 2.3, 1.0) + 5.0, 3);
  float puff = smoothstep(0.1, 1.1, env * 1.05 + n * 0.6 + n2 * 0.2 - 0.25);
  // faint grey shading where billows overlap (ink-wash cloud edges)
  float nb = fbm3(r + vec3(0.12, -0.18, 0.0), 5);
  float sh = clamp((nb - n) * 2.5, 0.0, 1.0) * uP2.x * puff * (1.0 - puff * 0.4);
  // droplets: fine white specks near the impact
  float dr = 0.0;
  if (uP1.w > 0.0) {
    vec2 g = (p + vec2(0.0, t * 40.0)) / 3.0;
    float h = hash12(floor(g) + uP1.z * 13.0);
    dr = step(0.93, h) * exp(-pow(q.x / 0.9, 2.0)) * smoothstep(0.9, 0.1, abs(up - 0.2)) * uP1.w;
  }
  float a = clamp(puff * uP1.x + dr, 0.0, 1.0);
  vec3 col = mix(uMC, uIC, sh);
  return vec4(col * a, a);
}`;

const BACKING_FS = FALLS_GLSL + /* glsl */ `
uniform vec4 uB0;   // darkness, margin px, fade start v, seed
uniform vec3 uBC;
vec4 shade(vec2 p, vec2 uv) {
  vec3 c = curtainUV(p);
  float u = c.x, v = c.y, wpx = c.z;
  float m = uB0.y / max(wpx, 1.0);
  if (v < -0.04 || v > 1.1) return vec4(0.0);
  float e = smoothstep(-m, -m * 0.3, u) * (1.0 - smoothstep(1.0 + m * 0.3, 1.0 + m, u));
  float n = snoise(vec2(p.x / 9.0, p.y / 60.0) + uB0.w) * 0.5 + 0.5;
  float a = e * smoothstep(-0.04, 0.02, v) * (1.0 - smoothstep(uB0.z, 1.05, v)) * uB0.x * (0.7 + 0.3 * n);
  return vec4(uBC * a, a);
}`;

const FALLS_PRESETS = {
  plain: { water: [242, 236, 226], ink: [70, 66, 60], darkness: 0.42 },
  far: { water: [236, 230, 220], ink: [120, 115, 108], darkness: 0.4 },
  night: { water: [236, 229, 217], ink: [70, 66, 60], darkness: 0.5 },
};

/**
 * Animated waterfall: returns { layers: [backing?, curtain, spray?], anchors }.
 */
export function makeWaterfall(api, opts = {}) {
  const o = opts;
  const [L, R] = o.lip || [[470, 590], [540, 610]];
  const H = o.height ?? 240;
  const pr = FALLS_PRESETS[o.preset || 'plain'] || FALLS_PRESETS.plain;
  const z = o.z ?? 1.5;
  const seed = o.seed ?? 1.3;
  const geo = {
    uL0: [L[0], L[1], R[0], R[1]],
    uL1: [H, o.bendL ?? 0, o.bendR ?? 0, o.curve ?? 6],
    uL2: [o.driftL ?? -6, o.driftR ?? 10, o.arch ?? 4, seed],
  };
  const minX = Math.min(L[0], L[0] + (o.bendL ?? 0) + (o.driftL ?? -6)) - 40;
  const maxX = Math.max(R[0], R[0] + (o.bendR ?? 0) + (o.driftR ?? 10)) + 40;
  const top = Math.min(L[1], R[1]) - (o.arch ?? 4) - 6;
  const bot = Math.max(L[1], R[1]) + H * 1.25;
  const rect = [minX, top, maxX - minX, bot - top];
  const layers = [];
  if (o.backing !== false) {
    layers.push(api.shader(BACKING_FS, {
      name: (o.name || 'falls') + '-backing', z, rect,
      uniforms: { ...geo, uB0: [o.backingDark ?? 0.75, o.backingMargin ?? 10, o.fade ?? 0.72, seed], uBC: c01(o.backingColor || [32, 30, 27]) },
    }));
  }
  const curtain = api.shader(CURTAIN_FS, {
    name: (o.name || 'falls') + '-curtain', z, rect,
    uniforms: {
      ...geo,
      uS0: [o.speed ?? 260, o.startSpeed ?? 0.22, o.streakScale ?? 3.2, o.darkness ?? pr.darkness],
      uS1: [o.ragged ?? 1, o.fade ?? 0.72, o.opacity ?? 0.97, o.sheets ?? 2],
      uS2: [o.thin ?? 0.3, o.topBright ?? 0.6, o.strands ?? 0.8, o.sideShade ?? 0.18],
      uS3: [o.lineWidth ?? 3.6, o.edgeSoft ?? 0.9, o.beads ?? 0.8, o.debug ?? 0],
      uWC: c01(o.water || pr.water), uSC: c01(o.ink || pr.ink),
    },
  });
  layers.push(curtain);
  const baseY = Math.max(L[1], R[1]) + H * (o.fade ?? 0.72) + H * 0.12;
  const cx = (L[0] + R[0]) / 2 + ((o.driftL ?? -6) + (o.driftR ?? 10)) / 2 * 0.85 + ((o.bendL ?? 0) + (o.bendR ?? 0)) / 2;
  if (o.spray !== false) {
    const sp = o.spray || {};
    const hw = sp.width ?? (R[0] - L[0]) * 0.9 + 20;
    const rise = sp.rise ?? H * 0.45;
    const sx = sp.x ?? cx, sy = sp.y ?? baseY;
    layers.push(api.shader(SPRAY_FS, {
      name: (o.name || 'falls') + '-spray', z: sp.z ?? z * 0.98,
      rect: [sx - hw * 3.2, sy - rise * 2.4, hw * 6.4, rise * 4.2],
      uniforms: {
        uP0: [sx, sy, hw, rise], uP1: [sp.amount ?? 1, sp.speed ?? 1, seed * 7.0, sp.droplets ?? 0],
        uP2: [sp.shade ?? 0.35, sp.spread ?? 0.8, 0, 0],
        uMC: c01(sp.color || o.paper || PAPER), uIC: c01(sp.ink || [150, 145, 138]),
      },
    }));
  }
  return { layers, anchors: { lip: [L, R], base: [cx, baseY] }, rect };
}
// ---------------------------------------------------------------- rivers
// A river is modelled on a ground plane seen in perspective, so a meandering
// centreline of constant width turns into a ribbon that narrows with distance
// and whose far loops flatten into horizontal bands (as painted in ref 02/07).
//   screen y = horizon + Dn / Z,  screen x = vx + Xg / Z,  Z = 1 + Zg / (Dn * fore)
// with Dn = yNear - horizon (Z = 1 at the near end). Xg, Zg are ground px.
export function riverModel(o = {}) {
  const H = o.horizon ?? 470, vx = o.vx ?? 960;
  const yNear = o.yNear ?? 1100, yFar = o.yFar ?? H + 30;
  const Dn = yNear - H, fore = o.fore ?? 3;
  const toZ = (Zg) => 1 + Zg / (Dn * fore);
  const ZgOfY = (y) => (Dn / Math.max(1e-3, y - H) - 1) * Dn * fore;
  const ZgFar = ZgOfY(yFar);
  const mean = o.meander || [{ amp: 260, wl: 2600, phase: 0 }, { amp: 90, wl: 900, phase: 1.3 }];
  // amplitudes may grow with distance (ampGrow ground px per ground px): valleys open up far away
  const centre = o.centre || ((Zg) => (o.offset ?? 0) + mean.reduce((s, m) => s + (m.amp + (m.grow ?? 0) * Zg) * Math.sin((Zg / m.wl) * Math.PI * 2 + (m.phase ?? 0)), 0));
  const width = (Zg) => (o.width ?? 600) * mix(1, o.taper ?? 0.6, clamp(Zg / ZgFar));
  const project = (Xg, Zg) => { const Z = toZ(Zg); return [vx + Xg / Z, H + Dn / Z]; };
  return { H, vx, yNear, yFar, Dn, fore, toZ, ZgOfY, ZgFar, centre, width, project };
}

function riverOutline(M, nz, wander, wScale = 1, xOff = 0) {
  const left = [], right = [], info = [];
  let Zg = 0;
  while (Zg <= M.ZgFar) {
    const Z = M.toZ(Zg);
    const c = M.centre(Zg) + xOff, d = (M.centre(Zg + 2) - M.centre(Zg - 2)) / 4;
    const len = Math.hypot(1, d);
    const nxg = 1 / len, nzg = -d / len;
    const w = M.width(Zg) * wScale * 0.5;
    const nl = 1 + wander * nz.n2(Zg * 0.004, 1.3 + xOff * 0.01) + wander * 0.8 * nz.n2(Zg * 0.013, 4.1) + wander * 0.3 * nz.n2(Zg * 0.05, 2.1);
    const nr = 1 + wander * nz.n2(Zg * 0.004, 7.9 + xOff * 0.01) + wander * 0.8 * nz.n2(Zg * 0.013, 9.7) + wander * 0.3 * nz.n2(Zg * 0.05, 6.3);
    left.push(M.project(c - nxg * w * nl, Zg - nzg * w * nl));
    right.push(M.project(c + nxg * w * nr, Zg + nzg * w * nr));
    info.push({ Zg, Z, w });
    Zg += Math.max(1.0, 1.4 * Z * Z * M.fore);
  }
  return { left, right, info };
}

function polyPath(ctx, a, b) {
  ctx.moveTo(a[0][0], a[0][1]);
  for (const p of a) ctx.lineTo(p[0], p[1]);
  for (let i = b.length - 1; i >= 0; i--) ctx.lineTo(b[i][0], b[i][1]);
  ctx.closePath();
}

// ground-space ellipse (bar / islet) projected to a screen polygon
function groundBlob(M, nz, Xg, Zg, len, wid, ang = 0, seed = 0) {
  const pts = [];
  const n = 36;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 1 + 0.18 * nz.n2(Math.cos(a) * 1.7 + seed, Math.sin(a) * 1.7 + seed * 0.7) + 0.08 * nz.n2(Math.cos(a) * 5 + seed, Math.sin(a) * 5);
    const u = Math.cos(a) * wid * 0.5 * r, v = Math.sin(a) * len * 0.5 * r * (Math.sin(a) > 0 ? 1 : 0.8);
    const gx = Xg + u * Math.cos(ang) + v * Math.sin(ang), gz = Zg - u * Math.sin(ang) + v * Math.cos(ang);
    pts.push(M.project(gx, gz));
  }
  return pts;
}

/**
 * Winding river on a ground plane. Returns { layers: [flats?, surface, banks, overlay], model, mask, rect }.
 */
export function makeRiver(api, opts = {}) {
  const o = opts;
  const M = riverModel(o);
  const z = o.z ?? 2;
  const variant = o.variant || 'golden';
  const pr = LAKE_PRESETS[variant] || LAKE_PRESETS.plain;
  const paper = o.paper || pr.paper;
  const rng = api.rng(o.seed ?? 'river');
  const nz = api.noise(o.seed ?? 'river');
  const wander = o.wander ?? 0.12;
  const main = riverOutline(M, nz, wander);
  const branches = (o.branches || []).map((b) => riverOutline({ ...M, centre: b.centre || ((Zg) => M.centre(Zg) + (b.dx || 0)), width: (Zg) => M.width(Zg) * (b.width ?? 0.3), ZgFar: Math.min(M.ZgFar, b.to ?? M.ZgFar) }, nz, wander * 1.5));
  // screen bounds
  let x0 = 1e9, x1 = -1e9;
  for (const g of [main, ...branches]) for (const p of [...g.left, ...g.right]) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); }
  const rect = o.rect || [Math.floor(x0 - 60), Math.floor(M.yFar - 10), Math.ceil(x1 - x0 + 120), Math.ceil(M.yNear - M.yFar + 20)];
  // bars: [{ x (ground, relative to centre in half-widths -1..1), at (0..1 depth fraction), len, wid (fractions of width) }]
  // bars: [{ y (screen y of the bar centre), x (-1..1 across the river), len, wid (fractions of the local width) }]
  const nb = o.barCount ?? 9;
  const barSpecs = o.bars ?? Array.from({ length: nb }, (_, i) => {
    const y = mix(M.yFar + 30, M.yNear - 40, (i + rng.range(0.15, 0.85)) / nb);
    const side = rng.chance(0.65) ? rng.sign() * rng.range(0.6, 0.95) : rng.range(-0.35, 0.35);
    return { x: side, y, len: rng.range(0.25, 0.7), wid: rng.range(0.05, 0.12) };
  });
  const bars = barSpecs.map((b, i) => {
    if (b.sx !== undefined) {
      // screen-space lens: centre (sx, sy), width sw, height sh
      const pts = [];
      for (let k = 0; k < 40; k++) {
        const a = (k / 40) * Math.PI * 2;
        const rr = 1 + 0.16 * nz.n2(Math.cos(a) * 1.6 + i * 3.1, Math.sin(a) * 1.6) + 0.06 * nz.n2(Math.cos(a) * 6 + i, Math.sin(a) * 6);
        const sy = Math.sin(a);
        pts.push([b.sx + Math.cos(a) * b.sw * 0.5 * rr * (1 - 0.2 * Math.pow(Math.abs(sy), 4)), b.sy + sy * b.sh * 0.5 * rr * (sy < 0 ? 0.7 : 1)]);
      }
      return { pts, Zg: M.ZgOfY(b.sy), tone: b.tone };
    }
    const Zg = b.y !== undefined ? M.ZgOfY(b.y) : b.at * M.ZgFar;
    const w = M.width(Zg);
    const c = M.centre(Zg);
    const d = (M.centre(Zg + 2) - M.centre(Zg - 2)) / 4;
    // painters lay bars out as horizontal lenses: elongate along ground x (lateral), slight tilt with the flow
    return { pts: groundBlob(M, nz, c + b.x * w * 0.5, Zg, w * b.len, w * b.wid * (b.thick ?? 1.6), Math.PI / 2 + Math.atan(d) * 0.25 + (b.tilt ?? 0), i * 3.7 + 1), Zg, tone: b.tone };
  });
  const ms = o.maskScale ?? 0.5;
  const mask = api.bakeCanvas(rect[2], rect[3], (ctx) => {
    ctx.translate(-rect[0], -rect[1]);
    ctx.filter = `blur(${(o.soft ?? 0.8).toFixed(2)}px)`;
    ctx.fillStyle = '#000';
    for (const g of [main, ...branches]) { ctx.beginPath(); polyPath(ctx, g.left, g.right); ctx.fill(); }
    if (o.extraWater) o.extraWater(ctx, M);
    ctx.globalCompositeOperation = 'destination-out';
    for (const b of bars) { ctx.beginPath(); ctx.moveTo(b.pts[0][0], b.pts[0][1]); for (const p of b.pts) ctx.lineTo(p[0], p[1]); ctx.closePath(); ctx.fill(); }
  }, { scale: ms, mipmap: false });
  const maskInfo = { src: mask, rect };
  const layers = [];
  // floodplain flats behind the water: a pale wash wider than the river
  if (o.flats !== false) {
    const flats = api.bakeCanvas(rect[2] + 400, rect[3], (ctx) => {
      ctx.translate(-rect[0] + 200, -rect[1]);
      const fl = riverOutline(M, nz, wander * 2, o.flatsWidth ?? 1.9);
      ctx.filter = 'blur(6px)';
      ctx.fillStyle = rgba(tone(o.flatsTone ?? 0.8, paper), o.flatsAlpha ?? 0.55);
      ctx.beginPath(); polyPath(ctx, fl.left, fl.right); ctx.fill();
      ctx.filter = 'none';
      for (let i = 0; i < 160; i++) {
        const Zg = Math.pow(rng(), 0.7) * M.ZgFar, w = M.width(Zg) * (o.flatsWidth ?? 1.9) * 0.5;
        const xg = M.centre(Zg) + rng.range(-1, 1) * w;
        const [x, y] = M.project(xg, Zg);
        const Z = M.toZ(Zg);
        stroke(ctx, [[x, y], [x + rng.range(20, 70) / Z, y + rng.range(-0.5, 0.5)]], { width: rng.range(1, 3) / Math.sqrt(Z), color: tone(o.flatsTone ? o.flatsTone - 0.15 : 0.62, paper), alpha: 0.35, rng });
      }
    }, { scale: 0.75 });
    layers.push(api.tex(inkify(api, flats, { edge: 0.2, granulation: 0.3, bleed: 1 }), { rect: [rect[0] - 200, rect[1], rect[2] + 400, rect[3]], z, name: 'river-flats' }));
  }
  const surface = makeLake(api, { ...o, variant, paper, z, mask: maskInfo, rect, x0: rect[0] - 200, x1: rect[0] + rect[2] + 200, y: M.H, yBottom: M.yNear, cx: M.vx });
  layers.push(surface);
  // banks: bars, bank lines, shore reflections
  const banksRaw = api.bakeCanvas(rect[2], rect[3], (ctx) => {
    ctx.translate(-rect[0], -rect[1]);
    const lineA = o.bankLine ?? 0.6;
    for (const g of [main, ...branches]) {
      for (const [side, sgn] of [[g.left, -1], [g.right, 1]]) {
        // which way is "water" from this edge on screen: compare with the other edge
        let run = [];
        const flush = (k) => {
          if (run.length > 3) {
            const Z = g.info[k].Z;
            stroke(ctx, run, { width: (o.bankWidth ?? 1.8) / Math.pow(Z, 0.6), color: tone(0.22, paper), alpha: lineA * clamp(1.3 / Z, 0.3, 1), rng, profile: 'brush', rough: 0.35 });
          }
          run = [];
        };
        for (let i = 1; i < side.length; i++) {
          const other = (sgn < 0 ? g.right : g.left)[i];
          const farBank = side[i][1] < other[1] - 0.5 || Math.abs(side[i][0] - other[0]) > Math.abs(side[i][1] - other[1]) * 1.5;
          const show = nz.n2(i * 0.11 + (sgn < 0 ? 3 : 9), 2.2) + 0.5 * nz.n2(i * 0.37, 5.0) > (farBank ? 0.05 : 0.45);
          if (show) run.push(side[i]); else flush(i);
        }
        flush(side.length - 1);
      }
    }
    for (const b of bars) {
      const Z = M.toZ(b.Zg);
      const v = b.tone ?? (o.barTone ?? 0.66);
      let ymin = 1e9, ymax = -1e9;
      for (const p of b.pts) { ymin = Math.min(ymin, p[1]); ymax = Math.max(ymax, p[1]); }
      const shape = new Path2D(); shape.moveTo(b.pts[0][0], b.pts[0][1]); for (const p of b.pts) shape.lineTo(p[0], p[1]); shape.closePath();
      const gr = ctx.createLinearGradient(0, ymin, 0, ymax);
      gr.addColorStop(0, rgba(tone(v + 0.14, paper), 0.7));
      gr.addColorStop(0.65, rgba(tone(v + 0.04, paper), 0.9));
      gr.addColorStop(1, rgba(tone(v - 0.1, paper), 0.95));
      ctx.fillStyle = gr; ctx.fill(shape);
      ctx.save(); ctx.clip(shape);
      const bw = Math.max(...b.pts.map((p) => p[0])) - Math.min(...b.pts.map((p) => p[0]));
      for (let k = 0; k < 7; k++) {
        const yy = mix(ymin, ymax, rng.range(0.2, 0.9)), xx = Math.min(...b.pts.map((p) => p[0])) + bw * rng.range(0, 0.7);
        stroke(ctx, [[xx, yy], [xx + bw * rng.range(0.1, 0.4), yy + rng.range(-1, 1)]], { width: rng.range(0.8, 2.2) / Math.sqrt(Z), color: tone(v - 0.22, paper), alpha: 0.35, rng });
      }
      ctx.restore();
      const low = b.pts.filter((p) => p[1] > (ymin + ymax) / 2).sort((a, c) => a[0] - c[0]);
      if (low.length > 3) stroke(ctx, low, { width: 2.2 / Math.pow(Z, 0.6), color: tone(0.2, paper), alpha: 0.65, rng, rough: 0.4 });
      if (Z < 4) dots(ctx, low[low.length >> 1]?.[0] ?? b.pts[0][0], ymax - 1, bw * 0.15, Math.round(bw / 30), { size: [0.8, 2.2], rng, color: tone(0.15, paper), alpha: [0.4, 0.85], squash: 0.4 });
    }
    if (o.paintBanks) o.paintBanks(ctx, { M, main, branches, bars, rng, nz });
  }, { scale: o.bankScale ?? 1 });
  const banks = inkify(api, banksRaw, { edge: 0.4, granulation: 0.25, bleed: 1.0 });
  const banksLayer = api.tex(banks, { rect, z, name: 'river-banks' });
  layers.push(banksLayer);
  const overlay = makeGlitter(api, {
    ...o, variant, paper, z, mask: maskInfo, rect, x0: rect[0] - 200, x1: rect[0] + rect[2] + 200, y: M.H, yBottom: M.yNear, cx: M.vx,
    glitter: o.glitter, occluders: o.occluders, sheen: o.sheen ?? 0.3,
  });
  layers.push(overlay);
  return { layers, surface, banks: banksLayer, overlay, mask: maskInfo, rect, model: M, bars };
}
// ---------------------------------------------------------------- cascades
const FOAM_FS = /* glsl */ `
uniform vec4 uF0;   // centre x, y, half width, half height
uniform vec4 uF1;   // amount, speed, seed, stipple
uniform vec4 uF2;   // grey (foam line darkness), drift x px/s, top softness, -
uniform vec3 uWC, uSC;
vec2 worley2f(vec2 p) {
  vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y)); vec2 r = g + hash22(i + g) - f; float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return sqrt(vec2(d1, d2));
}
vec4 shade(vec2 p, vec2 uv) {
  float t = uTime * uF1.y;
  vec2 q = (p - uF0.xy) / uF0.zw;
  float edgeN = 0.22 * snoise(vec2(p.x / 26.0 + uF1.z, t * 0.4)) + 0.12 * snoise(vec2(p.x / 9.0, t * 0.9 + 3.0));
  float r = length(vec2(q.x, q.y > 0.0 ? q.y * 0.8 : q.y * (1.0 + uF2.z)));
  float env = 1.0 - smoothstep(0.55, 1.0, r + edgeN);
  if (env <= 0.001) return vec4(0.0);
  // churning foam: two worley layers advected down and sideways
  vec2 w1 = worley2f(p / 7.0 + vec2(uF2.y * uTime / 7.0, -t * 0.9) + uF1.z);
  vec2 w2 = worley2f(p / 3.2 + vec2(-t * 0.5, -t * 1.7) + uF1.z * 2.0);
  // froth: rounded bubbles (bright centres, soft grey between), two sizes
  float b1 = 1.0 - smoothstep(0.15, 0.75, w1.x);
  float b2 = 1.0 - smoothstep(0.1, 0.7, w2.x);
  float grey = (1.0 - max(b1, b2 * 0.8)) * 0.6;
  float shadeN = smoothstep(-0.2, 0.7, snoise(vec2(p.x / 40.0, p.y / 18.0 - t * 0.4) + uF1.z));
  float dark = clamp(grey * uF2.x * (0.4 + 0.6 * shadeN) + shadeN * 0.12 * uF2.x, 0.0, 1.0);
  // stipple: white specks thrown up above the foam line
  float st = 0.0;
  if (uF1.w > 0.0) {
    vec2 g = (p + vec2(0.0, t * 26.0)) / 2.6;
    vec2 cell = floor(g); vec2 h = hash22(cell + uF1.z * 7.0);
    float d = length(fract(g) - h);
    float on = step(0.86, hash12(cell + 3.1)) * (1.0 - smoothstep(0.25, 0.42, d));
    float band = smoothstep(1.5, 0.6, r) * smoothstep(-1.4, -0.2, q.y) * (1.0 - env * 0.7);
    st = on * band * uF1.w;
  }
  float a = clamp(env * uF1.x, 0.0, 1.0);
  vec3 col = mix(uWC, uSC, dark);
  vec4 o = vec4(col * a, a);
  return o + vec4(uWC * st, st) * (1.0 - a);
}`;

/**
 * Whitewater foam patch at the foot of a drop / around rocks (animated).
 */
export function makeFoam(api, opts = {}) {
  const o = opts;
  const [x, y] = o.at || [960, 540];
  const w = o.w ?? 120, h = o.h ?? 30;
  const pr = FALLS_PRESETS[o.preset || 'plain'] || FALLS_PRESETS.plain;
  return api.shader(FOAM_FS, {
    name: o.name || 'foam', z: o.z ?? 1.5,
    rect: [x - w * 1.3, y - h * 3.2, w * 2.6, h * 4.6],
    uniforms: {
      uF0: [x, y, w, h], uF1: [o.amount ?? 1, o.speed ?? 1, o.seed ?? 1.7, o.stipple ?? 0.8],
      uF2: [o.grey ?? 0.35, o.drift ?? 6, o.topSoft ?? 0.6, 0],
      uWC: c01(o.water || pr.water), uSC: c01(o.ink || [110, 105, 98]),
    },
  });
}

// Ink boulders for cascades (optional; scenes may use the rock module instead).
// Each boulder is a scalloped crown of overlapping round dabs with a body that
// drops below it; dark wet ink with lighter facets, moss dots on the crown, and
// the lower part torn by white water streaks. list: [{ x, y (crown line), w, h, v? }]
export function paintBoulders(ctx, rng, list, { paper = PAPER, v = 0.12 } = {}) {
  for (const b of list) {
    const { x, y, w, h } = b;
    const tv = b.v ?? v;
    // outline: scalloped crown (overlapping arcs) widening into a body that flares downward
    const nd = 2 + Math.round(w / 34);
    const pts = [];
    const top = [];
    for (let i = 0; i <= nd * 6; i++) {
      const s = i / (nd * 6);
      const lobe = Math.abs(Math.sin(s * nd * Math.PI + rng() * 0.2));
      const arch = Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, s * 1.1 - 0.05))), 0.6);
      top.push([x - w * 0.5 + s * w, y - h * 0.22 * arch - lobe * Math.min(10, w / nd * 0.35) + rng.range(-1, 1)]);
    }
    pts.push(...top);
    const flare = w * rng.range(0.08, 0.2);
    pts.push([x + w * 0.5 + flare, y + h * rng.range(0.8, 1)]);
    for (let i = 6; i >= 0; i--) pts.push([x - w * 0.5 - flare + (w + 2 * flare) * (i / 6), y + h * (0.85 + 0.15 * Math.sin(i * 1.9 + rng() * 2))]);
    pts.push([x - w * 0.5 - flare, y + h * rng.range(0.8, 1)]);
    const shape = new Path2D(); shape.moveTo(pts[0][0], pts[0][1]); for (const p of pts) shape.lineTo(p[0], p[1]); shape.closePath();
    ctx.save();
    const g = ctx.createLinearGradient(0, y - h * 0.3, 0, y + h);
    g.addColorStop(0, rgba(tone(tv + 0.04, paper), 0.97));
    g.addColorStop(0.35, rgba(tone(tv + 0.1, paper), 0.95));
    g.addColorStop(0.75, rgba(tone(tv + 0.22, paper), 0.75));
    g.addColorStop(1, rgba(tone(tv + 0.35, paper), 0.0));
    ctx.fillStyle = g;
    ctx.filter = 'blur(0.7px)';
    ctx.fill(shape);
    ctx.filter = 'none';
    ctx.clip(shape);
    // lighter facets (planes catching light), vertical cun strokes
    for (let k = 0; k < 2 + w / 35; k++) {
      const fx = x + rng.range(-0.35, 0.35) * w, fy = y + rng.range(0.0, 0.45) * h;
      ctx.fillStyle = rgba(tone(tv + rng.range(0.3, 0.5), paper), rng.range(0.25, 0.45));
      ctx.beginPath(); ctx.ellipse(fx, fy, w * rng.range(0.06, 0.16), h * rng.range(0.12, 0.25), rng.range(-0.5, 0.5), 0, Math.PI * 2); ctx.fill();
    }
    for (let k = 0; k < w / 4; k++) {
      const sx = x + rng.range(-0.55, 0.55) * w, sy = y + rng.range(-0.15, 0.7) * h;
      stroke(ctx, [[sx, sy], [sx + rng.range(-2, 2), sy + rng.range(8, 30)]], { width: rng.range(2, 5), color: tone(tv + rng.range(-0.1, 0.3), paper), alpha: rng.range(0.2, 0.45), rng });
    }
    ctx.restore();
    // dark ragged contour along the crown + moss dots
    for (let i = 0; i < top.length - 3; i += 3) stroke(ctx, top.slice(i, i + 4), { width: rng.range(2, 4.5), color: tone(Math.max(0, tv - 0.08), paper), alpha: 0.9, rng });
    dots(ctx, x, y - h * 0.12, w * 0.42, Math.round(w / 7), { size: [0.8, 2.8], rng, color: tone(tv * 0.3, paper), alpha: [0.6, 1], squash: 0.35 });
  }
}
function blobInk(ctx, rng, x, y, r, col) {
  ctx.fillStyle = rgba(col, 0.9);
  ctx.beginPath(); ctx.ellipse(x, y, r, r * rng.range(0.55, 0.8), rng.range(-0.4, 0.4), 0, Math.PI * 2); ctx.fill();
}

// float32 port of the GLSL hash11 (to place lip boulders over the curtain gaps)
const f32 = Math.fround;
function hash11js(p) { p = f32(p * 0.1031); p = p - Math.floor(p); p = f32(p * f32(p + 33.33)); p = f32(p * f32(p + p)); return p - Math.floor(p); }

function bakeLipRocks(api, t, seed, paper, v) {
  const [L, R] = t.lip;
  const W = R[0] - L[0];
  const rr = api.rng(seed + ':lip');
  const list = [];
  const size = t.rockSize ?? Math.min(120, Math.max(28, W * 0.5));
  const bodyH = (t.height ?? 120) * (t.fade ?? 0.72) * 0.9;
  const yAt = (x) => mix(L[1], R[1], clamp((x - L[0]) / Math.max(1, W)));
  // framing boulders at both ends of the lip
  list.push({ x: L[0] - size * rr.range(0.38, 0.5), y: L[1] + size * 0.05, w: size * rr.range(0.9, 1.3), h: Math.max(size * 0.6, bodyH) });
  list.push({ x: R[0] + size * rr.range(0.38, 0.5), y: R[1] + size * 0.05, w: size * rr.range(0.9, 1.3), h: Math.max(size * 0.6, bodyH) });
  // boulders sitting in the sheet gaps (water parts around them)
  const nSheets = t.sheets ?? 2;
  for (let k = 0; k < Math.min(4, nSheets); k++) {
    if ((t.gapRocks ?? 0.7) < rr()) continue;
    const ck = 0.2 + 0.6 * hash11js(seed * 3.3 + k * 1.7);
    const x = L[0] + ck * W;
    list.push({ x, y: yAt(x) + 2, w: size * rr.range(0.25, 0.4), h: size * rr.range(0.25, 0.4) });
  }
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const b of list) { x0 = Math.min(x0, b.x - b.w); y0 = Math.min(y0, b.y - b.h * 1.4); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h * 1.6); }
  const rect = [Math.floor(x0), Math.floor(y0), Math.ceil(x1 - x0), Math.ceil(y1 - y0)];
  const raw = api.bakeCanvas(rect[2], rect[3], (ctx) => { ctx.translate(-rect[0], -rect[1]); paintBoulders(ctx, rr, list, { paper, v }); });
  return { src: inkify(api, raw, { edge: 0.55, granulation: 0.3, bleed: 1.2 }), rect };
}

/**
 * Multi-tier cascade: per tier (top to bottom) backing, curtain, foam and lip boulders,
 * then extra foam and spray clouds. Returns { layers, tiers: [{ curtain, foam, rocks, backing }] }.
 */
export function makeCascade(api, opts = {}) {
  const o = opts;
  const z = o.z ?? 1.5;
  const paper = o.paper || PAPER;
  const layers = [];
  const tiers = [];
  let wall = null;
  if (o.wall) {
    // optional tall dark rock wall behind big top falls: [{ x0, x1, y0, y1 }]
    let X0 = 1e9, Y0 = 1e9, X1 = -1e9, Y1 = -1e9;
    for (const w of o.wall) { X0 = Math.min(X0, w.x0); X1 = Math.max(X1, w.x1); Y0 = Math.min(Y0, w.y0); Y1 = Math.max(Y1, w.y1); }
    const rect = [X0 - 20, Y0 - 20, X1 - X0 + 40, Y1 - Y0 + 40];
    const rr = api.rng((o.seed ?? 3) + ':wall');
    const raw = api.bakeCanvas(rect[2], rect[3], (ctx) => {
      ctx.translate(-rect[0], -rect[1]);
      for (const w of o.wall) {
        const g = ctx.createLinearGradient(0, w.y0, 0, w.y1);
        g.addColorStop(0, rgba(tone(0.08, paper), 0.98)); g.addColorStop(0.7, rgba(tone(0.2, paper), 0.9)); g.addColorStop(1, rgba(tone(0.5, paper), 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(w.x0, w.y0 + 6);
        for (let x = w.x0; x <= w.x1; x += 8) ctx.lineTo(x, w.y0 + rr.range(-6, 6));
        ctx.lineTo(w.x1, w.y1); ctx.lineTo(w.x0, w.y1); ctx.closePath(); ctx.fill();
        ctx.save(); ctx.clip();
        for (let k = 0; k < (w.x1 - w.x0) * (w.y1 - w.y0) / 900; k++) {
          const x = rr.range(w.x0, w.x1), y = rr.range(w.y0, w.y1);
          stroke(ctx, [[x, y], [x + rr.range(-3, 3), y + rr.range(20, 60)]], { width: rr.range(3, 10), color: tone(rr.range(0.0, 0.35), paper), alpha: rr.range(0.25, 0.6), rng: rr });
        }
        ctx.restore();
      }
    });
    wall = api.tex(inkify(api, raw, { edge: 0.5, granulation: 0.3, bleed: 1.4 }), { rect, z, name: 'cascade-wall' });
    layers.push(wall);
  }
  (o.tiers || []).forEach((t, i) => {
    const seed = (o.seed ?? 3) + i * 1.37;
    const f = makeWaterfall(api, {
      preset: o.preset, z: t.z ?? z, seed, speed: t.speed ?? o.speed ?? 220, spray: false, sheets: 2, streakScale: 4, ragged: 1.2, thin: 0.35,
      backing: true, backingMargin: 12, backingDark: 0.85, ...t, name: 'cascade-' + i,
    });
    const group = { backing: null, curtain: null, foam: null, rocks: null };
    for (const L of f.layers) { if (L.name.endsWith('backing')) group.backing = L; else group.curtain = L; }
    if (group.backing) layers.push(group.backing);
    layers.push(group.curtain);
    if (t.foam !== false) {
      const [L, R] = t.lip, H = t.height ?? 120, fade = t.fade ?? 0.72;
      const xl = L[0] + (t.bendL ?? 0) + (t.driftL ?? -6) * fade, xr = R[0] + (t.bendR ?? 0) + (t.driftR ?? 10) * fade;
      const fm = t.foam || {};
      group.foam = makeFoam(api, {
        z: t.z ?? z, preset: o.preset, seed: (o.seed ?? 3) * 2 + i * 2.1,
        at: [fm.x ?? (xl + xr) / 2, fm.y ?? Math.max(L[1], R[1]) + H * fade * 0.98], w: fm.w ?? (xr - xl) * 0.62 + 12, h: fm.h ?? Math.max(10, H * 0.16),
        ...fm, name: 'cascade-foam-' + i,
      });
      layers.push(group.foam);
    }
    if (t.rocks !== false && o.lipRocks !== false) {
      const lr = bakeLipRocks(api, t, seed, paper, t.rockTone ?? 0.1);
      group.rocks = api.tex(lr.src, { rect: lr.rect, z: t.z ?? z, name: 'cascade-rocks-' + i });
      layers.push(group.rocks);
    }
    tiers.push(group);
  });
  for (const [i, fm] of (o.foam || []).entries()) layers.push(makeFoam(api, { z, preset: o.preset, seed: (o.seed ?? 3) * 2 + 50 + i * 2.1, ...fm, name: 'cascade-xfoam-' + i }));
  if (o.rocks && o.rocks.length) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const b of o.rocks) { x0 = Math.min(x0, b.x - b.w); y0 = Math.min(y0, b.y - b.h * 1.5); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h * 1.5); }
    const rect = [Math.floor(x0), Math.floor(y0), Math.ceil(x1 - x0), Math.ceil(y1 - y0)];
    const raw = api.bakeCanvas(rect[2], rect[3], (ctx) => { ctx.translate(-rect[0], -rect[1]); paintBoulders(ctx, api.rng((o.seed ?? 3) + ':rocks'), o.rocks, { paper }); });
    layers.push(api.tex(inkify(api, raw, { edge: 0.55, granulation: 0.3, bleed: 1.2 }), { rect, z, name: 'cascade-rocks' }));
  }
  const sprays = [];
  for (const [i, sp] of (o.spray || []).entries()) {
    const hw = sp.width ?? 140, rise = sp.rise ?? 90;
    sprays.push(api.shader(SPRAY_FS, {
      name: 'cascade-spray-' + i, z: sp.z ?? z * 0.98,
      rect: [sp.x - hw * 3.2, sp.y - rise * 2.4, hw * 6.4, rise * 4.2],
      uniforms: {
        uP0: [sp.x, sp.y, hw, rise], uP1: [sp.amount ?? 0.9, sp.speed ?? 1, (o.seed ?? 3) * 5 + i * 3.3, 0],
        uP2: [sp.shade ?? 0.3, sp.spread ?? 0.8, 0, 0],
        uMC: c01(sp.color || paper), uIC: c01(sp.ink || [150, 145, 138]),
      },
    }));
  }
  layers.push(...sprays);
  return { layers, tiers, wall, sprays };
}