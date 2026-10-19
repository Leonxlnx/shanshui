// Page entry. Exposes window.__api for the Node tools (stills, sheets,
// comparisons, film capture) and a small live viewer when opened by hand.

import { Engine, W, H } from './engine/engine.js';
import { SCENES, REF } from './scenes/index.js';

const params = new URLSearchParams(location.search);
const state = { engine: null, scene: null, sceneId: null, film: null };

async function post(path, body, type = 'application/octet-stream') {
  const r = await fetch(path, { method: 'POST', body, headers: { 'Content-Type': type } });
  if (!r.ok) throw new Error('POST ' + path + ' -> ' + r.status + ' ' + (await r.text()));
  return r.text();
}

function canvasEl() {
  let c = document.getElementById('view');
  if (!c) { c = document.createElement('canvas'); c.id = 'view'; document.body.appendChild(c); }
  return c;
}

const api = {
  async init({ scale = 1 } = {}) {
    if (state.engine && state.engine.scale === scale) return state.engine.info();
    state.engine = new Engine(canvasEl(), { scale });
    state.scene = null; state.sceneId = null; state.film = null;
    return state.engine.info();
  },

  async loadScene(id, opts = {}) {
    const eng = state.engine;
    if (state.scene) { eng.disposeScene(state.scene); state.scene = null; }
    // registry id (s01..s10) or a module path under src/ (e.g. "lab/pine" -> src/lab/pine.js)
    const loader = SCENES[id] || (() => import('./' + id.replace(/\.js$/, '') + '.js'));
    const mod = await loader();
    state.scene = await eng.buildScene(mod, opts);
    state.sceneId = id;
    state.refId = opts.ref || mod.default.ref || REF[id] || '01';
    return { id, buildMs: Math.round(state.scene.buildMs), layers: state.scene.layers.length, title: mod.default.title };
  },

  renderScene(t, { samples = 1 } = {}) {
    const t0 = performance.now();
    state.engine.renderSceneFrame(state.scene, t, { samples });
    state.engine.gl.finish();
    return Math.round(performance.now() - t0);
  },

  // force grade values for A/B tests, e.g. { ink: [0.5, 1, 1.6, 0] }
  setGrade(g) { state.engine.gradeOverride = g || null; },

  async savePNG(path) {
    const c = canvasEl();
    const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
    return post('/save?path=' + encodeURIComponent(path), blob);
  },

  // Reference above, render below (or side by side), scaled to `width` px wide each.
  async saveCompare(path, { width = 960, layout = 'stack', refId } = {}) {
    const ref = refId || state.refId;
    const img = new Image();
    img.src = '/ref/' + ref + '.webp';
    await img.decode();
    const c = canvasEl();
    const h = Math.round(width * 9 / 16);
    const out = new OffscreenCanvas(layout === 'stack' ? width : width * 2 + 8, layout === 'stack' ? h * 2 + 8 : h);
    const x = out.getContext('2d');
    x.fillStyle = '#222'; x.fillRect(0, 0, out.width, out.height);
    x.imageSmoothingQuality = 'high';
    x.drawImage(img, 0, 0, width, h);
    if (layout === 'stack') x.drawImage(c, 0, h + 8, width, h); else x.drawImage(c, width + 8, 0, width, h);
    const blob = await out.convertToBlob({ type: 'image/png' });
    return post('/save?path=' + encodeURIComponent(path), blob);
  },

  // Crop a region (design px) of reference and render, side by side, upscaled to `width` each.
  async saveCrop(path, { x = 0, y = 0, w = 640, h = 360, width = 900, refId } = {}) {
    const ref = refId || state.refId;
    const img = new Image();
    img.src = '/ref/' + ref + '.webp';
    await img.decode();
    const c = canvasEl();
    const sx = img.naturalWidth / W, cx = c.width / W;
    const oh = Math.round(width * h / w);
    const out = new OffscreenCanvas(width * 2 + 8, oh);
    const g = out.getContext('2d');
    g.fillStyle = '#222'; g.fillRect(0, 0, out.width, out.height);
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, x * sx, y * sx, w * sx, h * sx, 0, 0, width, oh);
    g.drawImage(c, x * cx, y * cx, w * cx, h * cx, width + 8, 0, width, oh);
    const blob = await out.convertToBlob({ type: 'image/png' });
    return post('/save?path=' + encodeURIComponent(path), blob);
  },

  // Contact sheet: render the current scene at each time, tile with labels.
  async saveSheet(path, { times, cols = 4, width = 480, samples = 1 } = {}) {
    const c = canvasEl();
    const h = Math.round(width * 9 / 16);
    const rows = Math.ceil(times.length / cols);
    const out = new OffscreenCanvas(cols * width + (cols - 1) * 4, rows * h + (rows - 1) * 4);
    const g = out.getContext('2d');
    g.fillStyle = '#222'; g.fillRect(0, 0, out.width, out.height);
    for (let i = 0; i < times.length; i++) {
      if (state.film) { await state.film.prepare(times[i]); api.renderFilm(times[i], { samples }); } else state.engine.renderSceneFrame(state.scene, times[i], { samples });
      const x = (i % cols) * (width + 4), y = Math.floor(i / cols) * (h + 4);
      g.drawImage(c, x, y, width, h);
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x, y, 74, 20);
      g.fillStyle = '#fff'; g.font = '13px monospace'; g.fillText('t=' + times[i].toFixed(2), x + 4, y + 14);
    }
    const blob = await out.convertToBlob({ type: 'image/png' });
    return post('/save?path=' + encodeURIComponent(path), blob);
  },

  // ---------------- film ----------------
  async loadFilm(opts = {}) {
    const { Film } = await import('./film.js');
    state.film = new Film(state.engine, opts);
    return state.film.summary();
  },
  renderFilm(T, { samples = 1 } = {}) {
    return state.film.renderAt(T, { samples });
  },
  async prepareFilm(T) { await state.film.prepare(T); },

  // Stream frames [from, to) as planar yuv420p (converted on the GPU) over a WebSocket to the render tool.
  // Up to 2 frames in flight so GPU work overlaps the transfer.
  async streamFilm({ from = 0, to, fps = 60, samples = 1 } = {}) {
    const eng = state.engine;
    const ws = new WebSocket('ws://' + location.host + '/frames');
    ws.binaryType = 'arraybuffer';
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('frame socket failed')); });
    let acked = from;
    const waiters = [];
    ws.onmessage = () => { acked++; while (waiters.length && waiters[0].n <= acked) waiters.shift().r(); };
    const waitAck = (n) => (acked >= n ? Promise.resolve() : new Promise((r) => waiters.push({ n, r })));
    const t0 = performance.now();
    const acc = { prep: 0, render: 0, read: 0, send: 0 };
    for (let f = from; f < to; f++) {
      const T = f / fps;
      let a = performance.now();
      await state.film.prepare(T);
      let b = performance.now(); acc.prep += b - a;
      state.film.renderAt(T, { samples, fps, target: eng.targets.tmp });
      a = performance.now(); acc.render += a - b;
      const buf = eng.readYUV(eng.targets.tmp);
      b = performance.now(); acc.read += b - a;
      await waitAck(f - 1);            // keep at most 2 frames in flight
      ws.send(buf);
      a = performance.now(); acc.send += a - b;
      if ((f - from) % 60 === 59) {
        const n = f - from + 1;
        await post('/log', `frame ${f + 1}/${to} ${((performance.now() - t0) / n).toFixed(0)} ms/f  (prep ${(acc.prep / n).toFixed(0)}, render ${(acc.render / n).toFixed(0)}, yuv+read ${(acc.read / n).toFixed(0)}, wait+send ${(acc.send / n).toFixed(0)})`, 'text/plain');
      }
    }
    await waitAck(to);
    ws.close();
    return Math.round(performance.now() - t0);
  },
};
window.__api = api;

