// s05 helper (copied from s01): dense dark foliage masses (tree canopies, bushes, small pines) that cover the
// lower-left cliff slope and ledges of ref 01. Painted in Canvas2D design px, back rows paler.
import { blob, dots, stroke, rgba, tone as toneRGB, PAPER } from '../../lib/brush.js';
import { paintConifer } from '../../lib/pine.js';
import { withBlur } from '../../lib/flora.js';

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- s05: dotted ink foliage
// One clump of foliage painted as ink dots (dian): a pale wet wash, then many small irregular
// dabs scattered around the centre (denser and darker toward the core and the lower side),
// with a ragged dotted rim. R = clump radius (px), v = darkest tone (0 black .. 1 paper).
export function paintDotClump(ctx, r, x, y, R, { v = 0.05, paper = PAPER, wash = 0.3, dots: dn = 1, dab = 1, flat = 0.75, halo = 0.55 } = {}) {
  const ink = (vv, a) => rgba(toneRGB(Math.min(1, Math.max(0, vv)), paper), a);
  const s0 = Math.max(1.5, R * 0.16) * dab;
  // thin paper halo along the top: separates this clump from the ones behind it
  if (halo > 0) blob(ctx, x, y - R * 0.08, R * 1.04 + 1.5, { color: rgba(paper, halo), rng: r, irregular: 0.3, squash: flat, sides: 10 });
  ctx.save();
  ctx.filter = `blur(${Math.max(0.8, R * 0.08).toFixed(1)}px)`;
  blob(ctx, x, y + R * 0.08, R * 0.9, { color: ink(v + 0.3, wash), rng: r, irregular: 0.4, squash: flat, sides: 10 });
  ctx.restore();
  // scalloped dotted rim on the upper half (leaf clusters defining the contour)
  const nr = Math.round((5 + R * 0.45) * dn);
  for (let i = 0; i < nr; i++) {
    const a = Math.PI * (1.05 + 0.9 * (i + r() * 0.8) / nr);
    const d = R * r.range(0.72, 0.98);
    blob(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d * flat, s0 * r.range(0.7, 1.25), { color: ink(v + 0.06 * r(), r.range(0.75, 1)), rng: r, irregular: 0.5, squash: r.range(0.55, 0.9), rot: a + 1.57, sides: 7 });
  }
  const n = Math.round((R * R / 16 + 5) * dn);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = Math.pow(r(), 0.8) * R * 0.9;
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * flat;
    const core = 1 - d / R;
    const s = s0 * (0.55 + 0.8 * r() * r()) * (0.75 + 0.4 * core);
    const vv = v + (1 - core) * 0.14 * r();
    blob(ctx, px, py, s, { color: ink(vv, 0.7 + 0.3 * r()), rng: r, irregular: 0.5, squash: 0.6 + 0.3 * r(), rot: r() * 3, sides: 7 });
  }
  // a few heavy dark dabs at the core (the wet centre of the clump)
  const m = 1 + ((R / 10) | 0);
  for (let i = 0; i < m; i++) {
    blob(ctx, x + r.range(-0.35, 0.35) * R, y + r.range(-0.05, 0.3) * R * flat, s0 * r.range(1.3, 2.2), { color: ink(v, r.range(0.8, 1)), rng: r, irregular: 0.45, squash: 0.7, sides: 8 });
  }
}

// Clumps filling a polygon (pts), back (top) to front (bottom). Top clumps paler (mist), the
// lower ones darker. size = [min, max] clump radius.
export function paintDotMass(ctx, r, nz, pts, { size = [10, 24], density = 1, v = 0.05, back = 0.25, paper = PAPER, wash = 0.3, dots: dn = 1, dab = 1, flat = 0.75, jag = 0.6, halo = 0.55 } = {}) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const path = new Path2D();
  pts.forEach((p, i) => (i ? path.lineTo(p[0], p[1]) : path.moveTo(p[0], p[1])));
  path.closePath();
  const area = (x1 - x0) * (y1 - y0);
  const rm = (size[0] + size[1]) / 2;
  const N = Math.round(area / (rm * rm * 1.6) * density * 2);
  const items = [];
  const T = ctx.getTransform();
  for (let i = 0; i < N * 3 && items.length < N; i++) {
    const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0);
    if (!ctx.isPointInPath(path, x * T.a + T.e, y * T.d + T.f)) continue;
    if (nz && nz.n2(x / 70, y / 50) < -jag + r() * 0.4 - 0.2) continue;
    const R = size[0] + (size[1] - size[0]) * r() * r();
    items.push({ x, y, R });
  }
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
    const depth = (it.y - y0) / Math.max(1, y1 - y0);
    paintDotClump(ctx, r, it.x, it.y, it.R, { v: v + back * (1 - depth) * (0.5 + 0.5 * r()), paper, wash, dots: dn, dab, flat, halo });
  }
}

