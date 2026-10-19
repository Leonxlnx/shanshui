// Pines and conifers in the shan shui manner (see docs/STYLE.md).
//
// Usage
// -----
//   import { makePine, paintPine, buildPine, paintConifer, paintTreeLine, makeTreeLine } from '../lib/pine.js';
//
//   // 1. a hero pine as its own swaying texture card
//   const pine = makePine(api, { x: 60, y: 640, height: 620, lean: 10, bend: 70, reach: 0.8, seed: 3 });
//   layers.push(pine.layer({ z: 1 }));          // card with sensible sway already set
//   // pine.anchor = { base:[x,y], top:[x,y], canopy:{x,y,r}, bbox:[x0,y0,x1,y1], reach, pads:[...] }
//
//   // 2. paint several elements into one bake (design px, absolute coordinates)
//   const src = api.bakeCanvas(1920, 1080, (ctx) => {
//     paintPine(ctx, { x: 1840, y: 420, height: 380, lean: -12, bend: -55, reach: -0.9, seed: 7 });
//     paintTreeLine(ctx, [[900, 330], [980, 300], [1060, 340]], { height: [26, 48], tone: 0.35, seed: 2 });
//     paintConifer(ctx, 400, 600, 70, { kind: 'fir', tone: 0.1, seed: 5 });
//   });
//   layers.push(api.tex(inkify(api, src), { rect: [0, 0, 1920, 1080] }));
//
// Coordinates are design px, y down. Angles are degrees measured from vertical-up, positive =
// toward the right (lean 20 tilts right, bend -60 curls the trunk over to the left).
// Everything is deterministic in `seed`.

import { makeRng, makeNoise, clamp, mix, smoothstep } from '../engine/rng.js';
import { smoothPath, blob, rgba, tone as toneRGB, PAPER } from './brush.js';
import { inkify } from './inkfx.js';

const DEG = Math.PI / 180;

