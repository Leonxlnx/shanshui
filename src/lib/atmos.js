// Atmosphere: paper/sky backgrounds, animated mist, sea of clouds, sky cloud
// bands, sun and moon. Everything is procedural (no assets); animated parts are
// shader cards that are pure functions of uTime and use rest-space p, so they
// stick to the world and parallax with their depth z.
//
// See the API doc block at the bottom of this header (filled in once the
// module stabilises).

import { PAPER } from './brush.js';

const C = (rgb) => rgb.map((v) => v / 255);
const isFn = (v) => typeof v === 'function';
const DEF_RECT = [-480, -270, 2880, 1620];

// ------------------------------------------------------------------ palette
// Measured from the references (sRGB 0-255), see docs/STYLE.md.
export const SKY_PRESETS = {
  rice:   { top: [236, 228, 216], bottom: [238, 230, 218], mottle: 0.010 },
  golden: { top: [244, 228, 208], bottom: [250, 231, 198], mottle: 0.010, glow: [254, 230, 176] },
  night:  { top: [229, 219, 207], bottom: [233, 224, 211], mottle: 0.012 },
  snow:   { top: [233, 227, 218], bottom: [237, 231, 222], mottle: 0.008 },
};
export const MIST_PAPER = { rice: PAPER, golden: [250, 233, 203], night: [232, 223, 210], snow: [238, 232, 223] };

// ------------------------------------------------------------------ shared GLSL
export const ATMOS_GLSL = /* glsl */ `
// fine pigment granulation, ~[0,1] mean 0.5
float a_grain(vec2 p) {
  return vnoise(p * 0.85) * 0.5 + vnoise(p * 2.3 + 3.7) * 0.3 + vnoise(p * 0.31 + 9.1) * 0.2;
}
// paper fibre network: faint curly hairlines (ink settles along them): 0..1
float a_fibres(vec2 p) {
  vec2 q = p * 0.045;
  vec2 w = vec2(snoise(q * 0.5 + 3.1), snoise(q * 0.5 + 8.4));
  float n = snoise(q + w * 0.9);
  float fw = max(fwidth(n), 1e-4);
  float line = 1.0 - smoothstep(0.25, 1.15, abs(n) / fw);
  float m = snoise(q * 0.8 + 2.0) * 0.5 + 0.5;
  return line * smoothstep(0.3, 0.7, m);
}
// soft gaussian ellipse
float a_blob(vec2 p, vec4 b) { vec2 d = (p - b.xy) / max(b.zw, vec2(1.0)); return exp(-dot(d, d)); }
`;

// ------------------------------------------------------------------ sky / paper
// Static background card (z = 1e5): paper colour, gentle vertical gradient,
// very low-frequency mottling, optional warm sun glow (golden).
export function makeSky(api, opts = {}) {
  const variant = opts.variant || 'rice';
  const P = { ...SKY_PRESETS[variant], ...opts };
  const rect = opts.rect || DEF_RECT;
  const sun = opts.sun || [1349, 339];
  const glow = opts.glowColor || P.glow || [0, 0, 0];
  const glowAmt = opts.glowAmount ?? (variant === 'golden' ? 1 : 0);
  const glowSize = opts.glowSize || [1100, 300];
  const src = api.bakeShader(rect[2], rect[3], ATMOS_GLSL + /* glsl */ `
    uniform vec3 uTop, uBot, uGlow;
    uniform vec4 uRect, uSun;
    uniform float uMottle, uGlowAmt, uSeed;
    vec4 shade(vec2 q, vec2 uv) {
      vec2 p = q + uRect.xy;                         // rest-space design px
      float v = clamp((p.y + 0.0) / 1080.0, 0.0, 1.0);
      vec3 c = mix(uTop, uBot, smoothstep(0.0, 1.0, v));
      float m = fbm(p * 0.0011 + uSeed, 3) * 0.7 + fbm(p * 0.0043 + uSeed * 2.0, 2) * 0.3;
      c *= 1.0 + uMottle * m;
      if (uGlowAmt > 0.0) {
        vec2 d = (p - uSun.xy) / uSun.zw;
        float g = exp(-dot(d, d) * 1.4) * 0.75 + exp(-dot(d * vec2(0.55, 1.0), d * vec2(0.55, 1.0)) * 0.6) * 0.35;
        // glow hugs the horizon: stronger below the sun's top than high in the sky
        g *= mix(0.55, 1.0, smoothstep(uSun.y - uSun.w * 1.2, uSun.y, p.y));
        c = mix(c, uGlow, clamp(g * uGlowAmt, 0.0, 1.0));
      }
      return vec4(c, 1.0);
    }`, { scale: opts.scale ?? 0.5, float: true, mipmap: false, uniforms: {
    uTop: C(P.top), uBot: C(P.bottom), uGlow: C(glow), uRect: rect, uSun: [sun[0], sun[1], glowSize[0], glowSize[1]],
    uMottle: P.mottle, uGlowAmt: glowAmt, uSeed: (opts.seed ?? 1) * 3.17,
  } });
  return api.tex(src, { rect, z: opts.z ?? 1e5, name: opts.name || 'sky-' + variant });
}

