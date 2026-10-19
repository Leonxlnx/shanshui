// s08: splashed-ink cliffs and boulders in the manner of ref 08.
// Each rock: paper-filled silhouette (occludes what is behind), facets lit from the left with a dark
// shadow side and crisp crevice, vertical axe-cut texture strokes, dark ink dabs, ragged dark top
// contour, foliage clumps crowning the top, and a ragged mist dissolve at the bottom.
import { stroke, dryStroke, blob, rgba, tone, noisePattern, PAPER } from '../../lib/brush.js';
import { paintMoss } from '../../lib/rock.js';
import { makeRng, makeNoise, clamp, mix, smoothstep } from '../../engine/rng.js';
import { paintBoulder } from './boulder.js';

function crossX(poly, y) {
  const xs = [];
  for (let i = 0, n = poly.length; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]));
  }
  return xs.sort((p, q) => p - q);
}
function crossY(poly, x) {
  const ys = [];
  for (let i = 0, n = poly.length; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    if ((a[0] <= x && b[0] > x) || (b[0] <= x && a[0] > x)) ys.push(a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]));
  }
  return ys.sort((p, q) => p - q);
}
function roughen(poly, nz, step, amp, freq) {
  const out = [];
  let s = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const k = Math.max(1, Math.ceil(L / step));
    const nx = -(b[1] - a[1]) / (L || 1), ny = (b[0] - a[0]) / (L || 1);
    for (let j = 0; j < k; j++) {
      const t = j / k, d = (nz.n2(s * freq, 3.7) * 0.7 + nz.n2(s * freq * 3.1, 9.1) * 0.3) * amp;
      out.push([a[0] + (b[0] - a[0]) * t + nx * d, a[1] + (b[1] - a[1]) * t + ny * d]);
      s += L / k;
    }
  }
  return out;
}
function fadeAt(fade, x) {
  if (typeof fade === 'function') return fade(x);
  const F = fade;
  if (x <= F[0][0]) return [F[0][1], F[0][2]];
  for (let i = 1; i < F.length; i++) if (x <= F[i][0]) { const t = (x - F[i - 1][0]) / (F[i][0] - F[i - 1][0]); return [mix(F[i - 1][1], F[i][1], t), mix(F[i - 1][2], F[i][2], t)]; }
  const l = F[F.length - 1]; return [l[1], l[2]];
}

