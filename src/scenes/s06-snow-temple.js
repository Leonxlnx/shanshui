// s06 Snow temple (ref 06): snow-laden pine and a temple on a snowy cliff, frozen
// waterfalls, a sea of clouds with snowy peaks on the right, falling snow.
import { makeSky, makeCloudSea, makeMist } from '../lib/atmos.js';
import { makePeaks } from '../lib/peaks.js';
import { makeSnowPine as makePine } from './s06/snowcap.js';
import { paintTemple, paintHall, bakeArch } from '../lib/architecture.js';
import { makeSnow } from './s06/snowfall.js';
import { inkify } from '../lib/inkfx.js';
import { PAPER_COOL } from '../lib/brush.js';
import { makeIcefall } from './s06/ice.js';
import { bakeSnowCliff } from './s06/snowcliff.js';

const SV = 'snow';

export const FACTS = {
  seal: [1716, 846, 74, 120],     // keep calm
  temple: [322, 330],
  pavilion: [781, 315],
  waterfall: [640, 600],
  icefalls: [[598, 420, 930], [884, 598, 872]],   // [x, top, foot]
  massif: [1533, 46],                              // summit of the big snowy peak
  snowCalm: [1700, 830, 1806, 982],                // flake-free rect around the seal
  bloomSeeds: [[180, 520], [700, 560]],
};