// ------------------------------------------------------------------ lobed cloud rows
// Circle chains at several scales give cumulus contours: round bumps with
// cusps between them, small bumps riding on big ones (cauliflower).
export const LOBE_GLSL = /* glsl */ `
// height of the topmost circle over x (>= 0) and the offset u in [-1,1] inside that circle
vec2 a_chain(float x, float cw, float seed, float t, float billow) {
  float ci = floor(x / cw);
  float best = 0.0; float bu = 1.0;
  for (int j = -1; j <= 1; j++) {
    float c = ci + float(j);
    float h1 = hash12(vec2(c * 1.13 + 0.5, seed * 0.917 + 0.3));
    float h2 = hash12(vec2(c * 0.71 + 17.3, seed * 1.37 + 5.1));
    float h3 = hash12(vec2(c * 1.91 - 5.1, seed * 0.53 + 3.3));
    float r = cw * (0.72 + 0.42 * h2) * (1.0 + billow * 0.10 * sin(t * (0.5 + 0.45 * h1) + h3 * 6.283));
    float cx = (c + 0.5 + (h1 - 0.5) * 0.5) * cw;
    float lift = cw * 0.45 * (h3 - 0.5) + billow * cw * 0.06 * sin(t * (0.37 + 0.3 * h2) + h2 * 6.283);
    float dx = x - cx;
    float k = r * r - dx * dx;
    if (k > 0.0) {
      float hh = sqrt(k) + lift;
      if (hh > best) { best = hh; bu = dx / r; }
    }
  }
  return vec2(best, bu);
}
// contour of one cloud row: x = rest x, base = baseline y, R = lobe size px, off = drift offset.
// returns (contourY, u big, u mid, local thickness)
vec4 a_cloudRow(float x, float base, float R, float off, float seed, float t, float billow, float undul, float detail) {
  float xs = x - off;
  vec2 b = a_chain(xs, R * 1.7, seed, t, billow);
  vec2 m = a_chain(xs + 31.0, R * 0.62, seed + 3.7, t * 1.3, billow);
  vec2 s = a_chain(xs + 77.0, R * 0.24, seed + 9.1, t * 1.7, billow);
  vec2 f = a_chain(xs + 13.0, R * 0.09, seed + 5.3, t * 2.1, billow);
  float big = snoise(vec2(xs / (R * 7.0), seed * 0.37 + t * 0.012));
  float y = base + undul * R * 0.9 * big - (0.5 * b.x + detail * (0.72 * m.x + 0.28 * s.x + 0.12 * f.x));
  return vec4(y, b.y, m.y, R * (0.55 + 0.25 * big));
}
`;

// One engine for the sea of clouds and for mist bands: rows of lobed cloud
// contours composited front to back with soft edges, shaded from a
// horizontally blurred contour (grey creeps into crevices, tops stay bright),
// optionally broken into wisps, holed, faded at the bottom and limited in x.
const LOBED_FS = ATMOS_GLSL + LOBE_GLSL + /* glsl */ `
uniform vec4 uSea;    // y of back row, y of front row, rows, lobe radius at front px
uniform vec4 uLook;   // shade amount, outline amount, edge softness px, far fade
uniform vec4 uMove;   // drift px/s (front row), billow amount, evolve rate, seed
uniform vec4 uForm;   // perspective power, undulation, scallop detail, light x
uniform vec4 uMist;   // wispiness, holes, bottom y (0 = none), bottom fade px
uniform vec4 uMist2;  // detached wisps above, density (max alpha), texture, unused
uniform vec4 uExtent; // x0, x1, feather, enabled
uniform vec3 uLitC;   // lit colour (paper)
uniform vec3 uShadowC;// shadow colour (grey ink wash)
uniform vec3 uLineC;  // outline colour
vec4 shade(vec2 p, vec2 uv) {
  float N = uSea.z;
  float t = uTime;
  float sd = uMove.w * 13.7;
  float te = t * uMove.z;
  float Rf = max(uSea.w, 1.0);
  // shared wisp field (world locked, drifting with the front row, slowly evolving)
  vec2 qw = vec2(p.x - uMove.x * t, p.y) / Rf;
  vec2 w = vec2(snoise3(vec3(qw * 0.45 + sd, te * 0.04)), snoise3(vec3(qw * 0.45 + vec2(7.3, 2.1) + sd, te * 0.04 + 4.0)));
  float wn = uMist.x > 0.0 ? fbm3(vec3(qw * vec2(1.3, 3.6) + w * 0.9 + sd, te * 0.06), 4) : 0.0;
  float gr = a_grain(p);
  vec3 col = vec3(0.0); float acc = 0.0;
  for (int i = 0; i < 24; i++) {
    float k = N - 1.0 - float(i);
    if (k < 0.0) break;
    float s = N > 1.0 ? k / (N - 1.0) : 1.0;
    float ps = pow(s, uForm.x);
    float base = mix(uSea.x, uSea.y, ps);
    float R = Rf * mix(0.2, 1.0, ps);
    float off = uMove.x * mix(0.2, 1.0, ps) * t;
    float seed = k * 7.31 + sd;
    vec4 rc = a_cloudRow(p.x, base, R, off, seed, te, uMove.y, uForm.y, uForm.z);
    float evn = snoise(vec2((p.x - off) / (R * 1.3), seed + 2.0));
    float soft = uLook.z * mix(4.0, 1.0, ps) * (1.0 + 4.0 * smoothstep(-0.1, 0.8, evn));
    float d = p.y - rc.x;
    float a = smoothstep(-soft, soft, d + uMist.x * wn * (soft + R * 0.3));
    if (a <= 0.002) continue;
    // shading from a horizontally blurred contour: shadow creeps up into the
    // crevices between lobes and stays away from the round tops
    float hb = R * 0.42;
    float cl = a_cloudRow(p.x - hb, base, R, off, seed, te, uMove.y, uForm.y, uForm.z).x;
    float cr = a_cloudRow(p.x + hb, base, R, off, seed, te, uMove.y, uForm.y, uForm.z).x;
    float cb = 0.3 * cl + 0.4 * rc.x + 0.3 * cr;
    float nz = fbm(vec2(p.x - off, p.y) / (R * 0.5) + seed, 3);
    float db = (p.y - cb) / rc.w;
    float side = uForm.w * 0.12 * (cr - cl) / hb;
    vec2 pq = vec2(p.x - off, p.y);
    float puff = (1.0 - abs(snoise(pq / (R * 0.22) + seed))) * 0.6 + (1.0 - abs(snoise(pq / (R * 0.09) + seed * 1.3))) * 0.4;
    float dark = smoothstep(0.3, 1.25, db + side + 0.25 * nz + 0.22 * (puff - 0.6) + 0.06 * (gr - 0.5));
    dark *= 1.0 - 0.55 * smoothstep(1.8, 4.0, db);              // light bounces back deep inside the mass
    // brushed texture inside the shadow: soft dry strokes following the row
    float brush = fbm(vec2((p.x - off) / (R * 0.32), p.y / (R * 0.16)) + w * 0.6 + seed * 1.7, 3);
    dark *= 1.0 + uMist2.z * 0.35 * brush;
    // definition varies over the sea: calm misty stretches and well-modelled billows
    float defn = smoothstep(-0.45, 0.55, snoise(vec2(p.x - off * 0.5, p.y * 2.0) / (Rf * 5.0) + seed * 0.1 + 40.0));
    float sh = uLook.x * mix(1.0 - uLook.w, 1.0, ps) * mix(0.35, 1.0, defn);
    vec3 c = mix(uLitC, uShadowC, clamp(dark * sh, 0.0, 1.0));
    // thin outline along the top contour (ref 09 style), broken
    if (uLook.y > 0.0) {
      float lw = 0.9 + 0.5 * ps;
      float dl = (d - lw * 1.5) / lw;
      float brk = smoothstep(-0.3, 0.4, snoise(vec2((p.x - off) / (R * 0.8), seed)));
      float line = exp(-dl * dl) * uLook.y * brk * mix(0.35, 1.0, ps);
      c = mix(c, uLineC, line);
    }
    col += (1.0 - acc) * a * c;
    acc += (1.0 - acc) * a;
    if (acc > 0.996) break;
  }
  // detached wisps floating above the back contour
  if (uMist2.x > 0.0) {
    float wf = fbm3(vec3(qw * vec2(0.8, 5.0) + w * 1.3 + 11.0 + sd, te * 0.05), 4);
    float above = exp(-max(uSea.x - p.y, 0.0) / (Rf * 1.1)) * smoothstep(uSea.x + Rf, uSea.x - Rf * 0.3, p.y);
    float aw = smoothstep(0.15, 0.7, wf) * above * uMist2.x * (1.0 - acc);
    col += aw * uLitC; acc += aw;
  }
  float m = uMist2.y;
  if (uMist.y > 0.0) {
    float hv = fbm3(vec3(qw * 0.6 + w * 0.5 + 21.0 + sd, te * 0.05), 3);
    m *= 1.0 - uMist.y * smoothstep(-0.15, 0.45, hv) * exp(-max(p.y - uSea.y, 0.0) / (Rf * 1.5));
  }
  if (uMist.z > 0.0) m *= 1.0 - smoothstep(uMist.z - uMist.w, uMist.z, p.y + wn * uMist.w * 0.5);
  if (uExtent.w > 0.5) {
    m *= smoothstep(uExtent.x - uExtent.z, uExtent.x + uExtent.z, p.x + wn * uExtent.z) * (1.0 - smoothstep(uExtent.y - uExtent.z, uExtent.y + uExtent.z, p.x - wn * uExtent.z));
  }
  return vec4(col, acc) * clamp(m, 0.0, 1.0);
}`;

