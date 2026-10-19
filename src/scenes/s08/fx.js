// s08 red cascade: scene-local shaders (spray mist, white water field).
// All animation is a pure function of uTime; noise is in rest-space p so it sticks to the world.

const c01 = (rgb) => rgb.map((v) => v / 255);

// ------------------------------------------------------------------ billowing spray / mist
// Up to 8 soft ellipses define where the mist sits; fbm3 billows rise and churn inside.
const SPRAY_FS = /* glsl */ `
uniform vec4 uB[8];      // cx, cy, rx, ry
uniform vec4 uBW[2];     // weights of the 8 blobs
uniform vec4 uS0;        // amount, threshold, softness, billow scale px
uniform vec4 uS1;        // rise px/s, drift px/s, evolve, seed
uniform vec4 uS2;        // shade amount, x-stretch, droplets, top crispness
uniform vec3 uMC, uSC;   // mist colour, shade colour
float bw(int i) { int j = i / 4; int k = i - j * 4; vec4 w = uBW[j]; return k == 0 ? w.x : k == 1 ? w.y : k == 2 ? w.z : w.w; }
vec4 shade(vec2 p, vec2 uv) {
  float m = 0.0;
  for (int i = 0; i < 8; i++) {
    vec4 b = uB[i];
    if (b.z <= 0.0) continue;
    vec2 d = (p - b.xy) / b.zw;
    m += bw(i) * exp(-dot(d, d) * 1.4);
  }
  if (m < 0.02) return vec4(0.0);
  float t = uTime;
  float sc = uS0.w;
  vec3 q = vec3((p.x - uS1.y * t) / (sc * uS2.y), (p.y + uS1.x * t) / sc, t * uS1.z + uS1.w);
  float n = fbm3(q, 5);
  float n2 = fbm3(q * vec3(2.6, 2.6, 1.3) + 7.0, 3);
  float f = m + 0.55 * n + 0.18 * n2 - uS0.y;
  float a = smoothstep(-uS0.z, uS0.z, f);
  // grey creeping into the folds between billows (offset sample = light from above)
  float nb = fbm3(q + vec3(0.0, -0.22, 0.0), 5);
  float sh = clamp((n - nb) * 3.6 + 0.1 + 0.12 * smoothstep(0.1, 0.7, n2), 0.0, 1.0) * uS2.x * a * (1.0 - 0.4 * a);
  a = clamp(a * uS0.x, 0.0, 1.0);
  vec3 col = mix(uMC, uSC, sh);
  return vec4(col * a, a);
}`;

export function makeSpray(api, o = {}) {
  const blobs = (o.blobs || []).slice(0, 8);
  const B = [], W = [];
  for (let i = 0; i < 8; i++) {
    const b = blobs[i];
    if (b) { B.push(b[0], b[1], b[2], b[3]); W.push(b[4] ?? 1); } else { B.push(0, 0, 0, 0); W.push(0); }
  }
  let rect = o.rect;
  if (!rect) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const b of blobs) { x0 = Math.min(x0, b[0] - b[2] * 1.6); x1 = Math.max(x1, b[0] + b[2] * 1.6); y0 = Math.min(y0, b[1] - b[3] * 1.6); y1 = Math.max(y1, b[1] + b[3] * 1.6); }
    rect = [Math.floor(x0), Math.floor(y0), Math.ceil(x1 - x0), Math.ceil(y1 - y0)];
  }
  return api.shader(SPRAY_FS, {
    name: o.name || 'spray', z: o.z ?? 2, rect, opacity: o.opacity ?? 1,
    uniforms: {
      uB: B, uBW: W,
      uS0: [o.amount ?? 1, o.threshold ?? 0.45, o.softness ?? 0.22, o.scale ?? 120],
      uS1: [o.rise ?? 12, o.drift ?? 4, o.evolve ?? 0.06, o.seed ?? 1],
      uS2: [o.shade ?? 0.3, o.stretch ?? 1.6, 0, 0],
      uMC: c01(o.color || [241, 235, 226]), uSC: c01(o.shadow || [196, 190, 182]),
    },
  });
}

