// The score, synthesized from nothing: Karplus-Strong guzheng (bends, vibrato,
// tremolo, glissandi, harmonics), a breathy xiao, a temple bowl, a low drone
// and ambience beds that follow the picture. Same clock as the film
// (src/timeline.js). Writes out/audio/soundtrack.wav (48 kHz, 24-bit),
// mastered to -14 LUFS integrated with a -1.5 dBTP ceiling.
//
//   node tools/audio.mjs [--stems]   (stems -> out/audio/stems/*.wav)

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { ROOT, parseArgs } from './lib.mjs';
import { bt, DURATION, SHOTS, CUE, BEAT } from '../src/timeline.js';

const args = parseArgs();
const SR = 48000;
const LEN = Math.ceil(DURATION * SR);
const OUT = path.join(ROOT, 'out', 'audio');
fs.mkdirSync(OUT, { recursive: true });

// ------------------------------------------------------------------ utils
function rngOf(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const dbToLin = (db) => Math.pow(10, db / 20);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
// piecewise-linear automation from [[t, v], ...]
function envOf(points) {
  return (t) => {
    if (t <= points[0][0]) return points[0][1];
    for (let i = 1; i < points.length; i++) {
      if (t <= points[i][0]) { const [t0, v0] = points[i - 1], [t1, v1] = points[i]; const u = (t - t0) / (t1 - t0); return v0 + (v1 - v0) * (u * u * (3 - 2 * u)); }
    }
    return points[points.length - 1][1];
  };
}

class Biquad {
  constructor(type, f, q = 0.707, gainDb = 0) { this.set(type, f, q, gainDb); this.x1 = this.x2 = this.y1 = this.y2 = 0; }
  set(type, f, q = 0.707, gainDb = 0) {
    const w = 2 * Math.PI * clamp(f, 10, SR * 0.49) / SR, cs = Math.cos(w), sn = Math.sin(w), al = sn / (2 * q), A = Math.pow(10, gainDb / 40);
    let b0, b1, b2, a0, a1, a2;
    if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = (1 - cs) / 2; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
    else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = (1 + cs) / 2; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
    else if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
    else if (type === 'peak') { b0 = 1 + al * A; b1 = -2 * cs; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cs; a2 = 1 - al / A; }
    else if (type === 'hs') { const sq = 2 * Math.sqrt(A) * al; b0 = A * ((A + 1) + (A - 1) * cs + sq); b1 = -2 * A * ((A - 1) + (A + 1) * cs); b2 = A * ((A + 1) + (A - 1) * cs - sq); a0 = (A + 1) - (A - 1) * cs + sq; a1 = 2 * ((A - 1) - (A + 1) * cs); a2 = (A + 1) - (A - 1) * cs - sq; }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
  }
  p(x) { const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2; this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y; return y; }
  run(buf) { for (let i = 0; i < buf.length; i++) buf[i] = this.p(buf[i]); return buf; }
}

function pinkGen(rnd) {
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  return () => { const w = rnd() * 2 - 1; b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; const o = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926; return o * 0.11; };
}
// smooth random LFO in [-1, 1]
function lfoGen(rnd, rate) {
  const pts = Array.from({ length: Math.ceil(DURATION * rate) + 4 }, () => rnd() * 2 - 1);
  return (t) => { const x = t * rate, i = Math.floor(x), f = x - i; const u = f * f * (3 - 2 * f); return pts[i] + (pts[i + 1] - pts[i]) * u; };
}

// stereo bus
const bus = () => [new Float32Array(LEN), new Float32Array(LEN)];
// add a mono buffer at time t with gain and constant-power pan (-1..1); 6 ms fade at its end
function place(dst, buf, t, gain = 1, pan = 0) {
  const i0 = Math.round(t * SR);
  const a = (clamp(pan, -1, 1) + 1) * Math.PI / 4;
  const gl = Math.cos(a) * gain, gr = Math.sin(a) * gain;
  const fade = Math.min(buf.length, Math.round(0.006 * SR));
  for (let k = 0; k < buf.length; k++) {
    const i = i0 + k; if (i < 0) continue; if (i >= LEN) break;
    let v = buf[k];
    const r = buf.length - k; if (r < fade) v *= r / fade;
    dst[0][i] += v * gl; dst[1][i] += v * gr;
  }
}
function addBus(dst, src, gain = 1) { for (let c = 0; c < 2; c++) for (let i = 0; i < LEN; i++) dst[c][i] += src[c][i] * gain; }

// ------------------------------------------------------------------ reverb (Freeverb)
class Comb { constructor(n) { this.b = new Float32Array(n); this.i = 0; this.s = 0; } p(x, fb, d) { const y = this.b[this.i]; this.s = y * (1 - d) + this.s * d; this.b[this.i] = x + this.s * fb; if (++this.i >= this.b.length) this.i = 0; return y; } }
class AP { constructor(n) { this.b = new Float32Array(n); this.i = 0; } p(x) { const b = this.b[this.i]; const y = -x + b; this.b[this.i] = x + b * 0.5; if (++this.i >= this.b.length) this.i = 0; return y; } }
function reverb(src, { room = 0.86, damp = 0.35, predelay = 0.025, hp = 220, width = 1 } = {}) {
  const k = SR / 44100, CT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], AT = [556, 441, 341, 225];
  const out = bus();
  const fb = room * 0.28 + 0.7, d = damp * 0.4;
  const pd = Math.round(predelay * SR);
  for (let c = 0; c < 2; c++) {
    const sp = c ? 23 : 0;
    const combs = CT.map((n) => new Comb(Math.round((n + sp) * k)));
    const aps = AT.map((n) => new AP(Math.round((n + sp) * k)));
    const h = new Biquad('hp', hp, 0.7);
    const mono = src[0].map((v, i) => (v + src[1][i]) * 0.5);
    for (let i = 0; i < LEN; i++) {
      const x = h.p(i >= pd ? mono[i - pd] : 0) * 0.015;
      let y = 0;
      for (const cb of combs) y += cb.p(x, fb, d);
      for (const ap of aps) y = ap.p(y);
      out[c][i] = y;
    }
  }
  if (width < 1) for (let i = 0; i < LEN; i++) { const m = (out[0][i] + out[1][i]) / 2, s = (out[0][i] - out[1][i]) / 2 * width; out[0][i] = m + s; out[1][i] = m - s; }
  return out;
}

