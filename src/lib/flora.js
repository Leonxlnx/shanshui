// flora.js - bamboo, red maples, shrubs and grass for the shan shui film.
// (usage doc is filled in at the end of development)

import { stroke, blob, rgba, tone, PAPER, INK } from './brush.js';
import { inkify } from './inkfx.js';
import { makeRng, makeNoise, clamp, mix, smoothstep } from '../engine/rng.js';

const TAU = Math.PI * 2;
const D2R = Math.PI / 180;

// ------------------------------------------------------------------ helpers
function rngOf(o, salt) {
  if (o.rng) return o.rng.fork ? o.rng.fork(salt) : o.rng;
  return makeRng('flora:' + salt + ':' + (o.seed ?? 1));
}
const col = (v, paper) => tone(clamp(v, 0, 1), paper || PAPER);

function polyFill(ctx, L, R) {
  ctx.beginPath();
  ctx.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < L.length; i++) ctx.lineTo(L[i][0], L[i][1]);
  for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
  ctx.closePath();
}

// sample a bowed line from a to b with sideways bow (px, + = to the right of a->b) and noise wobble
function bowPath(a, b, bow, n, wobble = 0, nz = null, seed = 0) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  const P = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const off = bow * 4 * s * (1 - s) + (nz ? nz.n2(s * 2.3 + seed, seed * 0.37) * wobble : 0);
    P.push([a[0] + dx * s + nx * off, a[1] + dy * s + ny * off]);
  }
  return P;
}

function pathInfo(P) {
  const L = [0];
  for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const total = L[L.length - 1] || 1;
  const at = (s) => {
    const d = clamp(s, 0, 1) * total;
    let i = 1;
    while (i < L.length - 1 && L[i] < d) i++;
    const t = (d - L[i - 1]) / ((L[i] - L[i - 1]) || 1);
    const p = [mix(P[i - 1][0], P[i][0], t), mix(P[i - 1][1], P[i][1], t)];
    const tx = P[i][0] - P[i - 1][0], ty = P[i][1] - P[i - 1][1];
    const tl = Math.hypot(tx, ty) || 1;
    return { p, t: [tx / tl, ty / tl], n: [-ty / tl, tx / tl] };
  };
  return { total, at };
}

const angDiff = (a, b) => ((b - a + 540) % 360) - 180; // degrees, signed shortest a->b

// Run fn on a scratch canvas with ctx's transform, then composite it into ctx softened by a blur (design px).
export function withBlur(ctx, px, fn) {
  if (!(px > 0)) return fn(ctx);
  const cv = ctx.canvas;
  const off = new OffscreenCanvas(cv.width, cv.height);
  const g = off.getContext('2d');
  const m = ctx.getTransform();
  g.setTransform(m);
  const r = fn(g);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = `blur(${(px * Math.abs(m.a)).toFixed(2)}px)`;
  ctx.drawImage(off, 0, 0);
  ctx.restore();
  return r;
}

// ------------------------------------------------------------------ bamboo leaf
// One tapered bamboo leaf: narrow stalk at the base, widest at ~30 %, long needle tip.
// ang in radians, len/wid in px. bend: midrib curvature (fraction of len, + bends toward the leaf's right normal).
export function paintBambooLeaf(ctx, x, y, ang, len, wid, { color = INK, alpha = 0.95, bend = 0, peak = 0.3, tipPow = 1.15, asym = 0.12, fade = 0, stalk = 0.1, bloom = 0, bloomAt = 0.6 } = {}) {
  const n = Math.max(10, Math.round(len / 2.5));
  const dx = Math.cos(ang), dy = Math.sin(ang);
  const nx = -dy, ny = dx;
  const L = [], R = [];
  const C = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const off = bend * len * s * s;
    C.push([x + dx * len * s + nx * off, y + dy * len * s + ny * off]);
  }
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const a = C[Math.max(0, i - 1)], b = C[Math.min(n, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    let f = s < peak ? Math.pow(Math.sin((Math.PI / 2) * (s / peak)), 0.7) : Math.pow((1 - s) / (1 - peak), tipPow);
    f *= 0.14 + 0.86 * smoothstep(0, stalk + 0.04, s);
    const hw = 0.5 * wid * f;
    L.push([C[i][0] - ty * hw * (1 + asym), C[i][1] + tx * hw * (1 + asym)]);
    R.push([C[i][0] + ty * hw * (1 - asym), C[i][1] - tx * hw * (1 - asym)]);
  }
  polyFill(ctx, L, R);
  if (fade !== 0 || bloom > 0) {
    // ink thins toward the tip (fade) and in a soft wet bloom along the blade
    const g = ctx.createLinearGradient(x, y, C[n][0], C[n][1]);
    const stops = [[0, alpha * (1 - Math.max(0, fade) * 0.25)], [0.3, alpha], [1, alpha * (1 - Math.abs(fade))]];
    if (bloom > 0) {
      const b = clamp(bloomAt, 0.35, 0.85);
      stops.push([b - 0.14, alpha], [b, alpha * (1 - bloom)], [Math.min(0.99, b + 0.14), alpha * (1 - Math.abs(fade) * 0.5)]);
    }
    stops.sort((p, q) => p[0] - q[0]);
    let last = -1;
    for (const [o, a] of stops) { const oo = Math.max(o, last + 1e-4); g.addColorStop(clamp(oo, 0, 1), rgba(color, a)); last = oo; }
    ctx.fillStyle = g;
  } else ctx.fillStyle = rgba(color, alpha);
  ctx.fill();
}

// Classic painted leaf-group patterns: angles (deg, relative to the group direction) and relative lengths.
export const LEAF_GROUPS = {
  one: { a: [0], l: [1] },
  two: { a: [-14, 16], l: [1, 0.85] },                       // fish tail
  ge: { a: [-34, 0, 30], l: [0.78, 1, 0.84] },              // 个
  jie: { a: [-42, -14, 14, 40], l: [0.72, 1, 0.92, 0.7] },   // 介
  fan5: { a: [-52, -24, 0, 22, 48], l: [0.66, 0.9, 1, 0.88, 0.64] },
  fan6: { a: [-62, -38, -14, 8, 30, 54], l: [0.6, 0.8, 0.98, 1, 0.82, 0.6] },
  hang: { a: [-16, -6, 4, 14], l: [0.9, 1, 0.96, 0.82] },    // hanging bundle
  hang5: { a: [-22, -11, 0, 10, 21], l: [0.85, 0.96, 1, 0.93, 0.8] },
};

// Leaves hanging along a twig polyline from node i0 to the tip: 1-3 leaves per node on alternating
// sides (sometimes on a short twiglet), a small group at the tip.
function cascadeLeaves(pts, i0, o, rng, sprays, side) {
  let sd = rng.sign();
  const n = pts.length;
  for (let i = Math.max(1, i0); i < n; i++) {
    const isTip = i === n - 1;
    if (!isTip && rng.chance(o.skip ?? 0.12)) continue;
    const pa = pts[i - 1], pb = pts[i];
    const na = Math.atan2(pb[1] - pa[1], pb[0] - pa[0]) / D2R;
    sd = -sd;
    let at = pb;
    let d = isTip ? na + rng.range(-12, 12) : na + sd * rng.range(28, 75);
    if (!isTip && rng.chance(o.twiglets ?? 0.45)) {
      const ta = na + sd * rng.range(25, 50);
      const tl = rng.range(6, 16);
      const tp = [at[0] + Math.cos(ta * D2R) * tl, at[1] + Math.sin(ta * D2R) * tl];
      side.push([at, tp]);
      at = tp;
      d = ta + sd * rng.range(-5, 15);
    }
    if (o.rise) d += angDiff(d, -90) * rng.range(0.1, 0.35);
    else if (!rng.chance(o.upward ?? 0.12)) d += angDiff(d, 90) * (o.droop ?? 0.6) * rng.range(0.2, 0.9);
    const pats = o.patterns || (isTip ? ['ge', 'jie', 'two', 'ge'] : ['one', 'one', 'two', 'two', 'ge']);
    const tv = (o.tone ?? 0.03) + (o.layer === 2 && rng.chance(o.greyFrac ?? 0.25) ? rng.range(0.06, 0.2) : 0);
    sprays.push({ at, dir: d, len: (o.leafLen ?? 110) * rng.range(0.82, 1.12), pattern: rng.pick(pats), tone: tv, layer: o.layer, droop: o.rise ? 0.1 : o.droop ?? 0.6, width: o.leafWidth });
  }
}