// ----------------------------------------------------------------------------- geometry
function arcs(path) {
  const L = [0];
  for (let i = 1; i < path.length; i++) L.push(L[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  return L;
}
function normalsOf(path) {
  const N = [];
  for (let i = 0; i < path.length; i++) {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    N.push([-dy / l, dx / l]);
  }
  return N;
}
function pointAt(path, L, d) {
  let i = 1; while (i < L.length - 1 && L[i] < d) i++;
  const t = clamp((d - L[i - 1]) / ((L[i] - L[i - 1]) || 1));
  return [mix(path[i - 1][0], path[i][0], t), mix(path[i - 1][1], path[i][1], t)];
}

// A branch: smoothed centre line + width profile. `jitter` adds gnarled sideways wander (px).
function mkBranch(pts, w0, w1, level, { flare = 0, step = 3, jitter = 0, nz = null, seed = 0, taperPow = 0.85 } = {}) {
  let path = smoothPath(pts, step);
  if (jitter > 0 && nz && path.length > 3) {
    const N0 = normalsOf(path), L0 = arcs(path), tot = L0[L0.length - 1] || 1;
    path = path.map((p, i) => {
      const fade = smoothstep(0, 0.12, L0[i] / tot);
      const off = jitter * fade * (0.65 * nz.n2(seed + L0[i] / 70, 3.1) + 0.35 * nz.n2(seed + L0[i] / 24, 8.7) + 0.15 * nz.n2(seed + L0[i] / 9, 5.3));
      return [p[0] + N0[i][0] * off, p[1] + N0[i][1] * off];
    });
  }
  const L = arcs(path), len = L[L.length - 1] || 1;
  const N = normalsOf(path);
  const knuckles = [];
  const w = (s) => {
    s = clamp(s);
    let v = mix(w0, w1, Math.pow(s, taperPow)) * (1 + flare * Math.pow(1 - s, 5));
    for (const k of knuckles) v *= 1 + k.amp * Math.exp(-Math.pow((s - k.s) * len / k.r, 2));
    return Math.max(0.6, v);
  };
  const at = (s) => {
    const d = clamp(s) * len;
    let i = 1; while (i < L.length - 1 && L[i] < d) i++;
    const t = (d - L[i - 1]) / ((L[i] - L[i - 1]) || 1);
    const a = path[i - 1], b = path[i];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return { x: mix(a[0], b[0], t), y: mix(a[1], b[1], t), tx: dx / l, ty: dy / l, th: Math.atan2(dx / l, -dy / l) };
  };
  return { pts, path, L, N, len, w, w0, w1, level, at, knuckles };
}

// Grow an axis by integrating a direction field. thetaFn(s) -> radians from vertical-up (+ right).
function growAxis(x, y, len, thetaFn, step = 10) {
  const n = Math.max(4, Math.round(len / step));
  const ds = len / n;
  const pts = [[x, y]];
  for (let i = 1; i <= n; i++) {
    const th = thetaFn((i - 0.5) / n);
    x += Math.sin(th) * ds; y -= Math.cos(th) * ds;
    pts.push([x, y]);
  }
  return pts;
}

// ----------------------------------------------------------------------------- colour / passes
function mkInk(T, paper) {
  // v: 0 = black ink .. 1 = paper; T pushes everything toward paper with distance
  return (v, a = 1) => rgba(toneRGB(clamp(v + (1 - v) * T), paper), a);
}
function devScale(ctx) { const m = ctx.getTransform(); return Math.hypot(m.a, m.b); }

// Draw `draw(g)` into a temporary layer and composite it (optionally blurred) onto ctx.
function blurredPass(ctx, blurPx, alpha, draw) {
  const cv = ctx.canvas;
  const off = new OffscreenCanvas(cv.width, cv.height);
  const g = off.getContext('2d');
  const m = ctx.getTransform();
  g.setTransform(m);
  draw(g);
  const k = Math.hypot(m.a, m.b);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = alpha;
  ctx.filter = blurPx > 0 ? `blur(${(blurPx * k).toFixed(2)}px)` : 'none';
  ctx.drawImage(off, 0, 0);
  ctx.restore();
}

// ----------------------------------------------------------------------------- strokes
// Tapered filled stroke along a polyline with width function wf(s).
function taperStroke(ctx, pts, wf, color, rng, rough = 0.12, step = 2.5) {
  const path = smoothPath(pts, step);
  if (path.length < 2) return;
  const N = normalsOf(path), L = arcs(path), tot = L[L.length - 1] || 1;
  const left = [], right = [];
  let wl = 0, wr = 0;
  for (let i = 0; i < path.length; i++) {
    const s = L[i] / tot;
    // smooth random walk on each side (ragged but not sawtoothed)
    wl = wl * 0.75 + (rng() - 0.5) * rough * 0.5;
    wr = wr * 0.75 + (rng() - 0.5) * rough * 0.5;
    const hw = Math.max(0.15, 0.5 * wf(s));
    left.push([path[i][0] + N[i][0] * hw * (1 + wl), path[i][1] + N[i][1] * hw * (1 + wl)]);
    right.push([path[i][0] - N[i][0] * hw * (1 + wr), path[i][1] - N[i][1] * hw * (1 + wr)]);
  }
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (let i = 1; i < left.length; i++) ctx.lineTo(left[i][0], left[i][1]);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

// One needle fan: a half wheel of blunt club-tipped strokes radiating from a small dark core.
function needleFan(ctx, x, y, R, ang, spread, n, lw, color, rng, core = 0.3) {
  blob(ctx, x, y, R * core, { color, rng, irregular: 0.22, squash: 0.72, rot: ang + Math.PI / 2, sides: 7 });
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const f = (i + 0.5 + (rng() - 0.5) * 0.45) / n;
    const a = ang - spread / 2 + spread * f;
    const edgeF = Math.abs(f - 0.5) * 2;
    const l = R * (0.78 + rng() * 0.26) * (1 - 0.18 * edgeF * edgeF);
    const c = Math.cos(a), s = Math.sin(a);
    // tapered finger: narrow at the core, club-rounded at the tip (ink pools as the brush lifts)
    const w0 = lw * 0.32, w1 = lw * (0.5 + rng() * 0.12);
    const r0 = R * 0.12;
    const bx = x + c * r0, by = y + s * r0, tx = x + c * (l - w1), ty = y + s * (l - w1);
    ctx.moveTo(bx - s * w0, by + c * w0);
    ctx.lineTo(tx - s * w1, ty + c * w1);
    ctx.arc(tx, ty, w1, a + Math.PI / 2, a - Math.PI / 2, true);
    ctx.lineTo(bx + s * w0, by - c * w0);
    ctx.closePath();
  }
  ctx.fill();
}

// ----------------------------------------------------------------------------- hero pine: structure
/**
 * buildPine(opts) -> tree structure (no drawing). Same options as paintPine.
 */
export function buildPine(o = {}) {
  const seed = o.seed ?? 1;
  const rng = makeRng('pine:' + seed);
  const nz = makeNoise('pine:n:' + seed);
  const H = o.height ?? 500;
  const x0 = o.x ?? 0, y0 = o.y ?? 0;
  const gnarl = o.gnarl ?? 0.5;
  const tw = o.trunkWidth ?? H * 0.075;
  const padSize = o.padSize ?? H * 0.2;
  const padAspect = o.padAspect ?? 0.42;
  const density = o.padDensity ?? 1;
  const branches = [];
  const ph = rng() * 100;

  // ---- trunk
  let spine;
  if (o.spine) spine = o.spine.map((p) => [p[0], p[1]]);
  else {
    const lean = (o.lean ?? 0) * DEG, bend = (o.bend ?? 0) * DEG, bendAt = o.bendAt ?? 0.3;
    const kinks = [];
    const nk = Math.round(gnarl * 3 + rng() * 1.5);
    for (let i = 0; i < nk; i++) kinks.push({ s: rng.range(0.15, 0.85), d: (rng() - 0.5) * 0.55 * gnarl });
    spine = growAxis(x0, y0, H, (s) => {
      let th = lean + bend * smoothstep(bendAt * 0.4, 1, s) + gnarl * 0.32 * nz.n2(ph + s * 2.3, 1.7) + gnarl * 0.12 * nz.n2(ph + s * 6.5, 4.1);
      for (const k of kinks) th += k.d * smoothstep(k.s - 0.03, k.s + 0.03, s);
      return th;
    }, 8);
  }
  const trunk = mkBranch(spine, tw, Math.max(1.5, tw * (o.taper ?? 0.22)), 0, { flare: o.flare ?? 0.3, jitter: o.spine ? gnarl * tw * 0.12 : 0, nz, seed: ph });
  trunk.isTrunk = true;
  branches.push(trunk);

  // ---- limbs (explicit or procedural)
  const limbs = [];
  if (Array.isArray(o.limbs)) {
    for (const lb of o.limbs) {
      const w0 = lb.w ?? tw * 0.45;
      const b = mkBranch(lb.pts, w0, lb.w1 ?? 1.4, 1, { jitter: gnarl * Math.min(18, w0 * 0.35 + 3), nz, seed: rng() * 100, taperPow: lb.taperPow ?? 1.3 });
      b.padScale = lb.pad ?? 1; b.subs = lb.subs; b.noAlong = lb.noAlong; b.tipPad = lb.tipPad ?? true;
      limbs.push(b);
    }
  } else {
    const nL = o.limbs ?? 6;
    const reach = o.reach ?? 0;
    const limbLen = (o.limbLength ?? 0.55) * H;
    const sA = o.limbStart ?? 0.38;
    let prevSide = rng() < 0.5 ? 1 : -1;
    for (let i = 0; i < nL; i++) {
      const s = mix(sA, 0.95, (i + 0.25 + rng() * 0.5) / nL);
      let side;
      if (Math.abs(reach) > 0.85) side = Math.sign(reach) * (rng() < 0.12 ? -1 : 1);
      else side = rng() < 0.5 + 0.5 * reach + (prevSide < 0 ? 0.18 : -0.18) ? 1 : -1;
      prevSide = side;
      const P = trunk.at(s);
      const reachMul = side === Math.sign(reach || 1) ? 1 : mix(1, 0.55, Math.abs(reach));
      const len = limbLen * (0.65 + rng() * 0.4) * reachMul * (1 - 0.5 * smoothstep(0.7, 1, s));
      const la = o.limbAngle ?? 82;
      const th0 = side * mix(la, la - 25, s) * DEG + (rng() - 0.5) * 12 * DEG;
      const droop = (o.droop ?? 22) * DEG * (0.6 + rng() * 0.8);
      const lp = rng() * 100;
      const pts = growAxis(P.x, P.y, len, (u) => th0 + side * (droop * u - droop * 1.3 * smoothstep(0.62, 1, u)) + gnarl * 0.35 * nz.n2(lp + u * 2.6, 7.7), 9);
      const b = mkBranch(pts, Math.max(1.6, trunk.w(s) * (0.45 + rng() * 0.2)), 1.3, 1, { jitter: gnarl * 5, nz, seed: lp, taperPow: 1.2 });
      b.padScale = 1; b.tipPad = true;
      limbs.push(b);
    }
  }
  branches.push(...limbs);

  // ---- sub-branches
  const subs = [];
  const subMul = o.subBranches ?? 1;
  for (const b of limbs) {
    if (b.len < padSize * 0.6) continue;
    const n = b.subs ?? clamp(Math.round((b.len / (padSize * 1.1)) * subMul), 0, 5);
    for (let k = 0; k < n; k++) {
      const u = mix(0.22, 0.88, (k + 0.2 + rng() * 0.6) / n);
      const P = b.at(u);
      const goUp = rng() < (o.subUp ?? 0.8);
      // upward subs rise steeply toward the canopy tiers; downward ones droop a little below the limb
      const th0 = goUp ? P.th * (0.15 + rng() * 0.45) + (rng() - 0.5) * 0.2 : P.th + Math.sign(P.th || 1) * (20 + rng() * 25) * DEG;
      const len = Math.min(b.len * (0.12 + rng() * 0.16) * (1 - u * 0.3) + padSize * 0.25, padSize * (0.5 + rng() * 0.45)) * (goUp ? 1 : 0.7);
      const side = Math.sign(Math.sin(th0)) || 1;
      const sp = rng() * 100;
      const nzig = 2 + rng() * 2.5;
      const pts = growAxis(P.x, P.y, len, (v) => th0 + side * 14 * DEG * v + gnarl * 0.3 * nz.n2(sp + v * 3, 2.2) + gnarl * 0.42 * Math.tanh(3 * Math.sin(v * Math.PI * nzig + sp)), 5);
      const sb = mkBranch(pts, Math.max(1.2, b.w(u) * 0.5), 1.0, 2, { jitter: gnarl * 2.5, nz, seed: sp });
      sb.padScale = (b.padScale ?? 1) * 0.9; sb.tipPad = true;
      b.knuckles.push({ s: u, amp: 0.25, r: b.w(u) * 0.8 + 3 });
      subs.push(sb);
    }
  }
  branches.push(...subs);

  // ---- pads
  const pads = [];
  const twigs = [];
  const fits = (p) => {
    for (const q of pads) {
      if (Math.abs(p.x - q.x) < (p.w + q.w) * 0.23 && Math.abs(p.y - q.y) < (p.h + q.h) * 0.36) return false;
    }
    return true;
  };
  const addPad = (x, y, w, from, force, hOverride, rooted) => {
    const h = hOverride ?? w * padAspect * (0.85 + rng() * 0.3);
    const p = { x, y, w, h, tilt: (rng() - 0.5) * 0.16, back: false, ax: x + (rng() - 0.5) * w * 0.2, ay: y + h * 0.5 };
    if (!force && !fits(p)) return null;
    pads.push(p);
    if (rooted) { p.ax = from[0]; p.ay = from[1]; p.rooted = true; }
    else if (from) {
      // the claw roots on the branch itself when it is close; otherwise a twig carries it
      const gap = from[1] - p.ay;
      if (gap > -h * 0.3 && gap < h * 0.45 && Math.abs(from[0] - p.ax) < w * 0.35) { p.ax = from[0]; p.ay = Math.max(from[1], y + h * 0.3); }
      else twigs.push({ pts: [from, [mix(from[0], p.ax, 0.5) + (rng() - 0.5) * w * 0.15, mix(from[1], p.ay, 0.6)], [p.ax, p.ay]], w: 4 });
    }
    return p;
  };
  // trunk apex crown
  const apex = trunk.at(1);
  if (o.crown ?? !Array.isArray(o.limbs)) {
    addPad(apex.x, apex.y - padSize * padAspect * 0.3, padSize * 1.1, [apex.x, apex.y], true);
    if (rng() < 0.75) addPad(apex.x + (rng() - 0.5) * padSize * 0.4, apex.y - padSize * padAspect * 1.25, padSize * 0.7, [apex.x, apex.y], true);
  }
  // tips (limbs first: their tip pads are the biggest)
  for (const b of [...limbs, ...subs]) {
    if (b.tipPad === false) continue;
    const t = b.at(1);
    const w = padSize * (0.8 + rng() * 0.4) * (b.padScale ?? 1) * (b.level === 2 ? 0.85 : 1.05);
    if (!addPad(t.x + t.tx * w * 0.12, t.y - w * padAspect * 0.35, w, [t.x, t.y], b.level === 1)) {
      addPad(t.x + t.tx * w * 0.1, t.y - w * padAspect * 0.25, w * 0.55, [t.x, t.y], true); // small tuft so no tip hangs bare
    }
  }
  // along limbs: tall lace pads rooted on the limb's upper edge, their fan crest a lace-height above
  const lace = o.lace ?? padSize * 0.55;
  for (const b of limbs) {
    if (b.noAlong) continue;
    const step = (padSize * 0.7) / Math.max(0.2, density);
    for (let d = b.len * 0.25; d < b.len * 0.92; d += step * (0.7 + rng() * 0.6)) {
      if (rng() > 0.85) continue;
      const u = d / b.len;
      const P = b.at(u);
      if (Math.abs(Math.sin(P.th)) < 0.45) continue; // steep stretches carry no lace layer
      const w = padSize * (0.6 + rng() * 0.45) * (b.padScale ?? 1);
      const h = lace * (0.7 + rng() * 0.55) * (b.padScale ?? 1) * clamp(Math.abs(Math.sin(P.th)) * 1.2, 0.5, 1);
      const topY = P.y - b.w(u) * 0.42;
      addPad(P.x + (rng() - 0.5) * w * 0.2, topY - h * 0.5, w, [P.x, topY], false, h, true);
    }
  }
  // back (hazy) pads: a share of existing ones + ghosts tucked into the canopy
  const backShare = o.backPads ?? 0.1;
  for (const p of pads) if (rng() < backShare) p.back = true;
  // ghosts: paler pads peeking out from behind front pads (depth in the canopy)
  const nGhost = Math.round((o.haze ?? 0.4) * pads.length * 0.5);
  const ghosts = [];
  for (let i = 0; i < nGhost && pads.length; i++) {
    const q = pads[(rng() * pads.length) | 0];
    const side = rng() < 0.5 ? -1 : 1;
    const w = q.w * (0.6 + rng() * 0.3);
    const gx = q.x + side * q.w * (0.08 + rng() * 0.25), gy = q.y - q.h * (0.3 + rng() * 0.4);
    ghosts.push({ x: gx, y: gy, w, h: w * padAspect * 0.8, tilt: (rng() - 0.5) * 0.2, back: true, ghost: true, ax: gx, ay: gy + w * padAspect * 0.45 });
  }

  // ---- anchors / bbox
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  const grow = (x, y, r) => { x1 = Math.min(x1, x - r); y1 = Math.min(y1, y - r); x2 = Math.max(x2, x + r); y2 = Math.max(y2, y + r); };
  for (const b of branches) for (let i = 0; i < b.path.length; i += 3) grow(b.path[i][0], b.path[i][1], b.w(b.L[i] / b.len) * 0.8 + 4);
  const R0 = o.needle ?? padSize * 0.12;
  for (const p of [...pads, ...ghosts]) { grow(p.x - p.w * 0.55, p.y, R0 * 1.8 + p.h); grow(p.x + p.w * 0.55, p.y, R0 * 1.8 + p.h); }
  let cx = 0, cy = 0;
  for (const p of pads) { cx += p.x; cy += p.y; }
  cx /= pads.length || 1; cy /= pads.length || 1;
  let cr = 0;
  for (const p of pads) cr = Math.max(cr, Math.hypot(p.x - cx, p.y - cy) + p.w * 0.5);
  const base = spine[0];
  const anchor = {
    base: [base[0], base[1]], top: [apex.x, apex.y],
    canopy: { x: cx, y: cy, r: cr },
    bbox: [x1, y1, x2, y2],
    reach: Math.max(...pads.map((p) => Math.hypot(p.x - base[0], p.y - base[1])), 1),
    pads: pads.map((p) => ({ x: p.x, y: p.y, w: p.w, h: p.h })),
  };
  return { seed, H, branches, trunk, limbs, subs, pads, ghosts, twigs, padSize, R0, anchor };
}

// ----------------------------------------------------------------------------- hero pine: painting
// Bark is painted in three passes over all branches so forks read as one continuous form:
// bodies (light), texture (mottles, dry dashes, dark plates), contour (broken dark edge + knobs).
function prepBranch(b, rng, nz) {
  const { L, len } = b;
  const n = b.path.length;
  const maxW = b.w(0);
  const W = new Float32Array(n);
  const ph = rng() * 100;
  for (let i = 0; i < n; i++) {
    const s = L[i] / len;
    W[i] = b.w(s) * (1 + 0.18 * nz.n2(ph + L[i] / Math.max(14, maxW * 1.3), 0.5) + 0.09 * nz.n2(ph + L[i] / Math.max(5, maxW * 0.33), 2.5));
  }
  b.W = W;
  b.edge = (side, i, f = 1) => [b.path[i][0] + b.N[i][0] * W[i] * 0.5 * side * f, b.path[i][1] + b.N[i][1] * W[i] * 0.5 * side * f];
  // interior offsets use the smooth width so texture does not ripple with the lumpy outline
  b.inner = (side, i, f = 1) => { const w = b.w(L[i] / len) * 0.5 * side * f; return [b.path[i][0] + b.N[i][0] * w, b.path[i][1] + b.N[i][1] * w]; };
  b.upSide = (i) => (b.N[i][1] < 0 ? 1 : -1);
  b.thin = maxW < 4.5;
}

function paintBody(ctx, b, P, rng) {
  const n = b.path.length;
  if (n < 2) return;
  if (b.thin || P.detail < 0.35) { taperStroke(ctx, b.path, (s) => b.w(s) * 1.05, P.ink(0.04, 0.97), rng, 0.3); return; }
  // body value follows the local width: broad trunk light grey, thinner limbs darker, twigs black.
  // Painted as overlapping chunks so the tone can change along the branch without seams.
  const toneAt = b.level === 0 ? () => P.bark : (i) => mix(0.22, P.bark * 0.95, smoothstep(4, 44, b.W[i]));
  const CH = 6;
  for (let i0 = 0; i0 < n - 1; i0 += CH) {
    const i1 = Math.min(n - 1, i0 + CH + 1);
    ctx.beginPath();
    let p = b.edge(1, i0); ctx.moveTo(p[0], p[1]);
    for (let i = i0 + 1; i <= i1; i++) { p = b.edge(1, i); ctx.lineTo(p[0], p[1]); }
    for (let i = i1; i >= i0; i--) { p = b.edge(-1, i); ctx.lineTo(p[0], p[1]); }
    ctx.closePath();
    ctx.fillStyle = P.ink(toneAt(Math.min(n - 1, i0 + (CH >> 1))), 1);
    ctx.fill();
  }
}

function paintBark(ctx, b, P, rng, skip) {
  if (b.thin || P.detail < 0.35) return;
  const { path, N, L, len, W } = b;
  const ink = P.ink;
  const n = path.length;
  const maxW = b.w(0);
  const step = len / (n - 1 || 1);
  const strokeAlong = (i0, i1, ufn, wfn, color, rough = 0.3, onEdge = false) => {
    const pts = [];
    const at = onEdge ? b.edge : b.inner;
    for (let i = i0; i <= i1; i++) pts.push(at(1, i, ufn((i - i0) / Math.max(1, i1 - i0))));
    if (pts.length < 2) return;
    taperStroke(ctx, pts, wfn, color, rng, rough, 2);
  };
  const pick = () => {
    const i = (rng() * (n - 1)) | 0;
    return L[i] < skip * 0.5 || W[i] < 4 ? -1 : i;
  };
  const dirAt = (i) => Math.atan2(path[Math.min(n - 1, i + 1)][1] - path[Math.max(0, i - 1)][1], path[Math.min(n - 1, i + 1)][0] - path[Math.max(0, i - 1)][0]);
  const area = (len * maxW) / 200 * P.barkDensity * (b.level > 0 ? 1.6 : 1);
  // 1. mottled mid-tone patches, more on the shadow side
  for (let k = 0; k < area * 0.6; k++) {
    const i = pick(); if (i < 0) continue;
    const sh = rng() < 0.7 ? -b.upSide(i) : b.upSide(i);
    const u = sh * Math.pow(rng(), 0.7) * 0.85;
    const q = b.inner(1, i, u);
    const r = W[i] * (0.08 + rng() * 0.2);
    blob(ctx, q[0], q[1], r, { color: ink(0.35 + rng() * 0.2, 0.18 + rng() * 0.3), rng, irregular: 0.5, squash: 0.3 + rng() * 0.3, rot: dirAt(i) + (rng() - 0.5) * 0.5, sides: 9 });
  }
  // 2. a few short broken dry dashes along the grain (mostly on the broad trunk)
  for (let k = 0; k < area * (b.level === 0 ? 0.4 : 0.12); k++) {
    const i0 = pick(); if (i0 < 0) continue;
    const i1 = Math.min(n - 1, i0 + Math.max(2, Math.round(W[i0] * (0.15 + rng() * 0.45) / step)));
    const u0 = (rng() * 2 - 1) * 0.85, du = (rng() - 0.5) * 0.4;
    const pw = Math.max(0.6, W[i0] * (0.02 + rng() * 0.035));
    strokeAlong(i0, i1, (s) => clamp(u0 + du * s, -1, 1), (s) => pw * Math.sin(Math.PI * clamp(s * 0.9 + 0.05)), ink(0.2 + rng() * 0.25, 0.3 + rng() * 0.4), 0.4);
  }
  // 3. dark blotches (irregular, elongated with the grain), crowding the shadow edge
  for (let k = 0; k < area * 0.75; k++) {
    const i = pick(); if (i < 0) continue;
    const sh = rng() < 0.62 ? -b.upSide(i) : b.upSide(i);
    const u = sh * Math.pow(rng(), 0.45) * 0.92;
    const q = b.inner(1, i, u);
    const r = W[i] * (0.06 + rng() * rng() * 0.26) + 0.6;
    const rot = dirAt(i) + (rng() - 0.5) * 0.5;
    const sq = 0.25 + rng() * 0.3;
    blob(ctx, q[0], q[1], r, { color: ink(0.02 + rng() * 0.06, 0.9 + rng() * 0.1), rng, irregular: 0.45, squash: sq, rot, sides: 10 });
    if (rng() < 0.35) blob(ctx, q[0] + Math.cos(rot) * r * 1.1, q[1] + Math.sin(rot) * r * 1.1, r * 0.6, { color: ink(0.03, 0.9), rng, irregular: 0.4, squash: sq, rot, sides: 8 });
  }
  // 4. inner lobes: round dark bumps half inside the outline (the lumpy, knuckled bark edge)
  for (let k = 0; k < area * 0.3; k++) {
    const i = pick(); if (i < 0) continue;
    const sh = rng() < 0.6 ? -b.upSide(i) : b.upSide(i);
    const q = b.edge(sh, i, 0.72 + rng() * 0.2);
    const r = W[i] * (0.08 + rng() * 0.1) + 0.8;
    blob(ctx, q[0], q[1], r, { color: ink(0.03, 0.95), rng, irregular: 0.3, squash: 0.6 + rng() * 0.35, rot: dirAt(i), sides: 9 });
  }
}

function paintContour(ctx, b, P, rng, nz, skip) {
  if (b.thin || P.detail < 0.35) return;
  const { path, N, L, len, W } = b;
  const ink = P.ink;
  const n = path.length;
  const maxW = b.w(0);
  const nearJoin = (d, side) => {
    for (const j of b.joins || []) if (j.side === side && Math.abs(d - j.d) < j.r) return true;
    return false;
  };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const side of [1, -1]) {
    const sp = rng() * 100;
    ctx.strokeStyle = ink(0.02, 0.95);
    let on = false;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const shadow = b.upSide(i) !== side;
      if (L[i] < skip || nearJoin(L[i], side) || nz.n2(sp + L[i] * 0.03, side * 3.3) < (shadow ? -0.7 : -0.3)) { if (on) { ctx.stroke(); ctx.beginPath(); } on = false; continue; }
      ctx.lineWidth = Math.max(1, W[i] * (shadow ? 0.15 : 0.09) + 0.8);
      const q = b.edge(side, i, 0.95);
      if (!on) { ctx.moveTo(q[0], q[1]); on = true; } else ctx.lineTo(q[0], q[1]);
    }
    ctx.stroke();
    // knobs: clusters of round dark bumps hugging the edge (the pine's "cloud knuckles")
    let d = skip + rng() * maxW * 0.6;
    while (d < len * 0.96) {
      let i = 0; while (i < n - 1 && L[i] < d) i++;
      const wi = W[i];
      const isUp = b.upSide(i) === side;
      if (!nearJoin(d, side) && rng() < (isUp ? 0.62 : 0.5) * P.knobs && wi > 4) {
        const m = 1 + ((rng() * 3.2) | 0);
        const tx = -N[i][1], ty = N[i][0];
        const rb = (wi * (isUp ? 0.1 : 0.14) + 2.2) * (0.7 + rng() * 0.6);
        for (let j = 0; j < m; j++) {
          const r = rb * (0.65 + rng() * 0.6);
          const q = b.edge(side, i, 1 + (r / Math.max(1, wi)) * (0.1 + rng() * 0.6));
          const off = (j - (m - 1) / 2) * rb * (1.3 + rng() * 0.5);
          blob(ctx, q[0] + tx * off, q[1] + ty * off, r, { color: ink(0.02, 0.97), rng, irregular: 0.22, squash: 0.8 + rng() * 0.2, rot: rng() * 3, sides: 9 });
        }
      }
      d += wi * (0.5 + rng() * 0.8);
    }
  }
}

