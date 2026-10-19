// s01 helper: misty shan shui mountain masses (ref 01 style), painted with Canvas2D brushwork.
// Each peak is a cluster of rounded "thumbs" (a tall main pillar, lower shoulder pillars stepping
// down both flanks, a low skirt behind), painted back to front so every shoulder's top edge reads
// as a ledge across the mass. Each thumb gets mottled grey planes (lit centre-left, shaded right
// flank), a few creases, cun strokes biased to the flanks, moss dots, a broken dry contour and
// conifers on its crown and ledges. The base of each peak dissolves into mist (noisy mask).
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
function thumbsOf(api, P) {
  const r = api.rng(P.seed * 4271 + 5);
  const H = P.base - P.top;
  const T = [
    { x: P.x, top: P.base - H * 0.5, wl: P.wl * 1.1, wr: P.wr * 1.1, a: 1.6, b: 1.3, skirt: true },
    { x: P.x, top: P.top, wl: P.wl * 0.66, wr: P.wr * 0.66, a: P.a, b: P.b, main: true },
  ];
  const sh = [];
  for (const side of [-1, 1]) {
    const W = side < 0 ? P.wl : P.wr;
    const n = P.knobs ?? (W < 100 || P.tone < 0.5 ? (r() < 0.6 ? 1 : 0) : 1 + (r() < 0.35 ? 1 : 0));
    let hh = 1;
    for (let k = 0; k < n; k++) {
      hh *= r.range(0.72, 0.88);
      const f = 0.42 + 0.5 * (k + 0.7) / n + r.range(-0.05, 0.05);
      const tw = W * Math.min(1.15 - f, r.range(0.34, 0.46));
      sh.push({ x: P.x + side * f * W, top: P.base - H * hh * (0.92 + 0.08 * r()), wl: tw * r.range(0.8, 1.15), wr: tw * r.range(0.8, 1.15), a: r.range(2.2, 3.0), b: r.range(0.75, 1.0) });
    }
  }
  sh.sort((p, q) => p.top - q.top);
  T.push(...sh);
  T.forEach((t, i) => { t.base = P.base; t.k = P.seed * 3.1 + i * 1.7; });
  return T;
}

function thumbSil(T, nz, rough) {
  const H = T.base - T.top;
  return (x) => {
    const dx = x - T.x, w = dx < 0 ? T.wl : T.wr;
    const u = Math.abs(dx) / w;
    if (u >= 1) return T.base;
    let h = Math.pow(1 - Math.pow(u, T.a), T.b);
    h += rough * (0.07 * nz.fbm2(x / (w * 0.3), T.k, 3) * ss(0.05, 0.5, h) + 0.015 * nz.n2(x / 5, T.k + 9.1) * ss(0, 0.2, h));
    return T.base - H * Math.max(0, h);
  };
}

function silhouettes(api, P) {
  const nz = api.noise(P.seed * 31 + 7);
  const T = thumbsOf(api, P);
  for (const t of T) t.sil = thumbSil(t, nz, P.rough);
  const sil = (x) => { let y = P.base; for (const t of T) y = Math.min(y, t.sil(x)); return y; };
  return { T, sil, x0: Math.min(...T.map((t) => t.x - t.wl)), x1: Math.max(...T.map((t) => t.x + t.wr)) };
}

