// s09 local copy of src/lib/peaks.js (quality round 2): tunable fissure length (fis, fisFade),
// shadow-edge foliage reach (drip), lit-face lightness (litK), and a crisp 'cun' column style
// (style: 'cun', see inkColumn09 at the bottom) closer to the ref 09 pillars.
// Huangshan-style granite pillar peaks and layered far ranges, painted with
// Canvas2D brushwork and finished with a GPU wet-ink pass.
//
// The painters draw in COLOUR into any Canvas2D context in design px: each
// column is first filled with the paper colour (so it occludes whatever was
// painted behind it, exactly like mist separating depth planes), then inked
// (shadow-side washes, lit spindle faces with fissure contours, wet blots,
// crown foliage and ridge trees), and its base dissolves into billowy mist.
// Paint back to front.
//
//   import { paintPeak, paintRange, makePeaks, makeRange, wetInk } from '../lib/peaks.js';
//
//   // one baked card holding several clusters (back to front), with anchors:
//   const mid = makePeaks(api, {
//     rect: [500, 100, 900, 800],                    // bake area in design px (optional)
//     peaks: [
//       { x: 780, top: 190, base: 560, width: 260, cols: 3, tone: 0.18, seed: 1 },
//       { x: 960, top: 490, base: 820, width: 200, shape: 'mesa', clearTop: true, seed: 2 },
//     ],
//   });
//   layers.push(mid.layer({ z: 2.5 }));            // = api.tex(mid.src, { rect: mid.rect, z })
//   mid.anchors.tops   -> [{ x, y, w, flat }]        (summit points; flat tops for pavilions)
//   mid.anchors.ledges -> [{ x, y, side }]           (step ledges on the column sides)
//
//   // a pale far range card:
//   const far = makeRange(api, { x0: -200, x1: 2100, base: 520, top: 260, tone: 0.78, soft: 2.5, seed: 4 });
//   layers.push(far.layer({ z: 8 }));
//
//   // or paint into your own bake and finish it yourself:
//   const src = api.bakeCanvas(w, h, (ctx) => { ctx.translate(-x0, -y0); paintPeak(ctx, {...}); paintPeak(ctx, {...}); });
//   const card = wetInk(api, src, { variant: 'plain' });
//
// Peak options (paintPeak): see PEAK_DEFAULTS below. Range options: RANGE_DEFAULTS.
// Variants: 'plain' | 'golden' (warm paper, warm ink, gold haze) | 'night' (greyer faces)
//           | 'snow' (white caps and ledges, dark streaks, snow-topped trees).
// Everything is deterministic in `seed` (or a passed api.rng `rng`).

import { PAPER, PAPER_WARM, PAPER_COOL, smoothPath } from '../../lib/brush.js';
import { makeRng, makeNoise, clamp, mix, smoothstep } from '../../engine/rng.js';

const PI = Math.PI;

// ------------------------------------------------------------------ palettes
export const VARIANTS = {
  plain: { paper: PAPER, ink: [14, 12, 9], face: 0.08 },
  golden: { paper: PAPER_WARM, ink: [44, 31, 20], face: 0.07 },
  night: { paper: [226, 218, 206], ink: [13, 12, 12], face: 0.13 },
  snow: { paper: PAPER_COOL, ink: [13, 12, 12], face: 0.04, snow: true },
};

export const PEAK_DEFAULTS = {
  x: 960,          // centre x of the cluster (design px)
  top: 200,        // y of the highest summit
  base: 700,       // y where the cluster has fully dissolved into mist
  width: 260,      // overall cluster width
  cols: 0,         // number of columns (0 = from width/shape)
  columns: null,   // explicit columns [{dx, top, hw, cap, capH, lean, spread, notches, spindles, z}] (dx from x; top absolute y)
  shape: 'pillar', // 'pillar' (tall slender, ref 04) | 'dome' (broad, refs 01/03) | 'spire' (pointed) | 'mesa' (flat tops, ref 09)
  tone: 0.3,       // darkest ink value: 0 = black ink .. 1 = paper (midground 0.15-0.45, far 0.6-0.85)
  face: null,      // ink density of the lit faces (default per variant)
  fade: 0.42,      // where the mist dissolve starts, as a fraction from each column's top to base
  trees: 1,        // ridge-tree / crown-foliage density multiplier (0 = none)
  treeTone: null,  // darkest value of the trees (default a little darker than tone)
  treeSize: 1,     // ridge-tree size multiplier (trees scale with column height by default)
  wetBlur: 1.6,    // softness of the wash layer (design px at scale 1)
  detail: 1,       // stroke / blot count multiplier (lower for far peaks)
  scale: null,     // brush scale (blot and tree sizes), default from height
  shadow: 'left',  // which side of the columns is in shadow
  clearTop: false, // keep flat summits free of trees (pavilion sites); true or [column indices]
  snow: null,      // force snow treatment (default from variant)
  variant: 'plain',
  paper: null, ink: null, // colour overrides (rgb 0..255)
  seed: 1, rng: null,
};

function makeP(o) {
  const v = VARIANTS[o.variant] || VARIANTS.plain;
  const paper = o.paper || v.paper, ink = o.ink || v.ink;
  const rng = o.rng ? (o.rng.fork ? o.rng.fork('pk' + (o.seed ?? 1)) : o.rng) : makeRng('peaks:' + (o.seed ?? 1));
  const tone = o.tone ?? 0.3;
  // Ink is diluted to the peak's tone: strokes accumulate towards that value and never past it
  // (darkest accents may reach a little below 'tone'; trees use their own dilution).
  const dil = (t) => ink.map((c, i) => Math.round(mix(c, paper[i], clamp(t))));
  const ik = dil(tone * 0.82), tk = dil(o.treeTone ?? tone * 0.8);
  return {
    paper, ink, variant: o.variant || 'plain',
    snow: o.snow ?? !!v.snow,
    dm: 1,
    tdm: 1,
    treeCss: `rgb(${tk[0]},${tk[1]},${tk[2]})`,
    inkD: ik,
    face: o.face ?? v.face,
    detail: o.detail ?? 1,
    fis: o.fis ?? 1, fisFade: o.fisFade ?? 0.4, drip: o.drip ?? 1.1, litK: o.litK ?? 1,
    style: o.style ?? 'plain', washK: o.washK ?? 1, cunK: o.cunK ?? 1, edgeK: o.edgeK ?? 1, mossK: o.mossK ?? 1, valK: o.valK ?? 1,
    trees: o.trees ?? 1,
    treeSize: o.treeSize ?? 1,
    far: smoothstep(0.42, 0.85, tone),
    wetBlur: o.wetBlur ?? 1.6,
    s: o.shadow === 'right' ? 1 : -1,
    r: rng,
    nz: makeNoise('peaks:n:' + (o.seed ?? 1)),
    inkCss: `rgb(${ik[0]},${ik[1]},${ik[2]})`,
    paperCss: `rgb(${paper[0] | 0},${paper[1] | 0},${paper[2] | 0})`,
  };
}

// ------------------------------------------------------------------ primitives
// All primitives draw with the current fillStyle and set globalAlpha themselves.

// Irregular wet blot: a smooth closed curve through a jittered polygon.
// squash > 1 elongates along the (rotated) y axis.
function dab(ctx, x, y, r, a, rng, squash = 0.85, irr = 0.32, rot0 = null) {
  if (a <= 0.004 || r <= 0.05) return;
  const n = 7 + ((rng() * 3) | 0);
  const ph = rng() * 6.283, rot = rot0 ?? rng() * PI;
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const px = new Float32Array(n), py = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = (i / n) * 6.2832;
    const rr = r * (1 + (rng() - 0.5) * irr * 2 + Math.sin(t * 2 + ph) * irr * 0.4);
    const ex = Math.cos(t) * rr, ey = Math.sin(t) * rr * squash;
    px[i] = x + ex * cr - ey * sr; py[i] = y + ex * sr + ey * cr;
  }
  ctx.globalAlpha = a > 1 ? 1 : a;
  ctx.beginPath();
  ctx.moveTo((px[n - 1] + px[0]) / 2, (py[n - 1] + py[0]) / 2);
  for (let i = 0; i < n; i++) {
    const j = i + 1 === n ? 0 : i + 1;
    ctx.quadraticCurveTo(px[i], py[i], (px[i] + px[j]) / 2, (py[i] + py[j]) / 2);
  }
  ctx.fill();
}

// Flat translucent brush chip: an angular, slightly irregular parallelogram (axe-cut / hemp-fibre
// stroke) of length len and width wid, rotated ang radians from vertical.
function chip(ctx, x, y, len, wid, ang, a, rng) {
  if (a <= 0.004) return;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const ax = sa * len * 0.5, ay = ca * len * 0.5;      // half axis (vertical at ang = 0)
  const px = ca * wid * 0.5, py = -sa * wid * 0.5;     // half perpendicular
  const sk = (rng() - 0.5) * 0.6, j = () => 1 + (rng() - 0.5) * 0.5;
  const t0 = 0.55 + rng() * 0.35, t1 = 0.55 + rng() * 0.35; // tapered ends
  ctx.globalAlpha = a > 1 ? 1 : a;
  ctx.beginPath();
  ctx.moveTo(x - ax + px * t0 + ax * sk * 0.3, y - ay + py * t0 + ay * sk * 0.3);
  ctx.lineTo(x + px * j() + ax * sk * 0.2, y + py * j() + ay * sk * 0.2);
  ctx.lineTo(x + ax + px * t1, y + ay + py * t1);
  ctx.lineTo(x + ax - px * t1 * j(), y + ay - py * t1 * j());
  ctx.lineTo(x - px * j() - ax * sk * 0.2, y - py * j() - ay * sk * 0.2);
  ctx.lineTo(x - ax - px * t0, y - ay - py * t0);
  ctx.closePath();
  ctx.fill();
}

