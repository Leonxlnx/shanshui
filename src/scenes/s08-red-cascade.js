// s08 Red cascade (ref 08): a massive multi-tier waterfall from the top centre-left, cliffs on the
// left heavy with red maples and pines, misty pillar peaks on the right, red leaves drifting.
import { PAPER } from '../lib/brush.js';
import { inkify } from '../lib/inkfx.js';
import { makeSky } from '../lib/atmos.js';
import { makePeaks } from '../lib/peaks.js';
import { bakeS08Rocks } from './s08/rockpaint.js';
import { makePine, paintConifer } from '../lib/pine.js';
import { makeMaple08 as makeMaple, paintMaple08 as paintMaple } from './s08/maple.js';
import { makeWaterfall } from '../lib/water.js';
import { makeFallingLeaves } from '../lib/fauna.js';
import { makeSpray, makeWhiteWater } from './s08/fx.js';
import { boulder, paintWaterShade } from './s08/boulder.js';

export const FACTS = {
  waterfall: [640, 270],     // inside the main upper sheet (rest space)
  cascade: [760, 640],       // middle of the lower tiers
  bloomSeeds: [[300, 520], [800, 230]],
};

// maple leaf look: slightly muted vermilion, many ink-dark leaves, airy clumps
const MAPLE_PAL = { bright: [190, 60, 44], mid: [162, 50, 38], dark: [110, 36, 28], pale: [202, 146, 126] };
const LEAF = { palette: MAPLE_PAL, inkLeaves: 0.22, pale: 0.2, alongTwigs: 0.8, clusterSpread: 3.4, strays: 0.05 };

const Z = { far: 9, mid: 5.5, ridge: 3.4, near: 2.5, falls: 2.0, casc: 1.6, left: 1.25, front: 1.08 };

