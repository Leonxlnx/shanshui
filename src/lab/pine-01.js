// Lab: reproduce the hero pine of ref 01 at its exact place.
import { makePine } from '../lib/pine.js';

export default {
  id: 'lab-pine-01', title: 'pine ref 01', ref: '01',
  build(api) {
    const paper = api.shader(`vec4 shade(vec2 p, vec2 uv){
      vec3 c = vec3(239.,231.,220.)/255.;
      c *= 1.0 + 0.012 * fbm(p * 0.003, 3);
      return vec4(c, 1.); }`, { z: 1e5 });
    const pine = makePine(api, {
      seed: 11, height: 640, gnarl: 0.7,
      spine: [[20, 660], [70, 540], [120, 430], [165, 345], [192, 292]],
      trunkWidth: 120, taper: 0.45, flare: 0.1,
      limbs: [
        { pts: [[190, 296], [262, 260], [345, 236], [420, 228], [485, 240], [560, 256], [640, 262], [740, 268], [852, 268]], w: 52, subs: 3 },
        { pts: [[196, 296], [226, 228], [262, 178], [305, 152], [360, 140], [420, 130], [458, 134]], w: 40, subs: 3 },
        { pts: [[132, 380], [108, 260], [102, 170], [114, 122], [160, 98], [232, 82], [310, 64], [400, 52], [472, 54]], w: 50, subs: 2 },
        { pts: [[110, 150], [72, 96], [30, 62], [-10, 50]], w: 18, subs: 1 },
      ],
      padSize: 165, needle: 18, padDensity: 2.6, haze: 0.1,
    });
    return { layers: [paper, pine.layer({ z: 1 })] };
  },
};
