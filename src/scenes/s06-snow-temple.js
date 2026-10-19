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
import { bakeSnowPeaks } from './s06/massif.js';
import { bakeGarden } from './s06/garden.js';

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
    layers.push(makeCloudSea(api, { yBack: 235, yFront: 380, rows: 3, lobe: 80, z: 6.5, seed: 1, drift: 3, farFade: 0.6, shade: 0.38, softness: 1.2, perspective: 0.8, detail: 0.25, wisp: 0.35, wispsAbove: 0.3, color: [247, 246, 243], shadowColor: [186, 184, 181] }));

    // ---- the big snowy massif top right
    // painted snow peaks: white faces carved by fold strokes, tree clumps, bases in the cloud
    const big = bakeSnowPeaks(api, [1120, -10, 960, 480], [
      { // back right
        ridge: [[1700, 250], [1740, 190], [1770, 152], [1800, 128], [1830, 112], [1856, 104], [1880, 118], [1910, 134], [1950, 150], [2000, 170], [2080, 200]],
        base: 250, fadeH: 120, tone: 0.5, folds: 0.8, halfW: 120, shadow: 1.3, treeScale: 1.7, treeN: 1.6, autoClumps: 1, clumps: [[1850, 128, 20, 9, 10], [1905, 160, 24, 10, 10]], ridgeTrees: 0.4,
        spurs: [[1856, 106, 0.1, 160, 26]] },
      { // small peak left of the massif
        ridge: [[1150, 400], [1190, 330], [1225, 290], [1260, 262], [1290, 245], [1318, 232], [1340, 226], [1362, 236], [1385, 262], [1410, 300], [1440, 360]],
        base: 300, fadeH: 110, tone: 0.38, folds: 1, halfW: 110, shadow: 1.3, treeScale: 1.7, treeN: 1.6, autoClumps: 1, clumps: [[1325, 246, 18, 9, 10], [1365, 290, 20, 8, 10]], ridgeTrees: 0.4,
        spurs: [[1340, 228, 0.1, 160, 24]] },
      { // the massif: summit with shoulders stepping down both ridges
        ridge: [[1300, 440], [1335, 345], [1358, 300], [1374, 268], [1386, 240], [1399, 218], [1413, 204], [1426, 178], [1441, 135], [1456, 100], [1472, 84], [1490, 72], [1506, 60], [1520, 53], [1533, 46], [1548, 51], [1565, 66], [1582, 92], [1598, 112], [1622, 119], [1644, 128], [1660, 121], [1677, 138], [1700, 158], [1724, 177], [1746, 204], [1772, 230], [1805, 262], [1845, 298], [1890, 330], [1950, 362], [2080, 400]],
        base: 320, fadeH: 130, tone: 0, halfW: 180, ridgeTrees: 0.5, shadow: 1.5, treeScale: 2.1, treeN: 2.3, clumpR: 1.3, autoClumps: 1.4,
        summits: [[1533, 46], [1660, 121], [1413, 204]],
        spurs: [[1533, 48, -0.32, 330, 22], [1536, 50, 0.08, 330, 40], [1598, 114, 0.22, 260, 30], [1660, 124, 0.12, 240, 26], [1456, 102, -0.4, 260, 14], [1413, 206, -0.25, 160, 14], [1746, 206, 0.3, 160, 20]],
        clumps: [[1490, 80, 22, 12, 13], [1522, 58, 12, 5, 11], [1612, 200, 34, 18, 14], [1662, 245, 48, 28, 15], [1722, 290, 46, 26, 15], [1690, 172, 22, 10, 12], [1398, 226, 16, 7, 11], [1440, 300, 22, 10, 12], [1790, 285, 30, 14, 13], [1560, 150, 14, 6, 11], [1760, 225, 20, 9, 12], [1850, 320, 30, 12, 13]], treeH: 11 },
    ], { seed: 1 });
    layers.push(big.layer({ z: 5 }));
    layers.push(makeMist(api, { top: 345, height: 90, lobe: 55, z: 4.8, seed: 9, drift: 6, extent: [1150, 2050, 120] }));
    layers.push(makeCloudSea(api, { yBack: 385, yFront: 540, rows: 4, lobe: 100, softness: 2, detail: 0.55, z: 4.6, seed: 2, drift: 4, farFade: 0.4, perspective: 1.1, shade: 0.65, wisp: 0.45, wispsAbove: 0.4, texture: 0.6, color: [247, 246, 243], shadowColor: [178, 176, 173] }));

    // ---- small right peaks and the central snowy peak
    const mid = bakeSnowPeaks(api, [930, 270, 1150, 380], [
      { // spire right
        ridge: [[1640, 600], [1670, 520], [1700, 470], [1730, 440], [1760, 420], [1790, 395], [1810, 385], [1830, 398], [1850, 420], [1880, 450], [1920, 470], [1980, 500], [2080, 520]],
        base: 500, fadeH: 110, tone: 0.32, halfW: 100, shadow: 1.3, treeScale: 1.7, treeN: 1.6, autoClumps: 1, ridgeTrees: 0.4,
        spurs: [[1810, 388, 0.1, 150, 26]], clumps: [[1805, 398, 18, 10, 10], [1860, 440, 22, 9, 10]] },
      { // the central snowy peaks
        ridge: [[960, 560], [990, 480], [1020, 440], [1050, 420], [1072, 392], [1090, 362], [1104, 372], [1122, 340], [1140, 318], [1160, 300], [1178, 312], [1196, 330], [1215, 348], [1240, 352], [1260, 346], [1280, 362], [1310, 380], [1340, 392], [1360, 388], [1385, 410], [1420, 430], [1460, 432], [1500, 460], [1540, 520], [1570, 600]],
        base: 530, fadeH: 120, tone: 0.12, halfW: 100, shadow: 1.4, treeScale: 2, treeN: 3, clumpR: 1.3, ridgeTrees: 1, autoClumps: 2, treeH: 10,
        summits: [[1160, 300], [1260, 346], [1090, 362], [1360, 388]],
        spurs: [[1160, 302, -0.15, 220, 30], [1260, 348, 0.1, 180, 26], [1360, 390, 0.2, 140, 22]],
        clumps: [[1150, 312, 22, 12, 12], [1255, 352, 20, 10, 11], [1090, 372, 16, 8, 10], [1355, 398, 18, 8, 10], [1200, 380, 26, 12, 11], [1460, 445, 20, 8, 10]] },
    ], { seed: 2 });
    layers.push(mid.layer({ z: 3.3 }));
    layers.push(makeMist(api, { top: 530, height: 100, lobe: 70, z: 3.1, seed: 10, drift: 7, extent: [900, 2050, 140] }));
    layers.push(makeCloudSea(api, { yBack: 570, yFront: 800, rows: 4, lobe: 150, softness: 3.5, detail: 0.65, z: 2.9, seed: 3, drift: 5, farFade: 0.3, perspective: 0.9, shade: 0.62, wisp: 0.4, wispsAbove: 0.35, texture: 0.6, color: [247, 246, 243], shadowColor: [172, 170, 167] }));

    // ---- lower right peak (base kept clear of the seal corner)
    const low = bakeSnowPeaks(api, [1540, 570, 540, 360], [{
      ridge: [[1560, 900], [1590, 800], [1615, 740], [1640, 712], [1665, 690], [1690, 650], [1715, 625], [1740, 608], [1770, 597], [1795, 604], [1815, 622], [1835, 640], [1860, 655], [1890, 662], [1930, 690], [2000, 730], [2080, 760]],
      base: 760, fadeH: 110, tone: 0, halfW: 110, shadow: 1.5, treeScale: 2.1, treeN: 3, clumpR: 1.3, ridgeTrees: 0.9, autoClumps: 2, treeH: 10,
      summits: [[1770, 597], [1665, 690]],
      spurs: [[1770, 600, 0.05, 220, 34], [1665, 692, -0.1, 150, 22], [1860, 657, 0.25, 140, 24]],
      clumps: [[1765, 610, 24, 14, 12], [1700, 640, 18, 9, 11], [1640, 712, 18, 9, 11], [1850, 650, 22, 10, 11], [1810, 700, 30, 12, 12]],
    }], { seed: 3 });
    layers.push(low.layer({ z: 2.3 }));
    layers.push(makeCloudSea(api, { yBack: 800, yFront: 1180, rows: 3, lobe: 220, softness: 3.5, detail: 0.75, z: 2.0, seed: 4, drift: 6, farFade: 0.2, shade: 0.64, wisp: 0.35, wispsAbove: 0.3, texture: 0.65, color: [247, 246, 243], shadowColor: [166, 164, 161] }));
    tm('peaks+clouds');

    const snow = makeSnow(api, { intensity: 1, wind: 0.8, seed: 6, calm: [1700, 830, 1806, 982] });
    layers.push(snow[0], snow[1]);

    // ---- central cliffs: the pavilion pillar and the right spur (z 1.4)
    const SETTLE = { ink: [0.3, 0.14], cap: 5, mound: 2.5, blur: 2.5, thr: 0.42, flat: [0.55, 0.92], lobes: 0.6 };
    const midRock = bakeSnowCliff(api, [580, 280, 640, 680], [
      { poly: [[884, 930], [884, 640], [890, 560], [873, 505], [920, 512], [960, 518], [1010, 540], [1040, 580], [1068, 620], [1102, 689], [1130, 760], [1150, 830], [1160, 930]],
        face: 0.56, facetBlur: 1.8, cap: 10, cover: 0.4, ledges: 0, rough: 10, litRange: 0.4, cun: 1.2, settle: SETTLE, fade: [780, 900],
        pines: [[890, 512, 40, -4, 0.2], [990, 552, 44, 8, 0.5], [905, 530, 58, -8, -0.3], [930, 560, 70, -10, 0.3], [960, 548, 52, 6, 0.6], [975, 600, 60, 10, 0.5], [1010, 640, 55, 5, 0.2], [1035, 610, 48, 12, 0.7],
          [1060, 668, 58, 8, 0.6], [1080, 705, 70, 0, 0.6], [1110, 760, 52, 10, 0.8], [940, 650, 46, -6, -0.4], [1000, 720, 50, 4, 0.5]] },
      { poly: [[640, 940], [640, 700], [645, 600], [634, 520], [640, 440], [637, 379], [666, 350], [735, 345], [804, 342], [855, 345], [873, 367], [878, 482], [884, 640], [890, 940]],
        face: 0.54, facetBlur: 1.8, cap: 12, cover: 0.4, ledges: 0, rough: 10, litRange: 0.4, cun: 1.2, settle: SETTLE, fade: [800, 920],
        pines: [[665, 395, 62, -15, -0.6], [690, 410, 80, -15, -0.5], [730, 395, 52, 4, 0.2], [760, 430, 70, 5, 0.4], [805, 410, 56, 10, 0.6], [835, 480, 75, 15, 0.6],
          [860, 430, 50, 12, 0.8], [700, 540, 65, -5, -0.3], [800, 600, 70, 8, 0.5], [850, 560, 52, 10, 0.7], [740, 700, 80, 0, 0.3], [690, 640, 50, -8, -0.4]] },
    ], { seed: 6 });
    layers.push(api.tex(midRock.src, { rect: midRock.rect, z: 1.4 }));
    const pmo = { gnarl: 0.7, snow: 0.95, paper: PAPER_COOL, padDensity: 2.6, haze: 0.15, needles: 10, fanSpacing: 0.9, swayAmp: 1.5, swayFreq: 0.2, ink: { bleed: 0.2, edge: 0.3 }, fans: { fanR: 2.1, needles: 22, needleWidth: 0.075, fanStep: 0.7, backTone: 0.45 }, caps: { cap: 11, mound: 6, blur: 4, freq: 0.1, lobes: 1, ragged: 0.3, rimAmt: 0.03, under: [220, 223, 227], round: 1.3, pokeV: 0.45 }, flecks: 1.2 };
    const pD = makePine(api, { ...pmo, seed: 64, x: 700, y: 470, height: 120, lean: -20, bend: -40, reach: -0.7, padSize: 50, needle: 7, trunkWidth: 10 });
    const pE = makePine(api, { ...pmo, seed: 65, x: 815, y: 560, height: 110, lean: 15, bend: 45, reach: 0.7, padSize: 48, needle: 6, trunkWidth: 9 });
    const pF = makePine(api, { ...pmo, seed: 66, x: 960, y: 610, height: 100, lean: 10, bend: 30, reach: 0.5, padSize: 44, needle: 6, trunkWidth: 9 });
    layers.push(pD.layer({ z: 1.4 }), pE.layer({ z: 1.4 }), pF.layer({ z: 1.4 }));
    tm('midrock');

    // frozen waterfall 2 and the pavilion on the pillar
    const ice2 = makeIcefall(api, [820, 570, 140, 330], [{ x: 890, y0: 715, y1: 872, hw0: 40, hw1: 46, lean: 6, col: 24, seed: 8, fade: 0.6, lip: 1.1 }, { x: 884, y0: 598, y1: 745, hw0: 34, hw1: 40, lean: 6, col: 24, seed: 2, fade: 0.92 }]);
    layers.push(api.tex(ice2, { rect: [820, 570, 140, 330], z: 1.4 }));
    const pav = bakeArch(api, [640, 240, 260, 130], (ctx) => {
      paintHall(ctx, { x: 690, y: 355, w: 80, snow: true, turn: 0.5, tiers: 1, steps: false, gable: false, seed: 61, paper: PAPER_COOL, fade: 0.08, aspect: 2.2, bays: [3, 1] });
      paintHall(ctx, { x: 781, y: 343, w: 95, snow: true, tiers: 2, aspect: 1.35, turn: 0.3, bays: [3, 2], seed: 62, paper: PAPER_COOL, steps: false, gable: false, colH: 0.55, roofH: 0.42, roof2H: 0.6, ridge: 0.35, upper: 0.74, upperB: 0.7 });
    });
    layers.push(api.tex(pav, { rect: [640, 240, 260, 130], z: 1.4 }));
    layers.push(makeMist(api, { top: 780, height: 300, lobe: 90, z: 1.35, seed: 7, drift: 8, extent: [560, 1500, 140] }));

    // ---- frozen waterfall 1 (z 1.25)
    const ice1 = makeIcefall(api, [500, 390, 280, 540], [
      // stacked tiers, lower ones first: each upper tier's icicles hang over the bulging lip below
      { x: 612, y0: 722, y1: 900, hw0: 62, hw1: 58, lean: -6, col: 30, seed: 5, fade: 0.55, lip: 1.2, recess: 0.4 },
      { x: 700, y0: 700, y1: 840, hw0: 44, hw1: 40, lean: 6, col: 28, seed: 6, fade: 0.7, lip: 1.1, recess: 0.4 },
      { x: 600, y0: 608, y1: 770, hw0: 60, hw1: 62, lean: -4, col: 30, seed: 4, fade: 0.9, lip: 1.2, recess: 0.6 },
      { x: 690, y0: 560, y1: 730, hw0: 48, hw1: 44, lean: 8, col: 30, seed: 3, fade: 0.9, lip: 1.2, recess: 0.6 },
      { x: 628, y0: 512, y1: 650, hw0: 68, hw1: 72, lean: 4, col: 30, seed: 7, fade: 0.95, lip: 1.2, recess: 0.6 },
      { x: 592, y0: 420, y1: 560, hw0: 50, hw1: 58, lean: 6, col: 30, seed: 1, fade: 0.95, recess: 0.8 },
    ]);
    layers.push(api.tex(ice1, { rect: [500, 390, 280, 540], z: 1.25 }));
    tm('ice');

    // ---- left cliff with the temple (z 1.15)
    const leftRock = bakeSnowCliff(api, [-200, 330, 900, 900], [
      // face under the temple
      { poly: [[255, 400], [300, 386], [360, 380], [420, 382], [470, 386], [520, 392], [545, 410], [548, 480], [552, 600], [548, 700], [540, 790], [255, 790]],
        face: 0.46, facetBlur: 1.8, snowDepth: 12, cover: 0.5, ledges: 0, facet: 50, litRange: 0.6, cun: 1, settle: SETTLE, fade: [660, 790],
        pines: [[270, 412, 46, -8, -0.4], [440, 405, 40, 6, 0.5], [530, 420, 44, 10, 0.7], [300, 455, 60, -10, -0.5], [350, 470, 48, 5, 0.3], [470, 450, 62, 8, 0.6], [520, 480, 50, 12, 0.8], [400, 560, 56, -4, 0.2], [500, 600, 60, 10, 0.6], [330, 660, 52, -8, -0.4]] },
      // upper-left shoulder, mostly snow
      { poly: [[-160, 470], [-90, 440], [-30, 425], [30, 428], [80, 445], [120, 440], [170, 452], [215, 470], [250, 505], [270, 550], [285, 620], [300, 700], [300, 800], [-160, 800]],
        face: 0.34, facetBlur: 2, snowDepth: 150, cover: 0.6, ledges: 0, cun: 0.8, rough: 12, pines: [[30, 470, 58, -10, -0.4], [160, 490, 52, 6, 0.4], [40, 575, 66, -6, -0.3], [130, 610, 58, 8, 0.4], [210, 565, 62, 10, 0.6], [80, 690, 56, -4, 0.2], [235, 665, 50, 12, 0.7], [-10, 640, 52, -8, -0.5]], peek: 0.5, fade: [720, 800] },
      // big snowy slope bottom left
      { poly: [[-160, 705], [-60, 690], [40, 708], [140, 694], [230, 718], [300, 728], [360, 746], [420, 762], [460, 790], [470, 860], [480, 1000], [490, 1200], [-160, 1200]],
        face: 0.28, facetBlur: 2, snowDepth: 100, cover: 0.55, ledges: 0, cun: 0.9, settle: SETTLE, pines: [[120, 760, 62, -6, -0.3], [300, 790, 54, 6, 0.4], [360, 860, 76, 5, 0.5]], peek: 0.4 },
      { poly: [[-160, 830], [0, 836], [110, 860], [190, 900], [235, 960], [255, 1060], [262, 1200], [-160, 1200]],
        face: 0.22, snowDepth: 110, cover: 0.55, ledges: 0, cun: 0.9, peek: 0.4, settle: SETTLE, pines: [[40, 990, 100, -4, 0.3], [-60, 1060, 96, -6, -0.2]] },
      // a lower snow shelf stepping down toward the dark pillar
      { poly: [[110, 905], [170, 884], [240, 876], [310, 884], [380, 896], [440, 910], [470, 940], [480, 1000], [490, 1200], [110, 1200]],
        face: 0.24, facetBlur: 2, snowDepth: 70, cover: 0.55, ledges: 0, cun: 1, peek: 0.4, settle: SETTLE, pines: [[200, 900, 70, 6, 0.4], [400, 915, 64, 8, 0.5]] },
      // dark pillar bottom right of the slope
      { poly: [[466, 835], [520, 815], [570, 828], [610, 858], [640, 900], [652, 1000], [662, 1200], [466, 1200]],
        face: 0.26, snowDepth: 22, cover: 0.5, ledges: 0, cun: 1, settle: SETTLE, fade: [1000, 1130], pines: [[540, 905, 100, -4, 0.6]] },
    ], { seed: 7 });
    layers.push(api.tex(leftRock.src, { rect: leftRock.rect, z: 1.15 }));
    tm('leftrock');
    // two larger snow pines on the left cliff, as their own swaying cards
    const pineOpts = { gnarl: 0.7, snow: 0.95, paper: PAPER_COOL, padDensity: 2.6, haze: 0.15, needles: 10, fanSpacing: 0.9, swayAmp: 2, swayFreq: 0.2, ink: { bleed: 0.2, edge: 0.3 }, fans: { fanR: 2.1, needles: 24, needleWidth: 0.075, fanStep: 0.7, backTone: 0.45 }, caps: { cap: 14, mound: 8, blur: 5, freq: 0.09, lobes: 1, ragged: 0.3, rimAmt: 0.03, under: [220, 223, 227], round: 1.4, pokeV: 0.45 }, flecks: 1.2 };
    const pA = makePine(api, { ...pineOpts, seed: 61, x: 268, y: 610, height: 150, lean: 30, bend: 50, reach: 0.85, padSize: 62, needle: 8, trunkWidth: 13 });
    const pB = makePine(api, { ...pineOpts, seed: 62, x: 432, y: 800, height: 190, lean: -8, bend: 70, reach: 0.9, padSize: 74, needle: 9, trunkWidth: 17 });
    const pC = makePine(api, { ...pineOpts, seed: 63, x: 70, y: 500, height: 120, lean: -12, bend: -40, reach: -0.5, padSize: 52, needle: 7, trunkWidth: 11 });
    // big dark snow pines filling the lower-left corner (the darkest mass of ref 06)
    const pG = makePine(api, { ...pineOpts, seed: 67, x: 110, y: 1110, height: 230, lean: 14, bend: 40, reach: 0.8, padSize: 80, needle: 9, trunkWidth: 18 });
    const pH = makePine(api, { ...pineOpts, seed: 68, x: 330, y: 1100, height: 170, lean: -6, bend: -30, reach: -0.5, padSize: 70, needle: 9, trunkWidth: 15 });
    layers.push(pA.layer({ z: 1.15 }), pB.layer({ z: 1.12 }), pC.layer({ z: 1.15 }), pH.layer({ z: 1.1 }), pG.layer({ z: 1.08 }));
    tm('pines');
    // pale conifers behind the temple, then the temple, then shrubs along the terrace front
    const gBack = bakeGarden(api, [60, 230, 240, 200], [
      { kind: 'pine', x: 120, y: 384, h: 70, lean: -6, tone: 0.5 }, { kind: 'pine', x: 172, y: 374, h: 92, lean: -3, tone: 0.48 }, { kind: 'pine', x: 222, y: 368, h: 74, lean: 5, tone: 0.55 },
    ], { seed: 11 });
    layers.push(api.tex(gBack, { rect: [60, 230, 240, 200], z: 1.15 }));
    const temple = bakeArch(api, [140, 200, 400, 200], (ctx) => {
      paintTemple(ctx, { x: 330, y: 374, w: 215, snow: true, style: 'pavilion', terrace: true, stairs: 'front', turn: -0.35, aspect: 1.9, seed: 6, paper: PAPER_COOL, sides: [{ dx: -0.5, dy: -0.04, w: 0.42, turn: 0.5 }] });
    });
    layers.push(api.tex(temple, { rect: [140, 200, 400, 200], z: 1.15 }));
    const gFront = bakeGarden(api, [80, 320, 460, 120], [
      { kind: 'pine', x: 138, y: 404, h: 50, lean: -10, reach: -0.5 }, { kind: 'red', x: 150, y: 393, w: 40 }, { kind: 'red', x: 212, y: 398, w: 66 },
      { kind: 'pine', x: 186, y: 406, h: 40, lean: -8, reach: -0.4 }, { kind: 'pine', x: 262, y: 408, h: 34, lean: 5 },
      { kind: 'red', x: 455, y: 390, w: 52 }, { kind: 'pine', x: 418, y: 405, h: 36, lean: 10, reach: 0.5 }, { kind: 'pine', x: 488, y: 403, h: 44, lean: 12, reach: 0.6 },
    ], { seed: 12 });
    layers.push(api.tex(gFront, { rect: [80, 320, 460, 120], z: 1.15 }));

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
        { pts: [[118, 128], [70, 80], [20, 52], [-30, 44]], w: 12, subs: 2 },
        { pts: [[156, 20], [215, -4], [290, -14], [340, -8]], w: 9, subs: 1 },
        { pts: [[230, 160], [262, 120], [300, 104], [350, 110]], w: 7, subs: 1 },
      ],
      padSize: 90, needle: 13, padDensity: 1.7, haze: 0, wet: 0.45, under: 0.9, needleWidth: 0.11, needles: 13, fanSpacing: 1.0, core: 0.15, soft: 0.55, barkTone: 0.24, swayAmp: 3, swayFreq: 0.18, fans: { fanR: 2.3, needles: 34, needleWidth: 0.07, fanStep: 0.55, rows: 3, backTone: 0.45 }, flecks: 0.4,
      caps: { cap: 20, mound: 20, blur: 10, freq: 0.04, bumps: 0.1, lobes: 0.6, flat: [0.1, 0.6], pokeV: 0.5, under: [214, 217, 221], rimAmt: 0.04, ragged: 0.18, round: 2.4 },
      ink: { bleed: 0.2, edge: 0.3 },
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