// Wet-blot foliage mass (shrubs / undergrowth of ref 05): a mottled grey wash over the polygon,
// irregular dark wet blots clustered by noise (heavier toward the bottom), small crisp dabs
// scattered around the blot edges, and a ragged dotted fringe along the top contour.
export function paintBlotMass(ctx, r, nz, pts, { v = 0.04, paper = PAPER, size = [8, 22], density = 1, wash = 0.5, dots: dn = 1, light = 0.05, fringe = 1, seed = 0 } = {}) {
  const ink = (vv, a) => rgba(toneRGB(Math.min(1, Math.max(0, vv)), paper), a);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const path = new Path2D();
  pts.forEach((p, i) => (i ? path.lineTo(p[0], p[1]) : path.moveTo(p[0], p[1])));
  path.closePath();
  const T = ctx.getTransform();
  const inside = (x, y) => ctx.isPointInPath(path, x * T.a + T.e, y * T.d + T.f);
  const W = x1 - x0, H = y1 - y0, A = W * H;
  const sd = seed * 13.7;
  const field = (x, y) => nz.fbm2(x / 55 + sd, y / 38, 3) * 0.7 + nz.n2(x / 17 + sd, y / 13) * 0.3;   // clustering
  // 1. mottled wash (one blurred pass)
  withBlur(ctx, 3, (g) => {
    const nw = Math.round(A / 260 * density);
    for (let i = 0; i < nw; i++) {
      const x = x0 + r() * W, y = y0 + r() * H;
      if (!inside(x, y)) continue;
      blob(g, x, y, r.range(10, 26), { color: ink(v + 0.22 + 0.2 * r(), wash * r.range(0.5, 1)), rng: r, irregular: 0.5, squash: 0.6 });
    }
  });
  // 2. crisp wet blots: black where the cluster field is high, mid grey where it is low,
  //    bare (light gaps) below a threshold; heavier toward the bottom of the mass
  const nb = Math.round(A / 45 * density);
  for (let i = 0; i < nb; i++) {
    const x = x0 + r() * W, y = y0 + r() * H;
    if (!inside(x, y)) continue;
    const low = (y - y0) / H;
    const f = field(x, y) + 0.3 * low - light;
    if (f < -0.32 + 0.3 * r()) continue;
    const R = size[0] + (size[1] - size[0]) * Math.pow(r(), 2.5);
    const vv = v + Math.min(0.38, Math.max(0, 0.22 - f * 0.6)) * (0.6 + 0.6 * r());
    blob(ctx, x, y, R, { color: ink(vv, r.range(0.75, 1)), rng: r, irregular: 0.55, squash: r.range(0.5, 0.85), rot: r.range(-0.4, 0.4), sides: 11 });
  }
  // 3. crisp dabs (dian) where the blots thin out
  const nd = Math.round(A / 40 * dn * density);
  for (let i = 0; i < nd; i++) {
    const x = x0 + r() * W, y = y0 + r() * H;
    if (!inside(x, y)) continue;
    const f = field(x, y) - light;
    if (Math.abs(f + 0.1) > 0.28 + 0.2 * r()) continue;
    blob(ctx, x, y, r.range(1.2, 3.6), { color: ink(v + 0.1 * r(), r.range(0.6, 1)), rng: r, irregular: 0.45, squash: r.range(0.45, 0.8), rot: r.range(-0.5, 0.5), sides: 7 });
  }
  // 4. ragged fringe along the polygon contour (top edges only: the outline segments that face up)
  if (fringe > 0) for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const nx = b[1] - a[1], ny = -(b[0] - a[0]);        // outward-ish normal for a clockwise polygon
    const L = Math.hypot(nx, ny);
    if (L < 1 || ny / L > -0.2) continue;               // only edges whose normal points up
    const n = Math.round(L / 5 * fringe);
    for (let k = 0; k < n; k++) {
      const s = r();
      const x = a[0] + (b[0] - a[0]) * s, y = a[1] + (b[1] - a[1]) * s;
      const o = r() * r() * 9;
      blob(ctx, x + nx / L * o, y + ny / L * o, r.range(1.2, 3.4) * (1 - o / 14), { color: ink(v + 0.08 * r(), r.range(0.6, 1)), rng: r, irregular: 0.45, squash: r.range(0.5, 0.85), sides: 7 });
    }
  }
}

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
