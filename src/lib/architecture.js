// Architecture painted like ink-and-colour on rice paper: pavilions, temple halls,
// gates, ruined watchtowers, stone arch bridges and rope bridges.
//
// Every painter draws into a Canvas2D context in DESIGN px (so a scene can paint
// several elements into one bake) and returns anchor points. All randomness comes
// from `seed` (deterministic). Common options for every painter:
//   seed   : number|string   variation seed (default 1)
//   fade   : 0..1            atmospheric distance: inks and reds fade toward the paper
//   paper  : [r,g,b]         paper colour the fade mixes toward (default PAPER)
//   snow   : bool            snow on roofs / ledges (white roofs, dark eave lines)
// Buildings are modelled as simple 3D solids (rectangular plan) seen in a slight
// 3/4 view and painted face by face: dark tiled roofs with upturned eaves, ridge
// finials, vermilion columns, pale walls, railings, stone platforms.
//
// Painters (all return anchors in design px):
//   paintPavilion(ctx, {x, y, w, tiers=2, turn=-1.1, aspect=1.25, bays=[3,2], railing=true, ...})
//       (x, y) = bottom centre of the stone base, w = lower eave span (px).
//       -> { base:[x,y], top:[x,yFinial], left:[x,y], right:[x,y], floorY, k }
//   paintHall(ctx, {x, y, w, tiers=1, turn=0.45, aspect=2.2, bays=[5,2], door=true, steps=true, gable=true, railing=false, ...})
//   paintTemple(ctx, {x, y, w, turn, snow, side=true, terrace=true, stairs:'front'|'left'|'right', mirror=false, ...})
//       main hall + side hall(s) + terrace with stone balustrade + stairs.
//   paintGate(ctx, {x, y, w, turn=-0.25, ...})       open gate pavilion with red posts, double lintel, low railing.
//   paintTower(ctx, {x, y, w, h, side=1, ruin=0.6, windows=2, annex=true, overgrow=0.6, ...})
//       ruined stone watchtower, (x, y) = bottom centre, w = width incl. side face.
//   paintArchBridge(ctx, {x0, x1, y, deck, hump, arches:[{c, span, crown}], ...})
//       stone arch bridge, y = water/footing line; arches c = centre x (px), span (px), crown y (px).
//   paintRopeBridge(ctx, {a:[x,y], b:[x,y], sag, hand, spacing, figure, ...})
//       sagging rope walkway between two anchor points (deck ends).
//
// Baking helpers:
//   bakeArch(api, rect, (ctx) => { paintX(ctx, ...); ... }, {scale=2, blur, edge, granulation, bleed})
//       -> texture source covering rect [x,y,w,h] (design px), softened + inkified.
//   makeArch(api, kind, opts, bakeOpts) -> { src, rect, anchors }  (kind: 'pavilion'|'hall'|'temple'|'gate'|'tower'|'archBridge'|'ropeBridge')
//       picks a tight rect automatically; use api.tex(src, { rect, z }).
//
// Example:
//   import { makeArch } from '../lib/architecture.js';
//   const pav = makeArch(api, 'pavilion', { x: 277, y: 470, w: 150, seed: 3 });
//   layers.push(api.tex(pav.src, { rect: pav.rect, z: 1.2 }));
//   // several far pavilions in one bake:
//   const far = bakeArch(api, [600, 150, 1200, 500], (ctx) => {
//     paintPavilion(ctx, { x: 760, y: 245, w: 36, fade: 0.35, seed: 1 });
//     paintPavilion(ctx, { x: 1070, y: 320, w: 50, fade: 0.2, seed: 2 });
//   });
import { makeRng, makeNoise, clamp, mix } from '../engine/rng.js';
import { PAPER, tone, rgba, stroke, blob, dryStroke } from './brush.js';
import { inkify } from './inkfx.js';

const RED = [162, 42, 32];
const RED_DARK = [92, 28, 22];

// ---------------------------------------------------------------- style
function makeStyle(opts = {}) {
  const seed = opts.seed ?? 1;
  const paper = opts.paper || PAPER;
  const fade = clamp(opts.fade ?? 0);
  const S = { paper, fade, seed, snow: !!opts.snow, rng: makeRng('arch:' + seed), nz: makeNoise('arch-n:' + seed) };
  S.inkc = (v) => tone(mix(clamp(v), 1, fade * 0.94), paper);
  S.ink = (v, a = 1) => rgba(S.inkc(v), a);
  S.redc = (dark = 0) => {
    const c = [mix(RED[0], RED_DARK[0], dark), mix(RED[1], RED_DARK[1], dark), mix(RED[2], RED_DARK[2], dark)];
    const f = fade * 0.88;
    return [mix(c[0], paper[0], f), mix(c[1], paper[1], f), mix(c[2], paper[2], f)];
  };
  S.red = (dark = 0, a = 1) => rgba(S.redc(dark), a);
  return S;
}

// ---------------------------------------------------------------- drawing helpers
// hand-wobbled polyline: small low-frequency perpendicular drift
function wob(S, pts, amp = 0.25, freq = 0.08) {
  if (amp <= 0 || pts.length < 2) return pts;
  const ph = S.rng() * 100;
  let L = 0;
  return pts.map((p, i) => {
    if (i > 0) L += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1;
    const o = S.nz.n2(L * freq + ph, ph * 0.37) * amp;
    return [p[0] - dy / l * o, p[1] + dx / l * o];
  });
}
function path(ctx, pts, close = false) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
}
function line(ctx, S, pts, w, color, amp = 0.2) {
  const p = wob(S, pts, amp);
  ctx.lineWidth = Math.max(0.3, w);
  ctx.strokeStyle = color;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  path(ctx, p);
  ctx.stroke();
}
function fillPoly(ctx, pts, color) { path(ctx, pts, true); ctx.fillStyle = color; ctx.fill(); }
function lerp2(a, b, t) { return [mix(a[0], b[0], t), mix(a[1], b[1], t)]; }
function sub2(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
function convexHull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  up.pop(); lo.pop();
  return lo.concat(up);
}
// ragged dry-brush edge along a polyline (broken dark dabs)
function raggedEdge(ctx, S, pts, w, v, a) {
  for (let i = 0; i < pts.length - 1; i++) {
    if (S.rng() < 0.18) continue;
    const p = pts[i], q = pts[i + 1];
    line(ctx, S, [p, lerp2(p, q, 0.6 + S.rng() * 0.5)], w * (0.6 + S.rng() * 0.8), S.ink(v, a * (0.6 + S.rng() * 0.4)), 0.3);
  }
}
// Draw into an offscreen layer covering bbox [x,y,w,h] (design px) at the context's pixel
// density, mask it with `poly` (destination-in) and composite it back. Much faster than many
// draws under a complex clip path.
function withLayer(ctx, bbox, poly, draw) {
  const m = ctx.getTransform();
  const sc = Math.hypot(m.a, m.b) || 1;
  const [bx, by, bw, bh] = bbox;
  const pw = Math.max(1, Math.ceil(bw * sc)), ph = Math.max(1, Math.ceil(bh * sc));
  const cv = new OffscreenCanvas(pw, ph);
  const g = cv.getContext('2d');
  g.setTransform(sc, 0, 0, sc, -bx * sc, -by * sc);
  draw(g);
  g.globalCompositeOperation = 'destination-in';
  path(g, poly, true); g.fillStyle = '#000'; g.fill();
  ctx.drawImage(cv, bx, by, pw / sc, ph / sc);
}
function polyBox(poly, pad = 2) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of poly) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  return [Math.floor(x0 - pad), Math.floor(y0 - pad), Math.ceil(x1 - x0 + 2 * pad), Math.ceil(y1 - y0 + 2 * pad)];
}
// soft round dab (radial falloff) - a cheap stand-in for a blurred blob
function softDot(ctx, x, y, r, c, a, squash = 1, rot = 0) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot); ctx.scale(1, squash);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, rgba(c, a)); g.addColorStop(0.55, rgba(c, a * 0.6)); g.addColorStop(1, rgba(c, 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function resample(pts, step) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let j = 1; j <= n; j++) out.push(lerp2(a, b, j / n));
  }
  return out;
}

// ---------------------------------------------------------------- 3D view
// Orthographic view: X right, Y up, Z toward the viewer, rotated by `turn` about the
// vertical axis (negative turn shows the right side), looked at from slightly above.
function makeView(cx, by, k, turn, tilt) {
  const c = Math.cos(turn), s = Math.sin(turn), ct = Math.cos(tilt), st = Math.sin(tilt);
  return {
    cx, by, k, c, s,
    P(X, Y, Z) { const xr = X * c + Z * s, zr = -X * s + Z * c; return [cx + xr * k, by - (Y * ct - zr * st) * k, zr]; },
    facing(nx, nz) { return -nx * s + nz * c; },  // rotated z of a plan normal (> 0: faces the viewer)
    lightX(nx, nz) { return nx * c + nz * s; },   // rotated x of a plan normal (> 0: lit from the right)
  };
}
const CORNERS = [[-1, 1], [1, 1], [1, -1], [-1, -1]]; // FL FR BR BL (sign of X, Z)
const EDGE_N = [[0, 1], [1, 0], [0, -1], [-1, 0]];     // outward normal of edge i (corner i -> i+1)

// ---------------------------------------------------------------- roof
// R = { A, B, Ye, lift, out, prof, sag, top: {kind:'ring'|'ridge'|'point', A, B, half, Y}, tone, th, gable, finials, finH }
function roofModel(V, R) {
  const E = CORNERS.map(([sx, sz]) => [sx * R.A, sz * R.B]);
  const T = CORNERS.map(([sx, sz]) => {
    const t = R.top;
    if (t.kind === 'ring') return [sx * t.A, sz * t.B];
    if (t.kind === 'ridge') return [sx * t.half, 0];
    return [0, 0];
  });
  const lam = R.lam ?? 0.16;
  const edgeLen = E.map((e, i) => { const f = E[(i + 1) % 4]; return Math.hypot(f[0] - e[0], f[1] - e[1]); });
  const prof = R.prof ?? 1.5;
  const hip3 = (i, s) => {
    const [ex, ez] = E[i], [tx, tz] = T[i];
    const cs = Math.pow(s, 7);
    return [mix(tx, ex, s) + CORNERS[i][0] * R.out * cs, R.Ye + (R.top.Y - R.Ye) * Math.pow(1 - s, prof) + R.lift * cs, mix(tz, ez, s) + CORNERS[i][1] * R.out * cs];
  };
  const cw = (i, t) => { const L = edgeLen[i]; const f = (u) => Math.exp(-u * L / lam); const n = 1 + f(1); return [f(t) / n, f(1 - t) / n]; };
  const face3 = (i, s, t) => {
    const i1 = (i + 1) % 4;
    const [ex0, ez0] = E[i], [ex1, ez1] = E[i1], [tx0, tz0] = T[i], [tx1, tz1] = T[i1];
    let X = mix(mix(tx0, ex0, s), mix(tx1, ex1, s), t), Z = mix(mix(tz0, ez0, s), mix(tz1, ez1, s), t);
    let Y = R.Ye + (R.top.Y - R.Ye) * Math.pow(1 - s, prof);
    const cs = Math.pow(s, 7);
    const [w0, w1] = cw(i, t);
    Y += R.lift * cs * (w0 + w1) - (R.sag ?? 0.015) * cs * Math.sin(Math.PI * t) * Math.min(1, edgeLen[i] / 1.5);
    X += (CORNERS[i][0] * w0 + CORNERS[i1][0] * w1) * R.out * cs;
    Z += (CORNERS[i][1] * w0 + CORNERS[i1][1] * w1) * R.out * cs;
    return [X, Y, Z];
  };
  const P = (p) => V.P(p[0], p[1], p[2]);
  return { E, T, hip3, face3, P, edgeLen };
}

