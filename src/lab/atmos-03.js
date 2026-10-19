// Night sky (ref 03 top): grey washed sky, dark soft cloud masses, torn light
// strands, full moon with faint maria veiled by passing strands.
import { makeSky, makeCloudWash, makeCloudStrands, makeMoon } from '../lib/atmos.js';

export default {
  id: 'lab-atmos-03', title: 'atmos night sky', ref: '03',
  build(api) {
    return {
      layers: [
        makeSky(api, { variant: 'night' }),
        makeCloudWash(api, { regions: [[1320, 120, 400, 200, 1.0], [1720, 100, 330, 160, 0.5], [1150, 230, 220, 60, 0.3]], z: 80, seed: 3 }),
        makeMoon(api, { x: 1339, y: 200, r: 79 }),
        makeCloudStrands(api, { band: [130, 320, 30], z: 60, seed: 2, density: 0.95, region: [1330, 230, 520, 140] }),
      ],
      grade: { vignette: 0 },   // refs have no vignette: calibrate without it
    };
  },
};
