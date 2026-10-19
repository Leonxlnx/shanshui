// s09 sea of clouds: piled cumulus billows (ref 09). Rows of big round puffs carrying smaller
// bumps; each puff is paper-white at its top and turns to a mottled grey wash toward its lower
// part, where the next row's white tops overlap it. No outlines. A faint grey haze rises above
// the back row so peak bases dissolve into it. Pure function of uTime, rest-space p.
import { ATMOS_GLSL, LOBE_GLSL } from '../../lib/atmos.js';

const FS = ATMOS_GLSL + LOBE_GLSL + /* glsl */ `
uniform vec4 uA;   // yBack, yFront, rows, R (front row lobe radius)
uniform vec4 uB;   // drift px/s (front row), evolve rate, seed, edge softness px
uniform vec4 uC;   // shade, haze amount, density, top whiteness depth (x R)
uniform vec4 uD;   // extent x0, x1, feather, enabled
uniform vec4 uE;   // wisp amount, row perspective power, haze height (x R), bottom fade y (0 = off)
uniform vec4 uF;   // contour amount, contour width px, brush texture, wash clearing below the tops
uniform vec3 uLit, uShadow, uHaze;
// chain of circles (5-cell search: no seams), returns (height of the top circle, offset u in it)
vec2 chain5(float x, float cw, float seed, float t, float liftAmt) {
  float ci = floor(x / cw); float best = -1e9; float bu = 1.0;
  for (int j = -2; j <= 2; j++) {
    float c = ci + float(j);
    float h1 = hash12(vec2(c * 1.13 + 0.5, seed * 0.917 + 0.3));
    float h2 = hash12(vec2(c * 0.71 + 17.3, seed * 1.37 + 5.1));
    float h3 = hash12(vec2(c * 1.91 - 5.1, seed * 0.53 + 3.3));
    float r = cw * (0.7 + 0.5 * h2) * (1.0 + 0.06 * sin(t * (0.5 + 0.45 * h1) + h3 * 6.283));
    float cx = (c + 0.5 + (h1 - 0.5) * 0.6) * cw;
    float lift = cw * liftAmt * (h3 - 0.5) + cw * 0.05 * sin(t * (0.37 + 0.3 * h2) + h2 * 6.283);
    float dx = x - cx; float k = r * r - dx * dx;
    if (k > 0.0) { float hh = sqrt(k) + lift; if (hh > best) { best = hh; bu = dx / r; } }
  }
  return vec2(max(best, 0.0), bu);
}
float rowY(float xs, float base, float R, float seed, float t, out float bu) {
  vec2 b = chain5(xs, R * 1.5, seed, t, 0.9);
  vec2 m = chain5(xs + 31.0, R * 0.52, seed + 3.7, t * 1.3, 0.5);
  vec2 s = chain5(xs + 77.0, R * 0.2, seed + 9.1, t * 1.7, 0.3);
  bu = b.y;
  float big = snoise(vec2(xs / (R * 5.0), seed * 0.37 + 2.0));
  return base + R * 0.75 * big - (0.62 * b.x + 0.45 * m.x + 0.2 * s.x);
}
vec4 shade(vec2 p, vec2 uv) {
  float N = uA.z, Rf = uA.w, t = uTime, te = t * uB.y, sd = uB.z * 13.7;
  vec3 col = vec3(0.0); float acc = 0.0;
  float gr = a_grain(p);
  float backY = 1e9, backR = Rf;
  for (int i = 0; i < 8; i++) {
    float k = N - 1.0 - float(i);
    if (k < 0.0) break;
    float s = N > 1.0 ? k / (N - 1.0) : 1.0;
    float ps = pow(s, uE.y);
    float base = mix(uA.x, uA.y, ps);
    float R = Rf * mix(0.38, 1.0, ps);
    float off = uB.x * mix(0.35, 1.0, ps) * t;
    float seed = k * 7.31 + sd;
    float xs = p.x - off + k * 173.0;
    float bu;
    float yc = rowY(xs, base, R, seed, te, bu);
    if (k == 0.0) { backY = yc; backR = R; }
    float d = p.y - yc;
    // wispy, slowly changing top edge
    float wn = fbm(vec2(xs / (R * 0.7) + te * 0.03, p.y / (R * 0.35) + seed), 2);
    float soft = uB.w * (1.0 + 2.5 * smoothstep(0.2, 0.9, wn));
    float a = smoothstep(-soft, soft, d + uE.x * wn * R * 0.25);
    if (a <= 0.002) continue;
    float dn = d / R;
    // a soft wash pools below the white top of each puff and clears again lower down
    // (painted, not modelled: streaky brush texture, no flat grey bands)
    float mot = fbm(vec2(xs / (R * 1.2), p.y / (R * 0.7)) + seed, 3);
    float fine = fbm(vec2(xs / (R * 0.28), p.y / (R * 0.075)) + seed * 1.7, 3);
    float wt = uC.w * (1.0 + 0.9 * snoise(vec2(xs / (R * 2.2), seed + 5.0)));
    float g = smoothstep(wt, wt + 1.5, dn * 0.85 + 0.55 * mot + uF.z * 0.3 * fine);
    g *= 1.0 - uF.w * smoothstep(1.1, 2.8, dn + 0.7 * mot);
    g *= 1.0 + 0.25 * (gr - 0.5) + uF.z * 0.35 * fine;
    float defn = smoothstep(-0.6, 0.5, snoise(vec2(xs / (Rf * 4.0), seed * 0.1 + 40.0)));
    float sh = uC.x * mix(0.45, 1.0, defn) * mix(0.75, 1.0, ps);
    vec3 c = mix(uLit, uShadow, clamp(g * sh, 0.0, 1.0));
    // faint broken contour hugging the crisp parts of the top edge (drawn scallops)
    if (uF.x > 0.0) {
      float dd = d + uE.x * wn * R * 0.25;
      float ln = exp(-pow((dd - uB.w * 0.9 - uF.y) / uF.y, 2.0));
      float brk = smoothstep(-0.35, 0.35, snoise(vec2(xs / (R * 0.45), seed + 11.0)));
      ln *= brk * (1.0 - smoothstep(0.1, 0.7, wn)) * (0.75 + 0.5 * gr);
      c = mix(c, uShadow, clamp(ln * uF.x, 0.0, 1.0));
    }
    col += (1.0 - acc) * a * c;
    acc += (1.0 - acc) * a;
    if (acc > 0.996) break;
  }
  // grey haze above the back row (peak bases dissolve into it)
  if (uC.y > 0.0 && acc < 0.996 && backY < 1e8) {
    float above = max(backY - p.y, 0.0);
    float hn = fbm(vec2((p.x - uB.x * 0.3 * t) / (backR * 2.0) + te * 0.01, p.y / backR + sd), 2) * 0.5 + 0.5;
    float h = uC.y * exp(-above / (backR * uE.z)) * (0.6 + 0.8 * hn) * smoothstep(-2.0, 6.0, above);
    h = clamp(h, 0.0, 1.0) * (1.0 - acc);
    col += h * uHaze; acc += h;
  }
  float m = uC.z;
  if (uD.w > 0.5) m *= smoothstep(uD.x - uD.z, uD.x + uD.z, p.x) * (1.0 - smoothstep(uD.y - uD.z, uD.y + uD.z, p.x));
  if (uE.w > 0.0) m *= 1.0 - smoothstep(uE.w - 80.0, uE.w, p.y);
  return vec4(col, acc) * clamp(m, 0.0, 1.0);
}`;