function paintRoof(ctx, S, V, R) {
  const M = roofModel(V, R);
  const k = V.k;
  const lod = k < 9 ? 0 : k < 20 ? 1 : 2;     // level of detail by pixel size
  const order = [0, 1, 2, 3].map((i) => ({ i, z: V.facing(...EDGE_N[i]) })).sort((a, b) => a.z - b.z);
  const NS = lod ? 16 : 8;
  const faceOutline = (i) => {
    const pts = [];
    for (let j = 0; j <= NS; j++) pts.push(M.P(M.face3(i, 0, j / NS)));
    for (let j = 0; j <= NS; j++) pts.push(M.P(M.face3(i, j / NS, 1)));
    for (let j = NS; j >= 0; j--) pts.push(M.P(M.face3(i, 1, j / NS)));
    for (let j = NS; j >= 0; j--) pts.push(M.P(M.face3(i, j / NS, 0)));
    return pts;
  };
  const baseTone = R.tone ?? 0.56;
  const snow = S.snow;
  const th = Math.max(0.6, (R.th ?? 0.04) * (snow ? 1.6 : 1) * k);
  let topY = Infinity;
  // soffit: the dark underside seen below the lifted eave corners
  for (const { i, z } of order) {
    if (z < -0.3) continue;
    const top = [], bot = [];
    for (let j = 0; j <= 16; j++) {
      const t = j / 16;
      top.push(M.P(M.face3(i, 1, t)));
      const p = M.face3(i, 0.82, t);
      bot.push(V.P(p[0], R.Ye - 0.06, p[2]));
    }
    fillPoly(ctx, [...top, ...bot.reverse()], S.ink(snow ? 0.25 : 0.16, 0.95));
  }
  // face fills (back to front)
  for (const { i, z } of order) {
    const pts = faceOutline(i);
    for (const p of pts) topY = Math.min(topY, p[1]);
    const nxr = V.lightX(...EDGE_N[i]);
    const tv = snow ? 0.93 + 0.05 * nxr : baseTone + (z < 0 ? -0.06 : 0) + (R.shade ?? 0.1) * nxr;
    fillPoly(ctx, pts, S.ink(tv));
    if (z > -0.2) {
      ctx.save();
      path(ctx, pts, true); ctx.clip();
      const top = M.P(M.face3(i, 0, 0.5)), bot = M.P(M.face3(i, 1, 0.5));
      const g = ctx.createLinearGradient(top[0], top[1], bot[0], bot[1]);
      if (snow) {
        g.addColorStop(0, S.ink(0.6, 0.05)); g.addColorStop(0.15, S.ink(0.6, 0)); g.addColorStop(0.8, S.ink(0.6, 0.02)); g.addColorStop(1, S.ink(0.55, 0.16 - 0.08 * nxr));
      } else {
        g.addColorStop(0, S.ink(0.1, 0.25)); g.addColorStop(0.2, S.ink(0.2, 0.0)); g.addColorStop(0.75, S.ink(0.2, 0.05)); g.addColorStop(1, S.ink(0.1, 0.35));
      }
      ctx.fillStyle = g; ctx.fill();
      ctx.restore();
    }
  }
  // tile rows: parallel in plan, running up the slope until they meet a hip or the top
  for (const { i, z } of order) {
    if (z < -0.15) continue;
    const i1 = (i + 1) % 4;
    const ex = M.E[i1][0] - M.E[i][0], ez = M.E[i1][1] - M.E[i][1];
    const L = Math.hypot(ex, ez), ux = ex / L, uz = ez / L;
    const xT0 = (M.T[i][0] - M.E[i][0]) * ux + (M.T[i][1] - M.E[i][1]) * uz;
    const xT1 = (M.T[i1][0] - M.E[i][0]) * ux + (M.T[i1][1] - M.E[i][1]) * uz;
    const eL = Math.hypot(...sub2(M.P(M.face3(i, 1, 0)), M.P(M.face3(i, 1, 1))));
    const sp = R.tileSp ?? Math.max(lod === 2 ? 2.2 : 1.8, 0.065 * k);
    const n = Math.max(2, Math.round(eL / sp));
    const fan = R.fan ?? 0.25;
    const row = (x) => {
      let sMin = 0;
      if (x < xT0) sMin = Math.max(sMin, (xT0 - x) / xT0);
      if (x > xT1) sMin = Math.max(sMin, (x - xT1) / (L - xT1));
      sMin = clamp(mix(sMin, 0, fan));
      const pts = [];
      for (let q = 0; q <= 10; q++) {
        const s = mix(sMin, 1, q / 10);
        const xh0 = mix(xT0, 0, s), xh1 = mix(xT1, L, s);
        const tPar = clamp((x - xh0) / Math.max(1e-4, xh1 - xh0));
        pts.push(M.P(M.face3(i, s, mix(tPar, x / L, fan * (1 - s)))));
      }
      return pts;
    };
    for (let j = 1; j < n; j++) {
      const x = L * (j + (S.rng() - 0.5) * 0.25) / n;
      if (snow) {
        if (lod && S.rng() < 0.3) line(ctx, S, row(x).slice(7), Math.max(0.4, 0.015 * k), S.ink(0.6, 0.22), 0.1);
      } else if (lod === 0) {
        if (j % 2) line(ctx, S, row(x).slice(3), 0.45, S.ink(0.15, 0.3), 0.05);
      } else {
        line(ctx, S, row(x), Math.max(0.5, 0.03 * k), S.ink(0.08, 0.45 + S.rng() * 0.3), 0.1);
        line(ctx, S, row(L * (j + 0.5) / n).slice(1), Math.max(0.4, 0.022 * k), S.ink(0.9, 0.2 + S.rng() * 0.15), 0.08);
      }
    }
  }
  // painterly unevenness on the tiled faces: soft dark and pale patches (ink pooling)
  if (lod && !snow) {
    for (const { i, z } of order) {
      if (z < -0.15) continue;
      const pts = faceOutline(i);
      ctx.save(); path(ctx, pts, true); ctx.clip();
      const n = Math.round(4 + k * 0.12);
      for (let j = 0; j < n; j++) {
        const p = M.P(M.face3(i, 0.15 + S.rng() * 0.85, S.rng()));
        const dark = S.rng() < 0.6;
        softDot(ctx, p[0], p[1], (0.12 + S.rng() * 0.22) * k, S.inkc(dark ? 0.08 : 0.92), dark ? 0.12 + S.rng() * 0.14 : 0.1 + S.rng() * 0.12, 0.5 + S.rng() * 0.4, (S.rng() - 0.5) * 0.6);
      }
      ctx.restore();
    }
  }
  // hips
  for (let h = 0; h < 4; h++) {
    const fa = V.facing(...EDGE_N[(h + 3) % 4]), fb = V.facing(...EDGE_N[h]);
    if (fa < -0.2 && fb < -0.2) continue;
    const pts = [];
    for (let q = 0; q <= 14; q++) pts.push(M.P(M.hip3(h, q / 14)));
    const sil = fa * fb < 0;
    line(ctx, S, pts, Math.max(0.6, (sil ? 0.03 : 0.045) * k), snow ? S.ink(0.35, sil ? 0.45 : 0.6) : S.ink(0.08, sil ? 0.75 : 0.9), 0.15);
    // small ridge beasts near the tip
    if (lod === 2 && !snow) {
      for (const s of [0.8, 0.87, 0.93]) {
        const p = M.P(M.hip3(h, s));
        const sz = 0.045 * k;
        stroke(ctx, [[p[0], p[1] + sz * 0.2], [p[0] + (S.rng() - 0.5) * sz * 0.3, p[1] - sz]], { width: sz * 0.7, profile: 'taper', color: S.inkc(0.06), rng: S.rng, rough: 0, smooth: false });
      }
    }
  }
  // xieshan gable on the visible short side
  if (R.gable && R.top.kind === 'ridge') {
    for (const side of [1, 3]) {
      const zf = V.facing(...EDGE_N[side]);
      if (zf < 0.08) continue;
      const sx = side === 1 ? 1 : -1;
      const hA = side === 1 ? 1 : 0, hB = side === 1 ? 2 : 3;  // hips of that side
      const sg = R.gableS ?? 0.62;
      const a = M.hip3(hA, sg), b = M.hip3(hB, sg);
      const apex = V.P(sx * R.top.half, R.top.Y + 0.02, 0);
      const pa = M.P(a), pb = M.P(b);
      fillPoly(ctx, [apex, pa, pb], snow ? S.ink(0.8) : S.ink(0.72));
      if (lod) {
        const nb = Math.max(2, Math.round(Math.abs(pa[0] - pb[0]) / 2.2));
        for (let j = 1; j < nb; j++) { const t = j / nb; const q = lerp2(pb, pa, t); line(ctx, S, [q, lerp2(q, apex, 0.75 - Math.abs(t - 0.5))], 0.35, S.ink(0.4, 0.25), 0.05); }
        const cxy = lerp2(lerp2(pa, pb, 0.5), apex, 0.4);
        blob(ctx, cxy[0], cxy[1], Math.max(0.6, 0.05 * k), { color: S.red(0.05, 0.95), rng: S.rng, sides: 8, irregular: 0.1 });
        blob(ctx, cxy[0], cxy[1], Math.max(0.3, 0.02 * k), { color: S.ink(0.15, 0.8), rng: S.rng, sides: 6 });
      }
      line(ctx, S, [lerp2(apex, pa, -0.05), pa], Math.max(0.6, 0.04 * k), S.ink(snow ? 0.2 : 0.06, 0.95), 0.1);
      line(ctx, S, [lerp2(apex, pb, -0.05), pb], Math.max(0.6, 0.04 * k), S.ink(snow ? 0.2 : 0.06, 0.95), 0.1);
      line(ctx, S, [pa, pb], Math.max(0.5, 0.025 * k), S.ink(0.15, 0.7), 0.1);
      if (snow) {
        line(ctx, S, [lerp2(apex, pa, 0.02), lerp2(apex, pa, 0.95)], Math.max(0.5, 0.025 * k), S.ink(0.98, 0.9), 0.2);
        line(ctx, S, [lerp2(apex, pb, 0.02), lerp2(apex, pb, 0.95)], Math.max(0.5, 0.025 * k), S.ink(0.98, 0.9), 0.2);
      }
    }
  }
  // ridge + finials
  const finH = 0.22 * k * (R.finH ?? 1);
  if (R.top.kind === 'ridge') {
    const a = M.P(M.hip3(0, 0)), b = M.P(M.hip3(1, 0));
    const mid = lerp2(a, b, 0.5);
    const rp = [a, [mid[0], mid[1] + 0.02 * k], b];
    line(ctx, S, rp, Math.max(0.8, 0.06 * k), snow ? S.ink(0.3, 0.8) : S.ink(0.06), 0.15);
    if (snow) line(ctx, S, rp.map((p) => [p[0], p[1] - 0.03 * k]), Math.max(0.6, 0.05 * k), S.ink(0.98), 0.2);
    if (R.finials !== false) { finial(ctx, S, a[0], a[1], finH, -1, lod); finial(ctx, S, b[0], b[1], finH, 1, lod); }
    topY = Math.min(topY, Math.min(a[1], b[1]) - finH * (R.finials !== false ? 1.05 : 0.1));
  } else if (R.top.kind === 'point') {
    const a = M.P(M.hip3(0, 0));
    if (R.finials !== false) finial(ctx, S, a[0], a[1], finH * 1.2, 0, lod);
    topY = Math.min(topY, a[1] - finH * 1.25);
  }
  // eave fascia band, tile ends, soffit shadow
  for (const { i, z } of order) {
    if (z < -0.25) continue;
    const top = [], bot = [];
    for (let j = 0; j <= 24; j++) { const p = M.P(M.face3(i, 1, j / 24)); top.push(p); bot.push([p[0], p[1] + th]); }
    const sh = bot.map((p) => [p[0], p[1] + th * 0.9]);
    fillPoly(ctx, [...bot, ...sh.slice().reverse()], S.ink(0.15, snow ? 0.5 : 0.7));
    fillPoly(ctx, [...top, ...bot.slice().reverse()], S.ink(snow ? 0.12 : 0.05, 0.95));
    if (lod) {
      const eL = Math.hypot(top[24][0] - top[0][0], top[24][1] - top[0][1]);
      const n = Math.round(eL / Math.max(1.6, 0.06 * k));
      for (let j = 0; j <= n; j++) {
        const p = M.P(M.face3(i, 1, j / n));
        blob(ctx, p[0], p[1] + th * 1.15, Math.max(0.4, th * 0.42), { color: S.ink(0.05, 0.85), rng: S.rng, irregular: 0.25, sides: 6 });
        if (lod === 2 && !snow && j % 2 === 0) blob(ctx, p[0] + 0.02 * k, p[1] - th * 0.15, Math.max(0.35, th * 0.32), { color: S.ink(0.85, 0.45), rng: S.rng, sides: 6 });
      }
    }
    if (snow) {
      // snow cushion riding over the eave edge: lumpy, bulging above the roof line and
      // drooping over the dark tile band in places
      const ph = i * 3.1 + S.rng() * 10;
      const cap = top.map((p, j) => [p[0], p[1] - th * (0.7 + 0.45 * S.nz.n2(j * 0.5, ph))]);
      const capB = top.map((p, j) => [p[0], p[1] + th * (0.0 + 0.5 * Math.max(0, S.nz.n2(j * 0.38 + 9, ph)) ** 1.5)]);
      fillPoly(ctx, [...cap, ...capB.slice().reverse()], S.ink(0.985));
      line(ctx, S, capB, Math.max(0.35, 0.014 * k), S.ink(0.55, 0.4), 0.2);
      line(ctx, S, cap, Math.max(0.3, 0.01 * k), S.ink(0.7, 0.25), 0.2);
    }
  }
  // upturned corner tips
  for (let h = 0; h < 4; h++) {
    const fa = V.facing(...EDGE_N[(h + 3) % 4]), fb = V.facing(...EDGE_N[h]);
    if (fa < -0.25 && fb < -0.25) continue;
    const c0 = M.P(M.hip3(h, 0.96)), c1 = M.P(M.hip3(h, 1));
    const sil = fa * fb < 0;
    const dir = Math.sign(c1[0] - c0[0]) || (h === 0 || h === 3 ? -1 : 1);
    const L = (sil ? 0.09 : 0.05) * k * (R.hook ?? 1);
    const pts = [[c1[0] - dir * L * 0.8, c1[1] + th * 0.7], [c1[0], c1[1] + th * 0.1], [c1[0] + dir * L * 0.5, c1[1] - L * 0.35], [c1[0] + dir * L * 0.8, c1[1] - L * 0.9]];
    stroke(ctx, pts, { width: Math.max(0.8, th * 1.5), profile: 'taper', color: snow ? S.inkc(0.15) : S.inkc(0.05), rng: S.rng, rough: 0.05, step: 1 });
    if (snow) blob(ctx, c1[0] - dir * L * 0.1, c1[1] - th * 0.6, Math.max(0.6, th * 0.9), { color: S.ink(0.98), rng: S.rng, squash: 0.6 });
  }
  return { M, topY };
}

// Ridge-end ornament (finial), base at (x, y), height h, dir -1/1 = left/right end.
function finial(ctx, S, x, y, h, dir, lod = 2) {
  const c = S.snow ? S.inkc(0.1) : S.inkc(0.06);
  const col = rgba(c, 1);
  if (lod === 0) { line(ctx, S, [[x, y], [x + dir * h * 0.05, y - h]], Math.max(0.6, h * 0.28), col, 0); return; }
  // gourd-shaped ridge ornament: base block, narrow neck, round bulb, short spike
  fillPoly(ctx, wob(S, [[x - h * 0.2, y + h * 0.05], [x + h * 0.2, y + h * 0.05], [x + h * 0.13, y - h * 0.3], [x - h * 0.13, y - h * 0.3]], 0.15), col);
  line(ctx, S, [[x, y - h * 0.3], [x + dir * h * 0.02, y - h * 0.5]], h * 0.12, col, 0.05);
  blob(ctx, x + dir * h * 0.03, y - h * 0.62, h * 0.17, { color: col, rng: S.rng, irregular: 0.12, squash: 1.15 });
  blob(ctx, x + dir * h * 0.035, y - h * 0.84, h * 0.08, { color: col, rng: S.rng, irregular: 0.15 });
  stroke(ctx, [[x + dir * h * 0.04, y - h * 0.86], [x + dir * h * 0.05, y - h * 1.05]], { width: h * 0.07, profile: 'taper', color: c, rng: S.rng, rough: 0, smooth: false });
  if (S.snow) blob(ctx, x, y - h * 0.72, h * 0.13, { color: S.ink(0.98, 0.9), rng: S.rng, squash: 0.6 });
}

// ---------------------------------------------------------------- platforms, steps, railings
function prismFaces(V, A, B, y0, y1) {
  const faces = [];
  for (let i = 0; i < 4; i++) {
    const z = V.facing(...EDGE_N[i]);
    const [sx0, sz0] = CORNERS[i], [sx1, sz1] = CORNERS[(i + 1) % 4];
    faces.push({ i, z, p: [V.P(sx0 * A, y0, sz0 * B), V.P(sx1 * A, y0, sz1 * B), V.P(sx1 * A, y1, sz1 * B), V.P(sx0 * A, y1, sz0 * B)] });
  }
  return faces.sort((a, b) => a.z - b.z);
}
function edgePoints(A, B, i, n) {
  const [sx0, sz0] = CORNERS[i], [sx1, sz1] = CORNERS[(i + 1) % 4];
  const out = [];
  for (let j = 0; j <= n; j++) { const t = j / n; out.push([mix(sx0 * A, sx1 * A, t), mix(sz0 * B, sz1 * B, t)]); }
  return out;
}

