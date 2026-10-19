// s10: falling maple leaves that pass through the ref-10 leaf positions at t = t0.
// Each leaf drifts right and down on its own wind-carried path (flutter, tumble, gusts), recycling
// with its own period; a pure function of t. Sprites come from the library leaf atlas.
// Large near leaves (size > 26) drift in from off-frame left / above, so they never pop in mid-frame.
import { makeLeafAtlas, drawLeafSprite } from '../../lib/fauna.js';
import { makeRng, clamp, mix } from '../../engine/rng.js';

const TAU = Math.PI * 2;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// list: [x, y, size(radius px), blur px] at time t0
// xEnd / yEnd: where a leaf recycles (keep beyond the frame + camera overscan)
export function makeRefLeaves(api, { list, t0 = 3, z = 1, rect = [-200, 200, 2300, 1000], seed = 10, res = 1, name = 'leaves', xEnd = 2450, yEnd = 1180 } = {}) {
  const atlas = makeLeafAtlas(api, {});
  const G = 0.35, GW = 0.45;   // gust strength, gust angular frequency
  // 5th field 'top': the leaf blows in from above the frame (trees out of shot) instead of the maple
  const L = list.slice().sort((p, q) => p[2] - q[2]).map(([x, y, size, blur, src], i) => {
    const r = makeRng('s10leaf:' + seed + ':' + i);
    const d = clamp((size - 6) / 36, 0, 1);              // 0 far .. 1 near
    const big = clamp((size - 40) / 60, 0, 1);           // extra speed for the huge near leaves
    const vx = mix(46, 92, d) * (1 + 0.5 * big) * r.range(0.85, 1.15);
    const vy = mix(30, 70, d) * (1 + 0.3 * big) * r.range(0.85, 1.15);
    const w = TAU * r.range(0.25, 0.5) * (1 - 0.35 * big), ph = r() * TAU, amp = size * r.range(0.8, 1.8) * (1 - 0.5 * big) + 6;
    const near = size > 26;
    const sxT = near ? r.range(-140, -60) - size * 1.2 : r.range(90, 330);
    const age = src === 'top' ? clamp((y + 30 + size * 2) / vy, 0.6, 40) : clamp((x - sxT) / vx, 0.6, near ? 40 : 10);
    const X = (a, t) => vx * a + vx * G * (Math.cos(GW * (t - a)) - Math.cos(GW * t)) / GW + amp * (Math.sin(w * a + ph) - Math.sin(ph));
    const Y = (a) => vy * a - 0.16 * vy / w * (Math.sin(2 * (w * a + ph)) - Math.sin(2 * ph));
    const sx = x - X(age, t0), sy = y - Y(age);
    const rest = Math.min((yEnd + size - y) / vy, (xEnd + size - x) / vx) + 0.5;
    const T = age + Math.max(1.5, rest);
    return {
      size, blur, sx, sy, X, Y, age, T, near, w, ph,
      rot0: r() * TAU, spin: (r() < 0.5 ? -1 : 1) * r.range(0.8, 2.4) * (1 - 0.4 * big), fl0: r() * TAU, tl0: r() * TAU,
      variant: r.int(0, 5),
    };
  });
  const at = (l, t) => {
    let a = (t - t0 + l.age) % l.T; if (a < 0) a += l.T;
    const x = l.sx + l.X(a, t), y = l.sy + l.Y(a);
    const rock = 0.5 * Math.cos(l.w * a + l.ph);
    const alpha = sstep(0, l.near ? 0.4 : 0.7, a) * (1 - sstep(l.T - 0.8, l.T, a));
    return {
      x, y, size: l.size, alpha, blur: l.blur, variant: l.variant,
      rot: l.rot0 + rock + 0.25 * a, flip: Math.cos(l.fl0 + l.spin * a), tilt: 0.72 + 0.28 * Math.abs(Math.cos(l.tl0 + 0.7 * l.spin * a)),
    };
  };
  const layer = api.canvas((ctx, t) => {
    for (const l of L) {
      const s = at(l, t);
      if (s.alpha < 0.003) continue;
      drawLeafSprite(ctx, atlas, s.x, s.y, s.size, s);
    }
  }, { z, rect, name, res });
  layer.leavesAt = (t) => L.map((l) => at(l, t));
  return layer;
}
