// s01 helper: misty shan shui mountain masses (ref 01 style), painted with Canvas2D brushwork.
// Each peak is a cluster of "thumbs" (a tall main pillar, lower shoulder pillars stepping down both
// flanks, a skirt behind), painted back to front so every shoulder's top edge reads as a ledge.
// Round 2: thumbs are tapered asymmetric pillars (one steep flank, optional lean, craggy multi-scale
// crown; silhouettes are 1 px lookup tables). Each thumb gets ink pooled under the whole crown line,
// a shaded right flank, vertical grey planes, ridges running down from the crown (shaded face on
// their right, hemp-fibre companions, raindrop dabs), boulder arcs, near-vertical cun, clustered moss,
// optional dark crown bushes and clustered conifers. The base dissolves into mist (noisy mask).
// Extra options (card or peak): skirt (height fraction), aL/aR/a/b (profile exponents), lean,
// knobs/knobsL/knobsR, shDecay [lo, hi], knobAmp, crownBush.
// Peaks in one card are listed back to front. The card is inkified once.
//
// makeMountains(api, { rect, peaks: [{ x, top, wl, wr, base, tone, trees, treeH, fade: [f0, f1],
//                      rough, moss, cun, body, knobs, detail, seed }], paper, scale, ink }) -> { src, rect, topAt, layer(o) }
//   tone   darkest ink density 0..1 (near 0.85, mid 0.6, far 0.3)
//   fade   [f0, f1] fraction of the height where the mist dissolve starts / ends
//   detail 0..1 internal texture (creases, cun); defaults from tone (far ranges stay plain)
import { stroke, dryStroke, blob, rgba, tone as toneRGB, PAPER } from '../../lib/brush.js';
import { paintConifer } from '../../lib/pine.js';
import { inkify } from '../../lib/inkfx.js';

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// The thumbs of one peak (deterministic per seed). Index 0 = skirt, 1 = main pillar, then shoulders
// sorted from highest to lowest (painting order).
// Round 2: thumbs are tapered, asymmetric, leaning pillars (one steep flank, one stepping
// shoulder) with a craggy multi-scale crown instead of smooth superellipse domes.
function thumbsOf(api, P) {
  const r = api.rng(P.seed * 4271 + 5);
  const H = P.base - P.top;
  const lean = P.lean ?? r.range(-0.1, 0.1);
  const steepL = r() < 0.5;
  const T = [
    { x: P.x, top: P.base - H * (P.skirt ?? 0.42), wl: P.wl * 1.1, wr: P.wr * 1.1, aL: 1.6, aR: 1.6, b: 1.2, lean: 0, skirt: true },
    { x: P.x, top: P.top, wl: P.wl * 0.68, wr: P.wr * 0.68, aL: P.aL ?? P.a ?? (steepL ? r.range(2.6, 3.2) : r.range(2.0, 2.4)), aR: P.aR ?? P.a ?? (steepL ? r.range(2.0, 2.4) : r.range(2.6, 3.2)), b: P.b ?? r.range(1.3, 1.7), lean, main: true },
  ];
  const sh = [];
  for (const side of [-1, 1]) {
    const W = side < 0 ? P.wl : P.wr;
    const n = (side < 0 ? P.knobsL : P.knobsR) ?? P.knobs ?? (W < 100 || P.tone < 0.5 ? (r() < 0.6 ? 1 : 0) : 1 + (r() < 0.5 ? 1 : 0));
    let hh = 1;
    for (let k = 0; k < n; k++) {
      hh *= P.shDecay ? r.range(P.shDecay[0], P.shDecay[1]) : r.range(0.66, 0.86);
      const f = 0.32 + 0.45 * (k + 0.7) / n + r.range(-0.06, 0.06);
      const tw = W * Math.min(1.15 - f, r.range(0.38, 0.55));
      const st = r() < 0.5;
      sh.push({ x: P.x + side * f * W, top: P.base - H * hh * (0.9 + 0.1 * r()), wl: tw * r.range(0.75, 1.2), wr: tw * r.range(0.75, 1.2),
        aL: P.a ?? (st ? r.range(2.8, 3.6) : r.range(2.1, 2.6)), aR: P.a ?? (st ? r.range(2.1, 2.6) : r.range(2.8, 3.6)), b: P.b ?? r.range(1.2, 1.55), lean: lean * 0.6 + r.range(-0.06, 0.06) });
    }
  }
  sh.sort((p, q) => p.top - q.top);
  T.push(...sh);
  T.forEach((t, i) => { t.base = P.base; t.k = P.seed * 3.1 + i * 1.7; t.knobAmp = P.knobAmp; });
  return T;
}

