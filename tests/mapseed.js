// ASCII map of a fresh world (or snapshot): node mapseed.js <seed|snap.json> x0 x1 y0 y1   (. air, ~ water, L lava, # solid, O ore, o object, T tree, X noclip)
const run = require('./harness');
const fs = require('fs');
run(async (page) => {
  const src = process.argv[2];
  if (fs.existsSync(src)) { await page.newGame('evalA'); await page.loadSnap(src); } else await page.newGame(src);
  console.log(await page.evaluate(([x0, x1, y0, y1]) => {
    const w = G.world, rows = [];
    for (let y = y0; y <= y1; y++) { let s = ''; for (let x = x0; x <= x1; x++) { const t = w.tile(x, y), d = TILES[t]; s += !t ? (w.liq(x, y) > 30 ? (w.ltype[w.idx(x, y)] ? 'L' : '~') : '.') : t === T.NOCLIP ? 'X' : t === T.TREE ? 'T' : d.ore ? 'O' : d.solid ? '#' : 'o'; } rows.push(s + ' ' + y); }
    return rows.join('\n') + '\nx0=' + x0 + ' spawn=' + w.spawnX + ',' + w.spawnY + ' noclip=' + w.noclipAt + ' surface=' + w.worldSurface + ' backrooms=' + JSON.stringify(w.backrooms);
  }, process.argv.slice(3, 7).map(Number)));
});
