// Lab: ref 09 - many small pavilions crowning pillar peaks, small single-arch bridges between
// peaks, and the main temple on the left cliff.
import { paintPavilion, paintArchBridge, paintTemple, bakeArch } from '../lib/architecture.js';
import { pillar, paperShader } from './arch-ph.js';

// [x, baseY, w, fade] - measured from ref 09 (lower-eave tip span, base = top of the stone terrace)
export const PAVS09 = [
  [1672, 125, 44, 0.3],
  [872, 277, 43, 0.25],
  [1217, 371, 89, 0.08],
  [1310, 420, 68, 0.08],
  [677, 410, 50, 0.15],
  [1766, 404, 55, 0.18],
  [655, 610, 50, 0.05],
  [1014, 606, 49, 0.05],
  [1809, 676, 75, 0.0],
  [1622, 834, 51, 0.05],
];
export const BRIDGES09 = [
  { x0: 1037, x1: 1119, y: 690, deck: [615, 615], hump: 3, arches: [{ c: 1078, span: 68, crown: 623, rise: 0.8 }], balH: 6, postSp: 11, ring: 3.4, barrelDepth: 0.1, fadeBelow: [655, 688], tone: 0.66, seed: 91 },
  { x0: 1375, x1: 1461, y: 560, deck: [474, 482], hump: 3, arches: [{ c: 1416, span: 70, crown: 486, rise: 0.8 }], balH: 6, postSp: 11, ring: 3.4, barrelDepth: 0.1, fadeBelow: [518, 555], tone: 0.66, seed: 92, fade: 0.05 },
  { x0: 1671, x1: 1736, y: 540, deck: [430, 423], hump: 2, arches: [{ c: 1700, span: 43, crown: 446 }], balH: 5, postSp: 9, ring: 3, barrelDepth: 0.12, fadeBelow: [500, 538], tone: 0.66, seed: 93, fade: 0.1 },
  { x0: 552, x1: 607, y: 680, deck: [630, 630], hump: 2, arches: [{ c: 582, span: 25, crown: 642, rise: 0.8 }], balH: 4, postSp: 8, ring: 2.5, barrelDepth: 0.1, fadeBelow: [652, 678], tone: 0.66, seed: 94, fade: 0.3 },
];

export default {
  id: 'lab-arch-09', title: 'arch: floating peak pavilions (ref 09)', ref: '09',
  build(api) {
    const paper = api.shader(paperShader([239, 232, 222]), { z: 1e5 });
    const peaks = api.bakeCanvas(1920, 1080, (ctx) => {
      const r = api.rng(9);
      for (const [x, y, w, f] of PAVS09) pillar(ctx, r, x, y, w * 2.4, 320, 0.3 + f);
      pillar(ctx, r, 250, 385, 420, 700, 0.2);
    });
    const t0 = performance.now();
    const b = bakeArch(api, [100, 60, 1820, 820], (ctx) => {
      paintTemple(ctx, { x: 244, y: 436, w: 190, seed: 9, stairs: 'left', sides: [{ dx: -0.5, dy: -0.06, w: 0.4, turn: -0.6 }] });
      for (const o of BRIDGES09) paintArchBridge(ctx, o);
      PAVS09.forEach(([x, y, w, f], i) => paintPavilion(ctx, { x, y, w, fade: f, seed: 90 + i, variant: 'peak' }));
    });
    console.log('ref09 arch bake ms', Math.round(performance.now() - t0));
    return { layers: [paper, api.tex(peaks, { rect: [0, 0, 1920, 1080] }), api.tex(b, { rect: [100, 60, 1820, 820] })] };
  },
};