// Filled brush ribbon along pts with width profile (taper by default) and ragged edges.
const PROF = {
  taper: (s) => Math.pow(Math.min(1, s * 6 + 0.25), 0.5) * (1 - s * 0.85),
  brush: (s) => Math.pow(Math.max(0, Math.sin(PI * (0.07 + 0.93 * s))), 0.5) * (1 - 0.2 * s),
  even: () => 1,
};
function ribbon(ctx, pts, width, a, rng, { profile = 'taper', rough = 0.4, step = 3 } = {}) {
  if (a <= 0.004) return;
  const path = smoothPath(pts, step);
  const n = path.length;
  if (n < 2) return;
  const prof = PROF[profile] || profile;
  const Ls = new Float32Array(n);
  for (let i = 1; i < n; i++) Ls[i] = Ls[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  const tot = Ls[n - 1] || 1;
  const left = [], right = [];
  let wob = 0;
  for (let i = 0; i < n; i++) {
    const p0 = path[Math.max(0, i - 1)], p1 = path[Math.min(n - 1, i + 1)];
    let dx = p1[0] - p0[0], dy = p1[1] - p0[1];
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    wob = wob * 0.75 + (rng() - 0.5) * rough * 0.5;
    const hw = Math.max(0.05, 0.5 * width * prof(Ls[i] / tot) * (1 + wob));
    const jl = 1 + (rng() - 0.5) * rough * 0.5, jr = 1 + (rng() - 0.5) * rough * 0.5;
    left.push(path[i][0] - dy * hw * jl, path[i][1] + dx * hw * jl);
    right.push(path[i][0] + dy * hw * jr, path[i][1] - dx * hw * jr);
  }
  ctx.globalAlpha = a > 1 ? 1 : a;
  ctx.beginPath();
  ctx.moveTo(left[0], left[1]);
  for (let i = 2; i < left.length; i += 2) ctx.lineTo(left[i], left[i + 1]);
  for (let i = right.length - 2; i >= 0; i -= 2) ctx.lineTo(right[i], right[i + 1]);
  ctx.closePath();
  ctx.fill();
}

// Small ridge conifer (base at x,y; grows up h px). kind: 'spruce' (tiered) | 'pine' (flat pads).
// ctx.fillStyle must be the ink colour; `snowCss` (optional) paints snow on the pads.
export function paintConifer(ctx, x, y, h, { alpha = 0.9, rng, kind = 'spruce', snowCss = null, inkCss = null } = {}) {
  if (inkCss) ctx.fillStyle = inkCss;
  const lean = (rng() - 0.5) * 0.14;
  const tx = (t) => x + lean * h * t + Math.sin(t * 5 + h) * h * 0.012;
  // trunk (mostly hidden by pads)
  ribbon(ctx, [[x, y], [tx(0.5), y - h * 0.5], [tx(0.97), y - h * 0.97]], Math.max(0.8, h * 0.05), alpha * 0.9, rng, { profile: 'taper', rough: 0.2 });
  const pads = [];
  if (kind === 'pine') {
    const n = 2 + ((rng() * 2) | 0);
    for (let i = 0; i < n; i++) {
      const t = 0.5 + 0.45 * (i / Math.max(1, n - 1));
      pads.push([tx(t) + (rng() - 0.5) * h * 0.25, y - h * t, h * (0.75 - 0.25 * i / n) * (0.8 + rng() * 0.4), h * 0.13]);
    }
  } else {
    const n = Math.max(3, Math.min(7, Math.round(h / 6)));
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const w = h * (0.72 * Math.pow(1 - t, 0.85) + 0.1) * (0.8 + rng() * 0.4);
      pads.push([tx(0.22 + 0.72 * t) + (rng() - 0.5) * h * 0.08, y - h * (0.22 + 0.72 * t), w, h * (0.19 - 0.07 * t)]);
    }
  }
  for (const [px, py, w, th] of pads) {
    const k = Math.max(2, Math.round(w / Math.max(1.0, th * 0.8)));
    for (let j = 0; j < k; j++) {
      const u = j / (k - 1) - 0.5;
      const bx = px + u * w + (rng() - 0.5) * th * 0.5;
      const by = py + u * u * th * 1.6 + (rng() - 0.5) * th * 0.45;
      dab(ctx, bx, by, th * (0.8 + rng() * 0.5) * (1 - Math.abs(u) * 0.4), alpha * (0.8 + rng() * 0.25), rng, 0.42, 0.45, (rng() - 0.5) * 0.35 + u * 0.5);
    }
  }
  dab(ctx, tx(0.97), y - h * 0.99, h * 0.045 + 0.5, alpha, rng, 1.6, 0.3, 0);
  if (snowCss) {
    ctx.fillStyle = snowCss;
    for (const [px, py, w, th] of pads) {
      const k2 = Math.max(1, Math.round(w / (th * 1.6)));
      for (let j = 0; j < k2; j++) {
        const u = k2 === 1 ? 0 : j / (k2 - 1) - 0.5;
        dab(ctx, px + u * w * 0.8, py - th * 0.5 + u * u * th, th * (0.65 + rng() * 0.4), 0.92, rng, 0.45, 0.3, 0);
      }
    }
    if (inkCss) ctx.fillStyle = inkCss;
  }
}

// ------------------------------------------------------------------ geometry
function buildColumn(c, P, sc) {
  const r = P.r, nz = P.nz;
  const top = c.top, bot = c.bot, H = Math.max(10, bot - top);
  const hw = c.hw;
  const cap = c.cap || 'round';
  const lean = c.lean ?? r.range(-0.05, 0.05);
  const spread = c.spread ?? r.range(0.12, 0.4);
  const bow = c.bow ?? r.range(-0.15, 0.15);
  const s1 = r() * 100, s2 = r() * 100;
  const skew = c.skew ?? r.range(-0.45, 0.45);
  // summit: finger tips (spindle tops) whose upper envelope forms the outline, or a flat mesa top
  let tips = [];
  let ch;
  if (cap === 'flat') {
    ch = c.capH ?? hw * r.range(0.45, 0.7);
  } else {
    const single = cap === 'point' || c.tips === 1 || hw < 26 * sc;
    const tw0 = c.spindleW ? c.spindleW / 2 : clamp(hw * r.range(0.36, 0.5), 7 * sc, 42 * sc);
    const nt = single ? 1 : c.tips ?? Math.max(1, Math.round((2 * hw) / (tw0 * 2.3)));
    const tw = single || nt === 1 ? hw * 1.02 : Math.max(tw0, ((2 * hw) / nt) * 0.66);
    const mainU = clamp(skew, -0.6, 0.6);
    for (let i = 0; i < nt; i++) {
      const u = nt === 1 ? 0 : mix(-1, 1, i / (nt - 1)) * (1 - tw / hw * 0.75) + r.range(-0.06, 0.06);
      tips.push({ u, w: tw * r.range(0.85, 1.15) * (nt === 1 ? 1 : 1) });
    }
    let main = 0;
    for (let i = 1; i < nt; i++) if (Math.abs(tips[i].u - mainU) < Math.abs(tips[main].u - mainU)) main = i;
    for (let i = 0; i < nt; i++) {
      const t = tips[i];
      const d = Math.abs(t.u - tips[main].u);
      t.top = i === main ? top : top + H * clamp(r.range(0.02, 0.09) + d * r.range(0.04, 0.16), 0, 0.35);
      t.h = c.capH ?? (cap === 'point' || hw < 26 * sc ? t.w * r.range(1.4, 2.2) : t.w * r.range(1.0, 1.7));
    }
    ch = Math.max(...tips.map((t) => t.top + t.h)) - top;
  }
  const sh = top + ch;
  const notches = [];
  const nn = c.notches ?? r.int(0, 1 + Math.round(H / 300));
  for (let i = 0; i < nn; i++) notches.push({ y: mix(sh + H * 0.1, top + H * 0.6, r()), side: r.sign(), d: r.range(0.06, 0.16), len: r.range(8, 22) * sc });
  const center = (y) => c.x + lean * (y - top) + bow * hw * Math.sin(PI * clamp((y - top) / H));
  const half = (y) => hw * (1 + spread * Math.pow(clamp((y - sh) / Math.max(1, bot - sh)), 0.9));
  const step = (y, side) => { let k = 0; for (const n of notches) if (n.side === side) k += n.d * hw * smoothstep(n.y, n.y + n.len, y); return k; };
  const wob = (sd, y) => 0.07 * nz.n2(sd, y / (hw * 1.7)) + 0.03 * nz.n2(sd + 9, y / (hw * 0.4));
  const L = (y) => center(y) - half(y) * (1 + wob(s1, y)) - step(y, -1);
  const R = (y) => center(y) + half(y) * (1 + wob(s2, y)) + step(y, 1);
  const xl = L(sh), xr = R(sh), cw = xr - xl;
  for (const t of tips) t.x = mix(xl, xr, (t.u + 1) / 2);
  const tilt = cap === 'flat' ? r.range(-0.04, 0.04) : 0;
  const capPts = [];
  const N = Math.max(16, Math.round(cw / (2 * sc)));
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const x = mix(xl, xr, u);
    let y;
    if (cap === 'flat') {
      const rr = 0.36;
      const e = u < rr ? u / rr : u > 1 - rr ? (1 - u) / rr : 1;
      y = sh - ch * Math.pow(Math.max(0, 1 - (1 - e) * (1 - e)), 0.6) + tilt * (u - 0.5) * cw;
      y += nz.n2(s1 + 3, x / (14 * sc)) * 1.6 * sc;
    } else {
      y = sh;
      for (const t of tips) {
        const q = (x - t.x) / t.w;
        if (Math.abs(q) >= 1) continue;
        const ty = cap === 'point' ? t.top + t.h * Math.pow(Math.abs(q), 1.25) : t.top + t.h * (1 - Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(q), 1.25))));
        if (ty < y) y = ty;
      }
      // the outermost shoulders blend into the sides
      const edgeK = Math.min(u, 1 - u) * 2;
      y = Math.min(y, sh) + nz.n2(s1 + 3, x / (10 * sc)) * 1.5 * sc * edgeK;
    }
    capPts.push([x, y]);
  }
  const pts = [];
  const st = Math.max(3, 4 * sc);
  for (let y = bot; y > sh; y -= st) pts.push([L(y), y]);
  for (const p of capPts) pts.push(p);
  for (let y = sh + st; y <= bot; y += st) pts.push([R(y), y]);
  pts.push([R(bot), bot]);
  const path = new Path2D();
  path.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) path.lineTo(pts[i][0], pts[i][1]);
  path.closePath();
  const capY = (x) => {
    if (x <= capPts[0][0]) return capPts[0][1];
    if (x >= capPts[N][0]) return capPts[N][1];
    let lo = 0, hi = N;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (capPts[m][0] < x) lo = m; else hi = m; }
    const a = capPts[lo], b = capPts[hi];
    return mix(a[1], b[1], (x - a[0]) / Math.max(1e-6, b[0] - a[0]));
  };
  let apex = capPts[0];
  for (const p of capPts) if (p[1] < apex[1]) apex = p;
  const ledges = notches.map((n) => ({ x: n.side < 0 ? L(n.y) : R(n.y), y: n.y, side: n.side }));
  const xAt = (u, y) => (y < sh ? mix(xl, xr, (u + 1) / 2) : mix(L(y), R(y), (u + 1) / 2));
  const topAt = (u) => capY(mix(xl, xr, (u + 1) / 2));
  return { ...c, top, bot, H, hw, cap, ch, sh, center, half, L, R, capPts, path, pts, capY, apex, xl, xr, cw, ledges, xAt, topAt, notches, tips };
}

