// Lab: two-tier pavilion of ref 01 on a placeholder cliff top.
import { paintPavilion, bakeArch } from '../lib/architecture.js';
import { blob, inkCss, wash } from '../lib/brush.js';

export default {
  id: 'lab-arch-01', title: 'arch: pavilion (ref 01)', ref: '01',
  build(api) {
    const paper = api.shader(`vec4 shade(vec2 p, vec2 uv){ return vec4(vec3(239.,231.,220.)/255., 1.); }`, { z: 1e5 });
    // placeholder cliff
    const cliff = api.bakeCanvas(700, 700, (ctx) => {
      const r = api.rng(5);
      wash(ctx, (c) => { c.moveTo(0, 130); c.lineTo(120, 100); c.lineTo(220, 112); c.lineTo(330, 95); c.lineTo(400, 120); c.lineTo(420, 700); c.lineTo(0, 700); c.closePath(); }, { alpha: 0.55, blur: 3 });
      for (let i = 0; i < 260; i++) blob(ctx, r.range(0, 430), r.range(95, 260), r.range(3, 11), { color: inkCss(r.range(0, 0.25), r.range(0.6, 1)), rng: r });
    });
    const t0 = performance.now();
    const rect = [160, 300, 240, 200];
    const pav = bakeArch(api, rect, (ctx) => paintPavilion(ctx, { x: 277, y: 470, w: 150, seed: 3 }));
    console.log('pavilion bake ms', Math.round(performance.now() - t0));
    return {
      layers: [
        paper,
        api.tex(cliff, { rect: [0, 380, 700, 700] }),
        api.tex(pav, { rect }),
      ],
    };
  },
};