// ------------------------------------------------------------------ bamboo plan
// opts:
//   culms: [{ base:[x,y], top:[x,y], width: w | [wBase, wTop], tone 0..1, bow px, nodes:[s..] | nodeY:[y..] | spacing:[a,b] px,
//             layer 0 back | 1 mid | 2 near, light: -1..1 (light band side), branches: n twigs grown from upper nodes,
//             leafLen, droop }]
//   twigs: [{ at:[x,y], dir: deg, len: px, tone, layer, groups: n leaf groups along the end, leafLen, droop 0..1, rise: bool, seg: px }]
//   sprays:[{ at:[x,y], dir: deg, len, pattern: key of LEAF_GROUPS, tone, layer }]
//   leafScale (1), leafWidth (0.125 = width/length), seed
export function planBamboo(opts = {}) {
  const rng = rngOf(opts, 'bamboo-plan');
  const nz = makeNoise('flora:bamboo:' + (opts.seed ?? 1));
  const leafScale = opts.leafScale ?? 1;
  const leafWidth = opts.leafWidth ?? 0.13;
  const plan = { culms: [], twigs: [], leaves: [], anchors: {} };

  // ---- culms
  for (const cs of opts.culms || []) {
    const wv = Array.isArray(cs.width) ? cs.width : [cs.width ?? 30, (cs.width ?? 30) * 0.8];
    const path = bowPath(cs.base, cs.top, cs.bow ?? 0, 48, cs.wobble ?? wv[0] * 0.06, nz, rng() * 100);
    const info = pathInfo(path);
    let nodes = cs.nodes;
    if (!nodes && cs.nodeY) {
      const H = cs.base[1] - cs.top[1];
      nodes = cs.nodeY.map((y) => (cs.base[1] - y) / H);
    }
    if (!nodes) {
      nodes = [];
      const sp = cs.spacing || [wv[0] * 2.6, wv[0] * 4.0];
      let d = rng.range(0.3, 1.0) * sp[0];
      while (d < info.total - 6) { nodes.push(d / info.total); d += rng.range(sp[0], sp[1]); }
    }
    nodes = nodes.filter((s) => s > 0.003 && s < 0.997).sort((a, b) => a - b);
    const layer = cs.layer ?? 2;
    plan.culms.push({ path, info, w: wv, nodes, tone: cs.tone ?? 0.05, layer, light: cs.light ?? rng.range(-0.5, -0.15), seed: rng() * 1000, nodeTone: cs.nodeTone, dry: cs.dry ?? 1, band: cs.band ?? 1 });
    const nb = cs.branches ?? 0;
    for (let k = 0; k < nb; k++) {
      const upper = nodes.filter((s) => s > (cs.branchFrom ?? 0.3));
      const s = upper.length ? rng.pick(upper) : rng.range(0.4, 0.95);
      const { p, t } = info.at(s);
      const side = rng.sign();
      const up = Math.atan2(t[1], t[0]) / D2R;
      plan.twigs.push({ at: p, dir: up + side * rng.range(30, 65), len: rng.range(70, 200) * (cs.branchScale ?? 1), tone: (cs.tone ?? 0.05) + 0.02, layer, groups: rng.int(1, 3), leafLen: cs.leafLen, droop: cs.droop ?? 0.55 });
    }
  }
  // ---- explicit twigs
  for (const tw of opts.twigs || []) plan.twigs.push({ ...tw });
  const sprays = (opts.sprays || []).slice();
  // ---- clumps: a leaf mass at `at` (radius r) fed by a twig from `from` (default: nearest culm point)
  for (const cl of opts.clumps || []) {
    const layer = cl.layer ?? 2;
    let from = cl.from;
    if (!from) {
      let best = 1e18;
      for (const c of plan.culms) {
        if (Math.abs(c.layer - layer) > 1 && plan.culms.some((q) => q.layer === layer)) continue;
        for (let i = 0; i < c.path.length; i++) {
          const q = c.path[i];
          const d = (q[0] - cl.at[0]) ** 2 + (q[1] - cl.at[1]) ** 2 + (c.layer === layer ? 0 : 1e4);
          if (d < best) { best = d; from = q; }
        }
      }
      if (!from) from = [cl.at[0] - 60, cl.at[1] + 40];
    }
    // main twig: arches out of `from`, passes through the mass and droops beyond it
    const r = cl.r ?? 60;
    const droop = cl.droop ?? 0.6;
    const dx = cl.at[0] - from[0], dy = cl.at[1] - from[1];
    const L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L;
    const reach = r * (cl.reach ?? 0.9);
    const endP = cl.rise
      ? [cl.at[0] + ux * reach, cl.at[1] + uy * reach - r * 0.35]
      : [cl.at[0] + ux * reach * (1 - 0.4 * droop), cl.at[1] + uy * reach + r * 0.7 * droop];
    const ctrl = [mix(from[0], cl.at[0], 0.55), mix(from[1], cl.at[1], 0.55) - L * (cl.arch ?? 0.12)];
    const total = L + reach;
    const nseg = Math.max(3, Math.round(total / rng.range(20, 27)));
    const pts = [];
    for (let i = 0; i <= nseg; i++) {
      const s = i / nseg;
      // quadratic from -> ctrl -> at for s < sAt, then at -> endP
      const sAt = L / total;
      let q;
      if (s <= sAt) { const t = s / sAt; q = [mix(mix(from[0], ctrl[0], t), mix(ctrl[0], cl.at[0], t), t), mix(mix(from[1], ctrl[1], t), mix(ctrl[1], cl.at[1], t), t)]; }
      else { const t = (s - sAt) / (1 - sAt); const tt = t * t; q = [mix(cl.at[0], endP[0], t), mix(cl.at[1], endP[1], cl.rise ? t : tt * 0.6 + t * 0.4)]; }
      if (i > 0 && i < nseg) { q[0] += rng.range(-2.2, 2.2); q[1] += rng.range(-2.2, 2.2); }
      pts.push(q);
    }
    const side = [];
    const base = { leafLen: cl.leafLen ?? 115, tone: cl.tone ?? 0.03, layer, droop, rise: cl.rise, upward: cl.upward, leafWidth: cl.leafWidth, twiglets: cl.twiglets ?? 0.45, patterns: cl.patterns };
    // leaves cascade along the part of the twig inside / beyond the mass
    let i0 = pts.length - 1;
    for (let i = 0; i < pts.length; i++) if (Math.hypot(pts[i][0] - cl.at[0], pts[i][1] - cl.at[1]) < r * (cl.spread ?? 1.0)) { i0 = i; break; }
    cascadeLeaves(pts, i0, base, rng, sprays, side);
    // a big mass gets one or two sub-twigs of its own
    const subs = cl.subTwigs ?? (r >= 65 ? rng.int(1, 2) : 0);
    for (let k = 0; k < subs; k++) {
      const si = clamp(Math.round(mix(i0 * 0.7, pts.length - 3, rng.range(0.1, 0.6))), 1, pts.length - 2);
      const a0 = Math.atan2(pts[si + 1][1] - pts[si][1], pts[si + 1][0] - pts[si][0]) / D2R + rng.sign() * rng.range(25, 50);
      const sl = r * rng.range(0.7, 1.1);
      const sp = [pts[si].slice()];
      let a = a0, p = pts[si].slice();
      const ns = Math.max(2, Math.round(sl / 22));
      for (let j = 0; j < ns; j++) {
        a += cl.rise ? rng.range(-8, 8) : angDiff(a, 90) * droop * 0.12 + rng.range(-8, 8);
        p = [p[0] + Math.cos(a * D2R) * sl / ns, p[1] + Math.sin(a * D2R) * sl / ns];
        sp.push(p.slice());
      }
      cascadeLeaves(sp, 1, base, rng, sprays, side);
      plan.twigs.push({ fixed: true, pts: sp, side: [], tone: base.tone, layer, width: cl.twigWidth && cl.twigWidth * 0.8 });
    }
    plan.twigs.push({ fixed: true, pts, side, tone: base.tone, layer, width: cl.twigWidth });
  }
  // ---- expand twigs into polylines + leaf groups
  for (const tw of plan.twigs) {
    if (tw.fixed) { tw.width = tw.width ?? (tw.layer === 2 ? 2.6 : tw.layer === 1 ? 2.0 : 1.6); continue; }
    const segL = tw.seg ?? rng.range(22, 34);
    const segs = Math.max(2, Math.round(tw.len / segL));
    let a = (tw.dir ?? 0);
    let p = tw.at.slice();
    const pts = [p.slice()];
    const zig = tw.zig ?? 10;
    const sag = tw.sag ?? 0.04; // per segment, toward gravity, scaled by horizontality
    let side = rng.sign();
    // leaves gather toward the twig end: groups on every `every`-th node over the distal `leafy` part
    const every = tw.every ?? 1;
    const leafy = tw.leafy ?? 0.45;
    const groups = tw.groups === undefined || tw.groups === 'all' ? Math.max(1, Math.ceil((segs * leafy) / every)) : tw.groups;
    const droop = tw.droop ?? 0.55;
    const nodesOut = [];
    for (let i = 0; i < segs; i++) {
      const l = (tw.len / segs) * rng.range(0.75, 1.25);
      a += side * zig * rng.range(0.4, 1.1);
      a += angDiff(a, 90) * sag * Math.abs(Math.cos(a * D2R));
      side = -side;
      p = [p[0] + Math.cos(a * D2R) * l, p[1] + Math.sin(a * D2R) * l];
      pts.push(p.slice());
      nodesOut.push({ p: p.slice(), a, side });
    }
    // groups at the tip and at every n-th node back from it; side groups sit on short twiglets
    const side2 = [];
    for (let g = 0; g < groups; g++) {
      const idx = segs - 1 - g * every - (g > 0 && every > 1 && rng.chance(0.35) ? 1 : 0);
      if (idx < 0) break;
      if (g > 0 && rng.chance(tw.skip ?? 0.15)) continue;
      const nd = nodesOut[idx];
      const isTip = g === 0;
      let at = nd.p;
      let d = isTip ? nd.a + rng.range(-10, 10) : nd.a + nd.side * rng.range(30, 65);
      if (!isTip && (tw.twiglets ?? 0.8) > rng()) {
        const ta = nd.a + nd.side * rng.range(25, 55);
        const tl = rng.range(8, 22) * (tw.layer === 2 ? 1 : 0.8);
        const tp = [at[0] + Math.cos(ta * D2R) * tl, at[1] + Math.sin(ta * D2R) * tl];
        side2.push([at, tp]);
        at = tp;
        d = ta + rng.range(-10, 15) * nd.side;
      }
      if (tw.rise) d = isTip ? nd.a + rng.range(-15, 5) : d + angDiff(d, -90) * 0.25;
      else if (!rng.chance(tw.upward ?? 0.18)) d += angDiff(d, 90) * droop * rng.range(0.3, 1.05);
      else d = nd.a + nd.side * rng.range(-20, 35) - 25 * Math.sign(Math.cos(nd.a * D2R) || 1); // a few groups lift up and out
      const pats = tw.patterns || (tw.rise ? (isTip ? ['ge', 'jie', 'fan5'] : ['two', 'ge']) : isTip ? ['jie', 'fan5', 'ge', 'hang5', 'fan6'] : ['ge', 'two', 'jie', 'hang', 'hang5']);
      sprays.push({ at, dir: d, len: (tw.leafLen ?? 92) * rng.range(0.85, 1.12), pattern: rng.pick(pats), tone: tw.tone, layer: tw.layer, droop: tw.rise ? 0.1 : droop, width: tw.leafWidth });
    }
    tw.side = side2;
    tw.pts = pts;
    tw.width = tw.width ?? (tw.layer === 2 ? 2.6 : tw.layer === 1 ? 2.0 : 1.6);
  }
  // ---- sprays into leaves
  for (const sp of sprays) {
    const pat = LEAF_GROUPS[sp.pattern] || LEAF_GROUPS.jie;
    const mirror = rng.chance(0.5) ? -1 : 1;
    const len0 = (sp.len ?? 92) * leafScale;
    const wid0 = sp.width ?? len0 * leafWidth;
    const dir = sp.dir ?? 90;
    const n = pat.a.length;
    const order = Array.from({ length: n }, (_, i) => i).sort(() => 0); // keep order
    for (const i of order) {
      const a = (dir + mirror * pat.a[i] * rng.range(0.8, 1.2) + rng.range(-6, 6)) * D2R;
      const len = len0 * pat.l[i] * rng.range(0.86, 1.1);
      const back = rng.range(0, 6);
      const bx = sp.at[0] - Math.cos(dir * D2R) * back + rng.range(-1.5, 1.5);
      const by = sp.at[1] - Math.sin(dir * D2R) * back + rng.range(-1.5, 1.5);
      const droop = sp.droop ?? 0.3;
      // long leaves sag toward gravity: bend toward "down" side of the leaf
      const downSide = Math.cos(a) >= 0 ? 1 : -1;
      const bend = downSide * droop * rng.range(0.03, 0.15) + rng.range(-0.035, 0.035);
      plan.leaves.push({ x: bx, y: by, ang: a, len, wid: wid0 * rng.range(0.85, 1.15) * Math.pow(pat.l[i], 0.4), bend, tone: (sp.tone ?? 0.04) + rng.range(-0.02, 0.05), layer: sp.layer ?? 2, peak: rng.range(0.26, 0.4), tipPow: rng.range(1.0, 1.3), asym: rng.range(-0.18, 0.18), fade: rng.range(-0.1, 0.35), bloom: rng.chance(0.45) ? rng.range(0.12, 0.4) : 0, bloomAt: rng.range(0.4, 0.8) });
    }
  }
  // ---- anchors
  let ax = 0, ay = -1e9, minY = 1e9, minX = 1e9, maxX = -1e9;
  for (const c of plan.culms) { const b = c.path[0]; ay = Math.max(ay, b[1]); ax += b[0]; for (const q of c.path) { minY = Math.min(minY, q[1]); minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]); } }
  if (plan.culms.length) ax /= plan.culms.length;
  else if (plan.twigs.length) { ax = plan.twigs[0].at[0]; ay = plan.twigs[0].at[1]; }
  for (const l of plan.leaves) { minY = Math.min(minY, l.y - l.len); minX = Math.min(minX, l.x - l.len); maxX = Math.max(maxX, l.x + l.len); }
  plan.anchors = { sway: [ax, ay], radius: Math.max(200, ay - minY), bounds: [minX, minY, maxX, ay], culmBases: plan.culms.map((c) => c.path[0]), culmTops: plan.culms.map((c) => c.path[c.path.length - 1]) };
  return plan;
}

