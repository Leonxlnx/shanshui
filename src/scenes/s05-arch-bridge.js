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
import { rgba, blob, tone as inkTone } from '../lib/brush.js';
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
    // rounded craggy ridges stepping down to the right (mountains.js masses), back to front, mist between
    const rangeBack = makeMountains(api, { rect: [20, 150, 540, 260], fade: [0.25, 0.72], trees: 0.5, treeH: 10, body: 1.2, cun: 0.7, moss: 0.9, rough: 1.4, a: 1.6, peaks: [
      { x: 330, top: 188, wl: 230, wr: 170, base: 400, tone: 0.38, seed: 61 },
    ] });
    layers.push(rangeBack.layer({ z: 7, name: 'range-back' }));
    // ridges = rows of overlapping rounded knobs (each paper-filled, so nearer knobs overlap farther ones)
    // ridges = one continuous mass per ridge with several rounded knobs; the mist dissolve follows the ridge line
    // round 2: taller bodies (deeper dissolve), deeper saddles, lighter top fringe (no dark moss band)
    const RK = { trees: 0.45, treeH: 10, body: 1.3, cun: 1.4, moss: 0.7, rough: 0.32, a: 2, b: 1.2, foot: 0, knobW: 1.9, crease: 0.5, band: 0.12, contour: 0.55, slope: 1, shadow: 1, ink: { edge: 0.2 } };
    const range = makeMountains(api, { ...RK, rect: [0, 85, 1430, 470], peaks: [
      { x: 560, wl: 300, wr: 300, top: 122, base: 470, tone: 0.38, seed: 64, fadeLocal: [70, 250], fadeFloor: [345, 420],
        knobs: [{ x: 330, top: 190, w: 110 }, { x: 470, top: 146, w: 110 }, { x: 610, top: 120, w: 115 }, { x: 710, top: 170, w: 85 }, { x: 800, top: 186, w: 95 }] },
      { x: 1000, wl: 170, wr: 170, top: 224, base: 540, tone: 0.36, seed: 65, fadeLocal: [50, 200], fadeFloor: [410, 480],
        knobs: [{ x: 880, top: 224, w: 95 }, { x: 980, top: 262, w: 110 }, { x: 1100, top: 318, w: 130 }] },
    ] });
    layers.push(range.layer({ z: 6, name: 'range' }));
    const rangeFront = makeMountains(api, { ...RK, moss: 0.9, rect: [230, 190, 1220, 360], peaks: [
      { x: 530, wl: 140, wr: 140, top: 222, base: 520, tone: 0.5, seed: 67, fadeLocal: [60, 210], fadeFloor: [375, 440],
        knobs: [{ x: 440, top: 240, w: 85 }, { x: 530, top: 222, w: 90 }, { x: 620, top: 268, w: 85 }] },
      { x: 880, wl: 220, wr: 220, top: 300, base: 560, tone: 0.48, seed: 68, fadeLocal: [45, 160], fadeFloor: [410, 470],
        knobs: [{ x: 700, top: 300, w: 95 }, { x: 820, top: 312, w: 100 }, { x: 940, top: 330, w: 100 }, { x: 1060, top: 352, w: 120 }] },
    ] });
    layers.push(makeMist(api, { wispsAbove: 0.05, texture: 0, top: 340, bottom: 480, z: 5.8, lobe: 80, seed: 6, drift: 6, density: 0.32, holes: 0.5, softness: 30, shade: 0.01, extent: [200, 1300, 320] }));
    layers.push(rangeFront.layer({ z: 5.5, name: 'range-front' }));
    layers.push(makeMist(api, { wispsAbove: 0.05, texture: 0, top: 430, bottom: 600, z: 5.6, lobe: 80, seed: 1, drift: 7, density: 0.6, holes: 0.35, softness: 20, shade: 0.01 }));

    // ------------------------------------------------------------ right edge peaks and pale tree hills
    // round 2: one low pale tree-lined ridge (ridge mode) instead of two domes with stamped tufts
    const hills = makeMountains(api, { rect: [1290, 380, 560, 220], trees: 0.9, treeH: 12, body: 0.9, cun: 0.7, moss: 0.4, rough: 0.35, a: 2, b: 1.2, foot: 0, knobW: 1.8, crease: 0.4, band: 0.1, contour: 0.4, slope: 0.7, shadow: 0.6, peaks: [
      { x: 1560, wl: 200, wr: 200, top: 466, base: 590, tone: 0.24, seed: 73, fadeLocal: [30, 105], fadeFloor: [535, 580],
        knobs: [{ x: 1470, top: 466, w: 90 }, { x: 1575, top: 482, w: 80 }, { x: 1665, top: 490, w: 90 }] },
    ] });
    layers.push(hills.layer({ z: 7, name: 'tree-hills' }));
    const edgeR = makePeaks(api, { rect: [1600, 340, 480, 300], peaks: [
      { x: 1860, top: 390, base: 590, tone: 0.5, seed: 72, shape: 'dome', fade: 0.32, treeSize: 0.45, trees: 0.6, columns: [
        { dx: 6, top: 390, hw: 58 }, { dx: -72, top: 455, hw: 48 }, { dx: -118, top: 500, hw: 40 }, { dx: 90, top: 425, hw: 62 }] },
    ] });
    layers.push(edgeR.layer({ z: 5, name: 'edge-right' }));
    layers.push(makeMist(api, { wispsAbove: 0.05, texture: 0, top: 520, bottom: 700, z: 4.2, lobe: 70, seed: 2, drift: 9, density: 0.6, holes: 0.35, softness: 20, shade: 0.01 }));

    // ------------------------------------------------------------ lake
    layers.push(makeLake(api, { y: WATER, variant: 'plain', paper: PAPER, z: 2.4, density: [0.06, 0.12, 0.18, 0.45], fog: [70, 0.6, 0, 0], bands: 0.1, blotch: 0.2 }));

    // round 2: pale misty far shore seen through the bridge arches (ref: faint trees in the main arch)
    const fbRect = [420, 560, 380, 140];
    const farBank = api.bakeCanvas(fbRect[2], fbRect[3], (ctx) => {
      ctx.translate(-fbRect[0], -fbRect[1]);
      withBlur(ctx, 2.6, (g) => {
        for (const [x, y, h, sd] of [[548, 692, 70, 62], [604, 690, 46, 64], [676, 692, 82, 66]]) paintConifer(g, x, y, h, { kind: sd % 4 ? 'fir' : 'pine', tone: 0.72, paper: PAPER, seed: sd });
        paintTreeLine(g, [[470, 692], [540, 684], [620, 682], [700, 686], [770, 692]], { height: [16, 40], density: 3, tone: 0.7, rows: 3, paper: PAPER, seed: 69 });
        const gs = g.createLinearGradient(0, 676, 0, 696);
        gs.addColorStop(0, rgba(inkTone(0.62, PAPER), 0)); gs.addColorStop(1, rgba(inkTone(0.62, PAPER), 0.6));
        g.fillStyle = gs; g.fillRect(450, 676, 340, 20);
      });
      // mist: the trees dissolve downward and at both ends
      ctx.globalCompositeOperation = 'destination-in';
      const gm = ctx.createLinearGradient(440, 0, 790, 0);
      gm.addColorStop(0, 'rgba(0,0,0,0)'); gm.addColorStop(0.25, 'rgba(0,0,0,0.85)'); gm.addColorStop(0.75, 'rgba(0,0,0,0.85)'); gm.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gm; ctx.fillRect(420, 560, 380, 140);
    });
    layers.push(api.tex(farBank, { rect: fbRect, z: 2.2, name: 'far-bank' }));

    // ------------------------------------------------------------ central island with pavilion
    const islRect = [1000, 400, 820, 300];
    // the mound: paper-filled outline with a soft grey body, a few pale boulders in the lower middle, and
    // wet-blot shrub masses clothing the top and both shoulders (rock shows only between them)
    const islOutline = [[1096, 700], [1104, 640], [1140, 610], [1196, 588], [1250, 566], [1300, 556], [1380, 552], [1440, 560], [1486, 574], [1530, 598], [1566, 628], [1612, 648], [1650, 664], [1690, 700]];
    const islTrees = api.bakeCanvas(islRect[2], islRect[3], (ctx) => {
      ctx.translate(-islRect[0], -islRect[1]);
      const r = api.rng(84), nz = api.noise(85);
      const P = { paper: PAPER };
      // pale trees in the mist behind the left end
      withBlur(ctx, 1.2, (g) => { for (const [x, y, h, sd] of [[1066, 600, 92, 41], [1114, 610, 80, 42], [1156, 606, 104, 43], [1190, 620, 78, 44], [1036, 626, 60, 45]]) paintConifer(g, x, y, h, { kind: 'fir', tone: 0.56, paper: PAPER, seed: sd }); });
      paintTreeLine(ctx, [[1040, 556], [1080, 540], [1120, 548], [1160, 566]], { height: [26, 46], density: 3, tone: 0.5, rows: 2, paper: PAPER, seed: 9 });
      const bp = new Path2D(); islOutline.forEach(([x, y], i) => (i ? bp.lineTo(x, y) : bp.moveTo(x, y))); bp.closePath();
      ctx.fillStyle = rgba(PAPER, 1); ctx.fill(bp);
      const gw = ctx.createLinearGradient(0, 552, 0, 700);
      gw.addColorStop(0, rgba(inkTone(0.35, PAPER), 0.7)); gw.addColorStop(0.5, rgba(inkTone(0.5, PAPER), 0.45)); gw.addColorStop(1, rgba(inkTone(0.7, PAPER), 0));
      ctx.fillStyle = gw; ctx.fill(bp);
      // shrub masses first (left shoulder, top under the pavilion, right shoulder); round 2: the rock faces
      // are painted over their lower edge so a textured mid-grey cliff shows in the middle (ref), then clumps
      paintBlotMass(ctx, r, nz, [[1104, 646], [1140, 608], [1196, 586], [1250, 564], [1300, 554], [1306, 590], [1270, 620], [1220, 640], [1170, 660], [1120, 668]], { ...P, size: [8, 18], density: 1.2, v: 0.1, light: 0.14, seed: 1 });
      paintBlotMass(ctx, r, nz, [[1290, 560], [1330, 554], [1400, 556], [1440, 562], [1436, 590], [1396, 604], [1340, 606], [1300, 592]], { ...P, size: [6, 13], density: 1.0, v: 0.12, light: 0.16, seed: 21 });
      paintBlotMass(ctx, r, nz, [[1420, 558], [1486, 572], [1530, 596], [1566, 626], [1612, 646], [1660, 666], [1640, 690], [1590, 680], [1560, 660], [1520, 640], [1470, 620], [1440, 596]], { ...P, size: [8, 18], density: 1.2, v: 0.08, light: 0.12, seed: 2 });
      paintRock(ctx, r, nz, [[1190, 694], [1198, 654], [1222, 622], [1262, 604], [1318, 596], [1372, 602], [1414, 622], [1436, 660], [1442, 694]], { ...P, v: 0.28, lit: 0.28, shade: 1, streak: 0.5, dots: 0.7, contour: 0.9, rough: 3, facets: 1.6, wet: 1.4 });
      paintRock(ctx, r, nz, [[1410, 694], [1424, 660], [1454, 636], [1500, 628], [1538, 642], [1560, 694]], { ...P, v: 0.26, lit: 0.26, shade: 1, streak: 0.5, dots: 0.6, contour: 0.9, rough: 3, facets: 1.4, wet: 1.4 });
      paintRock(ctx, r, nz, [[1124, 694], [1134, 664], [1166, 648], [1210, 654], [1232, 694]], { ...P, v: 0.3, lit: 0.3, shade: -1, streak: 0.4, dots: 0.5, contour: 0.8, rough: 2.5, facets: 1, wet: 1.2 });
      paintBlotMass(ctx, r, nz, [[1226, 620], [1270, 600], [1330, 590], [1392, 598], [1420, 612], [1380, 614], [1320, 610], [1262, 624]], { ...P, size: [3, 8], density: 1.0, v: 0.1, light: 0.1, seed: 24 });
      paintBlotMass(ctx, r, nz, [[1236, 640], [1272, 626], [1300, 636], [1290, 660], [1250, 664]], { ...P, size: [4, 9], density: 0.9, v: 0.08, light: 0.15, seed: 22 });
      paintBlotMass(ctx, r, nz, [[1440, 640], [1478, 630], [1500, 650], [1470, 668]], { ...P, size: [4, 9], density: 0.9, v: 0.08, light: 0.15, seed: 23 });
      paintFoliageBand(ctx, r, nz, [[1290, 556], [1330, 552], [1380, 552], [1420, 556]], { band: 8, size: [6, 12], density: 1.2, v: 0.08, paper: PAPER, pines: 0.1, back: 0.1 });
      paintConifer(ctx, 1246, 566, 112, { kind: 'fir', tone: 0.3, paper: PAPER, seed: 3 });
      paintConifer(ctx, 1170, 600, 70, { kind: 'fir', tone: 0.1, paper: PAPER, seed: 4 });
      paintConifer(ctx, 1480, 580, 70, { kind: 'fir', tone: 0.14, paper: PAPER, seed: 5 });
      paintConifer(ctx, 1505, 590, 62, { kind: 'pine', tone: 0.16, paper: PAPER, seed: 6 });
      paintConifer(ctx, 1132, 614, 52, { kind: 'fir', tone: 0.14, paper: PAPER, seed: 7 });
      paintConifer(ctx, 1600, 650, 44, { kind: 'fir', tone: 0.12, paper: PAPER, seed: 8 });
      // the foot dissolves into bare paper (low mist) before it reaches the water: ragged, not a straight fade
      ctx.save(); ctx.clip(bp);
      const gf = ctx.createLinearGradient(0, 666, 0, 698);
      gf.addColorStop(0, rgba(PAPER, 0)); gf.addColorStop(0.55, rgba(PAPER, 0.75)); gf.addColorStop(1, rgba(PAPER, 1));
      ctx.fillStyle = gf; ctx.fillRect(1080, 640, 640, 70);
      withBlur(ctx, 5, (g) => { for (let i = 0; i < 60; i++) blob(g, 1096 + r() * 600, 660 + r() * 30, r.range(8, 20), { color: rgba(PAPER, r.range(0.3, 0.7)), rng: r, irregular: 0.5, squash: 0.3 }); });
      ctx.restore();
    });
    const pavRect = [1250, 440, 180, 130];
    const pav = bakeArch(api, pavRect, (ctx) => paintPavilion(ctx, { x: 1338, y: 552, w: 128, tiers: 2, seed: 7, wallTone: 0.6, fade: 0.08 }));
    const islMaple = makeMaple(api, { seed: 205, paper: PAPER, trees: [
      { x: 1196, y: 560, height: 44, width: 60, shape: 'round', leafSize: 2.4, density: 1.3, pale: 0.35, depth: 4 },
      { x: 1438, y: 588, height: 36, width: 46, shape: 'round', leafSize: 2.2, density: 1.2, pale: 0.35, depth: 4 },
    ] });
    // opaque paper underlay (inkify's granulation leaves the bake slightly translucent: far creases showed through)
    const islBase = api.bakeCanvas(islRect[2], islRect[3], (ctx) => { ctx.translate(-islRect[0], -islRect[1]); ctx.fillStyle = rgba(PAPER, 1); ctx.beginPath(); islOutline.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill(); });
    const island = composite(api, islRect, [
      { src: islBase, rect: islRect },
      { src: inkB(api, islTrees, { edge: 0.4, granulation: 0.15, bleed: 0.9 }), rect: islRect },
      { src: islMaple.src, rect: islMaple.rect },
      { src: pav, rect: pavRect },
    ]);
    layers.push(makeReflection(api, island, { rect: islRect, y: WATER, z: 2.4, paper: PAPER, strength: 0.62, amp: 2, fade: 240, smear: 8, hblur: 1.5, breakup: 0.6, row: 3.5 }));
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
    const bridge = darken(api, bakeArch(api, brRect, (ctx) => paintArchBridge(ctx, { ...BRIDGE, tone: 0.76, ringTone: 0.68, spots: 1900 })), { gamma: 1.45 });
    const bankRect = [760, 470, 440, 250];
    const bankTrees = api.bakeCanvas(bankRect[2], bankRect[3], (ctx) => {
      ctx.translate(-bankRect[0], -bankRect[1]);
      const r = api.rng(95), nz = api.noise(96);
      const P = { paper: PAPER };
      paintRock(ctx, r, nz, [[806, 600], [836, 586], [866, 590], [896, 584], [930, 600], [962, 616], [990, 630], [1020, 640], [1046, 652], [1076, 662], [1104, 674], [1130, 684], [1156, 698], [1166, 708], [800, 708]], { ...P, v: 0.36, lit: 0.34, shade: -1, streak: 0.6, dots: 0.6, facets: 1, wet: 1 });
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
    // round 2: pier feet sink into the water (wet dark band, low stones, a shrub tuft) instead of a straight cut
    const feetRect = [330, 650, 520, 60];
    const feet = api.bakeCanvas(feetRect[2], feetRect[3], (ctx) => {
      ctx.translate(-feetRect[0], -feetRect[1]);
      const r = api.rng(97), nz = api.noise(98);
      withBlur(ctx, 2.5, (g) => {
        for (const [xa, xb] of [[338, 362], [444, 494], [694, 738], [798, 822]]) {
          const gb = g.createLinearGradient(0, 676, 0, 697);
          gb.addColorStop(0, rgba(inkTone(0.25, PAPER), 0)); gb.addColorStop(1, rgba(inkTone(0.2, PAPER), 0.55));
          g.fillStyle = gb; g.fillRect(xa, 676, xb - xa, 21);
        }
      });
      for (const [x, w, h, v] of [[440, 26, 10, 0.16], [486, 18, 7, 0.2], [690, 22, 9, 0.18], [736, 16, 6, 0.22], [352, 20, 8, 0.2], [818, 24, 8, 0.18]]) {
        paintRock(ctx, r, nz, [[x - w / 2, 698], [x - w * 0.4, 698 - h * 0.6], [x - w * 0.1, 698 - h], [x + w * 0.3, 698 - h * 0.8], [x + w / 2, 698]], { paper: PAPER, v, lit: 0.18, shade: 1, streak: 0.2, dots: 0.3, contour: 0.6, rough: 1.5 });
      }
      paintBlotMass(ctx, r, nz, [[446, 694], [452, 680], [466, 676], [476, 686], [470, 696]], { paper: PAPER, size: [2, 5], density: 1.1, v: 0.06, seed: 31 });
      paintBlotMass(ctx, r, nz, [[728, 696], [736, 684], [748, 682], [752, 696]], { paper: PAPER, size: [2, 4], density: 1.1, v: 0.08, seed: 32 });
    });
    const bridgeCard = composite(api, brAll, [
      { src: inkB(api, bankTrees, { edge: 0.4, granulation: 0.15, bleed: 0.9 }), rect: bankRect },
      { src: bridge, rect: brRect },
      { src: inkB(api, feet, { edge: 0.4, granulation: 0.15, bleed: 0.9 }), rect: feetRect },
      { src: bankMaple.src, rect: bankMaple.rect },
    ]);
    layers.push(makeReflection(api, bridgeCard, { rect: brAll, y: WATER, z: 1.6, paper: PAPER, strength: 0.66, amp: 2.2, fade: 280, smear: 7, hblur: 1.5, breakup: 0.62, row: 3.5, tint: [0.9, 0.9, 0.9] }));
    layers.push(api.tex(bridgeCard, { rect: brAll, z: 1.6, name: 'bridge' }));
    layers.push(makeWaterFog(api, { wispsAbove: 0, texture: 0, wisp: 0.3, shade: 0, softness: 8, rect: [-480, 682, 2880, 260], top: 690, z: 1.9, seed: 4, density: 0.2 }));
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
      // round 2 (ref layout): a mid-grey cliff face under the pine with dark foliage on its left, a shrub-clad
      // rocky spit at the bridge foot, a big pale boulder low left, dark shrubs beside it and small dark shore
      // rocks stepping out into pale water (rounded bottoms, no flat cut slabs)
      paintRock(ctx, r, nz, [[166, 552], [200, 538], [240, 532], [270, 540], [288, 560], [296, 604], [288, 646], [298, 690], [290, 722], [256, 742], [212, 738], [178, 704], [164, 626]], { ...P, v: 0.32, lit: 0.3, shade: 1, streak: 1.0, contour: 1.2, dots: 1.0, facets: 1.4, wet: 1.2 });
      paintRock(ctx, r, nz, [[290, 732], [304, 712], [336, 702], [380, 706], [416, 718], [434, 736], [412, 746], [340, 748], [298, 744]], { ...P, v: 0.2, lit: 0.26, shade: 1, streak: 0.6, contour: 1, facets: 1, wet: 1 });
      paintRock(ctx, r, nz, [[50, 862], [52, 826], [70, 792], [100, 768], [140, 754], [182, 758], [212, 778], [230, 810], [236, 846], [228, 872], [180, 882], [104, 882]], { ...P, v: 0.34, lit: 0.36, shade: 1, streak: 0.45, dots: 0.6, contour: 1.8, facets: 1.6, wet: 1.3 });
      paintRock(ctx, r, nz, [[400, 858], [410, 840], [436, 830], [466, 836], [484, 856], [470, 868], [418, 868]], { ...P, v: 0.12, lit: 0.18, shade: 1, streak: 0.4, contour: 1, facets: 0.6, wet: 1 });
      paintRock(ctx, r, nz, [[504, 864], [514, 852], [536, 848], [554, 858], [548, 868], [510, 870]], { ...P, v: 0.16, lit: 0.2, shade: 1, streak: 0.3, contour: 1 });
      paintRock(ctx, r, nz, [[566, 866], [586, 852], [626, 846], [664, 852], [690, 866], [640, 874], [590, 874]], { ...P, v: 0.2, lit: 0.24, shade: 1, streak: 0.4, contour: 0.9 });
      // foliage masses
      paintBlotMass(ctx, r, nz, [[-160, 420], [-60, 410], [20, 440], [80, 480], [130, 520], [176, 546], [168, 620], [150, 700], [110, 756], [40, 770], [-160, 780]], { ...P, size: [10, 26], density: 1.2, v: 0.04, light: 0.22, seed: 1 });
      paintBlotMass(ctx, r, nz, [[-160, 784], [36, 776], [50, 868], [-160, 890]], { ...P, size: [10, 24], density: 1.1, v: 0.03, seed: 2 });
      paintBlotMass(ctx, r, nz, [[268, 708], [284, 672], [314, 650], [350, 654], [384, 676], [400, 704], [370, 716], [300, 718]], { ...P, size: [6, 15], density: 1.1, v: 0.04, light: 0.1, seed: 3 });
      paintBlotMass(ctx, r, nz, [[216, 812], [240, 776], [286, 760], [336, 772], [372, 806], [386, 846], [360, 868], [300, 872], [238, 866]], { ...P, size: [7, 18], density: 1.1, v: 0.03, light: 0.08, seed: 8 });
      paintBlotMass(ctx, r, nz, [[270, 604], [300, 596], [320, 622], [318, 660], [290, 674], [270, 660]], { ...P, size: [5, 12], density: 1.0, v: 0.05, light: 0.1, seed: 4 });
      paintBlotMass(ctx, r, nz, [[152, 534], [230, 522], [292, 542], [284, 568], [200, 574], [152, 564]], { ...P, size: [6, 14], density: 1.0, v: 0.04, light: 0.1, seed: 5 });
      paintBlotMass(ctx, r, nz, [[30, 852], [120, 862], [230, 858], [252, 880], [20, 886]], { ...P, size: [6, 14], density: 1.1, v: 0.03, seed: 7 });
      paintBlotMass(ctx, r, nz, [[420, 840], [444, 826], [470, 834], [460, 848], [430, 850]], { ...P, size: [3, 7], density: 1.0, v: 0.05, light: 0.1, seed: 6 });
    });
    const leftCard = inkB(api, folRaw, { edge: 0.4, granulation: 0.18, bleed: 0.9 });
    layers.push(makeReflection(api, leftCard, { rect: folRect, y: 868, z: 1.15, paper: PAPER, strength: 0.5, amp: 2.5, fade: 200, smear: 14, hblur: 2, breakup: 0.5 }));
    layers.push(api.tex(leftCard, { rect: folRect, z: 1.15, name: 'left-bank', sway: { amp: 0.8, freq: 0.25, scale: 200, power: 1.5, anchor: [200, 900], radius: 500 } }));

    // round 2: muted vermilion (ref: orange-red dabs, pale washed ones behind), airier crown, twigs visible
    const MPAL = { bright: [204, 84, 58], mid: [184, 68, 48], dark: [128, 46, 36], pale: [222, 156, 134] };
    const maple = makeMaple(api, { seed: 301, paper: PAPER, trees: [
      { x: 200, y: 600, height: 220, width: 340, lean: 14, shape: 'spread', crown: [254, 458, 140, 88], leafSize: 3.6, density: 1.15, coverage: 0.6, cluster: 5, clusterSpread: 4.2, pale: 0.48, palette: MPAL, depth: 6, spread: 42 },
      { x: 30, y: 650, height: 120, width: 160, lean: -6, shape: 'spread', crown: [56, 566, 76, 48], leafSize: 3.4, density: 1.0, coverage: 0.6, cluster: 4, pale: 0.48, palette: MPAL, depth: 5 },
    ] });
    layers.push(maple.layer({ z: 1.1, amp: 2 }));

    // ------------------------------------------------------------ hero pines (two trunks)
    const pineCommon = { gnarl: 0.75, scale: 1.15, padAspect: 0.46, needle: 12.5, padDensity: 3.6, haze: 0.5, backPads: 0.2, wet: 0.3, soft: 0.2, core: 0.25, needleWidth: 0.16, barkTone: 0.34, barkDensity: 3.6, knobs: 0.7, swayFreq: 0.2 };
    const pineB = makePine(api, {
      ...pineCommon, seed: 22, height: 600, padSize: 80, padDensity: 5.2,
      spine: [[-34, 640], [-16, 520], [10, 420], [42, 320], [76, 236], [106, 172], [134, 126], [154, 96]],
      trunkWidth: 30, taper: 0.4, flare: 0.1,
      limbs: [
        { pts: [[152, 100], [200, 90], [250, 94], [296, 108], [340, 124]], w: 11, subs: 3 },
        { pts: [[236, 96], [262, 124], [296, 140], [320, 148]], w: 6, subs: 2, pad: 0.8 },
        { pts: [[92, 190], [60, 166], [24, 150], [-10, 148], [-40, 156]], w: 12, subs: 3 },
        { pts: [[66, 256], [36, 246], [6, 254], [-30, 266]], w: 9, subs: 2, pad: 0.9 },
        { pts: [[144, 112], [118, 84], [84, 66], [50, 62]], w: 7, subs: 2 },
        { pts: [[200, 90], [214, 64], [236, 50]], w: 5, subs: 1 },
      ],
      swayAmp: 3.5,
    });
    const pineA = makePine(api, {
      ...pineCommon, seed: 21, height: 420, padSize: 76, padDensity: 4.4,
      spine: [[24, 640], [42, 560], [62, 480], [88, 410], [120, 352], [156, 318]],
      trunkWidth: 34, taper: 0.55, flare: 0.12,
      limbs: [
        { pts: [[152, 320], [206, 300], [262, 294], [320, 298], [380, 310], [446, 330]], w: 18, subs: 4 },
        { pts: [[160, 316], [178, 280], [204, 256], [240, 244]], w: 9, subs: 2 },
        { pts: [[96, 398], [70, 378], [40, 372]], w: 8, subs: 1, pad: 0.8 },
        { pts: [[300, 298], [316, 268], [340, 252]], w: 6, subs: 1 },
        { pts: [[380, 310], [404, 290], [430, 284]], w: 5, subs: 1 },
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