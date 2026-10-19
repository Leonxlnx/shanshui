// The film: ten paintings in one minute. A shot list on a single clock,
// transitions that composite neighbouring scenes, film-level overlays that
// carry objects across seams, and the final paper/vignette/dither pass.

import { W, H } from './engine/engine.js';
import { compile, setUniforms, createTarget, bindTarget, drawQuad } from './engine/gl.js';
import { HEADER, NOISE, INK } from './engine/glsl.js';
import { SCENES } from './scenes/index.js';
import { TRANSITIONS, TRANS_HEAD, EASE } from './transitions/index.js';

import { FPS, DURATION, SHOTS, CUE } from './timeline.js';
import { makeSealOverlay } from './lib/seal.js';
import { makeLeafGust } from './lib/gust.js';
export { FPS, DURATION, SHOTS };

// Film-level overlays drawn over the composite (after grading): { from, to, make: async (api) => ({ layers, camera? }) }
export const OVERLAYS = [
  // a gust of maple leaves carries the cascade into the autumn ruins
  { from: CUE.gust, to: CUE.gust + 2.8, make: (api) => makeLeafGust(api, { dur: 2.8 }) },
  // the seal is pressed onto the last painting and stays when the painting returns to paper
  { from: CUE.seal, to: DURATION + 1, make: (api) => makeSealOverlay(api) },
];

export const PAPER_RGB = [239 / 255, 231 / 255, 220 / 255];

const FULL_VS = HEADER + /* glsl */ `
in vec2 aPos; out vec2 vUV; out vec2 vP;
void main() { vUV = aPos; vP = vec2(aPos.x, 1.0 - aPos.y) * vec2(1920.0, 1080.0); gl_Position = vec4(aPos * 2.0 - 1.0, 0.0, 1.0); }`;

export class Film {
  constructor(engine, { shots = SHOTS, overlays = OVERLAYS, duration = DURATION } = {}) {
    this.engine = engine;
    this.shots = shots.map((s, i) => ({ ...s, index: i }));
    this.overlays = overlays;
    this.duration = duration;
    this.built = new Map();     // shot index -> scene
    this.overlayBuilt = new Map();
    const gl = engine.gl;
    this.gA = createTarget(gl, engine.pw, engine.ph);
    this.gB = createTarget(gl, engine.pw, engine.ph);
    this.progs = {};
    for (const [k, def] of Object.entries(TRANSITIONS)) {
      const fs = HEADER + NOISE + INK + TRANS_HEAD + def.frag + /* glsl */ `
      in vec2 vUV; in vec2 vP; out vec4 o;
      void main() { o = transition(vP, vUV); }`;
      this.progs[k] = compile(gl, FULL_VS, fs, 'transition-' + k);
    }
  }

  summary() {
    return { duration: this.duration, shots: this.shots.map((s) => ({ scene: s.scene, start: s.start, in: s.in && s.in.type })) };
  }

  // shot i is on screen from its start until the next shot's transition completes
  shotEnd(i) {
    const n = this.shots[i + 1];
    return n ? n.start + (n.in ? n.in.dur : 0) : this.duration + 1;
  }

  activeAt(T) {
    let i = 0;
    for (let k = 0; k < this.shots.length; k++) if (this.shots[k].start <= T) i = k;
    const B = this.shots[i];
    const tr = B.in && T < B.start + B.in.dur ? B.in : null;
    return { B, A: tr ? this.shots[i - 1] : null, tr, p: tr ? (T - B.start) / tr.dur : 1 };
  }

  async buildShot(shot) {
    if (shot.scene === '@paper') return null;
    if (this.built.has(shot.index)) return this.built.get(shot.index);
    // reuse a scene already built for another shot with the same id
    for (const [k, sc] of this.built) if (this.shots[k].scene === shot.scene) { this.built.set(shot.index, sc); return sc; }
    const loader = SCENES[shot.scene] || (() => import('./' + shot.scene + '.js'));
    const mod = await loader();
    const sc = await this.engine.buildScene(mod, {});
    this.built.set(shot.index, sc);
    return sc;
  }

