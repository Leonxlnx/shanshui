// s07 - Bamboo valley (ref 07). The first painting of the film: painted in from bare paper
// by the ink-bloom transition, so the darkest masses (bamboo culms, near rocks, the right
// cliff crown) carry the composition.
//
// Layer stack (back to front, z):
//   sky 1e5 | far peaks 11 | mist 10 | central peaks 7.5 | mist 7 | mid peaks 5.5 | mist 5
//   | far right cliffs 4 | left-centre cliff + forested ridge 3.2 | mist 3 | river 2.4
//   | right cliff + gate 2.3 | conifers 2.15 | river mist 2.1 | islands/shore 2 | low fog 1.8
//   | near rocks + shrubs 1.1 | bamboo grove 1.0 | bottom-right bamboo 1.0
import { makeSky, makeMist, makeWaterFog } from '../lib/atmos.js';
import { makePeaks, makeRange } from '../lib/peaks.js';
import { cliff, bakeRocks, paintMoss } from '../lib/rock.js';
import { paintTreeLine, paintConifer, paintPine } from '../lib/pine.js';
import { makeArch } from '../lib/architecture.js';
import { makeBamboo, paintMapleDab } from '../lib/flora.js';
import { inkify } from '../lib/inkfx.js';
import { blob, rgba, tone } from '../lib/brush.js';
import { CULMS, TWIGS, BR_CULMS, BR_TWIGS } from './s07/grove.js';
import { makeRocks } from './s07/rocks.js';
import { paintShrubMass } from './s07/shrub.js';

const P07 = [236, 229, 218];
const C = (rgb) => rgb.map((v) => v / 255);

// ------------------------------------------------------------------ river (design px)
const RIVER = [[1188, 744], [1262, 742], [1330, 778], [1460, 836], [1640, 896], [1720, 1000], [1740, 1130], [640, 1130], [650, 950], [715, 885], [900, 842], [1050, 803], [1138, 768]];

const RIVER_FS = /* glsl */ `
uniform sampler2D uMask;
uniform vec4 uMR;          // mask rect
uniform vec3 uPaperC;
vec4 shade(vec2 p, vec2 uv) {
  vec2 mu = (p - uMR.xy) / uMR.zw;
  if (mu.x < 0.0 || mu.y < 0.0 || mu.x > 1.0 || mu.y > 1.0) return vec4(0.0);
  float m = texture(uMask, mu).a;
  if (m < 0.003) return vec4(0.0);
  float t = uTime;
  // perspective: ripple lines get thinner and denser toward the far end (y 740)
  float persp = clamp((p.y - 735.0) / 345.0, 0.03, 1.0);
  float fy = p.y / (2.5 + 10.0 * persp);
  float ph = fbm(vec2(p.x / (200.0 * persp + 30.0) + t * 0.025, p.y / 50.0), 3) * 3.0;
  float ln = pow(0.5 + 0.5 * sin(fy * 6.2832 + ph + t * 0.35), 7.0);
  float brk = smoothstep(-0.1, 0.55, fbm(vec2((p.x - t * 9.0 * persp) / (130.0 * persp + 18.0), p.y / (9.0 * persp + 2.0)), 3));
  float s2 = fbm(vec2((p.x - t * 5.0) / 70.0, p.y / 2.5), 3);
  float lines = ln * brk + smoothstep(0.45, 0.9, s2) * 0.25;
  // darker water along the banks (shadowed shallows) and lighter mid-stream
  float bank = 1.0 - smoothstep(0.2, 0.95, m);
  float a = clamp(0.05 + 0.035 * persp + lines * (0.2 + 0.16 * persp) + bank * 0.12, 0.0, 0.5);  vec3 ink = vec3(0.30, 0.28, 0.26);
  vec3 col = mix(uPaperC, ink, a);
  float al = m;
  return vec4(col * al, al);
}`;

