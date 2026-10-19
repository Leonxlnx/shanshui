// Water lab: the waterfall of ref 01 (x 470-590, y 590-830) over a dark placeholder cliff.
import { makeWaterfall } from '../lib/water.js';
import { paperLayer, paintCliff, bakeInked, mistLayer } from './water-props.js';
import { stroke, inkCss, blob } from '../lib/brush.js';

export default {
  id: 'lab-water-falls01', title: 'water: falls 01', ref: '01',
  build(api) {
    const r = api.rng(5);
    const layers = [paperLayer(api)];
    // placeholder cliffs either side of the falls
    const cliff = bakeInked(api, 800, 560, (ctx) => {
      ctx.translate(-100, -520);
      paintCliff(ctx, r, [[100, 600], [300, 560], [440, 575], [470, 600], [520, 610], [560, 600], [610, 590], [660, 640], [700, 760], [720, 1080], [100, 1080]], { v: 0.06 });
      // mid-tone right pillar face
      ctx.fillStyle = inkCss(0.45, 0.6);
      ctx.beginPath(); ctx.moveTo(600, 600); ctx.lineTo(660, 640); ctx.lineTo(700, 800); ctx.lineTo(640, 900); ctx.closePath(); ctx.fill();
      for (let i = 0; i < 40; i++) blob(ctx, r.range(420, 680), r.range(540, 600), r.range(6, 16), { color: inkCss(0.05, 0.9), rng: r, squash: 0.6 });
    });
    layers.push(api.tex(cliff, { rect: [100, 520, 800, 560], z: 1.5 }));
    const falls = makeWaterfall(api, {
      lip: [[447, 590], [533, 611]], height: 280, bendL: 38, bendR: 18, curve: 7, driftL: 12, driftR: 36, arch: 3,
      speed: 230, z: 1.5, seed: 2.1, sheets: 2, streakScale: 5, thin: 0.35, sideShade: 0.2, spray: { amount: 0.8, rise: 110, width: 130 },
    });
    layers.push(...falls.layers);
    layers.push(mistLayer(api, { y0: 760, y1: 1100, x0: 200, x1: 1100, z: 1.3, amount: 1, name: 'mist-base', scale: 1.2 }));
    return { layers };
  },
};
