// GPU post-processing for baked texture cards: wet-edge pooling, pigment
// granulation and soft bleed. Run once at build time on a Canvas2D bake so
// clean vector strokes read as ink soaked into paper.

export function inkify(api, src, { edge = 0.45, granulation = 0.22, bleed = 1.2, grainScale = 1.0, seed = 0 } = {}) {
  return api.processTex(src, /* glsl */ `
    uniform float uEdge, uGran, uBleed, uGrainScale, uSeed;
    vec4 shade(vec2 p, vec2 uv) {
      vec4 c = texture(uSrc, uv);
      // blurred alpha sampled in two rings around the pixel
      float ab = 0.0; vec4 cb = vec4(0.0);
      for (int i = 0; i < 12; i++) {
        float a = float(i) / 12.0 * 6.2831853;
        vec2 o = vec2(cos(a), sin(a));
        vec4 s1 = texture(uSrc, uv + o * uTexel * uBleed * 2.0);
        vec4 s2 = texture(uSrc, uv + o * uTexel * uBleed * 5.0);
        ab += s1.a * 0.6 + s2.a * 0.4; cb += s1 * 0.6 + s2 * 0.4;
      }
      ab /= 12.0; cb /= 12.0;
      // wet edge: interior pixels near the boundary get darker (pigment pools at the rim)
      float rim = clamp((c.a - ab) * 2.5, 0.0, 1.0) * c.a;
      vec3 col = c.a > 0.0 ? c.rgb / c.a : vec3(0.0);
      col *= 1.0 - uEdge * rim * 0.6;
      // granulation: pigment settles into paper tooth -> alpha breaks up in mid-tones
      vec2 gp = p * uGrainScale + uSeed * 37.0;
      float g = vnoise(gp * 0.9) * 0.55 + vnoise(gp * 2.3 + 4.0) * 0.3 + vnoise(gp * 0.25 + 9.0) * 0.15;
      float mid = 4.0 * c.a * (1.0 - c.a);
      float a = c.a * (1.0 - uGran * (g - 0.35) * (0.6 + mid));
      // bleed: faint halo where the stroke wicked into the paper
      float halo = max(0.0, ab - c.a) * 0.35;
      vec3 haloCol = ab > 0.0 ? cb.rgb / max(cb.a, 1e-4) : col;
      float A = clamp(a + halo, 0.0, 1.0);
      vec3 C = A > 0.0 ? (col * clamp(a, 0.0, 1.0) + haloCol * halo) / max(A, 1e-4) : vec3(0.0);
      return vec4(C * A, A);
    }`, { uniforms: { uEdge: edge, uGran: granulation, uBleed: bleed, uGrainScale: grainScale, uSeed: seed } });
}
