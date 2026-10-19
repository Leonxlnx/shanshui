// Shared tooling: a tiny static server (with a binary frame sink and a file
// sink), headless Chrome on the real GPU via puppeteer-core, and the job
// runner used by both the standalone tools and the warm render daemon.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DAEMON_PORT = +(process.env.SHANSHUI_DAEMON_PORT || 7781);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css', '.wav': 'audio/wav' };

export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      if (out[k] === undefined) out[k] = v; else out[k] = [].concat(out[k], v);
    } else out._.push(a);
  }
  return out;
}

function safeOut(p) {
  const abs = path.resolve(ROOT, p);
  const outDir = path.join(ROOT, 'out');
  if (!abs.startsWith(outDir)) throw new Error('refusing to write outside out/: ' + p);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  return abs;
}

// Static files + POST sinks. `extra(req, res, u, body)` may handle more routes (returns true if handled).
export function startServer({ onFrame, onLog, port = 0, extra } = {}) {
  return new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://x');
      if (req.method === 'POST') {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', async () => {
          try {
            const body = Buffer.concat(chunks);
            if (extra && (await extra(req, res, u, body))) return;
            if (u.pathname === '/save') {
              const abs = safeOut(u.searchParams.get('path'));
              fs.writeFileSync(abs, body);
              res.end(abs);
            } else if (u.pathname === '/frame') {
              if (onFrame) await onFrame(body, +u.searchParams.get('i'));
              res.end('ok');
            } else if (u.pathname === '/log') {
              (onLog || console.log)(body.toString());
              res.end('ok');
            } else { res.statusCode = 404; res.end('no'); }
          } catch (e) { res.statusCode = 500; res.end(String(e.stack || e)); }
        });
        return;
      }
      if (u.pathname === '/ping') { res.end('pong'); return; }
      let p = decodeURIComponent(u.pathname);
      if (p === '/') p = '/index.html';
      if (p === '/favicon.ico') { res.statusCode = 204; res.end(); return; }
      const abs = path.join(ROOT, p);
      if (!abs.startsWith(ROOT) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) { res.statusCode = 404; res.end('not found'); return; }
      res.setHeader('Content-Type', MIME[path.extname(abs)] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-store');
      fs.createReadStream(abs).pipe(res);
    });
    srv.on('error', reject);
    srv.listen(port, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean).find((p) => fs.existsSync(p));

export async function launchBrowser(profile) {
  fs.mkdirSync(profile, { recursive: true });
  const { default: puppeteer } = await import('puppeteer-core');
  return puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    userDataDir: profile,
    protocolTimeout: 0,
    args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--js-flags=--max-old-space-size=8192'],
    defaultViewport: { width: 1280, height: 720, deviceScaleFactor: 1 },
  });
}

export async function killBrowser(browser) {
  const proc = browser.process();
  try { browser.disconnect(); } catch {}
  if (proc && proc.pid) {
    if (process.platform === 'win32') await new Promise((r) => execFile('taskkill', ['/pid', String(proc.pid), '/T', '/F'], () => r()));
    else { try { process.kill(proc.pid, 'SIGKILL'); } catch {} }
  }
}

export async function newToolPage(browser, port, scale, log = console.log, quiet = false) {
  const page = await browser.newPage();
  page.on('console', (m) => { if (!quiet || m.type() === 'error' || m.type() === 'warn') log('[page] ' + m.type() + ' ' + m.text()); });
  page.on('pageerror', (e) => log('[page error] ' + e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?tool=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__api);
  const info = await page.evaluate((s) => window.__api.init({ scale: s }), scale);
  return { page, info };
}

// Standalone page (own server + browser), used for film renders or when no daemon runs.
export async function openPage({ scale = 1, quiet = false } = {}) {
  const server = await startServer({ onFrame: (...a) => server.onFrame && server.onFrame(...a), onLog: (s) => console.log('[film]', s) });
  const profile = path.join(ROOT, 'out', '.chrome', 'p' + process.pid + '-' + Date.now());
  const browser = await launchBrowser(profile);
  const { page, info } = await newToolPage(browser, server.port, scale, console.log, quiet);
  const close = async () => {
    await killBrowser(browser);
    server.srv.close();
    for (let i = 0; i < 10; i++) {
      try { fs.rmSync(profile, { recursive: true, force: true }); break; } catch { await new Promise((r) => setTimeout(r, 300)); }
    }
  };
  process.on('SIGINT', async () => { await close(); process.exit(130); });
  return { page, browser, server, info, close };
}

// A still job: {scene, t, scale, samples, out, compare, side, crops:[{x,y,w,h,path}], sheets:[{times, path}], info}
export async function runJob(page, job, log = console.log) {
  const samples = job.samples || 1;
  const t = job.t || 0;
  const b = await page.evaluate((id, ref) => window.__api.loadScene(id, ref ? { ref } : {}), job.scene, job.ref || null);
  if (job.grade) await page.evaluate((g) => window.__api.setGrade(g), job.grade);
  log(`built ${b.id} "${b.title}" in ${b.buildMs} ms, ${b.layers} layers`);
  const ms = await page.evaluate((tt, s) => window.__api.renderScene(tt, { samples: s }), t, samples);
  log(`rendered t=${t} in ${ms} ms`);
  if (job.out) log('wrote ' + (await page.evaluate((p) => window.__api.savePNG(p), job.out)));
  if (job.compare) log('wrote ' + (await page.evaluate((p, w) => window.__api.saveCompare(p, { layout: 'stack', width: w }), job.compare, job.width || 960)));
  if (job.side) log('wrote ' + (await page.evaluate((p, w) => window.__api.saveCompare(p, { layout: 'side', width: w }), job.side, job.width || 960)));
  for (const c of job.crops || []) {
    log('wrote ' + (await page.evaluate((p, r) => window.__api.saveCrop(p, r), c.path, { x: c.x, y: c.y, w: c.w, h: c.h, width: job.width || 900 })));
  }
  for (const s of job.sheets || []) {
    const tile = Math.round((job.width || 960) / 2);
    log('wrote ' + (await page.evaluate((p, times, smp, tw) => window.__api.saveSheet(p, { times, cols: Math.min(4, times.length), width: tw, samples: smp }), s.path, s.times, samples, tile)));
  }
}
