const run = require('./harness');
run(async (page) => {
  await page.newGame('bot67');
  await page.evaluate(() => { Bot.start(1); });
  const r = await page.evaluate(() => {
    let info = null;
    for (let i = 0; i < 20000 && !info; i++) {
      Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame();
      if (Bot.digKey && Bot.digTicks === 250) {
        const p = G.player; const [x, y] = Bot.digKey.split(',').map(Number);
        info = { i, key: Bot.digKey, goal: Bot.goal, sel: p.sel, item: p.inv[p.sel] && p.inv[p.sel].id, feet: Bot.feet(), tile: G.world.tile(x, y), reach: p.inReach(x, y), mouse: [Input.mx, Input.my], mDown: Input.mDown, cam: [G.cam && G.cam.x, G.cam && G.cam.y], hover: G.hoverTile && G.hoverTile(), pos: [p.x, p.y], ui: UI.invOpen, above: [G.world.tile(1052,166), G.world.tile(1053,166), T.TREE, T.WORKBENCH], tt: G.player.targetTile(G.world, ITEMS.copper_pickaxe), smart: G.player.smartCursor || SETTINGS.smartCursor, cxy: [G.player.cx, G.player.cy], mw: [G.mouseWorldX(), G.mouseWorldY()] };
      }
    }
    return info;
  });
  console.log(JSON.stringify(r));
});
