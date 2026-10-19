// s07 shrubs: small-leaved bushes painted as stems ending in rosettes of short pointed leaves
// (the dark leafy shrubs around the near boulder in ref 07).
import { rgba, tone } from '../../lib/brush.js';

function leaf(ctx, x, y, ang, len, wid) {
  const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + dx * len * 0.45 + nx * wid, y + dy * len * 0.45 + ny * wid, x + dx * len, y + dy * len);
  ctx.quadraticCurveTo(x + dx * len * 0.45 - nx * wid, y + dy * len * 0.45 - ny * wid, x, y);
  ctx.fill();
}

// loose cluster of small pointed leaf dabs around (x, y): no centre, leaves scattered in a disc,
// pointing roughly outward, each dab a tapered teardrop of varying grey
function rosette(ctx, x, y, r, rng, col, alpha, n, paper) {
  const m = n + 2 + ((rng() * 4) | 0);
  for (let i = 0; i < m; i++) {
    const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * r * 1.3;
    const cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d * 0.8;
    const dir = a + (rng() - 0.5) * 1.6 - 0.4;
    const len = r * (0.7 + rng() * 0.5);
    const f = paper && rng() < 0.15 ? 0.2 + rng() * 0.3 : 0;
    const c = f ? col.map((v, k) => v + (paper[k] - v) * f) : col;
    ctx.fillStyle = rgba(c, alpha * (0.75 + rng() * 0.25));
    leaf(ctx, cx - Math.cos(dir) * len * 0.4, cy - Math.sin(dir) * len * 0.4, dir, len, len * (0.36 + rng() * 0.2));
  }
}
// base (x, y), overall height h, opts: tone (0 ink..1 paper), paper, spread (deg), lean (deg), stems, leaf (size px), density
export function paintShrub(ctx, x, y, h, rng, o = {}) {
  const paper = o.paper;
  const tn = o.tone ?? 0.05;
  const stems = o.stems ?? 5 + ((rng() * 4) | 0);
  const spread = (o.spread ?? 55) * Math.PI / 180;
  const lean = (o.lean ?? 0) * Math.PI / 180;
  const ls = o.leaf ?? Math.max(5, h * 0.085);
  const dens = o.density ?? 1;
  ctx.lineCap = 'round';
  for (let s = 0; s < stems; s++) {
    const a = -Math.PI / 2 + lean + (rng() * 2 - 1) * spread;
    const L = h * (0.5 + rng() * 0.5);
    const bend = (rng() - 0.5) * 0.5;
    const col = tone(Math.min(1, tn + Math.pow(rng(), 2) * 0.2), paper);
    const pts = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const aa = a + bend * t;
      pts.push([x + Math.cos(aa) * L * t + (rng() - 0.5) * 1.5, y + Math.sin(aa) * L * t]);
    }
    ctx.strokeStyle = rgba(col, 0.85);
    ctx.lineWidth = Math.max(0.8, h * 0.012);
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
    // rosettes at the tip and along the upper stem, with short side twigs
    const tip = pts[6];
    rosette(ctx, tip[0], tip[1], ls * (0.9 + rng() * 0.4), rng, col, 0.92, 4 + ((rng() * 3) | 0), paper);
    const extra = Math.round((1 + rng() * 2.5) * dens);
    for (let k = 0; k < extra; k++) {
      const p = pts[2 + ((rng() * 4) | 0)];
      const sa = a + (rng() < 0.5 ? -1 : 1) * (0.5 + rng() * 0.6);
      const sl = ls * (1 + rng() * 1.5);
      const q = [p[0] + Math.cos(sa) * sl, p[1] + Math.sin(sa) * sl];
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
      rosette(ctx, q[0], q[1], ls * (0.65 + rng() * 0.4), rng, col, 0.88, 3 + ((rng() * 3) | 0), paper);
    }
  }
}

// dense dark mass of overlapping shrubs along a baseline
export function paintShrubMass(ctx, pts, rng, o = {}) {
  const n = o.count ?? 12;
  for (let i = 0; i < n; i++) {
    const s = rng();
    const k = Math.min(pts.length - 2, Math.floor(s * (pts.length - 1)));
    const f = s * (pts.length - 1) - k;
    const x = pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f, y = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f;
    const h = (o.height ?? [40, 80])[0] + rng() * ((o.height ?? [40, 80])[1] - (o.height ?? [40, 80])[0]);
    paintShrub(ctx, x + (rng() - 0.5) * 10, y + rng() * 8, h, rng, o);
  }
}