export const FACTS = {
  bloomSeeds: [[185, 330], [1485, 465]],   // bamboo culms / right cliff crown (darkest ink)
  gate: [1611, 395],                       // red gate pavilion centre
  valley: [1225, 745],                     // far end of the river (camera pushes toward it)
};

export default {
  id: 's07', title: 'Bamboo valley', ref: '07',
  build(api) {
    const L = [];
    const paperShader = (z) => api.shader(`vec4 shade(vec2 p, vec2 uv){ return vec4(vec3(${C(P07).map((v) => v.toFixed(4)).join(',')}), 1.); }`, { z });
    L.push(makeSky(api, { variant: 'rice', top: P07, bottom: P07 }));

    // ---- far pale peaks (top centre) + far right cliff tops
    const far = makePeaks(api, {
      paper: P07,
      peaks: [
        { x: 1365, top: 82, base: 330, tone: 0.66, seed: 71, fade: 0.35, columns: [
          { dx: -70, top: 130, hw: 50 }, { dx: 0, top: 82, hw: 62, lit: 0.6 }, { dx: 75, top: 120, hw: 48 }] },
        { x: 960, top: 300, base: 420, tone: 0.72, seed: 72, fade: 0.35, columns: [{ dx: -40, top: 310, hw: 40 }, { dx: 30, top: 300, hw: 45 }] },
      ],
    });
    L.push(far.layer({ z: 11 }));
    L.push(makeMist(api, { top: 230, bottom: 520, z: 10, lobe: 90, seed: 11, drift: 6, color: P07, density: 0.9, extent: [800, 1700, 160] }));

    // ---- central peaks
    const cen = makePeaks(api, {
      paper: P07,
      peaks: [
        { x: 1150, top: 160, base: 480, tone: 0.5, seed: 73, fade: 0.32, shape: 'dome', trees: 1.3, treeSize: 0.55, columns: [
          { dx: -280, top: 360, hw: 50, cap: 'round' }, { dx: -215, top: 296, hw: 54, cap: 'round' }, { dx: -150, top: 252, hw: 58, cap: 'round', lit: 0.5 }, { dx: -80, top: 212, hw: 62, cap: 'round', lit: 0.5 },
          { dx: 190, top: 300, hw: 48, cap: 'round' }, { dx: 140, top: 250, hw: 52, cap: 'round' }, { dx: 80, top: 204, hw: 60, cap: 'round', lit: 0.6 },
          { dx: 0, top: 160, hw: 72, cap: 'round', lit: 0.5 }] },
      ],
    });
    L.push(cen.layer({ z: 7.5 }));
    const cfar = makeRange(api, { paper: P07, rows: [{ x0: 650, x1: 1080, base: 470, top: 300, amp: 0.3, tone: 0.76, seed: 81, count: 3, trees: 0.8, treeSize: 0.5, shape: 'dome' }], soft: 1.0 });
    L.push(cfar.layer({ z: 8 }));
    L.push(makeMist(api, { top: 390, bottom: 640, z: 7, lobe: 80, seed: 12, drift: 8, color: P07, density: 0.95 }));

    // ---- mid peaks
    const mid = makePeaks(api, {
      paper: P07,
      peaks: [
        { x: 1290, top: 327, base: 560, tone: 0.34, seed: 74, fade: 0.42, columns: [
          { dx: -100, top: 380, hw: 45 }, { dx: -20, top: 327, hw: 55, lit: 0.5 }, { dx: 80, top: 350, hw: 50, lit: 0.6 }, { dx: 145, top: 400, hw: 40 }] },
        { x: 1010, top: 441, base: 680, tone: 0.38, seed: 75, fade: 0.5, trees: 1.2, treeSize: 0.6, columns: [
          { dx: -60, top: 470, hw: 50, cap: 'round' }, { dx: -20, top: 441, hw: 58, lit: 0.45, cap: 'round' }, { dx: 98, top: 476, hw: 56, lit: 0.5, cap: 'round' }, { dx: 170, top: 520, hw: 46, cap: 'round' }] },
      ],
    });
    L.push(mid.layer({ z: 5.5 }));
    L.push(makeMist(api, { top: 585, bottom: 780, z: 5, lobe: 80, seed: 13, drift: 9, color: P07, density: 0.95 }));

    // ---- left far hills behind the bamboo
    const lfar = makeRange(api, { paper: P07, rows: [{ x0: 200, x1: 620, base: 470, top: 270, amp: 0.4, tone: 0.72, seed: 76, count: 3, trees: 1, treeSize: 0.8 }], soft: 0.8 });
    L.push(lfar.layer({ z: 6 }));

    // ---- far right tall pale cliff (behind the gate cliff)
    const fr = makePeaks(api, {
      paper: P07,
      peaks: [
        { x: 1570, top: 20, base: 560, tone: 0.42, seed: 77, fade: 0.55, shape: 'mesa', columns: [
          { dx: -60, top: 50, hw: 60, lit: 0.7, cap: 'round' }, { dx: 30, top: 20, hw: 70, lit: 0.6, cap: 'round' }] },
        { x: 1840, top: 200, base: 700, tone: 0.28, seed: 78, fade: 0.5, columns: [
          { dx: -70, top: 230, hw: 60, lit: 0.6, cap: 'round' }, { dx: 30, top: 200, hw: 80, lit: 0.5, cap: 'round' }, { dx: 130, top: 190, hw: 60 }] },
      ],
    });
    L.push(fr.layer({ z: 4 }));
    // pale distant forest in the valley mist
    const pfRect = [1100, 520, 420, 240];
    const pfRaw = api.bakeCanvas(pfRect[2], pfRect[3], (ctx) => {
      ctx.translate(-pfRect[0], -pfRect[1]);
      paintTreeLine(ctx, [[1150, 640], [1230, 630], [1320, 650], [1420, 670], [1480, 690]], { height: [40, 74], density: 3, tone: 0.5, toneJitter: 0.15, rows: 3, clump: 0.5, paper: P07, seed: 91 });
    });
    L.push(api.tex(inkify(api, pfRaw, { edge: 0.2, granulation: 0.15, bleed: 1.4 }), { rect: pfRect, z: 4.5, opacity: 0.85 }));
    L.push(makeMist(api, { top: 692, bottom: 820, z: 4.2, lobe: 60, seed: 17, drift: 9, color: P07, density: 0.9, extent: [1080, 1560, 120] }));

    // ---- left-centre cliff + forested ridge sloping to the river
    const lc = makePeaks(api, {
      paper: P07,
      peaks: [
        { x: 560, top: 312, base: 800, tone: 0.12, face: 0.26, seed: 79, fade: 0.66, treeSize: 1.2, columns: [
          { dx: -95, top: 362, hw: 44, lit: 0.4 }, { dx: -30, top: 312, hw: 56, lit: 0.5 }, { dx: 40, top: 356, hw: 50, lit: 0.6 }, { dx: 100, top: 428, hw: 48, lit: 0.6 }, { dx: 158, top: 500, hw: 46, lit: 0.5 }] },
      ],
    });
    L.push(lc.layer({ z: 3.2 }));
    const ridgeRect = [640, 450, 640, 480];
    const ridgeRaw = api.bakeCanvas(ridgeRect[2], ridgeRect[3], (ctx) => {
      ctx.translate(-ridgeRect[0], -ridgeRect[1]);
      const ridge = [[700, 545], [760, 580], [830, 620], [900, 660], [970, 700], [1040, 735], [1100, 765], [1160, 790]];
      paintTreeLine(ctx, ridge, { height: [56, 104], density: 3.2, tone: 0.05, rows: 3, clump: 0.35, paper: P07, seed: 21 });
      for (let k = 1; k <= 4; k++) {
        const off = ridge.map(([x, y]) => [x + k * 12, y + k * 38]);
        paintTreeLine(ctx, off, { height: [48 - k * 4, 90 - k * 8], density: 3.6, tone: 0.06 + k * 0.045, rows: 2, clump: 0.35, paper: P07, seed: 21 + k, from: 0.02 * k, to: 1 - 0.08 * k });
      }
    });
    L.push(api.tex(inkify(api, ridgeRaw, { edge: 0.35, granulation: 0.2, bleed: 0.9 }), { rect: ridgeRect, z: 3.1 }));
    L.push(makeMist(api, { top: 740, bottom: 900, z: 3, lobe: 70, seed: 14, drift: 11, color: P07, density: 0.8, extent: [820, 1500, 140] }));

    // ---- river
    const mrect = [600, 700, 1180, 450];
    const mask = api.bakeCanvas(mrect[2], mrect[3], (ctx) => {
      ctx.translate(-mrect[0], -mrect[1]);
      ctx.filter = 'blur(10px)';
      ctx.fillStyle = '#000';
      ctx.beginPath(); RIVER.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill();
    }, { scale: 0.5 });
    L.push(api.shader(RIVER_FS, { z: 2.4, rect: [560, 680, 1260, 500], name: 'river', textures: { uMask: mask }, uniforms: { uMR: mrect, uPaperC: C(P07) } }));

    // ---- right cliff with the gate
    const rock = makeRocks(api, {
      rect: [1400, 400, 640, 520], paper: P07, seed: 5, look: { tone: 0.7, crown: 1.0, texture: 0.4, speckle: 0.7, cun: 1.8 },
      items: [
        { outline: [[1438, 480], [1452, 458], [1490, 452], [1540, 448], [1600, 446], [1660, 447], [1700, 455], [1740, 478], [1780, 520], [1796, 546], [1700, 560], [1690, 700], [1694, 840], [1452, 860], [1446, 700], [1440, 560]],
          fade: [690, 830], top: [[1438, 480], [1452, 458], [1490, 452], [1530, 450]], crown: 26, drips: 0.05, rough: 2,
          dark: [{ poly: [[1440, 470], [1540, 460], [1530, 560], [1450, 600]], a: 70 }, { poly: [[1640, 520], [1700, 520], [1696, 800], [1650, 800]], a: 90 }],
          lit: [{ poly: [[1452, 520], [1490, 520], [1500, 860], [1456, 860]], a: 130 }, { poly: [[1540, 470], [1700, 470], [1760, 530], [1560, 520]], a: 160 }],
          contour: [{ pts: [[1440, 560], [1446, 700], [1452, 830]], w: 4 }, { pts: [[1688, 570], [1690, 700], [1694, 820]], w: 6 }] },
        { outline: [[1672, 572], [1700, 550], [1745, 548], [1792, 560], [1842, 580], [1900, 598], [1970, 612], [2030, 620], [2030, 920], [1684, 920], [1676, 720]],
          fade: [680, 820], top: [[1672, 572], [1700, 550], [1745, 548], [1792, 560], [1842, 580], [1900, 598], [1970, 612]], crown: 34, drips: 0.05, rough: 3,
          dark: [{ poly: [[1690, 560], [1800, 570], [1790, 700], [1700, 720]], a: 80 }],
          contour: [{ pts: [[1676, 600], [1678, 720], [1684, 820]], w: 2.5 }] },
      ],
    });
    L.push(rock.layer({ z: 2.3 }));    const ctRect = [1380, 300, 640, 360];
    const ctRaw = api.bakeCanvas(ctRect[2], ctRect[3], (ctx) => {
      ctx.translate(-ctRect[0], -ctRect[1]);
      const r = api.rng(33);
      paintTreeLine(ctx, [[1420, 470], [1450, 452], [1500, 450], [1540, 450]], { height: [36, 64], density: 3, tone: 0.06, rows: 2, paper: P07, seed: 34 });
      paintPine(ctx, { x: 1480, y: 458, height: 110, lean: -6, bend: -20, reach: -0.5, seed: 35, paper: P07 });
      paintTreeLine(ctx, [[1700, 556], [1760, 552], [1830, 572], [1900, 598], [1960, 610]], { height: [40, 90], density: 2.4, tone: 0.08, rows: 2, paper: P07, seed: 36 });
      paintTreeLine(ctx, [[1720, 470], [1760, 496], [1790, 530]], { height: [30, 56], density: 2.4, tone: 0.12, rows: 1, paper: P07, seed: 37 });
      paintShrubMass(ctx, [[1436, 476], [1480, 456], [1530, 452]], r, { count: 12, height: [22, 44], tone: 0.03, paper: P07, spread: 70, density: 1.6 });
      paintShrubMass(ctx, [[1560, 470], [1640, 490], [1700, 520]], r, { count: 6, height: [12, 24], tone: 0.15, paper: P07, spread: 70 });
      paintShrubMass(ctx, [[1680, 560], [1800, 566], [1900, 600]], r, { count: 12, height: [20, 40], tone: 0.04, paper: P07, spread: 70 });
      for (let i = 0; i < 18; i++) paintMapleDab(ctx, 1770 + r.range(-25, 25), 585 + r.range(-18, 18), r.range(3, 7), { color: [178, 70, 52], alpha: r.range(0.5, 0.85), rng: r, rot: r() * 6 });
      // red maple behind the gate's right side
      ctx.strokeStyle = rgba(tone(0.08, P07), 0.9); ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      for (const [x0, y0, x1, y1] of [[1700, 458], [1716, 430], [1712, 440], [1740, 410], [1705, 452], [1680, 420]].reduce((a, p, i, arr) => (i % 2 ? a : [...a, [...p, ...arr[i + 1]]]), [])) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
      for (let i = 0; i < 90; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 1;
        const x = 1708 + Math.cos(a) * d * 40, y = 415 + Math.sin(a) * d * 30;
        paintMapleDab(ctx, x, y, r.range(2.5, 6), { color: r.chance(0.3) ? [140, 52, 40] : [176, 78, 60], alpha: r.range(0.5, 0.85), rng: r, rot: r() * 6 });
      }
    });
    L.push(api.tex(inkify(api, ctRaw, { edge: 0.3, granulation: 0.18, bleed: 0.8 }), { rect: ctRect, z: 2.3 }));
    const gate = makeArch(api, 'gate', { x: 1611, y: 445, w: 136, seed: 7, paper: P07 });
    L.push(api.tex(gate.src, { rect: gate.rect, z: 2.3 }));

    // conifers in front of the cliff, left of it
    const cfRect = [1300, 560, 200, 300];
    const cfRaw = api.bakeCanvas(cfRect[2], cfRect[3], (ctx) => {
      ctx.translate(-cfRect[0], -cfRect[1]);
      const r = api.rng(41);
      const T = [[1350, 800, 120], [1385, 790, 150], [1420, 805, 110], [1330, 820, 80], [1445, 810, 90]];
      for (const [x, y, h] of T) paintConifer(ctx, x, y, h, { kind: 'fir', tone: 0.08, paper: P07, seed: r.int(1, 1e6) });
    });
    L.push(api.tex(inkify(api, cfRaw, { edge: 0.35, granulation: 0.2, bleed: 0.9 }), { rect: cfRect, z: 2.15 }));
    L.push(makeMist(api, { top: 770, bottom: 960, z: 2.1, lobe: 70, seed: 15, drift: 12, color: P07, density: 1, shade: 0.4, extent: [1300, 2000, 90] }));

    // ---- islands and shore rocks in the river (with reflections)
    const isl = makeRocks(api, {
      rect: [630, 760, 900, 220], paper: P07, seed: 9, look: { tone: 0.4, crown: 1.3, texture: 1, speckle: 0.6, cun: 0.5 },
      items: [
        { outline: [[650, 906], [700, 872], [780, 860], [870, 864], [960, 872], [1030, 882], [1080, 896], [1104, 910], [650, 912]], top: [[650, 906], [700, 872], [780, 860], [870, 864], [960, 872], [1030, 882], [1080, 896], [1104, 910]], crown: 22, rough: 5 },
        { outline: [[1136, 906], [1166, 862], [1220, 838], [1282, 842], [1332, 858], [1362, 884], [1374, 908]], top: [[1136, 906], [1166, 862], [1220, 838], [1282, 842], [1332, 858], [1362, 884], [1374, 908]], crown: 26, rough: 6 },
        { outline: [[1384, 952], [1408, 932], [1450, 926], [1490, 936], [1504, 954]], top: [[1384, 952], [1408, 932], [1450, 926], [1490, 936], [1504, 954]], crown: 14, rough: 3 },
      ],
    });
    const isTrees = api.bakeCanvas(900, 260, (ctx) => {
      ctx.translate(-630, -720);
      const r = api.rng(51);
      paintTreeLine(ctx, [[1180, 850], [1230, 838], [1290, 846]], { height: [70, 112], density: 3.2, tone: 0.06, rows: 2, paper: P07, seed: 52 });
      paintTreeLine(ctx, [[680, 878], [760, 864], [860, 866]], { height: [26, 46], density: 2.6, tone: 0.1, rows: 2, paper: P07, seed: 53 });
      paintShrubMass(ctx, [[700, 878], [900, 868], [1060, 888]], r, { count: 16, height: [12, 26], tone: 0.06, paper: P07, spread: 70 });
      paintShrubMass(ctx, [[1150, 880], [1330, 856]], r, { count: 10, height: [14, 28], tone: 0.05, paper: P07, spread: 70 });
    });
    const isRefl = { y: 906, strength: 0.42, fade: 46, smear: 3, amp: 2.2, wavelength: 26, speed: 0.5, breakup: 0.45 };
    L.push(api.tex(isl.src, { rect: isl.rect, z: 2.0, reflect: isRefl }));
    L.push(api.tex(inkify(api, isTrees, { edge: 0.3, granulation: 0.18, bleed: 0.8 }), { rect: [630, 720, 900, 260], z: 2.0, reflect: isRefl }));    L.push(makeWaterFog(api, { top: 770, z: 1.8, color: P07, seed: 16, drift: 7, extent: [700, 1500, 150], density: 0.5 }));

    // ---- bamboo grove (left): back + culms behind the near rocks, near leaves in front
    const grove = makeBamboo(api, { seed: 7, rect: [-160, -120, 1260, 1300], paper: P07, culms: CULMS, twigs: TWIGS, leafWidth: 0.105, leafScale: 0.94 });
    const gl = grove.layers({ amp: 4 });
    L.push(gl[0], gl[1]);

    // ---- near rocks bottom-left + shrubs
    const bgShRect = [-60, 600, 520, 260];
    const bgSh = api.bakeCanvas(bgShRect[2], bgShRect[3], (ctx) => {
      ctx.translate(-bgShRect[0], -bgShRect[1]);
      const r = api.rng(73);
      paintShrubMass(ctx, [[0, 830], [100, 790], [200, 760], [300, 742], [400, 744]], r, { count: 40, height: [50, 110], tone: 0.02, paper: P07, spread: 75, density: 2 });
    });
    L.push(api.tex(inkify(api, bgSh, { edge: 0.1, granulation: 0.1, bleed: 0.5 }), { rect: bgShRect, z: 1.0 }));
    const near = makeRocks(api, {
      rect: [-140, 680, 1320, 480], paper: P07, seed: 6, look: { tone: 0.22, crown: 1.25, texture: 1, speckle: 1, cun: 0.7 },
      items: [
        { outline: [[204, 800], [224, 760], [262, 735], [310, 718], [355, 713], [400, 720], [440, 734], [470, 752], [492, 778], [505, 820], [515, 900], [526, 1000], [534, 1160], [196, 1160], [194, 900]],
          top: [[204, 800], [224, 760], [262, 735], [310, 718], [355, 713], [400, 720], [440, 734], [470, 752], [492, 778]], crown: 56, drips: 0.25, rough: 6,
          dark: [{ poly: [[200, 760], [480, 740], [470, 860], [210, 900]], a: 90 }],
          lit: [{ poly: [[456, 790], [505, 810], [512, 1160], [446, 1160], [440, 900]], a: 160 }, { poly: [[250, 1000], [380, 980], [390, 1160], [240, 1160]], a: 80 }],
          contour: [{ pts: [[492, 778], [505, 820], [515, 900], [526, 1000], [534, 1100]], w: 5 }, { pts: [[440, 790], [438, 900], [444, 1060]], w: 3 }] },
        { outline: [[610, 1002], [652, 976], [722, 962], [800, 955], [880, 958], [960, 966], [1040, 981], [1100, 1002], [1142, 1032], [1152, 1160], [610, 1160]],
          top: [[610, 1002], [652, 976], [722, 962], [800, 955], [880, 958], [960, 966], [1040, 981], [1100, 1002], [1142, 1032]], crown: 40, drips: 0.1,
          lit: [{ poly: [[700, 1010], [820, 1000], [840, 1160], [700, 1160]], a: 120 }] },
      ],
    });
    const lrock = makeRocks(api, {
      rect: [-140, 800, 400, 360], paper: P07, seed: 8, look: { tone: 0.66, crown: 1.1, texture: 0.8, speckle: 0.6, cun: 1.0 },
      items: [{ outline: [[-140, 940], [-60, 905], [0, 880], [60, 860], [130, 850], [180, 862], [214, 890], [232, 932], [240, 1160], [-140, 1160]],
        top: [[-140, 940], [-60, 905], [0, 880], [60, 860], [130, 850], [180, 862], [214, 890]], crown: 26, drips: 0.15, rough: 4,
        lit: [{ poly: [[-60, 900], [150, 900], [200, 1010], [210, 1160], [-60, 1160]], a: 150 }],
        contour: [{ pts: [[170, 866], [214, 896], [232, 940], [238, 1060]], w: 3 }] }],
    });
    L.push(near.layer({ z: 1.0 }));
    L.push(lrock.layer({ z: 1.0 }));
    const shRect = [440, 660, 760, 480];
    const shRaw = api.bakeCanvas(shRect[2], shRect[3], (ctx) => {
      ctx.translate(-shRect[0], -shRect[1]);
      const r = api.rng(71);
      paintShrubMass(ctx, [[505, 1090], [560, 1040], [620, 1000], [700, 990]], r, { count: 14, height: [80, 170], tone: 0.0, paper: P07, spread: 50, lean: 10, density: 2.2 });
      paintShrubMass(ctx, [[500, 900], [540, 870]], r, { count: 4, height: [50, 90], tone: 0.06, paper: P07, spread: 60, lean: 20 });
      paintShrubMass(ctx, [[640, 985], [760, 962], [900, 956], [1060, 985]], r, { count: 12, height: [24, 50], tone: 0.06, paper: P07 });
      for (const [x, y, h] of [[820, 962, 70], [880, 960, 56], [950, 968, 64], [1010, 978, 48]]) paintConifer(ctx, x, y, h, { kind: 'pine', tone: 0.06, paper: P07, seed: x });
    });
    L.push(api.tex(inkify(api, shRaw, { edge: 0.1, granulation: 0.1, bleed: 0.5 }), { rect: shRect, z: 1.0 }));
    L.push(gl[2]);
    const clump = makeBamboo(api, { seed: 71, rect: [1460, 680, 560, 500], paper: P07, culms: BR_CULMS, twigs: BR_TWIGS, leafWidth: 0.11 });
    L.push(...clump.layers({ amp: 4 }));

    return {
      layers: L,
      camera: (t) => ({ x: 4 * (t - 3), y: 0, dolly: 0.0035 * (t - 3), zoom: 1, roll: 0 }),
      grade: { vignette: 0 },
      meta: { clear: C(P07) },
    };
  },
};
