// Water lab: plain day lake of ref 01 (y 790-1080) with placeholder islands and reflections.
import { makeLake, makeGlitter, makeReflection } from '../lib/water.js';
import { paperLayer, paintPeaks, paintIsland, bakeInked, mistLayer } from './water-props.js';

export default {
  id: 'lab-water-01', title: 'water: plain lake', ref: '01',
  build(api) {
    const r = api.rng(1);
    const PAPER = [239, 231, 220];
    const Y = 792;
    const layers = [paperLayer(api, PAPER)];
    const far = bakeInked(api, 1920, 900, (ctx) => {
      paintPeaks(ctx, r, 820, [[700, 420, 280], [1000, 380, 330], [1300, 300, 300], [1500, 340, 440], [1750, 320, 560], [1900, 260, 420]], { tone: 0.62 });
      paintPeaks(ctx, r, 820, [[1150, 200, 230], [1400, 260, 320], [1650, 300, 360]], { tone: 0.42 });
    });
    layers.push(api.tex(far, { rect: [0, 0, 1920, 900], z: 4 }));
    layers.push(mistLayer(api, { y0: 600, y1: 850, z: 3.5, amount: 1, name: 'mist-far' }));
    layers.push(makeLake(api, { y: Y, variant: 'plain', paper: PAPER, z: 2 }));
    const isl = (x0, x1, base, h, trees, v, treeH, seed, refl) => {
      const rr = api.rng(seed);
      const pad = 40, top = Math.round(base - h - treeH * 1.3);
      const rect = [x0 - pad, top, x1 - x0 + pad * 2, base - top + 4];
      const src = bakeInked(api, rect[2], rect[3], (ctx) => {
        ctx.translate(-rect[0], -rect[1]);
        paintIsland(ctx, rr, { x0, x1, baseY: base, h, trees, v, treeH });
      });
      return [makeReflection(api, src, { rect, y: base, z: 2, paper: PAPER, ...refl }), api.tex(src, { rect, z: 2 })];
    };
    layers.push(...isl(1000, 1150, 827, 26, 6, 0.3, 30, 21, { strength: 0.5, amp: 2 }));
    layers.push(...isl(1150, 1380, 838, 20, 6, 0.25, 30, 22, { strength: 0.55, amp: 2 }));
    layers.push(...isl(1556, 1872, 893, 45, 8, 0.12, 46, 23, { strength: 0.6, amp: 2.5 }));
    layers.push(makeGlitter(api, { y: Y, variant: 'plain', paper: PAPER, z: 2, sheen: 0.35, occluders: [[1000, 1150, 827, 8], [1150, 1380, 838, 8], [1556, 1872, 893, 8]] }));
    layers.push(mistLayer(api, { y0: 860, y1: 1140, x0: -480, x1: 1150, z: 1.4, amount: 1, name: 'mist-near', scale: 1.4 }));
    return { layers, meta: { clear: PAPER.map((v) => v / 255) } };
  },
};
