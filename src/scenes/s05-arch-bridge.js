// s05 - Stone arch bridge, red sun (ref 05).
// Pine and red maple on the left bank, three-arch stone bridge reflected in still water, island
// with pavilion and trees, small red sun with a faint red reflection, soft far mountains, mist.
// Camera: slow push-in (dolly only, so the sky / sun stay fixed for the incoming sun match).
// Composition matches the reference at t = 3 (camera at rest).
import { makeSky, makeSun, makeSkyStreaks, makeMist, makeWaterFog } from '../lib/atmos.js';
import { makePine, paintTreeLine, paintConifer } from '../lib/pine.js';
import { cliff, bakeRocks } from '../lib/rock.js';
import { makeLake, makeGlitter, makeReflection } from '../lib/water.js';
import { bakeArch, paintArchBridge, paintPavilion, archBounds } from '../lib/architecture.js';
import { makeMaple, withBlur } from '../lib/flora.js';
import { inkify } from '../lib/inkfx.js';
import { makeMountains } from './s05/mountains.js';
import { makePeaks } from '../lib/peaks.js';
import { paintFoliageBand, paintBlotMass } from './s05/foliage.js';
import { composite, darken } from './s05/util.js';
import { paintRock } from './s05/rocks.js';

const PAPER = [239, 231, 220];
const T0 = 3;                 // camera at rest (reference composition)
const DOLLY = 0.0065;         // dolly per second (push-in)
const WATER = 694;            // waterline (design px)
const SUN = { x: 1742, y: 354, r: 39, sink: 1.6 };   // sinks 1.6 px/s

const BRIDGE = {
  x0: 270, x1: 830, y: 696, deck: [590, 606], hump: 72, peak: 585,
  arches: [
    { c: 403, span: 87, crown: 599 },
    { c: 595, span: 205, crown: 550 },
    { c: 768, span: 65, crown: 604 },
  ],
  seed: 5,
};

export const FACTS = {
  camera: { T0, dolly: DOLLY },
  sun: [SUN.x, SUN.y + SUN.sink * 1],          // centre at t = 1 (middle of the incoming sun match); r 39
  sunSink: SUN.sink,                             // px/s downward: centre(t) = [1742, 354 + 1.6 t]
  sunRadius: SUN.r,
  bridge: [595, 560],
  pavilion: [1338, 505],
  waterY: WATER,
  bloomSeeds: [[80, 640], [300, 300]],          // darkest ink: left bank mass, pine canopy along the long limb
};

const inkB = (api, raw, o) => { const s = inkify(api, raw, o); api.engine?.freeTex?.(raw); return s; };