// Record where each branch attaches to a thicker one (for contour gaps at forks).
function linkJoins(branches) {
  for (const b of branches) b.joins = [];
  for (const c of branches) {
    if (c.isTrunk) continue;
    const s0 = c.path[0];
    let best = null, bd = Infinity;
    for (const p of branches) {
      if (p === c || p.w0 <= c.w0 * 0.9 || p.thin) continue;
      for (let i = 0; i < p.path.length; i += 2) {
        const dd = Math.hypot(p.path[i][0] - s0[0], p.path[i][1] - s0[1]);
        if (dd < bd) { bd = dd; best = { p, i }; }
      }
    }
    if (!best || bd > best.p.W[best.i] * 0.9 + 6) continue;
    const { p, i } = best;
    const c1 = c.path[Math.min(c.path.length - 1, 4)];
    const dx = c1[0] - s0[0], dy = c1[1] - s0[1];
    const side = dx * p.N[i][0] + dy * p.N[i][1] >= 0 ? 1 : -1;
    p.joins.push({ d: p.L[i], r: c.w0 * 0.75 + 2, side });
    c.skip = Math.max(c.skip || 0, p.W[i] * 0.5);
  }
}

// Pad geometry: a small claw of branchlets from the attach point, fans standing on it in a dome.
function padGeom(pad, P, rng) {
  const { x, y, w, h } = pad;
  const R = P.R * clamp(w / P.padSize, 0.75, 1.2) * (pad.ghost ? 1.05 : 1);
  const ax = pad.ax ?? x, ay = y + h * 0.45;
  const lw = Math.max(1.1, R * 0.19);
  const branchlets = [];
  const fans = [];
  const cores = []; // dark core band polylines (merged fan bases)
  for (const side of [-1, 1]) {
    const ext = (side < 0 ? ax - (x - w * 0.5) : x + w * 0.5 - ax) * (0.88 + rng() * 0.12);
    if (ext < R * 0.5) continue;
    const ex = ax + side * ext, ey = ay - h * (0.35 + rng() * 0.35) + Math.sin(pad.tilt) * side * ext;
    const pts = [[ax, ay], [ax + side * ext * 0.33, ay - h * 0.1 + (rng() - 0.5) * h * 0.2], [ax + side * ext * 0.7, mix(ay, ey, 0.55) + (rng() - 0.5) * h * 0.18], [ex, ey]];
    branchlets.push({ pts, w0: lw, w1: lw * 0.5 });
    // a secondary twiglet forking upward from the branchlet
    const path = smoothPath(pts, 2), L = arcs(path), tot = L[L.length - 1] || 1;
    const nf = Math.max(1, Math.round(ext / (R * P.fanSpacing)));
    const band = [];
    for (let k = 0; k < nf; k++) {
      const u = nf === 1 ? 0.9 : mix(0.2, 1.0, k / (nf - 1)) + (rng() - 0.5) * 0.06;
      const q = pointAt(path, L, clamp(u) * tot);
      const e = clamp((q[0] - x) / (w * 0.5), -1, 1);
      const dome = 1 - e * e;
      const stem = R * (0.12 + 0.45 * dome) * (0.7 + rng() * 0.6);
      const ang = -Math.PI / 2 + e * 55 * DEG + (rng() - 0.5) * 22 * DEG;
      const fx = q[0] + Math.cos(ang) * stem * 0.8, fy = q[1] + Math.sin(ang) * stem;
      fans.push({ x: fx, y: fy, R: R * (0.85 + rng() * 0.3), a: ang, row: 0, sx: q[0], sy: q[1] });
      band.push([fx, fy + R * 0.12]);
      if (rng() < 0.9) fans.push({ x: mix(q[0], fx, 0.3) + (rng() - 0.5) * R * 0.7, y: mix(q[1], fy, 0.3) + R * 0.12, R: R * (0.72 + rng() * 0.22), a: ang + (rng() - 0.5) * 0.6, row: 1 });
      if (rng() < 0.28 * P.under) fans.push({ x: q[0] + (rng() - 0.5) * R, y: q[1] + R * 0.28, R: R * (0.5 + rng() * 0.2), a: Math.PI / 2 - e * 55 * DEG + (rng() - 0.5) * 0.6, row: 2 });
    }
    if (band.length > 1) cores.push(band);
  }
  // centre fans above the attach point
  const nc = w > R * 4.5 ? 2 : 1;
  for (let i = 0; i < nc; i++) {
    const fx = ax + (i - (nc - 1) / 2) * R * 1.2 + (rng() - 0.5) * R * 0.4;
    fans.push({ x: fx, y: ay - h * (0.48 + rng() * 0.2), R: R * (0.95 + rng() * 0.2), a: -Math.PI / 2 + (rng() - 0.5) * 0.35, row: 0, sx: ax, sy: ay });
    fans.push({ x: fx + (rng() - 0.5) * R * 0.8, y: ay - h * 0.3, R: R * 0.8, a: -Math.PI / 2 + (rng() - 0.5) * 0.6, row: 1 });
  }
  return { fans, branchlets, cores, R, lw };
}

