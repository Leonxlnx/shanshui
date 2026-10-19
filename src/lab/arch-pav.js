// Lab: the other hero pavilions, each at its reference position. Only the pavilion of the
// reference passed with --ref is painted (02/03/04/05; default 03).
import { paintPavilion, paintHall, bakeArch } from '../lib/architecture.js';
import { pillar, paperShader } from './arch-ph.js';

export const PAVS = {
  '03': { x: 320, y: 466, w: 174, seed: 31, colH: 0.6 },
  '04': { x: 1662, y: 386, w: 141, seed: 41, variant: 'peak', baseH: 0.3, colH: 0.78 },
  '05': { x: 1348, y: 546, w: 119, seed: 51, colH: 0.58, roofTone: 0.5 },
  '02': { x: 1692, y: 394, w: 75, seed: 21, fade: 0.3, paper: [250, 233, 203], turn: -0.5, colH: 0.62 },
};
const PAPER = { '02': [250, 233, 203], '03': [237, 228, 215], '04': [239, 231, 220], '05': [239, 231, 220] };

export default {
  id: 'lab-arch-pav', title: 'arch: pavilions of refs 02-05', ref: '03',
  build(api, opts = {}) {
    const id = opts.ref && PAVS[opts.ref] ? opts.ref : '03';
    const p = PAVS[id];
    const paper = api.shader(paperShader(PAPER[id]), { z: 1e5 });
    const rocks = api.bakeCanvas(1920, 1080, (ctx) => {
      const r = api.rng(2);
      pillar(ctx, r, p.x, p.y + 4, p.w * 1.8, 300, 0.25 + (p.fade || 0), { paper: PAPER[id] });
    });
    const rect = [p.x - p.w, p.y - p.w * 1.1, p.w * 2, p.w * 1.3];
    const t0 = performance.now();
    const b = bakeArch(api, rect, (ctx) => {
      if (id === '05') paintHall(ctx, { x: 1290, y: 546, w: 46, tiers: 1, turn: -0.9, aspect: 1.8, bays: [3, 1], steps: false, gable: false, seed: 52, railing: true, walls: 'open', colH: 0.55 });
      paintPavilion(ctx, p);
    });
    console.log('pavilion bake ms', Math.round(performance.now() - t0));
    return { layers: [paper, api.tex(rocks, { rect: [0, 0, 1920, 1080] }), api.tex(b, { rect })] };
  },
};
