// s03 helper: the full moon of ref 03 - crisp warm-white disc with low-contrast, mottled grey maria
// (large connected seas, not separate blobs), fine crater speckle, and only a faint tight glow.
const C = (rgb) => rgb.map((v) => (v / 255).toFixed(4)).join(', ');

export function makeMoon03(api, { x, y, r, z = 1e5, color = [250, 243, 224], maria = [212, 203, 186], glow = 0.24, glowR = 0.45, seed = 2.3, name = 'moon' } = {}) {
  const ext = Math.ceil(r * (1 + glowR * 3) + 6), size = ext * 2;
  const src = api.bakeShader(size, size, /* glsl */ `
    vec4 shade(vec2 p, vec2 uv) {
      vec2 d = (p - uSize * 0.5) / ${r.toFixed(1)};
      float rr = length(d);
      float aa = 1.0 / ${r.toFixed(1)};
      float disc = 1.0 - smoothstep(1.0 - aa, 1.0 + aa * 0.5, rr + 0.004 * snoise(d * 11.0 + ${seed.toFixed(2)}));
      // warped coordinates so seas have ragged, organic coasts
      vec2 w = d + 0.16 * vec2(fbm(d * 2.4 + ${seed.toFixed(2)}, 3), fbm(d * 2.4 + 7.7, 3));
      // seas (unit-disc coords, y down): upper right, centre, right limb, lower left, left
      float s = 0.0;
      s += 1.00 * exp(-dot(w - vec2( 0.45, -0.38), w - vec2( 0.45, -0.38)) / 0.07);
      s += 0.80 * exp(-dot(w - vec2( 0.05, -0.08), w - vec2( 0.05, -0.08)) / 0.045);
      s += 0.75 * exp(-dot(w - vec2( 0.62,  0.12), w - vec2( 0.62,  0.12)) / 0.03);
      s += 0.95 * exp(-dot(w - vec2(-0.45,  0.38), w - vec2(-0.45,  0.38)) / 0.06);
      s += 0.60 * exp(-dot(w - vec2(-0.12,  0.55), w - vec2(-0.12,  0.55)) / 0.025);
      s += 0.55 * exp(-dot(w - vec2(-0.62, -0.05), w - vec2(-0.62, -0.05)) / 0.03);
      s += 0.45 * exp(-dot(w - vec2( 0.20,  0.30), w - vec2( 0.20,  0.30)) / 0.02);
      float tex = fbm(w * 4.0 + 3.1, 4);
      float sea = smoothstep(0.3, 0.75, s + 0.35 * tex);
      // softly mottled interior + fine crater speckle everywhere
      float mott = 0.7 + 0.3 * fbm(w * 8.0 + 9.0, 3);
      float spk = smoothstep(0.6, 0.92, vnoise(p * 0.8 + 11.0)) * 0.2 + smoothstep(0.65, 0.95, vnoise(p * 0.35 + 2.0)) * 0.18;
      float m = clamp(sea * mott * 0.9 + spk * (0.25 + 0.75 * sea), 0.0, 1.0);
      vec3 c = mix(vec3(${C(color)}), vec3(${C(maria)}), m);
      c *= 1.0 - 0.03 * smoothstep(0.7, 1.0, rr);
      // faint tight glow
      float h = ${glow.toFixed(3)} * exp(-max(rr - 1.0, 0.0) / ${glowR.toFixed(3)}) * (1.0 - disc);
      vec3 col = c * disc + vec3(${C(color)}) * h;
      return vec4(col, clamp(disc + h, 0.0, 1.0));
    }`, { scale: 1.5 });
  return api.tex(src, { rect: [x - ext, y - ext, size, size], z, name });
}
