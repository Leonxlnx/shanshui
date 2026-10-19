// Lab: falling maple leaves over a simple misty backdrop (ref 10 layout: the maple at the left
// sheds leaves that drift right and down; a few large near leaves pass blurred).
import { makeFallingLeaves } from '../lib/fauna.js';

export default {
  id: 'lab-fauna-leaves', title: 'fauna: falling leaves', ref: '10',
  build(api) {
    const paper = api.shader(`vec4 shade(vec2 p, vec2 uv){
      vec3 c = vec3(239.,231.,220.)/255.;
      // stand-in backdrop: pale misty hills and a grey cliff edge at the left
      float h1 = 600. + 70.*sin(p.x*0.0035 + 1.) + 40.*snoise(vec2(p.x*0.005, 1.));
      float m = smoothstep(0., 140., p.y - h1) * (1. - smoothstep(760., 1000., p.y)) * (0.55 + 0.45*snoise(p*vec2(0.006,0.012)));
      float edge = 330. + 0.35*(p.y-500.) + 50.*snoise(vec2(p.y*0.008, 3.));
      float cliff = smoothstep(edge, edge - 60., p.x) * smoothstep(380., 520., p.y);
      c = mix(c, c*0.72, clamp(m, 0., 1.)*0.5);
      c = mix(c, c*0.45, cliff*(0.7 + 0.3*snoise(p*0.02)));
      return vec4(c, 1.);
    }`, { z: 1e5 });
    const leaves = makeFallingLeaves(api, {
      region: [120, 470, 260, 320], wind: 85, count: 18, nearCount: 3, size: [8, 42], seed: 3, life: [7, 11],
      nearFrom: [-150, 380, 700, 160],
    });
    return { layers: [paper, leaves] };
  },
};