function lobedLayer(api, o, name, defZ) {
  return api.shader(LOBED_FS, {
    name: o.name || name, z: o.z ?? defZ, rect: o.rect, opacity: o.opacity ?? 1,
    uniforms: {
      uSea: [o.yBack, o.yFront, o.rows, o.lobe],
      uLook: [o.shade, o.outline ?? 0, o.softness, o.farFade ?? 0],
      uMove: [o.drift, o.billow ?? 1, o.evolve ?? 1, o.seed ?? 1],
      uForm: [o.perspective ?? 1.4, o.undulate ?? 1, o.detail ?? 1, o.lightX ?? -1],
      uMist: [o.wisp ?? 0, o.holes ?? 0, o.bottom ?? 0, o.fadeBottom ?? 120],
      uMist2: [o.wispsAbove ?? 0, o.density ?? 1, o.texture ?? 0.5, 0],
      uExtent: o.extent ? [o.extent[0], o.extent[1], o.extent[2] ?? 120, 1] : [0, 0, 1, 0],
      uLitC: C(o.color), uShadowC: C(o.shadowColor), uLineC: C(o.lineColor || [150, 146, 142]),
      ...(o.uniforms || {}),
    },
  });
}

// Sea of clouds: rows of billowing lobes from yBack (far, small, flat) to
// yFront (near, big). Opaque below the back contour, so it hides whatever lies
// behind it (stack slabs between peaks at different z).
export function makeCloudSea(api, opts = {}) {
  const o = { yBack: 500, yFront: 1000, rows: 9, lobe: 110, shade: 0.55, softness: 2.5, farFade: 0.6, drift: 6,
    color: [240, 234, 226], shadowColor: [172, 168, 164], ...opts };
  o.rect = o.rect || [-480, o.yBack - o.lobe * 0.6 - 80, 2880, Math.max(200, 1350 - (o.yBack - o.lobe * 0.6 - 80))];
  return lobedLayer(api, o, 'cloudsea', 3);
}

// Animated band of paper-coloured mist: a soft billowy top contour (low
// contrast puffs), wisps, uneven density, fading out downward. Stack several
// at different z between depth planes to dissolve the bases of what is behind.
export function makeMist(api, opts = {}) {
  const top = opts.top ?? 600;
  const lobe = opts.lobe ?? opts.scale ?? 90;
  const bottom = opts.bottom ?? top + (opts.height ?? 260);
  const o = {
    yBack: top, yFront: opts.yFront ?? top + lobe * 1.3, rows: opts.rows ?? 3, lobe,
    shade: 0.28, softness: 6, farFade: 0, drift: 10, evolve: 0.6, billow: 1, undulate: 0.8, perspective: 1,
    wisp: 0.55, holes: 0.15, bottom, fadeBottom: Math.max(40, (bottom - top) * 0.45), wispsAbove: 0.45, density: 1,
    texture: 0.3, color: PAPER, shadowColor: [205, 199, 190], ...opts,
  };
  o.rect = o.rect || [-480, top - lobe * 2.6 - 60, 2880, bottom - top + lobe * 2.6 + 100];
  return lobedLayer(api, o, 'mist', 3);
}

// Low-lying fog over water: thin, flat, horizontally streaked veils.
export function makeWaterFog(api, opts = {}) {
  const top = opts.top ?? 780;
  return makeMist(api, { top, lobe: 40, rows: 2, yFront: top + 30, undulate: 0.3, detail: 0.4, softness: 18, shade: 0.03,
    wisp: 0.9, holes: 0.35, density: 0.6, wispsAbove: 0.3, height: 120, drift: 6, evolve: 0.4, ...opts, name: opts.name || 'water-fog' });
}

