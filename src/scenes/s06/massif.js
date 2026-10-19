// s06 snowy peaks, painted for ref 06 (replaces the snowified lib/peaks cards):
// a crisp, jagged silhouette; white faces carved by long fold strokes that fan out from the
// summits (hemp-fibre striations); a grey wash on the shadow side (right, light from the left)
// of every fold and spur; dark tree clumps on the ridges and down the shadow flanks, with
// snow on their tiers; and a base that dissolves into the cloud sea.
//
// bakeSnowPeaks(api, rect, peaks, { seed, scale }) -> { src, rect, layer(lo) }
// peak: {
//   ridge: [[x, y], ...]       silhouette, left to right (design px)
//   base, fadeH                the body fades out from y = base over fadeH px (lumpy)
//   summits: [[x, y], ...]     fold strokes fan out around the nearest summit (default: the highest ridge point)
//   spurs: [[x, y, ang, len, w], ...]  major ridges: ang from vertical (+ = down-right), w = wash width
//   folds                      fold-stroke density (1)
//   clumps: [[x, y, r, n, h], ...]     dark tree clumps (centre, radius, count, tree height)
//   ridgeTrees                 0..1 trees poking above the silhouette
//   tone                       0 = full ink .. 1 = paper (aerial perspective)
//   shadow                     overall wash strength (1)
// }
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function rngOf(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const PAPER = [240, 234, 226];
const SNOW = [248, 247, 244];

function jag(pts, rng, rough, minSeg) {
  let P = pts.map((p) => [p[0], p[1]]);
  for (let it = 0; it < 7; it++) {
    const Q = [P[0]];
    let changed = false;
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1], b = P[i];
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
      if (L > minSeg) {
        const off = (rng() - 0.5) * L * rough;
        Q.push([(a[0] + b[0]) / 2 - (dy / L) * off, (a[1] + b[1]) / 2 + (dx / L) * off]);
        changed = true;
      }
      Q.push(b);
    }
    P = Q;
    if (!changed) break;
  }
  return P;
}
function yOn(P, x) {
  if (x <= P[0][0]) return P[0][1];
  for (let i = 1; i < P.length; i++) {
    if (P[i][0] >= x) { const a = P[i - 1], b = P[i], t = (x - a[0]) / Math.max(1e-3, b[0] - a[0]); return a[1] + (b[1] - a[1]) * t; }
  }
  return P[P.length - 1][1];
}
function walk(rng, x, y, ang, len, step, wob = 0.1) {
  const P = [[x, y]];
  let a = ang;
  for (let s = step; s <= len; s += step) {
    a += (rng() - 0.5) * wob; a = a * 0.85 + ang * 0.15;
    x += Math.sin(a) * step; y += Math.cos(a) * step;
    P.push([x, y]);
  }
  return P;
}
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const toward = (c, t, p = PAPER) => [c[0] + (p[0] - c[0]) * t, c[1] + (p[1] - c[1]) * t, c[2] + (p[2] - c[2]) * t];

