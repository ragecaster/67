// usage: node watch.js x y [ticks]: logs every change of tile (x,y) with the bot's goal/position at that moment
const run = require('./harness');
const X = +process.argv[2], Y = +process.argv[3], N = +process.argv[4] || 12000;
run(async (page) => {
  await page.newGame('bot67');
  await page.evaluate(() => { Bot.start(1); });
  const r = await page.evaluate(([X, Y, N]) => {
    const w = G.world, out = []; let last = w.tile(X, Y);
    for (let i = 0; i < N; i++) {
      Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame();
      const t = w.tile(X, Y);
      if (t !== last) { out.push(G.tick + ' ' + (TILES[last] ? TILES[last].name : 'air') + ' -> ' + (TILES[t] ? TILES[t].name : 'air') + ' | ' + Bot.goal + ' | feet ' + Bot.feet().join(',') + ' held ' + (G.player.inv[G.player.sel] || {}).id); last = t; }
    }
    return out;
  }, [X, Y, N]);
  console.log(r.join('\n'));
});
