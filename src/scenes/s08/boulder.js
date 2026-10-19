// s08: lumpy cascade boulders in the manner of ref 08. A boulder is a crown of many small rounded
// stones (cauliflower silhouette, crisp) over a body that pales downward and dissolves into foam.
// Each stone: dark ink rim, lighter wet centre lit from the upper left, a thin paper line where it
// overlaps the stones behind; speckled pigment, pale dry flecks, short dark cun down the body.
import { dryStroke, stroke, blob, rgba, tone, noisePattern, PAPER } from '../../lib/brush.js';
import { makeRng, makeNoise, clamp, mix } from '../../engine/rng.js';

function lumpPath(x, y, rx, ry, rng, irr = 0.1) {
  const n = 14, ph = rng() * 6.283;
  const P = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const q = 1 + (rng() - 0.5) * irr * 2 + Math.sin(a * 3 + ph) * irr * 0.6;
    P.push([x + Math.cos(a) * rx * q, y + Math.sin(a) * ry * q]);
  }
  const p = new Path2D();
  const m = (i) => { const a = P[i % n], b = P[(i + 1) % n]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
  const s0 = m(n - 1); p.moveTo(s0[0], s0[1]);
  for (let i = 0; i < n; i++) { const c = P[i], e = m(i); p.quadraticCurveTo(c[0], c[1], e[0], e[1]); }
  p.closePath();
  return p;
}

