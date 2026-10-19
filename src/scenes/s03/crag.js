// s03 helper: near cliffs of ref 03 painted as wet, mottled ink (Canvas2D dabs + a strong wet-ink GPU
// pass). Faces are built from many soft vertical wet dabs (denser and darker near the top contour and
// along fissures), speckled moss dots, a dark ragged contour, then a noisy mist dissolve at the base.
// Foliage masses are painted into the same bake so they bleed and mottle together with the rock.
//
// paintCrag(ctx, rng, nz, { profile:[[x,y]...], base, fade:[y0,y1] | (x)=>[y0,y1], tone, dabs, lean,
//            fissures:[{ pts, w, a }], light:[{ x, w, a }] (lit face: less ink), cun (long dry hemp strokes per 10 px),
//            speckle, paper, k })
import { stroke, dryStroke, blob, rgba, tone as toneRGB, PAPER } from '../../lib/brush.js';

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function profileFn(pts) {
  return (x) => {
    if (x <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i]; const t = (x - ax) / (bx - ax || 1); return ay + (by - ay) * t; }
    return pts[pts.length - 1][1];
  };
}

export function paintCrag(ctx, r, nz, o) {
  const paper = o.paper || PAPER;
  const k = o.k || 1;
  const prof = o.profile;
  const x0 = prof[0][0], x1 = prof[prof.length - 1][0];
  const base = o.base;
  const topRaw = profileFn(prof);
  const top = (x) => topRaw(x) + 3 * nz.n2(x / 9, 1.7) + 1.5 * nz.n2(x / 3, 4.1);
  const fadeAt = typeof o.fade === 'function' ? o.fade : () => o.fade;
  const vD = 1 - (o.tone ?? 0.9);
  const ink = (v, a) => rgba(toneRGB(Math.min(1, Math.max(0, v)), paper), a);
  const lean = o.lean ?? 0;
  const bx = Math.floor(x0 - 20), by = Math.floor(Math.min(...prof.map((p) => p[1])) - 30), bw = Math.ceil(x1 - x0 + 40), bh = Math.ceil(base - by + 4);
  const cv = new OffscreenCanvas(Math.max(1, Math.ceil(bw * k)), Math.max(1, Math.ceil(bh * k)));
  const g = cv.getContext('2d');
  g.setTransform(k, 0, 0, k, -bx * k, -by * k);
  const path = new Path2D();
  path.moveTo(x0, base + 2);
  for (let x = x0; x <= x1; x += 2) path.lineTo(x, top(x));
  path.lineTo(x1, base + 2); path.closePath();
  g.fillStyle = rgba(paper, 1); g.fill(path);
  g.save(); g.clip(path);
  // presence: 1 near the top contour, fading toward the dissolve
  const lit = (x) => { let m = 1; for (const L of o.light || []) m *= 1 - L.a * Math.exp(-(((x - L.x) / L.w) ** 2)); return m; };
  const presRaw = (x, y) => { const [f0, f1] = fadeAt(x); return 1 - ss(f0, f1, y + nz.fbm2(x / 70, y / 40, 2) * 40); };
  const pres = (x, y) => presRaw(x, y) * lit(x);
  // 0. optional body wash (darker under the top, fading toward the dissolve)
  if (o.body) {
    g.save(); g.filter = `blur(${(4 * k).toFixed(1)}px)`;
    for (let x = x0; x < x1; x += 6) {
      const t = top(x), [f0, f1] = fadeAt(x);
      const gr = g.createLinearGradient(0, t, 0, f1);
      const a = o.body * lit(x) * (0.75 + 0.5 * Math.max(-0.5, nz.n2(x / 60, 3.3)));
      gr.addColorStop(0, ink(vD, Math.min(1, a))); gr.addColorStop(0.5, ink(vD, Math.min(1, a) * 0.55)); gr.addColorStop(1, ink(vD, 0));
      g.fillStyle = gr; g.fillRect(x - 1, t - 4, 8, f1 - t + 8);
    }
    g.restore();
  }
  // 1. pale body wash dabs (big, soft)
  g.save(); g.filter = `blur(${(6 * k).toFixed(1)}px)`;
  const area = (x1 - x0) * (base - by);
  for (let i = 0; i < area / 3600 * (o.wash ?? 1); i++) {
    const x = x0 + r() * (x1 - x0), t = top(x), y = t + Math.pow(r(), 1.4) * (base - t);
    const p = pres(x, y); if (p < 0.05) continue;
    blob(g, x, y, r.range(14, 40), { color: ink(vD, r.range(0.04, 0.15) * p * (0.5 + 0.9 * Math.max(0, nz.n2(x / 160, y / 220)))), rng: r, irregular: 0.5, squash: r.range(1.6, 3), rot: Math.PI / 2 + lean * 0.6 });
  }
  g.restore();
  // 2. face texture: elongated wet dabs in vertical runs (hemp-fibre cun read as mottled streaks)
  const nRun = Math.round((x1 - x0) / 14 * (o.dabs ?? 1));
  for (let i = 0; i < nRun; i++) {
    const x = x0 + r() * (x1 - x0), t = top(x);
    const len = (base - t) * r.range(0.15, 0.7);
    const y0 = t + Math.pow(r(), 2) * (base - t) * 0.4;
    const dark = Math.pow(r(), 2.2);
    let xx = x;
    for (let y = y0; y < y0 + len; y += r.range(4, 9)) {
      const p = pres(xx, y) * (1 - 0.6 * (y - y0) / len); if (p < 0.04) break;
      xx += lean * 6 + r.range(-1.2, 1.2);
      blob(g, xx, y, r.range(1.6, 4.5), { color: ink(vD + 0.2 * (1 - dark), (0.08 + 0.5 * dark) * p * (o.dabA ?? 1)), rng: r, irregular: 0.6, squash: r.range(1.8, 3.2), rot: Math.PI / 2 + lean });
    }
  }
  // 2b. hemp-fibre cun: long, thin, dry vertical strokes (visible on the lit faces too)
  if (o.cun) {
    g.save(); g.filter = `blur(${((o.cunBlur ?? 1.8) * k).toFixed(1)}px)`;
    const nC = Math.round((x1 - x0) / 10 * o.cun);
    for (let i = 0; i < nC; i++) {
      const x = x0 + r() * (x1 - x0), t = top(x);
      const y0 = t + r.range(2, 30) + Math.pow(r(), 1.6) * (base - t) * 0.45;
      const p = presRaw(x, y0) * (0.35 + 0.65 * lit(x)); if (p < 0.12) continue;
      const len = r.range(50, 220) * (0.5 + 0.5 * p);
      const pts = []; let xx = x;
      for (let q = 0; q <= 6; q++) { const y = y0 + len * q / 6; pts.push([xx, y]); xx += lean * len / 10 + r.range(-1.5, 1.5) + nz.n2(x / 40, y / 50) * 1.2; }
      dryStroke(g, pts, { width: r.range(5, 16), bristles: 4, color: ink(vD + r.range(0.2, 0.5), 1), alpha: r.range(0.15, 0.4) * p, dry: 0.45, rng: r, profile: 'taper' });
    }
    g.restore();
  }
  // 3. fissures: wet dark bands (soft wash + stacked dabs + thin crisp lines)
  for (const F of o.fissures || []) {
    const w = F.w ?? 30, a = F.a ?? 0.6;
    g.save(); g.filter = `blur(${(w * 0.18 * k).toFixed(1)}px)`;
    for (let j = 0; j + 1 < F.pts.length; j++) {
      const [ax, ay] = F.pts[j], [cx, cy] = F.pts[j + 1];
      const n = Math.ceil(Math.hypot(cx - ax, cy - ay) / 8);
      for (let q = 0; q < n; q++) {
        const s = q / n, x = ax + (cx - ax) * s, y = ay + (cy - ay) * s;
        const fall = 1 - (j + s) / (F.pts.length - 1);
        blob(g, x + r.range(-0.4, 0.4) * w, y, w * r.range(0.25, 0.5) * (0.5 + 0.5 * fall), { color: ink(vD * 0.8, a * r.range(0.3, 0.7) * (0.3 + 0.7 * fall)), rng: r, irregular: 0.6, squash: 1.8, rot: Math.PI / 2 });
      }
    }
    g.restore();
    for (let m = 0; m < (F.n ?? 4); m++) {
      const off = r.range(-0.45, 0.45) * w, cut = Math.max(2, Math.round(F.pts.length * r.range(0.4, 1)));
      const pts = F.pts.slice(0, cut).map((q, j) => [q[0] + off + nz.n2(m * 3.1, j * 0.9) * 4, q[1] + r.range(-3, 3)]);
      stroke(g, pts, { width: [r.range(1.2, 3.2), 0.4], profile: 'taper', color: ink(vD * 0.7, a * r.range(0.5, 0.95)), rng: r, rough: 0.6 });
    }
  }
  // 3b. axe-cut strokes: long side-of-brush strokes dragged down along the fissures (slightly fanned),
  //     dark at the start, plus a crisp broken contour line down the steep parts of the profile
  if (o.axe) {
    for (const F of o.fissures || []) {
      const segL = F.pts.slice(1).map((q, j) => Math.hypot(q[0] - F.pts[j][0], q[1] - F.pts[j][1])), tot = segL.reduce((p, q) => p + q, 0);
      const nA = Math.round(tot / 14 * o.axe * (F.a ?? 0.6));
      for (let i = 0; i < nA; i++) {
        let d = r() * tot * 0.85, j = 0; while (j < segL.length - 1 && d > segL[j]) { d -= segL[j]; j++; }
        const [ax, ay] = F.pts[j], [qx, qy] = F.pts[j + 1], s = d / segL[j];
        const side = r() < 0.5 ? -1 : 1, off = side * r.range(0.1, 0.6) * (F.w ?? 30);
        const x = ax + (qx - ax) * s + off, y = ay + (qy - ay) * s;
        const p = presRaw(x, y) * (0.5 + 0.5 * lit(x)); if (p < 0.15) continue;
        const L = r.range(24, 70), ang = Math.atan2(qy - ay, qx - ax) + side * r.range(0.05, 0.3);
        const pts = []; for (let q = 0; q <= 5; q++) { const t = q / 5; pts.push([x + Math.cos(ang) * L * t + nz.n2(x / 20, t * 2) * 2, y + Math.sin(ang) * L * t]); }
        if (r() < 0.6) dryStroke(g, pts, { width: r.range(6, 15), bristles: 5, color: ink(vD * 0.6, 1), alpha: r.range(0.2, 0.45) * p, dry: 0.5, rng: r, profile: 'taper' });
        else stroke(g, pts, { width: [r.range(1.5, 3.5), 0.3], profile: 'taper', color: ink(vD * 0.5, r.range(0.35, 0.7) * p), rng: r, rough: 0.6 });
      }
    }
    let run = [];
    const flush = () => { if (run.length > 3) stroke(g, run, { width: [r.range(1.6, 3.4), 0.5], profile: 'taper', color: ink(vD * 0.4, r.range(0.5, 0.85)), rng: r, rough: 0.6 }); run = []; };
    for (let j = 1; j < prof.length; j++) {
      const [ax, ay] = prof[j - 1], [qx, qy] = prof[j];
      if (Math.abs(qy - ay) < Math.abs(qx - ax) * 1.2) { flush(); continue; }
      const n = Math.ceil(Math.hypot(qx - ax, qy - ay) / 6);
      for (let q = 0; q <= n; q++) { const t = q / n, x = ax + (qx - ax) * t, y = ay + (qy - ay) * t; if (presRaw(x, y) < 0.25) { flush(); continue; } run.push([x + nz.n2(y / 14, 2.2) * 1.5 - Math.sign(qx - ax || 1) * 1.5, y]); if (run.length > 18 && r() < 0.2) flush(); }
    }
    flush();
  }  // 4. dark wet band and ragged contour under the top
  for (let x = x0; x <= x1; x += r.range(3, 7)) {
    const t = top(x);
    if (r() < 0.75) blob(g, x, t + r.range(1, 9), r.range(3, 9), { color: ink(vD * 0.6, r.range(0.35, 0.8)), rng: r, irregular: 0.55, squash: 0.7 });
  }
  // 5. moss speckles: scattered dark dots, denser near the top and along fissures
  for (let i = 0; i < (x1 - x0) * 0.9 * (o.speckle ?? 1); i++) {
    const x = x0 + r() * (x1 - x0), t = top(x), y = t + Math.pow(r(), 2.2) * (base - t) * 0.7;
    const p = pres(x, y); if (p < 0.2 || r() > p) continue;
    blob(g, x, y, r.range(0.7, 2.6), { color: ink(vD * 0.5, r.range(0.5, 0.95)), rng: r, irregular: 0.4, squash: r.range(0.6, 1.2) });
  }
  g.restore();
  // 6. mist dissolve toward the base (noisy low-res mask)
  const ds = 4;
  const mw = Math.ceil(bw / ds), mh = Math.ceil(bh / ds);
  const mc = new OffscreenCanvas(mw, mh);
  const mg = mc.getContext('2d');
  const img = mg.createImageData(mw, mh);
  for (let jy = 0; jy < mh; jy++) for (let ix = 0; ix < mw; ix++) {
    const X = bx + (ix + 0.5) * ds, Y = by + (jy + 0.5) * ds;
    const [f0, f1] = fadeAt(X);
    const n = nz.fbm2(X / 90, Y / 36, 3);
    img.data[(jy * mw + ix) * 4 + 3] = Math.round((1 - ss(f0, f1, Y + n * (f1 - f0) * 0.5)) * 255);
  }
  mg.putImageData(img, 0, 0);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'destination-in';
  g.imageSmoothingEnabled = true;
  g.drawImage(mc, 0, 0, mw, mh, 0, 0, mw * ds * k, mh * ds * k);
  ctx.drawImage(cv, bx, by, cv.width / k, cv.height / k);
  return { top };
}
