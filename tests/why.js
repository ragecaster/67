// usage: node why.js <snap>: what does the planner want right now, item by item?
const run = require('./harness');
const { restore } = require('./snaplib');
run(async (page) => {
  await page.newGame('bot67');
  await restore(page, process.argv[2]);
  console.log(await page.evaluate(() => {
    const o = [];
    for (const seg of Bot.wantSegments()) {
      if (!seg.want) { o.push(seg.name + ' (special)'); continue; }
      for (const [id, q] of seg.want) { const st = Bot.resolve(id, q); o.push(seg.name + ': ' + id + ' x' + q + ' owns=' + Bot.owns(id) + ' blocked=' + !!Bot.blocked(id) + ' -> ' + JSON.stringify(st)); }
    }
    o.push('stationPlaced furnace ' + Bot.stationPlaced('furnace') + ' anvil ' + Bot.stationPlaced('anvil') + ' base ' + Bot.base);
    o.push('fails ' + JSON.stringify(Bot.fails)); o.push('cooldowns ' + JSON.stringify(Bot.cooldowns));
    o.push('lifeMax ' + G.player.lifeMax + ' milestones ' + Object.keys(Bot.milestones).join(','));
    return o.join('\n');
  }));
});
