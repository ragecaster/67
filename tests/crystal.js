const run = require('./harness');
const { applyStage } = require('./stagelib');
run(async (page) => {
  await page.newGame('bot67');
  await applyStage(page, 'gold');
  await page.evaluate(() => { invAdd(G.player.inv, 'life_crystal', 2); });
  for (let k = 0; k < 8; k++) {
    console.log(await page.evaluate(() => {
      for (let i = 0; i < 600; i++) { Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame(); }
      const p = G.player; return 't' + G.tick + ' lifeMax ' + p.lifeMax + ' crystals ' + Bot.count('life_crystal') + ' goal ' + Bot.goal + ' sel ' + p.sel + ' hb ' + JSON.stringify(Bot.hb) + ' inv ' + UI.invOpen + ' mouseItem ' + JSON.stringify(p.mouseItem) + ' cd ' + JSON.stringify(Bot.cooldowns);
    }));
  }
});
