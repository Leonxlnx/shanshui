// Lab: ref 01 left cliff (upper columns with the waterfall notch + lower-left mass), rock only.
import { cliff, bakeRocks } from '../lib/rock.js';

const DEBUG = false;
globalThis.__rockDebug = 0;

export default {
  id: 'lab-rock-01', title: 'rock 01 left cliff', ref: '01',
  build(api) {
    const paper = api.shader(`vec4 shade(vec2 p, vec2 uv){ return vec4(vec3(239.,231.,220.)/255., 1.); }`, { z: 1e5 });
    const upper = cliff({
      seed: 11,
      outline: [[-80, 520], [-20, 500], [60, 482], [140, 476], [205, 472], [280, 474], [345, 470], [372, 452], [398, 458], [412, 482], [430, 500],
        [452, 520], [458, 596], [548, 596], [556, 588], [585, 586], [612, 592], [632, 610], [648, 650], [660, 720], [672, 800], [690, 900], [700, 1000], [-80, 1000]],
      columns: [{ x: 150 }, { x: 205, tone: -0.1 }, { x: 292 }, { x: 352 }, { x: 402, tone: 0.35, dark: 0.25 }, { x: 595, tone: 0.2, dark: 0.12 }],
      firstColumn: { tone: 0.15, dark: 0.1 },
      notch: { x0: 455, x1: 552, y: 596, bottom: 900, tone: 0.8, dark: 0.85 },
      fade: [[0, 780, 1000], [300, 760, 900], [450, 760, 880], [600, 720, 880], [700, 700, 860]],
      tone: 0.22, shadow: 0.5, moss: 1.2, foliage: 1.3, ledges: 0,
      tufts: [[420, 520, 46], [440, 530, 30], [522, 598, 30], [560, 588, 52], [600, 594, 40], [628, 606, 26]],
    });
    const lower = cliff({
      seed: 12,
      outline: [[-80, 650], [0, 632], [60, 658], [120, 690], [180, 716], [240, 728], [300, 766], [340, 812], [360, 878], [420, 888], [480, 926], [540, 958], [600, 990], [660, 1030], [730, 1090], [730, 1160], [-80, 1160]],
      columns: [{ x: 60 }, { x: 175 }, { x: 350 }, { x: 520 }],
      fade: [[0, 900, 1090], [150, 980, 1120], [300, 1060, 1160], [700, 1060, 1160]],
      tone: 0.15, shadow: 0.55, moss: 1.8, mossSize: 1.3, foliage: 2.2, grain: 70,
      tufts: [[230, 732, 60], [300, 772, 52], [420, 892, 56], [470, 920, 40], [560, 966, 50]],
    });
    const rock = bakeRocks(api, { rect: [-80, 380, 820, 760], items: [upper, lower], seed: 3 });
    const layers = [paper, rock.layer({ z: 1 })];
    if (DEBUG) {
      const dbg = api.bakeCanvas(1920, 1080, (ctx) => {
        ctx.strokeStyle = 'rgba(255,0,0,0.8)'; ctx.lineWidth = 1.5;
        for (const it of [upper, lower]) { ctx.beginPath(); it.outline.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p))); ctx.closePath(); ctx.stroke(); }
      });
      layers.push(api.tex(dbg, { rect: [0, 0, 1920, 1080] }));
    }
    return { layers };
  },
};
