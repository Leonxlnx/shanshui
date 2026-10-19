// Lab: ref 03 left cliff group (sheer pavilion cliff, lower-left slope, front rock, right lower cliff).
import { cliff, bakeRocks } from '../lib/rock.js';

const PAPER03 = [237, 228, 215];

export default {
  id: 'lab-rock-03', title: 'rock 03 left cliff', ref: '03',
  build(api) {
    const paper = api.shader(`vec4 shade(vec2 p, vec2 uv){ return vec4(vec3(237.,228.,215.)/255., 1.); }`, { z: 1e5 });
    // right lower cliff (behind)
    const right = cliff({
      seed: 31,
      outline: [[470, 668], [500, 642], [560, 612], [600, 612], [650, 622], [700, 650], [740, 680], [780, 722], [830, 790], [868, 860], [896, 950], [910, 1040], [470, 1040]],
      columns: [{ x: 560 }, { x: 640, tone: 0.1 }, { x: 720 }, { x: 800, tone: 0.1 }],
      fade: [[480, 860, 990], [700, 850, 970], [900, 900, 1010]],
      tone: 0.3, shadow: 0.5, moss: 1.5, foliage: 1.6, topDark: 1.6,
      tufts: [[575, 618, 96, 0.02], [530, 636, 60], [660, 628, 70], [700, 652, 46], [745, 686, 40], [820, 782, 44], [866, 862, 30]],
    });
    // sheer pavilion cliff
    const sheer = cliff({
      seed: 32,
      outline: [[-80, 470], [0, 456], [60, 470], [120, 500], [170, 492], [210, 482], [260, 472], [330, 470], [380, 477], [430, 488], [462, 502], [474, 540], [479, 640], [474, 760], [470, 880], [466, 1000], [-80, 1000]],
      columns: [{ x: 70, tone: 0.1 }, { x: 205, tone: -0.1 }, { x: 395, tone: 0.3, dark: 0.2 }],
      firstColumn: { tone: 0.3 },
      fade: [[-80, 700, 860], [150, 760, 900], [300, 800, 940], [470, 840, 980]],
      tone: 0.2, shadow: 0.55, moss: 1.5, foliage: 1.5, topDark: 1.8, streak: 0.6,
    });
    // lower-left slope with diagonal streaks
    const slope = cliff({
      seed: 33,
      outline: [[-80, 830], [0, 806], [60, 784], [120, 764], [180, 748], [250, 728], [300, 720], [340, 726], [368, 748], [380, 800], [390, 900], [400, 1000], [404, 1120], [-80, 1120]],
      columns: [{ x: 120, lean: -0.5 }, { x: 230, lean: -0.45 }, { x: 330, lean: -0.15, tone: 0.2 }],
      grain: 115,
      fade: [[-80, 880, 1060], [150, 930, 1090], [330, 920, 1040], [400, 880, 990]],
      tone: 0.12, shadow: 0.5, moss: 1.7, foliage: 2.0, streak: 1.0, topDark: 1.5,
    });
    // small dark front rock with a pine on top
    const front = cliff({
      seed: 34,
      outline: [[378, 884], [420, 852], [470, 846], [500, 862], [520, 900], [530, 962], [540, 1050], [376, 1050]],
      columns: [{ x: 450, tone: 0.2 }],
      fade: [[380, 990, 1060], [540, 1000, 1070]],
      tone: 0.6, dark: 0.35, shadow: 0.7, moss: 1.8, foliage: 1.5, topDark: 2.2, topDepth: 90,
      tufts: [[430, 858, 58, 0.05]],
    });
    const rock = bakeRocks(api, { rect: [-80, 400, 1000, 680], items: [right, sheer, slope, front], seed: 3, paper: PAPER03 });
    return { layers: [paper, rock.layer({ z: 1 })], meta: { clear: PAPER03.map((v) => v / 255) } };
  },
};
