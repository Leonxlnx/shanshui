// s10 autumn ruins: scene-local shaders (billowing mist, crater lake).
// makeSpray is adapted from src/scenes/s08/fx.js (copied so s10 owns it).
// All animation is a pure function of uTime; noise is in rest-space p so it sticks to the world.

const c01 = (rgb) => rgb.map((v) => v / 255);

// ------------------------------------------------------------------ billowing mist
// Up to 8 soft ellipses define where the mist sits; fbm3 billows drift and churn inside.
const SPRAY_FS = /* glsl */ `
uniform vec4 uB[8];      // cx, cy, rx, ry
uniform vec4 uBW[2];     // weights of the 8 blobs
uniform vec4 uS0;        // amount, threshold, softness, billow scale px
uniform vec4 uS1;        // rise px/s, drift px/s, evolve, seed
uniform vec4 uS2;        // shade amount, x-stretch, edge fade px, unused
uniform vec3 uMC, uSC;   // mist colour, shade colour
float bw(int i) { int j = i / 4; int k = i - j * 4; vec4 w = uBW[j]; return k == 0 ? w.x : k == 1 ? w.y : k == 2 ? w.z : w.w; }
vec4 shade(vec2 p, vec2 uv) {
  float m = 0.0;
  for (int i = 0; i < 8; i++) {
    vec4 b = uB[i];
    if (b.z <= 0.0) continue;
    vec2 d = (p - b.xy) / b.zw;
    m += bw(i) * exp(-dot(d, d) * 1.4);
  }
  if (m < 0.02) return vec4(0.0);
  float t = uTime;
  float sc = uS0.w;
  vec3 q = vec3((p.x - uS1.y * t) / (sc * uS2.y), (p.y + uS1.x * t) / sc, t * uS1.z + uS1.w);
  float n = fbm3(q, 5);
  float n2 = fbm3(q * vec3(2.6, 2.6, 1.3) + 7.0, 3);
  float f = m + 0.55 * n + 0.18 * n2 - uS0.y;
  float a = smoothstep(-uS0.z, uS0.z, f);
  float nb = fbm3(q + vec3(0.0, -0.22, 0.0), 5);
  float sh = clamp((n - nb) * 3.6 + 0.1 + 0.12 * smoothstep(0.1, 0.7, n2), 0.0, 1.0) * uS2.x * a * (1.0 - 0.4 * a);
  a = clamp(a * uS0.x, 0.0, 1.0);
  vec3 col = mix(uMC, uSC, sh);
  return vec4(col * a, a);
}`;

export function makeSpray(api, o = {}) {
  const blobs = (o.blobs || []).slice(0, 8);
  const B = [], W = [];
  for (let i = 0; i < 8; i++) {
    const b = blobs[i];
    if (b) { B.push(b[0], b[1], b[2], b[3]); W.push(b[4] ?? 1); } else { B.push(0, 0, 0, 0); W.push(0); }
  }
  let rect = o.rect;
  if (!rect) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const b of blobs) { x0 = Math.min(x0, b[0] - b[2] * 1.7); x1 = Math.max(x1, b[0] + b[2] * 1.7); y0 = Math.min(y0, b[1] - b[3] * 1.7); y1 = Math.max(y1, b[1] + b[3] * 1.7); }
    rect = [Math.floor(x0), Math.floor(y0), Math.ceil(x1 - x0), Math.ceil(y1 - y0)];
  }
  return api.shader(SPRAY_FS, {
    name: o.name || 'mist', z: o.z ?? 2, rect, opacity: o.opacity ?? 1,
    uniforms: {
      uB: B, uBW: W,
      uS0: [o.amount ?? 1, o.threshold ?? 0.45, o.softness ?? 0.25, o.scale ?? 120],
      uS1: [o.rise ?? 2, o.drift ?? 8, o.evolve ?? 0.05, o.seed ?? 1],
      uS2: [o.shade ?? 0.3, o.stretch ?? 2.2, 0, 0],
      uMC: c01(o.color || [240, 233, 223]), uSC: c01(o.shadow || [200, 194, 186]),
    },
  });
}

