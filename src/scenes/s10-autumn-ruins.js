// s10 Autumn ruins (ref 10): a pine top-left over a dark left cliff with a red maple shedding
// leaves, ruined stone watchtowers on misty peaks, a crater lake ringed by forest, waterfalls,
// deep mist. Camera: slow pan right (the outgoing handscroll pan adds +220 px at the end; checked:
// no card edges with the camera at +260 px).
import { PAPER } from '../lib/brush.js';
import { inkify } from '../lib/inkfx.js';
import { makeSky } from '../lib/atmos.js';
import { makePeaks } from '../lib/peaks.js';
import { makePine } from '../lib/pine.js';
import { makeMaple } from '../lib/flora.js';
import { makeWaterfall } from '../lib/water.js';
import { paintTower, bakeArch } from '../lib/architecture.js';
import { paintSlope } from './s10/forest.js';
import { makeSpray, makeCraterLake } from './s10/fx.js';
import { bakeS08Rocks, bakeFineRocks, paintFoliage } from './s10/rockpaint.js';
import { makeRefLeaves } from './s10/leaves.js';
import { paintConifer } from '../lib/pine.js';

export const FACTS = {
  tower: [1300, 95],           // main ruined watchtower (rest space)
  lake: [1160, 655],
  waterfall: [1404, 830],      // big waterfall below the lake (lip 1366-1442 at y 750)
  maple: [170, 640],
  bloomSeeds: [[300, 880], [1320, 170]],   // darkest ink: left cliff crown, tower crag crown
};

const Z = { far: 10, farTower: 8, midFar: 6, crag: 4.2, hill: 3.2, rightPillar: 3.0, lakeBack: 2.5, lake: 2.4, lakeFront: 2.3, bottom: 1.7, foot: 1.45, cliff: 1.2, maple: 1.15, pine: 1.1 };

