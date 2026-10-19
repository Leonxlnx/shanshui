// Painterly Canvas2D primitives shared by every element generator.
// Coordinates are design px. Every function is deterministic given its rng.

import { clamp, mix } from '../engine/rng.js';

// ---------------------------------------------------------------- palette
// Measured from the reference paintings (see docs/STYLE.md).
export const PAPER = [239, 231, 220];        // default rice paper
export const PAPER_WARM = [250, 233, 203];   // golden-hour paper (ref 02)
export const PAPER_COOL = [240, 234, 226];   // snow paper (ref 06)
export const INK = [11, 9, 6];               // warm ink black
export const VERMILION = [178, 46, 32];      // pavilion columns, maple
export const MAPLE = [196, 58, 40];          // brighter red foliage
export const GOLD = [236, 196, 120];         // sun glow (ref 02)

// Ink tone: v = 0 -> full black ink, v = 1 -> paper. Optional paper override.
export function tone(v, paper = PAPER) {
  return [mix(INK[0], paper[0], v), mix(INK[1], paper[1], v), mix(INK[2], paper[2], v)];
}
export function rgba(c, a = 1) {
  return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(a, 0, 1).toFixed(4)})`;
}
export function inkCss(v, a = 1, paper = PAPER) { return rgba(tone(v, paper), a); }

// ---------------------------------------------------------------- paths
// Catmull-Rom through pts, resampled to roughly `step` px spacing.
export function smoothPath(pts, step = 4) {
  if (pts.length < 3) {
    if (pts.length < 2) return pts.slice();
    const [a, b] = pts; const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    return Array.from({ length: n + 1 }, (_, i) => [mix(a[0], b[0], i / n), mix(a[1], b[1], i / n)]);
  }
  const out = [];
  const P = [pts[0], ...pts, pts[pts.length - 1]];
  for (let i = 1; i < P.length - 2; i++) {
    const p0 = P[i - 1], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2];
    const n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function normals(path) {
  const N = [];
  for (let i = 0; i < path.length; i++) {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    N.push([-dy / l, dx / l]);
  }
  return N;
}

function arcLengths(path) {
  const L = [0];
  for (let i = 1; i < path.length; i++) L.push(L[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  return L;
}

// Brush pressure profile: quick swell at the start, long body, taper at the end.
export const PROFILE = {
  brush: (s) => Math.pow(Math.max(0, Math.sin(Math.PI * (0.07 + 0.93 * s))), 0.5) * (1 - 0.2 * s),
  taper: (s) => 1 - s * 0.92,
  even: () => 1,
  needle: (s) => Math.pow(1 - s, 0.8) * Math.min(1, s * 8 + 0.4),
  leaf: (s) => Math.pow(Math.sin(Math.PI * Math.pow(s, 0.75)), 0.9),
};

// Filled stroke with varying width. width: number | [w0, w1] | fn(s) (s = 0..1 along path).
export function stroke(ctx, pts, { width = 4, profile = 'brush', color = INK, alpha = 1, rough = 0.15, rng = Math.random, smooth = true, step = 3 } = {}) {
  const path = smooth ? smoothPath(pts, step) : pts;
  if (path.length < 2) return;
  const N = normals(path), L = arcLengths(path), total = L[L.length - 1] || 1;
  const prof = typeof profile === 'function' ? profile : PROFILE[profile] || PROFILE.brush;
  const wf = typeof width === 'function' ? width : Array.isArray(width) ? (s) => mix(width[0], width[1], s) : () => width;
  const left = [], right = [];
  let wob = 0;
  for (let i = 0; i < path.length; i++) {
    const s = L[i] / total;
    wob = wob * 0.8 + (rng() - 0.5) * rough * 2 * 0.2;
    const hw = Math.max(0.05, 0.5 * wf(s) * prof(s) * (1 + wob));
    left.push([path[i][0] + N[i][0] * hw * (1 + (rng() - 0.5) * rough * 0.4), path[i][1] + N[i][1] * hw]);
    right.push([path[i][0] - N[i][0] * hw, path[i][1] - N[i][1] * hw * (1 + (rng() - 0.5) * rough * 0.4)]);
  }
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (let i = 1; i < left.length; i++) ctx.lineTo(left[i][0], left[i][1]);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
  ctx.fillStyle = typeof color === 'string' ? color : rgba(color, alpha);
  ctx.fill();
}

// Dry-brush: many thin bristles across the stroke width, broken by gaps where the brush runs dry.
export function dryStroke(ctx, pts, { width = 12, bristles = 10, color = INK, alpha = 0.8, dry = 0.4, rng = Math.random, noise = null, profile = 'brush', step = 3 } = {}) {
  const path = smoothPath(pts, step);
  if (path.length < 2) return;
  const N = normals(path), L = arcLengths(path), total = L[L.length - 1] || 1;
  const prof = typeof profile === 'function' ? profile : PROFILE[profile] || PROFILE.brush;
  ctx.lineCap = 'round';
  for (let b = 0; b < bristles; b++) {
    const off = (b / Math.max(1, bristles - 1) - 0.5) + (rng() - 0.5) * 0.15;
    const bw = (width / bristles) * (0.6 + rng() * 0.9);
    const ba = alpha * (0.5 + rng() * 0.5);
    const phase = rng() * 1000;
    const dryEdge = Math.abs(off) * 2; // edges run dry first
    ctx.strokeStyle = typeof color === 'string' ? color : rgba(color, ba);
    ctx.lineWidth = bw;
    let drawing = false;
    ctx.beginPath();
    for (let i = 0; i < path.length; i++) {
      const s = L[i] / total;
      const n = noise ? noise.n2(L[i] * 0.045 + phase, b * 3.1) : Math.sin(L[i] * 0.07 + phase) * 0.6 + (rng() - 0.5) * 0.8;
      const gap = n * 0.5 + 0.5 < dry * (0.55 + dryEdge * 0.6 + s * 0.6);
      const w = width * prof(s);
      const x = path[i][0] + N[i][0] * off * w, y = path[i][1] + N[i][1] * off * w;
      if (gap) { if (drawing) { ctx.stroke(); ctx.beginPath(); drawing = false; } continue; }
      if (!drawing) { ctx.moveTo(x, y); drawing = true; } else ctx.lineTo(x, y);
    }
    if (drawing) ctx.stroke();
  }
}

// Irregular ink blob (moss dot, leaf dab, foliage clump).
export function blob(ctx, x, y, r, { color = INK, alpha = 1, rng = Math.random, irregular = 0.3, squash = 1, rot = 0, sides = 9 } = {}) {
  const n = sides + ((rng() * 4) | 0);
  const ph = rng() * 6.283;
  const P = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (1 + (rng() - 0.5) * irregular * 2 + Math.sin(a * 2 + ph) * irregular * 0.3);
    const px = Math.cos(a) * rr, py = Math.sin(a) * rr * squash;
    P.push([x + px * Math.cos(rot) - py * Math.sin(rot), y + px * Math.sin(rot) + py * Math.cos(rot)]);
  }
  // smooth closed curve through the midpoints of the jittered polygon
  ctx.beginPath();
  const m = (i) => { const a = P[i % n], b = P[(i + 1) % n]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
  let s0 = m(n - 1);
  ctx.moveTo(s0[0], s0[1]);
  for (let i = 0; i < n; i++) { const e = m(i); ctx.quadraticCurveTo(P[i][0], P[i][1], e[0], e[1]); }
  ctx.closePath();
  ctx.fillStyle = typeof color === 'string' ? color : rgba(color, alpha);
  ctx.fill();
}

// Cluster of moss/texture dots around (x, y) within radius R.
export function dots(ctx, x, y, R, n, { size = [1.5, 4], color = INK, alpha = [0.5, 1], rng = Math.random, squash = 0.8 } = {}) {
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * R;
    blob(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d * squash, mix(size[0], size[1], rng() * rng()), { color, alpha: mix(alpha[0], alpha[1], rng()), rng, irregular: 0.35, squash: 0.7 + rng() * 0.5, rot: rng() * 3 });
  }
}

// Soft wash: fill a path with blurred edges and a slightly darker pooled rim (wet-edge).
// shape: Path2D or fn(ctx) that builds the current path.
export function wash(ctx, shape, { color = INK, alpha = 0.3, blur = 6, rim = 0.35, rimWidth = 3 } = {}) {
  ctx.save();
  ctx.filter = blur > 0 ? `blur(${blur}px)` : 'none';
  ctx.fillStyle = typeof color === 'string' ? color : rgba(color, alpha);
  if (shape instanceof Path2D) ctx.fill(shape); else { ctx.beginPath(); shape(ctx); ctx.fill(); }
  if (rim > 0) {
    ctx.filter = `blur(${Math.max(0.5, blur * 0.35)}px)`;
    ctx.strokeStyle = typeof color === 'string' ? color : rgba(color, alpha * rim);
    ctx.lineWidth = rimWidth;
    if (shape instanceof Path2D) ctx.stroke(shape); else { ctx.beginPath(); shape(ctx); ctx.stroke(); }
  }
  ctx.restore();
}

// Tileable noise pattern canvas (value noise, `cell` px) for granulation / dry texture.
const patCache = new Map();
export function noisePattern(ctx, { cell = 3, size = 256, seed = 7, contrast = 1 } = {}) {
  const key = cell + ':' + size + ':' + seed + ':' + contrast;
  let cv = patCache.get(key);
  if (!cv) {
    cv = new OffscreenCanvas(size, size);
    const g = cv.getContext('2d');
    const img = g.createImageData(size, size);
    let s = seed >>> 0;
    const rnd = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const gw = Math.ceil(size / cell);
    const grid = Array.from({ length: gw * gw }, rnd);
    const at = (i, j) => grid[((j % gw + gw) % gw) * gw + ((i % gw + gw) % gw)];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy);
      let u = fx - ix, v = fy - iy; u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
      const val = mix(mix(at(ix, iy), at(ix + 1, iy), u), mix(at(ix, iy + 1), at(ix + 1, iy + 1), u), v);
      const c = clamp(0.5 + (val - 0.5) * contrast) * 255;
      const k = (y * size + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = 0; img.data[k + 3] = c;
    }
    g.putImageData(img, 0, 0);
    patCache.set(key, cv);
  }
  return ctx.createPattern(cv, 'repeat');
}

// Erode what is already drawn with noise (granulation / dry paper texture). amount 0..1.
export function granulate(ctx, x, y, w, h, { amount = 0.25, cell = 2.5, seed = 7, contrast = 2.2 } = {}) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.globalAlpha = amount;
  ctx.fillStyle = noisePattern(ctx, { cell, seed, contrast });
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// Fill a polygon with a vertical value gradient (darker at top, fading down), handy for peaks.
export function gradientFill(ctx, shape, y0, y1, c0, a0, c1, a1) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, rgba(c0, a0));
  g.addColorStop(1, rgba(c1, a1));
  ctx.fillStyle = g;
  if (shape instanceof Path2D) ctx.fill(shape); else { ctx.beginPath(); shape(ctx); ctx.fill(); }
}
