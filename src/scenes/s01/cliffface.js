// s01 helper: overlay brushwork for the left cliff of ref 01, painted over the rock.js cliff:
// a paper veil that quiets the generic texture, shaded column faces (soft wash on the left of each
// crevice), black wavering crevices with side cracks, a mottled stipple that is denser near the top
// and the crevices, axe-cut cun strokes, and black moss dots / grass tufts along the top edge.
// The bottom fades out (destination-out gradient) so the cliff still dissolves into the mist.
import { stroke, dryStroke, blob, dots, rgba, tone as toneRGB, PAPER } from '../../lib/brush.js';
import { paintPineMass } from './foliage.js';

// Top edge of a closed outline polygon at x (min y over the segments spanning x).
export function topOf(outline) {
  return (x) => {
    let y = 1e9;
    for (let i = 0; i < outline.length; i++) {
      const [ax, ay] = outline[i], [bx, by] = outline[(i + 1) % outline.length];
      if ((x - ax) * (x - bx) > 0 || ax === bx) continue;
      y = Math.min(y, ay + (by - ay) * (x - ax) / (bx - ax));
    }
    return y;
  };
}

export function paintCliffFace(ctx, r, nz, { outline, hole, columns, tone = 0.9, veil = 0.4, fade = [900, 1060], paper = PAPER, k = 1, moss = 1, stipple = 1, skipTop = [], caps = 0, dabs = 0 }) {
  const ink = (v, a) => rgba(toneRGB(Math.min(1, Math.max(0, v)), paper), a);
  const vD = 1 - tone;
  const topAt = topOf(outline);
  const path = new Path2D();
  outline.forEach((p, i) => (i ? path.lineTo(p[0], p[1]) : path.moveTo(p[0], p[1])));
  path.closePath();
  if (hole) path.rect(hole[0], hole[1], hole[2], hole[3]);
  const xs = outline.map((p) => p[0]), ys = outline.map((p) => p[1]);
  const X0 = Math.max(-160, Math.min(...xs)), X1 = Math.max(...xs), Y0 = Math.min(...ys), Y1 = Math.max(...ys);
  ctx.save();
  ctx.clip(path, 'evenodd');
  ctx.fillStyle = rgba(paper, veil);
  ctx.fillRect(X0 - 10, Y0 - 10, X1 - X0 + 20, Y1 - Y0 + 20);
  // a soft darker band under the top edge (the column heads are wet and mossy)
  ctx.save();
  ctx.filter = `blur(${(7 * k).toFixed(1)}px)`;
  for (let x = X0; x < X1; x += 14) {
    const t = topAt(x);
    if (t > Y1 - 5) continue;
    blob(ctx, x, t + r.range(4, 22), r.range(12, 26), { color: ink(vD + 0.05, r.range(0.35, 0.6)), rng: r, irregular: 0.5, squash: r.range(0.6, 1.4) });
  }
  // shaded column faces: a wash on the left of each crevice, fading downwards
  for (const c of columns) {
    const t = topAt(c.x) + 2, len = c.len ?? 260, w = c.w ?? 46, a = (c.dark ?? 0.4) * 1.4;
    const poly = new Path2D();
    poly.moveTo(c.x - w, t - 4); poly.lineTo(c.x + 2, t - 4);
    for (let s = 0; s <= 1.001; s += 0.2) poly.lineTo(c.x + nz.n2(c.x / 37, s * 3) * 8 * s, t + len * s);
    poly.lineTo(c.x - w * 0.35, t + len); poly.closePath();
    const gg = ctx.createLinearGradient(c.x + 2, 0, c.x - w, 0);
    gg.addColorStop(0, ink(vD, a)); gg.addColorStop(0.35, ink(vD, a * 0.55)); gg.addColorStop(1, ink(vD, 0));
    ctx.fillStyle = gg; ctx.fill(poly);
    // dark wet core of the cleft (broad, not a hairline)
    if (dabs > 0) {
      const cw = (c.crack ?? 4) * 2.2 + 4, core = new Path2D();
      core.moveTo(c.x - cw, t); core.lineTo(c.x + 3, t);
      for (let s = 0; s <= 1.001; s += 0.2) core.lineTo(c.x + 3 + nz.n2(c.x / 37, s * 3) * 8 * s, t + len * 0.85 * s);
      for (let s = 1; s >= -0.001; s -= 0.2) core.lineTo(c.x - cw * (1 - 0.6 * s) + nz.n2(c.x / 37, s * 3) * 8 * s, t + len * 0.85 * s);
      core.closePath();
      const gc = ctx.createLinearGradient(0, t, 0, t + len * 0.85);
      gc.addColorStop(0, ink(vD * 0.6, Math.min(0.85, a * 0.9))); gc.addColorStop(0.6, ink(vD * 0.6, a * 0.45)); gc.addColorStop(1, ink(vD, 0));
      ctx.fillStyle = gc; ctx.fill(core);
    }
  }
  ctx.restore();
  // mottled stipple
  const area = (X1 - X0) * (Y1 - Y0);
  const N = Math.round(area / 140 * stipple);
  for (let i = 0; i < N; i++) {
    const x = r.range(X0, X1), t = topAt(x);
    if (t > Y1) continue;
    const y = t + Math.pow(r(), 1.3) * (Y1 - t);
    let dc = 1e9;
    for (const c of columns) dc = Math.min(dc, Math.abs(x - c.x + 10));
    const p = (0.15 + 0.6 * Math.max(0, 1 - (y - t) / 220) + 0.4 * Math.max(0, 1 - dc / 30)) * (0.45 + 0.9 * nz.fbm2(x / 30, y / 22, 3));
    if (r() > p) continue;
    blob(ctx, x, y, (1.4 + 4 * r() * r()), { color: ink(vD * (0.8 + 0.4 * r()), r.range(0.06, 0.2)), rng: r, irregular: 0.55, squash: r.range(1, 2.4), sides: 7 });
  }
  // round 2: dark vertical dabs (raindrop texture) clustered by a noise field, densest under the
  // column heads and along the crevices, so the faces read mottled dark grey instead of plastered
  {
    const N2 = Math.round(area / 260 * dabs);
    for (let i = 0; i < N2; i++) {
      const x = r.range(X0, X1), t = topAt(x);
      if (t > Y1) continue;
      const y = t + Math.pow(r(), 1.6) * (Y1 - t);
      let dc = 1e9;
      for (const c of columns) dc = Math.min(dc, Math.abs(x - c.x + 14));
      const f = nz.fbm2(x / 26 + 7.7, y / 40, 3);
      const p = (0.08 + 0.55 * Math.max(0, 1 - (y - t) / 260) + 0.5 * Math.max(0, 1 - dc / 40)) * Math.max(0, 0.2 + 1.6 * f);
      if (r() > p) continue;
      const rr = 1 + 2.4 * r() * r();
      blob(ctx, x, y, rr, { color: ink(vD * (0.55 + 0.35 * r()), r.range(0.22, 0.6)), rng: r, irregular: 0.55, squash: r.range(1.5, 3.2), rot: r.range(-0.25, 0.25), sides: 6 });
    }
    // a few horizontal fractures across the columns
    for (let i = 0; i < Math.round(columns.length * 3 * dabs); i++) {
      const c = columns[(r() * columns.length) | 0];
      const x = c.x - r.range(10, 50), y = topAt(x) + r.range(30, (c.len ?? 260) * 0.8), L = r.range(10, 26);
      stroke(ctx, [[x, y], [x + L * 0.5, y + r.range(-2, 3)], [x + L, y + r.range(1, 6)]], { width: [r.range(1, 2.2), 0.4], profile: 'taper', color: ink(vD * 0.6, r.range(0.35, 0.7)), rng: r, rough: 0.6 });
    }
  }
  // crevices: long black wavering cracks with a few side cracks
  for (const c of columns) {
    const t = topAt(c.x) + 1 + (r() < 0.5 ? r.range(0, 40) : 0), len = (c.len ?? 260) * r.range(0.6, 1);
    const pts = [];
    for (let s = 0; s <= 1.001; s += 0.08) pts.push([c.x + nz.n2(c.x / 37, s * 3) * 8 * s + r.range(-1, 1), t + len * s]);
    const w0 = (c.crack ?? 4) * 1.5;
    stroke(ctx, pts, { width: [w0, w0 * 0.3], profile: 'brush', color: ink(vD * 0.5, 0.9), rng: r, rough: 0.9 });
    ctx.save();
    ctx.filter = `blur(${(1.2 * k).toFixed(1)}px)`;
    for (let j = 0, nP = 4 + ((r() * 6) | 0); j < nP; j++) {
      const q = pts[Math.round(Math.pow(r(), 1.5) * 0.75 * (pts.length - 1))];
      blob(ctx, q[0] - r.range(0, 16), q[1] + r.range(-6, 12), r.range(5, 17), { color: ink(vD * 0.7, r.range(0.25, 0.55)), rng: r, irregular: 0.6, squash: r.range(1, 2.2) });
    }
    ctx.restore();
    dryStroke(ctx, pts.slice(0, 8).map((p) => [p[0] - 4, p[1]]), { width: w0 * 2.2, bristles: 5, color: ink(vD, 0.5), alpha: 0.5, dry: 0.5, rng: r, noise: nz });
    const nS = 1 + ((r() * 3) | 0);
    for (let j = 0; j < nS; j++) {
      const s0 = r.range(0.1, 0.6), q = pts[Math.round(s0 * (pts.length - 1))];
      const dx = r.range(-14, 14), L = r.range(30, 90);
      stroke(ctx, [q, [q[0] + dx * 0.5, q[1] + L * 0.5], [q[0] + dx, q[1] + L]], { width: [w0 * 0.55, 0.4], profile: 'taper', color: ink(vD * 0.6, 0.75), rng: r, rough: 0.6 });
    }
  }
  // axe-cut cun strokes near the crevices and the top
  for (let i = 0; i < Math.round(columns.length * 26); i++) {
    const c = columns[(r() * columns.length) | 0];
    const x = c.x + r.range(-36, 18), t = topAt(x);
    const y = t + Math.pow(r(), 1.5) * (c.len ?? 260) * 0.8;
    const L = r.range(6, 22), ang = r.range(-0.3, 0.3);
    stroke(ctx, [[x, y], [x + Math.sin(ang) * L * 0.5, y + L * 0.5], [x + Math.sin(ang) * L, y + L]], { width: [r.range(1, 2.6), 0.4], profile: 'taper', color: ink(vD * 0.8, r.range(0.3, 0.7)), rng: r, rough: 0.5 });
  }
  ctx.restore();
  // moss dots and grass tufts along the top edge (they may overhang the edge)
  for (let x = X0; x < X1; x += 3) {
    const t = topAt(x);
    if (t > Y1 - 5 || skipTop.some(([a, b]) => x > a && x < b)) continue;
    if (r() < caps * 0.07) paintPineMass(ctx, r, x, t - r.range(2, 8), r.range(12, 24), { v: 0.04, paper, k, wash: 0.8, trunk: r() < 0.4 });
    if (r() > 0.32 * moss * (0.4 + 0.6 * Math.max(0, nz.n2(x / 40, 4.4) + 0.5))) continue;
    const n = 2 + ((r() * 4) | 0);
    for (let j = 0; j < n; j++) blob(ctx, x + r.range(-5, 5), t + r.range(-3, 12), r.range(1.2, 4.5), { color: ink(vD * 0.5, r.range(0.7, 0.95)), rng: r, irregular: 0.45, squash: 0.75 });
    if (r() < 0.25) for (let j = 0; j < 4; j++) {
      const L = r.range(5, 12), a = r.range(-0.6, 0.6) - Math.PI / 2;
      stroke(ctx, [[x, t + 2], [x + Math.cos(a) * L * 0.5, t + 2 + Math.sin(a) * L * 0.5], [x + Math.cos(a) * L, t + 2 + Math.sin(a) * L]], { width: [1.4, 0.2], profile: 'taper', color: ink(vD * 0.5, 0.85), rng: r, rough: 0.3 });
    }
  }
  // dissolve the bottom
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  const gf = ctx.createLinearGradient(0, fade[0], 0, fade[1]);
  gf.addColorStop(0, 'rgba(0,0,0,0)'); gf.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = gf;
  ctx.fillRect(X0 - 20, fade[0], X1 - X0 + 40, Math.max(Y1, fade[1]) - fade[0] + 400);
  ctx.restore();
}
