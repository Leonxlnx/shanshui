// rock.js - near cliffs, crags, boulders and islands (first draft, see bottom for API doc)
import { blob, stroke, dryStroke, smoothPath, rgba, tone as inkTone, PAPER, INK } from './brush.js';
import { makeRng, makeNoise, clamp, mix, smoothstep } from '../engine/rng.js';
import { texFromSource } from '../engine/gl.js';

const DEG = Math.PI / 180;

// ------------------------------------------------------------------ polygon helpers
export function polyBBox(poly) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of poly) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}
function tracePoly(ctx, poly) {
  ctx.moveTo(poly[0][0], poly[0][1]);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
  ctx.closePath();
}
function polyPath(poly) { const p = new Path2D(); tracePoly(p, poly); return p; }
// all y where the vertical line x crosses the polygon boundary (sorted)
function crossingsY(poly, x) {
  const ys = [];
  for (let i = 0, n = poly.length; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    if ((a[0] <= x && b[0] > x) || (b[0] <= x && a[0] > x)) ys.push(a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]));
  }
  return ys.sort((p, q) => p - q);
}
export function topYAt(poly, x) { const ys = crossingsY(poly, x); return ys.length ? ys[0] : null; }
export function bottomYAt(poly, x) { const ys = crossingsY(poly, x); return ys.length ? ys[ys.length - 1] : null; }
function crossingsX(poly, y) {
  const xs = [];
  for (let i = 0, n = poly.length; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]));
  }
  return xs.sort((p, q) => p - q);
}
// resample a closed polygon to ~step spacing and displace along normals with 1D noise (ragged edge)
function roughen(poly, nz, { step = 5, amp = 3, freq = 0.06, closed = true } = {}) {
  const out = [];
  const n = poly.length;
  let s = 0;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
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
  if (!closed) out.push(poly[n - 1]);
  return out;
}

// ------------------------------------------------------------------ brush vocabulary
// Moss / foliage clump: scalloped cluster of ink lobes with satellites (dark, crisp, rounded top).
function blobPath(x, y, r, rng, irregular = 0.3, squash = 1, rot = 0) {
  const n = 9 + ((rng() * 4) | 0), ph = rng() * 6.283, P = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (1 + (rng() - 0.5) * irregular * 2 + Math.sin(a * 2 + ph) * irregular * 0.3);
    const px = Math.cos(a) * rr, py = Math.sin(a) * rr * squash;
    P.push([x + px * Math.cos(rot) - py * Math.sin(rot), y + px * Math.sin(rot) + py * Math.cos(rot)]);
  }
  const path = new Path2D();
  const m = (i) => { const a = P[i % n], b = P[(i + 1) % n]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
  const s0 = m(n - 1); path.moveTo(s0[0], s0[1]);
  for (let i = 0; i < n; i++) { const e = m(i); path.quadraticCurveTo(P[i][0], P[i][1], e[0], e[1]); }
  path.closePath();
  return path;
}

export function paintMoss(ctx, x, y, r, rng, { color = INK, alpha = 1, greys = 0.35, flat = 0.62, satellites = 1, separation = 0.12, snow = 0, snowColor = [247, 246, 243] } = {}) {
  // cluster of rounded dabs drawn back (top) to front (bottom); a thin paper line is left where a front
  // dab overlaps the ones behind, giving the scalloped "cloud" edges of the reference foliage masses
  const n = 3 + Math.round(r / 3.2);
  const lobes = [];
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * r * 0.72;
    lobes.push([x + Math.cos(a) * d * 1.25, y + Math.sin(a) * d * flat, r * (0.24 + 0.28 * rng())]);
  }
  lobes.sort((p, q) => p[1] - q[1]);
  if (greys > 0) for (let i = 0; i < Math.ceil(1 + r * 0.12 * greys); i++) {
    blob(ctx, x + (rng() - 0.5) * r * 1.6, y + (rng() - 0.2) * r * 0.5, r * (0.3 + rng() * 0.35), { color: inkTone(0.38 + rng() * 0.22), alpha: alpha * 0.5, rng, irregular: 0.4, squash: 0.7 });
  }
  const css = typeof color === 'string' ? color : rgba(color, 1);
  for (let i = 0; i < lobes.length; i++) {
    const [lx, ly, lr] = lobes[i];
    const path = blobPath(lx, ly, lr, rng, 0.22, 0.72 + rng() * 0.3, rng() * 3);
    if (i > 0 && rng() < separation) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = Math.max(0.6, Math.min(1.4, lr * 0.1));
      ctx.strokeStyle = 'rgba(0,0,0,0.9)';
      ctx.stroke(path);
      ctx.restore();
    }
    ctx.globalAlpha = alpha * (0.9 + rng() * 0.1);
    ctx.fillStyle = css;
    ctx.fill(path);
    ctx.globalAlpha = 1;
  }
  const ns = Math.round(satellites * (r / 5) * rng());
  for (let i = 0; i < ns; i++) {
    const a = Math.PI * (0.9 + rng() * 1.2), d = r * (1.0 + rng() * 0.5);
    blob(ctx, x + Math.cos(a) * d * 1.2, y + Math.sin(a) * d * flat, Math.max(0.7, r * (0.06 + rng() * 0.08)), { color, alpha: alpha * 0.9, rng, irregular: 0.3 });
  }
  if (snow > 0) {
    // snow sits on the upper part of each lobe: white cap offset upward, dark crescent stays below
    for (const L of lobes) {
      if (rng() > snow) continue;
      blob(ctx, L[0] + (rng() - 0.5) * L[2] * 0.4, L[1] - L[2] * (0.35 + rng() * 0.25), L[2] * (0.85 + rng() * 0.35), { color: snowColor, alpha: 1, rng, irregular: 0.25, squash: 0.55 + rng() * 0.2 });
    }
  }
}

// Small conifer tuft (ridge/islet tree): thin trunk with stacked flat needle pads.
export function paintTuft(ctx, x, y, h, rng, { color = INK, alpha = 1, lean = 0, tiers = 0, snow = 0, snowColor = [247, 246, 243] } = {}) {
  const n = tiers || Math.max(3, Math.min(7, Math.round(2.5 + h / 15)));
  const top = [x + lean * h, y - h];
  const bend = (rng() - 0.5) * h * 0.08;
  stroke(ctx, [[x, y + 2], [x + lean * h * 0.5 + bend, y - h * 0.5], top], { width: Math.max(1.2, h * 0.06), profile: 'taper', color, alpha, rng, rough: 0.4 });
  let side = rng() < 0.5 ? -1 : 1;
  for (let i = 0; i < n; i++) {
    const s = n > 1 ? i / (n - 1) : 1;
    const ty = y - h * (0.3 + 0.7 * Math.pow(s, 0.9)) + (rng() - 0.5) * h * 0.04;
    const tx = x + lean * h * (0.3 + 0.7 * s) + bend * Math.sin(Math.PI * s);
    const w = h * (0.62 - 0.46 * s) * (0.7 + rng() * 0.6);
    const off = side * w * (0.12 + rng() * 0.22);
    side = -side;
    const cx = tx + off;
    const th = h * (0.075 + rng() * 0.04) * (1 - 0.3 * s);
    // branch from the trunk to the pad
    if (Math.abs(off) > 2 && s < 0.95) stroke(ctx, [[tx, ty + th * 0.6], [cx, ty + th * 0.2]], { width: Math.max(0.8, h * 0.025), profile: 'taper', color, alpha, rng });
    // pad: scalloped flat cloud of needle dabs, rounded top, ragged drooping underside
    const k = 4 + Math.round(w / 3);
    for (let j = 0; j < k; j++) {
      const u = (rng() * 2 - 1);
      const px = cx + u * w * 0.5;
      const py = ty + u * u * th * 0.6 + (rng() - 0.6) * th * 0.6;
      const r = Math.max(0.8, th * (0.55 + 0.5 * (1 - Math.abs(u))) * (0.7 + rng() * 0.5));
      blob(ctx, px, py, r, { color, alpha: alpha * (0.85 + rng() * 0.15), rng, irregular: 0.4, squash: 0.6 + rng() * 0.25 });
    }
    // needle tips hanging under the pad
    for (let j = 0; j < 2 + w / 6; j++) {
      const u = rng() * 2 - 1;
      blob(ctx, cx + u * w * 0.55, ty + th * (0.4 + rng() * 0.5), Math.max(0.6, th * 0.25), { color, alpha: alpha * 0.85, rng, irregular: 0.5, squash: 1.4 });
    }
    if (snow > 0 && rng() < snow) blob(ctx, cx, ty - th * 0.45, w * 0.42, { color: snowColor, alpha: 1, rng, irregular: 0.3, squash: 0.28 });
  }
}

