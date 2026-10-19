// s02 helper: soft, wet, forested crag masses in the manner of ref 02.
// Each mass is a union of lobes (rounded / pointed humps). It is filled with paper first (so a
// nearer mass occludes a farther one, like mist separating depth planes), then painted with
// mottled wet-on-wet washes, a shadow side, lit granite planes with creases, vertical cun streaks,
// a soft darker band under the ridge, a broken dry contour, and a coat of blotchy conifers and
// canopy clumps crowning the ridges and stepping down the faces. The base dissolves into mist.
// Every blurred pass is drawn unfiltered into a scratch canvas and composited once (fast).
//
// paintCrag(ctx, api, P, paper, k)
//   P = { lobes: [{ x, top, wl, wr, a, b }], base, v (darkest value 0 ink .. 1 paper), treeV, body,
//         mottle, shadow, planes, streaks, edge, crown, crownDepth, clumps, trees, treeH, dots,
//         fade: [f0, f1] (fractions of the local height), rough, jag, soft, seed, light }
// makeCrags(api, { rect, masses: [P...] (back to front), defaults, paper, scale, ink }) -> { src, rect, topAt, layer }
import { stroke, dryStroke, blob, dots, rgba, tone as toneRGB, PAPER } from '../../lib/brush.js';
import { inkify } from '../../lib/inkfx.js';

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp01 = (v) => Math.min(1, Math.max(0, v));

export function cragSilhouette(P, nz) {
  const lobes = P.lobes;
  const base = P.base;
  const rough = P.rough ?? 1;
  const Htot = base - Math.min(...lobes.map((l) => l.top));
  return (x) => {
    let y = base;
    for (const L of lobes) {
      const w = x < L.x ? L.wl : L.wr;
      const u = Math.abs(x - L.x) / w;
      if (u >= 1) continue;
      const prof = Math.pow(1 - Math.pow(u, L.a ?? 2), L.b ?? 1);
      y = Math.min(y, base - (base - L.top) * prof);
    }
    const H = base - y;
    if (H <= 0) return base;
    // rounded bumps (crowns of trees / boulders) riding on the ridge + steps + broad undulation
    const bump = Math.abs(nz.n2(x / 12, 3.1)) * 4 + Math.abs(nz.n2(x / 28, 7.7)) * 7;
    const step = nz.ridge2(x / 70, 2.3, 3) * 14;
    const n = nz.fbm2(x / 110, 1.7, 3) * 18;
    return y - rough * ss(0, 60, H) * (bump + n + step) * ss(0, 0.35, H / Htot);
  };
}

