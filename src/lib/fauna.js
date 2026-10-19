// fauna.js - red-crowned cranes in flight, falling maple leaves, snowfall, distant birds.
// (work in progress; full usage doc at the end of development)

import { PAPER, INK } from './brush.js';
export { makeFallingLeaves, paintMapleLeaf, mapleOutline, makeLeafAtlas, drawLeafSprite } from './fauna/leaves.js';
export { makeSnow, SNOW_BANDS } from './fauna/snow.js';

const TAU = Math.PI * 2, DEG = Math.PI / 180;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const mix = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// small deterministic PRNG (mulberry32) for per-bird stroke jitter that never "boils" between frames
export function prng(seed) {
  let s = (Math.floor(seed * 2654435761) >>> 0) || 1;
  const r = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.range = (a, b) => a + (b - a) * r();
  return r;
}

// ------------------------------------------------------------------ colour
function makePalette(fade = 0, paper = PAPER) {
  const ink = (v, a = 1) => {
    const vv = v + (1 - v) * fade;
    return `rgba(${mix(INK[0], paper[0], vv) | 0},${mix(INK[1], paper[1], vv) | 0},${mix(INK[2], paper[2], vv) | 0},${clamp(a).toFixed(3)})`;
  };
  const white = (a = 1) => {
    const k = 1 - fade;
    const w = [Math.min(255, paper[0] + 9 * k), Math.min(255, paper[1] + 11 * k), Math.min(255, paper[2] + 14 * k)];
    return `rgba(${w[0] | 0},${w[1] | 0},${w[2] | 0},${clamp(a).toFixed(3)})`;
  };
  const red = (a = 1) => {
    const c = [204, 44, 34];
    return `rgba(${mix(c[0], paper[0], fade * 0.9) | 0},${mix(c[1], paper[1], fade * 0.9) | 0},${mix(c[2], paper[2], fade * 0.9) | 0},${clamp(a).toFixed(3)})`;
  };
  return { ink, white, red };
}

// ------------------------------------------------------------------ 2D helpers (local units, y up)
const u2 = (a) => [Math.cos(a * DEG), Math.sin(a * DEG)];
const add2 = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub2 = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul2 = (a, s) => [a[0] * s, a[1] * s];
const len2 = (a) => Math.hypot(a[0], a[1]);
const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const perp = (a) => [-a[1], a[0]];
const nrm2 = (a) => { const l = len2(a) || 1; return [a[0] / l, a[1] / l]; };
const qpt = (a, c, b, t) => { const s = 1 - t; return [s * s * a[0] + 2 * s * t * c[0] + t * t * b[0], s * s * a[1] + 2 * s * t * c[1] + t * t * b[1]]; };
const qbez = (a, c, b, n = 8) => { const o = []; for (let i = 0; i <= n; i++) o.push(qpt(a, c, b, i / n)); return o; };

function polyPath(ctx, P, close = true) {
  ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]);
  for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]);
  if (close) ctx.closePath();
}
// smooth curve through points (quadratic midpoints)
function curvePath(ctx, P, close = true) {
  const n = P.length;
  ctx.beginPath();
  if (!close) {
    ctx.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < n - 1; i++) { const m = lerp2(P[i], P[i + 1], 0.5); ctx.quadraticCurveTo(P[i][0], P[i][1], m[0], m[1]); }
    ctx.lineTo(P[n - 1][0], P[n - 1][1]);
    return;
  }
  const m0 = lerp2(P[n - 1], P[0], 0.5);
  ctx.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) { const m = lerp2(P[i], P[(i + 1) % n], 0.5); ctx.quadraticCurveTo(P[i][0], P[i][1], m[0], m[1]); }
  ctx.closePath();
}
// tapered ribbon outline along a polyline, wf(s) = full width at arclength fraction s
function ribbon(pts, wf) {
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + len2(sub2(pts[i], pts[i - 1])));
  const tot = L[L.length - 1] || 1;
  const left = [], right = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const d = nrm2(sub2(b, a)), hw = wf(L[i] / tot) * 0.5;
    left.push([pts[i][0] - d[1] * hw, pts[i][1] + d[0] * hw]);
    right.push([pts[i][0] + d[1] * hw, pts[i][1] - d[0] * hw]);
  }
  return left.concat(right.reverse());
}

