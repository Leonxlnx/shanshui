// s08: cascade rock geometry. A rock is a pile of rounded bumps of uneven size hugging a mound
// envelope (stacked boulders with notches between, shoulders sloping away); top(x) is exposed so
// water can be poured over the exact contour.
import { makeRng } from '../../engine/rng.js';

export function lumpRock(cx, yTop, w, h, seed) {
  const r = makeRng('s08lump:' + seed);
  const x0 = cx - w / 2, x1 = cx + w / 2;
  const nb = Math.max(3, Math.round(w / 40)) + (r() < 0.5 ? 1 : 0);
  const skew = (r() - 0.5) * 0.5;
  const env = (x) => {
    const e = Math.min(1.3, Math.abs((x - cx) / (w / 2) - skew * 0.4));
    return yTop + h * 0.6 * Math.pow(e, 2.4);
  };
  const bumps = [];
  for (let i = 0; i < nb; i++) {
    const bx = x0 + w * (i + 0.5) / nb + (r() - 0.5) * (w / nb) * 0.5;
    const rr = (w / nb) * (0.55 + r() * 0.45);
    const sq = 0.6 + r() * 0.4;
    const t = env(bx) + (i % 2 ? 0.12 + r() * 0.2 : r() * 0.1) * h;
    bumps.push({ x: bx, r: rr, sq, y: t + rr * sq, k: 2.6 + r() * 2.2 });
  }
  const bottom = yTop + h * 1.25;
  // each bump: a squashed upper half-circle, continued below its widest point by a sloping skirt
  const top = (x) => {
    let best = bottom;
    for (const b of bumps) {
      const d = Math.abs(x - b.x);
      const y = d < b.r ? b.y - Math.sqrt(b.r * b.r - d * d) * b.sq : b.y + (d - b.r) * b.k;
      best = Math.min(best, y);
    }
    return Math.max(best, yTop);
  };
  const pts = [];
  let xa = cx, xb = cx;
  for (let x = cx; x > x0 - w; x -= 2) { if (top(x) >= bottom) break; xa = x; }
  for (let x = cx; x < x1 + w; x += 2) { if (top(x) >= bottom) break; xb = x; }
  const n = Math.max(16, Math.round((xb - xa) / 4));
  for (let i = 0; i <= n; i++) { const x = xa + ((xb - xa) * i) / n; pts.push([x, Math.min(top(x), bottom)]); }
  pts.push([xb, bottom + 10], [xa, bottom + 10]);
  return { outline: pts, top, x0: xa, x1: xb, yTop, h, cx, w: xb - xa };
}
