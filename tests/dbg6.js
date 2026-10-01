const run = require('./harness');
run(async (page) => {
  await page.newGame(process.argv[3] || 'bot67');
  await page.evaluate(() => { Bot.start(1); });
  const r = await page.evaluate((pat) => {
    let info = null, n = 0;
    for (let i = 0; i < 60000 && !info; i++) {
      Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || i % 1200 === 0) G.draw(); Input.endFrame();
      if (Bot.logLines.some(l => l.includes(pat))) {
        const [fx, fy] = Bot.feet(), w = G.world, rows = [];
        for (let y = fy - 12; y <= fy + 3; y++) { let s = ''; for (let x = fx - 14; x <= fx + 16; x++) { const t = w.tile(x, y), d = TILES[t]; const me = x >= fx && x <= fx + 1 && y > fy - 3 && y <= fy; s += me ? '@' : !t ? (w.wall(x, y) ? 'w' : '.') : d.door ? 'D' : d.station ? 'S' : d.solid ? '#' : 'o'; } rows.push(s + ' ' + y); }
        info = { i, rows, ok: checkRoom(w, Bot.houseSpot[0] + 5, Bot.houseSpot[1] - 2), goal: Bot.goal, log: Bot.logLines.slice(-12), inv: G.player.inv.filter(Boolean).map(s => s.id + ':' + s.count).join(' ') };
      }
    }
    return info;
  }, process.argv[2] || 'giving up on furn');
  console.log(r && JSON.stringify({ ...r, rows: undefined }, null, 1)); console.log(r && r.rows.join('\n'));
});
