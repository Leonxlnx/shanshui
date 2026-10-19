// Red sun (ref 05): flat vermilion disc with brush texture, thin pale strands
// crossing it and a pink haze band along the horizon.
import { makeSky, makeSkyStreaks, makeSun } from '../lib/atmos.js';

export default {
  id: 'lab-atmos-05', title: 'atmos red sun', ref: '05',
  build(api) {
    return {
      layers: [
        makeSky(api, { variant: 'rice', sun: [1742, 369], glowColor: [236, 214, 198], glowAmount: 0.7, glowSize: [520, 170] }),
        makeSun(api, { style: 'red', x: 1742, y: 369, r: 39 }),
        makeSkyStreaks(api, { style: 'thin', z: 50, seed: 4, region: [1700, 380, 520, 60], sun: [1742, 375, 230, 40], floor: [374, 8, 0.97] }),
      ],
      grade: { vignette: 0 },   // refs have no vignette: calibrate without it
    };
  },
};
