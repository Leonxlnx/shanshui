// Falling red maple leaves (ref 10): leaf painter, sprite atlas with depth-of-field blur levels,
// and a deterministic falling-leaf layer that spawns/recycles leaves as a pure function of t.
import { TAU, clamp, mix, sstep, prng, hash01, rgbCss } from './util.js';

// ------------------------------------------------------------------ leaf shape
// Leaf space: origin where the veins meet, main lobe toward -y (tip at distance 1), petiole toward +y.
const VARIANTS = [
  { lobes: [[0, 1], [50, 0.9], [-50, 0.9], [106, 0.52], [-106, 0.52]], w: 0.3, teeth: 3 },
  { lobes: [[0, 1], [47, 0.95], [-47, 0.95], [98, 0.62], [-98, 0.62], [146, 0.2], [-146, 0.2]], w: 0.27, teeth: 3 },
  { lobes: [[0, 1], [54, 0.85], [-54, 0.85], [112, 0.45], [-112, 0.45]], w: 0.34, teeth: 2 },
  { lobes: [[0, 1], [44, 0.98], [-44, 0.98], [92, 0.7], [-92, 0.7], [140, 0.28], [-140, 0.28]], w: 0.25, teeth: 3 },
  { lobes: [[0, 1], [52, 0.88], [-52, 0.88], [104, 0.5], [-104, 0.5]], w: 0.36, teeth: 2 },
  { lobes: [[0, 1], [48, 0.92], [-48, 0.92], [100, 0.58], [-100, 0.58], [150, 0.18], [-150, 0.18]], w: 0.29, teeth: 3 },
];