// ------------------------------------------------------------------ sky cloud washes
const WASH_FS = ATMOS_GLSL + /* glsl */ `
uniform vec4 uBlobs[4];  // region of the wash: cx, cy, rx, ry (rest px)
uniform vec4 uBlobW;     // weight of each blob
uniform vec4 uWash;      // max alpha, feature scale px, x-stretch, drift px/s
uniform vec4 uWash2;     // evolve, seed, streaky raggedness, fibres
uniform vec4 uWash3;     // threshold, edge softness, inner mottling, granulation
uniform vec3 uInkC;
vec4 shade(vec2 p, vec2 uv) {
  float t = uTime;
  float m = 0.0;
  for (int i = 0; i < 4; i++) m += uBlobW[i] * a_blob(p, uBlobs[i]);
  float sd = uWash2.y * 11.3;
  float x = p.x - uWash.w * t;
  vec2 q = vec2(x / (uWash.y * uWash.z), p.y / uWash.y);
  float te = t * uWash2.x;
  vec2 w = vec2(fbm3(vec3(q * 0.7 + sd, te), 3), fbm3(vec3(q * 0.7 + 4.3 + sd, te + 2.0), 3));
  float n = fbm3(vec3(q + w * 0.6 + sd * 1.7, te * 1.2), 5);
  // feathered horizontal dry-brush strokes, only in places along the boundary
  vec2 qs = vec2(x / 220.0, p.y / 16.0 + w.y * 0.8);
  float st = fbm(qs + sd, 3) * smoothstep(-0.1, 0.5, snoise(vec2(x / 380.0, p.y / 90.0) + sd + 3.0));
  float f = m + 0.5 * n + uWash2.z * 0.16 * st - uWash3.x;
  float a = smoothstep(0.0, uWash3.y, f);
  // internal mottling: soft lighter / darker cloud masses inside the wash
  vec2 qm = vec2(x / 130.0, p.y / 70.0);
  float mo = fbm3(vec3(qm + w * 0.5 + sd, te * 1.5), 4);
  float mo2 = fbm(vec2(x / 45.0, p.y / 28.0) + w * 0.6 + sd * 2.0, 3);
  a *= 1.0 - uWash3.z * clamp(0.5 + 0.7 * mo + 0.25 * mo2, 0.0, 1.0) * smoothstep(0.0, 0.5, a);
  a *= 1.0 + uWash3.w * (a_grain(p * 1.4) - 0.5);
  float fib = a_fibres(p) * uWash2.w * smoothstep(0.05, 0.5, a);
  a = clamp(a * uWash.x + fib * 0.06, 0.0, 1.0);
  return vec4(uInkC * a, a);
}`;
// Grey ink wash masses for a night / overcast sky (ref 03). Draw behind the moon.
// regions: up to 4 [cx, cy, rx, ry, weight] ellipses where the wash sits.
export function makeCloudWash(api, opts = {}) {
  const regions = (opts.regions || [[1400, 120, 700, 260, 1]]).slice(0, 4);
  const B = new Array(16).fill(0), Wt = [0, 0, 0, 0];
  regions.forEach((r, i) => { B.splice(i * 4, 4, r[0], r[1], r[2], r[3]); Wt[i] = r[4] ?? 1; });
  return api.shader(WASH_FS, {
    name: opts.name || 'cloud-wash', z: opts.z ?? 60, rect: opts.rect || [-480, -270, 2880, 1100], opacity: opts.opacity ?? 1,
    uniforms: {
      uBlobs: B, uBlobW: Wt,
      uWash: [opts.darkness ?? 0.6, opts.scale ?? 260, opts.stretch ?? 3.5, opts.drift ?? 4],
      uWash2: [opts.evolve ?? 0.03, opts.seed ?? 1, opts.streaky ?? 1, opts.fibres ?? 1],
      uWash3: [opts.threshold ?? 0.35, opts.edge ?? 0.55, opts.mottle ?? 0.45, opts.grain ?? 0.25],
      uInkC: C(opts.color || [116, 111, 106]),
      ...(opts.uniforms || {}),
    },
  });
}

