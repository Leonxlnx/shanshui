// Water lab: moon lake of ref 03 (night lake, moon glitter column, island reflections).
import { makeLake, makeGlitter, makeReflection } from '../lib/water.js';
import { paperLayer, nightSky, paintPeaks, paintIsland, paintCliff, bakeInked, mistLayer } from './water-props.js';

export default {
  id: 'lab-water-03', title: 'water: moon lake', ref: '03',
  build(api) {
    const r = api.rng(3);
    const PAPER = [237, 228, 215];
    const Y = 648;
    const layers = [paperLayer(api, PAPER), nightSky(api)];
    const far = bakeInked(api, 1920, 700, (ctx) => {
      paintPeaks(ctx, r, 620, [[700, 260, 120], [880, 300, 190], [1010, 260, 150], [1160, 300, 120], [1300, 260, 90]], { tone: 0.62 });
      paintPeaks(ctx, r, 620, [[740, 300, 330], [950, 180, 230], [1560, 240, 420], [1760, 280, 470], [1880, 200, 300]], { tone: 0.38 });
    });
    layers.push(api.tex(far, { rect: [0, 0, 1920, 700], z: 4 }));
    layers.push(mistLayer(api, { y0: 470, y1: 680, z: 3.5, amount: 1, name: 'mist-far' }));
    layers.push(makeLake(api, { y: Y, variant: 'night', paper: PAPER, z: 2, density: [0.22, 0.23, 0.37, 0.45], fog: [60, 0.6, 0, 0], persp: 1.1 }));
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
    layers.push(...isl(1270, 1540, 658, 40, 9, 0.35, 34, 11, { strength: 0.3 }));
    layers.push(...isl(900, 1240, 735, 55, 7, 0.08, 52, 12, { strength: 0.8 }));
    layers.push(...isl(1516, 1866, 731, 100, 7, 0.06, 56, 13, { strength: 0.8 }));
    layers.push(makeGlitter(api, {
      y: Y, variant: 'night', paper: PAPER, z: 2,
      glitter: { kind: 'moon', x: 1322, x1: 1318, w0: 40, w1: 58, ext0: 55, ext1: 100, row: 7, intensity: 1, glowW: 230, glowH: 22, glow: 0.8, fadeNear: 80 },
      occluders: [[900, 1240, 735, 8], [1516, 1866, 731, 8], [1270, 1540, 658, 8]],
    }));
    const cliff = bakeInked(api, 1000, 700, (ctx) => {
      ctx.translate(0, -400);
      paintCliff(ctx, r, [[0, 420], [260, 400], [420, 470], [520, 560], [700, 640], [800, 760], [900, 900], [880, 1080], [0, 1080]], { v: 0.1 });
    });
    layers.push(mistLayer(api, { y0: 930, y1: 1130, x0: -480, x1: 1500, z: 1.4, amount: 1, name: 'mist-near', scale: 1.4 }));
    layers.push(api.tex(cliff, { rect: [0, 400, 1000, 700], z: 1.2 }));
    return { layers, meta: { clear: PAPER.map((v) => v / 255) } };
  },
};
