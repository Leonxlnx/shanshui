// Lab: reproduce the top-right pine of ref 04 (leaning left over the gorge) at its exact place.
import { makePine, paintConifer } from '../lib/pine.js';
import { inkify } from '../lib/inkfx.js';

export default {
  id: 'lab-pine-04', title: 'pine ref 04', ref: '04',
  build(api) {
    const paper = api.shader(`vec4 shade(vec2 p, vec2 uv){
      vec3 c = vec3(239.,231.,220.)/255.;
      c *= 1.0 + 0.012 * fbm(p * 0.003, 3);
      return vec4(c, 1.); }`, { z: 1e5 });
    // tiered conifers standing behind the trunk on the right
    const back = api.bakeCanvas(420, 420, (ctx) => {
      ctx.translate(-1500, 0);
      paintConifer(ctx, 1900, 400, 290, { kind: 'fir', tone: 0.42, seed: 3, width: 0.9 });
      paintConifer(ctx, 1830, 395, 250, { kind: 'fir', tone: 0.22, seed: 8, width: 0.95 });
    });
    const backInk = inkify(api, back, { edge: 0.3, granulation: 0.15, bleed: 1.2 });
    const pine = makePine(api, {
      seed: 4, height: 360, gnarl: 0.7,
      spine: [[1885, 410], [1866, 320], [1843, 250], [1815, 186], [1790, 140], [1768, 100], [1748, 62]],
      trunkWidth: 56, taper: 0.4, flare: 0.1,
      limbs: [
        { pts: [[1800, 162], [1758, 150], [1708, 145], [1659, 156], [1609, 163], [1565, 170], [1522, 182], [1484, 194], [1435, 213], [1390, 232]], w: 32, subs: 4 },
        { pts: [[1572, 172], [1532, 192], [1500, 212], [1470, 233], [1442, 252]], w: 10, subs: 1 },
        { pts: [[1752, 72], [1712, 52], [1662, 46], [1627, 52], [1590, 72]], w: 18, subs: 2 },
        { pts: [[1754, 72], [1792, 54], [1830, 50], [1864, 58]], w: 12, subs: 1 },
      ],
      padSize: 118, needle: 15, padDensity: 2.2, haze: 0.15,
    });
    return { layers: [paper, api.tex(backInk, { rect: [1500, 0, 420, 420] }), pine.layer({ z: 1 })] };
  },
};
