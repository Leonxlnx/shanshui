// Lab: snow-laden pine of ref 06 (top-left) at its exact place, on the cool snow paper.
import { makePine } from '../lib/pine.js';
import { PAPER_COOL } from '../lib/brush.js';

export default {
  id: 'lab-pine-06', title: 'pine ref 06 snow', ref: '06',
  build(api) {
    const paper = api.shader(`vec4 shade(vec2 p, vec2 uv){
      vec3 c = vec3(240.,234.,226.)/255.;
      c *= 1.0 + 0.012 * fbm(p * 0.003, 3);
      return vec4(c, 1.); }`, { z: 1e5 });
    const pine = makePine(api, {
      seed: 6, height: 420, gnarl: 0.65, snow: 0.95, paper: PAPER_COOL,
      spine: [[0, 520], [40, 430], [92, 320], [122, 240], [136, 170], [142, 110], [150, 40]],
      trunkWidth: 64, taper: 0.35, flare: 0.1,
      limbs: [
        { pts: [[140, 150], [205, 150], [261, 162], [324, 186], [398, 205], [473, 224], [518, 238]], w: 26, subs: 4 },
        { pts: [[146, 86], [205, 66], [261, 68], [320, 84], [360, 100]], w: 16, subs: 2 },
        { pts: [[132, 104], [62, 98], [10, 108], [-30, 112]], w: 16, subs: 2 },
        { pts: [[104, 290], [60, 250], [10, 232], [-30, 228]], w: 20, subs: 2 },
        { pts: [[128, 210], [80, 186], [30, 176], [-20, 176]], w: 14, subs: 1 },
        { pts: [[150, 46], [110, 24], [60, 14], [20, 16]], w: 12, subs: 1 },
        { pts: [[152, 44], [200, 20], [250, 12]], w: 10, subs: 1 },
        { pts: [[300, 180], [330, 230], [372, 268], [420, 292]], w: 8, subs: 1 },
      ],
      padSize: 150, needle: 17, padDensity: 3, haze: 0.2, needles: 11, fanSpacing: 0.9,
    });
    return { layers: [paper, pine.layer({ z: 1 })] };
  },
};
