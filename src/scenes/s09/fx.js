// s09 small atmospheric helpers.

// Soft drifting mist puff: paper-coloured billows inside a soft ellipse (no hard band edges).
export function softMist(api, { cx, cy, rx, ry, z = 1.2, density = 0.9, drift = 8, move = 0, seed = 1, scale = 90, color = [240, 233, 223], shade = 0.12, name = 'mist-puff', tRange = [-3, 14] }) {
  const C = color.map((v) => v / 255);
  const x0 = cx - rx * 2 + Math.min(0, move * tRange[0]), x1 = cx + rx * 2 + Math.max(0, move * tRange[1]);
  return api.shader(/* glsl */ `
    uniform vec4 uM; uniform vec4 uM2; uniform vec3 uC; uniform float uShade; uniform float uMove;
    vec4 shade(vec2 p, vec2 uv) {
      vec2 q = (p - uM.xy - vec2(uMove * uTime, 0.0)) / uM.zw;
      float env = exp(-dot(q, q) * 1.3);
      if (env < 0.02) return vec4(0.0);
      float t = uTime;
      vec2 w = p - vec2(uM2.y * t, 0.0);
      float n = fbm3(vec3(w / uM2.w + uM2.z, t * 0.05), 4) * 0.5 + 0.5;
      float n2 = fbm(w / (uM2.w * 0.33) + uM2.z * 2.0 + t * 0.02, 2) * 0.5 + 0.5;
      float f = env * 1.15 + (n - 0.5) * 0.95 + (n2 - 0.5) * 0.3;
      float a = smoothstep(0.3, 0.8, f) * uM2.x;
      if (a < 0.003) return vec4(0.0);
      // faint grey where billows overlap (below their brighter tops)
      float nb = fbm3(vec3((w + vec2(0.0, -uM2.w * 0.18)) / uM2.w + uM2.z, t * 0.05), 3) * 0.5 + 0.5;
      float sh = clamp((nb - n) * 3.0, 0.0, 1.0) * uShade * smoothstep(0.35, 0.9, f);
      vec3 c = uC * (1.0 - sh);
      return vec4(c * a, a);
    }`, {
    z, name, rect: [x0, cy - ry * 2, x1 - x0, ry * 4],
    uniforms: { uM: [cx, cy, rx, ry], uM2: [density, drift, seed * 3.7, scale], uC: C, uShade: shade, uMove: move },
  });
}
