// s03 - Moon over the lake (ref 03).
// Night: grey-washed sky with dark cloud bands, full moon with maria and halo, hero pine and red
// pavilion on the left cliff, red maples, centre and right granite peaks in mist, wooded islands,
// a lake with a long moon-glitter column and soft island reflections.
// Camera: slow push toward the moon (dolly + drift up-right). Composition = reference at t = 3.
import { makeMist, makeWaterFog } from '../lib/atmos.js';
import { makeMoon03 } from './s03/moon.js';
import { makeNightSky, makeNightClouds } from './s03/sky.js';
import { makePine, paintConifer } from '../lib/pine.js';
import { paintMoss } from '../lib/rock.js';
import { makeLake, makeGlitter, makeReflection } from '../lib/water.js';
import { bakeArch, paintPavilion } from '../lib/architecture.js';
import { makeMaple } from '../lib/flora.js';
import { makeDomes } from './s03/domes.js';
import { paintFoliageBand, paintCanopy } from './s03/foliage.js';
import { paintCrag } from './s03/crag.js';
import { wetInk } from '../lib/peaks.js';

const PAPER = [237, 228, 215];
const T0 = 3;                       // camera at rest (reference composition)
const MOON = [1338, 198], MOON_R = 78;
const LAKE_Y = 655;

export const FACTS = {
  camera: { T0, pan: [7, -3.5], dolly: 0.0045 },
  moon: MOON, moonR: MOON_R,        // sky (does not move with the camera)
  glitter: [1330, 740],             // head of the moon-glitter column on the lake (z 2.4)
  pavilion: [320, 410],             // z 1.2
  lakeY: LAKE_Y,
  bloomSeeds: [[120, 300], [300, 700]],
};

const cam = (t) => ({ x: 7 * (t - T0), y: -3.5 * (t - T0), dolly: 0.0045 * (t - T0), zoom: 1, roll: 0 });

