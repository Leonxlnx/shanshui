// Water lab: the multi-tier red cascade of ref 08 (400-1000, 0-1000) with placeholder cliffs.
import { makeCascade } from '../lib/water.js';
import { paperLayer, paintPeaks, paintCliff, bakeInked, mistLayer } from './water-props.js';

export default {
  id: 'lab-water-08', title: 'water: cascade', ref: '08',
  build(api) {
    const r = api.rng(8);
    const layers = [paperLayer(api)];
    const far = bakeInked(api, 1920, 1000, (ctx) => {
      paintPeaks(ctx, r, 700, [[1250, 240, 420], [1500, 260, 520], [1750, 260, 600]], { tone: 0.5 });
      paintPeaks(ctx, r, 950, [[1350, 200, 420], [1650, 260, 560], [1880, 200, 500]], { tone: 0.4 });
    });
    layers.push(api.tex(far, { rect: [0, 0, 1920, 1000], z: 4 }));
    // dark rock wall behind the top falls + left cliff (placeholders)
    const wall = bakeInked(api, 1100, 1080, (ctx) => {
      paintCliff(ctx, r, [[380, 90], [520, 70], [640, 80], [800, 100], [860, 200], [900, 420], [760, 430], [600, 420], [430, 420], [380, 300]], { v: 0.12 });
      paintCliff(ctx, r, [[0, 120], [180, 140], [330, 300], [460, 420], [520, 600], [560, 800], [700, 1080], [0, 1080]], { v: 0.1 });
      paintCliff(ctx, r, [[880, 160], [960, 200], [1000, 420], [950, 480], [880, 430]], { v: 0.18 });
    });
    layers.push(api.tex(wall, { rect: [0, 0, 1100, 1080], z: 1.5 }));
    const c = makeCascade(api, {
      seed: 8, z: 1.5, wall: [{ x0: 420, x1: 820, y0: 110, y1: 430 }],
      tiers: [
        { lip: [[440, 150], [512, 142]], height: 270, driftL: -8, driftR: 8, sheets: 1, ledge: 24 },
        { lip: [[528, 118], [698, 132]], height: 300, driftL: -14, driftR: 22, sheets: 3, arch: 6, ledge: 24 },
        { lip: [[714, 140], [790, 152]], height: 260, driftL: -4, driftR: 14, sheets: 1, ledge: 40 },
        { lip: [[548, 458], [618, 448]], height: 120, speed: 170, fade: 0.7 },
        { lip: [[628, 452], [700, 462]], height: 110, speed: 170, fade: 0.7 },
        { lip: [[712, 470], [770, 478]], height: 90, speed: 160, fade: 0.7 },
        { lip: [[860, 500], [930, 510]], height: 80, speed: 150, fade: 0.7 },
        { lip: [[505, 640], [575, 630]], height: 100, speed: 160, fade: 0.7 },
        { lip: [[590, 628], [690, 640]], height: 95, speed: 160, fade: 0.7 },
        { lip: [[700, 650], [780, 660]], height: 80, speed: 150, fade: 0.7 },
        { lip: [[540, 770], [640, 778]], height: 70, speed: 140, fade: 0.68, sheets: 2 },
        { lip: [[655, 778], [760, 790]], height: 72, speed: 140, fade: 0.68, sheets: 2 },
        { lip: [[790, 800], [880, 808]], height: 60, speed: 130, fade: 0.68, sheets: 2 },
        { lip: [[600, 880], [700, 890]], height: 75, speed: 140, fade: 0.68, sheets: 2 },
        { lip: [[720, 890], [830, 900]], height: 70, speed: 140, fade: 0.68, sheets: 2 },
        { lip: [[860, 915], [980, 925]], height: 60, speed: 130, fade: 0.68, sheets: 2 },
        { lip: [[1000, 950], [1110, 958]], height: 55, speed: 120, fade: 0.68, sheets: 2 },
      ],
      foam: [{ at: [1060, 1020], w: 220, h: 34 }, { at: [700, 1040], w: 260, h: 30 }],
      spray: [
        { x: 620, y: 440, width: 220, rise: 120, amount: 0.65 }, { x: 700, y: 600, width: 230, rise: 90, amount: 0.5 },
        { x: 780, y: 780, width: 260, rise: 90, amount: 0.5 }, { x: 880, y: 960, width: 300, rise: 90, amount: 0.55 },
      ],
    });    layers.push(...c.layers);
    layers.push(mistLayer(api, { y0: 300, y1: 1000, x0: 900, x1: 2400, z: 2.5, amount: 0.9, name: 'mist-sea', scale: 1.6 }));
    return { layers };
  },
};
