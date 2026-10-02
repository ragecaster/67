const { chromium } = require('playwright');
const fs = require('fs');
if (!process.env.CHROME_PATH) { const p = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'; if (fs.existsSync(p)) process.env.CHROME_PATH = p; }
if (!fs.existsSync(require('path').resolve(__dirname, '..', 'src', 'assets_data.js'))) process.env.NO_ASSETS = '1';
module.exports = async function run(fn, opts = {}) {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const page = await browser.newPage({ viewport: { width: opts.w || 1440, height: opts.h || 900 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  if (process.env.NO_ASSETS) await page.addInitScript(() => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#888'; x.fillRect(0, 0, 64, 64);
    const url = c.toDataURL();
    const keys = () => { const o = []; for (const [f, names] of Object.entries(ASSET_MANIFEST)) if (f !== 'music' && f !== 'sfx') for (const n of names) o.push(f + '/' + n.replace(/\.[^.]+$/, '')); return o; };
    window.ASSET_DATA = new Proxy({}, { ownKeys: keys, getOwnPropertyDescriptor: () => ({ value: url, enumerable: true, configurable: true }), get: () => url });
  });
  await page.addInitScript(() => { window.__rng = 0x9e3779b9; Math.random = () => { let a = window.__rng | 0; window.__rng = a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; });
  await page.goto('file://' + require('path').resolve(__dirname, '..', 'index.html'));
  await page.waitForFunction(() => typeof G !== 'undefined' && G.state === 'menu', null, { timeout: 30000 });
  await page.evaluate(() => { SETTINGS.tts = false; SETTINGS.sfx = 0; SETTINGS.music = 0; window.speechSynthesis && (window.speechSynthesis.speak = () => {}); });
  page.newGame = async (seed = '12345') => {
    await page.evaluate((seed) => {
      const it = generateWorld('Test World', seed, 'small');
      let r; while (!(r = it.next()).done) {}
      const p = new Player('Tester', null, 0); G.start(p, r.value);
    }, seed);
  };
  // snapshots: save the whole game (world, player, bot memory, RNG state) to a file, and start from one later
  page.saveSnap = async (file) => {
    const d = await page.evaluate(() => {
      const enc = v => (ArrayBuffer.isView(v) ? { __ta: v.constructor.name, b: (() => { let s = ''; const u = new Uint8Array(v.buffer, v.byteOffset, v.byteLength); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); })() } : v);
      const w = Save.serializeWorld(G.world); for (const k of Object.keys(w)) w[k] = enc(w[k]);
      const B = Bot, bot = { base: B.base, houseSpot: B.houseSpot, houseFinished: B.houseFinished, milestones: B.milestones, deaths: B.deaths, hell: B.hell ? Object.assign({}, B.hell) : null, badCrystals: B.badCrystals ? [...B.badCrystals] : [] };
      return { world: w, player: Save.serializePlayer(G.player), tick: G.tick, rng: window.__rng, bot };
    });
    fs.writeFileSync(file, JSON.stringify(d));
  };
  page.loadSnap = async (file) => {
    await page.evaluate((d) => {
      const dec = v => (v && v.__ta ? (() => { const s = atob(v.b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new window[v.__ta](u.buffer); })() : v);
      for (const k of Object.keys(d.world)) d.world[k] = dec(d.world[k]);
      const w = Save.loadWorld(d.world), p = Save.loadPlayer(d.player);
      G.start(p, w); G.tick = d.tick; window.__rng = d.rng;
      Object.assign(Bot, d.bot, { badCrystals: new Set(d.bot.badCrystals) });
      window.__snapLoaded = true;
    }, JSON.parse(fs.readFileSync(file, 'utf8')));
  };
  page.ticks = async (n) => page.evaluate((n) => { for (let i = 0; i < n; i++) { G.update(); if (i % 30 === 0) G.draw(); } }, n);
  try { await fn(page, errors); } catch (e) { console.log('TEST EXCEPTION', e.message); }
  const uniq = [...new Set(errors)];
  console.log('ERRORS (' + uniq.length + '):\n' + uniq.slice(0, 15).join('\n---\n'));
  await browser.close();
};
