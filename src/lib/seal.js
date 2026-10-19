// A vermilion artist's seal reading 山水 ("mountains and water") in a
// simplified seal-script, white characters carved out of red (baiwen),
// with the uneven paste and chipped edges of a real impression.
import { makeRng } from '../engine/rng.js';
import { granulate } from './brush.js';

// glyph strokes in a 100x100 box, squarish Han-seal (miuzhuan) construction
const SHAN = [
  [[50, 4], [50, 92]],
  [[13, 30], [13, 92], [87, 92], [87, 30]],
];
const SHUI = [
  [[50, 4], [50, 96]],
  [[8, 18], [35, 18], [35, 44]],
  [[8, 58], [32, 58], [32, 94]],
  [[92, 18], [65, 18], [65, 44]],
  [[92, 58], [68, 58], [68, 94]],
];
function strokePath(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
}

// Paint the seal with its top-left at (x, y), width w (height = 1.62 w).
export function paintSeal(ctx, x, y, w, { seed = 9, color = [176, 38, 30] } = {}) {
  const r = makeRng(seed);
  const h = w * 1.62;
  const cv = new OffscreenCanvas(Math.ceil(w * 4), Math.ceil(h * 4));
  const g = cv.getContext('2d');
  g.scale(4, 4);
  // red body with slightly irregular edges
  g.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
  g.beginPath();
  const jit = () => (r() - 0.5) * w * 0.012;
  g.moveTo(jit(), jit());
  for (let i = 1; i <= 8; i++) g.lineTo((w * i) / 8 + jit(), jit());
  for (let i = 1; i <= 12; i++) g.lineTo(w + jit(), (h * i) / 12 + jit());
  for (let i = 7; i >= 0; i--) g.lineTo((w * i) / 8 + jit(), h + jit());
  for (let i = 11; i >= 1; i--) g.lineTo(jit(), (h * i) / 12 + jit());
  g.closePath();
  g.fill();
  // carve the characters
  g.globalCompositeOperation = 'destination-out';
  g.lineCap = 'butt'; g.lineJoin = 'round';
  const pad = w * 0.14, cellW = w - pad * 2, gap = w * 0.07, cellH = (h - pad * 2 - gap) / 2;
  const drawGlyph = (strokes, ox, oy) => {
    g.save(); g.translate(ox, oy); g.scale(cellW / 100, cellH / 100);
    g.filter = 'blur(0.35px)';
    g.lineWidth = 12.5;
    for (const st of strokes) strokePath(g, st.map(([px, py]) => [px + (r() - 0.5) * 1.6, py + (r() - 0.5) * 1.6]));
    g.restore();
  };
  drawGlyph(SHAN, pad, pad);
  drawGlyph(SHUI, pad, pad + cellH + gap);
  // chips and uneven paste
  for (let i = 0; i < 14; i++) {
    const ex = r() < 0.5 ? (r() < 0.5 ? 0 : w) : r() * w, ey = ex === 0 || ex === w ? r() * h : (r() < 0.5 ? 0 : h);
    g.beginPath(); g.arc(ex, ey, w * (0.006 + r() * 0.014), 0, Math.PI * 2); g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  g.setTransform(1, 0, 0, 1, 0, 0);
  granulate(g, 0, 0, cv.width, cv.height, { amount: 0.32, cell: 2.2, seed: 31, contrast: 2.6 });
  granulate(g, 0, 0, cv.width, cv.height, { amount: 0.12, cell: 9, seed: 37, contrast: 1.8 });
  ctx.save();
  ctx.globalAlpha = 0.93;
  ctx.drawImage(cv, x, y, w, h);
  ctx.restore();
}

// Film overlay: the seal pressed onto the painting at local t = 0 (a quick press, a settle), then held.
export function makeSealOverlay(api, { x = 1716, y = 846, w = 74, seed = 9 } = {}) {
  const h = w * 1.62;
  const tex = api.bakeCanvas(w + 20, h + 20, (ctx) => paintSeal(ctx, 10, 10, w, { seed }), { scale: 2 });
  const cx = x + w / 2, cy = y + h / 2;
  const layer = api.tex(tex, {
    rect: [x - 10, y - 10, w + 20, h + 20], z: 1e5,
    opacity: (t) => Math.min(1, Math.max(0, t / 0.09)),
    update: (t, L) => {
      // press: 4% larger and lighter as it comes down, settles in ~0.16 s
      const u = Math.min(1, Math.max(0, t / 0.16));
      const s = 1 + 0.04 * (1 - u) * (1 - u);
      const ww = (w + 20) * s, hh = (h + 20) * s;
      L.rect = [cx - ww / 2, cy - hh / 2, ww, hh];
    },
  });
  return { layers: [layer] };
}
