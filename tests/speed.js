// usage: node speed.js [chunks] [seed]: ms per 2000 bot ticks, to spot slow phases (A* storms etc.)
const run = require('./harness');
run(async (page) => {
  await page.newGame(process.argv[3] || 'bot67');
  await page.evaluate(() => { Bot.start(1); });
  for (let k = 0; k < (+process.argv[2] || 15); k++) {
    const t0 = Date.now();
    const r = await page.evaluate(() => {
      for (let i = 0; i < 2000; i++) { Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame(); }
      return [Bot.goal.slice(0, 40), Math.round(Bot.planMs || 0), Bot.planCount, G.npcs.length, G.projectiles.length];
    });
    console.log(k * 2000 + 2000, Date.now() - t0, 'ms', JSON.stringify(r));
  }
});