// ------------------------------------------------------------------ bamboo painters
// One culm, rasterised per pixel in the culm's own frame (u across, v along): dark wet edges, a lighter
// dry band that wanders, ink pooled at the node ends of every internode, fibre streaks along the stroke,
// paper flecks (flying white) in the dry band. Node rims are brushed on top as paths.
function paintCulm(ctx, c, paper) {
  const rng = makeRng('flora:culm:' + c.seed);
  const nz = makeNoise('flora:culmn:' + c.seed);
  const tr = ctx.getTransform();
  const kx = tr.a, ky = tr.d, ex = tr.e, fy = tr.f;
  const P = c.path, info = c.info, total = info.total;
  const wMax = Math.max(c.w[0], c.w[1]);
  const pad = wMax * 0.7 + 4;
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (const q of P) { minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]); minY = Math.min(minY, q[1]); maxY = Math.max(maxY, q[1]); }
  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  const dx0 = clamp(Math.floor(kx * (minX - pad) + ex), 0, cw), dx1 = clamp(Math.ceil(kx * (maxX + pad) + ex), 0, cw);
  const dy0 = clamp(Math.floor(ky * minY + fy), 0, ch), dy1 = clamp(Math.ceil(ky * maxY + fy), 0, ch);
  const Wd = dx1 - dx0, Hd = dy1 - dy0;
  if (Wd > 0 && Hd > 0) {
    const img = new ImageData(Wd, Hd);
    const D = img.data;
    // arc length at each path vertex
    const AL = [0];
    for (let i = 1; i < P.length; i++) AL.push(AL[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const nodesPx = [0, ...c.nodes.map((s) => s * total), total];
    const near = c.layer === 2;
    const contrast = near ? 1 : c.layer === 1 ? 0.75 : 0.55;
    const tone0 = c.tone;
    const pr = paper || PAPER;
    const inkC = INK;
    const dry = c.dry * (near ? 1 : 0.35);
    let seg = 1;
    for (let py = 0; py < Hd; py++) {
      const y = (dy0 + py + 0.5 - fy) / ky;
      // centreline crossing this row (path runs base (bottom) -> top, y decreasing)
      let i = 1;
      while (i < P.length - 1 && P[i][1] > y) i++;
      const a = P[i - 1], b = P[i];
      const dyAB = a[1] - b[1];
      if (dyAB <= 0) continue;
      let t = (a[1] - y) / dyAB;
      if (t < 0 || t > 1) { if ((i === 1 && t < 0) || (i === P.length - 1 && t > 1)) continue; t = clamp(t, 0, 1); }
      const xc = mix(a[0], b[0], t);
      const segL = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const tx = (b[0] - a[0]) / segL, ty = (b[1] - a[1]) / segL; // tangent (up)
      const vRow = AL[i - 1] + t * segL; // arc length at centre
      const s = vRow / total;
      const hw0 = (mix(c.w[0], c.w[1], s) / 2) * (1 + 0.03 * nz.n2(vRow * 0.006, 1.7));
      const ragL = 0.05 * nz.n2(vRow * 0.02, 11.3) + 0.012 * nz.n2(vRow * 0.12, 5.1);
      const ragR = 0.05 * nz.n2(vRow * 0.02, 23.9) + 0.012 * nz.n2(vRow * 0.12, 8.7);
      const lbu = c.light + 0.2 * nz.n2(vRow * 0.004, 3.1);
      const bStr = clamp(0.6 + 0.6 * nz.n2(vRow * 0.005, 17.3), 0.05, 1) * c.band;   // how dry the band is here
      const bSig = 0.36 + 0.13 * nz.n2(vRow * 0.006, 29.1);
      const xL = Math.floor(kx * (xc - hw0 / Math.max(0.3, -ty) - 3) + ex) - dx0;
      const xR = Math.ceil(kx * (xc + hw0 / Math.max(0.3, -ty) + 3) + ex) - dx0;
      const aa = 1.4 / (hw0 * kx); // soft, slightly wet edge (in u units)
      for (let px = Math.max(0, xL); px < Math.min(Wd, xR); px++) {
        const x = (dx0 + px + 0.5 - ex) / kx;
        const dxp = x - xc;
        const uPx = dxp * -ty;              // across (normal = (-ty, tx))
        const v = vRow + dxp * tx;           // along, corrected for tilt
        const u = uPx / hw0;
        const au = Math.abs(u) + (u < 0 ? ragL : ragR);
        const cov = clamp((1 - au) / aa + 0.5, 0, 1);
        if (cov <= 0) continue;
        // internode
        while (seg < nodesPx.length - 1 && v > nodesPx[seg]) seg++;
        while (seg > 1 && v < nodesPx[seg - 1]) seg--;
        const n0 = nodesPx[seg - 1], n1 = nodesPx[seg];
        const d0 = v - n0, d1 = n1 - v;
        const w = hw0 * 2;
        const pjit = 1 + 0.35 * nz.n2(uPx * 0.08 + 41.0, n0 * 0.01);
        const pool = (seg > 1 ? 1.0 * Math.exp(-d0 / (0.75 * w * pjit)) : 0) + (seg < nodesPx.length - 1 ? 0.75 * Math.exp(-d1 / (0.5 * w * pjit)) : 0);
        const mid = clamp(Math.min(d0, d1) / (0.9 * w), 0, 1);
        const edge = smoothstep(0.45, 1.0, Math.abs(u));
        const bx = Math.abs(u - lbu) / bSig;
        const band = Math.exp(-Math.pow(bx, 1.6));
        // wet blotches (soft, stretched along the stroke) + faint fibre
        const mott = nz.n2(uPx * 0.04 + 7.7, v * 0.009) * 0.6 + nz.n2(uPx * 0.1 + 2.3, v * 0.024) * 0.4;
        const fib = nz.n2(uPx * 0.3 + 13.7, v * 0.01);
        let dens = 0.76 + 0.24 * edge - 0.8 * bStr * band * (1 - 0.75 * edge) + 1.05 * pool + 0.3 * mott + 0.04 * fib;
        dens = clamp(dens, 0, 1);
        // flying white in the dry band, strongest mid-internode, strung along fibre lines
        let alpha = cov * (near ? 0.97 : 0.9);
        if (dry > 0) {
          const sp1 = nz.n2(uPx * 0.7 + 51.3, v * 0.15) * 0.6 + nz.n2(uPx * 1.9 + 9.1, v * 0.42) * 0.4;
          const lane = Math.exp(-Math.pow((u - lbu + 0.25 * bSig / 0.36) / 0.2, 2));
          const thr = 0.72 - 0.62 * lane * bStr * mid * dry + 0.6 * pool;
          if (sp1 > thr) alpha *= 1 - smoothstep(thr, thr + 0.07, sp1) * 0.96;
        }
        const vt = tone0 + (1 - tone0) * (1 - dens) * 0.72 * contrast + (1 - contrast) * (1 - tone0) * 0.15;
        const k4 = (py * Wd + px) * 4;
        D[k4] = inkC[0] + (pr[0] - inkC[0]) * vt;
        D[k4 + 1] = inkC[1] + (pr[1] - inkC[1]) * vt;
        D[k4 + 2] = inkC[2] + (pr[2] - inkC[2]) * vt;
        D[k4 + 3] = alpha * 255;
      }
    }
    const off = new OffscreenCanvas(Wd, Hd);
    off.getContext('2d').putImageData(img, 0, 0);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(off, dx0, dy0);
    ctx.restore();
  }
  // ---- nodes
  const gapPx = Math.max(0.9, wMax * 0.03);
  for (const s of c.nodes) paintNode(ctx, c, s, mix(c.w[0], c.w[1], s), gapPx, paper, rng);
}

function paintNode(ctx, c, s, w, gapPx, paper, rng) {
  const { p, t, n: nn } = c.info.at(s);
  const hw = w / 2;
  const nodeCol = col(c.nodeTone ?? Math.max(0, c.tone - 0.1), paper);
  const flare = Math.max(1.4, w * rng.range(0.09, 0.13));
  const sag = w * rng.range(0.02, 0.07) * (rng.chance(0.8) ? 1 : -1);
  const tilt = rng.range(-0.04, 0.04) * w;
  const P = (u, v) => [p[0] + nn[0] * u + t[0] * v, p[1] + nn[1] * u + t[1] * v];
  const arc = (u) => sag * (1 - Math.min(1.4, (u / hw) * (u / hw))) + tilt * (u / hw);
  const J = () => rng.range(-0.5, 0.5);
  const steps = 12;
  const g = gapPx * 0.5;
  // upper rim: bottom end of the internode above, flaring into pointed ears (little horns)
  const hU = Math.max(2, w * rng.range(0.12, 0.17));
  const earR = w * rng.range(0.16, 0.3), earL = w * rng.range(0.16, 0.3);
  const flR = flare * rng.range(0.9, 1.4), flL = flare * rng.range(0.9, 1.4);
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) { const u = mix(-hw - flL * 0.75, hw + flR * 0.75, i / steps); const q = P(u, g - arc(u) + J() * 0.3); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }
  ctx.quadraticCurveTo(...P(hw + flR * 1.6, g + earR * 0.35), ...P(hw + flR * 1.25, g + earR));          // right horn tip
  ctx.quadraticCurveTo(...P(hw + flR * 0.35, g + earR * 0.6), ...P(hw * 0.97, g + earR * 0.42));
  for (let i = 1; i < 7; i++) { const u = mix(hw * 0.97, -hw * 0.97, i / 7); ctx.lineTo(...P(u, g + hU * (1.0 + 0.3 * Math.sin(i * 1.3 + c.seed)) - arc(u) * 0.6)); }
  ctx.lineTo(...P(-hw * 0.97, g + earL * 0.42));
  ctx.quadraticCurveTo(...P(-hw - flL * 0.35, g + earL * 0.6), ...P(-hw - flL * 1.25, g + earL));       // left horn tip
  ctx.quadraticCurveTo(...P(-hw - flL * 1.6, g + earL * 0.35), ...P(-hw - flL * 0.75, g - arc(-hw - flL * 0.75)));
  ctx.closePath();
  ctx.fillStyle = rgba(nodeCol, 0.97);
  ctx.fill();
  // lower rim: top end of the internode below, a collar with rounded lobes
  const hL = Math.max(2, w * rng.range(0.1, 0.15));
  const lbR = flare * rng.range(1.0, 1.5), lbL = flare * rng.range(1.0, 1.5);
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) { const u = mix(-hw - lbL * 0.8, hw + lbR * 0.8, i / steps); const q = P(u, -g - arc(u) + J() * 0.3); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }
  ctx.bezierCurveTo(...P(hw + lbR * 1.7, -g - hL * 0.15), ...P(hw + lbR * 1.5, -g - hL * 1.15), ...P(hw * 0.92, -g - hL * 1.05));
  for (let i = 1; i < 7; i++) { const u = mix(hw * 0.92, -hw * 0.92, i / 7); ctx.lineTo(...P(u, -g - hL * (0.85 + 0.3 * Math.sin(i * 1.7 + c.seed * 2)) - arc(u) * 0.6)); }
  ctx.lineTo(...P(-hw * 0.92, -g - hL * 1.05));
  ctx.bezierCurveTo(...P(-hw - lbL * 1.5, -g - hL * 1.15), ...P(-hw - lbL * 1.7, -g - hL * 0.15), ...P(-hw - lbL * 0.8, -g - arc(-hw - lbL * 0.8)));
  ctx.closePath();
  ctx.fillStyle = rgba(nodeCol, 0.95);
  ctx.fill();
  // thin paper line between the rims, wavy and slightly broken
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineCap = 'round';
  const segN = Math.max(6, Math.round(w / 5));
  const lw = Math.max(0.8, w * 0.03);
  for (let i = 0; i < segN; i++) {
    if (rng.chance(0.1)) continue;
    const u0 = mix(-hw - flare * 0.3, hw + flare * 0.3, i / segN), u1 = mix(-hw - flare * 0.3, hw + flare * 0.3, (i + 1) / segN);
    const qa = P(u0, -arc(u0) + rng.range(-0.25, 0.25) * lw), qb = P(u1, -arc(u1) + rng.range(-0.25, 0.25) * lw);
    ctx.strokeStyle = `rgba(0,0,0,${rng.range(0.7, 1).toFixed(3)})`;
    ctx.lineWidth = lw * rng.range(0.7, 1.3);
    ctx.beginPath(); ctx.moveTo(qa[0], qa[1]); ctx.lineTo(qb[0], qb[1]); ctx.stroke();
  }
  ctx.restore();
}