// ------------------------------------------------------------------ painting
// Spindle: a lit sub-column face (teardrop with a pointed top) inside a column, outlined on its
// shadow side by a broken fissure contour with a dark crevice beside it.
function makeSpindle(C, P, sc, uc, ya, wmax, len, light, tipH = 0) {
  const r = P.r, nz = P.nz;
  const xa = C.xAt(uc, C.sh);
  const n = Math.max(8, Math.round(len / (5 * sc)));
  const tl = tipH > 0 ? Math.min(0.6, tipH / len) : 0.32;
  const lean = r.range(-0.04, 0.04);
  const sd = r() * 50;
  const c0 = C.center(Math.max(ya, C.sh));
  const Lp = [], Rp = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const y = ya + t * len;
    const w = wmax * Math.pow(Math.min(1, t / tl), 0.6) * (1 + 0.15 * t);
    const xc = xa + lean * (y - ya) + (C.center(Math.max(y, C.sh)) - c0);
    Lp.push([xc - w * (1 + 0.14 * nz.n2(sd, y / 37)), y]);
    Rp.push([xc + w * (1 + 0.1 * nz.n2(sd + 5, y / 41)), y]);
  }
  const path = new Path2D();
  path.moveTo(Lp[0][0], Lp[0][1]);
  for (let k = 1; k <= n; k++) path.lineTo(Lp[k][0], Lp[k][1]);
  for (let k = n; k >= 0; k--) path.lineTo(Rp[k][0], Rp[k][1]);
  path.closePath();
  return { Lp, Rp, path, ya, len, n, wmax, light };
}

// wet part: lighten the face (paper showing through) and lay faint mottled washes on it
function spindleWet(w, C, P, sc, S) {
  const r = P.r;
  const { Lp, Rp, ya, len, n, wmax, light } = S;
  const g = w.createLinearGradient(0, ya, 0, ya + len);
  const pr = P.paper;
  const pcol = (a) => `rgba(${pr[0] | 0},${pr[1] | 0},${pr[2] | 0},${clamp(a, 0, 1).toFixed(3)})`;
  g.addColorStop(0, pcol(0.85 * light)); g.addColorStop(0.55, pcol(0.7 * light)); g.addColorStop(1, pcol(0.25 * light));
  w.globalAlpha = 1;
  w.fillStyle = g;
  w.fill(S.path);
  w.fillStyle = P.inkCss;
  const nm = Math.round(((wmax * len) / (60 * sc * sc)) * P.detail);
  for (let i = 0; i < nm; i++) {
    const t = Math.pow(r(), 1.3), k = Math.min(n, Math.round(t * n));
    const lf = C.life(Lp[k][1]);
    const f = Math.pow(r(), 0.8);
    const fx = P.s < 0 ? f : 1 - f; // denser towards the shadow-side contour
    chip(w, mix(Lp[k][0], Rp[k][0], fx), Lp[k][1], r.range(10, 30) * sc, r.range(3, 9) * sc, r.range(-0.3, 0.3), r.range(0.05, 0.14) * lf * (0.6 + 0.8 * (1 - f)), r);
  }
}

// crisp part: hemp-fibre streaks, fissure contour, crevice, lit-side contour, flecks
function spindleCrisp(g, C, P, sc, S) {
  const r = P.r, s = P.s;
  const { Lp, Rp, ya, len, n, wmax } = S;
  const nst = Math.round(((wmax * len) / (240 * sc * sc)) * P.detail);
  for (let i = 0; i < nst; i++) {
    const t = Math.pow(r(), 1.2) * 0.9, k = Math.min(n, Math.round(t * n));
    const f = r.range(0.1, 0.95);
    const lf = C.life(Lp[k][1]);
    if (lf < 0.08) continue;
    const l = r.range(6, 28) * sc;
    const k2 = Math.min(n, k + Math.max(1, Math.round(l / (len / n))));
    const x0 = mix(Lp[k][0], Rp[k][0], f), x1 = mix(Lp[k2][0], Rp[k2][0], f) + r.range(-1, 1) * sc;
    ribbon(g, [[x0, Lp[k][1]], [x1, Lp[k2][1]]], r.range(0.7, 1.5) * sc, r.range(0.06, 0.2) * lf, r, { profile: 'brush', rough: 0.5 });
  }
  const edge = s < 0 ? Lp : Rp;
  const other = s < 0 ? Rp : Lp;
  // crevice: dark blotchy band just outside the shadow-side contour, fading downward
  const crev = r.range(5, 11) * sc;
  for (let k = 1; k <= n * 0.85 * P.fis; k++) {
    const t = k / n;
    if (r() < 0.2) continue;
    const lf = C.life(edge[k][1]);
    if (lf < 0.05) break;
    chip(g, edge[k][0] + s * crev * r.range(0.3, 0.9), edge[k][1] + r.range(-2, 2) * sc, crev * r.range(1.6, 3.2), crev * r.range(0.7, 1.3) * (1 - t * 0.4), r.range(-0.3, 0.3), r.range(0.25, 0.55) * Math.max(0, 1 - t * 0.55 * P.fisFade) * lf, r);
  }
  // fissure contour with a small hook over the top
  const cpts = [other[2], other[1]];
  for (let k = 0; k <= n; k++) cpts.push(edge[k]);
  const reach = Math.round(cpts.length * r.range(0.6, 0.9) * P.fis);
  for (let i0 = 0; i0 < reach;) {
    const seg = 4 + ((r() * 8) | 0);
    const sp = cpts.slice(i0, Math.min(reach, i0 + seg + 1));
    const tt = (sp[0][1] - ya) / len;
    if (sp.length > 1 && r() < 0.92) {
      ribbon(g, sp.map(([x, yy]) => [x + s * r.range(1, 3) * sc, yy]), r.range(4, 9) * sc * (1 - tt * 0.5), r.range(0.5, 0.9) * Math.max(0, 1 - tt * P.fisFade) * C.life(sp[0][1]), r, { profile: 'brush', rough: 0.8 });
    }
    i0 += seg;
  }
  // lighter broken contour on the lit side
  for (let k0 = 2; k0 < n * 0.7;) {
    const seg = 3 + ((r() * 5) | 0);
    const sp = other.slice(k0, Math.min(n, k0 + seg + 1));
    if (sp.length > 1 && r() < 0.6) ribbon(g, sp, r.range(0.8, 2.2) * sc, r.range(0.25, 0.5) * C.life(sp[0][1]), r, { profile: 'brush', rough: 0.7 });
    k0 += seg + ((r() * 4) | 0);
  }
  // flecks along the contour and in vertical chains on the face
  const nf = Math.round((len / (5 * sc)) * P.detail);
  for (let i = 0; i < nf; i++) {
    const t = Math.pow(r(), 1.6) * 0.85, k = Math.min(n, Math.round(t * n));
    const near = r() < 0.8;
    const x = near ? edge[k][0] - s * r.range(-1, 6) * sc : mix(Lp[k][0], Rp[k][0], r.range(0.05, 0.6) * (s < 0 ? 1 : -1) + (s < 0 ? 0 : 1));
    const y = edge[k][1] + r.range(-3, 3) * sc;
    const lf = C.life(y);
    if (lf < 0.05) continue;
    const fl = r.range(1.2, 4.5) * sc;
    dab(g, x, y, fl, r.range(0.3, 0.75) * lf, r, r.range(1.1, 1.9), 0.55, r.range(-0.4, 0.4));
  }
}

