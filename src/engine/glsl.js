// Shared GLSL chunks. Shaders are assembled from these strings so every
// scene speaks the same noise and ink vocabulary.

export const HEADER = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
`;

export const NOISE = /* glsl */ `
// ---------- hashing ----------
float hash11(float p) { p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float hash13(vec3 p3) { p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }

// ---------- value noise ----------
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6. - 15.) + 10.);
  float a = hash12(i), b = hash12(i + vec2(1, 0)), c = hash12(i + vec2(0, 1)), d = hash12(i + vec2(1, 1));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// ---------- 2D simplex noise (Ashima / McEwan, MIT) -> [-1,1] ----------
vec3 _perm(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = _perm(_perm(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g; g.x = a0.x * x0.x + h.x * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// ---------- 3D simplex noise -> [-1,1] (use z as time for evolving fields) ----------
vec4 _perm4(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec4 _tis(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise3(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod(i, 289.0);
  vec4 p = _perm4(_perm4(_perm4(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = _tis(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// ---------- fractal sums ----------
const mat2 ROT = mat2(0.8, -0.6, 0.6, 0.8);
float fbm(vec2 p, int oct) {
  float s = 0., a = .5, n = 0.;
  for (int i = 0; i < 10; i++) { if (i >= oct) break; s += a * snoise(p); n += a; p = ROT * p * 2.03 + 17.1; a *= .5; }
  return s / n; // ~[-1,1]
}
float fbm3(vec3 p, int oct) {
  float s = 0., a = .5, n = 0.;
  for (int i = 0; i < 8; i++) { if (i >= oct) break; s += a * snoise3(p); n += a; p = vec3(ROT * p.xy, p.z) * 2.03 + vec3(17.1, 9.2, 3.7); a *= .5; }
  return s / n;
}
float ridged(vec2 p, int oct) {
  float s = 0., a = .5, n = 0.;
  for (int i = 0; i < 10; i++) { if (i >= oct) break; float v = 1. - abs(snoise(p)); s += a * v * v; n += a; p = ROT * p * 2.03 + 11.7; a *= .5; }
  return s / n; // [0,1]
}
// anisotropic streak noise: long along 'dir', short across it (brush texture, cun strokes, water streaks)
float streaks(vec2 p, vec2 dir, float stretch, int oct) {
  vec2 d = normalize(dir); vec2 q = vec2(dot(p, d) / stretch, dot(p, vec2(-d.y, d.x)));
  return fbm(q, oct);
}
// cellular (worley) F1 distance
float worley(vec2 p) {
  vec2 i = floor(p), f = fract(p); float d = 8.;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(x, y); vec2 o = hash22(i + g); vec2 r = g + o - f; d = min(d, dot(r, r));
  }
  return sqrt(d);
}
`;

// Ink and paper helpers (colours are in display sRGB 0..1)
export const INK = /* glsl */ `
const vec3 INK_BLACK = vec3(0.075, 0.07, 0.068);
const vec3 VERMILION = vec3(0.72, 0.19, 0.13);
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// paper fibre / mottle field in pixel space (static), returns ~[-1,1]
float paperField(vec2 px) {
  float mottle = fbm(px * 0.0022, 4) * 0.6 + fbm(px * 0.011, 3) * 0.3;
  float fib = streaks(px * 0.045 + 3.1, vec2(0.86, 0.5), 9.0, 2) * 0.35 + streaks(px * 0.05 + 8.7, vec2(-0.4, 0.92), 7.0, 2) * 0.3;
  float speck = smoothstep(0.82, 0.95, vnoise(px * 0.35)) * 0.8;
  return mottle + fib * 0.6 - speck * 0.3;
}
`;