// ------------------------------------------------------------------ instruments
let seedCounter = 1;

// Guzheng string: variable-delay Karplus-Strong (bends + vibrato), nail-pick transient, body resonances.
function guzheng(midi, { vel = 0.5, T60 = 3.5, bend = [], vib = 0, vibDelay = 0.35, bright = 0.5, dur } = {}) {
  const rnd = rngOf(seedCounter++ * 7919);
  const f0 = mtof(midi);
  const len = Math.ceil((dur ?? Math.min(T60 * 1.05, 9)) * SR);
  const out = new Float32Array(len);
  const M = 1 << Math.ceil(Math.log2(SR / (f0 * 0.7) + 8));
  const d = new Float32Array(M);
  const P0 = SR / f0;
  // excitation: noise burst through a velocity lowpass and a pluck-position comb
  const exLen = Math.round(P0);
  const ex = new Float32Array(exLen + Math.round(P0 * 0.15) + 2);
  const lpA = 0.25 + 0.65 * clamp(vel * bright * 1.6, 0, 1);
  let lp = 0;
  for (let i = 0; i < exLen; i++) { lp += lpA * ((rnd() * 2 - 1) - lp); ex[i] = lp; }
  const pp = Math.max(1, Math.round(P0 * 0.13));
  for (let i = ex.length - 1; i >= pp; i--) ex[i] -= 0.92 * ex[i - pp];
  const g = Math.pow(10, -3 / (T60 * f0));            // loop gain per period
  const a = 0.42 + 0.5 * bright;                        // one-pole loop lowpass (higher = brighter)
  const filtDelay = (1 - a) / a;
  let w = 0, prev = 0;
  const semisAt = (t) => {
    let s = 0;
    for (const b of bend) {                            // {at, to (semitones), dur, back (time to release), backDur}
      const up = clamp((t - b.at) / (b.dur || 0.2), 0, 1);
      let v = b.to * (up * up * (3 - 2 * up));
      if (b.back !== undefined) { const dn = clamp((t - b.back) / (b.backDur || 0.3), 0, 1); v *= 1 - dn * dn * (3 - 2 * dn); }
      s += v;
    }
    if (vib > 0) { const vd = clamp((t - vibDelay) / 0.4, 0, 1); s += vib * vd * Math.sin(2 * Math.PI * 5.4 * t + 0.7 * Math.sin(2 * Math.PI * 0.6 * t)); }
    return s;
  };
  for (let n = 0; n < len; n++) {
    const t = n / SR;
    const P = SR / (f0 * Math.pow(2, semisAt(t) / 12)) - filtDelay;
    // cubic Hermite read at w - P
    const rp = w - P + M * 4;
    const i1 = Math.floor(rp), fr = rp - i1;
    const y0 = d[(i1 - 1) & (M - 1)], y1 = d[i1 & (M - 1)], y2 = d[(i1 + 1) & (M - 1)], y3 = d[(i1 + 2) & (M - 1)];
    const c1 = 0.5 * (y2 - y0), c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3, c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
    const y = ((c3 * fr + c2) * fr + c1) * fr + y1;
    prev += a * (y - prev);
    d[w & (M - 1)] = (n < ex.length ? ex[n] * vel : 0) + g * prev;
    out[n] = y;
    w++;
  }
  // nail/plectrum transient
  const tick = Math.round(0.004 * SR);
  const th = new Biquad('hp', 2500, 0.7);
  for (let i = 0; i < tick && i < len; i++) out[i] += th.p(rnd() * 2 - 1) * vel * 0.12 * (1 - i / tick);
  // body: resonances + direct
  const r1 = new Biquad('bp', 190, 3), r2 = new Biquad('bp', 540, 2.5), r3 = new Biquad('bp', 1450, 2), hs = new Biquad('hs', 4500, 0.7, -3);
  for (let i = 0; i < len; i++) { const x = out[i]; out[i] = hs.p(x * 0.75 + r1.p(x) * 0.5 + r2.p(x) * 0.35 + r3.p(x) * 0.2); }
  // gentle overall decay envelope so nothing ends abruptly
  for (let i = 0; i < len; i++) { const r = (len - i) / SR; if (r < 0.15) out[i] *= r / 0.15; }
  return out;
}

// Guzheng harmonic (fanyin): pure, bell-like.
function harmonic(midi, { vel = 0.5, T60 = 4 } = {}) {
  const f = mtof(midi), len = Math.ceil(T60 * SR);
  const out = new Float32Array(len);
  const k = -6.9 / T60;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const att = Math.min(1, t / 0.004);
    out[i] = vel * att * (Math.sin(2 * Math.PI * f * t) * Math.exp(k * t) + 0.18 * Math.sin(2 * Math.PI * f * 2.003 * t) * Math.exp(k * 2.4 * t) + 0.06 * Math.sin(2 * Math.PI * f * 3.01 * t) * Math.exp(k * 4 * t));
  }
  return out;
}

