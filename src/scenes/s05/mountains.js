// s05 helper (copied from s01): misty shan shui mountain masses (ref 01 style), painted with Canvas2D brushwork.
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

// knobs: [{ x, top, w }] - a ridge made of several rounded summits (one continuous mass with saddles)
function knobH(P, x) {
  const H = P.base - P.top;
  let h = 0, dom = P.knobs[0];
  for (const k of P.knobs) {
    const u = Math.min(1, Math.abs(x - k.x) / (k.w * (P.knobW ?? 1)));
    const hk = (P.base - k.top) / H * Math.pow(Math.max(1 - Math.pow(u, P.a), 0), P.b);
    if (hk > h) { h = hk; dom = k; }
  }
  return { h, dom };
}

function silhouette(P, nz) {
  const H = P.base - P.top;
  return (x) => {
    const dx = x - P.x, w = P.knobs ? (P.roughW ?? 220) : dx < 0 ? P.wl : P.wr;
    const u = Math.abs(dx) / w;
    const kh = P.knobs ? knobH(P, x) : null;
    let h = kh ? kh.h : Math.pow(Math.max(1 - Math.pow(Math.min(u, 1), P.a), 0), P.b);
    h += P.foot * Math.exp(-u * 2.2) * (1 - h);
    // roughness grows with the height on the local knob (ridge mode), so flanks get crags too
    const hl = kh ? Math.min(1, h * H / Math.max(1, P.base - kh.dom.top)) : h;
    const rd = 1 - Math.abs(nz.n2(x / (w * 0.38), 1.3));
    const rd2 = 1 - Math.abs(nz.n2(x / (w * 0.17), 7.7));
    h += P.rough * ((rd * rd - 0.5) * 0.17 * ss(0.05, 0.5, hl) * (1 - 0.6 * ss(0.85, 1, hl))
      + (rd2 * rd2 - 0.5) * 0.05 * ss(0.05, 0.5, hl)
      + 0.045 * nz.fbm2(x / (w * 0.1), 4.2, 3) * ss(0, 0.2, hl)
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
  // threshold height (0 base .. 1 summit): global for one peak, relative to the local knob on a ridge
  const hT = P.knobs ? (x) => { const d = knobH(P, x).dom; return Math.min(1.1, (P.base - sil(x)) / Math.max(1, P.base - d.top)); } : hOf;
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
  if (P.knobs) {
    g.save(); g.filter = `blur(${(9 * k).toFixed(2)}px)`;
    const bandP = new Path2D(); top.forEach((p, j) => (j ? bandP.lineTo(p[0], p[1] + 10) : bandP.moveTo(p[0], p[1] + 10)));
    g.lineWidth = 34; g.lineJoin = 'round'; g.strokeStyle = ink(vD, (P.band ?? 0.3) * bo); g.stroke(bandP);
    g.restore();
  }
  // ridge mode: each knob gets its own soft summit wash and a shadowed left flank (rounded rock masses)
  if (P.knobs) for (const kb of P.knobs) {
    const kw = kb.w * (P.knobW ?? 1), hk = P.base - kb.top;
    for (const [dx, dy, rad, al, sy] of [[0, 0.12, 0.55, 0.45, 0.55], [-0.32, 0.3, 0.35, 0.4, 0.55], [r.range(0.1, 0.3), 0.35, 0.25, 0.25, 0.55], [r.range(0.3, 0.45), 0.42, 0.3, 0.55 * (P.shadow ?? 0), 1.6]]) {
      if (al <= 0) continue;
      const cx = kb.x + dx * kw, cy = kb.top + dy * hk, R = rad * kw;
      g.save(); g.translate(cx, cy); g.scale(1, sy);
      const rg = g.createRadialGradient(0, 0, 0, 0, 0, R);
      rg.addColorStop(0, ink(vD, al * bo * 0.5)); rg.addColorStop(0.6, ink(vD, al * bo * 0.22)); rg.addColorStop(1, ink(vD, 0));
      g.fillStyle = rg; g.fillRect(-R, -R, 2 * R, 2 * R); g.restore();
    }
  }
  // ridge mode, round 2: mottled wet patches over the rock body (breaks the flat card-like grey)
  const dMax = P.fadeLocal ? P.fadeLocal[1] * 0.85 : H * 0.6;
  if (P.knobs && (P.slope ?? 0) > 0) {
    g.save(); g.filter = `blur(${(6 * k).toFixed(2)}px)`;
    const nM = Math.round((x1 - x0) / 7 * P.slope);
    for (let i = 0; i < nM; i++) {
      const x = x0 + r() * (x1 - x0); if (hT(x) < 0.25) continue;
      const y = sil(x) + 6 + Math.pow(r(), 1.3) * dMax;
      blob(g, x, y, r.range(7, 22), { color: ink(vD, r.range(0.1, 0.32)), rng: r, irregular: 0.6, squash: r.range(1.3, 2.4), rot: 1.57 + r.range(-0.3, 0.3) });
    }
    for (let i = 0; i < nM * 0.4; i++) {            // pale lit planes (paper showing through)
      const x = x0 + r() * (x1 - x0); if (hT(x) < 0.3) continue;
      const y = sil(x) + 14 + Math.pow(r(), 1.2) * dMax * 0.8;
      blob(g, x, y, r.range(8, 20), { color: rgba(paper, r.range(0.25, 0.5)), rng: r, irregular: 0.6, squash: r.range(1.4, 2.6), rot: 1.57 + r.range(-0.3, 0.3) });
    }
    g.restore();
  }
  // creases and shadow faces
  const fs = (P.knobs ? 34 : W * 0.05) * P.fold;
  const nF = Math.max(3, Math.round((x1 - x0) / fs));
  const folds = [];
  for (let i = 0; i < nF; i++) {
    const xs = x0 + (i + 0.5 + r.range(-0.35, 0.35)) * (x1 - x0) / nF;
    const hf = hT(xs);
    if (hf < 0.1) continue;
    const ys = sil(xs) + 1;
    const len = (P.base - sil(xs)) * r.range(0.45, 1.0);
    const dk = P.knobs ? knobH(P, xs).dom : null;
    const ang = (dk ? ((xs - dk.x) / (dk.w * 2)) : ((xs - P.x) / W)) * 0.8 + r.range(-0.08, 0.08);
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
    const a = r.range(0.22, 0.48) * (0.5 + 0.5 * f.hf) * P.crease;
    gg.addColorStop(0, ink(vD, a)); gg.addColorStop(1, ink(vD, 0));
    g.fillStyle = gg; g.fill(poly);
  }
  g.restore();
  for (const f of folds) {
    const w0 = (1.2 + 3.2 * f.hf * r()) * sc + 0.5;
    stroke(g, f.pts.slice(0, Math.max(3, Math.round(f.pts.length * r.range(0.5, 1.0)))), { width: [w0, w0 * 0.25], profile: 'taper', color: ink(vD * 0.85, r.range(0.45, 0.85) * P.crease), rng: r, rough: 0.4 });
    if (r() < 0.6) {
      const off = r.range(-4, 4) * sc;
      dryStroke(g, f.pts.slice(0, 5).map((p) => [p[0] + off, p[1]]), { width: (4 + 5 * r()) * sc, bristles: 4, color: ink(vD, 0.35), alpha: 0.35 * P.crease, dry: 0.45, rng: r, noise: nz });
    }
  }
  // short cun strokes over the upper faces (axe-cut texture), denser and darker near the top
  const nC = Math.round(W * H / 1400 * P.cun);
  for (let i = 0; i < nC; i++) {
    const x = x0 + r() * (x1 - x0);
    const hf = hOf(x);
    if (hT(x) < 0.15) continue;
    const dd = Math.pow(r(), 1.6) * H * hf * 0.75;          // depth below the ridge
    const y = sil(x) + 3 + dd;
    const near = 1 - dd / (H * 0.75);
    const L = (6 + 22 * r()) * sc;
    const ang = ((x - P.x) / W) * 0.7 + r.range(-0.25, 0.25);
    const pts = [[x, y], [x + Math.sin(ang) * L * 0.5 + r.range(-1, 1), y + Math.cos(ang) * L * 0.5], [x + Math.sin(ang) * L, y + Math.cos(ang) * L]];
    stroke(g, pts, { width: [(0.8 + 2.2 * r()) * sc + 0.3, 0.4], profile: 'taper', color: ink(vD * (0.8 + 0.2 * r()), (0.18 + 0.5 * near) * r.range(0.6, 1)), rng: r, rough: 0.5 });
  }
  // ridge mode, round 2: rounded tree clumps (dian dots over a soft underlay) scattered down the slopes
  if (P.knobs && (P.slope ?? 0) > 0) {
    const clump = (x, y, R) => {
      g.save(); g.filter = `blur(${(3 * k).toFixed(2)}px)`;
      blob(g, x, y + R * 0.2, R * 1.25, { color: ink(vD * 0.85, r.range(0.3, 0.48)), rng: r, irregular: 0.5, squash: 0.7 });
      g.filter = `blur(${(0.9 * k).toFixed(2)}px)`;          // soft dian dots (ref: no crisp specks at this distance)
      const n = 4 + ((r() * R * 0.8) | 0);
      for (let j = 0; j < n; j++) {
        const a = r() * 6.283, d = Math.sqrt(r()) * R;
        blob(g, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7 - R * 0.15, r.range(1.8, 4.2), { color: ink(vD * r.range(0.6, 0.9), r.range(0.35, 0.65)), rng: r, irregular: 0.4, squash: 0.75 });
      }
      g.restore();
    };
    const nCl = Math.round((x1 - x0) / 60 * P.slope);
    for (let i = 0; i < nCl; i++) {
      const x = x0 + r() * (x1 - x0); if (hT(x) < 0.3) continue;
      if (nz.n2(x / 70, 4.4) < -0.3) continue;
      const dd = Math.pow(r(), 1.5) * dMax * 0.8;
      clump(x, sil(x) + 5 + dd, r.range(6, 15) * (1 - 0.35 * dd / dMax));
    }
    // clumps follow the spurs down from the ridge (along the creases), overlapping into masses
    for (const f of folds) {
      if (f.hf < 0.3 || r() > 0.75 * P.slope) continue;
      const m = 3 + ((r() * 4) | 0);
      for (let q = 0; q < m; q++) {
        const s = Math.pow(q / m + r() * 0.12, 1.2) * 0.6, p = f.pts[Math.round(s * (f.pts.length - 1))];
        if (p[1] - sil(p[0]) > dMax) continue;
        clump(p[0] + r.range(-7, 5), p[1] + r.range(-3, 3), r.range(8, 17) * (1 - 0.45 * s));
      }
    }
  }
  // foliage clumps along the upper ridge and at crease heads
  for (let x = x0; x <= x1; x += 3.5 * sc) {
    const hf = hT(x);
    if (hf < 0.45) continue;
    const dens = ss(0.45, 0.8, hf) * ss(-0.5, 0.25, nz.n2(x / (W * 0.08), 5.3));
    if (r() > dens) continue;
    const rr = (2.2 + 4.5 * r() * r()) * sc + 0.6;
    blob(g, x + r.range(-2, 2), sil(x) + rr * r.range(0.2, 2.2), rr, { color: ink(vD * 0.7, r.range(0.7, 0.95)), rng: r, irregular: 0.4, squash: 0.75 });
  }
  // canopy clumps: dark scalloped masses capping the summit and shoulders
  for (let x = x0; x <= x1; x += 6 * sc) {
    const hf = hT(x);
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
      const ca = P.contour ?? 1;
      dryStroke(g, seg, { width: (2.6 + 1.6 * r()) * sc + 0.6, bristles: 5, color: ink(cv0, 0.7 * ca), alpha: 0.7 * ca, dry: 0.35, rng: r, noise: nz });
      if (vD < 0.4) stroke(g, seg, { width: 0.9 * sc + 0.4, profile: 'brush', color: ink(cv0, 0.6 * ca), rng: r, rough: 0.5 });
    }
    seg = [];
  };
  for (let j = 0; j < top.length; j++) {
    const [x, y] = top[j];
    if (hT(x) < 0.12 || r() > 0.15 + ss(0.3, 0.75, hT(x))) { flush(); continue; }
    seg.push([x, y + 0.8]);
    if (seg.length > 30 + r() * 40) { flush(); seg.push([x, y + 0.8]); }
  }
  flush();
  // small conifers crowning the upper ridge
  if (P.trees > 0) {
    let x = x0 + r() * P.treeH * 0.4;
    let j = 0;
    while (x < x1) {
      const hf = hT(x);
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
  // fadeLocal [d0, d1]: dissolve between d0 and d1 px below the local ridge line (depth varies along the ridge)
  const colS = P.fadeLocal ? Array.from({ length: mw }, (_, ix) => { const X = bx + (ix + 0.5) * ds; return sil(X); }) : null;
  // ridge flanks far from any knob (low local height) dissolve too, so no long bare flank lines remain
  const colH = P.fadeLocal && P.knobs ? Array.from({ length: mw }, (_, ix) => ss(0.12, 0.5, hT(bx + (ix + 0.5) * ds))) : null;
  const colV = P.fadeLocal ? Array.from({ length: mw }, (_, ix) => 1 + 0.45 * nz.n2((bx + ix * ds) / 160, 3.3)) : null;
  for (let jy = 0; jy < mh; jy++) for (let ix = 0; ix < mw; ix++) {
    const X = bx + (ix + 0.5) * ds, Y = by + (jy + 0.5) * ds;
    const n = nz.fbm2(X / 75, Y / 32, 3);
    const m = colS ? (1 - ss(colS[ix] + P.fadeLocal[0] * colV[ix], colS[ix] + P.fadeLocal[1] * colV[ix], Y + n * P.fadeLocal[1] * 0.35)) * (P.fadeFloor ? 1 - ss(P.fadeFloor[0], P.fadeFloor[1], Y + n * 40) : 1) * (colH ? colH[ix] : 1) : 1 - ss(f0, f1, Y + n * H * 0.22);
    img.data[(jy * mw + ix) * 4 + 3] = Math.round(m * 255);
  }
  mg.putImageData(img, 0, 0);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'destination-in';
  g.imageSmoothingEnabled = true;
  g.drawImage(mc, 0, 0, mw, mh, 0, 0, mw * ds * k, mh * ds * k);
  ctx.drawImage(cv, bx, by, cv.width / k, cv.height / k);
}

// ridge mode: the painted span covers every knob's full width (no vertical walls at the ends)
function knobSpan(P) {
  if (!P.knobs) return;
  const kw = P.knobW ?? 1;
  const a = Math.min(...P.knobs.map((k) => k.x - k.w * kw)), b = Math.max(...P.knobs.map((k) => k.x + k.w * kw));
  P.x = (a + b) / 2; P.wl = P.wr = (b - a) / 2 / 1.3;
}

export function makeMountains(api, o) {
  const rect = o.rect;
  const paper = o.paper || PAPER;
  const D = { tone: o.tone ?? 0.5, a: o.a ?? 2.0, b: o.b ?? 1.15, fold: 1, trees: o.trees ?? 0.5, treeH: o.treeH ?? 18, fade: o.fade ?? [0.35, 1.0], rough: o.rough ?? 1, foot: o.foot ?? 0.15, knobW: o.knobW, roughW: o.roughW, crease: o.crease ?? 1, band: o.band, contour: o.contour, slope: o.slope, shadow: o.shadow, moss: o.moss ?? 1, cun: o.cun ?? 1, body: o.body ?? 1, base: o.base ?? 800 };
  const T0 = performance.now();
  const raw = api.bakeCanvas(rect[2], rect[3], (ctx, { k }) => {
    ctx.translate(-rect[0], -rect[1]);
    o.peaks.forEach((pk, i) => {
      const P = { ...D, ...pk, seed: pk.seed ?? i + 1 };
      P.wl = pk.wl ?? pk.w ?? 150; P.wr = pk.wr ?? pk.w ?? 150;
      knobSpan(P);
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
    knobSpan(P);
    return { f: silhouette(P, api.noise(P.seed * 31 + 7)), x0: P.x - P.wl * 1.3, x1: P.x + P.wr * 1.3 };
  });
  const topAt = (x) => { let y = 1e9; for (const s of sils) if (x >= s.x0 && x <= s.x1) y = Math.min(y, s.f(x)); return y; };
  return { src, rect, topAt, layer: (lo = {}) => api.tex(src, { rect, ...lo }) };
}