// Silhouette of one thumb as a 1 px lookup table (the lean shears the profile so the top stays at T.x).
function thumbSil(T, nz, rough) {
  const H = T.base - T.top, shift = T.lean * H;
  const xa = Math.floor(T.x - T.wl - Math.abs(shift) - 3), xb = Math.ceil(T.x + T.wr + Math.abs(shift) + 3);
  const tab = new Float32Array(xb - xa + 1).fill(T.base);
  let px = null, py = 0;
  for (let xs = T.x - T.wl; xs <= T.x + T.wr + 0.01; xs += 0.5) {
    const dx = xs - T.x, w = dx < 0 ? T.wl : T.wr, a = dx < 0 ? T.aL : T.aR;
    const u = Math.min(1, Math.abs(dx) / w);
    let h = Math.pow(Math.max(0, 1 - Math.pow(u, a)), T.b);
    h += rough * (0.09 * nz.fbm2(xs / (w * 0.4), T.k, 3) * ss(0.05, 0.5, h)
      + 0.065 * (T.knobAmp ?? 1) * (0.45 - Math.abs(nz.n2(xs / 18, T.k + 3.3))) * ss(0.35, 0.85, h)
      + 0.014 * nz.n2(xs / 4, T.k + 9.1) * ss(0, 0.2, h));
    h = Math.max(0, h);
    const X = xs + shift * (h - 1), Y = T.base - H * h;
    if (px !== null) {
      const lo = Math.ceil(Math.min(px, X)), hi = Math.floor(Math.max(px, X));
      for (let xi = lo; xi <= hi; xi++) {
        const t = X === px ? 0 : (xi - px) / (X - px);
        const y = py + (Y - py) * t, j = xi - xa;
        if (j >= 0 && j < tab.length && y < tab[j]) tab[j] = y;
      }
    }
    px = X; py = Y;
  }
  T.xa = xa; T.xb = xb;
  return (x) => {
    const f = x - xa;
    if (f <= 0 || f >= tab.length - 1) return T.base;
    const i = f | 0, t = f - i;
    return tab[i] + (tab[i + 1] - tab[i]) * t;
  };
}

function silhouettes(api, P) {
  const nz = api.noise(P.seed * 31 + 7);
  const T = thumbsOf(api, P);
  for (const t of T) t.sil = thumbSil(t, nz, P.rough);
  const sil = (x) => { let y = P.base; for (const t of T) y = Math.min(y, t.sil(x)); return y; };
  return { T, sil, x0: Math.min(...T.map((t) => t.xa)), x1: Math.max(...T.map((t) => t.xb)) };
}

