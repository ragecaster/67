const run = require('./harness');
run(async (page) => {
  await page.newGame('bot67');
  const r = await page.evaluate(() => {
    Bot.start(1);
    const w = G.world, [fx, fy] = Bot.feet();
    // wall of wood to the left of the player, 3 high
    for (let j = 0; j < 3; j++) w.setTile(fx - 1, fy - j, T.WOOD);
    const out = [];
    Bot.task = { step() { for (let j = 0; j < 3; j++) if (w.tile(fx - 1, fy - j)) { Bot.dig(fx - 1, fy - j); return; } this.done = true; } };
    for (let i = 0; i < 900; i++) { Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || i % 60 === 0) G.draw(); Input.endFrame(); if (i % 100 === 0) out.push([i, w.tile(fx - 1, fy), w.tile(fx - 1, fy - 1), w.tile(fx - 1, fy - 2), Bot.goal, G.player.sel]); }
    return out;
  });
  console.log(r.map(x => JSON.stringify(x)).join('\n'));
});
