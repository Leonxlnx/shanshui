// s09 foliage: dense dark clumps of Huangshan pines crowning cliff tops and ledges
// (merged masses, as in ref 09), built from the library conifer painter.
import { paintConifer } from '../../lib/pine.js';
import { blob, inkCss } from '../../lib/brush.js';
import { makeRng } from '../../engine/rng.js';

// pts: ridge polyline (left to right). h: [min, max] tree height. Trees overlap into one mass;
// a dark under-mass of blots merges their feet and hides the rock edge beneath.
export function paintClump(ctx, pts, { h = [50, 100], spacing = 0.45, tone = 0.03, pineShare = 0.75, spruce = 0, seed = 1, paper, under = 1, lean = 10 } = {}) {
  const r = makeRng('s09clump:' + seed);
  // resample polyline
  const segs = [];
  let L = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push([pts[i - 1], pts[i], L, d]); L += d; }
  const at = (s) => { for (const [a, b, l0, d] of segs) if (s <= l0 + d) { const u = (s - l0) / d; return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; } return pts[pts.length - 1]; };
  const trees = [];
  let s = r() * 10;
  while (s < L) {
    const hh = h[0] + (h[1] - h[0]) * r();
    const [x, y] = at(s);
    trees.push({ x: x + (r() - 0.5) * 8, y: y + hh * (0.15 + r() * 0.2), h: hh, kind: r() < pineShare ? 'pine' : r() < spruce ? 'spruce' : 'fir', tone: tone + r() * 0.08, seed: (r() * 1e6) | 0 });
    s += hh * spacing * (0.6 + r() * 0.8);
  }
  // back trees first (paler, smaller), then front
  trees.sort((a, b) => b.tone - a.tone);
  if (under > 0) {
    for (const t of trees) {
      const n = 3;
      for (let i = 0; i < n; i++) blob(ctx, t.x + (r() - 0.5) * t.h * 0.7, t.y - t.h * (0.05 + r() * 0.2), t.h * (0.16 + r() * 0.12) * under, { color: inkCss(tone + 0.04, 0.95, paper), rng: r, irregular: 0.4, squash: 0.6, rot: r() * 3, sides: 9 });
    }
  }
  for (const t of trees) paintConifer(ctx, t.x, t.y, t.h, { kind: t.kind, tone: t.tone, lean: (r() - 0.5) * 2 * lean, paper, rng: makeRng('s09cf:' + t.seed) });
  return trees;
}
