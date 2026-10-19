// s04 helper: Huangshan granite massifs painted like ref 04.
// A massif is a silhouette given by its top contour (summits, left to right) with spire tips; its sides
// drop to the mist line. Inside: lit spindle faces (pale, broken dark contour on the shadow side), a
// blurred wash of vertical blots, a crisp dry-brush texture (thresholded streak noise whose coverage
// follows the shade field), art-directed value / foliage-blotch zones, soft Huangshan pines clustered
// on the summits (paintSoftPine), and a billowy dissolve into mist at the base. Dabs are batched in
// alpha buckets (one fill per bucket) to keep the bake fast. Painted in colour (paper occluder + diluted ink), finish the bake
// with peaks.wetInk.
import { smoothPath, PAPER } from '../../lib/brush.js';

const INKC = [14, 12, 9];
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const dil = (paper, t) => INKC.map((c, i) => Math.round(mix(c, paper[i], clamp(t))));
const css = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

function dab(g, x, y, r, a, rng, squash = 0.8, rot = null, irr = 0.35) {
  if (a <= 0.004 || r <= 0.1) return;
  if (g.bk) { let i = 0; const B = g.bk; while (i < B.length - 1 && a > (B[i].a + B[i + 1].a) / 2) i++; dabShape(B[i].p, x, y, r, rng, squash, rot, irr); return; }
  g.globalAlpha = Math.min(1, a);
  g.beginPath();
  dabShape(g, x, y, r, rng, squash, rot, irr);
  g.fill();
}
// alpha-bucketed batch of dabs: one fill per bucket instead of one per dab (much faster rasterising)
function buckets(levels) { return { bk: levels.map((a) => ({ a, p: new Path2D() })) }; }
function flush(g, B) { for (const b of B.bk) { g.globalAlpha = b.a; g.fill(b.p); } }
function dabShape(g, x, y, r, rng, squash, rot, irr) {
  const n = 7 + ((rng() * 3) | 0);
  const ph = rng() * 6.283, ro = rot ?? rng() * Math.PI;
  const cr = Math.cos(ro), sr = Math.sin(ro);
  const px = [], py = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * 6.2832;
    const rr = r * (1 + (rng() - 0.5) * irr * 2 + Math.sin(t * 2 + ph) * irr * 0.4);
    const ex = Math.cos(t) * rr, ey = Math.sin(t) * rr * squash;
    px.push(x + ex * cr - ey * sr); py.push(y + ex * sr + ey * cr);
  }
  g.moveTo((px[n - 1] + px[0]) / 2, (py[n - 1] + py[0]) / 2);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; g.quadraticCurveTo(px[i], py[i], (px[i] + px[j]) / 2, (py[i] + py[j]) / 2); }
  g.closePath();
}

