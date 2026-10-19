// Render the film (or a range of it) straight into ffmpeg: frames are read
// back from the GPU and streamed as raw RGBA, never written to disk.
//
//   node tools/render.mjs --out out/film.mp4                     master: 1920x1080@60, CRF 16, x264 slow
//   node tools/render.mjs --out out/preview.mp4 --preview        960x540@30, fast
//        [--from 0] [--to 60] (seconds)  [--fps 60] [--scale 1] [--samples 1] [--crf 16]
//        [--audio out/soundtrack.wav]  [--shots path/to/shots.json]  (override the shot list)
//
// Also: --still T --png out/x.png  renders one film frame;  --sheet T1,T2,..:out/x.png a contact sheet.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { openPage, parseArgs, ROOT } from './lib.mjs';
import { WebSocketServer } from 'ws';

const a = parseArgs();
const preview = !!a.preview;
const fps = +(a.fps || (preview ? 30 : 60));
const scale = +(a.scale || (preview ? 0.5 : 1));
const samples = +(a.samples || 1);
const crf = +(a.crf || (preview ? 22 : 16));
const from = +(a.from || 0);
const shots = a.shots ? JSON.parse(fs.readFileSync(path.resolve(ROOT, a.shots), 'utf8')) : null;

const { page, server, close } = await openPage({ scale, quiet: true });
let code = 0;
try {
  const sum = await page.evaluate((s) => window.__api.loadFilm(s ? { shots: s } : {}), shots);
  const to = +(a.to || sum.duration);
  if (a.still !== undefined) {
    const T = +a.still;
    await page.evaluate((T) => window.__api.prepareFilm(T), T);
    await page.evaluate((T, s) => window.__api.renderFilm(T, { samples: s }), T, samples);
    console.log('wrote', await page.evaluate((p) => window.__api.savePNG(p), a.png || `out/film-${T}.png`));
  } else if (a.sheet) {
    const s = String(a.sheet); const i = s.lastIndexOf(':');
    const times = s.slice(0, i).split(',').map(Number);
    console.log('wrote', await page.evaluate((p, times, smp) => window.__api.saveSheet(p, { times, cols: 4, width: 480, samples: smp }), s.slice(i + 1), times, samples));
  } else {
    const out = path.resolve(ROOT, a.out || 'out/film.mp4');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const info = await page.evaluate(() => ({ w: document.getElementById('view').width, h: document.getElementById('view').height }));
    const f0 = Math.round(from * fps), f1 = Math.round(to * fps);
    const args = ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'yuv420p', '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-s', `${info.w}x${info.h}`, '-r', String(fps), '-i', '-'];
    if (a.audio) args.push('-ss', String(from), '-i', path.resolve(ROOT, a.audio));
    args.push('-vf', 'setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv',
      '-c:v', 'libx264', '-preset', preview ? 'veryfast' : 'slow', '-crf', String(crf), '-tune', 'film',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv');
    if (a.audio) args.push('-map', '0:v:0', '-map', '1:a:0', '-af', 'apad', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-ac', '2', '-t', String((f1 - f0) / fps));
    args.push('-movflags', '+faststart', out);
    const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
    const ffDone = new Promise((r) => ff.on('close', r));
    // frames arrive as yuv420p over a WebSocket; ack each once ffmpeg has accepted it
    const wss = new WebSocketServer({ server: server.srv, path: '/frames', maxPayload: 64 * 1024 * 1024 });
    wss.on('connection', (sock) => {
      let chain = Promise.resolve();
      sock.on('message', (data) => {
        chain = chain.then(() => new Promise((res) => { if (ff.stdin.write(data)) res(); else ff.stdin.once('drain', res); })).then(() => sock.send('k'));
      });
    });
    console.log(`rendering frames ${f0}..${f1} (${(f1 - f0) / fps}s) at ${info.w}x${info.h}@${fps}, samples ${samples} -> ${out}`);
    const ms = await page.evaluate((o) => window.__api.streamFilm(o), { from: f0, to: f1, fps, samples });
    ff.stdin.end();
    const rc = await ffDone;
    console.log(`done in ${(ms / 1000).toFixed(1)} s (${(ms / (f1 - f0)).toFixed(0)} ms/frame), ffmpeg exit ${rc}`);
    if (rc !== 0) code = 1;
  }
} catch (e) {
  console.error('ERROR:', e.message);
  code = 1;
} finally {
  await close();
}
process.exit(code);