function paintPlatform(ctx, S, V, A, B, h, opts = {}) {
  const k = V.k;
  const faces = prismFaces(V, A, B, 0, h);
  const rag = opts.ragged ?? 0.35;
  for (const f of faces) {
    if (f.z <= 0) continue;
    let poly = f.p;
    if (rag > 0) {
      const bot = [];
      const hp = Math.abs(f.p[3][1] - f.p[0][1]);
      const nseg = 18;
      let v = S.rng() * 0.5;
      for (let j = 0; j <= nseg; j++) {
        const t = j / nseg;
        v = clamp(v * 0.6 + (S.rng() < 0.3 ? S.rng() : S.rng() * 0.3));
        bot.push([mix(f.p[0][0], f.p[1][0], t) + (S.rng() - 0.5) * 0.04 * k, mix(f.p[0][1], f.p[1][1], t) - hp * rag * v]);
      }
      poly = [...bot, f.p[2], f.p[3]];
    }
    const nxr = V.lightX(...EDGE_N[f.i]);
    const tv = (opts.tone ?? 0.82) + 0.03 * nxr;
    fillPoly(ctx, poly, S.ink(tv));
    ctx.save(); path(ctx, poly, true); ctx.clip();
    const yb = Math.max(f.p[0][1], f.p[1][1]), yt = Math.min(f.p[2][1], f.p[3][1]);
    const xl = Math.min(f.p[0][0], f.p[1][0]), xr = Math.max(f.p[0][0], f.p[1][0]);
    const g = ctx.createLinearGradient(0, yt, 0, yb);
    g.addColorStop(0, S.ink(0.4, 0.0)); g.addColorStop(0.6, S.ink(0.4, 0.12)); g.addColorStop(1, S.ink(0.35, 0.4));
    ctx.fillStyle = g; ctx.fillRect(xl - 2, yt - 2, xr - xl + 4, yb - yt + 4);
    if (k > 8) {
      const n = Math.round((xr - xl) / (0.16 * k)) + 2;
      for (let j = 0; j < n; j++) {
        const t = S.rng(), u = 0.15 + S.rng() * 0.85;
        const x = mix(f.p[0][0], f.p[1][0], t), y = mix(mix(f.p[0][1], f.p[1][1], t), mix(f.p[3][1], f.p[2][1], t), 1 - u);
        softDot(ctx, x, y, (0.06 + S.rng() * 0.12) * k, S.inkc(0.4), 0.1 + S.rng() * 0.25, 0.35 + S.rng() * 0.4, S.rng() * 0.6 - 0.3);
      }
      for (let j = 0; j < n * 0.35; j++) {
        const t = S.rng(), u = S.rng();
        const x = mix(f.p[0][0], f.p[1][0], t), y = mix(mix(f.p[0][1], f.p[1][1], t), mix(f.p[3][1], f.p[2][1], t), u);
        line(ctx, S, [[x, y], [x + (S.rng() - 0.5) * 0.05 * k, y + (0.04 + S.rng() * 0.08) * k]], Math.max(0.4, 0.015 * k), S.ink(0.25, 0.4), 0.1);
      }
    }
    const l0 = f.p[3], l1 = f.p[2], dl = 0.07 * k;
    fillPoly(ctx, [l0, l1, [l1[0], l1[1] + dl], [l0[0], l0[1] + dl]], S.ink(S.snow ? 0.98 : 0.95, 0.85));
    ctx.restore();
    line(ctx, S, [f.p[3], f.p[2]], Math.max(0.5, 0.025 * k), S.ink(0.3, 0.7), 0.2);
    if (S.snow) {
      // snow on the ledge, softly overhanging
      const a = f.p[3], b = f.p[2], pts = [];
      for (let j = 0; j <= 12; j++) { const p = lerp2(a, b, j / 12); pts.push([p[0], p[1] + (0.03 + 0.05 * Math.max(0, S.nz.n2(j * 0.7, f.i + 3))) * k]); }
      fillPoly(ctx, [[a[0], a[1] - 0.04 * k], [b[0], b[1] - 0.04 * k], ...pts.reverse()], S.ink(0.985));
    }
  }
  const top = CORNERS.map(([sx, sz]) => V.P(sx * A, h, sz * B));
  fillPoly(ctx, top, S.ink(S.snow ? 0.97 : 0.9));
}

// stone balustrade (pale posts and rails) along the front edges of a terrace
function paintStoneRail(ctx, S, V, A, B, y, h, opts = {}) {
  const k = V.k;
  for (let i = 0; i < 4; i++) {
    const z = V.facing(...EDGE_N[i]);
    if (z <= 0.05) continue;
    const [sx0, sz0] = CORNERS[i], [sx1, sz1] = CORNERS[(i + 1) % 4];
    const len = i % 2 === 0 ? 2 * A : 2 * B;
    const n = Math.max(2, Math.round(len / (opts.spacing ?? 0.32)));
    const gap = opts.gap && i === (opts.gapFace ?? 0) ? opts.gap : null;   // [t0, t1] opening for stairs
    const P = (t, yy) => V.P(mix(sx0 * A, sx1 * A, t), yy, mix(sz0 * B, sz1 * B, t));
    const segs = gap ? [[0, gap[0]], [gap[1], 1]] : [[0, 1]];
    const tn = opts.tone ?? 0.88;
    for (const [t0, t1] of segs) {
      if (t1 - t0 < 0.02) continue;
      const r0 = P(t0, y + h * 0.8), r1 = P(t1, y + h * 0.8), b0 = P(t0, y + h * 0.15), b1 = P(t1, y + h * 0.15);
      fillPoly(ctx, [P(t0, y), P(t1, y), r1, r0], S.ink(tn - 0.06, tn < 0.6 ? 0.9 : 0.55));
      line(ctx, S, [r0, r1], Math.max(0.7, 0.05 * k), S.ink(S.snow ? 0.97 : tn + 0.02), 0.1);
      line(ctx, S, [[r0[0], r0[1] + 0.03 * k], [r1[0], r1[1] + 0.03 * k]], Math.max(0.4, 0.018 * k), S.ink(0.25, 0.65), 0.15);
      line(ctx, S, [b0, b1], Math.max(0.4, 0.018 * k), S.ink(0.3, 0.5), 0.15);
      const m = Math.max(1, Math.round(n * (t1 - t0)));
      for (let j = 0; j <= m; j++) {
        const t = mix(t0, t1, j / m);
        const pb = P(t, y), pt = P(t, y + h);
        line(ctx, S, [pb, pt], Math.max(0.8, 0.06 * k), S.ink(tn), 0.05);
        line(ctx, S, [[pb[0] + 0.03 * k, pb[1]], [pt[0] + 0.03 * k, pt[1]]], Math.max(0.35, 0.015 * k), S.ink(0.2, 0.6), 0.05);
        blob(ctx, pt[0], pt[1] - 0.02 * k, Math.max(0.5, 0.04 * k), { color: S.ink(S.snow ? 0.98 : tn - 0.02), rng: S.rng, sides: 7 });
        line(ctx, S, [[pt[0] - 0.035 * k, pt[1] + 0.01 * k], [pt[0] + 0.035 * k, pt[1] + 0.01 * k]], Math.max(0.3, 0.012 * k), S.ink(0.2, 0.5), 0.05);
      }
    }
  }
}

// a flight of steps descending from the platform edge (face `fi`, centred at t, width w units)
function paintSteps(ctx, S, V, fi, t, w, h, depth, n, opts = {}) {
  const k = V.k;
  const [sx0, sz0] = CORNERS[fi], [sx1, sz1] = CORNERS[(fi + 1) % 4];
  const A = opts.A, B = opts.B;
  const ex = sx1 * A - sx0 * A, ez = sz1 * B - sz0 * B, L = Math.hypot(ex, ez);
  const ux = ex / L, uz = ez / L, [nx, nz] = EDGE_N[fi];
  const cx = mix(sx0 * A, sx1 * A, t), cz = mix(sz0 * B, sz1 * B, t);
  const hw = w / 2;
  const P = (lat, out, y) => V.P(cx + ux * lat + nx * out, y, cz + uz * lat + nz * out);
  // cheek walls
  const cheek = (side) => {
    const lat = side * (hw + 0.05);
    fillPoly(ctx, [P(lat, 0, h + 0.06), P(lat, depth, 0.05), P(lat, depth, 0), P(lat, 0, 0)], S.ink(0.7));
  };
  const visSide = V.lightX(ux, uz) > 0 ? -1 : 1;
  cheek(visSide);
  for (let j = 0; j < n; j++) {
    const y0 = h * (1 - j / n), y1 = h * (1 - (j + 1) / n);
    const o0 = depth * j / n, o1 = depth * (j + 1) / n;
    // tread
    fillPoly(ctx, [P(-hw, o0, y0), P(hw, o0, y0), P(hw, o1, y0), P(-hw, o1, y0)], S.ink(S.snow ? 0.98 : 0.9));
    // riser
    fillPoly(ctx, [P(-hw, o1, y0), P(hw, o1, y0), P(hw, o1, y1), P(-hw, o1, y1)], S.ink(S.snow ? 0.62 : 0.55));
    line(ctx, S, [P(-hw, o1, y0), P(hw, o1, y0)], Math.max(0.35, 0.015 * k), S.ink(0.3, 0.55), 0.15);
  }
  cheek(-visSide);
  // cheek copings
  for (const side of [-1, 1]) {
    const lat = side * (hw + 0.05);
    line(ctx, S, [P(lat, -0.02, h + 0.08), P(lat, depth + 0.02, 0.07)], Math.max(0.6, 0.04 * k), S.ink(S.snow ? 0.97 : 0.86), 0.1);
    line(ctx, S, [P(lat, -0.02, h + 0.05), P(lat, depth + 0.02, 0.04)], Math.max(0.35, 0.014 * k), S.ink(0.3, 0.55), 0.1);
  }
}