function paintTwig(ctx, tw, paper, rng) {
  const c = col(tw.tone + 0.02, paper);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // each internode its own slightly tapering stroke, knots at the joints
  for (let i = 0; i < tw.pts.length - 1; i++) {
    const a = tw.pts[i], b = tw.pts[i + 1];
    const w = tw.width * mix(1.15, 0.55, i / Math.max(1, tw.pts.length - 2));
    const ll = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, bo = rng.range(-0.07, 0.07) * ll;
    stroke(ctx, [a, [mix(a[0], b[0], 0.5) - (b[1] - a[1]) / ll * bo, mix(a[1], b[1], 0.5) + (b[0] - a[0]) / ll * bo], b], { width: [w, w * 0.8], profile: 'even', color: c, alpha: 0.95, rough: 0.12, rng, step: 2 });
    if (i > 0) {
      ctx.beginPath();
      ctx.ellipse(a[0], a[1], w * 0.95, w * 0.62, rng() * 3, 0, TAU);
      ctx.fillStyle = rgba(c, 0.9);
      ctx.fill();
    }
  }
  for (const [a, b] of tw.side || []) {
    const w = tw.width * 0.6;
    stroke(ctx, [a, b], { width: [w, w * 0.7], profile: 'even', color: c, alpha: 0.9, rough: 0.1, rng, step: 2 });
  }
}

