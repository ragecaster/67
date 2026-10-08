// walks from (fx, surface) to (tx, ty) with moveTo on a fresh world; prints progress. usage: node _walk.js seed fx tx ty [ticks]
const run = require('./harness');
const [SEED, FX, TX, TY, TICKS] = process.argv.slice(2).map((v, i) => i ? +v : v);
run(async (page) => {
  await page.newGame(SEED); if (process.env.PRE) await page.evaluate((s) => { window.__pre = s; }, process.env.PRE);
  console.log(await page.evaluate(([FX, TX, TY0, TICKS, PLAT]) => {
    let TY = TY0;
    const p = G.player, w = G.world, o = [];
    if (!TY) TY = topSolid(w, TX) - 1;
    p.x = FX * TS + 6; p.y = topSolid(w, FX) * TS - p.h; p.vx = p.vy = 0;
    invAdd(p.inv, 'wood_platform', PLAT); invAdd(p.inv, 'gold_pickaxe', 1); invAdd(p.inv, 'the_67', 1); invAdd(p.inv, 'dirt_block', +(window.DIRT || 0));
    p.lifeMax = p.life = 400; G.godMode = true;
    Bot.start(1); if (window.__pre) eval(window.__pre); Bot.base = [TX, TY]; Bot.needDecision = () => false; Bot.decideAct = () => {};
    let t = 0;
    for (; t < (TICKS || 20000); t++) {
      Bot.task = { done: false, step() { const r = Bot.moveTo(TX, TY, 0); if (r === true) this.done = true; } };
      Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame();
      if (t % 250 === 0) o.push(t + ' @' + Bot.feet() + ' why=' + Bot.replanWhy + ' step=' + (Bot.nav && Bot.nav.path[Bot.nav.i] ? Bot.nav.path[Bot.nav.i].move.t + '>' + Bot.nav.path[Bot.nav.i].x + ',' + Bot.nav.path[Bot.nav.i].y : '-') + ' plats=' + Bot.count('wood_platform') + ' ' + (Bot.planLog || []).slice(-1)[0]);
      const [fx, fy] = Bot.feet(); if (Math.abs(fx - TX) <= 1 && Math.abs(fy - TY) <= 1) break;
    }
    o.push('end t=' + t + ' @' + Bot.feet());
    return o.join('\n');
  }, [FX, TX, TY, TICKS, +process.env.PLAT || 600]));
});