// ------------------------------------------------------------------ sky strata (streaks / bands)
const STRATA_FS = ATMOS_GLSL + /* glsl */ `
uniform vec4 uBand;    // y0, y1, feather px, unused
uniform vec4 uMove;    // drift px/s, evolve, seed, undulation px
uniform vec4 uWG, uWP; // wash  geo (length px, thickness px, raggedness, y offset) / params (alpha, threshold, softness, wet rim)
uniform vec4 uDG, uDP; // dark  geo / params (alpha, threshold, softness, unused)
uniform vec4 uLG, uLP; // light geo / params (alpha, threshold, softness, unused)
uniform vec3 uLightC, uDarkC, uWashC, uTintC;
uniform vec4 uSun;     // x, y, rx, ry : tint toward uTintC near the sun
uniform vec4 uMaskR;   // optional region ellipse cx, cy, rx, ry (rx = 0: none)
uniform vec4 uFloor;   // horizon haze: top y, softness px, alpha, colour = uWashC (tinted)
uniform vec3 uFloorC;
float a_strata(vec2 p, float x, float te, float sd, vec4 g) {
  float y = p.y + g.w;
  float und = uMove.w * snoise(vec2(x / 900.0, sd + 0.37)) + uMove.w * 0.4 * snoise(vec2(x / 310.0, sd + 5.1));
  vec2 q = vec2(x / g.x, (y + und) / g.y);
  float n = fbm3(vec3(q + sd, te), 4);
  float r = fbm(vec2(x / (g.x * 0.16), (y + und) / (g.y * 0.32)) + sd * 1.3, 3);
  return n + g.z * 0.25 * r;
}
vec4 shade(vec2 p, vec2 uv) {
  float t = uTime;
  float band = smoothstep(uBand.x - uBand.z, uBand.x + uBand.z, p.y) * (1.0 - smoothstep(uBand.y - uBand.z, uBand.y + uBand.z, p.y));
  if (uMaskR.z > 0.0) band *= smoothstep(0.0, 1.0, 1.3 * a_blob(p, uMaskR));
  float sd = uMove.z * 7.77;
  float x = p.x - uMove.x * t;
  float te = t * uMove.y;
  vec2 dv = (p - uSun.xy) / max(uSun.zw, vec2(1.0));
  float tint = exp(-dot(dv, dv));
  vec3 col = vec3(0.0); float A = 0.0;
  if (uFloor.z > 0.0) {   // opaque horizon haze the sun sinks into
    float fy = uFloor.x + 3.0 * snoise(vec2(x / 260.0, sd + 9.0)) + 2.0 * fbm(vec2(x / 40.0, p.y / 6.0) + sd, 2);
    float af = uFloor.z * smoothstep(fy - uFloor.y, fy + uFloor.y, p.y);
    float tx = (p.x - uSun.x) / max(uSun.z * 1.3, 1.0), ty = (p.y - fy) / 30.0;
    vec3 cf = mix(uFloorC, uTintC, 0.5 * exp(-tx * tx - ty * ty));
    col = cf * af; A = af;
  }
  if (band <= 0.001) return vec4(col, A);
  if (uWP.x > 0.0) {   // flat coloured bands with a wet edge
    float f = a_strata(p, x, te, sd + 3.0, uWG);
    float th = uWP.y;
    float a = smoothstep(th, th + uWP.z, f);
    float rim = a * (1.0 - smoothstep(th + uWP.z, th + uWP.z + 0.1, f));
    float inner = fbm(vec2(x / 60.0, p.y / 9.0) + sd, 3);
    float aw = clamp(uWP.x * (a * (0.78 + 0.22 * inner + 0.15 * (a_grain(p * 0.8) - 0.5)) + uWP.w * rim), 0.0, 1.0) * band;
    vec3 cw = mix(uWashC, uTintC, tint);
    col = cw * aw + col * (1.0 - aw); A = aw + A * (1.0 - aw);
  }
  if (uDP.x > 0.0) {   // soft darker cloud masses
    float f2 = a_strata(p, x, te, sd, uDG);
    float ad = uDP.x * smoothstep(uDP.y, uDP.y + uDP.z, f2) * band;
    vec3 cd = mix(uDarkC, uTintC, tint * 0.6);
    col = cd * ad + col * (1.0 - ad); A = ad + A * (1.0 - ad);
  }
  if (uLP.x > 0.0) {   // paper-coloured torn strands
    float f = a_strata(p, x, te, sd, uLG);
    float al = uLP.x * smoothstep(uLP.y, uLP.y + uLP.z, f) * band;
    col = uLightC * al + col * (1.0 - al); A = al + A * (1.0 - al);
  }
  return vec4(col, A);
}`;