function paintThumb(g, T, P, paper, sc, k, r, nz, detail) {
  const H = T.base - T.top, W = T.wl + T.wr;
  const sil = T.sil;
  const vD = 1 - P.tone;
  const ink = (v, a) => rgba(toneRGB(Math.min(1, Math.max(0, v)), paper), a);
  const hOf = (x) => (T.base - sil(x)) / H;
  const xa = T.xa, xb = T.xb;
  const shift = T.lean * H;
  const cxAt = (y) => T.x + shift * ((T.base - y) / H - 1);
  const uAt = (x, y) => { const d = x - cxAt(y); return d / (d < 0 ? T.wl : T.wr); };
  const path = new Path2D();
  path.moveTo(xa - 2, T.base + 2);
  const top = [];
  for (let x = xa; x <= xb; x += 2) { const y = sil(x); top.push([x, y]); path.lineTo(x, y); }
  path.lineTo(xb + 2, T.base + 2); path.closePath();
  g.fillStyle = rgba(paper, 1);
  g.fill(path);
  g.save();
  g.clip(path);
  const bo = P.body * (T.skirt ? 0.6 : 1);
  // body: a light vertical wash plus ink pooled under the whole crown line (flanks included)
  const gr = g.createLinearGradient(0, T.top, 0, T.top + H);
  gr.addColorStop(0, ink(vD, Math.min(0.8, 0.42 * bo))); gr.addColorStop(0.45, ink(vD, 0.26 * bo)); gr.addColorStop(0.85, ink(vD, 0.1 * bo)); gr.addColorStop(1, ink(vD, 0));
  g.fillStyle = gr; g.fillRect(xa - 4, T.top - 4, xb - xa + 8, H + 8);
  // shaded right flank (light from the upper left), a darker rim on the far left
  const xm = T.x - shift * 0.5;
  const hg = g.createLinearGradient(xm - T.wl, 0, xm + T.wr, 0);
  hg.addColorStop(0, ink(vD, 0.1 * bo)); hg.addColorStop(0.2, ink(vD, 0)); hg.addColorStop(0.6, ink(vD, 0)); hg.addColorStop(0.85, ink(vD, 0.1 * bo)); hg.addColorStop(1, ink(vD, 0.2 * bo));
  g.fillStyle = hg; g.fillRect(xa - 4, T.top - 4, xb - xa + 8, H + 8);
  const crown = top.filter((p) => p[1] < T.base - 2);
  g.save();
  g.filter = `blur(${(Math.max(2, 0.025 * W) * k).toFixed(2)}px)`;
  if (crown.length > 2) {
    g.lineJoin = 'round';
    g.beginPath(); crown.forEach((p, i) => (i ? g.lineTo(p[0], p[1] + 2) : g.moveTo(p[0], p[1] + 2)));
    g.lineWidth = Math.max(6, 0.16 * W); g.strokeStyle = ink(vD, 0.36 * bo); g.stroke();
  }
  // mottled grey planes, stretched vertically (rock faces, not clouds)
  const nM = 3 + Math.round(W / 30);
  for (let i = 0; i < nM; i++) {
    const u = r.range(-0.9, 0.95), x = T.x + u * (u < 0 ? T.wl : T.wr);
    const y = sil(x) + H * Math.pow(r(), 1.3) * 0.6;
    blob(g, x, y, W * r.range(0.03, 0.08), { color: ink(vD * (0.9 + 0.1 * r()), r.range(0.08, 0.24) * bo), rng: r, irregular: 0.55, squash: r.range(1.4, 3), rot: r.range(-0.2, 0.2) });
  }
  if (!T.skirt) {
    for (let i = 0; i < 2 + Math.round(W / 60); i++) {
      const x = T.x - T.wl * r.range(-0.2, 0.7), y = sil(x) + H * r.range(0.25, 0.65);
      blob(g, x, y, W * r.range(0.03, 0.07), { color: rgba(paper, r.range(0.3, 0.6)), rng: r, irregular: 0.5, squash: r.range(1.8, 3.5) });
    }
  }
  g.restore();
  // stippled rock texture: small translucent vertical marks whose density follows a mottled field
  {
    const N = Math.round(W * H / 80 * (0.35 + 0.95 * detail * detail) * (T.skirt ? 0.5 : 1));
    for (let i = 0; i < N; i++) {
      const x = xa + (xb - xa) * r(), ys = sil(x);
      if (ys >= T.base - 2) continue;
      const y = ys + (T.base - ys) * Math.pow(r(), 1.4);
      const u = uAt(x, y);
      const dTop = 1 - Math.min(1, (y - ys) / (H * 0.8));
      const flank = u > 0 ? ss(0.25, 1, u) : 0.5 * ss(0.6, 1, -u);
      const lit = u < 0.1 && u > -0.6 ? 1 - Math.abs(u + 0.25) / 0.35 : 0;
      const field = 0.5 + 0.9 * nz.fbm2(x / 22 + T.k, y / 30, 3);
      const p = (0.15 + 0.55 * dTop + 0.55 * flank - 0.4 * Math.max(0, lit)) * field;
      if (r() > p) continue;
      const rr = (1.2 + 3 * r() * r()) * sc + 0.5;
      blob(g, x, y, rr, { color: ink(vD * (0.8 + 0.2 * r()), r.range(0.08, 0.26) * (0.5 + 0.5 * bo)), rng: r, irregular: 0.55, squash: r.range(1.1, 2.4), rot: r.range(-0.2, 0.2), sides: 7 });
    }
  }
  // ridges: dark wavering lines running down from the crown, the face right of each in shade,
  // hemp-fibre companions and texture dabs along them
  if (detail > 0.05 && (!T.skirt || (P.skirt ?? 0) > 0.5)) {
    const nF = Math.max(2, Math.round((W / 22) * (0.45 + 0.55 * detail) * (T.skirt ? 0.6 : 1)));
    const folds = [];
    for (let i = 0; i < nF; i++) {
      const xs = xa + (xb - xa) * (0.06 + 0.88 * (i + r.range(0.15, 0.85)) / nF);
      const hf = hOf(xs);
      if (hf < 0.2) continue;
      const ys = sil(xs) + 1, len = H * hf * r.range(0.25, 0.75);
      const u = uAt(xs, ys);
      const ang = u * 0.2 - T.lean + r.range(-0.07, 0.07);
      const pts = [];
      for (let s = 0; s <= 1.001; s += 0.1) pts.push([xs + Math.sin(ang) * len * s + nz.n2(i * 3.7 + T.k, s * 3) * W * 0.035 * s, ys + Math.cos(ang) * len * s]);
      folds.push({ pts, hf, u, len, fw: W * r.range(0.05, 0.12) * (u > 0 ? 1.3 : 0.8) });
    }
    g.save();
    g.filter = `blur(${(1.6 * sc * k).toFixed(2)}px)`;
    for (const f of folds) {
      if (r() > 0.85) continue;
      const a = r.range(0.2, 0.42) * (0.4 + 0.6 * detail) * bo;
      for (const m of [1, 0.55, 0.25]) {
        const poly = new Path2D();
        f.pts.forEach((p, j) => (j ? poly.lineTo(p[0], p[1]) : poly.moveTo(p[0], p[1])));
        for (let j = f.pts.length - 1; j >= 0; j--) { const s = j / (f.pts.length - 1); poly.lineTo(f.pts[j][0] + f.fw * m * (0.35 + 0.65 * s), f.pts[j][1] + 2); }
        poly.closePath();
        const gg = g.createLinearGradient(0, f.pts[0][1], 0, f.pts[f.pts.length - 1][1]);
        gg.addColorStop(0, ink(vD, a / 2)); gg.addColorStop(0.6, ink(vD, a / 5)); gg.addColorStop(1, ink(vD, 0));
        g.fillStyle = gg; g.fill(poly);
      }
    }
    g.restore();
    for (const f of folds) {
      const n = f.pts.length;
      const w0 = (1.1 + 2.2 * f.hf * r()) * sc + 0.5;
      if (r() < 0.75) stroke(g, f.pts.slice(0, Math.max(4, Math.round(n * r.range(0.45, 1.0)))), { width: [w0, w0 * 0.15], profile: 'taper', color: ink(vD * 0.6, r.range(0.5, 0.9) * (0.3 + 0.7 * detail)), rng: r, rough: 0.6 });
      const nh = 1 + ((r() * 3) | 0);
      for (let q = 0; q < nh; q++) {
        const off = (q + 1) * r.range(3, 7) * sc, s0 = r.range(0, 0.35), s1 = s0 + r.range(0.25, 0.6);
        const sub = f.pts.filter((_, j) => j / (n - 1) >= s0 && j / (n - 1) <= s1).map((p) => [p[0] + off + r.range(-1, 1), p[1]]);
        if (sub.length > 2) stroke(g, sub, { width: [(0.5 + r()) * sc + 0.3, 0.3], profile: 'taper', color: ink(vD * 0.7, r.range(0.25, 0.55) * detail), rng: r, rough: 0.6 });
      }
      const nd = Math.round(f.len / 4 * (0.3 + 0.7 * detail));
      for (let q = 0; q < nd; q++) {
        const s = Math.pow(r(), 1.6), j = s * (n - 1), j0 = j | 0, j1 = Math.min(n - 1, j0 + 1), t = j - j0;
        const px = f.pts[j0][0] + (f.pts[j1][0] - f.pts[j0][0]) * t, py = f.pts[j0][1] + (f.pts[j1][1] - f.pts[j0][1]) * t;
        const o = Math.abs(r() + r() - 1) * f.fw * 1.2;
        blob(g, px + o, py + r.range(-3, 3), (0.8 + 1.5 * r()) * sc + 0.4, { color: ink(vD * (0.7 + 0.25 * r()), r.range(0.15, 0.5) * (1 - 0.6 * s)), rng: r, irregular: 0.5, squash: r.range(1.4, 2.8), rot: r.range(-0.2, 0.2), sides: 6 });
      }
    }
    // rounded boulder lumps in the upper body: convex arcs with dabs pooled under them
    if (!T.skirt && detail > 0.5) {
      const nB = Math.round(W / 22 * detail);
      for (let i = 0; i < nB; i++) {
        const x = xa + (xb - xa) * r.range(0.1, 0.9), ys = sil(x);
        if (ys > T.base - H * 0.4) continue;
        const R = r.range(7, 18) * sc, y = ys + R + H * Math.pow(r(), 1.5) * 0.45;
        const a0 = Math.PI * r.range(1.05, 1.25), a1 = Math.PI * r.range(1.75, 1.95), pts = [];
        for (let q = 0; q <= 6; q++) { const a = a0 + (a1 - a0) * q / 6; pts.push([x + Math.cos(a) * R, y + Math.sin(a) * R * 0.8]); }
        stroke(g, pts, { width: [(0.8 + 1.2 * r()) * sc + 0.3, 0.4], profile: 'taper', color: ink(vD * 0.65, r.range(0.3, 0.65) * detail), rng: r, rough: 0.5 });
        for (let q = 0; q < 6; q++) blob(g, x + r.range(0.1, 0.9) * R, y + r.range(-0.2, 0.4) * R, (0.7 + 1.2 * r()) * sc + 0.3, { color: ink(vD * 0.8, r.range(0.12, 0.35)), rng: r, irregular: 0.5, squash: r.range(0.8, 1.8), sides: 6 });
      }
    }
    // short cun strokes, near-vertical, biased to the flanks and the upper body
    const nC = Math.round(W * H / 1800 * P.cun * detail);
    for (let i = 0; i < nC; i++) {
      const side = r() < 0.4 ? -1 : 1, u = side * Math.pow(r(), 0.45) * 0.95;
      const x0 = T.x + u * (u < 0 ? T.wl : T.wr);
      const dd = Math.pow(r(), 1.5) * H * hOf(x0) * 0.7, y = sil(x0) + 3 + dd;
      const x = x0 + shift * ((T.base - y) / H - 1);
      if (sil(x) > y - 2) continue;
      const near = 1 - dd / (H * 0.7);
      const L = (6 + 18 * r()) * sc, ang = u * 0.25 - T.lean + r.range(-0.15, 0.15);
      stroke(g, [[x, y], [x + Math.sin(ang) * L * 0.5 + r.range(-1, 1), y + Math.cos(ang) * L * 0.5], [x + Math.sin(ang) * L, y + Math.cos(ang) * L]],
        { width: [(0.6 + 1.6 * r()) * sc + 0.3, 0.4], profile: 'taper', color: ink(vD * (0.75 + 0.2 * r()), (0.15 + 0.45 * near) * r.range(0.6, 1)), rng: r, rough: 0.5 });
    }
  }
  // moss dots and dark crown clumps along the upper edge (clustered)
  for (let x = xa; x <= xb; x += 4 * sc) {
    const hf = hOf(x), u = Math.abs(uAt(x, sil(x)));
    if (hf < 0.25 || u > 0.92) continue;
    if (r() < 0.4 * P.moss * ss(-0.2, 0.35, nz.n2(x / (W * 0.12), T.k + 2.9))) {
      const n = 2 + ((r() * 4) | 0);
      for (let j = 0; j < n; j++) blob(g, x + r.range(-3, 3) * sc, sil(x) + r.range(1, 10) * sc, (0.8 + 1.8 * r()) * sc + 0.3, { color: ink(vD * 0.65, r.range(0.6, 0.95)), rng: r, irregular: 0.4, squash: 0.8 });
    }
    if (!T.skirt && u < 0.8 && r() < 0.6 * P.moss * ss(0.5, 0.95, hf) * ss(-0.1, 0.3, nz.n2(x / (W * 0.1), T.k + 5.1))) {
      const rr = (3 + 5 * r()) * sc;
      blob(g, x + r.range(-4, 4) * sc, sil(x) + rr * 0.5 + r.range(0, 4), rr, { color: ink(vD * 0.55, r.range(0.5, 0.85)), rng: r, irregular: 0.45, squash: 0.7, sides: 10 });
    }
  }
  g.restore();
  // broken dark dry contour along the crown and shoulders
  let seg = [];
  const flush = () => {
    if (seg.length > 3) {
      const cv0 = Math.min(1, vD * 0.95);
      dryStroke(g, seg, { width: (2.2 + 2.4 * r()) * sc + 0.5, bristles: 5, color: ink(cv0, 0.7), alpha: 0.12 + 0.5 * detail, dry: 0.5, rng: r, noise: nz });
    }
    seg = [];
  };
  for (const [x, y] of top) {
    const hf = hOf(x);
    if (hf < 0.2 || r() > 0.1 + 0.9 * ss(0.3, 0.8, hf)) { flush(); continue; }
    seg.push([x, y + 0.8]);
    if (seg.length > 18 + r() * 30) { flush(); seg.push([x, y + 0.8]); }
  }
  flush();
  // dark bushy clumps capping the highest crowns (ref: the main peaks wear a cap of dark foliage)
  if ((P.crownBush ?? 0) > 0 && !T.skirt) {
    for (let x = xa; x <= xb; x += 7 * sc) {
      const hf = hOf(x);
      if (hf < 0.8 || r() > P.crownBush * ss(0.8, 0.95, hf) * (T.main ? 1 : 0.6)) continue;
      const n = 3 + ((r() * 4) | 0), y0 = sil(x);
      for (let j = 0; j < n; j++) blob(g, x + r.range(-6, 6) * sc, y0 + r.range(-2, 10) * sc, (2.5 + 4 * r()) * sc, { color: ink(vD * 0.45, r.range(0.55, 0.9)), rng: r, irregular: 0.5, squash: r.range(0.6, 0.9), sides: 9 });
    }
  }
  // conifers in clusters on the crown (some thumbs stay bare), a few clusters on ledges
  if (P.trees > 0 && !T.skirt && (T.main || r() < 0.7)) {
    let x = xa + 4 + r() * P.treeH * 0.4, j = 0;
    while (x < xb - 4) {
      const hf = hOf(x);
      const cl = ss(-0.05, 0.35, nz.n2(x / (P.treeH * 3), T.k + 8.8));
      const dens = P.trees * 1.6 * ss(0.5, 0.85, hf) * cl;
      if (r() < dens) {
        const th = P.treeH * (0.5 + 0.9 * r() * r()) * (0.75 + 0.25 * hf) * (T.main ? 1 : 0.85);
        paintConifer(g, x, sil(x) + th * 0.18, th, { kind: r() < 0.7 ? 'fir' : 'pine', tone: Math.min(1, vD * 0.8), paper, seed: Math.round(T.k * 1000) + j, detail: 0 });
      }
      x += P.treeH * r.range(0.22, 0.55);
      j++;
    }
    const nL = Math.round(P.trees * W / 80 * r());
    for (let i = 0; i < nL; i++) {
      const u = r.range(0.2, 0.85) * (r() < 0.7 ? 1 : -1), lx = T.x + u * (u < 0 ? T.wl : T.wr);
      if (hOf(lx) < 0.35) continue;
      const ly = sil(lx) + H * r.range(0.12, 0.4);
      const n = 2 + ((r() * 3) | 0);
      for (let q = 0; q < n; q++) {
        const th = P.treeH * r.range(0.45, 0.8);
        paintConifer(g, lx + r.range(-1, 1) * P.treeH * 0.6, ly + r.range(-3, 3), th, { kind: 'fir', tone: Math.min(1, vD * 0.85 + 0.05), paper, seed: Math.round(T.k * 977) + i * 7 + q, detail: 0 });
      }
    }
  }
}

