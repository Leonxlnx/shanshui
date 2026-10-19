// Warm render daemon: one Chrome kept open on the GPU (with its shader cache),
// a fresh page per job so edited modules always reload. tools/still.mjs uses
// it automatically when it is running.
//
//   node tools/daemon.mjs            (listens on 127.0.0.1:7781)
import path from 'node:path';
import { ROOT, DAEMON_PORT, startServer, launchBrowser, newToolPage, runJob } from './lib.mjs';

const MAX_PAGES = +(process.env.SHANSHUI_MAX_PAGES || 6);
let active = 0;
const queue = [];
const acquire = () => new Promise((r) => { if (active < MAX_PAGES) { active++; r(); } else queue.push(r); });
const release = () => { const n = queue.shift(); if (n) n(); else active--; };

let browser = null;
let server = null;
async function ensureBrowser() {
  if (browser && browser.connected) return browser;
  browser = await launchBrowser(path.join(ROOT, 'out', '.chrome', 'daemon'));
  browser.on('disconnected', () => { browser = null; });
  return browser;
}

server = await startServer({
  port: DAEMON_PORT,
  extra: async (req, res, u, body) => {
    if (u.pathname !== '/job') return false;
    const job = JSON.parse(body.toString());
    const logs = [];
    const t0 = performance.now();
    const log = (s) => logs.push(`[${((performance.now() - t0) / 1000).toFixed(1)}s] ${s}`);
    await acquire();
    let page;
    try {
      const b = await ensureBrowser();
      const tp = await newToolPage(b, server.port, job.scale || 1, log, !job.verbose);
      page = tp.page;
      log('page ready');
      if (job.info) log('gpu: ' + JSON.stringify(tp.info));
      await Promise.race([
        runJob(page, job, log),
        new Promise((_, rej) => setTimeout(() => rej(new Error('job timeout after ' + (job.timeout || 240) + ' s')), (job.timeout || 240) * 1000)),
      ]);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, logs }));
    } catch (e) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, logs, error: String(e.message || e) }));
    } finally {
      if (page) { try { await page.close(); } catch {} }
      release();
    }
    return true;
  },
});
await ensureBrowser();
console.log(`shanshui render daemon on http://127.0.0.1:${server.port} (max ${MAX_PAGES} concurrent pages)`);