// Ink one column into its own canvas context g (transform already set to design px).
// Washes are painted on a separate wet layer that is softened before the crisp brushwork goes on.
function inkColumn(g0, C, P, sc) {
  let g = g0;
  const r = P.r, nz = P.nz, s = P.s, D = P.detail;
  const { top, bot, H } = C;
  const fadeY = C.fadeTop;
  const life = (C.life = (y) => 1 - smoothstep(mix(top, fadeY, 0.75), mix(fadeY, bot, 0.9), y));
  const vdark = (y) => 0.6 + 0.9 * Math.exp(-((y - top) / H) * 6);
  const lit = C.lit ?? 0.45;
  const ls = (lit - 0.45) * 1.2;
  const side = (u) => smoothstep(-0.6 + ls, 0.95 + ls * 0.5, u * s); // 0 lit .. 1 shadow
  const snow = P.snow;
  const area = C.cw * H;
  const far = P.far;

  // 1. paper occluder
  g.globalAlpha = 1;
  g.fillStyle = P.paperCss;
  g.fill(C.path);

  // ---------------- wet layer ----------------
  const cv = g.canvas;
  const W = new OffscreenCanvas(cv.width, cv.height);
  const w = W.getContext('2d');
  w.setTransform(g.getTransform());
  w.fillStyle = P.inkCss;
  // 2. overall tone, darker near the top (distance flattens everything into this tone)
  const fd = P.face * (1 + 2.2 * far);
  const pg = w.createLinearGradient(0, top, 0, bot);
  const ik = P.inkD;
  const icol = (a) => `rgba(${ik[0] | 0},${ik[1] | 0},${ik[2] | 0},${clamp(a, 0, 1).toFixed(3)})`;
  pg.addColorStop(0, icol(fd * 1.6)); pg.addColorStop(0.4, icol(fd)); pg.addColorStop(1, icol(fd * 0.3));
  w.fillStyle = pg;
  w.fill(C.path);
  w.fillStyle = P.inkCss;
  // 3. broad vertical washes on the shadow side
  const nw = Math.round((C.cw / (5 * sc)) * D * (snow ? 0.5 : 1));
  for (let i = 0; i < nw; i++) {
    const u = s * (1.05 - Math.pow(r(), 0.8) * 1.6);
    const sd = side(u);
    if (r() > 0.1 + 0.9 * sd) continue;
    const y0 = C.topAt(u) - 3 * sc;
    const y1 = Math.min(bot, y0 + H * r.range(0.2, 0.7));
    const pts = [];
    for (let k = 0; k <= 4; k++) { const y = mix(y0, y1, k / 4); pts.push([C.xAt(u, y) + nz.n2(i * 3.1, y / 45) * 2 * sc, y]); }
    ribbon(w, pts, r.range(14, 32) * sc, r.range(0.08, 0.17) * (0.3 + 0.7 * sd) * life(y0), r, { profile: 'brush', rough: 0.5, step: 6 });
  }
  // 3b. body tone: large faint chips (mid greys), heavier on the shadow side
  const nwash = Math.round((area / (170 * sc * sc)) * D);
  for (let i = 0; i < nwash; i++) {
    const u = r.range(-1.1, 1.1);
    const y = mix(C.topAt(u), bot, Math.pow(r(), 1.1));
    const lf = life(y);
    if (lf < 0.03) continue;
    chip(w, C.xAt(u, y), y, r.range(22, 52) * sc, r.range(9, 20) * sc, r.range(-0.25, 0.25), r.range(0.05, 0.11) * (0.45 + 0.75 * side(u)) * vdark(y) * lf * (1 + 1.2 * far), r);
  }
  // 3c. wet patches: larger pooled strokes high on the shadow side
  const npat = Math.round((area / (900 * sc * sc)) * D * (snow ? 0.4 : 1));
  for (let i = 0; i < npat; i++) {
    const u = s * r.range(-0.2, 1.05);
    const v = Math.pow(r(), 1.6) * 0.65;
    const y = C.topAt(u) + v * H;
    const lf = life(y);
    if (r() > side(u) * lf) continue;
    chip(w, C.xAt(u, y), y, r.range(18, 38) * sc, r.range(8, 16) * sc, r.range(-0.6, 0.6), r.range(0.16, 0.36) * lf, r);
  }
  // 4. mottled mass: a lattice of slanted and vertical axe-cut chips, banded into fibres
  const nb = Math.round((area / (26 * sc * sc)) * D * (snow ? 0.55 : 1));
  const slant = -s * 0.35;
  for (let i = 0; i < nb; i++) {
    const u = r.range(-1.05, 1.05);
    const y = mix(C.topAt(u) - 3 * sc, bot, Math.pow(r(), 1.15));
    const lf = life(y);
    if (lf < 0.03) continue;
    const sd = side(u);
    const xx = C.xAt(u, y);
    const band = 0.2 + 1.4 * Math.pow(0.5 + 0.5 * nz.fbm2(xx / (13 * sc) + C.seedF, y / (80 * sc), 2), 1.5);
    if (r() > (0.5 + 0.5 * Math.pow(sd, 1.3)) * vdark(y) * lf * band) continue;
    const big = r() < 0.25;
    const k = r();
    const ang = k < 0.35 ? r.range(-0.2, 0.2) : (k < 0.7 ? 1 : -1) * r.range(0.45, 0.95) + slant * 0.3;
    chip(w, xx + nz.n2(u * 7, y / 30) * 3 * sc, y, (big ? r.range(18, 32) : r.range(11, 22)) * sc, (big ? r.range(8, 14) : r.range(5, 9)) * sc, ang,
      (big ? r.range(0.09, 0.17) : r.range(0.12, 0.26)) * (0.35 + 0.65 * sd) * lf, r);
  }
  // 5. spindles: finger-like sub-columns starting at the summit tips, separated by crevices;
  //    painted from the shadow side to the lit side, faces lighter towards the light
  const order = C.tips.length ? C.tips.slice().sort((a, b) => (a.u - b.u) * -s) : [];
  if (!order.length) {
    const sw = clamp(C.hw * r.range(0.75, 1.0), 16 * sc, 80 * sc);
    const n = Math.max(1, Math.round((C.cw * 0.9) / (sw * 0.85)));
    for (let i = 0; i < n; i++) { const f = n === 1 ? 0.5 : i / (n - 1); const u = s * mix(0.78, -0.72, f); const x = C.xAt(u, C.sh); order.push({ u, x, top: C.capY(x) + H * r.range(0.02, 0.1), w: sw * 0.5 * r.range(0.85, 1.15), h: 0 }); }
  }
  const spindles = order.map((t) => {
    const lk = 1 - side(t.u);
    const len = (bot - t.top) * r.range(0.88, 1.0);
    const light = mix(0.12, 0.68, Math.pow(lk, 0.8)) * P.litK * mix(0.3, 1, lit) * (snow ? 1.35 : 1) * (1 - 0.55 * far);
    return makeSpindle(C, P, sc, t.u, t.top, t.w * (order.length === 1 ? mix(0.6, 1.0, lit) : 1), len, light, t.h);
  });
  for (const S of spindles) spindleWet(w, C, P, sc, S);
  // soften the wet layer and lay it down inside the silhouette
  w.setTransform(1, 0, 0, 1, 0, 0);
  w.globalAlpha = 1;
  w.globalCompositeOperation = 'destination-in';
  w.setTransform(g.getTransform());
  w.fillStyle = '#000';
  w.fill(C.path);
  const kpx = g.getTransform().a || 1;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.filter = `blur(${(P.wetBlur * sc * kpx).toFixed(2)}px)`;
  g.drawImage(W, 0, 0);
  g.restore();

  // ---------------- crisp brushwork ----------------
  g.fillStyle = P.inkCss;
  for (const S of spindles) spindleCrisp(g, C, P, sc, S);
  // dark accents in the shadow mass
  const na = Math.round((area / (700 * sc * sc)) * D * (snow ? 0.5 : 1));
  for (let i = 0; i < na; i++) {
    const u = s * r.range(-0.1, 1.0);
    const y = mix(C.topAt(u), fadeY, Math.pow(r(), 1.5));
    const lf = life(y);
    if (r() > side(u) * lf) continue;
    const al = r.range(3, 10) * sc;
    chip(g, C.xAt(u, y), y, al * r.range(1.3, 2.4), al * r.range(0.4, 0.8), (r() < 0.5 ? 1 : -1) * r.range(0.3, 0.9), r.range(0.25, 0.5) * lf, r);
  }
  // salt specks: paper showing through the dark mass
  g.fillStyle = P.paperCss;
  const nsalt = Math.round((area / (900 * sc * sc)) * D);
  for (let i = 0; i < nsalt; i++) {
    const u = r.range(-1, 1);
    const y = mix(C.topAt(u), fadeY, r());
    if (r() > side(u) * vdark(y) * 0.8) continue;
    dab(g, C.xAt(u, y), y, r.range(0.5, 1.3) * sc, r.range(0.45, 0.85), r, 1.2, 0.3);
  }
  g.fillStyle = P.inkCss;
  // contour: ragged dark edge on the shadow side, broken and fading down
  const shadowEdge = s < 0 ? C.L : C.R;
  const edgePts = [];
  for (let y = Math.min(bot, mix(top, fadeY, 1.15)); y > C.sh; y -= 5 * sc) edgePts.push([shadowEdge(y), y]);
  const cp = s < 0 ? C.capPts : C.capPts.slice().reverse();
  for (let i = 0; i < cp.length * 0.2; i += 2) edgePts.push(cp[i]);
  for (let i0 = 0; i0 < edgePts.length - 2;) {
    const len = 4 + ((r() * 9) | 0);
    const seg = edgePts.slice(i0, Math.min(edgePts.length, i0 + len + 1));
    if (seg.length > 1 && r() < 0.9) ribbon(g, seg, r.range(1.5, 4.5) * sc, r.range(0.45, 0.85) * life(seg[0][1]), r, { profile: 'brush', rough: 0.8 });
    i0 += len;
  }
  const litEdge = s < 0 ? C.R : C.L;
  for (let y = C.sh; y < mix(top, fadeY, 1.05);) {
    const len = r.range(10, 40) * sc;
    if (r() < 0.6) {
      const pts = [];
      for (let k = 0; k <= 3; k++) { const yy = y + (len * k) / 3; pts.push([litEdge(yy), yy]); }
      ribbon(g, pts, r.range(0.8, 2.4) * sc, r.range(0.25, 0.6) * life(y), r, { profile: 'brush', rough: 0.6 });
    }
    y += len + r.range(2, 16) * sc;
  }
  // foliage: canopy clumps on the crown, down the upper shadow side and on the shadow edge,
  // painted on their own wet layer (soft merging edges), then the ridge trees go on crisp
  const Fc = new OffscreenCanvas(cv.width, cv.height);
  const gm = g;
  g = Fc.getContext('2d');
  g.setTransform(gm.getTransform());
  g.fillStyle = P.treeCss;
  const fol = (C.foliage ?? 0.25) * Math.min(1, P.trees);
  const fsz = Math.min(1, 0.45 + 0.55 * P.treeSize);
  if (fol > 0) {
    // foliage hangs from the crown and creeps down the shadow edge and the crevices
    const nfo = Math.round(((C.cw * H) / (160 * sc * sc)) * fol * D);
    const crevs = spindles.map((S) => (s < 0 ? S.Lp : S.Rp));
    for (let i = 0; i < nfo; i++) {
      const v = Math.pow(r(), 2.2) * 0.45;
      let x, y;
      if (r() < 0.0 && crevs.length) {
        const e = crevs[(r() * crevs.length) | 0];
        const kk = Math.min(e.length - 1, Math.round(v * 2 * (e.length - 1) * 0.6));
        x = e[kk][0] + s * r.range(0, 6) * sc; y = e[kk][1];
      } else {
        const u = s * r.range(0.3, 1.05);
        y = C.topAt(u) + v * H; x = C.xAt(u, y);
      }
      if (r() > Math.exp(-v * 4) * life(y)) continue;
      clump(g, r, x, y, r.range(3, 9) * sc * fsz, r.range(0.3, 0.6) * life(y));
    }
  }
  const ne = Math.round((H / (10 * sc)) * D * (snow ? 0.7 : 1) * Math.min(1, P.trees + 0.3));
  for (let i = 0; i < ne; i++) {
    const y = top + Math.pow(r(), 1.7) * (fadeY - top) * P.drip;
    const lf = life(y);
    if (lf < 0.05) continue;
    const u = s * (1.03 - Math.pow(r(), 1.2) * 0.35);
    clump(g, r, C.xAt(u, y), y, r.range(2.5, 7) * sc * fsz, r.range(0.3, 0.7) * lf);
  }
  // ledges: dark lip with shrubs
  for (const l of C.ledges) {
    const lf = life(l.y);
    const x0 = l.x, x1 = l.x + l.side * C.hw * 0.25;
    g.fillStyle = P.inkCss;
    ribbon(g, [[x0 - l.side * 3 * sc, l.y + 1], [mix(x0, x1, 0.5), l.y + 2 * sc], [x1, l.y + 4 * sc]], 2.5 * sc, 0.7 * lf, r, { profile: 'brush' });
    g.fillStyle = P.treeCss;
    for (let k = 0; k < 5 * D; k++) clump(g, r, mix(x0, x1, r()) - l.side * 4 * sc, l.y - r.range(0, 3) * sc, r.range(2, 5) * sc * fsz, r.range(0.4, 0.8) * lf);
  }
  // crown: foliage clumps straddling the summit outline, then ridge trees in two rows
  const treeK = P.trees * (C.trees ?? 1);
  if (treeK > 0) {
    const folK = 0.35 + (C.foliage ?? 0.25);
    const ncan = Math.round((C.cw / (2.4 * sc)) * D * Math.min(1.5, treeK) * folK);
    for (let i = 0; i < ncan; i++) {
      let u = r.range(-1.08, 1.08);
      if (C.clear && Math.abs(u) < 0.7) u = Math.sign(u || 1) * r.range(0.7, 1.05);
      const x = C.xAt(u, C.sh);
      const sd = side(u);
      if (r() > 0.25 + 0.75 * Math.max(sd, C.foliage ?? 0.25)) continue;
      const rr = r.range(3.5, 11) * sc * fsz;
      const depth = Math.pow(r(), 2.2) * H * (0.03 + 0.12 * sd) * (0.5 + (C.foliage ?? 0.25)) - rr * r.range(0.1, 0.9);
      clump(g, r, x + r.range(-2, 2) * sc, C.capY(x) + depth, rr, r.range(0.3, 0.7));
    }
  }
  // lay the foliage layer down softened, continue crisp on the column canvas
  gm.save();
  gm.setTransform(1, 0, 0, 1, 0, 0);
  gm.globalAlpha = 1;
  gm.filter = `blur(${(P.wetBlur * 0.55 * sc * kpx).toFixed(2)}px)`;
  gm.drawImage(Fc, 0, 0);
  gm.restore();
  g = gm;
  if (treeK > 0) {
    const tsz = P.treeSize;
    const hmin = clamp(H * 0.07 * tsz, 4 * sc, 42), hmax = clamp(H * 0.16 * tsz, 7 * sc, 80);
    const folK = 0.35 + (C.foliage ?? 0.25);
    const nt = Math.round((C.cw / (hmax * 0.3)) * treeK * r.range(0.75, 1.2) * Math.min(1.3, folK));
    const snowCss = snow ? P.paperCss : null;
    const trees = [];
    for (let i = 0; i < nt; i++) {
      let u = r.range(-1.0, 1.0);
      if (C.clear) u = (r() < 0.5 ? -1 : 1) * r.range(0.75, 1.02);
      const x = C.xAt(u, C.sh);
      const back = r() < 0.4;
      const h = mix(hmin, hmax, Math.pow(r(), 0.8)) * (1 - Math.abs(u) * 0.3) * (back ? 0.85 : 1);
      trees.push({ x, y: C.capY(x) + h * (back ? r.range(-0.02, 0.12) : r.range(0.12, 0.35)), h, a: back ? r.range(0.55, 0.8) : r.range(0.85, 1), back });
    }
    trees.sort((a, b) => (b.back - a.back) || (a.y - b.y));
    for (const t of trees) paintConifer(g, t.x, t.y, t.h, { alpha: t.a, rng: r, kind: r() < 0.25 ? 'pine' : 'spruce', snowCss, inkCss: P.treeCss });
    const nd = Math.round(r.range(0, 3) * treeK);
    for (let i = 0; i < nd; i++) {
      const y = mix(C.sh, mix(top, fadeY, 0.6), r());
      const h = mix(hmin, hmax, r()) * 0.8;
      paintConifer(g, shadowEdge(y) + s * r.range(-2, 4) * sc, y + h * 0.2, h, { alpha: r.range(0.75, 0.95) * life(y), rng: r, snowCss, inkCss: P.treeCss });
    }
    for (const l of C.ledges) if (r() < 0.8 * treeK) {
      const h = mix(hmin, hmax, r()) * 0.8;
      paintConifer(g, l.x - l.side * r.range(2, 8) * sc, l.y + 2 * sc, h, { alpha: 0.85 * life(l.y), rng: r, snowCss, inkCss: P.treeCss });
    }
  }
  // snow: white caps and ledge shelves over the ink
  if (snow) {
    g.fillStyle = P.paperCss;
    const n = Math.round(C.cw / (4 * sc));
    for (let i = 0; i < n; i++) {
      const u = r.range(-0.95, 0.95);
      const x = C.xAt(u, C.sh);
      dab(g, x, C.capY(x) + r.range(1, 8) * sc, r.range(4, 11) * sc, 0.88, r, 0.45, 0.3, r.range(-0.3, 0.3));
    }
    for (const l of C.ledges) for (let k = 0; k < 5; k++) dab(g, l.x + l.side * C.hw * r.range(0, 0.25), l.y - 1 * sc, r.range(3, 8) * sc, 0.88, r, 0.4);
  }
  g.fillStyle = P.inkCss;
  g.globalAlpha = 1;
}

