// s02 - Golden river (ref 02).
// Warm golden paper, pale sun low over the far ridges inside a broad warm haze, soft feathery gold
// cloud washes (s02/sky.js), hero pine top-left, dark left cliffs with a red maple, layered central
// peaks in glowing mist, a river (s02/river.js: masked lake + gold column + glitter) widening from
// the sun toward the viewer between alternating wooded land tongues and two islands with
// reflections, a pavilion on the right cliff. Camera: continues the handscroll pan (the transition
// adds x -220 -> 0 over t 0..2.2), then a slow drift right. Composition matches the reference at
// t = 3.
import { makeSky, makeSun, makeMist, makeWaterFog } from '../lib/atmos.js';
import { makeGoldClouds, makeSunHaze } from './s02/sky.js';
import { makeGoldRiver } from './s02/river.js';
import { makeCrags } from './s02/crags.js';
import { makePine, paintConifer } from '../lib/pine.js';
import { cliff, bakeRocks } from '../lib/rock.js';
import { makeReflection } from '../lib/water.js';
import { bakeArch, paintPavilion } from '../lib/architecture.js';
import { makeMaple } from '../lib/flora.js';
import { inkify } from '../lib/inkfx.js';
import { rgba, tone as toneRGB } from '../lib/brush.js';
import { paintFoliageBand } from './s02/foliage.js';
import { makeSandbars } from './s02/sandbars.js';

const PAPER = [240, 227, 208];       // neutral warm paper (left half, mist)
const GOLDP = [250, 232, 192];       // golden paper near the sun / on the river
const T0 = 3;
const PAN = 8;                       // px/s at the picture plane

export const FACTS = {
  camera: { T0, pan: [PAN, 0] },
  sun: [1349, 308],                  // z 1e5 (does not parallax), r 50
  river: [1333, 700],                // centre of the gold sun column on the water at y 700 (horizon y 498)
  pavilion: [1688, 396],             // z 3
  bloomSeeds: [[90, 300], [300, 560]],
};

