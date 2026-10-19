// s03 helper: the night sky of ref 03 as two shader cards on the sky plane.
//  makeNightSky  - opaque paper + grey ink wash: light at the top-left and toward the horizon, a mid-grey
//                  band through the moon's latitude, darker to the right; soft horizontal mottling and
//                  pigment granulation.
//  makeNightClouds - transparent cloud layer IN FRONT of the moon: long paper-light fluffy strands with
//                  greyer undersides (the ref's reserved-paper clouds), a few darker masses (top-right of
//                  the moon); thin wisps veil the lower half of the moon. Drift slowly right.
const C = (rgb) => rgb.map((v) => (v / 255).toFixed(4)).join(', ');

export function makeNightSky(api, { paper = [237, 228, 215], moon = [1338, 198, 78], ink = [70, 66, 62], z = 1e5, rect = [-480, -270, 2880, 1100] } = {}) {
  return api.shader(/* glsl */ `
    vec4 shade(vec2 p, vec2 uv) {
      float t = uTime;
      vec3 paper = vec3(${C(paper)});
      vec3 ink = vec3(${C(ink)});
      // band through the moon's latitude, fading to the horizon (y ~ 420) and lighter high up
      float band = smoothstep(-80.0, 120.0, p.y) * (1.0 - smoothstep(230.0, 430.0, p.y));
      float high = 1.0 - smoothstep(-200.0, 120.0, p.y);
      float side = smoothstep(250.0, 1400.0, p.x);
      float a = 0.05 + (0.36 * band + 0.16 * high) * (0.12 + 0.88 * side) + 0.07 * smoothstep(1500.0, 2000.0, p.x) * (1.0 - smoothstep(200.0, 450.0, p.y));
      // horizontally stretched wash mottling, slowly evolving
      float x = p.x - 3.0 * t;
      vec2 q = vec2(x / 520.0, p.y / 120.0);
      vec2 w = vec2(fbm3(vec3(q, t * 0.012), 3), fbm3(vec3(q + 4.1, t * 0.012 + 2.0), 3));
      float m = fbm3(vec3(q * 1.5 + w * 0.7, t * 0.018 + 1.3), 4);
      float m2 = fbm(vec2(x / 120.0, p.y / 22.0) + w * 1.5 + 7.1, 3);
      a *= 1.0 + 0.38 * m + 0.14 * m2;
      // pigment granulation (the ref sky is visibly grainy)
      float gr = vnoise(p * 0.55) * 0.55 + vnoise(p * 1.4 + 3.0) * 0.45;
      a *= 1.0 + 0.3 * (gr - 0.5) * smoothstep(0.03, 0.2, a);
      // faint lift right around the moon
      float d = length(p - vec2(${moon[0].toFixed(1)}, ${moon[1].toFixed(1)}));
      float R = ${moon[2].toFixed(1)};
      float halo = exp(-max(d - R, 0.0) / (R * 0.5));
      a *= 1.0 - 0.25 * halo;
      a = clamp(a, 0.0, 1.0);
      return vec4(mix(paper, ink, a), 1.0);
    }`, { z, rect, name: 'night-sky' });
}

export function makeNightClouds(api, { paper = [237, 228, 215], ink = [74, 70, 66], z = 1e5, rect = [-480, -270, 2880, 900], drift = 5, moon = [1338, 198, 78] } = {}) {
  return api.shader(/* glsl */ `
    float strand(float x, float y, vec2 w) {
      // long horizontal light streaks with fluffy (cotton) edges
      float yy = y + 22.0 * snoise(vec2(x / 700.0, 2.7)) + 8.0 * snoise(vec2(x / 230.0, 5.1));
      float n = fbm(vec2(x / 260.0 + w.x * 0.5, yy / 26.0 + w.y * 0.4), 4);
      float fl = fbm(vec2(x / 22.0, yy / 7.0) + w * 2.0 + 4.0, 3);
      float lane = smoothstep(-0.25, 0.5, snoise(vec2(x / 520.0 + 3.0, yy / 90.0)));
      return smoothstep(0.12, 0.5, n + 0.3 * fl) * (0.6 + 0.4 * smoothstep(-0.35, 0.35, fl)) * lane;
    }
    vec4 shade(vec2 p, vec2 uv) {
      float t = uTime;
      float x = p.x - ${drift.toFixed(2)} * t;
      vec2 w = vec2(fbm3(vec3(x / 400.0, p.y / 80.0, t * 0.02), 3), fbm3(vec3(x / 400.0 + 3.3, p.y / 80.0, t * 0.02 + 1.0), 3));
      // strands live between y ~ 110 and the horizon haze, sparser far left
      float envL = smoothstep(90.0, 140.0, p.y) * (1.0 - smoothstep(300.0, 360.0, p.y)) * (0.35 + 0.65 * smoothstep(200.0, 900.0, p.x));
      float L = strand(x, p.y, w) * envL;
      float Lb = strand(x, p.y - 6.0, w) * envL;           // the strand a little above: its underside
      float under = clamp(Lb - L, 0.0, 1.0);
      // dark soft masses: top-right of the moon and high over the centre
      float envD = smoothstep(80.0, 130.0, p.y) * (1.0 - smoothstep(170.0, 230.0, p.y)) * smoothstep(1380.0, 1520.0, p.x)
                 + 0.7 * (1.0 - smoothstep(40.0, 120.0, p.y)) * smoothstep(700.0, 1100.0, p.x);
      float nd = fbm3(vec3(x / 260.0 + w.x, p.y / 40.0, t * 0.02 + 4.0), 4) + 0.25 * fbm(vec2(x / 30.0, p.y / 12.0), 2);
      float ad = 0.32 * smoothstep(-0.05, 0.45, nd) * envD;
      ad += 0.22 * under;
      ad *= 0.8 + 0.4 * (vnoise(p * 0.6) * 0.6 + vnoise(p * 1.5) * 0.4);
      float al = 0.8 * L;
      // over the moon: wisps only (lower half), dark masses much weaker
      vec2 dm = p - vec2(${moon[0].toFixed(1)}, ${moon[1].toFixed(1)});
      float onMoon = 1.0 - smoothstep(${moon[2].toFixed(1)} - 2.0, ${moon[2].toFixed(1)} + 3.0, length(dm));
      ad *= 1.0 - 0.75 * onMoon;
      al *= 1.0 - onMoon * (1.0 - 0.6 * smoothstep(-10.0, 30.0, dm.y));
      vec3 inkc = vec3(${C(ink)}), pc = vec3(${C(paper)}) * 1.015;
      vec4 o = vec4(inkc * ad, ad);
      o = vec4(pc * al, al) + o * (1.0 - al);
      return o;
    }`, { z, rect, name: 'night-clouds' });
}
