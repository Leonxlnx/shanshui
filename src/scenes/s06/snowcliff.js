// s06 snowy cliffs: masses of dark mottled rock buried under thick snow pillows
// (ref 06). A mass is a dark rock backdrop plus a stack of rounded lumps painted
// top to bottom: each lump is a dark face with a snow cap, and every lower lump
// covers the foot of the faces above it, which gives the ledge-over-ledge look of
// the reference. Snow-laden pines are painted into the stack. A GPU pass then adds
// wet-ink mottling, granulation and vertical texture to the rock; the snow stays clean.
import { rgba, blob, dryStroke, tone } from '../../lib/brush.js';
import { topYAt, polyBBox } from '../../lib/rock.js';
import { snowCaps } from './snowcap.js';

export const SNOW = [246, 245, 242];
export const SNOW_SH = [181, 184, 188];
const PAPER = [240, 234, 226];
const tn = (v) => tone(v, PAPER);
const smoothstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function roughen(poly, nz, amp, seed) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(L / 6));
    const nx = -(b[1] - a[1]) / (L || 1), ny = (b[0] - a[0]) / (L || 1);
    for (let k = 0; k < n; k++) {
      const s = k / n, x = a[0] + (b[0] - a[0]) * s, y = a[1] + (b[1] - a[1]) * s;
      const d = amp * (nz.n2(x * 0.012 + seed, y * 0.012) * 1.6 + nz.n2(x * 0.05 + seed, y * 0.05) * 0.5 + nz.n2(x * 0.2, y * 0.2 + seed) * 0.2);
      out.push([x + nx * d, y + ny * d]);
    }
  }
  return out;
}
const trace = (g, P) => { g.beginPath(); g.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) g.lineTo(P[i][0], P[i][1]); g.closePath(); };
function inside(P, x, y) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    if ((P[i][1] > y) !== (P[j][1] > y) && x < (P[j][0] - P[i][0]) * (y - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c;
  }
  return c;
}
// rounded irregular lump outline (flatter bottom), as a point list
function lumpPts(rng, x, y, w, h) {
  const n = 16, P = [];
  const ph = rng() * 6.28;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 1 + (rng() - 0.5) * 0.18 + Math.sin(a * 3 + ph) * 0.06;
    const sy = Math.sin(a) > 0 ? 1.15 : 1;            // a little deeper below the centre
    P.push([x + Math.cos(a) * w * 0.5 * r, y + Math.sin(a) * h * 0.5 * r * sy]);
  }
  return P;
}
function smoothTrace(g, P) {
  const n = P.length;
  const m = (i) => [(P[i % n][0] + P[(i + 1) % n][0]) / 2, (P[i % n][1] + P[(i + 1) % n][1]) / 2];
  g.beginPath();
  const s = m(n - 1); g.moveTo(s[0], s[1]);
  for (let i = 0; i < n; i++) { const e = m(i); g.quadraticCurveTo(P[i][0], P[i][1], e[0], e[1]); }
  g.closePath();
}

// snow pillows along [x0, x1] resting at yTop: cool grey undersides, white tops, a few drips
function snowCap(g, rng, x0, x1, yTop, capH) {
  const w = x1 - x0;
  const n = Math.max(2, Math.round(w / (capH * 1.15)));
  const P = [];
  for (let i = 0; i < n; i++) {
    const x = x0 + w * (i + 0.5) / n + (rng() - 0.5) * capH * 0.5;
    const r = Math.min(w * 0.6, capH * (0.6 + rng() * 0.4));
    P.push([x, yTop + capH * 0.42 + (rng() - 0.5) * capH * 0.25, r]);
    if (rng() < 0.06) P.push([x + (rng() - 0.5) * r, yTop + capH * (0.8 + rng() * 0.3), r * (0.3 + rng() * 0.2)]);
  }
  for (const [x, y, r] of P) blob(g, x + r * 0.06, y + r * 0.26, r * 1.02, { color: SNOW_SH, alpha: 0.7, rng, irregular: 0.3, squash: 0.68, sides: 10 });
  for (const [x, y, r] of P) blob(g, x + r * 0.03, y + r * 0.1, r * 0.98, { color: [214, 216, 218], alpha: 0.9, rng, irregular: 0.3, squash: 0.66, sides: 10 });
  for (const [x, y, r] of P) blob(g, x - r * 0.08, y - r * 0.08, r * 0.9, { color: SNOW, alpha: 1, rng, irregular: 0.3, squash: 0.64, sides: 10 });
}

