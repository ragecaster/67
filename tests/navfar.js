// A* tuning: nodes expanded / time / path length to get home from far cave starts, for different (weight, up-cost, down-cost) heuristics
const run = require('./harness');
run(async (page) => {
  await page.newGame('bot67');
  const r = await page.evaluate(() => {
    const w = G.world, p = G.player; p.inv[9] = { id: 'dirt_block', count: 200 };
    const out = [];
    const rng = makeRng(7); const starts = [];
    while (starts.length < 8) {
      const x = w.spawnX + randInt(-150, 150, rng), y = randInt(w.worldSurface + 5, w.rockLayer + 60, rng);
      if (!w.solid(x, y) && !w.solid(x + 1, y) && !w.solid(x, y - 1) && !w.solid(x + 1, y - 1) && !w.solid(x, y - 2) && !w.solid(x + 1, y - 2) && (w.solid(x, y + 1) || w.solid(x + 1, y + 1)) && !w.liq(x, y)) starts.push([x, y]);
    }
    const tx = w.spawnX, ty = w.spawnY;
    const combos = [[2, 5, 1.5], [3, 5, 1.5], [2.5, 6, 2], [2, 7, 2], [3, 7, 2], [4, 6, 2], [6, 6, 2]];
    for (const [W, up, dn] of combos) {
      let exp = 0, ms = 0, len = 0, ok = 0;
      for (const [sx, sy] of starts) {
        Nav.W = W;
        const heur = (x, y) => Math.abs(x + 0.5 - tx) + (y > ty ? (y - ty) * up : (ty - y) * dn);
        const t0 = performance.now();
        const res = Nav.plan(sx, sy, (x, y) => Math.abs(x - tx) <= 2 && Math.abs(y - ty) <= 2, heur, 300000);
        ms += performance.now() - t0; exp += res.expanded; len += res.path.length; if (res.reached) ok++;
      }
      out.push({ W, up, dn, reached: ok + '/' + starts.length, avgExp: Math.round(exp / starts.length), avgMs: Math.round(ms / starts.length), avgLen: Math.round(len / starts.length) });
    }
    return out;
  });
  for (const x of r) console.log(JSON.stringify(x));
});
