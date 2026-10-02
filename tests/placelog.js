// What does the bot place, and while doing what? (wood blocks should only ever go into the house)
// usage: node placelog.js <ticks> <seed>
const run = require('./harness');
const [TICKS, SEED] = [parseInt(process.argv[2] || '60000'), process.argv[3] || 'evalA'];
run(async (page) => {
  await page.newGame(SEED);
  await page.evaluate(() => {
    TerraJev.mode = 'teacher'; Bot.start(1);
    const W = window.__pl = {}, w = G.world, pt = w.placeTile.bind(w);
    w.placeTile = (x, y, id) => { const ok = pt(x, y, id); if (ok && Bot.active) { const k = TILES[id].name + ' <- ' + String(Bot.goal || '').replace(/[0-9(),/@:]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 40); W[k] = (W[k] || 0) + 1; } return ok; };
  });
  for (let d = 0; d < TICKS; d += 10000) await page.evaluate((k) => { for (let i = 0; i < k; i++) { Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame(); } }, 10000);
  const r = await page.evaluate(() => Object.entries(window.__pl).sort((a, b) => b[1] - a[1]).map(([k, n]) => n + '  ' + k));
  console.log(SEED + '\n' + r.slice(0, 25).join('\n'));
});
