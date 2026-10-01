// isolates Bot.moveTo: start in random caves, try to walk home to spawn. Prints each start as it finishes.
// usage: node navtest.js [count] [seed]
const run = require('./harness');
run(async (page) => {
  await page.newGame('bot67');
  const N = +process.argv[2] || 6, SEED = +process.argv[3] || 5;
  await page.evaluate(([N, SEED]) => {
    const w = G.world, p = G.player;
    G.godMode = true; p.inv[9] = { id: 'dirt_block', count: 200 };
    const rng = makeRng(SEED); window.__starts = [];
    while (window.__starts.length < N) {
      const x = w.spawnX + randInt(-120, 120, rng), y = randInt(w.worldSurface + 5, w.rockLayer + 40, rng);
      if (!w.solid(x, y) && !w.solid(x + 1, y) && !w.solid(x, y - 1) && !w.solid(x + 1, y - 1) && !w.solid(x, y - 2) && !w.solid(x + 1, y - 2) && (w.solid(x, y + 1) || w.solid(x + 1, y + 1)) && !w.liq(x, y)) window.__starts.push([x, y]);
    }
    Bot.active = true; Bot.base = [w.spawnX, w.spawnY];
  }, [N, SEED]);
  for (let k = 0; k < N; k++) {
    const r = await page.evaluate((k) => {
      const w = G.world, p = G.player, [sx, sy] = window.__starts[k];
      p.x = sx * TS + 6; p.y = (sy + 1) * TS - p.h; p.vx = p.vy = 0; Bot.nav = null; G.snapCamera();
      Bot.planMs = 0; Bot.planCount = 0;
      let r = false, t = 0, fails = 0;
      for (; t < 6000 && r !== true; t++) {
        Bot.resetInputs(); Bot.wasDown = Input.mDown;
        r = Bot.moveTo(w.spawnX, w.spawnY, 2);
        if (r === 'fail') fails++;
        Bot.active = false; G.update(); Bot.active = true; if (t % 300 === 0) G.draw(); Input.endFrame();
      }
      const [nx, ny] = Nav.nodeOf(p);
      return { start: [sx - w.spawnX, sy - w.spawnY], arrived: r === true, ticks: t, fails, plans: Bot.planCount, planMs: Math.round(Bot.planMs), end: [nx - w.spawnX, ny - w.spawnY] };
    }, k);
    console.log(JSON.stringify(r));
  }
});
