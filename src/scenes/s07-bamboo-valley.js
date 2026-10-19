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
          { dx: -280, top: 360, hw: 72, cap: 'round' }, { dx: -215, top: 296, hw: 78, cap: 'round' }, { dx: -150, top: 252, hw: 84, cap: 'round', lit: 0.5 }, { dx: -80, top: 212, hw: 90, cap: 'round', lit: 0.5 },
          { dx: 190, top: 300, hw: 70, cap: 'round' }, { dx: 140, top: 250, hw: 75, cap: 'round' }, { dx: 80, top: 204, hw: 87, cap: 'round', lit: 0.6 },
          { dx: 0, top: 160, hw: 104, cap: 'round', lit: 0.5 }] },
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
        { x: 1290, top: 327, base: 560, tone: 0.48, seed: 74, fade: 0.42, trees: 0.55, columns: [
          { dx: -100, top: 380, hw: 61 }, { dx: -20, top: 327, hw: 74, lit: 0.5, cap: 'point' }, { dx: 80, top: 350, hw: 68, lit: 0.6 }, { dx: 145, top: 400, hw: 54, cap: 'point' }] },
        { x: 1010, top: 441, base: 680, tone: 0.5, seed: 75, fade: 0.5, trees: 0.7, treeSize: 0.55, columns: [
          { dx: -60, top: 470, hw: 68, cap: 'round' }, { dx: -20, top: 441, hw: 78, lit: 0.45, cap: 'point' }, { dx: 98, top: 476, hw: 76, lit: 0.5, cap: 'point' }, { dx: 170, top: 520, hw: 62, cap: 'round' }] },
      ],
    });
    L.push(mid.layer({ z: 5.5 }));
    L.push(makeMist(api, { top: 585, bottom: 780, z: 5, lobe: 80, seed: 13, drift: 9, color: P07, density: 0.82, holes: 0.35, shade: 0.42 }));

    // ---- left far hills behind the bamboo
    const lfar = makeRange(api, { paper: P07, rows: [{ x0: 200, x1: 620, base: 470, top: 270, amp: 0.4, tone: 0.72, seed: 76, count: 3, trees: 1, treeSize: 0.8 }], soft: 0.8 });
    L.push(lfar.layer({ z: 6 }));

    // ---- far right tall cliffs behind the gate cliff (painted rock, pale, tree-crowned tops)
    const frA = makeRocks(api, {
      rect: [1400, -40, 440, 680], paper: P07, seed: 12,
      look: { tone: 0.47, crown: 0.95, texture: 0.6, speckle: 0.3, cun: 2.2, angle: 0.02, stroke: 1.5, dots: 0.8, far: 0.25, ink: 0.5, aniso: 1.5, dab: 0.8, dabs: 1.1, blotch: 0.8, swid: 1.8, slen: 0.8 },
      items: [
        { outline: [[1466, 620], [1472, 320], [1478, 180], [1488, 120], [1502, 70], [1530, 42], [1560, 52], [1592, 20], [1632, 8], [1672, 28], [1704, 20], [1742, 58], [1772, 108], [1782, 300], [1790, 620]],
          top: [[1478, 180], [1488, 120], [1502, 70], [1530, 42], [1560, 52], [1592, 20], [1632, 8], [1672, 28], [1704, 20], [1742, 58], [1772, 108]], crown: 46, drips: 0.35, rough: 5, fade: [290, 480],
          dark: [{ poly: [[1466, 80], [1506, 60], [1512, 620], [1466, 620]], a: 70 }, { poly: [[1700, 40], [1780, 100], [1786, 400], [1716, 360]], a: 80 }, { poly: [[1602, 96], [1626, 96], [1632, 440], [1608, 440]], a: 120 }, { poly: [[1668, 84], [1700, 84], [1706, 420], [1676, 420]], a: 110 }],
          lit: [{ poly: [[1540, 90], [1600, 80], [1604, 620], [1550, 620]], a: 120 }, { poly: [[1628, 80], [1660, 76], [1666, 620], [1630, 620]], a: 90 }],
          contour: [{ pts: [[1598, 96], [1602, 250], [1608, 430]], w: 2.5 }, { pts: [[1662, 84], [1668, 240], [1676, 420]], w: 2.5 }, { pts: [[1514, 110], [1510, 260], [1514, 400]], w: 2 }] },
      ],
    });
    L.push(frA.layer({ z: 4.05 }));
    const frB = makeRocks(api, {
      rect: [1700, 120, 380, 600], paper: P07, seed: 13,
      look: { tone: 0.36, crown: 1.0, texture: 0.7, speckle: 0.4, cun: 1.8, angle: 0.02, stroke: 1.2, dots: 0.9, far: 0.1, ink: 0.8, aniso: 1.5, dab: 0.85, dabs: 1.1, blotch: 0.8 },
      items: [
        { outline: [[1730, 700], [1736, 400], [1744, 240], [1770, 200], [1820, 184], [1880, 190], [1940, 205], [2000, 222], [2070, 240], [2070, 700]],
          top: [[1744, 240], [1770, 200], [1820, 184], [1880, 190], [1940, 205], [2000, 222], [2070, 240]], crown: 50, drips: 0.3, rough: 5, fade: [520, 700],
          dark: [{ poly: [[1736, 220], [1790, 200], [1796, 700], [1736, 700]], a: 100 }] },
      ],
    });
    L.push(frB.layer({ z: 3.95 }));    const frtRect = [1400, -100, 680, 380];
    const frtRaw = api.bakeCanvas(frtRect[2], frtRect[3], (ctx) => {
      ctx.translate(-frtRect[0], -frtRect[1]);
      const r = api.rng(94);
      paintShrubMass(ctx, [[1484, 150], [1504, 76], [1540, 46], [1600, 22], [1660, 24], [1720, 36], [1770, 104]], r, { count: 26, height: [20, 44], tone: 0.22, paper: P07, spread: 70, density: 1.4 });
      // foliage cascading down the far cliff's left edge and hanging from its face ledges
      paintShrubMass(ctx, [[1500, 96], [1490, 160], [1484, 220], [1480, 262]], r, { count: 14, height: [18, 40], tone: 0.2, paper: P07, spread: 80, density: 1.3 });
      paintShrubMass(ctx, [[1560, 120], [1640, 104], [1700, 120]], r, { count: 10, height: [14, 30], tone: 0.3, paper: P07, spread: 80 });
      paintShrubMass(ctx, [[1690, 210], [1740, 200], [1770, 230]], r, { count: 6, height: [12, 26], tone: 0.3, paper: P07, spread: 80 });
      paintTreeLine(ctx, [[1490, 110], [1510, 62], [1540, 40], [1594, 18], [1640, 8], [1700, 20], [1744, 58]], { height: [26, 54], density: 2.6, tone: 0.26, rows: 2, mix: 0.8, paper: P07, seed: 95 });
      paintTreeLine(ctx, [[1748, 232], [1780, 198], [1840, 184], [1900, 192], [1970, 210], [2060, 238]], { height: [36, 86], density: 2.8, tone: 0.1, rows: 2, mix: 0.75, paper: P07, seed: 96 });
      paintShrubMass(ctx, [[1744, 236], [1800, 192], [1880, 192], [1960, 210], [2060, 238]], r, { count: 22, height: [18, 40], tone: 0.08, paper: P07, spread: 70, density: 1.4 });
    });
    L.push(api.tex(inkify(api, frtRaw, { edge: 0.25, granulation: 0.15, bleed: 1.2 }), { rect: frtRect, z: 4 }));    // pale distant forest in the valley mist
    const pfRect = [1090, 470, 450, 320];
    const pfRaw = api.bakeCanvas(pfRect[2], pfRect[3], (ctx) => {
      ctx.translate(-pfRect[0], -pfRect[1]);
      // soft grey forest mass the trees grow out of (reads as distant woods, not single icons)
      ctx.save(); ctx.filter = 'blur(16px)'; ctx.fillStyle = rgba(tone(0.7, P07), 0.55);
      ctx.beginPath(); ctx.moveTo(1120, 760); ctx.lineTo(1150, 690); ctx.lineTo(1240, 650); ctx.lineTo(1330, 655); ctx.lineTo(1420, 690); ctx.lineTo(1510, 730); ctx.lineTo(1520, 790); ctx.closePath(); ctx.fill(); ctx.restore();
      paintTreeLine(ctx, [[1130, 690], [1200, 650], [1280, 640], [1360, 660], [1430, 690], [1500, 720]], { height: [46, 100], density: 3.0, tone: 0.62, toneJitter: 0.12, rows: 3, clump: 0.55, mix: 0.95, spruce: 0.45, paper: P07, seed: 91 });
      paintTreeLine(ctx, [[1150, 740], [1260, 720], [1380, 735], [1490, 760]], { height: [40, 80], density: 2.6, tone: 0.66, toneJitter: 0.1, rows: 2, clump: 0.5, mix: 0.95, spruce: 0.4, paper: P07, seed: 92 });
    });
    L.push(api.tex(inkify(api, pfRaw, { edge: 0.15, granulation: 0.15, bleed: 2.2 }), { rect: pfRect, z: 4.5, opacity: 0.75 }));
    L.push(makeMist(api, { top: 715, bottom: 830, z: 4.2, lobe: 60, seed: 17, drift: 9, color: P07, density: 0.62, holes: 0.3, shade: 0.4, extent: [1080, 1560, 120] }));

    // ---- left-centre cliff + forested ridge sloping to the river
    const lc = makePeaks(api, {
      paper: P07,
      peaks: [
        { x: 560, top: 312, base: 800, tone: 0.2, face: 0.36, treeTone: 0.1, seed: 79, fade: 0.66, treeSize: 1.2, columns: [
          { dx: -95, top: 362, hw: 58, lit: 0.4 }, { dx: -30, top: 312, hw: 72, lit: 0.5 }, { dx: 40, top: 356, hw: 64, lit: 0.6 }, { dx: 100, top: 428, hw: 60, lit: 0.6 }, { dx: 158, top: 500, hw: 56, lit: 0.5 }] },
      ],
    });
    L.push(lc.layer({ z: 3.2 }));
    const ridgeRect = [640, 450, 640, 480];
    const ridgeRaw = api.bakeCanvas(ridgeRect[2], ridgeRect[3], (ctx) => {
      ctx.translate(-ridgeRect[0], -ridgeRect[1]);
      const ridge = [[700, 545], [760, 580], [830, 620], [900, 660], [970, 700], [1040, 735], [1100, 765], [1160, 790]];
      // forested slope below the crest: grey wash fading downhill into the river mist
      ctx.save(); ctx.filter = 'blur(14px)';
      const sg = ctx.createLinearGradient(0, 560, 0, 860);
      sg.addColorStop(0, rgba(tone(0.3, P07), 0.9)); sg.addColorStop(0.45, rgba(tone(0.5, P07), 0.6)); sg.addColorStop(1, rgba(tone(0.75, P07), 0));
      ctx.fillStyle = sg; ctx.beginPath(); ridge.forEach(([x, y], i) => (i ? ctx.lineTo(x, y + 10) : ctx.moveTo(x, y + 10)));
      ctx.lineTo(1150, 860); ctx.lineTo(700, 860); ctx.closePath(); ctx.fill(); ctx.restore();
      // the crest: dark near the left cliff, greying and shrinking downhill
      paintTreeLine(ctx, ridge.slice(0, 4), { height: [42, 84], density: 4.2, tone: 0.1, toneJitter: 0.06, rows: 3, clump: 0.5, mix: 0.85, spruce: 0.35, paper: P07, seed: 21 });
      paintTreeLine(ctx, ridge.slice(3), { height: [28, 54], density: 4.4, tone: 0.2, toneJitter: 0.08, rows: 3, clump: 0.5, mix: 0.9, spruce: 0.35, paper: P07, seed: 25 });
      for (let k = 1; k <= 3; k++) {
        const off = ridge.map(([x, y]) => [x - 10 + k * 8, y + k * 22]);
        paintTreeLine(ctx, off, { height: [26 - k * 3, 50 - k * 6], density: 3.4, tone: 0.26 + k * 0.1, toneJitter: 0.08, rows: 2, clump: 0.5, mix: 0.9, spruce: 0.4, paper: P07, seed: 21 + k, from: 0.04 * k, to: 1 - 0.1 * k });
      }
    });
    L.push(api.tex(inkify(api, ridgeRaw, { edge: 0.35, granulation: 0.2, bleed: 0.9 }), { rect: ridgeRect, z: 3.1 }));
    L.push(makeMist(api, { top: 768, bottom: 900, z: 3, lobe: 70, seed: 14, drift: 11, color: P07, density: 0.58, holes: 0.35, shade: 0.4, extent: [820, 1500, 140] }));

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
      rect: [1400, 400, 640, 520], paper: P07, seed: 5, look: { tone: 0.34, crown: 1.0, texture: 1.0, speckle: 0.5, cun: 1.6, angle: 0.03, stroke: 1.25, dots: 0.7, dry: 0.9, aniso: 1.6, dab: 1.2, dabs: 1.25, blotch: 0.85, core: 0.6, swid: 1.6, slen: 0.8, ink: 0.7 },
      items: [
        { outline: [[1438, 480], [1452, 458], [1490, 452], [1540, 448], [1600, 446], [1660, 447], [1700, 455], [1740, 478], [1780, 520], [1796, 546], [1700, 560], [1690, 700], [1694, 840], [1452, 860], [1440, 740], [1447, 662], [1433, 600], [1445, 540]],
          fade: [690, 830], top: [[1438, 480], [1452, 458], [1490, 452], [1530, 450]], crown: 26, drips: 0.05, rough: 4,
          dark: [{ poly: [[1440, 470], [1540, 460], [1530, 560], [1450, 600]], a: 70 }, { poly: [[1430, 470], [1478, 470], [1484, 780], [1436, 780]], a: 80 }, { poly: [[1598, 520], [1632, 520], [1642, 820], [1608, 820]], a: 90 }, { poly: [[1640, 520], [1700, 520], [1696, 800], [1650, 800]], a: 90 }, { poly: [[1530, 470], [1700, 476], [1696, 566], [1536, 548]], a: 80 }],
          lit: [{ poly: [[1486, 540], [1584, 520], [1592, 860], [1494, 860]], a: 120 }, { poly: [[1540, 470], [1700, 470], [1760, 530], [1560, 520]], a: 160 }],
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
      // terrace the gate stands on: shadow under its front lip, a broken edge of small dark rocks
      // and shrubs, low stone walls beside the gate and a path sloping down-right past the maple
      ctx.save(); ctx.filter = 'blur(5px)'; ctx.fillStyle = rgba(tone(0.3, P07), 0.55);
      ctx.beginPath(); ctx.moveTo(1520, 462); ctx.lineTo(1700, 468); ctx.lineTo(1745, 500); ctx.lineTo(1770, 540); ctx.lineTo(1740, 560); ctx.lineTo(1700, 512); ctx.lineTo(1600, 506); ctx.lineTo(1520, 500); ctx.closePath(); ctx.fill(); ctx.restore();
      const edge = [[1518, 462], [1580, 466], [1640, 468], [1700, 472], [1736, 496], [1764, 530]];
      for (let i = 0; i < 46; i++) {
        const s = r() * (edge.length - 1), k = Math.min(edge.length - 2, s | 0), f = s - k;
        const x = edge[k][0] + (edge[k + 1][0] - edge[k][0]) * f, y = edge[k][1] + (edge[k + 1][1] - edge[k][1]) * f + r.range(-2, 6);
        const rx = r.range(4, 11), ry = rx * r.range(0.45, 0.7);
        ctx.fillStyle = rgba(tone(r.range(0.04, 0.3), P07), r.range(0.7, 0.95));
        ctx.beginPath(); ctx.ellipse(x, y, rx, ry, r.range(-0.3, 0.3), 0, Math.PI * 2); ctx.fill();
        if (r.chance(0.5)) { ctx.fillStyle = rgba(tone(0.62, P07), 0.6); ctx.beginPath(); ctx.ellipse(x - rx * 0.2, y - ry * 0.45, rx * 0.55, ry * 0.35, 0, 0, Math.PI * 2); ctx.fill(); }
      }
      paintShrubMass(ctx, edge, r, { count: 14, height: [10, 24], tone: 0.06, paper: P07, spread: 75 });
      ctx.strokeStyle = rgba(tone(0.22, P07), 0.85); ctx.lineCap = 'round';
      for (const [x0, x1] of [[1508, 1546], [1678, 1712]]) {
        ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x0, 444); ctx.lineTo(x1, 445); ctx.stroke();
        ctx.lineWidth = 1.6; for (let x = x0; x <= x1; x += 9) { ctx.beginPath(); ctx.moveTo(x, 444); ctx.lineTo(x, 434); ctx.stroke(); }
        ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x0, 435); ctx.lineTo(x1, 435); ctx.stroke();
      }
      ctx.strokeStyle = rgba(tone(0.5, P07), 0.55); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(1690, 452); ctx.quadraticCurveTo(1722, 470, 1746, 512); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(1706, 448); ctx.quadraticCurveTo(1740, 468, 1764, 506); ctx.stroke();
      for (let i = 0; i < 18; i++) paintMapleDab(ctx, 1770 + r.range(-25, 25), 585 + r.range(-18, 18), r.range(3, 7), { color: [178, 70, 52], alpha: r.range(0.5, 0.85), rng: r, rot: r() * 6 });
      // red maple behind the gate's right side
      ctx.strokeStyle = rgba(tone(0.08, P07), 0.9); ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      for (const seg of [[[1730, 472], [1733, 446], [1728, 420]], [[1732, 448], [1752, 426], [1762, 414]], [[1729, 432], [1710, 414], [1702, 400]], [[1731, 440], [1758, 440]]]) { ctx.lineWidth = seg === undefined ? 1 : (seg[0][1] > 460 ? 3 : 1.6); ctx.beginPath(); seg.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); }
      for (let i = 0; i < 150; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 1;
        const x = 1732 + Math.cos(a) * d * 46, y = 414 + Math.sin(a) * d * 36;
        paintMapleDab(ctx, x, y, r.range(2.5, 6), { color: r.chance(0.3) ? [140, 52, 40] : [176, 78, 60], alpha: r.range(0.5, 0.85), rng: r, rot: r() * 6 });
      }
    });
    L.push(api.tex(inkify(api, ctRaw, { edge: 0.3, granulation: 0.18, bleed: 0.8 }), { rect: ctRect, z: 2.3 }));
    const gate = makeArch(api, 'gate', { x: 1611, y: 445, w: 136, seed: 7, paper: P07 });
    L.push(api.tex(gate.src, { rect: gate.rect, z: 2.3 }));

    // conifers in front of the cliff, left of it
    const cfRect = [1240, 480, 280, 380];
    const cfRaw = api.bakeCanvas(cfRect[2], cfRect[3], (ctx) => {
      ctx.translate(-cfRect[0], -cfRect[1]);
      const r = api.rng(41);
      const T = [[1395, 800, 215], [1360, 806, 170], [1430, 812, 170], [1335, 822, 130], [1300, 812, 95], [1272, 826, 70], [1455, 826, 120], [1412, 832, 90]];
      for (const [x, y, h] of T) paintConifer(ctx, x, y, h, { kind: h > 110 ? 'spruce' : 'fir', tiers: Math.round(h / 12), width: h > 110 ? 0.95 : 1, tone: 0.1 + (h > 180 ? 0.06 : 0), paper: P07, seed: r.int(1, 1e6) });
    });
    L.push(api.tex(inkify(api, cfRaw, { edge: 0.35, granulation: 0.2, bleed: 0.9 }), { rect: cfRect, z: 2.15 }));
    L.push(makeMist(api, { top: 770, bottom: 960, z: 2.1, lobe: 70, seed: 15, drift: 12, color: P07, density: 1, shade: 0.4, extent: [1300, 2000, 90] }));

    // ---- islands and shore rocks in the river (with reflections)
    const isl = makeRocks(api, {
      rect: [630, 760, 900, 220], paper: P07, seed: 9, look: { tone: 0.42, crown: 0.9, texture: 0.9, speckle: 0.6, cun: 0.8, angle: 1.2, stroke: 0.5, dots: 0.6, dab: 0.7 },
      items: [
        // one long low spit (ref: flat island with shrubs, dark stones at the waterline) + small stones
        { outline: [[650, 908], [664, 893], [700, 884], [760, 879], [830, 876], [900, 878], [960, 884], [1010, 893], [1046, 902], [1060, 910]], top: [[650, 908], [664, 893], [700, 884], [760, 879], [830, 876], [900, 878], [960, 884], [1010, 893], [1046, 902]], crown: 12, rough: 2 },
        { outline: [[704, 912], [716, 900], [738, 897], [752, 912]], top: [[704, 912], [716, 900], [738, 897]], crown: 8, rough: 1.5 },
        { outline: [[1066, 913], [1080, 904], [1104, 902], [1116, 913]], top: [[1066, 913], [1080, 904], [1104, 902]], crown: 8, rough: 1.5 },
        { outline: [[1136, 906], [1160, 882], [1206, 868], [1258, 868], [1284, 882], [1292, 906]], top: [[1136, 906], [1160, 882], [1206, 868], [1258, 868], [1284, 882]], crown: 16, rough: 3 },
        { outline: [[1270, 908], [1296, 890], [1334, 882], [1360, 894], [1372, 908]], top: [[1270, 908], [1296, 890], [1334, 882], [1360, 894]], crown: 12, rough: 2 },
        { outline: [[1384, 952], [1408, 932], [1450, 926], [1490, 936], [1504, 954]], top: [[1384, 952], [1408, 932], [1450, 926], [1490, 936], [1504, 954]], crown: 14, rough: 3 },
      ],
    });
    const isTrees = api.bakeCanvas(900, 260, (ctx) => {
      ctx.translate(-630, -720);
      const r = api.rng(51);
      paintTreeLine(ctx, [[1180, 870], [1230, 862], [1290, 868]], { height: [60, 100], density: 3.2, tone: 0.06, rows: 2, paper: P07, seed: 52 });
      paintTreeLine(ctx, [[690, 888], [780, 880], [890, 880]], { height: [20, 40], density: 2.6, tone: 0.16, toneJitter: 0.08, rows: 2, paper: P07, seed: 53 });
      paintShrubMass(ctx, [[680, 892], [860, 882], [1040, 900]], r, { count: 22, height: [8, 20], tone: 0.1, paper: P07, spread: 75 });
      paintShrubMass(ctx, [[1150, 890], [1330, 876]], r, { count: 10, height: [12, 24], tone: 0.05, paper: P07, spread: 70 });
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
      paintShrubMass(ctx, [[0, 830], [100, 790], [200, 760], [300, 742], [400, 744]], r, { count: 30, height: [50, 110], tone: 0.06, paper: P07, spread: 75, density: 1.6 });
    });
    L.push(api.tex(inkify(api, bgSh, { edge: 0.1, granulation: 0.1, bleed: 0.5 }), { rect: bgShRect, z: 1.0 }));
    const near = makeRocks(api, {
      rect: [-140, 680, 1320, 480], paper: P07, seed: 6, look: { tone: 0.22, crown: 0.85, texture: 1.4, speckle: 0.22, cun: 1.4, angle: 0.12, stroke: 1.0, dots: 0.25, aniso: 1.2, blotch: 1.3, dab: 2.2, dabs: 1.3, core: 0.75 },
      items: [
        { outline: [[200, 806], [218, 768], [252, 742], [300, 722], [352, 712], [398, 716], [440, 730], [474, 754], [498, 786], [512, 830], [522, 900], [528, 1000], [530, 1160], [176, 1160], [174, 960], [184, 880]],
          top: [[200, 806], [218, 768], [252, 742], [300, 722], [352, 712], [398, 716], [440, 730], [474, 754], [498, 786]], crown: 44, drips: 0.25, rough: 6,
          dark: [{ poly: [[196, 750], [420, 716], [400, 1000], [190, 1060]], a: 170 }],
          lit: [{ poly: [[456, 790], [505, 810], [512, 1160], [446, 1160], [440, 900]], a: 160 }, { poly: [[250, 1000], [380, 980], [390, 1160], [240, 1160]], a: 80 }],
          contour: [{ pts: [[492, 778], [505, 820], [515, 900], [526, 1000], [534, 1100]], w: 5 }, { pts: [[440, 790], [438, 900], [444, 1060]], w: 3 }] },
        { outline: [[598, 1030], [626, 1004], [668, 990], [714, 986], [758, 996], [792, 1016], [806, 1060], [810, 1160], [598, 1160]],
          top: [[598, 1030], [626, 1004], [668, 990], [714, 986], [758, 996], [792, 1016]], crown: 40, drips: 0.3, rough: 5,
          dark: [{ poly: [[600, 980], [720, 976], [700, 1100], [600, 1100]], a: 110 }] },
        // one low dark mound along the bottom (ref: low rocks under shrubs, not a row of loaves)
        { outline: [[770, 1044], [806, 1018], [856, 1004], [912, 998], [970, 1004], [1030, 1010], [1090, 1014], [1130, 1030], [1150, 1060], [1156, 1160], [770, 1160]],
          top: [[770, 1044], [806, 1018], [856, 1004], [912, 998], [970, 1004], [1030, 1010], [1090, 1014], [1130, 1030]], crown: 38, drips: 0.3, rough: 9,
          dark: [{ poly: [[780, 1000], [1000, 994], [990, 1100], [780, 1100]], a: 90 }],
          lit: [{ poly: [[1040, 1024], [1150, 1044], [1156, 1160], [1050, 1160]], a: 80 }] },
      ],
    });
    const lrock = makeRocks(api, {
      rect: [-140, 800, 400, 360], paper: P07, seed: 8, look: { tone: 0.62, crown: 0.4, texture: 0.5, speckle: 0.6, ink: 0.5, cun: 2.6, angle: -0.75, stroke: 1.8, slen: 0.45, swid: 2.0, dots: 1.2, dry: 0.75, dabs: 0.45, jitter: 0.45, aniso: 1.6 },
      items: [{ outline: [[-140, 940], [-60, 905], [0, 880], [60, 860], [130, 850], [180, 862], [214, 890], [232, 932], [240, 1160], [-140, 1160]],
        top: [[-140, 940], [-60, 905], [0, 880], [60, 860], [130, 850], [180, 862], [214, 890]], crown: 26, drips: 0.15, rough: 4,
        lit: [{ poly: [[-60, 900], [150, 900], [200, 1010], [210, 1160], [-60, 1160]], a: 60 }],
        contour: [{ pts: [[170, 866], [214, 896], [232, 940], [238, 1060]], w: 3 }] }],
    });
    L.push(near.layer({ z: 1.0 }));
    L.push(lrock.layer({ z: 1.0 }));
    const shRect = [440, 660, 760, 480];
    const shRaw = api.bakeCanvas(shRect[2], shRect[3], (ctx) => {
      ctx.translate(-shRect[0], -shRect[1]);
      const r = api.rng(71);
      paintShrubMass(ctx, [[505, 1090], [560, 1040], [620, 1000], [700, 990]], r, { count: 9, height: [80, 170], tone: 0.02, paper: P07, spread: 50, lean: 10, density: 1.1 });
      paintShrubMass(ctx, [[500, 900], [540, 870]], r, { count: 4, height: [50, 90], tone: 0.06, paper: P07, spread: 60, lean: 20 });
      paintShrubMass(ctx, [[640, 1004], [760, 994], [900, 1000], [1060, 1012], [1130, 1032]], r, { count: 22, height: [26, 64], tone: 0.05, paper: P07, density: 1.3 });
      for (const [x, y, h] of [[820, 1012, 62], [880, 1002, 52], [950, 1004, 58], [1010, 1012, 44]]) paintConifer(ctx, x, y, h, { kind: 'pine', tone: 0.06, paper: P07, seed: x });
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
