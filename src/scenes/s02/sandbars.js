// s02 helper: pale sandbars and spits on the gold river (ref 02). Each bar is a flat lens of pale
// sand (lighter than the water) whose water-side edge carries a thin, broken dark shore line, with
// a faint shadow line under it and a few short horizontal ripple lines nearby. Bars sit under the
// wooded land tongues (their tips run out past the trees) or lie free in the water.
//
// makeSandbars(api, { rect, bars: [{ a: [x, y], b: [x, y], t, bulge }], sand, ink, seed, z }) -> layer
//   a / b: left / right ends of the shore line (design px); t: thickness above the shore line;
//   bulge: 0..1 where along a->b the bar is thickest (0.5)
import { stroke, rgba } from '../../lib/brush.js';
import { inkify } from '../../lib/inkfx.js';

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function makeSandbars(api, o) {
  const rect = o.rect;
  const sand = o.sand || [251, 238, 210];
  const ink = o.ink || [96, 80, 60];
  const src = api.bakeCanvas(rect[2], rect[3], (ctx) => {
    ctx.translate(-rect[0], -rect[1]);
    const r = api.rng(o.seed ?? 5), nz = api.noise((o.seed ?? 5) + 1);
    for (const bar of o.bars) {
      const [ax, ay] = bar.a, [bx, by] = bar.b;
      const len = Math.hypot(bx - ax, by - ay);
      const n = Math.max(8, Math.round(len / 5));
      const bu = bar.bulge ?? 0.5;
      const ph = r() * 100;
      const shore = [], upper = [];
      for (let i = 0; i <= n; i++) {
        const s = i / n;
        const x = ax + (bx - ax) * s, y0 = ay + (by - ay) * s;
        // lens profile, thickest at `bu`, with a slow wobble so the bar has bays and points
        const u = s < bu ? s / bu : (1 - s) / (1 - bu);
        const th = bar.t * Math.pow(Math.max(0, u), 0.7) * (0.35 + 1.0 * (0.5 + 0.5 * nz.n2(ph + s * 6, 2.1)));
        const y = y0 + nz.n2(ph + x / 60, 7.3) * bar.t * 0.25;
        shore.push([x, y]);
        upper.push([x, y - th]);
      }
      // the sand flat (pale, slightly translucent at the tips)
      ctx.beginPath();
      ctx.moveTo(shore[0][0], shore[0][1]);
      for (const p of upper) ctx.lineTo(p[0], p[1]);
      for (let i = shore.length - 1; i >= 0; i--) ctx.lineTo(shore[i][0], shore[i][1]);
      ctx.closePath();
      const ym = Math.min(ay, by), g = ctx.createLinearGradient(0, ym - bar.t * 1.2, 0, Math.max(ay, by));
      g.addColorStop(0, rgba(sand, 0.15)); g.addColorStop(0.6, rgba(sand, 0.6)); g.addColorStop(1, rgba(sand, 0.85));
      ctx.fillStyle = g; ctx.fill();
      // the shore line: thin, dark, broken, thicker where the bar is thick
      let seg = [];
      const flush = () => { if (seg.length > 2) stroke(ctx, seg, { width: [1.5 + r() * 0.8, 0.5], profile: 'brush', color: rgba(ink, 0.55 + 0.25 * r()), rng: r, rough: 0.5 }); seg = []; };
      for (let i = 0; i < shore.length; i++) {
        const s = i / n;
        const on = nz.n2(ph + s * len / 45, 9.9) + 0.2 - 0.6 * (1 - ss(0, 0.12, Math.min(s, 1 - s)));
        if (on < 0) { flush(); continue; }
        seg.push([shore[i][0], shore[i][1] + 0.5]);
      }
      flush();
      // a soft shadow line just under the shore, and short ripple lines off the bar
      stroke(ctx, shore.filter((_, i) => i % 2 === 0).map((p) => [p[0], p[1] + 4]), { width: 3, profile: 'brush', color: rgba(ink, 0.035), rng: r, rough: 0.3 });
      const nr = Math.round(len / 60);
      for (let k = 0; k < nr; k++) {
        const s = r.range(0.1, 0.9), x = ax + (bx - ax) * s + r.range(-20, 20), y = ay + (by - ay) * s + r.range(5, 18);
        const l = r.range(12, 40);
        stroke(ctx, [[x, y], [x + l * 0.5, y + r.range(-0.5, 0.5)], [x + l, y]], { width: [0.9, 0.3], profile: 'brush', color: rgba(ink, r.range(0.1, 0.22)), rng: r, rough: 0.3 });
      }
    }
  });
  const tex = inkify(api, src, { edge: 0.25, granulation: 0.12, bleed: 0.6 });
  return api.tex(tex, { rect, z: o.z ?? 2.5, name: 'sandbars' });
}
