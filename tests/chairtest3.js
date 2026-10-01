const run = require('./harness');
const { restore } = require('./snaplib');
run(async (page) => {
  await page.newGame('bot67');
  await restore(page, '/tmp/end4.json');
  console.log(await page.evaluate(() => {
    const w = G.world, p = G.player, out = [];
    for (let i = 0; i < 60; i++) {
      Bot.resetInputs(); Bot.wasDown = Input.mDown; UI.mouseOverUI = false;
      Bot.dig(948, 256);
      Bot.active = false; G.update(); Bot.active = true; if (Bot.wantsDraw) G.draw(); Bot.wantsDraw = false; Input.endFrame();
      if (i % 6 === 0) out.push(i + ' tile ' + w.tile(948, 256) + ' dmg ' + JSON.stringify([...w.damage.entries()].slice(0, 2)) + ' sel ' + p.sel + ' held ' + (p.inv[p.sel] || {}).id + ' mDown ' + Input.mDown + ' mClick ' + Input.mClick + ' anim ' + p.itemAnim + ' timer ' + p.itemTimer + ' tt ' + p.targetTile(w, ITEMS[(p.inv[p.sel] || {}).id || 'gold_pickaxe']) + ' mouse ' + Math.round(Input.mx) + ',' + Math.round(Input.my) + ' mw ' + G.mouseWorldX().toFixed(0) + ',' + G.mouseWorldY().toFixed(0) + ' hb ' + JSON.stringify(Bot.hb) + ' inv ' + UI.invOpen);
    }
    return out.join('\n');
  }));
});