export default {
  id: 's10', title: 'Autumn ruins', ref: '10',
  build(api) {
    const layers = [];
    layers.push(makeSky(api, { variant: 'rice', seed: 10 }));
    const INK_FX = { edge: 0.4, granulation: 0.2, bleed: 0.8 };
    const slopeCard = (rect, slopes, z, name, scale = 1) => {
      const src = api.bakeCanvas(rect[2], rect[3], (ctx) => { ctx.translate(-rect[0], -rect[1]); for (const s of slopes) paintSlope(ctx, s); }, { scale });
      return api.tex(inkify(api, src, INK_FX), { rect, z, name });
    };

    const WET_FAR = { soft: 2.4, blur: 0.8, bleed: 0.3, edge: 0.25, granulation: 0.15, mottle: 0.35 };
    const WET_MID = { soft: 1.6, blur: 0.5, bleed: 0.3, edge: 0.35, granulation: 0.18, mottle: 0.35 };

    // ---------------------------------------------------------------- far ranges (top right, behind)
    const far = makePeaks(api, {
      rect: [700, 0, 1750, 380], wet: WET_FAR, scale: 0.6,
      peaks: [
        { x: 900, top: 165, base: 330, width: 320, shape: 'dome', tone: 0.82, trees: 0.5, detail: 0.3, seed: 1 },
        { x: 1460, top: 120, base: 320, width: 220, shape: 'dome', tone: 0.78, trees: 0.5, detail: 0.3, seed: 2 },
        { x: 1640, top: 48, base: 330, width: 300, cols: 3, shape: 'dome', tone: 0.76, trees: 0.5, detail: 0.25, seed: 3 },
        { x: 1880, top: 90, base: 330, width: 320, cols: 3, shape: 'dome', tone: 0.66, trees: 0.6, detail: 0.3, seed: 4 },
        { x: 2180, top: 110, base: 340, width: 360, cols: 3, shape: 'dome', tone: 0.8, trees: 0.5, detail: 0.25, seed: 5 },
      ],
    });
    layers.push(far.layer({ z: Z.far, name: 'peaks-far' }));
    layers.push(makeSpray(api, { name: 'mist-far', z: Z.far * 0.95, blobs: [[1000, 300, 500, 50, 1], [1650, 300, 520, 60, 1], [2200, 310, 400, 60, 1]], threshold: 0.45, scale: 160, drift: 4, shade: 0.15 }));

    // far faint tower peak (centre) + left tower peak + pointed peak + right mid peaks
    const midFar = makePeaks(api, {
      rect: [560, 120, 1500, 340], wet: WET_FAR, scale: 0.8,
      peaks: [
        { x: 1128, top: 228, base: 360, width: 130, cols: 2, shape: 'pillar', tone: 0.68, trees: 0.6, detail: 0.4, seed: 11 },
        { x: 1760, top: 160, base: 420, width: 380, cols: 3, shape: 'dome', tone: 0.5, trees: 1.3, detail: 0.6, seed: 13 },
      ],
    });
    layers.push(midFar.layer({ z: Z.midFar, name: 'peaks-midfar' }));
    layers.push(slopeCard([560, 150, 520, 300], [
      { seed: 12, contour: [[590, 312], [640, 282], [690, 246], [728, 214], [760, 204], [796, 214], [846, 246], [900, 268], [960, 296], [1010, 330]], base: 440, fade: 0.45, tone: 0.3, rock: 0.62, h: [12, 22], trees: 0.6, cover: 0.75 },
    ], Z.midFar * 0.998, 'peak-towerL', 0.8));
    const farTowers = bakeArch(api, [690, 120, 480, 130], (ctx) => {
      paintTower(ctx, { x: 1128, y: 236, w: 26, h: 50, fade: 0.62, seed: 12, windows: 2, annex: false, overgrow: 0.35 });
      paintTower(ctx, { x: 760, y: 208, w: 36, h: 58, fade: 0.38, seed: 11, windows: 2, overgrow: 0.5 });
    }, { blur: 0.7 });
    layers.push(api.tex(farTowers, { rect: [690, 120, 480, 130], z: Z.midFar * 0.999, name: 'towers-far' }));
    layers.push(makeSpray(api, { name: 'mist-midfar', z: Z.midFar * 0.95, blobs: [[700, 400, 380, 60, 1], [1100, 420, 300, 60, 1], [1750, 420, 380, 70, 1], [2150, 420, 300, 60, 1]], threshold: 0.45, scale: 140, drift: 5, shade: 0.2 }));

    // ---------------------------------------------------------------- main tower crag
    const crag = makePeaks(api, {
      rect: [940, 160, 280, 400], wet: WET_MID,
      peaks: [{ x: 1072, top: 222, base: 480, width: 170, cols: 2, shape: 'spire', tone: 0.24, fade: 0.5, trees: 1.5, seed: 14 }],
    });
    layers.push(crag.layer({ z: Z.crag, name: 'peaks-crag' }));
    // the tower crag: one great leaning slab (fine axe-cut texture, moss dots, dark crown foliage)
    const slabRect = [1140, 90, 560, 390];
    const slabO = [[1258, 132], [1300, 124], [1350, 128], [1400, 134], [1440, 142], [1470, 158], [1500, 184], [1530, 190], [1562, 212], [1600, 240], [1632, 282], [1652, 330], [1662, 470], [1166, 470], [1200, 330], [1226, 236], [1246, 170]];
    const spireO = [[1190, 222], [1206, 204], [1224, 208], [1238, 236], [1246, 300], [1252, 470], [1176, 470]];
    const slab = bakeFineRocks(api, slabRect, [
      {
        seed: 21, outline: slabO,
        facets: [1296, 1352, 1418, 1500, 1580], slant: -0.18, face: 0.6, shade: 0.24, crown: 0.8, mossSize: 0.75, contour: 0.6, tex: 2.2, texLen: 1.2, shadowTex: 1.6, dabs: 2.2, dabSize: 0.8, wisps: 0.6,
        inkTop: 0.55, inkDepth: 70, rough: 3,
        fade: [[1176, 320, 450], [1300, 330, 460], [1450, 300, 430], [1662, 300, 440]], fadeJitter: 0.8,
      },
      {
        seed: 22, outline: spireO,
        facets: [1214], slant: -0.05, face: 0.66, shade: 0.28, crown: 0.7, mossSize: 0.7, contour: 0.6, tex: 2.0, texLen: 1.2, shadowTex: 1.4, dabs: 2, dabSize: 0.8, wisps: 0.6,
        inkTop: 0.45, inkDepth: 50,
        fade: [[1180, 340, 460], [1250, 340, 460]], fadeJitter: 0.8,
      },
    ], {
      fine: 2, haze: 0.18,
      after: (ctx) => {
        paintFoliage(ctx, slabO, { seed: 24, density: 1.5, depth: 170, size: 2.2, tones: [0.14, 0.46] });
        paintFoliage(ctx, spireO, { seed: 25, density: 1.2, depth: 90, size: 1.6, tones: [0.16, 0.46] });
        const r = api.rng(23);
        for (const [x, y, h] of [[1275, 134, 16], [1330, 129, 20], [1372, 131, 18], [1410, 136, 22], [1452, 148, 20], [1488, 178, 16], [1525, 194, 44], [1546, 204, 36], [1572, 220, 30], [1598, 240, 34], [1622, 266, 20], [1242, 182, 14], [1230, 228, 12], [1214, 210, 12]]) {
          paintConifer(ctx, x, y + h * 0.1, h, { kind: r() < 0.5 ? 'pine' : 'fir', tone: 0.22 + r() * 0.12, rng: r.fork(x + ':' + y), width: 1.0 + r() * 0.3 });
        }
      },
    });
    layers.push(api.tex(inkify(api, slab.src, { edge: 0.35, granulation: 0.2, bleed: 0.8 }), { rect: slabRect, z: Z.crag * 0.9995, name: 'crag-slab' }));
    const towerRect = [1220, 0, 200, 160];
    const tower = bakeArch(api, towerRect, (ctx) => paintTower(ctx, { x: 1298, y: 142, w: 64, h: 104, seed: 10, ruin: 0.95, overgrow: 0.35, fade: 0.08 }));
    layers.push(api.tex(tower, { rect: towerRect, z: Z.crag * 0.999, name: 'tower' }));
    layers.push(...makeWaterfall(api, { name: 'falls-crag', z: Z.crag * 0.998, lip: [[1604, 296], [1626, 296]], height: 90, speed: 120, spray: false, lineWidth: 1.6, streakScale: 2.2, backingDark: 0.6, fade: 0.75, preset: 'far', seed: 4.1 }).layers);
    layers.push(makeSpray(api, { name: 'mist-crag', z: Z.crag * 0.96, blobs: [[1200, 470, 300, 60, 1], [1500, 450, 300, 70, 1], [900, 440, 260, 60, 0.9], [1850, 470, 300, 60, 0.9], [1240, 425, 170, 42, 0.85], [1470, 400, 210, 40, 0.75], [1110, 330, 130, 50, 0.8]], threshold: 0.45, scale: 120, drift: 6, shade: 0.45, shadow: [192, 186, 178] }));

    // ---------------------------------------------------------------- hills behind the lake + right pillar
    layers.push(slopeCard([440, 230, 1300, 460], [
      { seed: 31, trees: 0.7, contour: [[470, 330], [530, 300], [600, 284], [650, 306], [700, 345], [740, 380], [800, 420], [880, 452], [960, 482], [1010, 505]], base: 600, fade: 0.2, fadeNoise: 60, cun: 1.6, tone: 0.2, rock: 0.62, h: [16, 30], crest: 1.6, cover: 0.7 },
      { seed: 32, trees: 0.7, contour: [[1100, 500], [1150, 462], [1215, 438], [1285, 420], [1355, 437], [1447, 470], [1540, 505], [1610, 540], [1660, 580]], base: 640, fade: 0.25, fadeNoise: 60, cun: 1.6, tone: 0.24, rock: 0.64, h: [16, 28], crest: 1.6, cover: 0.7 },
    ], Z.hill, 'hills', 0.7));
    layers.push(...makeWaterfall(api, { name: 'falls-left', z: Z.hill * 0.998, lip: [[712, 434], [734, 434]], height: 118, speed: 140, spray: false, lineWidth: 1.8, streakScale: 2.4, backingDark: 0.65, fade: 0.75, seed: 2.2 }).layers);
    layers.push(...makeWaterfall(api, { name: 'falls-ridge', z: Z.hill * 0.998, lip: [[1178, 474], [1194, 474]], height: 60, speed: 100, spray: false, lineWidth: 1.4, streakScale: 2.0, backingDark: 0.5, fade: 0.7, preset: 'far', seed: 3.3 }).layers);

    const rightP = makePeaks(api, {
      rect: [1600, 200, 600, 560], wet: WET_MID,
      peaks: [{ x: 1890, top: 296, base: 700, width: 440, tone: 0.13, trees: 1.6, treeSize: 1.2, seed: 41, columns: [{ dx: -95, top: 300, hw: 66, cap: 'round' }, { dx: 5, top: 336, hw: 58, cap: 'round' }, { dx: 110, top: 372, hw: 64, cap: 'round' }, { dx: 215, top: 326, hw: 70, cap: 'round' }] }],
    });
    layers.push(rightP.layer({ z: Z.rightPillar, name: 'peaks-right' }));
    layers.push(makeSpray(api, { name: 'mist-hills', z: Z.rightPillar * 0.95, blobs: [[760, 600, 320, 70, 1], [1120, 560, 260, 50, 0.8], [1700, 640, 340, 80, 1], [2150, 640, 300, 80, 1], [560, 540, 200, 60, 0.8]], threshold: 0.45, scale: 120, drift: 7, shade: 0.45, shadow: [192, 186, 178] }));

    // ---------------------------------------------------------------- crater lake + ring forests
    layers.push(slopeCard([460, 480, 1750, 380], [
      { seed: 51, trees: 0.6, contour: [[480, 622], [540, 586], [600, 566], [660, 576], [720, 602], [790, 640], [850, 680]], base: 820, fade: 0.35, tone: 0.2, rock: 0.64, h: [22, 42] },
      { seed: 52, trees: 0.6, contour: [[840, 610], [900, 580], [960, 562], [1040, 540], [1100, 534], [1160, 546], [1200, 570], [1250, 596]], base: 660, fade: 0.55, tone: 0.2, rock: 0.64, h: [20, 38], cover: 0.9 },
      { seed: 53, trees: 0.6, contour: [[1600, 600], [1680, 562], [1760, 540], [1850, 556], [1950, 532], [2100, 560], [2180, 600]], base: 760, fade: 0.35, tone: 0.3, rock: 0.68, h: [18, 32] },
    ], Z.lakeBack, 'forest-lakeback', 0.8));
    layers.push(makeCraterLake(api, {
      z: Z.lake, rect: [870, 580, 590, 150], far: 597, near: 714,
      shape: [[895, 655], [920, 622], [975, 603], [1080, 597], [1240, 596], [1370, 600], [1430, 612], [1420, 650], [1340, 690], [1200, 712], [1050, 716], [940, 700]],
    }));
    layers.push(slopeCard([560, 560, 1300, 520], [
      { seed: 61, trees: 0.8, contour: [[600, 668], [680, 645], [760, 660], [840, 694], [920, 716], [1000, 730], [1080, 736], [1180, 730], [1230, 740]], base: 900, fade: 0.3, clump: 0.6, cover: 0.6, tone: 0.22, rock: 0.6, h: [26, 48] },
      { seed: 62, trees: 0.8, contour: [[1250, 770], [1300, 742], [1350, 714], [1398, 684], [1430, 646], [1462, 616], [1530, 628], [1610, 646], [1680, 690], [1730, 745]], base: 1060, fade: 0.55, tone: 0.15, rock: 0.58, h: [28, 52] },
    ], Z.lakeFront, 'forest-lakefront'));
    // dark rock lip the big waterfall spills over (ref: a textured cliff band under the lake's outflow)
    const lipRect = [1270, 700, 290, 300];
    const lipO = [[1262, 830], [1284, 790], [1322, 754], [1360, 746], [1404, 742], [1448, 744], [1482, 752], [1514, 774], [1530, 830], [1534, 990], [1262, 990]];
    const lipRock = bakeFineRocks(api, lipRect, [{
      seed: 66, outline: lipO, facets: [1340, 1400, 1470], face: 0.62, shade: 0.08, crown: 0, contour: 0.6, tex: 1.8, texLen: 1.3, shadowTex: 2.2, dabs: 1.6, dabSize: 0.6, wisps: 0,
      inkTop: 0.7, inkDepth: 70, fade: [[1290, 860, 970], [1410, 890, 985], [1534, 850, 960]],
    }], { fine: 1.5, after: (ctx) => paintFoliage(ctx, lipO, { seed: 67, density: 1.3, depth: 40, size: 1.8, tones: [0.06, 0.34] }) });
    layers.push(api.tex(inkify(api, lipRock.src, { edge: 0.4, granulation: 0.2, bleed: 0.8 }), { rect: lipRect, z: Z.lakeFront * 0.999, name: 'falls-rock' }));
    layers.push(...makeWaterfall(api, { name: 'falls-big', z: Z.lakeFront * 0.998, lip: [[1366, 750], [1442, 748]], height: 190, speed: 200, sheets: 3, thin: 0.7, strands: 1.0, ragged: 1.4, edgeSoft: 1.3, arch: 7, darkness: 0.5, lineWidth: 2.0, streakScale: 2.8, backingDark: 0.55, fade: 0.72, seed: 5.5, spray: { amount: 0.8, shade: 0.45, shadow: [192, 186, 178] } }).layers);
    layers.push(makeSpray(api, { name: 'mist-lake', z: Z.lakeFront * 0.96, blobs: [[820, 760, 300, 70, 1], [1100, 790, 260, 60, 0.8], [1800, 900, 300, 110, 1.0], [2150, 840, 320, 110, 1], [1450, 980, 300, 80, 0.9], [640, 720, 200, 60, 0.8]], threshold: 0.45, scale: 130, drift: 8, shade: 0.45, shadow: [192, 186, 178] }));

    // ---------------------------------------------------------------- bottom forests
    layers.push(slopeCard([480, 760, 1050, 420], [
      { seed: 71, contour: [[860, 880], [920, 830], [980, 806], [1035, 816], [1100, 850], [1150, 886], [1220, 920], [1265, 950], [1330, 966], [1400, 992], [1450, 1020]], base: 1150, fade: 0.45, tone: 0.12, rock: 0.55, h: [40, 72], cover: 0.8 },
    ], Z.bottom, 'forest-bottom'));
    layers.push(slopeCard([440, 820, 520, 380], [
      { seed: 81, contour: [[480, 980], [520, 950], [580, 902], [640, 882], [700, 900], [760, 930], [830, 980], [880, 1030]], base: 1180, fade: 0.55, tone: 0.05, rock: 0.5, h: [55, 100], cover: 0.8, pineShare: 0.6 },
    ], Z.foot, 'forest-foot'));
    layers.push(makeSpray(api, { name: 'mist-low', z: Z.foot * 0.95, blobs: [[1150, 1060, 380, 70, 1], [1650, 1000, 420, 120, 1.1], [2100, 980, 360, 120, 1], [700, 1080, 260, 60, 0.8]], threshold: 0.45, scale: 130, drift: 9, shade: 0.45, shadow: [192, 186, 178] }));

    // ---------------------------------------------------------------- left cliff
    const upperCol = {
      seed: 91, outline: [[-180, 330], [-80, 300], [10, 292], [80, 318], [150, 302], [212, 312], [252, 342], [276, 400], [290, 480], [298, 560], [305, 650], [310, 760], [312, 880], [-180, 880]],
      facets: [40, 130, 215, 270], face: 0.8, shade: 0.08, crown: 0, contour: 0.7, shadowTex: 2.4, tex: 1.6, texLen: 1.8, dabs: 1.6, dabSize: 0.45, wisps: 0,
      inkTop: 0.85, inkDepth: 110,
      fade: [[-100, 580, 780], [140, 520, 720], [312, 470, 660]],
    };
    const stepRock = {
      seed: 92, outline: [[282, 600], [318, 572], [366, 562], [404, 578], [428, 616], [440, 700], [446, 820], [282, 820]],
      facets: [330, 398], face: 0.82, shade: 0.1, crown: 0, contour: 0.7, wisps: 0, shadowTex: 2.4, tex: 1.5, texLen: 1.5, dabs: 1.6, dabSize: 0.45,
      inkTop: 0.8, inkDepth: 80,
      fade: [[282, 640, 780], [446, 670, 800]],
    };
    const lowCrag = {
      seed: 93, outline: [[398, 690], [426, 656], [462, 650], [492, 676], [506, 740], [514, 820], [520, 900], [398, 900]],
      facets: [446, 490], face: 0.84, shade: 0.1, crown: 0, contour: 0.7, wisps: 0, shadowTex: 2.4, tex: 1.5, texLen: 1.4, dabs: 1.6, dabSize: 0.45,
      inkTop: 0.75, inkDepth: 70,
      fade: [[398, 740, 870], [520, 760, 880]],
    };
    const lowerMass = {
      seed: 94, outline: [[-180, 880], [-60, 866], [40, 858], [140, 862], [220, 846], [290, 826], [340, 806], [392, 796], [446, 806], [492, 828], [532, 868], [562, 930], [590, 1010], [610, 1100], [620, 1250], [-180, 1250]],
      facets: [60, 170, 290, 410, 520], face: 0.86, shade: 0.06, crown: 0, contour: 0.7, shadowTex: 2.6, tex: 1.5, texLen: 2.6, dabs: 1.8, dabSize: 0.5, slant: 0.2, wisps: 0,
      inkTop: 1.0, inkDepth: 100, rough: 4,
      fade: [[-100, 1000, 1160], [250, 1040, 1190], [620, 1150, 1250]],
    };
    const cliffRect = [-200, 240, 860, 1040];
    const cliffBake = bakeFineRocks(api, cliffRect, [upperCol, stepRock, lowCrag, lowerMass], {
      fine: 1,
      after: (ctx) => {
        // ink-dot foliage crowning each rock (breaks the silhouettes)
        paintFoliage(ctx, upperCol.outline, { seed: 96, density: 1.5, depth: 70, size: 3.2, tones: [0.0, 0.3] });
        paintFoliage(ctx, stepRock.outline, { seed: 97, density: 1.4, depth: 45, size: 2.6, tones: [0.02, 0.32] });
        paintFoliage(ctx, lowCrag.outline, { seed: 98, density: 1.4, depth: 40, size: 2.4, tones: [0.02, 0.32] });
        paintFoliage(ctx, lowerMass.outline, { seed: 99, density: 1.6, depth: 60, size: 3.4, tones: [0.0, 0.28] });
      },
    });
    const cliff = { layer: (o) => api.tex(inkify(api, cliffBake.src, { edge: 0.5, granulation: 0.25, bleed: 1.0 }), { rect: cliffRect, ...o }) };
    layers.push(cliff.layer({ z: Z.cliff, name: 'cliff-left' }));
    const cliffTreesRect = [-120, 200, 720, 720];
    const cliffTrees = api.bakeCanvas(cliffTreesRect[2], cliffTreesRect[3], (ctx) => {
      ctx.translate(-cliffTreesRect[0], -cliffTreesRect[1]);
      const r = api.rng(95);
      const T = [[60, 322, 30, 'pine'], [104, 324, 40, 'fir'], [150, 312, 34, 'fir'], [190, 318, 48, 'fir'], [232, 330, 40, 'pine'], [262, 352, 34, 'fir'],
        [292, 420, 26, 'fir'], [300, 480, 24, 'fir'], [306, 545, 22, 'pine'],
        [318, 580, 36, 'fir'], [352, 570, 46, 'fir'], [392, 576, 38, 'pine'], [420, 600, 30, 'fir'],
        [436, 662, 40, 'fir'], [470, 658, 34, 'pine'], [496, 690, 28, 'fir'],
        [300, 826, 36, 'pine'], [360, 822, 44, 'fir'], [400, 830, 52, 'fir'], [442, 842, 46, 'pine'], [484, 856, 40, 'fir'], [520, 884, 34, 'fir']];
      for (const [x, y, h, kind] of T) paintConifer(ctx, x, y + h * 0.08, h, { kind, tone: 0.04 + r() * 0.08, rng: r.fork(x + ':' + y), width: 1.0 + r() * 0.4 });
    });
    layers.push(api.tex(inkify(api, cliffTrees, { edge: 0.35, granulation: 0.12, bleed: 0.8 }), { rect: cliffTreesRect, z: Z.cliff * 0.998, name: 'cliff-trees', sway: { amp: 1.2, freq: 0.2, scale: 200, power: 1.5, anchor: [300, 900], radius: 600 } }));
    // red maple (ref 10 tree, lab/flora-10)
    const maple = makeMaple(api, {
      seed: 10, paper: PAPER,
      trees: [{ x: 150, y: 870, height: 380, width: 400, lean: -12, shape: 'spread', crown: [160, 600, 220, 150], palette: 'autumn', density: 2.2, leafSize: 6, trunk: 44, gnarl: 0.9, dry: 0.7, trunkLen: 110, depth: 5, limbs: [[-112, 95, 0.6], [-58, 105, 0.55], [-14, 120, 0.45], [-155, 60, 0.4]] }],
    });
    layers.push(maple.layer({ z: Z.maple, amp: 3, freq: 0.22 }));
    // hero pine top-left
    const pine = makePine(api, {
      seed: 101, height: 440, gnarl: 0.85,
      spine: [[-14, 492], [38, 404], [82, 304], [112, 222], [134, 150]],
      trunkWidth: 30, taper: 0.4, flare: 0.2,
      limbs: [
        { pts: [[134, 152], [180, 122], [240, 102], [306, 96], [346, 106]], w: 12, subs: 3 },
        { pts: [[128, 162], [88, 136], [44, 122], [-6, 116]], w: 11, subs: 2 },
        { pts: [[134, 150], [142, 106], [162, 66], [204, 40]], w: 9, subs: 2 },
        { pts: [[70, 330], [128, 282], [198, 250], [288, 242], [378, 256], [450, 276], [512, 298]], w: 14, subs: 4 },
      ],
      padSize: 92, padAspect: 0.5, needle: 11, padDensity: 4.5, haze: 0.2, scale: 1.25, barkTone: 0.7,
    });
    layers.push(pine.layer({ z: Z.pine }));

    // falling maple leaves
    // falling maple leaves (pass through the ref 10 leaf positions at t = 3)
    layers.push(makeRefLeaves(api, {
      t0: 3, z: 1, rect: [-250, -40, 2450, 1140],
      list: [
        // ref 10 leaf positions
        [357, 523, 18, 0], [483, 540, 34, 0], [537, 687, 31, 0], [362, 782, 48, 1.5], [641, 777, 53, 2], [535, 828, 29, 0],
        [767, 845, 11, 0], [827, 863, 14, 0], [690, 883, 14, 0], [826, 957, 67, 4], [702, 1027, 48, 3], [1041, 1027, 59, 5],
        [250, 640, 11, 0], [310, 700, 14, 0], [420, 600, 11, 0], [200, 770, 13, 0], [610, 610, 10, 0], [900, 760, 11, 0],
        [980, 900, 14, 0], [460, 900, 15, 0], [1150, 980, 18, 1], [760, 690, 10, 0],
        // more from the maple, plus leaves blown in from trees above the frame
        [130, 560, 9, 0], [280, 470, 10, 0], [380, 1040, 22, 1], [580, 960, 17, 0.5], [440, 720, 8, 0],
        [560, 180, 9, 0, 'top'], [880, 260, 8, 0, 'top'], [1240, 330, 10, 0, 'top'], [1520, 230, 9, 0, 'top'], [1700, 420, 12, 0, 'top'],
        [1380, 520, 11, 0, 'top'], [1020, 430, 9, 0, 'top'], [700, 470, 13, 0, 'top'], [1610, 690, 14, 0, 'top'], [1300, 820, 16, 0.5, 'top'],
        [1820, 860, 15, 0.5, 'top'], [1150, 650, 10, 0, 'top'], [950, 600, 8, 0, 'top'], [1480, 960, 18, 1, 'top'], [1750, 1010, 20, 1, 'top'],
        [1900, 560, 11, 0, 'top'], [2050, 760, 13, 0, 'top'], [2150, 400, 10, 0, 'top'], [1250, 1000, 28, 1.5, 'top'], [1660, 300, 24, 1, 'top'],
      ],
    }));
    // a few huge, out-of-focus leaves passing right in front of the lens
    layers.push(makeRefLeaves(api, {
      t0: 3, z: 0.85, rect: [-450, -300, 2750, 1500], res: 0.5, name: 'leaves-near', seed: 77,
      list: [[1570, 950, 92, 8], [1720, 300, 78, 7, 'top'], [70, 1000, 74, 7]],
    }));


    return {
      layers,
      camera: (t) => ({ x: 8 * (t - 3), y: 0, dolly: 0, zoom: 1, roll: 0 }),
      meta: { clear: PAPER.map((v) => v / 255) },
    };
  },
};
