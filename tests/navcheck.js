// Probe the planner: node navcheck.js <seed> <skipTicks> <tx> <ty> [tol]  (plays the seed with the bot first; prints the plan and the map around the bot)
const run = require('./harness');
const [SEED, SKIP, TX, TY, TOL] = [process.argv[2], +process.argv[3], +process.argv[4], +process.argv[5], +(process.argv[6] || 1)];
run(async (page) => {
  await page.newGame(SEED);
  console.log(await page.evaluate(([SKIP, TX, TY, TOL, ROW]) => {
    TerraJev.mode = 'teacher'; Bot.start(1);
    for (let i = 0; i < SKIP; i++) { Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame(); }
    const p = G.player, w = G.world, [nx, ny] = Nav.nodeOf(p), o = [];
    o.push('player x ' + p.x.toFixed(1) + ' cx ' + p.cx.toFixed(1) + ' node ' + nx + ',' + ny + ' feet ' + Bot.feet() + ' onGround ' + p.onGround);
    Nav.stamp = (Nav.stamp || 0) + 1; Nav.power = Nav.pickPower(); Nav.blocks = Bot.spareBlocks();
    for (let y = ny - 4; y <= ny + 2; y++) { let s = ''; for (let x = nx - 6; x <= nx + 8; x++) { const c = Nav.cellCost(x, y); s += c === Infinity ? 'X' : c === 0 ? (w.tile(x, y) ? 'o' : '.') : '#'; s += x === nx ? '|' : ''; } o.push(s + ' ' + y + '  standable(nx+1)=' + Nav.standable(nx + 1, y)); }
    if (ROW) { const ry = ROW; for (let x = nx - 4; x <= nx + 16; x++) o.push('  node ' + x + ',' + ry + ' space ' + JSON.stringify(Nav.space(x, ry)) + ' standable ' + Nav.standable(x, ry) + ' tiles ' + [0, 1, 2, 3].map(j => (TILES[w.tile(x, ry - 2 + j)] || { name: 'air' }).name).join('/')); }
    const goalFn = (x, y) => Math.abs(x + 0.5 - TX) <= TOL + 0.5 && Math.abs(y - TY) <= Math.max(1, TOL);
    const res = Nav.plan(nx, ny, goalFn, (x, y) => Math.abs(x + 0.5 - TX) + Math.abs(y - TY), 20000);
    o.push('plan: ' + (res ? 'reached ' + res.reached + ' len ' + res.path.length + ' : ' + res.path.map(q => q.move.t + '@' + q.x + ',' + q.y).join(' ') : 'null'));
    o.push('bans: ' + [...Nav.bans.entries()].filter(([k, v]) => v > G.tick).map(([k]) => k).join(' '));
    o.push('goal ' + Bot.goal + ' nav ' + JSON.stringify(Bot.nav && { tx: Bot.nav.tx, ty: Bot.nav.ty, i: Bot.nav.i, n: Bot.nav.path.length, cd: Bot.nav.cooldown - G.tick }));
    return o.join('\n');
  }, [SKIP, TX, TY, TOL, +(process.env.ROW || 0)]));
});
