// Water lab: golden winding river of ref 02 (900-1720, 500-1080) with sandbars,
// placeholder islands and a gold sun shine.
import { makeRiver, makeReflection } from '../lib/water.js';
import { paperLayer, paintPeaks, paintIsland, bakeInked, mistLayer } from './water-props.js';

export default {
  id: 'lab-water-02', title: 'water: golden river', ref: '02',
  build(api) {
    const r = api.rng(2);
    const PAPER = [250, 233, 203];
    const layers = [paperLayer(api, PAPER, { top: [251, 236, 205] })];
    layers.push(api.shader(/* glsl */`
      vec4 shade(vec2 p, vec2 uv) {
        vec2 d = p - vec2(1520.0, 330.0);
        float sun = 1.0 - smoothstep(44.0, 46.0, length(d));
        float glow = exp(-length(d * vec2(0.6, 1.4)) / 260.0);
        vec3 c = vec3(0.98, 0.86, 0.6);
        float a = glow * 0.45 + sun * 0.5;
        return vec4(c * a, a);
      }`, { z: 1e5, rect: [-480, -270, 2880, 1000], name: 'sun' }));
    const far = bakeInked(api, 1920, 700, (ctx) => {
      paintPeaks(ctx, r, 560, [[700, 300, 340], [900, 260, 260], [1100, 300, 180], [1700, 300, 260], [1880, 260, 300]], { tone: 0.6 });
      paintPeaks(ctx, r, 600, [[500, 300, 420], [1550, 160, 200]], { tone: 0.45 });
    });
    layers.push(api.tex(far, { rect: [0, 0, 1920, 700], z: 4 }));
    const river = makeRiver(api, {
      variant: 'golden', paper: PAPER, z: 2, seed: 7,
      horizon: 470, vx: 1310, yNear: 1110, yFar: 500, fore: 2.4, width: 760, taper: 1.3,
      meander: [{ amp: 380, grow: 0.045, wl: 5600, phase: 0.6 }, { amp: 120, grow: 0.01, wl: 2100, phase: 2.0 }], offset: 60,
      wander: 0.22,
      bars: [{ sx: 1285, sy: 698, sw: 280, sh: 12 }, { sx: 1545, sy: 752, sw: 300, sh: 14 }, { sx: 1210, sy: 625, sw: 170, sh: 7 }, { sx: 1320, sy: 661, sw: 260, sh: 9 }, { sx: 1120, sy: 872, sw: 300, sh: 16, tone: 0.6 }, { sx: 1470, sy: 832, sw: 300, sh: 13, tone: 0.6 }, { sx: 1030, sy: 790, sw: 200, sh: 16 }, { sx: 1680, sy: 690, sw: 220, sh: 10 }],
      density: [0.0, 0.02, 0.04, 0.5],
      glitter: { kind: 'gold', x: 1320, x1: 1300, w0: 10, w1: 60, ext0: 25, ext1: 130, row: 6, intensity: 0.9, glowW: 140, glowH: 60, glow: 0.45, spillW: 300, spill: 0.3, sparkle: 0.7, fadeNear: 40 },
    });
    layers.push(...river.layers.slice(0, 3));
    const isl = (x0, x1, base, h, trees, v, treeH, seed) => {
      const rr = api.rng(seed);
      const pad = 40, top = Math.round(base - h - treeH * 1.3);
      const rect = [x0 - pad, top, x1 - x0 + pad * 2, base - top + 4];
      const src = bakeInked(api, rect[2], rect[3], (ctx) => { ctx.translate(-rect[0], -rect[1]); paintIsland(ctx, rr, { x0, x1, baseY: base, h, trees, v, treeH }); });
      return [makeReflection(api, src, { rect, y: base, z: 2, paper: PAPER, strength: 0.45, amp: 2.5 }), api.tex(src, { rect, z: 2 })];
    };
    layers.push(...isl(1000, 1240, 870, 55, 6, 0.15, 40, 31));
    layers.push(...isl(1340, 1560, 830, 40, 6, 0.2, 34, 32));
    layers.push(river.overlay);
    layers.push(mistLayer(api, { y0: 480, y1: 640, z: 3, amount: 0.9, rgb: PAPER, name: 'mist-far' }));
    layers.push(mistLayer(api, { y0: 900, y1: 1150, x0: -480, x1: 1150, z: 1.3, amount: 1, rgb: PAPER, name: 'mist-near', scale: 1.4 }));
    return { layers, meta: { clear: PAPER.map((v) => v / 255) } };
  },
};
