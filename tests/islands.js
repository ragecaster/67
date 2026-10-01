const run = require('./harness');
run(async (page) => {
  await page.newGame('bot67');
  console.log(await page.evaluate(() => {
    const w = G.world, out = [];
    const lava = (x, y) => w.liq(x, y) > 100 && w.ltype[w.idx(x, y)] === 1;
    const lavaBelow = (x, y) => { for (let j = y + 1; j < w.h - 1; j++) { if (w.solid(x, j)) return false; if (lava(x, j)) return true; } return false; };
    const stand = (x, y) => { if (!w.solid(x, y + 1) || !w.solid(x + 1, y + 1)) return false; for (let j = 0; j < 3; j++) if (w.solid(x, y - j) || w.solid(x + 1, y - j)) return false; return true; };
    for (let y = 626; y <= 662; y++) { let x = 0; while (x < w.w - 2) { if (!stand(x, y)) { x++; continue; } let x1 = x; while (stand(x1 + 1, y)) x1++; if (x1 - x >= 4) { let west = 0, east = 0; for (let k = 3; k <= 9; k++) { if (lavaBelow(x - k, y)) west++; if (lavaBelow(x1 + 2 + k, y)) east++; } out.push(`${x}-${x1}@${y} westLava ${west}/7 eastLava ${east}/7`); } x = x1 + 1; } }
    return out.join('\n');
  }));
});