function paintMountain(ctx, api, P, paper, k) {
  const r = api.rng(P.seed * 7919 + 13);
  const nz = api.noise(P.seed * 31 + 7);
  const H = P.base - P.top;
  const sc = Math.min(1.6, Math.max(0.35, H / 300));
  const S = silhouettes(api, P);
  const detail = P.detail ?? ss(0.3, 0.8, P.tone);
  const x0 = S.x0, x1 = S.x1;
  const bx = Math.floor(x0 - P.treeH - 12), by = Math.floor(P.top - P.treeH * 1.6 - 14), bw = Math.ceil(x1 - x0 + 2 * P.treeH + 24), bh = Math.ceil(P.base - by + 4);
  const cv = new OffscreenCanvas(Math.max(1, Math.ceil(bw * k)), Math.max(1, Math.ceil(bh * k)));
  const g = cv.getContext('2d');
  g.setTransform(k, 0, 0, k, -bx * k, -by * k);
  for (const T of S.T) paintThumb(g, T, P, paper, sc, k, r, nz, detail);
  // mist dissolve toward the base (noisy low-res mask)
  const ds = 4;
  const mw = Math.ceil(bw / ds), mh = Math.ceil(bh / ds);
  const mc = new OffscreenCanvas(mw, mh);
  const mg = mc.getContext('2d');
  const img = mg.createImageData(mw, mh);
  const f0 = P.top + H * P.fade[0], f1 = P.top + H * P.fade[1];
  for (let jy = 0; jy < mh; jy++) for (let ix = 0; ix < mw; ix++) {
    const X = bx + (ix + 0.5) * ds, Y = by + (jy + 0.5) * ds;
    const n = nz.fbm2(X / 75, Y / 32, 3);
    const m = 1 - ss(f0, f1, Y + n * H * 0.25);
    img.data[(jy * mw + ix) * 4 + 3] = Math.round(m * 255);
  }
  mg.putImageData(img, 0, 0);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'destination-in';
  g.imageSmoothingEnabled = true;
  g.drawImage(mc, 0, 0, mw, mh, 0, 0, mw * ds * k, mh * ds * k);
  ctx.drawImage(cv, bx, by, cv.width / k, cv.height / k);
}

