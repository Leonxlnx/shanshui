// s05 helper: rocks painted in Canvas2D (cliff faces, boulders, shore rocks of ref 05).
// paintRock(ctx, r, nz, pts, opts): pts = clockwise outline (design px).
//   v       face tone (0 ink .. 1 paper) of the shaded side; the lit side is lighter by `lit`
//   lit     how much lighter the lit (upper-left) part is (0..1)
//   streak  density of vertical texture strokes (cun), contour = dark rim strength
//   shade   side in shadow: 1 = right, -1 = left
import { stroke, dryStroke, blob, rgba, tone as toneRGB, PAPER } from '../../lib/brush.js';
import { withBlur } from '../../lib/flora.js';

// Resample a closed outline every `step` px and push it along its normal by noise (organic edge).
export function roughen(pts, nz, { step = 5, amp = 4, freq = 0.06, seed = 0 } = {}) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.round(L / step));
    const nx = (b[1] - a[1]) / (L || 1), ny = -(b[0] - a[0]) / (L || 1);
    for (let k = 0; k < n; k++) {
      const s = k / n, x = a[0] + (b[0] - a[0]) * s, y = a[1] + (b[1] - a[1]) * s;
      const d = amp * (0.7 * nz.n2(x * freq + seed, y * freq) + 0.3 * nz.n2(x * freq * 3.1, y * freq * 3.1 + seed));
      out.push([x + nx * d, y + ny * d]);
    }
  }
  return out;
}

export function paintRock(ctx, r, nz, pts0, { v = 0.35, lit = 0.35, streak = 1, contour = 1, shade = 1, paper = PAPER, dots = 1, angle = 0, rough = 4, base = 0.15 } = {}) {
  const ink = (vv, a) => rgba(toneRGB(Math.min(1, Math.max(0, vv)), paper), a);
  const pts = rough > 0 ? roughen(pts0, nz, { amp: rough, seed: r() * 50 }) : pts0;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const W = x1 - x0, H = y1 - y0;
  const path = new Path2D();
  pts.forEach((p, i) => (i ? path.lineTo(p[0], p[1]) : path.moveTo(p[0], p[1])));
  path.closePath();
  // paper fill (occludes what is behind), then the face washes
  ctx.fillStyle = rgba(paper, 1);
  ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  const g = ctx.createLinearGradient(shade > 0 ? x0 : x1, y0, shade > 0 ? x1 : x0, y0 + H * 0.3);
  g.addColorStop(0, ink(v + lit, 0.9)); g.addColorStop(0.55, ink(v + lit * 0.5, 0.9)); g.addColorStop(1, ink(v, 0.95));
  ctx.fillStyle = g;
  ctx.fill(path);
  if (base > 0) {
    const gb = ctx.createLinearGradient(0, y1 - H * 0.45, 0, y1);
    gb.addColorStop(0, ink(v, 0)); gb.addColorStop(1, ink(Math.max(0, v - 0.22), Math.min(1, base * 4)));
    ctx.fillStyle = gb; ctx.fill(path);
  }
  // mottled wet patches
  withBlur(ctx, 2.5, (gg) => { for (let i = 0, n = Math.round(W * H / 700); i < n; i++) {
    blob(gg, x0 + r() * W, y0 + r() * H, r.range(6, 18), { color: ink(v - 0.08 + 0.2 * r(), r.range(0.15, 0.4)), rng: r, irregular: 0.5, squash: r.range(1.2, 2.2), rot: 1.57 + angle });
  } });
  // vertical fissures / cun strokes, denser on the shaded side
  const ns = Math.round(W / 6 * streak);
  for (let i = 0; i < ns; i++) {
    const u = Math.pow(r(), shade > 0 ? 0.6 : 1.6);
    const x = x0 + u * W;
    const y = y0 + r() * H * 0.6;
    const L = H * r.range(0.15, 0.6);
    const a = angle + r.range(-0.12, 0.12);
    const p = [[x, y], [x + Math.sin(a) * L * 0.5 + r.range(-2, 2), y + L * 0.5], [x + Math.sin(a) * L, y + L]];
    if (r() < 0.55) stroke(ctx, p, { width: [r.range(0.8, 2.6), 0.4], profile: 'taper', color: ink(v - 0.2 * r(), r.range(0.45, 0.9)), rng: r, rough: 0.4 });
    else dryStroke(ctx, p, { width: r.range(3, 8), bristles: 4, color: ink(v - 0.1, 0.5), alpha: 0.45, dry: 0.5, rng: r, noise: nz });
  }
  // moss dots on top edges
  for (let i = 0, n = Math.round(W / 4 * dots); i < n; i++) {
    const x = x0 + r() * W;
    blob(ctx, x, y0 + r() * H * 0.9, r.range(0.8, 2.4), { color: ink(0.05, r.range(0.6, 1)), rng: r, irregular: 0.4, squash: 0.6 });
  }
  ctx.restore();
  // dark contour: dry brush around the outline, heavier on the shaded side and bottom
  if (contour > 0) {
    const N = pts.length, run = 9;
    for (let i = 0; i < N; i += run - 1) {
      const seg = [];
      for (let k = 0; k < run && i + k <= N; k++) seg.push(pts[(i + k) % N]);
      if (seg.length < 3) continue;
      const mx = seg[seg.length >> 1][0], my = seg[seg.length >> 1][1];
      const sideW = Math.max(shade > 0 ? (mx - x0) / W : (x1 - mx) / W, (my - y0) / H * 0.8);
      if (r() > 0.45 + 0.55 * sideW) continue;
      dryStroke(ctx, seg, { width: (1.6 + 3 * sideW) * contour + 1, bristles: 4, color: ink(0.04, 0.85), alpha: 0.8, dry: 0.35, rng: r, noise: nz });
    }
  }
}
