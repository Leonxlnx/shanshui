// s06 temple garden: what seats the temple in the snow (ref 06): snowy pines and shrubs along
// the terrace front, red-leaved shrubs (nandina) with snow on them, and pale conifers behind.
//
// bakeGarden(api, rect, items, { seed }) -> texture source
// items: [{ kind: 'pine', x, y, h, lean, reach, tone } | { kind: 'red', x, y, w }]
import { snowPine } from './snowcliff.js';

function rngOf(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

function blot(g, rng, x, y, rx, ry, rot = 0) {
  const n = 7, ph = rng() * 6.28, cr = Math.cos(rot), sr = Math.sin(rot);
  const px = [], py = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * 6.2832, rr = 1 + (rng() - 0.5) * 0.5 + Math.sin(t * 2 + ph) * 0.1;
    const ex = Math.cos(t) * rx * rr, ey = Math.sin(t) * ry * rr;
    px.push(x + ex * cr - ey * sr); py.push(y + ex * sr + ey * cr);
  }
  g.beginPath(); g.moveTo((px[n - 1] + px[0]) / 2, (py[n - 1] + py[0]) / 2);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; g.quadraticCurveTo(px[i], py[i], (px[i] + px[j]) / 2, (py[i] + py[j]) / 2); }
  g.fill();
}

// red-leaved shrub: dark twigs fanning up from the base, clusters of red leaves and berries,
// snow resting on the upper clusters
function redShrub(g, rng, x, y, w) {
  const h = w * 0.7;
  g.strokeStyle = 'rgba(30,24,22,0.9)'; g.lineCap = 'round';
  const tips = [];
  const nt = 7 + ((rng() * 5) | 0);
  for (let i = 0; i < nt; i++) {
    const a = -Math.PI / 2 + (rng() - 0.5) * 2.2, L = h * (0.5 + rng() * 0.6);
    const ex = x + Math.cos(a) * L * (w / h) * 0.6, ey = y + Math.sin(a) * L;
    g.lineWidth = 0.6 + rng() * 0.9;
    g.beginPath(); g.moveTo(x + (rng() - 0.5) * 4, y); g.quadraticCurveTo((x + ex) / 2 + (rng() - 0.5) * 6, (y + ey) / 2, ex, ey); g.stroke();
    tips.push([ex, ey]);
  }
  const reds = ['rgba(176,32,30,0.92)', 'rgba(198,52,40,0.9)', 'rgba(150,24,26,0.92)', 'rgba(212,74,52,0.85)'];
  for (const [tx, ty] of tips) {
    const n = 5 + ((rng() * 8) | 0);
    for (let j = 0; j < n; j++) {
      g.fillStyle = reds[(rng() * reds.length) | 0];
      const r = 0.9 + rng() * 1.8;
      blot(g, rng, tx + (rng() - 0.5) * w * 0.22, ty + (rng() - 0.3) * h * 0.22, r * (1 + rng() * 0.6), r * 0.8, rng() * 3);
    }
    // a few dark leaf dots among the red
    g.fillStyle = 'rgba(40,26,24,0.8)';
    for (let j = 0; j < 2; j++) blot(g, rng, tx + (rng() - 0.5) * w * 0.2, ty + (rng() - 0.5) * h * 0.2, 0.8 + rng(), 0.6 + rng() * 0.6);
  }
  // snow on the upper clusters
  g.fillStyle = 'rgba(247,246,244,0.95)';
  for (const [tx, ty] of tips) if (rng() < 0.6) blot(g, rng, tx + (rng() - 0.5) * 4, ty - 2.5 - rng() * 2, 2.5 + rng() * w * 0.08, 1.2 + rng() * 1.5, (rng() - 0.5) * 0.3);
  // a snow mound at the foot
  g.fillStyle = 'rgba(246,245,242,1)';
  blot(g, rng, x, y + 2, w * 0.45, 4 + rng() * 2);
}

export function bakeGarden(api, rect, items, { seed = 1 } = {}) {
  const rng = rngOf(seed);
  return api.bakeCanvas(rect[2], rect[3], (ctx) => {
    ctx.translate(-rect[0], -rect[1]);
    for (const it of items) {
      if (it.kind === 'red') redShrub(ctx, rng, it.x, it.y, it.w);
      else snowPine(ctx, rng, it.x, it.y, it.h, { lean: it.lean ?? 0, reach: it.reach ?? 0, tone: it.tone ?? 0.03 });
    }
  });
}