export function makeMountains(api, o) {
  const rect = o.rect;
  const paper = o.paper || PAPER;
  const D = { tone: o.tone ?? 0.5, a: o.a, b: o.b, trees: o.trees ?? 0.5, treeH: o.treeH ?? 18, fade: o.fade ?? [0.35, 1.0], rough: o.rough ?? 1, moss: o.moss ?? 1, cun: o.cun ?? 1, body: o.body ?? 1, base: o.base ?? 800, detail: o.detail, skirt: o.skirt, knobAmp: o.knobAmp, shDecay: o.shDecay, crownBush: o.crownBush };
  const mk = (pk, i) => { const P = { ...D, ...pk, seed: pk.seed ?? i + 1 }; P.wl = pk.wl ?? pk.w ?? 150; P.wr = pk.wr ?? pk.w ?? 150; return P; };
  const T0 = performance.now();
  const raw = api.bakeCanvas(rect[2], rect[3], (ctx, { k }) => {
    ctx.translate(-rect[0], -rect[1]);
    o.peaks.forEach((pk, i) => paintMountain(ctx, api, mk(pk, i), paper, k));
  }, { scale: o.scale ?? 1 });
  console.warn('mountains bake ms', Math.round(performance.now() - T0), o.peaks.length);
  const src = o.ink === false ? raw : inkify(api, raw, { edge: 0.35, granulation: 0.18, bleed: 0.8, ...(o.ink || {}) });
  if (src !== raw) api.engine?.freeTex?.(raw);
  // topAt(x): highest silhouette y over all peaks of the card (for placing trees from outside)
  const sils = o.peaks.map((pk, i) => silhouettes(api, mk(pk, i)));
  const topAt = (x) => { let y = 1e9; for (const s of sils) if (x >= s.x0 && x <= s.x1) y = Math.min(y, s.sil(x)); return y; };
  return { src, rect, topAt, layer: (lo = {}) => api.tex(src, { rect, ...lo }) };
}