export function treeDab(g, r, x, y, h, col, colLight) {
  if (r() < 0.62) {
    // conifer: stacked drooping tiers narrowing to a point
    const tiers = 3 + ((r() * 3) | 0);
    const w = h * r.range(0.5, 0.75);
    stroke(g, [[x, y + h * 0.05], [x + r.range(-1, 1), y - h * 0.9]], { width: Math.max(0.8, h * 0.05), color: col, rng: r, profile: 'taper' });
    for (let i = 0; i < tiers; i++) {
      const s = i / (tiers - 1);
      const ty = y - h * (0.18 + 0.7 * s);
      const tw = w * (1 - 0.72 * s) * r.range(0.8, 1.2);
      blob(g, x + r.range(-0.12, 0.12) * w, ty, tw * 0.6, { color: col, rng: r, irregular: 0.55, squash: 0.5, sides: 9 });
      if (r() < 0.5) blob(g, x + r.range(-0.4, 0.4) * tw, ty + r.range(0, 0.1) * h, tw * 0.3, { color: col, rng: r, irregular: 0.5, squash: 0.6, sides: 8 });
    }
    blob(g, x, y - h * 0.93, Math.max(0.8, w * 0.12), { color: col, rng: r, irregular: 0.3, squash: 1.4 });
  } else {
    // broadleaf / pine canopy clump: overlapping round blots, darker core
    const R = h * r.range(0.36, 0.52);
    const n = 3 + ((r() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const a = r.range(-Math.PI, 0), d = r() * R * 0.8;
      blob(g, x + Math.cos(a) * d * 1.3, y - R * 0.9 + Math.sin(a) * d * 0.7, R * r.range(0.5, 0.8), { color: i === 0 ? col : (r() < 0.5 ? colLight : col), rng: r, irregular: 0.45, squash: 0.78, sides: 10 });
    }
  }
}

export function paintCrag(ctx, api, P, paper, k) {
  const r = api.rng(P.seed * 7919 + 13);
  const nz = api.noise(P.seed * 31 + 7);
  const sil = cragSilhouette(P, nz);
  const top0 = Math.min(...P.lobes.map((L) => L.top));
  const H = P.base - top0;
  const x0 = Math.min(...P.lobes.map((L) => L.x - L.wl)) - 4, x1 = Math.max(...P.lobes.map((L) => L.x + L.wr)) + 4;
  const W = x1 - x0;
  const treeH = P.treeH ?? 18;
  const sc = Math.min(1.5, Math.max(0.35, (P.scale ?? H / 300)));
  const v = P.v ?? 0.3;                                    // darkest value of the mass
  const treeV = P.treeV ?? v;
  const ink = (vv, a) => rgba(toneRGB(clamp01(vv), paper), a);
  const hOf = (x) => (P.base - sil(x)) / H;
  const bx = Math.floor(x0 - treeH), by = Math.floor(top0 - treeH * 1.6 - 16), bw = Math.ceil(W + treeH * 2), bh = Math.ceil(P.base - by + 4);
  const PW = Math.max(1, Math.ceil(bw * k)), PH = Math.max(1, Math.ceil(bh * k));
  const cv = new OffscreenCanvas(PW, PH);
  const g = cv.getContext('2d');
  g.setTransform(k, 0, 0, k, -bx * k, -by * k);
  const scratch = new OffscreenCanvas(PW, PH);
  const h = scratch.getContext('2d');
  // draw fn(h) unfiltered into the scratch canvas, then composite it once onto g with a blur
  const pass = (blurPx, fn) => {
    h.setTransform(1, 0, 0, 1, 0, 0); h.clearRect(0, 0, PW, PH);
    h.setTransform(k, 0, 0, k, -bx * k, -by * k);
    fn(h);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    if (blurPx > 0) g.filter = `blur(${(blurPx * k).toFixed(2)}px)`;
    g.drawImage(scratch, 0, 0);
    g.restore();
  };
  const light = P.light === 'left' ? -1 : 1;              // sun from the right: shadow on the left flanks
  const tint = (vv) => ink(vv + r.range(0, 0.12) * (1 - vv), r.range(0.75, 0.95));
  const tintL = (vv) => ink(vv + (1 - vv) * 0.25, 0.85);

  const top0pts = [];
  for (let x = x0; x <= x1; x += 2) top0pts.push([x, sil(x)]);
  // jag the contour along its normal (horizontal bumps on steep flanks, ledges, boulders)
  const top = [];
  let arc = 0;
  for (let i = 0; i < top0pts.length; i++) {
    const p = top0pts[i], q = top0pts[Math.min(top0pts.length - 1, i + 1)], o = top0pts[Math.max(0, i - 1)];
    let tx = q[0] - o[0], ty = q[1] - o[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    if (i) arc += Math.hypot(p[0] - top0pts[i - 1][0], p[1] - top0pts[i - 1][1]);
    const hf = (P.base - p[1]) / H;
    const d = (P.jag ?? 1) * ss(0.02, 0.25, hf) * (nz.n2(arc / 16, 4.4) * 2.2 + nz.n2(arc / 50, 9.1) * 4.5 + Math.abs(nz.n2(arc / 8, 2.2)) * 1.5) * Math.max(0.6, sc);
    top.push([p[0] + ty * d, p[1] - tx * d]);
  }
  const path = new Path2D();
  path.moveTo(x0, P.base + 2);
  for (const p of top) path.lineTo(p[0], p[1]);
  path.lineTo(x1, P.base + 2); path.closePath();
  g.fillStyle = rgba(paper, 1);
  g.fill(path);
  g.save();
  g.clip(path);

  // 1. body wash, stronger toward the ridge
  const body = P.body ?? 1;
  const vb = v + (1 - v) * 0.4;
  const gr = g.createLinearGradient(0, top0, 0, P.base);
  gr.addColorStop(0, ink(vb, Math.min(0.9, 0.62 * body))); gr.addColorStop(0.4, ink(vb, Math.min(0.8, 0.42 * body))); gr.addColorStop(0.8, ink(vb, 0.15 * body)); gr.addColorStop(1, ink(vb, 0));
  g.fillStyle = gr; g.fill(path);

  // 2. shadow flanks of each lobe (soft wash)
  pass(7 * sc, (c) => {
    for (const L of P.lobes) {
      const hw = light > 0 ? L.wl : L.wr;
      const sx = L.x - light * hw * r.range(0.15, 0.4);
      const poly = new Path2D();
      poly.moveTo(L.x + light * 4, L.top - 10);
      poly.lineTo(sx, L.top + (P.base - L.top) * 0.4);
      poly.lineTo(sx - light * hw * 0.2, P.base);
      poly.lineTo(L.x - light * hw * 1.2, P.base);
      poly.lineTo(L.x - light * hw * 1.2, L.top - 10);
      poly.closePath();
      const gg = c.createLinearGradient(0, L.top, 0, P.base);
      const a = (P.shadow ?? 0.35) * r.range(0.8, 1.2);
      gg.addColorStop(0, ink(v + (1 - v) * 0.25, a)); gg.addColorStop(0.6, ink(v + (1 - v) * 0.3, a * 0.5)); gg.addColorStop(1, ink(v, 0));
      c.fillStyle = gg; c.fill(poly);
    }
  });
  // 3. wet-on-wet mottling: blots of varying strength
  pass(2.2 * sc, (c) => {
    const nM = Math.round(W * H / 1300 * (P.mottle ?? 1));
    for (let i = 0; i < nM; i++) {
      const x = x0 + r() * W, hf = hOf(x);
      if (hf < 0.05) continue;
      const y = sil(x) + Math.pow(r(), 1.3) * H * hf * 0.9;
      const R = (6 + 24 * r()) * sc;
      const dark = r() < 0.62;
      blob(c, x, y, R, { color: dark ? ink(v + (1 - v) * 0.25 * r(), r.range(0.08, 0.28)) : rgba(paper, r.range(0.15, 0.4)), rng: r, irregular: 0.65, squash: r.range(1.0, 2.0), rot: 1.57 });
    }
  });
  // 3b. lit granite planes; their shadow-side edges become creases
  const creases = [];
  pass(3 * sc, (c) => {
    for (const L of P.lobes) {
      const hl = P.base - L.top;
      const nP = 1 + ((r() * 2.5) | 0);
      for (let j = 0; j < nP; j++) {
        const cx = L.x + light * r.range(-0.15, 0.5) * (light > 0 ? L.wr : L.wl);
        const yt = sil(cx) + hl * r.range(0.08, 0.2);
        const len = hl * r.range(0.35, 0.65), wd = (light > 0 ? L.wr : L.wl) * r.range(0.25, 0.45);
        const pts = [];
        for (let s2 = 0; s2 <= 1.001; s2 += 0.1) pts.push([cx + nz.n2(j * 5.1 + L.x, s2 * 2) * wd * 0.25 + light * wd * 0.3 * s2, yt + len * s2]);
        const hwAt = (p) => wd * 0.5 * Math.sin(Math.PI * Math.min(1, (p[1] - yt) / len * 1.2 + 0.1));
        const poly = new Path2D();
        poly.moveTo(pts[0][0], pts[0][1]);
        for (const p of pts) poly.lineTo(p[0] - hwAt(p), p[1]);
        for (let q = pts.length - 1; q >= 0; q--) poly.lineTo(pts[q][0] + hwAt(pts[q]), pts[q][1]);
        poly.closePath();
        c.fillStyle = rgba(paper, r.range(0.3, 0.55) * (P.planes ?? 1));
        c.fill(poly);
        creases.push(pts.map((p) => [p[0] - light * hwAt(p), p[1]]));
      }
    }
  });
  // 4. creases and vertical cun streaks following the flanks
  pass(0.7, (c) => {
    for (const e of creases) stroke(c, e.slice(0, 8), { width: [(1.5 + 2.5 * r()) * sc, 0.4], profile: 'taper', color: ink(v + (1 - v) * 0.1, r.range(0.45, 0.8) * (P.planes ?? 1)), rng: r, rough: 0.5 });
    const nS = Math.round(W * H / 1800 * (P.streaks ?? 1));
    for (let i = 0; i < nS; i++) {
      const x = x0 + r() * W, hf = hOf(x);
      if (hf < 0.12) continue;
      let L = null, best = 1e9;
      for (const lb of P.lobes) { const d = Math.abs(x - lb.x) / (x < lb.x ? lb.wl : lb.wr); if (d < best) { best = d; L = lb; } }
      const dd = Math.pow(r(), 1.8) * H * hf * 0.45;
      const y = sil(x) + 2 + dd;
      const len = (10 + 36 * r()) * sc * (0.5 + hf);
      const ang = Math.max(-0.5, Math.min(0.5, ((x - L.x) / ((x < L.x ? L.wl : L.wr) || 1)) * 0.35)) + r.range(-0.08, 0.08);
      const pts = [];
      for (let s2 = 0; s2 <= 1.001; s2 += 0.25) pts.push([x + Math.sin(ang) * len * s2 + nz.n2(i * 1.7, s2 * 2) * 3 * sc, y + Math.cos(ang) * len * s2]);
      const near = 1 - dd / (H * 0.6 + 1);
      stroke(c, pts, { width: [(0.8 + 2.4 * r()) * sc + 0.4, 0.3], profile: 'taper', color: ink(v + (1 - v) * 0.15 * r(), (0.15 + 0.45 * near) * r.range(0.6, 1)), rng: r, rough: 0.5 });
    }
  });
  // 5. soft darker band just under the ridge line
  pass(5 * sc, (c) => {
    c.lineJoin = 'round';
    c.strokeStyle = ink(v + (1 - v) * 0.2, 0.32 * (P.edge ?? 1));
    c.lineWidth = 12 * sc;
    c.beginPath(); top.forEach((p, i) => (i ? c.lineTo(p[0], p[1] + 3 * sc) : c.moveTo(p[0], p[1] + 3 * sc))); c.stroke();
  });
  // 6. foliage: dense crown along the crest + clumps on the faces (crease heads, ledges)
  pass(0.5, (c) => {
    if ((P.crown ?? 0.6) > 0) {
      const cd = (P.crownDepth ?? 0.12) * H;
      for (let x = x0; x <= x1; x += 2) {
        const hf = hOf(x);
        if (hf < 0.3) continue;
        const pres = (P.crown ?? 0.6) * ss(0.3, 0.75, hf) * (0.4 + 0.6 * ss(-0.6, 0.2, nz.n2(x / 50, 12.3)));
        if (r() > pres) continue;
        const th = treeH * r.range(0.45, 0.95);
        treeDab(c, r, x + r.range(-2, 2), sil(x) + th * 0.5 + Math.pow(r(), 1.5) * cd, th, tint(treeV), tintL(treeV));
      }
    }
    const nF = Math.round(W * H / 900 * (P.clumps ?? 1));
    for (let i = 0; i < nF; i++) {
      const x = x0 + r() * W, hf = hOf(x);
      if (hf < 0.15) continue;
      const dd = Math.pow(r(), 2.2) * H * hf * 0.75;
      const y = sil(x) + 4 + dd;
      const pres = ss(-0.3, 0.4, nz.n2(x / 60, y / 60 + 5.1));
      if (r() > pres) continue;
      const n = 2 + ((r() * 4) | 0);
      const th = treeH * r.range(0.45, 0.85) * (1 - 0.4 * dd / H);
      for (let j = 0; j < n; j++) treeDab(c, r, x + r.range(-1, 1) * th * 0.9, y + r.range(-0.3, 0.6) * th, th * r.range(0.7, 1.1), tint(treeV), tintL(treeV));
    }
  });
  g.restore(); // clip

  // 7. broken dry contour along the ridge
  let seg = [];
  const flush = () => {
    if (seg.length > 3) dryStroke(g, seg, { width: (2.2 + 1.6 * r()) * sc + 0.5, bristles: 5, color: ink(v + (1 - v) * 0.08, 0.7), alpha: 0.6, dry: 0.4, rng: r, noise: nz });
    seg = [];
  };
  for (let j = 0; j < top.length; j++) {
    const [x, y] = top[j];
    if (hOf(x) < 0.1 || r() > 0.1 + ss(0.25, 0.7, hOf(x))) { flush(); continue; }
    seg.push([x, y + 1]);
    if (seg.length > 20 + r() * 30) { flush(); seg.push([x, y + 1]); }
  }
  flush();

  // 8. trees crowning the ridge (stick out above the silhouette) and moss dots
  pass(0.45, (c) => {
    if ((P.trees ?? 1) > 0) {
      let x = x0 + r() * treeH * 0.4;
      while (x < x1) {
        const hf = hOf(x);
        const dens = (P.trees ?? 1) * ss(0.2, 0.6, hf) * (0.35 + 0.65 * ss(-0.5, 0.2, nz.n2(x / (treeH * 3.5), 8.8)));
        if (r() < dens) {
          const th = treeH * (0.55 + 0.7 * r() * r()) * (0.7 + 0.3 * hf);
          treeDab(c, r, x, sil(x) + th * 0.22, th, tint(treeV), tintL(treeV));
        }
        x += treeH * r.range(0.16, 0.42);
      }
    }
    if (P.dots !== false) {
      for (let i = 0; i < W / 25; i++) {
        const x = x0 + r() * W; if (hOf(x) < 0.3) continue;
        dots(c, x, sil(x) + r.range(4, 30) * sc, 10 * sc, 5, { size: [0.8 * sc, 2.2 * sc], color: ink(treeV, 1), alpha: [0.5, 0.9], rng: r, squash: 0.6 });
      }
    }
  });

  // 9. mist dissolve toward the base (noisy low-res mask)
  const ds = 4;
  const mw = Math.ceil(bw / ds), mh = Math.ceil(bh / ds);
  const mc = new OffscreenCanvas(mw, mh);
  const mg = mc.getContext('2d');
  const img = mg.createImageData(mw, mh);
  const fade = P.fade || [0.45, 1];
  for (let ix = 0; ix < mw; ix++) {
    const X = bx + (ix + 0.5) * ds;
    const tY = sil(X), hh = P.base - tY;
    const f0 = tY + hh * fade[0], f1 = tY + hh * fade[1];
    for (let jy = 0; jy < mh; jy++) {
      const Y = by + (jy + 0.5) * ds;
      const n = nz.fbm2(X / 70, Y / 30, 3);
      const m = 1 - ss(f0, Math.max(f0 + 4, f1), Y + n * Math.max(20, hh) * 0.25);
      img.data[(jy * mw + ix) * 4 + 3] = Math.round(m * 255);
    }
  }
  mg.putImageData(img, 0, 0);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'destination-in';
  g.imageSmoothingEnabled = true;
  g.drawImage(mc, 0, 0, mw, mh, 0, 0, mw * ds * k, mh * ds * k);
  ctx.save();
  if (P.soft) ctx.filter = `blur(${(P.soft * k).toFixed(2)}px)`;
  ctx.drawImage(cv, bx, by, cv.width / k, cv.height / k);
  ctx.restore();
  return { sil, x0, x1 };
}

export function makeCrags(api, o) {
  const rect = o.rect;
  const paper = o.paper || PAPER;
  const sils = [];
  const T0 = performance.now();
  const raw = api.bakeCanvas(rect[2], rect[3], (ctx, { k }) => {
    ctx.translate(-rect[0], -rect[1]);
    o.masses.forEach((m, i) => {
      const P = { ...(o.defaults || {}), ...m, seed: m.seed ?? i + 1 };
      sils.push(paintCrag(ctx, api, P, paper, k));
    });
    if (o.after) o.after(ctx);
  }, { scale: o.scale ?? 1 });
  if (globalThis.__s02Timing) console.warn('crags bake ms', Math.round(performance.now() - T0), o.masses.length);
  const src = o.ink === false ? raw : inkify(api, raw, { edge: 0.35, granulation: 0.22, bleed: 1.0, ...(o.ink || {}) });
  if (src !== raw) api.engine?.freeTex?.(raw);
  const topAt = (x) => { let y = 1e9; for (const s of sils) if (x >= s.x0 && x <= s.x1) y = Math.min(y, s.sil(x)); return y; };
  return { src, rect, topAt, layer: (lo = {}) => api.tex(src, { rect, ...lo }) };
}