const c01 = (c) => c.map((v) => v / 255);

export function makeBillows(api, o = {}) {
  const yBack = o.yBack ?? 600, yFront = o.yFront ?? 900, R = o.lobe ?? 100;
  const rect = o.rect || [-480, yBack - R * 1.8 - (o.hazeH ?? 1.2) * R * 0.38 * 3, 2880, (o.bottomY || yFront + R) - (yBack - R * 3)];
  return api.shader(FS, {
    name: o.name || 'billows', z: o.z ?? 2, rect, opacity: o.opacity ?? 1,
    uniforms: {
      uA: [yBack, yFront, o.rows ?? 4, R],
      uB: [o.drift ?? 6, o.evolve ?? 1, o.seed ?? 1, o.softness ?? 5],
      uC: [o.shade ?? 0.8, o.haze ?? 0.25, o.density ?? 1, o.white ?? 0.18],
      uD: o.extent ? [o.extent[0], o.extent[1], o.extent[2] ?? 120, 1] : [0, 0, 1, 0],
      uE: [o.wisp ?? 0.6, o.perspective ?? 1.2, o.hazeH ?? 1.2, o.bottomFade ?? 0],
      uF: [o.contour ?? 0.35, o.contourW ?? 1.6, o.texture ?? 1, o.clear ?? 0.7],
      uLit: c01(o.color || [241, 235, 226]), uShadow: c01(o.shadowColor || [186, 180, 171]), uHaze: c01(o.hazeColor || [222, 216, 207]),
    },
  });
}