// small snow-laden pine: crooked trunk, near-horizontal limbs ending in flat pads of
// radiating needle tufts, thick snow lumps resting on the pads
function tuft(g, rng, x, y, r, ink) {
  blob(g, x, y + r * 0.1, r * 0.55, { color: ink, alpha: 0.95, rng, irregular: 0.35, squash: 0.5 });
  g.strokeStyle = rgba(ink, 0.92);
  g.lineWidth = Math.max(0.7, r * 0.07);
  g.beginPath();
  const n = 12 + ((rng() * 8) | 0);
  for (let i = 0; i < n; i++) {
    const a = -0.25 + rng() * (Math.PI + 0.5), L = r * (0.6 + rng() * 0.55);
    const sx = x + (rng() - 0.5) * r * 0.3, sy = y + (rng() - 0.5) * r * 0.2;
    g.moveTo(sx, sy); g.lineTo(sx + Math.cos(a) * L, sy + Math.sin(a) * L * 0.75);
  }
  g.stroke();
}
export function snowPine(g0, rng, x, y, h, { lean = 0, reach = 0, tone: tv = 0.03 } = {}) {
  // painted on its own small canvas so the snow can settle on it, then composited
  const k = g0.getTransform().a;
  const bx = Math.floor(x - h * 1.5), by = Math.floor(y - h * 1.45), bw = Math.ceil(h * 3), bh = Math.ceil(h * 1.65);
  const cv = new OffscreenCanvas(Math.max(1, Math.round(bw * k)), Math.max(1, Math.round(bh * k)));
  const g = cv.getContext('2d');
  g.setTransform(k, 0, 0, k, -bx * k, -by * k);
  const ink = tn(tv);
  const spine = [];
  let px = x, py = y, ang = lean * Math.PI / 180;
  for (let i = 0; i <= 8; i++) {
    spine.push([px, py]);
    ang += (rng() - 0.5) * 0.45 + reach * 0.05;
    px += Math.sin(ang) * h / 8; py -= Math.cos(ang) * h / 8;
  }
  dryStroke(g, spine, { width: Math.max(2.5, h * 0.085), bristles: 5, color: ink, alpha: 0.95, dry: 0.12, rng, profile: 'taper' });
  const pads = [];
  const nb = 2 + Math.round(h / 45 + rng());
  for (let i = 0; i < nb; i++) {
    const s = 0.4 + 0.6 * (i / Math.max(1, nb - 1)) + (rng() - 0.5) * 0.08;
    const p = spine[Math.max(0, Math.min(8, Math.round(s * 8)))];
    const dir = rng() < 0.5 + reach * 0.45 ? 1 : -1;
    const L = h * (0.45 + rng() * 0.4) * (1.15 - s * 0.5);
    const end = [p[0] + dir * L, p[1] - L * (0.02 + rng() * 0.18)];
    const mid = [p[0] + dir * L * 0.5, p[1] + L * (rng() - 0.6) * 0.12];
    dryStroke(g, [p, mid, end], { width: Math.max(1.4, h * 0.032), bristles: 3, color: ink, alpha: 0.92, dry: 0.15, rng, profile: 'taper' });
    // a rounded clump of needle tufts around the branch end (a dense crown, not a flat shelf)
    const tf = [];
    const cw = L * (0.8 + rng() * 0.35), ch = h * (0.3 + rng() * 0.12), nc = 6 + ((rng() * 5) | 0);
    const cx = end[0] - dir * cw * 0.3, cy = end[1] - ch * 0.2;
    for (let j = 0; j < nc; j++) {
      const a = rng() * Math.PI * 2, rr = Math.sqrt(rng());
      tf.push([cx + Math.cos(a) * rr * cw * 0.5, cy + Math.sin(a) * rr * ch * 0.5 - ch * 0.15, h * (0.13 + rng() * 0.08)]);
    }
    tf.sort((a, b) => a[1] - b[1]);
    pads.push(tf);
  }
  const top = spine[8];
  pads.push([[top[0], top[1] + 3, h * 0.08], [top[0] - h * 0.07, top[1] + h * 0.06, h * 0.07], [top[0] + h * 0.07, top[1] + h * 0.07, h * 0.07]]);
  for (const tf of pads) for (const [tx, ty, r] of tf) tuft(g, rng, tx, ty, r, ink);
  // finer, broken snow (a dusting on every tuft, not one smooth pillow per pad) ...
  snowCaps(cv, k, { cap: h * 0.06, mound: h * 0.035, blur: Math.max(1.5, h * 0.03), freq: 0.15, lobes: 1, seed: (rng() * 1000) | 0, rim: [214, 218, 223], rimAmt: 0.03, under: [220, 223, 227], ragged: 0.3, round: 1.2, pokeV: 0.45 });
  // ... plus loose flecks of snow on the upper side of the tufts
  for (const tf of pads) for (const [tx, ty, r] of tf) {
    const nfl = 2 + ((rng() * 4) | 0);
    for (let j = 0; j < nfl; j++) blob(g, tx + (rng() - 0.5) * r * 1.4, ty - r * (0.1 + rng() * 0.45), r * (0.1 + rng() * 0.16), { color: SNOW, alpha: 0.95, rng, irregular: 0.4, squash: 0.55, sides: 7 });
  }
  g0.drawImage(cv, bx, by, bw, bh);
}

