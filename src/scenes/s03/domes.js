// s03 helper: the rounded granite domes and spires of ref 03 (Huangshan style), Canvas2D + wet ink.
// A dome is a parametric bell h(u) = (1 - |u|^a)^b (u = dx / half width; a ~2 b ~0.45 = round-topped
// bullet, a ~1.2 = pointed spire), or (t set) a flaring trapezoid with a rounded cap. A dome can carry
// nested SLABS (smaller bells in front of it): the silhouette is the upper envelope of the dome and its
// slabs (shoulders, notches), and inside the body every slab is modelled on its own (lit face, shadow
// edge, darker crown) and outlined by a dark crease and a crisp contour line - the nested convex forms of
// Huangshan granite. Painted as: a paper fill (occludes farther domes), a per-pixel modelled ink wash,
// creases, meridian cun lines following each slab's curvature, clustered raindrop dots and dashes, a
// dark ragged crown band and crisp side contours, tufted tree clumps and small conifers on the crests,
// then a noisy mist dissolve toward the base.
//
// makeDomes(api, { rect, domes: [{ cx, top, wl, wr, base, a, b, t, capH, p, tone, fade: [y0, y1],
//                  shadow (-1 left), body, cun, dots, crown, trees, treeH, rough, seed,
//                  slabs: [{ dx, top, wl, wr | w, a, b, t, capH, p, shadow }] }], paper, wet }) -> { src, rect, layer(o) }
import { stroke, blob, rgba, tone as toneRGB, PAPER } from '../../lib/brush.js';
import { paintConifer } from '../../lib/pine.js';
import { wetInk } from '../../lib/peaks.js';

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// one convex form (the dome itself or a slab), all in design px
function makeShape(S, i, base, rough, nz) {
  const cx = S.cx, top = S.top, wl = S.wl ?? S.w ?? 100, wr = S.wr ?? S.w ?? 100;
  const a = S.a ?? 2.2, b = S.b ?? 0.45, H = base - top;
  const tp = S.t, pp = S.p ?? 1, hc = tp != null ? 1 - (S.capH ?? 40) / H : 1;
  const jit = (hn) => 1 + 0.035 * rough * nz.n2(hn * H / 22, 4.4 + i * 2.1) + 0.015 * rough * nz.n2(hn * H / 6, 8.8 + i);
  const halfT = (hn) => (tp + (1 - tp) * Math.pow(1 - hn, pp)) * (hn > hc ? Math.sqrt(Math.max(0, 1 - ((hn - hc) / (1 - hc)) ** 2)) : 1) * jit(hn);
  const hOfU = (u) => {
    const au = Math.abs(u);
    if (au >= 1) return 0;
    if (tp == null) return Math.pow(1 - Math.pow(au, a), b);
    let lo = 0, hi = 1;
    for (let k = 0; k < 18; k++) { const m = (lo + hi) / 2; if (halfT(m) > au) lo = m; else hi = m; }
    return (lo + hi) / 2;
  };
  // crest height table (sil is sampled a lot)
  const xa = Math.floor(cx - wl - 2), xb = Math.ceil(cx + wr + 2), tab = new Float32Array(xb - xa + 1);
  for (let x = xa; x <= xb; x++) {
    let h = hOfU((x - cx) / (x < cx ? wl : wr));
    h += rough * (0.03 * nz.fbm2(x / 34, 2.3 + i * 1.9, 3) + 0.008 * nz.n2(x / 5, 6.1 + i)) * ss(0.02, 0.25, h);
    tab[x - xa] = h > 0 ? base - H * h : base + 1;
  }
  const sil = (x) => { const q = Math.round(x) - xa; return q < 0 || q >= tab.length ? base + 1 : tab[q]; };
  const half = (y) => { const h = Math.min(1, Math.max(0, (base - y) / H)); return tp != null ? halfT(h) : Math.pow(Math.max(0, 1 - Math.pow(h, 1 / b)), 1 / a); };
  const uOf = (x, y) => (x - cx) / ((x < cx ? wl : wr) * Math.max(0.02, half(y)));
  const xOf = (u, y) => cx + u * (u < 0 ? wl : wr) * half(y);
  const contains = (x, y) => y >= sil(x) && x > cx - wl && x < cx + wr;
  return { i, cx, top, wl, wr, H, sil, half, uOf, xOf, contains, shadow: S.shadow };
}

