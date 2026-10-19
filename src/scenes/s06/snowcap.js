// s06 snow caps: snow that settles on whatever is already painted on a canvas.
// The painted alpha is smoothed into an occupancy field; in every pixel column each
// upward-facing surface (top of a foliage pad, upper side of a limb) gets a cap: a
// mound above the surface plus a layer reaching down into the foliage. Thickness
// follows how flat the surface is (steep sides stay dark) and wanders with noise, so
// caps are flat, wide and lumpy, white on top and cool grey underneath, with the
// dark needles showing below their wavy lower edge.
import { buildPine, paintPine } from '../../lib/pine.js';
import { inkify } from '../../lib/inkfx.js';

const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function noise1(seed) {
  let s = (seed * 2654435761) >>> 0;
  const r = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const T = new Float32Array(512);
  for (let i = 0; i < 512; i++) T[i] = r();
  return (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return T[i & 511] * (1 - u) + T[(i + 1) & 511] * u; };
}
function boxH(src, W, H, r) {
  const out = new Float32Array(W * H), n = 2 * r + 1;
  for (let y = 0; y < H; y++) {
    const o = y * W;
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[o + Math.max(0, Math.min(W - 1, x))];
    for (let x = 0; x < W; x++) {
      out[o + x] = acc / n;
      acc += src[o + Math.min(W - 1, x + r + 1)] - src[o + Math.max(0, x - r)];
    }
  }
  return out;
}
function boxV(src, W, H, r) {
  const out = new Float32Array(W * H), n = 2 * r + 1;
  for (let x = 0; x < W; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += src[Math.max(0, Math.min(H - 1, y)) * W + x];
    for (let y = 0; y < H; y++) {
      out[y * W + x] = acc / n;
      acc += src[Math.min(H - 1, y + r + 1) * W + x] - src[Math.max(0, y - r) * W + x];
    }
  }
  return out;
}

/**
 * snowCaps(canvas, k, opts) - paints snow onto the canvas in place (pixel space, k = px per design px)
 *   cap     depth of the cap into the foliage, design px (12)
 *   mound   height of the snow above the surface, design px (6)
 *   blur    occupancy smoothing radius, design px (4): larger = smoother, wider caps
 *   freq    thickness variation frequency per design px (0.05)
 *   lobes   lower-edge lobe amplitude (0.5); runShare: max share of a thin run covered (0.6)
 *   flat    [lo, hi] up-facing range for the cap thickness ([0.3, 0.8])
 */
