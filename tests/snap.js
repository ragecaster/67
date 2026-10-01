// usage: node snap.js <ticks> [seed] -> runs the bot, then dumps an ASCII map around the player + base and bot state
const run = require('./harness');
const TICKS = parseInt(process.argv[2] || '200000'), SEED = process.argv[3] || 'bot67';
run(async (page) => {
  await page.newGame(SEED);
  await page.evaluate(() => { Bot.start(1); window.__seen = 0; });
  for (let done = 0; done < TICKS; done += 20000) await page.evaluate((n) => { for (let i = 0; i < n; i++) { Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || i % 1200 === 0) G.draw(); Input.endFrame(); } }, Math.min(20000, TICKS - done));
  const r = await page.evaluate(() => {
    const w = G.world, p = G.player, [fx, fy] = Bot.feet(), rows = [];
    for (let y = fy - 14; y <= fy + 8; y++) { let s = ''; for (let x = fx - 30; x <= fx + 30; x++) { const t = w.tile(x, y), d = TILES[t]; const me = x >= fx && x <= fx + 1 && y > fy - 3 && y <= fy; s += me ? '@' : !t ? (w.wall(x, y) ? 'w' : w.liq(x, y) > 50 ? '~' : '.') : d.door ? 'D' : d.station ? 'S' : d.solid ? '#' : 'o'; } rows.push(s + ' ' + y); }
    return { feet: [fx, fy], house: Bot.houseSpot, base: Bot.base, goal: Bot.goal, why: Bot.why, nav: Bot.nav && { tx: Bot.nav.tx, ty: Bot.nav.ty, n: Bot.nav.path.length, i: Bot.nav.i }, rows, log: Bot.logLines.slice(-10) };
  });
  console.log(JSON.stringify({ ...r, rows: undefined }, null, 0)); console.log(r.rows.join('\n'));
});
