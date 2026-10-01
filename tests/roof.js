const run = require('./harness');
run(async (page) => {
  await page.newGame('bot67');
  await page.evaluate(() => { Bot.start(1); });
  for (let i = 0; i < 40 && !(await page.evaluate(() => Bot.milestones.house)); i++)
    await page.evaluate(() => { for (let k = 0; k < 1000; k++) { Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame(); } });
  const out = await page.evaluate(() => {
    const w = G.world, [hx, fy] = Bot.houseSpot, o = [];
    const rows = []; for (let y = fy - 9; y <= fy + 4; y++) { let s = ''; for (let x = hx - 6; x <= hx + 18; x++) { const t = w.tile(x, y), d = TILES[t]; s += !t ? '.' : d.door ? 'D' : d.station ? 'S' : d.solid ? '#' : 'o'; } rows.push(s + ' ' + y); }
    o.push('hx=' + hx + ' fy=' + fy + ' x0=' + (hx - 6)); o.push(rows.join('\n'));
    o.push('tile 1048,167=' + TILES[w.tile(1048,167)]?.name + ' 1048,166=' + TILES[w.tile(1048,166)]?.name + ' prot=' + Bot.isProtected(1048,167) + ' bad=' + (Bot.badTiles ? [...Bot.badTiles].filter(k => k.startsWith('104')).join(' ') : '-')); o.push(Bot.logLines.filter(l => /house|dig|giving|skipping/.test(l)).join('\n'));
    const sx = hx + 14, sy = Nav.rawSurf(sx) - 1;
    const tests = [['roof east', hx + 9, fy - 7], ['roof west', hx + 1, fy - 7], ['west doorstep', hx - 2, fy - 1], ['base', Bot.base[0], Bot.base[1]]];
    for (const [name, tx, ty] of tests) {
      const t0 = performance.now();
      const res = Nav.plan(sx, sy, (x, y) => Math.abs(x + 0.5 - tx) <= 1.5 && Math.abs(y - ty) <= 1, (x, y) => Math.abs(x + 0.5 - tx) + (y > ty ? (y - ty) * 6 : (ty - y) * 2), 200000);
      const kinds = {}; res.path.forEach(q => kinds[q.move.t] = (kinds[q.move.t] || 0) + 1);
      const last = res.path[res.path.length - 1];
      o.push(name + ' from ' + sx + ',' + sy + ' -> ' + tx + ',' + ty + ': reached ' + res.reached + ' exp ' + res.expanded + ' len ' + res.path.length + ' ' + Math.round(performance.now() - t0) + 'ms last ' + (last && last.x + ',' + last.y) + ' ' + JSON.stringify(kinds));
    }
    return o;
  });
  console.log(out.join('\n'));
});