// Xiao (end-blown flute): one continuous voice over a phrase [{t, m, d}] with portamento, breath and vibrato.
function xiao(notes, { vel = 0.5, breath = 1 } = {}) {
  const rnd = rngOf(seedCounter++ * 104729);
  const t0 = notes[0].t - 0.05, t1 = notes[notes.length - 1].t + notes[notes.length - 1].d + 0.6;
  const len = Math.ceil((t1 - t0) * SR);
  const out = new Float32Array(len);
  const bp1 = new Biquad('bp', 600, 6), bp2 = new Biquad('bp', 1200, 5), chiffHP = new Biquad('hp', 2200, 0.7), hiss = new Biquad('lp', 5000, 0.7);
  const jitP = lfoGen(rngOf(seedCounter * 13), 2.6), jitA = lfoGen(rngOf(seedCounter * 17), 1.7);
  let phase = 0, pitch = notes[0].m - 0.4;
  for (let n = 0; n < len; n++) {
    const t = t0 + n / SR;
    // active note
    let cur = null, amp = 0, sinceOn = 0;
    for (let i = 0; i < notes.length; i++) {
      const no = notes[i];
      const nx = notes[i + 1], pv = notes[i - 1];
      const legato = nx && nx.t - (no.t + no.d) < 0.06;
      const legIn = pv && no.t - (pv.t + pv.d) < 0.06;
      const on = t - no.t;
      const end = no.t + no.d;
      if (t < no.t - 0.001) continue;
      if (t > end + 0.35) continue;
      let e;
      if (legIn) e = 1.0;
      else if (on < 0.14) e = Math.sin((on / 0.14) * Math.PI / 2) * 1.06;
      else e = 1.06 - 0.06 * clamp((on - 0.14) / 0.2, 0, 1);
      e *= 1 + 0.08 * Math.sin(Math.PI * clamp(on / Math.max(no.d, 0.2), 0, 1)); // swell through the note
      if (t > end) e *= legato ? 0 : Math.max(0, 1 - (t - end) / 0.32);
      if (e > amp) { amp = e; cur = no; sinceOn = on; }
      if (legato && t > end - 0.03 && t < end + 0.04) amp *= 0.86;  // tongue between legato notes
    }
    if (cur) {
      const target = cur.m + (sinceOn < 0.09 ? -0.35 * (1 - sinceOn / 0.09) : 0);
      pitch += (target - pitch) * (1 - Math.exp(-1 / (0.035 * SR)));
    }
    const vd = clamp((sinceOn - 0.35) / 0.5, 0, 1);
    // breath is never perfectly steady: slow random drift in pitch and level
    const drift = jitP(t) * 0.035, swell = 1 + jitA(t) * 0.05;
    amp *= swell;
    const p = pitch + drift + vd * 0.19 * Math.sin(2 * Math.PI * 4.9 * t + 0.4 * Math.sin(2 * Math.PI * 0.37 * t));
    const f = mtof(p);
    phase += 2 * Math.PI * f / SR;
    if (n % 64 === 0) { bp1.set('bp', f, 7); bp2.set('bp', f * 2, 6); }
    const tone = Math.sin(phase) + 0.16 * Math.sin(2 * phase) + 0.055 * Math.sin(3 * phase) + 0.02 * Math.sin(4 * phase);
    const w = rnd() * 2 - 1;
    const br = (bp1.p(w) * 0.55 + bp2.p(w) * 0.3) * breath * 0.9 + hiss.p(w) * 0.025 * breath;
    const chiff = sinceOn < 0.05 ? chiffHP.p(w) * 0.06 * (1 - sinceOn / 0.05) : 0;
    out[n] = (tone * 0.78 + br) * amp * vel + chiff * vel;
  }
  return { buf: out, t: t0 };
}

// Temple singing bowl: beating modal partials.
function bowl(midi, { vel = 0.5, T60 = 9 } = {}) {
  const rnd = rngOf(seedCounter++ * 31);
  const f = mtof(midi), len = Math.ceil(T60 * SR);
  const R = [1, 2.71, 5.12, 8.21, 11.9], A = [1, 0.42, 0.22, 0.1, 0.05], D = [1, 0.62, 0.42, 0.28, 0.18];
  const out = new Float32Array(len);
  const ph = R.map(() => rnd() * 6.28);
  for (let i = 0; i < len; i++) {
    const t = i / SR; let s = 0;
    for (let k = 0; k < R.length; k++) {
      const e = Math.exp(-6.9 * t / (T60 * D[k]));
      const fk = f * R[k];
      s += A[k] * e * 0.5 * (Math.sin(2 * Math.PI * fk * (1 - 0.0012) * t + ph[k]) + Math.sin(2 * Math.PI * fk * (1 + 0.0012) * t + ph[k] * 1.3));
    }
    const att = Math.min(1, t / 0.006);
    out[i] = s * att * vel * 0.6;
  }
  const lp = new Biquad('lp', 900, 0.7);
  for (let i = 0; i < Math.round(0.01 * SR); i++) out[i] += lp.p(rnd() * 2 - 1) * vel * 0.25 * (1 - i / (0.01 * SR));
  return out;
}

// Low frame drum.
function drum({ vel = 0.5, pitch = 52 } = {}) {
  const rnd = rngOf(seedCounter++ * 977);
  const len = Math.ceil(1.2 * SR), out = new Float32Array(len);
  const base = mtof(pitch - 12);
  let ph = 0; const lp = new Biquad('lp', 380, 0.8);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const f = base + 70 * Math.exp(-t / 0.028);
    ph += 2 * Math.PI * f / SR;
    out[i] = (Math.sin(ph) * Math.exp(-t / 0.42) + lp.p(rnd() * 2 - 1) * 0.45 * Math.exp(-t / 0.045)) * vel;
    out[i] = Math.tanh(out[i] * 1.4) / 1.4;
  }
  return out;
}

