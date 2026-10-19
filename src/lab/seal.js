// Check the seal on paper at 1:1 and enlarged.
import { paintSeal } from '../lib/seal.js';
export default {
  id: 'lab-seal', title: 'seal', ref: '06',
  build(api) {
    const paper = api.shader(`vec4 shade(vec2 p, vec2 uv){ return vec4(vec3(240.,234.,226.)/255., 1.); }`, { z: 1e5 });
    const t = api.bakeCanvas(1920, 1080, (ctx) => { paintSeal(ctx, 1716, 846, 74); paintSeal(ctx, 300, 120, 480); });
    return { layers: [paper, api.tex(t, { rect: [0, 0, 1920, 1080] })] };
  },
};