// Horizontal sky cloud strata. style presets:
//  'night'  (ref 03) paper-coloured torn strands with soft darker masses above them
//  'golden' (ref 02) flat ochre washes with wet edges, golden near the sun
//  'thin'   (ref 05) thin pale strands + salmon haze band near the sun
const STRATA_PRESETS = {
  night: { band: [120, 380, 60], und: 18, drift: 6,
    wash: { geo: [1, 1, 0, 0], p: [0, 0, 0, 0] },
    dark: { geo: [210, 46, 0.5, 20], p: [0.45, 0.1, 0.35, 0] },
    light: { geo: [170, 19, 0.9, 0], p: [0.95, 0.4, 0.06, 0] },
    lightC: [229, 219, 207], darkC: [128, 121, 114], washC: [0, 0, 0], tintC: [0, 0, 0] },
  golden: { band: [60, 330, 60], und: 14, drift: 5,
    wash: { geo: [330, 30, 1.0, 0], p: [0.42, 0.08, 0.025, 0.7] },
    dark: { geo: [1, 1, 0, 0], p: [0, 0, 0, 0] },
    light: { geo: [1, 1, 0, 0], p: [0, 0, 0, 0] },
    lightC: [0, 0, 0], darkC: [0, 0, 0], washC: [226, 196, 150], tintC: [240, 200, 128] },
  thin: { band: [345, 415, 18], und: 2, drift: 4,
    wash: { geo: [520, 22, 0.5, 0], p: [0.6, -0.2, 0.55, 0] },
    dark: { geo: [1, 1, 0, 0], p: [0, 0, 0, 0] },
    light: { geo: [320, 4.5, 0.9, 0], p: [0.85, 0.42, 0.07, 0] },
    lightC: [236, 226, 213], darkC: [0, 0, 0], washC: [228, 212, 200], tintC: [234, 168, 144] },
};
export function makeSkyStreaks(api, opts = {}) {
  const style = opts.style || 'night';
  const P = STRATA_PRESETS[style];
  const part = (k) => ({ geo: (opts[k] && opts[k].geo) || P[k].geo, p: (opts[k] && opts[k].p) || P[k].p });
  const W = part('wash'), D = part('dark'), L = part('light');
  const band = opts.band ? [opts.band[0], opts.band[1], opts.band[2] ?? P.band[2], 0] : [...P.band, 0];
  const sun = opts.sun || [1742, 360, 260, 60];
  const mask = opts.region || [0, 0, 0, 0];
  const rect = opts.rect || (opts.floor ? [-480, band[0] - band[2] - 40, 2880, 1350 - band[0]] : [-480, band[0] - band[2] - 40, 2880, band[1] - band[0] + band[2] * 2 + 80]);
  return api.shader(STRATA_FS, {
    name: opts.name || 'sky-streaks-' + style, z: opts.z ?? 50, rect, opacity: opts.opacity ?? 1,
    uniforms: {
      uBand: band, uMove: [opts.drift ?? P.drift, opts.evolve ?? 0.04, opts.seed ?? 1, opts.undulate ?? P.und],
      uWG: W.geo, uWP: W.p, uDG: D.geo, uDP: D.p, uLG: L.geo, uLP: L.p,
      uLightC: C(opts.lightColor || P.lightC), uDarkC: C(opts.darkColor || P.darkC), uWashC: C(opts.washColor || P.washC), uTintC: C(opts.tintColor || P.tintC),
      uSun: sun, uMaskR: mask,
      uFloor: opts.floor ? [opts.floor[0], opts.floor[1] ?? 8, opts.floor[2] ?? 1, 0] : [0, 1, 0, 0], uFloorC: C(opts.floorColor || [236, 228, 216]),
      ...(opts.uniforms || {}),
    },
  });
}
// ------------------------------------------------------------------ torn cloud strands (night)
// Explicit brush objects scattered on a drifting cell grid: torn paper-coloured
// strands (reserved whites) and soft dark lumps with billowy tops.
const STRANDS_FS = ATMOS_GLSL + LOBE_GLSL + /* glsl */ `
uniform vec4 uBand;    // y0, y1, feather, density
uniform vec4 uCell;    // strand row height px, strand cell width px, lump row height, lump cell width
uniform vec4 uMove;    // drift px/s, evolve, seed, undulation px
uniform vec4 uLP;      // strand alpha, thickness (fraction of row), length (fraction of cell), raggedness
uniform vec4 uDP;      // lump alpha, lump presence, softness px, unused
uniform vec3 uLightC, uDarkC, uWashC, uTintC;
uniform vec4 uMaskR;   // region ellipse where strands cluster (rx = 0: everywhere)
uniform vec4 uMode;    // 0 = reserved light strands, 1 = coloured wash patches; wet rim, interior variation, unused
uniform vec4 uSun;     // tint toward uTintC near (x, y) with radii (rx, ry)
float a_present(vec2 c) {
  // presence of a strand centred at drifting coords c (band, region, density)
  vec2 pw = vec2(c.x + uMove.x * uTime, c.y);
  float band = smoothstep(uBand.x - uBand.z, uBand.x + uBand.z, pw.y) * (1.0 - smoothstep(uBand.y - uBand.z, uBand.y + uBand.z, pw.y));
  float reg = uMaskR.z > 0.0 ? smoothstep(0.05, 0.75, a_blob(pw, uMaskR)) : 1.0;
  return band * reg * uBand.w;
}
vec2 a_strand(vec2 q, float te, float sd) {
  // q: drifting coords. returns (coverage, wet-rim) of the strands near q
  float H = uCell.x, Wc = uCell.y;
  float j0 = floor(q.y / H);
  float cov = 0.0, rimv = 0.0;
  for (int dj = -1; dj <= 1; dj++) {
    float j = j0 + float(dj);
    for (int di = -2; di <= 2; di++) {
      float i = floor(q.x / Wc) + float(di);
      vec4 h = vec4(hash12(vec2(i, j + sd)), hash12(vec2(i + 7.1, j - sd)), hash12(vec2(i - 3.3, j + 2.7 * sd)), hash12(vec2(i + 1.9, j + 5.3)));
      float h5 = hash12(vec2(i * 0.37 + 9.7, j * 1.31 - 2.2));
      // strands cluster in groups
      float grp = smoothstep(-0.6, 0.3, snoise(vec2(i * Wc / 420.0, j * H / 110.0) + sd));
      vec2 c = vec2((i + 0.5 + 0.6 * (h.w - 0.5)) * Wc, (j + 0.5 + 0.9 * (h5 - 0.5)) * H);
      if (h.x > a_present(c) * grp) continue;
      float len = Wc * uLP.z * (0.35 + 1.15 * h.y * h.y);
      float th = H * uLP.y * (0.5 + 1.0 * h.z * h.z);
      vec2 d = q - c;
      d.y -= (h5 - 0.5) * 0.08 * d.x;                       // slight slant
      float u = d.x / (len * 0.5);
      if (abs(u) > 1.0) continue;
      float skew = (h.y - 0.5) * 1.4;
      float prof = sqrt(max(1.0 - u * u, 0.0)) * clamp(1.0 + skew * u, 0.15, 2.0);
      // lumpy top made of small round bumps, ragged hairy bottom
      vec2 bump = a_chain(d.x + i * 53.0, max(th * 1.1, 3.0), j + i * 0.1 + sd, te * 6.0, 1.0);
      float n2 = snoise(vec2(d.x / mix(17.0, 45.0, uMode.x) - i * 2.3, j * 2.9 + 0.37 - te));
      float top = -th * prof * (0.3 + 0.7 * uLP.w * bump.x / max(th * 1.1, 3.0));
      float bot = th * prof * (0.3 + mix(0.25, 0.1, uMode.x) * n2 * uLP.w);
      float fine = uMode.x * 1.3 * snoise(vec2(d.x / 8.0 + i * 3.0, d.y / 8.0 + j));
      float inside = smoothstep(top - 0.8, top + 0.8, d.y + fine) * (1.0 - smoothstep(bot - 1.5, bot + 1.5, d.y - fine));
      // breaks along the strand; dry-brush hair streaks feather the ends and bottom
      float brk = uMode.x < 0.5 ? smoothstep(-0.75, -0.35, snoise(vec2(d.x / 26.0 + d.y / 9.0 + i * 5.7, d.y / 7.0 + j * 3.3 + te * 0.5)))
                                : smoothstep(-0.62, -0.3, snoise(vec2(d.x / 38.0 + i * 5.7, d.y / 3.5 + j * 3.3 + te * 0.5)) + 0.35 * smoothstep(0.0, 0.6, (d.y - top) / max(bot - top, 1.0)));
      float hair = snoise(vec2(d.x / 40.0 + i, d.y / 1.4 + j * 7.0));
      float feather = smoothstep(0.55, 1.0, abs(u)) + smoothstep(0.0, max(bot, 1.0), d.y) * 0.6;
      float hairA = mix(1.0, smoothstep(-0.2, 0.5, hair), clamp(feather, 0.0, 1.0) * (1.0 - uMode.x));
      float bright = mix(0.62 + 0.38 * h5, 1.0 - 0.4 * smoothstep(0.2, 1.0, (d.y - top) / max(bot - top, 1.0)), uMode.x);
      float cv = inside * brk * hairA * bright;
      if (cv > cov) { cov = cv; rimv = inside * exp(-max(min(d.y - top, bot - d.y), 0.0) / 2.2); }
    }
  }
  return vec2(cov, rimv);
}
float a_lump(vec2 q, float te, float sd) {
  float H = uCell.z, Wc = uCell.w;
  float j0 = floor(q.y / H);
  float cov = 0.0;
  for (int dj = -1; dj <= 0; dj++) {
    float j = j0 + float(dj);
    for (int di = -1; di <= 1; di++) {
      float i = floor(q.x / Wc) + float(di);
      vec4 h = vec4(hash12(vec2(i * 1.3, j + sd + 11.0)), hash12(vec2(i + 4.1, j - sd + 3.0)), hash12(vec2(i - 8.3, j + 1.7)), hash12(vec2(i + 2.9, j + 9.3)));
      if (h.x > uDP.y) continue;
      float wdt = Wc * (0.5 + 0.7 * h.y);
      float hgt = H * (0.5 + 0.5 * h.z);
      vec2 c = vec2((i + 0.5 + 0.5 * (h.w - 0.5)) * Wc, (j + 0.6) * H);
      vec2 d = q - c;
      float u = d.x / (wdt * 0.5);
      if (abs(u) > 1.0) continue;
      float env = sqrt(max(1.0 - u * u, 0.0));
      vec2 ch = a_chain(d.x + i * 97.0, hgt * 0.3, sd + i, te * 8.0, 1.0);
      float top = -hgt * env * 0.35 - ch.x * 1.1 * env;
      float sft = uDP.z;
      float a = smoothstep(top - sft * 0.3, top + sft, d.y);
      a *= 1.0 - smoothstep(0.0, hgt * 0.9, d.y);      // fades out downward
      a *= smoothstep(1.0, 0.6, abs(u));
      cov = max(cov, a);
    }
  }
  return cov;
}
vec4 shade(vec2 p, vec2 uv) {
  float t = uTime;
  float band = smoothstep(uBand.x - uBand.z, uBand.x + uBand.z, p.y) * (1.0 - smoothstep(uBand.y - uBand.z, uBand.y + uBand.z, p.y));
  float reg = uMaskR.z > 0.0 ? smoothstep(0.05, 0.75, a_blob(p, uMaskR)) : 1.0;
  float presence = band * reg * uBand.w;
  if (presence <= 0.002) return vec4(0.0);
  float sd = uMove.z * 7.77;
  float te = t * uMove.y;
  float und = uMove.w * snoise(vec2(p.x / 700.0, sd + 0.37));
  vec2 q = vec2(p.x - uMove.x * t, p.y + und);
  float lump = uDP.x > 0.0 ? a_lump(q, te, sd) * uDP.x * band * reg : 0.0;
  float mo = 0.8 + 0.2 * fbm(q / 40.0 + sd, 3);
  vec3 col = uDarkC * lump * mo; float A = lump * mo;
  vec2 sr = a_strand(q, te, sd);
  if (uMode.x < 0.5) {
    float s = sr.x * uLP.x;
    col = uLightC * s + col * (1.0 - s); A = s + A * (1.0 - s);
  } else {
    vec2 dv = (p - uSun.xy) / max(uSun.zw, vec2(1.0));
    vec3 wc = mix(uWashC, uTintC, exp(-dot(dv, dv)));
    float inner = fbm(vec2(q.x / 55.0, q.y / 8.0) + sd, 3);
    float s = clamp(uLP.x * (sr.x * (0.8 + uMode.z * 0.2 * inner + 0.12 * (a_grain(p * 0.8) - 0.5)) + uMode.y * sr.y), 0.0, 1.0);
    wc *= 1.0 - 0.08 * sr.y;
    col = wc * s + col * (1.0 - s); A = s + A * (1.0 - s);
  }
  return vec4(col, A);
}`;

