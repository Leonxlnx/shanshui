// s02 helper (copied from s01): misty shan shui mountain masses (ref 01 style), painted with Canvas2D brushwork.
// Conical masses with rounded summits, shoulders stepping down the flanks, vertical creases
// radiating from the ridge (a soft shadow wash on one side of each crease), a dark dry-brush
// contour, foliage clumps and small conifers crowning the upper ridge, and a base that
// dissolves into mist (noisy mask). Peaks in one card are listed back to front: each is filled
// with paper first, so nearer masses occlude farther ones. The card is inkified once.
//
// makeMountains(api, { rect, peaks: [{ x, top, wl, wr, base, tone, a, b, fold, trees, treeH,
//                      fade: [f0, f1], rough, foot, seed }], paper, scale, ink }) -> { src, rect, layer(o) }
//   tone   darkest ink density 0..1 (near 0.85, mid 0.6, far 0.3)
//   a, b   flank shape: h(u) = (1 - u^a)^b   (u = |dx| / half width)
//   fade   [f0, f1] fraction of the height where the mist dissolve starts / ends
import { stroke, dryStroke, blob, rgba, tone as toneRGB, PAPER } from '../../lib/brush.js';
import { paintConifer } from '../../lib/pine.js';
import { inkify } from '../../lib/inkfx.js';

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function silhouette(P, nz) {
  const H = P.base - P.top;
  return (x) => {
    const dx = x - P.x, w = dx < 0 ? P.wl : P.wr;
    const u = Math.abs(dx) / w;
    let h = Math.pow(Math.max(1 - Math.pow(Math.min(u, 1), P.a), 0), P.b);
    h += P.foot * Math.exp(-u * 2.2) * (1 - h);
    const rd = 1 - Math.abs(nz.n2(x / (w * 0.38), 1.3));
    const rd2 = 1 - Math.abs(nz.n2(x / (w * 0.17), 7.7));
    h += P.rough * ((rd * rd - 0.5) * 0.17 * ss(0.05, 0.5, h) * (1 - 0.6 * ss(0.85, 1, h))
      + (rd2 * rd2 - 0.5) * 0.05 * ss(0.05, 0.5, h)
      + 0.045 * nz.fbm2(x / (w * 0.1), 4.2, 3) * ss(0, 0.2, h)
      + 0.012 * nz.n2(x / 5, 9.1));
    return P.base - H * Math.max(0, h);
  };
}