// Paint culms of the given layers (default all) back to front.
export function paintBambooCulms(ctx, plan, { layers = null, paper = PAPER } = {}) {
  const sel = (L) => !layers || layers.includes(L);
  const cs = plan.culms.filter((c) => sel(c.layer)).sort((a, b) => a.layer - b.layer || b.tone - a.tone);
  for (const c of cs) paintCulm(ctx, c, paper);
}

// Paint twigs + leaves of the given layers (default all) back to front.
export function paintBambooLeaves(ctx, plan, { layers = null, paper = PAPER, twigs = true } = {}) {
  const rng = makeRng('flora:leafpaint');
  const sel = (L) => !layers || layers.includes(L);
  for (const L of [0, 1, 2].filter(sel)) {
    if (twigs) for (const tw of plan.twigs) if (tw.layer === L) paintTwig(ctx, tw, paper, rng);
    for (const lf of plan.leaves) {
      if (lf.layer !== L) continue;
      paintBambooLeaf(ctx, lf.x, lf.y, lf.ang, lf.len, lf.wid, { color: col(lf.tone, paper), alpha: L === 2 ? 0.96 : 0.85, bend: lf.bend, peak: lf.peak, tipPow: lf.tipPow, asym: lf.asym, fade: lf.fade, bloom: lf.bloom, bloomAt: lf.bloomAt });
    }
  }
}

// Whole grove into one context (back to front: far, mid, near).
export function paintBamboo(ctx, opts = {}) {
  const plan = opts.plan || planBamboo(opts);
  for (const L of [0, 1, 2]) {
    paintBambooCulms(ctx, plan, { layers: [L], paper: opts.paper });
    paintBambooLeaves(ctx, plan, { layers: [L], paper: opts.paper });
  }
  return plan;
}

// Bake a grove into three texture sources: back (layers 0+1, culms+leaves), culms (near), leaves (near).
export function makeBamboo(api, opts = {}) {
  const plan = opts.plan || planBamboo(opts);
  const rect = opts.rect || [0, 0, api.W, api.H];
  const [rx, ry, rw, rh] = rect;
  const scale = opts.scale ?? 1;
  const paper = opts.paper || PAPER;
  const ink = opts.ink === undefined ? { edge: 0.35, granulation: 0.16, bleed: 0.9 } : opts.ink;
  const bake = (fn, inkOpts = ink) => {
    const raw = api.bakeCanvas(rw, rh, (ctx) => { ctx.translate(-rx, -ry); fn(ctx); }, { scale });
    if (!inkOpts) return raw;
    const out = inkify(api, raw, inkOpts);
    if (api.engine && api.engine.freeTex) api.engine.freeTex(raw);
    return out;
  };
  const soft = opts.backBlur ?? [1.6, 0.8];
  const back = bake((ctx) => {
    withBlur(ctx, soft[0], (g) => { paintBambooCulms(g, plan, { layers: [0], paper }); paintBambooLeaves(g, plan, { layers: [0], paper }); });
    withBlur(ctx, soft[1], (g) => { paintBambooCulms(g, plan, { layers: [1], paper }); paintBambooLeaves(g, plan, { layers: [1], paper }); });
  }, ink && { ...ink, bleed: (ink.bleed ?? 1) * 1.3 });
  const culms = bake((ctx) => paintBambooCulms(ctx, plan, { layers: [2], paper }));
  const leaves = bake((ctx) => paintBambooLeaves(ctx, plan, { layers: [2], paper }), ink && { ...ink, bleed: (ink.bleed ?? 1) * 0.6, granulation: (ink.granulation ?? 0.2) * 0.35 });
  const anchor = plan.anchors.sway, radius = plan.anchors.radius;
  const layers = ({ z = 1, amp = 4, freq = 0.22, scale: sc = 520, opacity = 1 } = {}) => [
    api.tex(back, { rect, z: z * 1.02, opacity, name: 'bamboo-back', sway: { amp: amp * 0.7, freq: freq * 0.9, scale: sc, power: 1.7, anchor, radius } }),
    api.tex(culms, { rect, z, opacity, name: 'bamboo-culms', sway: { amp: amp * 0.75, freq, scale: sc, power: 1.8, anchor, radius } }),
    api.tex(leaves, { rect, z, opacity, name: 'bamboo-leaves', sway: { amp: amp * 1.15, freq: freq * 1.15, scale: sc * 0.7, power: 1.5, anchor, radius } }),
  ];
  return { back, culms, leaves, rect, plan, anchor, radius, layers };
}

// ================================================================== red maples
export const MAPLE_PALETTES = {
  vermilion: { bright: [198, 56, 38], mid: [176, 44, 31], dark: [128, 30, 22], pale: [214, 136, 116] },
  autumn: { bright: [190, 52, 36], mid: [160, 40, 28], dark: [112, 27, 20], pale: [206, 126, 106] },
  golden: { bright: [206, 92, 46], mid: [190, 74, 38], dark: [140, 54, 30], pale: [224, 160, 122] },
  night: { bright: [162, 62, 48], mid: [142, 52, 40], dark: [100, 38, 30], pale: [182, 132, 116] },
};
const mixC = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

