// s01 - Cranes over the falls (ref 01).
// Hero pine top-left, red two-tier pavilion on the cliff, waterfall in the left cliff,
// three cranes flying right, layered misty peaks right, lake with islands and reflections.
// Camera: slow pan right following the cranes. Composition matches the reference at t = 3
// (camera at rest there).
import { makeSky, makeMist, makeWaterFog } from '../lib/atmos.js';
import { makeMountains } from './s01/mountains.js';
import { makePine, paintConifer } from '../lib/pine.js';
import { cliff, bakeRocks } from '../lib/rock.js';
import { makeWaterfall, makeLake, makeGlitter, makeReflection } from '../lib/water.js';
import { bakeArch, paintPavilion } from '../lib/architecture.js';
import { makeMaple } from '../lib/flora.js';
import { makeCraneFlock } from '../lib/fauna.js';
import { paintIsland, bakeInked } from './s01/islands.js';
import { inkify } from '../lib/inkfx.js';
import { paintFoliageBand } from './s01/foliage.js';
import { paintCliffFace } from './s01/cliffface.js';

const PAPER = [239, 231, 220];
const T0 = 3;              // time at which the camera is at rest (reference composition)
const PAN = 16;            // camera pan speed at the picture plane, px/s
const D = Math.PI / 180;

// Rest-space design px (= screen px at t = 3; camera x = 16 (t - 3), y = -1.5 (t - 3); z noted).
export const FACTS = {
  camera: { T0, pan: [PAN, -1.5] },
  waterfall: [502, 596],          // lip centre (z 1.2); curtain falls to y ~870
  waterfallMid: [515, 730],
  sprayBase: [536, 905],          // spray mist billows here (z 1.2)
  pavilion: [280, 412],           // z 1.2
  cranes: [[1131, 283], [1286, 247], [1429, 184]],   // at t = 3 (z 2), flying +54 px/s x, -6 px/s y
  mainPeak: [1487, 480],          // z 3.2
  lakeY: 812,
  bloomSeeds: [[70, 420], [250, 860]],              // pine trunk, lower-left foliage mass
};

