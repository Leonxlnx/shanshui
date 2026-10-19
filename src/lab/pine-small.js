// Lab: small conifers and ridge tree lines, compared with the ridge trees of refs 04 / 09 / 01.
import { paintConifer, paintTreeLine } from '../lib/pine.js';
import { inkify } from '../lib/inkfx.js';

export default {
  id: 'lab-pine-small', title: 'pine small conifers', ref: '04',
  build(api) {
    const paper = api.shader(`vec4 shade(vec2 p, vec2 uv){
      vec3 c = vec3(239.,231.,220.)/255.;
      c *= 1.0 + 0.012 * fbm(p * 0.003, 3);
      return vec4(c, 1.); }`, { z: 1e5 });
    const raw = api.bakeCanvas(1920, 1080, (ctx) => {
      // single trees at the sizes seen in ref 04 (crop 280,330 / 760,420 / 1440,300)
      paintConifer(ctx, 480, 470, 95, { kind: 'pine', tone: 0.03, seed: 1 });
      paintConifer(ctx, 360, 520, 70, { kind: 'pine', tone: 0.05, seed: 2 });
      paintConifer(ctx, 905, 470, 110, { kind: 'fir', tone: 0.05, seed: 3 });
      paintConifer(ctx, 860, 520, 75, { kind: 'fir', tone: 0.3, seed: 4 });
      paintConifer(ctx, 1500, 400, 90, { kind: 'fir', tone: 0.02, seed: 5 });
      paintConifer(ctx, 1555, 395, 70, { kind: 'pine', tone: 0.02, seed: 6 });
      paintConifer(ctx, 1460, 420, 55, { kind: 'fir', tone: 0.02, seed: 7 });
      // distance ladder
      for (let i = 0; i < 8; i++) paintConifer(ctx, 120 + i * 90, 760, 80 - i * 6, { kind: i % 3 === 2 ? 'pine' : 'fir', tone: i * 0.1, seed: 20 + i });
      // tree lines on ridges at three distances
      paintTreeLine(ctx, [[900, 760], [980, 700], [1060, 690], [1140, 720], [1220, 780]], { height: [34, 70], tone: 0.05, seed: 11 });
      paintTreeLine(ctx, [[1260, 760], [1340, 720], [1420, 735], [1520, 700], [1600, 740]], { height: [22, 44], tone: 0.35, seed: 12 });
      paintTreeLine(ctx, [[1620, 760], [1700, 735], [1800, 745], [1900, 725]], { height: [14, 26], tone: 0.6, seed: 13, rows: 1 });
      // snowy
      paintTreeLine(ctx, [[100, 1000], [300, 950], [500, 970], [700, 940]], { height: [30, 60], tone: 0.05, snow: 0.8, seed: 14 });
      paintConifer(ctx, 900, 1000, 110, { kind: 'pine', tone: 0.03, snow: 0.9, seed: 15 });
      paintConifer(ctx, 1000, 1000, 100, { kind: 'fir', tone: 0.03, snow: 0.9, seed: 16 });
    });
    const inked = inkify(api, raw, { edge: 0.35, granulation: 0.15, bleed: 1.0 });
    return { layers: [paper, api.tex(inked, { rect: [0, 0, 1920, 1080] })] };
  },
};