// ------------------------------------------------------------------ geometry
// A rock "item" is { outline, slabs:[{poly, clip, tone, grain, shadow, dark, streak}], fade, notch, marks..., anchors }.
// Slabs are flat planes with their own value; the GPU pass shades each slab from the ID map
// (shadow band on the side away from the light, contour band under its top edge, lit rim).

function fadeFn(fade, bb) {
  if (typeof fade === 'function') return fade;
  if (Array.isArray(fade) && typeof fade[0] === 'number') return () => fade;
  if (Array.isArray(fade) && Array.isArray(fade[0])) {
    // [[x, y0, y1], ...] interpolated in x
    const F = fade.slice().sort((a, b) => a[0] - b[0]);
    return (x) => {
      if (x <= F[0][0]) return [F[0][1], F[0][2]];
      for (let i = 1; i < F.length; i++) if (x <= F[i][0]) { const t = (x - F[i - 1][0]) / (F[i][0] - F[i - 1][0]); return [mix(F[i - 1][1], F[i][1], t), mix(F[i - 1][2], F[i][2], t)]; }
      const l = F[F.length - 1]; return [l[1], l[2]];
    };
  }
  return () => [bb.y1 + 10, bb.y1 + 20];
}

// Cliff / crag from a silhouette.
export function cliff(spec = {}) {
  const seed = spec.seed ?? 1;
  const rng = makeRng('rock-cliff:' + seed);
  const nz = makeNoise('rock-cliff-n:' + seed);
  let outline = spec.outline;
  if (!outline && spec.top) {
    const base = spec.base ?? 1200;
    const t = spec.top;
    outline = [...t, [t[t.length - 1][0], base], [t[0][0], base]];
  }
  if (!outline) throw new Error('rock.cliff: need outline or top');
  outline = roughen(outline, nz, { step: 4, amp: spec.rough ?? 2.5, freq: 0.07 });
  const bb = polyBBox(outline);
  const light = spec.light === 'right' ? 1 : -1; // -1: light from the left (shadows on right sides)
  const grain = (spec.grain ?? 90) * DEG;
  const baseTone = spec.tone ?? 0.25;
  const item = { kind: 'cliff', seed, outline, bb, light, slabs: [], fissures: [], cracks: [], ledges: [], marks: [], tufts: [], snowCaps: [], spec };
  // the mist fade must be complete before the outline's own bottom edge (never a hard cut)
  const f0 = fadeFn(spec.fade, bb);
  item.fade = (x) => { const [a, b] = f0(x); const lim = bb.y1 - 6; return [Math.min(a, lim - 20), Math.min(b, lim)]; };

  // ---- fissures (column boundaries)
  let cols = spec.columns;
  if (typeof cols === 'number' || cols === undefined) {
    const n = cols ?? Math.max(2, Math.round(bb.w / 110));
    const xs = [];
    for (let i = 1; i <= n; i++) xs.push(bb.x0 + bb.w * (i - 0.5 + (rng() - 0.5) * 0.55) / n);
    cols = xs.map((x) => ({ x }));
  }
  cols = cols.map((c) => (typeof c === 'number' ? { x: c } : c)).sort((a, b) => a.x - b.x);
  const fissures = cols.map((c, i) => {
    const t0 = c.top ?? (topYAt(outline, c.x) ?? bb.y0);
    const y1 = bb.y1 + 30;
    const lean = c.lean ?? Math.cos(grain) * 1.0;
    const pts = [];
    const steps = Math.max(4, Math.ceil((y1 - t0) / 24));
    const ph = rng() * 100;
    for (let k = 0; k <= steps; k++) {
      const s = k / steps;
      const y = mix(t0 - 40, y1, s);
      const wob = nz.n2(ph, y * 0.012) * (c.wander ?? 12) + nz.n2(ph + 7, y * 0.035) * 5 + nz.n2(ph + 3, y * 0.09) * 2;
      pts.push([c.x + lean * (y - t0) + wob, y]);
    }
    return { pts: smoothPath(pts, 5), top: t0, x: c.x, i };
  });
  item.fissures = fissures;

  // ---- column slabs: strip between consecutive fissures, clipped by the outline
  const left = { pts: [[bb.x0 - 200, bb.y0 - 200], [bb.x0 - 200, bb.y1 + 200]] };
  const right = { pts: [[bb.x1 + 200, bb.y0 - 200], [bb.x1 + 200, bb.y1 + 200]] };
  const bounds = [left, ...fissures, right];
  for (let i = 0; i < bounds.length - 1; i++) {
    const a = bounds[i].pts, b = bounds[i + 1].pts;
    const poly = [...a, ...b.slice().reverse()];
    const c = i > 0 ? cols[i - 1] : (spec.firstColumn || {}); // a fissure's options describe the column to its right
    const cw = (b[0][0] - a[0][0]);
    item.slabs.push({
      poly, clip: outline,
      tone: clamp(baseTone + (rng() - 0.5) * 0.18 + (c.tone ?? 0)),
      grain,
      shadow: clamp((spec.shadow ?? 0.45) * Math.min(1, Math.max(0.3, Math.abs(cw) / 120)) * (0.8 + rng() * 0.4)),
      dark: clamp(0.5 + (spec.dark ?? 0) + (c.dark ?? 0) + (rng() - 0.5) * 0.12),
      streak: spec.streak ?? 0.35,
      topDepth: (spec.topDepth ?? 110) * (0.8 + rng() * 0.4),
      topDark: clamp(0.42 * (spec.topDark ?? 1)),
      speckle: spec.speckle ?? 0.25,
    });
  }

  // ---- cracks inside columns (dark vertical cun lines) and ledges
  const nCracks = spec.cracks ?? Math.round(bb.w / 60);
  for (let i = 0; i < nCracks; i++) {
    const x = bb.x0 + rng() * bb.w;
    const t0 = topYAt(outline, x);
    if (t0 == null) continue;
    const yA = t0 + 10 + rng() * Math.max(10, (bb.y1 - t0) * 0.5);
    const len = 40 + rng() * 160;
    const pts = [];
    for (let k = 0; k <= 6; k++) { const y = yA + len * k / 6; pts.push([x + Math.cos(grain) * (y - yA) + nz.n2(i * 3.1, y * 0.02) * 6, y]); }
    item.cracks.push({ pts, w: 2 + rng() * 5, a: 0.4 + rng() * 0.5 });
  }
  const ledgeSpec = spec.ledges ?? 0;
  const ledges = Array.isArray(ledgeSpec) ? ledgeSpec : Array.from({ length: ledgeSpec }, () => {
    const x0 = bb.x0 + rng() * bb.w * 0.8, w = 40 + rng() * 120;
    const t0 = topYAt(outline, x0 + w / 2) ?? bb.y0;
    const [f0] = item.fade(x0);
    return { x0, x1: x0 + w, y: mix(t0 + 40, Math.min(f0, bb.y1), 0.15 + rng() * 0.5), tilt: (rng() - 0.5) * 0.3, depth: 8 + rng() * 14 };
  });
  for (const L of ledges) {
    const tilt = L.tilt ?? 0, d = L.depth ?? 12;
    const yl = (x) => L.y + (x - L.x0) * tilt;
    const poly = [];
    const n = 8;
    for (let k = 0; k <= n; k++) { const x = mix(L.x0, L.x1, k / n); poly.push([x, yl(x) + nz.n2(k * 0.7, L.y) * 2]); }
    for (let k = n; k >= 0; k--) { const x = mix(L.x0, L.x1, k / n); const e = Math.sin(Math.PI * k / n); poly.push([x, yl(x) + d * (0.35 + 0.65 * e)]); }
    item.slabs.push({ poly, clip: outline, tone: 0.05, grain: 0, shadow: 0.08, dark: 0.35, streak: 0.1 });
    item.ledges.push({ x0: L.x0, x1: L.x1, y: L.y, tilt, depth: d, under: poly.slice(n + 1) });
  }

  // ---- notch (waterfall gap): cut the outline above the lip, recessed back wall below
  if (spec.notch) {
    const N = spec.notch;
    const x0 = N.x0 ?? N.x, x1 = N.x1 ?? (N.x + N.w);
    item.notch = { x0, x1, y: N.y, bottom: N.bottom ?? bb.y1 };
    const wall = [[x0 - 2, N.y - 14], [x1 + 2, N.y - 14], [x1 + 6, item.notch.bottom + 40], [x0 - 6, item.notch.bottom + 40]];
    item.slabs.push({ poly: wall, clip: outline, tone: N.tone ?? 0.75, grain, shadow: 0.25, dark: N.dark ?? 0.72, streak: 0.6 });
  }

  // ---- extra slabs supplied by the caller (planes, boulders in front, etc.)
  for (const s of spec.slabs || []) item.slabs.push({ clip: s.clip === false ? null : outline, tone: baseTone, grain, shadow: 0.4, dark: 0.5, streak: 0.3, ...s, grain: s.grain != null ? s.grain * DEG : grain });

  buildAnchorsAndMarks(item, spec, rng, nz);
  return item;
}

