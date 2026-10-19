// s01 helper: small rocky lake islands with conifers (adapted from the water lab props so the
// scene does not depend on lab files). Waterline at baseY, design px.
import { blob, dots, stroke, inkCss } from '../../lib/brush.js';
import { inkify } from '../../lib/inkfx.js';

function conifer(ctx, rng, x, y, h, v) {
  const tiers = 4 + ((rng() * 3) | 0);
  stroke(ctx, [[x, y], [x + rng.range(-2, 2), y - h * 0.5], [x + rng.range(-2, 2), y - h]], { width: Math.max(1.2, h * 0.06), color: inkCss(v, 0.95), rng, profile: 'taper' });
  for (let i = 0; i < tiers; i++) {
    const s = i / (tiers - 1);
    const ty = y - h * (0.28 + 0.72 * s);
    const tw = h * 0.42 * (1 - s * 0.7) * (0.75 + 0.5 * rng());
    const side = rng.range(-0.25, 0.25) * tw;
    for (let k = 0; k < 3; k++) {
      blob(ctx, x + side + rng.range(-0.4, 0.4) * tw, ty + rng.range(-1, 1), tw * rng.range(0.45, 0.7), { color: inkCss(v + rng.range(-0.04, 0.06), 0.9), rng, irregular: 0.5, squash: 0.4, sides: 9 });
    }
  }
}

export function paintIsland(ctx, rng, { x0, x1, baseY, h, trees = 6, v = 0.12, treeH = 40 }) {
  const w = x1 - x0;
  const n = 40;
  const bumps = [[0.35 + rng.range(-0.1, 0.1), 1, 0.16], [0.62 + rng.range(-0.1, 0.1), 0.75, 0.14], [0.15, 0.35, 0.08], [0.85, 0.4, 0.09]];
  const prof = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    let hh = 0;
    for (const [c, a, sg] of bumps) hh = Math.max(hh, a * Math.exp(-Math.pow((s - c) / sg, 2) * 0.5));
    hh = Math.min(1, hh * (0.9 + 0.2 * rng())) * Math.min(1, s * 12, (1 - s) * 12);
    prof.push([x0 + s * w, baseY - h * hh]);
  }
  const shape = new Path2D();
  shape.moveTo(x0, baseY);
  for (const p of prof) shape.lineTo(p[0], p[1]);
  shape.lineTo(x1, baseY); shape.closePath();
  const g = ctx.createLinearGradient(0, baseY - h, 0, baseY);
  g.addColorStop(0, inkCss(v + 0.18, 0.95));
  g.addColorStop(1, inkCss(v + 0.42, 0.95));
  ctx.fillStyle = g; ctx.fill(shape);
  ctx.save(); ctx.clip(shape);
  for (let i = 0; i < 70; i++) {
    const x = x0 + rng() * w, y = baseY - rng() * h;
    const len = rng.range(8, 26);
    const ang = rng.range(-0.9, 0.9) + Math.PI / 2;
    stroke(ctx, [[x, y], [x + Math.cos(ang) * len, y + Math.sin(ang) * len]], { width: rng.range(2, 7), color: inkCss(v + rng.range(-0.05, 0.3), rng.range(0.4, 0.85)), rng });
  }
  ctx.restore();
  for (let i = 0; i < n; i += 2) {
    const a = prof[i], b = prof[Math.min(n, i + 3)];
    stroke(ctx, [a, b], { width: rng.range(2, 5), color: inkCss(v, 0.9), rng });
  }
  dots(ctx, x0 + w * 0.45, baseY - h * 0.75, w * 0.3, 40, { size: [1.5, 3.5], rng, color: inkCss(v * 0.5, 1), squash: 0.25 });
  ctx.fillStyle = inkCss(v + 0.4, 0.8);
  ctx.beginPath(); ctx.ellipse(x0 + w * 0.5, baseY, w * 0.56, 3.5, 0, Math.PI, 0); ctx.fill();
  for (let i = 0; i < trees; i++) {
    const s = 0.12 + 0.76 * (i + rng()) / trees;
    const k = Math.round(s * n);
    const tx = prof[k][0], ty = prof[k][1] + 4;
    conifer(ctx, rng, tx, ty, treeH * (0.55 + 0.6 * rng()) * (0.6 + 0.6 * (baseY - ty) / h), v * 0.5);
  }
}

export function bakeInked(api, w, h, draw) {
  const raw = api.bakeCanvas(w, h, draw);
  const src = inkify(api, raw, { edge: 0.5, granulation: 0.25, bleed: 1.2 });
  api.engine?.freeTex?.(raw);
  return src;
}