// ---------------- live viewer (opened by hand) ----------------
// Space: play/pause  Left/Right: previous/next painting  F: fullscreen  M: sound
async function viewer() {
  document.body.style.cssText = 'margin:0;background:#0d0d0c;display:grid;place-items:center;height:100vh;overflow:hidden;font:13px/1.4 system-ui,sans-serif;color:#9a958c';
  const scale = +(params.get('scale') || 0.5);
  await api.init({ scale });
  const c = canvasEl();
  c.style.cssText = 'width:min(100vw,177.78vh);height:auto;aspect-ratio:16/9;display:block';
  const hud = document.createElement('div');
  hud.style.cssText = 'position:fixed;left:16px;bottom:12px;letter-spacing:.02em;opacity:.8;pointer-events:none;transition:opacity 1s';
  document.body.appendChild(hud);
  const id = params.get('scene');
  if (id) {
    hud.textContent = 'painting ' + id + '...';
    const info = await api.loadScene(id);
    hud.textContent = info.title;
    const start = performance.now();
    const t0 = +(params.get('t') || 0);
    const loop = () => { state.engine.renderSceneFrame(state.scene, t0 + (performance.now() - start) / 1000); requestAnimationFrame(loop); };
    loop();
    return;
  }
  await api.loadFilm();
  const film = state.film;
  // build every painting up front so playback never stalls
  const scenes = [...new Set(film.shots.filter((s) => s.scene !== '@paper').map((s) => s.scene))];
  for (let i = 0; i < scenes.length; i++) {
    hud.textContent = `painting ${i + 1} / ${scenes.length}`;
    await new Promise((r) => setTimeout(r, 0));
    await film.buildShot(film.shots.find((s) => s.scene === scenes[i]));
  }
  for (const s of film.shots) if (s.scene !== '@paper') await film.buildShot(s);
  // everything is resident now: only overlays still need building on demand
  film.prepare = async (T) => {
    for (const ov of film.overlays) {
      const on = T >= ov.from - 0.6 && T <= ov.to;
      if (on && !film.overlayBuilt.has(ov)) film.overlayBuilt.set(ov, await ov.make(state.engine.api('overlay')));
    }
  };
  const audio = new Audio('out/audio/soundtrack.wav');
  let hasAudio = false;
  audio.addEventListener('canplaythrough', () => { hasAudio = true; });
  let playing = true, T = 0, last = performance.now(), muted = true;
  hud.textContent = 'space: pause   arrows: paintings   f: fullscreen   m: sound';
  setTimeout(() => (hud.style.opacity = '0'), 4000);
  const starts = film.shots.filter((s) => s.scene !== '@paper').map((s) => s.start + (s.in ? s.in.dur : 0));
  const seek = (t) => { T = (t + film.duration) % film.duration; if (hasAudio) audio.currentTime = T; };
  addEventListener('keydown', (e) => {
    if (e.code === 'Space') { playing = !playing; if (hasAudio && !muted) (playing ? audio.play() : audio.pause()); e.preventDefault(); }
    if (e.code === 'ArrowRight') seek(starts.find((s) => s > T + 0.1) ?? 0);
    if (e.code === 'ArrowLeft') seek([...starts].reverse().find((s) => s < T - 0.5) ?? 0);
    if (e.code === 'KeyF') (document.fullscreenElement ? document.exitFullscreen() : c.requestFullscreen());
    if (e.code === 'KeyM' && hasAudio) { muted = !muted; audio.currentTime = T; muted ? audio.pause() : audio.play(); }
  });
  let busy = false;
  const loop = async () => {
    const now = performance.now();
    if (playing) T += (now - last) / 1000;
    last = now;
    if (T >= film.duration) { T = 0; if (hasAudio) audio.currentTime = 0; }
    if (hasAudio && !muted && playing && Math.abs(audio.currentTime - T) > 0.08) T = audio.currentTime;
    if (!busy) { busy = true; await film.prepare(T); film.renderAt(T); busy = false; }
    requestAnimationFrame(loop);
  };
  loop();
}

if (!params.has('tool')) viewer().catch((e) => { document.body.textContent = String(e.stack || e); });