// moss along exposed tops, drips down fissures, tufts, snow caps; anchors for scenes
function buildAnchorsAndMarks(item, spec, rng, nz) {
  const { outline, bb } = item;
  const mossAmt = spec.moss ?? 1;
  const size = spec.mossSize ?? 1;
  const raw = [];
  for (let x = Math.ceil(bb.x0); x <= bb.x1; x += 3) raw.push([x, topYAt(outline, x)]);
  const top = [];
  for (let i = 0; i < raw.length; i++) {
    const [x, y] = raw[i];
    if (y == null) continue;
    if (item.notch && x > item.notch.x0 - 4 && x < item.notch.x1 + 4) continue;
    const a = raw[Math.max(0, i - 2)][1] ?? y, b = raw[Math.min(raw.length - 1, i + 2)][1] ?? y;
    if (Math.abs(b - a) / 12 > (spec.maxSlope ?? 1.6)) continue; // steep flank: not a top
    if (y > item.fade(x)[0] + 20) continue;                         // already dissolved in mist
    top.push([x, y]);
  }
  item.top = top;
  // moss clumps along the top edge (clustered by noise, gaps where it is bare)
  if (mossAmt > 0) {
    // clumps along the top edge, clustered by noise; dense stretches grow into bushes (stacked clumps)
    // and leak small dark dabs down onto the face
    const foliage = spec.foliage ?? 1;
    let acc = 0;
    for (let i = 0; i < top.length; i++) {
      const [x, y] = top[i];
      const dens = smoothstep(-0.4, 0.4, nz.n2(x * 0.009, 1.3) + (mossAmt - 1) * 0.7);
      acc += dens * 3 / (12 * size);
      if (acc < 1) continue;
      acc -= 0.7 + rng() * 0.8;
      const r = size * (4 + Math.pow(rng(), 1.8) * 13 + dens * 4);
      item.marks.push({ type: 'moss', x: x + (rng() - 0.5) * 6, y: y + r * 0.2 + rng() * 4, r });
      if (rng() < 0.12 * foliage * dens) {
        // bush: a low dome of clumps on the edge, slightly greyer at the back
        const hgt = size * (10 + rng() * 22) * Math.sqrt(foliage);
        const n = 2 + Math.round(rng() * 2 * foliage);
        for (let k = 1; k <= n; k++) {
          const t = k / n;
          item.marks.push({ type: 'moss', x: x + (rng() - 0.5) * r * 2.4, y: y - hgt * t + r * 0.3, r: r * (1.0 - 0.4 * t) * (0.7 + rng() * 0.4), greys: 0.5 });
        }
      }
      if (rng() < 0.35 * dens) {
        // leak: a short trail of smaller dabs down the face
        let yy = y + r * 0.8, rr = r * 0.55;
        const n = 1 + Math.round(rng() * 3);
        for (let k = 0; k < n && rr > 1.5; k++) {
          item.marks.push({ type: 'moss', x: x + (rng() - 0.5) * r, y: yy, r: rr, greys: 0.15, satellites: 0.5 });
          yy += rr * (1.4 + rng()); rr *= 0.65 + rng() * 0.2;
        }
      }
    }
    // drips down the shadow side of fissures (dark ink pooled under the top)
    for (const f of item.fissures) {
      const fy = topYAt(outline, f.x);
      if (fy == null) continue;
      if (rng() > 0.6) continue;
      const L = (10 + rng() * 40) * mossAmt;
      let y = fy + 4;
      while (y < fy + L) {
        const pt = f.pts.find((p) => p[1] >= y) || f.pts[f.pts.length - 1];
        const k = 1 - (y - fy) / L;
        const r = size * (3 + 6 * k * rng() + 2);
        item.marks.push({ type: 'moss', x: pt[0] + item.light * (r * 0.5 + rng() * 3), y, r, greys: 0.2 });
        y += r * (1.2 + rng() * 1.2);
      }
    }
    for (const L of item.ledges) {
      for (let x = L.x0; x < L.x1; x += 9 * size + rng() * 12) {
        if (rng() > 0.75 * mossAmt) continue;
        const r = size * (4 + rng() * 8);
        item.marks.push({ type: 'moss', x, y: L.y + (x - L.x0) * L.tilt + r * 0.2, r });
      }
    }
  }
  // explicit marks from the caller
  for (const m of spec.marks || []) item.marks.push(m);
  // tufts (small conifers): explicit [[x, y, h], ...] or count along the top
  const tufts = spec.tufts ?? 0;
  if (Array.isArray(tufts)) for (const t of tufts) item.tufts.push({ x: t[0], y: t[1], h: t[2], lean: t[3] ?? 0 });
  else for (let i = 0; i < tufts; i++) {
    const p = top[(rng() * top.length) | 0];
    if (p) item.tufts.push({ x: p[0], y: p[1] + 3, h: (18 + rng() * 30) * size, lean: (rng() - 0.5) * 0.2 });
  }
  // anchors
  const peaks = [];
  for (let i = 0; i < top.length; i++) {
    let isMin = true;
    for (let j = Math.max(0, i - 12); j <= Math.min(top.length - 1, i + 12); j++) if (top[j][1] < top[i][1]) { isMin = false; break; }
    if (isMin && (!peaks.length || top[i][0] - peaks[peaks.length - 1][0] > 30)) peaks.push(top[i]);
  }
  item.anchors = {
    top: top.filter((_, i) => i % 6 === 0),
    peaks,
    ledges: item.ledges.map((L) => ({ x0: L.x0, x1: L.x1, y: L.y, mid: [(L.x0 + L.x1) / 2, L.y + (L.x1 - L.x0) / 2 * L.tilt] })),
    notch: item.notch ? { x0: item.notch.x0, x1: item.notch.x1, lip: item.notch.y, bottom: item.notch.bottom } : null,
    bbox: bb,
  };
}

// ------------------------------------------------------------------ slab rasterizer (exact, no antialiasing)
// Antialiased fills would blend slab ids along every boundary and create fake 1-px slabs, so the
// id/param maps are scan-converted here. id: r tone, g grain, b key, a 255. par: r shadow width,
// g dark bias, b streak, a mist-fade presence. Outline spans are dilated ~1 px so the antialiased
// silhouette (fields.r) always has slab data underneath.
function spansAt(poly, y) {
  const xs = crossingsX(poly, y);
  const out = [];
  for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1]]);
  return out;
}
function intersectSpans(a, b) {
  const out = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    const lo = Math.max(a[i][0], b[j][0]), hi = Math.min(a[i][1], b[j][1]);
    if (hi > lo) out.push([lo, hi]);
    if (a[i][1] < b[j][1]) i++; else j++;
  }
  return out;
}
function unionSpans(list) {
  const all = list.flat().sort((p, q) => p[0] - q[0]);
  const out = [];
  for (const s of all) {
    if (out.length && s[0] <= out[out.length - 1][1]) out[out.length - 1][1] = Math.max(out[out.length - 1][1], s[1]);
    else out.push([s[0], s[1]]);
  }
  return out;
}
export function rasterRockMaps(items, rect, pw, ph) {
  const [rx, ry, rw, rh] = rect;
  const kx = pw / rw, ky = ph / rh;
  const id = new Uint8ClampedArray(pw * ph * 4), par = new Uint8ClampedArray(pw * ph * 4), aux = new Uint8ClampedArray(pw * ph * 4);
  const sidx = new Uint16Array(pw * ph); // global slab index + 1 (0 = empty), for fast JS form queries
  const slabs = [];
  let key = 0;
  for (let ii = 0; ii < items.length; ii++) {
    const it = items[ii];
    const itemA = 255 - 16 * (ii % 8); // alpha encodes the item: a boundary to another item counts as open air
    // outline spans per row (cached)
    const rows = new Array(ph);
    const yAt = (r) => ry + (r + 0.5) / ky;
    for (let r = 0; r < ph; r++) rows[r] = spansAt(it.outline, yAt(r));
    // fade per column
    const fcol = new Float32Array(pw * 2);
    for (let c = 0; c < pw; c++) { const f = it.fade(rx + (c + 0.5) / kx); fcol[c * 2] = f[0]; fcol[c * 2 + 1] = Math.max(f[0] + 1, f[1]); }
    for (const s of it.slabs) {
      slabs.push({ s, item: it, ii });
      const sid = slabs.length;
      key = (key % 250) + 1;
      const kk = ((key * 97) % 251) + 2;
      const g = ((s.grain / Math.PI) % 1 + 1) % 1;
      const v0 = [s.tone * 255, g * 255, kk], v1 = [s.shadow * 255, s.dark * 255, s.streak * 255];
      const v2 = [clamp((s.topDepth ?? 0) / 400) * 255, clamp(s.topDark ?? 0) * 255, clamp(s.speckle ?? 0) * 255];
      const sb = polyBBox(s.poly);
      const r0 = Math.max(0, Math.floor((sb.y0 - ry) * ky - 1)), r1 = Math.min(ph - 1, Math.ceil((sb.y1 - ry) * ky + 1));
      for (let r = r0; r <= r1; r++) {
        let sp = spansAt(s.poly, yAt(r));
        if (!sp.length) continue;
        if (s.clip) sp = intersectSpans(sp, s.clip === it.outline ? rows[r] : spansAt(s.clip, yAt(r)));
        for (const [a, b] of sp) {
          const c0 = Math.max(0, Math.ceil((a - rx) * kx - 0.5)), c1 = Math.min(pw - 1, Math.floor((b - rx) * kx - 0.5));
          const y = yAt(r);
          for (let c = c0; c <= c1; c++) {
            const o = (r * pw + c) * 4;
            id[o] = v0[0]; id[o + 1] = v0[1]; id[o + 2] = v0[2]; id[o + 3] = itemA;
            const f0 = fcol[c * 2], f1 = fcol[c * 2 + 1];
            par[o] = v1[0]; par[o + 1] = v1[1]; par[o + 2] = v1[2];
            par[o + 3] = 255 * (y <= f0 ? 1 : y >= f1 ? 0 : 1 - (y - f0) / (f1 - f0));
            aux[o] = v2[0]; aux[o + 1] = v2[1]; aux[o + 2] = v2[2]; aux[o + 3] = 255;
            sidx[r * pw + c] = sid;
          }
        }
      }
    }
  }
  // form query in design px: slab, distance to its shadow-side / lit-side edge and to the open top
  const form = (x, y, light) => {
    const c = Math.floor((x - rx) * kx), r = Math.floor((y - ry) * ky);
    if (c < 0 || r < 0 || c >= pw || r >= ph) return null;
    const k = sidx[r * pw + c];
    if (!k) return null;
    const row = r * pw;
    let a = c, b = c;
    while (b + 1 < pw && sidx[row + b + 1] === k) b++;
    while (a - 1 >= 0 && sidx[row + a - 1] === k) a--;
    const ii = slabs[k - 1].ii;
    let u = r;
    while (u - 2 >= 0) { const kk = sidx[(u - 2) * pw + c]; if (!kk || slabs[kk - 1].ii !== ii) break; u -= 2; }
    const dR = (b - c) / kx, dLft = (c - a) / kx;
    return { s: slabs[k - 1].s, dS: light < 0 ? dR : dLft, dL: light < 0 ? dLft : dR, dT: (r - u) / ky };
  };
  return { id: new ImageData(id, pw, ph), par: new ImageData(par, pw, ph), aux: new ImageData(aux, pw, ph), form };
}

