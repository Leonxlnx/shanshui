// Lab-only comparison aid (never used by the film): ghosts the painted cranes (tinted blue) over
// the reference image so shape misalignments are visible in a crop. The reference is loaded here
// only, exactly as the still tool does for its comparisons; fauna.js itself never loads images.
//   node tools/still.mjs --scene lab/fauna-ov --ref 04 --crop ...
import { makeCraneFlock } from '../lib/fauna.js';
import { CRANES } from './fauna-data.js';

export default {
  id: 'lab-fauna-ov', title: 'fauna overlay', ref: '01',
  async build(api, opts = {}) {
    const ref = opts.ref || '01';
    const img = await createImageBitmap(await (await fetch('/ref/' + ref + '.webp')).blob());
    const bg = api.bakeCanvas(1920, 1080, (ctx) => { ctx.drawImage(img, 0, 0, 1920, 1080); });
    const flock = makeCraneFlock(api, { cranes: CRANES[ref], z: 1 });
    const draw = flock.draw;
    flock.draw = (ctx, t, L) => {
      draw(ctx, t, L);
      ctx.save(); ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(0,90,255,0.45)'; ctx.fillRect(0, 0, 1920, 1080); ctx.restore();
    };
    flock.opacity = 0.6;
    return { layers: [api.tex(bg, { rect: [0, 0, 1920, 1080], z: 1e5 }), flock], grade: { paper: 0, vignette: 0, dither: 0 } };
  },
};
