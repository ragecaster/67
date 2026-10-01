const run = require('./harness');
run(async (page) => {
  await page.newGame('bot67');
  console.log(await page.evaluate(([y0, y1, x0, x1]) => {
    const w = G.world, out = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x < x1; x++) {
      if (!w.solid(x, y + 1) && !w.solid(x + 1, y + 1)) continue;
      if (!(w.solid(x, y + 1) && w.solid(x + 1, y + 1))) continue;
      let ok = true; for (let j = 0; j < 3 && ok; j++) if (w.solid(x, y - j) || w.solid(x + 1, y - j)) ok = false;
      if (ok) out.push(x + ',' + y);
    }
    return out.length + ': ' + out.slice(0, 150).join(' ');
  }, [618, 662, 900, 1500]));
});