function paintThumb(g, T, P, paper, sc, k, r, nz, detail) {
  const H = T.base - T.top, W = T.wl + T.wr;
  const sil = T.sil;
  const vD = 1 - P.tone;
  const ink = (v, a) => rgba(toneRGB(Math.min(1, Math.max(0, v)), paper), a);
  const hOf = (x) => (T.base - sil(x)) / H;
  const xa = T.x - T.wl, xb = T.x + T.wr;
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
  // body: darker toward the top
  const gr = g.createLinearGradient(0, T.top, 0, T.top + H);
  gr.addColorStop(0, ink(vD, Math.min(0.85, 0.42 * bo))); gr.addColorStop(0.4, ink(vD, 0.26 * bo)); gr.addColorStop(0.8, ink(vD, 0.1 * bo)); gr.addColorStop(1, ink(vD, 0));
  g.fillStyle = gr; g.fillRect(xa - 4, T.top - 4, W + 8, H + 8);
  // mottled planes: shaded right flank, darker left rim, grey patches, lit planes
  g.save();
  g.filter = `blur(${(Math.max(1.5, 0.012 * W) * k).toFixed(2)}px)`;
  const nSh = 3 + Math.round(W / 40);
  for (let i = 0; i < nSh; i++) {
    const x = T.x + T.wr * r.range(0.4, 1.0), y = sil(x) + H * r.range(0.02, 0.4);
    blob(g, x, y, W * r.range(0.07, 0.15), { color: ink(vD, r.range(0.14, 0.3) * bo), rng: r, irregular: 0.5, squash: r.range(1.1, 2) });
  }
  for (let i = 0; i < 2 + Math.round(W / 90); i++) {
    const x = T.x - T.wl * r.range(0.7, 1.0), y = sil(x) + H * r.range(0.02, 0.4);
    blob(g, x, y, W * r.range(0.05, 0.1), { color: ink(vD, r.range(0.1, 0.22) * bo), rng: r, irregular: 0.5, squash: r.range(1.6, 3) });
  }
  const nM = 5 + Math.round(W / 18);
  for (let i = 0; i < nM; i++) {
    const u = r.range(-0.9, 0.9), x = T.x + u * (u < 0 ? T.wl : T.wr);
    const y = sil(x) + H * Math.pow(r(), 1.3) * 0.7;
    blob(g, x, y, W * r.range(0.035, 0.11), { color: ink(vD * (0.9 + 0.1 * r()), r.range(0.08, 0.28) * bo), rng: r, irregular: 0.55, squash: r.range(0.7, 1.8), rot: r.range(-0.5, 0.5) });
  }
  if (!T.skirt) {
    for (let i = 0; i < 2 + Math.round(W / 70); i++) {
      const x = T.x - T.wl * r.range(-0.1, 0.65), y = sil(x) + H * r.range(0.12, 0.6);
      blob(g, x, y, W * r.range(0.06, 0.13), { color: rgba(paper, r.range(0.45, 0.8)), rng: r, irregular: 0.5, squash: r.range(1.2, 2.4) });
    }
  }
  g.restore();
  // stippled rock texture: many small translucent marks whose density follows a mottled field
  // (denser near the crown and on the shaded right flank, open on the lit centre-left)
  {
    const N = Math.round(W * H / 55 * (0.35 + 0.65 * detail) * (T.skirt ? 0.5 : 1));
    for (let i = 0; i < N; i++) {
      const u = r.range(-1, 1), x = T.x + u * (u < 0 ? T.wl : T.wr), ys = sil(x);
      if (ys >= T.base - 2) continue;
      const y = ys + (T.base - ys) * Math.pow(r(), 1.4);
      const dTop = 1 - Math.min(1, (y - ys) / (H * 0.8));
      const flank = u > 0 ? ss(0.25, 1, u) : 0.5 * ss(0.6, 1, -u);
      const lit = u < 0.1 && u > -0.6 ? 1 - Math.abs(u + 0.25) / 0.35 : 0;
      const field = 0.5 + 0.9 * nz.fbm2(x / 28 + T.k, y / 20, 3);
      const p = (0.15 + 0.55 * dTop + 0.55 * flank - 0.35 * Math.max(0, lit)) * field;
      if (r() > p) continue;
      const rr = (1.5 + 4.5 * r() * r()) * sc + 0.5;
      blob(g, x, y, rr, { color: ink(vD * (0.85 + 0.15 * r()), r.range(0.06, 0.2) * (0.5 + 0.5 * bo)), rng: r, irregular: 0.55, squash: r.range(0.6, 1.8), rot: u * 0.4, sides: 7 });
    }
  }
  // creases (a soft shadow wash on their left), fanning out from the crown
  if (detail > 0.05 && !T.skirt) {
    const nF = Math.max(1, Math.round((W / 38) * (0.5 + 0.5 * detail)));
    const folds = [];
    for (let i = 0; i < nF; i++) {
      const u = r.range(-0.75, 0.8), xs = T.x + u * (u < 0 ? T.wl : T.wr);
      const hf = hOf(xs);
      if (hf < 0.25) continue;
      const ys = sil(xs) + 2, len = H * hf * r.range(0.22, 0.6);
      const ang = u * 0.32 + r.range(-0.08, 0.08);
      const pts = [];
      for (let s = 0; s <= 1.001; s += 0.125) pts.push([xs + Math.sin(ang) * len * s + nz.n2(i * 3.7 + T.k, s * 2.2) * W * 0.03 * s, ys + Math.cos(ang) * len * s]);
      folds.push({ pts, hf, u });
    }
    g.save();
    g.filter = `blur(${(1.8 * sc * k).toFixed(2)}px)`;
    for (const f of folds) {
      if (r() > 0.75) continue;
      const fw = W * r.range(0.05, 0.12);
      const poly = new Path2D();
      f.pts.forEach((p, j) => (j ? poly.lineTo(p[0], p[1]) : poly.moveTo(p[0], p[1])));
      for (let j = f.pts.length - 1; j >= 0; j--) { const s = j / (f.pts.length - 1); poly.lineTo(f.pts[j][0] - fw * (0.3 + 0.7 * s), f.pts[j][1] + 3); }
      poly.closePath();
      const gg = g.createLinearGradient(0, f.pts[0][1], 0, f.pts[f.pts.length - 1][1]);
      const a = r.range(0.22, 0.48) * detail;
      gg.addColorStop(0, ink(vD, a)); gg.addColorStop(1, ink(vD, 0));
      g.fillStyle = gg; g.fill(poly);
    }
    g.restore();
    for (const f of folds) {
      const w0 = (1 + 2.6 * f.hf * r()) * sc + 0.4;
      stroke(g, f.pts.slice(0, Math.max(3, Math.round(f.pts.length * r.range(0.4, 1.0)))), { width: [w0, w0 * 0.2], profile: 'taper', color: ink(vD * 0.7, r.range(0.45, 0.9) * detail), rng: r, rough: 0.5 });
    }
    // cun strokes, biased to the flanks and the upper body
    const nC = Math.round(W * H / 1500 * P.cun * detail);
    for (let i = 0; i < nC; i++) {
      const side = r() < 0.4 ? -1 : 1, u = side * Math.pow(r(), 0.45) * 0.95;
      const x = T.x + u * (u < 0 ? T.wl : T.wr);
      const dd = Math.pow(r(), 1.5) * H * hOf(x) * 0.7, y = sil(x) + 3 + dd;
      const near = 1 - dd / (H * 0.7);
      const L = (5 + 16 * r()) * sc, ang = u * 0.4 + r.range(-0.25, 0.25);
      stroke(g, [[x, y], [x + Math.sin(ang) * L * 0.5 + r.range(-1, 1), y + Math.cos(ang) * L * 0.5], [x + Math.sin(ang) * L, y + Math.cos(ang) * L]],
        { width: [(0.7 + 2 * r()) * sc + 0.3, 0.4], profile: 'taper', color: ink(vD * (0.8 + 0.2 * r()), (0.15 + 0.45 * near) * r.range(0.6, 1)), rng: r, rough: 0.5 });
    }
  }
  // moss dots and dark crown clumps along the upper edge
  for (let x = xa; x <= xb; x += 4 * sc) {
    const hf = hOf(x), u = Math.abs(x - T.x) / (x < T.x ? T.wl : T.wr);
    if (hf < 0.3 || u > 0.9) continue;
    if (r() < 0.35 * P.moss * ss(-0.3, 0.3, nz.n2(x / (W * 0.15), T.k + 2.9))) {
      const n = 2 + ((r() * 4) | 0);
      for (let j = 0; j < n; j++) blob(g, x + r.range(-3, 3) * sc, sil(x) + r.range(1, 9) * sc, (0.8 + 1.8 * r()) * sc + 0.3, { color: ink(vD * 0.7, r.range(0.6, 0.95)), rng: r, irregular: 0.4, squash: 0.8 });
    }
    if (!T.skirt && u < 0.7 && r() < 0.45 * P.moss * ss(0.55, 0.95, hf)) {
      const rr = (3 + 5 * r()) * sc;
      blob(g, x + r.range(-4, 4) * sc, sil(x) + rr * 0.5 + r.range(0, 4), rr, { color: ink(vD * 0.6, r.range(0.5, 0.85)), rng: r, irregular: 0.45, squash: 0.7, sides: 10 });
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
  // conifers on the crown and down the shoulders, a few clusters on ledges
  if (P.trees > 0 && !T.skirt) {
    let x = xa + T.wl * 0.15 + r() * P.treeH * 0.4, j = 0;
    while (x < xb - T.wr * 0.12) {
      const hf = hOf(x);
      const dens = P.trees * 1.3 * ss(0.45, 0.85, hf) * (0.25 + 0.75 * ss(-0.4, 0.3, nz.n2(x / (P.treeH * 4), T.k + 8.8)));
      if (r() < dens) {
        const th = P.treeH * (0.55 + 0.75 * r() * r()) * (0.75 + 0.25 * hf) * (T.main ? 1 : 0.85);
        paintConifer(g, x, sil(x) + th * 0.18, th, { kind: r() < 0.75 ? 'fir' : 'pine', tone: Math.min(1, vD * 0.8), paper, seed: Math.round(T.k * 1000) + j, detail: 0 });
      }
      x += P.treeH * r.range(0.28, 0.7);
      j++;
    }
    const nL = Math.round(P.trees * W / 120 * r());
    for (let i = 0; i < nL; i++) {
      const u = r.range(0.2, 0.85) * (r() < 0.7 ? 1 : -1), lx = T.x + u * (u < 0 ? T.wl : T.wr);
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
  const D = { tone: o.tone ?? 0.5, a: o.a ?? 2.6, b: o.b ?? 0.85, trees: o.trees ?? 0.5, treeH: o.treeH ?? 18, fade: o.fade ?? [0.35, 1.0], rough: o.rough ?? 1, moss: o.moss ?? 1, cun: o.cun ?? 1, body: o.body ?? 1, base: o.base ?? 800, detail: o.detail };
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
