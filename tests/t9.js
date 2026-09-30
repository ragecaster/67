const run = require('./harness');
run(async (page) => {
  await page.newGame();
  await page.ticks(30);
  const res = await page.evaluate(() => {
    const p = G.player, w = G.world, out = [];
    G.godMode = true;
    for (const id of Object.keys(ITEMS)) {
      const it = ITEMS[id];
      if (!(it.use || it.pick || it.axe || it.hammer || it.hook)) continue;
      try {
        p.inv[9] = { id, count: it.stack > 1 ? 50 : 1 }; p.sel = 9;
        p.inv[40] = { id: 'wooden_arrow', count: 200 }; p.inv[41] = { id: 'musket_ball', count: 200 }; p.mana = 200; p.manaMaxBase = 200;
        delete p.buffs.potion_sickness;
        const target = G.spawnNPC('zombie', p.cx + 90, p.y + p.h);
        Input.mx = p.cx + 90 - G.camX; Input.my = p.cy - G.camY; Input.mDown = true; Input.mClick = true;
        for (let i = 0; i < 50; i++) { G.update(); Input.mClick = false; }
        Input.mDown = false;
        if (it.hook) { Input.pressed.e = true; for (let i = 0; i < 30; i++) G.update(); }
        for (let i = 0; i < 60; i++) G.update();
        G.draw();
        target.dead = true;
      } catch (e) { out.push(id + ': ' + e.message + ' ' + e.stack.split('\n')[1]); }
    }
    return out;
  });
  console.log('item sweep errors:', res.length, res.slice(0, 10));
  // housing: build a 10x7 wood house near spawn with door, torch, table, chair
  const house = await page.evaluate(() => {
    const w = G.world, p = G.player;
    const x0 = (p.cx / TS | 0) + 6, y0 = ((p.y + p.h) / TS | 0) - 12;
    for (let j = 0; j < 8; j++) for (let i = 0; i < 11; i++) {
      const edge = i === 0 || i === 10 || j === 0 || j === 7;
      w.setTile(x0 + i, y0 + j, edge ? T.WOOD : 0); w.setWall(x0 + i, y0 + j, W.WOOD);
    }
    for (let j = 4; j < 7; j++) w.setTile(x0, y0 + j, 0);
    w.placeObject(x0, y0 + 4, T.DOOR_CLOSED);
    w.placeObject(x0 + 3, y0 + 6, T.WORKBENCH);
    w.placeObject(x0 + 6, y0 + 5, T.CHAIR);
    w.setTile(x0 + 5, y0 + 2, T.TORCH);
    const r = checkRoom(w, x0 + 6, y0 + 5);
    invAddMoney(p.inv, 10000);
    townTick(w, p);
    return [r, G.npcs.filter(n => n.town).map(n => n.name + ' home=' + JSON.stringify(n.home))];
  });
  console.log('house', JSON.stringify(house));
  // talk to merchant and open shop, buy a torch
  const shop = await page.evaluate(() => {
    const m = G.npcs.find(n => n.type === 'merchant');
    if (!m) return 'no merchant';
    m.x = G.player.x + 30; m.y = G.player.y;
    UI.openTalk(m);
    G.draw();
    const before = invMoney(G.player.inv);
    UI.shop = { npc: m, title: 'Unc', items: SHOPS.merchant(), buyback: [] }; UI.invOpen = true;
    G.draw();
    return [UI.talk.text, before, SHOPS.merchant().length, buyPrice('torch')];
  });
  console.log('shop', JSON.stringify(shop));
  await page.screenshot({ path: 'shot_shop.png' });
});