// Claw pad: the twig forks two or three times like a hand; fans sit on every tip and along the
// knuckles, pointing up/outward. Tips spread into a flat dome of width w and height h.
function clawGeom(pad, P, rng) {
  const { x, y, w, h } = pad;
  const R = P.R * clamp(w / P.padSize, 0.75, 1.2) * (pad.ghost ? 1.05 : 1);
  const ax = pad.ax ?? x, ay = pad.ay ?? y + h * 0.5;
  const lw = Math.max(1.2, R * (pad.rooted ? 0.46 : 0.32));
  const branchlets = [];
  const fans = [];
  const cores = [];
  const knots = [];
  const crest = y - h * 0.5;
  const sx = w / 2, sy = pad.rooted ? Math.max(R, ay - crest) : clamp(ay - crest, h * 0.6, h * 1.05); // spread scales
  const grow = (px, py, ang, len, depth, wid) => {
    // ang: radians from vertical (+ right); geometry squashed vertically into the pad
    const ex = px + Math.sin(ang) * len * sx;
    let ey = py - Math.cos(ang) * len * sy * 0.95;
    if (depth <= 0) {
      // fan tips line up into a domed crest along the top of the pad
      const e = clamp((ex - x) / sx, -1.2, 1.2);
      ey = mix(ey, crest + R * 0.35 + h * 0.28 * e * e + (rng() - 0.5) * R * 0.5, pad.rooted ? 0.75 : 0.4);
    }
    // zig-zag twig: the middle kinks sideways (gnarled lace), with a knob at the kink
    const kink = (rng() < 0.5 ? -1 : 1) * (0.1 + rng() * 0.16);
    const seg = Math.hypot(ex - px, ey - py) || 1;
    const nx = -(ey - py) / seg, ny = (ex - px) / seg;
    const mx = mix(px, ex, 0.45 + rng() * 0.15) + nx * seg * kink, my = mix(py, ey, 0.45 + rng() * 0.15) + ny * seg * kink;
    branchlets.push({ pts: [[px, py], [mx, my], [ex, ey]], w0: wid, w1: wid * 0.72 });
    if (wid > 2.2 && rng() < 0.5) knots.push([mx, my, wid * 0.55]);
    const up = ang * 0.55; // fans lean toward vertical
    if (depth <= 0) {
      fans.push({ x: ex, y: ey, R: R * (0.85 + rng() * 0.3), a: -Math.PI / 2 + up + (rng() - 0.5) * 0.3, row: 0 });
      cores.push([ex, ey + R * 0.12]);
      // a neighbouring fan on the same twig tip thickens the crest into a continuous band
      if (rng() < P.crest) {
        const s = rng() < 0.5 ? -1 : 1;
        fans.push({ x: ex + s * R * (0.6 + rng() * 0.4), y: ey + R * (0.05 + rng() * 0.25), R: R * (0.75 + rng() * 0.25), a: -Math.PI / 2 + up + s * 0.35 + (rng() - 0.5) * 0.3, row: 0 });
      }
      if (rng() < 0.3) fans.push({ x: mix(mx, ex, 0.5) + (rng() - 0.5) * R * 0.5, y: mix(my, ey, 0.5) + R * 0.2, R: R * (0.6 + rng() * 0.2), a: -Math.PI / 2 + up * 0.7 + (rng() - 0.5) * 0.6, row: 1 });
      return;
    }
    knots.push([ex, ey, wid * 0.85]);
    // a few fans along the knuckles keep the fingers from showing bare
    if (rng() < 0.4) fans.push({ x: mx + (rng() - 0.5) * R * 0.4, y: my - R * 0.15, R: R * (0.75 + rng() * 0.2), a: -Math.PI / 2 + up * 0.8 + (rng() - 0.5) * 0.5, row: 0 });
    if (rng() < 0.3) fans.push({ x: ex + (rng() - 0.5) * R * 0.5, y: ey - R * 0.2, R: R * (0.8 + rng() * 0.2), a: -Math.PI / 2 + up * 0.7 + (rng() - 0.5) * 0.4, row: 1 });
    const k = rng() < 0.3 ? 3 : 2;
    for (let i = 0; i < k; i++) {
      const f = k === 1 ? 0 : i / (k - 1) - 0.5;
      const da = f * (0.75 + rng() * 0.45) + (rng() - 0.5) * 0.2;
      grow(ex, ey, clamp(ang + da, -1.45, 1.45), len * (0.55 + rng() * 0.2), depth - 1, wid * 0.72);
    }
  };
  const depth = w > R * 6.5 || sy > R * 3.4 ? 2 : 1;
  const roots = pad.rooted && w > R * 6 ? 4 : w > R * 4 ? 3 : 2;
  for (let i = 0; i < roots; i++) {
    const f = roots === 1 ? 0 : i / (roots - 1) - 0.5;
    const spread = pad.rooted ? 1.7 : 2.3;
    const ang = f * spread + (rng() - 0.5) * 0.3 + (ax - x) / -sx * 0.4;
    const len = (depth === 2 ? 0.5 : 0.75) * (0.85 + rng() * 0.3) * (Math.abs(f) > 0.2 ? 1.05 : 0.75);
    grow(ax, ay, ang, len, depth, lw);
  }
  // under fringe (pale, hanging)
  const nu = Math.round(fans.length * 0.12 * P.under);
  for (let i = 0; i < nu; i++) {
    const e = (rng() - 0.5) * 1.6;
    fans.push({ x: ax + e * sx * 0.8, y: ay - h * 0.15 + rng() * h * 0.2, R: R * (0.5 + rng() * 0.2), a: Math.PI / 2 - e * 0.9 + (rng() - 0.5) * 0.4, row: 2 });
  }
  return { fans, branchlets, cores: [cores], knots, R, lw };
}

