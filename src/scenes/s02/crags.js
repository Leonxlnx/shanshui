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

export function treeDab(g, r, x, y, h, col, colLight, pineShare = 0.1) {
  const kind = r();
  if (kind < 0.55) {
    // conifer: stacked drooping tiers narrowing to a point; the trunk shows only under the lowest tier
    const tiers = 3 + ((r() * 3) | 0);
    const w = h * r.range(0.45, 0.7);
    stroke(g, [[x, y + h * 0.05], [x + r.range(-1, 1), y - h * 0.45]], { width: Math.max(0.7, h * 0.05), color: col, rng: r, profile: 'taper' });
    for (let i = 0; i < tiers; i++) {
      const s = i / (tiers - 1);
      const ty = y - h * (0.24 + 0.66 * s);
      const tw = w * (1 - 0.75 * s) * r.range(0.8, 1.2);
      blob(g, x + r.range(-0.1, 0.1) * w, ty, tw * 0.6, { color: col, rng: r, irregular: 0.55, squash: 0.45, sides: 9 });
      if (r() < 0.5) blob(g, x + r.range(-0.4, 0.4) * tw, ty + r.range(0, 0.1) * h, tw * 0.3, { color: col, rng: r, irregular: 0.5, squash: 0.6, sides: 8 });
    }
    blob(g, x, y - h * 0.92, Math.max(0.7, w * 0.1), { color: col, rng: r, irregular: 0.3, squash: 1.6 });
  } else if (kind < 0.55 + pineShare) {
    // flat-topped pine: a leaning, slightly crooked trunk carrying two or three flat needle pads
    const lean = r.range(-0.22, 0.22);
    stroke(g, [[x, y + h * 0.05], [x + lean * h * 0.4 + r.range(-0.06, 0.06) * h, y - h * 0.45], [x + lean * h, y - h * 0.82]], { width: [Math.max(0.8, h * 0.075), Math.max(0.5, h * 0.03)], profile: 'even', color: col, rng: r });
    const np = 3 + ((r() * 2) | 0);
    for (let i = 0; i < np; i++) {
      const s = i / Math.max(1, np - 1);
      const pw = h * r.range(0.32, 0.5) * (1 - 0.4 * s);
      const px = x + lean * h * (0.4 + 0.5 * s) + (i % 2 ? 1 : -1) * pw * r.range(0.1, 0.4);
      const py = y - h * (0.32 + 0.58 * s);
      blob(g, px, py, pw, { color: col, rng: r, irregular: 0.35, squash: 0.3, sides: 10 });
      blob(g, px + r.range(-0.4, 0.4) * pw, py - pw * 0.12, pw * 0.55, { color: col, rng: r, irregular: 0.4, squash: 0.35, sides: 9 });
    }
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

  // 1. body wash, a little stronger toward the ridge (the lit faces stay pale)
  const body = P.body ?? 1;
  const vb = v + (1 - v) * 0.4;
  const gr = g.createLinearGradient(0, top0, 0, P.base);
  gr.addColorStop(0, ink(vb, Math.min(0.8, 0.46 * body))); gr.addColorStop(0.4, ink(vb, Math.min(0.7, 0.34 * body))); gr.addColorStop(0.8, ink(vb, 0.12 * body)); gr.addColorStop(1, ink(vb, 0));
  g.fillStyle = gr; g.fill(path);

  // nearest lobe and the side of it a point is on: -1 left edge .. +1 right edge; shade 1 = shadow flank
  const lobeAt = (x) => { let L = P.lobes[0], best = 1e9; for (const lb of P.lobes) { const d = Math.abs(x - lb.x) / (x < lb.x ? lb.wl : lb.wr); if (d < best) { best = d; L = lb; } } return L; };
  const sideAt = (x, L) => (x - L.x) / ((x < L.x ? L.wl : L.wr) || 1);
  const shadeAt = (x) => { const s = sideAt(x, lobeAt(x)); return light > 0 ? ss(0.35, -0.55, s) : ss(-0.35, 0.55, s); };

  // 2. shadow flanks of each lobe (soft wash with a ragged inner edge)
  pass(5 * sc, (c) => {
    for (const L of P.lobes) {
      const hw = light > 0 ? L.wl : L.wr;
      const hl = P.base - L.top;
      const sx = L.x - light * hw * r.range(0.1, 0.3);
      const poly = new Path2D();
      poly.moveTo(L.x + light * 4, L.top - 10);
      const ph = r() * 50;
      for (let s2 = 0.08; s2 <= 1.001; s2 += 0.08) {
        const xe = L.x + light * 4 + (sx - L.x - light * 4) * Math.min(1, s2 * 2.2) - light * hw * 0.2 * Math.max(0, s2 - 0.45) + nz.n2(ph + s2 * 4, 1.3) * hw * 0.14;
        poly.lineTo(xe, L.top - 10 + (hl + 10) * s2);
      }
      poly.lineTo(L.x - light * hw * 1.2, P.base);
      poly.lineTo(L.x - light * hw * 1.2, L.top - 10);
      poly.closePath();
      const gg = c.createLinearGradient(0, L.top, 0, P.base);
      const a = (P.shadow ?? 0.35) * r.range(0.9, 1.25);
      gg.addColorStop(0, ink(v + (1 - v) * 0.2, a)); gg.addColorStop(0.6, ink(v + (1 - v) * 0.28, a * 0.6)); gg.addColorStop(1, ink(v, 0));
      c.fillStyle = gg; c.fill(poly);
    }
  });
  // 3. wet-on-wet mottling: rounded blots of varying strength (no vertical curtains)
  pass(2.2 * sc, (c) => {
    const nM = Math.round(W * H / 1300 * (P.mottle ?? 1));
    for (let i = 0; i < nM; i++) {
      const x = x0 + r() * W, hf = hOf(x);
      if (hf < 0.05) continue;
      const y = sil(x) + Math.pow(r(), 1.3) * H * hf * 0.9;
      const R = (6 + 20 * r()) * sc;
      const dark = r() < 0.72;
      const sh = shadeAt(x);
      blob(c, x, y, R, { color: dark ? ink(v + (1 - v) * 0.25 * r(), r.range(0.06, 0.22) * (0.6 + 0.6 * sh)) : rgba(paper, r.range(0.1, 0.25)), rng: r, irregular: 0.65, squash: r.range(0.6, 1.1), rot: r() * 3 });
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
        c.fillStyle = rgba(paper, r.range(0.22, 0.42) * (P.planes ?? 1));
        c.fill(poly);
        creases.push(pts.map((p) => [p[0] - light * hwAt(p), p[1]]));
      }
    }
  });
  // 4. creases, then hemp-fibre cun: bundles of thin, slightly sagging strokes running down and
  //    splaying outward over the faces, dense and dark on the shadow flanks, sparse on the lit faces
  pass(0.35, (c) => {
    for (const e of creases) stroke(c, e.slice(0, 8), { width: [(1.3 + 2.2 * r()) * sc + 0.3, 0.4], profile: 'taper', color: ink(v + (1 - v) * 0.08, r.range(0.5, 0.85) * (P.planes ?? 1)), rng: r, rough: 0.5 });
    const nB = Math.round(W * H / 480 * (P.streaks ?? 1));
    for (let i = 0; i < nB; i++) {
      const x = x0 + r() * W, hf = hOf(x);
      if (hf < 0.1) continue;
      const L = lobeAt(x), side = sideAt(x, L), shade = shadeAt(x);
      if (r() > 0.3 + 0.7 * shade) continue;
      const dd = Math.pow(r(), 1.5) * H * hf * 0.62;
      const y = sil(x) + 3 + dd;
      const len = (14 + 44 * r()) * sc * (0.6 + 0.6 * hf);
      const ang = Math.max(-0.65, Math.min(0.65, side * 0.55)) + r.range(-0.1, 0.1);
      const bend = r.range(-0.3, 0.3);
      const nS = 2 + ((r() * 4) | 0), sp = (2.4 + 3 * r()) * sc;
      const near = 1 - dd / (H * 0.7 + 1);
      const a0 = (0.22 + 0.5 * shade) * (0.35 + 0.65 * near);
      if (r() < 0.22) {
        // a dry, rubbed stroke: broken bristle texture over the shadow wash
        const pts = [];
        for (let s2 = 0; s2 <= 1.001; s2 += 0.2) { const a = ang + bend * s2; pts.push([x + Math.sin(a) * len * s2, y + Math.cos(a) * len * s2]); }
        dryStroke(c, pts, { width: (5 + 7 * r()) * sc, bristles: 6, color: ink(v + (1 - v) * 0.15, 1), alpha: a0 * 0.8, dry: 0.55, rng: r, noise: nz, profile: 'taper' });
        continue;
      }
      for (let j = 0; j < nS; j++) {
        const o = (j - (nS - 1) / 2) * sp;
        const ox = o * Math.cos(ang), oy = -o * Math.sin(ang) + r.range(-3, 3) * sc;
        const l2 = len * r.range(0.55, 1.05);
        const pts = [];
        for (let s2 = 0; s2 <= 1.001; s2 += 0.25) { const a = ang + bend * s2; pts.push([x + ox + Math.sin(a) * l2 * s2, y + oy + Math.cos(a) * l2 * s2]); }
        stroke(c, pts, { width: [(0.6 + 1.0 * r()) * sc + 0.35, 0.25], profile: 'taper', color: ink(v + (1 - v) * 0.12 * r(), a0 * r.range(0.6, 1.15)), rng: r, rough: 0.7 });
      }
    }
  });
  // 5. soft darker band just under the ridge line
  pass(5 * sc, (c) => {
    c.lineJoin = 'round';
    c.strokeStyle = ink(v + (1 - v) * 0.2, 0.16 * (P.edge ?? 1));
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
        const th = Math.min(treeH * r.range(0.45, 0.95), H * 0.5);
        treeDab(c, r, x + r.range(-2, 2), sil(x) + th * 0.5 + Math.pow(r(), 1.5) * cd, th, tint(treeV), tintL(treeV), P.pines);
      }
    }
    // tree drifts down the faces: denser on the shadow flanks and in the creases
    const nF = Math.round(W * H / 800 * (P.clumps ?? 1));
    for (let i = 0; i < nF; i++) {
      const x = x0 + r() * W, hf = hOf(x);
      if (hf < 0.15) continue;
      const dd = Math.pow(r(), 2.0) * H * hf * 0.75;
      const y = sil(x) + 4 + dd;
      const pres = ss(-0.3, 0.4, nz.n2(x / 60, y / 60 + 5.1)) * (0.45 + 0.55 * shadeAt(x));
      if (r() > pres) continue;
      const n = 2 + ((r() * 5) | 0);
      const th = Math.min(treeH * r.range(0.45, 0.85) * (1 - 0.4 * dd / H), H * 0.42);
      for (let j = 0; j < n; j++) treeDab(c, r, x + r.range(-1, 1) * th * 0.9, y + r.range(-0.3, 0.6) * th, th * r.range(0.7, 1.1), tint(treeV), tintL(treeV), P.pines);
    }
  });
  g.restore(); // clip

  // 7. broken contour along the ridge: a crisp dark line on the shadow flanks and crests, dry and
  //    gappy on the lit flanks
  let seg = [], segShade = 0;
  const flush = () => {
    if (seg.length > 3) {
      const sh = segShade / seg.length;
      dryStroke(g, seg, { width: (1.8 + 1.4 * r()) * sc + 0.6 + sh * 1.2 * sc, bristles: 4, color: ink(v * 0.8, 0.85), alpha: (0.55 + 0.3 * sh) * (P.contour ?? 1), dry: 0.42 - 0.22 * sh, rng: r, noise: nz });
      if (sh > 0.4) stroke(g, seg, { width: [(0.9 + 0.8 * r()) * sc + 0.4, 0.5], profile: 'brush', color: ink(v * 0.7, 0.55 * sh * (P.contour ?? 1)), rng: r, rough: 0.5 });
    }
    seg = []; segShade = 0;
  };
  let arcC = 0;
  for (let j = 0; j < top.length; j++) {
    const [x, y] = top[j];
    if (j) arcC += Math.hypot(x - top[j - 1][0], y - top[j - 1][1]);
    const hf = hOf(x);
    const slope = (sil(x + 12) - sil(x - 12)) / 24;          // < 0 rising to the right: a left flank
    const sh = light > 0 ? ss(0.05, -0.4, slope) : ss(-0.05, 0.4, slope);
    const on = nz.n2(arcC / 40, 17.7) + 0.5 * sh + 0.35 * ss(0.3, 0.8, hf) - 0.25;
    if (hf < 0.08 || on < 0) { flush(); continue; }
    seg.push([x, y + 1]); segShade += sh;
    if (seg.length > 24 + r() * 30) { flush(); seg.push([x, y + 1]); }
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
          treeDab(c, r, x, sil(x) + th * 0.22, th, tint(treeV), tintL(treeV), P.pines);
        }
        x += treeH * r.range(0.16, 0.42);
      }
    }
    if (P.dots !== false) {
      for (let i = 0; i < W / 25; i++) {
        const x = x0 + r() * W; if (hOf(x) < 0.3) continue;
        dots(c, x, sil(x) + r.range(4, 30) * sc, 10 * sc, 5, { size: [0.8 * sc, 2.2 * sc], color: ink(treeV, 1), alpha: [0.5, 0.9], rng: r, squash: 0.6 });
      }
      // moss dots and shrubs scattered down the faces, mostly on the shadow flanks
      const nD = Math.round(W * H / 2200 * (P.faceDots ?? 1));
      for (let i = 0; i < nD; i++) {
        const x = x0 + r() * W, hf = hOf(x); if (hf < 0.2) continue;
        if (r() > 0.25 + 0.75 * shadeAt(x)) continue;
        const dd = Math.pow(r(), 1.6) * H * hf * 0.65;
        const near = 1 - dd / (H * 0.7 + 1);
        dots(c, x, sil(x) + 6 + dd, (6 + 8 * r()) * sc, 3 + ((r() * 6) | 0), { size: [0.7 * sc, 2.4 * sc], color: ink(treeV + (1 - treeV) * 0.1, 1), alpha: [0.35 * near, 0.85 * near], rng: r, squash: 0.6 });
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
  const bands = P.bands || [];                             // [[fraction from the top, half width, strength]]: mist crossing the mass
  for (let ix = 0; ix < mw; ix++) {
    const X = bx + (ix + 0.5) * ds;
    const tY = sil(X), hh = P.base - tY;
    const f0 = tY + hh * fade[0], f1 = tY + hh * fade[1];
    for (let jy = 0; jy < mh; jy++) {
      const Y = by + (jy + 0.5) * ds;
      // mist lies in horizontal banks: the noise varies slowly across and faster down
      const n = nz.fbm2(X / 190, Y / 40, 3) * 0.8 + nz.n2(X / 45, Y / 18) * 0.25;
      const Yn = Y + n * Math.max(20, hh) * 0.22;
      let m = 1 - ss(f0, Math.max(f0 + 4, f1), Yn);
      for (const [fb, hw, st] of bands) {
        const d = Math.abs(Yn - (P.base - H * (1 - fb))) / (H * hw);
        m *= 1 - st * (1 - ss(0.2, 1, d));
      }
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
