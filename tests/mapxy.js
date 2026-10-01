// usage: node mapxy.js <snap> <x0> <x1> <y0> <y1>: ASCII map of a fixed window (. air, ~ water, L lava, # solid, O ore, o object)
const run = require('./harness');
const { restore } = require('./snaplib');
run(async (page) => {
  await page.newGame('bot67');
  await restore(page, process.argv[2]);
  console.log(await page.evaluate(([x0, x1, y0, y1]) => {
    const w = G.world, rows = [];
    for (let y = y0; y <= y1; y++) { let s = ''; for (let x = x0; x <= x1; x++) { const t = w.tile(x, y), d = TILES[t]; s += !t ? (w.liq(x, y) > 30 ? (w.ltype[w.idx(x, y)] ? 'L' : '~') : '.') : d.ore ? 'O' : d.solid ? (t === T.OBSIDIAN ? 'B' : t === T.ASH ? 'a' : t === T.HELLSTONE ? 'H' : '#') : 'o'; } rows.push(s + ' ' + y); }
    return rows.join('\n') + '\nx0=' + x0 + ' hellLayer=' + w.hellLayer + ' h=' + w.h;
  }, process.argv.slice(3, 7).map(Number)));
});