export function mapleOutline(variant = 0, seed = 1) {
  const V = VARIANTS[((variant % VARIANTS.length) + VARIANTS.length) % VARIANTS.length];
  const r = prng(seed * 31 + variant * 7 + 3);
  const L = V.lobes.map(([a, l]) => ({ a: a + r.range(-4, 4), l: l * r.range(0.93, 1.06) })).sort((p, q) => p.a - q.a);
  const pt = (a, d) => [Math.sin(a * Math.PI / 180) * d, -Math.cos(a * Math.PI / 180) * d];
  const out = [];
  const n = L.length;
  // sinus points between neighbouring lobes (deep notches, ~35-45% of the shorter lobe)
  const sinus = [];
  for (let i = 0; i <= n; i++) {
    const a0 = i > 0 ? L[i - 1] : { a: -180, l: 0.15 }, a1 = i < n ? L[i] : { a: 180, l: 0.15 };
    const sa = (a0.a + a1.a) / 2 + r.range(-3, 3), sr = 0.14 + 0.33 * Math.min(a0.l, a1.l) * r.range(0.9, 1.1);
    sinus.push(pt(sa, sr));
  }
  out.push(pt(180, 0.1));
  for (let i = 0; i < n; i++) {
    const lo = L[i], u = pt(lo.a, 1), nn = [-u[1], u[0]], len = lo.l, tip = pt(lo.a, len);
    const S0 = sinus[i], S1 = sinus[i + 1];
    // each flank: quadratic from the sinus to the tip, bulging out at ~40% (broad triangular lobe)
    const flank = (S, sgn) => {
      const C = [u[0] * len * 0.5 + nn[0] * V.w * 1.25 * len * sgn, u[1] * len * 0.5 + nn[1] * V.w * 1.25 * len * sgn];
      const pts = [];
      const K = 7;
      for (let k = 0; k <= K; k++) {
        const t = k / K, a = 1 - t;
        let p = [a * a * S[0] + 2 * a * t * C[0] + t * t * tip[0], a * a * S[1] + 2 * a * t * C[1] + t * t * tip[1]];
        // two small forward teeth near the tip
        if (V.teeth > 0 && k === 5 && len > 0.4) {
          const o = 0.022 * len * r.range(0.5, 1.2);
          pts.push(p);
          const q = [a * a * S[0] + 2 * a * (t + 0.07) * C[0] + (t + 0.07) ** 2 * tip[0], a * a * S[1] + 2 * a * (t + 0.07) * C[1] + (t + 0.07) ** 2 * tip[1]];
          p = [q[0] + nn[0] * o * sgn + u[0] * o * 0.6, q[1] + nn[1] * o * sgn + u[1] * o * 0.6];
        }
        if (k < K) pts.push(p);
      }
      return pts;
    };
    out.push(S0, ...flank(S0, -1).slice(1), tip, ...flank(S1, 1).slice(1).reverse());
  }
  out.push(sinus[n]);
  return { pts: out, lobes: L };
}
// Paint one maple leaf into ctx at the current transform, leaf radius 1 (scale ctx first).
// opts: color [r,g,b], back (paler underside), veins, petiole, alpha
export function paintMapleLeaf(ctx, { variant = 0, seed = 1, color = [194, 56, 38], back = false, veins = true, petiole = true, alpha = 1, px = 0.02 } = {}) {
  const { pts, lobes } = mapleOutline(variant, seed);
  const r = prng(seed * 17 + 5);
  const base = back ? [Math.min(255, color[0] + 18), Math.min(255, color[1] + 34), Math.min(255, color[2] + 22)] : color;
  const dark = [base[0] * 0.62, base[1] * 0.55, base[2] * 0.55];
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (petiole) {
    const bend = r.range(0.25, 0.55) * (r() < 0.5 ? -1 : 1), len = r.range(0.85, 1.2);
    const P0 = [0, 0.04], C = [bend * 0.15, len * 0.55], P1 = [bend, len];
    const N = 10, left = [], right = [];
    for (let k = 0; k <= N; k++) {
      const t = k / N, a = 1 - t;
      const p = [a * a * P0[0] + 2 * a * t * C[0] + t * t * P1[0], a * a * P0[1] + 2 * a * t * C[1] + t * t * P1[1]];
      const d = [2 * a * (C[0] - P0[0]) + 2 * t * (P1[0] - C[0]), 2 * a * (C[1] - P0[1]) + 2 * t * (P1[1] - C[1])], dl = Math.hypot(d[0], d[1]) || 1;
      const hw = Math.max(px * 0.6, mix(0.032, 0.012, t) * (t > 0.9 ? 1.4 : 1));
      left.push([p[0] - d[1] / dl * hw, p[1] + d[0] / dl * hw]); right.push([p[0] + d[1] / dl * hw, p[1] - d[0] / dl * hw]);
    }
    const pp = left.concat(right.reverse());
    ctx.beginPath(); ctx.moveTo(pp[0][0], pp[0][1]); for (const q of pp) ctx.lineTo(q[0], q[1]); ctx.closePath();
    ctx.fillStyle = rgbCss([dark[0] * 0.8, dark[1] * 0.8, dark[2] * 0.8], 0.92); ctx.fill();
  }
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  const g = ctx.createRadialGradient(0, 0.05, 0, 0, -0.1, 1.0);
  g.addColorStop(0, rgbCss(dark, 1));
  g.addColorStop(0.28, rgbCss(mix3(dark, base, 0.65), 1));
  g.addColorStop(0.7, rgbCss(base, 1));
  g.addColorStop(1, rgbCss([Math.min(255, base[0] + 10), base[1] + 6, base[2] + 4], 1));
  ctx.fillStyle = g; ctx.fill();
  // wet edge: pigment pooled a little darker at the rim
  ctx.strokeStyle = rgbCss(dark, back ? 0.18 : 0.32); ctx.lineWidth = Math.max(px, 0.03); ctx.stroke();
  if (veins) {
    ctx.strokeStyle = rgbCss(dark, back ? 0.25 : 0.55);
    for (const lo of lobes) {
      const a = lo.a * Math.PI / 180, L = lo.l * 0.86;
      ctx.beginPath(); ctx.moveTo(0, 0.02);
      ctx.quadraticCurveTo(Math.sin(a) * L * 0.5 + r.range(-0.03, 0.03), -Math.cos(a) * L * 0.5, Math.sin(a) * L, -Math.cos(a) * L);
      ctx.lineWidth = Math.max(px * 0.8, 0.022 * (lo.l > 0.6 ? 1 : 0.7)); ctx.stroke();
    }
  }
  ctx.restore();
}
const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