// ------------------------------------------------------------------ cun texture strokes
function pointInPoly(poly, x, y) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) ins = !ins;
  }
  return ins;
}
// Approximate form at a point (JS mirror of the GPU shading): which slab, distance to its shadow-side
// edge, distance below the open top. Used to place texture strokes where the painter would put them.
function formAt(item, x, y) {
  if (!pointInPoly(item.outline, x, y)) return null;
  let s = null;
  for (let i = item.slabs.length - 1; i >= 0; i--) if (pointInPoly(item.slabs[i].poly, x, y)) { s = item.slabs[i]; break; }
  if (!s) return null;
  const sp = intersectSpans(spansAt(s.poly, y), spansAt(item.outline, y));
  let dS = 1e3, dL = 1e3;
  for (const [a, b] of sp) if (x >= a && x <= b) { dS = item.light < 0 ? b - x : x - a; dL = item.light < 0 ? x - a : b - x; }
  const t = topYAt(item.outline, x);
  return { s, dS, dL, dT: t == null ? 1e3 : y - t };
}
// tapered stroke polygon along a gently curved line; prof(s) gives relative half-width
function taper(ctx, x, y, ang, len, w, prof, bend = 0, n = 7) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const L = [], R = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const off = bend * Math.sin(Math.PI * t) * len;
    const px = x + c * len * t - s * off, py = y + s * len * t + c * off;
    const hw = 0.5 * w * prof(t);
    L.push([px - s * hw, py + c * hw]); R.push([px + s * hw, py - c * hw]);
  }
  ctx.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < L.length; i++) ctx.lineTo(L[i][0], L[i][1]);
  for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
  ctx.closePath();
}
const P_DRIP = (t) => Math.pow(1 - t, 0.8) * Math.min(1, 0.35 + t * 7);
const P_AXE = (t) => Math.pow(1 - t, 1.4) * Math.min(1, 0.5 + t * 9);
const P_HAIR = (t) => Math.sin(Math.PI * Math.min(1, t * 1.15)) * 0.9 + 0.1;
// cun: Canvas2D (transparent), strokes drawn as grey ink with alpha. Grouped by value so each group is one fill.
export function paintRockCun(cun, item, { density = 1, form = null } = {}) {
  const rng = makeRng('rock-cun:' + item.seed);
  const query = form ? (x, y) => form(x, y, item.light) : (x, y) => formAt(item, x, y);
  const { bb, spec } = item;
  const dens = density * (spec.cun ?? 1);
  if (dens <= 0) return;
  const groups = new Map();
  const add = (val, a) => { const k = Math.round(val * 10) + ':' + Math.round(a * 10); let g = groups.get(k); if (!g) { g = { val: Math.round(val * 10) / 10, a: Math.round(a * 10) / 10, p: new Path2D() }; groups.set(k, g); } return g.p; };
  const area = bb.w * bb.h;
  const tries = Math.round(area / 55 * dens);
  // stroke vocabulary mix: drip (vertical cun), axe (tilted wedges), hair (hemp fibre), dot, dapple (granite blots)
  const M = { drip: 0.42, axe: 0.38, hair: 0.13, dot: 0.07, dapple: 0, ...(spec.cunMix || {}) };
  const mixAcc = [M.drip, M.drip + M.axe, M.drip + M.axe + M.hair, M.drip + M.axe + M.hair + M.dot];
  const mixTot = mixAcc[3] + M.dapple;
  const g0 = (spec.grain ?? 90) * DEG;
  for (let i = 0; i < tries; i++) {
    const x = bb.x0 + rng() * bb.w, y = bb.y0 + rng() * bb.h;
    const [f0, f1] = item.fade(x);
    if (y > f1) continue;
    const f = query(x, y);
    if (!f || !f.s.clip) continue;
    const W = f.s.shadow * 110 + 4;
    const sh = Math.exp(-f.dS / W), tp = Math.exp(-f.dT / ((f.s.topDepth ?? 100) * 0.7)), mist = 1 - clamp((y - f0) / (f1 - f0));
    const F = clamp(0.12 + 0.3 * f.s.tone + 0.6 * sh + 0.5 * tp * (f.s.topDark ?? 0.4) * 2 + (f.s.dark - 0.5));
    const pAcc = (0.07 + 0.93 * Math.pow(F, 1.25)) * mist;
    if (rng() > pAcc) continue;
    const grain = f.s.grain ?? g0;
    const r = rng() * mixTot;
    if (r >= mixAcc[3]) {
      // dapple: irregular cloud-shaped blot (granite lumps): a ragged outline traced around a few lobes
      const v = clamp(0.66 - 0.4 * F + (rng() - 0.5) * 0.15, 0.12, 0.85);
      const p = add(v, 0.18 + rng() * 0.25);
      const R = 3 + Math.pow(rng(), 1.5) * 12 * (0.6 + F * 0.6);
      const n = 9 + ((rng() * 6) | 0), ph = rng() * 6.28, el = 0.5 + rng() * 0.5, rot = grain + (rng() - 0.5) * 1.2;
      const cr = Math.cos(rot), sr = Math.sin(rot);
      for (let k = 0; k <= n; k++) {
        const a = (k % n) / n * Math.PI * 2;
        const rr = R * (0.65 + 0.35 * Math.sin(a * 3 + ph) * Math.sin(a * 2 - ph * 0.7) + (rng() - 0.5) * 0.45);
        const px = Math.cos(a) * rr, py = Math.sin(a) * rr * el;
        const X = x + px * cr - py * sr, Y = y + px * sr + py * cr;
        if (k === 0) p.moveTo(X, Y); else p.lineTo(X, Y);
      }
      p.closePath();
    } else if (r < mixAcc[0]) {
      // drip / vertical cun: tapering streak down the grain, darker near the shadow edge
      const len = (10 + rng() * 38) * (0.6 + F * 0.8);
      const w = 1.4 + rng() * 3.2 * (0.5 + F);
      const v = clamp(0.62 - 0.45 * F + (rng() - 0.5) * 0.15, 0.08, 0.8);
      taper(add(v, 0.35 + rng() * 0.4), x, y, grain + (rng() - 0.5) * 0.25, len, w, P_DRIP, (rng() - 0.5) * 0.12);
    } else if (r < mixAcc[1]) {
      // axe-cut: short wedge tilted off the grain, alternating sides
      const len = 6 + rng() * 14;
      const w = 2 + rng() * 4.5;
      const tilt = (rng() < 0.5 ? -1 : 1) * (0.35 + rng() * 0.5);
      const v = clamp(0.7 - 0.4 * F + (rng() - 0.5) * 0.18, 0.1, 0.85);
      taper(add(v, 0.3 + rng() * 0.35), x, y, grain + tilt, len, w, P_AXE, (rng() - 0.5) * 0.2);
    } else if (r < mixAcc[2]) {
      // hair line (hemp-fibre): long thin pale stroke
      const len = 20 + rng() * 50;
      taper(add(clamp(0.6 - 0.3 * F, 0.2, 0.8), 0.25 + rng() * 0.25), x, y, grain + (rng() - 0.5) * 0.15, len, 0.9 + rng() * 1.3, P_HAIR, (rng() - 0.5) * 0.1);
    } else {
      // dot
      const p = add(clamp(0.35 - 0.3 * F, 0.05, 0.6), 0.6 + rng() * 0.4);
      const rr = 0.8 + rng() * 1.8;
      p.moveTo(x + rr, y); p.ellipse(x, y, rr, rr * (0.7 + rng() * 0.5), rng() * 3, 0, Math.PI * 2);
    }
  }
  cun.save();
  cun.beginPath(); tracePoly(cun, item.outline); cun.clip();
  for (const g of groups.values()) {
    const c = inkTone(g.val);
    cun.fillStyle = rgba(c, g.a);
    cun.fill(g.p);
  }
  cun.restore();
}

