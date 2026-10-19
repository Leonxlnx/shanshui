// s02 helper: the luminous gold river. The water is a screen-space ribbon (left / right bank
// polylines, widening toward the viewer) used as a mask for the library lake surface and the
// glitter overlay (sun column on rippled water). Land tongues, islands and reflections are
// painted by the scene on top of the surface.
import { makeLake, makeGlitter } from '../../lib/water.js';

// smooth closed path through bank points (left top->bottom, right bottom->top)
function bankPath(ctx, left, right, nz, rough) {
  const pts = [...left, ...right.slice().reverse()];
  const P = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 6));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      // Catmull-Rom between a and b
      const p0 = pts[(i - 1 + pts.length) % pts.length], p3 = pts[(i + 2) % pts.length];
      const cr = (u, v0, v1, v2, v3) => 0.5 * ((2 * v1) + (-v0 + v2) * u + (2 * v0 - 5 * v1 + 4 * v2 - v3) * u * u + (-v0 + 3 * v1 - 3 * v2 + v3) * u * u * u);
      const x = cr(t, p0[0], a[0], b[0], p3[0]), y = cr(t, p0[1], a[1], b[1], p3[1]);
      const j = rough * (nz.n2(x / 30, y / 12) * 0.7 + nz.n2(x / 9, y / 5) * 0.3);
      P.push([x + j, y]);
    }
  }
  ctx.moveTo(P[0][0], P[0][1]);
  for (const p of P) ctx.lineTo(p[0], p[1]);
  ctx.closePath();
}

// warm gold wash on the water under the sun: a column that widens toward the viewer, broken
// into soft ripple rows, plus a faint warm cast over the whole river (masked by the water)
const SHEEN_FS = /* glsl */ `
uniform sampler2D uMask; uniform vec4 uMaskRect;
uniform vec4 uCol;   // x at horizon, x at bottom, half width at horizon, half width at bottom
uniform vec4 uK;     // horizon y, bottom y, amount, overall cast
uniform vec3 uC;
vec4 shade(vec2 p, vec2 uv) {
  vec2 mu = (p - uMaskRect.xy) / uMaskRect.zw;
  if (mu.x < 0.0 || mu.y < 0.0 || mu.x > 1.0 || mu.y > 1.0) return vec4(0.0);
  float m = texture(uMask, mu).a;
  if (m <= 0.001) return vec4(0.0);
  float d = clamp((p.y - uK.x) / (uK.y - uK.x), 0.0, 1.0);
  float cx = mix(uCol.x, uCol.y, d), hw = mix(uCol.z, uCol.w, pow(d, 0.8));
  float D = max(p.y - uK.x, 0.0) + 8.0;
  float t = uTime;
  // ripple rows in perspective (thin near the horizon)
  float row = log(D) * 26.0 - t * 0.35;
  float rip = 0.7 + 0.3 * smoothstep(-0.4, 0.6, snoise(vec2((p.x - cx) / (40.0 + D * 0.4), row)));
  float wob = snoise(vec2(row * 0.5, 2.7)) * hw * 0.25;
  float xx = (p.x - cx - wob) / hw;
  float col = exp(-xx * xx) * (0.55 + 0.45 * exp(-pow(D / 260.0, 2.0)));
  float a = uK.z * col * rip + uK.w;
  a = clamp(a * m, 0.0, 1.0);
  return vec4(uC * a, a);
}`;

export function makeGoldRiver(api, o) {
  const rect = o.rect;
  const nz = api.noise(o.seed ?? 7);
  const z = o.z ?? 2.5;
  const mask = api.bakeCanvas(rect[2], rect[3], (ctx) => {
    ctx.translate(-rect[0], -rect[1]);
    ctx.filter = `blur(${o.soft ?? 3}px)`;
    ctx.fillStyle = '#000';
    ctx.beginPath(); bankPath(ctx, o.left, o.right, nz, o.rough ?? 6); ctx.fill();
  }, { scale: 0.5, mipmap: false });
  const maskInfo = { src: mask, rect };
  const common = {
    variant: 'golden', paper: o.paper, z, mask: maskInfo, rect,
    x0: rect[0] - 200, x1: rect[0] + rect[2] + 200, y: o.horizon, yBottom: o.yBottom ?? 1080, cx: o.vx, seed: o.seed ?? 7,
  };
  const surface = makeLake(api, { ...common, name: 'river-surface', ...(o.surface || {}) });
  const overlay = makeGlitter(api, { ...common, name: 'river-glitter', glitter: o.glitter, sheen: o.sheen ?? 0.35, drift: 5 });
  const g = o.gold || {};
  const gold = api.shader(SHEEN_FS, {
    name: 'river-gold', z, rect,
    uniforms: {
      uMaskRect: rect,
      uCol: [g.x ?? o.vx, g.x1 ?? o.vx, g.w0 ?? 30, g.w1 ?? 200],
      uK: [o.horizon, o.yBottom ?? 1080, g.amount ?? 0.6, g.cast ?? 0.08],
      uC: (g.color || [242, 202, 128]).map((v) => v / 255),
    },
    textures: { uMask: mask },
  });
  return { surface, overlay, gold, mask: maskInfo };
}