// Seal pressed onto paper: a soft, short wooden knock.
function knock({ vel = 0.5 } = {}) {
  const rnd = rngOf(4242);
  const len = Math.ceil(0.35 * SR), out = new Float32Array(len);
  const M = [[210, 0.07, 1], [470, 0.045, 0.6], [1050, 0.025, 0.35], [2300, 0.012, 0.15]];
  const lp = new Biquad('lp', 1800, 0.7);
  for (let i = 0; i < len; i++) {
    const t = i / SR; let s = 0;
    for (const [f, d, a] of M) s += a * Math.sin(2 * Math.PI * f * t) * Math.exp(-t / d);
    if (i < 0.003 * SR) s += lp.p(rnd() * 2 - 1) * 0.5;
    out[i] = s * vel * Math.min(1, t / 0.0015);
  }
  return out;
}

// Whoosh: 1/f-ish noise through a band that sweeps f0 -> f1 (at the apex) -> f2, swelling to the apex.
// rustle > 0 adds a burst of dry leaf grains following the same envelope.
function whoosh(dur, { f0 = 250, f1 = 1100, f2 = 450, apex = 0.45, q = 0.9, rustle = 0, seed = 5 } = {}) {
  const rnd = rngOf(seed * 7717);
  const len = Math.ceil(dur * SR), out = new Float32Array(len);
  const pink = pinkGen(rnd), bp = new Biquad('bp', f0, q), hp = new Biquad('hp', 2400, 0.7);
  let grain = 0, gd = 0.99;
  for (let i = 0; i < len; i++) {
    const u = i / len;
    const f = u < apex ? f0 * Math.pow(f1 / f0, u / apex) : f1 * Math.pow(f2 / f1, (u - apex) / (1 - apex));
    if (i % 64 === 0) bp.set('bp', f, q);
    const env = u < apex ? Math.pow(u / apex, 2) : Math.exp(-4.2 * (u - apex) / (1 - apex));
    let s = bp.p(pink()) * env * 2.2;
    if (rustle > 0) {
      if (rnd() < (40 + 260 * env) / SR) { grain = 0.5 + rnd() * 0.5; gd = Math.exp(-1 / ((0.006 + rnd() * 0.02) * SR)); }
      s += hp.p(rnd() * 2 - 1) * grain * env * rustle; grain *= gd;
    }
    out[i] = s;
  }
  return out;
}

// ------------------------------------------------------------------ score helpers
const music = bus();     // guzheng, xiao, bowl, drum
const pads = bus();      // drone (less reverb)
const sfx = bus();       // knock
const amb = bus();       // ambience beds
const PENT = [];
for (let m = 33; m <= 98; m++) if ([2, 4, 6, 9, 11].includes(m % 12)) PENT.push(m);
const rndScore = rngOf(2026);
const human = (s = 0.012) => (rndScore() - 0.5) * 2 * s;

function pl(t, m, vel = 0.5, opts = {}) {
  const buf = guzheng(m, { vel, ...opts });
  const pan = opts.pan ?? clamp((m - 66) / 30, -0.55, 0.55);
  place(music, buf, t + (opts.exact ? 0 : human(0.008)), 0.9, pan);
}
function hm(t, m, vel = 0.4, opts = {}) { place(music, harmonic(m, { vel, ...opts }), t, 0.7, opts.pan ?? clamp((m - 74) / 30, -0.5, 0.5)); }
// glissando across the pentatonic strings, landing its last string exactly on tEnd
function gliss(tEnd, from, to, dur, v0 = 0.2, v1 = 0.5, opts = {}) {
  const lo = Math.min(from, to), hi = Math.max(from, to);
  let notes = PENT.filter((m) => m >= lo && m <= hi);
  if (from > to) notes = notes.reverse();
  const n = notes.length;
  notes.forEach((m, i) => {
    const u = n > 1 ? i / (n - 1) : 1;
    const tt = tEnd - dur * Math.pow(1 - u, 1.35);
    pl(tt, m, v0 + (v1 - v0) * u, { T60: opts.T60 ?? 2.4, exact: true, bright: 0.55 });
  });
}
function roll(t, notes, vel = 0.45, spread = 0.04, opts = {}) { notes.forEach((m, i) => pl(t + i * spread, m, vel * (0.85 + 0.15 * (i / notes.length)), { T60: 5, ...opts })); }
function trem(t, m, dur, rate = 11, vEnv = (u) => 0.3) {
  const n = Math.floor(dur * rate);
  for (let i = 0; i < n; i++) { const u = i / n; pl(t + i / rate + human(0.004), m, vEnv(u), { T60: 0.9, dur: 0.5, exact: true }); }
}
function flute(notes, vel = 0.5, pan = -0.15) { const x = xiao(notes, { vel }); place(music, x.buf, x.t, 0.55, pan); }
const N = (bar, beat, m, beats) => ({ t: bt(bar, beat), m, d: beats * BEAT });

// pitches
const [D2, A2, B1, Fs2, B2, D3, E3, Fs3, A3, B3, D4, E4, Fs4, A4, B4, D5, E5, Fs5, A5, B5, D6, E2] = [38, 45, 35, 42, 47, 50, 52, 54, 57, 59, 62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86, 40];

// ------------------------------------------------------------------ the score
// Bars 1-2  bamboo valley (painted in from paper)
pl(0.02, D4, 0.5, { T60: 4.5, exact: true });
pl(bt(1, 1.5), Fs4, 0.36);
pl(bt(1, 2.5), A4, 0.46, { T60: 4.5, bend: [{ at: 0.32, to: 2, dur: 0.28, back: 1.25, backDur: 0.4 }] });
pl(bt(2, 0), E4, 0.4);
pl(bt(2, 1), D4, 0.36); pl(bt(2, 1), A3, 0.26);
pl(bt(2, 2.5), B3, 0.32, { T60: 3 });
gliss(bt(3), D4, A5, 0.6, 0.16, 0.42);