// a ledge shrub: a low mound of dark needle tufts on a shadowed ledge, snow settled on top
export function snowShrub(g0, rng, x, y, w) {
  const k = g0.getTransform().a;
  const h = w * (0.35 + rng() * 0.2);
  const bx = Math.floor(x - w * 0.8), by = Math.floor(y - h * 1.6), bw = Math.ceil(w * 1.6), bh = Math.ceil(h * 2.3);
  const cv = new OffscreenCanvas(Math.max(1, Math.round(bw * k)), Math.max(1, Math.round(bh * k)));
  const g = cv.getContext('2d');
  g.setTransform(k, 0, 0, k, -bx * k, -by * k);
  const ink = tn(0.03 + rng() * 0.05);
  blob(g, x, y + h * 0.15, w * 0.5, { color: tn(0.12), alpha: 0.75, rng, irregular: 0.35, squash: 0.3 });
  const n = 4 + Math.round(w / 8);
  for (let i = 0; i < n; i++) {
    const e = (rng() * 2 - 1) * 0.9;
    const env = 1 - e * e;
    tuft(g, rng, x + e * w * 0.45, y - h * env * (0.3 + rng() * 0.5), w * (0.17 + rng() * 0.1) * (0.6 + 0.4 * env), ink);
  }
  snowCaps(cv, k, { cap: h * 0.3, mound: h * 0.18, blur: Math.max(2, w * 0.06), freq: 0.1, lobes: 0.5, seed: (rng() * 1000) | 0, rim: [214, 218, 223], flat: [0.15, 0.7] });
  g0.drawImage(cv, bx, by, bw, bh);
}