  // Build what is needed at T (and shortly after), dispose what is no longer needed.
  async prepare(T, lookahead = 0.6) {
    const need = new Set();
    // motion-blur sub-frames sample slightly before T, so keep a short tail behind it
    const back = 0.05;
    for (const s of this.shots) {
      const from = s.start - lookahead, to = this.shotEnd(s.index);
      if (T + 0 >= from && T - back <= to) need.add(s.index);
    }
    for (const i of need) await this.buildShot(this.shots[i]);
    const keepScenes = new Set([...need].map((i) => this.shots[i].scene));
    for (const [k, sc] of [...this.built]) {
      if (!need.has(k)) {
        this.built.delete(k);
        const stillUsed = [...this.built.values()].includes(sc);
        if (!stillUsed && !keepScenes.has(this.shots[k].scene)) this.engine.disposeScene(sc);
      }
    }
    for (const ov of this.overlays) {
      const on = T >= ov.from - lookahead && T <= ov.to;
      if (on && !this.overlayBuilt.has(ov)) {
        const api = this.engine.api('overlay');
        this.overlayBuilt.set(ov, await ov.make(api));
      } else if (!on && this.overlayBuilt.has(ov)) {
        const built = this.overlayBuilt.get(ov);
        this.engine.disposeScene({ layers: built.layers, dispose: built.dispose });
        this.overlayBuilt.delete(ov);
      }
    }
  }

  localT(shot, T) { return T - shot.start + (shot.t0 || 0); }

  // Render the scene of `shot` at film time T into raw target, then grade into `graded`.
  renderShot(shot, T, raw, graded, camAdd) {
    const eng = this.engine;
    if (!shot || shot.scene === '@paper') {
      eng.clear(graded, [...PAPER_RGB, 1]);
      return eng.defaultGrade;
    }
    const sc = this.built.get(shot.index);
    if (!sc) throw new Error('scene not prepared: ' + shot.scene + ' at T=' + T);
    const t = this.localT(shot, T);
    eng.renderScene(sc, t, raw, camAdd);
    const g = eng.gradeAt(sc, t);
    eng.postPass(raw, graded, g, { doGrade: true, doFinal: false });
    return g;
  }

  // Composite one instant into engine.targets.comp; returns the final-pass params to use.
  composite(T) {
    const eng = this.engine, gl = eng.gl;
    const { A, B, tr, p } = this.activeAt(T);
    let finalG;
    if (!tr) {
      finalG = this.renderShot(B, T, eng.targets.sceneB, eng.targets.comp);
    } else {
      const def = TRANSITIONS[tr.type];
      if (!def) throw new Error('unknown transition ' + tr.type);
      const e = (EASE[tr.ease || def.ease] || EASE.smooth)(Math.min(1, Math.max(0, p)));
      const cams = def.cam ? def.cam(e, tr) : { a: null, b: null };
      const gA = this.renderShot(A, T, eng.targets.sceneA, this.gA, cams.a);
      const gB = this.renderShot(B, T, eng.targets.sceneB, this.gB, cams.b);
      const prog = this.progs[tr.type];
      bindTarget(gl, eng.targets.comp);
      gl.disable(gl.BLEND);
      gl.useProgram(prog.prog);
      const d = def.defaults || {};
      setUniforms(gl, prog, {
        uA: this.gA.tex, uB: this.gB.tex, uP: p, uE: e, uT: T,
        uK: tr.k || d.k || [0, 0, 0, 0], uK2: tr.k2 || d.k2 || [0, 0, 0, 0],
        uC: tr.c || d.c || [960, 540], uC2: tr.c2 || d.c2 || [960, 540],
        uPaperC: tr.paper || PAPER_RGB,
      });
      drawQuad(gl);
      // final-pass params blend across the seam
      finalG = { ...gB, paper: gA.paper + (gB.paper - gA.paper) * e, vignette: gA.vignette + (gB.vignette - gA.vignette) * e, dither: 1 };
    }
    // overlays on top of the graded composite
    for (const [ov, built] of this.overlayBuilt) {
      if (T < ov.from || T > ov.to) continue;
      const lt = T - ov.from;
      const cam = built.camera ? built.camera(lt, T) : null;
      eng.renderLayers(built.layers, lt, eng.targets.comp, cam, { clear: null });
    }
    return finalG;
  }

  // Full frame at film time T to the canvas. samples > 1 accumulates sub-frames (motion blur).
  // target: null = canvas, or a float target (e.g. for YUV readback).
  renderAt(T, { samples = 1, shutter = 0.5, fps = FPS, target = null } = {}) {
    const eng = this.engine;
    let g;
    if (samples <= 1) {
      g = this.composite(T);
      eng.postPass(eng.targets.comp, target, g, { doGrade: false, doFinal: true });
      return;
    }
    eng.clear(eng.targets.accum);
    for (let i = 0; i < samples; i++) {
      const ts = T + ((i + 0.5) / samples - 0.5) * (shutter / fps);
      g = this.composite(ts);
      eng.blit(eng.targets.comp, eng.targets.accum, 1 / samples, true);
    }
    eng.postPass(eng.targets.accum, target, g, { doGrade: false, doFinal: true });
  }
}
