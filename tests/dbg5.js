const run = require('./harness');
run(async (page) => {
  await page.newGame('bot67');
  await page.evaluate(() => { Bot.start(1); });
  const r = await page.evaluate(() => {
    const out = []; let n = 0;
    for (let i = 0; i < 30000 && n < 14; i++) {
      Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || i % 60 === 0) G.draw(); Input.endFrame();
      if (/@1059,168/.test(Bot.goal) && i % 15 === 0) {
        const p = G.player, it = p.inv[p.sel];
        const m = /@(\d+),(\d+)/.exec(Bot.goal), x = +m[1], y = +m[2];
        out.push({ i, goal: Bot.goal.slice(20,50), sel: p.sel, item: it && it.id, cnt: it && it.count, feet: Bot.feet(), reach: p.inReach(x, y), tt: p.targetTile(G.world, it && ITEMS[it.id]), tile: G.world.tile(x, y), over: p.overlapsTile(x, y), mclick: Input.mClick, npc: G.npcBlocksTile(x, y), anim: p.itemAnim, timer: p.itemTimer, mD: Input.mDown, mC: Input.mClick, ui: G.ui.mouseOverUI, mi: !!p.mouseItem, blk: G.ui.blockWorldClick });
        n++;
      }
    }
    return out;
  });
  console.log(r.map(x => JSON.stringify(x)).join('\n'));
});
