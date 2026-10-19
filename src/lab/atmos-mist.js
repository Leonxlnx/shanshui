// Mist bands stacked between simple ink test silhouettes (three depth planes),
// to judge how mist dissolves mountain bases (compare refs 01 / 04 / 07).
import { makeSky, makeMist } from '../lib/atmos.js';

const PEAK_FS = /* glsl */ `
uniform vec4 uP;      // base y, height scale, ink tone (0 black..1 paper), seed
uniform vec4 uPk[6];  // peaks: x, top y, half width, sharpness
vec4 shade(vec2 p, vec2 uv) {
  float ridge = 1e9;
  for (int i = 0; i < 6; i++) {
    vec4 k = uPk[i];
    if (k.z <= 0.0) continue;
    float dx = abs(p.x - k.x + 0.12 * (p.y - k.y)) / k.z;
    float y = k.y + (uP.x - k.y) * pow(dx, k.w) + 14.0 * fbm(vec2(p.x * 0.025, uP.w + float(i)), 4);
    ridge = min(ridge, y);
  }
  float d = p.y - ridge;
  if (d < 0.0) return vec4(0.0);
  float edge = smoothstep(0.0, 1.5, d);
  // darker contour at the top, texture of vertical strokes, fading down
  float cun = streaks(p * 0.03 + uP.w, vec2(0.15, 1.0), 5.0, 4) * 0.5 + 0.5;
  float a = edge * (0.55 + 0.45 * exp(-d / 26.0)) * (0.65 + 0.35 * cun) * exp(-d / uP.y) * smoothstep(1.0, 0.6, uv.y);
  vec3 ink = mix(vec3(0.05, 0.045, 0.04), vec3(0.937, 0.906, 0.863), uP.z);
  a = clamp(a, 0.0, 1.0);
  return vec4(ink * a, a);
}`;

function peaks(api, { base, fall, tone, seed, pk, rect }) {
  const arr = new Array(24).fill(0);
  pk.forEach((k, i) => arr.splice(i * 4, 4, ...k));
  const src = api.bakeShader(rect[2], rect[3], `uniform vec4 uOff;\n` + PEAK_FS.replace('vec4 shade(vec2 p, vec2 uv) {', 'vec4 shade(vec2 pp, vec2 uv) { vec2 p = pp + uOff.xy;'), {
    uniforms: { uP: [base, fall, tone, seed], uPk: arr, uOff: [rect[0], rect[1], 0, 0] },
  });
  return src;
}

export default {
  id: 'lab-atmos-mist', title: 'atmos mist', ref: '01',
  build(api) {
    const far = peaks(api, { base: 900, fall: 900, tone: 0.62, seed: 1, rect: [-200, 150, 2400, 800], pk: [[1500, 300, 260, 2.2], [1850, 260, 200, 2.5], [1150, 380, 220, 2.4], [700, 360, 260, 2.2], [300, 330, 220, 2.6]] });
    const mid = peaks(api, { base: 950, fall: 900, tone: 0.38, seed: 2, rect: [-200, 250, 2400, 800], pk: [[1350, 420, 110, 3.0], [1650, 360, 150, 3.2], [1900, 400, 140, 2.8], [900, 470, 150, 2.8], [450, 430, 120, 3.0], [1100, 500, 90, 3.0]] });
    const near = peaks(api, { base: 1100, fall: 1200, tone: 0.1, seed: 3, rect: [-200, 400, 2400, 800], pk: [[1500, 580, 110, 2.6], [1780, 530, 150, 2.8], [200, 470, 220, 2.4], [620, 600, 130, 2.6]] });
    return {
      layers: [
        makeSky(api, { variant: 'rice' }),
        api.tex(far, { rect: [-200, 150, 2400, 800], z: 8 }),
        makeMist(api, { top: 520, bottom: 1150, z: 7, lobe: 110, seed: 1, drift: 7 }),
        api.tex(mid, { rect: [-200, 250, 2400, 800], z: 4 }),
        makeMist(api, { top: 650, bottom: 1150, z: 3.6, lobe: 90, seed: 2, drift: 10 }),
        api.tex(near, { rect: [-200, 400, 2400, 800], z: 2 }),
        makeMist(api, { top: 830, bottom: 1150, z: 1.8, lobe: 80, seed: 3, drift: 14, density: 0.95 }),
      ],
      grade: { vignette: 0 },   // refs have no vignette: calibrate without it
    };
  },
};