// Bars 3-4  cranes over the falls
pl(bt(3), D3, 0.58, { T60: 6 }); pl(bt(3), A3, 0.4, { T60: 5 });
pl(bt(3, 0), A4, 0.58); pl(bt(3, 1), B4, 0.48); pl(bt(3, 1.5), D5, 0.52);
pl(bt(3, 2), E5, 0.58, { T60: 4.5, vib: 0.18 });
pl(bt(3, 3.25), D5, 0.42); pl(bt(3, 3.5), B4, 0.44);
pl(bt(4, 0), A4, 0.54, { T60: 5, bend: [{ at: 0.25, to: 2, dur: 0.22, back: 0.75, backDur: 0.3 }] });
pl(bt(4, 0), B2, 0.42, { T60: 5 });
pl(bt(4, 1.5), Fs4, 0.42); pl(bt(4, 2), E4, 0.48); pl(bt(4, 3), D4, 0.46, { vib: 0.12 });
[[3, 1.5, A3], [3, 2.5, D4], [3, 3.5, Fs4], [4, 1, Fs3], [4, 2.5, B3], [4, 3.5, D4]].forEach(([b, k, m]) => pl(bt(b, k), m, 0.22));

// Bars 5-6  rope bridges (the xiao enters)
pl(bt(5), D3, 0.5, { T60: 6 }); pl(bt(5), A3, 0.34);
flute([N(5, 0.5, A4, 1.5), N(5, 2, B4, 1), N(5, 3, D5, 2.5), N(6, 1.5, E5, 1), N(6, 2.5, D5, 0.5), N(6, 3, B4, 1.6)], 0.42);
const arp5 = [D4, A4, D5, A4, Fs4, A4, D5, A4], arp6 = [E4, B4, D5, B4, E4, A4, D5, A4];
arp5.forEach((m, i) => pl(bt(5, i * 0.5), m, i % 2 ? 0.17 : 0.23, { T60: 2.2 }));
arp6.forEach((m, i) => pl(bt(6, i * 0.5), m, i % 2 ? 0.17 : 0.23, { T60: 2.2 }));
pl(bt(6), E3, 0.42, { T60: 5 });
gliss(bt(7), D3, D6, 0.85, 0.14, 0.5);

// Bars 7-8  floating peaks (rising)
pl(bt(7), D2 + 12, 0.66, { T60: 7 }); pl(bt(7), A3, 0.42); pl(bt(7), D4, 0.36);
trem(bt(7, 0.5), Fs5, 3 * BEAT, 11, (u) => 0.16 + 0.24 * Math.sin(Math.PI * u));
trem(bt(8, 0), A5, 2.5 * BEAT, 11, (u) => 0.18 + 0.26 * Math.sin(Math.PI * Math.min(1, u * 1.2)));
flute([N(7, 1, D5, 2), N(7, 3, E5, 1), N(8, 0, Fs5, 2), N(8, 2, E5, 0.75), N(8, 2.75, D5, 1.25)], 0.5);
pl(bt(7), B2, 0.4, { T60: 5 }); pl(bt(8), A2, 0.44, { T60: 5 });
[[7, 2, Fs4], [7, 3, B4], [8, 1, E4], [8, 2.5, A4], [8, 3.5, D5]].forEach(([b, k, m]) => pl(bt(b, k), m, 0.24));

// Bars 9-10  red cascade (the strongest moment)
gliss(bt(9) + 0.55, D6, D3, 0.62, 0.42, 0.25);
pl(bt(9), D3 - 12, 0.7, { T60: 6, bright: 0.35 });
place(music, drum({ vel: 0.55, pitch: D3 }), bt(9), 0.8, 0);
place(music, drum({ vel: 0.4, pitch: D3 }), bt(9, 2.5), 0.8, 0);
place(music, drum({ vel: 0.5, pitch: B2 }), bt(10), 0.8, 0);
place(music, drum({ vel: 0.36, pitch: B2 }), bt(10, 2.5), 0.8, 0);
const ost9 = [D4, A4, D5, A4, Fs4, A4, D5, A4], ost10 = [B3, Fs4, B4, Fs4, D4, Fs4, B4, Fs4];
for (let k = 0; k < 16; k++) {
  const acc = [0.3, 0.17, 0.22, 0.17][k % 4];
  pl(bt(9, k * 0.25), ost9[k % 8], acc, { T60: 1.4 });
  pl(bt(10, k * 0.25), ost10[k % 8], acc * (k < 12 ? 1 : 1 - (k - 11) * 0.12), { T60: 1.4 });
}
pl(bt(9, 0), A5, 0.66, { T60: 4 }); pl(bt(9, 1), Fs5, 0.56); pl(bt(9, 1.5), E5, 0.54);
pl(bt(9, 2), D5, 0.62, { T60: 4.5, vib: 0.16 }); pl(bt(9, 3.5), E5, 0.5);
pl(bt(10, 0), Fs5, 0.64, { T60: 4.5, bend: [{ at: 0.2, to: -2, dur: 0.01 }, { at: 0.2, to: 2, dur: 0.25 }] });
pl(bt(10, 1), E5, 0.52); pl(bt(10, 1.5), D5, 0.52);
pl(bt(10, 2), B4, 0.6, { T60: 4.5, vib: 0.16 }); pl(bt(10, 3), A4, 0.48); pl(bt(10, 3.5), B4, 0.44);
pl(bt(10), B2 - 12, 0.6, { T60: 6, bright: 0.35 });

// Bars 11-12  autumn ruins (falling figures, thinning out)
pl(bt(11), E3, 0.5, { T60: 6 }); pl(bt(11), B3, 0.34);
const fall = (bar, beat, seq, v = 0.4) => seq.forEach((m, i) => pl(bt(bar, beat) + i * 0.15 * (1 + i * 0.12), m, v * (1 - i * 0.07), { T60: 3 }));
fall(11, 0.5, [A5, Fs5, E5, D5, B4], 0.46);
fall(11, 2.5, [E5, D5, B4, A4], 0.4);
fall(12, 0.5, [D5, B4, A4, Fs4, E4], 0.4);
fall(12, 2.5, [B4, A4, Fs4, E4, D4], 0.34);
flute([N(11, 1, B4, 2.5), N(12, 0, A4, 3.2)], 0.4);
pl(bt(12), A2, 0.42, { T60: 5 });

