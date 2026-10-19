// s04 - Rope bridges (ref 04). Dense Huangshan pillar peaks in mist, waterfall on the left,
// three rope bridges, four cranes, a pine top-right leaning left, a pavilion on the right cliff,
// red maples. Camera: slow tilt up (leads into the cloud rise to s09).
//
// Depth plan (z): sky 1e5 | far ridge 6 | top band 4 | mid band 2.5 (+ upper bridge) | cranes 2 |
// mist 1.5 | front-left + waterfall 1.3 | mist 1.05 | centre-front peak + long bridge, lower peaks +
// lower bridge, gorge pillar, bottom-left cliffs, right cliff, pavilion, maples, firs, pine 1.0.
// Every bridge shares the z of both peaks it hangs between, so parallax never detaches it.
import { makeSky, makeMist } from '../lib/atmos.js';
import { makeRange, wetInk } from '../lib/peaks.js';
import { bakeMassifs, paintSoftPine } from './s04/massif.js';
import { makePine } from '../lib/pine.js';
import { inkify } from '../lib/inkfx.js';
import { paintPavilion, paintRopeBridge, bakeArch } from '../lib/architecture.js';
import { makeMaple } from '../lib/flora.js';
import { makeCraneFlock } from '../lib/fauna.js';
import { makeWaterfall } from '../lib/water.js';
import { PAPER } from '../lib/brush.js';

const D = Math.PI / 180;
const T_REF = 3;            // time at which the composition matches the reference

// cranes measured on ref 04 (body centre at T_REF), flying right and slightly up
const CRANES = [
  { x: 1089, y: 195, size: 130, heading0: -24.6 * D, phase: 0.97, vx: 50, vy: -12, seed: 4 },
  { x: 1174, y: 198, size: 103, heading0: -12.7 * D, phase: 0.5, vx: 55, vy: -6, seed: 5 },
  { x: 1242, y: 121, size: 125, heading0: -14.9 * D, phase: 0.02, vx: 52, vy: -7, seed: 6 },
  { x: 1408, y: 120, size: 108, heading0: -16.4 * D, phase: 0.0, vx: 54, vy: -8, seed: 7 },
].map((c) => ({ ...c, x: c.x - c.vx * T_REF, y: c.y - c.vy * T_REF }));

const ROPES = {
  long: { a: [1100, 490], b: [1421, 459], sag: 38, hand: 15, figure: 0.035, seed: 41 },
  upper: { a: [913, 336], b: [1011, 349], sag: 10, hand: 9, seed: 42, fade: 0.25 },
  lower: { a: [790, 762], b: [910, 826], sag: 16, hand: 15, seed: 43 },
};

export const FACTS = {
  waterfall: [393, 545],          // lip centre (design px, rest, z 1.3)
  waterfallBase: [423, 793],      // where the curtain dissolves into its spray
  cranes: CRANES.map((c) => [c.x + c.vx * T_REF, c.y + c.vy * T_REF]),
  bridges: [[1100, 490, 1421, 459], [913, 336, 1011, 349], [790, 762, 910, 826]],
  pavilion: [1662, 386],
  camera: 'y = -7.5 (t - 3): rest layout = reference at t = 3, tilting up',
};

// mist cards only need a little horizontal overscan (the camera never pans in x)
const mistRect = (top, bottom, lobe, x0 = -120, w = 2160) => [x0, top - lobe * 2.6 - 60, w, bottom - top + lobe * 2.6 + 100];

