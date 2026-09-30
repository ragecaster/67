const { chromium } = require('playwright');
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
  page.ticks = async (n) => page.evaluate((n) => { for (let i = 0; i < n; i++) { G.update(); if (i % 30 === 0) G.draw(); } }, n);
  try { await fn(page, errors); } catch (e) { console.log('TEST EXCEPTION', e.message); }
  const uniq = [...new Set(errors)];
  console.log('ERRORS (' + uniq.length + '):\n' + uniq.slice(0, 15).join('\n---\n'));
  await browser.close();
};