export default {
  id: 's01', title: 'Cranes over the falls', ref: '01',
  build(api) {
    const layers = [];
    layers.push(makeSky(api, { variant: 'rice' }));

    // ---------------------------------------------------------------- far ranges (right, top)
    // ---------------------------------------------------------------- far ranges (right, top)
    const far = makeMountains(api, { rect: [960, 170, 1200, 400], fade: [0.2, 0.8], trees: 0.3, treeH: 11, body: 1.0, detail: 0.3, ink: { edge: 0.12 }, peaks: [
      { x: 1230, top: 410, wl: 300, wr: 160, base: 560, tone: 0.24, seed: 1 },
      { x: 1390, top: 345, wl: 170, wr: 140, base: 550, tone: 0.3, seed: 2 },
      { x: 1581, top: 305, wl: 170, wr: 160, base: 540, tone: 0.38, seed: 3, detail: 0.45 },
      { x: 1804, top: 230, wl: 180, wr: 240, base: 540, tone: 0.5, seed: 4, treeH: 13, detail: 0.55 },
    ] });
    layers.push(far.layer({ z: 8, name: 'far' }));
    layers.push(makeMist(api, { top: 430, bottom: 640, z: 7.5, lobe: 70, seed: 1, drift: 6, density: 0.45, holes: 0.4, softness: 16, shade: 0.08 }));

    // distant pale hills behind the falls and in the centre
    const hills = makeMountains(api, { rect: [360, 400, 1060, 300], fade: [0.15, 0.75], trees: 0.3, treeH: 10, a: 2.0, b: 1.2, rough: 1.2, knobAmp: 0.15, detail: 0.4, ink: { edge: 0.15 }, peaks: [
      { x: 1220, top: 455, wl: 220, wr: 170, base: 650, tone: 0.36, seed: 11 },
      { x: 1080, top: 500, wl: 190, wr: 130, base: 660, tone: 0.32, seed: 12 },
      { x: 560, top: 520, wl: 170, wr: 150, base: 660, tone: 0.28, seed: 13, moss: 1.5, knobs: 1 },
      { x: 690, top: 482, wl: 170, wr: 160, base: 660, tone: 0.34, seed: 14, moss: 1.5, knobs: 2 },
      { x: 820, top: 538, wl: 170, wr: 150, base: 670, tone: 0.26, seed: 15, moss: 1.5, knobs: 1 },
      { x: 940, top: 562, wl: 120, wr: 160, base: 680, tone: 0.24, seed: 16, moss: 1.5, knobs: 0 },
    ] });
    layers.push(hills.layer({ z: 6, name: 'hills' }));

    const midFar = makeMountains(api, { rect: [1380, 300, 800, 400], fade: [0.28, 0.85], trees: 1.0, treeH: 16, body: 1.3, crownBush: 0.45, ink: { edge: 0.2 }, peaks: [
      { x: 1600, top: 430, wl: 140, wr: 110, base: 660, tone: 0.52, seed: 21 },
      { x: 1880, top: 420, wl: 150, wr: 200, base: 670, tone: 0.56, seed: 22 },
      { x: 1701, top: 369, wl: 200, wr: 190, base: 670, tone: 0.7, seed: 23 },
    ] });
    layers.push(midFar.layer({ z: 5, name: 'midfar' }));
    layers.push(makeMist(api, { top: 580, bottom: 750, z: 4.6, lobe: 70, seed: 2, drift: 8, density: 0.5, holes: 0.35, softness: 16, shade: 0.08 }));

    const mid = makeMountains(api, { rect: [1100, 400, 1060, 470], fade: [0.42, 0.95], trees: 1.4, treeH: 30, body: 1.8, cun: 1.4, skirt: 0.62, crownBush: 0.7, peaks: [
      { x: 1620, top: 525, wl: 120, wr: 170, base: 810, tone: 0.86, seed: 31, moss: 1.5 },
      { x: 1264, top: 598, wl: 80, wr: 85, base: 800, tone: 0.72, seed: 32, knobs: 0 },
      { x: 1487, top: 480, wl: 150, wr: 160, base: 810, tone: 0.95, seed: 33, treeH: 30, moss: 1.6 },
      { x: 1412, top: 552, wl: 80, wr: 70, base: 810, tone: 0.84, seed: 34 },
      { x: 1880, top: 648, wl: 130, wr: 170, base: 850, tone: 0.84, seed: 35, trees: 1.3, treeH: 40, moss: 1.6 },
    ] });
    layers.push(mid.layer({ z: 3.2, name: 'mid' }));
    layers.push(makeMist(api, { top: 735, bottom: 855, z: 3, lobe: 60, seed: 3, drift: 10, density: 0.6, holes: 0.3, softness: 14, shade: 0.1 }));
    // ---------------------------------------------------------------- lake, islands, reflections
    const Y = 812;
    layers.push(makeLake(api, { y: Y, variant: 'plain', paper: PAPER, z: 2 }));
    const isl = (x0, x1, base, h, trees, v, treeH, seed, refl) => {
      const rr = api.rng(seed);
      const pad = 40, top = Math.round(base - h - treeH * 1.3);
      const rect = [x0 - pad, top, x1 - x0 + pad * 2, base - top + 4];
      const src = bakeInked(api, rect[2], rect[3], (ctx) => { ctx.translate(-rect[0], -rect[1]); paintIsland(ctx, rr, { x0, x1, baseY: base, h, trees, v, treeH }); });
      return [makeReflection(api, src, { rect, y: base, z: 2, paper: PAPER, ...refl }), api.tex(src, { rect, z: 2 })];
    };
    layers.push(...isl(1015, 1160, 826, 18, 5, 0.35, 26, 21, { strength: 0.45, amp: 2 }));
    layers.push(...isl(1090, 1300, 840, 22, 7, 0.28, 30, 22, { strength: 0.5, amp: 2 }));
    layers.push(...isl(1564, 1890, 900, 42, 9, 0.1, 50, 23, { strength: 0.6, amp: 2.5 }));
    layers.push(...isl(930, 1190, 922, 50, 9, 0.12, 52, 24, { strength: 0.55, amp: 2.5 }));
    layers.push(makeGlitter(api, { y: Y, variant: 'plain', paper: PAPER, z: 2, sheen: 0.3, occluders: [[1015, 1160, 826, 8], [1090, 1300, 840, 8], [1564, 1890, 900, 8], [930, 1190, 922, 8]] }));
    layers.push(makeWaterFog(api, { top: 800, z: 1.9, seed: 4, wisp: 0.3, wispsAbove: 0.1 }));

    // ---------------------------------------------------------------- middle crags right of the falls
    const crags = makeMountains(api, { rect: [560, 560, 640, 400], fade: [0.6, 1.05], trees: 0, moss: 2.2, body: 1.9, skirt: 0.5, a: 1.9, b: 1.05, detail: 1, peaks: [
      { x: 1000, top: 772, wl: 150, wr: 170, base: 940, tone: 0.7, seed: 43 },
      { x: 715, top: 632, wl: 110, wr: 430, aR: 1.25, b: 1.0, base: 940, tone: 0.93, seed: 42, knobsL: 1, knobsR: 3, lean: 0, shDecay: [0.6, 0.72] },
    ] });
    layers.push(crags.layer({ z: 1.5, name: 'crags' }));
    // conifers crowning the crags (back rows paler)
    const cfRect = [580, 520, 600, 320];
    const cfRaw = api.bakeCanvas(cfRect[2], cfRect[3], (ctx) => {
      ctx.translate(-cfRect[0], -cfRect[1]);
      const r = api.rng(91), nz = api.noise(92);
      for (let x = 640; x < 1120; x += r.range(7, 16)) {
        const y = crags.topAt(x);
        if (y > 900) continue;
        const dist = (x - 640) / 480;                         // farther crags are paler and smaller
        if (r() > 0.95 - 0.3 * dist + 0.3 * nz.n2(x / 60, 1)) continue;
        const h = (34 + 40 * r() * r()) * (1 - 0.4 * dist);
        paintConifer(ctx, x, y + h * 0.2 + r.range(0, 14), h, { kind: r() < 0.7 ? 'fir' : 'pine', tone: 0.04 + 0.22 * dist + r.range(0, 0.1), paper: PAPER, seed: (r() * 1e6) | 0 });
      }
    });
    layers.push(api.tex(inkify(api, cfRaw, { edge: 0.35, granulation: 0.15, bleed: 0.8 }), { rect: cfRect, z: 1.5, name: 'crag-trees', sway: { amp: 1, freq: 0.22, scale: 160, power: 1.5, anchor: [860, 900], radius: 300 } }));

    // ---------------------------------------------------------------- left cliff
    const upperOutline = [[-180, 520], [-20, 500], [60, 482], [140, 476], [205, 472], [280, 474], [345, 470], [372, 452], [398, 458], [412, 482], [430, 500],
        [452, 520], [458, 596], [548, 596], [556, 588], [585, 584], [612, 588], [640, 600], [662, 640], [672, 720], [680, 800], [690, 900], [700, 1000], [-180, 1000]];
    const lowerOutline = [[-180, 650], [0, 632], [60, 658], [120, 690], [180, 716], [240, 728], [300, 766], [340, 812], [360, 878], [420, 888], [480, 926], [540, 958], [600, 990], [660, 1030], [730, 1090], [730, 1200], [-180, 1200]];
    const upper = cliff({
      seed: 11,
      outline: [[-180, 520], [-20, 500], [60, 482], [140, 476], [205, 472], [280, 474], [345, 470], [372, 452], [398, 458], [412, 482], [430, 500],
        [452, 520], [458, 596], [548, 596], [556, 588], [585, 584], [612, 588], [640, 600], [662, 640], [672, 720], [680, 800], [690, 900], [700, 1000], [-180, 1000]],
      columns: [{ x: 150 }, { x: 205, tone: -0.1 }, { x: 292 }, { x: 352 }, { x: 402, tone: 0.35, dark: 0.25 }, { x: 590, tone: 0.1, dark: 0.25 }],
      firstColumn: { tone: 0.15, dark: 0.1 },
      notch: { x0: 455, x1: 552, y: 596, bottom: 900, tone: 0.8, dark: 0.85 },
      fade: [[0, 780, 1000], [300, 770, 920], [450, 780, 900], [600, 760, 900], [700, 740, 880]],
      tone: 0.22, shadow: 0.5, moss: 1.3, foliage: 1.4, ledges: 0, streak: 0.15,
      tufts: [[420, 520, 46], [440, 530, 30], [522, 598, 30], [568, 588, 56], [600, 590, 62], [632, 600, 44], [655, 620, 30]],
    });
    const lower = cliff({
      seed: 12,
      outline: lowerOutline,
      columns: [{ x: 60 }, { x: 175 }, { x: 350 }, { x: 520 }],
      fade: [[0, 1060, 1180], [300, 1080, 1190], [700, 1080, 1190]],
      tone: 0.3, shadow: 0.45, moss: 1.0, mossSize: 1.2, foliage: 1.0, grain: 70,
    });
    const rock = bakeRocks(api, { rect: [-180, 380, 920, 830], items: [upper, lower], seed: 3, texture: 0.65, cun: 0.3, far: 0.22 });

    const falls = makeWaterfall(api, {
      lip: [[456, 594], [548, 598]], height: 320, bendL: 26, bendR: 14, curve: 7, driftL: 8, driftR: 26, arch: 3, fade: 0.85,
      speed: 230, z: 1.2, seed: 2.1, sheets: 2, streakScale: 5, thin: 0.35, sideShade: 0.2, spray: { amount: 0.9, rise: 130, width: 160, shade: 0.06 },
    });
    layers.push(rock.layer({ z: 1.2, name: 'cliff' }));
    // brushwork overlay on the cliff: column crevices, shaded faces, mottling, moss along the tops
    const cfaceRect = [-160, 380, 900, 760];
    const cfaceRaw = api.bakeCanvas(cfaceRect[2], cfaceRect[3], (ctx, { k }) => {
      ctx.translate(-cfaceRect[0], -cfaceRect[1]);
      const nz = api.noise(55);
      paintCliffFace(ctx, api.rng(54), nz, { outline: upperOutline, hole: [455, 596, 97, 420], tone: 0.9, veil: 0.24, fade: [820, 960], paper: PAPER, k, moss: 1.2, caps: 1, dabs: 1.2, skipTop: [[205, 352], [446, 558]],
        columns: [{ x: 30, len: 170, dark: 0.3 }, { x: 95, len: 250, dark: 0.55 }, { x: 150, len: 300, dark: 0.22 }, { x: 205, len: 220, dark: 0.6, w: 60 }, { x: 292, len: 320, dark: 0.28 }, { x: 352, len: 200, dark: 0.45 },
          { x: 402, len: 300, dark: 0.65, crack: 5, w: 60 }, { x: 452, len: 340, dark: 0.75, crack: 5, w: 50 }, { x: 600, len: 300, dark: 0.7, crack: 5, w: 50 }, { x: 645, len: 260, dark: 0.45 }] });
      paintCliffFace(ctx, api.rng(56), nz, { outline: lowerOutline, tone: 0.85, veil: 0.45, fade: [990, 1110], paper: PAPER, k, moss: 1, caps: 0.6, dabs: 0.9,
        columns: [{ x: 20, len: 260 }, { x: 80, len: 240, dark: 0.5 }, { x: 150, len: 260 }, { x: 220, len: 240, dark: 0.5 }, { x: 290, len: 200 }, { x: 350, len: 180 }, { x: 430, len: 160 }, { x: 520, len: 140 }] });
    });
    layers.push(api.tex(inkify(api, cfaceRaw, { edge: 0.3, granulation: 0.15, bleed: 0.8 }), { rect: cfaceRect, z: 1.2, name: 'cliff-face' }));
    layers.push(...falls.layers);

    // dense foliage over the lower-left slope and the cliff ledges
    const folRect = [-160, 440, 900, 780];
    const folRaw = api.bakeCanvas(folRect[2], folRect[3], (ctx, { k }) => {
      ctx.translate(-folRect[0], -folRect[1]);
      const r = api.rng(77), nz = api.noise(78);
      paintFoliageBand(ctx, r, nz, [[-150, 600], [-40, 612], [60, 642], [150, 684], [230, 724], [300, 764], [350, 830], [420, 880], [500, 922], [570, 962], [650, 1010], [720, 1080]],
        { band: 70, size: [16, 34], density: 1.5, v: 0.04, paper: PAPER, k, pines: 0.5, back: 0.06 });
      // dense dark clusters (under the maple, mid slope, lower right, bottom pines in the mist)
      paintFoliageBand(ctx, r, nz, [[-140, 640], [-40, 650], [60, 680], [130, 720]], { band: 90, size: [20, 40], density: 2.2, v: 0.03, paper: PAPER, k, pines: 0.25, back: 0.05 });
      paintFoliageBand(ctx, r, nz, [[150, 720], [230, 750], [300, 800], [340, 860]], { band: 110, size: [20, 42], density: 2.2, v: 0.03, paper: PAPER, k, pines: 0.35, back: 0.05 });
      paintFoliageBand(ctx, r, nz, [[200, 880], [280, 900], [360, 950], [420, 1000], [470, 1080]], { band: 140, size: [22, 44], density: 2.1, v: 0.03, paper: PAPER, k, pines: 0.4, back: 0.05 });
      paintFoliageBand(ctx, r, nz, [[-140, 770], [-60, 800], [20, 860], [80, 930]], { band: 100, size: [22, 44], density: 2.2, v: 0.03, paper: PAPER, k, pines: 0.3, back: 0.05 });
      paintFoliageBand(ctx, r, nz, [[-140, 900], [-40, 960], [40, 1040], [100, 1120]], { band: 120, size: [22, 44], density: 3.0, v: 0.03, paper: PAPER, k, pines: 0.3, back: 0.05 });
      paintFoliageBand(ctx, r, nz, [[400, 950], [480, 975], [560, 1010], [640, 1060]], { band: 110, size: [18, 34], density: 2.0, v: 0.05, paper: PAPER, k, pines: 0.7, back: 0.08 });
      // dark foliage cloaking the left end of the cliff top (ref: only the middle columns show bare rock)
      paintFoliageBand(ctx, r, nz, [[-150, 540], [-70, 528], [10, 534], [80, 552], [130, 580]], { band: 110, size: [18, 36], density: 1.8, v: 0.04, paper: PAPER, k, pines: 0.3, back: 0.06 });
      paintFoliageBand(ctx, r, nz, [[70, 506], [130, 490], [205, 484]], { band: 24, size: [8, 18], density: 2.2, v: 0.04, paper: PAPER, k, pines: 0.15, back: 0.08 });
      paintFoliageBand(ctx, r, nz, [[348, 482], [372, 468], [400, 474], [430, 506]], { band: 24, size: [8, 18], density: 2.2, v: 0.04, paper: PAPER, k, pines: 0.1, back: 0.08 });
    });
    const fol = inkify(api, folRaw, { edge: 0.4, granulation: 0.15, bleed: 0.9 });
    layers.push(api.tex(fol, { rect: folRect, z: 1.15, name: 'foliage', sway: { amp: 1.2, freq: 0.25, scale: 200, power: 1.5, anchor: [300, 1080], radius: 600 } }));
    layers.push(makeMist(api, { top: 830, bottom: 1140, z: 1.12, lobe: 80, seed: 5, drift: 12, density: 0.9, softness: 16, shade: 0.05, wisp: 0.1, wispsAbove: 0.1, extent: [480, 1000, 160] }));

    // ---------------------------------------------------------------- pavilion and maples
    const pavRect = [160, 300, 240, 200];
    const pav = bakeArch(api, pavRect, (ctx) => paintPavilion(ctx, { x: 280, y: 468, w: 140, seed: 3 }));
    layers.push(api.tex(pav, { rect: pavRect, z: 1.2, name: 'pavilion' }));
    const mapleTop = makeMaple(api, { seed: 101, paper: PAPER, trees: [
      { x: 396, y: 476, height: 70, width: 95, lean: 4, shape: 'round', crown: [408, 452, 46, 32], leafSize: 3.0, density: 1.5, pale: 0.4, depth: 5 },
    ] });
    const mapleLow = makeMaple(api, { seed: 102, paper: PAPER, trees: [
      { x: 112, y: 716, height: 100, width: 120, lean: 6, shape: 'round', crown: [138, 662, 58, 42], leafSize: 3.8, density: 1.5, depth: 5, pale: 0.3 },
      { x: 18, y: 664, height: 80, width: 70, lean: -5, shape: 'round', crown: [24, 612, 34, 30], leafSize: 3.6, density: 1.5, pale: 0.35, depth: 5 },
    ] });
    layers.push(mapleTop.layer({ z: 1.2, amp: 1.5 }), mapleLow.layer({ z: 1.2, amp: 2 }));

    // ---------------------------------------------------------------- hero pine
    const pine = makePine(api, {
      seed: 11, height: 640, gnarl: 0.75, scale: 1,
      spine: [[-60, 660], [-5, 560], [50, 470], [105, 385], [165, 315], [235, 268], [310, 240]],
      trunkWidth: 100, taper: 0.36, flare: 0.1,
      limbs: [
        { pts: [[300, 242], [380, 218], [460, 205], [540, 204], [610, 218], [680, 240], [750, 256], [815, 264]], w: 32, subs: 6 },
        { pts: [[30, 500], [14, 400], [12, 300], [26, 215], [62, 152], [125, 108], [205, 84], [300, 64], [390, 50], [460, 46]], w: 52, subs: 5 },
        { pts: [[245, 262], [268, 208], [300, 170], [352, 144], [420, 134], [480, 140]], w: 22, subs: 3 },
        { pts: [[62, 152], [32, 112], [0, 92], [-40, 84]], w: 18, subs: 1 },
        { pts: [[560, 206], [576, 250], [594, 296], [612, 330]], w: 9, subs: 1, pad: 0.6 },
      ],
      padSize: 80, padAspect: 0.5, needle: 13, padDensity: 3.4, haze: 0.18, wet: 0.35, soft: 0.18, core: 0.22, needleWidth: 0.15, barkTone: 0.6, barkDensity: 1.6, knobs: 0.5,
      swayAmp: 4, swayFreq: 0.2,
    });
    const pineLayer = pine.layer({ z: 1 });

    // ---------------------------------------------------------------- cranes
    const base = [
      { x: 1131, y: 283, size: 128, heading0: -15 * D, phase: 0.0, vx: 52, vy: -6, seed: 1 },
      { x: 1286, y: 247, size: 129, heading0: -13 * D, phase: 0.5, vx: 56, vy: -5, seed: 2 },
      { x: 1429, y: 184, size: 130, heading0: -14.6 * D, phase: 0.0, vx: 54, vy: -7, seed: 3 },
    ];
    const CZ = 2;
    // place each bird so it is at its reference spot (and wing pose) at t = T0
    const shifted = base.map((c) => ({ ...c, x: c.x - c.vx * T0, y: c.y - c.vy * T0 }));
    const probe = makeCraneFlock(api, { cranes: shifted, z: CZ, paper: PAPER });
    const st = probe.stateAt(T0);
    const cranes = shifted.map((c, i) => ({ ...c, phase: c.phase - (st[i].phase - c.phase) }));
    // cranes fly behind the pine (they pass its branch tips around t = -3)
    layers.push(makeCraneFlock(api, { cranes, z: CZ, paper: PAPER }));
    layers.push(pineLayer);

    return {
      layers,
      camera: (t) => ({ x: PAN * (t - T0), y: -1.5 * (t - T0), dolly: 0, zoom: 1, roll: 0 }),
      meta: { clear: PAPER.map((v) => v / 255) },
    };
  },
};