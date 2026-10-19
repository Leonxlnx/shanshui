// s09 left side: the temple cliff (overlapping granite columns, dark pine clumps, red maples),
// the waterfall, mist between the columns, and the hero pine top-left.
import { cliff } from '../../lib/rock.js';
import { makeWaterfall } from '../../lib/water.js';
import { paintTemple, bakeArch } from '../../lib/architecture.js';
import { makePine, paintPine, paintTreeLine, paintConifer } from '../../lib/pine.js';
import { paintMaple } from '../../lib/flora.js';
import { softMist } from './fx.js';
import { paintClump } from './foliage.js';
import { inkify } from '../../lib/inkfx.js';
import { makePeaks } from './peaks.js';
import { BRUSH, WET } from './style.js';

export const Z_BACK = 1.25, Z_FRONT = 1.12;
export const FALLS = { lip: [[282, 537], [346, 539]], height: 300 };

const ROCK = { tone: 0.1, dark: 0.15, shadow: 0.85, moss: 1.8, foliage: 2.0, ledges: 0, topDark: 0.6, topDepth: 70, streak: 0.12, speckle: 1.0, cun: 1.3, grain: 88,
  cunMix: { drip: 0.08, axe: 0.25, hair: 0.12, dot: 0.15, dapple: 0.4 } };

