// s01 helper: dense dark foliage masses (pine crowns, bushes, small conifers) that cover the
// lower-left cliff slope and ledges of ref 01. Painted in Canvas2D design px, back rows paler.
// Each crown is a soft wet grey wash with flat dark needle pads stacked on a trunk; pads have a
// wet black core and a ragged needle fringe (no outlines, no pale halos).
import { blob, dots, stroke, rgba, tone as toneRGB, PAPER } from '../../lib/brush.js';
import { paintConifer } from '../../lib/pine.js';

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const cl01 = (v) => Math.min(1, Math.max(0, v));

// One flat needle pad: wet dark core + spiky fringe on the upper rim, a few hanging needles below.
function paintPad(ctx, r, px, py, a, b, v, ink) {
  blob(ctx, px, py, a * 0.8, { color: ink(v, r.range(0.82, 0.96)), rng: r, irregular: 0.38, squash: (b / a) * 1.15, sides: 12 });
  // needle fringe: thin tapered triangles batched into two fills (cheap)
  const nn = Math.round(a * 1.2) + 5;
  for (let pass = 0; pass < 2; pass++) {
    ctx.beginPath();
    for (let j = 0; j < (nn >> 1) + pass; j++) {
      const up = r() < 0.75;
      const th = up ? -Math.PI * (0.03 + 0.94 * r()) : Math.PI * (0.15 + 0.7 * r());
      const e0 = r.range(0.3, 0.75), ex = px + Math.cos(th) * a * e0, ey = py + Math.sin(th) * b * e0;
      const L = (up ? b * r.range(0.8, 1.7) : b * r.range(0.3, 0.8)) + 1.5;
      let dx = Math.cos(th), dy = Math.sin(th) * 0.8 - (up ? 0.25 : -0.2);
      const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
      const hw = r.range(0.45, 0.95);
      ctx.moveTo(ex - dy * hw, ey + dx * hw); ctx.lineTo(ex + dx * L, ey + dy * L); ctx.lineTo(ex + dy * hw, ey - dx * hw); ctx.closePath();
    }
    ctx.fillStyle = ink(v + 0.03 * pass, pass ? 0.65 : 0.9);
    ctx.fill();
  }
  dots(ctx, px, py - b * 0.3, a * 0.95, Math.round(a * 0.5) + 2, { size: [0.6, 1.8], color: ink(v, 1), alpha: [0.5, 0.9], rng: r, squash: 0.45 });
}

// One pine-like crown of radius R centred at (x, y): wet wash, trunk, 2-4 stacked pads.
export function paintPineMass(ctx, r, x, y, R, { v = 0.06, paper = PAPER, trunk = true, k = 1, wash = 1 } = {}) {
  const ink = (vv, a) => rgba(toneRGB(cl01(vv), paper), a);
  if (wash > 0) {
    ctx.save();
    ctx.filter = `blur(${(R * 0.28 * k).toFixed(1)}px)`;
    blob(ctx, x + r.range(-0.2, 0.2) * R, y + R * 0.15, R * r.range(0.9, 1.15), { color: ink(v + 0.1, 0.55 * wash), rng: r, irregular: 0.5, squash: 0.72 });
    ctx.restore();
  }
  if (trunk && R > 9) {
    const tx = x + r.range(-0.25, 0.25) * R;
    stroke(ctx, [[tx + r.range(-3, 3), y + R * 0.95], [tx + r.range(-4, 4), y + R * 0.45], [x + r.range(-5, 5), y - R * 0.2]], { width: [R * 0.15, R * 0.07], profile: 'taper', color: ink(v + 0.03, 0.92), rng: r, rough: 0.4 });
  }
  const n = 3 + ((r() * (R > 18 ? 4 : 2)) | 0);
  const pads = [];
  for (let i = 0; i < n; i++) {
    const a = R * r.range(0.35, 0.6), b = a * r.range(0.45, 0.62);
    pads.push([x + r.range(-0.55, 0.55) * R, y + r.range(-0.55, 0.3) * R, a, b]);
  }
  pads.sort((p, q) => p[1] - q[1]);
  for (const [px, py, a, b] of pads) paintPad(ctx, r, px, py, a, b, v + r.range(-0.02, 0.05), ink);
}

// Crowns scattered along a polyline (and in a band below it), back row first.
// pts: [[x, y], ...]; band: px below the line that is also filled; size: [min, max] crown radius.
export function paintFoliageBand(ctx, r, nz, pts, { band = 60, size = [10, 26], density = 1, v = 0.06, paper = PAPER, pines = 0.15, back = 0.25, k = 1 } = {}) {
  const L = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.max(1, Math.round(len / 4));
    for (let q = 0; q < n; q++) L.push([ax + (bx - ax) * q / n, ay + (by - ay) * q / n]);
  }
  const items = [];
  for (let i = 0; i < L.length; i += 1) {
    const [x, y] = L[i];
    const d = density * (0.35 + 0.65 * ss(-0.6, 0.4, nz.n2(x / 90, y / 90 + 3.3)));
    if (r() > d * 0.32) continue;
    const depth = r() * r();                                // 0 = on the line, 1 = deep in the band
    const R = size[0] + (size[1] - size[0]) * r() * r();
    items.push({ x: x + r.range(-8, 8), y: y + depth * band + R * 0.3, R, depth, pine: r() < pines });
  }
  // back (higher, paler) first: sort by y
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
    const vv = v + back * (1 - it.depth) * r() * 0.6;
    if (it.pine) paintConifer(ctx, it.x, it.y + it.R * 0.6, it.R * 2.6, { kind: r() < 0.6 ? 'pine' : 'fir', tone: Math.min(1, vv), paper, seed: (r() * 1e6) | 0 });
    else paintPineMass(ctx, r, it.x, it.y, it.R, { v: vv, paper, k, wash: it.depth < 0.5 ? 1 : 0.6 });
  }
}