// Torn light cloud strands with soft dark lumps (night sky, ref 03). Draw in
// front of the moon so passing strands veil it.
export function makeCloudStrands(api, opts = {}) {
  const band = opts.band || [130, 330, 40];
  const rect = opts.rect || [-480, band[0] - (band[2] ?? 40) - 60, 2880, band[1] - band[0] + (band[2] ?? 40) * 2 + 120];
  return api.shader(STRANDS_FS, {
    name: opts.name || 'cloud-strands', z: opts.z ?? 50, rect, opacity: opts.opacity ?? 1, blend: opts.blend || 'normal',
    uniforms: {
      uBand: [band[0], band[1], band[2] ?? 40, opts.density ?? 0.45],
      uCell: [opts.rowHeight ?? 30, opts.cellWidth ?? 150, opts.lumpRow ?? 80, opts.lumpWidth ?? 260],
      uMove: [opts.drift ?? 6, opts.evolve ?? 0.08, opts.seed ?? 1, opts.undulate ?? 14],
      uLP: [opts.alpha ?? 0.95, opts.thickness ?? 0.5, opts.length ?? 1.1, opts.ragged ?? 1],
      uDP: [opts.lumps ?? 0.4, opts.lumpPresence ?? 0.45, opts.lumpSoftness ?? 6, 0],
      uLightC: C(opts.lightColor || [229, 219, 207]), uDarkC: C(opts.darkColor || [128, 121, 114]),
      uWashC: C(opts.washColor || [226, 196, 150]), uTintC: C(opts.tintColor || opts.washColor || [226, 196, 150]),
      uMode: [opts.mode === 'wash' ? 1 : 0, opts.rim ?? 0.35, opts.interior ?? 1, 0], uSun: opts.sun || [0, 0, 1, 1],
      uMaskR: opts.region || [0, 0, 0, 0],
      ...(opts.uniforms || {}),
    },
  });
}
// ------------------------------------------------------------------ moon
// Default maria layout (unit-disc coords, y down): x, y, radius, strength.
const MARIA = [
  [0.05, -0.42, 0.24, 1.0], [-0.42, -0.42, 0.2, 0.55], [0.56, -0.44, 0.13, 0.9], [0.62, -0.05, 0.16, 0.8],
  [0.3, -0.12, 0.16, 0.7], [-0.15, -0.12, 0.17, 0.45], [-0.6, 0.02, 0.18, 0.45], [-0.45, 0.42, 0.16, 0.35],
  [-0.12, 0.5, 0.14, 0.3], [0.35, 0.28, 0.12, 0.35],
];
export function makeMoon(api, opts = {}) {
  const x = opts.x ?? 1339, y = opts.y ?? 200, r = opts.r ?? 79;
  const halo = opts.halo ?? 0.12, haloR = opts.haloRadius ?? 1.4;
  const ext = Math.ceil(r * (1 + haloR * 1.6) + 6);
  const size = ext * 2;
  const M = new Array(40).fill(0);
  (opts.maria || MARIA).slice(0, 10).forEach((m, i) => M.splice(i * 4, 4, ...m));
  const src = api.bakeShader(size, size, ATMOS_GLSL + /* glsl */ `
    uniform vec4 uM;       // r, halo, halo radius (in r), seed
    uniform vec4 uMar[10];
    uniform vec3 uMoonC, uMariaC, uHaloC;
    uniform float uMaria;
    vec4 shade(vec2 p, vec2 uv) {
      vec2 d = (p - uSize * 0.5) / uM.x;
      float rr = length(d);
      float aa = 1.1 / uM.x;
      float edgeN = 0.006 * snoise(d * 9.0 + uM.w);
      float disc = 1.0 - smoothstep(1.0 - aa, 1.0 + aa * 0.4, rr + edgeN);
      // maria: watercolour blooms, irregular, slightly darker rims
      vec2 w = d + 0.09 * vec2(fbm(d * 3.1 + uM.w, 3), fbm(d * 3.1 + uM.w + 5.2, 3));
      float f = 0.0;
      for (int i = 0; i < 10; i++) {
        vec4 m = uMar[i];
        if (m.z <= 0.0) continue;
        float q = length(w - m.xy) / m.z;
        f = max(f, m.w * (1.0 - smoothstep(0.55, 1.05, q + 0.25 * fbm(w * 7.0 + float(i) * 3.1, 3))));
      }
      float tex = fbm(w * 11.0 + uM.w * 2.0, 3);
      float mar = clamp(f * (0.75 + 0.35 * tex), 0.0, 1.0);
      float rim = smoothstep(0.08, 0.3, f) * (1.0 - smoothstep(0.3, 0.7, f));
      vec3 c = mix(uMoonC, uMariaC, uMaria * (mar * 0.85 + rim * 0.25));
      // faint fine specks and a brighter left limb
      c *= 1.0 + 0.018 * smoothstep(0.55, 1.0, rr) * smoothstep(0.2, -0.6, d.x);
      c *= 1.0 - 0.025 * smoothstep(0.75, 0.95, vnoise(p * 0.6 + uM.w));
      // halo outside the disc
      float h = uM.y * exp(-max(rr - 1.0, 0.0) / max(uM.z, 0.01) * 2.2) * (1.0 - disc);
      vec3 col = c * disc + uHaloC * h;
      float a = disc + h;
      return vec4(col, clamp(a, 0.0, 1.0));
    }`, { scale: opts.scale ?? 1.5, uniforms: {
    uM: [r, halo, haloR, (opts.seed ?? 1) * 1.37], uMar: M, uMaria: opts.maria === false ? 0 : (opts.mariaAmount ?? 1),
    uMoonC: C(opts.color || [245, 237, 222]), uMariaC: C(opts.mariaColor || [222, 212, 199]), uHaloC: C(opts.haloColor || [236, 228, 214]),
  } });
  return api.tex(src, { rect: [x - ext, y - ext, size, size], z: opts.z ?? 1e5, opacity: opts.opacity ?? 1, name: opts.name || 'moon' });
}