// ---------------------------------------------------------------- one storey: walls, columns, railing, lintel, brackets
function paintStory(ctx, S, V, P) {
  const k = V.k;
  const { A, B, y0, y1 } = P;
  const nx = P.bays?.[0] ?? 3, nz = P.bays?.[1] ?? 2;
  const walls = P.walls ?? 'open';
  const lod = k < 9 ? 0 : k < 20 ? 1 : 2;
  const cw = Math.max(lod ? 0.9 : 0.7, (P.colW ?? 0.06) * k);
  // ---- interior / walls
  if (walls === 'open' || walls === 'screen') {
    const ring = [];
    for (const [sx, sz] of CORNERS) { ring.push(V.P(sx * A, y0, sz * B)); ring.push(V.P(sx * A, y1, sz * B)); }
    const hull = convexHull(ring.map((p) => [p[0], p[1]]));
    const wt = P.wallTone ?? 0.72;
    fillPoly(ctx, hull, S.ink(wt));
    ctx.save(); path(ctx, hull, true); ctx.clip();
    if (lod) {
      const backFaces = prismFaces(V, A * 0.98, B * 0.98, y0, y1).filter((f) => f.z < 0.05);
      ctx.save();
      ctx.filter = `blur(${Math.max(0.8, 0.09 * k).toFixed(2)}px)`;
      for (const f of backFaces) {
        const n = Math.max(1, Math.round(Math.abs(f.p[1][0] - f.p[0][0]) / (0.42 * k)));
        for (let j = 0; j < n; j++) {
          const t = (j + 0.3 + S.rng() * 0.4) / n;
          const b0 = lerp2(f.p[0], f.p[1], t), b1 = lerp2(f.p[3], f.p[2], t);
          line(ctx, S, [b0, lerp2(b0, b1, 0.8)], (0.12 + S.rng() * 0.12) * k, S.ink(Math.min(0.97, wt + 0.22), 0.4 + S.rng() * 0.3), 0.3);
          const t2 = (j + 0.9 + S.rng() * 0.1) / n;
          line(ctx, S, [lerp2(f.p[0], f.p[1], t2), lerp2(f.p[3], f.p[2], t2)], (0.05 + S.rng() * 0.06) * k, S.ink(wt - 0.3, 0.12 + S.rng() * 0.12), 0.3);
        }
      }
      ctx.restore();
    }
    const ys = hull.map((p) => p[1]); const ymin = Math.min(...ys), ymax = Math.max(...ys);
    const xs = hull.map((p) => p[0]);
    const g = ctx.createLinearGradient(0, ymin, 0, ymax);
    g.addColorStop(0, S.ink(0.15, 0.7)); g.addColorStop(0.12, S.ink(0.35, 0.25)); g.addColorStop(0.35, S.ink(0.5, 0.0)); g.addColorStop(1, S.ink(0.5, 0.06));
    ctx.fillStyle = g; ctx.fillRect(Math.min(...xs) - 2, ymin - 2, Math.max(...xs) - Math.min(...xs) + 4, ymax - ymin + 4);
    ctx.restore();
  } else if (walls === 'see') {
    // open gate: nothing behind the posts but a faint shadow band under the beams
  } else if (walls === 'hall') {
    for (const f of prismFaces(V, A, B, y0, y1)) {
      if (f.z <= 0.0) continue;
      const nxr = V.lightX(...EDGE_N[f.i]);
      const wt = (P.wallTone ?? 0.72) + 0.06 * nxr;
      fillPoly(ctx, f.p, S.ink(wt));
      const n = f.i % 2 === 0 ? nx : nz;
      const front = f.i === (P.doorFace ?? 0);
      for (let j = 0; j < n; j++) {
        const ta = j / n, tb = (j + 1) / n;
        const mid = (n - 1) / 2;
        const inset = 0.12;
        const a0 = lerp2(f.p[0], f.p[1], mix(ta, tb, inset)), a1 = lerp2(f.p[0], f.p[1], mix(ta, tb, 1 - inset));
        const b0 = lerp2(f.p[3], f.p[2], mix(ta, tb, inset)), b1 = lerp2(f.p[3], f.p[2], mix(ta, tb, 1 - inset));
        const at = (u, v) => lerp2(lerp2(a0, a1, u), lerp2(b0, b1, u), v);  // u across, v up
        if (front && P.door !== false && j === Math.floor(n / 2)) {
          // door: dark opening with a pale frame
          fillPoly(ctx, [at(0.08, 0), at(0.92, 0), at(0.92, 0.82), at(0.08, 0.82)], S.ink(0.1, 0.95));
          line(ctx, S, [at(0.5, 0), at(0.5, 0.8)], Math.max(0.3, 0.012 * k), S.ink(0.3, 0.6), 0.05);
          line(ctx, S, [at(0.04, 0.85), at(0.96, 0.85)], Math.max(0.4, 0.025 * k), S.red(0.1, 0.9), 0.05);
        } else if (front && (P.windows ?? 'all') !== 'none' && ((P.windows ?? 'all') === 'all' || Math.abs(j - mid) < 1.6)) {
          // lattice window over a low wall
          fillPoly(ctx, [at(0.06, 0.35), at(0.94, 0.35), at(0.94, 0.86), at(0.06, 0.86)], S.ink(wt - 0.28));
          if (lod === 2) {
            for (let q = 1; q < 4; q++) line(ctx, S, [at(q / 4, 0.36), at(q / 4, 0.85)], 0.4, S.ink(wt + 0.1, 0.5), 0.02);
            for (let q = 1; q < 5; q++) line(ctx, S, [at(0.07, 0.35 + q * 0.1), at(0.93, 0.35 + q * 0.1)], 0.35, S.ink(wt + 0.1, 0.4), 0.02);
          }
          line(ctx, S, [at(0.04, 0.33), at(0.96, 0.33)], Math.max(0.4, 0.022 * k), P.redFrames ? S.red(0.15, 0.85) : S.ink(0.35, 0.6), 0.05);
          if (P.redFrames) {
            line(ctx, S, [at(0.05, 0.35), at(0.05, 0.86)], Math.max(0.35, 0.018 * k), S.red(0.2, 0.8), 0.03);
            line(ctx, S, [at(0.95, 0.35), at(0.95, 0.86)], Math.max(0.35, 0.018 * k), S.red(0.2, 0.8), 0.03);
          }
        }
      }
      // shadow under the eaves
      ctx.save(); path(ctx, f.p, true); ctx.clip();
      const yt = Math.min(f.p[2][1], f.p[3][1]), yb = Math.max(f.p[0][1], f.p[1][1]);
      const g = ctx.createLinearGradient(0, yt, 0, yb);
      g.addColorStop(0, S.ink(0.15, 0.6)); g.addColorStop(0.18, S.ink(0.3, 0.12)); g.addColorStop(0.4, S.ink(0.3, 0));
      ctx.fillStyle = g; ctx.fillRect(Math.min(f.p[0][0], f.p[1][0]) - 1, yt - 1, Math.abs(f.p[1][0] - f.p[0][0]) + 2, yb - yt + 2);
      ctx.restore();
    }
  }
  // ---- columns
  const cols = [];
  for (let i = 0; i < 4; i++) {
    const n = i % 2 === 0 ? nx : nz;
    const pts = edgePoints(A, B, i, n);
    for (let j = 0; j < n; j++) cols.push(pts[j]);
  }
  const items = cols.map(([X, Z]) => ({ X, Z, zr: -X * V.s + Z * V.c })).sort((a, b) => a.zr - b.zr);
  const zmax = Math.max(A, B);
  const drawCol = (c) => {
    const b = V.P(c.X, y0, c.Z), t = V.P(c.X, y1, c.Z);
    line(ctx, S, [b, t], cw, S.red(0.0), 0.12);
    if (lod) {
      line(ctx, S, [[b[0] + cw * 0.28, b[1]], [t[0] + cw * 0.28, t[1]]], cw * 0.38, S.red(0.55, 0.55), 0.1);
      line(ctx, S, [[t[0], t[1] + 0.12 * k], t], cw * 1.05, S.red(0.6, 0.45), 0.05);
      line(ctx, S, [[t[0] - cw * 0.9, t[1] + 0.015 * k], [t[0] + cw * 0.9, t[1] + 0.015 * k]], Math.max(0.6, 0.03 * k), S.ink(0.15, 0.7), 0.05);
      if (S.snow || P.plinth) blob(ctx, b[0], b[1] - 0.01 * k, cw * 0.8, { color: S.ink(0.8, 0.9), rng: S.rng, squash: 0.5 });
    }
  };
  for (const c of items) {
    const back = c.zr < -0.02 * zmax;
    if (back) { if (walls === 'see') { const b = V.P(c.X, y0, c.Z), t = V.P(c.X, y1, c.Z); line(ctx, S, [b, t], cw * 0.9, S.red(0.35, 0.85), 0.12); } }
  }
  // ---- railing (behind front columns) on facing edges
  const railing = P.railing ?? (walls === 'open');
  if (railing) {
    const rh = P.railH ?? 0.2;
    for (let i = 0; i < 4; i++) {
      const z = V.facing(...EDGE_N[i]);
      if (z <= 0.02) continue;
      if (P.railSkip && P.railSkip.includes(i)) continue;
      const n = i % 2 === 0 ? nx : nz;
      const [sx0, sz0] = CORNERS[i], [sx1, sz1] = CORNERS[(i + 1) % 4];
      const Q = (t, yy) => V.P(mix(sx0 * A, sx1 * A, t), yy, mix(sz0 * B, sz1 * B, t));
      const gap = P.railGap && i === (P.doorFace ?? 0) ? P.railGap : null;
      const segs = gap ? [[0, gap[0]], [gap[1], 1]] : [[0, 1]];
      for (const [t0, t1] of segs) {
        line(ctx, S, [Q(t0, y0 + rh), Q(t1, y0 + rh)], Math.max(0.6, 0.032 * k), S.red(0.05), 0.15);
        if (lod) line(ctx, S, [Q(t0, y0 + rh * 0.45), Q(t1, y0 + rh * 0.45)], Math.max(0.4, 0.016 * k), S.red(0.2, 0.55), 0.15);
        line(ctx, S, [Q(t0, y0 + 0.02), Q(t1, y0 + 0.02)], Math.max(0.5, 0.028 * k), S.red(0.15, 0.95), 0.15);
        const per = lod ? (P.railPosts ?? 3) : 2;
        const nb = Math.max(1, Math.round(n * per * (t1 - t0)));
        for (let j = 1; j < nb; j++) {
          const t = mix(t0, t1, j / nb);
          if (Math.abs((t * n * per) - Math.round(t * n * per)) < 0.01 && Math.round(t * n * per) % per === 0) continue;
          const top = Q(t, y0 + rh); top[1] -= 0.03 * k;
          line(ctx, S, [top, Q(t, y0 + 0.02)], Math.max(0.45, 0.024 * k), S.red(0.08, 0.95), 0.05);
        }
      }
    }
  }
  for (const c of items) if (c.zr >= -0.02 * zmax) drawCol(c);
  // ---- lintel(s) + bracket frieze on facing edges
  for (let i = 0; i < 4; i++) {
    const z = V.facing(...EDGE_N[i]);
    if (z <= 0.0) continue;
    const [sx0, sz0] = CORNERS[i], [sx1, sz1] = CORNERS[(i + 1) % 4];
    const ext = P.lintelExt ?? 0.04;
    const l0 = V.P(sx0 * (A + ext), y1 - 0.05, sz0 * (B + ext)), l1 = V.P(sx1 * (A + ext), y1 - 0.05, sz1 * (B + ext));
    line(ctx, S, [l0, l1], Math.max(0.7, 0.042 * k), S.red(0.1), 0.15);
    if (P.lintel2) {
      const m0 = V.P(sx0 * (A + ext * 1.6), y1 - 0.2, sz0 * (B + ext * 1.6)), m1 = V.P(sx1 * (A + ext * 1.6), y1 - 0.2, sz1 * (B + ext * 1.6));
      line(ctx, S, [m0, m1], Math.max(0.7, 0.05 * k), S.red(0.05), 0.15);
      if (lod) {
        // panel between the two beams
        fillPoly(ctx, [V.P(sx0 * A, y1 - 0.17, sz0 * B), V.P(sx1 * A, y1 - 0.17, sz1 * B), V.P(sx1 * A, y1 - 0.07, sz1 * B), V.P(sx0 * A, y1 - 0.07, sz0 * B)], S.ink(0.35, 0.8));
        const nb = Math.max(2, Math.round(Math.hypot(l1[0] - l0[0], l1[1] - l0[1]) / 3));
        for (let j = 1; j < nb; j++) { const p = lerp2(V.P(sx0 * A, y1 - 0.12, sz0 * B), V.P(sx1 * A, y1 - 0.12, sz1 * B), j / nb); blob(ctx, p[0], p[1], Math.max(0.35, 0.02 * k), { color: S.ink(0.8, 0.7), rng: S.rng, sides: 6 }); }
      }
    }
    const fr = P.frieze ?? 0.12;
    const b0 = V.P(sx0 * (A + ext), y1, sz0 * (B + ext)), b1 = V.P(sx1 * (A + ext), y1, sz1 * (B + ext));
    const c0 = V.P(sx0 * (A + ext * 2), y1 + fr, sz0 * (B + ext * 2)), c1 = V.P(sx1 * (A + ext * 2), y1 + fr, sz1 * (B + ext * 2));
    fillPoly(ctx, [b0, b1, c1, c0], S.ink(P.friezeTone ?? 0.18, 0.95));
    if (!lod) continue;
    const n = i % 2 === 0 ? nx : nz;
    const per = 3, nb = n * per;
    const span = 2 * (i % 2 ? B : A) + 2 * ext;
    for (let j = 0; j <= nb; j++) {
      const t = mix(ext / span, 1 - ext / span, j / nb);
      const p = lerp2(b0, b1, t), q = lerp2(c0, c1, t);
      const atCol = j % per === 0;
      line(ctx, S, [lerp2(p, q, 0.1), lerp2(p, q, atCol ? 0.95 : 0.7)], Math.max(0.5, (atCol ? 0.04 : 0.028) * k), P.friezeTone > 0.3 ? S.ink(0.12, 0.8) : S.red(atCol ? 0.05 : 0.2, 0.9), 0.05);
      const cp = lerp2(p, q, 0.78);
      blob(ctx, cp[0], cp[1], Math.max(0.35, 0.018 * k), { color: S.ink(0.85, 0.75), rng: S.rng, sides: 6 });
      if (j < nb) {
        const tm = t + 0.5 / nb * (1 - 2 * ext / span);
        const pm = lerp2(lerp2(b0, b1, tm), lerp2(c0, c1, tm), 0.45);
        blob(ctx, pm[0], pm[1], Math.max(0.3, 0.014 * k), { color: S.ink(0.7, 0.5), rng: S.rng, sides: 6 });
      }
    }
  }
}

// upper storey of a two-tier roof: short dark frieze with red posts and pale bracket caps
function paintUpperBody(ctx, S, V, A, B, y0, y1) {
  const k = V.k;
  for (const f of prismFaces(V, A, B, y0, y1)) {
    if (f.z <= 0) continue;
    fillPoly(ctx, f.p, S.ink(0.2));
    if (k < 9) continue;
    const n = Math.max(2, Math.round(Math.abs(f.p[1][0] - f.p[0][0]) / Math.max(2.2, 0.1 * k)));
    for (let j = 0; j <= n; j++) {
      const t = j / n;
      const b = lerp2(f.p[0], f.p[1], t), tt = lerp2(f.p[3], f.p[2], t);
      if (j % 2) { const p = lerp2(b, tt, 0.55); blob(ctx, p[0], p[1], Math.max(0.45, 0.024 * k), { color: S.ink(0.85, 0.8), rng: S.rng, sides: 6 }); }
      else line(ctx, S, [lerp2(b, tt, 0.15), lerp2(b, tt, 0.85)], Math.max(0.5, 0.024 * k), S.red(0.1, 0.85), 0.05);
    }
  }
}

// ---------------------------------------------------------------- generic building
// o: x, y, w, turn, tilt, aspect, ov, baseH, baseOut, colH, bays, tiers, walls, railing, door, steps,
//    roofTone, upper (0..1 size of the upper roof), ridge (fraction of eave length), gable, lift, finials, terrace
function paintBuilding(ctx, S, o) {
  const turn = o.turn ?? -1.1, tilt = o.tilt ?? 0.035;
  const Be = 1, Ae = o.aspect ?? 1.25;
  const c = Math.abs(Math.cos(turn)), s = Math.abs(Math.sin(turn));
  const k = (o.w / 2) / (Ae * c + Be * s + 0.1);
  const V = makeView(o.x, o.y, k, turn, tilt);
  const ov = o.ov ?? 0.3;
  const Ac = Ae - ov, Bc = Be - ov;
  const hb = o.baseH ?? 0.32, hc = hb + (o.colH ?? 0.82);
  const bo = o.baseOut ?? 0.1;
  paintPlatform(ctx, S, V, Ac + bo, Bc + bo, hb, { ragged: o.ragged, tone: o.baseTone });
  if (o.stoneRail) paintStoneRail(ctx, S, V, Ac + bo - 0.03, Bc + bo - 0.03, hb, 0.16, { gap: o.steps ? [0.4, 0.6] : null });
  if (o.steps) paintSteps(ctx, S, V, 0, 0.5, (2 * (Ac + bo)) * 0.16, hb, hb * 1.4, Math.max(3, Math.round(hb * 14)), { A: Ac + bo, B: Bc + bo });
  paintStory(ctx, S, V, { A: Ac, B: Bc, y0: hb, y1: hc, bays: o.bays || [3, 2], railing: o.railing, walls: o.walls, door: o.door, frieze: o.frieze ?? 0.15, wallTone: o.wallTone, lintel2: o.lintel2, lintelExt: o.lintelExt, railGap: o.steps ? [0.42, 0.58] : null, redFrames: o.redFrames, plinth: o.plinth, windows: o.windows, colW: o.colW, friezeTone: o.friezeTone });
  const Ye = hc + (o.frieze ?? 0.15) + 0.04;
  const roofTone = o.roofTone ?? 0.58;
  const ridgeFrac = o.ridge ?? 0.45;
  let res;
  if ((o.tiers ?? 2) >= 2) {
    const up = o.upper ?? 0.68;
    const Au = Ac * up, Bu = Bc * (o.upperB ?? up);
    const Ylt = Ye + (o.roofH ?? 0.24);
    paintRoof(ctx, S, V, { A: Ae, B: Be, Ye, lift: o.lift ?? 0.15, out: 0.07, prof: 1.35, lam: o.lam, sag: o.sag, top: { kind: 'ring', A: Au, B: Bu, Y: Ylt }, tone: roofTone + 0.02, th: 0.04 });
    const yu0 = Ylt - 0.05, yu1 = Ylt + (o.upperH ?? 0.13);
    paintUpperBody(ctx, S, V, Au, Bu, yu0, yu1);
    const Ae2 = Au + 0.27, Be2 = Bu + 0.27;
    res = paintRoof(ctx, S, V, { A: Ae2, B: Be2, Ye: yu1 + 0.02, lift: (o.lift ?? 0.15) * 0.8, out: 0.06, prof: 1.6, lam: o.lam, sag: o.sag, top: { kind: 'ridge', half: Math.max(0.02, Ae2 - Be2 * (1 - ridgeFrac) - 0.0) * (o.ridgeMul ?? 1), Y: yu1 + (o.roof2H ?? 0.5) }, tone: roofTone, th: 0.04, gable: o.gable, finH: o.finH });
  } else {
    res = paintRoof(ctx, S, V, { A: Ae, B: Be, Ye, lift: o.lift ?? 0.16, out: 0.07, prof: 1.55, lam: o.lam, sag: o.sag, top: o.point ? { kind: 'point', Y: Ye + (o.roofH ?? 0.62) } : { kind: 'ridge', half: Math.max(0.02, Ae - Be * (1 - ridgeFrac)) * (o.ridgeMul ?? 1), Y: Ye + (o.roofH ?? 0.62) }, tone: roofTone, th: 0.042, gable: o.gable, finH: o.finH });
  }
  // eave extremes for anchors
  const ex = (sx, sz) => V.P(sx * (Ae + 0.07), Ye + 0.15, sz * (Be + 0.07));
  const pts = CORNERS.map(([sx, sz]) => ex(sx, sz));
  const left = pts.reduce((a, b) => (b[0] < a[0] ? b : a)), right = pts.reduce((a, b) => (b[0] > a[0] ? b : a));
  return { base: [o.x, o.y], top: [o.x, res.topY], left: [left[0], left[1]], right: [right[0], right[1]], floorY: V.P(0, hb, 0)[1], k, V };
}

