// Lab: rope bridges of ref 04 between placeholder pillar peaks.
import { paintRopeBridge, bakeArch } from '../lib/architecture.js';
import { pillar, paperShader } from './arch-ph.js';

export const ROPES04 = [
  { a: [1100, 490], b: [1421, 459], sag: 38, hand: 15, figure: 0.035, seed: 41 },
  { a: [913, 336], b: [1011, 349], sag: 10, hand: 9, seed: 42, fade: 0.25 },
  { a: [790, 762], b: [910, 826], sag: 16, hand: 15, seed: 43 },
];

export default {
  id: 'lab-arch-04', title: 'arch: rope bridges (ref 04)', ref: '04',
  build(api) {
    const paper = api.shader(paperShader([239, 231, 220]), { z: 1e5 });
    const peaks = api.bakeCanvas(1200, 900, (ctx) => {
      const r = api.rng(4);
      pillar(ctx, r, 300, 140, 180, 700, 0.42);   // central peak (x ~ 900..1100 in design)
      pillar(ctx, r, 660, 120, 220, 760, 0.32);   // right cliff
      pillar(ctx, r, 160, 420, 160, 400, 0.45);
      pillar(ctx, r, 330, 560, 130, 300, 0.4);
    });
    const rect = [760, 290, 700, 560];
    const t0 = performance.now();
    const b = bakeArch(api, rect, (ctx) => { for (const o of ROPES04) paintRopeBridge(ctx, o); }, { blur: 0.2 });
    console.log('rope bake ms', Math.round(performance.now() - t0));
    return { layers: [paper, api.tex(peaks, { rect: [760, 330, 1200, 900] }), api.tex(b, { rect })] };
  },
};
