// s10 autumn ruins: forested slopes in the manner of ref 10.
// A slope is a silhouette (top contour, left -> right) filled with paper (occludes what is behind),
// washed with grey rock tone and vertical cun strokes, crowded with soft wet conifers (dense along
// the crest, clumped down the slope, paler lower down) and dissolved into mist toward its base.
// Layers are painted on separate canvases and softened by different amounts (wet ink): body wash
// (blurred), back trees (soft, pale), front trees (crisper, darker).
import { paintConifer } from '../../lib/pine.js';
import { blob, stroke, rgba, tone, smoothPath, PAPER } from '../../lib/brush.js';
import { makeRng, makeNoise, clamp, mix, smoothstep } from '../../engine/rng.js';

function sampler(pts) {
  const P = smoothPath(pts, 3).slice().sort((a, b) => a[0] - b[0]);
  return (x) => {
    if (x <= P[0][0]) return P[0][1];
    if (x >= P[P.length - 1][0]) return P[P.length - 1][1];
    let lo = 0, hi = P.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m][0] <= x) lo = m; else hi = m; }
    const t = (x - P[lo][0]) / ((P[hi][0] - P[lo][0]) || 1);
    return mix(P[lo][1], P[hi][1], t);
  };
}

// s: { contour:[[x,y]...], base (y fully dissolved), fade (0..1 crest->base where the dissolve starts),
//      tone (crest tree value), toneFall (added down the slope), toneJit, rock (body wash value), body (wash alpha),
//      trees (density), h:[min,max] tree px, crest (crest density), cover (0..1 reach down the slope), cun,
//      soft (tree blur px), pineShare, clump, clumpScale, fadeNoise px, seed }
export function paintSlope(ctx, s) {
  const seed = s.seed ?? 1;
  const rng = makeRng('s10slope:' + seed);
  const nz = makeNoise('s10slope-n:' + seed);
  const paper = s.paper || PAPER;
  const top = sampler(s.contour);
  const xs = s.contour.map((p) => p[0]);
  const X0 = Math.min(...xs), X1 = Math.max(...xs);
  const base = s.base;
  const fadeF = s.fade ?? 0.35;
  const [h0, h1] = s.h ?? [16, 34];
  const tn = s.tone ?? 0.3;
  const rockV = s.rock ?? 0.62;
  const soft = s.soft ?? 1.0;
  const k = ctx.getTransform().a || 1;
  const yTop = Math.min(...s.contour.map((p) => p[1]));
  const M = h1 * 1.3 + 12;
  const bx = Math.floor(X0 - M), by = Math.floor(yTop - M), bw = Math.ceil(X1 - X0 + 2 * M), bh = Math.ceil(base - by + 8);
  const W = Math.max(1, Math.ceil(bw * k)), H = Math.max(1, Math.ceil(bh * k));
  const mk = () => { const c = new OffscreenCanvas(W, H); const g = c.getContext('2d'); g.setTransform(k, 0, 0, k, -bx * k, -by * k); return [c, g]; };
  const [cv, g] = mk();          // final
  const [cb, gb] = mk();         // body wash
  const [ct1, gt1] = mk();       // back trees
  const [ct2, gt2] = mk();       // front trees

  const fadeTop = (x) => mix(top(x), base, fadeF);
  // ---- silhouette + body wash
  const sil = new Path2D();
  sil.moveTo(X0, base + 4);
  for (let x = X0; x <= X1; x += 3) sil.lineTo(x, top(x) + 3);
  sil.lineTo(X1, top(X1) + 3); sil.lineTo(X1, base + 4); sil.closePath();
  g.fillStyle = rgba(paper, 1);
  g.fill(sil);
  gb.save();
  gb.clip(sil);
  const rockC = tone(rockV, paper);
  const grd = gb.createLinearGradient(0, yTop, 0, base);
  const bA = s.body ?? 0.72;
  grd.addColorStop(0, rgba(rockC, bA)); grd.addColorStop(0.5, rgba(rockC, bA * 0.75)); grd.addColorStop(1, rgba(rockC, bA * 0.4));
  gb.fillStyle = grd;
  gb.fill(sil);
  const darkC = tone(Math.max(0.1, rockV - 0.2), paper);
  for (let i = 0; i < (s.washBlots ?? 1) * (X1 - X0) / 5; i++) {
    const x = mix(X0, X1, rng());
    const t0 = top(x);
    const d = Math.pow(rng(), 1.3) * (base - t0) * 0.8;
    const a = (0.06 + 0.16 * rng()) * (1 - d / (base - t0)) * (s.wash ?? 1);
    blob(gb, x, t0 + d, 5 + rng() * 20, { color: rgba(rng() < 0.5 ? darkC : rockC, a), rng, irregular: 0.45, squash: 0.45 + rng() * 0.5, rot: rng() * 3 });
  }
  const nCun = Math.round((s.cun ?? 1) * (X1 - X0) / 5);
  const cunC = tone(Math.max(0.1, rockV - 0.35), paper);
  for (let i = 0; i < nCun; i++) {
    const x = mix(X0, X1, rng());
    const t0 = top(x);
    const y = t0 + Math.pow(rng(), 1.1) * (base - t0) * 0.7;
    const L = 8 + rng() * 36;
    const sl = (rng() - 0.5) * 0.3;
    stroke(gb, [[x, y], [x + sl * L * 0.5 + (rng() - 0.5) * 2, y + L * 0.5], [x + sl * L, y + L]], {
      width: 0.8 + rng() * 2.4, color: cunC, alpha: (0.15 + rng() * 0.35) * (1 - (y - t0) / (base - t0)), rng, profile: 'brush', rough: 0.3,
    });
  }
  gb.restore();

  // ---- trees
  const trees = [];
  const dens = s.trees ?? 1;
  const cover = s.cover ?? 0.7;
  const clump = s.clump ?? 0.5;
  const cs = s.clumpScale ?? 80;
  const span = X1 - X0;
  const hm = (h0 + h1) / 2;
  // crest: 2-3 overlapping rows
  const nCrest = Math.round(span / (hm * 0.2) * (s.crest ?? 1) * dens);
  for (let i = 0; i < nCrest; i++) {
    const x = mix(X0, X1, rng());
    const row = rng();
    trees.push({ x, y: top(x) + 2 + row * hm * 0.55, crest: true, back: row < 0.35 });
  }
  const nSlope = Math.round(span * (base - yTop) * cover / (hm * hm * 0.13) * dens);
  for (let i = 0; i < nSlope; i++) {
    const x = mix(X0, X1, rng());
    const t0 = top(x);
    const u = Math.pow(rng(), 1.15) * cover;
    const y = t0 + hm * 0.4 + u * (base - t0);
    const c = nz.n2(x / cs, y / (cs * 0.6)) * 0.75 + nz.n2(x / (cs * 0.35), y / (cs * 0.25)) * 0.25;
    if (c < (clump - 0.5) * 1.2 + (rng() - 0.5) * 0.25) continue;
    trees.push({ x, y, back: rng() < 0.45 });
  }
  trees.sort((a, b) => a.y - b.y);
  const pineShare = s.pineShare ?? 0.55;
  const massC = tone(Math.min(0.85, tn + 0.22), paper);
  for (const T of trees) {
    const t0 = top(T.x);
    const u = clamp((T.y - t0) / Math.max(1, base - t0));
    const h = mix(h0, h1, Math.pow(rng(), 0.8)) * (T.crest ? 1 : mix(1, 0.75, u)) * (T.back ? 0.8 : 1);
    const tv = clamp(tn + u * (s.toneFall ?? 0.3) + (T.back ? 0.14 : 0) + (rng() - 0.5) * (s.toneJit ?? 0.12), 0, 0.92);
    const gg = T.back ? gt1 : gt2;
    // soft wash mass at the tree's foot merges neighbours into a forest
    blob(gb, T.x, T.y - h * 0.15, h * (0.35 + rng() * 0.2), { color: rgba(massC, 0.22 + 0.16 * rng()), rng, irregular: 0.4, squash: 0.6 });
    // canopy texture: small dark dabs clustered around the crown
    const nd = 3 + ((rng() * 4) | 0);
    const dc = tone(clamp(tv + 0.08, 0, 0.9), paper);
    for (let q = 0; q < nd; q++) blob(gb, T.x + (rng() - 0.5) * h * 0.9, T.y - h * (0.1 + rng() * 0.5), h * (0.06 + rng() * 0.08), { color: rgba(dc, 0.35 + 0.4 * rng()), rng, irregular: 0.4, squash: 0.7 });
    paintConifer(gg, T.x, T.y + h * 0.06, h, {
      kind: rng() < pineShare ? 'pine' : (rng() < 0.25 ? 'spruce' : 'fir'),
      tone: tv, rng, lean: (rng() - 0.5) * 12, width: 0.9 + rng() * 0.6, paper,
    });
  }
  // ---- compose (each layer softened like wet ink)
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.filter = `blur(${(1.6 * k).toFixed(2)}px)`;
  g.drawImage(cb, 0, 0);
  g.filter = `blur(${(soft * 1.5 * k).toFixed(2)}px)`;
  g.drawImage(ct1, 0, 0);
  g.filter = `blur(${(soft * 0.7 * k).toFixed(2)}px)`;
  g.drawImage(ct2, 0, 0);
  g.filter = 'none';
  g.restore();
  // ---- mist dissolve toward the base (low-res mask, noisy edge)
  const ds = 4;
  const mw = Math.ceil(bw / ds), mh = Math.ceil(bh / ds);
  const mc = new OffscreenCanvas(mw, mh), mg = mc.getContext('2d');
  const id = mg.createImageData(mw, mh);
  const amp = s.fadeNoise ?? 40;
  for (let j = 0; j < mh; j++) for (let i = 0; i < mw; i++) {
    const x = bx + i * ds, y = by + j * ds;
    const f0 = fadeTop(x);
    const n = nz.n2(x / 70, y / 45) * 0.6 + nz.n2(x / 23, y / 17) * 0.4;
    let a = (1 - smoothstep(f0, base, y + n * amp)) * (1 - smoothstep(base - 24, base, y));
    // (s10) misty side ends: the slope dissolves at its first / last contour x instead of a cut
    const ew = s.edge ?? 90;
    if (ew > 0) { const xx = x + n * ew * 0.6; a *= smoothstep(X0, X0 + ew, xx) * (1 - smoothstep(X1 - ew, X1, xx)); }
    id.data[(j * mw + i) * 4 + 3] = Math.round(clamp(a) * 255);
  }
  mg.putImageData(id, 0, 0);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'destination-in';
  g.imageSmoothingEnabled = true;
  g.drawImage(mc, 0, 0, mw, mh, 0, 0, mw * ds * k, mh * ds * k);
  const ga = ctx.globalAlpha;
  ctx.globalAlpha = 1;
  ctx.drawImage(cv, bx, by, cv.width / k, cv.height / k);
  ctx.globalAlpha = ga;
  return { top, bbox: [bx, by, bx + bw, by + bh] };
}
