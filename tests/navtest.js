// isolates Bot.moveTo: start in random caves, try to walk home to spawn
const run = require('./harness');
run(async (page) => {
  await page.newGame('bot67');
  const res = await page.evaluate(() => {
    const w = G.world, p = G.player, out = [];
    G.godMode = true;
    p.inv[9] = { id: 'dirt_block', count: 200 };
    const rng = makeRng(5);
    const starts = [];
    while (starts.length < 5) {
      const x = w.spawnX + randInt(-120, 120, rng), y = randInt(w.worldSurface + 5, w.rockLayer + 40, rng);
      if (!w.solid(x, y) && !w.solid(x + 1, y) && !w.solid(x, y - 1) && !w.solid(x + 1, y - 1) && !w.solid(x, y - 2) && !w.solid(x + 1, y - 2) && (w.solid(x, y + 1) || w.solid(x + 1, y + 1)) && !w.liq(x, y)) starts.push([x, y]);
    }
    Bot.active = true; Bot.base = [w.spawnX, w.spawnY];
    for (const [sx, sy] of starts) {
      p.x = sx * TS + 6; p.y = (sy + 1) * TS - p.h; p.vx = p.vy = 0; Bot.nav = null; G.snapCamera();
      let r = false, t = 0, fails = 0, replans = 0, lastNav = null;
      for (; t < 5000 && r !== true; t++) {
        Bot.resetInputs(); Bot.wasDown = Input.mDown;
        r = Bot.moveTo(w.spawnX, w.spawnY, 2);
        if (Bot.nav !== lastNav) { replans++; lastNav = Bot.nav; }
        if (r === 'fail') fails++;
        G.update(); if (t % 60 === 0) G.draw(); Input.endFrame();
      }
      const [nx, ny] = Nav.nodeOf(p);
      out.push({ start: [sx, sy], arrived: r === true, ticks: t, fails, replans, end: [nx, ny], dist: Math.abs(nx - w.spawnX) + Math.abs(ny - w.spawnY), lastPlan: Bot.nav && { len: Bot.nav.path.length, i: Bot.nav.i, partial: Bot.nav.partial, next: Bot.nav.path.slice(Bot.nav.i, Bot.nav.i + 3).map(q => q.move.t + '@' + q.x + ',' + q.y) } });
    }
    return out;
  });
  for (const r of res) console.log(JSON.stringify(r));
});
