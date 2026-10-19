// Lab: the maple-laden cliff edges of ref 08 (left cliff), in place.
import { makeMaple } from '../lib/flora.js';

const PAPER08 = [238, 230, 218];

export default {
  id: 'lab-flora-08', title: 'flora: maple cliff edges ref 08', ref: '08',
  build(api) {
    const paper = api.shader(`vec4 shade(vec2 p, vec2 uv){ return vec4(vec3(${PAPER08.map((v) => (v / 255).toFixed(4)).join(',')}), 1.); }`, { z: 1e5 });
    const maples = makeMaple(api, {
      seed: 8, paper: PAPER08, rect: [-40, 120, 700, 860],
      trees: [
        // top-left cluster on the upper cliff
        { x: 70, y: 300, height: 110, width: 150, lean: 10, shape: 'round', crown: [62, 238, 72, 45], leafSize: 4.5, density: 1.3 },
        // under the centre pine on the ledge
        { x: 300, y: 372, height: 70, width: 150, lean: 20, shape: 'spread', crown: [318, 338, 70, 28], leafSize: 4.2, density: 1.3 },
        // right ledge maple with long thin branches
        { x: 470, y: 425, height: 90, width: 210, lean: 15, shape: 'spread', crown: [478, 378, 100, 38], leafSize: 4.2, density: 1.1 },
        // big lower-left maple: branches sweep right and down along the cliff
        { x: 40, y: 640, height: 200, width: 420, lean: 50, shape: 'cascade', dir: 1, crown: [230, 625, 200, 80], leafSize: 5, density: 1.25, trunk: 12,
          limbs: [[-60, 90, 0.7], [-10, 130, 0.6], [25, 150, 0.5], [-100, 60, 0.4]], trunkLen: 40, depth: 5 },
        // bottom ledge bush
        { x: 430, y: 930, height: 150, width: 140, lean: -5, shape: 'round', crown: [430, 840, 70, 75], leafSize: 4.5, density: 1.2 },
      ],
    });
    return {
      layers: [paper, maples.layer({ amp: 2 })],
      meta: { clear: PAPER08.map((v) => v / 255) },
    };
  },
};
