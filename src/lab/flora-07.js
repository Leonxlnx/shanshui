// Lab: bamboo grove of ref 07 (left, full height) + bottom-right clump, in place.
import { makeBamboo } from '../lib/flora.js';

const PAPER07 = [236, 228, 216];

// Culms traced from ref 07 (design px). nodeY are node heights.
const CULMS = [
  // far / pale culms (layer 0)
  { base: [150, 820], top: [168, -30], width: [16, 13], tone: 0.62, layer: 0, nodeY: [-10, 70, 160, 260, 380, 520, 660] },
  { base: [40, 900], top: [130, -30], width: [18, 15], tone: 0.66, layer: 0, nodeY: [60, 180, 300, 430, 560, 700] },
  { base: [262, 760], top: [252, 330], width: [12, 10], tone: 0.6, layer: 0, nodeY: [420, 520, 640] },
  // mid-grey culms (layer 1)
  { base: [20, 1100], top: [112, -30], width: [26, 22], tone: 0.42, layer: 1, nodeY: [80, 195, 284, 360, 470, 600, 740, 880] },
  { base: [-30, 1100], top: [60, -30], width: [24, 20], tone: 0.45, layer: 1, nodeY: [40, 150, 271, 320, 450, 590, 730] },
  { base: [10, 1100], top: [150, 380], width: [30, 26], tone: 0.18, layer: 1, nodeY: [453, 684, 900] },
  // near dark culms (layer 2)
  { base: [8, 1100], top: [228, -30], width: [64, 44], tone: 0.02, layer: 2, bow: 6, nodeY: [71, 176, 344, 542, 742, 940] },
  { base: [52, 1100], top: [294, -30], width: [48, 39], tone: 0.2, layer: 2, bow: 4, nodeY: [116, 267, 364, 540, 720, 900] },
  { base: [190, 520], top: [470, -40], width: [15, 11], tone: 0.02, layer: 2, nodeY: [273, 164, 60], dry: 0.4, band: 0.45 },
];

const T = (at, dir, len, tone, layer, leafLen, droop, extra = {}) => ({ at, dir, len, tone, layer, leafLen, droop, ...extra });
const C = (at, r, tone, layer, leafLen, droop, extra = {}) => ({ at, r, tone, layer, leafLen, droop, ...extra });

export default {
  id: 'lab-flora-07', title: 'flora: bamboo grove ref 07', ref: '07',
  build(api) {
    const paper = api.shader(`vec4 shade(vec2 p, vec2 uv){ return vec4(vec3(${PAPER07.map((v) => (v / 255).toFixed(4)).join(',')}), 1.); }`, { z: 1e5 });
    const grove = makeBamboo(api, {
      seed: 7, rect: [-60, -60, 1120, 1200], paper: PAPER07,
      culms: CULMS,
      clumps: [
        // near, near-black masses traced from the reference
        C([600, 120], 75, 0.03, 2, 135, 0.85, { from: [470, 30], groups: 8 }),
        C([735, 110], 75, 0.03, 2, 135, 0.85, { from: [610, 40], groups: 8 }),
        C([905, 90], 70, 0.03, 2, 120, 0.8, { from: [780, 50], groups: 9 }),
        C([400, 290], 80, 0.03, 2, 140, 0.75, { groups: 8 }),
        C([480, 370], 75, 0.03, 2, 135, 0.8, { from: [330, 240], groups: 9 }),
        C([380, 60], 90, 0.04, 2, 120, 0.45, { groups: 9 }),
        C([90, 70], 85, 0.04, 2, 115, 0.55, { groups: 8 }),
        C([150, 210], 70, 0.04, 2, 115, 0.6, { groups: 9 }),
        C([60, 440], 70, 0.05, 2, 105, 0.5, { groups: 4 }),
        C([390, 610], 90, 0.05, 2, 110, 0.2, { rise: true, groups: 8 }),
        C([530, 690], 90, 0.06, 2, 105, 0.2, { rise: true, groups: 6, from: [240, 720] }),
        C([310, 730], 70, 0.06, 2, 100, 0.25, { rise: true, groups: 4 }),
        // mid-grey masses behind
        C([60, 150], 90, 0.42, 1, 110, 0.5, { groups: 8 }),
        C([200, 120], 80, 0.45, 1, 110, 0.5, { groups: 9 }),
        C([110, 330], 90, 0.42, 1, 110, 0.45, { groups: 8 }),
        C([300, 420], 90, 0.48, 1, 110, 0.5, { groups: 8 }),
        C([60, 600], 80, 0.42, 1, 105, 0.35, { groups: 9 }),
        C([250, 520], 80, 0.48, 1, 105, 0.4, { groups: 9 }),
        C([470, 160], 70, 0.5, 1, 110, 0.7, { groups: 4 }),
        // pale far masses
        C([30, 260], 80, 0.66, 0, 100, 0.5, { groups: 9 }),
        C([230, 300], 80, 0.68, 0, 100, 0.5, { groups: 9 }),
        C([160, 640], 80, 0.66, 0, 95, 0.4, { groups: 9 }),
        C([400, 480], 70, 0.7, 0, 95, 0.4, { groups: 4 }),
      ],
      twigs: [],
    });
    // bottom-right clump
    const clump = makeBamboo(api, {
      seed: 71, rect: [1500, 700, 480, 440], paper: PAPER07,
      culms: [{ base: [1890, 1120], top: [1872, 760], width: [7, 5], tone: 0.12, layer: 2, nodes: [0.2, 0.42, 0.62, 0.8] }],
      twigs: [
        T([1880, 1000], -150, 260, 0.04, 2, 85, 0.3),
        T([1870, 900], -165, 220, 0.04, 2, 80, 0.4),
        T([1860, 1080], -130, 300, 0.06, 2, 85, 0.2, { rise: true }),
        T([1900, 950], -120, 180, 0.45, 1, 80, 0.4),
        T([1920, 1050], -150, 250, 0.5, 1, 80, 0.4),
      ],
    });
    return {
      layers: [paper, ...grove.layers({ amp: 4 }), ...clump.layers({ amp: 4 })],
      meta: { clear: PAPER07.map((v) => v / 255) },
    };
  },
};