// Cluster of 2-5 blots: a foliage / moss clump clinging to rock (current fillStyle).
function clump(ctx, rng, x, y, r, a) {
  const n = 3 + ((rng() * 4) | 0);
  for (let i = 0; i < n; i++) {
    const ox = (rng() - 0.5) * r * 2.2, oy = (rng() - 0.5) * r * 0.8 + Math.abs(ox) * 0.3;
    dab(ctx, x + ox, y + oy, r * (0.4 + rng() * 0.5), a * (0.7 + rng() * 0.45), rng, 0.45 + rng() * 0.3, 0.5, (rng() - 0.5) * 0.5);
  }
}

// Billowy mist dissolve mask for a column bbox: alpha 1 above fadeTop, cloud-edged fade to 0 at fadeBot.
function mistMask(nz, bx, by, bw, bh, fadeTop, fadeBot, scale, seed, C) {
  const ds = 3;
  const mw = Math.max(2, Math.ceil(bw / ds) + 1), mh = Math.max(2, Math.ceil(bh / ds) + 1);
  const cv = new OffscreenCanvas(mw, mh);
  const g = cv.getContext('2d');
  const img = g.createImageData(mw, mh);
  const d = img.data;
  const span = Math.max(1, fadeBot - fadeTop);
  for (let j = 0; j < mh; j++) {
    const y = by + j * ds;
    const gy = clamp((fadeBot - y) / span);
    const yl = C ? C.L(Math.max(y, C.sh)) : 0, yr = C ? C.R(Math.max(y, C.sh)) : 1;
    for (let i = 0; i < mw; i++) {
      const k = (j * mw + i) * 4;
      let a;
      if (gy >= 1) a = 1;
      else if (gy <= 0) a = 0;
      else {
        const x = bx + i * ds;
        // billowy cloud tops: folded noise gives rounded puffs
        const b = 1 - Math.abs(nz.fbm2(x / (scale * 1.3) + seed, y / (scale * 0.75), 3));
        const n = 0.2 + 0.55 * b + 0.15 * nz.n2(x / (scale * 4) + seed, y / (scale * 3));
        const e = C ? clamp(Math.min(x - yl, yr - x) / Math.max(1, (yr - yl) * 0.5)) : 1;
        const v = Math.pow(gy, 0.7) - (1 - e) * 0.3 * (1 - gy);
        a = smoothstep(n - 0.26, n + 0.26, v);
      }
      d[k + 3] = (a * 255) | 0;
    }
  }
  g.putImageData(img, 0, 0);
  return { cv, mw, mh, ds };
}

function autoColumns(o, P) {
  const r = P.r;
  const H = o.base - o.top;
  const shape = o.shape || 'pillar';
  const n = o.cols || Math.max(1, Math.min(7, Math.round(o.width / (shape === 'dome' ? 120 : shape === 'mesa' ? 140 : 80))));
  const cols = [];
  const W = o.width;
  const pos = [];
  for (let i = 0; i < n; i++) pos.push(n === 1 ? 0 : (i / (n - 1) - 0.5) * (1 - 1 / (n + 1)) + r.range(-0.04, 0.04));
  const bias = r.range(-0.15, 0.15);
  let main = 0;
  for (let i = 1; i < n; i++) if (Math.abs(pos[i] - bias) < Math.abs(pos[main] - bias)) main = i;
  for (let i = 0; i < n; i++) {
    const d = Math.abs(pos[i] - pos[main]);
    const top = i === main ? o.top : o.top + H * clamp(0.04 + d * r.range(0.5, 1.1) + r.range(0, 0.12), 0.03, 0.6);
    const hw = (W / n) * r.range(0.5, 0.72) * (i === main ? 1.15 : 1) * (n === 1 ? 0.9 : 1);
    let cap = shape === 'mesa' ? 'flat' : shape === 'spire' ? (r() < 0.75 ? 'point' : 'round') : 'round';
    if (shape === 'pillar' && r() < 0.15) cap = 'point';
    const capH = shape === 'dome' ? hw * r.range(0.6, 0.9) : undefined;
    cols.push({ x: o.x + pos[i] * W, top, hw, cap, capH, spread: shape === 'dome' ? r.range(0.25, 0.5) : undefined, z: top });
  }
  return cols;
}