function paintMountain(ctx, api, P, paper, k) {
  const r = api.rng(P.seed * 7919 + 13);
  const nz = api.noise(P.seed * 31 + 7);
  const H = P.base - P.top, W = P.wl + P.wr;
  const sc = Math.min(1.6, Math.max(0.35, H / 300));
  const sil = silhouette(P, nz);
  const hOf = (x) => (P.base - sil(x)) / H;
  const vD = 1 - P.tone;                                    // darkest value (0 black .. 1 paper)
  const ink = (v, a) => rgba(toneRGB(Math.min(1, v), paper), a);
  const x0 = P.x - P.wl * 1.3, x1 = P.x + P.wr * 1.3;
  const bx = Math.floor(x0 - 12), by = Math.floor(P.top - P.treeH * 1.6 - 14), bw = Math.ceil(x1 - x0 + 24), bh = Math.ceil(P.base - by + 4);
  const cv = new OffscreenCanvas(Math.max(1, Math.ceil(bw * k)), Math.max(1, Math.ceil(bh * k)));
  const g = cv.getContext('2d');
  g.setTransform(k, 0, 0, k, -bx * k, -by * k);
  // silhouette
  const top = [];
  for (let x = x0; x <= x1; x += 2.5) top.push([x, sil(x)]);
  const path = new Path2D();
  path.moveTo(x0, P.base + 2);
  for (const p of top) path.lineTo(p[0], p[1]);
  path.lineTo(x1, P.base + 2); path.closePath();
  g.fillStyle = rgba(paper, 1);
  g.fill(path);
  g.save();
  g.clip(path);
  // body wash: darker toward the top
  const gr = g.createLinearGradient(0, P.top, 0, P.top + H * 0.9);
  const bo = P.body;
  gr.addColorStop(0, ink(vD, Math.min(0.9, 0.5 * bo))); gr.addColorStop(0.35, ink(vD, Math.min(0.8, 0.3 * bo))); gr.addColorStop(0.75, ink(vD, 0.1 * bo)); gr.addColorStop(1, ink(vD, 0.0));
  g.fillStyle = gr; g.fill(path);
  g.save();
  g.filter = `blur(${(5 * sc * k).toFixed(2)}px)`;
  for (let i = 0; i < 10; i++) {
    const bxp = P.x + r.range(-0.8, 0.8) * (r() < 0.5 ? P.wl : P.wr), hb = hOf(bxp);
    if (hb < 0.2) continue;
    blob(g, bxp, sil(bxp) + H * hb * r.range(0.05, 0.45), W * r.range(0.04, 0.1), { color: ink(vD, r.range(0.1, 0.22)), rng: r, irregular: 0.5, squash: r.range(1.2, 2.2), rot: 1.57 });
  }
  g.restore();
  // creases and shadow faces
  const fs = W * 0.05 * P.fold;
  const nF = Math.max(3, Math.round((x1 - x0) / fs));
  const folds = [];
  for (let i = 0; i < nF; i++) {
    const xs = x0 + (i + 0.5 + r.range(-0.35, 0.35)) * (x1 - x0) / nF;
    const hf = hOf(xs);
    if (hf < 0.1) continue;
    const ys = sil(xs) + 1;
    const len = H * hf * r.range(0.45, 1.0);
    const ang = ((xs - P.x) / W) * 0.8 + r.range(-0.08, 0.08);
    const pts = [];
    for (let s = 0; s <= 1.001; s += 0.125) {
      pts.push([xs + Math.sin(ang) * len * s + nz.n2(i * 3.7, s * 2.2) * fs * 0.4 * s, ys + Math.cos(ang) * len * s]);
    }
    folds.push({ pts, hf, len });
  }
  g.save();
  // major facets: broad shadow planes left of a few main creases (light from the right-front)
  g.filter = `blur(${(3 * sc * k).toFixed(2)}px)`;
  const major = folds.filter((f) => f.hf > 0.35 && r() < 0.45);
  for (const f of major) {
    const fw = W * r.range(0.07, 0.16);
    const poly = new Path2D();
    f.pts.forEach((p, j) => (j ? poly.lineTo(p[0], p[1]) : poly.moveTo(p[0], p[1])));
    for (let j = f.pts.length - 1; j >= 0; j--) { const s = j / (f.pts.length - 1); poly.lineTo(f.pts[j][0] - fw * (0.25 + 0.75 * s), f.pts[j][1] + 4); }
    poly.lineTo(f.pts[0][0] - fw * 0.25, f.pts[0][1] - 30);
    poly.closePath();
    const yA = f.pts[0][1] - 10, yB = f.pts[f.pts.length - 1][1];
    const gg = g.createLinearGradient(0, yA, 0, yB);
    const a = r.range(0.25, 0.5);
    gg.addColorStop(0, ink(vD, a)); gg.addColorStop(0.6, ink(vD, a * 0.6)); gg.addColorStop(1, ink(vD, 0));
    g.fillStyle = gg; g.fill(poly);
  }
  g.filter = `blur(${(1.6 * sc * k).toFixed(2)}px)`;
  for (const f of folds) {
    const fw = fs * r.range(0.6, 1.3);
    const poly = new Path2D();
    f.pts.forEach((p, j) => (j ? poly.lineTo(p[0], p[1]) : poly.moveTo(p[0], p[1])));
    for (let j = f.pts.length - 1; j >= 0; j--) { const s = j / (f.pts.length - 1); poly.lineTo(f.pts[j][0] - fw * (0.35 + 0.65 * s), f.pts[j][1] + 2); }
    poly.closePath();
    const yA = f.pts[0][1], yB = f.pts[f.pts.length - 1][1];
    const gg = g.createLinearGradient(0, yA, 0, yB);
    const a = r.range(0.22, 0.48) * (0.5 + 0.5 * f.hf);
    gg.addColorStop(0, ink(vD, a)); gg.addColorStop(1, ink(vD, 0));
    g.fillStyle = gg; g.fill(poly);
  }
  g.restore();
  for (const f of folds) {
    const w0 = (1.2 + 3.2 * f.hf * r()) * sc + 0.5;
    stroke(g, f.pts.slice(0, Math.max(3, Math.round(f.pts.length * r.range(0.5, 1.0)))), { width: [w0, w0 * 0.25], profile: 'taper', color: ink(vD * 0.85, r.range(0.45, 0.85)), rng: r, rough: 0.4 });
    if (r() < 0.6) {
      const off = r.range(-4, 4) * sc;
      dryStroke(g, f.pts.slice(0, 5).map((p) => [p[0] + off, p[1]]), { width: (4 + 5 * r()) * sc, bristles: 4, color: ink(vD, 0.35), alpha: 0.35, dry: 0.45, rng: r, noise: nz });
    }
  }
  // short cun strokes over the upper faces (axe-cut texture), denser and darker near the top
  const nC = Math.round(W * H / 1400 * P.cun);
  for (let i = 0; i < nC; i++) {
    const x = x0 + r() * (x1 - x0);
    const hf = hOf(x);
    if (hf < 0.15) continue;
    const dd = Math.pow(r(), 1.6) * H * hf * 0.75;          // depth below the ridge
    const y = sil(x) + 3 + dd;
    const near = 1 - dd / (H * 0.75);
    const L = (6 + 22 * r()) * sc;
    const ang = ((x - P.x) / W) * 0.7 + r.range(-0.25, 0.25);
    const pts = [[x, y], [x + Math.sin(ang) * L * 0.5 + r.range(-1, 1), y + Math.cos(ang) * L * 0.5], [x + Math.sin(ang) * L, y + Math.cos(ang) * L]];
    stroke(g, pts, { width: [(0.8 + 2.2 * r()) * sc + 0.3, 0.4], profile: 'taper', color: ink(vD * (0.8 + 0.2 * r()), (0.18 + 0.5 * near) * r.range(0.6, 1)), rng: r, rough: 0.5 });
  }
  // foliage clumps along the upper ridge and at crease heads
  for (let x = x0; x <= x1; x += 3.5 * sc) {
    const hf = hOf(x);
    if (hf < 0.45) continue;
    const dens = ss(0.45, 0.8, hf) * ss(-0.5, 0.25, nz.n2(x / (W * 0.08), 5.3));
    if (r() > dens) continue;
    const rr = (2.2 + 4.5 * r() * r()) * sc + 0.6;
    blob(g, x + r.range(-2, 2), sil(x) + rr * r.range(0.2, 2.2), rr, { color: ink(vD * 0.7, r.range(0.7, 0.95)), rng: r, irregular: 0.4, squash: 0.75 });
  }
  // canopy clumps: dark scalloped masses capping the summit and shoulders
  for (let x = x0; x <= x1; x += 6 * sc) {
    const hf = hOf(x);
    const dens = P.moss * ss(0.55, 0.9, hf) * ss(-0.2, 0.4, nz.n2(x / (W * 0.12), 2.9));
    if (r() > dens) continue;
    const n = 2 + ((r() * 3) | 0);
    for (let j = 0; j < n; j++) {
      const rr = (4 + 6 * r()) * sc;
      blob(g, x + r.range(-6, 6) * sc, sil(x) + rr * 0.4 + j * rr * 0.9 + r.range(0, 4), rr, { color: ink(vD * 0.6, r.range(0.55, 0.9)), rng: r, irregular: 0.45, squash: 0.7, sides: 10 });
    }
  }
  for (const f of folds) {
    if (r() > 0.55 * P.moss) continue;
    const n = 3 + ((r() * 6) | 0);
    for (let j = 0; j < n; j++) {
      const s = r() * 0.4, q = f.pts[Math.min(f.pts.length - 1, Math.round(s * (f.pts.length - 1)))];
      blob(g, q[0] + r.range(-3, 3) * sc, q[1] + r.range(-2, 6) * sc, (1 + 2.2 * r()) * sc + 0.4, { color: ink(vD * 0.75, r.range(0.6, 0.9)), rng: r, irregular: 0.4, squash: 0.8 });
    }
  }
  g.restore();
  // dark dry-brush contour along the top (broken into separate strokes)
  let seg = [];
  const flush = () => {
    if (seg.length > 3) {
      const cv0 = Math.min(1, vD * 0.95);
      dryStroke(g, seg, { width: (2.6 + 1.6 * r()) * sc + 0.6, bristles: 5, color: ink(cv0, 0.7), alpha: 0.7, dry: 0.35, rng: r, noise: nz });
      if (vD < 0.4) stroke(g, seg, { width: 0.9 * sc + 0.4, profile: 'brush', color: ink(cv0, 0.6), rng: r, rough: 0.5 });
    }
    seg = [];
  };
  for (let j = 0; j < top.length; j++) {
    const [x, y] = top[j];
    if (hOf(x) < 0.12 || r() > 0.15 + ss(0.3, 0.75, hOf(x))) { flush(); continue; }
    seg.push([x, y + 0.8]);
    if (seg.length > 30 + r() * 40) { flush(); seg.push([x, y + 0.8]); }
  }
  flush();
  // small conifers crowning the upper ridge
  if (P.trees > 0) {
    let x = x0 + r() * P.treeH * 0.4;
    let j = 0;
    while (x < x1) {
      const hf = hOf(x);
      const dens = P.trees * ss(0.45, 0.8, hf) * (0.3 + 0.7 * ss(-0.4, 0.3, nz.n2(x / (P.treeH * 4), 8.8)));
      if (r() < dens) {
        const th = P.treeH * (0.55 + 0.75 * r() * r()) * (0.75 + 0.25 * hf);
        paintConifer(g, x, sil(x) + th * 0.16, th, { kind: r() < 0.75 ? 'fir' : 'pine', tone: Math.min(1, vD * 0.8), paper, seed: P.seed * 1000 + j, detail: 0 });
      }
      x += P.treeH * r.range(0.3, 0.75);
      j++;
    }
  }
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
    const m = 1 - ss(f0, f1, Y + n * H * 0.22);
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
  const D = { tone: o.tone ?? 0.5, a: o.a ?? 2.0, b: o.b ?? 1.15, fold: 1, trees: o.trees ?? 0.5, treeH: o.treeH ?? 18, fade: o.fade ?? [0.35, 1.0], rough: o.rough ?? 1, foot: 0.15, moss: o.moss ?? 1, cun: o.cun ?? 1, body: o.body ?? 1, base: o.base ?? 800 };
  const T0 = performance.now();
  const raw = api.bakeCanvas(rect[2], rect[3], (ctx, { k }) => {
    ctx.translate(-rect[0], -rect[1]);
    o.peaks.forEach((pk, i) => {
      const P = { ...D, ...pk, seed: pk.seed ?? i + 1 };
      P.wl = pk.wl ?? pk.w ?? 150; P.wr = pk.wr ?? pk.w ?? 150;
      paintMountain(ctx, api, P, paper, k);
    });
  }, { scale: o.scale ?? 1 });
  console.warn('mountains bake ms', Math.round(performance.now() - T0), o.peaks.length);
  const src = o.ink === false ? raw : inkify(api, raw, { edge: 0.35, granulation: 0.18, bleed: 0.8, ...(o.ink || {}) });
  if (src !== raw) api.engine?.freeTex?.(raw);
  // topAt(x): highest silhouette y over all peaks of the card (for placing trees from outside)
  const sils = o.peaks.map((pk, i) => {
    const P = { ...D, ...pk, seed: pk.seed ?? i + 1 };
    P.wl = pk.wl ?? pk.w ?? 150; P.wr = pk.wr ?? pk.w ?? 150;
    return { f: silhouette(P, api.noise(P.seed * 31 + 7)), x0: P.x - P.wl * 1.3, x1: P.x + P.wr * 1.3 };
  });
  const topAt = (x) => { let y = 1e9; for (const s of sils) if (x >= s.x0 && x <= s.x1) y = Math.min(y, s.f(x)); return y; };
  return { src, rect, topAt, layer: (lo = {}) => api.tex(src, { rect, ...lo }) };
}
