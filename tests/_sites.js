const run = require('./harness');
run(async (page) => {
  for (const seed of (process.env.SEEDS || 'evalA,evalB,evalC,evalD,evalE,evalF').split(',')) {
    await page.newGame(seed);
    console.log(seed, await page.evaluate(() => {
      const w = G.world, fx = w.spawnX, out = [];
      invAdd(G.player.inv, 'gold_pickaxe', 1);
      for (const L of [600, 520, 450, 360]) { Bot.BRIDGE_LEN = L; const b = Bot.findBridge(fx); out.push(L + ':' + (b ? b.col + '@' + b.y + ' dir' + b.dir + ' rock' + b.rock + ' d' + Math.abs(b.col - fx) : '-')); }
      return 'spawn ' + fx + ' w ' + w.w + ' | ' + out.join('  ');
    }));
  }
});