// A single painted maple dab: a blot of 3-5 rounded lobes around a small core (reads as a maple
// leaf / leaf cluster at small sizes). One fill, so alpha stays even inside the dab.
export function paintMapleDab(ctx, x, y, r, { color = MAPLE_PALETTES.vermilion.mid, alpha = 0.9, rot = 0, lobes = 5, rng = Math.random, squash = 0.85 } = {}) {
  // outline r(θ) = core + lobes (pointed, uneven), smoothed through midpoints
  const nl = lobes;
  const amp = [];
  for (let i = 0; i < nl; i++) amp.push(rng() < 0.15 ? 0.3 : 0.55 + rng() * 0.5);
  const core = 0.5 + rng() * 0.14;
  const N = 28;
  const P = [];
  for (let k = 0; k < N; k++) {
    const th = (k / N) * TAU;
    const u = (th / TAU) * nl;
    const li = Math.floor(u + 0.5) % nl;
    const f = Math.cos((u - Math.round(u)) * Math.PI);           // 1 at lobe centre, 0 between lobes
    const lobe = Math.pow(Math.max(0, f), 0.9) * amp[li];
    const rr = r * (core + (1 - core) * lobe) * (1 + (rng() - 0.5) * 0.16);
    const a = th + rot;
    P.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * squash]);
  }
  ctx.beginPath();
  const m = (i) => { const a = P[i % N], b = P[(i + 1) % N]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
  const s0 = m(N - 1);
  ctx.moveTo(s0[0], s0[1]);
  for (let i = 0; i < N; i++) { const e = m(i); ctx.quadraticCurveTo(P[i][0], P[i][1], e[0], e[1]); }
  ctx.closePath();
  ctx.fillStyle = typeof color === 'string' ? color : rgba(color, alpha);
  ctx.fill();
}

// A clean five-pointed maple leaf silhouette (for big falling leaves). size = tip-to-tip radius px.
export function paintMapleLeaf(ctx, x, y, size, { rot = 0, color = MAPLE_PALETTES.vermilion.bright, alpha = 0.95, rng = Math.random, stem = true, curl = 0 } = {}) {
  const pts = [];
  const lobes = [[-90, 1.0], [-38, 0.9], [18, 0.62], [162, 0.62], [218, 0.9]]; // angles from "up", relative lengths
  // build outline: tip of each lobe with two shoulder teeth, valleys between lobes
  const order = [[-90, 1], [-38, 0.9], [14, 0.6], [166, 0.6], [218, 0.9]].sort((a, b) => a[0] - b[0]);
  const P = (ang, rr) => { const a = (ang + rot) * D2R; return [x + Math.cos(a) * rr * size, y + Math.sin(a) * rr * size * (1 - curl * 0.3)]; };
  for (let i = 0; i < order.length; i++) {
    const [a, l] = order[i];
    const [an] = order[(i + 1) % order.length];
    const nextA = an + (i === order.length - 1 ? 360 : 0);
    pts.push(P(a - 9, l * 0.62), P(a - 13, l * 0.7), P(a - 4, l * 0.8), P(a, l), P(a + 4, l * 0.8), P(a + 13, l * 0.7), P(a + 9, l * 0.62));
    const va = (a + nextA) / 2;
    pts.push(P(va, (nextA - a) > 100 ? 0.18 : 0.34));
  }
  ctx.beginPath();
  const m = (i) => { const a = pts[i % pts.length], b = pts[(i + 1) % pts.length]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
  let s0 = m(pts.length - 1);
  ctx.moveTo(s0[0], s0[1]);
  for (let i = 0; i < pts.length; i++) { const e = m(i); ctx.quadraticCurveTo(pts[i][0] + (rng() - 0.5) * size * 0.03, pts[i][1] + (rng() - 0.5) * size * 0.03, e[0], e[1]); }
  ctx.closePath();
  ctx.fillStyle = typeof color === 'string' ? color : rgba(color, alpha);
  ctx.fill();
  if (stem) {
    const a = (90 + rot) * D2R;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * size * 0.55, y + Math.sin(a) * size * 0.55);
    ctx.strokeStyle = typeof color === 'string' ? color : rgba(mixC(color, INK, 0.25), alpha);
    ctx.lineWidth = Math.max(0.6, size * 0.05); ctx.lineCap = 'round'; ctx.stroke();
  }
}

// distance from p along angle a to the boundary of ellipse (cx,cy,rx,ry); 0 if outside/behind
function rayEllipse(p, a, cx, cy, rx, ry) {
  const dx = Math.cos(a) / rx, dy = Math.sin(a) / ry;
  const ox = (p[0] - cx) / rx, oy = (p[1] - cy) / ry;
  const A = dx * dx + dy * dy, B = 2 * (ox * dx + oy * dy), C = ox * ox + oy * oy - 1;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return 0;
  const t = (-B + Math.sqrt(disc)) / (2 * A);
  return Math.max(0, t);
}

// Branch skeleton of a small deciduous tree. Returns { segs:[{pts,w0,w1,depth}], tips:[{p,a,depth}], crown }
export function planMaple(opts = {}) {
  const rng = rngOf(opts, 'maple-plan');
  const H = opts.height ?? 160;
  const Wc = opts.width ?? H * 1.1;
  const x = opts.x ?? 0, y = opts.y ?? 0;
  const lean = (opts.lean ?? 0) * D2R;
  const shape = opts.shape ?? 'round';
  const maxDepth = opts.depth ?? (H > 250 ? 6 : H > 110 ? 5 : H > 50 ? 4 : 3);
  const trunkW = opts.trunk ?? Math.max(2, H * 0.055);
  // crown ellipse
  let cx = x + Math.sin(lean) * H * 0.5, cy = y - H * 0.56, rx = Wc / 2, ry = H * 0.44;
  if (shape === 'spread') { ry = H * 0.32; cy = y - H * 0.66; rx = Wc * 0.6; }
  if (shape === 'cascade') { const s = (Math.sign(opts.dir ?? Math.sin(lean)) || 1); cx = x + s * Wc * 0.42; cy = y - H * 0.42; rx = Wc * 0.55; ry = H * 0.38; }
  if (shape === 'bush') { cy = y - H * 0.5; ry = H * 0.5; rx = Wc / 2; }
  if (opts.crown) [cx, cy, rx, ry] = opts.crown;
  const segs = [], tips = [];
  const kink = (opts.kink ?? 20) * D2R;
  const target = () => { const a = rng() * TAU, d = Math.sqrt(rng()); return [cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d * 0.9 - ry * 0.1]; };
  function branch(p, ang, len, w, depth) {
    // crooked limb: bends at every bud, a few px apart on twigs, longer runs on old wood
    const n = clamp(Math.round(len / (depth <= 1 ? 26 : 14)), 2, 9);
    let a = ang, q = p.slice();
    const pts = [p.slice()];
    for (let i = 0; i < n; i++) {
      a += rng.range(-1, 1) * kink * (depth === 0 ? 0.45 : 1) * (i === 0 ? 0.5 : 1) * (1.5 / Math.sqrt(n));
      const l = (len / n) * rng.range(0.75, 1.25);
      q = [q[0] + Math.cos(a) * l, q[1] + Math.sin(a) * l];
      pts.push(q.slice());
    }
    segs.push({ pts, w0: w, w1: w * 0.78, depth });
    if (depth >= maxDepth || len < (opts.minLen ?? 8)) { tips.push({ p: q, a, depth }); return; }
    // explicit first fork: limbs [[angleDeg (0 = right, -90 = up), length px, width fraction], ...]
    if (depth === 0 && opts.limbs) {
      for (const [la, ll, lw] of opts.limbs) branch(q, la * D2R, ll, w * (lw ?? 0.6), 1);
      return;
    }
    const spread = (opts.spread ?? 34) * D2R * (depth === 0 ? 1.5 : 1);
    // steer a child so it stays inside the crown ellipse; returns [angle, length]
    const steer = (from, ca, cl) => {
      const room = rayEllipse(from, ca, cx, cy, rx, ry);
      if (room < cl) {
        const ta = Math.atan2(cy - from[1], cx - from[0]);
        let dd = ta - ca; while (dd > Math.PI) dd -= TAU; while (dd < -Math.PI) dd += TAU;
        ca += dd * (opts.crownPull ?? 0.4);
        cl = Math.max(cl * 0.55, Math.min(cl, rayEllipse(from, ca, cx, cy, rx, ry) * 0.9));
      }
      return [ca, cl];
    };
    // side shoots along the limb fill the crown interior
    if (depth >= 1) {
      let sd = rng.sign();
      for (let i = 1; i < pts.length - 1; i++) {
        if (!rng.chance(opts.sideShoots ?? (depth <= 2 ? 0.28 : 0.16))) continue;
        const ai = Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]);
        const [ca, cl] = steer(pts[i], ai + sd * rng.range(0.6, 1.1), len * rng.range(0.38, 0.6));
        sd = -sd;
        branch(pts[i], ca, cl, Math.max(0.7, w * rng.range(0.24, 0.34)), depth + 1);
      }
    }
    const kids = depth === 0 ? rng.int(3, 4) : rng.chance(0.15) ? 3 : 2;
    let side = rng.sign();
    for (let k = 0; k < kids; k++) {
      const leader = k === 0;
      let ca0 = leader ? a + rng.range(-0.3, 0.3) : a + side * spread * rng.range(0.7, 1.4);
      if (!leader) side = -side;
      const [ca, cl] = steer(q, ca0, len * (leader ? rng.range(0.66, 0.82) : rng.range(0.5, 0.7)));
      branch(q, ca, Math.max(opts.minLen ?? 8, cl), Math.max(0.7, w * 0.78 * (leader ? rng.range(0.66, 0.76) : rng.range(0.42, 0.55))), depth + 1);
    }
  }
  // trunk
  const trunkLen = opts.trunkLen ?? (shape === 'bush' ? H * 0.12 : shape === 'cascade' ? H * 0.3 : shape === 'spread' ? H * 0.24 : H * 0.24);
  const ta = -Math.PI / 2 + lean + (shape === 'cascade' ? Math.sign(cx - x) * 0.5 : 0);
  if (shape === 'bush') {
    const stems = opts.stems ?? rng.int(3, 5);
    for (let i = 0; i < stems; i++) branch([x + rng.range(-trunkW, trunkW), y], -Math.PI / 2 + rng.range(-0.7, 0.7) + lean, H * rng.range(0.35, 0.5), trunkW * rng.range(0.5, 0.8), 1);
  } else branch([x, y], ta, trunkLen, trunkW, 0);
  return { segs, tips, crown: [cx, cy, rx, ry], base: [x, y], height: H };
}

