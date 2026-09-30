const run = require('./harness');
run(async (page) => {
  await page.newGame('bot67');
  await page.evaluate(() => { Bot.start(1); });
  const r = await page.evaluate(() => {
    let info = null;
    for (let i = 0; i < 30000 && !info; i++) {
      Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || i % 60 === 0) G.draw(); Input.endFrame();
      if (Bot.logLines.some(l => l.includes('house finished'))) {
        const [hx, fy] = Bot.houseSpot, w = G.world, rows = [];
        for (let y = fy - 9; y <= fy + 1; y++) { let s = ''; for (let x = hx - 4; x <= hx + 14; x++) { const t = w.tile(x, y), d = TILES[t]; s += !t ? (w.wall(x, y) ? 'w' : '.') : d.door ? 'D' : d.solid ? '#' : 'o'; } rows.push(s + ' ' + y); }
        info = { i, rows, ok: checkRoom(w, hx + 5, fy - 2), log: Bot.logLines.slice(-25), wood: Bot.count("wood") };
      }
    }
    return info;
  });
  console.log(JSON.stringify(r, null, 1));
});
