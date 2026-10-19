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
uniform vec4 uLook;   // face tone (0 ink..1 paper), crown strength, blotch amount, speckle
uniform vec4 uLook2;  // cun density, edge raggedness, seed, far (0..1 flatten)
uniform vec4 uLook3;  // stroke angle (rad, 0 = vertical), stroke scale, moss dots, dryness
uniform vec4 uLook4;  // blotch anisotropy, stroke angle jitter, blotch scale, stroke darkness

vec3 fieldAt(vec2 p) { return texture(uF, (p - uRect.xy) / uRect.zw).rgb; }

// cun: tapered dry-brush strokes scattered on a jittered grid in stroke space. Each stroke is
// pressed (blunt start), tapers to a tip, bends slightly and opens into bristle gaps (flying white).
float cun(vec2 p, float sd) {
  float ang = uLook3.x, sc = uLook3.y;
  float ca = cos(ang), sa = sin(ang);
  mat2 R = mat2(ca, sa, -sa, ca);
  vec2 q = R * p;
  vec2 cell = vec2(8.5, 115.0) * sc;
  vec2 id = floor(q / cell);
  float acc = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = id + vec2(float(i), float(j));
    vec2 h2 = hash22(c + sd);
    float h3 = hash12(c * 1.37 + sd * 2.1);
    float h4 = hash12(c * 0.71 + sd * 3.3 + 9.1);
    vec2 ctr = (c + vec2(0.5) + (h2 - 0.5) * vec2(0.9, 0.8)) * cell;
    vec3 Fc = fieldAt(transpose(R) * ctr);
    float want = uLook2.x * (0.3 + 0.55 * Fc.g - 0.3 * Fc.b) * step(0.5, Fc.r);
    if (h4 > want) continue;
    float len = cell.y * (0.5 + 0.95 * h3);
    float t = (q.y - ctr.y) / len + 0.5;
    if (t < 0.0 || t > 1.0) continue;
    float w = sc * (1.4 + 5.0 * h2.x * h2.x);
    float bend = (h3 - 0.5) * 4.0 * sc;
    float off = bend * (1.0 - (2.0 * t - 1.0) * (2.0 * t - 1.0)) + (q.y - ctr.y) * (hash12(c * 2.3 + sd) - 0.5) * uLook4.y + snoise(vec2(q.y / 40.0, h4 * 40.0)) * 0.7 * sc;
    float wid = w * (0.75 + 0.25 * smoothstep(0.0, 0.08, t)) * (1.0 - 0.8 * pow(t, 1.6));
    float dd = abs(q.x - ctr.x - off);
    float core = h3 > 0.62 ? 1.0 - smoothstep(wid * 0.15, wid * 1.2, dd) : 1.0 - smoothstep(wid * 0.5, wid, dd);
    float br = vnoise(vec2((q.x - ctr.x - off) / (0.75 * sc) + h3 * 37.0, q.y / (28.0 * sc)));
    float g = mix(0.1, 0.72, pow(t, 1.3) * uLook3.w) + 0.08;
    float ink = smoothstep(g, g + 0.14, br) * smoothstep(0.0, 0.025, t);
    acc = max(acc, core * ink * (0.45 + 0.55 * h2.y));
  }
  return acc;
}

// dian: moss dots, clustered where the crown / shadow field is strong
float dots(vec2 p, float sd) {
  vec2 cs = vec2(10.0);
  vec2 id = floor(p / cs);
  float acc = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = id + vec2(float(i), float(j));
    vec2 ctr = (c + 0.15 + 0.7 * hash22(c + sd * 1.9)) * cs;
    vec3 Fc = fieldAt(ctr);
    float want = uLook3.z * smoothstep(0.22, 0.6, Fc.g) * 0.8 * step(0.55, Fc.r);
    if (hash12(c + sd * 4.7) > want) continue;
    float r = 1.2 + 3.4 * pow(hash12(c * 1.9 + sd), 2.0);
    vec2 dv = (p - ctr) * vec2(0.78, 1.2);
    float dist = length(dv) + snoise(p / 1.7 + sd) * 0.45;
    acc = max(acc, (1.0 - smoothstep(r * 0.55, r, dist)) * (0.65 + 0.35 * hash12(c + 1.3)));
  }
  return acc;
}