function padPrepare(pad, P, rng) {
  const G = P.padStyle === 'flat' ? padGeom(pad, P, rng) : clawGeom(pad, P, rng);
  for (const f of G.fans) f.soft = f.row === 1 && rng() < P.soft;
  pad.G = G; pad.fans = G.fans; pad.R = G.R;
}

// Wet, slightly greyer inner fans (painted into a blurred pass behind the crisp ones).
function paintPadSoft(ctx, pad, P, rng) {
  const dark = pad.back ? P.backTone : 0.025;
  for (const f of pad.G.fans) {
    if (!f.soft) continue;
    const nn = Math.max(6, Math.round(P.needles * (0.85 + rng() * 0.3)));
    needleFan(ctx, f.x, f.y, f.R * 1.05, f.a, (170 + rng() * 34) * DEG, nn, Math.max(0.8, f.R * P.needleWidth * 1.1), P.ink(dark + 0.14 + rng() * 0.14, 1), rng, 0.4);
  }
}

function paintPad(ctx, pad, P, rng) {
  const ink = P.ink;
  if (!pad.G) padPrepare(pad, P, rng);
  const G = pad.G;
  const dark = pad.back ? P.backTone : 0.025;
  const col = ink(dark, 1);
  const bare = pad.ghost || pad.back;
  if (!bare) for (const b of G.branchlets) taperStroke(ctx, b.pts, (s) => mix(b.w0, b.w1, s) * (0.75 + 0.5 * Math.abs(Math.sin(s * 11 + b.pts[1][0]))), col, rng, 0.35);
  if (!bare) for (const k of G.knots || []) blob(ctx, k[0], k[1], k[2] * (0.7 + rng() * 0.4), { color: col, rng, irregular: 0.3, squash: 0.8, rot: rng() * 3, sides: 7 });
  if (!bare) for (const f of G.fans) {
    if (f.sx === undefined) continue;
    taperStroke(ctx, [[f.sx, f.sy], [mix(f.sx, f.x, 0.5) + (rng() - 0.5) * G.R * 0.2, mix(f.sy, f.y, 0.5)], [f.x, f.y]], (s) => G.lw * (0.95 - 0.25 * s), col, rng, 0.3);
  }
  // merged dark bases under the fan row
  for (const band of G.cores) {
    for (let i = 0; i < band.length; i++) {
      const [bx, by] = band[i];
      blob(ctx, bx, by, G.R * (0.32 + rng() * 0.18), { color: col, rng, irregular: 0.35, squash: 0.6, rot: rng() * 0.4, sides: 8 });
      if (P.padStyle === 'flat' && i < band.length - 1 && rng() < 0.7) {
        const [cx, cy] = band[i + 1];
        blob(ctx, (bx + cx) / 2, (by + cy) / 2 + G.R * 0.12, G.R * (0.26 + rng() * 0.14), { color: col, rng, irregular: 0.4, squash: 0.6, rot: rng() * 0.4, sides: 8 });
      }
    }
  }
  const order = G.fans.filter((f) => !f.soft).sort((a, b) => b.row - a.row);
  for (const f of order) {
    const v = f.row === 0 ? dark : dark + 0.03;
    const nn = Math.max(6, Math.round(P.needles * (0.85 + rng() * 0.3) * (f.row === 2 ? 0.8 : 1)));
    needleFan(ctx, f.x, f.y, f.R, f.a, (170 + rng() * 34) * DEG, nn, Math.max(0.9, f.R * P.needleWidth * (f.row === 2 ? 1.15 : 1)), ink(v, 1), rng, f.row === 1 ? 0.36 : P.core);
  }
}

