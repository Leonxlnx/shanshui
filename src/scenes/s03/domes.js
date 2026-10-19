// s03 helper: the rounded granite domes and spires of ref 03 (Huangshan style), Canvas2D + wet ink.
// A dome is a parametric bell h(u) = (1 - |u|^a)^b (u = dx / half width; a ~2 b ~0.45 = round-topped
// bullet, a ~1.2 = pointed spire). Painted as: a paper fill (occludes farther domes), a smooth
// modelled ink wash (shadow face, lit face, darker crown, wet mottling), meridian cun lines that follow
// the dome's curvature, clustered raindrop dots and short dashes, a dark ragged crown band, tufted tree
// clumps and small conifers on the crown, then a noisy mist dissolve toward the base.
//
// makeDomes(api, { rect, domes: [{ cx, top, wl, wr, base, a, b, tone, fade: [y0, y1], shadow (-1 left),
//                  body, cun, dots, crown, trees, treeH, rough, seed }], paper, wet }) -> { src, rect, layer(o) }
import { stroke, dryStroke, blob, rgba, tone as toneRGB, PAPER } from '../../lib/brush.js';
import { paintConifer } from '../../lib/pine.js';
import { wetInk } from '../../lib/peaks.js';

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function paintDome(ctx, r, nz, o) {
  const paper = o.paper || PAPER, k = o.k || 1;
  const { cx, top, base } = o;
  const wl = o.wl ?? o.w ?? 100, wr = o.wr ?? o.w ?? 100;
  const a = o.a ?? 2.2, b = o.b ?? 0.45;
  const H = base - top;
  const vD = 1 - (o.tone ?? 0.9);
  const ink = (v, al) => rgba(toneRGB(Math.min(1, Math.max(0, v)), paper), Math.min(1, Math.max(0, al)));
  const [f0, f1] = o.fade ?? [top + H * 0.5, base];
  const shadow = o.shadow ?? -1;
  const rough = o.rough ?? 1;
  // shape: bell h(u) = (1 - |u|^a)^b, or (o.t set) a flaring trapezoid with a rounded cap: half width
  // (t + (1 - t)(1 - hn)^p) * ellipse cap over the top capH px
  const hc = o.t != null ? 1 - (o.capH ?? 40) / H : 1, tp = o.t ?? 0, pp = o.p ?? 1;
  const halfT = (hn) => (tp + (1 - tp) * Math.pow(1 - hn, pp)) * (hn > hc ? Math.sqrt(Math.max(0, 1 - ((hn - hc) / (1 - hc)) ** 2)) : 1) * (1 + 0.035 * rough * nz.n2(hn * H / 22, 4.4) + 0.015 * rough * nz.n2(hn * H / 6, 8.8));
  const hOfU = (u) => {
    const au = Math.abs(u);
    if (au >= 1) return 0;
    if (o.t == null) return Math.pow(1 - Math.pow(au, a), b);
    let lo = 0, hi = 1;
    for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (halfT(m) > au) lo = m; else hi = m; }
    return (lo + hi) / 2;
  };
  const sil = (x) => {
    let h = hOfU((x - cx) / (x < cx ? wl : wr));
    h += rough * (0.03 * nz.fbm2(x / 34, 2.3, 3) + 0.008 * nz.n2(x / 5, 6.1)) * ss(0.02, 0.25, h);
    return base - H * Math.max(0, h);
  };
  const half = (y) => { const h = Math.min(1, Math.max(0, (base - y) / H)); return o.t != null ? halfT(h) : Math.pow(Math.max(0, 1 - Math.pow(h, 1 / b)), 1 / a); };
  const uOf = (x, y) => (x - cx) / ((x < cx ? wl : wr) * Math.max(0.02, half(y)));
  const xOf = (u, y) => cx + u * (u < 0 ? wl : wr) * half(y);
  const x0 = cx - wl - 4, x1 = cx + wr + 4;
  const treeH = o.treeH ?? 16;
  const bx = Math.floor(x0 - 16), by = Math.floor(top - treeH * 1.4 - 16), bw = Math.ceil(x1 - x0 + 32), bh = Math.ceil(base - by + 4);
  const cv = new OffscreenCanvas(Math.max(1, Math.ceil(bw * k)), Math.max(1, Math.ceil(bh * k)));
  const g = cv.getContext('2d');
  g.setTransform(k, 0, 0, k, -bx * k, -by * k);
  const path = new Path2D();
  path.moveTo(x0, base + 2);
  for (let x = x0; x <= x1; x += 2) path.lineTo(x, sil(x));
  path.lineTo(x1, base + 2); path.closePath();
  g.fillStyle = rgba(paper, 1); g.fill(path);
  g.save(); g.clip(path);
  // 1. modelled wash, per pixel at half resolution
  const ds = 2, mw = Math.ceil(bw / ds), mh = Math.ceil(bh / ds);
  const wc = new OffscreenCanvas(mw, mh), wg = wc.getContext('2d'), img = wg.createImageData(mw, mh);
  const ic = toneRGB(vD, paper), body = o.body ?? 1;
  for (let jy = 0; jy < mh; jy++) for (let ix = 0; ix < mw; ix++) {
    const X = bx + (ix + 0.5) * ds, Y = by + (jy + 0.5) * ds;
    if (Y < top - 6) continue;
    const s = Math.max(-1.5, Math.min(1.5, uOf(X, Y))) * shadow;   // > 0 toward the shadow edge
    const shade = ss(-0.5, 0.85, s);
    const lit = Math.exp(-(((s + 0.4) / 0.38) ** 2));
    const dy = (Y - top) / H;
    const crown = 1 - ss(0.0, 0.45, dy);
    const n = nz.fbm2(X / 40, Y / 64, 3), n2 = nz.fbm2(X / 12, Y / 26, 2);
    let al = body * (0.32 + 0.45 * shade + 0.3 * crown) * (1 - 0.5 * lit) * (0.8 + 0.5 * n + 0.22 * n2);
    al *= 1 - 0.45 * ss(f0 - 60, f1, Y);
    const q = (jy * mw + ix) * 4;
    img.data[q] = ic[0]; img.data[q + 1] = ic[1]; img.data[q + 2] = ic[2];
    img.data[q + 3] = Math.round(Math.min(1, Math.max(0, al)) * 255);
  }
  wg.putImageData(img, 0, 0);
  g.save(); g.filter = `blur(${(1.5 * k).toFixed(1)}px)`; g.imageSmoothingEnabled = true;
  g.drawImage(wc, 0, 0, mw, mh, bx, by, mw * ds, mh * ds);
  g.restore();
  const presAt = (x, y) => 1 - ss(f0 - 30, f1 - 10, y + 36 * nz.fbm2(x / 60, y / 40, 2));
  // 2. meridian cun: lines from near the crown bowing down along the dome's curvature
  const nM = Math.round((wl + wr) / 11 * (o.cun ?? 1));
  for (let i = 0; i < nM; i++) {
    const u0 = r.range(-0.97, 0.97);
    const yS = top + H * (0.04 + 0.32 * Math.pow(r(), 1.4));
    const L = H * r.range(0.12, 0.45);
    const pres = presAt(xOf(u0, yS + L * 0.4), yS + L * 0.4);
    if (pres < 0.1) continue;
    const sh = ss(-0.4, 0.9, u0 * shadow);
    const pts = [];
    for (let s = 0; s <= 1.001; s += 1 / 8) { const y = yS + L * s; pts.push([xOf(u0 + 0.05 * nz.n2(i * 1.7, s * 2.2), y) + r.range(-0.6, 0.6), y]); }
    stroke(g, pts, { width: [r.range(0.9, 2.4), 0.35], profile: 'taper', color: ink(vD * 0.7, r.range(0.3, 0.7) * pres * (0.45 + 0.55 * sh)), rng: r, rough: 0.55 });
    if (r() < 0.5) stroke(g, pts.map((p) => [p[0] - shadow * r.range(2, 5), p[1] + 2]), { width: [r.range(4, 9), 1], profile: 'taper', color: ink(vD, r.range(0.08, 0.18) * pres), rng: r, rough: 0.3 });
  }
  // 3. raindrop dots and short dashes, in clusters, more on the shadow side
  const nD = Math.round((wl + wr) * H / 36 * (o.dots ?? 1));
  for (let i = 0; i < nD; i++) {
    const x = x0 + r() * (x1 - x0), y = top + Math.pow(r(), 1.25) * H;
    if (y < sil(x) + 2) continue;
    const cl = ss(-0.15, 0.45, nz.fbm2(x / 22, y / 22, 2));
    const sh = ss(-0.5, 0.9, uOf(x, y) * shadow);
    const p = presAt(x, y) * (0.15 + 0.85 * cl) * (0.45 + 0.55 * sh);
    if (r() > p) continue;
    if (r() < 0.35) { const L = r.range(2, 5); stroke(g, [[x - L, y + r.range(-0.5, 0.5)], [x + L, y + r.range(-0.8, 0.8)]], { width: [r.range(0.8, 1.7), 0.4], profile: 'taper', color: ink(vD * 0.7, r.range(0.35, 0.8)), rng: r, rough: 0.4 }); }
    else blob(g, x, y, r.range(0.7, 2.6) * (0.7 + 0.5 * cl), { color: ink(vD * 0.7, r.range(0.2, 0.6) * (0.6 + 0.4 * sh)), rng: r, irregular: 0.5, squash: r.range(0.45, 0.8) });
  }
  // 4. dark ragged band under the crown contour
  for (let x = x0; x <= x1; x += r.range(2.5, 6)) {
    const hf = (base - sil(x)) / H;
    if (hf < 0.2) continue;
    blob(g, x, sil(x) + r.range(1, 8), r.range(2, 6.5), { color: ink(vD * 0.55, r.range(0.3, 0.75) * ss(0.2, 0.7, hf)), rng: r, irregular: 0.55, squash: 0.75 });
  }
  g.restore();
  // 5. tufted tree clumps on the crown (outside the clip: they break the outline)
  for (let x = x0; x <= x1; x += r.range(3, 7)) {
    const hf = (base - sil(x)) / H;
    const d = (o.crown ?? 1) * ss(0.3, 0.8, hf) * ss(-0.35, 0.25, nz.n2(x / 36, 3.3) + 0.2);
    if (r() > d || Math.abs(sil(x + 3) - sil(x - 3)) > 14) continue;
    const rr = r.range(3, 8.5);
    blob(g, x, sil(x) + rr * r.range(0.15, 0.9), rr, { color: ink(vD * 0.45, r.range(0.6, 0.92)), rng: r, irregular: 0.45, squash: 0.8, sides: 10 });
    if (r() < 0.5) blob(g, x + r.range(-3, 3), sil(x) + rr * 1.6, rr * 0.8, { color: ink(vD * 0.5, r.range(0.5, 0.85)), rng: r, irregular: 0.45, squash: 0.8 });
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
  // 6. mist dissolve toward the base (noisy low-res mask)
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
