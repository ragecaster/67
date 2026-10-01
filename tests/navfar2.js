// plan from navtest starts [k] with growing budgets
const run = require('./harness');
run(async (page) => {
  await page.newGame('bot67');
  const r = await page.evaluate(() => {
    const w = G.world, p = G.player; p.inv[9] = { id: 'dirt_block', count: 200 };
    const rng = makeRng(5); const starts = [];
    while (starts.length < 6) {
      const x = w.spawnX + randInt(-120, 120, rng), y = randInt(w.worldSurface + 5, w.rockLayer + 40, rng);
      if (!w.solid(x, y) && !w.solid(x + 1, y) && !w.solid(x, y - 1) && !w.solid(x + 1, y - 1) && !w.solid(x, y - 2) && !w.solid(x + 1, y - 2) && (w.solid(x, y + 1) || w.solid(x + 1, y + 1)) && !w.liq(x, y)) starts.push([x, y]);
    }
    const out = [];
    for (const k of [0, 4, 5]) { const [sx, sy] = starts[k];
      for (const budget of [220000, 600000, 1500000]) {
        const t0 = performance.now();
        const res = Nav.plan(sx, sy, (x, y) => Math.abs(x - w.spawnX) <= 3 && Math.abs(y - w.spawnY) <= 2, (x, y) => Math.abs(x - w.spawnX) + Math.abs(y - w.spawnY) * 1.3, budget);
        const last = res.path[res.path.length - 1];
        out.push({ k, budget, ms: Math.round(performance.now() - t0), expanded: res.expanded, reached: res.reached, len: res.path.length, last: last && [last.x - w.spawnX, last.y - w.spawnY] });
        if (res.reached) break;
      } }
    return out;
  });
  for (const x of r) console.log(JSON.stringify(x));
});