// ------------------------------------------------------------------ white water field
// A baked mask (r = water body, g = falling sheet, b = churning foam) painted with Canvas2D;
// the shader animates falling hairline streaks in sheets, drifting horizontal froth in pools.
const WATER_FS = /* glsl */ `
uniform sampler2D uMask;
uniform vec4 uW0;   // fall speed px/s, streak scale px, streak darkness, seed
uniform vec4 uW1;   // foam darkness, foam drift px/s, sheet side shade, body opacity
uniform vec3 uWC, uSC;
float hair(float X, float Y, float f, float s, float hw) {
  float n = snoise(vec2(X * f + s, Y));
  float n1 = snoise(vec2((X + 1.0) * f + s, Y));
  float g = max(abs(n1 - n), 0.02 * f);
  return 1.0 - smoothstep(0.0, 1.0, abs(n) / (g * hw));
}
vec4 shade(vec2 p, vec2 uv) {
  vec4 m = texture(uMask, uv);
  float body = m.r, sheet = m.g, foam = m.b;
  if (body < 0.004) return vec4(0.0);
  float t = uTime;
  float sd = uW0.w;
  float sc = uW0.y;
  // ---- falling sheets: soft grey hairlines that slide down, broken into long dashes
  float Y = p.y - uW0.x * t;
  float l1 = hair(p.x, Y / 260.0, 1.0 / (sc * 3.2), sd, 1.6);
  float l2 = hair(p.x, Y / 180.0, 1.0 / (sc * 1.7), sd * 2.3 + 11.0, 1.1);
  float k1 = smoothstep(-0.3, 0.5, snoise(vec2(p.x / (sc * 5.0) + 7.0 + sd, Y / 70.0)));
  float k2 = smoothstep(0.1, 0.7, snoise(vec2(p.x / (sc * 3.0) + 17.0 + sd, Y / 45.0)));
  float broad = smoothstep(0.3, 0.95, snoise(vec2(p.x / (sc * 6.0) + 29.0 + sd, Y / 140.0))) * 0.15;
  float lines = max(max(l1 * k1, l2 * 0.6 * k2), broad);
  float darkS = lines * uW0.z * sheet;
  // ---- foam / pools: churning froth, horizontal soft bands drifting sideways
  float fx = p.x - uW1.y * t;
  float band = fbm(vec2(fx / 70.0, p.y / 7.0 + sd), 3);
  float churn = fbm3(vec3(p.x / 16.0, (p.y + 18.0 * t) / 12.0, t * 0.5 + sd), 3);
  float darkF = clamp(smoothstep(0.15, 0.8, band) * 0.6 + smoothstep(0.2, 0.9, churn) * 0.5, 0.0, 1.0) * uW1.x * foam;
  // calm water between: faint long horizontal strokes
  if (uW1.z > 0.5) {
    // front mode: white water sliding over dark rock (bright strands + froth), transparent elsewhere
    float s1 = hair(p.x, Y / 200.0, 1.0 / (sc * 1.5), sd + 5.0, 2.8);
    float s2 = hair(p.x, Y / 150.0, 1.0 / (sc * 0.85), sd * 1.7 + 3.0, 2.0);
    float dash = smoothstep(-0.5, 0.3, snoise(vec2(p.x / (sc * 2.0) + sd, Y / 55.0)));
    float strands = max(s1, s2 * 0.85) * dash * sheet;
    float froth = smoothstep(-0.1, 0.6, churn) * foam;
    float af = clamp(max(strands, froth) * body * uW1.w, 0.0, 1.0);
    return vec4(uWC * af, af);
  }
  float calm = (1.0 - sheet) * (1.0 - foam);
  float hl = smoothstep(0.55, 0.95, snoise(vec2(fx / 160.0 + sd, p.y / 4.0))) * 0.18 * calm;
  float grain = (vnoise(p * 0.9) - 0.5) * 0.04;
  // soft grey wash modelling in the churned water (shadows between foam billows)
  float wash = smoothstep(0.05, 0.75, fbm3(vec3(fx / 90.0, (p.y + 10.0 * t) / 45.0, t * 0.08 + sd), 4)) * 0.22 * (1.0 - 0.6 * sheet);
  float dark = clamp(darkS + darkF + hl + grain + wash, 0.0, 1.0);
  vec3 col = mix(uWC, uSC, dark);
  float a = clamp(body * uW1.w, 0.0, 1.0);
  return vec4(col * a, a);
}`;

// draw(ctx) paints the mask in rest-space design px: use fillStyle 'rgb(255,0,0)' for body,
// (0,255,0) sheets, (0,0,255) foam with globalCompositeOperation 'lighter'.
export function makeWhiteWater(api, o = {}) {
  const rect = o.rect;
  const mask = api.bakeCanvas(rect[2], rect[3], (ctx) => {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, rect[2], rect[3]);
    ctx.translate(-rect[0], -rect[1]);
    o.draw(ctx);
  }, { scale: o.maskScale ?? 0.5 });
  return api.shader(WATER_FS, {
    name: o.name || 'whitewater', z: o.z ?? 1.6, rect,
    textures: { uMask: mask },
    uniforms: {
      uW0: [o.speed ?? 200, o.streakScale ?? 3.5, o.darkness ?? 0.45, o.seed ?? 3.1],
      uW1: [o.foamDark ?? 0.28, o.foamDrift ?? 9, o.front ? 1 : 0, o.opacity ?? 1],
      uWC: c01(o.water || [243, 238, 229]), uSC: c01(o.ink || [118, 113, 106]),
    },
  });
}
