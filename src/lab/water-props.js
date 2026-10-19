// Placeholder props for the water lab scenes (islands, peaks, cliffs, mist,
// paper). Not part of the film: just enough form and value to judge water and
// reflections against the references.
import { blob, dots, stroke, inkCss, rgba, tone, granulate } from '../lib/brush.js';
import { inkify } from '../lib/inkfx.js';

export function paperLayer(api, rgb = [239, 231, 220], { top = null } = {}) {
  const c = rgb.map((v) => (v / 255).toFixed(4)).join(',');
  const t = (top || rgb).map((v) => (v / 255).toFixed(4)).join(',');
  return api.shader(/* glsl */`
    vec4 shade(vec2 p, vec2 uv) {
      vec3 c = mix(vec3(${t}), vec3(${c}), smoothstep(0.0, 700.0, p.y));
      c *= 1.0 + 0.012 * fbm(p * 0.0025, 3);
      return vec4(c, 1.0);
    }`, { z: 1e5, name: 'paper' });
}

// soft grey night sky wash with cloud bands (ref 03)
export function nightSky(api) {
  return api.shader(/* glsl */`
    vec4 shade(vec2 p, vec2 uv) {
      float band = smoothstep(560.0, 80.0, p.y);
      float n = fbm(vec2(p.x * 0.0018, p.y * 0.006) + vec2(uTime * 0.004, 0.0), 5);
      float cl = smoothstep(-0.1, 0.6, n) * band;
      float a = clamp(0.18 * band + 0.32 * cl, 0.0, 0.6);
      vec2 d = p - vec2(1325.0, 225.0);
      float moon = 1.0 - smoothstep(84.0, 86.0, length(d));
      float halo = exp(-max(length(d) - 85.0, 0.0) / 60.0);
      a *= 1.0 - 0.8 * halo;
      vec3 ink = vec3(0.30, 0.29, 0.28);
      vec4 o = vec4(ink * a, a);
      vec3 mc = vec3(0.97, 0.95, 0.89) - 0.06 * smoothstep(0.2, 0.7, fbm(d * 0.03, 3));
      o = mix(o, vec4(mc, 1.0), moon);
      return o;
    }`, { z: 1e5, name: 'sky', rect: [-480, -270, 2880, 1000] });
}

// Distant peak silhouettes: list of [x, w, h]
export function paintPeaks(ctx, rng, baseY, peaks, { tone: tv = 0.6, fade = 140 } = {}) {
  for (const [x, w, h] of peaks) {
    const pts = [];
    const n = 24;
    for (let i = 0; i <= n; i++) {
      const s = i / n;
      const bell = Math.pow(Math.sin(Math.PI * s), 1.3);
      pts.push([x - w / 2 + s * w, baseY - h * bell * (0.85 + 0.15 * rng())]);
    }
    const g = ctx.createLinearGradient(0, baseY - h, 0, baseY);
    g.addColorStop(0, inkCss(tv, 0.9));
    g.addColorStop(1, inkCss(tv, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], baseY);
    for (const p of pts) ctx.lineTo(p[0], p[1]);
    ctx.lineTo(pts[pts.length - 1][0], baseY);
    ctx.closePath();
    ctx.fill();
  }
}

function conifer(ctx, rng, x, y, h, v) {
  const tiers = 4 + ((rng() * 3) | 0);
  stroke(ctx, [[x, y], [x + rng.range(-2, 2), y - h * 0.5], [x + rng.range(-2, 2), y - h]], { width: Math.max(1.2, h * 0.06), color: inkCss(v, 0.95), rng, profile: 'taper' });
  for (let i = 0; i < tiers; i++) {
    const s = i / (tiers - 1);
    const ty = y - h * (0.28 + 0.72 * s);
    const tw = h * 0.42 * (1 - s * 0.7) * (0.75 + 0.5 * rng());
    const side = rng.range(-0.25, 0.25) * tw;
    for (let k = 0; k < 3; k++) {
      blob(ctx, x + side + rng.range(-0.4, 0.4) * tw, ty + rng.range(-1, 1), tw * rng.range(0.45, 0.7), { color: inkCss(v + rng.range(-0.04, 0.06), 0.9), rng, irregular: 0.5, squash: 0.4, sides: 9 });
    }
  }
}