// ---------------------------------------------------------------- public building painters
// variant: 'cliff' (default, ref 01/03/04/05: 3/4 view, tall red columns, railing)
//          'peak'  (ref 09/02: small pavilion seen corner-on, short columns, stone terrace wall)
const PAVILION_VARIANTS = {
  cliff: { turn: -1.1, aspect: 1.25, bays: [3, 2], baseH: 0.32, colH: 0.82, ridge: 0.32 },
  peak: { turn: -0.785, aspect: 1.12, bays: [2, 2], baseH: 0.24, colH: 0.66, ridge: 0.35, ragged: 0.25, stoneRail: true },
};
export function paintPavilion(ctx, opts = {}) {
  const S = makeStyle(opts);
  const v = PAVILION_VARIANTS[opts.variant || 'cliff'] || PAVILION_VARIANTS.cliff;
  return paintBuilding(ctx, S, {
    x: opts.x ?? 0, y: opts.y ?? 0, w: opts.w ?? 150, turn: opts.turn ?? v.turn, tilt: opts.tilt, aspect: opts.aspect ?? v.aspect,
    tiers: opts.tiers ?? 2, bays: opts.bays || v.bays, railing: opts.railing ?? true, walls: opts.walls ?? 'open', baseH: opts.baseH ?? v.baseH,
    colH: opts.colH ?? v.colH, roofTone: opts.roofTone, ragged: opts.ragged ?? v.ragged, gable: opts.gable, steps: opts.steps, stoneRail: opts.stoneRail ?? v.stoneRail,
    lift: opts.lift, finH: opts.finH, upper: opts.upper, wallTone: opts.wallTone, ridge: opts.ridge ?? v.ridge,
    roofH: opts.roofH, roof2H: opts.roof2H, upperH: opts.upperH, door: opts.door, windows: opts.windows, redFrames: opts.redFrames,
  });
}

export function paintHall(ctx, opts = {}) {
  const S = makeStyle(opts);
  const tiers = opts.tiers ?? 1;
  return paintBuilding(ctx, S, {
    x: opts.x ?? 0, y: opts.y ?? 0, w: opts.w ?? 200, turn: opts.turn ?? 0.6, tilt: opts.tilt, aspect: opts.aspect ?? 2.2,
    tiers, bays: opts.bays || [5, 2], railing: opts.railing ?? false, walls: opts.walls ?? 'hall', door: opts.door ?? true,
    steps: opts.steps ?? true, gable: opts.gable ?? true, baseH: opts.baseH ?? 0.16, colH: opts.colH ?? 0.62, roofTone: opts.roofTone,
    ragged: opts.ragged ?? 0.15, stoneRail: opts.stoneRail, upper: opts.upper ?? 0.84, upperB: opts.upperB ?? 0.6,
    ridge: opts.ridge ?? 0.6, redFrames: opts.redFrames ?? true, lift: opts.lift ?? 0.24, roofH: opts.roofH ?? (tiers >= 2 ? 0.48 : 0.72),
    roof2H: opts.roof2H ?? 0.72, upperH: opts.upperH ?? 0.1, finH: opts.finH, plinth: true, frieze: opts.frieze ?? 0.13, ov: opts.ov ?? 0.32,
    windows: opts.windows ?? 'near', wallTone: opts.wallTone ?? 0.8, lam: opts.lam ?? 0.42, sag: opts.sag ?? 0.06,
  });
}

export function paintGate(ctx, opts = {}) {
  const S = makeStyle(opts);
  const asp = opts.aspect ?? 1.5, ov = 0.38;
  const r = paintBuilding(ctx, S, {
    x: opts.x ?? 0, y: opts.y ?? 0, w: opts.w ?? 135, turn: opts.turn ?? -0.42, tilt: opts.tilt ?? 0.03, aspect: asp,
    tiers: 1, bays: opts.bays || [2, 1], railing: false, walls: 'see', baseH: opts.baseH ?? 0.14, colH: opts.colH ?? 1.12,
    ov, frieze: 0.3, friezeTone: 0.42, lintel2: true, lintelExt: 0.2, roofTone: opts.roofTone ?? 0.5, ragged: opts.ragged ?? 0.25, ridge: opts.ridge ?? 0.3,
    roofH: opts.roofH ?? 0.78, lift: opts.lift ?? 0.24, lam: 0.3, sag: 0.03, finH: opts.finH ?? 1.25, colW: 0.13,
  });
  // low dark stone balustrade in front of / around the posts
  if (opts.balustrade !== false) {
    const V = r.V;
    paintStoneRail(ctx, S, V, asp - ov + 0.3, 1 - ov + 0.3, 0.14, 0.24, { spacing: 0.55, tone: 0.25, gap: [0.38, 0.62] });
  }
  return r;
}

export function paintTemple(ctx, opts = {}) {
  const x = opts.x ?? 0, y = opts.y ?? 0, w = opts.w ?? 200;
  const m = opts.mirror ? -1 : 1;
  const seed = opts.seed ?? 1;
  const common = { snow: opts.snow, fade: opts.fade, paper: opts.paper };
  const out = { halls: [] };
  // side halls behind (drawn first)
  if (opts.side !== false) {
    const sides = opts.sides || [{ dx: -0.5, dy: -0.06, w: 0.5, turn: 0.55 }];
    for (const [i, sd] of sides.entries()) {
      out.halls.push(paintHall(ctx, { ...common, seed: seed + 11 + i, x: x + sd.dx * w * m, y: y + sd.dy * w, w: sd.w * w, turn: (sd.turn ?? 0.5) * m, tiers: sd.tiers ?? 1, aspect: sd.aspect ?? 2.4, bays: sd.bays || [4, 1], steps: false, gable: sd.gable ?? false, fade: clamp((opts.fade ?? 0) + (sd.fade ?? 0.08)), baseH: 0.3, door: sd.door ?? false, roofH: 0.5 }));
    }
  }
  const S = makeStyle({ ...common, seed: seed + 5 });
  const style = opts.style ?? (opts.snow ? 'hall' : 'pavilion');
  const turn = (opts.turn ?? (style === 'hall' ? 0.75 : -0.95)) * m;
  const asp = opts.aspect ?? (style === 'hall' ? 2.0 : 1.6);
  const terrace = opts.terrace ?? (style === 'pavilion');
  let yb = y;
  if (terrace) {
    const c = Math.abs(Math.cos(turn)), s = Math.abs(Math.sin(turn));
    const k = (w / 2) / (asp * c + s + 0.1);
    const V = makeView(x, y, k, turn, 0.035);
    const tA = asp + 0.02, tB = 1.2, th = opts.terraceH ?? 0.26;
    paintPlatform(ctx, S, V, tA, tB, th, { ragged: 0.4, tone: 0.82 });
    const stairs = opts.stairs ?? 'front';
    paintStoneRail(ctx, S, V, tA - 0.04, tB - 0.04, th, 0.2, { gap: stairs === 'front' ? [0.42, 0.58] : null, spacing: 0.3 });
    if (stairs === 'front') paintSteps(ctx, S, V, 0, 0.5, 0.42, th, 0.5, 6, { A: tA, B: tB });
    else if (stairs !== 'none') {
      const fi = stairs === 'left' ? 3 : 1;
      if (V.facing(...EDGE_N[fi]) > 0) paintSteps(ctx, S, V, fi, 0.72, 0.42, th, 0.9, 8, { A: tA, B: tB });
      else paintSteps(ctx, S, V, 0, stairs === 'left' ? 0.1 : 0.9, 0.42, th, 0.6, 7, { A: tA, B: tB });
    }
    yb = y - th * k * 0.98;
  }
  if (style === 'hall') {
    out.main = paintHall(ctx, { ...common, seed, x, y: yb, w: terrace ? w * 0.9 : w, turn, tiers: opts.tiers ?? 2, aspect: asp, bays: opts.bays || [5, 2], steps: !terrace, railing: opts.railing ?? false, gable: opts.gable ?? true, baseH: terrace ? 0.08 : 0.16, door: true, ragged: terrace ? 0 : 0.2 });
  } else {
    out.main = paintPavilion(ctx, { ...common, seed, x, y: yb, w: terrace ? w * 0.96 : w, turn, aspect: asp, bays: opts.bays || [4, 2], baseH: terrace ? 0.08 : 0.3, ragged: terrace ? 0 : 0.3, colH: opts.colH ?? 0.82, roofH: opts.roofH ?? 0.36, roof2H: opts.roof2H ?? 0.62, walls: 'hall', wallTone: 0.88, windows: 'near', door: true, redFrames: false, gable: opts.gable, roofTone: opts.roofTone });
  }
  out.top = out.main.top; out.base = [x, y];
  return out;
}

