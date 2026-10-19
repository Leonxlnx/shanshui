// s05 helper: small GPU utilities.
//
// composite(api, rect, items) -> texture source covering rect (design px):
//   items: [{ src, rect }, ...] back to front (max 6), premultiplied "over".
//   Lets several separately baked/inkified pieces share one card (one reflection, one sway).
export function composite(api, rect, items, { scale = 1 } = {}) {
  const n = items.length;
  if (n > 6) throw new Error('composite: max 6 items');
  let decl = '', body = '';
  const uniforms = { uR0: rect };
  items.forEach((it, i) => {
    decl += `uniform sampler2D uT${i}; uniform vec4 uR${i + 1};\n`;
    body += `{ vec2 q = (P - uR${i + 1}.xy) / uR${i + 1}.zw;
      if (q.x >= 0.0 && q.y >= 0.0 && q.x <= 1.0 && q.y <= 1.0) { vec4 s = texture(uT${i}, q); c = s + c * (1.0 - s.a); } }\n`;
    uniforms['uT' + i] = it.src;
    uniforms['uR' + (i + 1)] = it.rect;
  });
  return api.bakeShader(rect[2], rect[3], `uniform vec4 uR0;\n${decl}
    vec4 shade(vec2 p, vec2 uv) { vec2 P = p + uR0.xy; vec4 c = vec4(0.0);\n${body} return c; }`, { scale, uniforms });
}

// darken(api, src, { gamma, mult }) -> new texture: tone curve on the un-premultiplied colour
// (gamma > 1 darkens mid tones while keeping paper-white highlights).
export function darken(api, src, { gamma = 1.5, mult = 1, free = true } = {}) {
  const out = api.processTex(src, `uniform float uG, uM;
    vec4 shade(vec2 p, vec2 uv) { vec4 s = texture(uSrc, uv); if (s.a < 1e-4) return vec4(0.0);
      vec3 c = s.rgb / s.a; c = pow(clamp(c, 0.0, 1.0), vec3(uG)) * uM; return vec4(c * s.a, s.a); }`, { uniforms: { uG: gamma, uM: mult } });
  if (free) api.engine?.freeTex?.(src);
  return out;
}

export const ss =(a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