export const _prof = { ink: 0, rest: 0, cols: 0 }; // TEMP profiling
// Paint one pillar cluster. Returns anchors { tops:[{x,y,w,flat}], ledges:[{x,y,side}], bbox:[x0,y0,x1,y1] }.
export function paintPeak(ctx, opts = {}) {
  const o = { ...PEAK_DEFAULTS, ...opts };
  const P = makeP(o);
  const H = o.base - o.top;
  const sc = o.scale ?? clamp(H / 480, 0.3, 1.8);
  const cols = o.columns ? o.columns.map((c) => ({ ...c, x: o.x + (c.dx ?? 0), z: c.z ?? c.top })) : autoColumns(o, P);
  cols.sort((a, b) => a.z - b.z);
  const anchors = { tops: [], ledges: [], bbox: [1e9, 1e9, -1e9, -1e9] };
  const k = ctx.getTransform().a || 1;
  cols.forEach((c, idx) => {
    const bot = o.base + (c.extend ?? 0);
    const C = buildColumn({ ...c, bot }, P, sc);
    C.fadeTop = c.fadeTop ?? mix(C.top, bot, o.fade);
    C.seedF = idx * 7.31 + (o.seed ?? 1) * 1.7;
    C.clear = o.clearTop === true ? C.cap === 'flat' : Array.isArray(o.clearTop) ? o.clearTop.includes(idx) : false;
    const m = 30 * sc + clamp(H * 0.16, 10 * sc, 80) * 0.6;
    let x0 = 1e9, x1 = -1e9;
    for (const p of C.pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); }
    const bx = Math.floor(x0 - m), by = Math.floor(C.apex[1] - m - clamp(H * 0.16, 10 * sc, 80)), bw = Math.ceil(x1 - x0 + 2 * m), bh = Math.ceil(bot - by + 4);
    const cv = new OffscreenCanvas(Math.max(1, Math.ceil(bw * k)), Math.max(1, Math.ceil(bh * k)));
    const g = cv.getContext('2d');
    g.setTransform(k, 0, 0, k, -bx * k, -by * k);
    const _t0 = performance.now();
    (P.style === 'cun' ? inkColumn09 : inkColumn)(g, C, P, sc);
    const _t1 = performance.now();
    const mm = mistMask(P.nz, bx, by, bw, bh, C.fadeTop, bot, Math.max(14, C.hw * 0.7), idx * 13.7, C);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'destination-in';
    g.imageSmoothingEnabled = true;
    g.drawImage(mm.cv, 0, 0, mm.mw, mm.mh, 0, 0, mm.mw * mm.ds * k, mm.mh * mm.ds * k);
    const ga = ctx.globalAlpha;
    ctx.globalAlpha = 1;
    ctx.drawImage(cv, bx, by, cv.width / k, cv.height / k);
    ctx.globalAlpha = ga;
    _prof.ink += _t1 - _t0; _prof.rest += performance.now() - _t1; _prof.cols++;
    anchors.tops.push({ x: C.apex[0], y: C.apex[1], w: C.cap === 'flat' ? C.cw * 0.6 : C.cw * 0.25, flat: C.cap === 'flat', col: idx });
    for (const l of C.ledges) anchors.ledges.push({ x: l.x, y: l.y, side: l.side });
    anchors.bbox = [Math.min(anchors.bbox[0], bx), Math.min(anchors.bbox[1], by), Math.max(anchors.bbox[2], bx + bw), Math.max(anchors.bbox[3], by + bh)];
  });
  return anchors;
}

// ------------------------------------------------------------------ ranges
export const RANGE_DEFAULTS = {
  x0: -100, x1: 2020,  // horizontal extent
  base: 600,           // mist line (fully dissolved)
  top: 300,            // typical summit height (y)
  amp: 0.35,           // summit height variation (fraction of base - top)
  count: 0,            // number of peaks (0 = from width)
  shape: 'pillar',     // 'pillar' | 'dome' | 'spire' | 'hills'
  tone: 0.75,          // darkest value (far 0.6-0.88)
  trees: 0.7, detail: 0.45, fade: 0.3,
  variant: 'plain', paper: null, ink: null, seed: 1, rng: null,
  profile: null,       // optional fn(u in 0..1) -> 0..1 envelope of summit heights
};

// Paint a far range: a row of overlapping simplified peaks at one distance.
export function paintRange(ctx, opts = {}) {
  const o = { ...RANGE_DEFAULTS, ...opts };
  const r = o.rng ? o.rng.fork('rg' + o.seed) : makeRng('range:' + o.seed);
  const nz = makeNoise('range:n:' + o.seed);
  const Wd = o.x1 - o.x0, H = o.base - o.top;
  const n = o.count || Math.max(2, Math.round(Wd / (o.shape === 'hills' ? 260 : 150)));
  const peaks = [];
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5 + r.range(-0.35, 0.35)) / n;
    const env = o.profile ? o.profile(u) : 0.5 + 0.5 * nz.fbm2(u * 3.1, 0.5, 2);
    const top = o.top + H * o.amp * (1 - env) * 1.6 + r.range(-0.08, 0.08) * H;
    const w = (Wd / n) * r.range(0.9, 1.6);
    peaks.push({ x: o.x0 + u * Wd, top, w, seed: o.seed * 100 + i });
  }
  peaks.sort((a, b) => a.top - b.top);
  const anchors = { tops: [], ledges: [] };
  for (const p of peaks) {
    const shape = o.shape === 'hills' ? 'dome' : o.shape;
    const a = paintPeak(ctx, {
      x: p.x, top: p.top, base: o.base, width: p.w, shape, cols: o.shape === 'hills' ? 2 : 0,
      tone: o.tone + r.range(-0.03, 0.03), trees: o.trees, detail: o.detail, fade: o.fade,
      variant: o.variant, paper: o.paper, ink: o.ink, seed: p.seed, scale: o.scale, face: o.face,
      columns: o.shape === 'hills' ? [{ dx: 0, top: p.top, hw: p.w * 0.45, cap: 'round', capH: p.w * r.range(0.18, 0.3), spread: 0.6, notches: 0 }, { dx: p.w * r.range(-0.3, 0.3), top: p.top + H * 0.15, hw: p.w * 0.3, cap: 'round', capH: p.w * 0.15, spread: 0.5, notches: 0 }] : null,
    });
    anchors.tops.push(...a.tops);
  }
  return anchors;
}

// ------------------------------------------------------------------ wet ink pass
// Turns a peak bake into ink soaked into paper: pigment mottling, granulation in mid tones,
// pooled wet edges, a faint bleed halo and optional distance softening. Decomposes each
// pixel into (ink density d, paper occluder occ) using the paper and ink colours.
export function wetInk(api, src, o = {}) {
  const v = VARIANTS[o.variant] || VARIANTS.plain;
  const paper = (o.paper || v.paper).map((c) => c / 255), ink = (o.ink || v.ink).map((c) => c / 255);
  return api.processTex(src, /* glsl */ `
    uniform vec3 uPaperC, uInkC;
    uniform float uSoft, uBleed, uEdge, uGran, uMottle, uSeed, uBlur;
    vec2 dec(vec4 c, float Lp, float Li) {
      float d = clamp((Lp * c.a - luma(c.rgb)) / max(1e-3, Lp - Li), 0.0, c.a);
      float occ = c.a > d + 1e-4 ? (c.a - d) / max(1e-4, 1.0 - d) : 0.0;
      return vec2(d, occ);
    }
    vec4 shade(vec2 p, vec2 uv) {
      float Lp = luma(uPaperC), Li = luma(uInkC);
      vec2 c0 = dec(texture(uSrc, uv), Lp, Li);
      vec2 a1 = vec2(0.0), a2 = vec2(0.0);
      for (int i = 0; i < 8; i++) {
        float an = float(i) * 0.7853982 + 0.39;
        vec2 dir = vec2(cos(an), sin(an)) * uTexel;
        a1 += dec(texture(uSrc, uv + dir * uSoft), Lp, Li);
        a2 += dec(texture(uSrc, uv + dir * uSoft * 2.7), Lp, Li);
      }
      a1 /= 8.0; a2 /= 8.0;
      float d = c0.x, occ = c0.y;
      d = mix(d, (d + a1.x * 1.4 + a2.x * 0.8) / 3.2, uBlur);
      occ = mix(occ, (occ + a1.y * 1.4 + a2.y * 0.8) / 3.2, uBlur);
      d = max(d, a2.x * uBleed);
      float rim = clamp((c0.x - a2.x) * 2.0, 0.0, 1.0) * c0.x;
      d += uEdge * rim * 0.5;
      vec2 q = p + uSeed * 37.0;
      float m = vnoise(q * 0.09) * 0.45 + vnoise(q * 0.031 + 5.0) * 0.35 + vnoise(q * 0.27 + 9.0) * 0.2;
      float mid = 4.0 * d * (1.0 - d);
      d *= 1.0 + uMottle * (m - 0.5) * 2.0 * (0.35 + 0.65 * mid);
      float gr = vnoise(q * 0.32) * 0.6 + vnoise(q * 0.9 + 3.0) * 0.4;
      d *= 1.0 - uGran * (gr - 0.42) * (0.4 + 1.6 * mid);
      d = clamp(d, 0.0, 1.0);
      vec3 rgb = uInkC * d + (1.0 - d) * uPaperC * occ;
      float a = d + (1.0 - d) * occ;
      return vec4(rgb, a);
    }`, {
    uniforms: {
      uPaperC: paper, uInkC: ink,
      uSoft: o.soft ?? 1.6, uBleed: o.bleed ?? 0.35, uEdge: o.edge ?? 0.5, uGran: o.granulation ?? 0.35,
      uMottle: o.mottle ?? 0.35, uSeed: o.seed ?? 0, uBlur: o.blur ?? 0,
    },
  });
}

// ------------------------------------------------------------------ bakers
function finish(api, src, rect, anchors, o) {
  const card = o.wet === false ? src : wetInk(api, src, { variant: o.variant, paper: o.paper, ink: o.ink, ...(o.wet || {}) });
  if (card !== src) api.engine.freeTex(src);
  return { src: card, rect, anchors, layer: (lo = {}) => api.tex(card, { rect, ...lo }) };
}

