// Lab: ref 04 - dense Huangshan pillars in mist (same positions/scale as the reference, x 0-1400).
// The right cliff / pine / pavilion / bridges / waterfall belong to other modules and are left out.
import { makePeaks, makeRange, _prof } from '../lib/peaks.js';

export default {
  id: 'lab-peaks-04', title: 'peaks 04', ref: '04',
  build(api) {
    const paper = api.shader(`vec4 shade(vec2 p, vec2 uv){ return vec4(vec3(239.,231.,220.)/255., 1.); }`, { z: 1e5 });
    const t0 = performance.now();
    // farthest pale pillars across the top
    const far = makeRange(api, {
      rows: [
        { x0: 80, x1: 1450, base: 300, top: 70, amp: 0.5, tone: 0.84, seed: 41, count: 13, trees: 0.8, treeSize: 0.6 },
      ], soft: 1.0,
    });
    const back = makePeaks(api, {
      peaks: [
        { x: 230, top: 30, base: 230, tone: 0.62, seed: 15, fade: 0.45, columns: [{ dx: -110, top: 70, hw: 40 }, { dx: -40, top: 40, hw: 50 }, { dx: 50, top: 60, hw: 45 }] },
        { x: 450, top: 10, base: 270, tone: 0.5, seed: 11, fade: 0.5, columns: [
          { dx: -120, top: 70, hw: 32, lit: 0.4 }, { dx: -60, top: 52, hw: 45, lit: 0.35 }, { dx: 30, top: 10, hw: 62, lit: 0.6, skew: 0.3 }] },
        { x: 610, top: 95, base: 270, tone: 0.58, seed: 14, fade: 0.45, columns: [{ dx: 0, top: 95, hw: 34, lit: 0.5 }, { dx: 30, top: 130, hw: 22 }] },
        { x: 1045, top: 305, base: 500, tone: 0.4, seed: 13, fade: 0.5, columns: [{ dx: -15, top: 305, hw: 40, lit: 0.55 }, { dx: 30, top: 340, hw: 25 }] },
        { x: 1250, top: 230, base: 420, tone: 0.62, seed: 16, fade: 0.45, columns: [{ dx: -30, top: 250, hw: 40 }, { dx: 30, top: 230, hw: 35, lit: 0.6 }] },
        { x: 1200, top: 610, base: 800, tone: 0.55, seed: 12, fade: 0.45, columns: [{ dx: 0, top: 610, hw: 42, lit: 0.5 }, { dx: -40, top: 650, hw: 25 }] },
        { x: 660, top: 600, base: 780, tone: 0.55, seed: 17, fade: 0.45, columns: [{ dx: 0, top: 610, hw: 50 }, { dx: 70, top: 640, hw: 40 }] },
      ],
    });
    // left wall of pillars (x 0-330) and the main central cluster
    const mid = makePeaks(api, {
      peaks: [
        { x: 160, top: 260, base: 650, tone: 0.14, treeSize: 1.3, seed: 23, fade: 0.55, columns: [
          { dx: -150, top: 300, hw: 45, lit: 0.3, foliage: 0.8 }, { dx: -70, top: 280, hw: 50, lit: 0.4, foliage: 0.6 },
          { dx: 30, top: 260, hw: 58, lit: 0.45, foliage: 0.7 }, { dx: 120, top: 330, hw: 40, lit: 0.6 }] },
        { x: 760, top: 205, base: 580, tone: 0.24, seed: 22, fade: 0.55, columns: [
          { dx: 0, top: 205, hw: 62, lit: 0.15, foliage: 1, tips: 1, cap: 'round' },
          { dx: -90, top: 262, hw: 52, lit: 0.3, foliage: 1, tips: 1 },
          { dx: -170, top: 300, hw: 38, lit: 0.3, foliage: 1, tips: 1 },
          { dx: 145, top: 290, hw: 24, lit: 0.5 },
          { dx: 60, top: 238, hw: 55, lit: 0.9, cap: 'point', capH: 70, foliage: 0.05, trees: 0.15, z: 400 },
        ] },
      ],
    });
    const low = makePeaks(api, {
      peaks: [
        { x: 120, top: 640, base: 1080, tone: 0.1, treeSize: 1.4, seed: 34, fade: 0.55, columns: [
          { dx: -90, top: 700, hw: 50, lit: 0.3, foliage: 0.8 }, { dx: 0, top: 650, hw: 55, lit: 0.4, foliage: 0.6 }, { dx: 100, top: 690, hw: 45, lit: 0.6 }] },
        { x: 470, top: 530, base: 1000, tone: 0.16, treeSize: 1.3, seed: 35, fade: 0.55, columns: [
          { dx: -60, top: 560, hw: 50, lit: 0.35, foliage: 0.8 }, { dx: 30, top: 530, hw: 55, lit: 0.5 }, { dx: 110, top: 600, hw: 40, lit: 0.6 }] },
        { x: 990, top: 500, base: 870, tone: 0.25, seed: 31, fade: 0.55, columns: [
          { dx: -40, top: 500, hw: 55, lit: 0.2, foliage: 1, tips: 1 },
          { dx: -120, top: 520, hw: 45, lit: 0.25, foliage: 1, tips: 1 },
          { dx: 100, top: 560, hw: 22, lit: 0.5 },
          { dx: 40, top: 512, hw: 48, lit: 0.9, cap: 'point', capH: 60, foliage: 0.05, trees: 0.15, z: 700 },
        ] },
        { x: 770, top: 700, base: 1080, tone: 0.24, seed: 32, fade: 0.55, columns: [
          { dx: -30, top: 700, hw: 55, lit: 0.3, foliage: 0.7 }, { dx: 40, top: 730, hw: 45, lit: 0.8, cap: 'point', z: 800 },
        ] },
        { x: 930, top: 815, base: 1080, tone: 0.26, seed: 33, fade: 0.5, columns: [{ dx: 0, top: 815, hw: 40, lit: 0.6 }] },
      ],
    });
    console.log('peaks-04 bake ms', Math.round(performance.now() - t0), JSON.stringify(_prof));
    return {
      layers: [paper, far.layer({ z: 1 }), back.layer({ z: 1 }), mid.layer({ z: 1 }), low.layer({ z: 1 })],
    };
  },
};