// tapered filled stroke along pts
function ribbon(g, pts, width, a, rng, rough = 0.4, prof = 'brush') {
  if (a <= 0.004 || pts.length < 2) return;
  const path = smoothPath(pts, 3);
  const n = path.length;
  if (n < 2) return;
  const L = [0];
  for (let i = 1; i < n; i++) L.push(L[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  const tot = L[n - 1] || 1;
  const pf = prof === 'taper' ? (s) => Math.pow(Math.min(1, s * 6 + 0.25), 0.5) * (1 - s * 0.85)
    : (s) => Math.pow(Math.max(0, Math.sin(Math.PI * (0.07 + 0.93 * s))), 0.5);
  const left = [], right = [];
  let wob = 0;
  for (let i = 0; i < n; i++) {
    const p0 = path[Math.max(0, i - 1)], p1 = path[Math.min(n - 1, i + 1)];
    let dx = p1[0] - p0[0], dy = p1[1] - p0[1];
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    wob = wob * 0.75 + (rng() - 0.5) * rough * 0.5;
    const hw = Math.max(0.08, 0.5 * width * pf(L[i] / tot) * (1 + wob));
    left.push([path[i][0] - dy * hw, path[i][1] + dx * hw]);
    right.push([path[i][0] + dy * hw, path[i][1] - dx * hw]);
  }
  g.globalAlpha = Math.min(1, a);
  g.beginPath();
  g.moveTo(left[0][0], left[0][1]);
  for (let i = 1; i < n; i++) g.lineTo(left[i][0], left[i][1]);
  for (let i = n - 1; i >= 0; i--) g.lineTo(right[i][0], right[i][1]);
  g.closePath();
  g.fill();
}

/**
 * paintSoftPine(g, w, x, y, h, o, rng) - Huangshan pine as in ref 04: thin crooked trunk and 2-5
 * flat tiered pads (dark bristly domes with flat bottoms). Soft pad bodies go to the wet layer `w`
 * (blurred later), crisp needle tufts and bristle ticks to `g`. Both contexts must have fillStyle set.
 *   width (1), lean (ratio), tiers (auto), wetA (1), ink css colour (for ticks)
 */
export function paintSoftPine(g, w, x, y, h, o, rng) {
  const wm = o.width ?? 1;
  const lean = o.lean ?? (rng() - 0.5) * 0.3;
  // two kinds as in ref 04: dense conical tiered pines (most) and flat umbrella pines
  const cone = o.cone ?? (!o.tiers && rng() < 0.6);
  const n = o.tiers ?? (cone ? (h < 28 ? 3 + ((rng() * 1.6) | 0) : 4 + ((rng() * 2.6) | 0)) : h < 28 ? 2 + ((rng() * 1.6) | 0) : 3 + ((rng() * 1.8) | 0));
  const topX = x + lean * h, topY = y - h;
  const bend = (rng() - 0.5) * h * 0.14;
  const ns = clamp(h / 55, 0.45, 1.5);
  const trunkX = (u) => (u < 0.45 ? mix(x, x + bend, u / 0.45) : mix(x + bend, topX, (u - 0.45) / 0.55));
  ribbon(g, [[x, y], [x + bend, y - h * 0.45], [topX, topY + h * 0.12]], Math.max(0.9, h * 0.055 * wm), 0.9, rng, 0.3, 'taper');
  let side = rng() < 0.5 ? -1 : 1;
  g.strokeStyle = o.ink;
  for (let i = 0; i < n; i++) {
    const f = n === 1 ? 1 : i / (n - 1);
    const ty = y - h * (cone ? 0.2 + 0.72 * f : 0.3 + 0.62 * f) + (rng() - 0.5) * h * 0.04;
    const tx = trunkX((y - ty) / h);
    // cone: tiers shrink upward and overlap; umbrella: similar widths, broad flat top, pads thrown to alternate sides
    const half = h * wm * (cone ? 0.3 * Math.pow(1 - f, 0.9) + 0.08 : 0.21 + 0.13 * (1 - f) + (i === n - 1 ? 0.06 : 0)) * (0.8 + 0.4 * rng());
    side = rng() < 0.7 ? -side : side;
    const off = side * half * (cone ? 0.04 + 0.18 * rng() : i === n - 1 ? 0.1 * rng() : 0.15 + 0.35 * rng());
    const th = h * (0.13 + 0.06 * rng());
    const cx = tx + off;
    if (Math.abs(off) > half * 0.2) ribbon(g, [[tx, ty + th * 0.35], [mix(tx, cx, 0.6), ty + th * 0.15], [cx, ty + th * 0.05]], Math.max(0.7, h * 0.026), 0.85, rng, 0.3, 'taper');
    // the pad is a row of 1-4 bristly sub-domes (bumpy top edge, outer clumps droop, gaps between)
    const nsub = clamp(Math.round(half / (h * 0.11 + 3)), 1, 4);
    for (let k = 0; k < nsub; k++) {
      const u = nsub === 1 ? 0 : (k / (nsub - 1)) * 2 - 1;
      const sx = cx + u * half * 0.62 + (rng() - 0.5) * half * 0.12;
      const sh = half * (nsub === 1 ? 1 : 0.5 + 0.22 * rng()) * (1 - 0.2 * Math.abs(u));
      const sth = th * (0.75 + 0.45 * rng()) * (1 - 0.25 * Math.abs(u));
      const sy = ty + Math.abs(u) * th * 0.3 + (rng() - 0.5) * th * 0.3;
      softPad(g, w, sx, sy, sh, sth, ns, o, rng);
    }
  }
}
function softPad(g, w, cx, ty, half, th, ns, o, rng) {
  // soft body
  dab(w, cx, ty - th * 0.3, half * 0.9, 0.6 * (o.wetA ?? 1), rng, clamp(th / half, 0.25, 0.6), (rng() - 0.5) * 0.15, 0.25);
  // needle tufts, dense at the top edge, flat bottom
  const m = Math.max(8, Math.round((half * th) / (1.25 * ns * ns)));
  const TB = buckets([0.4, 0.65, 0.92]);
  for (let j = 0; j < m; j++) {
    const a = rng() * 2 - 1;
    const v = Math.pow(rng(), 0.55);
    const dome = 0.25 + 0.95 * Math.pow(Math.max(0, 1 - a * a), 0.5);
    dab(TB, cx + a * half * 0.95, ty + th * 0.2 - v * th * dome, (1.2 + rng() * 1.8) * ns * (0.7 + 0.5 * v), 0.3 + 0.7 * Math.pow(v, 1.3), rng, 0.45, Math.PI / 2 + a * 0.6 + (rng() - 0.5) * 0.6, 0.4);
  }
  flush(g, TB);
  // bristle ticks along the dome
  g.globalAlpha = 0.75;
  g.lineWidth = 0.75 * ns;
  g.beginPath();
  const mt = Math.round(half / (1.1 * ns));
  for (let j = 0; j < mt; j++) {
    const a = rng() * 2 - 1;
    const ex = cx + a * half, ey = ty + th * 0.2 - th * (0.25 + 0.95 * Math.pow(Math.max(0, 1 - a * a), 0.5));
    const ang = -Math.PI / 2 + a * 1.2 + (rng() - 0.5) * 0.6;
    const len = (1.5 + rng() * 3) * ns;
    g.moveTo(ex - Math.cos(ang) * len * 0.4, ey - Math.sin(ang) * len * 0.4);
    g.lineTo(ex + Math.cos(ang) * len, ey + Math.sin(ang) * len);
  }
  g.stroke();
}

/**
 * paintMassif(ctx, api, o)
 *   top      [[x,y],...] top contour control points, left to right (first/last = shoulders)
 *   base     y where the massif has fully dissolved into mist
 *   fade     y where the dissolve starts (absolute) or fraction (0..1) of top..base (default 0.5)
 *   splay    [left, right] px the sides spread outward down to the base (default [20, 20])
 *   tone     darkest ink value (0 black .. 1 paper)
 *   faces    [{x, y, w, len, lean}] lit spindle faces (tip at x,y), auto from summits when omitted
 *   trees    density multiplier (1), treeH [min, max] px, treeTone, ledges [[x,y,n],...]
 *   moss     dab density multiplier (1), wash (stroke density, 1), sc brush scale (1)
 *   seed, paper
 */
export function paintMassif(ctx, api, o) {
  const seed = o.seed ?? 1;
  const rng = api.rng('massif:' + seed);
  const nz = api.noise('massif:n:' + seed);
  const paper = o.paper || PAPER;
  const sc = o.sc ?? 1;
  const tone = o.tone ?? 0.3;
  const inkCss = css(dil(paper, tone));
  const treeTone = o.treeTone ?? tone * 0.55;
  // ---- contour
  const raw = smoothPath(o.top, 1.5);
  // finger tips: rounded-pointed spire tops with notches between them (Huangshan fluting)
  const tipK = o.tips ?? 1;
  const rx0 = raw[0][0], rx1 = raw[raw.length - 1][0];
  const tips = [];
  if (tipK > 0) {
    let tx = rx0 + rng() * 10 * sc;
    while (tx < rx1) {
      const w = (16 + rng() * 26) * sc * (o.tipW ?? 1);
      const edge = sstep(0, 40 * sc, Math.min(tx - rx0, rx1 - tx));
      tips.push({ x: tx + w * 0.5, hw: w * (0.55 + rng() * 0.25), h: (5 + Math.pow(rng(), 1.4) * 21) * sc * tipK * (0.35 + 0.65 * edge), sk: (rng() - 0.5) * 0.5 });
      tx += w * (0.75 + rng() * 0.35);
    }
  }
  // spire tips: pointed (cone-like) with a slightly rounded summit and a skewed side
  const tipAt = (x) => { let m = 0; for (const t of tips) { const d = (x - t.x) / t.hw; const q = Math.abs(d) * (1 + t.sk * Math.sign(d)); if (q < 1) m = Math.max(m, t.h * Math.pow(1 - q * q, 0.8) * Math.pow(1 - q, 0.4)); } return m; };
  const cont = [];
  for (let i = 0; i < raw.length; i++) {
    const [x, y] = raw[i];
    cont.push([x, y - tipAt(x) + nz.n2(x / (9 * sc), 3.1) * 1.4 * sc + nz.n2(x / (3.5 * sc), 7.7) * 0.6 * sc]);
  }
  const x0 = cont[0][0], x1 = cont[cont.length - 1][0];
  let ymin = 1e9;
  for (const p of cont) ymin = Math.min(ymin, p[1]);
  const base = o.base;
  const H = base - ymin;
  const fadeY = o.fade == null ? mix(ymin, base, 0.5) : o.fade <= 1 ? mix(ymin, base, o.fade) : o.fade;
  const [spL, spR] = o.splay || [20, 20];
  const topY = (x) => {
    if (x < x0 || x > x1) return 1e9;
    let lo = 0, hi = cont.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cont[m][0] < x) lo = m; else hi = m; }
    const a = cont[lo], b = cont[hi];
    return mix(a[1], b[1], (x - a[0]) / Math.max(1e-6, b[0] - a[0]));
  };
  // sides: from the shoulders straight down, spreading out, with a slight wobble
  const yL = cont[0][1], yR = cont[cont.length - 1][1];
  const sideX = (side, y) => {
    if (side < 0) return x0 - spL * clamp((y - yL) / Math.max(1, base - yL)) + nz.n2(1.7, y / 40) * 4 * sc;
    return x1 + spR * clamp((y - yR) / Math.max(1, base - yR)) + nz.n2(5.3, y / 40) * 4 * sc;
  };
  const poly = [];
  for (let y = base + 8; y > yL; y -= 6) poly.push([sideX(-1, y), y]);
  for (const p of cont) poly.push(p);
  for (let y = yR + 6; y <= base + 8; y += 6) poly.push([sideX(1, y), y]);
  const path = new Path2D();
  path.moveTo(poly[0][0], poly[0][1]);
  for (const p of poly) path.lineTo(p[0], p[1]);
  path.closePath();
  const inside = (x, y) => {
    if (y > base + 8) return false;
    if (x >= x0 && x <= x1) return y >= topY(x);
    if (x < x0) return y > yL && x >= sideX(-1, y);
    return y > yR && x <= sideX(1, y);
  };
  const surfY = (x) => (x >= x0 && x <= x1 ? topY(x) : x < x0 ? yL : yR);
  // ---- faces (lit spindles)
  let faces = o.faces;
  if (!faces) {
    faces = [];
    for (let i = 1; i < cont.length - 1; i += 2) {
      const p = cont[i];
      if (p[1] <= cont[Math.max(0, i - 8)][1] && p[1] <= cont[Math.min(cont.length - 1, i + 8)][1] && p[1] < mix(ymin, base, 0.35)) {
        if (faces.length && Math.abs(faces[faces.length - 1].x - p[0]) < 30 * sc) continue;
        faces.push({ x: p[0] + 6 * sc, y: p[1] + 8 * sc, w: 34 * sc + rng() * 30 * sc, len: (base - p[1]) * 0.7, lean: (rng() - 0.5) * 0.08 });
      }
    }
  }
  const F = faces.map((f) => ({ lean: 0, ...f }));
  const faceGeom = (f, y) => {
    const v = (y - f.y) / f.len;
    const hw = f.w * 0.5 * Math.pow(clamp(v * (f.blunt ?? 1.7)), f.blunt ? 0.45 : 0.8) * (1 + 0.12 * clamp(v));
    return { v, hw, cx: f.x + f.lean * (y - f.y) + (f.bow ?? 1) * 9 * sc * nz.n2(f.x / 50 + 7, y / (160 * sc)) * clamp(v * 2) };
  };
  // ---- shading field: 0 lit .. 1 dark
  const sideK = o.sideDark ?? 0.2;
  const life = (x, y) => 1 - sstep(fadeY, base, y + nz.n2(x / 70, y / 50 + 3) * 30);
  const shadeAt = (x, y) => {
    const dy = y - surfY(x);
    const xw = x + nz.n2(x / 80, y / 90 + 2) * 12 * sc;
    const band = nz.n2(xw / (46 * sc), 0.37 + y / (900 * sc));
    const crev = 1 - Math.abs(nz.n2(xw / (24 * sc), 5.1 + y / (700 * sc)));
    let s = 0.52 + 0.22 * band * (o.band ?? 1) + 0.18 * nz.fbm2(x / (55 * sc), y / (120 * sc), 2) + 0.4 * sstep(0.8, 0.97, crev) + (o.dark ?? 0) + (o.darkX ? o.darkX[2] * sstep(o.darkX[0], o.darkX[1], x) : 0);
    s += 0.45 * Math.exp(-dy / (42 * sc)) - 0.12 * clamp(dy / H);   // dark under the crown, lighter low down
    s += sideK * (1 - sstep(0, 0.6, (x - x0) / Math.max(1, x1 - x0) + 0.12 * nz.n2(y / (60 * sc), 2.9)));   // light from the right: shadowed left flank
    for (const z of o.zones || []) {   // art-directed value zones [x, y, rx, ry, amount], ragged edges
      const zx = (x - z[0]) / z[2], zy = (y - z[1]) / z[3];
      const d = zx * zx + zy * zy;
      if (d < 4) s += z[4] * sstep(1.15, 0.55, Math.sqrt(d) + 0.35 * nz.fbm2(x / (26 * sc) + 3, y / (34 * sc), 2));
    }
    for (const f of F) {
      if (y < f.y - 2) continue;
      const { v, hw, cx } = faceGeom(f, y);
      if (v > 1.25 || hw < 0.5) continue;
      const d = (x - cx) / hw;
      const fadeOut = sstep(1.25, 0.8, v);
      if (d > -1 && d < 1) {
        const lit = (o.faceLit ?? 0.1) + 0.4 * Math.pow((d + 1) / 2, 1.6) + (0.12 + (o.faceLit ?? 0) * 0.5) * nz.n2(x / 14, y / 40);
        s = mix(s, lit, fadeOut);
      } else if (d <= -1 && d > -1.7) s = mix(s, Math.max(s, o.faceShadow ?? 0.8), fadeOut * (1 - (-1 - d) / 0.7));
    }
    return clamp(s);
  };
  // ---- bake into a local canvas (bbox) then mask with the mist dissolve
  const k = ctx.getTransform().a || 1;
  const bx = Math.floor(Math.min(x0 - spL, ...poly.map((p) => p[0])) - 60 * sc);
  const bx1 = Math.ceil(Math.max(x1 + spR, ...poly.map((p) => p[0])) + 60 * sc);
  const by = Math.floor(ymin - 125 * sc), by1 = Math.ceil(base + 10);
  const bw = bx1 - bx, bh = by1 - by;
  const cv = new OffscreenCanvas(Math.max(1, Math.ceil(bw * k)), Math.max(1, Math.ceil(bh * k)));
  const g = cv.getContext('2d');
  g.setTransform(k, 0, 0, k, -bx * k, -by * k);
  // paper occluder
  g.fillStyle = css(paper);
  g.globalAlpha = 1;
  g.fill(path);
  g.save();
  g.clip(path);
  g.fillStyle = inkCss;
  // flat light base wash so the rock is never bare paper except on lit faces
  g.globalAlpha = o.baseWash ?? 0.2;
  g.fill(path);
  const sample = () => {
    for (let tries = 0; tries < 6; tries++) {
      const x = mix(bx + 40 * sc, bx1 - 40 * sc, rng());
      const sy = surfY(x);
      const y = sy + Math.pow(rng(), 1.25) * (base - sy);
      if (inside(x, y)) return [x, y];
    }
    return null;
  };
  // wet body: translucent vertical blots (soft, merging), painted on their own layer and blurred
  const area = ((x1 - x0) + (spL + spR) * 0.5) * H;
  const wc = new OffscreenCanvas(cv.width, cv.height);
  const w = wc.getContext('2d');
  w.setTransform(k, 0, 0, k, -bx * k, -by * k);
  w.fillStyle = inkCss;
  const WB = buckets([0.06, 0.1, 0.14, 0.18, 0.23, 0.29, 0.36, 0.44, 0.55, 0.7]);
  const MB = buckets([0.2, 0.32, 0.45, 0.58, 0.7, 0.82, 0.95]);
  const FB = buckets([0.3, 0.45, 0.6, 0.75, 0.9]);
  const nS = Math.round(area / (45 * sc * sc) * (o.wash ?? 1) * (o.blots ?? 0.45));
  for (let i = 0; i < nS; i++) {
    const q = sample(); if (!q) continue;
    const [x, y] = q;
    const s = shadeAt(x, y) * life(x, y);
    if (rng() > s * 1.25) continue;
    const r = (5 + rng() * 11) * sc;
    let lean = (rng() - 0.5) * 0.15;
    for (const f of F) if (Math.abs(x - f.x) < f.w) lean = f.lean + (rng() - 0.5) * 0.08;
    dab(WB, x, y, r, (0.08 + 0.36 * s * s) * (o.washAlpha ?? 1), rng, 0.2 + rng() * 0.16, Math.PI / 2 + lean, 0.4);
  }
  // shadow crevice beside each face's dark contour
  for (const f of F) {
    for (let i = 0; i < 70 * (o.crevice ?? 1); i++) {
      const v = Math.pow(rng(), 1.3) * 0.95;
      const y = f.y + v * f.len;
      const G = faceGeom(f, y);
      const x = G.cx - G.hw - (2 + rng() * 10) * sc;
      dab(WB, x, y, (3 + rng() * 6) * sc, (0.15 + 0.3 * rng()) * life(x, y) * (1 - v * 0.6), rng, 0.4, Math.PI / 2 + f.lean, 0.45);
    }
  }
  g.fillStyle = inkCss;
  // moss / foliage dabs in clusters, patchy
  const nD = Math.round(area / (18 * sc * sc) * (o.moss ?? 1) * 0.4);
  for (let i = 0; i < nD; i++) {
    const q = sample(); if (!q) continue;
    const [x, y] = q;
    const s = shadeAt(x, y) * life(x, y);
    const patch = sstep(-0.3, 0.4, nz.fbm2(x / (17 * sc) + 11, y / (52 * sc), 2));
    if (rng() > sstep(0.5, 0.92, s) * (0.15 + 0.85 * patch) * 1.4) continue;
    const r = (1.1 + rng() * 2.6) * sc * (0.7 + 0.5 * s);
    const n = 2 + ((rng() * 4) | 0);
    const a = (0.3 + rng() * 0.6) * (0.4 + 0.6 * s);
    const wetD = rng() < 0.15;
    for (let j = 0; j < n; j++) {
      const ox = (rng() - 0.5) * r * 1.6, oy = (rng() - 0.5) * r * 3.2;
      dab(wetD ? WB : MB, x + ox, y + oy, r * (0.45 + rng() * 0.55) * (wetD ? 1.5 : 1), a * (0.7 + rng() * 0.5), rng, 0.5 + rng() * 0.3, Math.PI / 2 + (rng() - 0.5) * 0.7, 0.45);
    }
  }
  for (let i = 1; i < tips.length; i++) {
    const nx = (tips[i - 1].x + tips[i - 1].hw * 0.6 + tips[i].x - tips[i].hw * 0.6) / 2;
    if (rng() > 0.75 * (o.crevs ?? 1)) continue;
    const ny = topY(nx);
    const len = (18 + Math.pow(rng(), 2) * 90) * sc;
    const ln = (rng() - 0.5) * 0.12;
    const pts = [];
    for (let j = 0; j <= 8; j++) { const yy = ny + 2 * sc + (len * j) / 8; pts.push([nx + ln * (yy - ny) + nz.n2(nx, yy / 30) * 2.5 * sc, yy]); }
    const lf = life(nx, ny + len * 0.3);
    ribbon(g, pts, (2.2 + rng() * 2.4) * sc, (0.35 + rng() * 0.3) * lf, rng, 0.8, 'taper');
    for (let j = 0; j < 10; j++) { const p = pts[(rng() * 6) | 0]; dab(WB, p[0] - (2 + rng() * 7) * sc, p[1] + rng() * len * 0.15, (2.5 + rng() * 5) * sc, (0.12 + rng() * 0.25) * lf, rng, 0.4, Math.PI / 2, 0.45); }
  }
  flush(w, WB);
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.filter = `blur(${(1.6 * sc * k).toFixed(2)}px)`;
  g.drawImage(wc, 0, 0);
  g.restore();
  // cun texture + continuous shade wash in one pass: long thin thresholded streaks (hemp-fibre cun)
  // whose coverage grows with the shade field, over a soft wash streaked the same way. Inside a face
  // the texture x is face-relative, so strokes fan out with the spindle and lean with it.
  {
    const cs = 6, gw = Math.ceil(bw / cs) + 2, gh = Math.ceil(bh / cs) + 2;
    const S = new Float32Array(gw * gh), T = new Float32Array(gw * gh).fill(2), W = new Float32Array(gw * gh);
    const tex0 = o.tex ?? 1;
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const x = bx + i * cs, y = by + j * cs, m = j * gw + i;
      const sv = inside(x, y) || inside(x, y - cs) ? shadeAt(x, y) * life(x, y) : 0;
      S[m] = sv;
      if (sv > 0.04) T[m] = mix(1.3, -0.6, sstep(0.3, 0.95, sv * tex0)) + 0.3 * nz.n2(x / (70 * sc) + 2.2, y / (90 * sc) + 7.1);
      let off = nz.n2(x / 90, y / 120 + 9) * 2.5 * sc + nz.n2(x / 260, y / 180 + 4) * 9 * sc, wb = 0;
      for (const f of F) {
        if (y < f.y - 2) continue;
        const G = faceGeom(f, y);
        if (G.v > 1.3 || G.hw < 1) continue;
        const d = (x - G.cx) / G.hw;
        if (d < -1.8 || d > 1.8) continue;
        const wf = sstep(1.8, 1.1, Math.abs(d)) * sstep(1.3, 0.9, G.v);
        if (wf <= wb) continue;
        wb = wf;
        const kf = Math.min(f.w * 0.5 / G.hw, 2.5);
        off = mix(off, f.x + (x - G.cx) * kf - x, wf);
      }
      W[m] = off;
    }
    const ds = o.texDs ?? (sc >= 1.3 ? 1.25 : sc >= 1.1 ? 1.5 : 2);
    const tw = Math.ceil(bw / ds), th = Math.ceil(bh / ds);
    const tc = new OffscreenCanvas(tw, th);
    const tg = tc.getContext('2d');
    const im = tg.createImageData(tw, th);
    const D = im.data;
    const ic = dil(paper, tone);
    const ts = o.texScale ?? 1;
    const fx = 1 / (3.2 * sc * ts), fy = 1 / (60 * sc * ts), gx = 1 / (8 * sc * ts), gy = 1 / (22 * sc * ts), hx = 1 / (1.8 * sc * ts), hy = 1 / (9 * sc * ts);
    const wk = o.shadeWash ?? 0.45, lk = o.lines ?? 1;
    const lx = 1 / (10 * sc * ts), ly = 1 / (75 * sc * ts), bxF = 1 / (14 * sc * ts), byF = 1 / (90 * sc * ts);
    for (let j = 0; j < th; j++) {
      const y = by + j * ds;
      const gyf = (y - by) / cs, gj = Math.min(gh - 2, gyf | 0), fy2 = gyf - gj;
      for (let i = 0; i < tw; i++) {
        const x = bx + i * ds;
        const gxf = (x - bx) / cs, gi = Math.min(gw - 2, gxf | 0), fx2 = gxf - gi;
        const o0 = gj * gw + gi;
        const s = mix(mix(S[o0], S[o0 + 1], fx2), mix(S[o0 + gw], S[o0 + gw + 1], fx2), fy2);
        if (s < 0.06) continue;
        const t0 = mix(mix(T[o0], T[o0 + 1], fx2), mix(T[o0 + gw], T[o0 + gw + 1], fx2), fy2);
        const xw = x + mix(mix(W[o0], W[o0 + 1], fx2), mix(W[o0 + gw], W[o0 + gw + 1], fx2), fy2);
        const aw = wk * sstep(0.12, 1.0, s) * (0.65 + 0.35 * nz.n2(xw / (12 * sc) + 4.4, y / (90 * sc)));
        let at = 0;
        if (t0 < 0.95) {
          const q = 0.55 * nz.n2(xw * fx + 31.7, y * fy) + 0.3 * nz.n2(xw * gx + 5.1, y * gy + 3.3) + 0.15 * nz.n2(xw * hx + 9.9, y * hy + 1.7);
          at = sstep(t0 - 0.12, t0 + 0.12, q) * (0.2 + 0.75 * s);
        }
        // fibre lines: zero crossings of a stretched noise are long continuous strokes; a second noise
        // breaks them into strokes of varying length, line width grows with the shade
        const wl = 0.045 + 0.13 * s;
        const n1 = Math.abs(nz.n2(xw * lx + 3.7, y * ly + 8.1));
        let al = 0;
        if (n1 < wl) al = sstep(wl, wl * 0.35, n1) * sstep(-0.25, 0.35, nz.n2(xw * bxF + 1.3, y * byF + 6.6)) * (0.22 + 0.6 * s) * lk;
        const a = 1 - (1 - at) * (1 - aw) * (1 - al);
        if (a < 0.01) continue;
        const p = (j * tw + i) * 4;
        D[p] = ic[0]; D[p + 1] = ic[1]; D[p + 2] = ic[2]; D[p + 3] = (a * 255) | 0;
      }
    }
    tg.putImageData(im, 0, 0);
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = o.texAlpha ?? 0.85;
    g.imageSmoothingEnabled = true;
    g.drawImage(tc, 0, 0, tw, th, 0, 0, tw * ds * k, th * ds * k);
    g.restore();
  }
  // foliage zones (z[5] = density): clusters of crisp leaf blotches with paper gaps
  for (const z of o.zones || []) {
    if (!(z[5] > 0)) continue;
    const nb = Math.round(z[2] * z[3] / (14 * sc * sc) * z[5]);
    for (let i = 0; i < nb; i++) {
      const ang = rng() * 6.2832, rr = Math.sqrt(rng()) * 1.1;
      const x = z[0] + Math.cos(ang) * rr * z[2], y = z[1] + Math.sin(ang) * rr * z[3];
      const p = sstep(-0.3, 0.25, nz.fbm2(x / (22 * sc) + 17, y / (22 * sc), 2)) * sstep(1.0, 0.5, rr);
      if (rng() > p) continue;
      const r = (2 + Math.pow(rng(), 1.5) * 6) * sc;
      const nn = 2 + ((rng() * 3) | 0);
      for (let j = 0; j < nn; j++) dab(MB, x + (rng() - 0.5) * r * 2.2, y + (rng() - 0.5) * r * 1.6, r * (0.5 + rng() * 0.6), 0.55 + rng() * 0.4, rng, 0.35 + rng() * 0.3, rng() * 3.14, 0.6);
    }
  }
  // crisp face contours: broken dark strokes on the shadow side of the upper face, short fissures
  for (const f of F) {
    const N = 26;
    const edge = (u, v0, v1) => {
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const v = mix(v0, v1, i / N);
        const y = f.y + v * f.len;
        const G = faceGeom(f, y);
        pts.push([G.cx + u * G.hw + nz.n2(u * 3 + f.x, y / 25) * 1.2 * sc, y]);
      }
      return pts;
    };
    // shadow contour in 2-3 segments
    let v = 0;
    const vEnd = Math.min(0.6, 160 * sc / f.len);
    while (v < vEnd) {
      const len = Math.min(0.06 + rng() * 0.14, 70 * sc / f.len);
      const v1 = Math.min(vEnd, v + len);
      const pts = edge(-1, v, v1).filter((p) => p[1] < fadeY + (base - fadeY) * 0.5);
      if (pts.length > 3) ribbon(g, pts, (3 + rng() * 3) * sc * (1.3 - v), (0.8 - v * 0.5) * (o.contour ?? 1), rng, 0.9);
      v = v1 + 0.04 + rng() * 0.12;
    }
    if (rng() < 0.6) {
      const u = -0.5 + rng() * 1.2, v0 = 0.08 + rng() * 0.3;
      ribbon(g, edge(u, v0, v0 + Math.min(0.08 + rng() * 0.12, 50 * sc / f.len)), (1 + rng() * 1.2) * sc, 0.3 + rng() * 0.2, rng, 0.7);
    }
  }
  // dark crown band: dense foliage clumps hugging the top contour
  const nC = Math.round((x1 - x0) / (1.2 * sc) * (o.crown ?? 1));
  for (let i = 0; i < nC; i++) {
    const x = mix(x0, x1, rng());
    const ty = topY(x);
    const dpt = Math.pow(rng(), 1.6) * 34 * sc;
    const r = (2.5 + rng() * 5) * sc;
    dab(MB, x, ty + dpt + r * 0.3, r, 0.35 + rng() * 0.5, rng, 0.6, (rng() - 0.5) * 0.4, 0.5);
  }
  g.fillStyle = inkCss;
  flush(g, MB);
  g.restore();
  // foliage masses along polylines: dense dark clumps hanging from ridges and ledges
  g.fillStyle = inkCss;
  for (const fo of o.foliage || []) {
    const fp = smoothPath(fo.pts, 3);
    const fr = (fo.r ?? 6) * sc, dens = fo.dens ?? 1, hang = fo.hang ?? 18 * sc;
    for (let i = 0; i < fp.length; i++) {
      const gate = sstep(-0.55, 0.35, nz.n2(fp[i][0] / (45 * sc), fp[i][1] / (45 * sc) + 7));
      const n = Math.round((1 + rng() * 2) * dens * gate * 1.4);
      for (let j = 0; j < n; j++) {
        const dy = Math.pow(rng(), 1.8) * hang - fr * 0.3;
        const r = fr * (0.35 + rng() * 0.75) * (1 - 0.4 * dy / Math.max(1, hang));
        dab(FB, fp[i][0] + (rng() - 0.5) * fr * 2.2, fp[i][1] + dy, r, (0.45 + rng() * 0.5) * (fo.alpha ?? 1), rng, 0.55 + rng() * 0.3, (rng() - 0.5) * 0.8, 0.5);
      }
    }
  }
  g.fillStyle = inkCss;
  flush(g, FB);
  // trees: few, larger, soft Huangshan pines clustered on summits (wet bodies blurred, crisp needles)
  const trees = [];
  for (const fo of o.foliage || []) {
    if (!fo.trees) continue;
    const fp = smoothPath(fo.pts, 3);
    const [th0, th1] = fo.treeH || [24 * sc, 56 * sc];
    for (let d = rng() * 20; d < fp.length; d += Math.max(3, Math.round((th1 * 0.6) / fo.trees / 3 * (0.5 + rng())))) {
      const p = fp[Math.min(fp.length - 1, d | 0)];
      const h = mix(th0, th1, Math.pow(rng(), 0.8));
      trees.push({ x: p[0] + (rng() - 0.5) * 8, y: p[1] + h * 0.25, h, lean: fo.lean, wide: fo.wide });
    }
  }
  for (const p of o.pines || []) trees.push({ x: p[0], y: p[1], h: p[2], lean: p[3], wide: p[4] });   // explicit [x, y, h, lean, wide]
  const [h0, h1] = o.treeH || [22 * sc, 52 * sc];
  const tk = o.trees ?? 1;
  if (tk > 0) {
    const cx = (x) => clamp(x, x0, x1);
    let x = x0 + rng() * 20;
    while (x < x1) {
      const ty = topY(x);
      const nb = Math.max(topY(cx(x - 35 * sc)), topY(cx(x + 35 * sc)));
      const summit = clamp((nb - ty) / (16 * sc));
      const clump = sstep(-0.5, 0.2, nz.n2(x / 75, 13.3));
      let step = h1 * (0.35 + 0.4 * rng());
      if (rng() < (0.75 + 0.25 * summit) * clump * Math.min(1, tk)) {
        const h = mix(h0, h1, Math.pow(rng(), 0.75)) * (0.8 + 0.35 * summit) * (rng() < 0.15 ? 1.45 : 1);
        trees.push({ x: x + (rng() - 0.5) * 8, y: ty + h * mix(0.1, 0.3, rng()), h });
        if (rng() < 0.8 * tk) trees.push({ x: x + (rng() - 0.5) * h * 0.9, y: ty + h * mix(0.45, 0.9, rng()), h: h * mix(0.55, 0.8, rng()) });
        if (rng() < 0.45 * tk) trees.push({ x: x + (rng() - 0.5) * h * 1.2, y: ty + h * mix(0.35, 0.8, rng()), h: h * mix(0.5, 0.75, rng()) });
        step = h * (0.28 + 0.35 * rng());
      }
      x += step / Math.sqrt(Math.max(0.3, tk));
    }
    for (const L of o.ledges || []) {
      for (let i = 0; i < (L[2] ?? 3); i++) { const h = mix(h0, h1, rng()) * 0.8; trees.push({ x: L[0] + (rng() - 0.5) * h * 1.2, y: L[1] + rng() * h * 0.3, h }); }
    }
  }
  if (trees.length) {
    trees.sort((a, b) => a.y - b.y);
    const tcv = new OffscreenCanvas(cv.width, cv.height);
    const tw = tcv.getContext('2d');
    tw.setTransform(k, 0, 0, k, -bx * k, -by * k);
    const tc = dil(paper, treeTone);
    tw.fillStyle = css(tc);
    g.fillStyle = css(tc);
    for (const t of trees) {
      paintSoftPine(g, tw, t.x, t.y, t.h, { ink: css(tc), lean: t.lean, width: (1 + rng() * 0.45) * (t.wide ?? 1), tiers: t.wide ? 3 : undefined, wetA: o.treeWet ?? 1 }, api.rng('sp:' + seed + ':' + t.x.toFixed(1)));
    }
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.filter = `blur(${(1.4 * sc * k).toFixed(2)}px)`;
    g.drawImage(tcv, 0, 0);
    g.restore();
  }
  // ---- mist dissolve mask
  const ds = 3;
  const mw = Math.ceil(bw / ds) + 1, mh = Math.ceil(bh / ds) + 1;
  const mc = new OffscreenCanvas(mw, mh);
  const mg = mc.getContext('2d');
  const img = mg.createImageData(mw, mh);
  const span = Math.max(1, base - fadeY);
  const msc = o.mistScale ?? 40 * sc;
  for (let j = 0; j < mh; j++) {
    const y = by + j * ds;
    const gy = clamp((base - y) / span);
    for (let i = 0; i < mw; i++) {
      let a;
      if (gy >= 1) a = 1; else if (gy <= 0) a = 0;
      else {
        const x = bx + i * ds;
        const b = 1 - Math.abs(nz.fbm2(x / (msc * 1.4) + 40, y / (msc * 0.8), 3));
        const n = 0.2 + 0.55 * b + 0.15 * nz.n2(x / (msc * 4) + 9, y / (msc * 3));
        a = sstep(n - 0.3, n + 0.3, Math.pow(gy, 0.75));
      }
      img.data[(j * mw + i) * 4 + 3] = (a * 255) | 0;
    }
  }
  mg.putImageData(img, 0, 0);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'destination-in';
  g.imageSmoothingEnabled = true;
  g.drawImage(mc, 0, 0, mw, mh, 0, 0, mw * ds * k, mh * ds * k);
  const ga = ctx.globalAlpha;
  ctx.globalAlpha = 1;
  ctx.drawImage(cv, bx, by, cv.width / k, cv.height / k);
  ctx.globalAlpha = ga;
  return { bbox: [bx, by, bx1, by1], topY, faces: F };
}

// Bake several massifs (back to front) into one card, finished with the wet-ink pass.
export function bakeMassifs(api, rect, list, { scale = 1, wet = null, wetInk } = {}) {
  const src = api.bakeCanvas(rect[2], rect[3], (ctx) => {
    ctx.translate(-rect[0], -rect[1]);
    for (const m of list) paintMassif(ctx, api, m);
  }, { scale });
  const card = wetInk ? wetInk(api, src, { soft: 1.1, blur: 0.3, bleed: 0.25, edge: 0.45, granulation: 0.18, mottle: 0.3, ...(wet || {}) }) : src;
  if (card !== src) api.engine?.freeTex?.(src);
  return card;
}
