const run = require('./harness');
const { restore } = require('./snaplib');
run(async (page) => {
  await page.newGame('bot67');
  await restore(page, '/tmp/end4.json');
  console.log(await page.evaluate(() => {
    const w = G.world, p = G.player, [fx, fy] = Bot.feet();
    const out = [];
    for (let y = fy - 3; y <= fy + 1; y++) { let s = ''; for (let x = fx - 3; x <= fx + 4; x++) s += String(w.tile(x, y)).padStart(3) + ' '; out.push(s + ' y' + y); }
    out.push('x0=' + (fx - 3) + ' feet ' + fx + ',' + fy);
    const r = w.hitTile(948, 256, 55, 'pick'); out.push('hit chair -> ' + r + ' now ' + w.tile(948, 256) + ' dmg ' + JSON.stringify([...w.damage.entries()].slice(0, 3)));
    return out.join('\n');
  }));
});
