// Scene registry: id -> module loader. Order here is reference order (ref/01..10).
export const SCENES = {
  s00: () => import('./s00-test.js'),
  s01: () => import('./s01-cranes-falls.js'),
  s02: () => import('./s02-golden-river.js'),
  s03: () => import('./s03-moon-lake.js'),
  s04: () => import('./s04-rope-bridges.js'),
  s05: () => import('./s05-arch-bridge.js'),
  s06: () => import('./s06-snow-temple.js'),
  s07: () => import('./s07-bamboo-valley.js'),
  s08: () => import('./s08-red-cascade.js'),
  s09: () => import('./s09-floating-peaks.js'),
  s10: () => import('./s10-autumn-ruins.js'),
};

export const REF = { s01: '01', s02: '02', s03: '03', s04: '04', s05: '05', s06: '06', s07: '07', s08: '08', s09: '09', s10: '10' };

