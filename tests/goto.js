// usage: node goto.js <snap.json> <x> <y> [ticks] [tol]: restore a snapshot and drive Bot.moveTo(x,y) alone, printing progress
const run = require('./harness');
const { restore } = require('./snaplib');
const [FILE, X, Y, TICKS, TOL] = [process.argv[2], +process.argv[3], +process.argv[4], +process.argv[5] || 3000, +process.argv[6] || 3];
run(async (page) => {
  await page.newGame('bot67');
  await restore(page, FILE);
  const out = await page.evaluate(([X, Y, N, TOL]) => {
    const o = [], hist = []; let res = false;
    Bot.active = true; window.__trace = true;
    Bot.start(1); Bot.cooldowns = {}; let arrived = false;
    Bot.task = { step() { const r = Bot.moveTo(X, Y, TOL); if (r === true) { arrived = true; this.done = true; } }, done: false };
    Bot.goal = 'goto';
    for (let t = 0; t < N && !arrived; t++) {
      if (!Bot.task || Bot.task.done) break;
      Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame();
      hist.push([t, Math.round(G.player.x), Math.round(G.player.y + G.player.h), G.player.vy.toFixed(1), G.player.onGround ? 1 : 0, Math.round(G.player.life)].join(' ')); if (hist.length > 90) hist.shift();
      if (G.player.dead) { o.push('DEAD at t=' + t + ' cause ' + G.deathCause); break; }
      if (t % 300 === 0) { const nv = Bot.nav, p = G.player; o.push(t + ' why=' + Bot.why + ' at ' + Bot.feet() + (nv && nv.path.length ? ' i=' + nv.i + '/' + nv.path.length + ' next=' + (nv.path[nv.i] ? nv.path[nv.i].move.t + '@' + nv.path[nv.i].x + ',' + nv.path[nv.i].y : '-') + (nv.partial ? ' PARTIAL' : '') : ' nonav') + ' life ' + Math.round(p.life)); }
    }
    res = arrived;
    o.push('RESULT ' + res + ' final ' + Bot.feet() + ' tick ' + G.tick + ' planlog:\n' + (Bot.planLog || []).slice(-6).join('\n'));
    return o;
  }, [X, Y, TICKS, TOL]);
  console.log(out.join('\n'));
});