export default {
  id: 's06', title: 'Snow temple', ref: '06',
  build(api) {
    const layers = [];
    const T0 = performance.now();
    const tm = (l) => console.warn('s06', l, Math.round(performance.now() - T0));
    layers.push(makeSky(api, { variant: 'snow' }));

    // ---- far peaks (pale) and the first cloud row
    const far = makePeaks(api, {
      variant: SV,
      peaks: [
        { x: 975, top: 108, base: 270, width: 330, cols: 5, tone: 0.76, fade: 0.35, detail: 0.6, treeSize: 0.5, seed: 61 },
        { x: 1200, top: 150, base: 260, width: 220, cols: 3, tone: 0.8, fade: 0.35, detail: 0.5, treeSize: 0.45, seed: 62 },
        { x: 1800, top: 90, base: 300, width: 330, cols: 5, tone: 0.74, fade: 0.35, detail: 0.6, treeSize: 0.5, seed: 63 },
      ],
    });
    layers.push(far.layer({ z: 7.5 }));
    layers.push(makeCloudSea(api, { yBack: 235, yFront: 380, rows: 6, lobe: 50, z: 6.5, seed: 1, drift: 3, farFade: 0.6, shade: 0.5, wisp: 0.35, wispsAbove: 0.3, color: [247, 246, 243], shadowColor: [186, 184, 181] }));

    // ---- the big snowy massif top right
    const big = makePeaks(api, {
      variant: SV,
      peaks: [{
        // a pyramid: summit with shoulders stepping down both ridges
        x: 1533, width: 640, top: 46, base: 440, tone: 0.26, seed: 64, fade: 0.5, treeSize: 0.6, trees: 0.8, wetBlur: 0.9, detail: 1.25, columns: [
          { dx: -290, top: 270, hw: 90, cap: 'point', spread: 0.4, lean: -0.04 }, { dx: -190, top: 205, hw: 100, cap: 'point', spread: 0.4 },
          { dx: 310, top: 235, hw: 95, cap: 'point', spread: 0.4 }, { dx: 210, top: 170, hw: 105, cap: 'point', spread: 0.4 },
          { dx: -95, top: 115, hw: 115, cap: 'point', spread: 0.4, lean: -0.03 }, { dx: 115, top: 100, hw: 115, cap: 'point', spread: 0.4, lean: 0.03 },
          { dx: 0, top: 46, hw: 130, cap: 'point', spread: 0.4 },
        ],
      }],
    });
    layers.push(big.layer({ z: 5 }));
    layers.push(makeMist(api, { top: 345, height: 90, lobe: 55, z: 4.8, seed: 9, drift: 6, extent: [1150, 2050, 120] }));
    layers.push(makeCloudSea(api, { yBack: 385, yFront: 540, rows: 6, lobe: 85, z: 4.6, seed: 2, drift: 4, farFade: 0.4, perspective: 1.1, shade: 0.65, wisp: 0.45, wispsAbove: 0.4, texture: 0.6, color: [247, 246, 243], shadowColor: [178, 176, 173] }));

    // ---- small right peaks and the central snowy peak
    const mid = makePeaks(api, {
      variant: SV,
      peaks: [
        { x: 1810, top: 385, base: 600, width: 300, cols: 3, tone: 0.42, fade: 0.45, seed: 65, shape: 'spire' },
        {
          x: 1160, width: 520, top: 300, base: 600, tone: 0.22, seed: 66, fade: 0.4, columns: [
            { dx: 300, top: 430, hw: 70 }, { dx: 200, top: 390, hw: 60, cap: 'point' }, { dx: -140, top: 430, hw: 55 },
            { dx: -70, top: 360, hw: 55, cap: 'point' }, { dx: 100, top: 345, hw: 70, cap: 'point' }, { dx: 0, top: 300, hw: 60, cap: 'point' },
          ],
        },
      ],
    });
    layers.push(mid.layer({ z: 3.3 }));
    layers.push(makeMist(api, { top: 530, height: 100, lobe: 70, z: 3.1, seed: 10, drift: 7, extent: [900, 2050, 140] }));
    layers.push(makeCloudSea(api, { yBack: 570, yFront: 800, rows: 6, lobe: 135, z: 2.9, seed: 3, drift: 5, farFade: 0.3, perspective: 0.9, shade: 0.62, wisp: 0.4, wispsAbove: 0.35, texture: 0.6, color: [247, 246, 243], shadowColor: [172, 170, 167] }));

    // ---- lower right peak (base kept clear of the seal corner)
    const low = makePeaks(api, {
      variant: SV,
      peaks: [{
        x: 1770, width: 330, top: 597, base: 860, tone: 0.18, seed: 67, fade: 0.45, columns: [
          { dx: -170, top: 720, hw: 50 }, { dx: 170, top: 700, hw: 60 }, { dx: -90, top: 650, hw: 60, cap: 'point' },
          { dx: 90, top: 640, hw: 60 }, { dx: 0, top: 597, hw: 55, cap: 'point' },
        ],
      }],
    });
    layers.push(low.layer({ z: 2.3 }));
    layers.push(makeCloudSea(api, { yBack: 800, yFront: 1180, rows: 5, lobe: 200, z: 2.0, seed: 4, drift: 6, farFade: 0.2, shade: 0.64, wisp: 0.35, wispsAbove: 0.3, texture: 0.65, color: [247, 246, 243], shadowColor: [166, 164, 161] }));
    tm('peaks+clouds');

    const snow = makeSnow(api, { intensity: 1, wind: 0.8, seed: 6, calm: [1700, 830, 1806, 982] });
    layers.push(snow[0], snow[1]);

    // ---- central cliffs: the pavilion pillar and the right spur (z 1.4)
    const midRock = bakeSnowCliff(api, [580, 280, 640, 680], [
      { poly: [[884, 930], [884, 640], [890, 560], [873, 505], [920, 512], [960, 518], [1010, 540], [1040, 580], [1068, 620], [1102, 689], [1130, 760], [1150, 830], [1160, 930]],
        face: 0.42, cap: 10, cover: 0.4, ledges: 0.7, lump: [30, 80], fade: [780, 900], pines: [[930, 560, 70, -10, 0.3], [975, 600, 60, 10, 0.5], [1080, 705, 70, 0, 0.6], [1010, 640, 55, 5, 0.2]] },
      { poly: [[640, 940], [640, 700], [640, 520], [637, 379], [666, 350], [735, 345], [804, 342], [855, 345], [873, 367], [878, 482], [884, 640], [890, 940]],
        face: 0.38, cap: 12, cover: 0.4, ledges: 0.7, lump: [30, 80], fade: [800, 920], pines: [[690, 410, 80, -15, -0.5], [760, 430, 70, 5, 0.4], [835, 480, 75, 15, 0.6], [740, 700, 80, 0, 0.3], [800, 600, 70, 8, 0.5], [700, 540, 65, -5, -0.3]] },
    ], { seed: 6 });
    layers.push(api.tex(midRock.src, { rect: midRock.rect, z: 1.4 }));
    const pmo = { gnarl: 0.7, snow: 0.95, paper: PAPER_COOL, padDensity: 2.6, haze: 0.15, needles: 10, fanSpacing: 0.9, swayAmp: 1.5, swayFreq: 0.2, caps: { cap: 10, mound: 5, blur: 6 } };
    const pD = makePine(api, { ...pmo, seed: 64, x: 700, y: 470, height: 120, lean: -20, bend: -40, reach: -0.7, padSize: 50, needle: 7, trunkWidth: 10 });
    const pE = makePine(api, { ...pmo, seed: 65, x: 815, y: 560, height: 110, lean: 15, bend: 45, reach: 0.7, padSize: 48, needle: 6, trunkWidth: 9 });
    const pF = makePine(api, { ...pmo, seed: 66, x: 960, y: 610, height: 100, lean: 10, bend: 30, reach: 0.5, padSize: 44, needle: 6, trunkWidth: 9 });
    layers.push(pD.layer({ z: 1.4 }), pE.layer({ z: 1.4 }), pF.layer({ z: 1.4 }));
    tm('midrock');

    // frozen waterfall 2 and the pavilion on the pillar
    const ice2 = makeIcefall(api, [820, 570, 140, 330], [{ x: 884, y0: 598, y1: 872, hw0: 30, hw1: 40, lean: 8, col: 11, seed: 2, fade: 0.72 }]);
    layers.push(api.tex(ice2, { rect: [820, 570, 140, 330], z: 1.4 }));
    const pav = bakeArch(api, [640, 240, 260, 130], (ctx) => {
      paintHall(ctx, { x: 690, y: 355, w: 80, snow: true, turn: 0.5, tiers: 1, steps: false, gable: false, seed: 61, paper: PAPER_COOL, fade: 0.08, aspect: 2.2, bays: [3, 1] });
      paintHall(ctx, { x: 781, y: 343, w: 95, snow: true, tiers: 2, aspect: 1.35, turn: 0.3, bays: [3, 2], seed: 62, paper: PAPER_COOL, steps: false, gable: false, colH: 0.55, roofH: 0.42, roof2H: 0.6, ridge: 0.35, upper: 0.74, upperB: 0.7 });
    });
    layers.push(api.tex(pav, { rect: [640, 240, 260, 130], z: 1.4 }));
    layers.push(makeMist(api, { top: 780, height: 300, lobe: 90, z: 1.35, seed: 7, drift: 8, extent: [560, 1500, 140] }));

    // ---- frozen waterfall 1 (z 1.25)
    const ice1 = makeIcefall(api, [500, 390, 280, 540], [
      // lower tiers first: the icicles of each upper tier hang over the lip below
      { x: 604, y0: 705, y1: 930, hw0: 54, hw1: 50, lean: -6, col: 13, seed: 5, fade: 0.55, lip: 1.1, recess: 0.3 },
      { x: 598, y0: 548, y1: 915, hw0: 58, hw1: 52, lean: -8, col: 15, seed: 4, fade: 0.72, lip: 1.2 },
      { x: 690, y0: 545, y1: 830, hw0: 52, hw1: 46, lean: 8, col: 15, seed: 3, fade: 0.8, lip: 1.2 },
      { x: 592, y0: 420, y1: 590, hw0: 46, hw1: 58, lean: 6, col: 13, seed: 1, fade: 0.95, recess: 0.8 },
    ]);
    layers.push(api.tex(ice1, { rect: [500, 390, 280, 540], z: 1.25 }));
    tm('ice');

    // ---- left cliff with the temple (z 1.15)
    const leftRock = bakeSnowCliff(api, [-200, 330, 900, 900], [
      // face under the temple
      { poly: [[255, 400], [300, 386], [360, 380], [420, 382], [470, 386], [520, 392], [545, 410], [548, 480], [552, 600], [548, 700], [540, 790], [255, 790]],
        face: 0.3, snowDepth: 12, cover: 0.5, ledges: 0.25, facet: 50, litRange: 0.55, fade: [660, 790] },
      // upper-left shoulder, mostly snow
      { poly: [[-160, 470], [-90, 440], [-30, 425], [30, 428], [80, 445], [120, 440], [170, 452], [215, 470], [250, 505], [270, 550], [285, 620], [300, 700], [300, 800], [-160, 800]],
        face: 0.28, snowDepth: 140, cover: 0.6, ledges: 0.5, peek: 0.5, fade: [720, 800] },
      // big snowy slope bottom left
      { poly: [[-160, 720], [-60, 712], [40, 712], [140, 718], [230, 725], [300, 735], [360, 748], [420, 762], [460, 790], [470, 860], [480, 1000], [490, 1200], [-160, 1200]],
        face: 0.26, snowDepth: 120, cover: 0.6, ledges: 0.4, peek: 0.5 },
      { poly: [[-160, 830], [0, 836], [110, 860], [190, 900], [235, 960], [255, 1060], [262, 1200], [-160, 1200]],
        face: 0.3, snowDepth: 260, cover: 0.6, ledges: 0.3, peek: 0.5 },
      // dark pillar bottom right of the slope
      { poly: [[466, 835], [520, 815], [570, 828], [610, 858], [640, 900], [652, 1000], [662, 1200], [466, 1200]],
        face: 0.22, snowDepth: 22, cover: 0.5, ledges: 0.5, fade: [1000, 1130], pines: [[540, 905, 100, -4, 0.6]] },
    ], { seed: 7 });
    layers.push(api.tex(leftRock.src, { rect: leftRock.rect, z: 1.15 }));
    tm('leftrock');
    // two larger snow pines on the left cliff, as their own swaying cards
    const pineOpts = { gnarl: 0.7, snow: 0.95, paper: PAPER_COOL, padDensity: 2.6, haze: 0.15, needles: 10, fanSpacing: 0.9, swayAmp: 2, swayFreq: 0.2, caps: { cap: 13, mound: 7, blur: 8 } };
    const pA = makePine(api, { ...pineOpts, seed: 61, x: 268, y: 610, height: 150, lean: 30, bend: 50, reach: 0.85, padSize: 62, needle: 8, trunkWidth: 13 });
    const pB = makePine(api, { ...pineOpts, seed: 62, x: 432, y: 800, height: 190, lean: -8, bend: 70, reach: 0.9, padSize: 74, needle: 9, trunkWidth: 17 });
    const pC = makePine(api, { ...pineOpts, seed: 63, x: 70, y: 500, height: 120, lean: -12, bend: -40, reach: -0.5, padSize: 52, needle: 7, trunkWidth: 11 });
    layers.push(pA.layer({ z: 1.15 }), pB.layer({ z: 1.12 }), pC.layer({ z: 1.15 }));
    tm('pines');
    const temple = bakeArch(api, [140, 200, 400, 200], (ctx) => {
      paintTemple(ctx, { x: 330, y: 374, w: 215, snow: true, style: 'pavilion', terrace: true, stairs: 'front', turn: -0.35, aspect: 1.9, seed: 6, paper: PAPER_COOL, sides: [{ dx: -0.5, dy: -0.04, w: 0.42, turn: 0.5 }] });
    });
    layers.push(api.tex(temple, { rect: [140, 200, 400, 200], z: 1.15 }));

    layers.push(snow[2]);
    // ---- hero pine top left
    const pine = makePine(api, {
      seed: 6, height: 420, gnarl: 0.65, snow: 0.6, paper: PAPER_COOL,
      spine: [[-110, 560], [-30, 440], [40, 340], [80, 260], [104, 190], [116, 120], [128, 60], [150, 10]],
      trunkWidth: 64, taper: 0.35, flare: 0.1,
      limbs: [
        { pts: [[140, 150], [205, 150], [261, 162], [324, 186], [398, 205], [473, 224], [518, 238]], w: 26, subs: 4 },
        { pts: [[146, 86], [205, 66], [261, 68], [320, 84], [360, 100]], w: 16, subs: 2 },
        { pts: [[132, 104], [62, 98], [10, 108], [-30, 112]], w: 16, subs: 2 },
        { pts: [[104, 290], [60, 250], [10, 232], [-30, 228]], w: 20, subs: 2 },
        { pts: [[128, 210], [80, 186], [30, 176], [-20, 176]], w: 14, subs: 1 },
        { pts: [[150, 46], [110, 24], [60, 14], [20, 16]], w: 12, subs: 1 },
        { pts: [[152, 44], [200, 20], [250, 12]], w: 10, subs: 1 },
        { pts: [[300, 180], [330, 230], [372, 268], [420, 292]], w: 8, subs: 1 },
      ],
      padSize: 104, needle: 13, padDensity: 2.0, haze: 0.2, wet: 0.25, under: 0.9, needleWidth: 0.15, needles: 11, fanSpacing: 0.9, swayAmp: 3, swayFreq: 0.18, caps: { cap: 26, mound: 13, blur: 12, freq: 0.03, bumps: 0.07, lobes: 0.7, flat: [0.1, 0.6] },
    });
    layers.push(pine.layer({ z: 1 }));
    layers.push(snow[3], snow[4]);
    tm('build');

    return {
      layers,
      camera: (t) => ({ x: 0, y: 0, dolly: -0.0045 * (t - 3), zoom: 1, roll: 0 }),
      grade: { vignette: 0.03 },
      meta: { clear: [0.94, 0.918, 0.886] },
    };
  },
};
