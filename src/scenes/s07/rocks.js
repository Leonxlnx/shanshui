// s07 rocks: boulders / cliff masses painted as one GLSL bake from hand-drawn field maps.
// Field canvas (opaque black, rgb only): R = rock mask (soft 1.5 px edge), G = darkening
// (crown band under the top contour, shadow planes, contour), B = lit planes.
// The shader turns the fields into ink: mottled wash, sponge granulation with paper specks,
// vertical cun texture, a dark wet crown, ragged edges.
import { makeRng, makeNoise } from '../../engine/rng.js';

const ROCK_FS = /* glsl */ `
uniform sampler2D uF;
uniform vec4 uRect;
uniform vec3 uPaperC, uInkC;
uniform vec4 uLook;   // face tone (0 ink..1 paper), crown strength, texture amount, speckle
uniform vec4 uLook2;  // cun amount, edge raggedness, seed, far (0..1 flatten)
vec4 shade(vec2 q, vec2 uv) {
  vec2 p = q + uRect.xy;
  vec3 F = texture(uF, uv).rgb;
  float sd = uLook2.z * 17.3;
  float n1 = fbm(p / 70.0 + sd, 4);
  float n2 = fbm(p / 18.0 + sd * 1.7, 3);
  float rag = (n2 * 0.6 + snoise(p / 5.0 + sd) * 0.4) * uLook2.y;
  float a = smoothstep(0.38, 0.62, F.r + rag * 0.35);
  if (a <= 0.002) return vec4(0.0);
  // wet washes: a warped field, cut into tiers with soft edges and pooled rims (wet-in-wet ink)
  float face = 1.0 - uLook.x;
  vec2 w = vec2(fbm(p / 140.0 + sd, 3), fbm(p / 140.0 + sd + 5.2, 3));
  float W = fbm(p / 48.0 + w * 1.4 + sd * 0.7, 5) * 0.5 + 0.5;
  float W2 = fbm(p / 16.0 + w * 2.0 + sd * 1.3, 3) * 0.5 + 0.5;
  // region: 0 lit plane .. 1 deep shadow / crown
  float region = clamp(face + (W - 0.5) * 0.45 * uLook.z - F.b * 0.8 + F.g * 0.35, 0.0, 1.0);
  // 1. soft broad wash with large mottling
  float d = mix(0.20, 0.80, region) + (W2 - 0.5) * 0.10 + fbm(p / 30.0 + sd * 3.1, 3) * 0.10;
  // 2. large soft dark patches where the region is dark
  float bf = fbm(p / 46.0 + w * 0.3 + sd * 1.9, 4) * 0.5 + 0.5;
  float th = 0.86 - 0.42 * region;
  float B = smoothstep(th - 0.07, th + 0.05, bf);
  d = mix(d, 0.9, B * 0.75 * uLook.z);
  // 3. crown / shadow-plane ink: crisp blobby edge from the G field
  float cf = F.g * uLook.y + fbm(p / 13.0 + sd * 0.9, 3) * 0.22 + (0.4 - worley(p / 16.0 + sd)) * 0.12;
  float Cr = smoothstep(0.42, 0.50, cf);
  d = mix(d, 0.93 + 0.05 * W2, Cr);
  // 4. vertical cun streaks in the mid tones, dry hemp strokes in the lit planes
  // long vertical fissure strokes: ridges of a vertically stretched warped noise, broken in places
  float wx = p.x + 10.0 * snoise(vec2(p.x / 60.0, p.y / 90.0) + sd);
  float rid = 1.0 - abs(snoise(vec2(wx / 15.0, p.y / 420.0) + sd * 1.3));
  float rid2 = 1.0 - abs(snoise(vec2(wx / 6.0, p.y / 160.0) + sd * 2.1));
  float brk2 = smoothstep(-0.5, 0.2, snoise(vec2(p.x / 40.0, p.y / 140.0) + sd * 0.7));
  float fiss = smoothstep(0.86, 0.96, rid) * brk2 + smoothstep(0.9, 0.97, rid2) * 0.45 * brk2;
  d = mix(d, 0.82, clamp(fiss * uLook2.x * 0.55, 0.0, 1.0) * (1.0 - Cr));
  float hemp = streaks(p * vec2(0.05, 0.012) * mat2(0.8, -0.6, 0.6, 0.8) + sd, vec2(0.0, 1.0), 7.0, 4);
  d += uLook2.x * 0.4 * smoothstep(0.35, 0.8, hemp) * F.b;
  // 5. sparse paper flecks inside the dark ink
  float g2 = vnoise(p * 0.5 + sd) * 0.6 + vnoise(p * 1.25 + sd * 1.7) * 0.4;
  float speck = smoothstep(0.70, 0.76, g2) * smoothstep(0.5, 0.8, fbm(p / 40.0 + sd * 4.1, 2) * 0.5 + 0.5 + 0.15);
  d -= speck * uLook.w * 0.5 * smoothstep(0.6, 0.9, d);  d = mix(d, face, uLook2.w);
  d = clamp(d, 0.0, 1.0);
  vec3 col = mix(uPaperC, uInkC, d);
  return vec4(col * a, a);
}`;

