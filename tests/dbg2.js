const run = require('./harness');
run(async (page) => {
  await page.newGame('bot67');
  await page.evaluate(() => { Bot.start(1); });
  await page.evaluate((n) => { for (let i = 0; i < n; i++) { Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || i % 60 === 0) G.draw(); Input.endFrame(); } }, 5000);
  const r = await page.evaluate(() => {
    const [hx, fy] = Bot.houseSpot, w = G.world, rows = [];
    for (let y = fy - 9; y <= fy + 1; y++) { let s = ''; for (let x = hx - 4; x <= hx + 14; x++) { const t = w.tile(x, y), d = TILES[t]; s += !t ? (w.wall && w.wall(x, y) ? 'w' : '.') : d.door ? 'D' : d.solid ? '#' : 'o'; } rows.push(s + ' ' + y); }
    const p = G.player;
    return { log: Bot.logLines.slice(-25), hs: Bot.houseSpot, feet: Bot.feet(), rows, goal: Bot.goal, mouse: [Input.mx, Input.my], sel: p.sel, reach: p.inReach(hx + 7, fy - 6), ok: checkRoom(w, hx + 5, fy - 2) };
  });
  console.log(JSON.stringify(r, null, 1));
});
