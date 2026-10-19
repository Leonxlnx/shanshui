// s02 helper: wet foreground pines for the groves rising out of the bottom mist (ref 02). Each pine
// is a thin leaning trunk carrying flat, drooping needle pads built from small irregular blots with
// a dotted needle fringe, darker toward the top: painted clusters, not crisp stamped triangles.
import { stroke, blob, dots, rgba, tone as toneRGB } from '../../lib/brush.js';

const clamp01 = (v) => Math.min(1, Math.max(0, v));

export function paintWetPine(ctx, r, x, y, h, { v = 0.1, paper, lean = 0 } = {}) {
  const ink = (vv, a) => rgba(toneRGB(clamp01(vv), paper), a);
  // trunk (mostly hidden by the pads; shows between the lower tiers)
  const tp = [];
  const ph = r() * 6;
  for (let s = 0; s <= 1.001; s += 0.2) tp.push([x + lean * h * s + Math.sin(s * 3 + ph) * h * 0.025, y - h * 0.9 * s]);
  stroke(ctx, tp, { width: [Math.max(1.2, h * 0.04), Math.max(0.6, h * 0.012)], profile: 'taper', color: ink(v + 0.1, 0.8), rng: r, rough: 0.5 });
  const tiers = 5 + ((r() * 3) | 0);
  for (let i = 0; i < tiers; i++) {
    const s = i / (tiers - 1);                                 // 0 lowest pad .. 1 crown
    const ty = y - h * (0.2 + 0.76 * s) + r.range(-0.03, 0.03) * h;
    const cx = x + lean * h * (0.2 + 0.76 * s);
    const w = h * r.range(0.4, 0.62) * (1 - 0.6 * s);
    const off = (r() < 0.5 ? -1 : 1) * w * r.range(0, 0.28);
    const tv = v + (1 - s) * 0.14 + r.range(-0.03, 0.05);
    // the pad: a flat cluster of blots, drooping toward its tips
    const nb = 7 + ((w / 4) | 0);
    for (let j = 0; j < nb; j++) {
      const u = r() * 2 - 1;
      const bx = cx + off + u * w * 0.5;
      const by = ty + u * u * w * 0.14 + r.range(-0.05, 0.08) * w;
      blob(ctx, bx, by, w * r.range(0.09, 0.19), { color: ink(tv + r.range(-0.02, 0.12), r.range(0.65, 0.95)), rng: r, irregular: 0.65, squash: r.range(0.32, 0.55), rot: r.range(-0.25, 0.25), sides: 9 });
    }
    // needle fringe along the pad
    dots(ctx, cx + off, ty, w * 0.55, Math.round(6 + w * 0.7), { size: [0.7, Math.max(1.3, w * 0.045)], color: ink(tv, 1), alpha: [0.35, 0.85], rng: r, squash: 0.45 });
  }
}