// ---------------------------------------------------------------- ruined watchtower
// (x, y) bottom centre, w = width incl. side face, h = height of the main tower.
export function paintTower(ctx, opts = {}) {
  const S = makeStyle(opts);
  const x = opts.x ?? 0, y = opts.y ?? 0, w = opts.w ?? 60, h = opts.h ?? 110;
  const side = opts.side ?? 1;               // +1: side face on the right
  const ruin = opts.ruin ?? 0.6;
  const baseTone = opts.tone ?? 0.6;
  const r = S.rng;
  const u = w / 60;                          // unit scale (1 at w = 60)
  const step = Math.max(0.7, 1.1 * u);
  // displace a closed polygon along its normals: two noise octaves + occasional bites
  const crumble = (poly, amp, biteP = 0.04) => {
    const P = resample([...poly, poly[0]], step);
    P.pop();
    let area = 0;
    for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; area += a[0] * b[1] - b[0] * a[1]; }
    const sgn = area > 0 ? 1 : -1;
    const ph = r() * 100;
    let L = 0, bite = 0, biteD = 0;
    return P.map((p, i) => {
      const a = P[(i - 1 + P.length) % P.length], b = P[(i + 1) % P.length];
      L += Math.hypot(p[0] - a[0], p[1] - a[1]);
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      const nx = (dy / l) * sgn, ny = (-dx / l) * sgn;        // outward normal
      if (bite <= 0 && r() < biteP) { bite = 2 + Math.floor(r() * 4); biteD = (0.8 + r() * 2.2) * u; }
      let d = (S.nz.n2(L * 0.3 / u + ph, 0.5) * 0.6 + S.nz.n2(L * 1.3 / u + ph, 3.1) * 0.4) * amp;
      if (bite > 0) { d -= biteD; bite--; }
      return [p[0] + nx * d, p[1] + ny * d];
    });
  };
  // crenellated top line from xa to xb at height yBase (y down)
  const crenTop = (xa, xb, yBase, mH, mW, slope = 0) => {
    const pts = [];
    let xx = xa, up = r() < 0.6;
    const yAt = (xv) => yBase + slope * (xv - xa);
    while (xx < xb - 0.3) {
      const segW = Math.min(xb - xx, mW * (0.6 + r() * 0.7) * (up ? 1 : 0.7));
      const nx = xx + segW;
      const broken = r() < ruin * 0.35;
      const hh = up ? (broken ? mH * (0.2 + r() * 0.4) : mH * (0.8 + r() * 0.4)) : (r() < ruin * 0.25 ? -mH * r() * 0.5 : 0);
      pts.push([xx, yAt(xx) - hh]); pts.push([nx, yAt(nx) - hh]);
      xx = nx; up = !up;
    }
    return pts;
  };
  const dabs = (poly, bx0, bx1, by0, by1, density, dark) => withLayer(ctx, polyBox(poly), poly, (ctx) => {
    ctx.save();
    // mottled washes (soft)
    const area = (bx1 - bx0) * (by1 - by0);
    for (let i = 0; i < area / (60 * u * u); i++) softDot(ctx, mix(bx0, bx1, r()), mix(by0, by1, r()), (3 + r() * 7) * u, S.inkc(r() < 0.55 ? 0.25 : 0.85), 0.12 + r() * 0.22, 0.5 + r() * 0.6, r() * 3);
    // light from the left / top, dark toward the foot
    const g = ctx.createLinearGradient(bx0, by0, bx1 + (by1 - by0) * 0.3, by1);
    g.addColorStop(0, S.ink(0.95, dark ? 0.03 : 0.25)); g.addColorStop(0.45, S.ink(0.5, 0)); g.addColorStop(1, S.ink(0.1, 0.3));
    ctx.fillStyle = g; ctx.fillRect(bx0 - 3, by0 - 6 * u, bx1 - bx0 + 6, by1 - by0 + 9 * u);
    // dense weathered masonry: short dark dashes and dots
    const n = Math.round(area / (density * u * u));
    for (let i = 0; i < n; i++) {
      const xx = mix(bx0, bx1, r()), yy = mix(by0, by1, r());
      if (r() < 0.62) {
        const l = (0.8 + r() * 2.6) * u;
        line(ctx, S, [[xx, yy], [xx + l, yy + (r() - 0.5) * 0.7 * u]], Math.max(0.3, (0.35 + r() * 0.55) * u), S.ink(0.08 + r() * 0.2, 0.25 + r() * 0.5), 0.1);
      } else blob(ctx, xx, yy, (0.3 + Math.pow(r(), 2.5) * 1.1) * u, { color: S.ink(0.06 + r() * 0.15, 0.3 + r() * 0.5), rng: r, irregular: 0.5 });
    }
    // chipped pale spots
    for (let i = 0; i < area / (120 * u * u); i++) blob(ctx, mix(bx0, bx1, r()), mix(by0, by1, r()), (0.6 + r() * 1.5) * u, { color: S.ink(0.9, 0.35 + r() * 0.3), rng: r, irregular: 0.5 });
    // cracks
    for (let i = 0; i < 2; i++) {
      let cx2 = mix(bx0, bx1, 0.2 + r() * 0.6), cy = by0 + r() * (by1 - by0) * 0.35;
      const pts = [[cx2, cy]];
      for (let j = 0; j < 7; j++) { cx2 += (r() - 0.5) * 2.6 * u; cy += (2 + r() * 4) * u; pts.push([cx2, cy]); }
      line(ctx, S, pts, Math.max(0.3, 0.5 * u), S.ink(0.08, 0.5), 0.2);
    }
    ctx.restore();
  });
  // ---------- one tower block with two faces and a crenellated, broken crown
  const block = (bx, by, bw, bh, o = {}) => {
    const fw = bw * (o.front ?? 0.72), sw = bw - fw;
    const taper = bw * 0.035;
    const xl = bx - bw / 2, xr = bx + bw / 2;
    const xm = side > 0 ? xl + fw : xr - fw;          // the visible corner
    const top = by - bh;
    const mH = Math.max(1.5, bh * 0.06), mW = bw * 0.13;
    const foot = by + bh * 0.02;
    let fTop = side > 0 ? crenTop(xl + taper, xm, top, mH, mW) : crenTop(xm, xr - taper, top, mH, mW);
    let sTop = side > 0 ? crenTop(xm, xr - taper * 1.4, top + bh * 0.012, mH * 0.9, mW * 0.8, 0.04) : crenTop(xl + taper * 1.4, xm, top + bh * 0.012, mH * 0.9, mW * 0.8, -0.04);
    let frontPoly = side > 0 ? [[xl, foot], [xl + taper, top + mH * 0.4], ...fTop, [xm, top + mH * 0.4], [xm, foot]] : [[xm, foot], [xm, top + mH * 0.4], ...fTop, [xr - taper, top + mH * 0.4], [xr, foot]];
    let sidePoly = side > 0 ? [[xm, foot], [xm, top + mH * 0.4], ...sTop, [xr - taper * 1.4, top + mH * 0.5], [xr, foot]] : [[xl, foot], [xl + taper * 1.4, top + mH * 0.5], ...sTop, [xm, top + mH * 0.4], [xm, foot]];
    // ruin: a broken slope bitten into one corner of the crown
    let cornerTop = top + mH * 0.4;
    if (r() < ruin * (o.ruinMul ?? 1)) {
      const cw = bw * (0.15 + r() * 0.3), ch = bh * (0.05 + r() * 0.16 * ruin);
      const fromR = r() < 0.5;
      const cut = (pts) => pts.map((p) => { if (p[1] >= foot - 0.01) return p; const d = fromR ? (xr - p[0]) : (p[0] - xl); return d < cw ? [p[0], Math.max(p[1], top + ch * (1 - d / cw) + (r() - 0.5) * 1.2 * u)] : p; });
      frontPoly = cut(frontPoly); sidePoly = cut(sidePoly);
      const d = fromR ? xr - xm : xm - xl;
      if (d < cw) cornerTop = Math.max(cornerTop, top + ch * (1 - d / cw));
    }
    const amp = (o.amp ?? 0.7) * u;
    const fP = crumble(frontPoly, amp, 0.035), sP = crumble(sidePoly, amp, 0.035);
    fillPoly(ctx, sP, S.ink(baseTone - 0.17));
    fillPoly(ctx, fP, S.ink(baseTone));
    const fx0 = side > 0 ? xl : xm, fx1 = side > 0 ? xm : xr, sx0 = side > 0 ? xm : xl, sx1 = side > 0 ? xr : xm;
    dabs(fP, fx0, fx1, top - mH, foot, o.density ?? 5, 0);
    dabs(sP, sx0, sx1, top - mH, foot, (o.density ?? 5) * 0.8, 1);
    // corner shadow line and ragged outer contours
    line(ctx, S, [[xm, cornerTop + mH * 0.3], [xm + (r() - 0.5) * u, (cornerTop + foot) / 2], [xm, foot]], Math.max(0.35, 0.7 * u), S.ink(0.15, 0.45), 0.4);
    raggedEdge(ctx, S, fP, Math.max(0.45, 0.85 * u), 0.1, 0.7);
    raggedEdge(ctx, S, sP.filter((p) => p[1] < foot - 1), Math.max(0.35, 0.7 * u), 0.1, 0.55);
    return { xl, xm, xr, top, by, fx0, fx1, sx0, sx1, mH };
  };
  // ---------- arched opening showing the sky through
  const archWin = (cx, cy, ww, wh, depth = 0.35) => {
    const pts = (x0, y0, wdt, hgt) => {
      const out = [[x0 - wdt / 2, y0 + hgt / 2]];
      for (let i = 0; i <= 10; i++) { const a = Math.PI + Math.PI * i / 10; out.push([x0 + Math.cos(a) * wdt / 2, y0 - hgt / 2 + wdt / 2 + Math.sin(a) * wdt / 2]); }
      out.push([x0 + wdt / 2, y0 + hgt / 2]);
      return out;
    };
    fillPoly(ctx, crumble(pts(cx, cy, ww * 1.3, wh * 1.12), 0.35 * u, 0.02), S.ink(0.1, 0.92));
    fillPoly(ctx, crumble(pts(cx + side * ww * depth * 0.45, cy + wh * 0.05, ww * 0.62, wh * 0.84), 0.25 * u, 0), S.ink(opts.sky ?? 0.92));
  };
  // ---------- compose
  const annex = opts.annex !== false;
  let annexInfo = null;
  if (annex) block(x - side * w * 0.62, y, w * 0.36, h * 0.34, { front: 0.78 });
  const main = block(x, y, w, h, { front: opts.front ?? 0.78 });
  const nWin = opts.windows ?? 2;
  for (let i = 0; i < nWin; i++) {
    const cx = mix(main.fx0, main.fx1, (i + 0.72) / (nWin + 0.45));
    archWin(cx + (r() - 0.5) * 1.5 * u, main.top + h * (0.26 + (i % 2) * 0.02), w * 0.12, h * 0.14);
  }
  // putlog holes
  for (let i = 0; i < 5; i++) blob(ctx, mix(main.fx0, main.fx1, 0.12 + r() * 0.76), main.top + h * (0.42 + r() * 0.3), (0.7 + r() * 0.9) * u, { color: S.ink(0.06, 0.85), rng: r, squash: 1.2 });
  if (annex) {
    // broken curtain wall running to a smaller tower, pierced by a ruined arch
    const wx0 = side > 0 ? main.xr - 1 : main.xl + 1, wlen = w * 0.48;
    const wx1 = wx0 + side * wlen;
    const wTop = main.top + h * 0.42;
    const tp = crenTop(Math.min(wx0, wx1), Math.max(wx0, wx1), wTop, h * 0.03, w * 0.09);
    // a breach: a shallow ragged notch in the wall top
    const bx = mix(wx0, wx1, 0.42), bw2 = w * 0.12, bd = h * 0.06;
    const tpB = tp.map((p) => { const d = Math.abs(p[0] - bx) / bw2; return d < 1 ? [p[0], Math.max(p[1], wTop + bd * (1 - d * d * d * d) + (r() - 0.5) * 2 * u)] : p; });
    const wallPoly = crumble([[Math.min(wx0, wx1), y + h * 0.05], ...tpB, [Math.max(wx0, wx1), y + h * 0.05]], 0.6 * u, 0.05);
    fillPoly(ctx, wallPoly, S.ink(baseTone - 0.08));
    dabs(wallPoly, Math.min(wx0, wx1), Math.max(wx0, wx1), wTop - h * 0.04, y + h * 0.05, 5, 0);
    raggedEdge(ctx, S, wallPoly, Math.max(0.4, 0.8 * u), 0.1, 0.65);
    // inner face of the wall seen through the breach (darker), lit sky beyond
    archWin(mix(wx0, wx1, 0.72), wTop + h * 0.14, w * 0.1, h * 0.1, 0.2);
    annexInfo = block(wx1 + side * w * 0.17, y - h * 0.05, w * 0.36, h * 0.6, { front: 0.62, ruinMul: 0.3 });
    archWin(mix(annexInfo.fx0, annexInfo.fx1, 0.5), annexInfo.top + h * 0.2, w * 0.07, h * 0.09);
  }
  // ---------- overgrowth: dark wet foliage masses swallowing the foot, creepers, moss
  const og = opts.overgrow ?? 0.6;
  if (og > 0) {
    const x0 = x - w * (annex ? 0.85 : 0.6), x1 = x + w * (annex ? 1.15 : 0.6);
    const clusters = Math.round((annex ? 16 : 8) * og + 2);
    for (let c = 0; c < clusters; c++) {
      const cx = mix(x0, x1, (c + r() * 0.8) / clusters);
      const cy = y - h * (0.02 + Math.pow(r(), 1.2) * 0.62 * og);
      const R = (5 + r() * 10) * u;
      softDot(ctx, cx, cy + R * 0.3, R * 1.3, S.inkc(0.15), 0.5, 0.7);
      for (let i = 0; i < 16; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R;
        blob(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7 + R * 0.3, (1.5 + r() * 3.5) * u, { color: S.ink(r() < 0.75 ? 0.04 + r() * 0.14 : 0.4, 0.6 + r() * 0.4), rng: r, irregular: 0.55, squash: 0.65 + r() * 0.4 });
      }
      // a few pale leaf-gaps
      for (let i = 0; i < 4; i++) blob(ctx, cx + (r() - 0.5) * R * 1.4, cy + (r() - 0.3) * R * 0.6, (0.6 + r() * 1.2) * u, { color: S.ink(0.85, 0.5), rng: r });
    }
    // mass at the very foot so the base dissolves into the rock
    for (let i = 0; i < 90 * og * u; i++) blob(ctx, mix(x0 - w * 0.05, x1 + w * 0.05, r()), y + h * 0.05 - Math.pow(r(), 1.5) * h * 0.16, (2 + r() * 4.5) * u, { color: S.ink(0.04 + r() * 0.2, 0.75 + r() * 0.25), rng: r, irregular: 0.5 });
    for (let i = 0; i < 12 * og * u; i++) blob(ctx, mix(x0, x1, r()), y - Math.pow(r(), 1.5) * h * 0.14, (0.6 + r() * 1.2) * u, { color: S.ink(0.8, 0.5), rng: r });
    // creepers
    for (let i = 0; i < Math.round(6 * og); i++) {
      let cx = mix(x - w * 0.45, x + w * 0.45, r()), cy = y - h * 0.18;
      const pts = [[cx, cy]];
      for (let j = 0; j < 9; j++) { cx += (r() - 0.5) * 2.4 * u; cy -= (2.5 + r() * 3.5) * u; pts.push([cx, cy]); if (r() < 0.65) blob(ctx, cx + (r() - 0.5) * 2 * u, cy, (0.6 + r() * 1.1) * u, { color: S.ink(0.06, 0.8), rng: r }); }
      line(ctx, S, pts, Math.max(0.3, 0.4 * u), S.ink(0.08, 0.6), 0.3);
    }
  }
  return { base: [x, y], top: [x, main.top - main.mH], left: [x - w / 2, main.top], right: [x + w / 2, main.top] };
}