// ------------------------------------------------------------------ sprite atlas
// variants x {front, back} x blur levels, each cell S px with the leaf radius R px.
const S = 128, R = 44, OX = 64, OY = 60;
export const LEAF_BLURS = [0.45, 1.5, 3.3, 6.5]; // in sprite px (radius 44)
export function makeLeafAtlas(api, { colors = null, variants = 6, seed = 11 } = {}) {
  const cols = colors || [[196, 56, 38], [186, 48, 34], [204, 70, 44], [176, 44, 32], [200, 62, 40], [190, 58, 46]];
  const nb = LEAF_BLURS.length;
  const W = S * variants * 2, H = S * nb;
  const cv = new OffscreenCanvas(W, H), g = cv.getContext('2d');
  for (let v = 0; v < variants; v++) for (let side = 0; side < 2; side++) for (let b = 0; b < nb; b++) {
    g.save();
    g.translate((v * 2 + side) * S + OX, b * S + OY);
    if (LEAF_BLURS[b] > 0) g.filter = `blur(${LEAF_BLURS[b]}px)`;
    g.scale(R, R);
    const fadeB = [0, 0.05, 0.15, 0.26][b] ?? 0.3, c0 = cols[v % cols.length];
    const col = [mix(c0[0], 236, fadeB), mix(c0[1], 226, fadeB), mix(c0[2], 214, fadeB)];
    paintMapleLeaf(g, { variant: v, seed: seed + v, color: col, back: side === 1, px: 1 / R, veins: b < 2, alpha: [1, 1, 0.94, 0.88][b] ?? 0.85 });
    g.restore();
  }
  return { canvas: cv, S, R, OX, OY, variants, nb };
}

// Draw a leaf sprite: (x, y) leaf centre, size = radius px, rot radians, flip = cos of the tumble
// angle (sign picks front/back, magnitude squashes), tilt 0..1 squashes vertically, blur in design px.
export function drawLeafSprite(ctx, atlas, x, y, size, { variant = 0, rot = 0, flip = 1, tilt = 1, blur = 0, alpha = 1 } = {}) {
  const k = size / atlas.R;
  const bl = blur / Math.max(k, 1e-3);
  let bi = 0;
  for (let i = 1; i < LEAF_BLURS.length; i++) if (Math.abs(LEAF_BLURS[i] - bl) < Math.abs(LEAF_BLURS[bi] - bl)) bi = i;
  const side = flip < 0 ? 1 : 0;
  const sx = Math.max(0.1, Math.abs(flip)) * k, sy = k * clamp(tilt, 0.25, 1);
  const c = Math.cos(rot), s = Math.sin(rot);
  const m = ctx.getTransform();
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.transform(c * sx, s * sx, -s * sy, c * sy, x, y);
  ctx.drawImage(atlas.canvas, ((variant % atlas.variants) * 2 + side) * atlas.S, bi * atlas.S, atlas.S, atlas.S, -atlas.OX, -atlas.OY, atlas.S, atlas.S);
  ctx.restore();
  void m;
}