// ------------------------------------------------------------------ wingbeat keyframes
// Wings are painted from 2D keyframes in the crane's local frame (origin = body centre, x toward
// the head, y up, unit = crane length bill-tip..toe-tip). Each key describes the projected wing:
//   root/tail: leading/trailing edge roots on the back; aA,lA: arm (root -> wrist) angle (deg) and
//   length; bulge: leading-edge curvature; aH,lH: outer primary from the wrist; fan: angle from the
//   outer to the inner primary; pin: inner primary length ratio; cwA,cwL: chord vector at the wrist
//   (wrist -> trailing edge); band: black secondary fraction of the chord; shade: grey wash amount.
// Eight keys per beat at phase 0, 1/8 ... 7/8: 0 = top of the upstroke (the painted pose of refs
// 01/04/09), 2/8 = wings level, 4/8 = bottom of the downstroke, 6/8 = mid-upstroke (hands folded
// back). The near wing foreshortens as it sweeps past the viewer, and its hand angle turns a full
// clockwise loop per beat (forward-up -> down -> folded back -> up), hence DRIFT -360 on that channel.
const KEYS = ['rx', 'ry', 'tx', 'ty', 'aA', 'lA', 'bulge', 'aH', 'lH', 'fan', 'pin', 'cwA', 'cwL', 'band', 'shade', 'hand', 'wbi'];
const ANG = new Set(['aA', 'aH', 'cwA', 'fan']);
const PRIM_LEN = [1, 1.05, 0.96, 0.76, 0.55, 0.37, 0.19]; // outer -> inner primary lengths (ref 01)
const table = (T, n = 8) => Array.from({ length: n }, (_, i) => KEYS.map((k) => (Array.isArray(T[k]) ? T[k][i] : T[k])));
const FAR_T = {
  //      top    1/8    level  3/8    bottom 5/8    mid-up 7/8
  rx:    [0.064, 0.068, 0.075, 0.07, 0.062, 0.066, 0.072, 0.066],
  ry:    [0.058, 0.057, 0.055, 0.052, 0.05, 0.052, 0.055, 0.058],
  tx:    [-0.125, -0.122, -0.12, -0.11, -0.1, -0.105, -0.115, -0.123],
  ty:    [0.062, 0.06, 0.058, 0.054, 0.05, 0.053, 0.058, 0.062],
  aA:    [117, 140, 170, 198, 222, 200, 148, 126],
  lA:    [0.30, 0.27, 0.21, 0.22, 0.21, 0.2, 0.22, 0.27],
  bulge: [0.022, 0.02, 0.012, 0.006, 0.0, 0.006, 0.014, 0.02],
  aH:    [104, 125, 172, 205, 218, 212, 188, 142],
  lH:    [0.225, 0.23, 0.25, 0.24, 0.24, 0.2, 0.2, 0.21],
  fan:   [27, 30, 35, -15, -28, -12, 15, 22],
  pin:   [0.3, 0.3, 0.35, 0.35, 0.35, 0.5, 0.5, 0.4],
  cwA:   [214, 222, 222, 172, 140, 165, 215, 214],
  cwL:   [0.13, 0.12, 0.1, 0.09, 0.09, 0.07, 0.09, 0.115],
  band:  0.5,
  shade: [0.5, 0.55, 0.6, 0.7, 0.75, 0.7, 0.6, 0.55],
  hand:  0.05,
  wbi:   0.95,
};
const NEAR_T = {
  rx:    [0.155, 0.14, 0.12, 0.11, 0.1, 0.11, 0.13, 0.15],
  ry:    [0.075, 0.065, 0.045, 0.04, 0.04, 0.045, 0.06, 0.072],
  tx:    [0.11, 0.08, 0.02, -0.02, -0.04, -0.01, 0.06, 0.1],
  ty:    [0.085, 0.07, 0.04, 0.035, 0.03, 0.04, 0.065, 0.08],
  aA:    [56, 28, -35, -68, -82, -20, 48, 62],
  lA:    [0.173, 0.13, 0.09, 0.17, 0.24, 0.14, 0.12, 0.16],
  bulge: [0.008, 0.005, 0, -0.01, -0.015, -0.008, 0, 0.006],
  aH:    [68, 45, -48, -80, -92, -130, -195, -250],
  lH:    [0.205, 0.17, 0.15, 0.22, 0.26, 0.18, 0.16, 0.18],
  fan:   [-19, -20, -25, -25, -25, -15, 15, 0],
  pin:   [1, 0.95, 0.8, 0.7, 0.7, 0.8, 0.9, 1],
  cwA:   [170, 172, 185, 180, 175, 175, 200, 182],
  cwL:   [0.149, 0.13, 0.15, 0.13, 0.13, 0.1, 0.08, 0.11],
  band:  0.25,
  shade: [0, 0, 0.04, 0.06, 0.08, 0.06, 0.03, 0],
  hand:  0.02,
  wbi:   1,
};
const FAR_KEYS = table(FAR_T), NEAR_KEYS = table(NEAR_T);
const FAR_DRIFT = KEYS.map(() => 0), NEAR_DRIFT = KEYS.map((k) => (k === 'aH' ? -360 : 0));
const GLIDE_FAR = table({ ...FAR_T, rx: 0.066, ry: 0.057, tx: -0.122, ty: 0.06, aA: 134, lA: 0.28, bulge: 0.02, aH: 124, lH: 0.235, fan: 30, pin: 0.32, cwA: 218, cwL: 0.12, shade: 0.52 }, 1)[0];
const GLIDE_NEAR = table({ ...NEAR_T, rx: 0.145, ry: 0.068, tx: 0.09, ty: 0.075, aA: 38, lA: 0.15, bulge: 0.006, aH: 52, lH: 0.19, fan: -20, pin: 0.95, cwA: 172, cwL: 0.13, shade: 0 }, 1)[0];

function catmull(k0, k1, k2, k3, t) {
  const t2 = t * t, t3 = t2 * t;
  return k0.map((_, i) => 0.5 * (2 * k1[i] + (-k0[i] + k2[i]) * t + (2 * k0[i] - 5 * k1[i] + 4 * k2[i] - k3[i]) * t2 + (-k0[i] + 3 * k1[i] - 3 * k2[i] + k3[i]) * t3));
}
// periodic Catmull-Rom over the keys; drift[c] is added per wrap so looping channels stay continuous
function sampleKeys(keys, drift, q) {
  const n = keys.length, f = ((q % 1) + 1) % 1 * n, i = Math.floor(f), t = f - i;
  const at = (j) => { const w = Math.floor(j / n), k = keys[((j % n) + n) % n]; return w ? k.map((v, c) => v + drift[c] * w) : k; };
  return catmull(at(i - 1), at(i), at(i + 1), at(i + 2), t);
}
const toObj = (arr) => { const o = {}; KEYS.forEach((k, i) => (o[k] = arr[i])); return o; };
const mixKey = (a, b, g) => a.map((v, i) => { let w = b[i]; if (ANG.has(KEYS[i])) w += 360 * Math.round((v - w) / 360); return mix(v, w, g); });