// Rocky island with trees, waterline at baseY.
export function paintIsland(ctx, rng, { x0, x1, baseY, h, trees = 6, v = 0.12, treeH = 40 }) {
  const w = x1 - x0;
  const n = 40;
  const bumps = [[0.35 + rng.range(-0.1, 0.1), 1, 0.16], [0.62 + rng.range(-0.1, 0.1), 0.75, 0.14], [0.15, 0.35, 0.08], [0.85, 0.4, 0.09]];
  const prof = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    let hh = 0;
    for (const [c, a, sg] of bumps) hh = Math.max(hh, a * Math.exp(-Math.pow((s - c) / sg, 2) * 0.5));
    hh = Math.min(1, hh * (0.9 + 0.2 * rng())) * Math.min(1, s * 12, (1 - s) * 12);
    prof.push([x0 + s * w, baseY - h * hh]);
  }
  const shape = new Path2D();
  shape.moveTo(x0, baseY);
  for (const p of prof) shape.lineTo(p[0], p[1]);
  shape.lineTo(x1, baseY); shape.closePath();
  const g = ctx.createLinearGradient(0, baseY - h, 0, baseY);
  g.addColorStop(0, inkCss(v + 0.18, 0.95));
  g.addColorStop(1, inkCss(v + 0.42, 0.95));
  ctx.fillStyle = g; ctx.fill(shape);
  ctx.save(); ctx.clip(shape);
  for (let i = 0; i < 70; i++) {
    const x = x0 + rng() * w, y = baseY - rng() * h;
    const len = rng.range(8, 26);
    const ang = rng.range(-0.9, 0.9) + Math.PI / 2;
    stroke(ctx, [[x, y], [x + Math.cos(ang) * len, y + Math.sin(ang) * len]], { width: rng.range(2, 7), color: inkCss(v + rng.range(-0.05, 0.3), rng.range(0.4, 0.85)), rng });
  }
  ctx.restore();
  // dark ragged contour along the top
  for (let i = 0; i < n; i += 2) {
    const a = prof[i], b = prof[Math.min(n, i + 3)];
    stroke(ctx, [a, b], { width: rng.range(2, 5), color: inkCss(v, 0.9), rng });
  }
  dots(ctx, x0 + w * 0.45, baseY - h * 0.75, w * 0.3, 40, { size: [1.5, 3.5], rng, color: inkCss(v * 0.5, 1), squash: 0.25 });
  // flat spit at the waterline
  ctx.fillStyle = inkCss(v + 0.4, 0.8);
  ctx.beginPath(); ctx.ellipse(x0 + w * 0.5, baseY, w * 0.56, 3.5, 0, Math.PI, 0); ctx.fill();
  for (let i = 0; i < trees; i++) {
    const s = 0.12 + 0.76 * (i + rng()) / trees;
    const k = Math.round(s * n);
    const tx = prof[k][0], ty = prof[k][1] + 4;
    conifer(ctx, rng, tx, ty, treeH * (0.55 + 0.6 * rng()) * (0.6 + 0.6 * (baseY - ty) / h), v * 0.5);
  }
}
// Dark cliff mass placeholder: polygon pts, value v
export function paintCliff(ctx, rng, pts, { v = 0.12, fadeY = null } = {}) {
  ctx.save();
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts) ctx.lineTo(p[0], p[1]);
  ctx.closePath();
  ctx.fillStyle = inkCss(v + 0.25, 0.95);
  ctx.fill();
  ctx.clip();
  for (let i = 0; i < 260; i++) {
    const x = rng.range(-50, 1950), y = rng.range(0, 1100);
    stroke(ctx, [[x, y], [x + rng.range(-6, 6), y + rng.range(40, 140)]], { width: rng.range(6, 22), color: inkCss(v + rng.range(-0.1, 0.25), rng.range(0.3, 0.8)), rng, profile: 'brush' });
  }
  ctx.restore();
}

export function bakeInked(api, w, h, draw, opts = {}) {
  const raw = api.bakeCanvas(w, h, draw, { scale: opts.scale ?? 1 });
  return inkify(api, raw, { edge: 0.5, granulation: 0.25, bleed: 1.2, ...(opts.ink || {}) });
}

// soft mist band: y0..y1 with billows
export function mistLayer(api, { y0, y1, x0 = -480, x1 = 2400, z = 1.2, amount = 0.9, scale = 1, speed = 8, rgb = [239, 231, 220], name = 'mist' }) {
  const c = rgb.map((v) => (v / 255).toFixed(4)).join(',');
  return api.shader(/* glsl */`
    vec4 shade(vec2 p, vec2 uv) {
      float n = fbm3(vec3(p * vec2(0.0022, 0.005) / ${scale.toFixed(3)} + vec2(uTime * ${(speed * 0.0022 / scale).toFixed(5)}, 0.0), uTime * 0.04), 5) * 0.5 + 0.5;
      float band = smoothstep(${y0.toFixed(1)}, ${(y0 + (y1 - y0) * 0.45).toFixed(1)}, p.y) * (1.0 - smoothstep(${(y0 + (y1 - y0) * 0.6).toFixed(1)}, ${y1.toFixed(1)}, p.y));
      float edge = smoothstep(${x0.toFixed(1)}, ${(x0 + 200).toFixed(1)}, p.x) * (1.0 - smoothstep(${(x1 - 300).toFixed(1)}, ${x1.toFixed(1)}, p.x));
      float a = clamp(band * edge * (n * 1.6 - 0.25), 0.0, 1.0) * ${amount.toFixed(3)};
      return vec4(vec3(${c}) * a, a);
    }`, { z, name, rect: [x0, y0, x1 - x0, y1 - y0] });
}