// ---------------------------------------------------------------- stone arch bridge
// x0..x1 bridge ends (px), y = water / footing line, deck = deck top y at the ends (or [yl, yr]),
// hump = extra rise at the crown (px), arches = [{ c, span, crown }] (centre x, span px, crown y).
// fadeBelow: [y0, y1] - the masonry dissolves (into rock / mist) between y0 and y1 (for bridges
// spanning between peaks, ref 09).
export function paintArchBridge(ctx, opts = {}) {
  if (!opts.fadeBelow) return paintArchBridgeRaw(ctx, opts);
  const [f0, f1] = opts.fadeBelow;
  const bb = archBounds('archBridge', opts);
  let res;
  withLayer(ctx, bb, [[bb[0], bb[1]], [bb[0] + bb[2], bb[1]], [bb[0] + bb[2], bb[1] + bb[3]], [bb[0], bb[1] + bb[3]]], (g) => {
    res = paintArchBridgeRaw(g, opts);
    g.globalCompositeOperation = 'destination-out';
    const gr = g.createLinearGradient(0, f0, 0, f1);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = gr; g.fillRect(bb[0], f0, bb[2], bb[1] + bb[3] - f0);
    g.globalCompositeOperation = 'source-over';
  });
  return res;
}
function paintArchBridgeRaw(ctx, opts = {}) {
  const S = makeStyle(opts);
  const r = S.rng;
  const x0 = opts.x0 ?? 270, x1 = opts.x1 ?? 830, y = opts.y ?? 680;
  const deckL = Array.isArray(opts.deck) ? opts.deck[0] : (opts.deck ?? 590), deckR = Array.isArray(opts.deck) ? opts.deck[1] : (opts.deck ?? 590);
  const hump = opts.hump ?? 70;
  const peakX = opts.peak ?? (x0 + x1) / 2;
  const arches = opts.arches || [
    { c: mix(x0, x1, 0.235), span: (x1 - x0) * 0.185, crown: y - (x1 - x0) * 0.17 },
    { c: peakX, span: (x1 - x0) * 0.44, crown: y - (x1 - x0) * 0.255 },
    { c: mix(x0, x1, 0.885), span: (x1 - x0) * 0.155, crown: y - (x1 - x0) * 0.15 },
  ];
  const L = x1 - x0;
  const u = L / 560;                                  // unit scale (1 at the ref-05 size)
  const barrel = opts.barrel ?? 1;                    // inner barrel seen on the right (+1) or left (-1)
  const deckY = (x) => {
    const t = (x - x0) / L, tp = (peakX - x0) / L;
    const base = mix(deckL, deckR, t);
    const q = t < tp ? t / tp : (1 - t) / (1 - tp);
    return base - hump * Math.sin(Math.PI / 2 * clamp(q)) ** 1.6;
  };
  const corn = 7 * u;                                 // cornice / deck slab thickness
  const archPts = (a, grow = 0, n = 28) => {
    const rise = a.rise ?? 1;                         // 1 = semicircle on vertical legs, < 1 = segmental arch
    if (rise < 0.999) {
      const hs = a.span / 2, hr = hs * rise;
      const R0 = (hs * hs + hr * hr) / (2 * hr), cy = a.crown + R0, th0 = Math.asin(Math.min(1, hs / R0));
      const R = R0 + grow;
      const sy = cy - R0 * Math.cos(th0);
      const out = [[a.c - hs - grow, y + 2], [a.c - hs - grow, sy]];
      for (let i = 0; i <= n; i++) { const th = -th0 + 2 * th0 * i / n; out.push([a.c + Math.sin(th) * R, cy - Math.cos(th) * R]); }
      out.push([a.c + hs + grow, sy]); out.push([a.c + hs + grow, y + 2]);
      return out;
    }
    const R = a.span / 2 + grow;
    const sy = a.crown + a.span / 2;                  // springing line
    const out = [[a.c - R, y + 2]];
    for (let i = 0; i <= n; i++) { const ang = Math.PI + Math.PI * i / n; out.push([a.c + Math.cos(ang) * R, Math.min(y + 2, sy + Math.sin(ang) * (a.span / 2 + grow * 0.9))]); }
    out.push([a.c + R, y + 2]);
    return out;
  };
  // ---- body: deck curve down to the footing, arch openings as holes
  const top = [];
  for (let xx = x0; xx <= x1 + 0.1; xx += 4) top.push([xx, deckY(xx)]);
  const endL = opts.endL ?? [x0 - 6 * u, y], endR = opts.endR ?? [x1 + 6 * u, y];
  const body = new Path2D();
  body.moveTo(endL[0], endL[1]);
  for (const p of top) body.lineTo(p[0], p[1] + corn);
  body.lineTo(endR[0], endR[1]);
  body.closePath();
  const holes = new Path2D();
  for (const a of arches) { const p = archPts(a); holes.moveTo(p[0][0], p[0][1]); for (const q of p) holes.lineTo(q[0], q[1]); holes.closePath(); }
  const bodyMinus = new Path2D(); bodyMinus.addPath(body); bodyMinus.addPath(holes);
  const minTop = Math.min(...top.map((p) => p[1]));
  ctx.save();
  ctx.fillStyle = S.ink(opts.tone ?? 0.84);
  ctx.fill(bodyMinus, 'evenodd');
  ctx.clip(bodyMinus, 'evenodd');
  // broad grey washes, darker toward the waterline
  for (let i = 0; i < 50; i++) {
    const xx = mix(x0, x1, r()), yy = mix(deckY(xx), y, Math.pow(r(), 0.8));
    softDot(ctx, xx, yy, (8 + r() * 16) * u, S.inkc(0.4), 0.1 + r() * 0.18, 0.4 + r() * 0.5, (r() - 0.5) * 0.5);
  }
  const gw = ctx.createLinearGradient(0, minTop, 0, y);
  gw.addColorStop(0, S.ink(0.5, 0)); gw.addColorStop(0.7, S.ink(0.4, 0.06)); gw.addColorStop(1, S.ink(0.25, 0.3));
  ctx.fillStyle = gw; ctx.fillRect(x0 - 20, minTop, L + 40, y - minTop + 4);
  // irregular stone outlines (polygons), partly drawn
  for (let i = 0; i < 70 * u; i++) {
    const xx = mix(x0, x1, r()), yy = mix(minTop, y, r());
    if (yy < deckY(xx) + corn * 1.5) continue;
    const sw = (5 + r() * 9) * u, sh = (4 + r() * 6) * u;
    const poly = [[xx - sw / 2, yy - sh / 2], [xx + sw / 2 + (r() - 0.5) * 2 * u, yy - sh / 2], [xx + sw / 2, yy + sh / 2], [xx - sw / 2 + (r() - 0.5) * 2 * u, yy + sh / 2]];
    const a0 = Math.floor(r() * 4), cnt = 2 + Math.floor(r() * 3);
    const pts = []; for (let j = 0; j <= cnt; j++) pts.push(poly[(a0 + j) % 4]);
    line(ctx, S, pts, Math.max(0.35, (0.5 + r() * 0.6) * u), S.ink(0.12, 0.25 + r() * 0.35), 0.4);
  }
  // irregular stones: only some block edges drawn, broken and dry
  const course = 10 * u;
  for (let yy = minTop + corn; yy < y; yy += course * (0.75 + r() * 0.5)) {
    let xx = x0 + r() * course;
    while (xx < x1) {
      const bw = course * (1.2 + r() * 1.8);
      if (yy > deckY(xx) + corn * 1.3) {
        if (r() < 0.45) line(ctx, S, [[xx, yy], [xx + bw * (0.5 + r() * 0.45), yy + (r() - 0.5) * 1.4 * u]], Math.max(0.35, (0.5 + r() * 0.7) * u), S.ink(0.15, 0.2 + r() * 0.35), 0.5);
        if (r() < 0.35) line(ctx, S, [[xx + bw, yy - 0.5], [xx + bw + (r() - 0.5) * 1.5 * u, yy + course * (0.4 + r() * 0.5)]], Math.max(0.35, 0.7 * u), S.ink(0.15, 0.2 + r() * 0.3), 0.3);
      }
      xx += bw;
    }
  }
  // ink splotches: dark dabs, clustered, elongated (weathering, moss)
  const nSpl = Math.round((opts.spots ?? 1000) * u * u);
  let cx0 = mix(x0, x1, r()), cy0 = mix(minTop, y, r());
  for (let i = 0; i < nSpl; i++) {
    if (r() < 0.15) { cx0 = mix(x0, x1, r()); cy0 = mix(minTop + corn * 2, y, Math.pow(r(), 0.9)); }
    const xx = cx0 + (r() - 0.5) * 34 * u, yy = cy0 + (r() - 0.5) * 20 * u;
    if (yy < deckY(xx) + corn) continue;
    const big = r() < 0.12;
    blob(ctx, xx, yy, (big ? 2.5 + r() * 3 : 0.6 + Math.pow(r(), 2) * 2.6) * u, { color: S.ink(big ? 0.25 + r() * 0.2 : 0.04 + r() * 0.18, big ? 0.15 + r() * 0.2 : 0.35 + r() * 0.55), rng: r, irregular: 0.6, squash: 0.4 + r() * 0.5, rot: (r() - 0.5) * 0.8 });
  }
  // soft wet patches, then dry-brush horizontal streaks
  for (let i = 0; i < 70 * u; i++) {
    const xx = mix(x0, x1, r()), yy = mix(minTop, y, Math.pow(r(), 0.8));
    if (yy < deckY(xx) + corn * 1.5) continue;
    softDot(ctx, xx, yy, (3 + r() * 5) * u, S.inkc(0.15 + r() * 0.25), 0.3 + r() * 0.35, 0.35 + r() * 0.45, (r() - 0.5) * 0.6);
  }
  for (let i = 0; i < 40 * u; i++) {
    const xx = mix(x0, x1, r()), yy = mix(minTop, y, r());
    if (yy < deckY(xx) + corn * 1.5) continue;
    const l = (6 + r() * 16) * u;
    dryStroke(ctx, [[xx, yy], [xx + l * 0.5, yy + (r() - 0.5) * 1.5 * u], [xx + l, yy + (r() - 0.5) * 2 * u]], { width: (2 + r() * 3) * u, bristles: 5, color: S.inkc(0.12), alpha: 0.35 + r() * 0.3, dry: 0.55, rng: r, noise: S.nz });
  }
  // shadow under the cornice (dark, broken)
  for (let xx = x0; xx < x1; xx += 2.5 * u) {
    if (r() < 0.12) continue;
    const yy = deckY(xx) + corn + 1.2 * u;
    line(ctx, S, [[xx, yy], [xx + 3 * u, deckY(xx + 3 * u) + corn + 1.2 * u]], (1.6 + r() * 2.2) * u, S.ink(0.08, 0.35 + r() * 0.35), 0);
  }
  ctx.restore();
  // ---- inner barrels (dark), the far opening stays transparent (sky / mist shows through)
  for (const a of arches) {
    const near = archPts(a);
    const shift = -barrel * a.span * (opts.barrelDepth ?? 0.3);
    // far mouth of the barrel: a smaller, lower arch whose sides curve all the way down
    let far = [];
    if ((a.rise ?? 1) < 0.999) far = archPts({ ...a, c: a.c + shift, crown: a.crown + a.span * 0.05 });
    else {
      const fc = a.c + shift, fr = a.span * 0.55, fcrown = a.crown + a.span * 0.07;
      const fh = y + 2 - fcrown;
      far.push([fc - fr, y + 2]);
      for (let i = 0; i <= 28; i++) { const ang = Math.PI + Math.PI * i / 28; far.push([fc + Math.cos(ang) * fr, y + 2 + Math.sin(ang) * fh]); }
      far.push([fc + fr, y + 2]);
    }
    ctx.save();
    path(ctx, near, true); ctx.clip();
    const p2 = new Path2D(); p2.moveTo(near[0][0], near[0][1]); for (const q of near) p2.lineTo(q[0], q[1]); p2.closePath();
    p2.moveTo(far[0][0], far[0][1]); for (const q of far) p2.lineTo(q[0], q[1]); p2.closePath();
    const g = ctx.createLinearGradient(a.c - barrel * a.span * 0.2, 0, a.c + barrel * a.span / 2, 0);
    g.addColorStop(0, S.ink(0.38, 0.92)); g.addColorStop(0.5, S.ink(0.22, 0.96)); g.addColorStop(1, S.ink(0.14, 0.98));
    ctx.fillStyle = g;
    ctx.fill(p2, 'evenodd');
    ctx.clip(p2, 'evenodd');
    // barrel: soft vertical streaks and blotches (wet ink)
    for (let i = 0; i < 18; i++) {
      const xx = mix(a.c - a.span / 2, a.c + a.span / 2, r()), yy = mix(a.crown, y, r());
      softDot(ctx, xx, yy, (3 + r() * 6) * u, S.inkc(r() < 0.5 ? 0.05 : 0.5), 0.18 + r() * 0.25, 1.2 + r());
    }
    for (let i = 0; i < 12; i++) { const yy = mix(a.crown, y, r()); line(ctx, S, [[a.c - a.span / 2, yy], [a.c + a.span / 2, yy + (r() - 0.5) * 2]], 0.6 * u, S.ink(0.05, 0.2), 0.4); }
    ctx.restore();
    // far edge of the barrel: a soft dark contour (inside the near mouth only)
    ctx.save(); path(ctx, near, true); ctx.clip();
    line(ctx, S, far.slice(1, -1), Math.max(0.5, 1.0 * u), S.ink(0.1, 0.5), 0.4);
    ctx.restore();
  }
  // ---- voussoir rings: pale blocks, dark joints, double outline, keystone
  for (const a of arches) {
    const tv = opts.ring ?? (6 * u + a.span * 0.055);
    const nSeg = 34;
    const inner = archPts(a, 0, nSeg).slice(1, -1), outer = archPts(a, tv, nSeg).slice(1, -1);
    fillPoly(ctx, [...outer, ...inner.slice().reverse()], S.ink(opts.ringTone ?? 0.74, 0.97));
    // blocks: slightly varied tones
    for (let i = 0; i < inner.length - 1; i += 2) {
      const q = [inner[i], inner[i + 2] || inner[i + 1], outer[i + 2] || outer[i + 1], outer[i]];
      if (r() < 0.5) fillPoly(ctx, q, S.ink(0.45 + r() * 0.3, 0.15 + r() * 0.25));
      line(ctx, S, [inner[i], outer[i]], Math.max(0.45, (0.8 + r() * 0.8) * u), S.ink(0.1, 0.6 + r() * 0.35), 0.15);
      if (r() < 0.55) blob(ctx, mix(inner[i][0], outer[i][0], 0.3 + r() * 0.5), mix(inner[i][1], outer[i][1], 0.3 + r() * 0.5), (0.8 + r() * 1.6) * u, { color: S.ink(0.08, 0.55 + r() * 0.35), rng: r, irregular: 0.5 });
    }
    line(ctx, S, inner, Math.max(0.7, 1.8 * u), S.ink(0.06, 0.9), 0.45);
    line(ctx, S, outer, Math.max(0.5, 1.3 * u), S.ink(0.08, 0.85), 0.45);
    const mid = archPts(a, tv * 0.6, nSeg).slice(1, -1);
    line(ctx, S, mid, Math.max(0.35, 0.5 * u), S.ink(0.3, 0.3), 0.3);
    // keystone
    const kx = a.c, ky = a.crown - tv * 0.5;
    fillPoly(ctx, wob(S, [[kx - tv * 0.32, ky - tv * 0.55], [kx + tv * 0.32, ky - tv * 0.55], [kx + tv * 0.24, ky + tv * 0.55], [kx - tv * 0.24, ky + tv * 0.55]], 0.2), S.ink(0.25, 0.75));
    fillPoly(ctx, [[kx - tv * 0.16, ky - tv * 0.3], [kx + tv * 0.16, ky - tv * 0.3], [kx + tv * 0.12, ky + tv * 0.3], [kx - tv * 0.12, ky + tv * 0.3]], S.ink(0.8, 0.8));
  }
  // ---- piers / footings at the water
  for (let i = 0; i < arches.length - 1; i++) {
    const a = arches[i], b = arches[i + 1];
    const pl = a.c + a.span / 2, pr = b.c - b.span / 2;
    const fy = y - 12 * u;
    fillPoly(ctx, wob(S, [[pl - 4 * u, fy], [pr + 4 * u, fy], [pr + 5 * u, y + 1], [pl - 5 * u, y + 1]], 0.3), S.ink(0.42));
    for (let j = 0; j < 10; j++) blob(ctx, mix(pl, pr, r()), mix(fy, y, r()), (1 + r() * 2) * u, { color: S.ink(0.08, 0.5 + r() * 0.4), rng: r });
    line(ctx, S, [[pl - 4 * u, fy], [pr + 4 * u, fy]], Math.max(0.5, 1.2 * u), S.ink(0.1, 0.8), 0.2);
    line(ctx, S, [[mix(pl, pr, 0.5), fy], [mix(pl, pr, 0.5), y]], Math.max(0.4, 0.8 * u), S.ink(0.15, 0.6), 0.2);
  }
  // ---- cornice (deck slab edge)
  const cTop = top.map((p) => [p[0], p[1] + corn * 0.15]), cBot = top.map((p) => [p[0], p[1] + corn]);
  fillPoly(ctx, [...cTop, ...cBot.slice().reverse()], S.ink(S.snow ? 0.95 : 0.84));
  line(ctx, S, cBot, Math.max(0.6, 1.2 * u), S.ink(0.12, 0.85), 0.3);
  line(ctx, S, cTop, Math.max(0.4, 0.7 * u), S.ink(0.3, 0.55), 0.3);
  // ---- balustrade
  if (opts.balustrade !== false) {
    const bh = opts.balH ?? 17 * u;
    const sp = opts.postSp ?? 38 * u;
    const n = Math.max(2, Math.round(L / sp));
    const railTop = top.map((p) => [p[0], p[1] - bh * 0.78]);
    const railBot = top.map((p) => [p[0], p[1] - bh * 0.12]);
    // panels: grey slabs with pale openings and dark frames
    fillPoly(ctx, [...railTop, ...railBot.slice().reverse()], S.ink(0.5, 0.95));
    for (let i = 0; i < n; i++) {
      const xa = mix(x0, x1, i / n) + 3.5 * u, xb = mix(x0, x1, (i + 1) / n) - 3.5 * u;
      for (const [qa, qb] of [[0.1, 0.45], [0.55, 0.9]]) {
        const p0x = mix(xa, xb, qa), p1x = mix(xa, xb, qb);
        const op = [[p0x, deckY(p0x) - bh * 0.66], [p1x, deckY(p1x) - bh * 0.66], [p1x, deckY(p1x) - bh * 0.36], [p0x, deckY(p0x) - bh * 0.36]];
        fillPoly(ctx, wob(S, op, 0.15), S.ink(opts.sky ?? 0.94));
        line(ctx, S, [op[3], op[2]], Math.max(0.35, 0.7 * u), S.ink(0.15, 0.65), 0.1);
        line(ctx, S, [op[0], op[3]], Math.max(0.3, 0.5 * u), S.ink(0.2, 0.5), 0.05);
      }
      // little baluster between the openings
      const xm = mix(xa, xb, 0.5);
      line(ctx, S, [[xm, deckY(xm) - bh * 0.15], [xm, deckY(xm) - bh * 0.75]], Math.max(0.4, 1.0 * u), S.ink(0.35, 0.7), 0.05);
    }
    line(ctx, S, railTop.map((p) => [p[0], p[1] - 1.0 * u]), Math.max(0.7, 2.2 * u), S.ink(S.snow ? 0.97 : 0.86), 0.3);
    line(ctx, S, railTop.map((p) => [p[0], p[1] - 2.4 * u]), Math.max(0.4, 0.7 * u), S.ink(0.25, 0.6), 0.3);
    line(ctx, S, railTop, Math.max(0.6, 1.2 * u), S.ink(0.12, 0.85), 0.3);
    line(ctx, S, railBot, Math.max(0.5, 1.0 * u), S.ink(0.15, 0.75), 0.3);
    // posts with round caps
    for (let i = 0; i <= n; i++) {
      const xx = mix(x0, x1, i / n), yb = deckY(xx);
      const pw = 6.5 * u, ph = bh * 1.32;
      fillPoly(ctx, wob(S, [[xx - pw / 2, yb], [xx + pw / 2, yb], [xx + pw / 2, yb - ph], [xx - pw / 2, yb - ph]], 0.2), S.ink(0.6));
      fillPoly(ctx, [[xx + pw * 0.1, yb], [xx + pw / 2, yb], [xx + pw / 2, yb - ph], [xx + pw * 0.1, yb - ph]], S.ink(0.45, 0.45));
      line(ctx, S, [[xx + pw / 2, yb], [xx + pw / 2, yb - ph]], Math.max(0.45, 1.0 * u), S.ink(0.12, 0.85), 0.1);
      line(ctx, S, [[xx - pw / 2, yb], [xx - pw / 2, yb - ph]], Math.max(0.4, 0.8 * u), S.ink(0.15, 0.7), 0.1);
      line(ctx, S, [[xx - pw * 0.6, yb - ph], [xx + pw * 0.6, yb - ph]], Math.max(0.5, 1.2 * u), S.ink(0.15, 0.8), 0.1);
      blob(ctx, xx, yb - ph - 2.6 * u, 3.3 * u, { color: S.ink(0.62), rng: r, sides: 8, irregular: 0.12 });
      blob(ctx, xx + 1.0 * u, yb - ph - 2.4 * u, 1.9 * u, { color: S.ink(0.2, 0.6), rng: r });
      if (S.snow) blob(ctx, xx, yb - ph - 4 * u, 2.6 * u, { color: S.ink(0.98), rng: r, squash: 0.55 });
    }
  }
  // ---- ragged dark outline along the ends
  raggedEdge(ctx, S, resample([[x0, deckY(x0) + corn], endL], 3 * u), 1.2 * u, 0.15, 0.6);
  raggedEdge(ctx, S, resample([[x1, deckY(x1) + corn], endR], 3 * u), 1.2 * u, 0.15, 0.6);
  return { left: [x0, deckY(x0)], right: [x1, deckY(x1)], crown: [peakX, deckY(peakX)], deckY, arches };
}

