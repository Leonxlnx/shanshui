// s04 helper: Huangshan granite massifs painted like ref 04.
// A massif is a silhouette given by its top contour (summits, left to right); its sides drop to
// the mist line. Inside: lit spindle faces (pale, with a crisp dark contour on the shadow side and
// a few fissures), mottled shadow masses built from translucent vertical strokes and clustered moss
// dabs (darkest under the crown and in the crevices), ridge conifers along the top, and a billowy
// dissolve into mist at the base. Painted in colour (paper occluder + diluted ink), finish the bake
// with peaks.wetInk.
import { paintConifer } from '../../lib/pine.js';
import { smoothPath, PAPER } from '../../lib/brush.js';

const INKC = [14, 12, 9];
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const dil = (paper, t) => INKC.map((c, i) => Math.round(mix(c, paper[i], clamp(t))));
const css = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

function dab(g, x, y, r, a, rng, squash = 0.8, rot = null, irr = 0.35) {
  if (a <= 0.004 || r <= 0.1) return;
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
  g.globalAlpha = Math.min(1, a);
  g.beginPath();
  g.moveTo((px[n - 1] + px[0]) / 2, (py[n - 1] + py[0]) / 2);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; g.quadraticCurveTo(px[i], py[i], (px[i] + px[j]) / 2, (py[i] + py[j]) / 2); }
  g.fill();
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
      tips.push({ x: tx + w * 0.5, hw: w * (0.55 + rng() * 0.25), h: (5 + Math.pow(rng(), 1.5) * 22) * sc * tipK * (0.35 + 0.65 * edge) });
      tx += w * (0.75 + rng() * 0.35);
    }
  }
  const tipAt = (x) => { let m = 0; for (const t of tips) { const q = Math.abs(x - t.x) / t.hw; if (q < 1) m = Math.max(m, t.h * Math.pow(1 - q * q, 0.9) * (1 - 0.35 * q)); } return m; };
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
    const hw = f.w * 0.5 * Math.pow(clamp(v * 1.7), 0.8) * (1 + 0.12 * clamp(v));
    return { v, hw, cx: f.x + f.lean * (y - f.y) };
  };
  // ---- shading field: 0 lit .. 1 dark
  const life = (x, y) => 1 - sstep(fadeY, base, y + nz.n2(x / 70, y / 50 + 3) * 30);
  const shadeAt = (x, y) => {
    const dy = y - surfY(x);
    const xw = x + nz.n2(x / 80, y / 90 + 2) * 12 * sc;
    const band = nz.n2(xw / (46 * sc), 0.37 + y / (900 * sc));
    const crev = 1 - Math.abs(nz.n2(xw / (24 * sc), 5.1 + y / (700 * sc)));
    let s = 0.52 + 0.22 * band + 0.18 * nz.fbm2(x / (55 * sc), y / (120 * sc), 2) + 0.4 * sstep(0.8, 0.97, crev) + (o.dark ?? 0) + (o.darkX ? o.darkX[2] * sstep(o.darkX[0], o.darkX[1], x) : 0);
    s += 0.45 * Math.exp(-dy / (42 * sc)) - 0.12 * clamp(dy / H);   // dark under the crown, lighter low down
    for (const f of F) {
      if (y < f.y - 2) continue;
      const { v, hw, cx } = faceGeom(f, y);
      if (v > 1.25 || hw < 0.5) continue;
      const d = (x - cx) / hw;
      const fadeOut = sstep(1.25, 0.8, v);
      if (d > -1 && d < 1) {
        const lit = 0.1 + 0.4 * Math.pow((d + 1) / 2, 1.6) + 0.12 * nz.n2(x / 14, y / 40);
        s = mix(s, lit, fadeOut);
      } else if (d <= -1 && d > -1.9) s = mix(s, Math.max(s, 0.92), fadeOut * (1 - (-1 - d) / 0.9));
    }
    return clamp(s);
  };
  // ---- bake into a local canvas (bbox) then mask with the mist dissolve
  const k = ctx.getTransform().a || 1;
  const bx = Math.floor(Math.min(x0 - spL, ...poly.map((p) => p[0])) - 60 * sc);
  const bx1 = Math.ceil(Math.max(x1 + spR, ...poly.map((p) => p[0])) + 60 * sc);
  const by = Math.floor(ymin - 90 * sc), by1 = Math.ceil(base + 10);
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
  const nS = Math.round(area / (45 * sc * sc) * (o.wash ?? 1));
  for (let i = 0; i < nS; i++) {
    const q = sample(); if (!q) continue;
    const [x, y] = q;
    const s = shadeAt(x, y) * life(x, y);
    if (rng() > s * 1.25) continue;
    const r = (4 + rng() * 9) * sc;
    let lean = (rng() - 0.5) * 0.15;
    for (const f of F) if (Math.abs(x - f.x) < f.w) lean = f.lean + (rng() - 0.5) * 0.08;
    dab(w, x, y, r, (0.08 + 0.36 * s * s) * (o.washAlpha ?? 1), rng, 0.32 + rng() * 0.2, Math.PI / 2 + lean, 0.4);
  }
  // shadow crevice beside each face's dark contour
  for (const f of F) {
    for (let i = 0; i < 70 * (o.crevice ?? 1); i++) {
      const v = Math.pow(rng(), 1.3) * 0.95;
      const y = f.y + v * f.len;
      const G = faceGeom(f, y);
      const x = G.cx - G.hw - (2 + rng() * 10) * sc;
      dab(w, x, y, (3 + rng() * 6) * sc, (0.15 + 0.3 * rng()) * life(x, y) * (1 - v * 0.6), rng, 0.4, Math.PI / 2 + f.lean, 0.45);
    }
  }
  g.fillStyle = inkCss;
  // moss / foliage dabs in clusters, patchy
  const nD = Math.round(area / (18 * sc * sc) * (o.moss ?? 1));
  for (let i = 0; i < nD; i++) {
    const q = sample(); if (!q) continue;
    const [x, y] = q;
    const s = shadeAt(x, y) * life(x, y);
    const patch = sstep(-0.3, 0.4, nz.fbm2(x / (17 * sc) + 11, y / (52 * sc), 2));
    if (rng() > Math.pow(s, 2.2) * (0.15 + 0.85 * patch) * 1.4) continue;
    const r = (1.3 + rng() * 3.2) * sc * (0.7 + 0.5 * s);
    const n = 2 + ((rng() * 4) | 0);
    const a = (0.2 + rng() * 0.6) * (0.4 + 0.6 * s);
    const wetD = rng() < 0.5;
    for (let j = 0; j < n; j++) {
      const ox = (rng() - 0.5) * r * 1.6, oy = (rng() - 0.5) * r * 3.2;
      dab(wetD ? w : g, x + ox, y + oy, r * (0.45 + rng() * 0.55) * (wetD ? 1.5 : 1), a * (0.7 + rng() * 0.5), rng, 0.5 + rng() * 0.3, Math.PI / 2 + (rng() - 0.5) * 0.7, 0.45);
    }
  }
  for (let i = 1; i < tips.length; i++) {
    const nx = (tips[i - 1].x + tips[i - 1].hw * 0.6 + tips[i].x - tips[i].hw * 0.6) / 2;
    if (rng() > 0.75 * (o.crevs ?? 1)) continue;
    const ny = topY(nx);
    const len = (30 + Math.pow(rng(), 1.5) * 200) * sc;
    const ln = (rng() - 0.5) * 0.12;
    const pts = [];
    for (let j = 0; j <= 8; j++) { const yy = ny + 2 * sc + (len * j) / 8; pts.push([nx + ln * (yy - ny) + nz.n2(nx, yy / 30) * 2.5 * sc, yy]); }
    const lf = life(nx, ny + len * 0.3);
    ribbon(g, pts, (1.6 + rng() * 2.2) * sc, (0.45 + rng() * 0.35) * lf, rng, 0.8, 'taper');
    for (let j = 0; j < 10; j++) { const p = pts[(rng() * 6) | 0]; dab(w, p[0] - (2 + rng() * 7) * sc, p[1] + rng() * len * 0.15, (2.5 + rng() * 5) * sc, (0.12 + rng() * 0.25) * lf, rng, 0.4, Math.PI / 2, 0.45); }
  }
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.filter = `blur(${(1.6 * sc * k).toFixed(2)}px)`;
  g.drawImage(wc, 0, 0);
  g.restore();  // crisp face contours: dark broken line on the shadow side, faint on the lit side, fissures
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
    while (v < 0.95) {
      const len = 0.1 + rng() * 0.25;
      const v1 = Math.min(1.05, v + len);
      const pts = edge(-1, v, v1).filter((p) => p[1] < fadeY + (base - fadeY) * 0.5);
      if (pts.length > 3) ribbon(g, pts, (2.4 + rng() * 2.6) * sc * (1.35 - v * 0.9), (0.85 - v * 0.35) * (o.contour ?? 1), rng, 0.7);
      v = v1 + 0.03 + rng() * 0.15;
    }
    const pr = edge(1, 0.05, 0.7 + rng() * 0.3);
    ribbon(g, pr, 1.1 * sc, 0.25 * (o.contour ?? 1), rng, 0.6);
    const nf = 1 + ((rng() * 3) | 0);
    for (let i = 0; i < nf; i++) {
      const u = -0.5 + rng() * 1.2, v0 = 0.1 + rng() * 0.4;
      ribbon(g, edge(u, v0, v0 + 0.15 + rng() * 0.35), (0.7 + rng() * 0.9) * sc, 0.28 + rng() * 0.2, rng, 0.7);
    }
  }
  // dark crown band: dense foliage clumps hugging the top contour
  const nC = Math.round((x1 - x0) / (1.2 * sc) * (o.crown ?? 1));
  for (let i = 0; i < nC; i++) {
    const x = mix(x0, x1, rng());
    const ty = topY(x);
    const dpt = Math.pow(rng(), 1.6) * 34 * sc;
    const r = (2.5 + rng() * 5) * sc;
    dab(g, x, ty + dpt + r * 0.3, r, 0.35 + rng() * 0.5, rng, 0.6, (rng() - 0.5) * 0.4, 0.5);
  }
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
        dab(g, fp[i][0] + (rng() - 0.5) * fr * 2.2, fp[i][1] + dy, r, (0.45 + rng() * 0.5) * (fo.alpha ?? 1), rng, 0.55 + rng() * 0.3, (rng() - 0.5) * 0.8, 0.5);
      }
    }
    if (fo.trees) {
      const [th0, th1] = fo.treeH || [24 * sc, 56 * sc];
      for (let d = rng() * 20; d < fp.length; d += Math.max(2, Math.round((th1 * 0.35) / fo.trees / 3 * (0.5 + rng())))) {
        const p = fp[Math.min(fp.length - 1, d | 0)];
        const h = mix(th0, th1, rng());
        const u = rng();
        paintConifer(g, p[0] + (rng() - 0.5) * 8, p[1] + h * 0.2, h, { kind: u < 0.7 ? 'pine' : 'fir', tone: clamp(treeTone + (rng() - 0.5) * 0.06), lean: fo.lean ?? (rng() - 0.5) * 16, width: 0.9 + rng() * 0.4, paper, rng: api.rng('ftree:' + seed + ':' + d) });
      }
    }
  }
  g.fillStyle = inkCss;
  // ridge conifers along the top contour and the upper shoulders
  const [h0, h1] = o.treeH || [22 * sc, 52 * sc];
  const tk = o.trees ?? 1;
  if (tk > 0) {
    const trees = [];
    let x = x0 + rng() * 10;
    while (x < x1) {
      const clumpN = nz.n2(x / 90, 13.3) + 0.6 * tipAt(x) / (14 * sc) - 0.3;
      if (clumpN > -0.35 || rng() < 0.12) {
        const h = mix(h0, h1, Math.pow(rng(), 0.9)) * (0.85 + 0.3 * (clumpN + 1) / 2);
        trees.push({ x: x + (rng() - 0.5) * 6, y: topY(x) + h * mix(0.12, 0.35, rng()), h, back: rng() < 0.35 });
      }
      x += (h1 * 0.26) / tk * (0.5 + rng());
    }
    for (const L of o.ledges || []) {
      for (let i = 0; i < (L[2] ?? 3); i++) { const h = mix(h0, h1, rng()) * 0.8; trees.push({ x: L[0] + (rng() - 0.5) * h * 1.2, y: L[1] + rng() * h * 0.3, h, back: false }); }
    }
    trees.sort((a, b) => (b.back - a.back) || (a.y - b.y));
    for (const t of trees) {
      const u = rng();
      paintConifer(g, t.x, t.y, t.h, {
        kind: u < 0.6 ? 'fir' : u < 0.82 ? 'spruce' : 'pine', tone: clamp(treeTone + (t.back ? 0.12 : 0) + (rng() - 0.5) * 0.06),
        lean: (rng() - 0.5) * 10, width: 0.85 + rng() * 0.35, paper, rng: api.rng('tree:' + seed + ':' + t.x.toFixed(1)),
      });
    }
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