export function paintDome(ctx, r, nz, o) {
  const paper = o.paper || PAPER, k = o.k || 1;
  const { base } = o;
  const rough = o.rough ?? 1;
  const vD = 1 - (o.tone ?? 0.9);
  const ink = (v, al) => rgba(toneRGB(Math.min(1, Math.max(0, v)), paper), Math.min(1, Math.max(0, al)));
  const shadow = o.shadow ?? -1;
  const shapes = [makeShape(o, 0, base, rough, nz)];
  for (const [j, S] of (o.slabs || []).entries()) shapes.push(makeShape({ a: 2, b: 0.5, ...S, cx: o.cx + (S.dx ?? 0) }, j + 1, base, S.rough ?? rough * 0.8, nz));
  const M = shapes[0], H = M.H;
  const top = Math.min(...shapes.map((s) => s.top));
  const [f0, f1] = o.fade ?? [top + H * 0.5, base];
  const sil = (x) => { let y = Infinity; for (const s of shapes) y = Math.min(y, s.sil(x)); return y; };
  const front = (x, y) => { for (let j = shapes.length - 1; j >= 0; j--) if (shapes[j].contains(x, y)) return j; return -1; };
  const x0 = Math.min(...shapes.map((s) => s.cx - s.wl)) - 4, x1 = Math.max(...shapes.map((s) => s.cx + s.wr)) + 4;
  const treeH = o.treeH ?? 16;
  const bx = Math.floor(x0 - 16), by = Math.floor(top - treeH * 1.4 - 16), bw = Math.ceil(x1 - x0 + 32), bh = Math.ceil(base - by + 4);
  const cv = new OffscreenCanvas(Math.max(1, Math.ceil(bw * k)), Math.max(1, Math.ceil(bh * k)));
  const g = cv.getContext('2d');
  g.setTransform(k, 0, 0, k, -bx * k, -by * k);
  const path = new Path2D();
  path.moveTo(x0, base + 2);
  for (let x = x0; x <= x1; x += 2) path.lineTo(x, Math.min(base + 2, sil(x)));
  path.lineTo(x1, base + 2); path.closePath();
  g.fillStyle = rgba(paper, 1); g.fill(path);
  g.save(); g.clip(path);
  const presAt = (x, y) => 1 - ss(f0 - 30, f1 - 10, y + 36 * nz.fbm2(x / 60, y / 40, 2));
  const sideOf = (S) => S.shadow ?? shadow;
  // 1. modelled wash, per pixel at half resolution; each pixel is modelled by its frontmost form, and
  //    darkened in a crease just outside every form in front of that one
  const ds = 2, mw = Math.ceil(bw / ds), mh = Math.ceil(bh / ds);
  const wc = new OffscreenCanvas(mw, mh), wg = wc.getContext('2d'), img = wg.createImageData(mw, mh);
  const ic = toneRGB(vD, paper), body = o.body ?? 1, CW = o.creaseW ?? 9, CA = o.crease ?? 0.5, mott = o.mottle ?? 1;
  for (let jy = 0; jy < mh; jy++) for (let ix = 0; ix < mw; ix++) {
    const X = bx + (ix + 0.5) * ds, Y = by + (jy + 0.5) * ds;
    if (Y < top - 6) continue;
    let fi = front(X, Y); if (fi < 0) fi = 0;
    const F = shapes[fi], sd = sideOf(F);
    const s = Math.max(-1.5, Math.min(1.5, F.uOf(X, Y))) * sd;   // > 0 toward the shadow edge
    const shade = ss(-0.5, 0.85, s);
    const lit = Math.exp(-(((s + 0.4) / 0.38) ** 2));
    const dy = (Y - F.top) / H;
    const crown = 1 - ss(0.0, fi ? 0.3 : 0.45, dy);
    const n = nz.fbm2(X / 40, Y / 64, 3), n2 = nz.fbm2(X / 12, Y / 26, 2);
    let al = body * (0.36 + (o.shadeK ?? 0.45) * shade + 0.3 * crown) * (1 - (o.lit ?? 0.55) * lit) * (0.85 + 0.38 * n * mott + 0.18 * n2 * mott);
    let cr = 0;
    for (let j = fi + 1; j < shapes.length; j++) {
      const J = shapes[j];
      if (Y < J.top - CW) continue;
      const hw = (X < J.cx ? J.wl : J.wr) * J.half(Y);
      const d = Math.abs(X - J.cx) <= hw ? J.sil(X) - Y : Math.abs(X - J.cx) - hw;
      if (d > 0 && d < CW) cr = Math.max(cr, (1 - d / CW) ** 1.5 * ((X - J.cx) * sideOf(J) > 0 ? 1 : 0.6));
    }
    al += CA * cr * (0.7 + 0.3 * n2);
    al *= 1 - 0.45 * ss(f0 - 60, f1, Y);
    const q = (jy * mw + ix) * 4;
    img.data[q] = ic[0]; img.data[q + 1] = ic[1]; img.data[q + 2] = ic[2];
    img.data[q + 3] = Math.round(Math.min(1, Math.max(0, al)) * 255);
  }
  wg.putImageData(img, 0, 0);
  g.save(); g.filter = `blur(${(1.5 * k).toFixed(1)}px)`; g.imageSmoothingEnabled = true;
  g.drawImage(wc, 0, 0, mw, mh, bx, by, mw * ds, mh * ds);
  g.restore();
  // 2. crisp crease lines along every slab outline that lies inside the body behind it
  for (let j = 1; j < shapes.length; j++) {
    const J = shapes[j], sd = sideOf(J);
    const outline = [];
    for (let y = base; y > J.top + 1; y -= 3) outline.push([J.xOf(-1, y), y, -1]);
    for (let u = -0.9; u <= 0.9; u += 0.15) outline.push([J.cx + u * (u < 0 ? J.wl : J.wr), J.sil(J.cx + u * (u < 0 ? J.wl : J.wr)), 0]);
    for (let y = J.top + 2; y <= base; y += 3) outline.push([J.xOf(1, y), y, 1]);
    let run = [];
    const flush = () => {
      if (run.length > 3) {
        const side = run[(run.length / 2) | 0][2];
        const wgt = side === 0 ? 0.9 : side * sd > 0 ? 1 : 0.65;
        stroke(g, run.map((p) => [p[0], p[1]]), { width: [r.range(1.1, 2.2), 0.35], profile: 'taper', color: ink(vD * 0.45, r.range(0.55, 0.85) * wgt), rng: r, rough: 0.6 });
      }
      run = [];
    };
    for (const p of outline) {
      const [x, y, side] = p;
      const ox = x + (side === 0 ? 0 : side * 3), oy = y - (side === 0 ? 3 : 0);
      let behind = false; for (let q = 0; q < j; q++) if (shapes[q].contains(ox, oy)) { behind = true; break; }
      let hidden = false; for (let q = j + 1; q < shapes.length; q++) if (shapes[q].contains(x, y)) { hidden = true; break; }
      const pr = presAt(x, y);
      if (!behind || hidden || pr < 0.25 || r() < 0.04) { flush(); continue; }
      run.push([x + r.range(-0.4, 0.4), y]);
      if (run.length > 14 && r() < 0.15) { flush(); }
    }
    flush();
    // moss dots clustered along the upper crease
    for (let q = 0; q < (J.wl + J.wr) * 0.5 * (o.dots ?? 1); q++) {
      const p = outline[(r() * outline.length) | 0], [x, y] = p;
      if (!shapes.slice(0, j).some((s) => s.contains(x + p[2] * 3, y - (p[2] ? 0 : 3)))) continue;
      const pr = presAt(x, y) * (1 - ss(J.top, J.top + H * 0.6, y));
      if (r() > pr) continue;
      blob(g, x + p[2] * r.range(1, 5) + r.range(-2, 2), y + r.range(-2, 4), r.range(0.9, 2.8), { color: ink(vD * 0.45, r.range(0.45, 0.85)), rng: r, irregular: 0.5, squash: r.range(0.5, 0.9) });
    }
  }
  // 3. meridian cun: lines from near each form's crown bowing down along its curvature (cut where a
  //    form in front covers them)
  const areaW = shapes.map((s) => (s.wl + s.wr) * s.H), areaT = areaW.reduce((p, q) => p + q, 0);
  const nM = Math.round(shapes.reduce((p, s) => p + s.wl + s.wr, 0) / 11 * (o.cun ?? 1) * 2.2);
  for (let i = 0; i < nM; i++) {
    let pick = r() * areaT, si = 0; while (si < shapes.length - 1 && pick > areaW[si]) { pick -= areaW[si]; si++; }
    const S = shapes[si], sd = sideOf(S);
    const u0 = r.range(-0.95, 0.95);
    const long = r() < 0.35;
    const yS = S.top + S.H * (long ? 0.03 + 0.3 * Math.pow(r(), 1.4) : 0.04 + 0.5 * Math.pow(r(), 1.2));
    const L = H * (long ? r.range(0.12, 0.4) : r.range(0.03, 0.12));
    const pres = presAt(S.xOf(u0, yS + L * 0.4), yS + L * 0.4);
    if (pres < 0.1) continue;
    const sh = ss(-0.4, 0.9, u0 * sd);
    const pts = [];
    for (let s = 0; s <= 1.001; s += 1 / 8) {
      const y = yS + L * s, x = S.xOf(u0 + 0.05 * nz.n2(i * 1.7, s * 2.2), y) + r.range(-0.6, 0.6);
      if (front(x, y) !== si && pts.length) break;
      pts.push([x, y]);
    }
    if (pts.length < 3) continue;
    stroke(g, pts, { width: [long ? r.range(1.1, 2.2) : r.range(1, 2), 0.3], profile: 'taper', color: ink(vD * 0.5, r.range(0.35, 0.8) * pres * (0.45 + 0.55 * sh)), rng: r, rough: 0.6 });
    if (long && r() < 0.4) stroke(g, pts.map((p) => [p[0] - sd * r.range(2, 5), p[1] + 2]), { width: [r.range(4, 8), 1], profile: 'taper', color: ink(vD, r.range(0.05, 0.12) * pres), rng: r, rough: 0.3 });
  }
  // 4. raindrop dots and short dashes, in clusters, more on the shadow side of each form
  const nD = Math.round((x1 - x0) * H / 36 * (o.dots ?? 1));
  for (let i = 0; i < nD; i++) {
    const x = x0 + r() * (x1 - x0), y = top + Math.pow(r(), 1.25) * H;
    if (y < sil(x) + 2) continue;
    const fi = Math.max(0, front(x, y)), F = shapes[fi];
    const cl = ss(-0.15, 0.45, nz.fbm2(x / 22, y / 22, 2));
    const sh = ss(-0.5, 0.9, F.uOf(x, y) * sideOf(F));
    const p = presAt(x, y) * (0.15 + 0.85 * cl) * (0.4 + 0.6 * sh);
    if (r() > p) continue;
    if (r() < 0.35) { const L = r.range(2, 5); stroke(g, [[x - L, y + r.range(-0.5, 0.5)], [x + L, y + r.range(-0.8, 0.8)]], { width: [r.range(0.8, 1.7), 0.4], profile: 'taper', color: ink(vD * 0.7, r.range(0.35, 0.8)), rng: r, rough: 0.4 }); }
    else blob(g, x, y, r.range(0.9, 3) * (0.7 + 0.5 * cl), { color: ink(vD * 0.7, r.range(0.2, 0.6) * (0.6 + 0.4 * sh)), rng: r, irregular: 0.5, squash: r.range(0.45, 0.8) });
  }
  // 5. dark ragged band under the crown contour, and crisp side contours
  for (let x = x0; x <= x1; x += r.range(2.5, 6)) {
    const hf = (base - sil(x)) / H;
    if (hf < 0.2) continue;
    blob(g, x, sil(x) + r.range(1, 7), r.range(2, 6), { color: ink(vD * 0.55, r.range(0.3, 0.75) * ss(0.2, 0.7, hf)), rng: r, irregular: 0.55, squash: 0.75 });
  }
  g.restore();
  {
    // contour: walk the envelope in short runs (steep sides included), darker on the shadow side
    let run = [];
    const flush = (side) => { if (run.length > 2) stroke(g, run, { width: [r.range(1.2, 2.4), 0.4], profile: 'taper', color: ink(vD * 0.4, r.range(0.45, 0.8) * (side * shadow > 0 ? 1 : 0.7)), rng: r, rough: 0.6 }); run = []; };
    for (let x = x0; x <= x1; x += 2) {
      const y = sil(x);
      if (y > base || presAt(x, y) < 0.3) { flush(x < M.cx ? -1 : 1); continue; }
      run.push([x, y + 0.6]);
      if (run.length > 10 + r() * 14) flush(x < M.cx ? -1 : 1);
    }
    flush(1);
  }
  // 6. tufted tree clumps on the crests (outside the clip: they break the outline), also on slab crests
  for (let x = x0; x <= x1; x += r.range(3, 7)) {
    const hf = (base - sil(x)) / H;
    const d = (o.crown ?? 1) * ss(0.3, 0.8, hf) * ss(-0.35, 0.25, nz.n2(x / 36, 3.3) + 0.2);
    if (r() > d || Math.abs(sil(x + 3) - sil(x - 3)) > 14) continue;
    const rr = r.range(3, 8.5);
    blob(g, x, sil(x) + rr * r.range(0.15, 0.9), rr, { color: ink(vD * 0.45, r.range(0.6, 0.92)), rng: r, irregular: 0.45, squash: 0.8, sides: 10 });
    if (r() < 0.5) blob(g, x + r.range(-3, 3), sil(x) + rr * 1.6, rr * 0.8, { color: ink(vD * 0.5, r.range(0.5, 0.85)), rng: r, irregular: 0.45, squash: 0.8 });
  }
  for (let j = 1; j < shapes.length; j++) {
    const J = shapes[j];
    for (let x = J.cx - J.wl * 0.6; x <= J.cx + J.wr * 0.6; x += r.range(4, 9)) {
      const y = J.sil(x);
      if (y <= sil(x) + 3 || front(x, y + 2) !== j || r() > 0.55 * (o.crown ?? 1) * presAt(x, y)) continue;
      const rr = r.range(2, 5.5);
      blob(g, x, y + rr * 0.3, rr, { color: ink(vD * 0.45, r.range(0.55, 0.88)), rng: r, irregular: 0.45, squash: 0.8, sides: 10 });
    }
  }
  // ledge tufts on the steep sides of the silhouette
  for (const S of shapes) for (const side of [-1, 1]) for (let y = S.top + S.H * 0.08; y < f1; y += r.range(5, 14)) {
    const x = S.xOf(side, y);
    if (shapes.some((q) => q !== S && q.contains(x + side * 2, y)) || r() > 0.3 * (o.ledges ?? 1) * presAt(x, y)) continue;
    for (let q = 0, n = 1 + (r() * 3 | 0); q < n; q++) { const rr = r.range(1.6, 4.2); blob(g, x + side * r.range(-1, 2.5), y + r.range(-4, 4), rr, { color: ink(vD * 0.45, r.range(0.5, 0.85)), rng: r, irregular: 0.5, squash: 0.8 }); }
  }
  if (o.trees) {
    let x = x0 + r() * treeH, j = 0;
    while (x < x1) {
      const hf = (base - sil(x)) / H;
      if (r() < o.trees * ss(0.6, 0.9, hf)) {
        const th = treeH * (0.55 + 0.6 * r());
        paintConifer(g, x, sil(x) + th * 0.2, th, { kind: r() < 0.7 ? 'fir' : 'pine', tone: Math.min(1, vD * 0.6), paper, seed: (o.seed ?? 1) * 1000 + j, detail: 0 });
      }
      x += treeH * r.range(0.35, 0.8); j++;
    }
  }
  // 7. mist dissolve toward the base (noisy low-res mask)
  const md = 4, qw = Math.ceil(bw / md), qh = Math.ceil(bh / md);
  const mc = new OffscreenCanvas(qw, qh), mg = mc.getContext('2d'), mi = mg.createImageData(qw, qh);
  for (let jy = 0; jy < qh; jy++) for (let ix = 0; ix < qw; ix++) {
    const X = bx + (ix + 0.5) * md, Y = by + (jy + 0.5) * md;
    const n = nz.fbm2(X / 70, Y / 30, 3) + 0.9 * nz.fbm2(X / 120, 3.3, 2);
    mi.data[(jy * qw + ix) * 4 + 3] = Math.round((1 - ss(f0, f1, Y + n * (f1 - f0) * 0.6)) * 255);
  }
  mg.putImageData(mi, 0, 0);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'destination-in';
  g.imageSmoothingEnabled = true;
  g.drawImage(mc, 0, 0, qw, qh, 0, 0, qw * md * k, qh * md * k);
  ctx.drawImage(cv, bx, by, cv.width / k, cv.height / k);
  return { sil };
}

export function makeDomes(api, o) {
  const rect = o.rect, paper = o.paper || PAPER;
  const T0 = performance.now();
  const raw = api.bakeCanvas(rect[2], rect[3], (ctx, { k }) => {
    ctx.translate(-rect[0], -rect[1]);
    o.domes.forEach((d, i) => {
      const seed = d.seed ?? i + 1;
      paintDome(ctx, api.rng(seed * 7919 + 13), api.noise(seed * 31 + 7), { paper, k, ...o.defaults, ...d });
    });
  }, { scale: o.scale ?? 1 });
  console.warn('domes bake ms', Math.round(performance.now() - T0));
  const src = o.wet === false ? raw : wetInk(api, raw, { paper, ink: [12, 11, 10], soft: 1.2, blur: 0.12, bleed: 0.25, edge: 0.45, granulation: 0.35, mottle: 0.45, seed: 2, ...(o.wet || {}) });
  if (src !== raw) api.engine?.freeTex?.(raw);
  return { src, rect, layer: (lo = {}) => api.tex(src, { rect, ...lo }) };
}