// Snow cushion resting on a pad: a bumpy white dome over the upper part of the pad, its lower
// edge wavy so dark needles show beneath; shaded with a soft cool grey toward the underside.
function snowGeom(pad, P, rng) {
  const s = P.snow;
  const { x, y, w, h } = pad;
  const R = pad.R || P.R;
  const cw = w * (0.62 + 0.28 * s) * (0.9 + rng() * 0.2);
  const top0 = y - h * (0.5 + 0.2 * s);             // dome top
  const base = y - h * (0.1 - 0.15 * s);            // lower edge of the cushion
  const nb = Math.max(2, Math.round(cw / (R * (1.3 + rng() * 0.5))));
  const bumps = [];
  for (let i = 0; i < nb; i++) {
    const e = ((i + 0.5) / nb) * 2 - 1 + (rng() - 0.5) * 0.3 / nb;
    const env = Math.sqrt(Math.max(0, 1 - e * e * 0.8));
    bumps.push({ x: x + e * cw * 0.5, y: mix(base, top0, env * 0.85) + (rng() - 0.5) * R * 0.25, r: R * (0.6 + rng() * 0.45) * (0.7 + 0.3 * env) * (0.8 + 0.3 * s) });
  }
  const body = { x: x + (rng() - 0.5) * cw * 0.1, y: mix(base, top0, 0.42), rx: cw * 0.5, ry: (base - top0) * 0.42 };
  const drips = [];
  const nd = Math.round(nb * 1.2);
  for (let i = 0; i < nd; i++) drips.push({ e: (rng() * 2 - 1) * 0.8, d: R * (0.0 + rng() * 0.3), r: R * (0.2 + rng() * 0.25) });
  return { x, cw, base, bumps, body, drips, R };
}
function snowShape(g, sg, grow = 1, lift = 0, dx = 0) {
  const el = (x, y, rx, ry) => { g.beginPath(); g.ellipse(x + dx, y - lift, rx * grow, ry * grow, 0, 0, Math.PI * 2); g.fill(); };
  el(sg.body.x, sg.body.y, sg.body.rx, sg.body.ry);
  for (const b of sg.bumps) el(b.x, b.y, b.r, b.r * 0.8);
  for (const d of sg.drips) el(sg.x + d.e * sg.cw * 0.5, sg.base + d.d * 0.3 - sg.R * 0.1, d.r, d.r * 0.7);
}
function paintSnowPads(ctx, pads, P, rng) {
  const geoms = pads.map((p) => snowGeom(p, P, rng));
  const R = P.R;
  // cool grey cushion (its underside stays grey), white body lifted up-left with a soft falloff
  blurredPass(ctx, R * 0.04, 1, (g) => { g.fillStyle = rgba([210, 214, 221], 1); for (const sg of geoms) snowShape(g, sg, 1.0, 0); });
  blurredPass(ctx, R * 0.09, 1, (g) => { g.fillStyle = rgba([252, 252, 251], 1); for (const sg of geoms) snowShape(g, sg, 0.9, R * 0.22, -R * 0.05); });
  // dark needles poking out from under the cushion's lower edge, and a few through its top
  const col = P.ink(0.03, 1);
  for (const sg of geoms) {
    const n = Math.max(2, Math.round(sg.cw / (R * 0.9)));
    for (let i = 0; i < n; i++) {
      const e = ((i + 0.5) / n) * 2 - 1 + (rng() - 0.5) * 0.3 / n;
      const fx = sg.x + e * sg.cw * 0.5, fy = sg.base + R * (0.05 + rng() * 0.25);
      needleFan(ctx, fx, fy, R * (0.55 + rng() * 0.3), Math.PI / 2 - e * 1.0 + (rng() - 0.5) * 0.5, (150 + rng() * 40) * DEG, 7, Math.max(0.8, R * P.needleWidth * 0.9), col, rng, 0.3);
    }
    const nt = (rng() * 2.2) | 0;
    for (let i = 0; i < nt; i++) {
      const b = sg.bumps[(rng() * sg.bumps.length) | 0];
      needleFan(ctx, b.x + (rng() - 0.5) * b.r, b.y - b.r * 0.35, R * (0.4 + rng() * 0.25), -Math.PI / 2 + (rng() - 0.5) * 0.8, 150 * DEG, 6, Math.max(0.8, R * P.needleWidth * 0.85), col, rng, 0.25);
    }
  }
}

// Snow lying along the upper side of near-horizontal limbs: broken, tapering white strips.
function paintSnowBranch(ctx, b, P, rng, nz) {
  const { path, N, L, len } = b;
  if (b.w(0) < 3) return;
  const white = rgba([250, 250, 249], 1);
  const ph = rng() * 100;
  let run = [];
  const flush = () => {
    if (run.length > 2) {
      const pts = run.map((r) => r.p);
      const ws = run.map((r) => r.w);
      taperStroke(ctx, pts, (s) => ws[Math.min(ws.length - 1, Math.round(s * (ws.length - 1)))] * Math.pow(Math.sin(Math.PI * clamp(s * 0.9 + 0.05)), 0.5), white, rng, 0.4, 2);
    }
    run = [];
  };
  for (let i = 0; i < path.length; i++) {
    const s = L[i] / len;
    const ok = Math.abs(N[i][1]) > 0.55 && nz.n2(ph + L[i] * 0.015, 0) > 0.35 - P.snow * 0.7;
    if (!ok) { flush(); continue; }
    const up = N[i][1] < 0 ? 1 : -1;
    const wi = b.W ? b.W[i] : b.w(s);
    const th = Math.min(wi * 0.32, 7) * P.snow + 0.8;
    run.push({ p: [path[i][0] + N[i][0] * up * (wi * 0.5 - th * 0.15), path[i][1] + N[i][1] * up * (wi * 0.5 - th * 0.15)], w: th });
  }
  flush();
}

/**
 * paintPine(ctx, opts) -> tree (with .anchor). Paints a hero pine in design px.
 *
 * opts
 *   x, y          trunk base (design px)
 *   height        trunk length along the curve, px (default 500)
 *   lean          trunk tilt at the base, degrees from vertical (+ right)
 *   bend          extra turn of the trunk over its length, degrees (+ curls right; ~60-80 = overhanging)
 *   bendAt        0..1 where along the trunk the bend happens (default 0.3)
 *   gnarl         0..1 kinks, wiggles and bark knobs (default 0.5)
 *   trunkWidth    base width px (default height * 0.075); taper: top/base width ratio (0.22); flare (0.3)
 *   limbs         number of main limbs (tiers), or an explicit array [{pts:[[x,y]..], w, w1, subs, pad, noAlong, tipPad}]
 *   spine         explicit trunk polyline [[x,y]...] from base upward (overrides lean/bend)
 *   reach         -1..1 limb side bias (-1 all left, +1 all right)
 *   limbLength    main limb length as a fraction of height (0.55)
 *   limbAngle     limb launch angle from vertical, degrees (82 ~ horizontal); droop: degrees (22)
 *   limbStart     0..1 lowest limb position on the trunk (0.38)
 *   subBranches   multiplier on sub-branch count (1)
 *   padSize       foliage pad width px (height * 0.2); padAspect h/w (0.32); padDensity (1)
 *   needle        needle (fan radius) length px (padSize * 0.12); needles per fan (11); needleWidth (0.16 * needle)
 *   tone          0 = near black ink .. 1 = paper (distance)
 *   snow          0..1 snow caps on pads and limbs
 *   wet           0..1 grey wet bloom around pads (0.6); haze 0..1 hazy pads behind (0.5); backPads share (0.1)
 *   detail        0..1 (1); below ~0.4 bark texture is skipped (for small or far pines)
 *   barkTone      body value of the bark (0.7); barkDensity plates multiplier (1); knobs multiplier (1)
 *   paper         paper rgb the tones mix toward (PAPER)
 *   seed
 */
export function paintPine(ctx, o = {}) {
  const T = o.tree || buildPine(o);
  const rng = makeRng('pinepaint:' + (o.seed ?? 1));
  const nz = makeNoise('pinepaint:n:' + (o.seed ?? 1));
  const tn = o.tone ?? 0;
  const P = {
    ink: mkInk(tn, o.paper || PAPER),
    R: T.R0, padSize: T.padSize,
    needles: o.needles ?? 9,
    needleWidth: o.needleWidth ?? 0.19,
    fanSpacing: o.fanSpacing ?? 1.15,
    padStyle: o.padStyle ?? 'claw',
    crest: o.crest ?? 0.6,
    soft: o.soft ?? 0.35,
    core: o.core ?? 0.3,
    backTone: o.backTone ?? (o.snow > 0 ? 0.55 : 0.4),
    bark: o.barkTone ?? 0.8,
    barkDensity: o.barkDensity ?? 1,
    knobs: (o.knobs ?? 1) * (0.5 + (o.gnarl ?? 0.5)),
    detail: o.detail ?? 1,
    wet: o.wet ?? 0.6,
    under: o.under ?? (o.snow > 0 ? 1.4 : 0.3),
    snow: o.snow ?? 0,
  };
  for (const p of [...T.ghosts, ...T.pads]) padPrepare(p, P, rng);
  // 1. hazy back pads and ghosts, blurred
  const back = [...T.ghosts, ...T.pads.filter((p) => p.back)];
  if (back.length) blurredPass(ctx, Math.max(0.7, T.R0 * 0.05), 0.9, (g) => { for (const p of back) { paintPadSoft(g, p, P, rng); paintPad(g, p, P, rng); } });
  // 2. wet bloom under front pads
  if (P.wet > 0) {
    blurredPass(ctx, T.R0 * 0.35, 0.3 * P.wet, (g) => {
      for (const p of T.pads) {
        if (p.back) continue;
        const nb = 2 + ((rng() * 3) | 0);
        for (let i = 0; i < nb; i++) {
          const e = (rng() - 0.5) * 1.5;
          blob(g, p.x + e * p.w * 0.38, p.y - p.h * (0.1 + rng() * 0.3), p.h * (0.25 + rng() * 0.25), { color: P.ink(0.15 + rng() * 0.2, 1), rng, irregular: 0.45, squash: 0.7, rot: rng() * 3, sides: 9 });
        }
      }
    });
  }
  // 3. trunk and limbs: bodies, bark texture, contours (thick first in each pass)
  const order = T.branches.slice().sort((a, b) => b.w0 - a.w0);
  for (const b of order) prepBranch(b, rng, nz);
  linkJoins(order);
  for (const b of order.slice().reverse()) paintBody(ctx, b, P, rng);
  for (const b of order) paintBark(ctx, b, P, rng, b.skip || 0);
  for (const b of order) paintContour(ctx, b, P, rng, nz, b.skip || 0);
  // 4. twigs to pads
  for (const tw of T.twigs) taperStroke(ctx, tw.pts, (s) => tw.w * (1 - 0.4 * s) * Math.max(0.8, T.R0 / 14), P.ink(0.03, 1), rng, 0.3);
  // 5. front pads: soft wet inner fans (blurred), then the crisp structure and fans
  blurredPass(ctx, Math.max(0.6, T.R0 * 0.06), 0.95, (g) => { for (const p of T.pads) if (!p.back) paintPadSoft(g, p, P, rng); });
  for (const p of T.pads) if (!p.back) paintPad(ctx, p, P, rng);
  // 6. snow
  if (P.snow > 0) {
    for (const b of order) paintSnowBranch(ctx, b, P, rng, nz);
    paintSnowPads(ctx, T.pads.filter((p) => !p.back), P, rng);
  }
  if (o.debug) {
    ctx.save();
    ctx.lineWidth = 1.5;
    for (const b of T.branches) {
      ctx.strokeStyle = ['#f00', '#0a0', '#00f'][b.level] || '#f0f';
      ctx.beginPath(); b.path.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
    }
    for (const p of T.pads) { ctx.strokeStyle = p.back ? '#888' : '#e80'; ctx.strokeRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h); }
    ctx.restore();
  }
  return T;
}