// ---------------------------------------------------------------- rope bridge
// a, b: deck end points [x, y]; sag: px below the chord at mid-span; hand: hand-rope height px.
export function paintRopeBridge(ctx, opts = {}) {
  const S = makeStyle(opts);
  const r = S.rng;
  const a = opts.a ?? [1100, 480], b = opts.b ?? [1420, 455];
  const sag = opts.sag ?? 45, hand = opts.hand ?? 11;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const u = clamp(hand / 11, 0.35, 2);
  const spacing = opts.spacing ?? 9 * u;
  const v = opts.tone ?? 0.18;
  const deck = (t, extraSag = 0) => [mix(a[0], b[0], t), mix(a[1], b[1], t) + (sag + extraSag) * 4 * t * (1 - t)];
  const N = Math.max(16, Math.round(len / 3));
  const curve = (f) => Array.from({ length: N + 1 }, (_, i) => f(i / N));
  // far hand rope (lighter), deck, near hand rope
  const far = curve((t) => { const p = deck(t, -sag * 0.15); return [p[0] + 1.5 * u, p[1] - hand * 1.05 - 1.8 * u]; });
  line(ctx, S, far, Math.max(0.35, 0.55 * u), S.ink(v + 0.25, 0.65), 0.25);
  // far ties
  const nT = Math.max(3, Math.round(len / spacing));
  for (let i = 1; i < nT; i++) {
    const t = i / nT; const p = deck(t);
    const q = far[Math.round(t * N)];
    line(ctx, S, [[p[0] + 1.5 * u, p[1] - 1.2 * u], q], Math.max(0.3, 0.4 * u), S.ink(v + 0.3, 0.45), 0.1);
  }
  // deck: two edges with plank ticks
  const dw = (opts.deckW ?? 2.2) * u;
  const dTop = curve((t) => { const p = deck(t); return [p[0], p[1] - dw * 0.5]; });
  const dBot = curve((t) => { const p = deck(t); return [p[0], p[1] + dw * 0.5]; });
  fillPoly(ctx, [...dTop, ...dBot.slice().reverse()], S.ink(v + 0.12, 0.9));
  const nP = Math.round(len / (1.6 * u));
  for (let i = 0; i <= nP; i++) {
    const t = i / nP; const p = deck(t);
    line(ctx, S, [[p[0] - 0.3 * u, p[1] - dw * 0.6], [p[0] + 0.3 * u, p[1] + dw * 0.9]], Math.max(0.3, 0.5 * u), S.ink(v - 0.08, 0.55 + r() * 0.35), 0);
  }
  line(ctx, S, dBot, Math.max(0.45, 0.8 * u), S.ink(v - 0.1, 0.9), 0.2);
  line(ctx, S, dTop, Math.max(0.3, 0.45 * u), S.ink(v, 0.6), 0.2);
  // near hand rope + ties + knots under the deck
  const near = curve((t) => { const p = deck(t, -sag * 0.12); return [p[0], p[1] - hand]; });
  line(ctx, S, near, Math.max(0.45, 0.85 * u), S.ink(v - 0.05, 0.92), 0.25);
  for (let i = 1; i < nT; i++) {
    const t = (i + 0.25 + (r() - 0.5) * 0.18) / nT; const p = deck(t);
    const q = near[Math.round(t * N)];
    line(ctx, S, [[p[0], p[1] + dw * 0.4], [q[0] + (r() - 0.5) * 0.4 * u, q[1]]], Math.max(0.4, (0.6 + r() * 0.25) * u), S.ink(v - 0.04, 0.85), 0.1);
    blob(ctx, p[0], p[1] + dw * 0.95, Math.max(0.4, 0.7 * u), { color: S.ink(v - 0.1, 0.9), rng: r, sides: 6 });
    blob(ctx, q[0], q[1] - 0.1 * u, Math.max(0.4, 0.75 * u), { color: S.ink(v - 0.12, 0.9), rng: r, sides: 6 });
  }
  // end posts
  if (opts.posts !== false) {
    for (const [p, dir] of [[a, 1], [b, -1]]) {
      const ph = hand * 1.45;
      line(ctx, S, [[p[0], p[1] + 2 * u], [p[0] + dir * 0.4 * u, p[1] - ph]], Math.max(0.8, 1.5 * u), S.ink(v - 0.1), 0.1);
      line(ctx, S, [[p[0] + dir * 2.4 * u, p[1] + 1.5 * u], [p[0] + dir * 2.6 * u, p[1] - ph * 0.9]], Math.max(0.6, 1.1 * u), S.ink(v, 0.8), 0.1);
      blob(ctx, p[0] + dir * 0.4 * u, p[1] - ph, Math.max(0.6, 1.0 * u), { color: S.ink(v - 0.1), rng: r });
    }
  }
  // tiny walker in a red robe (scholar with a dark top-knot)
  if (opts.figure != null && opts.figure !== false) {
    const t = typeof opts.figure === 'number' ? opts.figure : 0.12;
    const p = deck(t);
    const fh = hand * 1.2;
    const by = p[1] - dw * 0.5;
    fillPoly(ctx, wob(S, [[p[0] - fh * 0.2, by], [p[0] + fh * 0.17, by], [p[0] + fh * 0.09, by - fh * 0.5], [p[0] + fh * 0.07, by - fh * 0.74], [p[0] - fh * 0.08, by - fh * 0.74], [p[0] - fh * 0.11, by - fh * 0.45]], 0.1), S.red(0.0, 0.92));
    line(ctx, S, [[p[0] - fh * 0.02, by - fh * 0.7], [p[0] + fh * 0.02, by - fh * 0.15]], Math.max(0.3, fh * 0.03), S.red(0.6, 0.6), 0.05);
    line(ctx, S, [[p[0] + fh * 0.06, by - fh * 0.62], [p[0] + fh * 0.24, by - fh * 0.5]], Math.max(0.35, fh * 0.06), S.red(0.2, 0.9), 0.05);
    blob(ctx, p[0], by - fh * 0.84, fh * 0.1, { color: S.ink(0.75), rng: r });
    blob(ctx, p[0] - fh * 0.02, by - fh * 0.95, fh * 0.07, { color: S.ink(0.08), rng: r });
  }
  return { a, b, mid: deck(0.5), deck: (t) => deck(t) };
}

// ---------------------------------------------------------------- baking
// Bake painter(s) into a texture card covering `rect` (design px), softened like
// ink on damp paper: drawn at `scale` density, lightly blurred, then inkified.
export function bakeArch(api, rect, draw, { scale = 2, blur = 0.3, edge = 0.25, granulation = 0.12, bleed = 0.7, seed = 0 } = {}) {
  const [rx, ry, rw, rh] = rect;
  const src = api.bakeCanvas(rw, rh, (ctx, info) => {
    const off = new OffscreenCanvas(info.pw, info.ph);
    const o = off.getContext('2d');
    o.setTransform(info.k, 0, 0, info.k, -rx * info.k, -ry * info.k);
    draw(o);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (blur > 0) ctx.filter = `blur(${(blur * info.k).toFixed(2)}px)`;
    ctx.drawImage(off, 0, 0);
    ctx.restore();
  }, { scale });
  const out = inkify(api, src, { edge, granulation, bleed, seed });
  api.engine?.freeTex?.(src);
  return out;
}

// Approximate bounding rect (design px) of an element, with margin.
export function archBounds(kind, o = {}) {
  const m = 6;
  if (kind === 'pavilion' || kind === 'hall' || kind === 'gate') {
    const w = o.w ?? (kind === 'hall' ? 200 : 150);
    const h = w * (kind === 'hall' ? 0.75 : kind === 'gate' ? 0.85 : 0.82);
    return [Math.floor(o.x - w * 0.62 - m), Math.floor(o.y - h - m), Math.ceil(w * 1.24 + 2 * m), Math.ceil(h + w * 0.12 + 2 * m)];
  }
  if (kind === 'temple') { const w = o.w ?? 200; return [Math.floor(o.x - w * 1.1 - m), Math.floor(o.y - w * 0.95 - m), Math.ceil(w * 2.2 + 2 * m), Math.ceil(w * 1.25 + 2 * m)]; }
  if (kind === 'tower') { const w = o.w ?? 60, h = o.h ?? 110; return [Math.floor(o.x - w * 1.25 - m), Math.floor(o.y - h * 1.12 - m), Math.ceil(w * 2.7 + 2 * m), Math.ceil(h * 1.15 + 2 * m)]; }
  if (kind === 'archBridge') { const x0 = o.x0 ?? 270, x1 = o.x1 ?? 830, y = o.y ?? 680, d = Math.min(...[].concat(o.deck ?? 590)) - (o.hump ?? 70) - (o.balH ?? 17 * (x1 - x0) / 560) - 8; return [Math.floor(x0 - 20), Math.floor(d - m), Math.ceil(x1 - x0 + 40), Math.ceil(y - d + 10 + m)]; }
  if (kind === 'ropeBridge') { const a = o.a ?? [1100, 480], b = o.b ?? [1420, 455]; const hand = o.hand ?? 11; return [Math.floor(Math.min(a[0], b[0]) - 10), Math.floor(Math.min(a[1], b[1]) - hand * 2 - 10), Math.ceil(Math.abs(b[0] - a[0]) + 20), Math.ceil(Math.abs(b[1] - a[1]) + (o.sag ?? 45) + hand * 2 + 24)]; }
  return [0, 0, 1920, 1080];
}

const PAINTERS = { pavilion: paintPavilion, hall: paintHall, temple: paintTemple, gate: paintGate, tower: paintTower, archBridge: paintArchBridge, ropeBridge: paintRopeBridge };

// Bake one element into its own tight card. Returns { src, rect, anchors }.
export function makeArch(api, kind, opts = {}, bakeOpts = {}) {
  const rect = bakeOpts.rect || archBounds(kind, opts);
  let anchors = null;
  const src = bakeArch(api, rect, (ctx) => { anchors = PAINTERS[kind](ctx, opts); }, bakeOpts);
  if (anchors && anchors.V) delete anchors.V;
  return { src, rect, anchors };
}
