// Lab: the small red maples of ref 01, in place (cliff top by the pavilion, lower-left cliff).
import { makeMaple } from '../lib/flora.js';

const PAPER01 = [239, 231, 220];

export default {
  id: 'lab-flora-maple01', title: 'flora: maples ref 01', ref: '01',
  build(api) {
    const paper = api.shader(`vec4 shade(vec2 p, vec2 uv){ return vec4(vec3(${PAPER01.map((v) => (v / 255).toFixed(4)).join(',')}), 1.); }`, { z: 1e5 });
    const top = makeMaple(api, {
      seed: 101, paper: PAPER01,
      trees: [
        { x: 396, y: 476, height: 70, width: 95, lean: 4, shape: 'round', crown: [408, 452, 46, 32], leafSize: 3.0, density: 1.5, pale: 0.4, depth: 5 },
      ],
    });
    const low = makeMaple(api, {
      seed: 102, paper: PAPER01,
      trees: [
        { x: 112, y: 716, height: 100, width: 120, lean: 6, shape: 'round', crown: [138, 662, 58, 42], leafSize: 3.8, density: 1.5, depth: 5, pale: 0.3, debug: 1 },
        { x: 18, y: 664, height: 80, width: 70, lean: -5, shape: 'round', crown: [24, 612, 34, 30], leafSize: 3.6, density: 1.5, pale: 0.35, depth: 5 },
      ],
    });
    return {
      layers: [paper, top.layer({ amp: 1.5 }), low.layer({ amp: 2 })],
      meta: { clear: PAPER01.map((v) => v / 255) },
    };
  },
};