// phase p in [0,1): 0 = wings high (painted pose), 0.5 = bottom of the downstroke.
// glide 0..1 blends toward a held glide pose (wings spread, slight dihedral).
export function cranePose(phase, glide = 0) {
  const p0 = ((phase % 1) + 1) % 1;
  const p = p0 - 0.3 * Math.sin(TAU * p0) / TAU; // linger on the painted top pose, quicker downstroke
  let far = sampleKeys(FAR_KEYS, FAR_DRIFT, p), near = sampleKeys(NEAR_KEYS, NEAR_DRIFT, p);
  const g = sstep(0, 1, clamp(glide));
  if (g > 0) { far = mixKey(far, GLIDE_FAR, g); near = mixKey(near, GLIDE_NEAR, g); }
  return { far: toObj(far), near: toObj(near), bob: Math.cos(TAU * p) * (1 - g), sv: Math.sin(TAU * p) * (1 - g) };
}

// ------------------------------------------------------------------ pigment grain
// Tileable value-noise alpha texture (paper tooth) used to break up ink a little.
let grainCv = null;
function grainCanvas() {
  if (grainCv) return grainCv;
  const N = 128, cv = new OffscreenCanvas(N, N), g = cv.getContext('2d');
  const img = g.createImageData(N, N), r = prng(4242);
  const lat = (c) => { const n = N / c, a = Array.from({ length: n * n }, () => r()); return (x, y) => a[((y % n + n) % n) * n + ((x % n + n) % n)]; };
  const oct = [[2, 0.5], [4, 0.3], [8, 0.2]].map(([c, w]) => ({ c, w, f: lat(c) }));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let v = 0;
    for (const o of oct) {
      const fx = x / o.c, fy = y / o.c, ix = Math.floor(fx), iy = Math.floor(fy);
      let u = fx - ix, w = fy - iy; u = u * u * (3 - 2 * u); w = w * w * (3 - 2 * w);
      v += o.w * mix(mix(o.f(ix, iy), o.f(ix + 1, iy), u), mix(o.f(ix, iy + 1), o.f(ix + 1, iy + 1), u), w);
    }
    const k = (y * N + x) * 4;
    img.data[k] = img.data[k + 1] = img.data[k + 2] = 0;
    img.data[k + 3] = clamp((v - 0.42) * 2.6) * 255;
  }
  g.putImageData(img, 0, 0);
  grainCv = cv;
  return cv;
}

// ------------------------------------------------------------------ crane painter
let scratch = null, sctx = null;
// Draws one red-crowned crane in flight into ctx (design px; works with any scale+translate
// transform on ctx). (x, y) = body centre, size = bill-tip to toe-tip length in px, phase =
// wingbeat phase (see cranePose). The bird is painted into a scratch canvas, eroded with pigment
// grain and composited with a slight softening blur (ink soaked into paper).
export function drawCrane(ctx, x, y, size, phase = 0, opts = {}) {
  const soft = opts.soft ?? 0.45, grain = opts.grain ?? 0.07;
  if ((soft <= 0 && grain <= 0) || size < 6) return paintCrane(ctx, x, y, size, phase, opts);
  const m = ctx.getTransform();
  const k = Math.hypot(m.a, m.b);
  const half = Math.ceil(size * 0.7 * k) + 4, W2 = half * 2;
  if (!scratch || scratch.width < W2 || scratch.height < W2) {
    const s = Math.max(W2, scratch ? scratch.width : 0);
    scratch = new OffscreenCanvas(s, s); sctx = scratch.getContext('2d');
  }
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.globalCompositeOperation = 'source-over'; sctx.globalAlpha = 1; sctx.filter = 'none';
  sctx.clearRect(0, 0, W2, W2);
  sctx.setTransform(k, 0, 0, k, half - x * k, half - y * k);
  paintCrane(sctx, x, y, size, phase, opts);
  if (grain > 0) {
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.globalCompositeOperation = 'destination-out'; sctx.globalAlpha = grain;
    const pat = sctx.createPattern(grainCanvas(), 'repeat');
    const gs = Math.max(0.5, k * 0.6), so = ((opts.seed || 1) * 37) % 128;
    pat.setTransform(new DOMMatrix([gs, 0, 0, gs, -so * gs, -so * 0.7 * gs]));
    sctx.fillStyle = pat; sctx.fillRect(0, 0, W2, W2);
    sctx.globalCompositeOperation = 'source-over'; sctx.globalAlpha = 1;
  }
  const dx = m.a * x + m.c * y + m.e, dy = m.b * x + m.d * y + m.f;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (soft > 0) ctx.filter = `blur(${(soft * k).toFixed(2)}px)`;
  ctx.drawImage(scratch, 0, 0, W2, W2, dx - half, dy - half, W2, W2);
  ctx.restore();
}

