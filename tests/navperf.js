const run = require('./harness');
run(async (page) => {
  await page.newGame('bot67');
  const r = await page.evaluate(() => {
    const w = G.world, p = G.player; p.inv[9] = { id: 'dirt_block', count: 200 };
    const out = [];
    for (const [sx, sy] of [[w.spawnX + 60, w.worldSurface + 30], [w.spawnX - 80, w.rockLayer + 10], [w.spawnX + 10, w.worldSurface + 5]]) {
      const t0 = performance.now();
      const res = Nav.plan(sx, sy, (x, y) => Math.abs(x - w.spawnX) <= 2 && Math.abs(y - w.spawnY) <= 2, (x, y) => Math.abs(x - w.spawnX) + Math.abs(y - w.spawnY) * 1.3);
      out.push({ ms: Math.round(performance.now() - t0), expanded: res && res.expanded, reached: res && res.reached, len: res && res.path.length });
    }
    return out;
  });
  console.log(JSON.stringify(r));
});
