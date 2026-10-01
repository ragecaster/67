// compressed underworld map: rows y0..y1, every `step` columns, '#' if any solid in cell, 'L' lava
const run = require('./harness');
run(async (page) => {
  await page.newGame('bot67');
  console.log(await page.evaluate(([y0, y1, step]) => {
    const w = G.world, rows = ['w=' + w.w + ' h=' + w.h + ' hell=' + w.hellLayer];
    for (let y = y0; y <= y1; y += 2) { let s = ''; for (let x = 0; x < w.w; x += step) { let sol = 0, lav = 0; for (let k = 0; k < step; k++) { if (w.solid(x + k, y)) sol++; else if (w.liq(x + k, y) > 30 && w.ltype[w.idx(x + k, y)] === 1) lav++; } s += sol > step / 2 ? '#' : lav > step / 2 ? 'L' : sol ? '+' : '.'; } rows.push(s + ' ' + y); }
    return rows.join('\n');
  }, [+process.argv[2] || 590, +process.argv[3] || 700, +process.argv[4] || 20]));
});
