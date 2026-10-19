// s06 frozen waterfalls: each stream is a curtain of icicle columns over a blue-grey
// ice sheet. Columns come in two layers with irregular widths (warped cells), varied
// lengths and pointed, bulging drips; each is white on its lit side with vertical
// streaks, rolling into blue-grey on its shadow side with a soft crease between
// columns. A lumpy snow cornice sits on the lip, wet dark rock shows in the recess,
// and the foot dissolves into mist. Baked once as a GPU shader.
//
// streams: [{ x, y0, y1, hw0, hw1, lean, col, seed, fade (0..1 where the mist dissolve starts), lip, bright, recess }]
// Streams are composited in order (later ones on top): list lower tiers first.
const ICE_GLSL = /* glsl */ `
uniform vec4 uS0[6];   // x, y0, y1, hw0
uniform vec4 uS1[6];   // hw1, lean, column width, seed
uniform vec4 uS2[6];   // fade start (v), lip, brightness, recess
uniform int uN;
uniform vec4 uRect;
const vec3 ICE_W = vec3(0.975, 0.975, 0.972);
const vec3 ICE_B = vec3(0.76, 0.785, 0.805);
const vec3 ICE_D = vec3(0.5, 0.53, 0.565);
vec4 shade(vec2 q, vec2 uv) {
  vec2 p = q + uRect.xy;
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 6; i++) {
    if (i >= uN) break;
    vec4 A = uS0[i], B = uS1[i], C = uS2[i];
    float len = A.z - A.y;
    float v = (p.y - A.y) / len;
    if (v < -0.2 || v > 1.15) continue;
    float vc = clamp(v, 0.0, 1.0);
    float sd = B.w;
    float cx = A.x + B.y * vc + 5.0 * snoise(vec2(p.y * 0.008, sd));
    float hw = mix(A.w, B.x, vc) * (1.0 + 0.1 * snoise(vec2(p.y * 0.018, sd + 3.0)));
    float u = (p.x - cx) / hw;
    if (abs(u) > 1.4) continue;
    float en = 0.12 * snoise(vec2(p.y * 0.035, sd + 7.0)) + 0.06 * snoise(vec2(p.y * 0.12, sd + 8.0));
    float edge = 1.0 - smoothstep(0.84, 1.0, abs(u) + en);
    float cw = B.z;
    float xw = p.x - cx + 3.0 * snoise(vec2(p.y * 0.006, sd + 11.0));
    // back sheet: blue-grey ice with vertical streaks behind the columns
    float sst = streaks(p * 0.06 + sd * 2.0, vec2(0.0, 1.0), 9.0, 3);
    float sheetA = edge * smoothstep(-0.02, 0.03, v) * (1.0 - smoothstep(0.5, 0.95, v + 0.25 * snoise(vec2(p.x * 0.03, sd + 1.0))));
    vec3 sheet = mix(ICE_D, ICE_B * 1.08, clamp(0.65 + 0.4 * sst - 0.25 * max(u, 0.0), 0.0, 1.0));
    vec4 col = vec4(sheet * sheetA, sheetA);
    for (int layer = 0; layer < 2; layer++) {
      float lw = cw * (layer == 0 ? 1.6 : 1.0);
      float c0 = xw / lw + (layer == 0 ? 0.37 : 0.0);
      float c = c0 + 0.45 * snoise(vec2(c0 * 0.33, sd + 20.0 + float(layer)));
      float ic = floor(c), fc = fract(c);
      float h = hash12(vec2(ic, sd + float(layer) * 13.0));
      float h2 = hash12(vec2(ic * 1.7 + 3.0, sd + 5.0));
      float h3 = hash12(vec2(ic * 2.3 + 7.0, sd + 9.0));
      float y0c = A.y + len * (layer == 0 ? 0.0 : 0.05 * h2);
      float cl = 0.5 + 0.5 * snoise(vec2(ic * 0.35, sd + float(layer)));
      float yb = A.y + len * mix(layer == 0 ? 0.6 : 0.25, 1.0, clamp(0.55 * cl + 0.6 * pow(h, 1.5), 0.0, 1.0));
      float tip = lw * (1.4 + 3.0 * h2);
      float bul = 0.2 * sin(p.y * (0.018 + 0.03 * h) + h2 * 20.0) + 0.1 * snoise(vec2(ic, p.y * 0.03));
      float cone = clamp((yb - p.y) / max(1.0, yb - y0c), 0.0, 1.0);
      float wprof = mix(clamp((yb - p.y) / tip, 0.0, 1.0), pow(cone, 1.4), 0.55);
      float tb = pow(0.5 + 0.5 * sin((p.y - A.y) * (0.03 + 0.03 * h3) + h * 6.283), 3.0);
      float halfw = (0.32 + 0.2 * h3) * sqrt(wprof) * (0.9 + bul + 0.32 * tb);
      // just under the lip the columns merge into a bulging white mound
      float mv = v + 0.05 * snoise(vec2(p.x * 0.05, sd + 30.0));
      float mg = (1.0 - smoothstep(0.05, 0.15, mv)) * min(C.y, 1.0);
      halfw = mix(halfw, 0.62, mg);
      float dxc = fc - 0.5 + 0.07 * snoise(vec2(ic * 3.0, p.y * 0.05));
      float inC = (1.0 - smoothstep(halfw - 0.07, halfw, abs(dxc))) * smoothstep(y0c - 1.0, y0c + 2.0, p.y);
      if (inC <= 0.0) continue;
      float s = dxc / max(halfw, 0.05);          // -1 lit side .. 1 shadow side
      float st = streaks(vec2(p.x * 0.5, p.y) * 0.08 + sd + float(layer) * 3.0, vec2(0.0, 1.0), 7.0, 3);
      float band = 0.5 + 0.5 * sin(p.y * 0.08 + h * 30.0 + 2.0 * snoise(vec2(ic, p.y * 0.02)));
      float lum = 0.92 + 0.1 * (1.0 - smoothstep(-0.2, 0.9, s)) + 0.2 * (st - 0.5) + 0.06 * (band - 0.5);
      lum -= 0.34 * smoothstep(0.35, 1.0, s) * (1.0 - mg);
      lum -= 0.2 * smoothstep(0.07, 0.14, mv) * (1.0 - smoothstep(0.15, 0.24, mv));   // mound underside
      lum *= (layer == 0 ? 0.86 : 1.0) * C.z;
      lum -= 0.2 * smoothstep(0.55, 1.0, abs(u)) * step(0.0, u);
      lum -= 0.12 * (1.0 - tb) * smoothstep(0.2, 0.9, abs(s));
      vec3 ice = mix(ICE_B, ICE_W, clamp(lum, 0.0, 1.0));
      ice = mix(ice, ICE_D, 0.5 * smoothstep(0.75, 1.0, s) * smoothstep(0.05, 0.25, halfw));
      col = vec4(ice * inC, inC) + col * (1.0 - inC);
    }
    // dark wet rock in the recess behind the curtain
    float rec = edge * smoothstep(-0.01, 0.06, v) * (1.0 - smoothstep(0.7, 1.0, v)) * C.w;
    vec4 rk = vec4(vec3(0.2, 0.21, 0.22) * rec, rec);
    vec4 sw = col + rk * (1.0 - col.a);
    // lumpy snow cornice on the lip, grey underneath
    float lipY = A.y + 4.0 * snoise(vec2(p.x * 0.04, sd + 2.0)) + 2.0 * snoise(vec2(p.x * 0.15, sd));
    float ld = p.y - lipY;
    float lumpTop = -8.0 - 7.0 * abs(snoise(vec2(p.x * 0.06, sd + 9.0)));
    float lumpBot = 4.0 + 5.0 * (0.5 + 0.5 * snoise(vec2(p.x * 0.09, sd + 12.0)));
    float lip = C.y * smoothstep(lumpTop - 1.5, lumpTop + 1.5, ld) * (1.0 - smoothstep(lumpBot - 1.5, lumpBot + 1.0, ld)) * (1.0 - smoothstep(0.98, 1.15, abs(u) + 0.5 * en));
    vec3 lc = mix(vec3(0.975, 0.975, 0.97), vec3(0.7, 0.73, 0.77), smoothstep(lumpTop * 0.2, lumpBot, ld));
    sw = vec4(lc * lip, lip) + sw * (1.0 - lip);
    float fade = 1.0 - smoothstep(C.x, 1.08, v + 0.06 * snoise(vec2(p.x * 0.02, sd + 4.0)));
    sw *= edge * fade;
    acc = sw + acc * (1.0 - sw.a);
  }
  return acc;
}`;

export function makeIcefall(api, rect, streams, { scale = 1.5 } = {}) {
  const S = streams.slice(0, 6);
  const pack = (f) => { const a = []; for (let i = 0; i < 6; i++) a.push(...(S[i] ? f(S[i], i) : [0, 0, 0, 0])); return a; };
  return api.bakeShader(rect[2], rect[3], ICE_GLSL, {
    scale,
    uniforms: {
      uS0: pack((s) => [s.x, s.y0, s.y1, s.hw0]),
      uS1: pack((s, i) => [s.hw1 ?? s.hw0, s.lean ?? 0, s.col ?? 14, (s.seed ?? i + 1) * 3.7]),
      uS2: pack((s) => [s.fade ?? 0.85, s.lip ?? 1, s.bright ?? 1, s.recess ?? 0.7]),
      uN: S.length, uRect: rect,
    },
  });
}