vec4 shade(vec2 q, vec2 uv) {
  vec2 p = q + uRect.xy;
  vec3 F = texture(uF, uv).rgb;
  float sd = uLook2.z * 17.3;
  float rag = (fbm(p / 18.0 + sd * 1.7, 3) * 0.6 + snoise(p / 5.0 + sd) * 0.4) * uLook2.y;
  float a = smoothstep(0.38, 0.62, F.r + rag * 0.35);
  if (a <= 0.002) return vec4(0.0);
  float face = 1.0 - uLook.x;
  vec2 w = vec2(fbm(p / 140.0 + sd, 3), fbm(p / 140.0 + sd + 5.2, 3));
  float W = fbm(p / 60.0 + w * 1.4 + sd * 0.7, 4) * 0.5 + 0.5;
  float W2 = fbm(p / 16.0 + w * 2.0 + sd * 1.3, 3) * 0.5 + 0.5;
  // region: 0 lit plane .. 1 deep shadow / crown
  float region = clamp(face + (W - 0.5) * 0.35 - F.b * 0.75 + F.g * 0.45, 0.0, 1.0);
  // 1. pale base wash, gently uneven
  float d = mix(0.08, 0.55, region) + fbm(p / 26.0 + sd * 3.1, 3) * 0.06;
  // 2. wet blotches: a broad warped field, dragged along the brush direction, cut into soft-edged
  //    ink pools that darken toward their centre, feathered edges and a faint grey bleed halo
  float ca = cos(uLook3.x), sa = sin(uLook3.x);
  vec2 qs = mat2(ca, sa, -sa, ca) * p;
  float bf = fbm(qs / (vec2(48.0, 48.0 * uLook4.x) * uLook4.z) + w * 0.45 + sd * 1.9, 3) * 0.5 + 0.5 + fbm(p / 6.0 + sd, 2) * 0.025;
  float th = mix(0.68, 0.40, region) + (1.0 - uLook.z) * 0.14;
  float inB = smoothstep(th - 0.09, th + 0.08, bf);
  float halo = smoothstep(th - 0.12, th - 0.04, bf) * (1.0 - inB);
  float bd = 0.6 + clamp(bf - th, 0.0, 0.2) * 1.5 + (W2 - 0.5) * 0.14;
  d = mix(d, max(d, clamp(bd, 0.0, 0.93)), inB) + halo * 0.08;
  // vertical drag texture inside the wash (bristle streaks of a wide wet brush)
  float drag = fbm(qs / vec2(14.0, 160.0) + w * 0.5 + sd * 2.9, 3);
  d += drag * 0.1 * smoothstep(0.05, 0.5, d) * uLook.z;
  // 3. crown: wet ink under the top contour, blotchy broken lower edge
  float cf = F.g * uLook.y + (bf - 0.5) * 0.55 + fbm(p / 9.0 + sd, 2) * 0.08;
  float Cr = smoothstep(0.5, 0.66, cf);
  d = mix(d, 0.9 + 0.06 * W2, Cr);
  // 4. cun strokes and moss dots
  d = max(d, cun(p, sd) * uLook4.w);
  d = max(d, dots(p, sd) * 0.95);
  // 5. paper flecks inside dark ink, pigment granulation
  float g2 = vnoise(p * 0.5 + sd) * 0.6 + vnoise(p * 1.25 + sd * 1.7) * 0.4;
  float speck = smoothstep(0.70, 0.76, g2) * smoothstep(0.5, 0.8, fbm(p / 40.0 + sd * 4.1, 2) * 0.5 + 0.65);
  d -= speck * uLook.w * 0.45 * smoothstep(0.6, 0.9, d);
  d *= 0.95 + 0.1 * vnoise(p * 0.6 + sd * 2.3);
  d = mix(d, face, uLook2.w);
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
  const L = { tone: 0.5, crown: 0.9, texture: 1, speckle: 1, cun: 1, rag: 1, far: 0, angle: 0, stroke: 1, dots: 0.5, dry: 0.8, aniso: 2.5, jitter: 0.15, blotch: 1, ink: 0.85, ...look };
  const src = api.bakeShader(rw, rh, ROCK_FS, {
    scale,
    uniforms: {
      uF: fld, uRect: rect, uPaperC: paper.map((v) => v / 255), uInkC: ink.map((v) => v / 255),
      uLook: [L.tone, L.crown, L.texture, L.speckle], uLook2: [L.cun, L.rag, seed * 0.37 % 7, L.far], uLook3: [L.angle, L.stroke, L.dots, L.dry], uLook4: [L.aniso, L.jitter, L.blotch, L.ink],
    },
  });
  if (api.engine && api.engine.freeTex) api.engine.freeTex(fld);
  return { src, rect, layer: (o = {}) => api.tex(src, { rect, ...o }) };
}
