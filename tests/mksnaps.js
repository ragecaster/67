// Play a world with the scripted teacher and save mid-game snapshots along the way (training/eval start states).
// usage: node mksnaps.js <seed> <max ticks> <out dir>
//   saves <seed>_boss<N>.json the moment the N-th boss dies, and <seed>_t<ticks>.json every 300k ticks
const run = require('./harness');
const fs = require('fs');
const [SEED, MAX, OUT] = [process.argv[2] || 'evalB', parseInt(process.argv[3] || '1200000'), process.argv[4] || '../tools/jev/snaps'];
fs.mkdirSync(OUT, { recursive: true });
run(async (page) => {
  await page.newGame(SEED);
  await page.evaluate(() => { TerraJev.mode = 'teacher'; Bot.start(1); });
  let saved = 0;
  for (let t = 0; t < MAX; ) {
    const r = await page.evaluate((have) => {
      for (let i = 0; i < 20000; i++) {
        Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame();
        if (TerraJev.BOSSES.filter(b => G.world.flags[b]).length > have && !G.npcs.some(n => n.boss)) break;
      }
      return { t: G.tick, bosses: TerraJev.BOSSES.filter(b => G.world.flags[b]).length, life: G.player.lifeMax, plan: Bot.plan && Bot.plan.label };
    }, saved);
    t = r.t;
    if (r.bosses > saved) { saved = r.bosses; await page.saveSnap(`${OUT}/${SEED}_boss${saved}.json`); console.log('saved boss' + saved, JSON.stringify(r)); }
    if (t % 300000 < 20000) { await page.saveSnap(`${OUT}/${SEED}_t${Math.round(t / 1000)}k.json`); console.log('saved', JSON.stringify(r)); }
    if (saved >= 4) break;
  }
});
