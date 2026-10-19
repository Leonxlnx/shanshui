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

export const FACTS = {
  waterfall: [640, 270],     // inside the main upper sheet (rest space)
  cascade: [760, 640],       // middle of the lower tiers
  bloomSeeds: [[300, 520], [800, 230]],
};

// maple leaf look: slightly muted vermilion, many ink-dark leaves, airy clumps
const MAPLE_PAL = { bright: [190, 60, 44], mid: [162, 50, 38], dark: [110, 36, 28], pale: [202, 146, 126] };
const LEAF = { palette: MAPLE_PAL, inkLeaves: 0.22, pale: 0.2, alongTwigs: 0.8, clusterSpread: 3.4, strays: 0.05 };

const Z = { far: 9, mid: 5.5, ridge: 3.4, near: 2.5, falls: 2.0, casc: 1.6, left: 1.25, front: 1.08 };

// rounded boulder: upper half-ellipse with lumpy crown, body hanging down to top + h (dissolved by the fade)
function boulderBlob(x0, x1, top, h, seed) {
  let s0 = seed * 7.13 + 1;
  const rnd = () => { s0 = Math.sin(s0 * 12.9898 + 78.233) * 43758.5453; return s0 - Math.floor(s0); };
  const cx = (x0 + x1) / 2, rx = (x1 - x0) / 2, ry = Math.min(h * 0.55, rx * 0.75);
  const nb = 2 + Math.floor(rnd() * 4), ph = rnd() * 6.28, amp = 0.1 + rnd() * 0.14, tilt = (rnd() - 0.5) * 0.25;
  const pts = [];
  const n = 30;
  for (let i = 0; i <= n; i++) {
    const th = Math.PI - (i / n) * Math.PI;
    const lump = 1 + amp * Math.abs(Math.sin(th * nb + ph)) + 0.05 * Math.sin(th * 7 + ph * 2);
    const x = cx + Math.cos(th) * rx * (1 + 0.04 * Math.sin(th * 3 + ph));
    const y = top + ry - Math.sin(th) * ry * lump + tilt * (x - cx) * 0.3;
    pts.push([x, y]);
  }
  pts.push([x1 + rx * 0.22, top + h * 0.6], [x1 + rx * 0.34, top + h], [cx + rx * 0.3 * Math.sin(ph * 3), top + h * 1.08], [x0 - rx * 0.34, top + h], [x0 - rx * 0.22, top + h * 0.6]);
  return pts;
}