// Paint one small maple tree (or bush). Returns anchor info { base, crown:[cx,cy], radius, bounds }.
export function paintMaple(ctx, opts = {}) {
  const rng = rngOf(opts, 'maple-paint');
  const plan = opts.plan || planMaple(opts);
  const paper = opts.paper || PAPER;
  const dist = clamp(opts.distance ?? 0, 0, 1);
  let pal = typeof opts.palette === 'object' ? opts.palette : MAPLE_PALETTES[opts.palette || 'vermilion'];
  if (dist > 0) pal = Object.fromEntries(Object.entries(pal).map(([k, c]) => [k, mixC(c, paper, dist * 0.45)]));
  const H = plan.height;
  const leafR = opts.leafSize ?? Math.max(2.5, H * 0.03);
  const density = opts.density ?? 1;
  const inkFrac = opts.inkLeaves ?? 0.1;
  const paleFrac = opts.pale ?? 0.22;
  const btone = (opts.branchTone ?? 0.03) + dist * 0.35;
  const bcol = col(btone, paper);
  const [cx, cy, rx, ry] = plan.crown;
  const maxD = Math.max(...plan.segs.map((s) => s.depth));
  // dab sites: clusters around twig tips and strung along the outer twigs
  const groups = [];
  const upOf = (py) => clamp((cy - py) / (ry || 1) * 0.5 + 0.5, 0, 1);
  for (const t of plan.tips) {
    const g = [];
    const n = Math.max(1, Math.round((opts.cluster ?? 4) * rng.range(0.5, 1.5)));
    const cr = leafR * (opts.clusterSpread ?? 3.2);
    for (let i = 0; i < n; i++) {
      const a = rng() * TAU, d = Math.sqrt(rng()) * cr;
      const px = t.p[0] + Math.cos(a) * d + Math.cos(t.a) * cr * 0.3;
      const py = t.p[1] + Math.sin(a) * d * 0.75 + Math.sin(t.a) * cr * 0.2 - cr * 0.2;
      g.push({ x: px, y: py, up: upOf(py), r: leafR * rng.range(0.75, 1.25) });
    }
    groups.push(g);
  }
  // small bunches (1-2 dabs) at the buds of the outer twigs, grouped per twig
  for (const s of plan.segs) if (s.depth >= Math.max(2, maxD - 3)) {
    const g = [];
    for (let k = 1; k < s.pts.length; k++) {
      if (!rng.chance(opts.alongTwigs ?? 0.75)) continue;
      const q = s.pts[k];
      const nb = rng.int(1, 2);
      for (let j = 0; j < nb; j++) g.push({ x: q[0] + rng.range(-1.2, 1.2) * leafR, y: q[1] + rng.range(-1.3, 0.6) * leafR, up: upOf(q[1]), r: leafR * rng.range(0.7, 1.15) });
    }
    if (g.length) groups.push(g);
  }
  // keep whole groups until the crown reaches its target coverage: clumps stay dense, paper shows between
  const sites = [];
  {
    const area = Math.PI * rx * ry;
    const target = Math.round(density * (opts.coverage ?? 0.8) * area / (Math.PI * leafR * leafR));
    for (let i = groups.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = groups[i]; groups[i] = groups[j]; groups[j] = t; }
    const total = groups.reduce((s, g) => s + g.length, 0);
    // most groups survive whole; the rest keep one dab so no twig end is left bare
    const keepWhole = clamp((target - groups.length) / Math.max(1, total - groups.length), 0, 1);
    for (const g of groups) { if (rng() < keepWhole) sites.push(...g); else sites.push(g[0]); }
    if (opts.debug) console.warn('maple sites', sites.length, 'groups', groups.length, 'target', target, 'tips', plan.tips.length);
  }
  // classify
  const back = [], ink = [], front = [];
  for (const s of sites) {
    const u = rng();
    if (u < paleFrac * (1.45 - s.up * 0.9)) back.push(s);
    else if (u < paleFrac + inkFrac) ink.push(s);
    else front.push(s);
  }
  const blur = opts.blur ?? dist * 1.6;
  withBlur(ctx, blur, (g) => {
    // 1) pale washed dabs behind
    for (const s of back) paintMapleDab(g, s.x, s.y, s.r * rng.range(1.0, 1.35), { color: rng.chance(0.3) ? mixC(pal.pale, pal.mid, 0.3) : pal.pale, alpha: rng.range(0.35, 0.6), rot: rng() * TAU, lobes: rng.int(3, 5), rng });
    // 2) ink-grey dabs mixed in (ink-dark leaves)
    for (const s of ink) paintMapleDab(g, s.x, s.y, s.r, { color: col(rng.range(0.08, 0.5) + dist * 0.3, paper), alpha: rng.range(0.6, 0.9), rot: rng() * TAU, lobes: rng.int(3, 5), rng });
    // red dabs in three tiers: dark (multiplied, deepening overlaps), mid, bright
    const tiers = [[], [], []];
    for (const s of front) { const v = rng() - s.up * 0.15; tiers[v < 0.16 ? 0 : v < 0.52 ? 1 : 2].push(s); }
    // dabs are glazed (multiply) so overlaps deepen to crimson like layered watercolour
    const dab = (s, t) => {
      g.save(); g.globalCompositeOperation = 'multiply';
      if (t === 0) paintMapleDab(g, s.x, s.y, s.r, { color: mixC(pal.dark, pal.mid, rng() * 0.5), alpha: rng.range(0.6, 0.85), rot: rng() * TAU, lobes: rng.chance(0.7) ? 5 : 4, rng });
      else if (t === 1) paintMapleDab(g, s.x, s.y, s.r, { color: mixC(pal.mid, pal.bright, rng() * 0.4), alpha: rng.range(0.75, 0.92), rot: rng() * TAU, lobes: rng.chance(0.7) ? 5 : 4, rng });
      else paintMapleDab(g, s.x, s.y, s.r * rng.range(0.85, 1.1), { color: mixC(pal.bright, pal.mid, rng() * 0.3), alpha: rng.range(0.8, 0.95), rot: rng() * TAU, lobes: rng.chance(0.75) ? 5 : 4, rng });
      g.restore();
    };
    // 3) inner dabs (behind the wood): the dark tier and part of the mid tier
    for (const s of tiers[0]) dab(s, 0);
    const midBack = tiers[1].filter(() => rng.chance(0.45));
    for (const s of midBack) dab(s, 1);
    // 4) trunk and branches
    paintMapleBranches(g, plan, { color: bcol, rng, gnarl: opts.gnarl ?? (H > 250 ? 0.8 : 0.4), paper, dry: opts.dry ?? (H > 200 ? 0.6 : 0.25) });
    // 5) outer dabs in front of the wood (bright ones over the twigs, so twig ends tuck into the leaves)
    for (const s of tiers[1]) if (!midBack.includes(s)) dab(s, 1);
    for (const s of tiers[2]) { g.save(); g.globalAlpha = 1; paintMapleDab(g, s.x, s.y, s.r * rng.range(0.85, 1.1), { color: mixC(pal.bright, pal.mid, rng() * 0.3), alpha: rng.range(0.82, 0.95), rot: rng() * TAU, lobes: rng.chance(0.75) ? 5 : 4, rng }); g.restore(); }
  });
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const s of sites) { x0 = Math.min(x0, s.x - s.r * 2); y0 = Math.min(y0, s.y - s.r * 2); x1 = Math.max(x1, s.x + s.r * 2); y1 = Math.max(y1, s.y + s.r * 2); }
  for (const s of plan.segs) for (const q of s.pts) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
  return { base: plan.base, crown: [cx, cy], radius: Math.max(rx, ry, H), bounds: [x0, y0, x1, y1], tips: plan.tips.map((t) => t.p) };
}