// mass: { poly, face (0..1 base value), dark (under-snow ink amount), cover (0..1 snow cap share),
//         lump: [min, max] lump width, fade: [y0, y1], light: -1 | 1, pines: [[x, y, h, lean, reach]] }
export function paintMass(ctx, k, api, M, seed) {
  const rng = api.rng('sc:' + seed);
  const nz = api.noise(seed * 7 + 3);
  const poly = roughen(M.poly, nz, M.rough ?? 7, seed);
  const bb = polyBBox(poly);
  const pad = 70;
  const bx = Math.floor(bb.x0 - pad), by = Math.floor(bb.y0 - pad);
  const bw = Math.ceil(bb.w + pad * 2), bh = Math.ceil(bb.h + pad * 2);
  const cv = new OffscreenCanvas(Math.max(1, Math.round(bw * k)), Math.max(1, Math.round(bh * k)));
  const g = cv.getContext('2d');
  g.setTransform(k, 0, 0, k, -bx * k, -by * k);
  const face = M.face ?? 0.4, dark = M.dark ?? 1, cover = M.cover ?? 0.45;
  const light = M.light ?? -1;
  const top = [];
  for (let x = Math.ceil(bb.x0); x <= bb.x1; x += 3) { const y = topYAt(poly, x); if (y != null) top.push([x, y]); }
  const topAt = (x) => { const i = Math.max(0, Math.min(top.length - 1, Math.round((x - top[0][0]) / 3))); return top[i][1]; };
  const fade0 = M.fade ? M.fade[0] : bb.y1 + 10, fade1 = M.fade ? M.fade[1] : bb.y1 + 20;
  const yEnd = Math.min(bb.y1, fade1);

  // ---- rock backdrop: vertical granite facets, dark under the top, lighter downward
  g.save();
  trace(g, poly); g.clip();
  g.fillStyle = rgba(tn(face)); g.fillRect(bb.x0 - 5, bb.y0 - 5, bb.w + 10, bb.h + 10);
  const cx = (x) => Math.max(bb.x0, Math.min(bb.x1, x));
  const fW = M.facet ?? 42;
  for (let fx = bb.x0 - 10; fx < bb.x1 + 10;) {
    const fw = fW * (0.45 + rng() * 1.1);
    const t = Math.min(topAt(cx(fx)), topAt(cx(fx + fw)), topAt(cx(fx + fw * 0.5)));
    const litF = light < 0 ? 1 - (fx - bb.x0) / bb.w : (fx - bb.x0) / bb.w;
    const v = face + (rng() - 0.5) * 0.3 + (litF - 0.5) * (M.litRange ?? 0.2);
    const span = Math.max(40, yEnd - t);
    const dd = (M.topDepth ?? 0.35) * (0.6 + rng() * 0.8);
    const fg = g.createLinearGradient(0, t, 0, t + span);
    fg.addColorStop(0, rgba(tn(Math.max(0.02, v - 0.32 * dark))));
    fg.addColorStop(Math.min(0.9, dd), rgba(tn(v)));
    fg.addColorStop(1, rgba(tn(Math.min(0.85, v + 0.22))));
    g.fillStyle = fg;
    g.filter = `blur(${((M.facetBlur ?? 5) * k).toFixed(1)}px)`;
    const sk = (rng() - 0.5) * fw * 0.35;
    g.beginPath(); g.moveTo(fx, t - 30); g.lineTo(fx + fw, t - 30); g.lineTo(fx + fw + sk, yEnd + 30); g.lineTo(fx + sk, yEnd + 30); g.closePath(); g.fill();
    g.filter = `blur(${(4 * k).toFixed(1)}px)`;
    // lit plane: a pale vertical wash on the light side of the facet
    if (rng() < 0.6) {
      const lx = light < 0 ? fx + fw * 0.08 : fx + fw * 0.5;
      const lg = g.createLinearGradient(0, t + span * 0.15, 0, t + span);
      lg.addColorStop(0, rgba(tn(0.92), 0)); lg.addColorStop(0.4, rgba(tn(0.92), 0.22 + rng() * 0.2)); lg.addColorStop(1, rgba(tn(0.92), 0.05));
      g.fillStyle = lg; g.fillRect(lx, t, fw * 0.42, span);
    }
    g.filter = 'none';
    // crease on the shadow edge of the facet
    const ex = light < 0 ? fx + fw : fx;
    const len = span * (0.4 + rng() * 0.6);
    dryStroke(g, [[ex, t + 4], [ex + sk * 0.3 + (rng() - 0.5) * 5, t + len * 0.45], [ex + sk * 0.6 + (rng() - 0.5) * 6, t + len]], { width: 2.5 + rng() * 6, bristles: 4, color: tn(0.03 + rng() * 0.08), alpha: 0.55 + rng() * 0.35, dry: 0.3, rng });
    fx += fw;
  }
  const nb = Math.round(bb.w * bb.h / 4000 * dark);
  for (let i = 0; i < nb; i++) {
    const x = bb.x0 + rng() * bb.w, t = topAt(x);
    const y = t + Math.pow(rng(), 1.8) * Math.max(20, yEnd - t);
    const bl = 6 + rng() * 40; dryStroke(g, [[x, y], [x + (rng() - 0.5) * 4, y + bl * 0.5], [x + (rng() - 0.5) * 6, y + bl]], { width: 2 + rng() * 7, bristles: 3, color: tn(0.02 + rng() * 0.12), alpha: 0.4 + rng() * 0.45, dry: 0.25, rng });
  }
  // cun: long thin fissure strokes, slightly bent, in loose families; pale lit planes between
  const ncun = Math.round(bb.w * bb.h / 2600 * (M.cun ?? 0));
  for (let i = 0; i < ncun; i++) {
    const x = bb.x0 + rng() * bb.w, t = topAt(x);
    const y = t + 4 + Math.pow(rng(), 1.4) * Math.max(30, yEnd - t);
    const len = 30 + rng() * 140, lean = (rng() - 0.5) * 0.4;
    const fam = 1 + ((rng() * 3) | 0);
    for (let f = 0; f < fam; f++) {
      let px = x + f * (4 + rng() * 7), py = y + (rng() - 0.5) * 12;
      const pts = [];
      for (let s = 0; s < 5; s++) { pts.push([px, py]); px += lean * len / 4 + (rng() - 0.5) * 5; py += len / 4 * (0.8 + rng() * 0.4); }
      dryStroke(g, pts, { width: (1.2 + rng() * 3.2) * (f ? 0.7 : 1), bristles: 3, color: tn(0.02 + rng() * 0.1), alpha: 0.5 + rng() * 0.4, dry: 0.45, rng, profile: 'taper' });
    }
    if (rng() < 0.5) {
      g.filter = `blur(${(3 * k).toFixed(1)}px)`;
      const lg = g.createLinearGradient(0, y, 0, y + len);
      lg.addColorStop(0, rgba(tn(0.95), 0)); lg.addColorStop(0.3, rgba(tn(0.95), 0.3 + rng() * 0.3)); lg.addColorStop(1, rgba(tn(0.95), 0));
      g.fillStyle = lg;
      g.beginPath(); g.moveTo(x + 3, y); g.lineTo(x + 6 + 10 + rng() * 14, y + 8); g.lineTo(x + 8 + 10 + lean * len, y + len); g.lineTo(x + 4 + lean * len, y + len); g.closePath(); g.fill();
      g.filter = 'none';
    }
  }
  g.restore();

  // ---- snow blanket over the top surface: white with soft grey modelling, lumpy lower edge
  const sdp = M.snowDepth ?? 16;
  const blanket = [];
  if (sdp > 0) {
    const sm = (arr, r) => arr.map(([x], i) => { let a = 0, n = 0; for (let j = Math.max(0, i - r); j <= Math.min(arr.length - 1, i + r); j++) { a += arr[j][1]; n++; } return [x, a / n]; });
    const topS = sm(top, 3);
    const bot0 = topS.map(([x, t], i) => {
      const a = topS[Math.max(0, i - 6)], b = topS[Math.min(topS.length - 1, i + 6)];
      const s = Math.abs(b[1] - a[1]) / Math.max(1, b[0] - a[0]);
      const n = nz.n2(x * 0.012 + 21, 3) * 0.5 + 0.5, n2 = nz.n2(x * 0.045 + 5, 8) * 0.5 + 0.5;
      const D = sdp * (0.35 + 1.1 * n) * (0.75 + 0.5 * n2) / (1 + s * 1.2);
      return [x, t + Math.max(3, D)];
    });
    const bot = sm(bot0, 4).map(([x, y], i) => [x, Math.max(y, topS[i][1] + 3)]);
    const up = top.map(([x, t]) => [x, t - 3]);
    const path = (dy, grow = 0) => { g.beginPath(); g.moveTo(up[0][0] - grow, up[0][1]); for (const q of up) g.lineTo(q[0], q[1] - grow); for (let i = bot.length - 1; i >= 0; i--) g.lineTo(bot[i][0], bot[i][1] + dy); g.closePath(); };
    // the ink under the blanket's edge is the darkest of the face
    g.save(); trace(g, poly); g.clip();
    g.filter = `blur(${(3 * k).toFixed(1)}px)`;
    g.strokeStyle = rgba(tn(0.02), 0.85); g.lineWidth = 9; g.beginPath(); bot.forEach(([x, y], i) => (i ? g.lineTo(x, y + 5) : g.moveTo(x, y + 5))); g.stroke();
    g.filter = 'none';
    g.restore();
    path(6); g.fillStyle = rgba(SNOW_SH, 0.95); g.fill();
    path(0, 2); g.fillStyle = rgba(SNOW); g.fill();
    // lumpy lower edge: hanging pillows
    const lumpsB = [];
    for (let i = 0; i < bot.length; i += 3 + ((rng() * 4) | 0)) {
      const [x, y] = bot[i];
      const r = 4 + rng() * Math.min(18, sdp * 0.4 + 4);
      lumpsB.push([x, y - r * 0.2, r]);
    }
    for (const [x, y, r] of lumpsB) blob(g, x + r * 0.05, y + r * 0.3, r, { color: SNOW_SH, alpha: 0.35, rng, irregular: 0.3, squash: 0.68 });
    for (const [x, y, r] of lumpsB) blob(g, x - r * 0.05, y - r * 0.05, r * 0.92, { color: SNOW, alpha: 1, rng, irregular: 0.3, squash: 0.66 });
    // modelling inside the blanket: soft cool hollows, a few rocks peeking through
    g.save();
    path(0, 2); g.clip();
    g.filter = `blur(${(7 * k).toFixed(1)}px)`;
    for (let i = 0; i < top.length; i += 6) {
      const [x, t] = top[i], yb = bot[i][1];
      if (yb - t < 18 || rng() > 0.6) continue;
      const y = t + (yb - t) * (0.3 + rng() * 0.65);
      blob(g, x, y, 8 + rng() * (yb - t) * 0.4, { color: SNOW_SH, alpha: 0.3 + rng() * 0.25, rng, irregular: 0.45, squash: 0.45 });
    }
    g.filter = 'none';
    g.restore();
    const nPeek = Math.round(top.length * 3 / 60 * (M.peek ?? 1) * Math.min(1, sdp / 40));
    for (let j = 0; j < nPeek; j++) {
      const i = (rng() * top.length) | 0;
      const [x, t] = top[i], yb = bot[i][1];
      if (yb - t < 24) continue;
      const y = t + (yb - t) * (0.3 + rng() * 0.6), r = 3 + rng() * Math.min(14, (yb - t) * 0.25);
      blob(g, x, y + r * 0.3, r * 1.1, { color: tn(0.03 + rng() * 0.2), alpha: 0.9, rng, irregular: 0.5, squash: 0.6 + rng() * 0.6 });
      blob(g, x - r * 0.1, y - r * 0.35, r * 0.95, { color: SNOW, alpha: 1, rng, irregular: 0.35, squash: 0.45 });
    }
    blanket.push(...bot);
  }

  // ---- snow settling on the tops of the dark rock (facet tops, creases), before the pines
  if (M.settle) snowCaps(cv, k, { ink: true, seed: seed * 5 + 2, rim: [214, 218, 223], ...M.settle });
  // ---- top boulders, snow ledges and pines, top to bottom
  const [lw0, lw1] = M.lump || [40, 120];
  const items = [];
  const nl = Math.round(bb.w * bb.h / 9000 * (M.ledges ?? 0.3));
  for (let i = 0; i < nl * 3; i++) {
    const x = bb.x0 + rng() * bb.w, t = topAt(x);
    const y = t + 30 + rng() * Math.max(10, fade0 - t - 40);
    if (!inside(poly, x, y) || !inside(poly, x, y + 20)) continue;
    const n = nz.n2(x * 0.01 + 3, y * 0.012) * 0.5 + 0.5;
    if (rng() > n * n * 2.2) continue;
    items.push({ x, y, w: 18 + rng() * (lw1 * 0.6) * (0.5 + n), ledge: true });
  }
  for (const p of (M.pines || [])) items.push({ pine: p, y: p[1] });
  items.sort((a, b) => a.y - b.y);
  for (const L of items) {
    if (L.pine) { const [px, py, ph, le = 0, re = 0] = L.pine; snowPine(g, rng, px, py, ph, { lean: le, reach: re }); continue; }
    if (L.ledge) { snowShrub(g, rng, L.x, L.y, L.w); continue; }
    const P = lumpPts(rng, L.x, L.y, L.w, L.h);
    const yTop = L.y - L.h * 0.5;
    g.save();
    smoothTrace(g, P); g.clip();
    const v0 = Math.max(0.02, face - 0.32 * dark), v1 = Math.min(0.85, face + 0.2);
    const fg = g.createLinearGradient(0, yTop, 0, yTop + L.h * 1.1);
    fg.addColorStop(0, rgba(tn(v0))); fg.addColorStop(1, rgba(tn(v1)));
    g.fillStyle = fg; g.fillRect(L.x - L.w, yTop - 10, L.w * 2, L.h * 1.4);
    for (let j = 0; j < L.w / 18; j++) {
      const sx = L.x + (rng() - 0.5) * L.w * 0.9, len = L.h * (0.4 + rng() * 0.7);
      dryStroke(g, [[sx, yTop + L.h * 0.1], [sx + (rng() - 0.5) * 5, yTop + L.h * 0.1 + len]], { width: 2 + rng() * 4, bristles: 3, color: tn(0.03 + rng() * 0.1), alpha: 0.5 + rng() * 0.35, dry: 0.3, rng });
    }
    g.restore();
    const n = nz.n2(L.x * 0.008 + 5, L.y * 0.008) * 0.5 + 0.5;
    const share = cover * (0.5 + 0.7 * n);
    if (share > 0.08) snowCap(g, rng, L.x - L.w * 0.5, L.x + L.w * 0.5, yTop - 3, L.h * Math.min(0.9, share));
  }
  // ---- top cornice along the silhouette
  const tc = M.cornice ?? 0;
  if (tc > 0) {
    let acc = 0;
    const row = [];
    for (let i = 0; i < top.length; i++) {
      const [x, y] = top[i];
      const a = top[Math.max(0, i - 3)], b = top[Math.min(top.length - 1, i + 3)];
      const s = Math.abs(b[1] - a[1]) / Math.max(1, b[0] - a[0]);
      const r = tc * (0.6 + (nz.n2(x * 0.03 + 11, 1) * 0.5 + 0.5)) * Math.max(0, 1 - s * 0.9);
      acc += 3;
      if (r < 2 || acc < r * 0.7) continue;
      acc = 0;
      row.push([x + (rng() - 0.5) * r * 0.3, y + r * 0.15, r * (0.8 + rng() * 0.4)]);
    }
    for (const [x, y, r] of row) blob(g, x + r * 0.08, y + r * 0.3, r * 1.03, { color: SNOW_SH, alpha: 0.9, rng, irregular: 0.28, squash: 0.6 });
    for (const [x, y, r] of row) blob(g, x - r * 0.05, y - r * 0.05, r, { color: SNOW, alpha: 1, rng, irregular: 0.28, squash: 0.58 });
  }
  // ---- mist dissolve at the bottom
  if (M.fade) {
    g.save();
    g.globalCompositeOperation = 'destination-out';
    const gd = g.createLinearGradient(0, fade0, 0, fade1);
    gd.addColorStop(0, 'rgba(0,0,0,0)'); gd.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = gd; g.fillRect(bx, fade0, bw, by + bh - fade0);
    g.filter = `blur(${(10 * k).toFixed(1)}px)`;
    g.fillStyle = 'rgba(0,0,0,0.85)';
    for (let x = bx; x < bx + bw; x += 30) {
      const y = fade0 + (fade1 - fade0) * (0.35 + 0.5 * (nz.n2(x * 0.01, 77) * 0.5 + 0.5));
      g.beginPath(); g.ellipse(x, y + 20, 34 + rng() * 25, 24 + rng() * 14, 0, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }
  ctx.drawImage(cv, bx, by, bw, bh);
  return { poly, top, bb };
}

const FINISH = /* glsl */ `
uniform float uSeed;
uniform vec2 uOff, uDim;
vec4 shade(vec2 p, vec2 uv) {
  vec2 q = p + uOff + uSeed * 91.0;
  // ragged, painted edges: warp the lookup a little (wavy plus fine bristle streaks)
  vec2 wv = vec2(fbm(q * 0.03, 3), fbm(q * 0.03 + 17.0, 3)) * 3.2
          + vec2(snoise(q * vec2(0.2, 0.045)), snoise(q * vec2(0.045, 0.2) + 9.0)) * 1.3;
  uv += wv / uDim;
  vec4 c = texture(uSrc, uv);
  if (c.a < 0.002) return c;
  vec3 col = c.rgb / c.a;
  float L = luma(col);
  float d = clamp((0.92 - L) / 0.88, 0.0, 1.0);          // ink density
  float rock = smoothstep(0.06, 0.2, d) * (1.0 - smoothstep(0.75, 0.9, L) * 0.0);
  float mott = fbm(q * 0.0045, 3) * 0.75 + fbm(q * 0.015, 3) * 0.25;
  float blot = fbm(q * vec2(0.03, 0.018) + 3.0, 4);
  float st = streaks(q * 0.09, vec2(0.0, 1.0), 7.0, 3);
  float gr = vnoise(q * 0.9) * 0.55 + vnoise(q * 2.3 + 4.0) * 0.45;
  float dd = d * (1.0 + 0.42 * mott + 0.08 * st);
  dd += smoothstep(0.15, 0.4, blot) * 0.12 * smoothstep(0.2, 0.55, d);
  dd -= smoothstep(0.2, 0.45, -blot) * 0.15 * (1.0 - d);
  float mid = 4.0 * dd * (1.0 - dd);
  dd *= 1.0 - 0.3 * (gr - 0.5) * (0.4 + 1.2 * mid);
  dd = clamp(mix(d, dd, rock), 0.0, 1.0);
  // wet rim: pigment pools where dark meets light
  vec4 b = vec4(0.0);
  for (int i = 0; i < 8; i++) { float a = float(i) * 0.785398; b += texture(uSrc, uv + vec2(cos(a), sin(a)) * uTexel * 3.0); }
  b /= 8.0;
  float db = clamp((0.92 - luma(b.a > 0.0 ? b.rgb / b.a : vec3(0.92))) / 0.88, 0.0, 1.0);
  dd = clamp(dd + max(0.0, dd - db) * 0.6 * rock, 0.0, 1.0);
  // dry brush: where the rock meets lighter snow above it, the ink breaks into streaks
  float lit = clamp((db - d) * -1.0, 0.0, 1.0);
  float dry = smoothstep(0.5, 0.78, vnoise(q * vec2(0.32, 0.045)) * 0.7 + vnoise(q * vec2(0.9, 0.12) + 5.0) * 0.3);
  dd = mix(dd, dd * 0.12, smoothstep(0.04, 0.25, lit) * dry * rock * 0.85);
  float Lt = 0.92 - dd * 0.88;
  vec3 o = mix(col * (Lt / max(L, 0.02)), Lt * vec3(1.01, 0.995, 0.975), rock * 0.5);
  o *= 1.0 - 0.025 * (1.0 - rock) * (gr - 0.5);
  float a = c.a * (1.0 - 0.12 * rock * (gr - 0.4) * mid);
  return vec4(clamp(o, 0.0, 1.0) * a, a);
}`;

export function bakeSnowCliff(api, rect, masses, { scale = 1, seed = 1, after = null } = {}) {
  const info = [];
  const t0 = performance.now();
  const src = api.bakeCanvas(rect[2], rect[3], (ctx, { k }) => {
    ctx.translate(-rect[0], -rect[1]);
    masses.forEach((M, i) => { info.push(paintMass(ctx, k, api, M, seed * 100 + i)); if (M.after) M.after(ctx); });
    if (after) after(ctx, k);
  }, { scale });
  const out = api.processTex(src, FINISH, { uniforms: { uSeed: seed % 7, uOff: [rect[0], rect[1]], uDim: [rect[2], rect[3]] } });
  api.engine?.freeTex?.(src);
  console.warn('s06 snowcliff ms', Math.round(performance.now() - t0));
  return { src: out, rect, info };
}