// Bake one or more peak clusters (back to front) into a single card.
// opts: { rect:[x,y,w,h] (default: union of the peaks), peaks:[paintPeak opts...], scale (bake density),
//         variant/paper/ink (shared defaults), wet: wetInk opts | false }
export function makePeaks(api, opts = {}) {
  const shared = { variant: opts.variant, paper: opts.paper, ink: opts.ink };
  for (const k in shared) if (shared[k] === undefined) delete shared[k];
  const list = (opts.peaks || [opts]).map((p) => ({ ...shared, ...p }));
  let rect = opts.rect;
  if (!rect) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of list) {
      const w = p.width ?? 260, hh = (p.base ?? 700) - (p.top ?? 200);
      x0 = Math.min(x0, p.x - w * 0.75 - 30); x1 = Math.max(x1, p.x + w * 0.75 + 30);
      y0 = Math.min(y0, p.top - Math.min(90, hh * 0.2) - 30); y1 = Math.max(y1, p.base + 6);
    }
    rect = [Math.floor(x0), Math.floor(y0), Math.ceil(x1 - x0), Math.ceil(y1 - y0)];
  }
  const anchors = { tops: [], ledges: [] };
  const src = api.bakeCanvas(rect[2], rect[3], (ctx) => {
    ctx.translate(-rect[0], -rect[1]);
    for (const p of list) { const a = paintPeak(ctx, p); anchors.tops.push(...a.tops); anchors.ledges.push(...a.ledges); }
  }, { scale: opts.scale ?? 1 });
  return finish(api, src, rect, anchors, { ...opts, wet: opts.wet ?? { soft: 1.2, blur: 0.35, bleed: 0.25, edge: 0.45, granulation: 0.15, mottle: 0.3 } });
}

// Bake a far range card. opts: paintRange opts + { rect, soft (blur px), rows: [paintRange opts...] (back to front) }
export function makeRange(api, opts = {}) {
  const shared = { variant: opts.variant, paper: opts.paper, ink: opts.ink };
  for (const k in shared) if (shared[k] === undefined) delete shared[k];
  const rows = (opts.rows || [opts]).map((p) => ({ ...RANGE_DEFAULTS, ...shared, ...p }));
  let rect = opts.rect;
  if (!rect) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of rows) { x0 = Math.min(x0, p.x0 - 60); x1 = Math.max(x1, p.x1 + 60); y0 = Math.min(y0, p.top - (p.base - p.top) * p.amp - 80); y1 = Math.max(y1, p.base + 10); }
    rect = [Math.floor(x0), Math.floor(y0), Math.ceil(x1 - x0), Math.ceil(y1 - y0)];
  }
  const anchors = { tops: [], ledges: [] };
  const soft = opts.soft ?? 0;
  const src = api.bakeCanvas(rect[2], rect[3], (ctx, { k }) => {
    ctx.translate(-rect[0], -rect[1]);
    for (const p of rows) { const a = paintRange(ctx, p); anchors.tops.push(...a.tops); }
    if (soft > 0) {
      const cv = ctx.canvas;
      const tmp = new OffscreenCanvas(cv.width, cv.height);
      const g = tmp.getContext('2d');
      g.filter = `blur(${soft * k}px)`;
      g.drawImage(cv, 0, 0);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(tmp, 0, 0); ctx.restore();
    }
  }, { scale: opts.scale ?? 1 });
  return finish(api, src, rect, anchors, { ...opts, wet: opts.wet ?? { soft: 1.2 + soft * 0.5, granulation: 0.25, mottle: 0.3, edge: 0.25, bleed: 0.25 } });
}

