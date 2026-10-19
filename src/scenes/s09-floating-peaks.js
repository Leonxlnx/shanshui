// s09 Floating peaks (ref 09): pine top-left, temple on the left cliff with a waterfall,
// pillar peaks crowned with pavilions floating in a sea of clouds, small arch bridges, four cranes.
// Layer stack and notes: out/s09/NOTES.md
import { makeSky } from '../lib/atmos.js';
import { makeBillows } from './s09/clouds.js';
import { softMist } from './s09/fx.js';
import { makePeaks } from './s09/peaks.js';
import { BRUSH, WET } from './s09/style.js';
import { paintClump } from './s09/foliage.js';
import { paintPavilion, paintArchBridge, bakeArch } from '../lib/architecture.js';
import { makeCraneFlock } from '../lib/fauna.js';
import { inkify } from '../lib/inkfx.js';
import { paintMaple } from '../lib/flora.js';
import { buildLeft, Z_BACK, FALLS } from './s09/left.js';

const PAPER09 = [240, 233, 223];
const D = Math.PI / 180;
const T_MATCH = 3;                       // composition matches the reference at this t
const CAM_VX = 9;                        // px/s drift right at the picture plane
const camX = (t) => CAM_VX * (t - T_MATCH);

const FALLS_C = [(FALLS.lip[0][0] + FALLS.lip[1][0]) / 2 + 12, FALLS.lip[0][1] + FALLS.height * 0.45];
export const FACTS = {
  // waterfall centre in rest space, and on screen at the start of the outgoing zoom (t ~ 5.5)
  waterfallRest: FALLS_C.map(Math.round),
  waterfallZ: Z_BACK,
  waterfall: [Math.round(FALLS_C[0] - camX(5.5) / Z_BACK), Math.round(FALLS_C[1])],
  camera: 'x = 9 * (t - 3) px at z = 1, y = 0 (the cloud-rise transition adds its own y offset)',
};

// pavilions: [x, baseY, w, fade, group]
const PAVS = [
  [1672, 125, 44, 0.3, 'mid'],
  [872, 277, 43, 0.25, 'mid'],
  [677, 410, 50, 0.15, 'mid'],
  [1766, 404, 55, 0.18, 'mid'],
  [1217, 371, 89, 0.08, 'nm'],
  [1310, 420, 68, 0.08, 'nm'],
  [655, 610, 50, 0.05, 'nm'],
  [1014, 606, 49, 0.05, 'nm'],
  [1809, 676, 75, 0.0, 'nm'],
  [1622, 834, 51, 0.05, 'near'],
];
const BRIDGES = [
  { g: 'nm', x0: 1037, x1: 1119, y: 690, deck: [615, 615], hump: 3, arches: [{ c: 1078, span: 68, crown: 623, rise: 0.8 }], balH: 6, postSp: 11, ring: 3.4, barrelDepth: 0.1, fadeBelow: [655, 688], tone: 0.66, seed: 91 },
  { g: 'nm', x0: 1378, x1: 1458, y: 528, deck: [474, 482], hump: 3, arches: [{ c: 1418, span: 64, crown: 488, rise: 0.8 }], balH: 6, postSp: 11, ring: 3.4, barrelDepth: 0.1, fadeBelow: [500, 526], tone: 0.66, seed: 92, fade: 0.05 },
  { g: 'mid', x0: 1668, x1: 1734, y: 470, deck: [430, 424], hump: 2, arches: [{ c: 1701, span: 50, crown: 438 }], balH: 5, postSp: 9, ring: 3, barrelDepth: 0.12, fadeBelow: [452, 468], tone: 0.66, seed: 93, fade: 0.1 },
  { g: 'nm', x0: 552, x1: 607, y: 680, deck: [630, 630], hump: 2, arches: [{ c: 582, span: 25, crown: 642, rise: 0.8 }], balH: 4, postSp: 8, ring: 2.5, barrelDepth: 0.1, fadeBelow: [652, 678], tone: 0.66, seed: 94, fade: 0.3 },
];

