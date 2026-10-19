// Lab: the red gate / shrine on the right cliff of ref 07.
import { makeArch } from '../lib/architecture.js';
import { pillar, paperShader } from './arch-ph.js';

export default {
  id: 'lab-arch-07', title: 'arch: gate (ref 07)', ref: '07',
  build(api) {
    const paper = api.shader(paperShader([238, 231, 220]), { z: 1e5 });
    const cliff = api.bakeCanvas(700, 700, (ctx) => {
      const r = api.rng(7);
      pillar(ctx, r, 330, 70, 520, 600, 0.3);
    });
    const t0 = performance.now();
    const g = makeArch(api, 'gate', { x: 1611, y: 437, w: 136, seed: 7 });
    console.log('gate bake ms', Math.round(performance.now() - t0));
    return { layers: [paper, api.tex(cliff, { rect: [1280, 370, 700, 700] }), api.tex(g.src, { rect: g.rect })] };
  },
};
