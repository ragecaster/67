// The Wall of Flesh in isolation: endgame kit, voodoo doll, blocks; go straight to the Ohio plan and log every 20k ticks
const run = require('./harness');
run(async (page) => {
  await page.newGame('wall1');
  await page.evaluate(() => {
    TerraJev.mode = 'teacher'; Bot.start(1);
    const p = G.player; p.lifeMax = 300; p.life = 300;
    [['the_67', 1], ['nightmare_pickaxe', 1], ['gold_bow', 1], ['wooden_arrow', 500], ['lesser_healing_potion', 30], ['guide_voodoo_doll', 1], ['stone_block', 999], ['dirt_block', 400], ['torch', 99]]
      .forEach(([id, n], i) => { p.inv[20 + i] = { id, count: n }; });
    p.armor = ['gold_helmet', 'gold_chainmail', 'gold_greaves'].map(id => ({ id, count: 1 }));
    ['king_slime', 'eye_of_cthulhu', 'tung_sahur'].forEach(k => G.world.flags[k] = true);
    for (let i = 0; i < 3; i++) { G.update(); Input.endFrame(); }
    Bot.base = Bot.feet(); Bot.houseSpot = Bot.feet(); Bot.houseFinished = true;
    Bot.setAct({ id: 'hell', kind: 'hell' }, Bot.taskHell(), []);
  });
  for (let k = 0; k < 20; k++) {
    const t0 = Date.now();
    const r = await page.evaluate(() => {
      for (let i = 0; i < 20000; i++) { Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw) G.draw(); Input.endFrame(); if (G.world.flags.wall_of_flesh) break; }
      const w = G.npcs.find(n => n.type === 'wall_of_flesh');
      return G.tick + ' deaths=' + Bot.deaths + ' at=' + Bot.feet() + ' life=' + Math.round(G.player.life) + (w ? ' WALL ' + Math.round(w.life) : '') + ' | ' + Bot.goal + (G.world.flags.wall_of_flesh ? ' KILLED' : '');
    });
    console.log(r + '  (' + Math.round((Date.now() - t0) / 1000) + 's)');
    if (r.includes('KILLED')) break;
  }
  console.log(await page.evaluate(() => Bot.logLines.filter(x => /Ohio|Wall|doll|died|runway|island/i.test(x)).slice(-20).join('\n')));
});
