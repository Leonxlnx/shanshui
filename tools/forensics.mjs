// Frame forensics for a rendered film: decodes the video at low resolution and
// reports single-frame pops, sudden motion jumps, frozen stretches and
// luminance dips, ignoring the transition windows declared in src/timeline.js.
//
//   node tools/forensics.mjs out/preview.mp4 [--from 12] [--json out/qa/forensics.json]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, ROOT } from './lib.mjs';
import { SHOTS } from '../src/timeline.js';

const a = parseArgs();
const file = path.resolve(ROOT, a._[0] || 'out/preview.mp4');
const W = 160, H = 90;
const T0 = +(a.from || 0);   // film time of the clip's first frame (for partial renders)

function probe(f) {
  return new Promise((res) => {
    const p = spawn('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', f]);
    let s = ''; p.stdout.on('data', (d) => (s += d)); p.on('close', () => { const [n, d] = s.trim().split('/').map(Number); res(n / (d || 1)); });
  });
}
const fps = await probe(file);
const frames = [];
await new Promise((res, rej) => {
  const p = spawn('ffmpeg', ['-v', 'error', '-i', file, '-vf', `scale=${W}:${H}:flags=area,format=gray`, '-f', 'rawvideo', '-']);
  let buf = Buffer.alloc(0);
  p.stdout.on('data', (d) => {
    buf = Buffer.concat([buf, d]);
    while (buf.length >= W * H) { frames.push(new Uint8Array(buf.subarray(0, W * H))); buf = buf.subarray(W * H); }
  });
  p.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c))));
});

const inTransition = (t) => SHOTS.some((s) => s.in && t >= s.start - 0.05 && t <= s.start + s.in.dur + 0.05);
const mad = (x, y) => { let s = 0; for (let i = 0; i < x.length; i++) s += Math.abs(x[i] - y[i]); return s / x.length; };
const mean = (x) => { let s = 0; for (let i = 0; i < x.length; i++) s += x[i]; return s / x.length; };

const diffs = [0], lum = frames.map(mean);
for (let i = 1; i < frames.length; i++) diffs.push(mad(frames[i], frames[i - 1]));
const med = (arr) => { const s = [...arr].sort((p, q) => p - q); return s[Math.floor(s.length / 2)] || 0; };
const report = { file: path.basename(file), fps, frames: frames.length, median_step: +med(diffs).toFixed(3), pops: [], jumps: [], holds: [], dips: [] };

// pops: a frame that differs from both neighbours much more than they differ from each other
for (let i = 1; i < frames.length - 1; i++) {
  const t = T0 + i / fps;
  const around = mad(frames[i - 1], frames[i + 1]);
  const spike = Math.min(diffs[i], diffs[i + 1]);
  if (spike > 1.2 && spike > 3 * around + 0.5) report.pops.push({ frame: i, t: +t.toFixed(3), spike: +spike.toFixed(2), neighbours: +around.toFixed(2), inTransition: inTransition(t) });
}
// jumps: step much larger than the local median (motion lurch), outside transitions
for (let i = 3; i < frames.length - 3; i++) {
  const t = T0 + i / fps;
  if (inTransition(t)) continue;
  const local = med(diffs.slice(Math.max(1, i - 15), i + 15));
  if (diffs[i] > Math.max(1.0, local * 4)) report.jumps.push({ frame: i, t: +t.toFixed(3), step: +diffs[i].toFixed(2), local: +local.toFixed(2) });
}
// holds: stretches longer than 0.8 s where nothing changes
let run = 0;
for (let i = 1; i < frames.length; i++) {
  if (diffs[i] < 0.02) run++; else { if (run > fps * 0.8) report.holds.push({ from: +((i - run) / fps).toFixed(2), to: +(i / fps).toFixed(2) }); run = 0; }
}
// luminance dips over 25% within a second (crossfade-through-dark style)
for (let i = 0; i < lum.length; i += Math.round(fps / 6)) {
  const w = lum.slice(Math.max(0, i - fps), Math.min(lum.length, i + fps));
  const mx = Math.max(...w), here = lum[i];
  if (here < mx * 0.75) report.dips.push({ t: +(i / fps).toFixed(2), lum: +here.toFixed(1), localMax: +mx.toFixed(1) });
}
const out = a.json ? path.resolve(ROOT, a.json) : null;
if (out) { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(report, null, 1)); }
console.log(`${report.file}: ${report.frames} frames @ ${fps} fps, median step ${report.median_step}`);
console.log(`pops: ${report.pops.length} (${report.pops.filter((p) => !p.inTransition).length} outside transitions)`);
for (const p of report.pops.slice(0, 20)) console.log('  pop', JSON.stringify(p));
console.log(`motion jumps outside transitions: ${report.jumps.length}`);
for (const j of report.jumps.slice(0, 20)) console.log('  jump', JSON.stringify(j));
console.log(`holds > 0.8 s: ${report.holds.length}`, report.holds.slice(0, 10).map((h) => `${h.from}-${h.to}`).join(' '));
console.log(`luminance dips > 25%: ${report.dips.length}`);
