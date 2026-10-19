// Shared crane placements measured on the references (design px, body centre at t = 0,
// size = bill-tip..toe-tip length, heading0 in radians, phase = wingbeat phase at t = 0).
const D = Math.PI / 180;
export const CRANES = {
  '01': [
    { x: 1131, y: 283, size: 128, heading0: -15 * D, phase: 0.0, vx: 52, vy: -6, seed: 1 },
    { x: 1286, y: 247, size: 129, heading0: -13 * D, phase: 0.5, vx: 56, vy: -5, seed: 2 },
    { x: 1429, y: 184, size: 130, heading0: -14.6 * D, phase: 0.0, vx: 54, vy: -7, seed: 3 },
  ],
  '04': [
    { x: 1089, y: 195, size: 130, heading0: -24.6 * D, phase: 0.97, vx: 50, vy: -12, seed: 4 },
    { x: 1174, y: 198, size: 103, heading0: -12.7 * D, phase: 0.5, vx: 55, vy: -6, seed: 5 },
    { x: 1242, y: 121, size: 125, heading0: -14.9 * D, phase: 0.02, vx: 52, vy: -7, seed: 6 },
    { x: 1408, y: 120, size: 108, heading0: -16.4 * D, phase: 0.0, vx: 54, vy: -8, seed: 7 },
  ],
  '09': [
    { x: 1163, y: 173, size: 136, heading0: -24 * D, phase: 0.96, vx: 50, vy: -10, seed: 8 },
    { x: 1310, y: 221, size: 121, heading0: -13.3 * D, phase: 0.9, vx: 54, vy: -6, seed: 9 },
    { x: 1412, y: 235, size: 101, heading0: 2.6 * D, phase: 0.5, vx: 58, vy: 0, seed: 10 },
    { x: 1517, y: 271, size: 116, heading0: -12 * D, phase: 0.0, vx: 55, vy: -6, seed: 11 },
  ],
};
export const PAPERS = { '01': [239, 231, 220], '04': [239, 231, 220], '09': [240, 233, 223] };