// domed, lobed boulder crown from x0..x1 (highest point yTop), body reaching depth px below
function boulderOutline(x0, x1, yTop, depth, seed, bumps = 0) {
  const w = x1 - x0;
  const nb = bumps || Math.max(2, Math.round(w / 45));
  let s0 = seed * 9.73;
  const rnd = () => { s0 = (s0 * 16807 + 0.123) % 2147483647; return (s0 % 1000) / 1000; };
  const ph = rnd() * 3, skew = rnd() - 0.5;
  const pts = [];
  const n = 28;
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const dome = Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, s + skew * 0.25 * Math.sin(Math.PI * s)))), 0.55);
    const lobe = Math.pow(Math.abs(Math.sin(s * nb * Math.PI + ph)), 0.6);
    pts.push([x0 + s * w, yTop + (1 - dome) * Math.min(depth * 0.45, w * 0.22) + (1 - lobe) * Math.min(18, w / nb * 0.45)]);
  }
  pts.push([x1 + w * 0.04, yTop + depth], [x0 - w * 0.04, yTop + depth]);
  return pts;
}

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
      threshold: 0.45, scale: 110, rise: 9, drift: 3, shade: 0.65, softness: 0.3, shadow: [178, 172, 164],
    }));

    // ---------------------------------------------------------------- upper falls: wall + right cliff
    const INK_FX = { edge: 0.5, granulation: 0.25, bleed: 1.0 };
    const rockCard = (rect, rocks, z, name) => {
      const b = bakeS08Rocks(api, rect, rocks, { scale: 1 });
      return api.tex(inkify(api, b.src, INK_FX), { rect, z, name });
    };
    const wall = {
      seed: 21,
      outline: [[318, 44], [342, 22], [372, 28], [398, 58], [430, 72], [470, 80], [520, 86], [560, 82], [600, 76], [650, 82], [700, 92], [700, 520], [318, 520]],
      facets: [362, 402, 446, 490, 560, 640], face: 0.45, shade: 0.07, shadowTex: 1.6, crown: 1.4,
      fade: [[320, 380, 470], [700, 400, 480]],
    };
    const rightCliff = {
      seed: 22,
      outline: [[700, 98], [728, 74], [770, 66], [822, 70], [872, 84], [906, 112], [920, 158], [952, 170], [986, 200], [1012, 238],
        [1046, 262], [1080, 302], [1100, 360], [1112, 440], [1120, 620], [782, 620], [786, 300], [790, 140], [740, 122]],
      facets: [835, 885, 948, 1004, 1062], face: 0.88, shade: 0.4, crown: 2.0, mossSize: 1.15,
      fade: [[780, 420, 520], [900, 440, 540], [1000, 480, 590], [1110, 540, 620]],
    };
    layers.push(rockCard([300, 0, 840, 640], [wall, rightCliff], Z.falls, 'rock-falls'));

    // upper waterfall curtains
    const fallsOpts = { z: Z.falls, spray: false, backingDark: 0.85, speed: 300, streakScale: 3.4, darkness: 0.18, lineWidth: 2.4, thin: 0.05, backingDark: 0.7 };
    for (const f of [
      { seed: 1.1, lip: [[404, 120], [432, 116]], height: 300, driftL: -2, driftR: 2, sheets: 1, thin: 0.6, opacity: 0.85, fade: 0.8, backing: false },
      { seed: 1.7, lip: [[450, 106], [474, 102]], height: 300, driftL: -2, driftR: 2, sheets: 1, thin: 0.5, opacity: 0.85, fade: 0.8, backing: false },
      { seed: 2.3, lip: [[494, 98], [592, 96]], height: 330, driftL: -6, driftR: 2, sheets: 1, arch: 4, fade: 0.78 },
      { seed: 3.1, lip: [[600, 96], [692, 100]], height: 320, driftL: -2, driftR: 4, sheets: 1, arch: 3, fade: 0.78 },
      { seed: 2.9, lip: [[708, 120], [786, 126]], height: 290, driftL: -2, driftR: 6, sheets: 1, fade: 0.78, thin: 0.35 },
    ]) layers.push(...makeWaterfall(api, { ...fallsOpts, ...f }).layers);
    layers.push(makeSpray(api, {
      name: 'spray-falls', z: Z.falls * 0.98,
      blobs: [[640, 400, 240, 70, 1.3], [470, 430, 130, 55, 1.0], [800, 430, 120, 55, 0.9], [640, 330, 150, 50, 0.6]],
      threshold: 0.42, scale: 85, stretch: 1.1, rise: 14, drift: 2, shade: 0.4,
    }));

    // ---------------------------------------------------------------- lower cascade
    // boulder specs [seed, x0, x1, yTop, depth]
    const BL = [
      [31, 540, 730, 418, 124], [32, 704, 904, 478, 92], [35, 556, 706, 488, 128], [33, 800, 1084, 500, 168],
      [34, 1008, 1172, 586, 108], [43, 548, 690, 648, 86], [36, 636, 760, 656, 80], [37, 690, 924, 672, 146],
      [38, 976, 1164, 720, 116], [44, 1136, 1262, 748, 74], [39, 620, 954, 822, 136], [40, 918, 1084, 892, 84],
      [41, 1226, 1452, 904, 84], [42, 1460, 1604, 958, 62],
    ];
    const RECT_W = [500, 400, 1100, 700];
    const sheetGrad = (ctx, x0, x1, y, h, top = 0.08) => {
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, 'rgb(0,0,0)'); g.addColorStop(top, 'rgb(0,255,0)'); g.addColorStop(0.7, 'rgb(0,220,0)'); g.addColorStop(1, 'rgb(0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(x0, y, x1 - x0, h);
    };
    layers.push(makeWhiteWater(api, {
      name: 'cascade-water', z: Z.casc * 1.01, rect: RECT_W, speed: 210, darkness: 0.15, streakScale: 3.0, foamDark: 0.2,
      draw: (ctx) => {
        ctx.globalCompositeOperation = 'lighter';
        ctx.filter = 'blur(6px)';
        ctx.fillStyle = 'rgb(255,0,0)';
        ctx.beginPath();
        ctx.moveTo(560, 420); ctx.lineTo(800, 420); ctx.lineTo(900, 520); ctx.lineTo(1060, 640); ctx.lineTo(1160, 800);
        ctx.lineTo(1450, 930); ctx.lineTo(1650, 960); ctx.lineTo(1650, 1110); ctx.lineTo(560, 1110); ctx.lineTo(540, 800); ctx.closePath();
        ctx.fill();
        ctx.filter = 'blur(4px)';
        for (const s of [
          [690, 830, 470, 110], [580, 720, 520, 170], [700, 820, 520, 150], [590, 710, 690, 140],
          [880, 1010, 600, 160], [700, 900, 790, 70], [580, 690, 800, 140], [890, 1040, 800, 120], [1130, 1200, 760, 120],
          [700, 950, 920, 140], [1040, 1110, 940, 110], [1150, 1300, 960, 110], [1420, 1500, 960, 60],
        ]) sheetGrad(ctx, ...s);
        ctx.filter = 'blur(8px)';
        ctx.fillStyle = 'rgb(0,0,255)';
        for (const [x, y, w, h] of [[740, 660, 260, 30], [650, 800, 180, 26], [940, 770, 180, 24], [820, 935, 300, 30], [1100, 905, 220, 24], [1300, 1040, 400, 40], [900, 1060, 400, 40], [1500, 1010, 260, 30]]) {
          ctx.beginPath(); ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill();
        }
      },
    }));

    // cascade boulders: dark wet rock with lumpy crowns, white water torn over their lower faces
    // each boulder is a cluster of overlapping rounded lobes (higher = behind, painted first)
    const boulders = [];
    for (const [seed, x0, x1, yTop, depth] of BL) {
      const r = api.rng(seed * 13 + 5);
      const w = x1 - x0, n = Math.max(1, Math.round(w / 65));
      const lobes = [];
      for (let i = 0; i < n; i++) {
        const cx = x0 + w * (i + 0.5) / n + r.range(-0.15, 0.15) * w / n;
        const lw = (w / n) * r.range(1.3, 1.8);
        const top = yTop + (n > 1 ? r.range(0, 0.45) * depth : 0);
        const d = depth * r.range(0.85, 1.15) - (top - yTop) * 0.3;
        lobes.push({ cx, lw, top, d, s: seed * 10 + i });
      }
      lobes.sort((a, b) => a.top - b.top);
      for (const L of lobes) {
        const a = L.cx - L.lw / 2, b = L.cx + L.lw / 2;
        boulders.push({
          seed: L.s, outline: boulderBlob(a, b, L.top, L.d, L.s), facets: r.chance(0.5) ? 2 : 1, slant: r.range(-0.15, 0.15), wisps: 0, rough: 5,
          fade: [[a, L.top + L.d * 0.15, L.top + L.d * 0.9], [L.cx, L.top + L.d * r.range(0.3, 0.55), L.top + L.d * 1.05], [b, L.top + L.d * 0.15, L.top + L.d * 0.9]], fadeJitter: 3.2,
          face: r.range(0.14, 0.28), shade: 0.03, crown: 1.0, mossSize: 0.55, lit: 0.9, streaks: 0, tex: 0.8, shadowTex: 0.8, dabs: 2.2,
        });
      }
    }
    layers.push(rockCard([470, 370, 1170, 690], boulders, Z.casc, 'rock-cascade'));
    // white water sliding over the boulders + froth at their feet (in front of the rock)
    layers.push(makeWhiteWater(api, {
      name: 'cascade-front', z: Z.casc * 0.996, rect: RECT_W, speed: 170, streakScale: 2.6, front: true, opacity: 0.2,
      draw: (ctx) => {
        ctx.globalCompositeOperation = 'lighter';
        ctx.filter = 'blur(3px)';
        // irregular tongues of water pouring over each boulder: a few ragged, widening sheets of varied
        // width / start / length (not a regular comb), joined by a broken foam band at the foot
        const rw = api.rng(908);
        for (const [, x0, x1, yTop, depth] of BL) {
          const w = x1 - x0;
          const nS = 1 + Math.round(w / 90 * rw.range(0.7, 1.3));
          for (let k = 0; k < nS; k++) {
            const sw = w * rw.range(0.1, 0.32), sx = x0 + w * 0.04 + (w * 0.92 - sw) * rw();
            const st = yTop + depth * rw.range(0.18, 0.55), sl = depth * rw.range(0.45, 0.95);
            const spread = sw * rw.range(0.05, 0.3), lean = rw.range(-0.15, 0.15) * sw;
            ctx.fillStyle = 'rgb(255,0,0)';
            ctx.beginPath(); ctx.moveTo(sx, st); ctx.lineTo(sx + sw, st + rw.range(0, 8));
            ctx.lineTo(sx + sw + spread + lean, st + sl * rw.range(0.8, 1.0)); ctx.lineTo(sx + sw * 0.5 + lean, st + sl);
            ctx.lineTo(sx - spread + lean, st + sl * rw.range(0.75, 1.0)); ctx.closePath(); ctx.fill();
            sheetGrad(ctx, sx + sw * 0.1, sx + sw * 0.9, st + 2, sl * 0.85, rw.range(0.2, 0.45));
          }
          ctx.fillStyle = 'rgb(0,0,255)';
          for (let k = 0; k < 3; k++) {
            ctx.beginPath();
            ctx.ellipse(x0 + w * rw.range(0.2, 0.8), yTop + depth * rw.range(0.88, 1.0), w * rw.range(0.15, 0.32), Math.max(8, depth * rw.range(0.1, 0.18)), 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      },
    }));
    layers.push(makeSpray(api, {
      name: 'spray-cascade', z: Z.casc * 0.98,
      blobs: [[760, 676, 150, 50, 0.9], [680, 812, 110, 44, 0.8], [960, 800, 120, 44, 0.8], [800, 960, 200, 50, 0.9], [1150, 930, 160, 50, 0.9], [630, 590, 80, 40, 0.7], [1000, 690, 90, 40, 0.6]],
      threshold: 0.58, scale: 38, stretch: 1.0, rise: 18, drift: 3, shade: 0.3, softness: 0.25,
    }));

    // ---------------------------------------------------------------- left cliffs
    const upperLeft = {
      seed: 51,
      outline: [[-140, 172], [-60, 164], [10, 152], [70, 160], [128, 172], [170, 190], [192, 240], [198, 330], [204, 450], [210, 600], [215, 760], [-140, 760]],
      facets: [30, 100, 168], face: 0.88, shade: 0.25, crown: 1.4, shadowTex: 1.4,
      fade: [[-100, 540, 690], [200, 580, 740]],
    };
    const midCol = {
      seed: 52,
      outline: [[172, 302], [212, 276], [262, 264], [312, 280], [352, 302], [376, 342], [386, 500], [392, 700], [398, 800], [172, 800]],
      facets: [236, 318, 356], face: 0.78, shade: 0.14, crown: 2.0, shadowTex: 1.6, tex: 1.2,
      fade: [[180, 620, 770], [390, 680, 790]],
    };
    const pillar = {
      seed: 53,
      outline: [[382, 382], [420, 356], [470, 346], [520, 352], [552, 382], [566, 440], [572, 560], [576, 700], [586, 820], [382, 820]],
      facets: [432, 500, 545], face: 0.5, shade: 0.05, crown: 2.2, shadowTex: 2.0, tex: 1.3,
      fade: [[390, 680, 810], [580, 700, 815]],
    };
    const lowerLeft = {
      seed: 54,
      outline: [[-140, 566], [-50, 544], [40, 556], [110, 592], [172, 642], [232, 702], [292, 760], [342, 802], [382, 852], [424, 880], [472, 902], [522, 940], [560, 982], [598, 1040], [612, 1200], [-140, 1200]],
      facets: [20, 150, 250, 400], face: 0.74, shade: 0.12, crown: 2.0, slant: 0.25, shadowTex: 2.0, tex: 1.3,
      fade: [[-100, 1100, 1200], [600, 1120, 1200]],
    };
    layers.push(rockCard([-160, 120, 800, 1100], [upperLeft, midCol, pillar, lowerLeft], Z.left, 'rock-left'));

    // bottom foreground rocks
    const front = {
      seed: 61,
      outline: [[380, 952], [440, 932], [500, 926], [560, 936], [620, 922], [700, 916], [780, 930], [850, 960], [900, 1000], [940, 1060], [950, 1200], [380, 1200]],
      facets: [470, 560, 660, 770, 870], face: 0.75, shade: 0.2, crown: 1.6,
      fade: [[380, 1150, 1200], [950, 1150, 1200]],
    };
    const bigLow = { seed: 62, outline: boulderOutline(1090, 1400, 912, 200, 62, 6), facets: 1, face: 0.24, shade: 0.04, crown: 1.6, lit: 0.5, streaks: 0.35, fade: [[1090, 990, 1110], [1400, 990, 1110]] };
    const lowR = { seed: 63, outline: boulderOutline(1440, 1610, 972, 90, 63, 4), facets: 1, face: 0.3, shade: 0.06, crown: 1.4, lit: 0.4, streaks: 0.3, fade: [[1440, 1010, 1062], [1610, 1010, 1062]] };
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
      padSize: 86, needle: 10, padDensity: 4.0, haze: 0.2, scale: 1.25, barkTone: 0.3,
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
      padSize: 60, needle: 8, padDensity: 3.6, haze: 0.15, scale: 1.25, barkTone: 0.3,
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
      padSize: 62, needle: 8, padDensity: 3.6, haze: 0.15, scale: 1.25, barkTone: 0.3,
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
