// Scenario test: let the bot build its house, then drop the player on the surface at various offsets and ask it to walk
// to its base (inside the house). Reports arrival, ticks and plan stats. (Teleporting is a TEST shortcut.)
// usage: node homewalk.js [seed]
const run = require('./harness');
run(async (page) => {
  await page.newGame(process.argv[2] || 'bot67');
  await page.evaluate(() => { Bot.start(1); });
  // let the bot build the house first
  for (let i = 0; i < 40 && !(await page.evaluate(() => Bot.milestones.house)); i++)
    await page.evaluate(() => { for (let k = 0; k < 1000; k++) { Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame(); } });
  console.log('house built:', await page.evaluate(() => !!Bot.milestones.house), 'at tick', await page.evaluate(() => G.tick));
  const OFFS = process.argv[3] ? process.argv[3].split(',').map(Number) : [30, 60, -30, -60, 100, -100];
  for (const off of OFFS) {
    await page.evaluate(() => { window.__trace = true; });
    const r = await page.evaluate((off) => {
      const w = G.world, p = G.player; G.godMode = true;
      const x = w.spawnX + off, y = Nav.rawSurf(x) - 1;
      p.x = x * TS + 6; p.y = (y + 1) * TS - p.h; p.vx = p.vy = 0; Bot.nav = null; Bot.task = null; G.snapCamera();
      Bot.planMs = 0; Bot.planCount = 0;
      let res = false, t = 0; const trace = [];
      for (; t < 4000 && res !== true; t++) {
        Bot.resetInputs(); Bot.wasDown = Input.mDown;
        res = Bot.moveTo(Bot.base[0], Bot.base[1], 1);
        if (window.__trace && t % 250 === 0) { const nv = Bot.nav, [qx, qy] = Nav.nodeOf(p); trace.push(t + ' at ' + (qx - Bot.base[0]) + ',' + (qy - Bot.base[1]) + (nv && nv.path.length ? ' i=' + nv.i + '/' + nv.path.length + ' next=' + (nv.path[nv.i] ? nv.path[nv.i].move.t + '@' + (nv.path[nv.i].x - Bot.base[0]) + ',' + (nv.path[nv.i].y - Bot.base[1]) : '-') + ' ' + nv.stage + (nv.partial ? ' PARTIAL' : '') : ' nonav') + ' onGround=' + p.onGround + ' sel=' + p.sel); }
        Bot.active = false; G.update(); Bot.active = true; if (Bot.wantsDraw || t % 300 === 0) G.draw(); Bot.wantsDraw = false; Input.endFrame();
      }
      const [nx, ny] = Nav.nodeOf(p);
      return { trace, off, arrived: res === true, ticks: t, end: [nx - Bot.base[0], ny - Bot.base[1]], plans: Bot.planCount, planMs: Math.round(Bot.planMs) };
    }, off);
    console.log(JSON.stringify({ ...r, trace: undefined })); if (process.argv[4]) console.log(r.trace.join('\n'));
  }
});