/**
 * makePine(api, opts) -> { src, rect, anchor, tree, sway, layer(layerOpts) }
 * Bakes one pine (paintPine options) into its own card, inkified. Extra opts:
 *   scale     bake density (1; use 1.25-1.5 for z = 1 cards pushed by the camera)
 *   margin    transparent border px for sway (40)
 *   ink       inkify options or false (default { edge: 0.4, granulation: 0.18, bleed: 1.1 })
 *   swayAmp   tip sway px (4), swayFreq Hz (0.22)
 */
export function makePine(api, o = {}) {
  const T = buildPine(o);
  const m = o.margin ?? 40;
  const [bx1, by1, bx2, by2] = T.anchor.bbox;
  const rect = [Math.floor(bx1 - m), Math.floor(by1 - m), Math.ceil(bx2 - bx1 + 2 * m), Math.ceil(by2 - by1 + 2 * m)];
  let src = api.bakeCanvas(rect[2], rect[3], (ctx) => {
    ctx.translate(-rect[0], -rect[1]);
    paintPine(ctx, { ...o, tree: T });
  }, { scale: o.scale ?? 1 });
  if (o.ink !== false) {
    const inked = inkify(api, src, { edge: 0.4, granulation: 0.1, bleed: 0.8, seed: (o.seed ?? 1) % 17, ...(o.ink || {}) });
    api.engine?.freeTex?.(src);
    src = inked;
  }
  const a = T.anchor;
  const sway = { amp: o.swayAmp ?? 4, freq: o.swayFreq ?? 0.22, scale: 380, power: 1.8, anchor: a.base, radius: a.reach, bias: 0 };
  return { src, rect, anchor: a, tree: T, sway, layer: (lo = {}) => api.tex(src, { rect, sway, name: 'pine', ...lo }) };
}

