// The Merchant's house: after the home, does the bot build a second valid room and does the Merchant move in?
const run = require('./harness');
run(async (page) => {
  await page.newGame(process.env.SEED || 'evalA');
  const r = await page.evaluate(() => {
    TerraJev.mode = 'teacher'; Bot.start(1);
    const p = G.player; invAdd(p.inv, 'the_67', 1); invAdd(p.inv, 'wood', 150); invAdd(p.inv, 'silver_coin', 60); invAdd(p.inv, 'iron_anvil', 1);
    const o = [];
    for (let k = 0; k < 6; k++) {
      for (let i = 0; i < 5000; i++) { Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame(); }
      o.push(G.tick + ' home=' + Bot.houseFinished + ' house2=' + Bot.house2Finished + ' at ' + Bot.house2Spot + ' npcs=' + G.npcs.filter(n => n.town).map(n => n.type + (n.home ? '@' + n.home : '')).join(',') + ' money=' + invMoney(p.inv) + ' | ' + Bot.goal);
    }
    const h2 = Bot.house2Spot; o.push('room2 check: ' + (h2 ? JSON.stringify(checkRoom(G.world, h2[0] + 5, h2[1] - 2)) : '-'));
    return o.concat(Bot.logLines.filter(l => /house|Merchant|Unc|arriv/i.test(l)).slice(-8));
  });
  console.log(r.join('\n'));
});
