// Lab: three-arch stone bridge of ref 05 (with a placeholder bank and its reflection).
import { paintArchBridge, bakeArch, archBounds } from '../lib/architecture.js';
import { blob, inkCss, wash } from '../lib/brush.js';

export const BRIDGE05 = {
  x0: 270, x1: 830, y: 682, deck: [590, 606], hump: 72, peak: 585,
  arches: [
    { c: 403, span: 87, crown: 599 },
    { c: 595, span: 205, crown: 550 },
    { c: 768, span: 65, crown: 604 },
  ],
  seed: 5,
};

export default {
  id: 'lab-arch-05', title: 'arch: stone bridge (ref 05)', ref: '05',
  build(api) {
    const paper = api.shader(`vec4 shade(vec2 p, vec2 uv){
      vec3 c = vec3(239.,231.,220.)/255.;
      if (p.y > 682.0) c *= 0.985 - 0.01 * smoothstep(682.0, 1080.0, p.y);
      return vec4(c, 1.); }`, { z: 1e5 });
    // placeholder banks
    const bank = api.bakeCanvas(1000, 400, (ctx) => {
      const r = api.rng(9);
      wash(ctx, (c) => { c.moveTo(0, 120); c.lineTo(180, 90); c.lineTo(290, 150); c.lineTo(300, 300); c.lineTo(0, 300); c.closePath(); }, { alpha: 0.5, blur: 4 });
      wash(ctx, (c) => { c.moveTo(800, 270); c.lineTo(880, 180); c.lineTo(960, 230); c.lineTo(1000, 300); c.lineTo(780, 300); c.closePath(); }, { alpha: 0.45, blur: 4 });
      for (let i = 0; i < 160; i++) blob(ctx, r.range(0, 300), r.range(90, 290), r.range(3, 10), { color: inkCss(r.range(0, 0.3), r.range(0.5, 1)), rng: r });
      for (let i = 0; i < 90; i++) blob(ctx, r.range(800, 1000), r.range(180, 290), r.range(3, 9), { color: inkCss(r.range(0, 0.3), r.range(0.5, 1)), rng: r });
    });
    const rect = archBounds('archBridge', BRIDGE05);
    const t0 = performance.now();
    const br = bakeArch(api, rect, (ctx) => paintArchBridge(ctx, BRIDGE05));
    console.log('bridge bake ms', Math.round(performance.now() - t0), rect);
    return {
      layers: [
        paper,
        api.tex(br, { rect, reflect: { y: 682, strength: 0.42, fade: 160, smear: 4, amp: 2, wavelength: 8, speed: 0.5, breakup: 0.35 } }),
        api.tex(bank, { rect: [0, 400, 1000, 400] }),
      ],
    };
  },
};