// ----------------------------------------------------------------------------- small conifers
// One horizontal foliage tier: a flat dark band with a scalloped top made of small needle tufts,
// drooping slightly toward its ends; close trees get tiny needle fans along the top.
function tierClump(ctx, x, y, w, th, color, rng, { droop = 0.3, scallop = 1, detail = 0, caps = null, asym = 0 } = {}) {
  const half0 = w * 0.5;
  // asymmetric extent: one side reaches further than the other
  const halfOf = (e) => half0 * (1 + asym * Math.sign(e));
  const half = half0;
  // one continuous horizontal brush layer: a lens-shaped core (so the tier never falls apart into
  // dots) carrying irregular rounded lobes on top, smaller ones underneath and drooping end lobes
  const skew = (rng() - 0.5) * 0.3;
  const cyAt = (e) => y + droop * th * e * e + skew * th * e;
  const M = 18;
  // flat-topped thickness profile: the tier keeps its body almost to the tips
  const envOf = (e) => Math.pow(Math.max(0, 1 - Math.pow(Math.abs(e), 3)), 0.5);
  ctx.beginPath();
  for (let j = 0; j <= M; j++) {
    const e = (j / M) * 2 - 1, env = envOf(e);
    const px = x + e * halfOf(e), py = cyAt(e) - th * 0.36 * env;
    if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  for (let j = M; j >= 0; j--) {
    const e = (j / M) * 2 - 1, env = envOf(e);
    ctx.lineTo(x + e * halfOf(e) * 0.97, cyAt(e) + th * 0.3 * env + th * 0.03);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  const lob = (e, dy, r) => blob(ctx, x + e * halfOf(e), cyAt(e) + dy, r, { color, rng, irregular: 0.28, squash: 0.78 + rng() * 0.15, rot: rng() * 3, sides: 8 });
  // top lobes of irregular size
  const nT = Math.max(2, Math.round((w / Math.max(2, th * 1.25)) * scallop));
  for (let k = 0; k < nT; k++) {
    const e = ((k + 0.5) / nT) * 2 - 1 + (rng() - 0.5) * (1.1 / nT);
    const env = envOf(e);
    const r = th * (0.28 + rng() * 0.18) * (0.65 + 0.35 * env) + 0.35;
    const dy = -th * 0.22 * env;
    lob(e, dy, r);
    if (caps) caps.push([x + e * halfOf(e), cyAt(e) + dy - r * 0.45, r]);
  }
  // a few underside lobes
  for (let k = 0; k < nT * 0.35; k++) {
    const e = (rng() * 2 - 1) * 0.8;
    lob(e, th * 0.22, th * (0.12 + rng() * 0.08) + 0.3);
  }
  // drooping end lobes
  for (const s of [-1, 1]) lob(s * (0.92 + rng() * 0.08), th * (0.06 + rng() * 0.1), th * (0.19 + rng() * 0.09) + 0.35);
  if (rng() < 0.4) {
    const e = (rng() * 2 - 1) * 1.08;
    lob(e, (rng() - 0.7) * th * 0.8, th * 0.08 + 0.4);
  }
  // near trees: tiny needle fans along the top edge
  if (detail > 0.3 && th > 7) {
    const R = th * 0.55;
    const nf = Math.round((w / (R * 1.3)) * detail);
    for (let i = 0; i < nf; i++) {
      const e = (rng() * 2 - 1) * 0.9;
      const env = Math.pow(Math.max(0, 1 - e * e), 0.55);
      needleFan(ctx, x + e * half, y + droop * th * e * e - th * env * 0.35, R * (0.8 + rng() * 0.3), -Math.PI / 2 + e * 0.9, 170 * DEG, 7, Math.max(0.8, R * 0.2), color, rng, 0.3);
    }
  }
}

/**
 * paintConifer(ctx, x, y, height, opts) -> {x, y, h, top:[x,y], w}
 * Small ridge / cliff tree, base at (x, y).
 *   kind     'fir' (tiered spire), 'pine' (flat-topped umbrella pine), 'spruce' (slim, many tiers)
 *   tone     0 near black .. 1 paper (use 0.4-0.85 for distance)
 *   lean     degrees, width (relative, 1), tiers (auto)
 *   snow     0..1, paper rgb, seed or rng
 */
export function paintConifer(ctx, x, y, h, o = {}) {
  const rng = o.rng || makeRng('conifer:' + (o.seed ?? 1));
  const tn = o.tone ?? 0.05;
  const ink = mkInk(tn, o.paper || PAPER);
  const kind = o.kind || 'fir';
  const lean = (o.lean ?? (rng() - 0.5) * 8) * DEG;
  const wmul = o.width ?? 1;
  const col = ink(0.03, 1);
  const snow = o.snow ?? 0;
  const snowCaps = [];
  const detail = o.detail ?? clamp((h - 40) / 120, 0, 1) * (1 - tn);
  if (kind === 'pine') {
    // Huangshan pine: crooked trunk, 3-5 broad asymmetric tiers that stay wide up to a flat top
    const bendDir = rng() < 0.5 ? -1 : 1;
    const topX = x + Math.sin(lean) * h + bendDir * h * 0.08, topY = y - h * 0.92;
    const midX = x + bendDir * h * (0.1 + rng() * 0.06);
    taperStroke(ctx, [[x, y], [midX, y - h * 0.4], [topX, topY + h * 0.08]], (s) => h * 0.05 * (1 - 0.6 * s) + 0.7, col, rng, 0.3);
    const tiers = o.tiers ?? (3 + ((rng() * 2.4) | 0));
    const y0 = y - h * (0.32 + rng() * 0.08);
    const gap = (y0 - (topY + h * 0.06)) / Math.max(1, tiers - 1);
    let side = rng() < 0.5 ? -1 : 1;
    for (let i = 0; i < tiers; i++) {
      const f = tiers === 1 ? 1 : i / (tiers - 1);
      const ty = y0 - gap * i + (rng() - 0.5) * gap * 0.2;
      const u = clamp((y - ty) / (h * 0.92));
      const tx = u < 0.43 ? mix(x, midX, u / 0.43) : mix(midX, topX, (u - 0.43) / 0.57);
      const half = h * wmul * (0.27 * Math.pow(1 - f, 0.7) + 0.14) * (0.8 + rng() * 0.4);
      side = rng() < 0.7 ? -side : side;
      const off = side * half * (0.15 + rng() * 0.3);
      if (Math.abs(off) > half * 0.25) taperStroke(ctx, [[tx, ty + gap * 0.25], [tx + off * 0.6, ty + gap * 0.12], [tx + off, ty + gap * 0.05]], (s) => Math.max(0.6, h * 0.025 * (1 - 0.5 * s)), col, rng, 0.3);
      tierClump(ctx, tx + off, ty, half * 2, Math.min(gap * (0.68 + rng() * 0.2) + h * 0.02, h * 0.17), col, rng, { droop: 0.28, scallop: 1.1, detail, caps: snowCaps, asym: (rng() - 0.5) * 0.5 });
    }
  } else {
    // tiered spire: thin trunk, horizontal scalloped tiers narrowing to a pointed top
    const slim = kind === 'spruce' ? 0.68 : 1;
    const tiers = o.tiers ?? clamp(Math.round(h / (kind === 'spruce' ? 10 : 12)) + ((rng() * 2) | 0), 4, kind === 'spruce' ? 12 : 10);
    const topX = x + Math.sin(lean) * h, topY = y - h;
    taperStroke(ctx, [[x, y], [mix(x, topX, 0.5) + (rng() - 0.5) * h * 0.03, mix(y, topY, 0.5)], [topX, topY + h * 0.06]], (s) => h * 0.035 * (1 - 0.7 * s) + 0.6, col, rng, 0.2);
    const span = h * 0.86;
    const gap = span / tiers;
    let skewSide = rng() < 0.5 ? -1 : 1;
    for (let i = 0; i < tiers; i++) {
      const f = i / (tiers - 1);
      const ty = y - h * 0.12 - span * Math.pow(f, 0.97);
      const tx = mix(x, topX, (y - ty) / h);
      const half = h * wmul * slim * (0.25 * Math.pow(1 - f, 1.05) + 0.06) * (0.75 + rng() * 0.5);
      const th = gap * (0.95 + rng() * 0.25) + h * 0.01;
      skewSide = rng() < 0.65 ? -skewSide : skewSide;
      const skew = skewSide * half * (0.08 + rng() * 0.22);
      tierClump(ctx, tx + skew, ty, half * 2, th, col, rng, { droop: 0.35, scallop: 1, detail, caps: snowCaps, asym: (rng() - 0.5) * 0.45 });
    }
    // pointed top tuft
    taperStroke(ctx, [[topX, topY + h * 0.1], [topX + (rng() - 0.5) * h * 0.02, topY - h * 0.01]], (s) => h * 0.05 * (1 - s) + 0.5, col, rng, 0.2);
  }
  if (snow > 0) {
    // small white cushions on the scallops, a cool grey crescent under each
    const white = rgba([248, 248, 246], 1), shade = rgba([200, 204, 208], 0.9);
    for (const [cx, cy, r] of snowCaps) {
      if (rng() > 0.35 + 0.65 * snow) continue;
      const rr = r * (0.9 + 0.5 * snow);
      blob(ctx, cx, cy + rr * 0.15, rr * 1.02, { color: shade, rng, irregular: 0.25, squash: 0.62, sides: 8 });
      blob(ctx, cx, cy - rr * 0.12, rr * 0.95, { color: white, rng, irregular: 0.25, squash: 0.6, sides: 8 });
    }
  }
  return { x, y, h, top: [x + Math.sin(lean) * h, y - h], w: h * (kind === 'pine' ? 1.0 : 0.6) * wmul };
}

/**
 * paintTreeLine(ctx, pts, opts) -> [{x, y, h, kind}]
 * Crowns a ridge polyline (left to right, design px) with an irregular cluster of small conifers.
 *   height    [min, max] tree height px ([24, 56])
 *   density   trees per 100 px of ridge (1.4)
 *   clump     0..1 grouping: 0 = even spacing, 1 = tight groups with bare gaps (0.6)
 *   mix       share of 'fir' vs 'pine' kinds (0.6 fir), spruce: share of firs drawn as slim spruces (0.15)
 *   tone      base tone (0.08), toneJitter (0.12): back trees get paler
 *   rows      1..3 depth rows: back rows are smaller, paler and a little higher (2)
 *   sink      fraction of height below the ridge line (0.12)
 *   from, to  0..1 portion of the polyline to cover (0..1)
 *   snow      0..1, lean jitter degrees (8), paper rgb, seed
 */
export function paintTreeLine(ctx, pts, o = {}) {
  const seed = o.seed ?? 1;
  const rng = makeRng('treeline:' + seed);
  const nz = makeNoise('treeline:n:' + seed);
  const path = smoothPath(pts, 2);
  const L = arcs(path), len = L[L.length - 1] || 1;
  const [h0, h1] = o.height ?? [24, 56];
  const density = o.density ?? 2;
  const clumpAmt = o.clump ?? 0.55;
  const mixFir = o.mix ?? 0.6;
  const spruce = o.spruce ?? 0.15;
  const tn = o.tone ?? 0.08, tj = o.toneJitter ?? 0.12;
  const rows = o.rows ?? 2;
  const sink = o.sink ?? 0.12;
  const ground = o.ground ?? 0.6;
  const d0 = (o.from ?? 0) * len, d1 = (o.to ?? 1) * len;
  const trees = [];
  for (let r = rows - 1; r >= 0; r--) {
    const rowScale = 1 - r * 0.22, rowTone = r * 0.16, rowLift = r * 0.18;
    const ph = rng() * 100;
    let d = d0 + rng() * 40 / density;
    while (d < d1) {
      const local = density * Math.max(0, 1 + clumpAmt * 1.8 * nz.n2(ph + d / 170, r * 5.1)) * (r ? 0.7 : 1);
      if (local < 0.25) { d += 25; continue; }
      const [px, py] = pointAt(path, L, d);
      const u = rng();
      const kind = u < mixFir * (1 - spruce) ? 'fir' : u < mixFir ? 'spruce' : 'pine';
      const hh = mix(h0, h1, Math.pow(rng(), 1.4)) * rowScale * (1 + 0.25 * nz.n2(ph + d / 260, 9.3)) * (kind === 'pine' ? 0.8 : 1);
      trees.push({ x: px + (rng() - 0.5) * 6, y: py + hh * (sink - rowLift), h: hh, kind, tone: clamp(tn + rowTone + (rng() - 0.3) * tj), row: r, seed: (rng() * 1e6) | 0 });
      d += (100 / local) * (0.45 + rng() * 1.1) * (kind === 'pine' ? 1.4 : 1);
    }
  }
  const snow = o.snow ?? 0;
  for (const t of trees) {
    paintConifer(ctx, t.x, t.y, t.h, { kind: t.kind, tone: t.tone, snow, lean: (rng() - 0.5) * 2 * (o.lean ?? 8), paper: o.paper, rng: makeRng('cf:' + t.seed) });
    // a low shrubby mass at the foot roots the tree into the ridge
    if (ground > 0 && t.row === 0) {
      const ink = mkInk(clamp(t.tone + 0.04), o.paper || PAPER);
      const nb = 2 + ((rng() * 2) | 0);
      for (let i = 0; i < nb; i++) {
        const r = t.h * (0.08 + rng() * 0.1) * ground + 0.5;
        blob(ctx, t.x + (rng() - 0.5) * t.h * 0.55, t.y - r * 0.2 + rng() * t.h * 0.05, r, { color: ink(0.04, 1), rng, irregular: 0.35, squash: 0.65, rot: rng() * 3, sides: 8 });
      }
    }
  }
  return trees;
}

/**
 * makeTreeLine(api, pts, opts) -> { src, rect, trees, layer(layerOpts) }
 * Bakes paintTreeLine into its own (inkified) card. Extra opts: margin (30), scale (1),
 * ink (inkify opts | false), blur px (softness for distant ridges, 0).
 */
export function makeTreeLine(api, pts, o = {}) {
  const h1 = (o.height ?? [24, 56])[1];
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const p of pts) { x1 = Math.min(x1, p[0]); x2 = Math.max(x2, p[0]); y1 = Math.min(y1, p[1]); y2 = Math.max(y2, p[1]); }
  const m = (o.margin ?? 30) + h1 * 0.5;
  const rect = [Math.floor(x1 - m), Math.floor(y1 - h1 * 1.3 - m * 0.5), Math.ceil(x2 - x1 + 2 * m), Math.ceil(y2 - y1 + h1 * 1.6 + m)];
  let trees;
  let src = api.bakeCanvas(rect[2], rect[3], (ctx) => {
    ctx.translate(-rect[0], -rect[1]);
    if (o.blur) {
      blurredPass(ctx, o.blur, 1, (g) => { trees = paintTreeLine(g, pts, o); });
    } else trees = paintTreeLine(ctx, pts, o);
  }, { scale: o.scale ?? 1 });
  if (o.ink !== false) {
    const inked = inkify(api, src, { edge: 0.35, granulation: 0.2, bleed: 1.0, ...(o.ink || {}) });
    api.engine?.freeTex?.(src);
    src = inked;
  }
  return { src, rect, trees, layer: (lo = {}) => api.tex(src, { rect, name: 'treeline', ...lo }) };
}