// Bars 13-14  golden river (warm, broad)
gliss(bt(13), A3, A4, 0.5, 0.12, 0.3);
roll(bt(13), [D2 + 12 - 12, A2, D3, Fs3, A3, D4], 0.46, 0.045);
flute([N(13, 0.5, Fs5, 1.5), N(13, 2, E5, 1), N(13, 3, D5, 1.5), N(14, 0.5, B4, 1), N(14, 1.5, A4, 2.6)], 0.5, -0.1);
roll(bt(14), [B1 + 12, Fs2 + 12, B3, D4, Fs4], 0.4, 0.05);
[[13, 2, A4], [13, 3.5, Fs4], [14, 2.5, D4], [14, 3.5, E4]].forEach(([b, k, m]) => pl(bt(b, k), m, 0.2));

// Bars 15-16  stone bridge, red sun (guzheng alone, expressive)
roll(bt(15), [E2 + 12, B2, E3, B3], 0.36, 0.06);
pl(bt(15, 0.5), B4, 0.48, { T60: 4, bend: [{ at: 0, to: -2, dur: 0.001 }, { at: 0.05, to: 2, dur: 0.22 }] });
pl(bt(15, 1.5), A4, 0.42); pl(bt(15, 2), Fs4, 0.42);
pl(bt(15, 3), E4, 0.48, { T60: 5, vib: 0.2 });
roll(bt(16), [A2, E3, A3], 0.34, 0.06);
pl(bt(16, 0.5), D4, 0.4); pl(bt(16, 1), E4, 0.4);
pl(bt(16, 2), A4, 0.5, { T60: 5, bend: [{ at: 0.3, to: 2, dur: 0.35, back: 1.1, backDur: 0.5 }] });
pl(bt(16, 3.5), Fs4, 0.32);

// Bars 17-18  moon over the lake (breakdown, yu mode on B)
pl(bt(17), B2, 0.34, { T60: 6 });
hm(bt(17), B4 + 12, 0.34); hm(bt(17, 1.5), Fs5 + 12, 0.24); hm(bt(17, 3), D5 + 12, 0.24);
hm(bt(18, 0.5), B5, 0.26); hm(bt(18, 2), A5, 0.22);
flute([N(17, 0.5, B4, 2.5), N(17, 3.25, A4, 0.75), N(18, 0, Fs4, 2.5), N(18, 2.75, E4, 1.0), N(18, 3.75, D4, 1.4)], 0.36, -0.2);

// Bars 19-20  snow temple, then back to paper
[D6, B5, A5, Fs5, E5, D5].forEach((m, i) => hm(bt(18, 2.4) + i * 0.22, m + 12 - 12, 0.16 + i * 0.015));
place(music, bowl(D4, { vel: 0.5, T60: 8 }), bt(19), 0.7, 0.05);
hm(bt(19, 1.5), A5, 0.22); hm(bt(19, 3), D5 + 12, 0.2);
pl(bt(20, 0.5) - 1.0, D4, 0.3, { T60: 4 });
place(sfx, knock({ vel: 0.55 }), CUE.seal, 1, 0.25);
// picture-caused air: the camera rising through the cloud bank, and the leaf gust
{
  const cr = SHOTS.find((s) => s.in && s.in.type === 'cloudrise');
  const w1 = whoosh(cr.in.dur + 0.6, { f0: 180, f1: 700, f2: 300, apex: 0.5, q: 0.7, seed: 3 });
  place(sfx, w1, cr.start - 0.2, 0.32, -0.1);
  const g = whoosh(3.0, { f0: 300, f1: 1300, f2: 520, apex: 0.38, q: 0.8, rustle: 0.55, seed: 9 });
  place(sfx, g, CUE.gust - 0.05, 0.36, -0.35);
}
hm(CUE.evaporate + 0.05, D5, 0.3, { T60: 3.6 }); hm(CUE.evaporate + 0.05, D5 + 12, 0.18, { T60: 3.2 });

// ------------------------------------------------------------------ drone
{
  const segs = [
    { t0: -1, t1: bt(9), notes: [D2, A2], lvl: 0.055 },
    { t0: bt(9), t1: bt(11), notes: [D2, A2, D3], lvl: 0.07 },
    { t0: bt(11), t1: bt(17) - 0.6, notes: [D2, A2], lvl: 0.05 },
    { t0: bt(17) - 0.6, t1: bt(19) - 0.6, notes: [B1, Fs2], lvl: 0.045 },
    { t0: bt(19) - 0.6, t1: CUE.evaporate + 0.6, notes: [D2, A2], lvl: 0.035 },
  ];
  const rnd = rngOf(77);
  const cutoff = envOf([[0, 260], [6, 420], [18, 600], [24, 900], [30, 700], [36, 820], [42, 560], [48, 380], [54, 420], [60, 300]]);
  for (let c = 0; c < 2; c++) {
    const lp = new Biquad('lp', 400, 0.6);
    const ph = segs.map((s) => s.notes.map(() => rnd()));
    for (let i = 0; i < LEN; i++) {
      const t = i / SR;
      if (i % 128 === 0) lp.set('lp', cutoff(t), 0.6);
      let s = 0;
      segs.forEach((sg, si) => {
        const e = clamp((t - sg.t0) / 1.4, 0, 1) * clamp((sg.t1 - t) / 1.6 + 1, 0, 1);
        if (e <= 0) return;
        sg.notes.forEach((m, k) => {
          const f = mtof(m) * (1 + (c ? 0.0018 : -0.0018) * (k + 1));
          ph[si][k] = (ph[si][k] + f / SR) % 1;
          const saw = 2 * ph[si][k] - 1;
          s += (saw * 0.35 + Math.sin(2 * Math.PI * ph[si][k]) * 0.65) * sg.lvl * e;
        });
      });
      pads[c][i] = lp.p(s) * (1 + 0.08 * Math.sin(2 * Math.PI * 0.11 * t + c));
    }
  }
  // fade in from frame 0 quickly (enters with intent), out before the end
  for (let i = 0; i < LEN; i++) { const t = i / SR; const g = clamp(t / 0.25, 0, 1) * clamp((59.5 - t) / 1.5, 0, 1); pads[0][i] *= g; pads[1][i] *= g; }
}

