// Render stills / comparisons / crops / contact sheets of one scene.
//
//   node tools/still.mjs --scene s03 --t 2 --out out/s03/a.png
//        [--compare out/s03/cmp.png]               reference (top) vs render (bottom), 960 px wide
//        [--side out/s03/side.png]                 reference | render
//        [--crop 0,300,700,500:out/s03/crop.png]   (repeatable) region in design px, ref | render, zoomed
//        [--sheet 0,2,4,6,8,10:out/s03/sheet.png]  contact sheet over time
//        [--ref 07]                                reference to compare against (default: scene's own)
//        [--width 640]                             output width per image for compare/side/crop (sheet tiles = width/2)
//        [--scale 1] [--samples 1] [--info] [--verbose]
//   --scene also accepts a module path under src/, e.g. --scene lab/pine
//
// Uses the warm render daemon (tools/daemon.mjs) when it is running, else launches Chrome itself.
import { openPage, parseArgs, runJob, DAEMON_PORT } from './lib.mjs';

const a = parseArgs();
if (!a.scene) { console.log('usage: node tools/still.mjs --scene s03 --t 2 --out out/x.png [--compare p] [--crop x,y,w,h:p] [--sheet t1,t2:p]'); process.exit(1); }
const job = {
  scene: a.scene, ref: a.ref ? String(a.ref).padStart(2, '0') : null, t: +(a.t || 0), scale: +(a.scale || 1), samples: +(a.samples || 1),
  grade: a.grade ? JSON.parse(a.grade) : null, width: a.width ? +a.width : null,
  out: a.out, compare: a.compare, side: a.side, info: !!a.info, verbose: !!a.verbose,
  crops: [].concat(a.crop || []).map((c) => { const i = c.lastIndexOf(':'); const [x, y, w, h] = c.slice(0, i).split(',').map(Number); return { x, y, w, h, path: c.slice(i + 1) }; }),
  sheets: [].concat(a.sheet || []).map((s) => { const i = s.lastIndexOf(':'); return { times: s.slice(0, i).split(',').map(Number), path: s.slice(i + 1) }; }),
};

let viaDaemon = false;
try {
  const r = await fetch(`http://127.0.0.1:${DAEMON_PORT}/ping`, { signal: AbortSignal.timeout(800) });
  viaDaemon = r.ok;
} catch {}

let code = 0;
if (viaDaemon && !a.standalone) {
  const r = await fetch(`http://127.0.0.1:${DAEMON_PORT}/job`, { method: 'POST', body: JSON.stringify(job) });
  const res = await r.json();
  for (const l of res.logs) console.log(l);
  if (!res.ok) { console.error('ERROR:', res.error); code = 1; }
} else {
  const { page, info, close } = await openPage({ scale: job.scale, quiet: !a.verbose });
  try {
    if (a.info) console.log('gpu:', JSON.stringify(info));
    await runJob(page, job);
  } catch (e) { console.error('ERROR:', e.message); code = 1; } finally { await close(); }
}
process.exit(code);
