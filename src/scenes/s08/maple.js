// s08 maples: a copy of lib/flora.js paintMaple/makeMaple tuned for ref 08's leaf clusters.
// Changes vs the library: small leaf dabs with uneven alpha and size, leaves at the rim of each clump
// smaller and paler (airy edges), a few stray leaves outside the clumps, and ink-dark leaves split
// between behind and in front of the red so they read inside the clusters.
import { rgba, tone, PAPER } from '../../lib/brush.js';
import { inkify } from '../../lib/inkfx.js';
import { makeRng, clamp, mix } from '../../engine/rng.js';
import { planMaple, paintMapleDab, paintMapleBranches, withBlur, MAPLE_PALETTES } from '../../lib/flora.js';

const TAU = Math.PI * 2;
const col = (v, paper) => tone(clamp(v, 0, 1), paper || PAPER);
const mixC = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
function rngOf(o, salt) {
  if (o.rng) return o.rng.fork ? o.rng.fork(salt) : o.rng;
  return makeRng('flora:' + salt + ':' + (o.seed ?? 1));
}

export function paintMaple08(ctx, opts = {}) {
  const rng = rngOf(opts, 'maple-paint');
  const plan = opts.plan || planMaple(opts);
  const paper = opts.paper || PAPER;
  const pal = typeof opts.palette === 'object' ? opts.palette : MAPLE_PALETTES[opts.palette || 'vermilion'];
  const H = plan.height;
  const leafR = opts.leafSize ?? Math.max(2.5, H * 0.03);
  const density = opts.density ?? 1;
  const inkFrac = opts.inkLeaves ?? 0.2;
  const paleFrac = opts.pale ?? 0.2;
  const bcol = col(opts.branchTone ?? 0.03, paper);
  const [cx, cy, rx, ry] = plan.crown;
  const maxD = Math.max(...plan.segs.map((s) => s.depth));
  const groups = [];
  const upOf = (py) => clamp((cy - py) / (ry || 1) * 0.5 + 0.5, 0, 1);
  const cr = leafR * (opts.clusterSpread ?? 3.2);
  for (const t of plan.tips) {
    const g = [];
    const n = Math.max(1, Math.round((opts.cluster ?? 4) * rng.range(0.5, 1.5)));
    const ox = t.p[0] + Math.cos(t.a) * cr * 0.3, oy = t.p[1] + Math.sin(t.a) * cr * 0.2 - cr * 0.2;
    for (let i = 0; i < n; i++) {
      const a = rng() * TAU, e = Math.sqrt(rng());
      const px = ox + Math.cos(a) * e * cr, py = oy + Math.sin(a) * e * cr * 0.75;
      // rim leaves (e -> 1) are smaller and lighter: the clump dissolves at its edge
      g.push({ x: px, y: py, up: upOf(py), rim: e, r: leafR * rng.range(0.7, 1.2) * (1.08 - 0.25 * e * e) });
    }
    groups.push(g);
  }
  for (const s of plan.segs) if (s.depth >= Math.max(2, maxD - 3)) {
    const g = [];
    for (let k = 1; k < s.pts.length; k++) {
      if (!rng.chance(opts.alongTwigs ?? 0.75)) continue;
      const q = s.pts[k];
      const nb = rng.int(1, 2);
      for (let j = 0; j < nb; j++) g.push({ x: q[0] + rng.range(-1.2, 1.2) * leafR, y: q[1] + rng.range(-1.3, 0.6) * leafR, up: upOf(q[1]), rim: 0.8, r: leafR * rng.range(0.6, 1.0) });
    }
    if (g.length) groups.push(g);
  }
  const sites = [];
  {
    const area = Math.PI * rx * ry;
    const target = Math.round(density * (opts.coverage ?? 0.8) * area / (Math.PI * leafR * leafR));
    for (let i = groups.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = groups[i]; groups[i] = groups[j]; groups[j] = t; }
    const total = groups.reduce((s, g) => s + g.length, 0);
    const keepWhole = clamp((target - groups.length) / Math.max(1, total - groups.length), 0, 1);
    for (const g of groups) { if (rng() < keepWhole) sites.push(...g); else sites.push(g[0]); }
  }
  // stray leaves just outside the clumps
  const strays = [];
  const nStray = Math.round(sites.length * (opts.strays ?? 0.05));
  for (let i = 0; i < nStray; i++) {
    const s = sites[Math.floor(rng() * sites.length)];
    const a = rng() * TAU, d = cr * rng.range(0.8, 1.6);
    strays.push({ x: s.x + Math.cos(a) * d, y: s.y + Math.sin(a) * d * 0.8, up: s.up, rim: 1, r: leafR * rng.range(0.55, 0.85) });
  }
  const back = [], inkB = [], inkF = [], front = [];
  for (const s of sites) {
    const u = rng();
    if (u < paleFrac * (1.45 - s.up * 0.9)) back.push(s);
    else if (u < paleFrac + inkFrac) (rng.chance(0.5) ? inkF : inkB).push(s);
    else front.push(s);
  }
  front.push(...strays);
  const inkDab = (g, s) => paintMapleDab(g, s.x, s.y, s.r * rng.range(0.75, 1.0), { color: col(rng.range(0.03, 0.32), paper), alpha: rng.range(0.55, 0.92), rot: rng() * TAU, lobes: rng.int(3, 5), rng });
  withBlur(ctx, opts.blur ?? 0, (g) => {
    for (const s of back) paintMapleDab(g, s.x, s.y, s.r * rng.range(1.0, 1.4), { color: rng.chance(0.3) ? mixC(pal.pale, pal.mid, 0.3) : pal.pale, alpha: rng.range(0.25, 0.55), rot: rng() * TAU, lobes: rng.int(3, 5), rng });
    for (const s of inkB) inkDab(g, s);
    const tiers = [[], [], []];
    for (const s of front) { const v = rng() - s.up * 0.15; tiers[v < 0.2 ? 0 : v < 0.58 ? 1 : 2].push(s); }
    // alpha falls off toward the clump rim and varies per leaf (wet / dry dabs)
    const al = (s, lo, hi) => rng.range(lo, hi) * (1 - 0.2 * s.rim * s.rim);
    const dab = (s, t) => {
      g.save(); g.globalCompositeOperation = 'multiply';
      if (t === 0) paintMapleDab(g, s.x, s.y, s.r, { color: mixC(pal.dark, pal.mid, rng() * 0.5), alpha: al(s, 0.55, 0.85), rot: rng() * TAU, lobes: rng.chance(0.7) ? 5 : 4, rng });
      else paintMapleDab(g, s.x, s.y, s.r, { color: mixC(pal.mid, pal.bright, rng() * 0.4), alpha: al(s, 0.7, 0.95), rot: rng() * TAU, lobes: rng.chance(0.7) ? 5 : 4, rng });
      g.restore();
    };
    for (const s of tiers[0]) dab(s, 0);
    const midBack = new Set(tiers[1].filter(() => rng.chance(0.45)));
    for (const s of midBack) dab(s, 1);
    paintMapleBranches(g, plan, { color: bcol, rng, gnarl: opts.gnarl ?? (H > 250 ? 0.8 : 0.4), paper, dry: opts.dry ?? (H > 200 ? 0.6 : 0.25) });
    for (const s of tiers[1]) if (!midBack.has(s)) dab(s, 1);
    for (const s of tiers[2]) paintMapleDab(g, s.x, s.y, s.r * rng.range(0.8, 1.1), { color: mixC(pal.bright, pal.mid, rng() * 0.35), alpha: al(s, 0.75, 0.97), rot: rng() * TAU, lobes: rng.chance(0.75) ? 5 : 4, rng });
    for (const s of inkF) inkDab(g, s);
  });
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const s of sites) { x0 = Math.min(x0, s.x - s.r * 2); y0 = Math.min(y0, s.y - s.r * 2); x1 = Math.max(x1, s.x + s.r * 2); y1 = Math.max(y1, s.y + s.r * 2); }
  return { base: plan.base, crown: [cx, cy], radius: Math.max(rx, ry, H), bounds: [x0, y0, x1, y1] };
}

// bake several maples into one card (same contract as lib makeMaple; rect required)
export function makeMaple08(api, opts = {}) {
  const trees = opts.trees;
  const paper = opts.paper || PAPER;
  const [rx, ry, rw, rh] = opts.rect;
  const infos = [];
  const raw = api.bakeCanvas(rw, rh, (ctx) => {
    ctx.translate(-rx, -ry);
    trees.forEach((t, i) => infos.push(paintMaple08(ctx, { paper, seed: (opts.seed ?? 1) * 31 + i, ...t })));
  }, { scale: opts.scale ?? 1 });
  const src = inkify(api, raw, opts.ink || { edge: 0.4, granulation: 0.14, bleed: 0.9 });
  if (api.engine && api.engine.freeTex) api.engine.freeTex(raw);
  const anchor = opts.anchor || infos[0].base;
  const radius = opts.radius || Math.max(...infos.map((f) => f.radius));
  const layer = ({ z = 1, amp = 3, freq = 0.2, scale = 380, opacity = 1, power = 1.7 } = {}) =>
    api.tex(src, { rect: opts.rect, z, opacity, name: 'maple', sway: { amp, freq, scale, power, anchor, radius } });
  return { src, rect: opts.rect, trees: infos, anchor, radius, layer };
}