// ------------------------------------------------------------------ painters (fields)
// fld: Canvas2D (opaque black, design px): r = antialiased silhouette, g = dark ink pools, b = snow.
export function paintRockFields(fld, item) {
  const { outline } = item;
  fld.save();
  fld.globalCompositeOperation = 'lighten';
  fld.fillStyle = 'rgb(255,0,0)';
  fld.beginPath(); tracePoly(fld, outline); fld.fill();
  fld.beginPath(); tracePoly(fld, outline); fld.clip();
  // extra dark (green): soft ink pools along the shadow side of fissures, under the top edge and in cracks.
  // The GPU pass thresholds this with noise, so soft blobs become lacy crisp-edged dark masses.
  const fr = makeRng('rock-fiss:' + item.seed);
  const pools = [[], [], []]; // three intensity groups (one blurred fill each)
  const pool = (x, y, rx, ry, lvl, rot = 0) => pools[Math.max(0, Math.min(2, lvl))].push([x, y, rx, ry, rot]);
  const sideX = item.light; // -1: pools sit left of each fissure (shadow side of the column to its left)
  const darkAmt = item.spec.pools ?? 1;
  for (const f of item.fissures) {
    const pts = smoothPath(f.pts, 4);
    const y0 = f.top, len = Math.max(60, Math.min(item.bb.y1, item.fade(f.x)[1]) - y0);
    // clustered pools: always one under the top, then a few irregular patches lower down
    const nCl = 1 + Math.round(fr() * 3 * darkAmt);
    for (let c = 0; c < nCl; c++) {
      const cy = c === 0 ? y0 + fr() * 8 : y0 + (0.12 + fr() * 0.7) * len;
      const s = (cy - y0) / len;
      const span = (16 + fr() * 70) * (1 - s * 0.5);
      const k = 2 + Math.round(fr() * 4);
      for (let j = 0; j < k; j++) {
        const y = cy + fr() * span;
        const pt = pts.find((p) => p[1] >= y) || pts[pts.length - 1];
        const ry = 5 + fr() * 18, rx = 3 + fr() * 11;
        pool(pt[0] + sideX * (rx * 0.5 + fr() * 9), y, rx, ry, s < 0.2 ? 0 : s < 0.55 ? 1 : 2, (fr() - 0.5) * 0.5);
      }
    }
  }
  // under the top edge: dark ink soaked beneath the moss, running down in drips (topDark scales depth/density)
  const topDark = item.spec.topDark ?? 1;
  for (let i = 0; i < (item.top || []).length; i += 4) {
    const [x, y] = item.top[i];
    if (fr() < 0.4 * darkAmt * Math.min(1.5, topDark)) pool(x + (fr() - 0.5) * 8, y + 6 + fr() * 14, 4 + fr() * 10, 5 + fr() * 16, fr() < 0.5 ? 0 : 1, (fr() - 0.5) * 0.4);
    if (topDark > 0.5 && fr() < 0.22 * topDark) {
      const d = 20 + fr() * 70 * topDark;
      pool(x + (fr() - 0.5) * 10, y + d * 0.6, 3 + fr() * 9, d * (0.35 + fr() * 0.3), d > 50 ? 2 : 1, (fr() - 0.5) * 0.3);
    }
  }
  // scattered pools on faces
  const nFace = Math.round((item.bb.w * item.bb.h) / 9000 * darkAmt * (item.spec.facePools ?? 1));
  for (let i = 0; i < nFace; i++) {
    const x = item.bb.x0 + fr() * item.bb.w, t = topYAt(item.outline, x);
    if (t == null) continue;
    const y = t + fr() * (Math.min(item.bb.y1, item.fade(x)[0]) - t);
    pool(x, y, 3 + fr() * 8, 6 + fr() * 20, 2, (fr() - 0.5) * 0.4);
  }
  const lv = [0.85, 0.6, 0.38];
  fld.filter = 'blur(3.5px)';
  for (let g = 0; g < 3; g++) {
    if (!pools[g].length) continue;
    fld.fillStyle = 'rgba(0,255,0,' + lv[g] + ')';
    fld.beginPath();
    for (const [x, y, rx, ry, rot] of pools[g]) { fld.moveTo(x + rx, y); fld.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); }
    fld.fill();
  }
  fld.filter = 'blur(1.5px)';
  for (const c of item.cracks) {
    fld.strokeStyle = 'rgba(0,255,0,' + (c.a * 0.6).toFixed(3) + ')';
    fld.lineWidth = c.w;
    fld.beginPath(); c.pts.forEach((p, i) => (i ? fld.lineTo(p[0], p[1]) : fld.moveTo(p[0], p[1]))); fld.stroke();
  }
  fld.filter = 'blur(5px)';
  for (const L of item.ledges) {
    fld.strokeStyle = 'rgba(0,255,0,0.8)';
    fld.lineWidth = 16;
    fld.beginPath(); L.under.forEach((p, i) => (i ? fld.lineTo(p[0], p[1] + 9) : fld.moveTo(p[0], p[1] + 9))); fld.stroke();
  }
  fld.filter = 'none';
  fld.restore();
}

// Foliage / moss as a density field (fol canvas, opaque black, 'lighter' adds): r = black clumps,
// g = grey clumps behind. Each lobe is a soft disc; the GPU pass thresholds the summed field with
// noise, so clumps merge into one dark mass with scalloped, lacy edges and paper speckles - the way
// wet ink dabs fuse in the references - instead of reading as separate round beads.
function softDisc(ctx, x, y, R, ch, a = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, R);
  const c = ch === 0 ? '255,0,0' : ch === 1 ? '0,255,0' : '0,0,255';
  // flat top, short falloff: overlapping lobes keep their scallops instead of fusing into smooth puddles
  g.addColorStop(0, `rgba(${c},${a})`);
  g.addColorStop(0.62, `rgba(${c},${a * 0.8})`);
  g.addColorStop(1, `rgba(${c},0)`);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
}
export function paintMossField(fol, x, y, r, rng, { greys = 0.35, flat = 0.62, satellites = 1, snow = 0, snowCtx = null } = {}) {
  // a solid core plus many small lobes, denser on the upper rim (the scalloped silhouette)
  const n = 5 + Math.round(r / 1.5);
  const lobes = [[x, y + r * 0.15, r * 0.42]];
  for (let i = 0; i < n; i++) {
    let a = rng() * Math.PI * 2;
    if (rng() < 0.5) a = Math.PI * (1.0 + rng());
    const d = Math.pow(rng(), 0.6) * r * 0.8;
    lobes.push([x + Math.cos(a) * d * 1.25, y + Math.sin(a) * d * flat, r * (0.09 + 0.16 * rng())]);
  }
  if (greys > 0 && rng() < greys * 1.5) for (let i = 0; i < Math.ceil(r * 0.08 * greys); i++) {
    softDisc(fol, x + (rng() - 0.5) * r * 2.2, y + (rng() - 0.2) * r * 0.7, r * (0.25 + rng() * 0.35), 1, 0.8);
  }
  for (const [lx, ly, lr] of lobes) softDisc(fol, lx, ly, lr * 1.45, 0, 1);
  const ns = Math.round(satellites * (r / 4) * rng());
  for (let i = 0; i < ns; i++) {
    const a = Math.PI * (0.85 + rng() * 1.3), d = r * (1.0 + rng() * 0.6);
    softDisc(fol, x + Math.cos(a) * d * 1.2, y + Math.sin(a) * d * flat, Math.max(1.6, r * (0.12 + rng() * 0.14)), 0, 1);
  }
  if (snow > 0 && snowCtx) {
    // snow on the upper half of each lobe (soft white cap, dark crescent left below)
    for (const [lx, ly, lr] of lobes) {
      if (rng() > snow) continue;
      snowCtx.save();
      snowCtx.translate(lx, ly - lr * (0.45 + rng() * 0.25));
      snowCtx.scale(1, 0.55 + rng() * 0.2);
      softDisc(snowCtx, 0, 0, lr * (1.7 + rng() * 0.5), 2, 1);
      snowCtx.restore();
    }
  }
}
export function paintRockFoliage(fol, item, { snow = 0, snowCtx = null } = {}) {
  const rng = makeRng('rock-fol:' + item.seed);
  fol.save();
  fol.globalCompositeOperation = 'lighter';
  if (snowCtx) { snowCtx.save(); snowCtx.globalCompositeOperation = 'lighter'; }
  const marks = item.marks.slice().sort((a, b) => a.y - b.y);
  for (const m of marks) if (m.type === 'moss') paintMossField(fol, m.x, m.y, m.r, rng, { greys: m.greys ?? 0.35, satellites: m.satellites ?? 1, snow, snowCtx });
  if (snowCtx) snowCtx.restore();
  fol.restore();
}

