// Continue a saved snapshot with the bot and print progress every 60k ticks.
// usage: node fromsnap.js <snapshot.json> <ticks> [teacher|jev]
const run = require('./harness');
const [SNAP, TICKS, MODE] = [process.argv[2], parseInt(process.argv[3] || '600000'), process.argv[4] || 'teacher'];
run(async (page) => {
  await page.loadSnap(SNAP);
  await page.evaluate((mode) => { TerraJev.mode = mode; Bot.start(1); }, MODE);
  for (let t = 0; t < TICKS; t += 60000) {
    const r = await page.evaluate(() => {
      for (let i = 0; i < 60000; i++) { Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame(); if (G.world.flags.wall_of_flesh) break; }
      const p = G.player;
      return G.tick + ' d' + G.world.day + ' deaths=' + Bot.deaths + ' life=' + p.lifeMax + ' def=' + p.calc.defense + ' pick=' + SDK.obs().inv.pick.power + ' pots=' + Bot.potionCount() +
        ' bosses=' + TerraJev.BOSSES.filter(b => G.world.flags[b]).join('+') + ' | plan: ' + (Bot.plan && Bot.plan.label) + ' | ' + Bot.goal;
    });
    console.log(r);
    if (r.includes('wall_of_flesh')) break;
  }
  console.log(await page.evaluate(() => Bot.logLines.filter(x => /MILESTONE|summon|not ready|Ohio|died|crystal|Wall|doll|Brainrot|chunk/i.test(x)).slice(-30).join('\n')));
});
