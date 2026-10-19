// Lab: ref 09 - pillar peaks floating in a sea of clouds (buildings left out; flat tops return anchors).
import { makePeaks } from '../lib/peaks.js';

export default {
  id: 'lab-peaks-09', title: 'peaks 09', ref: '09',
  build(api) {
    const paper = api.shader(`vec4 shade(vec2 p, vec2 uv){ return vec4(vec3(239.,231.,220.)/255., 1.); }`, { z: 1e5 });
    const t0 = performance.now();
    const far = makePeaks(api, {
      peaks: [
        { x: 545, top: 45, base: 250, width: 230, cols: 5, tone: 0.8, seed: 91, fade: 0.4, treeSize: 0.45, detail: 0.7 },
        { x: 975, top: 30, base: 210, width: 250, cols: 5, tone: 0.82, seed: 92, fade: 0.4, treeSize: 0.45, detail: 0.7 },
        { x: 1440, top: 55, base: 220, width: 230, cols: 5, tone: 0.82, seed: 93, fade: 0.4, treeSize: 0.45, detail: 0.7 },
        { x: 1830, top: 120, base: 300, width: 240, cols: 4, tone: 0.8, seed: 94, fade: 0.4, treeSize: 0.45, detail: 0.7 },
        { x: 660, top: 235, base: 390, width: 240, cols: 5, tone: 0.72, seed: 95, fade: 0.35, treeSize: 0.5, detail: 0.7 },
        { x: 1075, top: 250, base: 370, width: 170, cols: 3, tone: 0.74, seed: 96, fade: 0.35, treeSize: 0.5, detail: 0.7 },
      ],
    });
    const mid = makePeaks(api, {
      peaks: [
        { x: 1670, top: 118, base: 360, tone: 0.5, seed: 101, fade: 0.45, clearTop: [0], columns: [
          { dx: 0, top: 118, hw: 42, cap: 'flat', lit: 0.5 }, { dx: -80, top: 190, hw: 55, lit: 0.35 }, { dx: 85, top: 175, hw: 50, lit: 0.6 }] },
        { x: 870, top: 272, base: 500, tone: 0.42, seed: 102, fade: 0.45, clearTop: [0], columns: [
          { dx: 5, top: 272, hw: 38, cap: 'flat', lit: 0.55 }, { dx: -48, top: 310, hw: 34, lit: 0.3 }, { dx: 55, top: 300, hw: 30, lit: 0.7 }] },
        { x: 1580, top: 395, base: 600, tone: 0.42, seed: 103, fade: 0.45, columns: [
          { dx: -60, top: 420, hw: 45, lit: 0.4 }, { dx: 60, top: 395, hw: 55, lit: 0.55 }, { dx: 180, top: 370, hw: 50, cap: 'flat', lit: 0.5 }] },
        { x: 660, top: 398, base: 660, tone: 0.34, seed: 104, fade: 0.45, clearTop: [0], columns: [
          { dx: 10, top: 398, hw: 36, cap: 'flat', lit: 0.5 }, { dx: -55, top: 440, hw: 40, lit: 0.3 }, { dx: 55, top: 450, hw: 30, lit: 0.6 }] },
      ],
    });
    const near = makePeaks(api, {
      peaks: [
        { x: 1200, top: 330, base: 680, tone: 0.28, seed: 111, fade: 0.5, clearTop: [0], columns: [
          { dx: -20, top: 335, hw: 62, cap: 'flat', lit: 0.45 }, { dx: -90, top: 380, hw: 40, lit: 0.25 },
          { dx: 120, top: 440, hw: 45, lit: 0.55 }, { dx: 270, top: 465, hw: 55, lit: 0.5 }] },
        { x: 645, top: 598, base: 840, tone: 0.3, seed: 112, fade: 0.5, clearTop: [0], columns: [
          { dx: 0, top: 598, hw: 40, cap: 'flat', lit: 0.5 }, { dx: -45, top: 640, hw: 30, lit: 0.3 }, { dx: 45, top: 630, hw: 28, lit: 0.6 }] },
        { x: 1060, top: 525, base: 860, tone: 0.24, seed: 113, fade: 0.5, columns: [
          { dx: -110, top: 580, hw: 48, lit: 0.35 }, { dx: 100, top: 525, hw: 70, lit: 0.4 }, { dx: 30, top: 590, hw: 30, lit: 0.6 }] },
        { x: 1800, top: 695, base: 930, tone: 0.28, seed: 114, fade: 0.5, clearTop: [0], columns: [
          { dx: 30, top: 695, hw: 45, cap: 'flat', lit: 0.5 }, { dx: -55, top: 740, hw: 48, lit: 0.3 }, { dx: 100, top: 760, hw: 40, lit: 0.6 }] },
        { x: 1630, top: 822, base: 1060, tone: 0.24, seed: 115, fade: 0.5, clearTop: [0], columns: [
          { dx: -20, top: 822, hw: 45, cap: 'flat', lit: 0.45 }, { dx: -80, top: 870, hw: 40, lit: 0.3 }, { dx: 70, top: 880, hw: 50, lit: 0.6 }] },
      ],
    });
    console.log('peaks-09 bake ms', Math.round(performance.now() - t0), 'tops', JSON.stringify(near.anchors.tops.filter((t) => t.flat).map((t) => [Math.round(t.x), Math.round(t.y), Math.round(t.w)])));
    return {
      layers: [paper, far.layer({ z: 1 }), mid.layer({ z: 1 }), near.layer({ z: 1 })],
    };
  },
};
