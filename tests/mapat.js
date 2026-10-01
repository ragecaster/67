// usage: node mapat.js <snap> [radius]: ASCII map around the restored player
const run = require('./harness');
const { restore } = require('./snaplib');
run(async (page) => {
  await page.newGame('bot67');
  await restore(page, process.argv[2]);
  console.log(await page.evaluate((R) => {
    const w = G.world, [fx, fy] = Bot.feet(), rows = [];
    for (let y = fy - 14; y <= fy + 8; y++) { let s = ''; for (let x = fx - R; x <= fx + R; x++) { const t = w.tile(x, y), d = TILES[t]; const me = x >= fx - 1 && x <= fx && y > fy - 3 && y <= fy; s += me ? '@' : !t ? (w.liq(x, y) > 50 ? '~' : w.wall(x, y) ? 'w' : '.') : d.door ? 'D' : d.station ? 'S' : d.ore ? 'O' : d.solid ? '#' : 'o'; } rows.push(s + ' ' + y); }
    return rows.join('\n') + '\nx0=' + (fx - R) + ' feet ' + fx + ',' + fy;
  }, +process.argv[3] || 24));
});
