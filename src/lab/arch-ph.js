// Placeholder terrain for the architecture lab scenes (not a scene; shared helpers).
// Simple ink-wash pillar peaks / cliff tops so buildings can be judged in context.
import { blob, inkCss, rgba, tone } from '../lib/brush.js';

// A pillar peak: flat-ish top at (x, y), width w, height h, ink value v (0 black .. 1 paper).
export function pillar(ctx, r, x, y, w, h, v = 0.35, { paper } = {}) {
  const pts = [];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const xx = x - w / 2 + w * t;
    const top = y + Math.pow(Math.abs(t - 0.5) * 2, 2.2) * h * 0.18 + (r() - 0.5) * w * 0.04;
    pts.push([xx, top]);
  }
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  const c = tone(v, paper);
  g.addColorStop(0, rgba(c, 0.95)); g.addColorStop(0.55, rgba(c, 0.55)); g.addColorStop(1, rgba(c, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - w * 0.08, y + h);
  for (const p of pts) ctx.lineTo(p[0], p[1]);
  ctx.lineTo(x + w / 2 + w * 0.08, y + h);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < w * 0.6; i++) {
    const t = r();
    blob(ctx, x - w / 2 + w * t, y + r() * h * 0.25 + Math.abs(t - 0.5) * h * 0.1, 1 + r() * w * 0.05, { color: inkCss(Math.max(0, v - 0.25 - r() * 0.1), 0.5 + r() * 0.5, paper), rng: r });
  }
}

export const paperShader = (rgb) => `vec4 shade(vec2 p, vec2 uv){ return vec4(vec3(${rgb.map((v) => (v / 255).toFixed(4)).join(',')}), 1.); }`;