// the four cranes of ref 09 (positions at T_MATCH)
const CRANES09 = [
  { x: 1163, y: 173, size: 136, heading0: -24 * D, phase: 0.96, vx: 50, vy: -10, seed: 8 },
  { x: 1310, y: 221, size: 121, heading0: -13.3 * D, phase: 0.9, vx: 54, vy: -6, seed: 9 },
  { x: 1412, y: 235, size: 101, heading0: 2.6 * D, phase: 0.5, vx: 58, vy: 0, seed: 10 },
  { x: 1517, y: 271, size: 116, heading0: -12 * D, phase: 0.0, vx: 55, vy: -6, seed: 11 },
];

function archCard(api, group, rect, z) {
  const src = bakeArch(api, rect, (ctx) => {
    for (const o of BRIDGES) if (o.g === group) paintArchBridge(ctx, o);
    PAVS.forEach(([x, y, w, f, g], i) => {
      if (g !== group) return;
      // a small red maple beside most pavilions (as in the reference)
      if (i % 3 !== 1) paintMaple(ctx, { x: x + (i % 2 ? 1 : -1) * w * 0.62, y: y + 6, height: w * 0.42, width: w * 0.5, lean: (i % 2 ? 15 : -15), seed: 300 + i, paper: PAPER09, distance: f * 2, leafSize: 1.6 });
      paintPavilion(ctx, { x, y, w, fade: f, seed: 90 + i, variant: 'peak', paper: PAPER09 });
    });
  });
  return api.tex(src, { rect, z, name: 'arch-' + group });
}

const SEA = { farFade: 0.2, outline: 0, softness: 5, texture: 1.2, wisp: 0.25, perspective: 1.0, undulate: 2.4, detail: 1.25, shadowColor: [150, 146, 140] };
// chunkier pillars: columns widen toward the mist and carry fewer spindle tips
// brushwork: fissures and crevices only near the summits, foliage kept on the crowns, lighter lit faces
const chunky = (peaks, k = {}) => peaks.map((p) => ({ ...BRUSH, ...k, ...(p.columns ? { ...p, columns: p.columns.map((c) => ({ spread: 0.5, foliage: 0.5, tips: c.cap === 'flat' ? undefined : 1, ...c })) } : p) }));