// ------------------------------------------------------------------ ambience
{
  // per-shot levels for each bed, crossfading across each transition window
  const LV = {
    s07: { rustle: 0.55, water: 0.10, wind: 0.30 },
    s01: { water: 0.34, wind: 0.22 },
    s04: { water: 0.22, wind: 0.34 },
    s09: { wind: 0.42, water: 0.08 },
    s08: { water: 0.72, wind: 0.15 },
    s10: { rustle: 0.40, wind: 0.42, water: 0.12 },
    s02: { water: 0.26, wind: 0.18 },
    s05: { lap: 0.34, wind: 0.14 },
    s03: { lap: 0.26, wind: 0.08 },
    s06: { snow: 0.30 },
    '@paper': {},
  };
  const keys = ['rustle', 'water', 'wind', 'lap', 'snow'];
  const shots = SHOTS.filter((s) => s.start >= 0 || s.scene !== '@paper');
  const level = (key, t) => {
    let i = 0;
    for (let k = 0; k < shots.length; k++) if (shots[k].start <= t) i = k;
    const B = shots[i], A = shots[i - 1];
    const vb = (LV[B.scene] || {})[key] || 0;
    if (B.in && A && t < B.start + B.in.dur) {
      const u = clamp((t - B.start) / B.in.dur, 0, 1), e = u * u * (3 - 2 * u);
      const va = (LV[A.scene] || {})[key] || 0;
      return va + (vb - va) * e;
    }
    return vb;
  };
  const curves = {};
  for (const k of keys) { curves[k] = new Float32Array(Math.ceil(LEN / 64) + 1); for (let j = 0; j < curves[k].length; j++) curves[k][j] = level(k, (j * 64) / SR); }
  const cv = (k, i) => curves[k][i >> 6];
  const intro = (t) => clamp(t / 0.3, 0, 1) * clamp((59.6 - t) / 1.2, 0, 1);

  for (let c = 0; c < 2; c++) {
    const rnd = rngOf(900 + c * 17);
    const pink = pinkGen(rnd), pink2 = pinkGen(rngOf(1300 + c));
    const gust = lfoGen(rngOf(55), 0.18), gust2 = lfoGen(rngOf(56 + c), 0.6);
    const wbp = new Biquad('bp', 500, 0.9), wlp = new Biquad('lp', 2600, 0.7), whp = new Biquad('hp', 110, 0.7);
    const rhp = new Biquad('hp', 2200, 0.7), rlp = new Biquad('lp', 9000, 0.7);
    const snowbp = new Biquad('bp', 1600, 0.8);
    let brown = 0;
    // rustle grains
    let grain = 0, grainAmp = 0, grainDec = 0.99;
    // lapping bursts
    let lapEnv = 0, lapTarget = 0, nextLap = 0.3 + rnd(), lapBP = new Biquad('bp', 600, 2.5);
    for (let i = 0; i < LEN; i++) {
      const t = i / SR;
      const w = rnd() * 2 - 1;
      let s = 0;
      // wind
      const lw = cv('wind', i);
      if (lw > 0.001) {
        if (i % 64 === 0) wbp.set('bp', 380 * Math.pow(2, 1.1 * gust(t) + 0.3 * gust2(t)), 0.9);
        s += wbp.p(pink()) * lw * (0.55 + 0.45 * (gust(t) * 0.5 + 0.5)) * 1.6;
      }
      // water (waterfall / river)
      const lwa = cv('water', i);
      if (lwa > 0.001) {
        brown = brown * 0.985 + w * 0.06;
        s += whp.p(wlp.p(brown * 0.9 + pink2() * 0.8)) * lwa * (1 + 0.06 * gust2(t)) * 1.1;
      }
      // rustle (bamboo / leaves)
      const lr = cv('rustle', i);
      if (lr > 0.001) {
        const rate = 18 + 60 * (gust(t) * 0.5 + 0.5);
        if (rnd() < rate / SR) { grainAmp = 0.4 + rnd() * 0.6; grainDec = Math.exp(-1 / ((0.008 + rnd() * 0.03) * SR)); }
        grain = grainAmp; grainAmp *= grainDec;
        s += rlp.p(rhp.p(w)) * grain * lr * 0.6;
      }
      // lapping water
      const ll = cv('lap', i);
      if (ll > 0.001) {
        if (t >= nextLap) { lapTarget = 0.5 + rnd() * 0.5; nextLap = t + 0.7 + rnd() * 1.1; lapBP.set('bp', 380 + rnd() * 500, 2.2); }
        lapEnv += (lapTarget - lapEnv) * (lapTarget > lapEnv ? 0.0009 : 0.00016);
        if (lapEnv > lapTarget * 0.97) lapTarget = 0;
        s += lapBP.p(pink()) * lapEnv * ll * 2.2;
      }
      // snow wind (soft, high)
      const lsn = cv('snow', i);
      if (lsn > 0.001) s += snowbp.p(pink2()) * lsn * (0.6 + 0.4 * gust(t + 7)) * 1.2;
      amb[c][i] = s * intro(t);
    }
  }
}

