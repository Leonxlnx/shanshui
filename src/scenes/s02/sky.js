// s02 helper: golden sky washes and the warm sun haze.
// makeGoldClouds: soft, feathery golden cloud streaks (wet washes dragged sideways, fibrous dry
// edges) concentrated around the low sun and fading into the paper. Pure function of uTime.
// makeSunHaze: broad warm glow of light hanging in the valley mist in front of the far ranges.
const C = (rgb) => rgb.map((v) => v / 255);

const CLOUD_FS = /* glsl */ `
uniform vec4 uSun;     // sun x, y, clear radius, unused
uniform vec4 uBand;    // y0, y1, feather, x start
uniform vec4 uMove;    // drift px/s, seed, strength, unused
uniform vec4 uNearR;   // rx, ry of the golden zone around the sun
uniform vec3 uFarC, uNearC;
vec4 shade(vec2 p, vec2 uv) {
  float band = smoothstep(uBand.x - uBand.z, uBand.x + uBand.z, p.y) * (1.0 - smoothstep(uBand.y - uBand.z, uBand.y + uBand.z, p.y));
  float reg = smoothstep(uBand.w, uBand.w + 520.0, p.x);
  float env = band * reg;
  if (env <= 0.002) return vec4(0.0);
  float t = uTime;
  float sd = uMove.y;
  vec2 q = vec2(p.x - uMove.x * t, p.y);
  // streaks bend gently and taper like broad washes dragged sideways
  float bend = 30.0 * snoise(vec2(q.x / 1100.0, sd + 0.3)) + 12.0 * snoise(vec2(q.x / 380.0, sd + 3.1));
  vec2 w = vec2(q.x, q.y + bend);
  float n1 = fbm(vec2(w.x / 380.0, w.y / 46.0) + vec2(sd, t * 0.004), 4);
  float n2 = fbm(vec2(w.x / 160.0, w.y / 20.0) + vec2(sd * 1.7, -t * 0.006), 3);
  float d = n1 * 0.8 + n2 * 0.4;
  // large-scale patchiness so the washes break into separate clouds instead of parallel bands
  float patchy = smoothstep(-0.35, 0.45, snoise(vec2(w.x / 520.0, w.y / 130.0) + sd * 0.7 + vec2(t * 0.003, 0.0)));
  float cov = smoothstep(-0.32, 0.5, d) * patchy;
  cov *= cov * (3.0 - 2.0 * cov);
  // fibrous dry streaks inside the washes (thin horizontal hairs)
  float fib = snoise(vec2(w.x / 120.0, w.y / 2.8) + sd * 2.3);
  float hair = 0.7 + 0.3 * smoothstep(-0.5, 0.7, fib);
  // pigment granulation
  float gr = 0.9 + 0.1 * vnoise(p * 0.7);
  // golden near the sun, greyer ochre far away; clear just around the disc
  vec2 dn = (p - uSun.xy) / uNearR.xy;
  float near = exp(-dot(dn, dn));
  float clr = smoothstep(uSun.z * 1.1, uSun.z * 2.6, length(p - uSun.xy));
  float a = uMove.z * env * cov * hair * gr * (0.35 + 0.65 * near) * clr;
  a = clamp(a, 0.0, 1.0);
  vec3 col = mix(uFarC, uNearC, smoothstep(0.0, 1.0, near));
  return vec4(col * a, a);
}`;

export function makeGoldClouds(api, o = {}) {
  const sun = o.sun || [1349, 308];
  const band = o.band || [110, 330, 55];
  const rect = o.rect || [o.x0 ?? 500, band[0] - band[2] - 30, 2400 - (o.x0 ?? 500), band[1] - band[0] + band[2] * 2 + 60];
  return api.shader(CLOUD_FS, {
    name: o.name || 'gold-clouds', z: o.z ?? 40, rect,
    uniforms: {
      uSun: [sun[0], sun[1], o.clear ?? 52, 0],
      uBand: [band[0], band[1], band[2], o.x0 ?? 600],
      uMove: [o.drift ?? 4, o.seed ?? 3.1, o.strength ?? 0.5, 0],
      uNearR: o.nearR || [620, 170, 0, 0],
      uFarC: C(o.farColor || [214, 192, 160]),
      uNearC: C(o.nearColor || [238, 196, 122]),
    },
  });
}

const HAZE_FS = /* glsl */ `
uniform vec4 uSun;    // x, y, rx, ry
uniform vec4 uK;      // amount, horizon y, horizon feather, seed
uniform vec3 uC;
vec4 shade(vec2 p, vec2 uv) {
  vec2 d = (p - uSun.xy) / uSun.zw;
  float g = exp(-dot(d, d));
  g += 0.45 * exp(-dot(d * vec2(0.45, 0.8), d * vec2(0.45, 0.8)));
  // light pools along the misty horizon below the sun
  float hz = exp(-pow((p.y - uK.y) / uK.z, 2.0)) * exp(-pow((p.x - uSun.x) / (uSun.z * 1.6), 2.0));
  g = g * 0.75 + hz * 0.6;
  float t = uTime;
  float m = 0.75 + 0.25 * fbm(vec2(p.x / 260.0 - t * 0.02, p.y / 60.0) + uK.w, 3);
  float breathe = 0.94 + 0.06 * sin(t * 0.45);
  // keep the pale disc itself readable through the haze
  float keep = mix(0.6, 1.0, smoothstep(40.0, 120.0, length(p - uSun.xy)));
  float a = clamp(uK.x * g * m * breathe * keep, 0.0, 0.92);
  return vec4(uC * a, a);
}`;

export function makeSunHaze(api, o = {}) {
  const sun = o.sun || [1349, 308];
  const rect = o.rect || [500, 60, 1900, 620];
  return api.shader(HAZE_FS, {
    name: o.name || 'sun-haze', z: o.z ?? 5.8, rect,
    uniforms: {
      uSun: [sun[0], sun[1], (o.size || [480, 190])[0], (o.size || [480, 190])[1]],
      uK: [o.amount ?? 0.6, o.horizon ?? 440, o.feather ?? 60, o.seed ?? 2.3],
      uC: C(o.color || [252, 236, 200]),
    },
  });
}
