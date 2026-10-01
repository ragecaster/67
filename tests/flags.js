const run = require('./harness');
const { restore } = require('./snaplib');
run(async (page) => {
  await page.newGame('bot67');
  await restore(page, process.argv[2]);
  console.log(await page.evaluate(() => JSON.stringify({ tick: G.tick, flags: G.world.flags, lifeMax: G.player.lifeMax, def: G.player.calc.defense, inv: G.player.inv.filter(Boolean).map(s => s.id + ':' + s.count).join(' ') })));
});
