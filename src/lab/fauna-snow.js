// Lab: snowfall over a stand-in ref 06 backdrop (dark rock on the left, pale sky and cloud sea).
import { makeSnow } from '../lib/fauna.js';

export default {
  id: 'lab-fauna-snow', title: 'fauna: snowfall', ref: '06',
  build(api) {
    const bg = api.shader(`vec4 shade(vec2 p, vec2 uv){
      vec3 c = vec3(240.,234.,226.)/255.;
      float edge = 560. + 0.3*(p.y-400.) + 70.*snoise(vec2(p.y*0.006, 2.)) + 25.*snoise(vec2(p.y*0.03, 5.));
      float rock = smoothstep(edge, edge-30., p.x) * smoothstep(250., 330., p.y);
      float tex = 0.55 + 0.45*snoise(p*vec2(0.01,0.004)) + 0.2*snoise(p*0.05);
      float snowcap = smoothstep(0.35, 0.6, snoise(p*vec2(0.008,0.02)+3.)) * 0.8;
      vec3 rc = mix(vec3(0.08,0.075,0.07), vec3(0.3,0.29,0.28), clamp(tex*0.6,0.,1.));
      rc = mix(rc, c, snowcap);
      c = mix(c, rc, rock);
      float m = smoothstep(380., 520., p.y + 60.*snoise(vec2(p.x*0.004,9.))) * (1.-rock) * 0.12;
      c = mix(c, c*0.8, m);
      return vec4(c, 1.);
    }`, { z: 1e5 });
    const snow = makeSnow(api, { intensity: 1, wind: 1 });
    return { layers: [bg, ...snow], meta: { clear: [0.94, 0.92, 0.89] } };
  },
};