// geometry: crown row of small stones hugging a mound envelope (with notches), a second row of
// bigger stones lower down (front shoulders), and a body polygon below; top(x) for pouring water
export function boulder(cx, yTop, w, h, seed, o = {}) {
  const r = makeRng('s08boulder:' + seed);
  const x0 = cx - w / 2, x1 = cx + w / 2;
  const skew = (r() - 0.5) * 0.6;
  const env = (x) => { const u = Math.min(1.25, Math.abs((x - cx) / (w / 2) - skew * 0.3)); return yTop + h * 0.62 * Math.pow(u, 1.8); };
  const rMin = o.rMin ?? 5, rMax = o.rMax ?? clamp(h * 0.24, 9, 22);
  const lumps = [];
  let x = x0 + rMin * 1.5;
  while (x < x1 - rMin) {
    const rr = mix(rMin, rMax, Math.pow(r(), 1.4));
    const sq = 0.62 + r() * 0.3;
    const notch = r() < 0.2 ? h * (0.06 + r() * 0.12) : 0;
    lumps.push({ x, y: env(x) + rr * sq + notch + (r() - 0.5) * rr * 0.5, rx: rr * (1 + r() * 0.35), ry: rr * sq, row: 0 });
    x += rr * (1.25 + r() * 0.8);
  }
  const crown = lumps.slice();
  // second row: bigger stones lower down, spreading out to the shoulders
  const n2 = Math.max(2, Math.round(w / 50));
  for (let i = 0; i < n2; i++) {
    const s = (i + 0.5 + (r() - 0.5) * 0.6) / n2;
    const bx = x0 - w * 0.14 + w * 1.28 * s;
    const rr = mix(rMax * 0.8, rMax * 1.5, r());
    lumps.push({ x: bx, y: Math.max(env(bx), yTop + h * 0.3) + h * (0.12 + r() * 0.2) + rr * 0.3, rx: rr * (1.1 + r() * 0.4), ry: rr * (0.6 + r() * 0.2), row: 1 });
  }
  const bottom = yTop + h * 1.25;
  const first = crown[0], last = crown[crown.length - 1];
  // sloping sides: bulging, stepped (not straight tent lines)
  const side = (a, b, dir) => {
    const pts = [];
    for (let i = 1; i < 7; i++) {
      const t = i / 7, bulge = Math.sin(Math.PI * t) * w * 0.07 * dir;
      pts.push([mix(a[0], b[0], t) + bulge + (r() - 0.5) * w * 0.05, mix(a[1], b[1], Math.pow(t, 0.8)) + (r() - 0.5) * h * 0.08]);
    }
    return pts;
  };
  const cR = [last.x + last.rx * 0.9, last.y], bR = [x1 + w * 0.42, bottom], bL = [x0 - w * 0.42, bottom], cL = [first.x - first.rx * 0.9, first.y];
  const sR = side(cR, bR, 1), sL = side(bL, cL, -1);
  const body = [cL, ...crown.map((L) => [L.x, L.y]), cR, ...sR, bR, bL, ...sL];
  // stones stepping down the sloping sides (lumpy flanks) and scattered over the body (a pile, not a slab)
  for (const [pts, dir] of [[sR, 1], [sL, -1]]) for (const p of pts) {
    if (p[1] > yTop + h * 0.95 || r() < 0.25) continue;
    const rr = rMax * (0.45 + r() * 0.55);
    lumps.push({ x: p[0] - dir * rr * 0.35, y: p[1] + rr * 0.25, rx: rr * (1 + r() * 0.3), ry: rr * (0.6 + r() * 0.25), row: 2 });
  }
  const inside = (px, py) => {
    let c = false;
    for (let i = 0, j = body.length - 1; i < body.length; j = i++) {
      const a = body[i], b = body[j];
      if ((a[1] > py) !== (b[1] > py) && px < ((b[0] - a[0]) * (py - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  };
  for (let i = 0, n = Math.round((w * h) / (o.pile ?? 900)); i < n; i++) {
    const px = mix(x0 - w * 0.1, x1 + w * 0.1, r()), py = mix(env(px) + h * 0.15, yTop + h * 1.0, r());
    if (!inside(px, py)) continue;
    const rr = rMax * (0.35 + r() * 0.6);
    lumps.push({ x: px, y: py, rx: rr * (1 + r() * 0.4), ry: rr * (0.55 + r() * 0.25), row: 2 });
  }
  const top = (xx) => {
    let best = Infinity;
    for (const L of lumps) { const d = (xx - L.x) / L.rx; if (d > -1 && d < 1) best = Math.min(best, L.y - L.ry * Math.sqrt(1 - d * d)); }
    if (best === Infinity) {
      for (let i = 0; i < body.length - 1; i++) {
        const a = body[i], b = body[i + 1];
        if (xx >= a[0] && xx <= b[0]) { best = mix(a[1], b[1], (xx - a[0]) / Math.max(1e-3, b[0] - a[0])); break; }
      }
    }
    return best === Infinity ? bottom : Math.max(best, yTop);
  };
  const xa = first.x - first.rx, xb = last.x + last.rx;
  return { lumps, body, top, x0: xa, x1: xb, yTop, h, cx, w: xb - xa, bottom };
}

// grey modelling of the white water below each boulder (painted on a card between the water and the
// rocks): a soft shadow where the water leaves the foot, bundles of grey falling streaks, and grey
// splash stipple in the foam where it lands on the next tier
export function paintWaterShade(g, rocks, seed = 1, paper = PAPER) {
  const rng = makeRng('s08shade:' + seed);
  for (const R of rocks) {
    if (R.misty) continue;
    const foot = R.yTop + R.h * ((R.fade ? R.fade[0] + R.fade[1] : 1.8) / 2);
    const L = R.h * 0.55;
    g.save();
    g.filter = 'blur(5px)';
    for (let i = 0; i < 3 + R.w / 40; i++) {
      const x = mix(R.x0 - R.w * 0.1, R.x1 + R.w * 0.1, rng());
      blob(g, x, foot + rng() * L * 0.5, 10 + rng() * 22, { color: tone(0.5 + rng() * 0.2, paper), alpha: 0.12 + rng() * 0.14, rng, squash: 0.45 + rng() * 0.3, irregular: 0.5 });
    }
    g.restore();
    for (let i = 0; i < R.w / 7; i++) {
      const x = mix(R.x0 - R.w * 0.12, R.x1 + R.w * 0.12, rng());
      const y = foot - 4 + rng() * L * 0.4, len = L * (0.25 + rng() * 0.6);
      stroke(g, [[x, y], [x + (rng() - 0.5) * 2, y + len * 0.5], [x + (rng() - 0.5) * 3, y + len]], { width: 0.8 + rng() * 2.4, color: tone(0.35 + rng() * 0.35, paper), alpha: 0.12 + rng() * 0.28, rng, profile: 'taper' });
    }
    for (let i = 0; i < R.w / 2.5; i++) {
      const x = mix(R.x0 - R.w * 0.15, R.x1 + R.w * 0.15, rng());
      const y = foot + L * (0.55 + rng() * 0.5);
      blob(g, x, y, 0.6 + Math.pow(rng(), 2) * 2.4, { color: tone(0.3 + rng() * 0.35, paper), alpha: 0.2 + rng() * 0.35, rng, irregular: 0.5, squash: 0.6 + rng() * 0.4 });
    }
  }
}

// B: boulder() result + { seed, dark (1 = black crown, 0 = misty), fade: [a, b] (fractions of h), tex, speck }
export function paintBoulder(ctx, B, k = 1, paper = PAPER) {
  const rng = makeRng('s08bp:' + B.seed);
  const nz = makeNoise('s08bp-n:' + B.seed);
  const D = B.dark ?? 1;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const L of B.lumps) { x0 = Math.min(x0, L.x - L.rx * 1.3); x1 = Math.max(x1, L.x + L.rx * 1.3); y0 = Math.min(y0, L.y - L.ry * 1.3); y1 = Math.max(y1, L.y + L.ry * 1.3); }
  for (const [x, y] of B.body) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const M = 24;
  x0 = Math.floor(x0 - M); y0 = Math.floor(y0 - M); x1 = Math.ceil(x1 + M); y1 = Math.ceil(y1 + M);
  const W = x1 - x0, H = y1 - y0;
  const cv = new OffscreenCanvas(Math.max(1, Math.ceil(W * k)), Math.max(1, Math.ceil(H * k)));
  const g = cv.getContext('2d');
  g.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
  const top = B.top, hh = B.h, yT = B.yTop;
  const bodyP = new Path2D();
  B.body.forEach(([x, y], i) => (i ? bodyP.lineTo(x, y) : bodyP.moveTo(x, y)));
  bodyP.closePath();
  const lumpP = B.lumps.map((L) => lumpPath(L.x, L.y, L.rx, L.ry, rng, 0.11));

  // 1. silhouette in paper (occludes the water behind)
  g.fillStyle = rgba(paper, 1);
  g.fill(bodyP);
  for (const p of lumpP) g.fill(p);
  g.globalCompositeOperation = 'source-atop';
  // 2. base wash: dark at the crown, paler down the face, pooled unevenly
  const gr = g.createLinearGradient(0, yT, 0, yT + hh * 1.2);
  gr.addColorStop(0, rgba(tone(mix(0.62, 0.1, D), paper)));
  gr.addColorStop(0.45, rgba(tone(mix(0.72, 0.3, D), paper)));
  gr.addColorStop(1, rgba(tone(mix(0.8, 0.42, D), paper)));
  g.fillStyle = gr; g.fillRect(x0, y0, W, H);
  g.filter = `blur(${2.5 * k}px)`;
  for (let i = 0; i < (W * H) / 1400; i++) {
    const x = mix(x0, x1, rng()), y = mix(yT, y1, rng());
    const dark = rng() < 0.6;
    blob(g, x, y, 6 + rng() * 22, { color: tone(dark ? rng() * 0.18 : 0.72 + rng() * 0.15, paper), alpha: (dark ? 0.2 + rng() * 0.3 : 0.25 + rng() * 0.3) * (dark ? D : 1), rng, squash: 0.6 + rng() * 0.6, irregular: 0.45 });
  }
  g.filter = 'none';
  // 3. body: short dark cun strokes and pale reserved streaks (water sliding over the face)
  for (let i = 0; i < ((B.tex ?? 1) * W * H) / 320; i++) {
    const x = mix(x0, x1, rng()), y = mix(yT, y1, rng());
    if (y < top(x) + 6) continue;
    const len = 6 + rng() * 26, sl = (rng() - 0.5) * 0.25;
    const pts = [[x, y], [x + sl * len * 0.5, y + len * 0.5], [x + sl * len, y + len]];
    if (rng() < 0.62) dryStroke(g, pts, { width: 3 + rng() * 6, bristles: 3 + ((rng() * 3) | 0), color: tone(rng() * 0.22, paper), alpha: (0.3 + rng() * 0.45) * mix(0.5, 1, D), dry: 0.35 + rng() * 0.3, rng });
    else stroke(g, pts, { width: 1 + rng() * 3, color: tone(0.8 + rng() * 0.15, paper), alpha: 0.35 + rng() * 0.45, rng, profile: 'taper' });
  }
  // 4. stones, back (high) to front (low): paper rim, dark ink edge, lighter wet centre
  const order = B.lumps.map((L, i) => i).sort((a, b) => (B.lumps[a].y - B.lumps[a].ry * 0.5) - (B.lumps[b].y - B.lumps[b].ry * 0.5));
  // stones merge into one dark mass; only a few show a broken paper rim, many carry an irregular
  // pale wet highlight on the upper left (soft-edged dab, not a ring)
  for (const i of order) {
    const L = B.lumps[i], p = lumpP[i];
    const depth = clamp((L.y - yT) / hh, 0, 1.4);
    const v = clamp(mix(0.5, 0.05, D) * (0.4 + rng() * 1.2) + depth * 0.22 + L.row * 0.05, 0, 0.85);
    if (rng() < 0.22) {
      g.lineWidth = 0.8 + rng() * 0.8; g.strokeStyle = rgba(tone(0.88, paper), 0.35 + rng() * 0.3);
      g.beginPath(); g.ellipse(L.x, L.y, L.rx, L.ry, 0, Math.PI * (1.05 + rng() * 0.2), Math.PI * (1.55 + rng() * 0.35)); g.stroke();
    }
    g.fillStyle = rgba(tone(v, paper), 0.75 + rng() * 0.25); g.fill(p);
    if (rng() < 0.75) {
      g.filter = `blur(${(0.5 + L.rx * 0.04) * k}px)`;
      blob(g, L.x - L.rx * (0.15 + rng() * 0.25), L.y - L.ry * (0.05 + rng() * 0.3), Math.max(1.5, Math.min(L.rx, L.ry) * (0.3 + rng() * 0.3)),
        { color: tone(clamp(v + 0.32 + rng() * 0.3, 0, 0.9), paper), alpha: 0.5 + rng() * 0.35, rng, irregular: 0.55, squash: 0.55 + rng() * 0.4, rot: rng() * 3 });
      g.filter = 'none';
    }
  }
  // 5. pigment: granulation, dark speckle (denser near the crown), pale dry flecks
  g.globalAlpha = 0.24; g.fillStyle = noisePattern(g, { cell: 2.2, seed: B.seed % 97, contrast: 2.4 }); g.fillRect(x0, y0, W, H);
  g.globalAlpha = 0.14; g.fillStyle = noisePattern(g, { cell: 7, seed: (B.seed + 3) % 97, contrast: 1.8 }); g.fillRect(x0, y0, W, H);
  g.globalAlpha = 1;
  for (let i = 0; i < ((B.speck ?? 1) * W * H) / 90; i++) {
    const x = mix(x0, x1, rng()), y = mix(yT - 4, y1, rng());
    const t = top(x);
    if (y < t + 1) continue;
    const d = (y - t) / hh;
    if (rng() > Math.exp(-d * 2.2) * (0.5 + 0.5 * nz.n2(x * 0.05, y * 0.05 + 3))) continue;
    blob(g, x, y, 0.7 + Math.pow(rng(), 2.4) * 5, { color: tone(rng() * 0.14, paper), alpha: (0.45 + rng() * 0.5) * mix(0.4, 1, D), rng, irregular: 0.5, squash: 0.6 + rng() * 0.5, rot: rng() * 3 });
  }
  for (let i = 0; i < (W * H) / 1100; i++) {
    const x = mix(x0, x1, rng()), y = mix(yT, y1, rng());
    if (y < top(x) + 3) continue;
    blob(g, x, y, 0.5 + rng() * 1.2, { color: tone(0.7, paper), alpha: 0.2 + rng() * 0.3, rng, irregular: 0.5, squash: 0.5 + rng() * 0.4 });
  }
  g.globalCompositeOperation = 'source-over';
  // 6. ragged dark contour on the stone tops and a few moss dots breaking the silhouette
  if (D > 0.3) {
    const tops = [];
    for (let x = B.x0; x <= B.x1; x += 3) tops.push([x, top(x)]);
    for (let i = 0; i < tops.length - 3; i += 2 + ((rng() * 3) | 0)) {
      const seg = tops.slice(i, i + 3 + ((rng() * 3) | 0)).map(([x, y]) => [x, y + 1.2]);
      if (seg.length > 1) stroke(g, seg, { width: (1.4 + rng() * 2.4) * D, color: tone(0.03, paper), alpha: 0.85, rng });
    }
    for (let i = 0; i < (B.w / 26) * D; i++) {
      const x = mix(B.x0, B.x1, rng()), t = top(x);
      for (let j = 0; j < 2 + rng() * 4; j++) blob(g, x + (rng() - 0.5) * 8, t - rng() * 3 + 1, 0.8 + rng() * 2, { color: tone(0.03, paper), alpha: 0.8, rng, irregular: 0.4, squash: 0.8 });
    }
  }
  // 7. dissolve into foam: ragged blurred erase from the fade line down
  const [fa, fb] = B.fade || [0.72, 1.1];
  const ecv = new OffscreenCanvas(cv.width, cv.height);
  const eg = ecv.getContext('2d');
  eg.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
  // the foot is swallowed by billowing foam: a thin veil above, then round puffs eating into the
  // rock along a wandering line, solid below (crisp lumpy white edge, not a soft fog)
  const f0 = yT + hh * fa, f1 = yT + hh * fb;
  const line = (x) => f0 + (nz.n2(x * 0.018, 1.7) * 0.5 + nz.n2(x * 0.07, 2.9) * 0.25 + 0.4) * (f1 - f0);
  for (let x = x0; x < x1; x += 4) {
    const a = line(x), v = (f1 - f0) * 0.45;
    const eg2 = eg.createLinearGradient(0, a - v, 0, a);
    eg2.addColorStop(0, 'rgba(0,0,0,0)'); eg2.addColorStop(1, 'rgba(0,0,0,0.22)');
    eg.fillStyle = eg2; eg.fillRect(x, a - v, 4.5, v);
    eg.fillStyle = '#000'; eg.fillRect(x - 0.5, a, 5, y1 - a + 40);
  }
  eg.fillStyle = '#000';
  for (let x = x0; x < x1;) {
    const pr = 3 + Math.pow(rng(), 1.5) * 13;
    blob(eg, x, line(x) - pr * (0.3 + rng() * 0.35), pr, { color: [0, 0, 0], alpha: 1, rng, irregular: 0.35, squash: 0.65 + rng() * 0.35, rot: rng() * 3 });
    x += pr * (0.45 + rng() * 0.5);
  }
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'destination-out';
  g.filter = `blur(${1.6 * k}px)`;
  g.drawImage(ecv, 0, 0);
  g.restore();
  ctx.drawImage(cv, x0, y0, W, H);
  return { bbox: [x0 + M, y0 + M, x1 - M, y1 - M] };
}
