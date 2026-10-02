// Early-game aura crystals: when each one is picked up and max life over time.
// usage: node crystaltime.js <ticks> <seed>
const run = require('./harness');
const [TICKS, SEED] = [parseInt(process.argv[2] || '120000'), process.argv[3] || 'evalA'];
run(async (page) => {
  await page.newGame(SEED);
  await page.evaluate((PRE) => {
    TerraJev.mode = 'teacher'; Bot.start(1);
    if (PRE) eval(PRE);   // PRE='...': tweak the bot first (A/B switches)
    const W = window.__c = { got: [], life: [] }, log0 = Bot.log.bind(Bot);
    Bot.log = (m) => { m = String(m); if (/got aura crystal|MILESTONE/.test(m)) W.got.push(G.tick + ' ' + m.slice(0, 60)); return log0(m); };
  }, process.env.PRE || '');
  for (let done = 0; done < TICKS; done += 10000) {
    await page.evaluate((k) => {
      for (let i = 0; i < k; i++) { Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame(); }
      window.__c.life.push(G.tick + ':' + G.player.lifeMax);
    }, 10000);
  }
  const r = await page.evaluate(() => window.__c);
  console.log(SEED, 'lifeMax', r.life.join(' '));
  console.log(r.got.join('\n'));
});