// ------------------------------------------------------------------ mix
const hall = reverb(music, { room: 0.88, damp: 0.32, predelay: 0.03, hp: 240 });
const room = reverb(sfx, { room: 0.55, damp: 0.5, predelay: 0.01, hp: 300 });
const mix = bus();
addBus(mix, music, 1.0);
addBus(mix, hall, 0.55);
addBus(mix, pads, 1.0);
addBus(mix, amb, 0.32);
addBus(mix, sfx, 0.8);
addBus(mix, room, 0.3);
// mono low end below ~120 Hz, gentle high-pass at 28 Hz
{
  const lpL = new Biquad('lp', 120, 0.7), lpR = new Biquad('lp', 120, 0.7), hp0 = new Biquad('hp', 28, 0.7), hp1 = new Biquad('hp', 28, 0.7);
  for (let i = 0; i < LEN; i++) {
    const l = mix[0][i], r = mix[1][i];
    const lowL = lpL.p(l), lowR = lpR.p(r), lowM = (lowL + lowR) / 2;
    mix[0][i] = hp0.p(l - lowL + lowM); mix[1][i] = hp1.p(r - lowR + lowM);
  }
}
// tail: everything reaches digital silence on the last frame
for (let i = 0; i < LEN; i++) {
  const t = i / SR;
  const g = clamp((DURATION - 0.03 - t) / 1.1, 0, 1);
  const head = clamp(i / (0.003 * SR), 0, 1);
  mix[0][i] *= g * head; mix[1][i] *= g * head;
}

function writeWav(file, ch, { bits = 32 } = {}) {
  const n = ch[0].length, nc = ch.length;
  const bps = bits / 8;
  const buf = Buffer.alloc(44 + n * nc * bps);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * nc * bps, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(bits === 32 ? 3 : 1, 20); buf.writeUInt16LE(nc, 22); buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * nc * bps, 28); buf.writeUInt16LE(nc * bps, 32); buf.writeUInt16LE(bits, 34); buf.write('data', 36); buf.writeUInt32LE(n * nc * bps, 40);
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < nc; c++) {
    const v = ch[c][i];
    if (bits === 32) buf.writeFloatLE(v, o);
    else { const s = Math.round(clamp(v, -1, 1) * 8388607); buf.writeIntLE(s, o, 3); }
    o += bps;
  }
  fs.writeFileSync(file, buf);
}

function measure(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /\{[\s\S]*\}/.exec(r.stderr);
  return JSON.parse(m[0]);
}

// true-peak-aware lookahead limiter (4x oversampled peak estimate)
function limit(ch, ceilingDb = -1.6) {
  const ceil = dbToLin(ceilingDb);
  const n = ch[0].length, look = Math.round(0.004 * SR), rel = Math.exp(-1 / (0.12 * SR));
  const peak = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let p = 0;
    for (const c of ch) {
      const y0 = c[Math.max(0, i - 1)], y1 = c[i], y2 = c[Math.min(n - 1, i + 1)], y3 = c[Math.min(n - 1, i + 2)];
      for (let k = 0; k < 4; k++) { const f = k / 4; const c1 = 0.5 * (y2 - y0), c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3, c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2); const v = Math.abs(((c3 * f + c2) * f + c1) * f + y1); if (v > p) p = v; }
    }
    peak[i] = p;
  }
  // required gain per sample, minimum over the lookahead window, then smoothed release
  const need = new Float32Array(n);
  for (let i = 0; i < n; i++) need[i] = peak[i] > ceil ? ceil / peak[i] : 1;
  const gmin = new Float32Array(n);
  const dq = [];
  for (let i = n - 1; i >= 0; i--) {
    while (dq.length && need[dq[dq.length - 1]] >= need[i]) dq.pop();
    dq.push(i);
    while (dq[0] > i + look) dq.shift();
    gmin[i] = need[dq[0]];
  }
  let g = 1, maxGR = 0;
  for (let i = 0; i < n; i++) {
    const target = gmin[i];
    g = target < g ? target : target + (g - target) * rel;
    if (g > target) g = target;
    for (const c of ch) c[i] *= g;
    maxGR = Math.max(maxGR, -20 * Math.log10(g));
  }
  return maxGR;
}

const rawFile = path.join(OUT, 'mix-raw.wav');
writeWav(rawFile, mix);
let m0 = measure(rawFile);
console.log(`raw mix: ${(+m0.input_i).toFixed(1)} LUFS, TP ${(+m0.input_tp).toFixed(1)} dBTP, LRA ${(+m0.input_lra).toFixed(1)} LU`);
let gainDb = -14 - +m0.input_i;
let final, mFinal;
for (let pass = 0; pass < 4; pass++) {
  final = [Float32Array.from(mix[0]), Float32Array.from(mix[1])];
  const g = dbToLin(gainDb);
  for (const c of final) for (let i = 0; i < c.length; i++) c[i] *= g;
  const gr = limit(final, -1.7);
  const out = path.join(OUT, 'soundtrack.wav');
  writeWav(out, final, { bits: 24 });
  mFinal = measure(out);
  console.log(`pass ${pass}: gain ${gainDb.toFixed(2)} dB, limiter max GR ${gr.toFixed(2)} dB -> ${(+mFinal.input_i).toFixed(2)} LUFS, TP ${(+mFinal.input_tp).toFixed(2)} dBTP, LRA ${(+mFinal.input_lra).toFixed(1)}`);
  const err = -14 - +mFinal.input_i;
  if (Math.abs(err) < 0.2) break;
  gainDb += err;
}
fs.rmSync(rawFile, { force: true });
if (args.stems) {
  const sd = path.join(OUT, 'stems'); fs.mkdirSync(sd, { recursive: true });
  writeWav(path.join(sd, 'music.wav'), music); writeWav(path.join(sd, 'hall.wav'), hall); writeWav(path.join(sd, 'pads.wav'), pads); writeWav(path.join(sd, 'amb.wav'), amb); writeWav(path.join(sd, 'sfx.wav'), sfx);
}
console.log('wrote', path.join(OUT, 'soundtrack.wav'));
