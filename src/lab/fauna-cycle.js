// Lab: the wingbeat cycle laid out as a grid of 16 phases (static), plus a glide pose.
import { drawCrane } from '../lib/fauna.js';

export default {
  id: 'lab-fauna-cycle', title: 'fauna: wingbeat cycle grid', ref: '01',
  build(api) {
    const paper = api.shader(`vec4 shade(vec2 p, vec2 uv){ return vec4(vec3(239.,231.,220.)/255., 1.); }`, { z: 1e5 });
    const layer = api.canvas((ctx, t) => {
      for (let i = 0; i < 16; i++) {
        const cx = 200 + (i % 4) * 420, cy = 150 + Math.floor(i / 4) * 230;
        drawCrane(ctx, cx, cy, 260, i / 16 + t, { heading: -0.22, seed: 1 });
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.font = '18px monospace'; ctx.fillText((i / 16).toFixed(3), cx - 170, cy - 90);
      }
      drawCrane(ctx, 1780, 980, 200, 0, { heading: -0.1, seed: 2, glide: 1 });
    }, { rect: [0, 0, 1920, 1080], z: 1 });
    return { layers: [paper, layer] };
  },
};