// tapered stroke along P: width w0 at the head, thinning to the tail; dry breaks by noise
function taper(g, rng, P, w0, col, a, dry = 0) {
  const n = P.length;
  if (n < 2) return;
  const L = [], R = [];
  let wob = 0;
  for (let i = 0; i < n; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[Math.min(n - 1, i + 1)];
    let dx = p1[0] - p0[0], dy = p1[1] - p0[1];
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const s = i / (n - 1);
    wob = wob * 0.7 + (rng() - 0.5) * 0.5;
    const hw = 0.5 * w0 * Math.pow(1 - s, 0.8) * Math.min(1, s * 8 + 0.35) * (1 + wob * 0.6) + 0.15;
    L.push([P[i][0] - dy * hw, P[i][1] + dx * hw]); R.push([P[i][0] + dy * hw, P[i][1] - dx * hw]);
  }
  g.fillStyle = css(col, a);
  if (!dry) {
    g.beginPath(); g.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i < n; i++) g.lineTo(L[i][0], L[i][1]);
    for (let i = n - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
    g.closePath(); g.fill();
    return;
  }
  // dry brush: the stroke breaks into dashes
  let i = 0;
  while (i < n - 1) {
    const run = 2 + ((rng() * 5) | 0), gap = rng() < dry ? 1 + ((rng() * 3) | 0) : 0;
    const j = Math.min(n - 1, i + run);
    g.beginPath(); g.moveTo(L[i][0], L[i][1]);
    for (let k = i + 1; k <= j; k++) g.lineTo(L[k][0], L[k][1]);
    for (let k = j; k >= i; k--) g.lineTo(R[k][0], R[k][1]);
    g.closePath(); g.fill();
    i = j + gap;
  }
}
// wash band on one side of P (side 1: right of a downward stroke, the shadow side), width
// wd(s), fading down the band. Painted as a faint flat layer plus dry hatching along the
// fold (streaky hemp-fibre texture, denser and darker next to the fold line).
let HR = rngOf(5);
function wash(g, P, wmax, col, a0, grow = 0.6, side = 1, fp = 1) {
  const n = P.length;
  if (n < 2) return;
  const Nx = [], Ny = [], Wd = [];
  for (let i = 0; i < n; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[Math.min(n - 1, i + 1)];
    let dx = p1[0] - p0[0], dy = p1[1] - p0[1];
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const s = i / (n - 1);
    Wd.push(wmax * (1 - grow + grow * Math.sin(Math.min(1, s * 1.4) * Math.PI * 0.5)) * (1 - 0.6 * s * s));
    Nx.push(dy * side); Ny.push(-dx * side);
  }
  const fadeAt = (i) => { const s = i / (n - 1); return (1 - Math.pow(s, fp)) * Math.min(1, s * 6 + 0.4); };
  g.fillStyle = css(col, 1);
  for (let i = 0; i < n - 1; i++) {
    g.globalAlpha = a0 * 0.35 * fadeAt(i);
    g.beginPath(); g.moveTo(P[i][0], P[i][1]); g.lineTo(P[i + 1][0], P[i + 1][1]);
    g.lineTo(P[i + 1][0] + Nx[i + 1] * Wd[i + 1], P[i + 1][1] + Ny[i + 1] * Wd[i + 1]); g.lineTo(P[i][0] + Nx[i] * Wd[i], P[i][1] + Ny[i] * Wd[i]); g.closePath(); g.fill();
  }
  g.strokeStyle = css(col, 1);
  g.lineCap = 'butt';
  const m = Math.max(2, Math.round(wmax / 1.4));
  for (let j = 0; j < m; j++) {
    const u = Math.pow(HR(), 0.9);
    const i0 = Math.floor(HR() * HR() * n * 0.6), i1 = Math.min(n - 1, i0 + 2 + Math.floor(HR() * n));
    const lw = 0.7 + HR() * 1.9, a = a0 * Math.pow(1 - u, 0.6) * (0.45 + HR() * 0.75);
    g.lineWidth = lw;
    for (let i = i0; i < i1; i += 3) {
      const e = Math.min(i1, i + 3);
      if (HR() < 0.12) continue;           // dry gaps
      g.globalAlpha = Math.min(1, a * fadeAt(i));
      g.beginPath();
      for (let q = i; q <= e; q++) { const x = P[q][0] + Nx[q] * Wd[q] * u, y = P[q][1] + Ny[q] * Wd[q] * u; if (q === i) g.moveTo(x, y); else g.lineTo(x, y); }
      g.stroke();
    }
  }
  g.globalAlpha = 1;
}// irregular blot (wet dab) of radius rx, ry
function blot(g, rng, x, y, rx, ry, rot = 0) {
  const n = 7 + ((rng() * 3) | 0), ph = rng() * 6.28;
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const px = [], py = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * 6.2832, rr = 1 + (rng() - 0.5) * 0.55 + Math.sin(t * 2 + ph) * 0.12;
    const ex = Math.cos(t) * rx * rr, ey = Math.sin(t) * ry * rr;
    px.push(x + ex * cr - ey * sr); py.push(y + ex * sr + ey * cr);
  }
  g.beginPath(); g.moveTo((px[n - 1] + px[0]) / 2, (py[n - 1] + py[0]) / 2);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; g.quadraticCurveTo(px[i], py[i], (px[i] + px[j]) / 2, (py[i] + py[j]) / 2); }
  g.fill();
}
// a small snowy pine seen from afar: a dark rounded crown of a few wet blots on a thin
// trunk, flecked with snow on the upper side of its tiers
function tinyPine(g, rng, x, y, h, ink, snowA, a = 0.92) {
  g.fillStyle = css(ink, a);
  g.beginPath(); g.moveTo(x - h * 0.04, y); g.lineTo(x + h * 0.04, y); g.lineTo(x + (rng() - 0.5) * h * 0.1, y - h); g.closePath(); g.fill();
  const tiers = 2 + ((rng() * 3) | 0);
  const T = [];
  for (let i = 0; i < tiers; i++) {
    const t = tiers === 1 ? 0.5 : i / (tiers - 1);
    const w = h * (0.62 * Math.pow(1 - t, 0.8) + 0.2) * (0.75 + rng() * 0.5);
    const th = h * (0.3 - 0.1 * t) * (0.8 + rng() * 0.4);
    const cx = x + (rng() - 0.5) * h * 0.18, cy = y - h * (0.3 + 0.62 * t);
    T.push([cx, cy, w, th]);
    blot(g, rng, cx, cy, w * 0.5, th * 0.5, (rng() - 0.5) * 0.4);
  }
  if (snowA > 0) {
    g.fillStyle = css(SNOW, snowA);
    for (const [cx, cy, w, th] of T) {
      if (rng() < 0.3) continue;
      blot(g, rng, cx + (rng() - 0.5) * w * 0.25, cy - th * 0.3, w * (0.18 + rng() * 0.16), th * 0.22, (rng() - 0.5) * 0.3);
    }
  }
}
function clump(g, rng, cx, cy, r, n, h, ink, snowA, inside) {
  const T = [];
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2, d = Math.sqrt(rng());
    const x = cx + Math.cos(a) * d * r, y = cy + Math.sin(a) * d * r * 0.6;
    if (inside && !inside(x, y - h * 0.5)) continue;
    T.push([x, y, h * (0.6 + rng() * 0.6) * (1 - 0.25 * d), d]);
  }
  T.sort((p, q) => p[1] - q[1]);
  // grey shadow blots under the crowns tie the clump together (no outline)
  g.fillStyle = css(toward(ink, 0.55), 0.35);
  for (let i = 0; i < n * 0.5; i++) {
    const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * 0.8;
    const x = cx + Math.cos(a) * d * r, y = cy + Math.sin(a) * d * r * 0.5 + h * 0.1;
    if (inside && !inside(x, y)) continue;
    blot(g, rng, x, y, h * (0.35 + rng() * 0.4), h * (0.2 + rng() * 0.2), (rng() - 0.5) * 0.5);
  }
  // dense dark dotting (the forest seen from afar) under the crowns
  g.fillStyle = css(ink, 0.8);
  for (let i = 0; i < n * 1.5; i++) {
    const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * 0.9;
    const x = cx + Math.cos(a) * d * r, y = cy + Math.sin(a) * d * r * 0.5;
    if (inside && !inside(x, y)) continue;
    blot(g, rng, x, y, h * (0.1 + rng() * 0.16), h * (0.07 + rng() * 0.1), (rng() - 0.5) * 0.6);
  }
  for (const [x, y, hh, d] of T) tinyPine(g, rng, x, y, hh, ink, snowA, (0.95 - 0.3 * d * rng()) * (0.7 + 0.3 * rng()));
  // moss dots around
  g.fillStyle = css(ink, 0.9);
  for (let i = 0; i < n * 0.6; i++) {
    const a = rng() * Math.PI * 2, d = 0.6 + rng() * 0.6;
    const x = cx + Math.cos(a) * d * r, y = cy + Math.sin(a) * d * r * 0.5;
    if (inside && !inside(x, y)) continue;
    g.beginPath(); g.ellipse(x, y, 0.8 + rng() * 1.4, 0.6 + rng() * 0.9, rng() * 3, 0, Math.PI * 2); g.fill();
  }
}

