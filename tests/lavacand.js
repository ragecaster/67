const run = require('./harness');
run(async (page) => {
  await page.newGame('bot67');
  console.log(await page.evaluate(() => {
    const w = G.world, out = [];
    const lava = (x, y) => w.liq(x, y) > 100 && w.ltype[w.idx(x, y)] === 1;
    // ceiling: first non-solid row at or after 598 in column x; then below it must reach lava before any solid
    const info = (x) => { let y = 598; while (y < w.h - 1 && w.solid(x, y)) y++; const c = y; while (y < w.h - 1 && !w.solid(x, y) && !lava(x, y)) y++; return { c, ok: lava(x, y), ly: y }; };
    for (let x = 900; x < 1500; x++) { const a = info(x), b = info(x + 1); if (a.ok && b.ok) out.push(x + ':' + a.c + '/' + b.c + '@' + a.ly); }
    return out.join(' ');
  }));
});
