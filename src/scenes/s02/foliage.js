// s02 helper (copied from s01): dense dark foliage masses (tree canopies, bushes, small pines) that cover the
// lower-left cliff slope and ledges of ref 01. Painted in Canvas2D design px, back rows paler.
import { blob, dots, stroke, rgba, tone as toneRGB, PAPER } from '../../lib/brush.js';
import { paintConifer } from '../../lib/pine.js';

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// One rounded canopy: a dome of scalloped clumps, dark core, ragged dotted rim.
export function paintCanopy(ctx, r, x, y, R, { v = 0.08, paper = PAPER, trunk = true } = {}) {
  const ink = (vv, a) => rgba(toneRGB(Math.min(1, Math.max(0, vv)), paper), a);
  if (trunk && R > 10) {
    stroke(ctx, [[x + r.range(-3, 3), y + R * 0.9], [x + r.range(-4, 4), y + R * 0.3], [x + r.range(-6, 6), y - R * 0.1]], { width: [R * 0.14, R * 0.06], profile: 'taper', color: ink(v + 0.05, 0.9), rng: r });
  }
  const n = 6 + ((R / 4) | 0);
  // a pale halo first, so overlapping canopies stay separated by a thin light gap
  const cl = [];
  for (let i = 0; i < n; i++) {
    const a = r.range(-Math.PI, 0) * 0.95 - 0.08, d = Math.sqrt(r()) * R * 0.75;
    cl.push([x + Math.cos(a) * d * 1.2, y + Math.sin(a) * d * 0.85 + R * 0.2, R * r.range(0.32, 0.58)]);
  }
  for (const [cx, cy, rr] of cl) blob(ctx, cx, cy - 1, rr + 2.2, { color: rgba(paper, 0.8), rng: r, irregular: 0.3, squash: 0.82, sides: 9 });
  for (let i = 0; i < n; i++) {
    const [cx, cy, rr] = cl[i];
    blob(ctx, cx, cy, rr, { color: ink(v + r.range(-0.03, 0.12), r.range(0.75, 0.95)), rng: r, irregular: 0.42, squash: 0.82, sides: 11 });
  }
  dots(ctx, x, y - R * 0.2, R * 1.1, Math.round(R * 1.2), { size: [0.8, 2.6], color: ink(v, 1), alpha: [0.5, 0.95], rng: r, squash: 0.55 });
}

// Canopies scattered along a polyline (and in a band below it), back row first.
// pts: [[x, y], ...]; band: px below the line that is also filled; size: [min, max] canopy radius.
export function paintFoliageBand(ctx, r, nz, pts, { band = 60, size = [10, 26], density = 1, v = 0.06, paper = PAPER, pines = 0.15, back = 0.25 } = {}) {
  const L = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.max(1, Math.round(len / 4));
    for (let k = 0; k < n; k++) L.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]);
  }
  const items = [];
  for (let i = 0; i < L.length; i += 1) {
    const [x, y] = L[i];
    const d = density * (0.35 + 0.65 * ss(-0.6, 0.4, nz.n2(x / 90, y / 90 + 3.3)));
    if (r() > d * 0.3) continue;
    const depth = r() * r();                                // 0 = on the line, 1 = deep in the band
    const R = size[0] + (size[1] - size[0]) * r() * r();
    items.push({ x: x + r.range(-8, 8), y: y + depth * band + R * 0.3, R, depth, pine: r() < pines });
  }
  // back (higher, paler) first: sort by y
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
    const vv = v + back * (1 - it.depth) * r() * 0.6;
    if (it.pine) paintConifer(ctx, it.x, it.y + it.R * 0.6, it.R * 2.6, { kind: r() < 0.5 ? 'pine' : 'fir', tone: Math.min(1, vv), paper, seed: (r() * 1e6) | 0 });
    else paintCanopy(ctx, r, it.x, it.y, it.R, { v: vv, paper });
  }
}