export function snowCaps(cv, k, o = {}) {
  const W = cv.width, H = cv.height;
  const g = cv.getContext('2d');
  const img = g.getImageData(0, 0, W, H);
  const d = img.data, N = W * H;
  const A = new Float32Array(N);
  if (o.ink) {
    // occupancy = dark ink: snow settles on the tops of dark rock and needles, not on snow
    const [i0, i1] = o.ink === true ? [0.72, 0.4] : o.ink;
    for (let i = 0; i < N; i++) { const j = i * 4, L = (0.3 * d[j] + 0.59 * d[j + 1] + 0.11 * d[j + 2]) / 255; A[i] = d[j + 3] / 255 * sstep(i0, i1, L); }
  } else for (let i = 0; i < N; i++) A[i] = d[i * 4 + 3] / 255;
  const bl = o.blur ?? 4;
  const rb = Math.max(1, Math.round(bl * k));
  const B = boxV(boxH(boxH(A, W, H, rb), W, H, rb), W, H, Math.max(1, Math.round(bl * 0.45 * k)));
  const thr = o.thr ?? 0.38;
  const cap = (o.cap ?? 12) * k, mound = (o.mound ?? 6) * k;
  const seed = o.seed ?? 1;
  const n1 = noise1(seed), n2 = noise1(seed + 7), n3 = noise1(seed + 13);
  const fq = o.freq ?? 0.05, lob = o.lobes ?? 0.5, share = o.runShare ?? 0.6;
  const [f0, f1] = o.flat ?? [0.3, 0.8];
  const S = new Float32Array(N), V = new Float32Array(N);
  const gd = Math.max(1, Math.round(2 * k));
  // pass 1: surfaces with their raw thickness, depth limit and mound, stored as maps
  const TM = new Float32Array(N), MM = new Float32Array(N), RM = new Float32Array(N), IND = new Float32Array(N);
  const surf = [];
  for (let x = 0; x < W; x++) {
    const xd = x / k;
    const tN = 0.55 + 0.9 * n1(xd * fq);
    const mN = 0.45 + 0.9 * n2(xd * fq * 1.3);
    let y = 0;
    while (y < H) {
      while (y < H && B[y * W + x] <= thr) y++;
      if (y >= H) break;
      const ys = y;
      while (y < H && B[y * W + x] > thr) y++;
      const gy = B[Math.min(H - 1, ys + gd) * W + x] - B[Math.max(0, ys - gd) * W + x];
      const gx = B[ys * W + Math.min(W - 1, x + gd)] - B[ys * W + Math.max(0, x - gd)];
      const f = sstep(f0, f1, gy / (Math.hypot(gx, gy) + 1e-5));
      const i = ys * W + x;
      TM[i] = cap * tN * f; MM[i] = Math.min(mound * mN * f, cap * 0.8); RM[i] = (y - ys) * share; IND[i] = 1;
      surf.push(i);
    }
  }
  // smooth them along the surfaces so neighbouring columns agree (no blocky steps)
  const rT = Math.max(2, Math.round(cap * 0.6)), rY = Math.max(1, Math.round(2.5 * k));
  const sm = (M) => boxV(boxH(boxH(M, W, H, rT), W, H, rT), W, H, rY);
  const TS = sm(TM), MS = sm(MM), RS = sm(RM), IS = sm(IND);
  for (const i of surf) {
    {
      const x = i % W, ys = (i - x) / W, xd = x / k;
      const w = sstep(o.taper ?? 0.42, 0.92, IS[i] * (2 * rY + 1)) / Math.max(1e-4, IS[i]);    // tapers at the ends of a surface
      const lN = 1 + lob * (2 * n3(xd * 0.07) - 1) + 0.35 * lob * (2 * n3(xd * 0.17 + 50) - 1);
      const ww = 1 / Math.max(1e-4, IS[i]), tp = w / ww;   // tp: 0 at a surface end .. 1 inside
      const T = Math.min(TS[i] * ww * lN * (0.45 + 0.55 * tp), RS[i] * ww);
      const M = MS[i] * w * (0.55 + 0.9 * n2(xd * (o.bumps ?? 0.09) + 77));
      if (T + M < k * 1.2) continue;
      const y0 = ys - M, y1 = ys + T;
      for (let yi = Math.max(0, Math.floor(y0)); yi <= Math.min(H - 1, Math.ceil(y1)); yi++) {
        const cov = Math.min(1, yi + 1 - y0, y1 - yi);
        if (cov <= 0) continue;
        const i = yi * W + x;
        if (cov > S[i]) { S[i] = cov; V[i] = (yi - y0) / Math.max(1, y1 - y0); }
      }
    }
  }
  // round the caps: soften column steps, then a soft threshold
  const rs = Math.max(1, Math.round((o.round ?? 2.2) * k));
  const rv = Math.max(1, Math.round(0.8 * k));
  const Sb = boxV(boxV(boxH(boxH(S, W, H, rs), W, H, rs), W, H, rv), W, H, rv);
  const Vb = boxV(boxH(V, W, H, rs), W, H, Math.max(1, Math.round(0.6 * k)));
  const top = o.color ?? [250, 250, 248], under = o.under ?? [190, 196, 204], rim = o.rim ?? [222, 225, 229];
  const ga = o.alpha ?? 1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const s = sstep(0.32, 0.62, Sb[i]) * ga;
      if (s <= 0.003) continue;
      const v = Vb[i];
      const sh = sstep(0.3, 1.0, v) * (0.7 + 0.6 * n2(x / k * 0.05 + y / k * 0.03 + 30));
      const edge = 1 - sstep(0.62, 0.95, Sb[i]);     // faint cool line where the cap meets the paper
      let r = top[0] + (under[0] - top[0]) * sh, gg = top[1] + (under[1] - top[1]) * sh, b = top[2] + (under[2] - top[2]) * sh;
      const e = edge * 0.55 * (1 - sh);
      r += (rim[0] - r) * e; gg += (rim[1] - gg) * e; b += (rim[2] - b) * e;
      const j = i * 4, sa = d[j + 3] / 255;
      const oa = s + sa * (1 - s);
      d[j] = (r * s + d[j] * sa * (1 - s)) / oa;
      d[j + 1] = (gg * s + d[j + 1] * sa * (1 - s)) / oa;
      d[j + 2] = (b * s + d[j + 2] * sa * (1 - s)) / oa;
      d[j + 3] = oa * 255;
    }
  }
  g.putImageData(img, 0, 0);
}

// makePine with snow caps instead of the library's snow cushions
export function makeSnowPine(api, o = {}) {
  const T = buildPine(o);
  const m = o.margin ?? 40;
  const [bx1, by1, bx2, by2] = T.anchor.bbox;
  const rect = [Math.floor(bx1 - m), Math.floor(by1 - m), Math.ceil(bx2 - bx1 + 2 * m), Math.ceil(by2 - by1 + 2 * m)];
  let src = api.bakeCanvas(rect[2], rect[3], (ctx, { k }) => {
    ctx.translate(-rect[0], -rect[1]);
    paintPine(ctx, { ...o, snow: 0, backTone: o.backTone ?? 0.55, under: o.under ?? 1.4, tree: T });
    snowCaps(ctx.canvas, k, { seed: (o.seed ?? 1) * 3 + 1, ...(o.caps || {}) });
  }, { scale: o.scale ?? 1 });
  const inked = inkify(api, src, { edge: 0.4, granulation: 0.1, bleed: 0.8, seed: (o.seed ?? 1) % 17, ...(o.ink || {}) });
  api.engine?.freeTex?.(src);
  src = inked;
  const a = T.anchor;
  const sway = { amp: o.swayAmp ?? 4, freq: o.swayFreq ?? 0.22, scale: 380, power: 1.8, anchor: a.base, radius: a.reach, bias: 0 };
  return { src, rect, anchor: a, tree: T, sway, layer: (lo = {}) => api.tex(src, { rect, sway, name: 'pine', ...lo }) };
}
