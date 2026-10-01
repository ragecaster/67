const run = require('./harness');
run(async (page) => {
  await page.newGame('bot67');
  console.log(await page.evaluate(() => {
    const w = G.world, o = {}; for (let y = 596; y <= 622; y++) for (let x = 1000; x < 1700; x++) { const n = TILES[w.tile(x, y)] ? TILES[w.tile(x, y)].name + '/' + (TILES[w.tile(x, y)].minPick || 0) : 'air'; o[n] = (o[n] || 0) + 1; }
    return JSON.stringify(o) + ' pw=' + G.player.w + ' ph=' + G.player.h + ' viewW=' + G.viewW;
  }));
});
