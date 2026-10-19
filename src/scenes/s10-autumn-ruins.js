// s10 Autumn ruins (ref 10): a pine top-left over a dark left cliff with a red maple shedding
// leaves, ruined stone watchtowers on misty peaks, a crater lake ringed by forest, waterfalls,
// deep mist. Camera: slow pan right (the outgoing handscroll pan adds +220 px at the end; checked:
// no card edges with the camera at +260 px).
import { PAPER, stroke, dryStroke, blob, tone, rgba } from '../lib/brush.js';
import { inkify } from '../lib/inkfx.js';
import { makeSky } from '../lib/atmos.js';
import { makePeaks } from '../lib/peaks.js';
import { makePine } from '../lib/pine.js';
import { makeMaple } from '../lib/flora.js';
import { makeWaterfall } from '../lib/water.js';
import { paintTower, bakeArch } from '../lib/architecture.js';
import { paintSlope } from './s10/forest.js';
import { makeSpray, makeCraterLake } from './s10/fx.js';
import { bakeS08Rocks, bakeFineRocks, paintFoliage, paintFoliageWet, crossY } from './s10/rockpaint.js';
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
      ],
    });
    layers.push(far.layer({ z: Z.far, name: 'peaks-far' }));
    // far top-right: faint forested domes (painted slopes, not pillar ghosts)
    layers.push(slopeCard([1300, 20, 1150, 360], [
      { seed: 16, trees: 0.8, contour: [[1330, 190], [1380, 150], [1430, 112], [1480, 86], [1520, 78], [1560, 90], [1600, 114], [1640, 140], [1690, 170]], base: 330, fade: 0.3, tone: 0.68, rock: 0.85, h: [7, 13], cover: 0.5, canopy: 0, trees: 0.7 },
      { seed: 17, trees: 0.9, contour: [[1700, 200], [1760, 160], [1820, 126], [1870, 110], [1920, 118], [1980, 142], [2040, 132], [2100, 124], [2160, 142], [2240, 180], [2420, 220]], base: 340, fade: 0.3, tone: 0.62, rock: 0.83, h: [7, 14], cover: 0.5, canopy: 0, trees: 0.75 },
    ], Z.far * 0.999, 'domes-far', 0.5));
    layers.push(makeSpray(api, { name: 'mist-far', z: Z.far * 0.95, blobs: [[1000, 300, 500, 50, 1], [1650, 300, 520, 60, 1], [2200, 310, 400, 60, 1]], threshold: 0.45, scale: 160, drift: 4, shade: 0.15 }));

    // far faint tower peak (centre) + left tower peak + pointed peak + right mid peaks
    const midFar = makePeaks(api, {
      rect: [560, 120, 1500, 340], wet: WET_FAR, scale: 0.8,
      peaks: [
        { x: 1128, top: 228, base: 360, width: 130, cols: 2, shape: 'pillar', tone: 0.68, trees: 0.6, detail: 0.4, seed: 11 },
      ],
    });
    layers.push(midFar.layer({ z: Z.midFar, name: 'peaks-midfar' }));
    // forested peak rising behind the crag's right shoulder (ref: mid-grey, tree-textured)
    layers.push(slopeCard([1500, 40, 950, 420], [
      { seed: 18, trees: 1.1, jag: 10, contour: [[1540, 236], [1580, 176], [1620, 126], [1650, 102], [1680, 94], [1712, 106], [1740, 134], [1770, 162], [1810, 178], [1860, 172], [1910, 190], [1980, 228], [2060, 256], [2420, 300]], base: 440, fade: 0.4, fadeNoise: 40, tone: 0.34, rock: 0.7, h: [10, 18], cover: 0.65, canopy: 0.25, cun: 1.5 },
    ], Z.midFar * 0.997, 'peak-midfar-r', 0.8));
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
    // forested mountain left of the crag (ref: dark tree-crowned summit, pale flanks dissolving in mist)
    layers.push(slopeCard([930, 170, 320, 330], [
      { seed: 15, trees: 1.2, jag: 10, contour: [[950, 400], [978, 352], [1004, 306], [1030, 266], [1052, 238], [1072, 226], [1092, 236], [1112, 256], [1136, 288], [1164, 322], [1196, 352], [1236, 380]], base: 480, fade: 0.42, fadeNoise: 40, cun: 2, tone: 0.16, rock: 0.55, h: [10, 20], crest: 1.5, cover: 0.85, canopy: 0.3, mass: 1.2 },
    ], Z.crag * 1.002, 'peak-spire', 0.8));
    // the tower crag: one great leaning slab (fine axe-cut texture, moss dots, dark crown foliage)
    const slabRect = [1140, 90, 560, 390];
    // tapered wedge under the keep (pale cun-cut left face, forest pouring down its right slope)
    const slabO = [[1250, 166], [1256, 144], [1264, 130], [1280, 126], [1300, 130], [1322, 128], [1344, 130], [1366, 138], [1384, 152], [1398, 172], [1414, 198], [1428, 228], [1442, 266], [1454, 312], [1466, 380], [1474, 470], [1170, 470], [1192, 384], [1212, 306], [1230, 234], [1242, 190]];
    // a separate lower peak on the right, almost wholly forested (the small fall leaves its right shoulder)
    const peakRO = [[1436, 320], [1446, 270], [1458, 244], [1472, 226], [1484, 204], [1500, 196], [1512, 180], [1528, 178], [1540, 170], [1556, 182], [1570, 186], [1588, 204], [1602, 214], [1614, 236], [1632, 258], [1646, 290], [1662, 340], [1676, 404], [1684, 470], [1430, 470]];
    const spireO = [[1194, 236], [1204, 212], [1212, 204], [1220, 214], [1230, 244], [1238, 300], [1246, 470], [1166, 470], [1178, 380], [1188, 290]];
    // the wedge's right slope as its own outline: foliage is laid deep there, only a crown on the left face
    const slopeO = [[1300, 130], [1322, 128], [1344, 130], [1366, 138], [1384, 152], [1398, 172], [1414, 198], [1428, 228], [1442, 266], [1454, 312], [1466, 380], [1474, 470], [1300, 470]];
    const slab = bakeFineRocks(api, slabRect, [
      {
        seed: 26, outline: peakRO,
        facets: [1520, 1600], slant: 0.08, face: 0.68, shade: 0.16, crown: 0.9, mossSize: 0.7, contour: 0.5, tex: 1.6, texLen: 1.0, shadowTex: 1.6, dabs: 2.4, dabSize: 0.8, wisps: 0.6,
        inkTop: 0.5, inkDepth: 60, rough: 3,
        fade: [[1436, 280, 400], [1500, 350, 450], [1580, 300, 420], [1684, 330, 450]], fadeJitter: 1.2,
      },
      {
        seed: 21, outline: slabO,
        facets: [1236, 1318], slant: -0.04, face: 0.76, shade: 0.26, crown: 0.8, mossSize: 0.75, contour: 0.6, tex: 2.4, texLen: 1.5, shadowTex: 1.5, dabs: 2.0, dabSize: 0.8, wisps: 0.6,
        inkTop: 0.5, inkDepth: 60, rough: 3,
        fade: [[1176, 330, 450], [1250, 400, 480], [1330, 360, 470], [1420, 320, 440], [1474, 360, 470]], fadeJitter: 1.2,
      },
      {
        seed: 22, outline: spireO,
        facets: [1212], slant: -0.05, face: 0.48, shade: 0.12, crown: 0.7, mossSize: 0.7, contour: 0.6, tex: 2.0, texLen: 1.2, shadowTex: 1.4, dabs: 2, dabSize: 0.8, wisps: 0.6,
        inkTop: 0.45, inkDepth: 50,
        fade: [[1180, 340, 460], [1250, 340, 460]], fadeJitter: 0.8,
      },
    ], {
      fine: 2, haze: 0.16,
      after: (ctx) => {
        paintFoliageWet(ctx, peakRO, { wet: 1.3, crisp: 0.45, seed: 27, density: 1.6, depth: 150, size: 2.2, tones: [0.04, 0.42] });
        paintFoliageWet(ctx, slabO, { wet: 1.4, seed: 24, density: 1.2, depth: 60, size: 2.2, tones: [0.1, 0.44] });
        paintFoliageWet(ctx, slopeO, { wet: 1.3, crisp: 0.5, seed: 28, density: 1.6, depth: 190, size: 2.2, tones: [0.04, 0.42] });
        paintFoliageWet(ctx, spireO, { wet: 1.2, crisp: 0.5, seed: 25, density: 1.6, depth: 140, size: 1.8, tones: [0.06, 0.36] });
        const r = api.rng(23);
        for (const [x, y, h] of [[1262, 138, 14], [1356, 136, 18], [1380, 150, 18], [1402, 178, 20], [1424, 214, 18], [1444, 260, 16], [1494, 200, 34], [1516, 182, 50], [1540, 174, 56], [1562, 186, 44], [1590, 208, 38], [1612, 236, 26], [1640, 280, 20], [1230, 230, 12], [1210, 208, 12]]) {
          paintConifer(ctx, x, y + h * 0.1, h, { kind: r() < 0.5 ? 'pine' : 'fir', tone: 0.12 + r() * 0.12, rng: r.fork(x + ':' + y), width: 1.0 + r() * 0.3 });
        }
      },
    });
    // ruined keep, drawn before (behind) the slab: the slab's crown foliage hides the keep's base
    const towerRect = [1220, 0, 200, 160];
    const tower = bakeArch(api, towerRect, (ctx) => paintTower(ctx, { x: 1300, y: 154, w: 78, h: 118, seed: 10, ruin: 0.95, overgrow: 0.35, fade: 0.08 }));
    layers.push(api.tex(tower, { rect: towerRect, z: Z.crag * 0.9997, name: 'tower' }));
    layers.push(api.tex(inkify(api, slab.src, { edge: 0.35, granulation: 0.2, bleed: 0.8 }), { rect: slabRect, z: Z.crag * 0.9995, name: 'crag-slab' }));

    layers.push(...makeWaterfall(api, { name: 'falls-crag', z: Z.crag * 0.998, lip: [[1608, 296], [1621, 296]], height: 92, speed: 120, spray: false, lineWidth: 1.4, streakScale: 2.2, backingDark: 0.5, fade: 0.72, arch: 1, topBright: 0.1, thin: 0.6, ragged: 1.6, strands: 1.2, edgeSoft: 1.5, preset: 'far', seed: 4.1 }).layers);
    layers.push(makeSpray(api, { name: 'mist-crag', z: Z.crag * 0.96, blobs: [[1200, 470, 300, 60, 1], [1500, 450, 300, 70, 1], [900, 440, 260, 60, 0.9], [1850, 470, 300, 60, 0.9], [1200, 445, 150, 40, 0.8], [1490, 385, 190, 46, 0.8], [1110, 330, 130, 50, 0.8]], threshold: 0.45, softness: 0.42, scale: 120, drift: 6, shade: 0.45, shadow: [192, 186, 178] }));

    // ---------------------------------------------------------------- hills behind the lake + right pillar
    layers.push(slopeCard([440, 230, 1300, 460], [
      { seed: 31, trees: 1.1, jag: 14, contour: [[470, 330], [530, 300], [570, 292], [600, 280], [628, 296], [650, 302], [680, 330], [700, 342], [740, 376], [772, 392], [800, 418], [840, 430], [880, 452], [960, 482], [1010, 505]], base: 650, fade: 0.45, fadeNoise: 60, cun: 2, tone: 0.22, rock: 0.5, h: [16, 30], crest: 1.6, cover: 0.95, canopy: 0.35, mass: 1.4 },
      { seed: 32, trees: 1.0, jag: 16, contour: [[1100, 500], [1140, 470], [1180, 454], [1215, 448], [1250, 428], [1285, 436], [1320, 420], [1355, 442], [1400, 452], [1447, 476], [1500, 490], [1540, 510], [1610, 540], [1660, 580]], base: 660, fade: 0.4, fadeNoise: 60, cun: 1.8, tone: 0.24, rock: 0.55, h: [16, 28], crest: 1.6, cover: 0.9, canopy: 0.3, mass: 1.3 },
    ], Z.hill, 'hills', 0.7));
    layers.push(...makeWaterfall(api, { name: 'falls-left', z: Z.hill * 0.998, lip: [[712, 436], [726, 434]], height: 118, speed: 140, spray: false, lineWidth: 1.6, streakScale: 2.4, backingDark: 0.5, fade: 0.7, arch: 1, topBright: 0.15, thin: 0.6, ragged: 1.5, strands: 1.2, edgeSoft: 1.4, seed: 2.2 }).layers);
    layers.push(...makeWaterfall(api, { name: 'falls-left2', z: Z.hill * 0.998, lip: [[734, 446], [742, 446]], height: 92, speed: 130, spray: false, lineWidth: 1.4, streakScale: 2.2, backingDark: 0.45, fade: 0.65, arch: 1, topBright: 0.1, thin: 0.6, ragged: 1.6, strands: 1.2, edgeSoft: 1.4, preset: 'far', seed: 2.9 }).layers);
    layers.push(...makeWaterfall(api, { name: 'falls-ridge', z: Z.hill * 0.998, lip: [[1180, 474], [1192, 474]], height: 60, speed: 100, spray: false, lineWidth: 1.4, streakScale: 2.0, backingDark: 0.4, arch: 1, topBright: 0.1, ragged: 1.5, edgeSoft: 1.4, fade: 0.7, preset: 'far', seed: 3.3 }).layers);

    const rightP = makePeaks(api, {
      rect: [1600, 200, 600, 560], wet: WET_MID,
      peaks: [{ x: 1890, top: 296, base: 700, width: 440, tone: 0.13, trees: 1.6, treeSize: 1.2, seed: 41, columns: [{ dx: -95, top: 300, hw: 66, cap: 'round' }, { dx: 5, top: 336, hw: 58, cap: 'round' }, { dx: 110, top: 372, hw: 64, cap: 'round' }, { dx: 215, top: 326, hw: 70, cap: 'round' }] }],
    });
    layers.push(rightP.layer({ z: Z.rightPillar, name: 'peaks-right' }));
    layers.push(makeSpray(api, { name: 'mist-hills', z: Z.rightPillar * 0.95, blobs: [[760, 610, 300, 55, 0.65], [1120, 560, 240, 40, 0.6], [1700, 640, 340, 80, 1], [2150, 640, 300, 80, 1], [560, 550, 180, 50, 0.6]], threshold: 0.45, softness: 0.4, scale: 120, drift: 7, shade: 0.45, shadow: [192, 186, 178] }));

    // ---------------------------------------------------------------- crater lake + ring forests
    layers.push(slopeCard([460, 480, 1750, 380], [
      { seed: 51, trees: 1.0, contour: [[470, 640], [540, 586], [600, 566], [660, 576], [720, 602], [790, 640], [870, 690]], base: 840, fade: 0.5, tone: 0.22, rock: 0.58, h: [22, 42], cover: 0.9, canopy: 0.4, mass: 1.3 },
      { seed: 52, trees: 1.1, contour: [[840, 610], [900, 580], [960, 562], [1040, 540], [1100, 534], [1160, 546], [1200, 570], [1250, 596]], base: 670, fade: 0.6, tone: 0.2, rock: 0.6, h: [20, 38], cover: 0.95, canopy: 0.4, mass: 1.3 },
      { seed: 53, trees: 0.9, contour: [[1600, 600], [1680, 562], [1760, 540], [1850, 556], [1950, 532], [2100, 560], [2180, 600]], base: 780, fade: 0.45, tone: 0.22, rock: 0.62, h: [18, 32], canopy: 0.3 },
    ], Z.lakeBack, 'forest-lakeback', 0.8));
    layers.push(makeCraterLake(api, {
      z: Z.lake, rect: [870, 580, 590, 150], far: 597, near: 714,
      shape: [[890, 662], [902, 634], [930, 614], [985, 602], [1060, 598], [1150, 601], [1240, 596], [1320, 599], [1385, 605], [1428, 617], [1438, 640], [1412, 662], [1362, 683], [1290, 699], [1205, 711], [1115, 716], [1030, 711], [962, 699], [914, 684]],
      soft: 3.5, water: [146, 143, 137], refl: [62, 60, 56],
    }));
    // painted shoreline: a thin broken ink line along the far shore, a pale sandy beach on the left/near-left
    const shoreRect = [860, 570, 620, 170];
    layers.push(api.tex(inkify(api, api.bakeCanvas(shoreRect[2], shoreRect[3], (ctx) => {
      ctx.translate(-shoreRect[0], -shoreRect[1]);
      const r = api.rng(64);
      const far = [[900, 640], [912, 626], [936, 612], [985, 601], [1060, 597], [1150, 600], [1240, 595], [1320, 598], [1385, 604], [1426, 616]];
      const beachIn = [[892, 664], [914, 684], [962, 699], [1030, 711], [1100, 716]];
      const beachOut = [[870, 650], [878, 676], [902, 700], [950, 716], [1020, 728], [1090, 732]];
      // beach: pale paper band with a soft grey outer edge
      ctx.beginPath(); [...beachOut, ...beachIn.slice().reverse()].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
      ctx.filter = 'blur(2px)'; ctx.fillStyle = rgba(PAPER, 0.85); ctx.fill(); ctx.filter = 'none';
      // broken far-shore line: short overlapping strokes of varying weight, small dark dabs (tree feet) on it
      const at = (P, t) => { const j = Math.min(P.length - 2, Math.floor(t * (P.length - 1))); const u = t * (P.length - 1) - j; return [P[j][0] + (P[j + 1][0] - P[j][0]) * u, P[j][1] + (P[j + 1][1] - P[j][1]) * u]; };
      for (let t = 0; t < 1; ) { const L = 0.02 + r() * 0.05; if (r() < 0.8) { const a = at(far, t), b = at(far, Math.min(1, t + L * 0.5)), e = at(far, Math.min(1, t + L)); stroke(ctx, [a, [b[0], b[1] + (r() - 0.5) * 1.5], e], { width: 1.6 + r() * 2.4, color: tone(0.08 + r() * 0.12), alpha: 0.5 + r() * 0.35, rng: r, profile: 'brush', rough: 0.6 }); } t += L * (0.8 + r() * 0.5); }
      for (let i = 0; i < 40; i++) { const [x, y] = at(far, r()); blob(ctx, x, y - 1.5 - r() * 2, 1.2 + r() * 2.8, { color: tone(0.1 + r() * 0.2), alpha: 0.5 + r() * 0.4, rng: r, irregular: 0.6, squash: 0.6 }); }
      for (let i = 0; i < beachIn.length - 1; i++) if (r() < 0.5) stroke(ctx, [beachIn[i], beachIn[i + 1]], { width: 1.2 + r(), color: tone(0.4), alpha: 0.25 + r() * 0.2, rng: r, profile: 'taper', rough: 0.8 });
      for (let i = 0; i < 26; i++) { const t = r(); const j = Math.min(beachOut.length - 2, Math.floor(t * (beachOut.length - 1))); const u = t * (beachOut.length - 1) - j; const x = beachOut[j][0] + (beachOut[j + 1][0] - beachOut[j][0]) * u, y = beachOut[j][1] + (beachOut[j + 1][1] - beachOut[j][1]) * u; blob(ctx, x + (r() - 0.5) * 10, y + 3 + r() * 8, 1 + r() * 2.2, { color: tone(0.2 + r() * 0.3), alpha: 0.6, rng: r }); }
    }), { edge: 0.3, granulation: 0.2, bleed: 0.6 }), { rect: shoreRect, z: Z.lake * 0.999, name: 'lake-shore' }));
    layers.push(slopeCard([560, 560, 1300, 520], [
      { seed: 61, trees: 1.0, contour: [[600, 668], [680, 645], [760, 660], [840, 694], [920, 716], [1000, 730], [1080, 736], [1180, 730], [1230, 740]], base: 920, fade: 0.42, clump: 0.5, cover: 0.8, tone: 0.2, rock: 0.55, h: [26, 48], canopy: 0.35, mass: 1.3 },
      { seed: 62, trees: 1.0, contour: [[1250, 770], [1300, 742], [1350, 714], [1398, 684], [1430, 646], [1462, 616], [1530, 628], [1610, 646], [1680, 690], [1730, 745]], base: 1060, fade: 0.6, tone: 0.1, rock: 0.5, h: [28, 52], cover: 0.85, canopy: 0.3, mass: 1.3 },
    ], Z.lakeFront, 'forest-lakefront'));
    // dark rock lip the big waterfall spills over (ref: a textured cliff band under the lake's outflow)
    const lipRect = [1220, 700, 350, 300];
    const lipO = [[1232, 990], [1240, 900], [1256, 842], [1282, 796], [1318, 762], [1360, 746], [1404, 742], [1448, 744], [1484, 754], [1512, 778], [1528, 830], [1546, 920], [1556, 990]];
    const lipRock = bakeFineRocks(api, lipRect, [{
      seed: 66, outline: lipO, facets: [1340, 1400, 1470], face: 0.62, shade: 0.08, crown: 0, contour: 0.6, tex: 1.8, texLen: 1.3, shadowTex: 2.2, dabs: 1.6, dabSize: 0.6, wisps: 0,
      inkTop: 0.7, inkDepth: 70, fade: [[1236, 800, 900], [1300, 850, 960], [1410, 890, 985], [1556, 830, 950]], fadeJitter: 0.8,
    }], { fine: 1.5, after: (ctx) => {
      paintFoliage(ctx, lipO, { seed: 67, density: 1.3, depth: 40, size: 1.8, tones: [0.06, 0.34] });
      // pale water sliding over the rounded lip from the lake's outflow into each strand
      const rw = api.rng(68);
      for (const [cx, ly, w] of [[1372, 746, 16], [1408, 753, 26], [1439, 761, 12]]) {
        for (let j = 0; j < 4; j++) {
          const ox = (rw() - 0.5) * w * 0.8;
          stroke(ctx, [[cx + ox - 30 - rw() * 10, ly - 16 - rw() * 6], [cx + ox - 12, ly - 8], [cx + ox, ly + 2]], { width: [2 + rw() * w * 0.25, 1.5 + rw() * 2], color: rgba(PAPER, 1), alpha: 0.55 + rw() * 0.35, rng: rw, profile: 'taper' });
        }
      }
    } });
    layers.push(api.tex(inkify(api, lipRock.src, { edge: 0.4, granulation: 0.2, bleed: 0.8 }), { rect: lipRect, z: Z.lakeFront * 0.999, name: 'falls-rock' }));
    // three separate strands over the lip (dark rock between them)
    const FB = { z: Z.lakeFront * 0.998, speed: 200, sheets: 2, thin: 0.6, strands: 1.2, ragged: 1.6, edgeSoft: 1.5, arch: 3, curve: 12, topBright: 0.05, darkness: 0.5, lineWidth: 1.8, streakScale: 2.6, backingDark: 0.45, backingMargin: 6 };
    layers.push(...makeWaterfall(api, { ...FB, name: 'falls-big-l', lip: [[1362, 744], [1382, 748]], height: 150, fade: 0.68, seed: 5.1, spray: false }).layers);
    layers.push(...makeWaterfall(api, { ...FB, name: 'falls-big', lip: [[1392, 752], [1424, 754]], height: 186, fade: 0.72, seed: 5.5, spray: { amount: 0.8, shade: 0.45, shadow: [192, 186, 178], width: 70 } }).layers);
    layers.push(...makeWaterfall(api, { ...FB, name: 'falls-big-r', lip: [[1432, 760], [1446, 763]], height: 158, fade: 0.66, seed: 5.9, spray: false }).layers);
    layers.push(makeSpray(api, { name: 'mist-lake', z: Z.lakeFront * 0.96, blobs: [[820, 770, 280, 55, 0.7], [1100, 790, 240, 50, 0.6], [1800, 900, 300, 110, 1.0], [2150, 840, 320, 110, 1], [1450, 980, 300, 80, 0.9], [640, 730, 180, 50, 0.6]], threshold: 0.45, scale: 130, drift: 8, shade: 0.45, shadow: [192, 186, 178] }));

    // ---------------------------------------------------------------- bottom forests
    layers.push(slopeCard([480, 760, 1050, 420], [
      { seed: 71, contour: [[860, 880], [920, 830], [980, 806], [1035, 816], [1100, 850], [1150, 886], [1220, 920], [1265, 950], [1330, 966], [1400, 992], [1450, 1020]], base: 1150, fade: 0.5, tone: 0.1, rock: 0.5, h: [40, 72], cover: 0.9, canopy: 0.3, mass: 1.3 },
    ], Z.bottom, 'forest-bottom'));
    layers.push(slopeCard([440, 820, 520, 380], [
      { seed: 81, contour: [[480, 980], [520, 950], [580, 902], [640, 882], [700, 900], [760, 930], [830, 980], [880, 1030]], base: 1180, fade: 0.55, tone: 0.05, rock: 0.5, h: [55, 100], cover: 0.8, pineShare: 0.6 },
    ], Z.foot, 'forest-foot'));
    layers.push(makeSpray(api, { name: 'mist-low', z: Z.foot * 0.95, blobs: [[1150, 1060, 380, 70, 1], [1650, 1000, 420, 120, 1.1], [2100, 980, 360, 120, 1], [700, 1080, 260, 60, 0.8]], threshold: 0.45, scale: 130, drift: 9, shade: 0.45, shadow: [192, 186, 178] }));

    // ---------------------------------------------------------------- left cliff
    const upperCol = {
      seed: 91, outline: [[-180, 300], [-80, 268], [0, 256], [50, 262], [96, 282], [140, 276], [180, 290], [214, 306], [248, 338], [274, 394], [290, 480], [298, 560], [305, 650], [310, 760], [312, 880], [-180, 880]],
      facets: [40, 130, 215, 270], face: 0.7, shade: 0.08, crown: 0, contour: 0.7, shadowTex: 2.0, tex: 1.6, texLen: 1.1, slant: 0.22, dabs: 2.6, dabSize: 0.7, wisps: 0,
      inkTop: 0.85, inkDepth: 150,
      fade: [[-100, 580, 780], [140, 520, 720], [312, 470, 660]],
    };
    const stepRock = {
      seed: 92, outline: [[282, 600], [318, 572], [366, 562], [404, 578], [428, 616], [440, 700], [446, 820], [282, 820]],
      facets: [330, 398], face: 0.72, slant: 0.2, dabSize: 0.7, shade: 0.1, crown: 0, contour: 0.7, wisps: 0, shadowTex: 2.4, tex: 1.5, texLen: 1.5, dabs: 1.6, dabSize: 0.45,
      inkTop: 0.8, inkDepth: 80,
      fade: [[282, 640, 780], [446, 670, 800]],
    };
    const lowCrag = {
      seed: 93, outline: [[398, 690], [426, 656], [462, 650], [492, 676], [506, 740], [514, 820], [520, 900], [398, 900]],
      facets: [446, 490], face: 0.74, slant: 0.2, dabSize: 0.7, shade: 0.1, crown: 0, contour: 0.7, wisps: 0, shadowTex: 2.4, tex: 1.5, texLen: 1.4, dabs: 1.6, dabSize: 0.45,
      inkTop: 0.75, inkDepth: 70,
      fade: [[398, 740, 870], [520, 760, 880]],
    };
    const lowerMass = {
      seed: 94, outline: [[-180, 870], [-60, 858], [40, 846], [120, 852], [200, 834], [262, 840], [320, 816], [372, 806], [410, 788], [440, 780], [468, 792], [494, 822], [522, 868], [544, 930], [562, 1010], [576, 1100], [584, 1250], [-180, 1250]],
      facets: [60, 170, 290, 410, 520], face: 0.56, shade: 0.04, crown: 0, contour: 0.7, shadowTex: 2.6, tex: 1.7, texLen: 1.6, dabs: 3.4, dabSize: 0.8, slant: 0.32, wisps: 0,
      inkTop: 1.0, inkDepth: 210, rough: 4,
      fade: [[-100, 1130, 1250], [250, 1120, 1250], [620, 1150, 1250]],
    };
    const cliffRect = [-200, 200, 860, 1080];
    const cliffBake = bakeFineRocks(api, cliffRect, [upperCol, stepRock, lowCrag, lowerMass], {
      fine: 1,
      after: (ctx) => {
        // ink-dot foliage crowning each rock (breaks the silhouettes)
        paintFoliageWet(ctx, upperCol.outline, { wet: 1.3, crisp: 0.45, seed: 96, density: 1.8, depth: 130, size: 3.2, tones: [0.0, 0.3] });
        paintFoliageWet(ctx, stepRock.outline, { wet: 1.3, crisp: 0.45, seed: 97, density: 1.4, depth: 45, size: 2.6, tones: [0.02, 0.32] });
        paintFoliageWet(ctx, lowCrag.outline, { wet: 1.3, crisp: 0.45, seed: 98, density: 1.4, depth: 40, size: 2.4, tones: [0.02, 0.32] });
        paintFoliageWet(ctx, lowerMass.outline, { wet: 1.3, crisp: 0.45, seed: 99, density: 1.7, depth: 170, size: 3.4, tones: [0.0, 0.3] });
        // dry-brush skips: pale diagonal streaks slanting down-left through the dark lower mass (ref 10)
        const rs = api.rng(90);
        // broad lit rock planes (pale dry brush) each with a dark shadow edge on its right: axe-cut planes
        for (let i = 0; i < 9; i++) {
          const x = -40 + (i / 9) * 560 + rs() * 50, tt = crossY(lowerMass.outline, x); if (!tt.length) continue;
          const y = tt[0] + 50 + rs() * 70, len = 140 + rs() * 140, dx = -(0.3 + rs() * 0.35) * len;
          const w = 26 + rs() * 34, bend = (rs() - 0.5) * 30;
          const P = (o) => [[x + o, y], [x + o + dx * 0.45 + bend, y + len * 0.5], [x + o + dx, y + len]];
          dryStroke(ctx, P(0), { width: w, profile: 'taper', bristles: 9 + ((rs() * 5) | 0), color: tone(0.6 + rs() * 0.2), alpha: 0.3 + rs() * 0.25, dry: 0.6 + rs() * 0.25, rng: rs });
          dryStroke(ctx, P(w * 0.55), { width: 8 + rs() * 8, profile: 'taper', bristles: 4 + ((rs() * 3) | 0), color: tone(0.02 + rs() * 0.06), alpha: 0.55 + rs() * 0.3, dry: 0.35 + rs() * 0.25, rng: rs });
        }
      },
    });
    const cliff = { layer: (o) => api.tex(inkify(api, cliffBake.src, { edge: 0.5, granulation: 0.25, bleed: 1.0 }), { rect: cliffRect, ...o }) };
    layers.push(cliff.layer({ z: Z.cliff, name: 'cliff-left' }));
    const cliffTreesRect = [-120, 200, 720, 720];
    const cliffTrees = api.bakeCanvas(cliffTreesRect[2], cliffTreesRect[3], (ctx) => {
      ctx.translate(-cliffTreesRect[0], -cliffTreesRect[1]);
      const r = api.rng(95);
      const T = [[60, 268, 30, 'pine'], [104, 284, 40, 'fir'], [150, 280, 34, 'fir'], [190, 294, 48, 'fir'], [232, 322, 40, 'pine'], [262, 362, 34, 'fir'],
        [292, 420, 26, 'fir'], [300, 480, 24, 'fir'], [306, 545, 22, 'pine'],
        [318, 580, 36, 'fir'], [352, 570, 46, 'fir'], [392, 576, 38, 'pine'], [420, 600, 30, 'fir'],
        [436, 662, 40, 'fir'], [470, 658, 34, 'pine'], [496, 690, 28, 'fir'],
        [236, 840, 26, 'pine'], [330, 816, 34, 'pine'], [372, 808, 42, 'fir'], [410, 790, 52, 'fir'], [446, 782, 46, 'pine'], [478, 798, 38, 'fir'], [506, 836, 30, 'fir']];
      for (const [x, y, h, kind] of T) paintConifer(ctx, x, y + h * 0.08, h, { kind, tone: 0.04 + r() * 0.08, rng: r.fork(x + ':' + y), width: 1.0 + r() * 0.4 });
    });
    layers.push(api.tex(inkify(api, cliffTrees, { edge: 0.35, granulation: 0.12, bleed: 0.8 }), { rect: cliffTreesRect, z: Z.cliff * 0.998, name: 'cliff-trees', sway: { amp: 1.2, freq: 0.2, scale: 200, power: 1.5, anchor: [300, 900], radius: 600 } }));
    // red maple (ref 10 tree, lab/flora-10)
    const maple = makeMaple(api, {
      seed: 10, paper: PAPER,
      trees: [{ x: 150, y: 870, height: 380, width: 400, lean: -12, shape: 'spread', crown: [160, 600, 220, 150], palette: { bright: [182, 50, 36], mid: [150, 40, 30], dark: [98, 28, 22], pale: [196, 128, 108] }, inkLeaves: 0.28, density: 2.4, leafSize: 5.5, trunk: 34, gnarl: 1.15, dry: 0.7, trunkLen: 104, depth: 5, limbs: [[-112, 95, 0.6], [-58, 105, 0.55], [-14, 120, 0.45], [-155, 60, 0.4]] }],
    });
    layers.push(maple.layer({ z: Z.maple, amp: 3, freq: 0.22 }));
    // hero pine top-left
    const pine = makePine(api, {
      seed: 101, height: 440, gnarl: 0.85,
      spine: [[-26, 560], [16, 484], [66, 414], [114, 346], [142, 292], [132, 240], [104, 200], [94, 162], [104, 128]],
      trunkWidth: 40, taper: 0.4, flare: 0.25,
      limbs: [
        { pts: [[104, 130], [150, 106], [210, 88], [280, 84], [344, 100]], w: 12, subs: 7 },
        { pts: [[96, 150], [60, 128], [20, 116], [-24, 112]], w: 11, subs: 4 },
        { pts: [[104, 128], [116, 92], [146, 60], [196, 38], [236, 34]], w: 9, subs: 5 },
        { pts: [[110, 196], [150, 176], [196, 166]], w: 8, subs: 2 },
        { pts: [[138, 300], [188, 270], [250, 250], [320, 246], [400, 260], [460, 278], [520, 300]], w: 14, subs: 8 },
      ],
      padSize: 46, padAspect: 0.42, needle: 6, needles: 12, needleWidth: 0.12, padDensity: 5, crest: 0.4, wet: 0.35, haze: 0, scale: 1.25, barkTone: 0.42, barkDensity: 1.8,
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
