// Golden-hour sky (ref 02 top): warm paper, pale sun low over the ridges with a
// wide gold glow, ochre cloud bands across the top right.
import { makeSky, makeCloudStrands, makeSun } from '../lib/atmos.js';

export default {
  id: 'lab-atmos-02', title: 'atmos golden sky', ref: '02',
  build(api) {
    return {
      layers: [
        makeSky(api, { variant: 'golden', sun: [1349, 339] }),
        makeSun(api, { style: 'golden', x: 1349, y: 339, r: 54 }),
        makeCloudStrands(api, { mode: 'wash', band: [60, 280, 40], region: [1500, 160, 700, 200], rowHeight: 36, cellWidth: 190, thickness: 0.6, length: 1.3,
          density: 0.9, alpha: 0.75, rim: 0.3, lumps: 0, blend: 'multiply', washColor: [246, 222, 188], tintColor: [250, 222, 175], sun: [1349, 300, 380, 160], z: 50, seed: 3, drift: 5 }),
      ],
      grade: { vignette: 0 },   // refs have no vignette: calibrate without it
    };
  },
};