function paintPeak(g, k, rect, pk, seed) {
  const rng = rngOf(seed);
  HR = rngOf(seed + 3);
  const tone = pk.tone ?? 0;
  const INK = toward([22, 21, 21], tone), LINE = toward([58, 58, 60], tone), WASH = toward([118, 120, 124], tone * 0.8);
  const R = jag(pk.ridge, rng, pk.rough ?? 0.22, 3);
  const base = pk.base, fadeH = pk.fadeH ?? 90;
  const x0 = R[0][0], x1 = R[R.length - 1][0];
  const bottom = base + fadeH + 30;
  let sum = R[0];
  for (const p of R) if (p[1] < sum[1]) sum = p;
  const summits = pk.summits || [sum];
  const nearestSummit = (x) => { let b = summits[0], bd = 1e9; for (const s of summits) { const d = Math.abs(s[0] - x) + Math.max(0, x < s[0] ? 0 : 0); if (d < bd) { bd = d; b = s; } } return b; };
  const halfW = pk.halfW ?? (x1 - x0) * 0.35;
  const inside = (x, y) => x > x0 && x < x1 && y > yOn(R, x) + 1 && y < bottom;
  const body = () => { g.beginPath(); g.moveTo(R[0][0], R[0][1]); for (const p of R) g.lineTo(p[0], p[1]); g.lineTo(x1, bottom); g.lineTo(x0, bottom); g.closePath(); };

  // 1. rock body: light grey, paling into the mist below (snow is laid on top in step 2b)
  body();
  const ROCK = toward(pk.rock ?? [142, 144, 148], tone * 0.85), ROCK_LO = toward([218, 219, 220], tone * 0.5);
  const bg = g.createLinearGradient(0, sum[1], 0, bottom);
  bg.addColorStop(0, css(ROCK)); bg.addColorStop(0.55, css(toward(ROCK, 0.25, ROCK_LO))); bg.addColorStop(1, css(ROCK_LO));
  g.fillStyle = bg; g.fill();
  g.save(); body(); g.clip();

  // 2. washes (painted on their own canvas, then blurred so the far edge is soft)
  const W = new OffscreenCanvas(g.canvas.width, g.canvas.height);
  const wg = W.getContext('2d');
  wg.setTransform(k, 0, 0, k, -rect[0] * k, -rect[1] * k);
  const shadow = pk.shadow ?? 1;
  const spurs = (pk.spurs || []).map(([x, y, ang, len, w]) => ({ P: walk(rng, x, y, ang, len, 5, 0.12), w, a: 0.42 }));
  // plus secondary spurs every few dozen px along the ridge: each casts a grey plane to its right
  const fanAt = (x) => { const sm = nearestSummit(x); return Math.max(-1, Math.min(1, (x - sm[0]) / halfW)); };
  for (let x = x0 + 20 + rng() * 20; x < x1 - 10; x += (pk.spurGap ?? 42) * (0.6 + rng() * 0.8)) {
    const y = yOn(R, x) + 2, u = fanAt(x);
    spurs.push({ P: walk(rng, x, y, u * 0.45 + (rng() - 0.5) * 0.2, (60 + rng() * 160) * (pk.foldLen ?? 1), 5, 0.16), w: 12 + rng() * 30 * (0.6 + 0.6 * Math.abs(u)), a: 0.2 + rng() * 0.18 + (u > 0 ? 0.08 : 0) });
  }
  for (const s of spurs) wash(wg, s.P, s.w, WASH, s.a * shadow, 0.8);
  // fold strokes: start on the ridge (most) or inside on a spur, fall along the slope fanning out from the summit
  const folds = [];
  const nF = Math.round((x1 - x0) * 0.32 * (pk.folds ?? 1));
  for (let i = 0; i < nF; i++) {
    let x, y;
    if (rng() < 0.62 || !spurs.length) {
      x = x0 + 6 + rng() * (x1 - x0 - 12); y = yOn(R, x) + 1 + rng() * rng() * 30;
    } else {
      const s = spurs[(rng() * spurs.length) | 0], j = (rng() * s.P.length * 0.8) | 0;
      [x, y] = s.P[j]; x += (rng() - 0.5) * 6;
    }
    const sm = nearestSummit(x);
    const u = Math.max(-1, Math.min(1, (x - sm[0]) / halfW));
    const ang = u * 0.5 + (rng() - 0.5) * 0.16;
    const down = Math.max(20, bottom - y);
    const len = Math.min(down, (15 + rng() * rng() * 150) * (pk.foldLen ?? 1));
    const P = walk(rng, x, y, ang, len, 4, 0.26);
    const sh = (x > sm[0] ? 1.35 : 0.75) * shadow;
    folds.push({ P, sh, u, y });
    wash(wg, P, 3 + rng() * 9 * (0.6 + 0.6 * Math.abs(u)), WASH, (0.08 + rng() * 0.14) * sh, 0.5);
  }
  // 2b. snow: a crest band under the whole ridge and white planes on the lit (left) side of
  // every spur and fold, so the faces read as snow broken by grey rock, not grey on white
  const S = new OffscreenCanvas(g.canvas.width, g.canvas.height);
  const sg = S.getContext('2d');
  sg.setTransform(k, 0, 0, k, -rect[0] * k, -rect[1] * k);
  const snowAmt = pk.snow ?? 0.5;
  {
    let d = 0.5;
    const D = R.map(() => { d = Math.max(0, Math.min(1, d + (rng() - 0.5) * 0.35)); return d; });
    sg.fillStyle = css(SNOW);
    sg.beginPath(); sg.moveTo(R[0][0], R[0][1] - 1);
    for (const p of R) sg.lineTo(p[0], p[1] - 1);
    for (let i = R.length - 1; i >= 0; i--) sg.lineTo(R[i][0], R[i][1] + (5 + 20 * D[i]) * snowAmt);
    sg.closePath(); sg.fill();
  }
  for (const s of spurs) wash(sg, s.P, s.w * 1.1 * snowAmt, SNOW, 0.95, 0.5, -1, 1.8);
  for (const f of folds) if (rng() < 0.8) wash(sg, f.P, (3 + rng() * 11) * snowAmt * (f.u < 0 ? 1.3 : 0.8), SNOW, 0.9, 0.4, -1, 1.5);
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.filter = `blur(${(1.6 * k).toFixed(1)}px)`;
  g.drawImage(W, 0, 0);
  g.filter = `blur(${(0.7 * k).toFixed(1)}px)`;
  g.drawImage(S, 0, 0);
  g.filter = 'none';
  g.restore();

  // 3. crisp strokes: spur crests and the fold lines (dry, thin, tapering down the slope)
  for (const s of spurs) taper(g, rng, s.P.slice(0, Math.ceil(s.P.length * 0.7)), 1.2 + s.w * 0.06, LINE, 0.4 + s.a, 0.3);
  for (const f of folds) {
    const a = (0.2 + rng() * 0.45) * Math.min(1.2, 0.7 + 0.45 * f.sh);
    taper(g, rng, f.P, 0.8 + rng() * 1.6, LINE, a, 0.45);
  }
  // rock showing just under the crest on the shadow-facing stretches of the ridge
  for (let i = 2; i < R.length - 2; i += 1 + ((rng() * 3) | 0)) {
    const dx = R[i + 1][0] - R[i - 1][0], dy = R[i + 1][1] - R[i - 1][1];
    if (dy < 0.2 * Math.abs(dx) || rng() < 0.35) continue;     // descending to the right = shadow facing
    const P = walk(rng, R[i][0], R[i][1] + 1.5, 0.25 + (rng() - 0.5) * 0.3, 5 + rng() * 16, 2, 0.2);
    taper(g, rng, P, 1.5 + rng() * 2.2, INK, 0.55 + rng() * 0.35, 0);
  }
  g.restore();   // clip

  // 4. a thin, broken outline along the silhouette (snow edge against the sky)
  g.lineCap = 'round';
  for (let i = 1; i < R.length; i++) {
    if (rng() < 0.3) continue;
    g.strokeStyle = css(LINE, 0.15 + rng() * 0.35);
    g.lineWidth = 0.6 + rng() * 0.9;
    g.beginPath(); g.moveTo(R[i - 1][0], R[i - 1][1] + 0.5); g.lineTo(R[i][0], R[i][1] + 0.5); g.stroke();
  }

  // 5. tree clumps (inside the body) and trees poking above the ridge
  const snowA = pk.treeSnow ?? 0.9;
  // trees a step lighter than the rock accents (aerial distance), each a little different in value
  const TREE = toward([22, 21, 21], Math.min(0.9, tone + (pk.treeTone ?? 0.2)));
  for (const [cx, cy, r, n, h] of pk.clumps || []) clump(g, rng, cx, cy, r * (pk.clumpR ?? 1), Math.round(n * (pk.treeN ?? 1)), h * (pk.treeScale ?? 1), TREE, snowA, inside);
  const nA = Math.round((pk.autoClumps ?? 0) * (x1 - x0) / 100);
  for (let i = 0; i < nA; i++) {
    const sm0 = summits[(rng() * summits.length) | 0];
    let x = rng() < 0.65 ? sm0[0] + rng() * halfW : x0 + rng() * (x1 - x0);
    x = Math.max(x0 + 10, Math.min(x1 - 10, x));
    const yt = yOn(R, x);
    const y = yt + 8 + Math.pow(rng(), 2.5) * Math.max(10, (base - yt) * 0.6);
    clump(g, rng, x, y, (12 + rng() * 16) * (pk.clumpR ?? 1), Math.round((6 + rng() * 8) * (pk.treeN ?? 1)), (pk.treeH ?? 9) * (pk.treeScale ?? 1), TREE, snowA, inside);
  }
  // forest along the crest: runs of trees standing on the ridge (their tops make the bumpy treeline)
  const rt = pk.ridgeTrees ?? 0.3;
  const th = (pk.treeH ?? 9) * (pk.treeScale ?? 1);
  for (let x = x0 + 8; x < x1 - 8;) {
    if (rng() < rt * 0.5) {
      const run = th * (1.5 + rng() * 5);
      const T = [];
      for (let xx = x; xx < Math.min(x1 - 6, x + run); xx += th * (0.25 + rng() * 0.3)) {
        const hh = th * (0.55 + rng() * 0.6);
        T.push([xx + (rng() - 0.5) * 3, yOn(R, xx) + 2 + rng() * hh * 0.6, hh]);
        if (rng() < 0.5) T.push([xx + (rng() - 0.5) * 6, yOn(R, xx) + hh * (0.5 + rng() * 0.9), hh * 0.9]);
      }
      T.sort((p, q) => p[1] - q[1]);
      for (const [tx, ty, hh] of T) tinyPine(g, rng, tx, ty, hh, TREE, snowA, 0.65 + 0.3 * rng());
      x += run + th * (1 + rng() * 4);
    } else x += th * (1 + rng() * 3);
  }
  let lastX = -1e9;
  for (let i = 1; i < R.length - 1; i++) {
    const [x, y] = R[i];
    if (x - lastX < 10 || rng() > rt * 0.15) continue;
    lastX = x;
    const n = 1 + ((rng() * 3) | 0), h = (pk.treeH ?? 9) * (pk.treeScale ?? 1) * 0.8 * (0.7 + rng() * 0.6);
    for (let j = 0; j < n; j++) tinyPine(g, rng, x + (j - (n - 1) / 2) * h * 0.55 + (rng() - 0.5) * 3, yOn(R, x) + 2 + rng() * 4, h * (0.7 + rng() * 0.5), TREE, snowA);
  }
}

