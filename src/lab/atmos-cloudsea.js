// Sea of clouds (compare ref 06 right side and ref 09 lower area).
import { makeSky, makeCloudSea } from '../lib/atmos.js';

export default {
  id: 'lab-atmos-cloudsea', title: 'atmos cloud sea', ref: '06',
  build(api) {
    return {
      layers: [
        makeSky(api, { variant: 'snow' }),
        makeCloudSea(api, { yBack: 330, yFront: 640, rows: 9, lobe: 70, z: 6, seed: 1, drift: 3, farFade: 0.85 }),
        makeCloudSea(api, { yBack: 640, yFront: 1100, rows: 8, lobe: 150, z: 2.5, seed: 2, drift: 6, detail: 1.3, undulate: 1.4, farFade: 0.5 }),
      ],
      grade: { vignette: 0 },   // refs have no vignette: calibrate without it
    };
  },
};