// ------------------------------------------------------------------ crater lake
// Baked shape mask (Canvas2D path) + animated grey water: dark broken reflections of the
// far-shore forest, slow horizontal ripple streaks, a pale sheen band, paper fog at the rim.
const LAKE_FS = /* glsl */ `
uniform sampler2D uMask;
uniform vec4 uL0;   // far shore y, near shore y, drift px/s, seed
uniform vec3 uPaperC, uWaterC, uReflC;
vec4 shade(vec2 p, vec2 uv) {
  vec4 mk = texture(uMask, uv);
  float m = mk.a;
  if (m < 0.003) return vec4(0.0);
  float t = uTime;
  float v = clamp((p.y - uL0.x) / max(1.0, uL0.y - uL0.x), 0.0, 1.0);
  float sd = uL0.w;
  // reflection of the far-shore trees: vertical dark smears broken by ripples
  float rip = snoise(vec2(p.x / 50.0 - t * 0.06, p.y / 4.0 + sd)) * 2.5;
  float trees = fbm(vec2((p.x + rip) / 26.0, sd), 3) * 0.5 + 0.5;
  trees = smoothstep(0.25, 0.8, trees) * 0.6 + 0.4 * (fbm(vec2((p.x + rip) / 70.0, sd + 3.0), 2) * 0.5 + 0.5);
  float reflDepth = mix(24.0, 72.0, trees);
  float yy = p.y - uL0.x + 4.0;
  float refl = (1.0 - smoothstep(reflDepth * 0.25, reflDepth, yy)) * (0.45 + 0.4 * trees);
  refl *= 0.85 + 0.15 * snoise(vec2(p.x / 30.0, p.y / 2.5 - t * 0.2));
  // ripple streaks drifting slowly sideways
  float st = snoise(vec2((p.x - uL0.z * t) / 160.0, p.y / 2.2 + sd));
  float st2 = snoise(vec2((p.x + uL0.z * 0.6 * t) / 70.0, p.y / 1.4 + sd + 9.0));
  float streak = smoothstep(0.55, 0.95, st) * 0.6 + smoothstep(0.65, 0.98, st2) * 0.4;
  // body tone: darker toward the far shore, paler toward the near shore
  float body = mix(1.0, 0.3, smoothstep(0.0, 1.0, v)) + 0.08 * fbm(vec2(p.x / 140.0, p.y / 30.0) + sd + vec2(t * 0.01, 0.0), 3);
  vec3 col = mix(uPaperC, uWaterC, clamp(body, 0.0, 1.0));
  col = mix(col, uReflC, clamp(refl, 0.0, 1.0) * 0.9);
  col = mix(col, uPaperC, streak * mix(0.18, 0.4, v));
  // pale sky sheen lying across the middle of the water, slowly breathing
  float sv = (v - 0.58) / 0.2;
  col = mix(col, uPaperC, (0.32 + 0.06 * sin(t * 0.4)) * exp(-sv * sv) * (0.75 + 0.25 * fbm(vec2(p.x / 90.0 + t * 0.02, sd), 2)));
  // pale fog lying on the water toward the rims
  float fog = 0.7 * smoothstep(0.6, 1.0, 1.0 - m);
  col = mix(col, uPaperC, fog);
  float a = smoothstep(0.0, 0.5, m);
  return vec4(col * a, a);
}`;

// shape: closed polygon [[x,y]...] (design px); rect: card rect
export function makeCraterLake(api, o = {}) {
  const rect = o.rect;
  const mask = api.bakeCanvas(rect[2], rect[3], (ctx) => {
    ctx.translate(-rect[0], -rect[1]);
    ctx.filter = `blur(${o.soft ?? 3}px)`;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    o.shape.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
  }, { scale: 0.5 });
  return api.shader(LAKE_FS, {
    name: o.name || 'lake', z: o.z ?? 2.4, rect,
    textures: { uMask: mask },
    uniforms: {
      uL0: [o.far ?? rect[1], o.near ?? rect[1] + rect[3], o.drift ?? 4, o.seed ?? 2.3],
      uPaperC: c01(o.paper || [236, 229, 218]), uWaterC: c01(o.water || [116, 114, 109]), uReflC: c01(o.refl || [62, 60, 57]),
    },
  });
}