function paintCrane(ctx, x, y, size, phase = 0, opts = {}) {
  const { heading = -0.24, flip = false, glide = 0, fade = 0, paper = PAPER, alpha = 1, seed = 1, pose: poseOverride = null } = opts;
  const P = poseOverride || cranePose(phase, glide);
  const pal = makePalette(fade, paper);
  const R = prng(seed * 7919 + 13);
  const jit = Array.from({ length: 96 }, () => R() - 0.5);
  const px = 1 / size; // one design px in local units

  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.rotate(heading * (flip ? -1 : 1));
  ctx.scale(flip ? -size : size, -size);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  const by = -P.bob * 0.012; // body rises during the downstroke
  const hd = -P.bob * 0.004; // the head is stabilised and moves less

  // ---------- wing geometry from a key
  const wingGeom = (Kw, jo) => {
    const root = [Kw.rx, Kw.ry + by], tail = [Kw.tx, Kw.ty + by];
    const dA = u2(Kw.aA), W = add2(root, mul2(dA, Kw.lA));
    const cw = mul2(u2(Kw.cwA), Kw.cwL), Wt = add2(W, cw);
    let nOut = perp(dA); if (nOut[0] * cw[0] + nOut[1] * cw[1] > 0) nOut = mul2(nOut, -1);
    const leC = add2(lerp2(root, W, 0.5), mul2(nOut, Kw.bulge));
    const dH = u2(Kw.aH);
    const Hd = add2(W, mul2(dH, Kw.lH * Kw.hand));
    const tip0 = add2(W, mul2(dH, Kw.lH));
    const outerLen = len2(sub2(tip0, Hd));
    // trailing edge of the secondaries: tail -> Wt, slightly convex toward the trailing side
    const teC = add2(lerp2(tail, Wt, 0.5), mul2(nrm2(cw), 0.015));
    const ns = 7;
    const LE = (s) => qpt(root, leC, W, s), TE = (s) => qpt(tail, teC, Wt, s);
    const sec = [];
    for (let i = 0; i <= ns; i++) {
      const s = i / ns;
      sec.push({ le: LE(s), te: TE(s), ib: lerp2(LE(s), TE(s), 1 - Kw.band) });
    }
    // serrated trailing edge: feather tips with notches between
    const serr = [];
    for (let i = 0; i < ns; i++) {
      const s0 = i / ns, s1 = (i + 1) / ns;
      const a = TE(s0 + 0.001), b = TE(s1 - 0.001);
      const mid = lerp2(a, b, 0.5);
      const inward = sub2(lerp2(LE((s0 + s1) / 2), TE((s0 + s1) / 2), 0.78), mid);
      serr.push(a, add2(lerp2(a, b, 0.62), mul2(inward, 0.0)), add2(lerp2(a, b, 0.75), mul2(inward, 0.55 + jit[jo + i] * 0.3)));
    }
    serr.push(TE(1));
    // primaries: bases spread from the hand (outer) to the end of the secondaries (inner);
    // the 2nd/3rd are longest, the inner ones shorten steeply (measured on ref 01)
    const np = jo === 0 ? 7 : 5, prim = [];
    const Wb = lerp2(W, Wt, Kw.wbi);
    const q = clamp((1 - Kw.pin) / 0.81);
    for (let k = 0; k < np; k++) {
      const t = k / (np - 1);
      const base = lerp2(Hd, Wb, t);
      const dir = u2(Kw.aH + Kw.fan * Math.pow(t, 0.9) + jit[jo + 20 + k] * 3);
      const L = outerLen * mix(1, PRIM_LEN[Math.round(t * 6)], q) * (1 + jit[jo + 30 + k] * 0.07);
      const tip = add2(base, mul2(dir, L));
      const ctl = add2(lerp2(base, tip, 0.5), mul2(nrm2(cw), L * 0.13));
      prim.push({ base, tip, ctl, L });
    }
    return { root, tail, W, Wt, Hd, tip0, leC, sec, serr, prim, LE, TE, cw };
  };

  // tapered contour line (fine brush line that swells in the middle)
  const inkLine = (pts, w, color, taper = 0.5) => {
    const o = ribbon(pts, (s) => w * Math.max(0.25, Math.pow(Math.sin(Math.PI * clamp(s * 0.94 + 0.03)), taper)));
    polyPath(ctx, o); ctx.fillStyle = color; ctx.fill();
  };
  const featherW = (s) => (s < 0.4 ? 0.62 + 0.38 * (s / 0.4) : s < 0.74 ? 1 : 0.12 + 0.88 * Math.sqrt(Math.max(0, 1 - ((s - 0.74) / 0.26) ** 2)));

  const drawWing = (G, Kw, far) => {
    const fw = Math.max(px * 1.25, 0.0145); // primary feather width
    const band = [];
    for (let i = 0; i < G.sec.length; i++) band.push(G.sec[i].ib);
    for (let i = G.serr.length - 1; i >= 0; i--) band.push(G.serr[i]);
    const cov = [];
    for (let i = 0; i < G.sec.length; i++) cov.push(G.sec[i].le);
    cov.push(G.Hd);
    for (let k = 0; k < G.prim.length; k++) cov.push(lerp2(G.prim[k].base, G.prim[k].tip, far ? 0.1 : 0.04));
    for (let i = G.sec.length - 1; i >= 0; i--) cov.push(G.sec[i].ib);
    // black secondaries: a solid core plus one tapered stroke per feather, whose pointed tips make the
    // ragged trailing edge
    const secStrokes = (alphaMul) => {
      const core = [];
      for (let i = 0; i < G.sec.length; i++) core.push(G.sec[i].ib);
      for (let i = G.sec.length - 1; i >= 0; i--) core.push(lerp2(G.sec[i].ib, G.sec[i].te, 0.6));
      polyPath(ctx, core); ctx.fillStyle = pal.ink(0.035, 0.97 * alphaMul); ctx.fill();
      const ns = G.sec.length - 1;
      for (let i = 0; i < ns; i++) {
        const s = (i + 0.5) / ns;
        const ib = lerp2(G.sec[i].ib, G.sec[i + 1].ib, 0.5), te = G.TE(s);
        const sp = len2(sub2(G.TE((i + 1) / ns), G.TE(i / ns)));
        const tip = add2(te, mul2(sub2(te, ib), 0.06 + jit[96 - ns + i] * 0.1));
        const ctl = add2(lerp2(ib, tip, 0.5), mul2(nrm2(perp(sub2(tip, ib))), sp * 0.15));
        const o = ribbon(qbez(ib, ctl, tip, 6), (u) => sp * 1.3 * (u < 0.62 ? 1 : Math.sqrt(Math.max(0, 1 - (u - 0.62) / 0.38))));
        polyPath(ctx, o); ctx.fillStyle = pal.ink(0.03 + Math.abs(jit[40 + i]) * 0.06, 0.96 * alphaMul); ctx.fill();
      }
    };
    if (far) {
      // primaries: slender dark-grey feathers, lighter toward the base (inner first)
      for (let k = G.prim.length - 1; k >= 0; k--) {
        const f = G.prim[k];
        const o = ribbon(qbez(f.base, f.ctl, f.tip, 10), (s) => fw * featherW(s));
        const gr = ctx.createLinearGradient(f.base[0], f.base[1], f.tip[0], f.tip[1]);
        const v = mix(0.24, 0.36, k / 6) + Kw.shade * 0.06;
        gr.addColorStop(0, pal.ink(v + 0.3, 0.95)); gr.addColorStop(0.35, pal.ink(v + 0.06, 0.96)); gr.addColorStop(1, pal.ink(v - 0.04, 0.97));
        polyPath(ctx, o); ctx.fillStyle = gr; ctx.fill();
      }
      secStrokes(1);
      curvePath(ctx, cov); ctx.fillStyle = pal.white(1); ctx.fill();
      // grey wash on the coverts: white strip at the leading edge, darker toward the black band
      const a = G.sec[5].le, b = G.sec[5].ib;
      const gr = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
      gr.addColorStop(0, pal.ink(0.74, 0));
      gr.addColorStop(0.1, pal.ink(0.72, 0.5 + 0.35 * Kw.shade));
      gr.addColorStop(0.55, pal.ink(0.68, 0.62 + 0.35 * Kw.shade));
      gr.addColorStop(1, pal.ink(0.6, 0.72 + 0.28 * Kw.shade));
      curvePath(ctx, cov); ctx.fillStyle = gr; ctx.fill();
      // the coverts whiten toward the root so the wing melts into the white back
      { const r0 = lerp2(G.root, G.tail, 0.4), r1 = lerp2(r0, G.W, 0.42); const gw2 = ctx.createLinearGradient(r0[0], r0[1], r1[0], r1[1]);
        gw2.addColorStop(0, pal.white(0.92)); gw2.addColorStop(1, pal.white(0)); curvePath(ctx, cov); ctx.fillStyle = gw2; ctx.fill(); }
      inkLine(G.sec.map((s) => s.le).concat([G.Hd]), px * 1.0, pal.ink(0.3, 0.9));
    } else {
      // near wing: a white leaf drawn with very few fine lines (outer contour, one line per primary)
      // and the black secondaries showing as an almond at the root
      const pw = (s) => fw * 1.2 * (s < 0.55 ? 1 : 0.08 + 0.92 * Math.sqrt(Math.max(0, 1 - ((s - 0.55) / 0.45) ** 2)));
      const prims = G.prim.map((f) => ({ f, pts: qbez(f.base, f.ctl, f.tip, 10) }));
      for (const { pts } of prims) { polyPath(ctx, ribbon(pts, pw)); ctx.fillStyle = pal.white(1); ctx.fill(); }
      curvePath(ctx, cov); ctx.fillStyle = pal.white(1); ctx.fill();
      if (Kw.shade > 0) {
        curvePath(ctx, cov); ctx.fillStyle = pal.ink(0.7, Kw.shade); ctx.fill();
        for (const { pts } of prims) { polyPath(ctx, ribbon(pts, pw)); ctx.fillStyle = pal.ink(0.66, Kw.shade * 1.5); ctx.fill(); }
      }
      const lc = pal.ink(0.56 + Kw.shade * 0.1, 0.62);
      for (let k = 0; k < prims.length; k++) {
        const { f, pts } = prims[k];
        // trailing-side edge of each feather from mid-length round the tip
        const o = ribbon(pts, pw), half = o.length / 2;
        const edge = o.slice(Math.floor(half * 0.35), Math.ceil(half * 1.12));
        if (edge.length > 2) inkLine(edge, px * 0.6, lc, 0.6);
        void f;
      }
      // black almond of the secondaries/tertials at the wing root
      {
        const dA = nrm2(sub2(G.W, G.root)), c0 = lerp2(G.root, G.tail, 0.55);
        const Lp = 0.052 * clamp(Kw.band / 0.25, 0, 1.6);
        const pts = [add2(c0, mul2(dA, -0.004)), add2(c0, mul2(dA, Lp * 0.45)), add2(c0, mul2(dA, Lp))];
        const o = ribbon(curveSample(pts, 4), (s) => 0.018 * Math.pow(Math.sin(Math.PI * clamp(s * 0.92 + 0.04)), 0.7) * (1 - 0.3 * s));
        polyPath(ctx, o); ctx.fillStyle = pal.ink(0.04, 0.96); ctx.fill();
      }
      inkLine(G.serr.slice(Math.floor(G.serr.length * 0.3)), px * 0.7, pal.ink(0.55, 0.55));
      inkLine(G.sec.map((s) => s.le).concat([G.Hd, G.prim[0].tip]), px * 0.75, pal.ink(0.48, 0.7));
    }
  };

  // ---------- far wing (behind the body)
  const farG = wingGeom(P.far, 0), nearG = wingGeom(P.near, 48);
  drawWing(farG, P.far, true);

  // ---------- legs: one pale band with dark contours, dark forked feet
  const legSw = P.sv * 0.005;
  const hip = [-0.205, 0.004 + by * 0.7], knee = [-0.3, 0.003 + by * 0.3 + legSw * 0.5];
  const ankle = [-0.395, -0.001 + legSw], toe = [-0.49, -0.022 + legSw * 1.5];
  const leg = ribbon(qbez(hip, knee, ankle, 6), (s) => mix(0.026, 0.017, s));
  polyPath(ctx, leg); ctx.fillStyle = pal.ink(0.64, 0.95); ctx.fill();
  ctx.strokeStyle = pal.ink(0.22, 0.85); ctx.lineWidth = px * 0.7; ctx.stroke();
  polyPath(ctx, qbez(lerp2(hip, ankle, 0.1), knee, lerp2(hip, ankle, 0.95), 4), false);
  ctx.strokeStyle = pal.ink(0.45, 0.45); ctx.lineWidth = px * 0.45; ctx.stroke();
  {
    const d = sub2(toe, ankle), n = nrm2(perp(d));
    const foot = ribbon([lerp2(ankle, toe, -0.1), lerp2(ankle, toe, 0.45), toe], (s) => mix(0.022, 0.005, s));
    polyPath(ctx, foot); ctx.fillStyle = pal.ink(0.12, 0.95); ctx.fill();
    const tp = add2(lerp2(ankle, toe, 0.85), mul2(n, -0.016));
    polyPath(ctx, ribbon([lerp2(ankle, toe, 0.25), tp], (s) => mix(0.008, 0.003, s))); ctx.fill();
  }

  // ---------- body: compact white egg, flat grey-washed belly
  const bodyK = [
    [0.168, 0.024], [0.14, 0.058], [0.07, 0.094], [-0.04, 0.1], [-0.13, 0.084], [-0.2, 0.054], [-0.222, 0.028],
    [-0.18, 0.004], [-0.105, -0.014], [-0.025, -0.022], [0.06, -0.014], [0.132, 0.004],
  ].map((p) => [p[0], p[1] + by]);
  const body = closedSample(bodyK, 6);
  polyPath(ctx, body);
  ctx.fillStyle = pal.white(1); ctx.fill();
  ctx.save();
  polyPath(ctx, body); ctx.clip();
  // belly wash: a soft grey mass in the lower middle that fades toward the chest and the tail
  const gw = ctx.createLinearGradient(0, -0.024 + by, 0, 0.07 + by);
  gw.addColorStop(0, pal.ink(0.52, 0.85));
  gw.addColorStop(0.3, pal.ink(0.58, 0.66));
  gw.addColorStop(0.62, pal.ink(0.66, 0.22));
  gw.addColorStop(1, pal.ink(0.7, 0.0));
  ctx.fillStyle = gw; ctx.fillRect(-0.25, -0.05 + by, 0.5, 0.16);
  // the chest stays white where it meets the black neck; the rear greys into the tail tufts
  const gx = ctx.createLinearGradient(-0.22, 0, 0.17, 0);
  gx.addColorStop(0, pal.white(0)); gx.addColorStop(0.62, pal.white(0)); gx.addColorStop(0.9, pal.white(0.6)); gx.addColorStop(1, pal.white(0.8));
  ctx.fillStyle = gx; ctx.fillRect(-0.25, -0.05 + by, 0.5, 0.16);
  // pale blooms left in the wash (wet-in-wet)
  for (let i = 0; i < 2; i++) {
    ctx.beginPath(); ctx.ellipse(-0.07 + i * 0.07 + jit[60 + i] * 0.02, 0.012 + by, 0.028, 0.007, 0.05, 0, TAU);
    ctx.fillStyle = pal.white(0.32); ctx.fill();
  }
  ctx.restore();
  // lower contour taken from the silhouette itself (rear underside -> chest)
  const nb = body.length, lower = [];
  for (let i = Math.floor(nb * 0.52); i < Math.floor(nb * 0.97); i++) lower.push(body[i]);
  inkLine(lower, px * 0.8, pal.ink(0.36, 0.8), 0.7);

  // ---------- black tail plumes (tertials) over the hip: ragged feathered dabs
  // a rounded black tuft (soft body) with a few short feather tips flicking backward
  const plume = (cx, cy, rx, ry, ang, n, jo) => {
    const blobPts = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU, rr = 1 + jit[jo + i] * 0.25;
      blobPts.push([cx + Math.cos(a) * rx * 0.55 * rr, cy + Math.sin(a) * ry * rr]);
    }
    curvePath(ctx, blobPts); ctx.fillStyle = pal.ink(0.05, 0.95); ctx.fill();
    for (let i = 0; i < n; i++) {
      const t = n > 1 ? i / (n - 1) : 0.5;
      const off = mix(-ry * 0.8, ry * 0.8, t);
      const a = [cx - rx * 0.2, cy + off * 0.8];
      const b = [cx - rx * (0.85 + jit[jo + i] * 0.3), cy + off * 1.05 - ry * (0.25 + jit[jo + i + 5] * 0.3)];
      const o = ribbon(qbez(a, add2(lerp2(a, b, 0.5), [0, -ry * 0.15]), b, 5), (s) => ry * 0.9 * (s < 0.5 ? 1 : Math.sqrt(Math.max(0, 1 - (s - 0.5) / 0.5))));
      polyPath(ctx, o); ctx.fillStyle = pal.ink(0.06 + Math.abs(jit[jo + i + 9]) * 0.1, 0.92); ctx.fill();
    }
  };
  plume(-0.19, 0.03 + by, 0.08, 0.024, 0, 4, 64);
  plume(-0.145, -0.014 + by, 0.085, 0.022, 0, 4, 72);

  // ---------- neck (slender S-curve), head, crown, bill
  const neckPts = [[0.14, 0.004 + by], [0.2, 0.002 + by * 0.6 + hd * 0.4], [0.27, 0.006 + hd * 0.8], [0.325, 0.019 + hd], [0.36, 0.024 + hd]];
  const neck = ribbon(curveSample(neckPts, 4), (s) => mix(0.036, 0.018, Math.pow(s, 0.8)));
  polyPath(ctx, neck); ctx.fillStyle = pal.ink(0.03, 0.97); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0.38, 0.021 + hd, 0.022, 0.0135, 0.05, 0, TAU);
  ctx.fillStyle = pal.ink(0.03, 0.97); ctx.fill();
  // white cheek below the crown
  ctx.beginPath(); ctx.ellipse(0.369, 0.017 + hd, 0.007, 0.004, 0.3, 0, TAU);
  ctx.fillStyle = pal.white(0.9); ctx.fill();
  // red crown
  ctx.beginPath(); ctx.ellipse(0.38, 0.03 + hd, 0.026, 0.012, 0.04, 0, TAU);
  ctx.fillStyle = pal.red(0.95); ctx.fill();
  // bill: pale ivory with a dark lower line
  const bill = ribbon([[0.398, 0.016 + hd], [0.46, 0.003 + hd], [0.527, -0.014 + hd]], (s) => mix(0.013, 0.0025, s));
  polyPath(ctx, bill); ctx.fillStyle = pal.ink(0.72, 0.95); ctx.fill();
  polyPath(ctx, [[0.4, 0.011 + hd], [0.46, -0.001 + hd], [0.527, -0.014 + hd]], false);
  ctx.strokeStyle = pal.ink(0.15, 0.85); ctx.lineWidth = px * 0.8; ctx.stroke();

  // ---------- near wing (in front)
  drawWing(nearG, P.near, false);

  ctx.restore();
}