// ------------------------------------------------------------------ sun
// style 'golden' (ref 02): pale cream disc, soft edge, warm near-glow.
// style 'red' (ref 05): flat vermilion disc with slight brush texture.
export function makeSun(api, opts = {}) {
  const style = opts.style || 'golden';
  const red = style === 'red';
  const x = opts.x ?? (red ? 1742 : 1349), y = opts.y ?? (red ? 350 : 339), r = opts.r ?? (red ? 39 : 54);
  const glowR = opts.glowRadius ?? (red ? 1.2 : 2.2);
  const ext = Math.ceil(r * (1 + glowR) + 8);
  const size = ext * 2;
  const col = opts.color || (red ? [234, 150, 124] : [254, 242, 206]);
  const glowC = opts.glowColor || (red ? [238, 196, 178] : [254, 233, 184]);
  const src = api.bakeShader(size, size, ATMOS_GLSL + /* glsl */ `
    uniform vec4 uS;      // r, edge softness px, glow amount, glow radius (in r)
    uniform vec4 uT;      // texture amount, seed, red style, unused
    uniform vec3 uCol, uGlowC;
    vec4 shade(vec2 p, vec2 uv) {
      vec2 d = (p - uSize * 0.5) / uS.x;
      float rr = length(d);
      float aa = uS.y / uS.x;
      float edgeN = uT.z * 0.012 * fbm(d * 6.0 + uT.y, 3);
      float disc = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, rr + edgeN);
      vec3 c = uCol;
      // brush texture: soft mottling, faint horizontal drag, granulation
      float mo = fbm(d * 2.2 + uT.y, 4);
      float drag = fbm(vec2(d.x * 1.2, d.y * 7.0) + uT.y * 2.0, 3);
      float g = a_grain(p * 1.3 + uT.y * 10.0) - 0.5;
      c *= 1.0 + uT.x * (0.05 * mo + 0.04 * drag + 0.06 * g);
      // the vermilion pools a touch at the rim
      c *= 1.0 - uT.z * 0.05 * smoothstep(0.75, 1.0, rr);
      float h = uS.z * exp(-max(rr - 1.0, 0.0) / max(uS.w, 0.01) * 2.5) * (1.0 - disc);
      vec3 colr = c * disc + uGlowC * h;
      return vec4(colr, clamp(disc + h, 0.0, 1.0));
    }`, { scale: opts.scale ?? 1.5, uniforms: {
    uS: [r, opts.edge ?? (red ? 1.2 : 2.6), opts.glow ?? (red ? 0.12 : 0.35), glowR],
    uT: [opts.texture ?? (red ? 1 : 0.3), (opts.seed ?? 1) * 1.91, red ? 1 : 0, 0],
    uCol: C(col), uGlowC: C(glowC),
  } });
  return api.tex(src, { rect: [x - ext, y - ext, size, size], z: opts.z ?? 1e5, opacity: opts.opacity ?? 1, name: opts.name || 'sun-' + style });
}