// how many A* nodes are needed to reach home from far starts? (budget vs. search-quality question)
const run = require('./harness');
run(async (page) => {
  await page.newGame('bot67');
  const r = await page.evaluate(() => {
    const w = G.world, p = G.player; p.inv[9] = { id: 'dirt_block', count: 200 };
    const out = [];
    const rng = makeRng(7); const starts = [];
    while (starts.length < 6) {
      const x = w.spawnX + randInt(-150, 150, rng), y = randInt(w.worldSurface + 5, w.rockLayer + 60, rng);
      if (!w.solid(x, y) && !w.solid(x + 1, y) && !w.solid(x, y - 1) && !w.solid(x + 1, y - 1) && !w.solid(x, y - 2) && !w.solid(x + 1, y - 2) && (w.solid(x, y + 1) || w.solid(x + 1, y + 1)) && !w.liq(x, y)) starts.push([x, y]);
    }
    for (const [sx, sy] of starts) for (const W of [2.5, 4, 6, 10]) { const budget = 200000; Nav.W = W;
      const t0 = performance.now();
      const res = Nav.plan(sx, sy, (x, y) => Math.abs(x - w.spawnX) <= 2 && Math.abs(y - w.spawnY) <= 2, (x, y) => Math.abs(x - w.spawnX) + Math.abs(y - w.spawnY) * 1.3, budget);
      out.push({ start: [sx - w.spawnX, sy - w.spawnY], W, ms: Math.round(performance.now() - t0), expanded: res && res.expanded, reached: res && res.reached, len: res && res.path.length });

    }
    return out;
  });
  for (const x of r) console.log(JSON.stringify(x));
});