export default {
  id: 's09', title: 'Floating peaks', ref: '09',
  build(api) {
    const layers = [];
    layers.push(makeSky(api, { top: [239, 232, 222], bottom: PAPER09, mottle: 0.012, seed: 9 }));

    // ---------------------------------------------------------------- far row (z 8)
    // far rows in the faceted 'cun' style too (crisp spires with plane lines, light moss), softened by the wet pass
    const FARB = { fibreK: 0.9, ledgeK: 0.15, mossK: 0.9, cunK: 0.5 };
    const lite = (p) => ({ ...p, detail: (p.detail ?? 1) * 0.5 }); // far columns are small: half the strokes
    const far = makePeaks(api, {
      paper: PAPER09,
      peaks: chunky([
        { x: 545, top: 45, base: 290, width: 210, tone: 0.7, seed: 91, fade: 0.35, treeSize: 0.45, detail: 0.7, columns: [
          { dx: 0, top: 45, hw: 46, cap: 'point', spread: 0.9 }, { dx: -62, top: 105, hw: 40, spread: 0.7 }, { dx: 60, top: 92, hw: 42, spread: 0.7 }, { dx: -110, top: 160, hw: 36 }, { dx: 115, top: 150, hw: 40 }] },
        { x: 975, top: 30, base: 260, width: 240, tone: 0.72, seed: 92, fade: 0.35, treeSize: 0.45, detail: 0.7, columns: [
          { dx: 0, top: 30, hw: 50, cap: 'point', spread: 0.9 }, { dx: -70, top: 90, hw: 44, spread: 0.7 }, { dx: 72, top: 80, hw: 44, spread: 0.7 }, { dx: -125, top: 140, hw: 38 }, { dx: 128, top: 135, hw: 40 }] },
        { x: 1440, top: 55, base: 270, width: 230, tone: 0.72, seed: 93, fade: 0.35, treeSize: 0.45, detail: 0.7, columns: [
          { dx: 0, top: 55, hw: 46, cap: 'point', spread: 0.9 }, { dx: -66, top: 110, hw: 42, spread: 0.7 }, { dx: 64, top: 100, hw: 42, spread: 0.7 }, { dx: -118, top: 160, hw: 36 }, { dx: 120, top: 150, hw: 38 }] },
        { x: 1800, top: 95, base: 260, width: 160, cols: 3, tone: 0.83, seed: 99, fade: 0.35, treeSize: 0.4, detail: 0.6 },
      ], FARB).map(lite),
    });
    layers.push(far.layer({ z: 8, name: 'far' }));
    layers.push(makeBillows(api, { yBack: 255, yFront: 390, rows: 3, lobe: 60, z: 7, seed: 3, drift: 3, shade: 0.5, haze: 0.07, name: 'cs-far', rect: [-480, 130, 2880, 500] }));

    // ---------------------------------------------------------------- second row (z 5)
    const far2 = makePeaks(api, {
      paper: PAPER09,
      peaks: chunky([
        { x: 560, top: 225, base: 380, width: 170, cols: 4, tone: 0.7, seed: 95, fade: 0.35, treeSize: 0.5, detail: 0.7 },
        { x: 1075, top: 245, base: 380, width: 180, cols: 3, tone: 0.72, seed: 96, fade: 0.35, treeSize: 0.5, detail: 0.7 },
        { x: 1900, top: 160, base: 400, width: 200, cols: 3, tone: 0.55, seed: 106, fade: 0.4, treeSize: 0.6, detail: 0.8 },
        { x: 1580, top: 250, base: 400, width: 150, cols: 3, tone: 0.66, seed: 110, fade: 0.35, treeSize: 0.5, detail: 0.7 },
      ], FARB).map(lite),
    });
    // wisps drifting in front of the far row
    layers.push(softMist(api, { cx: 760, cy: 195, rx: 260, ry: 38, z: 6, density: 0.75, drift: 10, move: 9, seed: 21, scale: 70, color: PAPER09, shade: 0, name: 'wisp-far-a' }));
    layers.push(softMist(api, { cx: 1500, cy: 230, rx: 300, ry: 34, z: 6, density: 0.7, drift: 10, move: 11, seed: 22, scale: 70, color: PAPER09, shade: 0, name: 'wisp-far-b' }));
    layers.push(far2.layer({ z: 5, name: 'far2' }));
    layers.push(makeBillows(api, { yBack: 395, yFront: 545, rows: 3, lobe: 72, z: 4.4, seed: 4, drift: 4, shade: 0.6, haze: 0.08, name: 'cs-far2', rect: [-480, 260, 2880, 600] }));

    // ---------------------------------------------------------------- mid row (z 3.5)
    const mid = makePeaks(api, { wet: WET,
      paper: PAPER09,
      peaks: chunky([
        { x: 1670, top: 120, base: 400, tone: 0.42, seed: 101, fade: 0.45, clearTop: [0], columns: [
          { dx: 2, top: 129, hw: 38, cap: 'flat', lit: 0.5, spread: 0.9 }, { dx: -75, top: 245, hw: 50, lit: 0.3 }, { dx: 80, top: 225, hw: 46, lit: 0.6 }] },
        { x: 870, top: 272, base: 520, tone: 0.4, seed: 102, fade: 0.45, clearTop: [0], columns: [
          { dx: 2, top: 281, hw: 38, cap: 'flat', lit: 0.55 }, { dx: -48, top: 310, hw: 34, lit: 0.3 }, { dx: 55, top: 300, hw: 30, lit: 0.7 }] },
        { x: 1040, top: 430, base: 600, width: 150, cols: 3, tone: 0.55, seed: 107, fade: 0.4 },
        { x: 800, top: 475, base: 640, width: 110, cols: 2, tone: 0.42, seed: 108, fade: 0.45 },
        { x: 1720, top: 400, base: 620, tone: 0.38, seed: 103, fade: 0.45, clearTop: [1], columns: [
          { dx: -85, top: 428, hw: 42, lit: 0.4 }, { dx: 46, top: 408, hw: 46, cap: 'flat', lit: 0.55 }, { dx: 120, top: 450, hw: 40, lit: 0.6 }] },
        { x: 677, top: 410, base: 660, tone: 0.34, seed: 104, fade: 0.45, clearTop: [0], columns: [
          { dx: 0, top: 414, hw: 36, cap: 'flat', lit: 0.5 }, { dx: -55, top: 450, hw: 40, lit: 0.3 }, { dx: 52, top: 460, hw: 30, lit: 0.6 }] },
      ]),
    });
    layers.push(mid.layer({ z: 3.5, name: 'mid' }));
    layers.push(archCard(api, 'mid', [600, 60, 1300, 500], 3.5));
    layers.push(makeBillows(api, { yBack: 615, yFront: 790, rows: 3, lobe: 82, z: 2.9, seed: 5, drift: 5, shade: 1.15, haze: 0.3, texture: 0.55, name: 'cs-mid', rect: [-480, 440, 2880, 490] }));

    // ---------------------------------------------------------------- near-mid row (z 2.2)
    const nm = makePeaks(api, { wet: WET,
      paper: PAPER09,
      peaks: chunky([
        { x: 1220, top: 375, base: 900, tone: 0.15, seed: 111, fade: 0.55, clearTop: [1, 2], columns: [
          { dx: -110, top: 402, hw: 52, lit: 0.25, spread: 0.6 }, { dx: -2, top: 376, hw: 74, cap: 'flat', lit: 0.45, spread: 0.55 },
          { dx: 95, top: 426, hw: 46, cap: 'flat', lit: 0.6, spread: 0.6 }, { dx: 150, top: 480, hw: 40, lit: 0.65, spread: 0.7 }] },
        { x: 1490, top: 470, base: 780, tone: 0.24, seed: 116, fade: 0.5, columns: [
          { dx: 0, top: 470, hw: 52, lit: 0.5 }, { dx: 45, top: 520, hw: 30, lit: 0.65 }] },
        { x: 1180, top: 530, base: 940, tone: 0.16, seed: 113, fade: 0.55, columns: [
          { dx: 4, top: 530, hw: 86, lit: 0.42, spread: 0.85, tips: 1, skew: -0.3 }, { dx: 88, top: 612, hw: 32, lit: 0.6 }] },
        { x: 975, top: 600, base: 920, tone: 0.2, seed: 112, fade: 0.55, clearTop: [1], columns: [
          { dx: -45, top: 598, hw: 40, lit: 0.3 }, { dx: 39, top: 610, hw: 36, cap: 'flat', lit: 0.5 }, { dx: 80, top: 650, hw: 26, lit: 0.6 }] },
        { x: 655, top: 610, base: 920, tone: 0.2, seed: 114, fade: 0.55, clearTop: [0], columns: [
          { dx: 0, top: 614, hw: 40, cap: 'flat', lit: 0.5 }, { dx: -45, top: 650, hw: 30, lit: 0.3 }, { dx: 48, top: 640, hw: 28, lit: 0.6 }] },
        { x: 1800, top: 680, base: 850, tone: 0.2, seed: 115, fade: 0.3, clearTop: [0], columns: [
          { dx: 9, top: 680, hw: 45, cap: 'flat', lit: 0.5 }, { dx: -60, top: 705, hw: 42, lit: 0.3 }, { dx: 80, top: 700, hw: 38, lit: 0.6 }] },
      ], { valK: 1.6, washK: 2.3, mossK: 2.4, faceK: 0.7 }),
    });
    layers.push(nm.layer({ z: 2.2, name: 'near-mid' }));
    layers.push(archCard(api, 'nm', [520, 280, 1400, 440], 2.2));
    layers.push(makeBillows(api, { yBack: 880, yFront: 1300, rows: 4, lobe: 145, z: 1.9, seed: 6, drift: 6, shade: 1.05, haze: 0.28, texture: 0.4, name: 'cs-nm', rect: [-480, 640, 2880, 640] }));

    // ---------------------------------------------------------------- near row (z 1.5)
    const near = makePeaks(api, { wet: WET,
      paper: PAPER09,
      peaks: chunky([
        { x: 1622, top: 838, base: 1030, tone: 0.2, seed: 121, fade: 0.3, clearTop: [0], columns: [
          { dx: 0, top: 838, hw: 45, cap: 'flat', lit: 0.45, spread: 0.3 }, { dx: -55, top: 875, hw: 40, lit: 0.3, spread: 0.3 }, { dx: 65, top: 885, hw: 45, lit: 0.6, spread: 0.3 }] },
      ], { valK: 1.6, washK: 2.3, mossK: 2.4, faceK: 0.7 }),
    });
    layers.push(near.layer({ z: 1.5, name: 'near' }));
    layers.push(archCard(api, 'near', [1560, 760, 130, 90], 1.5));
    const trees = api.bakeCanvas(1560, 460, (ctx) => {
      ctx.translate(-560, -660);
      const T = { pineShare: 0.05, spruce: 0.6, paper: PAPER09, under: 0, lean: 5 };
      // feet dissolve into the cloud sea (no hard cut-out edge); painted top row first
      // billowy mist eating the feet: a vertical fade plus soft puffs at uneven heights (no straight cut)
      let fs = 1;
      const feet = (x0, x1, y0, y1) => {
        const gr = ctx.createLinearGradient(0, y0, 0, y1);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
        ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.globalAlpha = 1; ctx.fillStyle = gr;
        ctx.fillRect(x0 - 90, y0, x1 - x0 + 180, y1 - y0 + 90);
        for (let x = x0 - 70; x < x1 + 70; x += 22) {
          fs = (fs * 16807) % 2147483647; const q = fs / 2147483647;
          const py = y0 + (y1 - y0) * (0.35 + 0.6 * q), pr = 26 + 30 * ((q * 7.3) % 1);
          const rg = ctx.createRadialGradient(x, py + pr * 0.4, 0, x, py + pr * 0.4, pr);
          rg.addColorStop(0, 'rgba(0,0,0,0.85)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = rg; ctx.fillRect(x - pr, py - pr * 0.6, pr * 2, pr * 2);
        }
        ctx.restore();
      };
      // two depths per stand: a paler, smaller back rank, then a darker front rank with gaps (not a stamped row)
      const stand = (pts, h, tone, seed, y0, y1) => {
        paintClump(ctx, pts.map(([x, y]) => [x + 14, y - 12]), { ...T, h: [h[0] * 0.6, h[1] * 0.75], tone: tone + 0.14, spacing: 0.55, seed: seed + 50 });
        paintClump(ctx, pts, { ...T, h, tone, spacing: 0.85, seed });
        feet(pts[0][0], pts[pts.length - 1][0], y0, y1);
      };
      stand([[1820, 760], [1880, 740], [1960, 750]], [50, 110], 0.22, 34, 700, 770);
      stand([[1340, 810], [1410, 795], [1490, 812]], [40, 100], 0.26, 33, 770, 830);
      // foliage hugging the near peak's shoulders (ref: the pavilion peak is wrapped in dark pines)
      paintClump(ctx, [[1548, 925], [1572, 900], [1596, 915]], { ...T, h: [40, 84], tone: 0.1, spacing: 0.6, seed: 35 });
      paintClump(ctx, [[1672, 912], [1700, 925], [1730, 945]], { ...T, h: [44, 90], tone: 0.08, spacing: 0.6, seed: 36 });
      feet(1548, 1730, 935, 1000);
      stand([[1690, 985], [1770, 965], [1850, 975], [1980, 960]], [60, 145], 0.2, 32, 905, 1000);
      stand([[630, 1000], [700, 980], [780, 992], [860, 972], [960, 1000]], [60, 165], 0.22, 31, 915, 1020);
    });
    layers.push(api.tex(inkify(api, trees, { edge: 0.4, granulation: 0.25, bleed: 0.6 }), { rect: [560, 660, 1560, 460], z: 1.45, name: 'trees-near' }));
    layers.push(makeBillows(api, { yBack: 1065, yFront: 1400, rows: 3, lobe: 140, z: 1.4, seed: 7, drift: 7, shade: 1.05, haze: 0.22, texture: 0.4, name: 'cs-near', extent: [480, 2600, 200], rect: [-480, 780, 2880, 690] }));

    // ---------------------------------------------------------------- left cliff, waterfall, temple, pine
    const left = buildLeft(api, { paper: PAPER09 });
    layers.push(...left.back, ...left.front, left.pine);

    // ---------------------------------------------------------------- cranes
    const cranes = CRANES09.map((c) => ({ ...c, x: c.x - c.vx * T_MATCH, y: c.y - c.vy * T_MATCH }));
    layers.push(makeCraneFlock(api, { cranes, z: 1, paper: PAPER09 }));

    return {
      layers,
      camera: (t) => ({ x: camX(t), y: 0, dolly: 0, zoom: 1, roll: 0 }),
      grade: { vignette: 0 },
      meta: { clear: PAPER09.map((v) => v / 255) },
    };
  },
};
