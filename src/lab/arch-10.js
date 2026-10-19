// Lab: ruined watchtowers of ref 10 (main tower + two small far ones) on placeholder peaks.
import { paintTower, bakeArch } from '../lib/architecture.js';
import { pillar, paperShader } from './arch-ph.js';

export default {
  id: 'lab-arch-10', title: 'arch: ruined towers (ref 10)', ref: '10',
  build(api) {
    const paper = api.shader(paperShader([239, 231, 220]), { z: 1e5 });
    const peaks = api.bakeCanvas(900, 500, (ctx) => {
      const r = api.rng(10);
      pillar(ctx, r, 650, 150, 260, 340, 0.35);   // main peak under the big tower (x 1150..)
      pillar(ctx, r, 260, 190, 220, 260, 0.55);   // left far peak
      pillar(ctx, r, 480, 220, 120, 200, 0.7);
    });
    const t0 = performance.now();
    const farRect = [700, 120, 480, 130];
    const far = bakeArch(api, farRect, (ctx) => {
      paintTower(ctx, { x: 1130, y: 236, w: 26, h: 52, fade: 0.6, seed: 12, windows: 2, annex: false, overgrow: 0.35 });
      paintTower(ctx, { x: 772, y: 214, w: 30, h: 64, fade: 0.38, seed: 11, windows: 2, overgrow: 0.5 });
    }, { blur: 0.8 });
    const rect = [1180, 20, 260, 200];
    const b = bakeArch(api, rect, (ctx) => paintTower(ctx, { x: 1298, y: 175, w: 58, h: 127, seed: 10 }));
    console.log('tower bake ms', Math.round(performance.now() - t0));
    return { layers: [paper, api.tex(peaks, { rect: [500, 0, 900, 500] }), api.tex(far, { rect: farRect }), api.tex(b, { rect })] };
  },
};
