// Transition library. Each transition composites two graded scene images
// (uA outgoing, uB incoming) with a GLSL function
//   vec4 transition(vec2 p, vec2 uv)   p = design px (y down), uv = GL uv
// and may offset the scene cameras through cam(e, params) -> { a, b }.
//
// Uniforms: uA, uB, uP (raw progress 0..1), uE (eased progress), uT (film seconds),
// uK, uK2 (vec4 params), uC, uC2 (focus points, design px), uPaperC (paper rgb 0..1).

export const TRANS_HEAD = /* glsl */ `
uniform sampler2D uA;
uniform sampler2D uB;
uniform float uP;
uniform float uE;
uniform float uT;
uniform vec4 uK;
uniform vec4 uK2;
uniform vec2 uC;
uniform vec2 uC2;
uniform vec3 uPaperC;
const float PI = 3.14159265;
vec2 toUV(vec2 p) { return vec2(p.x / 1920.0, 1.0 - p.y / 1080.0); }
// out-of-frame samples fade to paper instead of smearing the edge pixels
float inFrame(vec2 p) { vec2 a = smoothstep(vec2(-2.0), vec2(24.0), p) * (1.0 - smoothstep(vec2(1896.0, 1056.0), vec2(1922.0, 1082.0), p)); return a.x * a.y; }
vec3 sA(vec2 p) { return mix(uPaperC, texture(uA, toUV(p)).rgb, inFrame(p)); }
vec3 sB(vec2 p) { return mix(uPaperC, texture(uB, toUV(p)).rgb, inFrame(p)); }
vec2 zoomAt(vec2 p, vec2 c, float s) { return c + (p - c) / s; }
float sat(float x) { return clamp(x, 0.0, 1.0); }
float bell(float x) { return sin(PI * sat(x)); }
// billowy cloud density in [0,1] (puffy cumulus lumps)
float billow(vec2 q, float t) {
  float s = 0.0, a = 0.55, n = 0.0;
  vec2 w = vec2(fbm(q * 0.6 + t * 0.03, 3), fbm(q * 0.6 + 7.3 - t * 0.02, 3)) * 0.6;
  q += w;
  for (int i = 0; i < 5; i++) { s += a * (1.0 - abs(snoise(q))); n += a; q = ROT * q * 2.07 + 3.1; a *= 0.5; }
  return s / n;
}
`;

const ease = {
  linear: (x) => x,
  smooth: (x) => x * x * (3 - 2 * x),
  inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  sine: (x) => 0.5 - 0.5 * Math.cos(Math.PI * x),
  out: (x) => 1 - Math.pow(1 - x, 3),
  in: (x) => x * x * x,
};
export const EASE = ease;

