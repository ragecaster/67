const run = require('./harness');
run(async (page) => {
  await page.newGame('bot67');
  console.log(await page.evaluate(([x0, x1, y0, y1]) => {
    const w = G.world, rows = [];
    for (let y = y0; y <= y1; y++) { let s = ''; for (let x = x0; x <= x1; x++) { const t = w.tile(x, y), d = TILES[t]; s += !t ? (w.liq(x, y) > 30 ? (w.ltype[w.idx(x, y)] ? 'L' : '~') : '.') : d.ore ? 'O' : d.solid ? '#' : 'o'; } rows.push(s + ' ' + y); }
    return rows.join('\n');
  }, process.argv.slice(2, 6).map(Number)));
});