// rock: { outline, seed, facets: [x...] | number, face (lit tone 0.68), shade (dark tone 0.22), fade: [[x,y0,y1]...],
//         crown (foliage 1), tex (texture 1), dabs (1), contour (1), light: 'left'|'right', grain (stroke slant), bushes }
export function paintRock(ctx, R, k = 1, paper = PAPER) {
  const seed = R.seed ?? 1;
  const rng = makeRng('s08rock:' + seed);
  const nz = makeNoise('s08rock-n:' + seed);
  const poly = roughen(R.outline, nz, 4, R.rough ?? 2.5, 0.08);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of poly) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const M = 40;
  x0 = Math.floor(x0 - M); y0 = Math.floor(y0 - M); x1 = Math.ceil(x1 + M); y1 = Math.ceil(y1 + M);
  const W = x1 - x0, H = y1 - y0;
  const cv = new OffscreenCanvas(Math.max(1, Math.ceil(W * k)), Math.max(1, Math.ceil(H * k)));
  const g = cv.getContext('2d');
  g.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
  const path = new Path2D();
  path.moveTo(poly[0][0], poly[0][1]);
  for (const p of poly) path.lineTo(p[0], p[1]);
  path.closePath();
  const face = R.face ?? 0.88, shade = R.shade ?? 0.42;
  const lightL = (R.light ?? 'left') === 'left';
  const top = (x) => { const ys = crossY(poly, x); return ys.length ? ys[0] : null; };
  const fade = R.fade || [[x0, y1 - 60, y1 - 10]];

  // facet boundaries (crevices): x positions with a wobble down the face
  let fx = R.facets;
  const bx0 = x0 + M, bx1 = x1 - M;
  if (typeof fx === 'number' || fx == null) {
    const n = fx ?? Math.max(1, Math.round((bx1 - bx0) / 120));
    fx = [];
    for (let i = 1; i < n; i++) fx.push(bx0 + (bx1 - bx0) * (i + (rng() - 0.5) * 0.5) / n);
  }
  const slant = R.slant ?? 0.08;
  const crev = fx.map((x, i) => ({ x, ph: rng() * 100, i }));
  const crevX = (c, y) => c.x + slant * (y - y0) + nz.n2(c.ph, y * 0.009) * 22 + nz.n2(c.ph + 7, y * 0.035) * 6;

  // 1. paper fill (occluder)
  g.fillStyle = rgba(paper, 1);
  g.fill(path);
  g.save();
  g.clip(path);
  // 2. facet shading, row by row (own canvas, composited with a slight blur so row steps vanish)
  const fcv = new OffscreenCanvas(cv.width, cv.height);
  const fg = fcv.getContext('2d');
  fg.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
  const rowH = 2;
  for (let y = y0; y < y1; y += rowH) {
    const xs = crossX(poly, y + rowH * 0.5);
    if (xs.length < 2) continue;
    const L = xs[0], Rr = xs[xs.length - 1];
    const bnd = [L - 30, ...crev.map((c) => crevX(c, y)).filter((x) => x > L && x < Rr), Rr + 2];
    for (let i = 0; i < bnd.length - 1; i++) {
      const a = Math.max(L - 2, bnd[i]), b = Math.min(Rr + 2, bnd[i + 1]);
      if (b <= a) continue;
      const gx = fg.createLinearGradient(lightL ? a : b, 0, lightL ? b : a, 0);
      const fv = face + (nz.n2(i * 3.1 + seed, y * 0.004) * (R.facetVar ?? 0.08)) - (R.facetVar ? (R.facetVar * 0.6) * (0.5 + 0.5 * Math.sin(i * 2.7 + seed)) : 0);
      gx.addColorStop(0, rgba(tone(fv, paper), 1));
      gx.addColorStop(R.sharp ? 0.72 : 0.55, rgba(tone(fv - 0.05, paper), 1));
      gx.addColorStop(R.sharp ? 0.9 : 0.85, rgba(tone(mix(fv, shade, 0.55), paper), 1));
      gx.addColorStop(1, rgba(tone(shade, paper), 1));
      fg.fillStyle = gx;
      fg.fillRect(a, y, b - a, rowH + 0.6);
    }
  }
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.filter = `blur(${1.6 * k}px)`; g.drawImage(fcv, 0, 0); g.restore();
  // granulation: fine and coarse pigment noise settling into the wash
  g.save();
  g.globalAlpha = 0.16 * (R.gran ?? 1); g.fillStyle = noisePattern(g, { cell: 2.2, seed: seed % 97, contrast: 2.4 }); g.fillRect(x0, y0, W, H);
  g.globalAlpha = 0.1 * (R.gran ?? 1); g.fillStyle = noisePattern(g, { cell: 9, seed: (seed + 5) % 97, contrast: 1.8 }); g.fillRect(x0, y0, W, H);
  g.restore();
  // large soft value variations (wash blooms)
  g.filter = `blur(${10 * k}px)`;
  for (let i = 0; i < (W * H) / 9000; i++) {
    const x = mix(x0, x1, rng()), y = mix(y0, y1, rng());
    blob(g, x, y, 14 + rng() * 40, { color: tone(clamp(face + (rng() < 0.6 ? -0.3 : 0.12)), paper), alpha: 0.12 + rng() * 0.12, rng, squash: 1.6, irregular: 0.4 });
  }
  g.filter = 'none';
  // 2c. dark wet crown: ink pooled along the top contour, bleeding down the face unevenly,
  // broken by pale dry-brush flecks (mottled, not flat)
  if (R.topDark) {
    const TD = R.topDark;
    g.save();
    g.filter = `blur(${3 * k}px)`;
    for (let x = x0 + M - 6; x <= x1 - M + 6; x += 3) {
      const t0 = top(x);
      if (t0 == null) continue;
      const D = TD * (0.35 + 0.9 * (0.5 + 0.5 * nz.n2(x * 0.018, 13.1)) + 0.25 * nz.n2(x * 0.09, 4.2));
      const gr = g.createLinearGradient(0, t0 - 4, 0, t0 + D);
      gr.addColorStop(0, rgba(tone(0.02, paper), 0.95));
      gr.addColorStop(0.4, rgba(tone(0.05, paper), 0.7));
      gr.addColorStop(1, rgba(tone(0.12, paper), 0));
      g.fillStyle = gr;
      g.fillRect(x - 0.5, t0 - 4, 4, D + 4);
    }
    g.filter = 'none';
    g.restore();
    for (let i = 0; i < W * TD / 700; i++) {
      const x = mix(bx0, bx1, rng());
      const t0 = top(x);
      if (t0 == null) continue;
      const y = t0 + 5 + rng() * TD * 0.9;
      const len = 5 + rng() * 16;
      dryStroke(g, [[x, y], [x + (rng() - 0.5) * 4, y + len * 0.5], [x + (rng() - 0.5) * 6, y + len]], { width: 3 + rng() * 7, bristles: 3 + ((rng() * 3) | 0), color: tone(0.45 + rng() * 0.35, paper), alpha: 0.18 + rng() * 0.3, dry: 0.55, rng });
    }
  }
  // 3. texture: vertical axe-cut strokes, denser toward each facet's shadow side and the top
  const texN = (R.tex ?? 1) * (W * H) / 260;
  const facetU = (x, y) => {
    const xs = [x0 - 30, ...crev.map((c) => crevX(c, y)), x1 + 30];
    for (let i = 0; i < xs.length - 1; i++) if (x >= xs[i] && x < xs[i + 1]) { const u = (x - xs[i]) / (xs[i + 1] - xs[i]); return lightL ? u : 1 - u; }
    return 0.5;
  };
  for (let i = 0; i < texN; i++) {
    const x = mix(x0, x1, rng()), y = mix(y0, y1, rng());
    const t0 = top(x);
    if (t0 == null || y < t0) continue;
    const u = facetU(x, y);
    const depth = clamp((y - t0) / 260, 0, 1);
    if (rng() > (R.texLit ?? 0.25) + 0.75 * u * (1 - 0.5 * depth)) continue;
    const len = (8 + rng() * 40) * (R.texLen ?? 1);
    const v = clamp(Math.min(face - 0.04, mix(R.texLight ?? 0.5, 0.02, u * u)) + (rng() - 0.5) * 0.3, 0.0, 0.75);
    const sl = slant + (rng() - 0.5) * 0.2;
    const tp = [[x, y], [x + sl * len * 0.5 + (rng() - 0.5) * 3, y + len * 0.5], [x + sl * len + (rng() - 0.5) * 3, y + len]];
    if (rng() < 0.65) dryStroke(g, tp, { width: 3 + rng() * 7, bristles: 3 + ((rng() * 4) | 0), color: tone(v, paper), alpha: 0.4 + rng() * 0.45, dry: 0.3 + rng() * 0.35, rng });
    else stroke(g, tp, { width: 1.2 + rng() * 3.5, color: tone(v, paper), alpha: 0.3 + rng() * 0.45, rng, profile: 'brush', rough: 0.5 });
  }
  // 3b. broken dark shadow sides: bold strokes and dabs where the facet turns from the light
  const shN = (R.shadowTex ?? 1) * (W * H) / 380;
  for (let i = 0; i < shN; i++) {
    const x = mix(x0, x1, rng()), y = mix(y0, y1, rng());
    const t0 = top(x);
    if (t0 == null || y < t0) continue;
    const u = facetU(x, y);
    if (u < 0.5 || rng() > smoothstep(0.5, 1.0, u)) continue;
    const len = (8 + rng() * 34) * (R.shLen ?? 1);
    const sl = slant + (rng() - 0.5) * 0.25;
    dryStroke(g, [[x, y], [x + sl * len * 0.5, y + len * 0.5], [x + sl * len, y + len]], { width: 4 + rng() * 9, bristles: 4 + ((rng() * 4) | 0), color: tone(rng() * 0.2, paper), alpha: 0.55 + rng() * 0.4, dry: 0.25 + rng() * 0.3, rng });
  }
  // 3c. splashed-ink mottling: clusters of dark irregular blots (where a noise field is high) with
  // pale dry flecks between, so the face reads as wet ink pooled unevenly, not an airbrushed ramp
  if (R.mottle) {
    const mN = R.mottle * (W * H) / 900;
    g.save();
    g.filter = `blur(${1.2 * k}px)`;
    for (let i = 0; i < mN; i++) {
      const x = mix(x0, x1, rng()), y = mix(y0, y1, rng());
      const t0 = top(x);
      if (t0 == null || y < t0 + 2) continue;
      const cl = nz.n2(x * 0.03 + seed, y * 0.035) + 0.35 * nz.n2(x * 0.11, y * 0.09 + 3.3);
      if (cl < -0.1 + rng() * 0.3) continue;
      blob(g, x, y, 3 + Math.pow(rng(), 1.8) * 13, { color: tone(rng() * 0.14, paper), alpha: 0.45 + rng() * 0.45, rng, irregular: 0.6, squash: 0.55 + rng() * 0.5, rot: rng() * 3 });
    }
    g.filter = 'none';
    g.restore();
    for (let i = 0; i < mN * 0.35; i++) {
      const x = mix(x0, x1, rng()), y = mix(y0, y1, rng());
      const t0 = top(x);
      if (t0 == null || y < t0 + 4) continue;
      const len = 4 + rng() * 14;
      dryStroke(g, [[x, y], [x + (rng() - 0.5) * 3, y + len * 0.5], [x + (rng() - 0.5) * 5, y + len]], { width: 2 + rng() * 6, bristles: 3, color: tone(0.55 + rng() * 0.3, paper), alpha: 0.2 + rng() * 0.3, dry: 0.6, rng });
    }
  }
  // 4. crevices: dark tapering strokes down each boundary
  for (const c of crev) {
    const yt = top(c.x) ?? y0;
    const len = (y1 - yt) * (0.25 + rng() * 0.35);
    const pts = [];
    for (let s = 0; s <= 8; s++) { const y = yt - 6 + len * s / 8; pts.push([crevX(c, y) + (lightL ? -2 : 2), y]); }
    stroke(g, pts, { width: [4 + rng() * 5, 1.2], profile: 'taper', color: tone(0.06, paper), alpha: 0.6, rng });
    // pooled dark beads along the crevice
    for (let s = 0; s < 6; s++) { const y = yt + rng() * len * 0.7; blob(g, crevX(c, y) - (lightL ? 4 : -4), y, 2 + rng() * 5, { color: tone(0.03, paper), alpha: 0.8, rng, squash: 1.6 }); }
  }
  // 5. ink dabs (moss dots) scattered, more near the top and on the shadow sides
  const dabN = (R.dabs ?? 1) * (W * H) / 650;
  for (let i = 0; i < dabN; i++) {
    const x = mix(x0, x1, rng()), y = mix(y0, y1, rng());
    const t0 = top(x);
    if (t0 == null || y < t0 + 4) continue;
    const depth = (y - t0) / 300;
    if (rng() > Math.exp(-depth * 1.6) * (0.4 + 0.6 * facetU(x, y))) continue;
    blob(g, x, y, 1.2 + Math.pow(rng(), 2.2) * 7, { color: tone(rng() * 0.18, paper), alpha: 0.55 + rng() * 0.4, rng, irregular: 0.55, squash: 0.7 + rng() * 0.5, rot: rng() * 3 });
  }
  // 5b. pale lit patches (rounded planes catching light) for dark boulders
  for (let i = 0; i < (R.lit ?? 0) * W / 22; i++) {
    const x = mix(bx0, bx1, rng());
    const t0 = top(x);
    if (t0 == null) continue;
    const y = t0 + 6 + rng() * Math.min(60, (y1 - t0) * 0.5);
    g.filter = `blur(${2.5 * k}px)`;
    blob(g, x, y, 5 + rng() * 14, { color: tone(0.6 + rng() * 0.25, paper), alpha: 0.35 + rng() * 0.35, rng, squash: 0.6 + rng() * 0.5, irregular: 0.45 });
    g.filter = 'none';
  }
  // 5c. white water sliding over the lower face
  for (let i = 0; i < (R.streaks ?? 0) * W / 2.5; i++) {
    const x = mix(bx0, bx1, rng());
    const t0 = top(x);
    if (t0 == null) continue;
    const yb = fadeAt(fade, x)[1];
    const y = mix(t0 + (yb - t0) * 0.15, yb, Math.pow(rng(), 0.7));
    const len = 12 + rng() * 50;
    stroke(g, [[x, y], [x + (rng() - 0.5) * 2, y + len * 0.5], [x + (rng() - 0.5) * 3, y + len]], { width: 1.2 + rng() * 4, color: rgba(paper, 1), alpha: 0.45 + rng() * 0.5, rng, profile: 'taper' });
  }
  g.restore();

  // 6. ragged dark contour along the top / exposed edges
  const tops = [];
  for (let x = bx0; x <= bx1; x += 4) { const t = top(x); if (t != null) tops.push([x, t]); }
  if ((R.contour ?? 1) > 0) {
    for (let i = 0; i < tops.length - 3; i += 2 + ((rng() * 3) | 0)) {
      const seg = tops.slice(i, i + 4 + ((rng() * 4) | 0)).map(([x, y]) => [x, y + 1.5]);
      if (seg.length < 2) continue;
      stroke(g, seg, { width: (2 + rng() * 3.5) * (R.contour ?? 1), color: tone(0.04, paper), alpha: 0.9, rng });
    }
  }
  // 7. foliage crown
  const crown = R.crown ?? 1;
  if (crown > 0 && tops.length) {
    let acc = 0;
    for (let i = 0; i < tops.length; i++) {
      const [x, y] = tops[i];
      const dens = smoothstep(-0.5, 0.4, nz.n2(x * 0.012, 5.3) + (crown - 1) * 0.6);
      acc += dens * crown * 0.42;
      if (acc < 1) continue;
      acc -= 0.6 + rng() * 0.9;
      const r = (R.mossSize ?? 1) * (5 + Math.pow(rng(), 1.6) * 12 + dens * 6);
      paintMoss(g, x + (rng() - 0.5) * 6, y + r * 0.15, r, rng, { color: tone(0.02, paper), greys: 0.5 });
      if (rng() < 0.3 * dens * crown) {
        const hh = r * (1.2 + rng() * 1.6);
        for (let j = 1; j <= 2; j++) paintMoss(g, x + (rng() - 0.5) * r * 2, y - hh * j / 2 + r * 0.4, r * (0.95 - 0.25 * j), rng, { color: tone(0.04, paper), greys: 0.6 });
      }
      if (rng() < 0.4 * dens) {
        let yy = y + r * 0.9, rr = r * 0.5;
        for (let j = 0; j < 3 && rr > 1.5; j++) { paintMoss(g, x + (rng() - 0.5) * r, yy, rr, rng, { color: tone(0.04, paper), greys: 0.2, satellites: 0.5 }); yy += rr * (1.5 + rng()); rr *= 0.7; }
      }
    }
  }
  for (const m of R.marks || []) paintMoss(g, m[0], m[1], m[2], rng, { color: tone(m[3] ?? 0.03, paper), greys: 0.5 });

  // 8. mist dissolve: erase downward from the fade line with a ragged, blurred edge
  // (the erase mask is drawn whole on its own canvas, then blurred once: blurring each column
  // separately left ~25% of the rock as a grey veil below the fade, ending in a hard line)
  const ecv = new OffscreenCanvas(cv.width, cv.height);
  const eg = ecv.getContext('2d');
  eg.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
  const sw = 10;
  for (let x = x0; x < x1; x += sw) {
    const [f0, f1] = fadeAt(fade, x + sw / 2);
    const fj = R.fadeJitter ?? 1;
    const j = (nz.n2(x * 0.01, 1.7) * (f1 - f0) * 0.45 + nz.n2(x * 0.04, 2.9) * (f1 - f0) * 0.15) * fj;
    const a = f0 + j, b = Math.max(a + 8, f1 + j);
    const gr = eg.createLinearGradient(0, a, 0, b);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
    eg.fillStyle = gr;
    eg.fillRect(x, a, sw, b - a);
    eg.fillStyle = 'rgba(0,0,0,1)';
    eg.fillRect(x - 0.5, b - 0.5, sw + 1, y1 - b + 40);
  }
  // wisps eating into the face above the fade line
  for (let i = 0; i < (R.wisps ?? 1) * W / 30; i++) {
    const x = mix(x0, x1, rng());
    const [f0, f1] = fadeAt(fade, x);
    const y = f0 - rng() * (f1 - f0) * 0.6;
    eg.fillStyle = `rgba(0,0,0,${0.25 + rng() * 0.35})`;
    eg.beginPath(); eg.ellipse(x, y, 18 + rng() * 50, 6 + rng() * 12, 0, 0, Math.PI * 2); eg.fill();
  }
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'destination-out';
  g.filter = `blur(${7 * k}px)`;
  g.drawImage(ecv, 0, 0);
  g.restore();

  ctx.drawImage(cv, x0, y0, W, H);
  return { tops, bbox: [x0 + M, y0 + M, x1 - M, y1 - M] };
}

// bake several rocks (back to front) into one card
export function bakeS08Rocks(api, rect, rocks, { paper = PAPER, scale = 1 } = {}) {
  const info = [];
  const src = api.bakeCanvas(rect[2], rect[3], (ctx, { k }) => {
    ctx.translate(-rect[0], -rect[1]);
    for (const R of rocks) info.push(R.lumps ? paintBoulder(ctx, R, k, paper) : paintRock(ctx, R, k, paper));
  }, { scale });
  return { src, rect, info };
}