function trace(ctx, pts) { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); }

function roughen(pts, nz, amp, seed) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.round(L / 6));
    for (let k = 0; k < n; k++) {
      const s = k / n;
      const x = a[0] + (b[0] - a[0]) * s, y = a[1] + (b[1] - a[1]) * s;
      const o = nz.n2(x * 0.03 + seed, y * 0.03) * amp + nz.n2(x * 0.11, y * 0.11 + seed) * amp * 0.35;
      out.push([x + o * 0.6, y + o]);
    }
  }
  return out;
}

// items: [{ outline, top: [[x,y]...] (top contour polyline), crown: px depth of the dark band,
//           dark: [[poly], ...] shadow planes, lit: [[poly], ...], fade: [y0, y1] (fade to paper at bottom) }]
export function makeRocks(api, { rect, items, paper, ink = [12, 10, 8], look = {}, seed = 1, scale = 1 }) {
  const [rx, ry, rw, rh] = rect;
  const nz = makeNoise('s07rock:' + seed);
  const rng = makeRng('s07rock:' + seed);
  const fld = api.bakeCanvas(rw, rh, (ctx) => {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, rw, rh);
    ctx.translate(-rx, -ry);
    ctx.globalCompositeOperation = 'lighter';
    items.forEach((it, idx) => {
      const out = roughen(it.outline, nz, it.rough ?? 3, idx * 7.1);
      ctx.save();
      // mask, faded to nothing toward the bottom if requested
      ctx.filter = 'blur(1.2px)';
      if (it.fade) {
        const g = ctx.createLinearGradient(0, it.fade[0], 0, it.fade[1]);
        g.addColorStop(0, 'rgb(255,0,0)'); g.addColorStop(1, 'rgb(0,0,0)');
        ctx.fillStyle = g;
      } else ctx.fillStyle = 'rgb(255,0,0)';
      trace(ctx, out); ctx.fill();
      ctx.restore();
      ctx.save();
      trace(ctx, out); ctx.clip();
      // crown: dark band under the top contour (wet ink soaked under moss), ragged lower edge
      if (it.top) {
        const cr = it.crown ?? 40;
        ctx.filter = `blur(${(cr * 0.35).toFixed(1)}px)`;
        ctx.strokeStyle = 'rgba(0,200,0,1)';
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.lineWidth = cr;
        ctx.beginPath(); it.top.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1] + cr * 0.15) : ctx.moveTo(p[0], p[1] + cr * 0.15))); ctx.stroke();
        // drips running down from the crown
        ctx.filter = 'blur(3px)';
        for (let i = 0; i < it.top.length - 1; i++) {
          const a = it.top[i], b = it.top[i + 1];
          const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
          for (let k = 0; k < L / 14; k++) {
            if (rng() > (it.drips ?? 0.2)) continue;
            const s = rng();
            const x = a[0] + (b[0] - a[0]) * s, y = a[1] + (b[1] - a[1]) * s;
            const len = cr * (0.3 + Math.pow(rng(), 2) * 2.4);
            ctx.fillStyle = `rgba(0,${(120 + rng() * 120) | 0},0,1)`;
            ctx.beginPath(); ctx.ellipse(x + (rng() - 0.5) * 6, y + len * 0.5, 3 + rng() * 9, len * 0.5, (rng() - 0.5) * 0.6, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
      ctx.filter = 'blur(6px)';
      for (const d of it.dark || []) { ctx.fillStyle = `rgba(0,${d.a ?? 150},0,1)`; trace(ctx, d.poly || d); ctx.fill(); }
      ctx.filter = 'blur(8px)';
      for (const l of it.lit || []) { ctx.fillStyle = `rgba(0,0,${l.a ?? 200},1)`; trace(ctx, l.poly || l); ctx.fill(); }
      // contour: dark dry line along the outline sides (not the faded bottom)
      ctx.filter = 'blur(1.4px)';
      ctx.strokeStyle = 'rgba(0,170,0,1)';
      for (const seg of it.contour || []) {
        ctx.lineWidth = seg.w ?? 5;
        ctx.beginPath(); seg.pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
      }
      ctx.restore();
    });
  }, { scale });
  const L = { tone: 0.5, crown: 0.9, texture: 1, speckle: 1, cun: 1, rag: 1, far: 0, ...look };
  const src = api.bakeShader(rw, rh, ROCK_FS, {
    scale,
    uniforms: {
      uF: fld, uRect: rect, uPaperC: paper.map((v) => v / 255), uInkC: ink.map((v) => v / 255),
      uLook: [L.tone, L.crown, L.texture, L.speckle], uLook2: [L.cun, L.rag, seed * 0.37 % 7, L.far],
    },
  });
  if (api.engine && api.engine.freeTex) api.engine.freeTex(fld);
  return { src, rect, layer: (o = {}) => api.tex(src, { rect, ...o }) };
}