export function buildLeft(api, { paper }) {
  const back = [], front = [];

  // ---------------------------------------------------------------- back columns (z Z_BACK)
  const cTemple = cliff({
    seed: 31, ...ROCK, tone: 0.2, moss: 0.9, foliage: 1.2,
    outline: [[-160, 404], [-80, 392], [0, 386], [50, 398], [90, 424], [140, 440], [230, 446], [292, 452], [300, 540], [296, 700], [290, 820], [-160, 820]],
    columns: [{ x: -20 }, { x: 60, tone: -0.1 }, { x: 150 }, { x: 230, tone: 0.1 }], fade: [[-160, 470, 590], [90, 500, 640], [200, 620, 780], [300, 680, 810]],
    tufts: [[20, 390, 40]],
  });
  const cBig = cliff({
    seed: 32, ...ROCK, tone: 0.16,
    outline: [[334, 500], [338, 462], [356, 436], [392, 420], [436, 418], [474, 434], [500, 470], [514, 540], [514, 580], [512, 700], [506, 830], [500, 960], [334, 960], [338, 800], [336, 620]],
    columns: [{ x: 350, tone: -0.15, dark: 0.3 }, { x: 410 }, { x: 465, tone: 0.1 }], firstColumn: { tone: -0.1, dark: 0.25 },
    fade: [[334, 800, 950], [514, 820, 955]],
    tufts: [[350, 452, 40], [500, 480, 36]],
  });
  const cRight = cliff({
    seed: 33, ...ROCK, tone: 0.2,
    outline: [[486, 640], [516, 616], [570, 608], [612, 618], [634, 650], [640, 720], [636, 840], [630, 990], [486, 990]],
    columns: [{ x: 540 }, { x: 595, tone: 0.1 }], fade: [[486, 850, 985], [640, 860, 985]],
    tufts: [[620, 630, 36]],
  });
  // the back granite columns are painted in the same 'cun' pillar style as the peaks (rounded tops,
  // dark ragged contours, hemp-fibre strokes, lit facets); rock.js outlines above are kept for reference
  void cTemple; void cBig; void cRight;
  const LC = { ...BRUSH, trees: 0, mossK: 2.6, valK: 2.1, washK: 3.4, litK: 0.5, cunK: 1.1 };
  const rockB = makePeaks(api, {
    paper, wet: WET, rect: [-240, 300, 940, 720],
    peaks: [
      { ...LC, x: -60, top: 388, base: 960, tone: 0.07, seed: 131, fade: 0.72, columns: [{ dx: 0, top: 388, hw: 96, lit: 0.35, spread: 0.15, tips: 1 }] },
      { ...LC, x: 168, top: 444, base: 980, tone: 0.06, seed: 132, fade: 0.72, columns: [{ dx: 0, top: 444, hw: 132, cap: 'flat', capH: 22, lit: 0.5, spread: 0.1, lean: 0.03 }] },
      { ...LC, x: 426, top: 418, base: 1000, tone: 0.05, seed: 133, fade: 0.76, columns: [{ dx: 0, top: 418, hw: 88, lit: 0.42, spread: 0.12, tips: 1, lean: 0 }] },
      { ...LC, x: 566, top: 608, base: 1000, tone: 0.08, seed: 134, fade: 0.7, columns: [{ dx: 0, top: 608, hw: 70, lit: 0.6, spread: 0.12, tips: 1 }] },
    ],
  });
  back.push(rockB.layer({ z: Z_BACK, name: 'cliff-back' }));

  // waterfall in front of the back columns
  const falls = makeWaterfall(api, {
    lip: FALLS.lip, height: FALLS.height, bendL: 26, bendR: 40, curve: 5, driftL: 4, driftR: 22, arch: 3,
    speed: 220, z: Z_BACK, seed: 9.1, sheets: 2, streakScale: 4, thin: 0.25, sideShade: 0.1, fade: 0.78, lineWidth: 1.6,
    spray: false, paper,
  });
  back.push(...falls.layers);

  // temple + back foliage (cliff-top pine clumps, maples), drawn on the back plane
  const templeRect = [60, 250, 400, 230];
  back.push(api.tex(bakeArch(api, templeRect, (ctx) => {
    paintTemple(ctx, { x: 244, y: 438, w: 186, seed: 9, stairs: 'left', paper, sides: [{ dx: -0.5, dy: -0.06, w: 0.4, turn: -0.6 }] });
  }), { rect: templeRect, z: Z_BACK, name: 'temple' }));

  const fb = api.bakeCanvas(800, 420, (ctx) => {
    ctx.translate(100, -340);
    paintClump(ctx, [[322, 470], [356, 438], [400, 426], [450, 430], [490, 452], [512, 486]], { h: [56, 104], tone: 0.07, seed: 41, paper, under: 0.6 });
    paintClump(ctx, [[490, 650], [540, 626], [590, 620], [640, 636]], { h: [44, 80], tone: 0.08, seed: 42, paper, under: 0.6 });
    paintClump(ctx, [[600, 680], [630, 740], [640, 800]], { h: [34, 60], tone: 0.05, spacing: 0.8, seed: 47, paper, under: 0.6 });
    paintClump(ctx, [[-20, 396], [40, 398], [100, 430], [150, 448]], { h: [40, 76], tone: 0.08, seed: 43, paper, under: 0.6 });
    paintClump(ctx, [[160, 546], [220, 526], [280, 552]], { h: [28, 52], tone: 0.05, seed: 44, paper, under: 0.7 });
    paintMaple(ctx, { x: 372, y: 450, height: 62, width: 70, lean: 10, seed: 51, paper, leafSize: 2.6 });
    paintMaple(ctx, { x: 128, y: 410, height: 70, width: 60, lean: -10, seed: 52, paper, leafSize: 2.6 });
    paintMaple(ctx, { x: 532, y: 655, height: 66, width: 78, lean: 15, seed: 53, paper, leafSize: 2.6 });
  });
  back.push(api.tex(inkify(api, fb, { edge: 0.35, granulation: 0.35, bleed: 0.9 }), { rect: [-100, 340, 800, 420], z: Z_BACK, name: 'cliff-trees-back' }));

  // mist between the back columns and the front mass (foot of the falls)
  back.push(softMist(api, { cx: 250, cy: 790, rx: 90, ry: 120, z: (Z_BACK + Z_FRONT) / 2, seed: 10, drift: 5, density: 0.95, scale: 60, color: paper, name: 'mist-gap' }));
  back.push(softMist(api, { cx: 360, cy: 840, rx: 170, ry: 60, z: (Z_BACK + Z_FRONT) / 2, seed: 8, drift: 7, density: 0.95, scale: 70, color: paper, name: 'mist-falls' }));
  back.push(softMist(api, { cx: 580, cy: 960, rx: 150, ry: 80, z: (Z_BACK + Z_FRONT) / 2, seed: 9, drift: 7, density: 0.9, scale: 80, color: paper, name: 'mist-right' }));

  // ---------------------------------------------------------------- front mass (z Z_FRONT)
  const cFrontL = cliff({
    seed: 34, ...ROCK, tone: 0.16, shadow: 0.75,
    outline: [[-160, 610], [-80, 592], [0, 580], [70, 584], [130, 600], [168, 628], [188, 672], [196, 740], [204, 840], [214, 960], [224, 1100], [230, 1420], [-160, 1420]],
    columns: [{ x: -40 }, { x: 50, tone: -0.1 }, { x: 130, tone: 0.1 }], firstColumn: { tone: 0.05 },
    fade: [[-160, 1280, 1410], [240, 1200, 1400]],
    tufts: [[170, 632, 34]],
  });
  const cFrontC = cliff({
    seed: 35, ...ROCK, tone: 0.18, shadow: 0.75,
    outline: [[214, 900], [250, 872], [306, 862], [356, 874], [392, 908], [404, 980], [410, 1080], [416, 1420], [214, 1420]],
    columns: [{ x: 270 }, { x: 340, tone: 0.1 }],
    fade: [[214, 1250, 1410], [416, 1150, 1380]],
  });
  void cFrontL; void cFrontC;
  const rockF = makePeaks(api, {
    paper, wet: WET, rect: [-260, 500, 760, 940],
    peaks: [
      { ...LC, x: 20, top: 582, base: 1420, tone: 0.05, seed: 135, fade: 0.78, columns: [{ dx: 0, top: 582, hw: 150, lit: 0.45, spread: 0.12, tips: 1, lean: 0.02 }] },
      { ...LC, x: 312, top: 864, base: 1420, tone: 0.06, seed: 136, fade: 0.72, columns: [{ dx: 0, top: 864, hw: 98, lit: 0.5, spread: 0.1, tips: 1 }] },
    ],
  });
  front.push(rockF.layer({ z: Z_FRONT, name: 'cliff-front' }));

  const ff = api.bakeCanvas(640, 680, (ctx) => {
    ctx.translate(20, -420);
    // small hero pine on the front mass
    paintPine(ctx, {
      seed: 61, height: 200, gnarl: 0.85,
      spine: [[150, 690], [140, 655], [124, 625], [108, 600], [96, 582]],
      trunkWidth: 15, taper: 0.5, flare: 0.2,
      limbs: [
        { pts: [[112, 606], [150, 596], [192, 600], [236, 610]], w: 8, subs: 3 },
        { pts: [[100, 588], [70, 578], [30, 576], [-10, 584]], w: 8, subs: 3 },
        { pts: [[98, 584], [104, 566], [124, 556], [150, 556]], w: 6, subs: 2 },
        { pts: [[130, 640], [100, 630], [60, 634]], w: 6, subs: 1 },
      ],
      padSize: 52, needle: 9, padDensity: 2.2, haze: 0.05, barkTone: 0.4, paper,
    });
    paintClump(ctx, [[-20, 604], [40, 590], [100, 600]], { h: [36, 64], tone: 0.03, seed: 62, paper });
    paintClump(ctx, [[140, 640], [175, 660], [196, 700]], { h: [36, 60], tone: 0.03, seed: 63, paper });
    paintClump(ctx, [[236, 888], [296, 868], [352, 874], [396, 908]], { h: [50, 90], tone: 0.02, seed: 64, paper });
    paintClump(ctx, [[400, 964], [450, 948], [515, 964]], { h: [50, 90], tone: 0.04, seed: 65, paper });
    paintClump(ctx, [[0, 760], [10, 860], [30, 960]], { h: [30, 56], tone: 0.06, spacing: 0.9, seed: 68, paper, under: 0.6 });
    // dark pine mass low on the left (ref: big pines at the bottom-left corner)
    paintClump(ctx, [[-30, 1000], [40, 968], [110, 980], [180, 1010]], { h: [80, 140], tone: 0.05, spacing: 0.4, seed: 69, paper, under: 0.7 });
    paintMaple(ctx, { x: 196, y: 712, height: 74, width: 92, lean: 25, seed: 66, paper, leafSize: 2.8 });
    paintMaple(ctx, { x: 405, y: 950, height: 70, width: 86, lean: 20, seed: 67, paper, leafSize: 2.8 });
  });
  front.push(api.tex(inkify(api, ff, { edge: 0.35, granulation: 0.35, bleed: 0.9 }), { rect: [-20, 420, 640, 680], z: Z_FRONT, name: 'cliff-trees-front' }));

  // ---------------------------------------------------------------- hero pine top-left (z 1)
  const pine = makePine(api, {
    seed: 19, height: 400, gnarl: 0.75,
    spine: [[-20, 440], [8, 380], [34, 316], [60, 254], [80, 204], [98, 160], [110, 126], [118, 100]],
    trunkWidth: 30, taper: 0.4, flare: 0.15,
    limbs: [
      { pts: [[92, 236], [150, 224], [222, 216], [296, 226], [368, 242], [445, 262]], w: 13, subs: 4 },
      { pts: [[116, 104], [166, 84], [226, 74], [290, 82]], w: 11, subs: 3 },
      { pts: [[114, 106], [80, 84], [42, 72], [8, 80]], w: 11, subs: 3 },
      { pts: [[104, 172], [150, 162], [204, 168]], w: 8, subs: 2 },
      { pts: [[56, 296], [26, 276], [-6, 262]], w: 9, subs: 2 },
    ],
    padSize: 88, needle: 12, padDensity: 2.6, haze: 0.1, swayAmp: 3, swayFreq: 0.2, barkTone: 0.4, paper,
  });
  return { back, front, pine: pine.layer({ z: 1 }), falls };
}
