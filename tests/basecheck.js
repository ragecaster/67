// Where do the house and the stations end up? node basecheck.js <seed> <ticks>  (prints an ASCII map of the base)
const run = require('./harness');
const [SEED, TICKS] = [process.argv[2] || 'evalC', +(process.argv[3] || 20000)];
run(async (page) => {
  await page.newGame(SEED);
  console.log(await page.evaluate((T) => {
    TerraJev.mode = 'teacher'; Bot.start(1);
    for (let i = 0; i < T; i++) { Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame(); }
    const w = G.world, h = Bot.houseSpot, rows = [];
    if (!h) return 'no house';
    for (let y = h[1] - 9; y <= h[1] + 2; y++) {
      let s = '';
      for (let x = h[0] - 16; x <= h[0] + 26; x++) {
        const t = w.tile(x, y), d = TILES[t];
        s += !t ? (w.wall(x, y) ? ':' : '.') : t === T.WORKBENCH ? 'B' : t === T.FURNACE ? 'F' : t === T.ANVIL ? 'A' : t === T.CHAIR ? 'c' : d.door ? 'D' : d.torch ? 't' : d.solid ? '#' : 'o';
      }
      rows.push(s + ' ' + y);
    }
    return rows.join('\n') + '\nhouse ' + h + ' base ' + Bot.base + ' valid ' + Bot.houseValid() + ' finished ' + Bot.houseFinished;
  }, TICKS));
});