// ------------------------------------------------------------------ falling leaves layer
// opts:
//   region [x,y,w,h]   where leaves detach (e.g. a maple canopy); near leaves enter from nearFrom
//   nearFrom [x,y,w,h] off-frame strip the large near (blurred) leaves drift in from
//   count 16, nearCount 3, seed 1
//   fall [far, near] px/s base fall speed (40..110), wind px/s (+ = right), gust 0..1
//   size [far, near] leaf radius px, life [min,max] s per leaf before it recycles
//   blur max DOF blur px for the nearest leaves (6), colors [[r,g,b],...]
//   fade toward paper for far leaves: farFade 0.25, paper [r,g,b]
//   rect (canvas card rect, default covers region + travel), z, res, + any layer opts
export function makeFallingLeaves(api, opts = {}) {
  const {
    region = [100, 480, 300, 300], nearFrom = null, count = 16, nearCount = 3, seed = 1,
    fall = [40, 110], wind = 45, gust = 0.35, size = [5, 30], life = [6, 10], blur = 6,
    colors = null, rect = null, z = 1, res = 1, tilt = true, ...layerOpts
  } = opts;
  const atlas = makeLeafAtlas(api, { colors });
  const slots = [];
  for (let i = 0; i < count + nearCount; i++) {
    const r = prng(seed * 977 + i * 13);
    const near = i >= count;
    slots.push({ i, near, T: r.range(life[0], life[1]) * (near ? 0.75 : 1), off: r() * 20 });
  }
  const windAt = (t, x, y) => wind * (1 + gust * (0.6 * Math.sin(t * 0.37 + x * 0.002) + 0.4 * Math.sin(t * 0.91 + 1.3 + y * 0.003)));
  // closed-form-ish integration of the drift: sample a few steps (pure function of t)
  const leafAt = (sl, t) => {
    const tt = t + sl.off;
    const k = Math.floor(tt / sl.T), a = tt - k * sl.T;
    const h = (n) => hash01(seed * 101 + sl.i, k, n);
    const d = sl.near ? mix(0.82, 1, h(1)) : Math.pow(h(1), 1.6) * 0.78; // depth 0 far .. 1 near
    const sz = mix(size[0], size[1], d * d);
    const vy = mix(fall[0], fall[1], d) * mix(0.8, 1.2, h(2));
    let x0, y0;
    if (sl.near) {
      const nf = nearFrom || [region[0] - 260, region[1] - 340, region[2] + 700, 120];
      x0 = nf[0] + h(3) * nf[2]; y0 = nf[1] + h(4) * nf[3];
    } else { x0 = region[0] + h(3) * region[2]; y0 = region[1] + h(4) * region[3]; }
    // pendulum flutter: lateral swing, vertical speed pulses at twice the swing frequency
    const w = TAU * mix(0.28, 0.55, h(5)), ph = h(6) * TAU, amp = sz * mix(0.9, 2.2, h(7)) + 6;
    const steps = 6, dt = a / steps;
    let dx = 0; for (let s = 0; s < steps; s++) { const ts = t - a + (s + 0.5) * dt; dx += windAt(ts, x0, y0) * (0.55 + 0.7 * d) * dt; }
    const x = x0 + dx + amp * Math.sin(w * a + ph) - amp * Math.sin(ph);
    const y = y0 + vy * a - 0.18 * vy / w * Math.sin(2 * (w * a + ph)) + 0.18 * vy / w * Math.sin(2 * ph);
    const rock = 0.55 * Math.cos(w * a + ph);
    const rot = h(8) * TAU + rock + (h(9) - 0.5) * 0.6 * a;
    const spin = (h(10) < 0.5 ? -1 : 1) * mix(0.8, 2.6, h(11));
    const flip = Math.cos(h(12) * TAU + spin * a);
    const tl = tilt ? 0.72 + 0.28 * Math.abs(Math.cos(h(13) * TAU + 0.7 * spin * a)) : 1;
    const alpha = sstep(0, sl.near ? 0.05 : 0.6, a) * (1 - sstep(sl.T - 1.0, sl.T, a));
    const bl = d > 0.7 ? blur * sstep(0.7, 1, d) : 0;
    return { x, y, size: sz, rot, flip, tilt: tl, alpha, blur: bl, variant: Math.floor(h(14) * atlas.variants), d };
  };
  // card rect: spawn regions plus the travel during one life
  let R2 = rect;
  if (!R2) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const sl of slots) for (let t = -3; t <= 14; t += 0.2) {
      const L = leafAt(sl, t); if (L.alpha <= 0) continue;
      const m = L.size * 1.6 + L.blur * 2;
      x0 = Math.min(x0, L.x - m); y0 = Math.min(y0, L.y - m); x1 = Math.max(x1, L.x + m); y1 = Math.max(y1, L.y + m);
    }
    x0 = Math.max(x0, -200); y0 = Math.max(y0, -200); x1 = Math.min(x1, 2120); y1 = Math.min(y1, 1280);
    R2 = [Math.floor(x0), Math.floor(y0), Math.ceil(x1 - x0), Math.ceil(y1 - y0)];
  }
  const layer = api.canvas((ctx, t) => {
    const L = slots.map((sl) => leafAt(sl, t)).filter((l) => l.alpha > 0.002).sort((a, b) => a.d - b.d);
    for (const l of L) drawLeafSprite(ctx, atlas, l.x, l.y, l.size, l);
  }, { z, res, name: 'leaves', ...layerOpts, rect: R2 });
  layer.leavesAt = (t) => slots.map((sl) => leafAt(sl, t));
  layer.atlas = atlas;
  return layer;
}
