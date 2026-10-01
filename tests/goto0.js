// usage: node goto0.js sx sy gx gy [ticks]: fresh world, bot placed at tile (sx,sy) feet, walk to (gx,gy) via the real Bot.tick loop; reports death/fall
const run = require('./harness');
const [SX, SY, GX, GY, N] = process.argv.slice(2, 7).map(Number);
run(async (page) => {
  await page.newGame('bot67');
  console.log(await page.evaluate(([SX, SY, GX, GY, N]) => {
    const p = G.player, o = [];
    p.x = SX * TS + 6; p.y = (SY + 1) * TS - p.h; p.vx = p.vy = 0; p.lifeMax = p.life = 300; G.snapCamera();
    Bot.start(1); Bot.milestones.house = 1; Bot.houseSpot = Bot.houseSpot || [1049, 168]; Bot.base = [1054, 167]; let arrived = false;
    Bot.task = { step() { const r = Bot.moveTo(GX, GY, 2); if (r === true) { arrived = true; this.done = true; } }, done: false };
    let minY = 1e9, maxY = 0;
    for (let t = 0; t < N && !arrived; t++) {
      Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame();
      if (p.dead) { o.push('DEAD t=' + t + ' ' + G.deathCause + ' at ' + Bot.feet()); break; }
      if (t % 200 === 0) o.push(t + ' at ' + Bot.feet() + ' life ' + Math.round(p.life) + ' ' + (Bot.nav && Bot.nav.path[Bot.nav.i] ? Bot.nav.path[Bot.nav.i].move.t : '-') + ' why ' + Bot.why);
    }
    o.push('arrived ' + arrived + ' at ' + Bot.feet());
    return o.join('\n');
  }, [SX, SY, GX, GY, N]));
});