// brushwork on top: contour strokes, tufts (moss/foliage go through paintRockFoliage)
export function paintRockInk(ctx, item, { inkColor = INK, alpha = 1, snow = 0 } = {}) {
  const rng = makeRng('rock-ink:' + item.seed);
  const nz = makeNoise('rock-ink-n:' + item.seed);
  // dry contour along the top edge
  const top = item.top;
  if (top && top.length > 4) {
    let seg = [];
    const flush = () => { if (seg.length > 3) dryStroke(ctx, seg, { width: 5, bristles: 5, color: inkColor, alpha: 0.85 * alpha, dry: 0.3, rng, noise: nz }); seg = []; };
    for (let i = 0; i < top.length; i++) {
      const on = nz.n2(top[i][0] * 0.02, 5.5) > -0.2;
      const gap = i > 0 && (top[i][0] - top[i - 1][0] > 4 || Math.abs(top[i][1] - top[i - 1][1]) > 8);
      if (gap || !on) flush();
      if (on) seg.push([top[i][0], top[i][1] + 1]);
    }
    flush();
  }
  for (const t of item.tufts) paintTuft(ctx, t.x, t.y, t.h, rng, { color: inkColor, alpha, lean: t.lean, snow });
}

// ------------------------------------------------------------------ GPU pass
// Tileable 4-channel fbm noise (1024 px period), baked once per GL context and shared by every rock bake.
// Sampling a texture instead of evaluating many simplex octaves keeps the rock shader small (fast compile) and cheap.
const NOISE_GLSL = /* glsl */ `
float pvn(vec2 p, float P, float s) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(mod(i, P) + s), b = hash12(mod(i + vec2(1.0, 0.0), P) + s);
  float c = hash12(mod(i + vec2(0.0, 1.0), P) + s), d = hash12(mod(i + vec2(1.0, 1.0), P) + s);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float pfbm(vec2 uv, float s, float g) {
  float v = 0.0, a = 0.5, n = 0.0, P = 8.0;
  for (int i = 0; i < 7; i++) { v += a * pvn(uv * P, P, s + float(i) * 13.7); n += a; P *= 2.0; a *= g; }
  // re-centre and normalise contrast so every channel spans roughly [0.1, 0.9]
  float sd = sqrt((1.0 - pow(g * g, 7.0)) / (1.0 - g * g)) * 0.5 * 0.29 / n;
  return clamp(0.5 + (v / n - 0.5) * (0.2 / max(sd, 1e-3)), 0.0, 1.0);
}
vec4 shade(vec2 p, vec2 uv) {
  return vec4(pfbm(uv, 1.3, 0.62), pfbm(uv, 41.1, 0.66), pfbm(uv, 77.9, 0.74), pfbm(uv, 123.4, 0.56));
}`;
const _noiseTex = new WeakMap();
function noiseTex(api) {
  let t = _noiseTex.get(api.gl);
  if (!t) {
    t = api.bakeShader(1024, 1024, NOISE_GLSL, { scale: 1 / api.scale });
    const gl = api.gl;
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    _noiseTex.set(api.gl, t);
  }
  return t;
}

export const _debugNoiseTex = (api) => noiseTex(api);