export const TRANSITIONS = {
  // Signature move: the incoming painting paints itself in - darkest ink first,
  // blooming outward from two seed points with a wet front, over bare paper.
  // uK: x edge softness, y wet-front strength, z capillary warp px, w darkness weight.
  bloom: {
    ease: 'linear',
    defaults: { k: [0.1, 0.7, 170, 0.9], k2: [0, 0, 0, 0], c: [300, 760], c2: [1640, 520] },
    frag: /* glsl */ `
    vec4 transition(vec2 p, vec2 uv) {
      vec3 b = sB(p);
      vec3 a = sA(p);
      float dark = 1.0 - smoothstep(0.08, 0.93, luma(b));          // 1 = black ink, 0 = paper
      float w = fbm(p * 0.0032 + 2.7, 5) * uK.z + fbm(p * 0.018 + 9.1, 3) * uK.z * 0.3;
      float d = min(length(p - uC), length(p - uC2) * 1.1) + w;
      float spatial = 1.0 - d / 2200.0;                              // 1 near seeds .. 0 far
      float v = mix(spatial, dark, uK.w * 0.5) + dark * 0.35;
      // the threshold sweeps through the value range across the whole transition
      float th = mix(1.2, -0.05, pow(uP, 0.9));
      float m = smoothstep(th - uK.x, th + uK.x, v);
      float front = exp(-pow((v - th - uK.x * 0.5) / (uK.x * 0.8), 2.0)) * uK.y * smoothstep(0.0, 0.1, uP) * (1.0 - smoothstep(0.8, 1.0, uP));
      vec3 bw = mix(uPaperC, b, sat(m * 1.1));
      bw *= 1.0 - front * 0.16 * (0.35 + dark);
      vec3 col = mix(a, bw, sat(m * 3.0));
      col = mix(col, b, smoothstep(0.86, 1.0, uP));
      return vec4(col, 1.0);
    }`,
  },

  // Mist veil: banks of mist drift through and thicken (never to blank paper), the scene
  // changes under the thickest part, and the banks thin away.
  // uK: x max density, y rise (0 = lateral drift, 1 = rising from below), z feature scale, w drift speed.
  // uK2.x: drift direction (+1 right, -1 left).
  mist: {
    ease: 'sine',
    defaults: { k: [0.78, 1.0, 1.0, 1.0], k2: [1, 0, 0, 0] },
    frag: /* glsl */ `
    vec4 transition(vec2 p, vec2 uv) {
      vec2 q = p * 0.0013 * uK.z;
      float dir = uK2.x == 0.0 ? 1.0 : uK2.x;
      vec2 drift = vec2(-dir * uT * 0.05 * uK.w, uT * 0.012 * uK.y);
      float n = fbm3(vec3(q * vec2(1.0, 2.2) + drift, uT * 0.07), 5) * 0.5 + 0.5;
      float bil = billow(q * 2.2 + drift * 1.6, uT);
      float yb = p.y / 1080.0;
      float xb = dir > 0.0 ? p.x / 1920.0 : 1.0 - p.x / 1920.0;
      // where the bank is: rising from below, or sweeping across with the drift
      float lead = mix(xb * 0.55, (1.0 - yb) * 0.6, uK.y);
      float env = sat(bell(sat(uP * 1.15 - lead * 0.3 + 0.08)) * 1.25);
      float body = smoothstep(0.25, 0.85, n * 0.7 + bil * 0.5);
      float D = sat(env * (0.35 + 0.75 * body)) * uK.x;
      float sw = smoothstep(-0.12, 0.12, uP * 1.3 - 0.15 - (n * 0.5 + lead * 0.5));
      vec3 base = mix(sA(p), sB(p), sw);
      // the mist is paper, a hair brighter in its densest folds
      vec3 mistC = uPaperC * (1.0 + 0.012 * body);
      return vec4(mix(base, mistC, D), 1.0);
    }`,
  },

  // Cloud bank sweeping down the frame as the camera rises: A below, clouds, B above.
  // uK: x band half-height px, y billow scale, z fold shading, w unused.
  cloudrise: {
    ease: 'smooth',
    defaults: { k: [520, 1.0, 0.5, 0], k2: [0, 0, 0, 0] },
    cam: (e) => ({ a: { y: -260 * e }, b: { y: 260 * (1 - e) } }),
    frag: /* glsl */ `
    // smooth union of soft puffs on a jittered grid: a continuous height field in ~[-1, 1]
    float puffH(vec2 p, float cell, float seed, float grow) {
      vec2 g0 = floor(p / cell);
      float acc = 0.0;
      for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
        vec2 id = g0 + vec2(float(i), float(j));
        vec2 c = (id + 0.15 + 0.7 * hash22(id + seed)) * cell;
        float r = cell * (0.7 + 0.6 * hash12(id * 1.31 + seed)) * grow;
        float h = 1.0 - dot(p - c, p - c) / (r * r);
        acc += exp(4.0 * h);
      }
      return log(acc) / 4.0;
    }
    // (coverage, lightness): lit from above, the height gradient gives soft round shading
    vec2 puffs(vec2 p, float cell, float seed, float grow) {
      float h = puffH(p, cell, seed, grow);
      float e = cell * 0.18;
      float hu = puffH(p + vec2(0.0, -e), cell, seed, grow);
      float hx = puffH(p + vec2(e, 0.0), cell, seed, grow);
      float lit = (hu - h) * 1.6 - (hx - h) * 0.4;
      return vec2(smoothstep(-0.15, 0.55, h), lit);
    }
    vec4 transition(vec2 p, vec2 uv) {
      float yc = mix(-uK.x - 300.0, 1080.0 + uK.x + 300.0, uE);
      float dy = abs(p.y - yc);
      // the bank: puffs grow toward its middle, so its edges are lumpy cumulus tops and bottoms
      float band = 1.0 - smoothstep(uK.x * 0.55, uK.x * 1.25, dy + fbm(vec2(p.x * 0.003, 2.0), 3) * 120.0);
      vec2 drift = vec2(uT * 9.0, 0.0);
      vec2 big = puffs(p + drift, 230.0 * uK.y, 1.0, 0.25 + 0.85 * band);
      vec2 mid = puffs(p + drift * 1.4 + 57.0, 120.0 * uK.y, 7.0, 0.2 + 0.9 * band);
      vec2 sml = puffs(p + drift * 1.8 + 133.0, 62.0 * uK.y, 3.0, 0.1 + 0.95 * band * band);
      float cov = max(big.x, max(mid.x * 0.95, sml.x * 0.9));
      float lit = (big.y * big.x * 1.0 + mid.y * mid.x * 0.6 + sml.y * sml.x * 0.35) / max(0.2, big.x + mid.x * 0.6 + sml.x * 0.35);
      float soft = fbm(p * 0.006 + uT * 0.05, 3) * 0.5 + 0.5;
      vec3 shadowC = uPaperC * (1.0 - uK.z * 0.24);
      vec3 cloud = mix(shadowC, uPaperC * 1.015, smoothstep(-0.5, 0.45, lit + (soft - 0.5) * 0.25));
      cov = sat(cov * (band * 0.4 + 0.75)) * smoothstep(0.0, 0.25, band + 0.05);
      // inside the bank's core everything is cloud, so no seam between the scenes can show
      cov = max(cov, smoothstep(0.75, 0.95, band));
      vec3 scene = p.y < yc ? sB(p) : sA(p);
      float haze = exp(-dy / 380.0) * 0.4;
      scene = mix(scene, uPaperC, haze);
      return vec4(mix(scene, cloud, cov), 1.0);
    }`,
  },

  // Handscroll pan: the painting continues to the right; a mist seam joins A and B.
  // uK: x seam half-width px, y mist density in seam, z seam waviness px.
  scroll: {
    ease: 'inOut',
    defaults: { k: [240, 0.8, 150, 0], k2: [0, 0, 0, 0] },
    cam: (e) => ({ a: { x: 220 * e }, b: { x: -220 * (1 - e) } }),
    frag: /* glsl */ `
    vec4 transition(vec2 p, vec2 uv) {
      float sx = uE * 1920.0;
      float xs = 1920.0 - sx;                 // where A's right edge meets B's left edge
      float d0 = p.x - xs;
      vec3 a = sA(vec2(p.x + sx, p.y));
      vec3 b = sB(vec2(p.x - xs, p.y));
      vec3 scene = d0 < 0.0 ? a : b;
      // a column of mist sits on the join: solid at its core, billowing at its edges
      float bil = billow(p * 0.0024 + vec2(uT * 0.03, -uT * 0.01), uT);
      float wav = fbm(vec2(p.y * 0.0032, uT * 0.06) + 3.0, 4) * uK.z + (bil - 0.5) * uK.z * 0.8;
      float width = uK.x * (1.0 + 0.35 * fbm(vec2(p.y * 0.002, 9.0), 3));
      float core = 1.0 - smoothstep(width * 0.35, width, abs(d0) + max(0.0, wav));
      float D = sat(core * (0.88 + 0.12 * bil)) * uK.y / 0.8;
      vec3 col = mix(scene, uPaperC * (1.0 + 0.01 * bil), sat(D));
      return vec4(col, 1.0);
    }`,
  },

  // Sun match: both suns slide onto one point while the frame breathes in around it,
  // and B blooms outward from the sun through warm haze.
  // uC = sun in A, uC2 = sun in B (design px). uK: x haze, y edge noise px, z breathe zoom.
  sunmatch: {
    ease: 'sine',
    defaults: { k: [0.4, 220, 0.14, 0], k2: [0, 0, 0, 0], c: [1520, 330], c2: [1700, 345] },
    frag: /* glsl */ `
    vec4 transition(vec2 p, vec2 uv) {
      vec2 dlt = uC2 - uC;
      vec2 sun = uC + dlt * uE;
      float s = 1.0 + uK.z * bell(uP);
      vec2 q = zoomAt(p, sun, s);
      vec3 a = sA(q - sun + uC);
      vec3 b = sB(q - sun + uC2);
      float r = mix(-200.0, 2700.0, uE);
      float d = length((p - sun) * vec2(1.0, 1.25)) + fbm(p * 0.003 + 1.7, 5) * uK.y;
      float m = 1.0 - smoothstep(r - 280.0, r + 280.0, d);
      float haze = bell(uP) * uK.x * exp(-max(0.0, d - r * 0.6) / 650.0);
      vec3 col = mix(a, b, m);
      col = mix(col, mix(vec3(0.99, 0.92, 0.80), vec3(0.98, 0.86, 0.80), uE), haze * 0.5);
      return vec4(col, 1.0);
    }`,
  },

  // Dusk: the day painting dims and cools, then night soaks down from the top of the sky
  // with a soft, wet, irregular front (pigment spreading in damp paper).
  // uK: x front softness px, y dimming, z front irregularity px.
  dusk: {
    ease: 'inOut',
    defaults: { k: [220, 0.22, 230, 0], k2: [0, 0, 0, 0] },
    frag: /* glsl */ `
    vec4 transition(vec2 p, vec2 uv) {
      float yf = mix(-500.0, 1600.0, uE);
      vec2 wq = p * 0.0024;
      vec2 warp = vec2(fbm(wq + 1.3 + uT * 0.02, 4), fbm(wq + 8.1 - uT * 0.02, 4));
      float edge = fbm(wq * 1.6 + warp * 1.2, 5) * uK.z + fbm(p * 0.009 + warp, 3) * uK.z * 0.3;
      float d = p.y - yf - edge;
      float m = 1.0 - smoothstep(-uK.x, uK.x * 0.7, d);
      // A dims and cools as dusk gathers; a faint darker pooling just ahead of the front
      vec3 a = sA(p);
      a = mix(a, a * vec3(0.84, 0.86, 0.92), uK.y * smoothstep(0.0, 0.6, uP) * 2.0);
      float pool = exp(-pow((d - uK.x * 0.3) / (uK.x * 0.9), 2.0)) * bell(uP) * 0.10;
      vec3 col = mix(a, sB(p), m);
      col *= 1.0 - pool;
      return vec4(col, 1.0);
    }`,
  },

  // Snow veil: snow thickens into a soft white haze, the scene changes beneath it, the snow eases.
  // uK: x flake density, y haze max, z wind.
  snow: {
    ease: 'sine',
    defaults: { k: [1.0, 0.68, 0.5, 0], k2: [0, 0, 0, 0] },
    frag: /* glsl */ `
    // one depth layer of jittered, size-varied flakes with their own drift and wobble
    float flakes(vec2 p, float cell, float speed, float seed, float sz) {
      vec2 q = p / cell;
      q.y -= uT * speed;
      q.x += uT * uK.z * speed * 0.35;
      vec2 id = floor(q); vec2 f = fract(q);
      float acc = 0.0;
      for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 h = hash22(id + g + seed);
        if (hash12(id + g + seed * 1.7) > 0.62 * uK.x) continue;
        vec2 c = g + h + vec2(0.18 * sin(uT * (0.8 + h.y) + h.x * 6.28), 0.0);
        float r = sz * (0.35 + 0.65 * hash12(id + g + seed * 3.1));
        float dd = length(f - c);
        acc = max(acc, smoothstep(r, r * 0.35, dd));
      }
      return acc;
    }
    vec4 transition(vec2 p, vec2 uv) {
      float n = fbm3(vec3(p * 0.0016 + vec2(uT * 0.02, 0.0), uT * 0.05), 5) * 0.5 + 0.5;
      float bil = billow(p * 0.002 + vec2(uT * 0.02, 0.0), uT);
      float env = bell(uP);
      float D = sat(env * (0.4 + 0.6 * n + 0.25 * bil)) * uK.y;
      float sw = smoothstep(-0.1, 0.1, uP * 1.2 - 0.1 - n);
      vec3 col = mix(mix(sA(p), sB(p), sw), uPaperC * 1.02, D);
      float f = flakes(p, 110.0, 0.9, 1.0, 0.07) * 0.85 + flakes(p, 70.0, 1.3, 7.0, 0.075) * 0.7 + flakes(p, 42.0, 1.9, 3.0, 0.09) * 0.5;
      col = mix(col, vec3(0.99, 0.985, 0.98), sat(f * smoothstep(0.0, 0.35, uP) * (1.0 - smoothstep(0.7, 1.0, uP)) * 1.1));
      return vec4(col, 1.0);
    }`,
  },

  // Zoom through spray: push into A's waterfall (uC) while falling spray fills the frame,
  // emerge in B (uC2). The frame never goes blank: falling streaks stay visible.
  // uK: x zoom-in scale, y zoom-out start scale, z spray density.
  spray: {
    ease: 'inOut',
    defaults: { k: [1.8, 1.35, 0.8, 0], k2: [0, 0, 0, 0], c: [330, 560], c2: [700, 420] },
    frag: /* glsl */ `
    vec4 transition(vec2 p, vec2 uv) {
      float sa = exp(mix(0.0, log(uK.x), smoothstep(0.0, 0.62, uE)));
      float sb = exp(mix(log(uK.y), 0.0, smoothstep(0.38, 1.0, uE)));
      vec3 a = sA(zoomAt(p, uC, sa));
      vec3 b = sB(zoomAt(p, uC2, sb));
      float n = fbm3(vec3(p * 0.0019, uT * 0.25), 4) * 0.5 + 0.5;
      float sw = smoothstep(0.38, 0.62, uP + (n - 0.5) * 0.25);
      // falling water streaks and rising spray billows
      float st = streaks(p * vec2(0.012, 0.0022) + vec2(0.0, uT * 1.1), vec2(0.0, 1.0), 7.0, 4) * 0.5 + 0.5;
      float bil = billow(p * 0.0022 + vec2(0.0, -uT * 0.18), uT);
      float env = bell(uP);
      float D = sat(env * (0.3 + 0.55 * bil + 0.2 * n) * uK.z * 1.25);
      vec3 col = mix(mix(a, b, sw), uPaperC * 1.02, D);
      // streaks: bright where the falling water is, slightly darker gaps between
      col = mix(col, uPaperC * 1.03, smoothstep(0.55, 0.85, st) * env * 0.55);
      col *= 1.0 - smoothstep(0.35, 0.15, st) * env * 0.06;
      return vec4(col, 1.0);
    }`,
  },

  // Directional wind wipe with a ragged edge (used under leaf gusts).
  // uK: x angle (rad), y edge softness px, z edge raggedness px.
  wind: {
    ease: 'inOut',
    defaults: { k: [0.25, 200, 280, 0], k2: [0, 0, 0, 0] },
    frag: /* glsl */ `
    vec4 transition(vec2 p, vec2 uv) {
      vec2 dir = vec2(cos(uK.x), sin(uK.x));
      float s = dot(p - vec2(960.0, 540.0), dir);
      float front = mix(-1350.0, 1350.0, uE);
      vec2 wq = p * 0.003;
      float rag = fbm(wq + vec2(fbm(wq + uT * 0.1, 3), 0.0) + vec2(uT * 0.25, 0.0), 5) * uK.z;
      float m = 1.0 - smoothstep(-uK.y, uK.y, s - front + rag);
      float bil = billow(p * 0.0025 + vec2(-uT * 0.2, 0.0), uT);
      float D = exp(-pow((s - front + rag) / (uK.y * 1.5), 2.0)) * (0.35 + 0.4 * bil);
      vec3 col = mix(mix(sA(p), sB(p), m), uPaperC, D);
      return vec4(col, 1.0);
    }`,
  },

  // The painting evaporates back into paper: pale washes go first, the darkest ink last.
  // B is plain paper here. uK: x softness, y edge-first bias, z warp px.
  evaporate: {
    ease: 'linear',
    defaults: { k: [0.16, 0.35, 140, 0], k2: [0, 0, 0, 0], c: [960, 560] },
    frag: /* glsl */ `
    vec4 transition(vec2 p, vec2 uv) {
      vec3 a = sA(p);
      float dark = 1.0 - smoothstep(0.08, 0.93, luma(a));
      float w = fbm(p * 0.003 + 4.1, 5) * uK.z;
      float edge = sat((length((p - uC) * vec2(0.9, 1.4)) + w) / 1300.0);
      float v = dark * (1.0 - uK.y) + (1.0 - edge) * uK.y;
      float th = mix(-0.2, 1.15, uP);
      float keep = smoothstep(th - uK.x, th + uK.x, v);
      vec3 col = mix(uPaperC, a, keep);
      return vec4(col, 1.0);
    }`,
  },
};