// Trunk + limbs as tapered brush strokes; old trunks get knots, dry-brush flecks and a wet dark edge.
export function paintMapleBranches(ctx, plan, { color = INK, rng = Math.random, gnarl = 0.4, dry = 0.3, paper = PAPER } = {}) {
  const segs = plan.segs.slice().sort((a, b) => a.depth - b.depth);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const ph = rng() * 100;
  for (const s of segs) {
    const w0 = s.w0, w1 = s.w1;
    const wf = (t) => mix(w0, w1, t) * (1 + gnarl * 0.22 * Math.sin(t * 7.3 + ph + s.depth));
    stroke(ctx, s.pts, { width: wf, profile: 'even', color, alpha: 0.96, rough: 0.3 + gnarl * 0.35, rng, step: 2 });
    // thick limbs: extra offset strokes make a lumpy, twisted silhouette
    if (w0 > 6) {
      for (let k = 0; k < 2; k++) {
        const off = (k ? 1 : -1) * w0 * rng.range(0.15, 0.3);
        const P = s.pts.map((q, i) => {
          const a = s.pts[Math.max(0, i - 1)], b = s.pts[Math.min(s.pts.length - 1, i + 1)];
          const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
          const o = off * (0.6 + 0.4 * Math.sin(i * 2.1 + ph + k));
          return [q[0] - (b[1] - a[1]) / l * o, q[1] + (b[0] - a[0]) / l * o];
        });
        stroke(ctx, P, { width: (t) => wf(t) * 0.55, profile: 'brush', color, alpha: 0.95, rough: 0.5, rng, step: 2 });
      }
    }
    // knots: irregular blobs on the limb edges
    if (w0 > 3.5 && gnarl > 0) {
      const nk = Math.round(gnarl * (s.pts.length - 1) * (w0 > 10 ? 2 : 1));
      for (let k = 0; k < nk; k++) {
        const i = 1 + Math.floor(rng() * (s.pts.length - 1));
        const a = s.pts[i - 1], b = s.pts[i], t = rng();
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const sd = rng.sign() * mix(w0, w1, t) * rng.range(0.35, 0.55);
        const px = mix(a[0], b[0], t) - (b[1] - a[1]) / l * sd, py = mix(a[1], b[1], t) + (b[0] - a[0]) / l * sd;
        blob(ctx, px, py, w0 * rng.range(0.18, 0.34), { color, alpha: 0.95, rng, irregular: 0.45, squash: rng.range(0.5, 0.9), rot: rng() * 3 });
      }
    }
  }
  // dry-brush paper flecks in the thick limbs: streaks along the wood on the lit side
  if (dry > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    for (const s of segs) {
      if (s.w0 < 4.5) continue;
      // a few dry patches per limb, each a scatter of streaky flecks following the wood
      const patches = Math.round(dry * 1.1 * (s.pts.length - 1) * Math.min(2, s.w0 / 12) + rng() * 0.8);
      for (let pI = 0; pI < patches; pI++) {
        const k = Math.floor(rng() * (s.pts.length - 1));
        const a = s.pts[k], b = s.pts[k + 1], t0 = rng();
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        const wv = mix(s.w0, s.w1, (k + t0) / (s.pts.length - 1));
        const u0 = rng.range(-0.35, 0.25);
        const n = Math.round(rng.range(3, 8) * Math.min(2.2, wv / 9));
        for (let i = 0; i < n; i++) {
          const t = clamp(t0 + rng.gauss(0, 0.18), 0, 1);
          const px = mix(a[0], b[0], t), py = mix(a[1], b[1], t);
          const off = (u0 + rng.gauss(0, 0.12)) * wv;
          ctx.fillStyle = `rgba(0,0,0,${rng.range(0.6, 1).toFixed(3)})`;
          ctx.beginPath();
          ctx.ellipse(px - Math.sin(ang) * off, py + Math.cos(ang) * off, rng.range(0.8, 2.8) * Math.min(1.5, wv / 12 + 0.5), rng.range(0.4, 0.9), ang + rng.range(-0.15, 0.15), 0, TAU);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }
}

// Several small maples / maple bushes along a cliff-edge polyline (ref 08). path: [[x,y],...]
export function paintMapleEdge(ctx, opts = {}) {
  const rng = rngOf(opts, 'maple-edge');
  const path = opts.path || [];
  const out = [];
  if (path.length < 2) return out;
  const info = pathInfo(path);
  const spacing = opts.spacing ?? 60;
  let d = rng.range(0, spacing * 0.5);
  let i = 0;
  while (d < info.total) {
    const { p } = info.at(d / info.total);
    const H = (opts.height ?? 70) * rng.range(0.6, 1.3);
    const shape = rng.pick(opts.shapes || ['bush', 'round', 'cascade', 'spread']);
    out.push(paintMaple(ctx, { ...opts, rng: rng.fork('t' + i), x: p[0] + rng.range(-6, 6), y: p[1] + rng.range(-2, 4), height: H, width: H * rng.range(0.9, 1.5), shape, lean: rng.range(-25, 25) + (opts.lean ?? 0), dir: opts.dir }));
    d += spacing * rng.range(0.6, 1.4);
    i++;
  }
  return out;
}

// Bake one or more maples into a texture card. opts.trees: [paintMaple opts...] (or a single tree's opts).
// rect defaults to the union of the trees' bounds plus a sway margin.
export function makeMaple(api, opts = {}) {
  const trees = opts.trees || [opts];
  const paper = opts.paper || PAPER;
  let rect = opts.rect;
  if (!rect) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const t of trees) {
      const H = t.height ?? 160, Wc = t.width ?? H * 1.1;
      x0 = Math.min(x0, t.x - Wc); x1 = Math.max(x1, t.x + Wc); y0 = Math.min(y0, t.y - H * 1.25); y1 = Math.max(y1, t.y + 10);
    }
    rect = [Math.floor(x0 - 20), Math.floor(y0 - 20), Math.ceil(x1 - x0 + 40), Math.ceil(y1 - y0 + 40)];
  }
  const [rx, ry, rw, rh] = rect;
  const infos = [];
  const raw = api.bakeCanvas(rw, rh, (ctx) => {
    ctx.translate(-rx, -ry);
    trees.forEach((t, i) => infos.push(paintMaple(ctx, { paper, seed: (opts.seed ?? 1) * 31 + i, ...t })));
  }, { scale: opts.scale ?? 1 });
  const ink = opts.ink === undefined ? { edge: 0.4, granulation: 0.14, bleed: 0.9 } : opts.ink;
  const src = ink ? inkify(api, raw, ink) : raw;
  if (ink && api.engine && api.engine.freeTex) api.engine.freeTex(raw);
  const main = infos[0];
  const anchor = opts.anchor || main.base;
  const radius = opts.radius || Math.max(...infos.map((f) => f.radius));
  const layer = ({ z = 1, amp = 3, freq = 0.2, scale = 380, opacity = 1, power = 1.7 } = {}) =>
    api.tex(src, { rect, z, opacity, name: 'maple', sway: { amp, freq, scale, power, anchor, radius } });
  return { src, rect, trees: infos, anchor, radius, layer };
}
