// Wood with no trees around: does taskChop plant acorns and chop what grows?
const run = require('./harness');
run(async (page) => {
  await page.newGame(process.env.SEED || 'bot67');
  const r = await page.evaluate(() => {
    TerraJev.mode = 'teacher'; Bot.start(1);
    for (let i = 0; i < 3; i++) { G.update(); Input.endFrame(); }
    const w = G.world, [fx] = Bot.feet();
    for (let x = fx - 150; x <= fx + 150; x++) for (let y = 5; y < w.worldSurface + 10; y++) if (w.tile(x, y) === T.TREE) w.setTile(x, y, 0);   // clear-cut
    invAdd(G.player.inv, 'acorn', 6); invAdd(G.player.inv, 'copper_axe', 1);
    Bot.task = Bot.taskChop(40); Bot.act = { id: 'test', kind: 'reflex', at: G.tick, life: 100, seen: new Set() };
    Bot.needDecision = () => false;
    const o = [];
    for (let i = 0; i < 6000; i++) { Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame(); if (i % 1000 === 999) o.push(G.tick + ' wood=' + Bot.count('wood') + ' acorns=' + Bot.count('acorn') + ' goal=' + Bot.goal); }
    return o.concat(Bot.logLines.slice(-5));
  });
  console.log(r.join('\n'));
});