function fadeMask(k, rect, W, H, pk, seed) {
  const rng = rngOf(seed + 999);
  const M = new OffscreenCanvas(W, H);
  const m = M.getContext('2d');
  m.setTransform(k, 0, 0, k, -rect[0] * k, -rect[1] * k);
  const base = pk.base, fadeH = pk.fadeH ?? 90;
  const gr = m.createLinearGradient(0, base, 0, base + fadeH);
  gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  m.fillStyle = gr; m.fillRect(rect[0], rect[1], rect[2], rect[3]);
  // cloud bites into the base: soft round lobes
  m.globalCompositeOperation = 'destination-out';
  const x0 = pk.ridge[0][0], x1 = pk.ridge[pk.ridge.length - 1][0];
  for (let x = x0 - 40; x < x1 + 40; x += 18 + rng() * 30) {
    const r = 30 + rng() * 70, y = base - fadeH * 0.3 + rng() * fadeH * 0.8;
    const rg = m.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, 'rgba(0,0,0,0.9)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    m.fillStyle = rg; m.beginPath(); m.ellipse(x, y, r, r * 0.6, 0, 0, Math.PI * 2); m.fill();
  }
  return M;
}

const FINISH = /* glsl */ `
uniform float uSeed;
uniform vec2 uOff;
vec4 shade(vec2 p, vec2 uv) {
  vec4 c = texture(uSrc, uv);
  vec4 s = vec4(0.0);
  for (int i = 0; i < 6; i++) { float a = float(i) * 1.0472 + 0.4; s += texture(uSrc, uv + vec2(cos(a), sin(a)) * uTexel * 1.7); }
  s /= 6.0;
  if (max(c.a, s.a) < 0.002) return vec4(0.0);
  vec3 cc = c.a > 0.002 ? c.rgb / c.a : vec3(0.97);
  vec3 sc = s.a > 0.002 ? s.rgb / s.a : vec3(0.97);
  // a little wet bleed: darks spread into lighter neighbours
  vec3 col = luma(sc) < luma(cc) ? mix(cc, sc, 0.4) : mix(cc, sc, 0.12);
  vec2 q = p + uOff + uSeed * 41.0;
  float gr = vnoise(q * 0.45) * 0.55 + vnoise(q * 1.3 + 7.0) * 0.45;
  // hemp-fibre texture in the greys: long vertical streaks and a slow mottle
  float L0 = luma(col);
  float midT = smoothstep(0.93, 0.75, L0) * smoothstep(0.25, 0.5, L0);
  float st = streaks(q * 0.06, vec2(0.0, 1.0), 6.0, 3);
  float mo = fbm(q * 0.012, 3);
  col *= 1.0 + midT * (0.22 * (0.5 - st) + 0.1 * mo);
  float dk = smoothstep(0.88, 0.35, luma(col));
  col = mix(col, vec3(0.965, 0.96, 0.95), dk * clamp((gr - 0.48) * 0.8, 0.0, 0.3));
  float e = vnoise(q * 0.22) * 0.6 + vnoise(q * 0.7 + 3.0) * 0.4 - 0.5;
  float a = clamp(c.a + e * 0.9 * c.a * (1.0 - c.a) * 4.0, 0.0, 1.0);
  return vec4(clamp(col, 0.0, 1.0) * a, a);
}`;

export function bakeSnowPeaks(api, rect, peaks, { seed = 1, scale = 1 } = {}) {
  const t0 = performance.now();
  const src = api.bakeCanvas(rect[2], rect[3], (ctx, { k }) => {
    const Wp = ctx.canvas.width, Hp = ctx.canvas.height;
    peaks.forEach((pk, i) => {
      const C = new OffscreenCanvas(Wp, Hp);
      const g = C.getContext('2d');
      g.setTransform(k, 0, 0, k, -rect[0] * k, -rect[1] * k);
      paintPeak(g, k, rect, pk, seed * 131 + i * 17);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'destination-in';
      g.drawImage(fadeMask(k, rect, Wp, Hp, pk, seed * 7 + i), 0, 0);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = pk.alpha ?? 1; ctx.drawImage(C, 0, 0); ctx.restore();
    });
  }, { scale });
  const out = api.processTex(src, FINISH, { uniforms: { uSeed: seed % 9, uOff: [rect[0], rect[1]] } });
  api.engine?.freeTex?.(src);
  console.warn('s06 massif ms', Math.round(performance.now() - t0));
  return { src: out, rect, layer: (lo = {}) => api.tex(out, { rect, ...lo }) };
}
