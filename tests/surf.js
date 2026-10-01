const run = require('./harness');
run(async (page) => {
  await page.newGame('bot67');
  const r = await page.evaluate(() => { const w = G.world; Nav.stamp = (Nav.stamp || 0) + 1; const o = []; for (let x = w.spawnX - 8; x <= w.spawnX + 12; x += 2) o.push(x + ':' + Nav.surfAt(x) + '/' + topSolid(w, x)); return { o, spawn: [w.spawnX, w.spawnY], ws: w.worldSurface }; });
  console.log(JSON.stringify(r));
});
