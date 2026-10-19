// Lab: ref 04 right cliff (pale granite pillar with deep dark fissures, darker front mass, lower-left slope).
import { cliff, bakeRocks } from '../lib/rock.js';

export default {
  id: 'lab-rock-04', title: 'rock 04 right cliff', ref: '04',
  build(api) {
    const paper = api.shader(`vec4 shade(vec2 p, vec2 uv){ return vec4(vec3(239.,231.,220.)/255., 1.); }`, { z: 1e5 });
    // pale granite pillar (behind)
    const pillar = cliff({
      seed: 41,
      outline: [[1396, 1140], [1398, 900], [1402, 720], [1406, 560], [1414, 470], [1428, 432], [1456, 414], [1510, 406], [1570, 400], [1630, 396], [1700, 398], [1760, 404], [1760, 1140]],
      columns: [{ x: 1470, tone: -0.05 }, { x: 1525, tone: 0.1 }, { x: 1598, tone: 0.05 }, { x: 1660, tone: 0.15 }],
      firstColumn: { tone: -0.1 },
      fade: [[1396, 1080, 1140], [1760, 1080, 1140]],
      tone: 0.05, shadow: 0.75, moss: 1.2, foliage: 1.0, topDark: 1.2, topDepth: 80, streak: 0.6, cun: 0.9, speckle: 0.8,
      cunMix: { drip: 0.25, axe: 0.1, hair: 0.1, dot: 0.05, dapple: 0.5 },
    });
    // darker front mass to the right of the diagonal crack
    const front = cliff({
      seed: 42,
      outline: [[1690, 452], [1730, 430], [1790, 412], [1850, 404], [1920, 410], [2000, 420], [2000, 1140], [1500, 1140], [1540, 1040], [1600, 930], [1660, 840], [1688, 760], [1692, 620]],
      columns: [{ x: 1760, lean: -0.15 }, { x: 1840, lean: -0.3, tone: 0.2 }, { x: 1920, lean: -0.3 }],
      grain: 108,
      fade: [[1500, 1090, 1140], [2000, 1090, 1140]],
      tone: 0.3, dark: 0.05, shadow: 0.7, moss: 1.8, foliage: 1.6, topDark: 1.6, topDepth: 140, streak: 0.5, cun: 1.3, speckle: 0.9,
      cunMix: { drip: 0.25, axe: 0.15, hair: 0.05, dot: 0.1, dapple: 0.45 },
    });
    // lower-left dark slope (in front)
    const slope = cliff({
      seed: 43,
      outline: [[1300, 1140], [1330, 1080], [1380, 1020], [1440, 950], [1500, 870], [1560, 800], [1600, 772], [1625, 790], [1612, 860], [1590, 960], [1570, 1060], [1560, 1140]],
      columns: [{ x: 1480, lean: -0.4 }],
      grain: 115,
      fade: [[1300, 1100, 1140], [1600, 1100, 1140]],
      tone: 0.4, dark: 0.15, shadow: 0.5, moss: 2.0, foliage: 1.8, topDark: 1.8, topDepth: 100,
    });
    const rock = bakeRocks(api, { rect: [1280, 340, 720, 800], items: [pillar, front, slope], seed: 4 });
    return { layers: [paper, rock.layer({ z: 1 })] };
  },
};
