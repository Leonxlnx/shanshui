// Lab: the big red maple of ref 10 (left, 0-350 x 480-830), in place.
import { makeMaple } from '../lib/flora.js';

const PAPER10 = [238, 230, 218];

export default {
  id: 'lab-flora-10', title: 'flora: maple tree ref 10', ref: '10',
  build(api) {
    const paper = api.shader(`vec4 shade(vec2 p, vec2 uv){ return vec4(vec3(${PAPER10.map((v) => (v / 255).toFixed(4)).join(',')}), 1.); }`, { z: 1e5 });
    const maple = makeMaple(api, {
      seed: 10, paper: PAPER10,
      trees: [{ x: 150, y: 870, height: 380, width: 400, lean: -12, shape: 'spread', crown: [160, 600, 220, 150], palette: 'autumn', density: 1.6, leafSize: 8, trunk: 44, gnarl: 0.9, dry: 0.7, trunkLen: 110, depth: 5, limbs: [[-112, 95, 0.6], [-58, 105, 0.55], [-14, 120, 0.45], [-155, 60, 0.4]] }],
    });
    return {
      layers: [paper, maple.layer({ amp: 3 })],
      meta: { clear: PAPER10.map((v) => v / 255) },
    };
  },
};