export default {
  id: 's05', title: 'Stone bridge, red sun', ref: '05',
  build(api) {
    const layers = [];
    // ------------------------------------------------------------ sky, sun, haze strands
    layers.push(makeSky(api, { variant: 'rice', sun: [SUN.x, SUN.y + 14], glowColor: [236, 214, 198], glowAmount: 0.7, glowSize: [560, 170] }));
    const sun = makeSun(api, { style: 'red', x: SUN.x, y: SUN.y, r: SUN.r });
    const sunRect = sun.rect.slice();
    sun.update = (t, l) => { l.rect = [sunRect[0], sunRect[1] + SUN.sink * t, sunRect[2], sunRect[3]]; };
    layers.push(sun);
    layers.push(makeSkyStreaks(api, { style: 'thin', z: 50, seed: 4, region: [1700, 384, 520, 60], sun: [SUN.x, SUN.y + 20, 230, 40], floor: [380, 8, 0.97] }));

    // ------------------------------------------------------------ far pale peaks (right)
    const farR = makeMountains(api, { rect: [1000, 240, 760, 260], fade: [0.25, 0.95], trees: 0.4, treeH: 10, body: 0.6, cun: 0.5, moss: 0.4, peaks: [
      { x: 1171, top: 298, wl: 100, wr: 110, base: 420, tone: 0.16, seed: 51 },
      { x: 1309, top: 300, wl: 150, wr: 270, base: 470, tone: 0.36, seed: 52, rough: 0.6 },
    ] });
    layers.push(farR.layer({ z: 9, name: 'far-right' }));

    // ------------------------------------------------------------ main mountain range (centre-left)
    const rangeBack = makePeaks(api, { rect: [180, 90, 520, 340], peaks: [
      { x: 486, top: 137, base: 400, tone: 0.76, seed: 61, shape: 'dome', fade: 0.26, treeSize: 0.45, trees: 0.7, detail: 0.7, columns: [
        { dx: 0, top: 137, hw: 62 }, { dx: -120, top: 190, hw: 72 }, { dx: -55, top: 205, hw: 45 }, { dx: -200, top: 250, hw: 60 }] },
    ] });
    layers.push(rangeBack.layer({ z: 7, name: 'range-back', opacity: 0.7 }));
    const range = makePeaks(api, { rect: [400, 80, 900, 440], peaks: [
      { x: 1000, top: 240, base: 480, tone: 0.7, seed: 63, shape: 'dome', fade: 0.24, treeSize: 0.5, trees: 0.8, detail: 0.7, columns: [
        { dx: -84, top: 240, hw: 58 }, { dx: 0, top: 296, hw: 50 }, { dx: 110, top: 340, hw: 80 }] },
      { x: 700, top: 118, base: 470, tone: 0.62, seed: 64, shape: 'dome', fade: 0.26, treeSize: 0.45, trees: 0.6, columns: [
        { dx: -102, top: 118, hw: 72 }, { dx: -20, top: 172, hw: 48 }, { dx: 96, top: 189, hw: 58 }, { dx: -175, top: 228, hw: 55 }, { dx: 30, top: 222, hw: 45 }] },
    ] });
    layers.push(range.layer({ z: 6, name: 'range', opacity: 0.78 }));
    const rangeFront = makePeaks(api, { rect: [360, 240, 560, 300], peaks: [
      { x: 620, top: 296, base: 500, tone: 0.5, seed: 67, shape: 'dome', fade: 0.3, treeSize: 0.55, trees: 1.3, columns: [
        { dx: 0, top: 296, hw: 58 }, { dx: -110, top: 330, hw: 55 }, { dx: 92, top: 342, hw: 50 }] },
    ] });
    layers.push(makeMist(api, { top: 300, bottom: 470, z: 5.8, lobe: 70, seed: 6, drift: 6, density: 0.65, holes: 0.4, softness: 16, shade: 0.05, extent: [250, 1300, 200] }));
    layers.push(rangeFront.layer({ z: 5.5, name: 'range-front' }));
    layers.push(makeMist(api, { top: 400, bottom: 600, z: 5.6, lobe: 80, seed: 1, drift: 7, density: 0.7, holes: 0.3, softness: 14, shade: 0.06 }));

    // ------------------------------------------------------------ right edge peaks and pale tree hills
    const hills = makeMountains(api, { rect: [1340, 400, 460, 200], fade: [0.25, 1.0], trees: 1.6, treeH: 15, body: 0.6, cun: 0.4, moss: 0.6, rough: 0.4, peaks: [
      { x: 1640, top: 488, wl: 100, wr: 110, base: 575, tone: 0.2, seed: 73 },
      { x: 1480, top: 466, wl: 120, wr: 110, base: 570, tone: 0.26, seed: 74 },
    ] });
    layers.push(hills.layer({ z: 7, name: 'tree-hills' }));
    const edgeR = makePeaks(api, { rect: [1600, 340, 480, 300], peaks: [
      { x: 1860, top: 390, base: 590, tone: 0.5, seed: 72, shape: 'dome', fade: 0.32, treeSize: 0.45, trees: 0.6, columns: [
        { dx: 6, top: 390, hw: 58 }, { dx: -72, top: 455, hw: 48 }, { dx: -118, top: 500, hw: 40 }, { dx: 90, top: 425, hw: 62 }] },
    ] });
    layers.push(edgeR.layer({ z: 5, name: 'edge-right' }));
    layers.push(makeMist(api, { top: 520, bottom: 700, z: 4.2, lobe: 70, seed: 2, drift: 9, density: 0.6, holes: 0.35, softness: 14, shade: 0.06 }));

    // ------------------------------------------------------------ lake
    layers.push(makeLake(api, { y: WATER, variant: 'plain', paper: PAPER, z: 2.4, density: [0.05, 0.1, 0.16, 0.45], fog: [70, 0.6, 0, 0] }));

    // ------------------------------------------------------------ central island with pavilion
    const islRect = [1000, 400, 820, 300];
    const islRock = cliff({
      seed: 81,
      outline: [[1096, 700], [1104, 640], [1140, 610], [1196, 588], [1250, 566], [1300, 556], [1380, 552], [1440, 560], [1486, 574], [1530, 598], [1566, 628], [1612, 648], [1650, 664], [1690, 700]],
      columns: [{ x: 1180 }, { x: 1260, tone: -0.1 }, { x: 1330 }, { x: 1420, tone: 0.1 }, { x: 1500, tone: 0.2, dark: 0.2 }, { x: 1580 }],
      fade: [[1100, 650, 694], [1400, 664, 696], [1690, 660, 694]],
      tone: 0.3, shadow: 0.45, moss: 1.4, foliage: 1.2, ledges: 0.5,
    });
    const mound = bakeRocks(api, { rect: islRect, items: [islRock], seed: 8, texture: 0.6, cun: 0.5, far: 0.3 });
    const islTrees = api.bakeCanvas(islRect[2], islRect[3], (ctx) => {
      ctx.translate(-islRect[0], -islRect[1]);
      const r = api.rng(84), nz = api.noise(85);
      // pale trees in the mist behind the left end
      withBlur(ctx, 1.2, (g) => { for (const [x, y, h, sd] of [[1066, 600, 92, 41], [1114, 610, 80, 42], [1156, 606, 104, 43], [1190, 620, 78, 44], [1036, 626, 60, 45]]) paintConifer(g, x, y, h, { kind: 'fir', tone: 0.56, paper: PAPER, seed: sd }); });
      paintTreeLine(ctx, [[1040, 556], [1080, 540], [1120, 548], [1160, 566]], { height: [26, 46], density: 3, tone: 0.5, rows: 2, paper: PAPER, seed: 9 });
      paintBlotMass(ctx, r, nz, [[1104, 640], [1140, 606], [1196, 584], [1250, 562], [1300, 552], [1310, 600], [1250, 640], [1180, 660], [1120, 668]], { size: [9, 20], density: 1.2, v: 0.04, back: 0.2, paper: PAPER });
      paintBlotMass(ctx, r, nz, [[1420, 556], [1486, 570], [1530, 594], [1566, 624], [1612, 644], [1660, 664], [1600, 676], [1520, 660], [1460, 620], [1420, 590]], { size: [9, 20], density: 1.2, v: 0.04, back: 0.2, paper: PAPER });
      paintFoliageBand(ctx, r, nz, [[1290, 556], [1330, 552], [1380, 552], [1420, 556]], { band: 8, size: [6, 12], density: 1.2, v: 0.08, paper: PAPER, pines: 0.1, back: 0.1 });
      paintConifer(ctx, 1246, 566, 122, { kind: 'fir', tone: 0.04, paper: PAPER, seed: 3 });
      paintConifer(ctx, 1170, 600, 70, { kind: 'fir', tone: 0.1, paper: PAPER, seed: 4 });
      paintConifer(ctx, 1480, 580, 70, { kind: 'fir', tone: 0.06, paper: PAPER, seed: 5 });
      paintConifer(ctx, 1505, 590, 62, { kind: 'pine', tone: 0.1, paper: PAPER, seed: 6 });
      paintConifer(ctx, 1132, 614, 52, { kind: 'fir', tone: 0.14, paper: PAPER, seed: 7 });
      paintConifer(ctx, 1600, 650, 44, { kind: 'fir', tone: 0.12, paper: PAPER, seed: 8 });
    });
    const pavRect = [1250, 440, 180, 130];
    const pav = bakeArch(api, pavRect, (ctx) => paintPavilion(ctx, { x: 1338, y: 552, w: 128, tiers: 2, seed: 7 }));
    const islMaple = makeMaple(api, { seed: 205, paper: PAPER, trees: [
      { x: 1196, y: 560, height: 44, width: 60, shape: 'round', leafSize: 2.4, density: 1.3, pale: 0.35, depth: 4 },
      { x: 1438, y: 588, height: 36, width: 46, shape: 'round', leafSize: 2.2, density: 1.2, pale: 0.35, depth: 4 },
    ] });
    const island = composite(api, islRect, [
      { src: darken(api, mound.src, { gamma: 1.6, mult: 0.97 }), rect: mound.rect },
      { src: inkB(api, islTrees, { edge: 0.4, granulation: 0.15, bleed: 0.9 }), rect: islRect },
      { src: islMaple.src, rect: islMaple.rect },
      { src: pav, rect: pavRect },
    ]);
    layers.push(makeReflection(api, island, { rect: islRect, y: WATER, z: 2.4, paper: PAPER, strength: 0.45, amp: 2, fade: 220, smear: 14, hblur: 2, breakup: 0.5 }));
    layers.push(api.tex(island, { rect: islRect, z: 2.4, name: 'island' }));

    // small island at the right edge
const smRect = [1720, 590, 280, 120];
    const small = api.bakeCanvas(smRect[2], smRect[3], (ctx) => {
      ctx.translate(-smRect[0], -smRect[1]);
      const r = api.rng(91), nz = api.noise(92);
      paintRock(ctx, r, nz, [[1756, 692], [1776, 682], [1810, 678], [1850, 677], [1890, 680], [1930, 683], [1964, 690], [1970, 698], [1752, 698]], { paper: PAPER, v: 0.16, lit: 0.25, shade: 1, streak: 0.5, rough: 2 });
      for (const [x, y, h, k, sd] of [[1790, 684, 38, 'fir', 31], [1822, 682, 60, 'pine', 32], [1850, 682, 44, 'fir', 33], [1884, 684, 34, 'pine', 34], [1914, 686, 28, 'fir', 35]]) paintConifer(ctx, x, y, h, { kind: k, tone: 0.06, paper: PAPER, seed: sd });
      paintBlotMass(ctx, r, nz, [[1762, 688], [1800, 670], [1860, 666], [1930, 676], [1962, 690], [1762, 696]], { paper: PAPER, size: [4, 10], density: 1.3, v: 0.03, seed: 16 });
    });    const smallSrc = inkB(api, small, { edge: 0.4, granulation: 0.15, bleed: 0.9 });
    layers.push(makeReflection(api, smallSrc, { rect: smRect, y: 694, z: 2.3, paper: PAPER, strength: 0.5, amp: 2, fade: 120, smear: 10, breakup: 0.45 }));
    layers.push(api.tex(smallSrc, { rect: smRect, z: 2.3, name: 'small-island' }));



    // ------------------------------------------------------------ bridge and right bank
    const brRect = archBounds('archBridge', BRIDGE);
    const bridge = darken(api, bakeArch(api, brRect, (ctx) => paintArchBridge(ctx, BRIDGE)), { gamma: 1.35 });
    const bankRect = [760, 470, 440, 250];
    const bankTrees = api.bakeCanvas(bankRect[2], bankRect[3], (ctx) => {
      ctx.translate(-bankRect[0], -bankRect[1]);
      const r = api.rng(95), nz = api.noise(96);
      const P = { paper: PAPER };
      paintRock(ctx, r, nz, [[806, 600], [836, 586], [866, 590], [896, 584], [930, 600], [962, 616], [990, 630], [1020, 640], [1046, 652], [1076, 662], [1104, 674], [1130, 684], [1156, 698], [1166, 708], [800, 708]], { ...P, v: 0.4, lit: 0.34, shade: -1, streak: 0.9, dots: 0.6 });
      paintConifer(ctx, 822, 600, 120, { kind: 'fir', tone: 0.03, paper: PAPER, seed: 21 });
      paintBlotMass(ctx, r, nz, [[790, 570], [820, 548], [856, 548], [884, 576], [890, 616], [870, 656], [836, 690], [800, 700]], { ...P, size: [7, 18], density: 1.3, v: 0.02, seed: 11 });
      paintBlotMass(ctx, r, nz, [[884, 644], [924, 632], [962, 650], [948, 684], [894, 686]], { ...P, size: [5, 12], density: 1.2, v: 0.03, seed: 12 });
      paintBlotMass(ctx, r, nz, [[996, 664], [1036, 662], [1064, 690], [1012, 700]], { ...P, size: [4, 10], density: 1.2, v: 0.04, seed: 13 });
      paintBlotMass(ctx, r, nz, [[1084, 684], [1122, 684], [1150, 702], [1092, 708]], { ...P, size: [4, 9], density: 1.2, v: 0.04, seed: 14 });
      paintBlotMass(ctx, r, nz, [[860, 596], [900, 590], [940, 606], [980, 626], [1020, 642], [1060, 656], [1100, 672], [1140, 690], [1100, 700], [1020, 690], [940, 668], [880, 650]], { ...P, size: [4, 11], density: 0.9, v: 0.04, light: 0.15, seed: 15 });
      paintConifer(ctx, 984, 646, 82, { kind: 'fir', tone: 0.05, paper: PAPER, seed: 22 });
      paintConifer(ctx, 1004, 654, 56, { kind: 'pine', tone: 0.08, paper: PAPER, seed: 23 });
    });
    const bankMaple = makeMaple(api, { seed: 207, paper: PAPER, trees: [
      { x: 915, y: 612, height: 52, width: 76, shape: 'round', leafSize: 2.6, density: 1.4, pale: 0.3, depth: 4 },
    ] });
    const brAll = [Math.min(brRect[0], bankRect[0]), Math.min(brRect[1], bankRect[1]), 0, 0];
    brAll[2] = Math.max(brRect[0] + brRect[2], bankRect[0] + bankRect[2]) - brAll[0];
    brAll[3] = Math.max(brRect[1] + brRect[3], bankRect[1] + bankRect[3]) - brAll[1];
    const bridgeCard = composite(api, brAll, [
      { src: inkB(api, bankTrees, { edge: 0.4, granulation: 0.15, bleed: 0.9 }), rect: bankRect },
      { src: bridge, rect: brRect },
      { src: bankMaple.src, rect: bankMaple.rect },
    ]);
    layers.push(makeReflection(api, bridgeCard, { rect: brAll, y: WATER, z: 1.6, paper: PAPER, strength: 0.42, amp: 2.2, fade: 200, smear: 14, hblur: 2, breakup: 0.5, tint: [0.92, 0.92, 0.92] }));
    layers.push(api.tex(bridgeCard, { rect: brAll, z: 1.6, name: 'bridge' }));
    layers.push(makeWaterFog(api, { top: 676, z: 1.9, seed: 4, density: 0.5 }));
    // sun reflection: faint vermilion smear on the water under the sun
    layers.push(api.shader(`
      vec4 shade(vec2 p, vec2 uv) {
        float dy = p.y - ${WATER + 2}.0;
        if (dy < 0.0) return vec4(0.0);
        float row = floor(dy / 3.0);
        float wob = 3.0 * snoise(vec2(row * 0.37, uTime * 0.35)) + 1.5 * snoise(vec2(p.y / 30.0, uTime * 0.5));
        float x = p.x + wob - ${SUN.x}.0;
        float w = 24.0 * (1.0 + dy / 150.0);
        float col = exp(-x * x / (w * w)) * exp(-dy / 120.0) * smoothstep(0.0, 6.0, dy);
        // broken into horizontal brush dashes that shimmer slowly
        float dash = smoothstep(-0.35, 0.45, snoise(vec2(p.x / 46.0 + uTime * 0.05, dy / 7.0 + uTime * 0.2)));
        col *= 0.35 + 0.65 * dash;
        float band = exp(-pow(x / 210.0, 2.0)) * exp(-dy / 40.0) * (0.6 + 0.4 * snoise(vec2(p.x / 80.0, dy / 8.0)));
        float a = clamp(0.5 * col + 0.24 * band, 0.0, 1.0);
        vec3 c = vec3(0.91, 0.55, 0.47);
        return vec4(c * a, a);
      }`, { rect: [SUN.x - 260, WATER, 520, 240], z: 2.4, name: 'sun-refl' }));

    // ------------------------------------------------------------ left bank
    const folRect = [-160, 440, 900, 480];
    const folRaw = api.bakeCanvas(folRect[2], folRect[3], (ctx) => {
      ctx.translate(-folRect[0], -folRect[1]);
      const r = api.rng(41), nz = api.noise(42);
      const P = { paper: PAPER };
      // rocks: cliff face under the pine, the pale boulder, shore rocks
      paintRock(ctx, r, nz, [[166, 552], [200, 538], [240, 532], [270, 540], [288, 556], [294, 610], [298, 680], [302, 744], [250, 764], [190, 754], [168, 700], [162, 620]], { ...P, v: 0.3, lit: 0.3, shade: 1, streak: 1.4 });
      paintRock(ctx, r, nz, [[40, 820], [56, 780], [92, 756], [140, 748], [186, 756], [214, 780], [226, 820], [230, 868], [36, 868]], { ...P, v: 0.45, lit: 0.38, shade: -1, streak: 0.7, dots: 0.4, contour: 1.8 });
      paintRock(ctx, r, nz, [[300, 802], [340, 782], [390, 786], [440, 802], [480, 830], [492, 864], [300, 870]], { ...P, v: 0.28, lit: 0.3, shade: 1, streak: 0.8 });
      paintRock(ctx, r, nz, [[560, 862], [590, 846], [640, 842], [690, 852], [702, 872], [556, 874]], { ...P, v: 0.32, lit: 0.3, shade: 1, streak: 0.6, contour: 0.7 });
      // foliage masses
      paintBlotMass(ctx, r, nz, [[-160, 420], [-60, 410], [20, 440], [80, 480], [130, 520], [176, 546], [186, 640], [172, 736], [60, 760], [-160, 780]], { ...P, size: [10, 26], density: 1.2, v: 0.02, seed: 1 });
      paintBlotMass(ctx, r, nz, [[-160, 784], [36, 776], [44, 868], [-160, 890]], { ...P, size: [10, 24], density: 1.1, v: 0.03, seed: 2 });
      paintBlotMass(ctx, r, nz, [[210, 724], [262, 690], [322, 704], [372, 744], [420, 792], [470, 824], [478, 852], [410, 846], [360, 820], [300, 800], [240, 800]], { ...P, size: [8, 22], density: 1.2, v: 0.02, seed: 3 });
      paintBlotMass(ctx, r, nz, [[264, 604], [300, 592], [330, 622], [338, 690], [300, 714], [266, 700]], { ...P, size: [6, 14], density: 1.0, v: 0.03, seed: 4 });
      paintBlotMass(ctx, r, nz, [[152, 534], [230, 522], [292, 542], [284, 568], [200, 574], [152, 564]], { ...P, size: [6, 14], density: 1.0, v: 0.04, light: 0.1, seed: 5 });
      paintBlotMass(ctx, r, nz, [[30, 846], [120, 852], [240, 850], [252, 880], [20, 886]], { ...P, size: [6, 14], density: 1.1, v: 0.03, seed: 7 });
      paintBlotMass(ctx, r, nz, [[580, 852], [620, 840], [660, 846], [650, 860], [590, 862]], { ...P, size: [4, 8], density: 1.0, v: 0.06, light: 0.1, seed: 6 });
    });
    const leftCard = inkB(api, folRaw, { edge: 0.4, granulation: 0.18, bleed: 0.9 });
    layers.push(makeReflection(api, leftCard, { rect: folRect, y: 868, z: 1.15, paper: PAPER, strength: 0.5, amp: 2.5, fade: 200, smear: 14, hblur: 2, breakup: 0.5 }));
    layers.push(api.tex(leftCard, { rect: folRect, z: 1.15, name: 'left-bank', sway: { amp: 0.8, freq: 0.25, scale: 200, power: 1.5, anchor: [200, 900], radius: 500 } }));

    const maple = makeMaple(api, { seed: 301, paper: PAPER, trees: [
      { x: 200, y: 600, height: 210, width: 320, lean: 14, shape: 'spread', crown: [252, 462, 122, 80], leafSize: 4.6, density: 2.0, cluster: 6, clusterSpread: 3.5, pale: 0.25, depth: 6, spread: 40 },
      { x: 30, y: 650, height: 120, width: 160, lean: -6, shape: 'spread', crown: [56, 566, 72, 46], leafSize: 4.2, density: 1.6, cluster: 5, pale: 0.25, depth: 5 },
    ] });
    layers.push(maple.layer({ z: 1.1, amp: 2 }));

    // ------------------------------------------------------------ hero pines (two trunks)
    const pineCommon = { gnarl: 0.75, scale: 1.15, padAspect: 0.42, needle: 11, padDensity: 3.0, haze: 0.15, wet: 0.3, soft: 0.2, core: 0.25, needleWidth: 0.16, barkTone: 0.3, barkDensity: 1.6, knobs: 0.4, swayFreq: 0.2 };
    const pineB = makePine(api, {
      ...pineCommon, seed: 22, height: 600, padSize: 56,
      spine: [[-34, 640], [-16, 520], [10, 420], [42, 320], [76, 226], [108, 150], [138, 98], [158, 64]],
      trunkWidth: 30, taper: 0.4, flare: 0.1,
      limbs: [
        { pts: [[156, 70], [200, 58], [250, 62], [296, 76], [340, 94]], w: 11, subs: 3 },
        { pts: [[236, 66], [262, 96], [296, 114], [320, 122]], w: 6, subs: 2, pad: 0.8 },
        { pts: [[92, 190], [60, 166], [24, 150], [-10, 148], [-40, 156]], w: 12, subs: 3 },
        { pts: [[66, 256], [36, 246], [6, 254], [-30, 266]], w: 9, subs: 2, pad: 0.9 },
      ],
      swayAmp: 3.5,
    });
    const pineA = makePine(api, {
      ...pineCommon, seed: 21, height: 420, padSize: 60,
      spine: [[24, 640], [42, 560], [62, 480], [88, 410], [120, 352], [156, 318]],
      trunkWidth: 34, taper: 0.55, flare: 0.12,
      limbs: [
        { pts: [[152, 320], [206, 300], [262, 294], [320, 298], [380, 310], [446, 330]], w: 18, subs: 4 },
        { pts: [[160, 316], [178, 280], [204, 256], [240, 244]], w: 9, subs: 2 },
        { pts: [[96, 398], [70, 378], [40, 372]], w: 8, subs: 1, pad: 0.8 },
      ],
      swayAmp: 3,
    });
    layers.push(pineB.layer({ z: 1 }));
    layers.push(pineA.layer({ z: 1 }));

    return {
      layers,
      camera: (t) => ({ x: 0, y: 0, dolly: DOLLY * (t - T0), zoom: 1, roll: 0 }),
      meta: { clear: PAPER.map((v) => v / 255) },
    };
  },
};