export default {
  id: 's02', title: 'Golden river', ref: '02',
  build(api) {
    const layers = [];
    // ------------------------------------------------------------------ sky
    layers.push(makeSky(api, { variant: 'golden', top: [239, 226, 206], bottom: [243, 229, 204], sun: [1349, 330], glowColor: [249, 212, 148], glowSize: [950, 300] }));
    layers.push(makeSun(api, { x: FACTS.sun[0], y: FACTS.sun[1], r: 50, edge: 7, glow: 0.35, color: [255, 243, 212] }));
    layers.push(makeGoldClouds(api, { sun: FACTS.sun, band: [100, 320, 60], x0: 640, strength: 1.0, nearColor: [234, 186, 108], farColor: [214, 188, 150], z: 40, seed: 3.1, drift: 4 }));

    // ------------------------------------------------------------------ far ranges
    const L = (x, top, wl, wr, a = 1.6, b = 1) => ({ x, top, wl, wr, a, b });
    const farR = makeCrags(api, { rect: [1150, 160, 1180, 270], paper: GOLDP, defaults: { treeH: 9, mottle: 0.6, streaks: 0.4, clumps: 0.5, shadow: 0.22, soft: 1.4, fade: [0.25, 0.9], contour: 0.3, edge: 0.5, faceDots: 0.4 }, masses: [
      { lobes: [L(1610, 312, 170, 90, 1.8, 1.0), L(1830, 240, 150, 100, 1.6, 1.0), L(1915, 216, 45, 70, 1.4, 1.1), L(2120, 252, 170, 150, 1.8, 1.0)], base: 420, v: 0.74, seed: 1, rough: 1.0, jag: 0.6 },
      { lobes: [L(1290, 344, 130, 120, 1.6, 1.2), L(1170, 364, 80, 80, 1.5, 1.2)], base: 420, v: 0.74, seed: 3, trees: 0.6, rough: 1.0, jag: 0.6 },
    ] });
    layers.push(farR.layer({ z: 10, name: 'far-range' }));

    const peakA = makeCrags(api, { rect: [250, 0, 760, 380], paper: PAPER, defaults: { treeH: 12, fade: [0.4, 1], soft: 0.5, streaks: 1.4, faceDots: 1.8 }, masses: [
      { lobes: [L(440, 140, 90, 80, 2, 1.0), L(370, 190, 70, 60, 2, 1)], base: 330, v: 0.58, seed: 11 },
      { lobes: [L(600, 56, 100, 110, 1.8, 0.85), L(735, 150, 70, 80, 2, 1.1), L(860, 220, 90, 90, 1.8, 1.1), L(620, 230, 250, 320, 2, 1)], base: 360, v: 0.36, seed: 12, shadow: 0.5, clumps: 1.8, crown: 1.2, body: 1.0, bands: [[0.55, 0.07, 0.5]] },
    ] });
    layers.push(peakA.layer({ z: 8, name: 'peak-A' }));

    const ridge = makeCrags(api, { rect: [720, 190, 1400, 340], paper: GOLDP, defaults: { treeH: 13, fade: [0.3, 1], soft: 1.0, contour: 0.55, edge: 0.6 }, masses: [
      { lobes: [L(1010, 292, 170, 110, 1.9, 1.0), L(1150, 320, 60, 110, 1.6, 1.1), L(1240, 346, 80, 80, 2, 1)], base: 470, v: 0.5, seed: 32, rough: 1.1, jag: 0.7 },
      { lobes: [L(870, 318, 90, 80, 1.8, 1)], base: 470, v: 0.56, seed: 33 },
      { lobes: [L(1590, 362, 130, 110, 1.8, 1.0), L(1710, 386, 70, 90, 1.8, 1.0)], base: 470, v: 0.62, seed: 31, rough: 1.0, jag: 0.6 },
      { lobes: [L(1910, 322, 120, 100, 1.8, 1.0), L(2040, 346, 90, 100, 1.8, 1.0)], base: 500, v: 0.55, seed: 34, rough: 1.0, jag: 0.6 },
    ] });
    layers.push(ridge.layer({ z: 6, name: 'ridge' }));
    layers.push(makeSunHaze(api, { sun: FACTS.sun, size: [460, 170], amount: 0.6, horizon: 450, feather: 70, z: 5.8, color: [252, 230, 182] }));
    layers.push(makeMist(api, { top: 400, bottom: 540, z: 5.5, lobe: 70, seed: 1, drift: 6, density: 0.55, holes: 0.35, softness: 16, shade: 0.05, color: PAPER }));

    const peakB = makeCrags(api, { rect: [180, 140, 860, 520], paper: toneRGB(0.93, PAPER), defaults: { treeH: 22, fade: [0.5, 1], soft: 0.4, streaks: 1.7, faceDots: 2.4 }, masses: [
      { lobes: [L(330, 300, 130, 90, 1.8, 1), L(250, 340, 90, 80)], base: 560, v: 0.26, seed: 40, treeH: 20, crown: 1, body: 1.4, shadow: 0.6 },
      { lobes: [L(490, 212, 115, 90, 2.2, 0.85), L(565, 262, 75, 90, 2, 1), L(415, 300, 60, 60, 2, 0.9)], base: 570, v: 0.18, body: 1.3, treeV: 0.1, seed: 41, shadow: 0.7, mottle: 1.2, crown: 1.3, crownDepth: 0.16, clumps: 1.6, bands: [[0.7, 0.06, 0.45]] },
      { lobes: [L(705, 360, 80, 85, 2.0, 1.1), L(760, 400, 60, 50)], base: 600, v: 0.2, seed: 42, treeH: 38, trees: 1.5, crown: 1.4, body: 1.2, shadow: 0.65, clumps: 1.4 },
    ] });
    layers.push(peakB.layer({ z: 4, name: 'peak-B' }));
    const forest = makeCrags(api, { rect: [400, 470, 760, 360], paper: PAPER, defaults: { treeH: 30, fade: [0.6, 1], soft: 0.4, crown: 1.6, clumps: 2.2, planes: 0.5, body: 1.4, trees: 1.6, pines: 0.15 }, masses: [
      { lobes: [L(590, 566, 150, 190, 2.5, 1), L(790, 590, 80, 170, 1.5, 1)], base: 640, v: 0.26, seed: 45, treeV: 0.1 },
      { lobes: [L(700, 636, 170, 230, 2.5, 1), L(940, 664, 90, 160, 1.5, 1)], base: 716, v: 0.24, seed: 46, treeV: 0.08 },
      { lobes: [L(800, 736, 140, 190, 2.5, 1), L(970, 756, 70, 110, 1.5, 1)], base: 792, v: 0.24, seed: 47, treeV: 0.08, fade: [0.75, 1] },
    ] });
    layers.push(forest.layer({ z: 3.2, name: 'forest' }));
    layers.push(makeMist(api, { top: 545, bottom: 700, z: 3.6, lobe: 70, seed: 2, drift: 8, density: 0.45, holes: 0.3, softness: 14, shade: 0.05, color: PAPER }));

    // ------------------------------------------------------------------ right cliff + pavilion
    const rc = cliff({
      seed: 51,
      outline: [[1530, 600], [1548, 520], [1560, 470], [1585, 432], [1625, 408], [1670, 398], [1720, 397], [1760, 404], [1800, 392], [1850, 372], [1905, 360], [1960, 368], [2010, 395], [2040, 450], [2050, 600]],
      columns: [{ x: 1600 }, { x: 1680 }, { x: 1750 }, { x: 1840 }, { x: 1940 }],
      fade: [[1530, 520, 590], [2050, 520, 590]],
      tone: 0.35, shadow: 0.45, moss: 1.0, foliage: 0.8,
    });
    const rcRock = bakeRocks(api, { rect: [1480, 320, 600, 300], items: [rc], paper: GOLDP, seed: 5, texture: 0.6, cun: 0.4, far: 0.35 });
    layers.push(rcRock.layer({ z: 3, name: 'right-cliff' }));
    const pavRect = [1630, 330, 120, 80];
    const pav = bakeArch(api, pavRect, (ctx) => paintPavilion(ctx, { x: 1688, y: 400, w: 64, seed: 4, fade: 0.15, paper: GOLDP }));
    layers.push(api.tex(pav, { rect: pavRect, z: 3, name: 'pavilion' }));

    // ------------------------------------------------------------------ river + islands
    // the valley floor is water that widens toward the viewer; land tongues from alternating banks
    // and two wooded islands make it read as a winding ribbon glittering under the sun
    const WATER = [248, 236, 212];
    const river = makeGoldRiver(api, {
      rect: [880, 488, 1320, 604], horizon: 498, vx: 1338, z: 2.5, seed: 7, paper: WATER,
      left: [[1312, 498], [1296, 526], [1246, 572], [1150, 628], [1040, 690], [962, 760], [930, 850], [960, 960], [940, 1092]],
      right: [[1362, 498], [1398, 528], [1500, 574], [1640, 618], [1800, 660], [1990, 700], [2120, 800], [2190, 1092]],
      surface: { density: [0.03, 0.07, 0.1, 0.45], tint: [1, 0.98, 0.92, 0.45], dark: 0.1, light: 0.5, fog: [50, 0.6, 0, 0], blotch: 0.12 },
      glitter: { kind: 'gold', color: [255, 246, 220], x: 1340, x1: 1330, w0: 9, w1: 70, ext0: 18, ext1: 170, row: 5, intensity: 0.6, glowW: 90, glowH: 120, glow: 0.35, spillW: 120, spill: 0.15 },
      gold: { x: 1340, x1: 1320, w0: 60, w1: 420, amount: 0.75, cast: 0.14, color: [238, 192, 108], sparkle: 0.6, fadeNear: 70 },
    });
    layers.push(river.surface);
    const LAND = { pines: 0.12, body: 1.5, shadow: 0.5, fade: [0.97, 1], crown: 1.5, clumps: 1.5, rough: 0.6, jag: 0.6, planes: 0.8, soft: 0.4 };
    const land = (lobes, base, v, treeH, seed, rect, extra = {}) => {
      const c = makeCrags(api, { rect, paper: GOLDP, masses: [{ lobes, base, v, treeH, seed, ...LAND, ...extra }] });
      return { refl: makeReflection(api, c.src, { rect, y: base, z: 2.5, paper: WATER, strength: 0.35, stretch: 1.0, amp: 2.5 }), layer: c.layer({ z: 2.5, name: 'land-' + seed }) };
    };
    const lands = [
      land([L(1060, 700, 140, 160, 3, 1), L(1270, 720, 110, 190, 1.5, 1)], 744, 0.34, 30, 63, [880, 620, 600, 128], { clumps: 2.6, trees: 1.4, treeV: 0.18 }),
      land([L(1780, 702, 200, 220, 3, 1), L(1590, 722, 100, 80, 1.5, 1)], 754, 0.34, 30, 64, [1470, 620, 550, 138], { clumps: 2.6, trees: 1.4, treeV: 0.18 }),
      land([L(1110, 840, 100, 80, 2.5, 1), L(1210, 852, 60, 100, 1.5, 1)], 880, 0.3, 56, 71, [990, 750, 340, 134], { treeV: 0.08 }),
      land([L(1460, 800, 100, 90, 2.5, 1), L(1570, 812, 60, 70, 1.5, 1)], 832, 0.3, 48, 72, [1340, 720, 320, 116], { treeV: 0.1 }),
    ];
    for (const l of lands) layers.push(l.refl);
    layers.push(river.gold, river.overlay);
    // pale sand flats under the tongues (their tips run out past the trees) and free spits, with thin shore lines
    layers.push(makeSandbars(api, { rect: [880, 620, 1320, 380], seed: 9, z: 2.5, bars: [
      { a: [905, 756], b: [1200, 760], t: 16, bulge: 0.55 }, { a: [1235, 758], b: [1530, 763], t: 12, bulge: 0.3 }, { a: [1400, 768], b: [1700, 764], t: 14, bulge: 0.65 }, { a: [1725, 766], b: [2040, 762], t: 16, bulge: 0.5 },
      { a: [985, 890], b: [1310, 894], t: 14, bulge: 0.45 }, { a: [1325, 842], b: [1690, 845], t: 13, bulge: 0.5 },
      { a: [1170, 802], b: [1330, 805], t: 4 }, { a: [990, 652], b: [1140, 656], t: 5 }, { a: [1610, 885], b: [1820, 892], t: 5, bulge: 0.3 }, { a: [1040, 968], b: [1260, 975], t: 6, bulge: 0.6 },
    ] }));
    const strips = makeCrags(api, { rect: [900, 480, 1200, 200], paper: GOLDP, defaults: { treeH: 22, fade: [0.55, 1], soft: 0.5, crown: 1.5, clumps: 1.5, planes: 0.3, streaks: 0.4, rough: 0.5, jag: 0.5 }, masses: [
      { lobes: [L(1050, 532, 120, 120, 2, 1), L(1200, 548, 100, 90, 2, 1)], base: 600, v: 0.3, seed: 61, treeV: 0.14, trees: 1.5 },
      { lobes: [L(1480, 600, 170, 150, 2.5, 1), L(1700, 588, 180, 200, 2.5, 1), L(1930, 590, 120, 160, 2.5, 1)], base: 648, v: 0.36, seed: 62, treeH: 20 },
    ] });
    layers.push(strips.layer({ z: 2.5, name: 'strips' }));
    for (const l of lands) layers.push(l.layer);
    layers.push(makeWaterFog(api, { top: 600, z: 2.4, seed: 4, color: GOLDP }));

    // ------------------------------------------------------------------ left cliffs
    const leftC = makeCrags(api, { rect: [-400, 330, 720, 640], paper: toneRGB(0.82, PAPER), masses: [
      { lobes: [L(-200, 432, 200, 150, 2, 1), L(60, 424, 150, 120, 2.2, 0.9), L(205, 475, 90, 80, 2, 1)], base: 920, v: 0.08, treeV: 0.05, treeH: 36, crown: 1.6, clumps: 3, planes: 0.6, body: 2.2, shadow: 0.9, fade: [0.4, 0.85], seed: 81, soft: 0.3 },
    ] });
    layers.push(leftC.layer({ z: 1.35, name: 'left-crag' }));
    const nearC = makeCrags(api, { rect: [60, 520, 610, 520], paper: toneRGB(0.88, PAPER), masses: [
      { lobes: [L(450, 622, 230, 170, 1.7, 0.9), L(365, 614, 70, 90, 1.8, 1), L(290, 705, 120, 90, 1.5, 1.2), L(190, 780, 110, 100, 1.5, 1)], light: 'left', base: 980, v: 0.05, treeV: 0.04, treeH: 30, crown: 1.2, crownDepth: 0.08, clumps: 0.8, planes: 1.6, body: 0.9, shadow: 0.95, mottle: 1.0, streaks: 2.4, faceDots: 1.5, fade: [0.55, 0.95], bands: [[0.62, 0.05, 0.35]], seed: 92, soft: 0.3 },
    ] });
    layers.push(nearC.layer({ z: 1.3, name: 'near-cliff' }));
    // foreground conifers rising out of the bottom mist (centre)
    const fgRect = [540, 720, 720, 400];
    const fgRaw = api.bakeCanvas(fgRect[2], fgRect[3], (ctx) => {
      ctx.translate(-fgRect[0], -fgRect[1]);
      const r = api.rng(93);
      // groves, not a row: a dark main cluster, paler groves behind it in the mist, a small group to
      // the right. Each grove sits on a soft wet bloom; trees taller at its centre, varied lean/kind.
      const gauss = () => (r() + r() + r() - 1.5) / 1.5;
      const groves = [
        { cx: 1010, cy: 905, n: 6, h: [30, 50], sp: 70, v: [0.45, 0.58] },
        { cx: 700, cy: 878, n: 10, h: [40, 80], sp: 125, v: [0.3, 0.45] },
        { cx: 905, cy: 985, n: 9, h: [50, 112], sp: 110, v: [0.02, 0.12] },
        { cx: 1115, cy: 1012, n: 6, h: [36, 64], sp: 65, v: [0.12, 0.24] },
      ];
      for (const G of groves) {
        // wet bloom behind the grove
        ctx.save(); ctx.filter = 'blur(14px)';
        ctx.fillStyle = rgba(toneRGB((G.v[0] + G.v[1]) / 2 + 0.3, PAPER), 0.35);
        ctx.beginPath(); ctx.ellipse(G.cx, G.cy - G.h[1] * 0.45, G.sp * 1.1, G.h[1] * 0.45, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        const trees = [];
        for (let i = 0; i < G.n; i++) {
          const gx = 0.55 * (r() * 2 - 1) + 0.45 * gauss(), cen = 1 - Math.min(1, Math.abs(gx));
          trees.push({ x: G.cx + gx * G.sp, y: G.cy + r.range(-6, 22) - cen * 6, h: G.h[0] + (G.h[1] - G.h[0]) * (0.45 * r() + 0.55 * Math.sqrt(cen)), v: r.range(G.v[0], G.v[1]) });
        }
        trees.sort((a, b) => a.y - b.y);
        for (const t of trees) paintConifer(ctx, t.x, t.y, t.h, { kind: r() < 0.5 ? 'fir' : 'pine', tone: t.v, lean: r.range(-9, 9), width: r.range(0.7, 1.0), paper: PAPER, seed: (r() * 1e6) | 0 });
        // the grove's lower half dissolves into the mist (wet gradation from dark crowns down)
        const gd = ctx.createLinearGradient(0, G.cy - G.h[1] * 0.3, 0, G.cy + 14);
        gd.addColorStop(0, 'rgba(0,0,0,0)'); gd.addColorStop(1, 'rgba(0,0,0,0.75)');
        ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = gd; ctx.fillRect(G.cx - G.sp * 1.6, G.cy - G.h[1] * 0.45, G.sp * 3.2, G.h[1] * 0.45 + 14);
        ctx.globalCompositeOperation = 'source-over';
      }
      // the slope and trunks dissolve into the bottom mist
      const fd = ctx.createLinearGradient(0, 930, 0, 1070);
      fd.addColorStop(0, 'rgba(0,0,0,0)'); fd.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = fd; ctx.fillRect(540, 930, 720, 190);
      ctx.globalCompositeOperation = 'source-over';
    });
    const fgTrees = api.tex(inkify(api, fgRaw, { edge: 0.4, granulation: 0.18, bleed: 0.9 }), { rect: fgRect, z: 1.25, name: 'fg-trees', sway: { amp: 1.2, freq: 0.24, scale: 220, power: 1.5, anchor: [880, 1080], radius: 400 } });

    const folRect = [-380, 380, 1600, 720];
    const folRaw = api.bakeCanvas(folRect[2], folRect[3], (ctx) => {
      ctx.translate(-folRect[0], -folRect[1]);
      const r = api.rng(77), nz = api.noise(78);
      // dark tree mass on the upper cliff and around the maple
      paintFoliageBand(ctx, r, nz, [[-360, 460], [-200, 450], [-60, 440], [60, 446], [160, 470], [230, 480], [300, 500]], { band: 120, size: [16, 34], density: 1.8, v: 0.04, paper: PAPER, pines: 0.5, back: 0.08 });
      paintFoliageBand(ctx, r, nz, [[190, 480], [260, 500], [320, 560], [360, 620]], { band: 90, size: [18, 36], density: 1.5, v: 0.03, paper: PAPER, pines: 0.4, back: 0.05 });
      // clumps on the near cliff top and down its right edge
      paintFoliageBand(ctx, r, nz, [[420, 612], [470, 610], [520, 630], [560, 670], [590, 730], [605, 800]], { band: 24, size: [10, 22], density: 0.9, v: 0.04, paper: PAPER, pines: 0.5, back: 0.06 });
      // far left dark masses down the face
      paintFoliageBand(ctx, r, nz, [[-360, 560], [-200, 580], [-60, 600], [60, 640], [140, 700]], { band: 110, size: [20, 42], density: 2.0, v: 0.05, paper: PAPER, pines: 0.3, back: 0.06 });
    });
    layers.push(api.tex(inkify(api, folRaw, { edge: 0.4, granulation: 0.15, bleed: 0.9 }), { rect: folRect, z: 1.3, name: 'foliage', sway: { amp: 1.2, freq: 0.22, scale: 200, power: 1.5, anchor: [300, 1080], radius: 600 } }));

    const maple = makeMaple(api, { seed: 103, paper: PAPER, trees: [
      { x: 360, y: 610, height: 110, width: 150, lean: 8, shape: 'round', crown: [385, 548, 75, 45], leafSize: 3.4, density: 1.4, pale: 0.35, depth: 5 },
      { x: 1628, y: 412, height: 34, width: 44, lean: -6, shape: 'round', crown: [1625, 395, 22, 14], leafSize: 2.2, density: 1.3, pale: 0.4, depth: 4 },
    ] });
    layers.push(maple.layer({ z: 1.3, amp: 1.5 }));

    layers.push(makeMist(api, { top: 900, bottom: 1180, z: 1.15, lobe: 90, seed: 5, drift: 10, density: 0.95, softness: 10, color: PAPER, extent: [-480, 1150, 200] }));
    layers.push(fgTrees);

    // ------------------------------------------------------------------ hero pine
    const pine = makePine(api, {
      seed: 21, height: 560, gnarl: 0.95, scale: 1,
      // an S-curved trunk (leans out over the valley, then turns back up) in pale bark with dark plates
      spine: [[-34, 500], [-8, 440], [24, 392], [46, 336], [56, 280], [74, 222], [108, 168], [144, 124], [166, 88], [176, 62]],
      trunkWidth: 27, taper: 0.5, flare: 0.15, barkTone: 0.42, barkDensity: 2.2, knobs: 1.3,
      limbs: [
        { pts: [[172, 70], [215, 80], [262, 95], [310, 115], [350, 138], [385, 150]], w: 12, subs: 3, pad: 0.75 },
        { pts: [[164, 86], [125, 80], [90, 92], [60, 110], [30, 130]], w: 10, subs: 3 },
        { pts: [[85, 210], [62, 190], [30, 180], [0, 185], [-40, 200]], w: 12, subs: 4, pad: 1.25 },
        { pts: [[62, 268], [110, 270], [165, 282], [220, 300], [270, 322], [330, 345], [380, 362]], w: 14, subs: 4 },
        { pts: [[47, 330], [15, 300], [-20, 285], [-70, 280]], w: 12, subs: 3, pad: 1.25 },
        { pts: [[19, 400], [-30, 380], [-90, 370], [-150, 380]], w: 12, subs: 2 },
      ],
      padSize: 70, padAspect: 0.5, needle: 13, padDensity: 2.6, haze: 0.3, wet: 0.35, soft: 0.2, core: 0.18, needleWidth: 0.15,
      swayAmp: 3.5, swayFreq: 0.2,
    });
    layers.push(pine.layer({ z: 1 }));

    return {
      layers,
      camera: (t) => ({ x: PAN * (t - T0), y: 0, dolly: 0, zoom: 1, roll: 0 }),
      meta: { clear: PAPER.map((v) => v / 255) },
    };
  },
};