const ROCK_GLSL = /* glsl */ `
uniform sampler2D uId;
uniform sampler2D uPar;
uniform sampler2D uAux;
uniform sampler2D uFld;
uniform sampler2D uInk;
uniform sampler2D uFol;
uniform sampler2D uCun;
uniform sampler2D uNoise;
uniform vec4 uRect;     // design rect of this bake
uniform vec2 uPx;       // map size in pixels
uniform vec3 uPaper;
uniform vec3 uInkCol;
uniform vec2 uShadow;   // unit vector pointing to the shadow side
uniform float uFeat;    // feature size (1 = near foreground)
uniform float uFar;     // 0 near .. 1 far
uniform float uTexAmt;
uniform float uSeed;
uniform vec3 uSnow;
uniform float uDebug;

// noise texture lookups: q in design px (feature space), returns ~[-1,1] fbm
vec4 NT(vec2 q) { return texture(uNoise, q / 1024.0) * 2.0 - 1.0; }

vec4 idAt(vec2 p) {
  vec2 t = clamp(p / uRect.zw * uPx, vec2(0.5), uPx - 0.5);
  return texelFetch(uId, ivec2(t), 0);
}
float idKey(vec4 c) { return c.a < 0.5 ? -1.0 : floor(c.b * 255.0 + 0.5); }
float edgeDist(vec2 p, vec2 dir, float W, float key) {
  float st = W / 10.0;
  float hit = -1.0;
  for (int i = 1; i <= 10; i++) {
    if (hit < 0.0 && abs(idKey(idAt(p + dir * st * float(i))) - key) > 0.5) hit = float(i);
  }
  if (hit < 0.0) return W * 4.0;
  float a = (hit - 1.0) * st, b = hit * st;
  for (int k = 0; k < 3; k++) {
    float md = 0.5 * (a + b);
    if (abs(idKey(idAt(p + dir * md)) - key) > 0.5) b = md; else a = md;
  }
  return 0.5 * (a + b);
}
// distance to the boundary along dir, and whether that boundary is open air / another item (1) or a slab of the same item (0)
vec2 edgeHit(vec2 p, vec2 dir, float W, float key, float itemA) {
  float st = W / 8.0;
  float hit = -1.0, air = 0.0;
  for (int i = 1; i <= 8; i++) {
    vec4 c = idAt(p + dir * st * float(i));
    if (hit < 0.0 && abs(idKey(c) - key) > 0.5) { hit = float(i); air = (c.a < 0.5 || abs(c.a - itemA) > 0.02) ? 1.0 : 0.0; }
  }
  if (hit < 0.0) return vec2(W * 4.0, 0.0);
  float a = (hit - 1.0) * st, b = hit * st;
  for (int k = 0; k < 3; k++) {
    float md = 0.5 * (a + b);
    if (abs(idKey(idAt(p + dir * md)) - key) > 0.5) b = md; else a = md;
  }
  return vec2(0.5 * (a + b), air);
}

vec4 shade(vec2 p, vec2 uv) {
  vec2 P = p + uRect.xy;
  vec2 Q = P / uFeat + uSeed * 397.0;
  vec4 id = idAt(p);
  vec4 fl = texture(uFld, uv);
  vec4 ink = texture(uInk, uv);
  // antialiased silhouette fringe outside the exact raster: borrow the slab of an inward neighbour
  vec2 pp = p;
  if (id.a < 0.5 && fl.r > 0.002) {
    float d = 1.5 * uRect.z / uPx.x;
    vec4 c;
    c = idAt(p + vec2(d, 0.0)); if (c.a > 0.5) { id = c; pp = p + vec2(d, 0.0); }
    c = idAt(p - vec2(d, 0.0)); if (id.a < 0.5 && c.a > 0.5) { id = c; pp = p - vec2(d, 0.0); }
    c = idAt(p + vec2(0.0, d)); if (id.a < 0.5 && c.a > 0.5) { id = c; pp = p + vec2(0.0, d); }
    c = idAt(p - vec2(0.0, d)); if (id.a < 0.5 && c.a > 0.5) { id = c; pp = p - vec2(0.0, d); }
  }
  vec4 pr = texture(uPar, (pp / uRect.zw));
  float m = pr.a;                            // mist-fade presence
  float rockA = 0.0; vec3 rockC = vec3(0.0);
  vec4 nfine = NT(Q * 6.0 + 71.0);           // fine detail (pixel-scale roughness)
  if (id.a > 0.5 && m > 0.002 && fl.r > 0.002) {
    vec3 idc = id.rgb;
    float key = floor(idc.b * 255.0 + 0.5);
    vec3 prc = pr.rgb;
    float tone = idc.r;
    float ang = idc.g * 3.14159265;
    float bias = prc.g - 0.5;
    float streakAmt = prc.b;
    vec2 gd = vec2(cos(ang), sin(ang));
    vec2 gq = vec2(dot(Q, gd), dot(Q, vec2(-gd.y, gd.x)));     // x along grain, y across
    vec4 nb = NT(Q * 0.25 + 13.0);           // broad fields
    vec4 ng = NT(vec2(gq.y, gq.x * 0.32) * 2.6 + 300.0);   // grain-elongated (vertical) fields
    vec4 ng2 = NT(vec2(gq.y, gq.x * 0.4) * 5.0 + 600.0);
    // two fleck fields tilted either way off the grain: short diagonal axe-cut marks that cross like chevrons
    const mat2 RA = mat2(0.92, 0.39, -0.39, 0.92), RB = mat2(0.92, -0.39, 0.39, 0.92);
    vec4 fa = NT((RA * vec2(gq.y, gq.x)) * vec2(1.0, 0.33) * 6.5 + 1200.0);
    vec4 fb = NT((RB * vec2(gq.y, gq.x)) * vec2(1.0, 0.33) * 6.5 + 1700.0);
    // band widths vary along the grain so shadow bands bulge and pinch
    float wv = 0.6 + 0.8 * (nb.a * 0.5 + 0.5);
    float W = (prc.r * 110.0 * uFeat + 2.0) * wv;
    vec2 jit = (nb.xy * 9.0 + ng2.xy * 4.0 + nfine.zw * 2.0) * uFeat;
    vec2 jp = pp + jit;
    float ds = edgeDist(jp, uShadow, W, key);
    float wash = 1.0 - smoothstep(0.0, W, ds);
    float Wt = 46.0 * uFeat;
    vec2 th = edgeHit(jp, vec2(0.0, -1.0), Wt, key, id.a);  // only open-air tops get the dark contour band
    float topB = (1.0 - smoothstep(0.0, Wt, th.x)) * th.y;
    // broad top-down darkening: the upper part of a mass is dark (moss, shade), breaking up downward
    vec4 ax = texture(uAux, pp / uRect.zw);
    float Hd = ax.r * 400.0 * uFeat + 1.0;
    vec2 tg2 = edgeHit(jp + vec2(0.0, ng.x * 10.0 * uFeat), vec2(0.0, -1.0), Hd, key, id.a);
    float topG = pow(1.0 - smoothstep(0.0, Hd, tg2.x), 1.4) * tg2.y * ax.g;
    if (uDebug > 0.5) return vec4(vec3(topB, wash, topG), 1.0);
    float Wl = 12.0 * uFeat;
    vec2 lh = edgeHit(pp + jit * 0.3, -uShadow, Wl, key, id.a);
    float litB = (1.0 - smoothstep(0.0, Wl, lh.x)) * lh.y;
    // crevice: the lit side of a slab-to-slab boundary also darkens for a few px (the crack has two walls)
    float crev = (1.0 - smoothstep(0.0, (5.0 + 6.0 * (nb.w * 0.5 + 0.5)) * uFeat, lh.x)) * (1.0 - lh.y);
    float litLine = (1.0 - smoothstep(1.0 * uFeat, 3.2 * uFeat, lh.x)) * smoothstep(-0.2, 0.3, nb.z) * lh.y;
    float fadeK = smoothstep(0.0, 0.9, m);

    // ---- form darkness: the geometric shading the painter builds up in layers
    float F = 0.05 + 0.25 * tone + 0.6 * pow(wash, 1.15) + 0.3 * topB + 1.0 * topG + 0.45 * crev + 0.16 * nb.x + bias * 0.6 + fl.g * 0.7;
    F *= mix(0.25, 1.0, fadeK) * uTexAmt;
    float e = mix(0.3, 0.035, fadeK) + uFar * 0.08;
    // base wash with soft mottling
    float v = 0.87 - 0.1 * F - nb.y * 0.045 - ng2.w * 0.035 + litB * 0.04;
    // dapple: fine granular mid-tone texture (many small marks), denser where the form is darker
    vec4 nd = NT(vec2(gq.y, gq.x * 0.7) * 9.0 + 3100.0);
    float cd = (nd.x - 0.62 + F * 0.22) * 5.0 + nd.y * 0.6;
    float ed = max(0.08, fwidth(cd) * 0.8);
    v -= smoothstep(-ed, ed, cd) * (0.1 + 0.12 * F) * fadeK;
    // dry-brush striations: long thin streaks along the grain, broken lengthwise (hemp-fibre / dragged brush)
    vec4 nsk = NT(vec2(gq.y * 10.0, gq.x * 0.25) + 2600.0);
    float skc = (nsk.x - 0.4) * 4.0 + nsk.y * 0.8 + (F - 0.3) * 0.9 + (streakAmt - 0.5) * 0.8;
    float ske = max(0.06, fwidth(skc) * 0.8);
    float sk = smoothstep(-ske, ske, skc) * smoothstep(-0.25, 0.35, nsk.z);
    v = mix(v, min(v, 0.55 - 0.25 * F), sk * min(1.0, streakAmt * 1.4) * fadeK * 0.85);
    // layer 1: pale grey wash patches
    // (each threshold is antialiased with its screen-space derivative so edges stay crisp but smooth)
    float c1 = (F - 0.25) * 2.2 + ng.x * 1.5 + nfine.x * 0.4;
    float e1 = max(e, fwidth(c1) * 0.8);
    v *= 1.0 - 0.12 * smoothstep(-e1, e1, c1);
    // layer 2: mid grey, follows the form toward the shadow edge; pigment pools at its edge
    float c2 = (F - 0.45) * 2.2 + ng.y * 1.3 + ng2.w * 0.8 + nfine.y * 0.5;
    float e2 = max(e, fwidth(c2) * 0.8);
    float l2 = smoothstep(-e2, e2, c2);
    float rim2 = l2 * (1.0 - smoothstep(e2, e2 + 0.5, c2));
    v = mix(v, min(v, 0.6 - 0.14 * F + 0.06 * ng2.x - 0.08 * rim2), l2);
    // layer 3: black, lacy edges with paper speckles
    float c3 = (F - 0.66) * 2.0 + ng.z * 1.0 + ng2.z * 1.1 + nfine.z * 0.6;
    float e3 = max(e, fwidth(c3) * 0.8);
    float l3 = smoothstep(-e3, e3, c3);
    float inkV = mix(0.3, 0.05, smoothstep(0.45, 0.85, F)) ;
    v = mix(v, min(v, inkV), l3);
    // scattered flecks on the lit planes (small, grain-elongated)
    float c4 = max(fa.x, fb.y) * 2.3 + nfine.w * 0.4 - 1.3 + F * 0.75;
    float e4 = max(e, fwidth(c4) * 0.8);
    v = mix(v, min(v, 0.62 - 0.25 * F), smoothstep(-e4, e4, c4) * 0.85);
    // cun texture strokes (JS brushwork): granulated where the ink is thin
    vec4 cu = texture(uCun, uv);
    if (cu.a > 0.003) {
      float cv = dot(cu.rgb / cu.a, vec3(0.333)) / max(dot(uPaper, vec3(0.333)), 0.1);
      float ca = cu.a * (1.0 - 0.8 * (nfine.y * 0.5 + 0.2) * (1.0 - cu.a));
      v = mix(v, min(v, cv), clamp(ca, 0.0, 1.0) * fadeK);
    }
    float sp = smoothstep(0.5, 0.75, nfine.w) * l3;
    v = mix(v, 0.7, sp * 0.8);
    // paper speckles in the mid-tones (granite): small pale flecks where pigment skipped the paper tooth
    vec4 nsp = NT(Q * 11.0 + 4100.0);
    float spc = (nsp.x - 0.7) * 6.0 + nsp.y * 0.5;
    float spk = smoothstep(-0.15, 0.15, spc) * ax.b * smoothstep(0.2, 0.6, 1.0 - v);
    v = mix(v, max(v, 0.88), spk);
    v = mix(v, 1.0, (1.0 - fadeK) * 0.5);

    // ---- silhouette: slightly ragged, dissolving into mist with soft grain-aligned fingers
    float cov = textureLod(uFld, uv, 0.7).r;
    float edgeA = smoothstep(0.3, 0.7, cov + nfine.x * 0.3 + ng.x * 0.12);
    float ma = smoothstep(0.02, 0.6, m + ng.w * 0.16);
    rockA = edgeA * ma;
    v = mix(v, 1.0, uFar * 0.72);
    rockC = mix(uInkCol, uPaper, clamp(v, 0.0, 1.0));
  }
  // ---- brushwork layer (inkified: soft wet rim, granulation in half-tones, rare speckles)
  vec4 col = vec4(rockC * rockA, rockA);
  if (ink.a > 0.003) {
    vec2 tx = 1.0 / uPx;
    float ab = 0.0;
    for (int i = 0; i < 6; i++) { float an = float(i) * 1.0472; ab += texture(uInk, uv + vec2(cos(an), sin(an)) * tx * 2.5).a; }
    ab /= 6.0;
    float rim = clamp((ink.a - ab) * 2.5, 0.0, 1.0);
    vec3 ic = ink.rgb / ink.a;
    float lum = dot(ic, vec3(0.333));
    ic = mix(ic, ic * 0.7, rim * 0.4);
    float gr = nfine.y * 0.5 + 0.5;
    float ia = ink.a * (1.0 - 0.9 * (gr - 0.45) * ink.a * (1.0 - ink.a));
    float isp = smoothstep(0.55, 0.8, nfine.w) * step(lum, 0.5) * smoothstep(0.9, 1.0, ink.a);
    ia *= 1.0 - isp * 0.85;
    ic = mix(ic, uPaper, uFar * 0.72 * (1.0 - smoothstep(0.85, 0.95, lum)));
    ia = clamp(ia, 0.0, 1.0);
    col = vec4(ic * ia, ia) + col * (1.0 - ia);
  }
  // ---- foliage / moss field: soft discs thresholded into fused dark masses with lacy edges
  vec4 fo = texture(uFol, uv);
  if (fo.r + fo.g > 0.004) {
    vec4 nq = NT(Q * 7.0 + 2100.0);
    float cg = (fo.g - 0.55) * 2.6 + nq.x * 0.8 + nfine.y * 0.5;
    float eg = max(0.05, fwidth(cg) * 0.8);
    float ag = smoothstep(-eg, eg, cg) * 0.7;
    vec3 gcol = mix(uInkCol, uPaper, mix(0.48 + 0.1 * nq.y, 1.0, uFar * 0.72));
    col = vec4(gcol * ag, ag) + col * (1.0 - ag);
    float cb = (fo.r - 0.5) * 2.5 + nq.z * 0.9 + nfine.z * 0.75;
    float eb = max(0.03, fwidth(cb) * 0.8);
    float ab = smoothstep(-eb, eb, cb);
    float halo = smoothstep(-0.7, -0.05, cb) * (1.0 - ab) * 0.12 * (0.6 + 0.4 * nq.w);   // faint wet bleed
    vec3 hcol = mix(uInkCol, uPaper, mix(0.45, 1.0, uFar * 0.72));
    col = vec4(hcol * halo, halo) + col * (1.0 - halo);
    float bv = 0.035 + 0.09 * smoothstep(0.2, 0.9, nq.w * 0.5 + 0.5);
    bv = mix(bv, 0.62, smoothstep(0.55, 0.8, nfine.w) * 0.75);       // paper speckles
    bv = mix(bv, 1.0, uFar * 0.72);
    vec3 bcol = mix(uInkCol, uPaper, bv);
    col = vec4(bcol * ab, ab) + col * (1.0 - ab);
  }
  // ---- snow (fields.b): soft lumpy white over rock and foliage, cool shadow along its lower edge
  float sn = fl.b;
  if (sn > 0.01) {
    vec4 ns = NT(Q * 0.7 + 900.0);
    float cs = (sn - 0.45) * 3.0 + ns.x * 0.45 + nfine.x * 0.2;
    float es = max(0.04, fwidth(cs) * 0.8);
    float sa = smoothstep(-es, es, cs);
    float below = textureLod(uFld, uv + vec2(0.0, 5.0 * uFeat / uRect.w), 2.0).b;
    float sh = clamp((1.0 - below) * 1.6, 0.0, 1.0) * smoothstep(0.0, 1.2, cs + 0.6);
    vec3 sc = mix(uSnow, vec3(0.72, 0.74, 0.76), sh * 0.45 + 0.06 * ns.y);
    col = vec4(sc * sa, sa) + col * (1.0 - sa);
  }
  return col;
}
`;


