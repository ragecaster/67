const run = require('./harness');
const { restore } = require('./snaplib');
run(async (page) => {
  await page.newGame('bot67');
  await restore(page, '/tmp/end4.json');
  console.log(await page.evaluate(() => {
    const w = G.world, p = G.player, out = [];
    Bot.active = false; p.sel = p.inv.findIndex(s => s && s.id === 'gold_pickaxe'); if (p.sel > 9) { const t = p.inv[9]; p.inv[9] = p.inv[p.sel]; p.inv[p.sel] = t; p.sel = 9; }
    for (let i = 0; i < 40; i++) {
      Input.mDown = true; Input.mClick = i === 0;
      Input.mx = 948 * TS + 8 - G.camX; Input.my = 256 * TS + 8 - G.camY;
      G.update(); G.draw(); Input.endFrame();
      if (i % 8 === 0) out.push(i + ' tile ' + w.tile(948, 256) + ' dmg ' + JSON.stringify([...w.damage.entries()].slice(0, 2)) + ' anim ' + p.itemAnim + ' timer ' + p.itemTimer + ' held ' + (p.inv[p.sel] || {}).id + ' tt ' + p.targetTile(w, ITEMS.gold_pickaxe) + ' reach ' + p.inReach(948, 256) + ' mw ' + G.mouseWorldX().toFixed(0) + ',' + G.mouseWorldY().toFixed(0) + ' ui ' + G.ui.mouseOverUI + ' blk ' + G.ui.blockWorldClick);
    }
    return out.join('\n');
  }));
});
