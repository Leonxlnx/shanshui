// A gust of red maple leaves that sweeps across the frame, left to right,
// carrying the wind transition between the cascade and the autumn ruins.
// Film overlay: local t = 0 when the overlay starts.
import { makeLeafAtlas, drawLeafSprite } from './fauna/leaves.js';
import { makeRng } from '../engine/rng.js';

export function makeLeafGust(api, { count = 115, dur = 2.6, seed = 21, speed = [1150, 2300], fromT = 0.0, spread = 1.15 } = {}) {
  const atlas = makeLeafAtlas(api, { seed: 11 });
  const r = makeRng('gust:' + seed);
  const leaves = [];
  for (let i = 0; i < count; i++) {
    const d = Math.pow(r(), 1.7);                 // depth 0 far .. 1 near
    leaves.push({
      d,
      t0: fromT + r() * spread * (0.6 + 0.4 * (1 - d)),
      x0: -120 - r() * 260 - d * 200,
      y0: -80 + r() * 1150,
      vx: speed[0] + (speed[1] - speed[0]) * (0.25 + 0.75 * d) * (0.8 + 0.4 * r()),
      vy: 60 + 220 * r(),
      lift: (r() - 0.5) * 260,
      size: 8 + 44 * d * d + r() * 5,
      w: 2 + r() * 4, ph: r() * 6.283,
      spin: (r() < 0.5 ? -1 : 1) * (2 + r() * 5),
      rot0: r() * 6.283,
      variant: Math.floor(r() * 6),
    });
  }
  leaves.sort((a, b) => a.d - b.d);
  const layer = api.canvas((ctx, t) => {
    for (const L of leaves) {
      const a = t - L.t0;
      if (a < 0) continue;
      // decelerating sweep: fast entry, easing as the gust passes, gravity taking over
      const ease = 1 - Math.exp(-a * 1.6);
      const x = L.x0 + (L.vx / 1.6) * ease + 40 * a;
      const y = L.y0 + L.vy * a + L.lift * Math.sin(Math.min(1, a * 1.2) * Math.PI) * 0.5 + 10 * Math.sin(L.w * a + L.ph);
      if (x > 2050 || y > 1200) continue;
      const alpha = Math.min(1, a / 0.12) * (1 - Math.min(1, Math.max(0, (t - dur + 0.5) / 0.5)));
      if (alpha <= 0.01) continue;
      drawLeafSprite(ctx, atlas, x, y, L.size, {
        variant: L.variant, rot: L.rot0 + L.spin * a, flip: Math.cos(L.ph + L.spin * a * 0.7),
        tilt: 0.7 + 0.3 * Math.abs(Math.cos(L.ph * 1.3 + a * 2)), blur: L.d > 0.7 ? 7 * (L.d - 0.7) / 0.3 : 0, alpha: alpha * (0.75 + 0.25 * L.d),
      });
    }
  }, { rect: [-200, -150, 2320, 1380], z: 1e5, name: 'leaf-gust' });
  return { layers: [layer] };
}