export default {
  id: 's08', title: 'Red cascade', ref: '08',
  build(api) {
    const layers = [];
    layers.push(makeSky(api, { variant: 'rice', seed: 8 }));

    // ---------------------------------------------------------------- far + mid peaks (right)
    const WET_FAR = { soft: 2.4, blur: 0.8, bleed: 0.3, edge: 0.25, granulation: 0.15, mottle: 0.35 };
    const WET_MID = { soft: 1.8, blur: 0.6, bleed: 0.3, edge: 0.35, granulation: 0.18, mottle: 0.35 };
    const far = makePeaks(api, {
      rect: [960, 60, 1060, 300], wet: WET_FAR,
      peaks: [
        { x: 1090, top: 165, base: 300, width: 170, cols: 2, shape: 'dome', tone: 0.8, trees: 0.4, detail: 0.35, seed: 81 },
        { x: 1340, top: 112, base: 320, width: 260, cols: 2, shape: 'dome', tone: 0.76, trees: 0.4, detail: 0.35, seed: 82 },
        { x: 1880, top: 120, base: 340, width: 260, cols: 2, shape: 'dome', tone: 0.76, trees: 0.4, detail: 0.35, seed: 84 },
      ],
    });
    layers.push(far.layer({ z: Z.far, name: 'peaks-far' }));
    layers.push(makeSpray(api, { name: 'mist-far', z: Z.far * 0.9, blobs: [[1300, 300, 520, 60, 1.0], [1750, 320, 400, 70, 1]], threshold: 0.5, scale: 150, rise: 2, drift: 5, shade: 0.2 }));

    const mid = makePeaks(api, {
      rect: [1280, 10, 760, 620], wet: WET_MID,
      peaks: [
        { x: 1665, top: 50, base: 380, width: 300, cols: 3, shape: 'dome', tone: 0.3, trees: 1.4, treeSize: 1.2, seed: 91 },
        { x: 1470, top: 225, base: 490, width: 240, cols: 3, shape: 'pillar', tone: 0.26, trees: 1.4, treeSize: 1.2, seed: 92 },
        { x: 1625, top: 285, base: 530, width: 220, cols: 3, shape: 'pillar', tone: 0.24, trees: 1.4, treeSize: 1.2, seed: 93 },
        { x: 1880, top: 365, base: 610, width: 280, cols: 3, shape: 'pillar', tone: 0.28, trees: 1.4, treeSize: 1.2, seed: 94 },
      ],
    });
    layers.push(mid.layer({ z: Z.mid, name: 'peaks-mid' }));
    layers.push(makeSpray(api, { name: 'mist-mid', z: Z.mid * 0.92, blobs: [[1500, 500, 380, 70, 1.0], [1860, 600, 260, 80, 1], [1250, 410, 240, 60, 0.9]], threshold: 0.48, scale: 130, rise: 3, drift: 6, shade: 0.45, shadow: [184, 178, 170] }));

    // ---------------------------------------------------------------- ridge right of the falls
    const ridge = makePeaks(api, {
      rect: [1020, 240, 620, 520], wet: WET_MID,
      peaks: [
        { x: 1150, top: 300, base: 660, width: 240, cols: 4, shape: 'pillar', tone: 0.14, trees: 1.7, treeSize: 1.3, seed: 101 },
        { x: 1300, top: 372, base: 690, width: 250, cols: 4, shape: 'pillar', tone: 0.16, trees: 1.7, treeSize: 1.3, seed: 102 },
        { x: 1460, top: 500, base: 720, width: 200, cols: 3, shape: 'pillar', tone: 0.2, trees: 1.7, treeSize: 1.2, seed: 104 },
      ],
    });
    layers.push(ridge.layer({ z: Z.ridge, name: 'peaks-ridge' }));
    layers.push(makeSpray(api, { name: 'mist-ridge', z: Z.ridge * 0.95, blobs: [[1250, 650, 300, 60, 1.0], [1500, 700, 220, 60, 0.9]], threshold: 0.5, scale: 90, rise: 5, drift: 4, shade: 0.5, shadow: [184, 178, 170] }));

    // near right cliff (pillars with pines)
    const nearR = makePeaks(api, {
      rect: [1540, 420, 500, 580], wet: WET_MID,
      peaks: [
        { x: 1690, top: 590, base: 940, width: 200, cols: 3, shape: 'pillar', tone: 0.1, trees: 1.7, treeSize: 1.3, seed: 111 },
        { x: 1845, top: 500, base: 960, width: 320, cols: 4, shape: 'pillar', tone: 0.06, trees: 1.8, treeSize: 1.4, seed: 112 },
      ],
    });
    layers.push(nearR.layer({ z: Z.near, name: 'peaks-nearR' }));

    // big spray sea between ridge and cascade
    layers.push(makeSpray(api, {
      name: 'spray-sea', z: Z.near * 0.97,
      blobs: [[1230, 730, 300, 120, 1.1], [1460, 800, 280, 130, 1.0], [1080, 850, 240, 110, 1.0], [1660, 910, 300, 110, 0.9], [1340, 610, 160, 60, 0.7]],
      threshold: 0.45, scale: 160, rise: 9, drift: 3, shade: 0.28, softness: 0.4, shadow: [184, 178, 170],
    }));

    // ---------------------------------------------------------------- upper falls: wall + right cliff
    const INK_FX = { edge: 0.5, granulation: 0.25, bleed: 1.0 };
    const rockCard = (rect, rocks, z, name) => {
      const b = bakeS08Rocks(api, rect, rocks, { scale: 1 });
      return api.tex(inkify(api, b.src, INK_FX), { rect, z, name });
    };
    const wall = {
      seed: 21,
      outline: [[318, 44], [342, 22], [372, 28], [394, 58], [416, 78], [440, 92], [462, 104], [480, 100], [500, 106], [516, 98], [540, 100], [560, 94], [574, 84], [590, 90], [620, 88], [650, 90], [684, 92], [700, 80], [700, 520], [318, 520]],
      facets: [362, 402, 446, 490, 560, 640], face: 0.32, shade: 0.05, shadowTex: 1.6, crown: 0.35, mossSize: 0.7, mottle: 0.8,
      fade: [[320, 380, 470], [700, 400, 480]],
    };
    const rightCliff = {
      seed: 22,
      outline: [[700, 98], [728, 74], [770, 66], [822, 70], [872, 84], [906, 112], [920, 158], [952, 170], [986, 200], [1012, 238],
        [1046, 262], [1080, 302], [1100, 360], [1112, 440], [1120, 620], [782, 620], [786, 300], [790, 140], [740, 122]],
      facets: [835, 885, 948, 1004, 1062], face: 0.9, shade: 0.2, crown: 1.3, mossSize: 0.95, mottle: 0.12, facetVar: 0.16, texLit: 0.06, texLight: 0.66, tex: 0.7, texLen: 2.4, shLen: 2.0, sharp: 1,
      fade: [[780, 420, 520], [900, 440, 540], [1000, 480, 590], [1110, 540, 620]],
    };
    layers.push(rockCard([300, 0, 840, 640], [wall, rightCliff], Z.falls, 'rock-falls'));

    // upper waterfall curtains
    // broad merging sheets (ref: thin curtains left, one wide bright sheet, a right sheet), split only
    // by one dark rock rib and lumpy stones sitting on the lip
    const fallsOpts = { z: Z.falls, spray: false, speed: 300, streakScale: 3.0, darkness: 0.18, lineWidth: 2.2, thin: 0.06, backingDark: 0.4, arch: 1.5 };
    for (const f of [
      { seed: 1.7, lip: [[468, 116], [503, 113]], height: 350, driftL: -3, driftR: 3, sheets: 1, thin: 0.45, opacity: 0.88, fade: 0.64, backing: false, ragged: 2.4 },
      { seed: 2.3, lip: [[510, 109], [564, 105]], height: 390, driftL: -4, driftR: 4, sheets: 2, fade: 0.68, ragged: 2.2 },
      { seed: 3.1, lip: [[582, 98], [704, 100]], height: 420, driftL: -4, driftR: 6, sheets: 3, fade: 0.78, ragged: 1.8 },
      { seed: 2.9, lip: [[698, 108], [786, 124]], height: 360, driftL: -2, driftR: 7, sheets: 2, fade: 0.66, thin: 0.3, ragged: 2 },
    ]) layers.push(...makeWaterfall(api, { ...fallsOpts, ...f }).layers);
    // stones on the lip (in front of the curtains): a dark rib between the left sheets and the main one
    const lip = [
      { ...boulder(574, 88, 28, 26, 71, { rMax: 8 }), seed: 71, dark: 1, fade: [0.9, 1.5] },
      { ...boulder(506, 98, 18, 22, 72, { rMax: 7 }), seed: 72, dark: 1, fade: [1.0, 2.2] },
      { ...boulder(626, 90, 26, 14, 73, { rMax: 7 }), seed: 73, dark: 0.9, fade: [0.9, 1.3] },
      { ...boulder(676, 92, 20, 12, 74, { rMax: 6 }), seed: 74, dark: 0.9, fade: [0.9, 1.3] },
      { ...boulder(742, 102, 28, 16, 75, { rMax: 7 }), seed: 75, dark: 0.9, fade: [0.9, 1.4] },
    ];
    layers.push(rockCard([440, 40, 380, 200], lip, Z.falls * 0.999, 'rock-lip'));
    layers.push(makeSpray(api, {
      name: 'spray-falls', z: Z.falls * 0.98,
      blobs: [[640, 450, 240, 64, 1.0], [470, 450, 130, 50, 0.9], [800, 450, 120, 50, 0.85], [640, 380, 150, 40, 0.45]],
      threshold: 0.5, scale: 85, stretch: 1.1, rise: 14, drift: 2, shade: 0.4,
    }));

    // ---------------------------------------------------------------- lower cascade
    // discrete dark rocks (lumpy crowns of stacked bumps) with broad white water between and over them
    // [seed, cx, yTop, w, h, face tone, misty, pour]; ledges (pour > 1) are low tiers painted first,
    // mostly hidden behind the curtains of water stepping over them
    // tiers stepping down from the upper falls (upper left) to the lower right: rows of lumpy dark
    // boulders (crowns of small stones) with gaps where the water pours through
    // [seed, cx, yTop, w, h, dark]
    const RK = [
      [34, 1122, 590, 170, 140, 0.25],
      // tier 1 (under the falls) + the tall maple rock
      [31, 596, 470, 150, 84, 0.9], [32, 704, 452, 120, 80, 1], [33, 926, 486, 236, 176, 1],
      // tier 2
      [35, 618, 598, 130, 80, 0.95], [41, 748, 586, 150, 92, 1], [46, 962, 642, 150, 78, 0.9], [47, 1062, 622, 96, 66, 0.85],
      // tier 3
      [36, 700, 700, 160, 100, 1], [42, 832, 716, 116, 78, 0.9], [43, 998, 734, 120, 80, 0.95], [37, 1112, 714, 140, 92, 0.9],
      // tier 4 (left part under tier 3, then stepping right/down)
      [48, 648, 832, 116, 66, 0.9], [38, 800, 818, 180, 92, 1], [40, 1082, 862, 160, 80, 1], [45, 1222, 872, 150, 70, 0.9], [39, 1330, 892, 96, 56, 0.85],
    ];
    // drawn larger than the listed footprint so the tiers carry real dark mass (ref: ~half the cascade is rock)
    const rocks = RK.map(([seed, cx, yTop, w, h, dark]) => {
      const m = dark < 0.5 ? 1 : 1.3;
      return { ...boulder(cx, yTop - (m - 1) * h * 0.3, w * m, h * (dark < 0.5 ? 1 : 1.12), seed), seed, dark, misty: dark < 0.5, pour: 1 };
    });
    const RECT_W = [500, 400, 1100, 700];
    const sheetGrad = (ctx, x0, x1, y, h, top = 0.08) => {
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, 'rgb(0,0,0)'); g.addColorStop(top, 'rgb(0,255,0)'); g.addColorStop(0.7, 'rgb(0,220,0)'); g.addColorStop(1, 'rgb(0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(x0, y, x1 - x0, h);
    };
    // water behind the rocks: one broad falling body, foam pools at each rock's foot
    layers.push(makeWhiteWater(api, {
      name: 'cascade-water', z: Z.casc * 1.01, rect: RECT_W, speed: 210, darkness: 0.26, streakScale: 2.8, foamDark: 0.16,
      draw: (ctx) => {
        ctx.globalCompositeOperation = 'lighter';
        ctx.filter = 'blur(6px)';
        ctx.fillStyle = 'rgb(255,0,0)';
        ctx.beginPath();
        ctx.moveTo(560, 420); ctx.lineTo(800, 420); ctx.lineTo(900, 520); ctx.lineTo(1060, 640); ctx.lineTo(1160, 800);
        ctx.lineTo(1450, 930); ctx.lineTo(1650, 960); ctx.lineTo(1650, 1110); ctx.lineTo(560, 1110); ctx.lineTo(540, 800); ctx.closePath();
        ctx.fill();
        // falling sheets only where water drops: the main drop below the upper falls and beside /
        // between the boulders of each tier (crown level to foot); pools of foam below every foot
        ctx.filter = 'blur(5px)';
        sheetGrad(ctx, 560, 840, 390, 150, 0.05);
        for (const R of rocks) if (!R.misty) sheetGrad(ctx, R.x0 - 36, R.x1 + 36, R.yTop - 6, R.h * 1.12, 0.12);
        ctx.filter = 'blur(10px)';
        ctx.fillStyle = 'rgb(0,0,255)';
        for (const R of rocks) {
          ctx.beginPath(); ctx.ellipse(R.cx, R.yTop + R.h * 1.08, R.w * 0.8, 22 + R.h * 0.2, 0, 0, Math.PI * 2); ctx.fill();
        }
      },
    }));

    // the rocks: dark mottled crowns fading down the face, dissolving at the foot into foam
    const boulders = rocks.map((R) => { const r = api.rng(R.seed * 7 + 1); return { ...R, fade: R.misty ? [0.3, 0.85] : [r.range(0.58, 0.8), r.range(1.0, 1.15)] }; });
    // grey modelling in the water below each boulder (shadow, falling streak bundles, splash stipple)
    const wshade = api.bakeCanvas(1170, 690, (ctx) => { ctx.translate(-470, -370); paintWaterShade(ctx, boulders, 8); });
    layers.push(api.tex(inkify(api, wshade, { edge: 0.1, granulation: 0.2, bleed: 0.6 }), { rect: [470, 370, 1170, 690], z: Z.casc * 1.004, name: 'water-shade' }));
    layers.push(rockCard([470, 370, 1170, 690], boulders, Z.casc, 'rock-cascade'));

    // water pouring over the rock crowns: tongues of uneven strands, solid in the middle, frayed at the
    // sides, ending in froth at the foot (in front of the rock)
    layers.push(makeWhiteWater(api, {
      name: 'cascade-over', z: Z.casc * 0.996, rect: RECT_W, speed: 180, darkness: 0.26, streakScale: 1.8, foamDark: 0.16, opacity: 0.96,
      draw: (ctx) => {
        ctx.globalCompositeOperation = 'lighter';
        const rw = api.rng(908);
        for (const R of rocks) {
          if (R.misty) continue;
          // tongues: a soft translucent sheet with streaky strands on top, narrow where it leaves
          // the crown notch, spreading and fraying as it falls
          const nT = Math.floor(rw.range(0.2, 0.9) + R.w / 150 * rw.range(0.5, 1.3));
          for (let k = 0; k < nT; k++) {
            const tw = R.w * rw.range(0.14, 0.3);
            let tc = 0, ty = -1e9;
            for (let c = 0; c < 5; c++) { const x = R.x0 + R.w * rw.range(0.12, 0.88); if (R.top(x) > ty) { ty = R.top(x); tc = x; } }
            const bot = R.yTop + R.h * rw.range(0.9, 1.15);
            ctx.filter = 'blur(1.5px)';
            ctx.fillStyle = 'rgb(120,120,0)';
            ctx.beginPath();
            ctx.moveTo(tc - tw * 0.3, ty + 2); ctx.lineTo(tc + tw * 0.3, ty + 2);
            ctx.lineTo(tc + tw * 0.6, bot); ctx.lineTo(tc - tw * 0.6, bot); ctx.closePath(); ctx.fill();
            ctx.filter = 'blur(0.8px)';
            const nS = Math.max(4, Math.round(tw / 2.6));
            for (let s = 0; s < nS; s++) {
              const e = (s + 0.5) / nS * 2 - 1;
              const sx = tc + e * tw * 0.32 + rw.range(-1.5, 1.5);
              const t0 = R.top(sx) + 1 + Math.abs(e) * rw.range(0, 16);
              const len = (bot - t0) * (1 - Math.abs(e) * rw.range(0, 0.55)) * rw.range(0.7, 1.0);
              const sw = rw.range(1.2, 3.6) * (1.15 - 0.4 * Math.abs(e));
              const v = Math.round(255 * rw.range(0.35, 1.0) * (1 - 0.3 * Math.abs(e)));
              const spread = e * tw * 0.3 * rw.range(0.6, 1.2);
              ctx.fillStyle = `rgb(${v},${v},0)`;
              ctx.beginPath();
              ctx.moveTo(sx - sw / 2, t0); ctx.lineTo(sx + sw / 2, t0);
              ctx.lineTo(sx + sw / 2 + spread + sw * 0.4, t0 + len); ctx.lineTo(sx - sw / 2 + spread - sw * 0.4, t0 + len);
              ctx.closePath(); ctx.fill();
            }
          }
          // billowing froth along the foot: overlapping round puffs, so the rock ends in a lumpy white edge
          ctx.filter = 'blur(1.2px)';
          const nF = Math.round(R.w / 22);
          for (let k = 0; k < nF; k++) {
            const fr = rw.range(8, 22) * (0.7 + R.h / 300);
            const v = Math.round(rw.range(150, 235));
            ctx.fillStyle = `rgb(${v},0,255)`;
            ctx.beginPath();
            ctx.arc(R.x0 + R.w * (k + rw.range(0.1, 0.9)) / nF, R.yTop + R.h * rw.range(0.82, 1.0) + fr * 0.5, fr, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      },
    }));
    layers.push(makeSpray(api, {
      name: 'spray-cascade', z: Z.casc * 0.98,
      blobs: [[700, 650, 140, 46, 0.9], [612, 790, 110, 44, 0.8], [960, 690, 130, 44, 0.8], [800, 980, 220, 50, 0.9], [1090, 850, 150, 46, 0.85], [660, 450, 110, 36, 0.8], [1210, 900, 120, 40, 0.7], [960, 940, 100, 36, 0.6]],
      threshold: 0.66, scale: 38, stretch: 1.0, rise: 18, drift: 3, shade: 0.3, softness: 0.25,
    }));

    // ---------------------------------------------------------------- left cliffs
    const upperLeft = {
      seed: 51,
      outline: [[-140, 172], [-60, 164], [10, 152], [70, 160], [128, 172], [170, 190], [192, 240], [198, 330], [204, 450], [210, 600], [215, 760], [-140, 760]],
      facets: [22, 118, 160], face: 0.92, shade: 0.12, crown: 1.0, shadowTex: 1.6, tex: 0.55, texLen: 2.6, shLen: 2.2, sharp: 1, mottle: 0.08, facetVar: 0.14, texLit: 0.03, texLight: 0.72, gran: 0.5,
      fade: [[-100, 540, 690], [200, 580, 740]],
    };
    const midCol = {
      seed: 52,
      outline: [[172, 302], [212, 276], [262, 264], [312, 280], [352, 302], [376, 342], [368, 400], [388, 452], [380, 540], [394, 610], [388, 700], [398, 800], [172, 800]],
      facets: [226, 300, 362], face: 0.9, shade: 0.08, crown: 1.2, shadowTex: 1.7, tex: 0.55, texLen: 2.6, shLen: 2.2, sharp: 1, mottle: 0.08, facetVar: 0.16, texLit: 0.03, texLight: 0.72, gran: 0.5,
      fade: [[180, 620, 770], [390, 680, 790]],
    };
    const pillar = {
      seed: 53,
      outline: [[382, 382], [420, 356], [470, 346], [520, 352], [552, 382], [566, 440], [552, 478], [570, 512], [562, 566], [578, 600], [570, 650], [582, 700], [574, 752], [586, 820], [382, 820]],
      facets: [424, 470, 538], face: 0.42, shade: 0.03, crown: 1.4, shadowTex: 1.8, tex: 0.7, texLen: 2.4, shLen: 2.0, sharp: 1, mottle: 0.25, facetVar: 0.2, texLit: 0.05, texLight: 0.66, gran: 0.6,
      fade: [[390, 680, 810], [580, 700, 815]],
    };
    const lowerLeft = {
      seed: 54,
      outline: [[-140, 566], [-50, 544], [40, 556], [96, 600], [132, 594], [172, 642], [218, 690], [262, 682], [290, 752], [332, 766], [356, 812], [398, 848], [438, 842], [472, 902], [522, 936], [548, 930], [568, 982], [598, 1040], [612, 1200], [-140, 1200]],
      facets: [20, 130, 262, 390], face: 0.78, shade: 0.05, crown: 1.1, slant: 0.25, shadowTex: 1.8, tex: 0.65, texLen: 2.4, shLen: 2.0, sharp: 1, topDark: 60, mottle: 0.15, facetVar: 0.2, texLit: 0.04, texLight: 0.68, gran: 0.6,
      fade: [[-100, 1100, 1200], [600, 1120, 1200]],
    };
    // lumpy stones stepping down the lower-left slope (breaks its long diagonal)
    const slopeStones = [[252, 664, 120, 58, 81], [446, 820, 104, 56, 82], [140, 580, 90, 46, 83]].map(([cx, y, w, h, sd]) => ({ ...boulder(cx, y, w, h, sd), seed: sd, dark: 0.9, fade: [0.85, 1.3] }));
    layers.push(rockCard([-160, 120, 800, 1100], [upperLeft, midCol, pillar, lowerLeft, ...slopeStones], Z.left, 'rock-left'));

    // bottom foreground rocks
    const front = {
      seed: 61,
      outline: [[380, 952], [440, 932], [500, 926], [560, 936], [620, 922], [700, 916], [780, 930], [850, 960], [900, 1000], [940, 1060], [950, 1200], [380, 1200]],
      facets: [470, 560, 660, 770, 870], face: 0.5, shade: 0.08, crown: 0.5, mossSize: 0.6, mottle: 1.0, facetVar: 0.2, texLit: 0.1, texLight: 0.5, topDark: 60,
      fade: [[380, 1150, 1200], [950, 1150, 1200]],
    };
    const bigLow = { ...boulder(1240, 916, 320, 118, 62, { rMax: 24 }), seed: 62, dark: 1, fade: [0.74, 1.15] };
    const lowR = { ...boulder(1528, 972, 176, 70, 63), seed: 63, dark: 0.95, fade: [0.7, 1.1] };
    layers.push(rockCard([360, 860, 1300, 360], [front, bigLow, lowR], Z.front, 'rock-front'));

    // ---------------------------------------------------------------- vegetation
    const vegFalls = api.bakeCanvas(900, 600, (ctx) => {
      ctx.translate(-600, -20);
      const r = api.rng(71);
      paintMaple(ctx, { x: 740, y: 108, height: 50, width: 120, shape: 'bush', leafSize: 3.0, density: 1.2, seed: 3, rng: r.fork('m1'), ...LEAF });
      paintMaple(ctx, { x: 960, y: 226, height: 64, width: 130, shape: 'spread', leafSize: 3.0, density: 1.2, seed: 4, rng: r.fork('m2'), ...LEAF });
      paintMaple(ctx, { x: 925, y: 196, height: 44, width: 90, shape: 'round', leafSize: 2.9, density: 1.1, seed: 5, rng: r.fork('m3'), ...LEAF });
      paintConifer(ctx, 728, 82, 74, { kind: 'fir', tone: 0.04, seed: 6 });
      paintConifer(ctx, 792, 72, 66, { kind: 'fir', tone: 0.05, seed: 7 });
      paintConifer(ctx, 870, 96, 58, { kind: 'pine', tone: 0.05, seed: 8 });
      paintConifer(ctx, 976, 186, 80, { kind: 'fir', tone: 0.04, seed: 9 });
      paintConifer(ctx, 1036, 262, 54, { kind: 'pine', tone: 0.06, seed: 10 });
    });
    layers.push(api.tex(inkify(api, vegFalls, { edge: 0.35, granulation: 0.12, bleed: 0.8 }), { rect: [600, 20, 900, 600], z: Z.falls * 0.995, name: 'veg-falls', sway: { amp: 1.5, freq: 0.2, scale: 300, power: 1.5, anchor: [900, 300], radius: 400 } }));

    const vegCasc = api.bakeCanvas(300, 200, (ctx) => {
      ctx.translate(-820, -400);
      paintMaple(ctx, { x: 930, y: 526, height: 60, width: 130, shape: 'spread', leafSize: 3.2, density: 1.2, seed: 12, ...LEAF });
      paintConifer(ctx, 978, 520, 60, { kind: 'fir', tone: 0.04, seed: 13 });
    });
    layers.push(api.tex(inkify(api, vegCasc, { edge: 0.35, granulation: 0.12, bleed: 0.8 }), { rect: [820, 400, 300, 200], z: Z.casc * 0.995, name: 'veg-casc', sway: { amp: 1.5, freq: 0.22, scale: 200, power: 1.5, anchor: [940, 530], radius: 100 } }));

    // left maples (ref positions, design px): small leaf dabs in clumps on thin twigs, ink-dark leaves mixed in
    const maples = makeMaple(api, {
      seed: 8, paper: PAPER, rect: [-120, 120, 760, 820],
      trees: [
        { x: 60, y: 272, height: 100, width: 160, lean: 10, shape: 'round', crown: [62, 210, 90, 52], leafSize: 4.8, density: 2.6, cluster: 18, depth: 5, ...LEAF },
        { x: 300, y: 372, height: 70, width: 160, lean: 20, shape: 'spread', crown: [318, 328, 88, 38], leafSize: 4.6, density: 2.6, cluster: 18, depth: 5, ...LEAF },
        { x: 470, y: 424, height: 90, width: 220, lean: 15, shape: 'spread', crown: [490, 372, 112, 46], leafSize: 4.6, density: 2.6, cluster: 18, depth: 5, ...LEAF },
        { x: 40, y: 640, height: 200, width: 420, lean: 50, shape: 'cascade', dir: 1, crown: [230, 625, 200, 80], leafSize: 5.2, density: 3.2, cluster: 24, trunk: 12,
          limbs: [[-60, 90, 0.7], [-10, 130, 0.6], [25, 150, 0.5], [-100, 60, 0.4]], trunkLen: 40, depth: 5, ...LEAF },
        { x: 430, y: 890, height: 130, width: 150, lean: -5, shape: 'round', crown: [428, 818, 66, 58], leafSize: 4.8, density: 2.6, cluster: 18, depth: 5, ...LEAF },
      ],
    });
    layers.push(maples.layer({ z: Z.left * 0.995, amp: 2 }));

    // pines on the left
    const pineA = makePine(api, {
      seed: 31, height: 230, gnarl: 0.7,
      spine: [[118, 210], [124, 172], [138, 134], [152, 104]],
      trunkWidth: 26, taper: 0.45, flare: 0.15,
      limbs: [
        { pts: [[150, 108], [190, 92], [240, 82], [295, 80], [352, 88]], w: 12, subs: 3 },
        { pts: [[146, 116], [110, 84], [70, 58], [20, 42], [-30, 36]], w: 11, subs: 3 },
        { pts: [[152, 104], [168, 68], [196, 40], [240, 24]], w: 9, subs: 2 },
        { pts: [[132, 150], [90, 140], [50, 136]], w: 7, subs: 1 },
      ],
      padSize: 86, needle: 13, needles: 8, padDensity: 2.2, soft: 0.5, wet: 0.35, haze: 0.35, scale: 1.25, barkTone: 0.3,
    });
    layers.push(pineA.layer({ z: Z.left * 0.99 }));
    const pineB = makePine(api, {
      seed: 32, height: 140, gnarl: 0.6,
      spine: [[300, 304], [306, 278], [314, 254]],
      trunkWidth: 14, taper: 0.5,
      limbs: [
        { pts: [[312, 260], [350, 250], [400, 246], [440, 252]], w: 7, subs: 2 },
        { pts: [[310, 262], [280, 254], [240, 250], [204, 256]], w: 7, subs: 2 },
        { pts: [[314, 254], [320, 232], [332, 216]], w: 6, subs: 1 },
      ],
      padSize: 60, needle: 10, needles: 8, padDensity: 2.0, soft: 0.5, wet: 0.35, haze: 0.3, scale: 1.25, barkTone: 0.3,
    });
    layers.push(pineB.layer({ z: Z.left * 0.99 }));
    const pineC = makePine(api, {
      seed: 33, height: 150, gnarl: 0.6,
      spine: [[84, 574], [92, 540], [100, 506], [110, 478]],
      trunkWidth: 16, taper: 0.5,
      limbs: [
        { pts: [[106, 488], [140, 476], [184, 472], [224, 480]], w: 7, subs: 2 },
        { pts: [[100, 500], [70, 486], [30, 474], [-14, 470]], w: 8, subs: 2 },
        { pts: [[110, 478], [116, 458], [128, 442]], w: 6, subs: 1 },
      ],
      padSize: 62, needle: 10, needles: 8, padDensity: 2.0, soft: 0.5, wet: 0.35, haze: 0.3, scale: 1.25, barkTone: 0.3,
    });
    layers.push(pineC.layer({ z: Z.left * 0.99 }));

    // drifting red leaves
    layers.push(makeFallingLeaves(api, {
      region: [120, 300, 520, 360], count: 10, nearCount: 1, seed: 8, fall: [40, 90], wind: 30, gust: 0.35,
      size: [5, 24], life: [7, 11], blur: 5, z: 1, rect: [-100, 200, 1300, 900],
    }));

    return {
      layers,
      camera: (t) => { const s = t - 3; return { x: -1.8 * s, y: -1.0 * s, dolly: 0.018 + 0.003 * s, zoom: 1, roll: 0 }; },
      meta: { clear: PAPER.map((v) => v / 255) },
    };
  },
};
