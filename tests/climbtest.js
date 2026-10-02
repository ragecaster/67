// Climb out of a 30-deep, 2-wide shaft with platforms only, then go back down. Counts rungs placed and ticks taken.
// usage: node climbtest.js [seed] [depth]
const run = require('./harness');
const [SEED, DEPTH] = [process.argv[2] || 'bot67', +process.argv[3] || 30];
run(async (page) => {
  await page.newGame(SEED);
  const r = await page.evaluate((D) => {
    TerraJev.mode = 'teacher'; Bot.start(1);
    for (let i = 0; i < 3; i++) { G.update(); Input.endFrame(); }
    const w = G.world, p = G.player, x = Bot.feet()[0] + 30, top = topSolid(w, x);
    for (let y = top - 3; y < top + D; y++) for (const xx of [x, x + 1]) w.setTile(xx, y, 0);   // the shaft
    for (const xx of [x, x + 1]) w.setTile(xx, top + D, T.STONE);
    p.inv = p.inv.map((s, i) => (s && (ITEMS[s.id].pick || ITEMS[s.id].axe || ITEMS[s.id].damage)) ? s : null);
    invAdd(p.inv, 'wood_platform', 60);
    p.x = x * TS + 6; p.y = (top + D) * TS - p.h - 1; p.vx = p.vy = 0;
    for (let i = 0; i < 30; i++) { G.update(); Input.endFrame(); }
    const placed = () => 60 - Bot.count('wood_platform');
    const go = (tx, ty, max) => { Bot.task = { step() { const m = Bot.moveTo(tx, ty, 1); if (m === true || m === 'fail') this.done = true; this.r = m; } }; Bot.act = { id: 'test', kind: 'reflex', at: G.tick, life: p.life, seen: new Set() }; Bot.needDecision = () => false;
      const t0 = G.tick; for (let i = 0; i < max && !Bot.task.done; i++) { Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw) G.draw(); Input.endFrame(); } return { ticks: G.tick - t0, r: Bot.task.r, feet: Bot.feet().join(',') }; };
    const up = go(x - 4, top - 1, 6000), usedUp = placed();
    let col = ''; for (let y = top - 2; y < top + D; y++) col += w.tile(x, y) === T.PLATFORM || w.tile(x + 1, y) === T.PLATFORM ? '=' : w.solid(x, y) ? '#' : '.';
    let map = []; for (let y = top - 8; y < top + D + 1; y++) { let row = y + ' '; for (let xx = x - 4; xx <= x + 5; xx++) { const t = w.tile(xx, y); row += t === T.PLATFORM ? '=' : t && TILES[t].solid ? '#' : t ? 'o' : (w.wall(xx, y) ? ':' : '.'); } map.push(row); }
    window.__map = map;
    const down = go(x, top + D - 1, 6000);
    return { up, platformsUp: usedUp, shaft: col, down, platformsTotal: placed() };
  }, DEPTH);
  console.log(JSON.stringify(r)); if (process.env.MAP) console.log((await page.evaluate(() => window.__map)).join("\n"));
});
