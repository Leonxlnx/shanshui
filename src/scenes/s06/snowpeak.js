// s06 snowy peaks: a GPU pass over a baked peak card (lib/peaks.js) that turns the grey
// mass into snow, the way ref 06 is painted: lit planes go back to (slightly whiter than)
// paper, shadow sides keep a soft grey, the darkest strokes (tree clumps, crevices) stay
// dark, and snow settles on the upper side of every dark shape (a white cap a few px thick
// with a soft grey lower edge). Isolated ink specks with no mass around them are dropped.
//
// snowifyPeaks(api, peaks, { lo, hi, cap, thr, seed }) -> { src, rect, layer(lo) }
//   lo, hi  ink density range that is remapped to 0..1 (below lo = bare snow)
//   cap     snow cap depth in design px; thr: density a shape needs to carry a cap
const GLSL = /* glsl */ `
uniform vec3 uPaperC;
uniform vec4 uP;        // lo, hi, cap px, cap threshold
uniform vec2 uDim, uOff;
uniform float uSeed, uWhite, uClose;
float dn(vec2 uv) {
  vec4 c = texture(uSrc, uv);
  if (c.a < 0.05) return 0.0;
  float Lp = luma(uPaperC);
  return clamp((Lp - luma(c.rgb / c.a)) / (Lp - 0.06), 0.0, 1.0);
}
vec4 shade(vec2 p, vec2 uv) {
  vec4 c = texture(uSrc, uv);
  float ar = 0.0;
  for (int i = 0; i < 12; i++) { float a = float(i) * 0.5236; ar += texture(uSrc, uv + vec2(cos(a), sin(a)) * 18.0 / uDim).a; }
  ar /= 12.0;
  c *= smoothstep(0.1, 0.28, ar);
  if (c.a < 0.002) return vec4(0.0);
  vec3 col = c.rgb / c.a;
  float Lp = luma(uPaperC);
  float L = luma(col);
  float d = clamp((Lp - L) / (Lp - 0.06), 0.0, 1.0);
  // close small paper gaps inside dark shapes (tier snow on tiny trees, beaded ridge dabs)
  float m = 0.0;
  for (int i = 0; i < 4; i++) {
    float a = float(i) * 0.785398 + 0.2;
    for (int j = 1; j <= 2; j++) {
      vec2 o = vec2(cos(a), sin(a)) * float(j) * 2.0 / uDim;
      m = max(m, min(dn(uv + o), dn(uv - o)));
    }
  }
  d = max(d, m * uClose);
  vec2 q = p + uOff + uSeed * 57.0;
  float n1 = fbm(q * 0.018, 3);
  float st = vnoise(q * vec2(0.12, 0.018));
  float d2 = pow(smoothstep(uP.x + 0.07 * n1 - 0.05 * st, uP.y, d), 0.8);
  // snow on the upper side of dark shapes
  float capPx = uP.z * (0.55 + 0.9 * vnoise(q * 0.06));
  float kmin = 99.0;
  if (d > uP.w) {
    for (int k = 1; k <= 8; k++) {
      float du = dn(uv - vec2(0.0, float(k) / 8.0 * capPx) / uDim);
      if (du < uP.w * 0.55) { kmin = float(k); break; }
    }
  }
  float cap = 1.0 - smoothstep(0.45, 1.0, kmin / 8.0);
  float under = smoothstep(0.3, 1.0, kmin / 8.0) * cap;
  float dOut = d2 * (1.0 - cap) + under * 0.25;
  float Lt = Lp - dOut * (Lp - 0.06);
  vec3 o = col * (Lt / max(L, 0.03));
  vec3 snowC = vec3(0.972, 0.97, 0.962);
  o = mix(o, snowC, (1.0 - smoothstep(0.0, 0.25, dOut)) * uWhite);
  o = mix(o, mix(snowC, vec3(0.78, 0.79, 0.8), under), cap * 0.92);
  return vec4(clamp(o, 0.0, 1.0) * c.a, c.a);
}`;

export function snowifyPeaks(api, pk, o = {}) {
  const paper = (o.paper || [240, 234, 226]).map((v) => v / 255);
  const src = api.processTex(pk.src, GLSL, {
    uniforms: {
      uPaperC: paper, uP: [o.lo ?? 0.22, o.hi ?? 0.85, o.cap ?? 5, o.thr ?? 0.45],
      uDim: [pk.rect[2], pk.rect[3]], uOff: [pk.rect[0], pk.rect[1]], uSeed: o.seed ?? 1, uWhite: o.white ?? 0.35, uClose: o.close ?? 1.0,
    },
  });
  api.engine?.freeTex?.(pk.src);
  const rect = pk.rect;
  return { src, rect, layer: (lo = {}) => api.tex(src, { rect, ...lo }) };
}
