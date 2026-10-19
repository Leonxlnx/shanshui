// Lab: the three cranes of ref 01 at their reference positions (t = 0) on ref 01 paper, flying.
import { makeCraneFlock } from '../lib/fauna.js';
import { CRANES, PAPERS } from './fauna-data.js';

export function craneLab(id, ref) {
  return {
    id, title: 'fauna: ref ' + ref + ' cranes', ref,
    build(api) {
      const P = PAPERS[ref].map((v) => (v / 255).toFixed(4)).join(',');
      const paper = api.shader(`vec4 shade(vec2 p, vec2 uv){ return vec4(vec3(${P}), 1.); }`, { z: 1e5 });
      const flock = makeCraneFlock(api, { cranes: CRANES[ref], z: 1, paper: PAPERS[ref] });
      return { layers: [paper, flock] };
    },
  };
}

export default craneLab('lab-fauna-01', '01');
