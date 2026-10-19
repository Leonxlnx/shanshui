// Visual check of brush.js + inkfx.js primitives.
import { stroke, dryStroke, blob, dots, wash, granulate, inkCss, rgba, PAPER, VERMILION } from '../lib/brush.js';
import { inkify } from '../lib/inkfx.js';

export default {
  id: 'lab-brush', title: 'brush primitives', ref: '01',
  build(api) {
    const paper = api.shader(`vec4 shade(vec2 p, vec2 uv){ return vec4(vec3(239.,231.,220.)/255., 1.); }`, { z: 1e5 });
    const raw = api.bakeCanvas(1920, 1080, (ctx) => {
      const r = api.rng(1), nz = api.noise(1);
      for (let i = 0; i < 6; i++) stroke(ctx, [[100, 100 + i * 60], [300, 80 + i * 60], [500, 110 + i * 60]], { width: 6 + i * 4, rng: r, color: inkCss(i * 0.12) });
      for (let i = 0; i < 5; i++) dryStroke(ctx, [[650, 100 + i * 80], [800, 130 + i * 80], [1000, 90 + i * 80]], { width: 30, bristles: 14, dry: 0.2 + i * 0.12, rng: r, noise: nz });
      for (let i = 0; i < 40; i++) blob(ctx, 1150 + (i % 10) * 60, 120 + Math.floor(i / 10) * 70, 6 + (i % 7) * 3, { rng: r, color: inkCss(0.05 + (i % 5) * 0.1, 0.9) });
      dots(ctx, 1500, 500, 120, 300, { rng: r });
      wash(ctx, (c) => { c.ellipse(400, 700, 300, 160, 0, 0, Math.PI * 2); }, { alpha: 0.35, blur: 8 });
      wash(ctx, (c) => { c.ellipse(1000, 750, 250, 200, 0.4, 0, Math.PI * 2); }, { alpha: 0.6, blur: 3, color: VERMILION });
      granulate(ctx, 700, 550, 600, 450, { amount: 0.5 });
    });
    const inked = inkify(api, raw, { edge: 0.6, granulation: 0.3, bleed: 1.5 });
    return { layers: [paper, api.tex(inked, { rect: [0, 0, 1920, 1080] })] };
  },
};