// rope bridge card that sways very slightly: the baked bridge is resampled with a vertical
// displacement that is zero at both anchors (sin(pi u)) and breathes at ~0.2 Hz
function swayBridge(api, rope, rect, z, amp, phase, name) {
  const src = bakeArch(api, rect, (ctx) => paintRopeBridge(ctx, rope), { blur: 0.2 });
  return api.shader(/* glsl */ `
    uniform sampler2D uB;
    uniform vec4 uBr;
    vec4 shade(vec2 p, vec2 uv) {
      float u = clamp((p.x - uBr.x) / (uBr.y - uBr.x), 0.0, 1.0);
      float d = uBr.z * sin(3.14159 * u) * (0.7 * sin(uTime * 1.25 + uBr.w) + 0.3 * sin(uTime * 0.53 + uBr.w * 2.1));
      return texture(uB, uv - vec2(0.0, d / uRect.w));
    }`, { rect, z, name, textures: { uB: src }, uniforms: { uBr: [rope.a[0], rope.b[0], amp, phase] } });
}

export default {
  id: 's04', title: 'Rope bridges', ref: '04',
  build(api) {
    const layers = [];
    const P = PAPER;

    // ---------------------------------------------------------------- sky / paper
    layers.push(makeSky(api, { top: [238, 230, 219], bottom: [239, 231, 220], seed: 4 }));

    // ---------------------------------------------------------------- far ridge (z 6)
    const far = makeRange(api, {
      rows: [
        { x0: 840, x1: 1480, base: 400, top: 200, amp: 0.45, tone: 0.8, seed: 41, count: 8, trees: 0.8, treeSize: 0.6 },
        { x0: -60, x1: 260, base: 230, top: 50, amp: 0.4, tone: 0.72, seed: 47, count: 3, trees: 0.8 },
      ], soft: 1.0,
    });
    layers.push(far.layer({ z: 6 }));

    // ---------------------------------------------------------------- top band (z 4)
    const topRect = [-80, -70, 1560, 1000];
    const top = bakeMassifs(api, topRect, [
      { seed: 101, tone: 0.68, trees: 0.45, treeTone: 0.56, base: 260, fade: 150, tips: 1.4, sc: 0.8, splay: [10, 10], treeH: [10, 22],
        top: [[-20, 120], [10, 80], [30, 55], [50, 46], [70, 52], [90, 80], [110, 110], [130, 140], [150, 170]] },
      { seed: 102, tone: 0.66, trees: 0.45, treeTone: 0.54, base: 310, fade: 190, tips: 1.4, sc: 0.8, splay: [10, 10], treeH: [10, 22],
        top: [[640, 200], [655, 140], [672, 110], [690, 98], [712, 92], [735, 105], [760, 130], [785, 165], [805, 210]] },
      { seed: 103, tone: 0.42, trees: 0.45, treeTone: 0.41, base: 300, fade: 170, sc: 0.9, splay: [10, 10], treeH: [12, 28], tips: 1.5,
        top: [[262, 120], [280, 60], [300, 40], [322, 32], [338, 50], [360, 45], [385, 52], [410, 35], [440, 20], [470, 8], [492, 6], [512, 18], [530, 40], [545, 80], [565, 95], [590, 96], [612, 110], [630, 140], [645, 180]],
        faces: [{ x: 482, y: 18, w: 62, len: 240 }, { x: 325, y: 42, w: 40, len: 180 }, { x: 588, y: 104, w: 36, len: 150 }] },
      { seed: 104, tone: 0.62, trees: 0.45, treeTone: 0.51, base: 540, fade: 440, tips: 1.3, sc: 0.85, splay: [10, 10], treeH: [12, 24],
        top: [[1095, 440], [1112, 405], [1135, 386], [1160, 378], [1188, 388], [1215, 405], [1240, 430], [1262, 470]] },
      { seed: 105, tone: 0.62, trees: 0.45, treeTone: 0.51, base: 680, fade: 580, sc: 0.85, splay: [10, 10], treeH: [10, 22],
        top: [[1250, 560], [1272, 520], [1300, 500], [1330, 496], [1360, 508], [1390, 530], [1420, 560], [1440, 600]] },
      { seed: 107, tone: 0.5, trees: 0.45, treeTone: 0.41, base: 800, fade: 700, sc: 0.9, splay: [10, 10], treeH: [12, 26], tips: 1.4,
        top: [[1135, 640], [1150, 600], [1170, 588], [1190, 592], [1210, 610], [1230, 600], [1250, 615], [1270, 650]] },
      { seed: 106, tone: 0.62, trees: 0.45, treeTone: 0.51, base: 920, fade: 870, sc: 0.8, splay: [6, 6], treeH: [10, 20],
        top: [[1125, 860], [1140, 830], [1160, 812], [1182, 806], [1200, 818], [1217, 850]] },
    ], { wetInk });
    layers.push(api.tex(top, { rect: topRect, z: 4, name: 'top' }));
    layers.push(makeMist(api, { top: 250, bottom: 470, z: 3.6, lobe: 80, seed: 1, drift: 8, density: 0.85, rect: mistRect(250, 470, 80) }));

    // ---------------------------------------------------------------- mid band (z 2.5)
    const midRect = [40, 30, 1120, 590];
    const mid = bakeMassifs(api, midRect, [
      { seed: 201, tone: 0.2, base: 470, fade: 330, sc: 1, splay: [10, 20],
        top: [[109, 250], [130, 215], [160, 180], [190, 158], [212, 148], [240, 165], [270, 185], [300, 210], [340, 238], [390, 252], [425, 290]],
        faces: [{ x: 262, y: 200, w: 70, len: 230, lean: -0.05 }, { x: 350, y: 250, w: 50, len: 180, lean: 0.03 }] },
      { seed: 202, tone: 0.36, base: 520, fade: 400, sc: 1, splay: [10, 10],
        top: [[436, 385], [460, 352], [490, 336], [520, 333], [560, 345], [600, 372], [622, 405]],
        faces: [{ x: 535, y: 345, w: 60, len: 200, lean: 0 }] },
      { seed: 203, tone: 0.17, base: 590, fade: 440, sc: 1.1, splay: [20, 10], tips: 2.0, tipW: 0.85, trees: 0.6,
        top: [[585, 290], [598, 266], [622, 256], [645, 250], [662, 238], [680, 236], [700, 226], [718, 230], [735, 212], [752, 206], [770, 214], [785, 198], [805, 186], [822, 178], [840, 182], [855, 196], [866, 220], [874, 252], [878, 290]],
        faces: [{ x: 837, y: 236, w: 100, len: 250, lean: -0.02 }, { x: 735, y: 230, w: 55, len: 220, lean: -0.04 }] },
      { seed: 204, tone: 0.22, base: 540, fade: 420, sc: 1, splay: [4, 6], treeH: [16, 34],
        top: [[884, 330], [889, 304], [898, 291], [910, 293], [918, 312], [922, 335]],
        faces: [{ x: 906, y: 300, w: 22, len: 170, lean: 0 }] },
      { seed: 205, tone: 0.3, base: 560, fade: 440, sc: 1, splay: [10, 20],
        top: [[965, 385], [985, 348], [1010, 334], [1040, 340], [1070, 362], [1100, 400]],
        faces: [{ x: 1022, y: 345, w: 50, len: 170, lean: 0.02 }] },
    ], { wetInk });
    layers.push(api.tex(mid, { rect: midRect, z: 2.5, name: 'mid' }));
    layers.push(swayBridge(api, ROPES.upper, [895, 310, 135, 70], 2.5, 0.5, 1.3, 'bridge-upper'));

    // cranes (behind the near masses)
    layers.push(makeCraneFlock(api, { cranes: CRANES, z: 2, paper: P }));

    layers.push(makeMist(api, { top: 450, bottom: 760, z: 2.1, lobe: 90, seed: 2, drift: 11, density: 0.75, softness: 14, wispsAbove: 0.3, rect: mistRect(450, 760, 90) }));

    // ---------------------------------------------------------------- front-left (z 1.3)
    const flRect = [-100, 150, 820, 790];
    const fl = bakeMassifs(api, flRect, [
      { seed: 301, tone: 0.08, base: 760, fade: 560, sc: 1.2, splay: [0, 30], treeH: [36, 80], dark: 0.2, faces: [{ x: 40, y: 320, w: 30, len: 260 }],
        top: [[-60, 330], [-30, 306], [0, 298], [30, 296], [60, 304], [85, 322], [108, 355]] },
      { seed: 302, tone: 0.1, base: 720, fade: 560, tips: 1.4, sc: 1.2, splay: [40, 30], treeH: [44, 96], dark: 0.12,
        top: [[60, 425], [85, 398], [110, 382], [140, 376], [170, 384], [200, 398], [228, 420], [255, 440], [285, 455], [320, 470], [345, 500]],
        faces: [{ x: 205, y: 405, w: 56, len: 300 }, { x: 290, y: 462, w: 36, len: 220 }] },
      { seed: 303, tone: 0.1, base: 790, fade: 680, tips: 1.3, sc: 1.2, splay: [30, 40], treeH: [42, 92], dark: 0.1,
        top: [[300, 528], [322, 502], [345, 493], [362, 506], [370, 540], [395, 550], [418, 543], [430, 516], [450, 501], [480, 494], [510, 505], [540, 524], [575, 540], [610, 560], [645, 600]],
        faces: [{ x: 472, y: 502, w: 62, len: 280 }, { x: 330, y: 505, w: 30, len: 220 }, { x: 590, y: 552, w: 40, len: 220 }],
        zones: [[352, 610, 34, 120, 0.4, 0.9], [470, 640, 60, 130, 0.38, 1.0]] },
    ], { wetInk });
    layers.push(makeMist(api, { top: 600, bottom: 900, z: 1.5, lobe: 80, seed: 5, drift: 12, density: 0.55, softness: 16, wispsAbove: 0.35, extent: [-200, 760, 200], rect: mistRect(600, 900, 80, -120, 1080) }));
    layers.push(api.tex(fl, { rect: flRect, z: 1.3, name: 'front-left' }));
    const falls = makeWaterfall(api, {
      lip: [[368, 542], [418, 547]], height: 300, bendL: 6, bendR: 14, curve: 6, driftL: 8, driftR: 40, arch: 2,
      speed: 230, z: 1.3, seed: 4.2, sheets: 0, streakScale: 4.5, thin: 0.2, sideShade: 0.2, fade: 0.7,
      spray: { amount: 0.85, rise: 90, width: 90 },
    });
    layers.push(...falls.layers);

    // ---------------------------------------------------------------- lower peaks (z 1.1)
    // centre-front peak carrying the long bridge (behind the lower peaks' mist)
    const n1Rect = [720, 290, 500, 630];
    const n1 = bakeMassifs(api, n1Rect, [
      { seed: 505, tone: 0.14, base: 830, fade: 650, sc: 1.15, splay: [0, 24], treeH: [28, 58], trees: 0.6, tips: 1.2,
        top: [[1000, 520], [1010, 488], [1030, 476], [1060, 472], [1085, 478], [1100, 490], [1115, 510], [1125, 545], [1132, 600]],
        faces: [{ x: 1058, y: 482, w: 96, len: 330 }] },
      { seed: 501, tone: 0.1, base: 800, fade: 620, sc: 1.15, splay: [34, 0], treeH: [28, 62], dark: 0.15, tips: 1.4,
        top: [[870, 530], [885, 488], [905, 462], [930, 444], [955, 434], [978, 438], [995, 452], [1008, 480], [1015, 520]],
        faces: [{ x: 930, y: 452, w: 34, len: 220 }] },    ], { wetInk });
    layers.push(api.tex(n1, { rect: n1Rect, z: 1, name: 'centre-front' }));
    layers.push(swayBridge(api, ROPES.long, [1080, 430, 360, 116], 1, 1.4, 0, 'bridge-long'));
    layers.push(makeMist(api, { top: 820, bottom: 1250, z: 1.05, lobe: 100, seed: 3, drift: 14, density: 0.8, softness: 12, rect: mistRect(820, 1250, 100) }));
    const lowRect = [380, 540, 780, 620];
    const low = bakeMassifs(api, lowRect, [
      { seed: 403, tone: 0.2, base: 1120, fade: 1020, sc: 1, splay: [10, 10], treeH: [16, 34],
        top: [[425, 985], [445, 952], [470, 936], [495, 932], [520, 940], [545, 956], [574, 992]] },
      { seed: 401, tone: 0.12, base: 1090, fade: 880, tips: 1.5, sc: 1.15, splay: [40, 40], dark: 0.08, treeH: [30, 62],
        top: [[620, 725], [640, 698], [665, 684], [690, 678], [715, 684], [740, 698], [770, 728], [795, 758], [815, 792], [830, 835]],
        faces: [{ x: 705, y: 690, w: 84, len: 340 }] },
      { seed: 402, tone: 0.13, base: 1100, fade: 920, tips: 1.5, sc: 1.15, splay: [40, 40], dark: 0.08, treeH: [30, 62],
        top: [[880, 862], [896, 836], [910, 824], [925, 802], [945, 788], [965, 783], [990, 790], [1015, 806], [1040, 832], [1062, 872]],
        faces: [{ x: 968, y: 795, w: 72, len: 300 }] },
    ], { wetInk });
    layers.push(api.tex(low, { rect: lowRect, z: 1, name: 'lower' }));
    layers.push(swayBridge(api, ROPES.lower, [775, 730, 150, 116], 1, 0.7, 2.4, 'bridge-lower'));


    // ---------------------------------------------------------------- near (z 1)
    const nearRect = [-100, 500, 1560, 670];
    const near = bakeMassifs(api, nearRect, [
      { seed: 502, tone: 0.16, base: 1150, fade: 1010, sc: 1.1, splay: [10, 10], treeH: [22, 44], sideDark: 0.3,
        top: [[1270, 802], [1285, 762], [1305, 744], [1330, 738], [1352, 750], [1370, 776], [1385, 822]],
        faces: [{ x: 1334, y: 748, w: 50, len: 330 }] },
      { seed: 503, tone: 0.08, base: 1140, fade: 990, sc: 1.25, splay: [20, 20], treeH: [36, 80],
        top: [[180, 832], [195, 802], [225, 791], [260, 787], [300, 790], [340, 800], [370, 815], [400, 840], [420, 882]],
        faces: [{ x: 300, y: 796, w: 96, len: 320 }], zones: [[330, 860, 90, 50, 0.25, 1.2], [215, 850, 40, 60, 0.3, 1]] },
      { seed: 504, tone: 0.08, base: 980, fade: 790, sc: 1.25, splay: [0, 30], treeH: [36, 80], dark: 0.1, faces: [{ x: 40, y: 672, w: 56, len: 260 }, { x: 128, y: 700, w: 40, len: 200 }], zones: [[90, 720, 110, 50, 0.25, 1.3], [60, 860, 90, 150, 0.22]],
        top: [[-60, 700], [-20, 672], [20, 660], [60, 664], [100, 680], [140, 700], [170, 730], [192, 772]] },
    ], { wetInk });
    layers.push(api.tex(near, { rect: nearRect, z: 1, name: 'near' }));

    // right cliff: pale granite wall with the pavilion on top, darker front masses
    const rcRect = [1300, 210, 760, 970];
    const rc = bakeMassifs(api, rcRect, [
      { seed: 601, tone: 0.1, base: 1190, fade: 1120, sc: 1.35, splay: [70, 0], treeH: [34, 70], trees: 0.5, darkX: [1760, 1900, 0.3], moss: 0.45, wash: 0.7, band: 0.45, washAlpha: 0.75, dark: 0.04, shadeWash: 0.5, lines: 1.3, faceLit: 0.38, faceShadow: 0.62,
        tex: 1.15, zones: [[1470, 660, 75, 260, 0.2], [1900, 540, 55, 180, 0.28, 0.9], [1470, 460, 70, 50, 0.2, 1.2], [1690, 470, 42, 95, 0.35, 1.2], [1662, 610, 36, 90, 0.3, 1.0]],
        top: [[1396, 520], [1405, 472], [1416, 446], [1440, 421], [1462, 402], [1485, 388], [1515, 390], [1545, 378], [1575, 384], [1605, 393], [1640, 389], [1690, 389], [1722, 380], [1760, 384], [1800, 363], [1840, 351], [1880, 345], [1920, 350], [1990, 362], [2040, 380]],
        faces: [{ x: 1440, y: 440, w: 70, len: 600, lean: -0.04, blunt: 8 }, { x: 1540, y: 410, w: 80, len: 560, lean: -0.02, blunt: 8 },
          { x: 1615, y: 420, w: 44, len: 420, blunt: 6 }, { x: 1775, y: 430, w: 160, len: 480, lean: 0.12, blunt: 7 }],
        foliage: [{ pts: [[1406, 470], [1420, 440], [1445, 418], [1470, 398], [1500, 388]], r: 7, hang: 40, dens: 1.4, trees: 1, treeH: [30, 64] },
          { pts: [[1760, 384], [1800, 366], [1840, 354], [1880, 350], [1930, 356], [2000, 366]], r: 8, hang: 90, dens: 1.6 },
          { pts: [[1700, 470], [1720, 520], [1716, 600], [1700, 680]], r: 6, hang: 20, dens: 1.0 }] },
      { seed: 602, tone: 0.07, base: 1190, fade: 1140, sc: 1.35, splay: [0, 0], treeH: [34, 70], trees: 0.3, moss: 0.3, wash: 0.6, band: 0.45, washAlpha: 0.6, shadeWash: 0.5, lines: 1.3, faceLit: 0.34, faceShadow: 0.65,
        zones: [[1650, 840, 120, 60, 0.25, 1.4], [1510, 970, 90, 80, 0.25, 1.4], [1745, 765, 70, 45, 0.2, 1.2], [1850, 880, 110, 220, -0.3]],
        top: [[1330, 1110], [1380, 1042], [1430, 982], [1480, 922], [1530, 862], [1580, 802], [1620, 762], [1665, 722], [1700, 704], [1740, 696], [1800, 706], [1860, 694], [1920, 702], [2040, 722]],
        faces: [{ x: 1560, y: 840, w: 70, len: 320, lean: -0.25, blunt: 6 }, { x: 1700, y: 712, w: 100, len: 460, lean: -0.1, blunt: 6 }, { x: 1830, y: 712, w: 120, len: 460, lean: -0.08, blunt: 6 }],
        pines: [[1598, 792, 112, -0.5, 1.25]],
        foliage: [{ pts: [[1440, 975], [1480, 922], [1530, 862], [1580, 802], [1620, 765], [1665, 726], [1700, 708]], r: 10, hang: 95, dens: 2.6 },
          { pts: [[1340, 1100], [1380, 1050], [1420, 1000]], r: 10, hang: 80, dens: 2, trees: 1, treeH: [40, 80] }] },    ], { wetInk });
    layers.push(api.tex(rc, { rect: rcRect, z: 1, name: 'right-cliff' }));

    // pavilion on the cliff top
    const pavRect = [1520, 230, 290, 190];
    layers.push(api.tex(bakeArch(api, pavRect, (ctx) => paintPavilion(ctx, { x: 1662, y: 386, w: 141, seed: 41, variant: 'peak', baseH: 0.3, colH: 0.78, walls: 'open', wallTone: 0.36 })), { rect: pavRect, z: 1, name: 'pavilion' }));

    // red maples by the pavilion and on the lower cliff
    const maples = makeMaple(api, {
      seed: 104, paper: P,
      trees: [
        { x: 1590, y: 410, height: 60, width: 80, lean: -10, shape: 'round', crown: [1585, 378, 40, 26], leafSize: 3.0, density: 1.4, pale: 0.35, depth: 5 },
        { x: 1772, y: 440, height: 105, width: 110, lean: 8, shape: 'round', crown: [1772, 385, 56, 48], leafSize: 3.4, density: 1.4, pale: 0.35, depth: 5 },
        { x: 1655, y: 715, height: 105, width: 100, lean: 5, shape: 'round', crown: [1650, 655, 50, 46], leafSize: 3.4, density: 1.4, pale: 0.3, depth: 5 },
      ],
    });
    layers.push(maples.layer({ z: 1, amp: 1.5 }));

    // pine top-right leaning left (ref 04 lab calibration) with firs behind the trunk
    // behind the trunk: painted Huangshan pines (wet bodies blurred, crisp needles), not stamped firs
    const back = api.bakeCanvas(420, 420, (ctx) => {
      ctx.translate(-1500, 0);
      const wc = new OffscreenCanvas(ctx.canvas.width, ctx.canvas.height);
      const w = wc.getContext('2d');
      for (const [x, y, h, tone, seed, wid, tiers] of [[1892, 410, 300, 0.32, 3, 0.9, 7], [1808, 392, 170, 0.22, 8, 1.0, 5]]) {
        const c = `rgb(${[14, 12, 9].map((v, i) => Math.round(v + (P[i] - v) * tone)).join(',')})`;
        w.setTransform(ctx.getTransform());
        w.clearRect(-1e4, -1e4, 2e4, 2e4);
        ctx.fillStyle = c; w.fillStyle = c;
        paintSoftPine(ctx, w, x, y, h, { ink: c, lean: -0.04, width: wid, tiers, cone: true }, api.rng('s04back:' + seed));
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.filter = 'blur(1px)';
        ctx.drawImage(wc, 0, 0);
        ctx.restore();
      }
    });
    layers.push(api.tex(inkify(api, back, { edge: 0.3, granulation: 0.15, bleed: 1.0 }), { rect: [1500, 0, 420, 420], z: 1, name: 'firs',
      sway: { amp: 1.5, freq: 0.2, scale: 300, power: 1.6, anchor: [1860, 400], radius: 300 } }));
    const pine = makePine(api, {
      seed: 4, height: 360, gnarl: 0.7,
      spine: [[1885, 410], [1866, 320], [1843, 250], [1815, 186], [1790, 140], [1768, 100], [1748, 62]],
      trunkWidth: 56, taper: 0.4, flare: 0.1,
      limbs: [
        { pts: [[1800, 162], [1758, 150], [1708, 145], [1659, 156], [1609, 163], [1565, 170], [1522, 182], [1484, 194], [1435, 213], [1390, 232]], w: 21, subs: 5 },
        { pts: [[1572, 172], [1532, 192], [1500, 212], [1470, 233], [1442, 252]], w: 10, subs: 1 },
        { pts: [[1752, 72], [1712, 52], [1662, 46], [1627, 52], [1590, 72]], w: 18, subs: 2 },
        { pts: [[1754, 72], [1792, 54], [1830, 50], [1864, 58]], w: 12, subs: 1 },
      ],
      padSize: 44, needle: 8, padDensity: 1.15, haze: 0, barkTone: 0.5, barkDensity: 0.7, knobs: 0.4, backTone: 0.62, wet: 0.25, soft: 0.2, core: 0.15, needles: 11, swayAmp: 3.5, swayFreq: 0.2,
    });
    layers.push(pine.layer({ z: 1 }));

    return {
      layers,
      camera: (t) => ({ x: 0, y: -7.5 * (t - T_REF), dolly: 0, zoom: 1, roll: 0 }),
      grade: { vignette: 0 },
      meta: { clear: P.map((v) => v / 255) },
    };
  },
};
