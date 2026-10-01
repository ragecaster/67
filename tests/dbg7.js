const run = require('./harness');
run(async (page) => {
  await page.newGame('bot67');
  await page.evaluate(() => { Bot.start(1); });
  const out = await page.evaluate(([a, b, step]) => {
    const out = [];
    for (let i = 0; i < b; i++) {
      Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || i % 1200 === 0) G.draw(); Input.endFrame();
      if (i >= a && (i - a) % step === 0) {
        const p = G.player, m = /@(\d+),(\d+)/.exec(Bot.goal);
        const x = m ? +m[1] : 0, y = m ? +m[2] : 0, it = p.inv[p.sel];
        out.push([i, Bot.goal.slice(20, 55), 'sel', p.sel, it && it.id, 'feet', Bot.feet().join(','), 'tile', G.world.tile(x, y), 'reach', p.inReach(x, y), 'anim', p.itemAnim, 'mD', Input.mDown, 'tries', Bot.task && Bot.task.tries, 'overl', p.overlapsTile(x, y), 'tt', p.targetTile(G.world, it && ITEMS[it.id]).join(','), 'mx', Math.round(Input.mx), Math.round(Input.my), 'cam', Math.round(G.camX), Math.round(G.camY), 'mw', Math.round(G.mouseWorldX() / 16), Math.round(G.mouseWorldY() / 16), 'ui', G.ui.mouseOverUI, G.ui.blockWorldClick, !!p.mouseItem, 'plc', it && ITEMS[it.id].use, it && ITEMS[it.id].place].join(' '));
      }
    }
    return out;
  }, [+process.argv[2], +process.argv[3], +process.argv[4] || 10]);
  console.log(out.join('\n'));
});
