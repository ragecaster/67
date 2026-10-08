const run = require('./harness');
const [SEED, X0, X1, Y0, Y1] = [process.argv[2], +process.argv[3], +process.argv[4], +process.argv[5], +process.argv[6]];
run(async (page) => {
  await page.newGame(SEED);
  console.log(await page.evaluate(([X0, X1, Y0, Y1]) => {
    const w = G.world, o = [];
    for (let y = Y0; y <= Y1; y++) { let s = ''; for (let x = X0; x <= X1; x++) { const t = w.tile(x, y), d = TILES[t]; s += !t ? (w.liq(x, y) > 50 ? (w.ltype[w.idx(x, y)] === 1 ? 'L' : '~') : '.') : d.tree ? 'T' : d.solid ? '#' : 'o'; } o.push(String(y).padStart(4) + ' ' + s); }
    return o.join('\n');
  }, [X0, X1, Y0, Y1]));
});
