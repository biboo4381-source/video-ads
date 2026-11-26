// Render the timeline's shots with headless Chromium + three.js.
//   node tools/render.mjs                 -> build/video_silent.mp4 (all shots)
//   node tools/render.mjs --stills        -> build/stills/<shot>.jpg (mid-frame of each shot)
//   node tools/render.mjs --only s05,s06  -> only those shots (stills or segments)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = path.join(ROOT, 'build');
const args = process.argv.slice(2);
const STILLS = args.includes('--stills');
const ONLY = (() => { const i = args.indexOf('--only'); return i >= 0 ? args[i + 1].split(',') : null; })();
const AT = (() => { const i = args.indexOf('--at'); return i >= 0 ? args[i + 1].split(',').map(Number) : [0.5]; })();
const W = 720, H = 1280;

const timeline = JSON.parse(fs.readFileSync(path.join(BUILD, 'timeline.json'), 'utf8'));
const beats = JSON.parse(fs.readFileSync(path.join(ROOT, 'beats.json'), 'utf8')).beats;
// take scene + params from beats.json so scene tweaks don't need a new voiceover
const shots = [];
for (const b of beats) {
  const tl = timeline.shots.filter((s) => s.beat === b.id);
  b.shots.forEach((s, k) => { const t = tl[k]; shots.push({ ...t, scene: s.scene, p: s.p || {} }); });
}
shots.forEach((s, i) => { s.id = `s${String(i).padStart(2, '0')}_${s.scene}`; });
const FPS = timeline.fps;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/renderer/index.html?w=${W}&h=${H}`);
await page.waitForFunction(() => window.READY === true, null, { timeout: 60000 });

const todo = shots.filter((s) => !ONLY || ONLY.some((o) => s.id.startsWith(o) || s.scene === o));
const t0 = Date.now();

if (STILLS) {
  const dir = path.join(BUILD, 'stills'); fs.mkdirSync(dir, { recursive: true });
  for (const s of todo) {
    await page.evaluate((shot) => window.loadShot(shot), s);
    for (const a of AT) {
      await page.evaluate((t) => window.drawFrame(t), s.dur * a);
      const url = await page.evaluate(() => window.grab(0.85));
      fs.writeFileSync(path.join(dir, `${s.id}${AT.length > 1 ? '_' + a : ''}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
    }
    console.log('still', s.id);
  }
} else {
  const dir = path.join(BUILD, 'segments'); fs.mkdirSync(dir, { recursive: true });
  for (const s of todo) {
    const f0 = Math.round(s.start * FPS), f1 = Math.round(s.end * FPS);
    const n = f1 - f0;
    const out = path.join(dir, `${s.id}.mp4`);
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(FPS), out], { stdio: ['pipe', 'inherit', 'inherit'] });
    await page.evaluate((shot) => window.loadShot(shot), s);
    const st = Date.now();
    for (let i = 0; i < n; i++) {
      await page.evaluate((t) => window.drawFrame(t), i / FPS);
      const url = await page.evaluate(() => window.grab(0.93));
      const ok = ff.stdin.write(Buffer.from(url.split(',')[1], 'base64'));
      if (!ok) await new Promise((r) => ff.stdin.once('drain', r));
    }
    ff.stdin.end();
    await new Promise((r) => ff.on('close', r));
    console.log(`${s.id} ${n}f ${((Date.now() - st) / n).toFixed(0)}ms/f`);
  }
  fs.writeFileSync(path.join(BUILD, 'shots.json'), JSON.stringify(shots, null, 1));
}
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
await browser.close();
server.close();