// Bake one or several rock items into a single texture.
export function bakeRocks(api, { rect, items, paper = PAPER, ink = INK, light = 'left', lightTilt = 0.25, feature = 1, far = 0, texture = 1, cun = 1, scale = 1, seed = 1, snowColor = [247, 246, 243], snow = 0 } = {}) {
  const [rx, ry, rw, rh] = rect;
  const k = scale * api.scale;
  const pw = Math.max(1, Math.round(rw * k)), ph = Math.max(1, Math.round(rh * k));
  const mk = (opaqueBlack) => {
    const cv = new OffscreenCanvas(pw, ph);
    const c = cv.getContext('2d');
    if (opaqueBlack) { c.fillStyle = '#000'; c.fillRect(0, 0, pw, ph); }
    c.setTransform(pw / rw, 0, 0, ph / rh, -rx * pw / rw, -ry * ph / rh);
    return [cv, c];
  };
  const PT = globalThis.performance, t0 = PT.now();
  const [cvFld, fld] = mk(true), [cvInk, inkc] = mk(false), [cvFol, fol] = mk(true), [cvCun, cunc] = mk(false);
  const maps = rasterRockMaps(items, rect, pw, ph);
  for (const it of items) paintRockFields(fld, it);
  for (const it of items) paintRockCun(cunc, it, { density: cun, form: maps.form });
  const t1 = PT.now();
  for (const it of items) {
    const sn = it.spec?.snow ?? snow;
    if (it.snowPaint) it.snowPaint(fld);
    paintRockInk(inkc, it, { inkColor: ink, snow: sn });
    paintRockFoliage(fol, it, { snow: sn, snowCtx: sn > 0 ? fld : null });
  }
  const t2 = PT.now();
  const T = (cv) => api.texture(cv);
  const raw = (img) => ({ tex: texFromSource(api.gl, img, { mipmap: true, premultiply: false }), w: rw, h: rh, pw, ph });
  const tId = raw(maps.id), tPar = raw(maps.par), tAux = raw(maps.aux), tFld = T(cvFld), tInk = T(cvInk), tFol = T(cvFol), tCun = T(cvCun);
  const t3 = PT.now();
  console.warn(`rock timing maps ${(t1 - t0).toFixed(0)} ink ${(t2 - t1).toFixed(0)} upload ${(t3 - t2).toFixed(0)}`);
  const lx = light === 'right' ? -1 : 1;
  const L = Math.hypot(1, lightTilt);
  const src = api.bakeShader(rw, rh, ROCK_GLSL, {
    scale,
    uniforms: {
      uId: tId, uPar: tPar, uAux: tAux, uFld: tFld, uInk: tInk, uFol: tFol, uCun: tCun, uNoise: noiseTex(api),
      uRect: [rx, ry, rw, rh], uPx: [pw, ph],
      uPaper: paper.map((v) => v / 255), uInkCol: ink.map((v) => v / 255), uSnow: snowColor.map((v) => v / 255),
      uShadow: [lx / L, lightTilt / L], uFeat: feature, uFar: far, uTexAmt: texture, uSeed: (seed * 0.6180339) % 1, uDebug: globalThis.__rockDebug || 0,
    },
  });
  api.gl.finish();
  console.warn(`rock timing shader ${(PT.now() - t3).toFixed(0)}`);
  for (const t of [tId, tPar, tAux, tFld, tInk, tFol, tCun]) api.engine.freeTex(t);
  const anchors = items.map((it) => it.anchors);
  return { src, rect: [rx, ry, rw, rh], anchors, layer: (opts = {}) => api.tex(src, { rect: [rx, ry, rw, rh], ...opts }) };
}

export function makeCliff(api, spec, bakeOpts = {}) {
  const item = cliff(spec);
  const bb = item.bb;
  const pad = 60;
  const rect = bakeOpts.rect || [Math.floor(bb.x0 - pad), Math.floor(bb.y0 - pad), Math.ceil(bb.w + pad * 2), Math.ceil(bb.h + pad * 2)];
  const r = bakeRocks(api, { ...bakeOpts, rect, items: [item], seed: spec.seed ?? 1 });
  return { ...r, item, anchors: item.anchors };
}