export default {
  id: 's03', title: 'Moon over the lake', ref: '03',
  build(api) {
    const layers = [];
    // ---------------------------------------------------------------- sky, clouds, moon
    layers.push(makeNightSky(api, { paper: PAPER, moon: [...MOON, MOON_R] }));
    layers.push(makeMoon03(api, { x: MOON[0], y: MOON[1], r: MOON_R }));
    layers.push(makeNightClouds(api, { paper: PAPER, moon: [...MOON, MOON_R] }));

    // ---------------------------------------------------------------- far ranges
    // (the old far-right distant mass read as a pale ghost wall above the domes: removed, the clouds carry it)

    // far ranges: soft layered grey washes (no paper fill, no creases), behind the pavilion and the peaks
    const FR = [200, 250, 1300, 290];
    const farSrc = api.bakeCanvas(FR[2], FR[3], (ctx) => {
      ctx.translate(-FR[0], -FR[1]);
      const nz = api.noise(81);
      const range = (pts, base, a, j) => {
        const x0 = pts[0][0], x1 = pts[pts.length - 1][0];
        const yAt = (x) => { for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i]; const s = (x - ax) / (bx - ax); return ay + (by - ay) * s * s * (3 - 2 * s); } return pts[pts.length - 1][1]; };
        const p = new Path2D(); p.moveTo(x0, base);
        for (let x = x0; x <= x1; x += 3) p.lineTo(x, yAt(x) + 5 * nz.fbm2(x / 45, j * 3.1, 3) + 1.5 * nz.n2(x / 8, j));
        p.lineTo(x1, base); p.closePath();
        const top = Math.min(...pts.map((q) => q[1]));
        const gr = ctx.createLinearGradient(0, top, 0, base);
        gr.addColorStop(0, `rgba(66,62,58,${a})`); gr.addColorStop(0.45, `rgba(66,62,58,${a * 0.6})`); gr.addColorStop(1, 'rgba(66,62,58,0)');
        ctx.save(); ctx.filter = 'blur(1.6px)'; ctx.fillStyle = gr; ctx.fill(p);
        ctx.filter = 'blur(2.5px)'; ctx.strokeStyle = `rgba(66,62,58,${a * 0.35})`; ctx.lineWidth = 3; ctx.stroke(p); ctx.restore();
      };
      range([[230, 430], [290, 372], [350, 322], [395, 306], [440, 316], [500, 345], [560, 380], [620, 420]], 470, 0.2, 1);
      range([[470, 420], [520, 368], [575, 331], [620, 352], [662, 375], [700, 400]], 480, 0.26, 2);
      range([[820, 452], [875, 402], [930, 384], [956, 373], [985, 392], [1025, 412], [1070, 442]], 500, 0.24, 6);
      range([[1000, 482], [1040, 456], [1062, 437], [1090, 452], [1112, 460], [1150, 426], [1200, 438], [1262, 413], [1320, 440], [1400, 482]], 525, 0.22, 3);
      range([[1010, 492], [1040, 470], [1064, 448], [1095, 468], [1130, 482]], 525, 0.32, 4);
      range([[1180, 500], [1240, 458], [1290, 446], [1340, 452], [1400, 470], [1470, 500]], 530, 0.26, 5);
    });
    const far = { layer: (lo) => api.tex(farSrc, { rect: FR, ...lo }) };
    layers.push(far.layer({ z: 10, name: 'far' }));
    layers.push(makeMist(api, { top: 470, bottom: 610, z: 9, lobe: 70, seed: 1, drift: 6, density: 0.45, holes: 0.4, softness: 5, shade: 0.06, wispsAbove: 0, color: PAPER }));

    // ---------------------------------------------------------------- centre and right peaks
    // right peaks: two rounded granite domes with a dark cleft (B behind, A in front), a smaller dome left,
    // a lower dark peak at the right edge; all dissolving into the mist by y ~520
    // each dome carries nested slabs (lit inner tongues outlined by creases, shoulders on the flanks)
    const right = makeDomes(api, { rect: [1320, 110, 760, 540], paper: PAPER, defaults: { shadow: -1, trees: 0.35, treeH: 13, t: 0.55, capH: 42, p: 1, body: 1.5, crown: 1.8, mottle: 0.5, lit: 0.4, dots: 2.6, cun: 2.6, shadeK: 0.3, rough: 1.7 }, wet: { mottle: 0.25, bleed: 0.18 }, domes: [
      { cx: 1925, top: 222, wl: 95, wr: 140, base: 620, tone: 0.84, t: 0.45, capH: 70, fade: [400, 520], seed: 26,
        slabs: [{ dx: -20, top: 262, wl: 50, wr: 60, t: 0.55, capH: 50 }] },
      { cx: 1940, top: 425, wl: 90, wr: 130, base: 650, tone: 0.9, capH: 60, fade: [540, 640], seed: 24 },
      { cx: 1482, top: 356, wl: 100, wr: 116, base: 620, tone: 0.8, t: 0.3, capH: 60, fade: [445, 535], seed: 23,
        slabs: [{ dx: -28, top: 392, wl: 52, wr: 44, t: 0.45, capH: 40 }, { dx: 40, top: 405, wl: 40, wr: 50, t: 0.5, capH: 30 }] },
      { cx: 1656, top: 221, wl: 128, wr: 150, base: 620, tone: 0.86, t: 0.33, capH: 100, fade: [430, 530], seed: 25, shadow: 1,
        slabs: [{ dx: -62, top: 288, wl: 72, wr: 52, t: 0.42, capH: 46, shadow: -1 }, { dx: 30, top: 262, wl: 44, wr: 52, t: 0.55, capH: 50 }, { dx: -20, top: 345, wl: 50, wr: 40, t: 0.6, capH: 40, shadow: -1 }] },
      { cx: 1786, top: 175, wl: 103, wr: 95, base: 620, tone: 0.92, t: 0.5, capH: 110, fade: [420, 525], seed: 22,
        slabs: [{ dx: 6, top: 230, wl: 42, wr: 44, t: 0.66, capH: 64, shadow: 1 }, { dx: 52, top: 262, wl: 34, wr: 40, t: 0.6, capH: 40 }, { dx: -48, top: 300, wl: 40, wr: 30, t: 0.6, capH: 40 }] },
    ] });
    layers.push(right.layer({ z: 5, name: 'right-peaks' }));
    // centre massif: one pointed summit, a left shoulder, secondaries S1/S2 attached down the right ridge
    const centre = makeDomes(api, { rect: [500, 260, 580, 340], paper: PAPER, defaults: { shadow: -1, trees: 0.4, treeH: 11, p: 1, body: 1.4, crown: 1.6, mottle: 0.5, lit: 0.4, dots: 2.4, cun: 2.4, shadeK: 0.3, rough: 1.5 }, wet: { mottle: 0.25, bleed: 0.18 }, domes: [
      { cx: 725, top: 302, wl: 160, wr: 140, a: 1.5, b: 0.75, base: 600, tone: 0.82, fade: [455, 565], seed: 33,
        slabs: [{ dx: -25, top: 334, wl: 70, wr: 60, a: 1.6, b: 0.7 }, { dx: -128, top: 404, wl: 90, wr: 80, a: 2.2, b: 0.45 },
          { dx: 50, top: 372, wl: 45, wr: 45, a: 1.6, b: 0.7 }, { dx: 162, top: 396, wl: 75, wr: 75, a: 1.6, b: 0.7, shadow: 1 }, { dx: 250, top: 468, wl: 52, wr: 52, a: 1.6, b: 0.7 }] },
    ] });
    layers.push(centre.layer({ z: 5.5, name: 'centre-peaks' }));
    layers.push(makeMist(api, { top: 520, bottom: 680, z: 4.5, lobe: 70, seed: 2, drift: 8, density: 0.6, holes: 0.3, softness: 5, shade: 0.06, wispsAbove: 0, color: PAPER }));

    // wooded hills in the mist (behind the near islands)
    const HR = [640, 420, 1000, 260];
    const hillRaw = api.bakeCanvas(HR[2], HR[3], (ctx, { k }) => {
      ctx.translate(-HR[0], -HR[1]);
      const r = api.rng(61), nz = api.noise(62);
      const forest = (x0, x1, topF, n, h, tn) => { for (let i = 0; i < n; i++) { const x = x0 + (x1 - x0) * (i + r()) / n; paintConifer(ctx, x, topF(x) + h * 0.25, h * r.range(0.6, 1.2), { kind: r() < 0.7 ? 'fir' : 'pine', tone: tn + r.range(0, 0.1), paper: PAPER, seed: (r() * 1e6) | 0, detail: 0 }); } };
      const pale = paintCrag(ctx, r, nz, { profile: [[690, 640], [720, 600], [760, 584], [820, 578], [880, 586], [940, 600], [990, 640]], base: 650, fade: [585, 640], tone: 0.48, paper: PAPER, k, dabs: 0.6, speckle: 0.5, body: 0.45 });
      // soft grey tree clumps in the mist (a regular row of firs read as a comb), a few firs among them
      ctx.save(); ctx.filter = `blur(${(1.3 * k).toFixed(1)}px)`;
      for (let x = 708; x < 982; x += r.range(11, 20)) paintCanopy(ctx, r, x, pale.top(x) + r.range(4, 12), r.range(9, 18), { v: 0.4 + r.range(0, 0.14), paper: PAPER });
      ctx.restore();
      forest(730, 950, pale.top, 6, 30, 0.42);
      const hill = paintCrag(ctx, r, nz, { profile: [[1263, 662], [1298, 612], [1343, 590], [1378, 568], [1412, 546], [1447, 534], [1493, 544], [1528, 576], [1550, 620], [1565, 662]], base: 668, fade: [610, 666], tone: 0.75, paper: PAPER, k, dabs: 0.7, body: 0.9, speckle: 0.25, cun: 1.2 });
      forest(1270, 1560, hill.top, 26, 40, 0.26);
      const islet = paintCrag(ctx, r, nz, { profile: [[1240, 662], [1262, 640], [1300, 632], [1330, 644], [1350, 662]], base: 666, fade: [645, 664], tone: 0.7, paper: PAPER, k, body: 0.6 });
      forest(1250, 1345, islet.top, 6, 34, 0.15);
    });
    const hillSrc = wetInk(api, hillRaw, { paper: PAPER, ink: [12, 11, 10], soft: 1.1, blur: 0.15, bleed: 0.15, edge: 0.4, granulation: 0.3, mottle: 0.35, seed: 5 });
    layers.push(api.tex(hillSrc, { rect: HR, z: 3.6, name: 'hills' }));
    layers.push(makeMist(api, { top: 640, bottom: 710, z: 3.2, lobe: 40, seed: 3, drift: 9, density: 0.45, holes: 0.3, softness: 14, shade: 0.05, color: PAPER }));

    // ---------------------------------------------------------------- lake, islands, reflections
    const LZ = 2.4;
    layers.push(makeLake(api, { y: LAKE_Y, variant: 'night', paper: PAPER, z: LZ, density: [0.3, 0.42, 0.54, 0.34], fog: [90, 0.75, 0, 0], persp: 1.1, grain: 0.015, blotch: 0.08, crackle: 0.02, bands: 0.015, mottle: 0.04 }));
    layers.push(makeWaterFog(api, { top: 650, z: LZ, seed: 4, color: PAPER, density: 0.5 }));
    const island = (rect, draw, refl) => {
      const raw = api.bakeCanvas(rect[2], rect[3], (ctx, { k }) => { ctx.translate(-rect[0], -rect[1]); draw(ctx, k); });
      const src = wetInk(api, raw, { paper: PAPER, ink: [12, 11, 10], soft: 1.0, blur: 0.1, bleed: 0.15, edge: 0.45, granulation: 0.3, mottle: 0.35, seed: rect[0] % 7 });
      return [makeReflection(api, src, { rect, y: rect[1] + rect[3] - 6, z: LZ, paper: PAPER, ...refl }), api.tex(src, { rect, z: LZ })];
    };
    const islandDraw = (seed, rocks) => (ctx, k) => {
      const r = api.rng(seed), nz = api.noise(seed + 1);
      for (const R of rocks) {
        const c = paintCrag(ctx, r, nz, { paper: PAPER, k, tone: 0.92, dabs: 1.0, body: 0.95, speckle: 0.3, cun: 1.4, ...R, fade: [R.fade[0] + 14, R.fade[1] + 4] });
        for (let x = R.profile[0][0] + 8; x < R.profile[R.profile.length - 1][0] - 8; x += r.range(7, 14)) if (r() < 0.5) paintMoss(ctx, x, c.top(x) + r.range(3, 14), r.range(5, 12), r, { color: [14, 13, 12], greys: 0.8, separation: 0 });
        for (const [x0, x1, n, h] of R.trees || []) for (let i = 0; i < n; i++) {
          const x = x0 + (x1 - x0) * (i + r()) / n;
          paintConifer(ctx, x, c.top(x) + h * 0.2, h * r.range(0.55, 1.15), { kind: r() < 0.65 ? 'fir' : 'pine', tone: 0.03 + r.range(0, 0.06), paper: PAPER, seed: (r() * 1e6) | 0 });
        }
      }
    };
    // left island (waterline 733)
    layers.push(...island([860, 590, 430, 150], islandDraw(71, [
      { profile: [[900, 733], [925, 716], [955, 696], [990, 680], [1030, 670], [1070, 676], [1100, 694], [1130, 716], [1155, 733]], base: 740, fade: [716, 740], trees: [[975, 1100, 9, 52]],
        fissures: [{ pts: [[1060, 674], [1066, 704], [1070, 732]], w: 26, a: 0.6 }, { pts: [[990, 682], [994, 710], [996, 732]], w: 22, a: 0.5 }] },
      { profile: [[1130, 733], [1150, 716], [1180, 708], [1205, 712], [1230, 722], [1252, 733]], base: 740, fade: [718, 740], trees: [[1150, 1215, 4, 34]] },
    ]), { strength: 0.9, amp: 2, fade: 175, stretch: 2.0, breakup: 0.15, smear: 10, hblur: 2, tint: [0.8, 0.79, 0.78] }));
    // right island (waterline 729)
    layers.push(...island([1490, 560, 410, 175], islandDraw(73, [
      { profile: [[1516, 729], [1540, 716], [1580, 700], [1610, 690], [1650, 700], [1680, 712], [1710, 729]], base: 736, fade: [706, 734], trees: [[1530, 1600, 4, 40]] },
      { profile: [[1570, 729], [1600, 682], [1630, 656], [1660, 646], [1700, 650], [1740, 674], [1762, 702], [1790, 729]], base: 736, fade: [706, 736], trees: [[1610, 1745, 10, 92]],
        fissures: [{ pts: [[1720, 668], [1730, 700], [1735, 728]], w: 30, a: 0.6 }, { pts: [[1640, 656], [1644, 690], [1648, 726]], w: 24, a: 0.4 }] },
      { profile: [[1740, 729], [1760, 712], [1800, 704], [1840, 712], [1866, 729]], base: 736, fade: [712, 734], trees: [[1770, 1845, 4, 40]] },
    ]), { strength: 0.9, amp: 2, fade: 175, stretch: 2.0, breakup: 0.15, smear: 10, hblur: 2, tint: [0.8, 0.79, 0.78] }));
    layers.push(makeReflection(api, hillSrc, { rect: HR, y: 664, z: LZ + 0.01, paper: PAPER, strength: 0.6, amp: 2, fade: 200, stretch: 1.4, breakup: 0.15, smear: 10, hblur: 2, tint: [0.8, 0.79, 0.78], name: 'hills-refl' }));
    const glit = makeGlitter(api, {
      y: LAKE_Y, variant: 'night', paper: PAPER, z: LZ,
      glitter: { kind: 'moon', x: 1336, x1: 1330, w0: 30, w1: 60, ext0: 55, ext1: 125, row: 6, intensity: 0.92, gaps: 0.3, glowW: 220, glowH: 18, glow: 0.85, fadeNear: 80 },
      occluders: [[900, 1252, 733, 8], [1516, 1866, 729, 8]],
    });
    // the moon is at infinity: keep its glitter column under it on screen while the camera moves
    const g0 = glit.uniforms.uG0.slice();
    const under = (x, t) => { const c = cam(t); return 960 + ((x - 960) * (LZ - c.dolly) + c.x) / LZ; };
    glit.uniforms.uG0 = (t) => [under(g0[0], t), under(g0[1], t), g0[2], g0[3]];
    layers.push(glit);

    // ---------------------------------------------------------------- left cliff group
    // one wet-ink card, back to front: ridge knolls descending right, the sheer pavilion cliff, the
    // lower-left slope, the small front rock; each followed by the foliage crowning it.
    const CR = [-220, 300, 1270, 880];
    const cragRaw = api.bakeCanvas(CR[2], CR[3], (ctx, { k }) => {
      ctx.translate(-CR[0], -CR[1]);
      const r = api.rng(51), nz = api.noise(52);
      const crag = (o) => paintCrag(ctx, r, nz, { paper: PAPER, k, axe: 1, cunBlur: 1, dabA: 0.3, body: 0.4, ...o });
      // foliage: smaller, more numerous, slightly greyer clumps (big black blobs read as broccoli)
      const band = (pts, o) => paintFoliageBand(ctx, r, nz, pts, { paper: PAPER, back: 0.4, greys: 0.9, separation: 0.12, ...o, size: [o.size[0] * 0.55, o.size[1] * 0.55], density: o.density * 2.8, v: o.v + 0.01 });
      const tree = (x, y, h, kind, tn = 0.09) => paintConifer(ctx, x, y, h, { kind, tone: tn + r.range(0, 0.04), paper: PAPER, seed: (r() * 1e6) | 0 });
      // knoll 1 (back)
      crag({ profile: [[470, 700], [490, 640], [530, 622], [580, 616], [630, 624], [670, 642], [705, 664], [722, 720], [730, 820], [736, 1000]], base: 1000, fade: [760, 940], tone: 0.8, cun: 1.5, dabs: 0.5, speckle: 0.5, light: [{ x: 600, w: 50, a: 0.6 }],
        fissures: [{ pts: [[700, 660], [712, 740], [718, 840]], w: 50, a: 0.95 }, { pts: [[560, 625], [566, 720], [570, 820]], w: 30, a: 0.45 }, { pts: [[620, 628], [626, 700], [630, 780]], w: 70, a: 0.35, n: 2 }, { pts: [[500, 640], [505, 720], [510, 800]], w: 60, a: 0.4, n: 2 }] });
      tree(505, 636, 96, 'fir', 0.06); tree(574, 626, 124, 'fir', 0.04); tree(545, 630, 70, 'pine', 0.2); tree(620, 630, 80, 'fir', 0.3);
      band([[470, 650], [520, 628], [580, 622], [640, 630], [700, 664]], { band: 50, size: [16, 36], density: 3.0, v: 0.36, pines: 0.15 });
      // knoll 2
      crag({ profile: [[470, 1000], [560, 820], [620, 740], [650, 690], [690, 662], [735, 680], [780, 712], [815, 752], [850, 810], [880, 880], [905, 960], [920, 1080]], base: 1080, fade: [860, 1020], dabs: 0.5, tone: 0.88, cun: 1.5, speckle: 0.5, light: [{ x: 750, w: 45, a: 0.6 }],
        fissures: [{ pts: [[815, 752], [830, 830], [838, 930]], w: 50, a: 0.95 }, { pts: [[730, 684], [736, 780], [740, 880]], w: 28, a: 0.45 }, { pts: [[690, 668], [695, 740], [700, 820]], w: 70, a: 0.35, n: 2 }, { pts: [[780, 716], [784, 790], [788, 860]], w: 60, a: 0.35, n: 2 }] });
      tree(650, 632, 60, 'fir'); tree(692, 656, 52, 'pine'); tree(740, 688, 54, 'fir'); tree(790, 724, 44, 'fir');
      band([[650, 694], [700, 668], [740, 686], [790, 720], [830, 762]], { band: 60, size: [18, 42], density: 3.6, v: 0.02, pines: 0.2 });
      // knoll 3 (front right, descending into the mist)
      crag({ profile: [[700, 1150], [752, 830], [790, 790], [835, 796], [868, 838], [898, 892], [935, 950], [975, 1010], [1010, 1080], [1030, 1150]], base: 1150, fade: [940, 1080], dabs: 0.5, tone: 0.9, cun: 1.5, speckle: 0.5, light: [{ x: 840, w: 45, a: 0.6 }],
        fissures: [{ pts: [[900, 896], [920, 980], [930, 1060]], w: 46, a: 0.95 }, { pts: [[800, 796], [806, 880], [810, 960]], w: 70, a: 0.4, n: 2 }, { pts: [[860, 830], [866, 900], [870, 980]], w: 50, a: 0.35, n: 2 }] });
      tree(905, 905, 56, 'pine'); tree(944, 990, 50, 'fir');
      band([[752, 834], [800, 796], [840, 802], [880, 852], [915, 920], [945, 990]], { band: 64, size: [18, 42], density: 3.6, v: 0.02, pines: 0.25 });
      // sheer pavilion cliff
      crag({ profile: [[-220, 470], [-80, 455], [0, 452], [60, 468], [120, 488], [170, 486], [210, 478], [260, 470], [330, 468], [380, 474], [430, 486], [462, 500], [474, 530], [480, 620], [484, 800], [490, 1060]], base: 1060,
        fade: (x) => (x < 200 ? [800, 1000] : [760 + (x - 200) * 0.2, 960]), tone: 0.92, dabs: 0.45, cun: 1.4, speckle: 0.4, light: [{ x: 300, w: 110, a: 0.8 }, { x: 160, w: 50, a: 0.4 }],
        fissures: [{ pts: [[452, 500], [462, 600], [466, 700], [468, 820]], w: 64, a: 0.8, n: 6 }, { pts: [[345, 474], [350, 560], [352, 660], [356, 760]], w: 34, a: 0.45 }, { pts: [[260, 474], [262, 560], [266, 640]], w: 26, a: 0.3 }, { pts: [[60, 470], [70, 560], [78, 680]], w: 80, a: 0.7 }, { pts: [[150, 488], [156, 580], [160, 700]], w: 90, a: 0.55, n: 3 }, { pts: [[-60, 460], [-50, 560], [-40, 700]], w: 120, a: 0.6, n: 3 }, { pts: [[410, 480], [416, 580], [420, 680]], w: 60, a: 0.45, n: 3 }] });
      tree(190, 482, 70, 'fir', 0.06); tree(-10, 470, 80, 'fir', 0.06); tree(40, 462, 96, 'fir', 0.05); tree(130, 474, 60, 'pine', 0.08);
      band([[-200, 440], [-120, 430], [-40, 428], [40, 440], [110, 456], [160, 470]], { band: 40, size: [18, 38], density: 2.6, v: 0.04, pines: 0.25 });
      band([[-210, 470], [-100, 456], [0, 455], [60, 470], [120, 490], [180, 488], [215, 482]], { band: 70, size: [18, 40], density: 3.2, v: 0.03, pines: 0.2 });
      band([[380, 476], [420, 484], [455, 498], [470, 520]], { band: 40, size: [14, 28], density: 2.6, v: 0.04, pines: 0.05 });
      band([[-210, 560], [-150, 600], [-100, 640], [-60, 700], [0, 760]], { band: 90, size: [22, 46], density: 3.4, v: 0.03, pines: 0.1 });
      band([[-210, 500], [-120, 520], [-40, 540], [40, 560], [110, 590]], { band: 60, size: [18, 40], density: 2.6, v: 0.04, pines: 0.1 });
      band([[0, 640], [50, 660], [100, 690], [130, 720]], { band: 50, size: [16, 34], density: 2.4, v: 0.04, pines: 0.1 });
      band([[150, 486], [200, 484], [240, 480], [262, 500]], { band: 40, size: [14, 30], density: 2.6, v: 0.03, pines: 0.05 });
      band([[0, 590], [50, 620], [100, 670], [140, 740], [150, 800]], { band: 110, size: [20, 46], density: 3.6, v: 0.03, pines: 0.1 });
      band([[380, 520], [420, 560], [450, 620], [460, 700]], { band: 30, size: [10, 24], density: 2.2, v: 0.05, pines: 0 });
      // lower-left slope
      crag({ profile: [[-220, 850], [-100, 826], [0, 804], [60, 786], [120, 766], [180, 750], [250, 732], [300, 724], [340, 730], [368, 752], [384, 800], [394, 900], [400, 1000], [404, 1150]], base: 1150,
        fade: (x) => [920 + x * 0.25, 1140], tone: 1.0, lean: -0.5, dabs: 0.6, body: 1.0, speckle: 0.3, light: [{ x: 190, w: 70, a: 0.75 }],
        fissures: [{ pts: [[330, 730], [300, 820], [262, 920], [220, 1020]], w: 70, a: 0.75, n: 6 }, { pts: [[200, 752], [160, 840], [120, 940]], w: 44, a: 0.45 }, { pts: [[60, 788], [30, 870], [0, 950]], w: 40, a: 0.4 }] });
      band([[-60, 800], [0, 806], [60, 788], [120, 768], [180, 752], [250, 734], [300, 726], [345, 734]], { band: 60, size: [16, 38], density: 2.8, v: 0.04, pines: 0.15 });
      band([[230, 740], [280, 732], [330, 740], [360, 770]], { band: 60, size: [20, 44], density: 3.4, v: 0.02, pines: 0.05 });
      band([[-40, 860], [20, 880], [80, 920], [120, 990], [140, 1060]], { band: 120, size: [22, 48], density: 3.4, v: 0.03, pines: 0.1 });
      // small front rock with a pine
      crag({ profile: [[376, 1150], [380, 890], [420, 858], [470, 850], [500, 864], [520, 900], [532, 960], [545, 1150]], base: 1150, fade: [960, 1120], tone: 1.0, body: 0.6, speckle: 0.4,
        fissures: [{ pts: [[500, 866], [515, 940], [525, 1020]], w: 40, a: 0.8 }] });
      tree(450, 862, 64, 'pine', 0.02);
      band([[380, 892], [420, 862], [470, 854], [505, 870], [525, 905]], { band: 50, size: [16, 36], density: 3.2, v: 0.02, pines: 0.1 });
    }, { scale: 1 });
    const cragSrc = wetInk(api, cragRaw, { paper: PAPER, ink: [12, 11, 10], soft: 1.6, blur: 0.15, bleed: 0.35, edge: 0.5, granulation: 0.32, mottle: 0.4, seed: 3 });
    // white mist behind the cliff card: where the crags dissolve they stand in mist, not on the lake
    layers.push(makeMist(api, { top: 830, bottom: 1180, z: 1.25, lobe: 70, seed: 6, drift: 6, density: 1.0, holes: 0, softness: 8, extent: [330, 1080, 140], color: PAPER }));
    layers.push(api.tex(cragSrc, { rect: CR, z: 1.2, name: 'cliff', sway: { amp: 0.6, freq: 0.2, scale: 260, power: 2, anchor: [400, 1200], radius: 900 } }));

    // pavilion and maples
    const pavRect = [140, 260, 360, 240];
    const pav = bakeArch(api, pavRect, (ctx) => paintPavilion(ctx, { x: 320, y: 466, w: 174, seed: 31, colH: 0.6, paper: PAPER }));
    layers.push(api.tex(pav, { rect: pavRect, z: 1.2, name: 'pavilion' }));
    const mapleTop = makeMaple(api, { seed: 301, paper: PAPER, trees: [
      { x: 440, y: 486, height: 70, width: 80, lean: 6, shape: 'round', crown: [445, 448, 40, 30], leafSize: 3.0, density: 1.4, pale: 0.4, depth: 5 },
    ] });
    const mapleLow = makeMaple(api, { seed: 302, paper: PAPER, trees: [
      { x: 232, y: 742, height: 130, width: 150, lean: 4, shape: 'round', crown: [232, 672, 84, 52], leafSize: 3.8, density: 1.4, depth: 5, pale: 0.3 },
    ] });
    layers.push(mapleTop.layer({ z: 1.2, amp: 1.5 }), mapleLow.layer({ z: 1.2, amp: 2 }));
    layers.push(makeMist(api, { top: 925, bottom: 1180, z: 1.1, lobe: 80, seed: 5, drift: 12, density: 1.0, holes: 0, softness: 10, extent: [430, 1060, 170], color: PAPER }));

    // ---------------------------------------------------------------- hero pine
    const pine = makePine(api, {
      seed: 31, height: 440, gnarl: 0.85, scale: 1,
      spine: [[60, 430], [70, 370], [90, 300], [100, 240], [118, 180], [148, 132], [165, 92]],
      trunkWidth: 36, taper: 0.45, flare: 0.15, barkTone: 0.3, barkDensity: 2.2, knobs: 0.45, tone: 0.05,
      limbs: [
        { pts: [[145, 190], [210, 196], [266, 192], [330, 190], [400, 200], [470, 220], [555, 247]], w: 12, subs: 4 },
        { pts: [[160, 112], [200, 84], [260, 70], [335, 74]], w: 10, subs: 3 },
        { pts: [[152, 118], [112, 92], [72, 82], [40, 88]], w: 8, subs: 2 },
        { pts: [[98, 250], [140, 262], [190, 266], [238, 292]], w: 8, subs: 2 },
        { pts: [[22, 430], [26, 340], [38, 260], [42, 180], [32, 110]], w: 16, subs: 2 },
        { pts: [[40, 200], [10, 160], [-20, 130]], w: 7, subs: 1 },
        { pts: [[130, 160], [180, 140], [240, 128], [300, 132]], w: 8, subs: 2 },
        { pts: [[200, 194], [230, 160], [270, 150]], w: 5, subs: 1 },
        { pts: [[160, 110], [190, 60], [230, 30], [280, 22]], w: 7, subs: 2 },
      ],
      // airier needle fans: fewer overlapping pads, more and finer needles, a light core
      padSize: 64, padAspect: 0.42, needle: 14, padDensity: 3.0, haze: 0, backPads: 0.03, wet: 0.15, soft: 0.18, core: 0.08, needleWidth: 0.12, needles: 13,
      swayAmp: 3, swayFreq: 0.2,
    });
    layers.push(pine.layer({ z: 1.15 }));

    return {
      layers,
      camera: cam,
      meta: { clear: PAPER.map((v) => v / 255) },
    };
  },
};
