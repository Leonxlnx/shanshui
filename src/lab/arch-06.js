// Lab: snow temple of ref 06 (main hall + side hall + steps) and the second snowy pavilion.
import { paintTemple, paintPavilion, paintHall, bakeArch } from '../lib/architecture.js';
import { pillar, paperShader } from './arch-ph.js';
import { PAPER_COOL } from '../lib/brush.js';

export default {
  id: 'lab-arch-06', title: 'arch: snow temple (ref 06)', ref: '06',
  build(api) {
    const paper = api.shader(paperShader([240, 234, 226]), { z: 1e5 });
    const cliff = api.bakeCanvas(1000, 500, (ctx) => {
      const r = api.rng(3);
      pillar(ctx, r, 330, 120, 420, 380, 0.25, { paper: PAPER_COOL });
      pillar(ctx, r, 760, 100, 230, 400, 0.3, { paper: PAPER_COOL });
    });
    const rect = [140, 200, 760, 200];
    const t0 = performance.now();
    const b = bakeArch(api, rect, (ctx) => {
      paintTemple(ctx, { x: 322, y: 366, w: 207, snow: true, seed: 6, paper: PAPER_COOL, sides: [{ dx: -0.42, dy: -0.02, w: 0.42, turn: 0.5 }] });
      paintHall(ctx, { x: 690, y: 355, w: 80, snow: true, turn: 0.5, tiers: 1, steps: false, gable: false, seed: 61, paper: PAPER_COOL, fade: 0.08, aspect: 2.2, bays: [3, 1] });
      paintHall(ctx, { x: 781, y: 343, w: 95, snow: true, tiers: 2, aspect: 1.35, turn: 0.3, bays: [3, 2], seed: 62, paper: PAPER_COOL, steps: false, gable: false, colH: 0.55, roofH: 0.42, roof2H: 0.6, ridge: 0.35, upper: 0.74, upperB: 0.7 });
    });
    console.log('snow temple bake ms', Math.round(performance.now() - t0));
    return { layers: [paper, api.tex(cliff, { rect: [0, 250, 1000, 500] }), api.tex(b, { rect })] };
  },
};