// ------------------------------------------------------------------ s09 'cun' column style
// Ref 09 pillars: crisp silhouettes with a dark ragged contour (heavier on the shadow side and over the
// crown), streaky vertical hemp-fibre strokes that follow the column, a few deep crevices, lit faces left
// close to bare paper, moss dots and dark conifers on the crown. Everything is crisp (no wet layer).
function inkColumn09(g, C, P, sc) {
  const r = P.r, nz = P.nz, s = P.s, D = P.detail;
  const { top, bot, H } = C;
  const fadeY = C.fadeTop;
  const life = (C.life = (y) => 1 - smoothstep(mix(top, fadeY, 0.85), mix(fadeY, bot, 0.8), y));
  const lit = C.lit ?? 0.45;
  const ls = (lit - 0.45) * 1.2;
  const side = (u) => smoothstep(-0.55 + ls, 0.9 + ls * 0.5, u * s); // 0 lit .. 1 shadow
  const hi = (y) => 0.45 + 0.55 * Math.exp(-Math.max(0, y - top) / (H * 0.4)); // darker high up
  const area = C.cw * H;
  const far = P.far;
  const wig = (sd, y) => nz.n2(sd, y / (26 * sc)) * 1.6 * sc;
  const along = (u, y0, len, sd, n = 5) => {
    const pts = [];
    for (let k = 0; k <= n; k++) { const y = y0 + (len * k) / n; pts.push([C.xAt(u, y) + wig(sd, y), y]); }
    return pts;
  };
  // 1. paper occluder
  g.globalAlpha = 1;
  g.fillStyle = P.paperCss;
  g.fill(C.path);
  // 2. wet mass on its own layer, softened a little: overall tone darker high up, broad shadow-side
  //    washes, and a mottled lattice of axe-cut chips (the grey granite body)
  const cv = g.canvas;
  const W = new OffscreenCanvas(cv.width, cv.height);
  const w = W.getContext('2d');
  w.setTransform(g.getTransform());
  const ik = P.inkD;
  const icol = (a) => `rgba(${ik[0] | 0},${ik[1] | 0},${ik[2] | 0},${clamp(a, 0, 1).toFixed(3)})`;
  // value structure: a shadow-side to lit-side wash, faded downward (mask applied before anything else)
  {
    const xl0 = C.xAt(-1, C.sh), xr0 = C.xAt(1, C.sh);
    const hg = w.createLinearGradient(s < 0 ? xl0 : xr0, 0, s < 0 ? xr0 : xl0, 0);
    const vk = P.valK * (1 - 0.45 * far);
    hg.addColorStop(0, icol(0.62 * vk)); hg.addColorStop(0.3, icol(0.46 * vk)); hg.addColorStop(0.65, icol(0.2 * vk)); hg.addColorStop(1, icol(0.06 * vk));
    w.fillStyle = hg;
    w.fill(C.path);
    const vg = w.createLinearGradient(0, top, 0, bot);
    vg.addColorStop(0, 'rgba(0,0,0,1)'); vg.addColorStop(clamp((fadeY - top) / H * 0.6), 'rgba(0,0,0,0.8)'); vg.addColorStop(clamp((fadeY - top) / H), 'rgba(0,0,0,0.5)'); vg.addColorStop(1, 'rgba(0,0,0,0.25)');
    w.globalCompositeOperation = 'destination-in';
    w.fillStyle = vg;
    w.fillRect(C.xl - 4 * C.hw, top - H, 10 * C.hw, 3 * H);
    w.globalCompositeOperation = 'source-over';
  }
  const fd = P.face * (1 + 2.2 * far) * P.washK;
  const pg = w.createLinearGradient(0, top, 0, bot);
  pg.addColorStop(0, icol(fd * 2.2)); pg.addColorStop(0.3, icol(fd * 1.1)); pg.addColorStop(1, icol(fd * 0.2));
  w.fillStyle = pg;
  w.fill(C.path);
  w.fillStyle = P.inkCss;
  const nw = Math.round((C.cw / (5 * sc)) * D);
  for (let i = 0; i < nw; i++) {
    const u = s * (1.05 - Math.pow(r(), 0.8) * 1.5);
    const sd = side(u);
    if (r() > 0.15 + 0.85 * sd) continue;
    const y0 = C.topAt(u) - 3 * sc;
    const len = H * r.range(0.2, 0.6);
    ribbon(w, along(u, y0, len, i * 3.7, 4), r.range(14, 30) * sc, r.range(0.08, 0.16) * (0.3 + 0.7 * sd) * life(y0) * P.washK, r, { profile: 'brush', rough: 0.5, step: 6 });
  }
  const nb = Math.round((area / (30 * sc * sc)) * D);
  for (let i = 0; i < nb; i++) {
    const u = r.range(-1.05, 1.05);
    const y = mix(C.topAt(u) - 3 * sc, bot, Math.pow(r(), 1.2));
    const lf = life(y);
    if (lf < 0.03) continue;
    const sd = side(u);
    const xx = C.xAt(u, y);
    const band = 0.2 + 1.4 * Math.pow(0.5 + 0.5 * nz.fbm2(xx / (13 * sc) + C.seedF, y / (80 * sc), 2), 1.5);
    if (r() > (0.35 + 0.65 * Math.pow(sd, 1.3)) * hi(y) * lf * band) continue;
    const big = r() < 0.25;
    const k = r();
    const ang = k < 0.4 ? r.range(-0.15, 0.15) : (k < 0.7 ? 1 : -1) * r.range(0.45, 0.95);
    chip(w, xx + nz.n2(u * 7, y / 30) * 3 * sc, y, (big ? r.range(18, 32) : r.range(10, 20)) * sc, (big ? r.range(8, 14) : r.range(4, 8)) * sc, ang,
      (big ? r.range(0.08, 0.15) : r.range(0.1, 0.24)) * (0.3 + 0.7 * sd) * lf * P.washK, r);
  }
  // lit facets: soft vertical patches of ink lifted off the wet mass (lighter granite planes)
  w.globalCompositeOperation = 'destination-out';
  w.fillStyle = '#000';
  const nf = Math.round((area / (900 * sc * sc)) * D * P.litK);
  for (let i = 0; i < nf; i++) {
    const u = -s * (1.0 - Math.pow(r(), 0.8) * 1.7);
    const y = mix(C.topAt(u) + 8 * sc, fadeY * 1.05, Math.pow(r(), 0.9));
    dab(w, C.xAt(u, y), y, r.range(4, 11) * sc, r.range(0.15, 0.4) * (1 - 0.6 * side(u)), r, r.range(1.8, 3.4), 0.45, r.range(-0.15, 0.15));
  }
  w.globalCompositeOperation = 'source-over';
  w.setTransform(1, 0, 0, 1, 0, 0);
  w.globalAlpha = 1;
  w.globalCompositeOperation = 'destination-in';
  w.setTransform(g.getTransform());
  w.fillStyle = '#000';
  w.fill(C.path);
  const kpx = g.getTransform().a || 1;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.filter = `blur(${(0.9 * sc * kpx).toFixed(2)}px)`;
  g.drawImage(W, 0, 0);
  g.restore();
  g.save();
  g.clip(C.path);
  // lit planes: lift the lit side back toward paper
  {
    const xl = C.xAt(-1, C.sh), xr = C.xAt(1, C.sh);
    const lg = g.createLinearGradient(s < 0 ? xr : xl, 0, s < 0 ? xl : xr, 0);
    const pr = P.paper;
    lg.addColorStop(0, `rgba(${pr[0] | 0},${pr[1] | 0},${pr[2] | 0},${(0.35 * P.litK).toFixed(3)})`);
    lg.addColorStop(0.45, `rgba(${pr[0] | 0},${pr[1] | 0},${pr[2] | 0},0)`);
    lg.addColorStop(1, `rgba(${pr[0] | 0},${pr[1] | 0},${pr[2] | 0},0)`);
    g.globalAlpha = 1;
    g.fillStyle = lg;
    g.fill(C.path);
  }
  g.fillStyle = P.inkCss;
  // 2b. dark crown band: dense dabs under the summit (forest and wet rock), thinning downward
  g.fillStyle = P.treeCss;
  const ncb = Math.round((C.cw / (1.4 * sc)) * D * P.mossK);
  for (let i = 0; i < ncb; i++) {
    const u = r.range(-1.05, 1.05);
    if (C.clear && Math.abs(u) < 0.55 && r() < 0.8) continue;
    const x = C.xAt(u, C.sh);
    const dv = Math.pow(r(), 1.8);
    const y = C.capY(x) + dv * H * 0.2;
    dab(g, x + r.range(-3, 3) * sc, y, r.range(2, 6) * sc * (1 - 0.5 * dv), r.range(0.2, 0.55) * (0.35 + 0.65 * side(u)) * (1 - dv), r, r.range(0.5, 0.9), 0.5);
  }
  g.fillStyle = P.inkCss;
  // 3. hemp-fibre cun: many thin vertical strokes following the column, denser in shadow
  const nc = Math.round((area / (55 * sc * sc)) * D * P.cunK);
  for (let i = 0; i < nc; i++) {
    const u = s * (1.05 - Math.pow(r(), 0.9) * 1.3);
    const sd = side(u);
    const y0 = C.topAt(u) + Math.pow(r(), 1.4) * (fadeY - top) * 1.1;
    const lf = life(y0);
    if (lf < 0.05 || r() > 0.1 + 0.9 * sd) continue;
    const len = r.range(8, 46) * sc * (0.6 + 0.8 * sd);
    ribbon(g, along(u, y0, len, 50 + i * 1.3, 3), r.range(0.6, 1.9) * sc, r.range(0.12, 0.4) * (0.35 + 0.65 * sd) * lf * hi(y0) * (1 - 0.5 * far), r, { profile: 'brush', rough: 0.6 });
  }
  // 4. axe-cut chips: a few slanted darker planes on the shadow side, high up
  const na = Math.round((area / (420 * sc * sc)) * D);
  for (let i = 0; i < na; i++) {
    const u = s * r.range(0.0, 1.0);
    const y = C.topAt(u) + Math.pow(r(), 1.8) * (fadeY - top);
    const lf = life(y);
    if (r() > side(u) * lf) continue;
    chip(g, C.xAt(u, y), y, r.range(10, 24) * sc, r.range(4, 9) * sc, s * r.range(0.2, 0.7), r.range(0.1, 0.24) * lf * hi(y), r);
  }
  // 5. deep crevices: one or two dark broken fissures from the crown down the shadow half
  const ncr = 1 + (r() < 0.5 ? 1 : 0) + (C.hw > 45 * sc ? 1 : 0);
  for (let i = 0; i < ncr; i++) {
    const u = s * r.range(-0.35, 0.65);
    let y = C.topAt(u) + r.range(0, 0.12) * H;
    const yEnd = y + H * r.range(0.25, 0.55);
    while (y < yEnd) {
      const len = r.range(12, 40) * sc;
      const lf = life(y);
      if (r() < 0.8) ribbon(g, along(u, y, len, 90 + i * 7, 3), r.range(1.8, 4.2) * sc * (1 - 0.4 * (y - top) / H), r.range(0.5, 0.85) * lf * hi(y), r, { profile: 'brush', rough: 0.8 });
      y += len + r.range(3, 14) * sc;
    }
  }
  // 6. salt specks of paper in the darker shadow passages
  g.fillStyle = P.paperCss;
  const nsalt = Math.round((area / (700 * sc * sc)) * D);
  for (let i = 0; i < nsalt; i++) {
    const u = s * r.range(0.1, 1.0);
    const y = mix(C.topAt(u), fadeY, r());
    dab(g, C.xAt(u, y), y, r.range(0.5, 1.4) * sc, r.range(0.4, 0.8) * side(u), r, 1.3, 0.3);
  }
  g.restore();
  g.fillStyle = P.inkCss;
  // 7. contours: ragged dark edge on the shadow side, over the crown, thin broken line on the lit side
  const shadowEdge = s < 0 ? C.L : C.R, litEdge = s < 0 ? C.R : C.L;
  const sEdge = [];
  for (let y = Math.min(bot, mix(top, fadeY, 1.2)); y > C.sh; y -= 4 * sc) sEdge.push([shadowEdge(y) - s * 0.5 * sc, y]);
  const cp = s < 0 ? C.capPts : C.capPts.slice().reverse();
  for (let i = 0; i < cp.length * 0.75; i += 2) sEdge.push(cp[i]);
  for (let i0 = 0; i0 < sEdge.length - 2;) {
    const len = 3 + ((r() * 8) | 0);
    const seg = sEdge.slice(i0, Math.min(sEdge.length, i0 + len + 1));
    const yy = seg[0][1];
    const k = 1 - smoothstep(top, fadeY * 1.05, yy) * 0.6;
    if (seg.length > 1 && r() < 0.88) ribbon(g, seg, r.range(1.6, 4.4) * sc * k * P.edgeK, r.range(0.55, 0.95) * life(yy), r, { profile: 'brush', rough: 0.8 });
    i0 += len + (r() < 0.25 ? 1 : 0);
  }
  const lEdge = [];
  for (let i = Math.floor(cp.length * 0.6); i < cp.length; i += 2) lEdge.push(cp[i]);
  for (let y = C.sh; y < Math.min(bot, mix(top, fadeY, 1.1)); y += 4 * sc) lEdge.push([litEdge(y) + s * 0.4 * sc, y]);
  for (let i0 = 0; i0 < lEdge.length - 2;) {
    const len = 3 + ((r() * 7) | 0);
    const seg = lEdge.slice(i0, Math.min(lEdge.length, i0 + len + 1));
    if (seg.length > 1 && r() < 0.7) ribbon(g, seg, r.range(0.8, 2.0) * sc * P.edgeK, r.range(0.35, 0.7) * life(seg[0][1]), r, { profile: 'brush', rough: 0.7 });
    i0 += len + ((r() * 4) | 0);
  }
  // 8. moss dots along the crown and the upper shadow edge, and on ledges
  g.fillStyle = P.treeCss;
  const nm = Math.round((C.cw / (3.2 * sc)) * D * P.mossK);
  for (let i = 0; i < nm; i++) {
    let x, y;
    if (r() < 0.6) {
      let u = r.range(-1.02, 1.02);
      if (C.clear && Math.abs(u) < 0.6) continue;
      x = C.xAt(u, C.sh); y = C.capY(x) + Math.pow(r(), 2) * 14 * sc;
    } else {
      y = top + Math.pow(r(), 1.6) * (fadeY - top) * 0.7; x = shadowEdge(Math.max(y, C.sh)) - s * r.range(-1, 7) * sc;
    }
    dab(g, x, y, r.range(1.0, 3.0) * sc, r.range(0.55, 0.95) * life(y), r, r.range(0.5, 0.9), 0.5);
  }
  for (const l of C.ledges) {
    const lf = life(l.y);
    for (let k = 0; k < 6 * D; k++) dab(g, l.x - l.side * r.range(0, C.hw * 0.3), l.y - r.range(0, 3) * sc, r.range(1.2, 3.2) * sc, r.range(0.6, 0.9) * lf, r, 0.6, 0.5);
  }
  // 9. crown: a few dark canopy clumps and ridge conifers (crisp)
  const treeK = P.trees * (C.trees ?? 1);
  if (treeK > 0) {
    const fsz = Math.min(1, 0.45 + 0.55 * P.treeSize);
    const ncan = Math.round((C.cw / (5 * sc)) * D * Math.min(1.5, treeK) * (0.35 + (C.foliage ?? 0.25)));
    for (let i = 0; i < ncan; i++) {
      let u = r.range(-1.05, 1.05);
      if (C.clear && Math.abs(u) < 0.7) u = Math.sign(u || 1) * r.range(0.7, 1.05);
      const x = C.xAt(u, C.sh);
      if (r() > 0.3 + 0.7 * side(u)) continue;
      const rr = r.range(3, 8) * sc * fsz;
      clump(g, r, x, C.capY(x) + rr * r.range(0.0, 0.8), rr, r.range(0.6, 0.9));
    }
    const tsz = P.treeSize;
    const hmin = clamp(H * 0.07 * tsz, 4 * sc, 42), hmax = clamp(H * 0.16 * tsz, 7 * sc, 80);
    const nt = Math.round((C.cw / (hmax * 0.32)) * treeK * r.range(0.75, 1.2) * 1.3);
    const trees = [];
    for (let i = 0; i < nt; i++) {
      let u = r.range(-1.0, 1.0);
      if (C.clear) u = (r() < 0.5 ? -1 : 1) * r.range(0.75, 1.02);
      const x = C.xAt(u, C.sh);
      const back = r() < 0.4;
      const h = mix(hmin, hmax, Math.pow(r(), 0.8)) * (1 - Math.abs(u) * 0.3) * (back ? 0.85 : 1);
      trees.push({ x, y: C.capY(x) + h * (back ? r.range(-0.02, 0.12) : r.range(0.12, 0.3)), h, a: back ? r.range(0.6, 0.85) : r.range(0.9, 1), back });
    }
    trees.sort((a, b) => (b.back - a.back) || (a.y - b.y));
    for (const t of trees) paintConifer(g, t.x, t.y, t.h, { alpha: t.a, rng: r, kind: r() < 0.45 ? 'pine' : 'spruce', inkCss: P.treeCss });
    for (const l of C.ledges) if (r() < 0.7 * treeK) {
      const h = mix(hmin, hmax, r()) * 0.75;
      paintConifer(g, l.x - l.side * r.range(2, 8) * sc, l.y + 2 * sc, h, { alpha: 0.9 * life(l.y), rng: r, inkCss: P.treeCss });
    }
  }
  g.fillStyle = P.inkCss;
  g.globalAlpha = 1;
}
