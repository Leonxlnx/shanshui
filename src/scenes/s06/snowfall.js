// s06 copy of lib/fauna/snow.js with a calm (flake-free) rectangle for the seal corner.
// Snowfall (ref 06): soft white flakes in several depth bands, one cheap procedural shader card
// per band (one hash + one disc per pixel), deterministic in t, parallaxing with the camera.
//
//   const snow = makeSnow(api, { intensity: 1, wind: 1 });   // -> array of layers, far .. near
//   layers.push(...snow);   or interleave: far bands behind the near cliff, near bands in front.

export const SNOW_BANDS = [
  //  z     cell  rad  speed drift alpha soft  sway
  { z: 5.0, cell: 22, rad: 0.9, speed: 20, drift: 6, alpha: 0.7, soft: 0.55, sway: 0.16, density: 0.55 },
  { z: 3.0, cell: 34, rad: 1.35, speed: 28, drift: 9, alpha: 0.78, soft: 0.55, sway: 0.18, density: 0.6 },
  { z: 1.8, cell: 58, rad: 2.2, speed: 40, drift: 14, alpha: 0.82, soft: 0.6, sway: 0.2, density: 0.62 },
  { z: 1.15, cell: 120, rad: 3.8, speed: 56, drift: 20, alpha: 0.72, soft: 0.75, sway: 0.2, density: 0.55 },
  { z: 1.0, cell: 300, rad: 9.0, speed: 80, drift: 28, alpha: 0.32, soft: 1.0, sway: 0.18, density: 0.4 },
];

const SNOW_GLSL = /* glsl */ `
uniform float uCell, uRad, uSpeed, uDrift, uSway, uDensity, uSeed, uAlpha, uSoft, uRim, uGust, uTop, uFade;
uniform vec3 uColor;
uniform vec4 uCalm;   // x0, y0, x1, y1 of a flake-free corner (the seal), soft edge 70 px
vec4 shade(vec2 p, vec2 uv) {
  float t = uTime;
  vec2 q = p - vec2(uDrift * t, uSpeed * t);
  // coherent gusts: neighbouring flakes swing together
  q.x += uGust * snoise(vec2(p.y * 0.0018 + t * 0.045, t * 0.11 + uSeed));
  vec2 g = q / uCell;
  vec2 cell = floor(g), f = g - cell;
  vec2 h = hash22(cell + uSeed * 17.0);
  float hz = hash12(cell * 1.37 + uSeed * 5.1);
  if (hz > uDensity) return vec4(0.0);
  float w = mix(0.7, 1.6, h.x) * 1.7;
  vec2 c = mix(vec2(0.24), vec2(0.76), h) + vec2(uSway * sin(t * w + h.y * 6.2831), 0.06 * uSway * sin(t * w * 0.7 + h.x * 6.2831));
  float r = uRad * mix(0.55, 1.3, fract(h.x * 7.31 + h.y * 3.17)) / uCell;
  vec2 d = f - c;
  float ang = atan(d.y, d.x);
  float dist = length(d) * (1.0 + 0.05 * sin(ang * 2.0 + h.y * 12.0) + 0.03 * sin(ang * 5.0 + h.x * 9.0));
  float a = 1.0 - smoothstep(r * (1.0 - uSoft), r, dist);
  a *= uAlpha * mix(0.55, 1.0, fract(hz * 9.7));
  // vertical extent: fade in below uTop over uFade px (e.g. snow only below a cloud bank)
  a *= smoothstep(uTop, uTop + uFade, p.y);
  vec2 cd = max(max(uCalm.xy - p, p - uCalm.zw), 0.0);
  a *= smoothstep(0.0, 70.0, length(cd));
  float rim = uRim * smoothstep(0.0, 70.0, length(cd)) * smoothstep(r * 0.55, r * 1.05, dist) * (1.0 - smoothstep(r * 1.05, r * 1.7, dist)) * uAlpha;
  vec4 flake = vec4(uColor * a, a);
  vec4 ring = vec4(vec3(0.55, 0.54, 0.52) * rim, rim);
  return flake + ring * (1.0 - flake.a);
}`;

// opts: intensity (density multiplier, 1), wind (drift multiplier, 1; negative blows left),
// speed (fall multiplier, 1), size (radius multiplier, 1), bands (array overriding SNOW_BANDS
// entries), rim (faint grey rim so flakes read on pale paper, 0.1), gust px (14), top/fade
// (vertical start of the snow in rest px, default none), color [r,g,b] 0..1, seed, opacity,
// rect, and any layer option. Returns an array of shader layers ordered far -> near.
export function makeSnow(api, opts = {}) {
  const {
    intensity = 1, wind = 1, speed = 1, size = 1, bands = SNOW_BANDS, rim = 0.1, gust = 14,
    top = -1e5, fade = 1, calm = [1e5, 1e5, 1e5, 1e5], color = [0.985, 0.982, 0.976], seed = 1, opacity = 1, ...layerOpts
  } = opts;
  return bands.map((b, i) => api.shader(SNOW_GLSL, {
    z: b.z, name: 'snow' + i, opacity,
    uniforms: {
      uCell: b.cell, uRad: b.rad * size, uSpeed: b.speed * speed, uDrift: b.drift * wind, uSway: b.sway,
      uDensity: Math.min(1, b.density * intensity), uSeed: seed * 13.1 + i * 7.7, uAlpha: b.alpha, uSoft: b.soft,
      uRim: rim, uGust: gust, uCalm: calm, uTop: top, uFade: fade, uColor: color,
    },
    ...layerOpts,
  }));
}