// Catmull-Rom sample of an open polyline (n sub-steps per segment)
function curveSample(pts, n = 4) {
  const out = [];
  const Q = [pts[0], ...pts, pts[pts.length - 1]];
  for (let i = 1; i < Q.length - 2; i++) {
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const p0 = Q[i - 1], p1 = Q[i], p2 = Q[i + 1], p3 = Q[i + 2];
      out.push([0, 1].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// ------------------------------------------------------------------ crane flock layer
// Deterministic flight for a few cranes. Each crane: { x, y, size, phase=0, freq=0.95 Hz, vx=60,
// vy=-8 (px/s), path=null (fn t -> [x, y] or [[t, x, y], ...] keys), arc=[amp px, period s],
// bob=0.02 (x size), pitch=-0.12 rad (nose-up bias over the path tangent), heading=null (fixed),
// glide={ every:[7,11], dur:[1.6,2.4] } | false, sink=5 (px/s while gliding), seed, fade, flip }.
// Returns an api.canvas layer whose rect tracks the flock; layer.stateAt(t) gives
// [{ x, y, heading, phase, glide, size }] for scenes that need to know where the birds are.
export function craneFlightState(c, t, tables) {
  const tb = tables;
  const ix = (t - tb.t0) / tb.dt;
  const i = Math.max(0, Math.min(tb.n - 2, Math.floor(ix)));
  const f = Math.max(-2, Math.min(3, ix - i));
  const ph = tb.phase[i] + (tb.phase[i + 1] - tb.phase[i]) * f;
  const g = Math.max(0, Math.min(1, tb.glide[i] + (tb.glide[i + 1] - tb.glide[i]) * f));
  const sk = tb.sink[i] + (tb.sink[i + 1] - tb.sink[i]) * f;
  return { phase: ph, glide: g, sink: sk };
}

function flightTables(c, seed) {
  const r = prng(seed * 131 + 7);
  const t0 = -6, t1 = 32, dt = 1 / 120, n = Math.ceil((t1 - t0) / dt) + 1;
  const phase = new Float64Array(n), glide = new Float64Array(n), sink = new Float64Array(n);
  const freq = c.freq ?? 0.95, G = c.glide === false ? null : { every: [7, 11], dur: [1.6, 2.4], ...(c.glide || {}) };
  // glide windows: planned start times; the actual start waits until the wings reach the top pose
  const plans = [];
  if (G) { let tt = 0.6 + r.range(0.2, 0.8) * G.every[0]; while (tt < t1) { plans.push({ at: tt, dur: r.range(G.dur[0], G.dur[1]) }); tt += r.range(G.every[0], G.every[1]); } }
  let p = (c.phase ?? 0) + freq * t0, gs = -1, ge = -1, pi = 0, sk = 0;
  for (let k = 0; k < n; k++) {
    const t = t0 + k * dt;
    if (gs < 0 && pi < plans.length && t >= plans[pi].at) {
      const fr = ((p % 1) + 1) % 1;
      if (fr > 0.86 && fr < 0.93) { gs = t; ge = t + plans[pi].dur; pi++; }
    }
    let g = 0;
    if (gs >= 0) {
      g = sstep(gs, gs + 0.55, t) * (1 - sstep(ge - 0.6, ge, t));
      if (t >= ge) { gs = -1; ge = -1; g = 0; }
    }
    phase[k] = p; glide[k] = g; sink[k] = sk;
    p += freq * dt * (1 - g);
    sk += (c.sink ?? 5) * g * dt;
  }
  // shift so that phase(0) = c.phase exactly (no glides are planned before t = 0.6)
  const k0 = Math.round((0 - t0) / dt), d = (c.phase ?? 0) - phase[k0];
  for (let k = 0; k < n; k++) phase[k] += d;
  return { t0, dt, n, phase, glide, sink };
}

export function makeCraneFlock(api, opts = {}) {
  const { cranes = [], z = 3, res = 1, paper, soft, grain, fade: fadeAll = 0, tRange = [-3, 14], margin = 30, ...layerOpts } = opts;
  const C = cranes.map((c, i) => {
    const seed = c.seed ?? i + 1;
    const tables = flightTables(c, seed);
    let pathFn = null;
    if (typeof c.path === 'function') pathFn = c.path;
    else if (Array.isArray(c.path)) {
      const K = c.path;
      pathFn = (t) => {
        let j = 0; while (j < K.length - 2 && t > K[j + 1][0]) j++;
        const a = K[Math.max(0, j - 1)], b = K[j], cc = K[j + 1], d = K[Math.min(K.length - 1, j + 2)];
        const u = (t - b[0]) / (cc[0] - b[0] || 1);
        const cr = (p0, p1, p2, p3) => 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
        return [cr(a[1], b[1], cc[1], d[1]), cr(a[2], b[2], cc[2], d[2])];
      };
    }
    const arc = c.arc ?? [c.size * 0.07, 9 + (seed % 4)];
    const arcPh = (seed * 1.7) % TAU;
    const arcOff = (t) => [arc[0] * 0.25 * Math.sin(TAU * t / (arc[1] * 1.37) + arcPh * 0.7), arc[0] * Math.sin(TAU * t / arc[1] + arcPh)];
    const a0 = arcOff(0);
    // (x, y) is exactly where the bird is at t = 0 (arc and bob offsets are zero there)
    const base = (t) => {
      const p = pathFn ? pathFn(t) : [c.x + (c.vx ?? 60) * t, c.y + (c.vy ?? -8) * t];
      const a = arcOff(t);
      return [p[0] + a[0] - a0[0], p[1] + a[1] - a0[1]];
    };
    const bob0 = (c.bob ?? 0.02) * c.size * Math.cos(TAU * ((c.phase ?? 0) - 0.1));
    // heading0: solve the nose-up pitch bias so the bird has exactly this heading at t = 0
    let pitch = c.pitch ?? -0.12;
    if (c.heading0 != null) { const q0 = base(-0.08), q1 = base(0.08); pitch = c.heading0 - Math.atan2(q1[1] - q0[1], Math.abs(q1[0] - q0[0]) || 1e-6) * (c.follow ?? 0.7); }
    return { c, seed, tables, base, bob0, pitch };
  });
  const stateAt = (t) => C.map(({ c, seed, tables, base, bob0, pitch }) => {
    const st = craneFlightState(c, t, tables);
    const p = base(t), q0 = base(t - 0.08), q1 = base(t + 0.08);
    const bob = (c.bob ?? 0.02) * c.size * Math.cos(TAU * (st.phase - 0.1)) * (1 - st.glide);
    const vxs = q1[0] - q0[0], vys = (q1[1] - q0[1]) + (c.sink ?? 5) * 0.16 * st.glide;
    let heading = c.heading ?? Math.atan2(vys, Math.abs(vxs) || 1e-6) * (c.follow ?? 0.7) + pitch;
    if (c.heading == null) heading = Math.max(-0.7, Math.min(0.5, heading));
    return { x: p[0], y: p[1] + bob - bob0 + st.sink, heading, phase: st.phase, glide: st.glide, size: c.size, seed, flip: c.flip ?? (vxs < 0), fade: (c.fade ?? 0) + fadeAll, c };
  });
  // fixed-size rect that follows the flock (cheap per-frame upload)
  let bw = 0, bh = 0;
  const boxAt = (t) => {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const s of stateAt(t)) { const R = s.size * 0.72; x0 = Math.min(x0, s.x - R); x1 = Math.max(x1, s.x + R); y0 = Math.min(y0, s.y - R); y1 = Math.max(y1, s.y + R); }
    return [x0, y0, x1, y1];
  };
  for (let t = tRange[0]; t <= tRange[1]; t += 0.25) { const b = boxAt(t); bw = Math.max(bw, b[2] - b[0]); bh = Math.max(bh, b[3] - b[1]); }
  bw = Math.ceil(bw + margin * 2); bh = Math.ceil(bh + margin * 2);
  const rectAt = (t) => { const b = boxAt(t); return [Math.round((b[0] + b[2]) / 2 - bw / 2), Math.round((b[1] + b[3]) / 2 - bh / 2), bw, bh]; };
  const layer = api.canvas((ctx, t) => {
    const S = stateAt(t).sort((a, b) => a.size - b.size); // smaller (farther) first
    for (const s of S) drawCrane(ctx, s.x, s.y, s.size, s.phase, { ...s.c, heading: s.heading, glide: s.glide, seed: s.seed, flip: s.flip, fade: s.fade, paper: s.c.paper ?? paper, soft: s.c.soft ?? soft, grain: s.c.grain ?? grain });
  }, { z, res, name: 'cranes', ...layerOpts, rect: rectAt(0) });
  layer.rect = (t) => rectAt(t);
  layer.stateAt = stateAt;
  return layer;
}
// sample the closed quadratic-midpoint curve used by curvePath into a polygon
function closedSample(P, n = 6) {
  const out = [], N = P.length;
  for (let i = 0; i < N; i++) {
    const a = lerp2(P[(i + N - 1) % N], P[i], 0.5), c = P[i], b = lerp2(P[i], P[(i + 1) % N], 0.5);
    for (let k = 0; k < n; k++) out.push(qpt(a, c, b, k / n));
  }
  return out;
}