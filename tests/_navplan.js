// plans a route on a fresh world and summarizes it. usage: node _navplan.js seed fx fy tx ty  env: PLAT, DIRT
const run = require('./harness');
const [SEED, FX, FY, TX, TY] = process.argv.slice(2).map((v, i) => i ? +v : v);
run(async (page) => {
  await page.newGame(SEED);
  console.log(await page.evaluate(([FX, FY, TX, TY, PLAT, DIRT]) => {
    const p = G.player, w = G.world;
    const fy = FY || topSolid(w, FX) - 1;
    p.x = FX * TS + 6; p.y = (fy + 1) * TS - p.h; p.vx = p.vy = 0;
    invAdd(p.inv, 'wood_platform', PLAT); if (DIRT) invAdd(p.inv, 'dirt_block', DIRT); invAdd(p.inv, 'gold_pickaxe', 1);
    for (let i = 0; i < 5; i++) G.update();
    const [nx, ny] = Nav.nodeOf(p), out = [];
    out.push('from ' + nx + ',' + ny + ' blocks ' + Bot.spareBlocks(false) + ' plats ' + Bot.count('wood_platform'));
    const tol = 0, goal = (x, y) => Math.abs(x + 0.5 - TX) <= tol + 0.5 && Math.abs(y - TY) <= 1;
    const heur = (x, y) => Math.abs(x + 0.5 - TX) + (y > TY ? (y - TY) * 6 : (TY - y) * 2);
    const t0 = performance.now(), res = Nav.plan(nx, ny, goal, heur, 220000);
    if (!res) return out.concat('no plan').join('\n');
    const mv = {}; let maxY = 0; for (const n of res.path) { mv[n.move.t] = (mv[n.move.t] || 0) + 1; maxY = Math.max(maxY, n.y); }
    out.push('reached ' + res.reached + ' len ' + res.path.length + ' exp ' + res.expanded + ' ' + Math.round(performance.now() - t0) + 'ms moves ' + JSON.stringify(mv) + ' maxY ' + maxY);
    let seg = ''; for (const n of res.path.filter((_, i) => i % 6 === 0)) seg += n.x + ',' + n.y + ':' + n.move.t[0] + ' ';
    out.push(seg);
    return out.join('\n');
  }, [FX, FY, TX, TY, +process.env.PLAT || 600, +process.env.DIRT || 0]));
});
