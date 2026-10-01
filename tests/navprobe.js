const run = require('./harness');
const { restore } = require('./snaplib');
run(async (page) => {
  await page.newGame('bot67');
  await restore(page, process.argv[2]);
  const [tx, ty] = [+process.argv[3], +process.argv[4]];
  console.log(await page.evaluate(([tx, ty]) => {
    G.update(); const p = G.player; const [nx, ny] = Nav.nodeOf(p);
    const goalFn = (x, y) => Math.abs(x + 0.5 - tx) <= 1.5 && Math.abs(y - ty) <= 1;
    const heur = (x, y) => Math.abs(x + 0.5 - tx) + (y > ty ? (y - ty) * 6 : (ty - y) * 2);
    const r = Nav.plan(nx, ny, goalFn, heur, 60000);
    return `node ${nx},${ny} onGround ${p.onGround} blocks ${Nav.blocks} avoid ${JSON.stringify(Bot.avoidZone)} reached ${r && r.reached} expanded ${r && r.expanded} len ${r && r.path.length}\n` + (r ? r.path.slice(0, 40).map(s => s.move.t + '@' + s.x + ',' + s.y).join(' ') : '');
  }, [tx, ty]));
});
