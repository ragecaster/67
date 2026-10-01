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
    for (let t = 0; t < N && res !== true; t++) {
      Bot.resetInputs(); Bot.wasDown = Input.mDown; Bot.allowDrop = false;
      res = Bot.moveTo(X, Y, TOL);
      Bot.active = false; G.update(); Bot.active = true; if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Bot.wantsDraw = false; Input.endFrame();
      hist.push([t, Math.round(G.player.x), Math.round(G.player.y + G.player.h), G.player.vy.toFixed(1), G.player.onGround ? 1 : 0, Math.round(G.player.life)].join(' ')); if (hist.length > 90) hist.shift();
      if (window.__trace && t < 260 && t % 4 === 0) { const p = G.player; o.push(t + ' feetY ' + Math.round(p.y + p.h) + ' vy ' + p.vy.toFixed(1) + ' g' + (p.onGround ? 1 : 0) + ' mD' + (Input.mDown ? 1 : 0) + ' held ' + (p.inv[p.sel] || {}).id + ' cnt ' + Bot.count('dirt_block') + ' i ' + (Bot.nav ? Bot.nav.i : '-')); }
      if (G.player.dead) { o.push('DEAD at t=' + t + ' cause ' + G.deathCause + ' last positions (t x feetY vy ground life):\n' + hist.filter((h, i) => i % 3 === 0).join('\n')); break; }
      if (t % 300 === 0) { const nv = Bot.nav, p = G.player; o.push(t + ' at ' + Bot.feet() + ' res=' + res + (nv && nv.path.length ? ' i=' + nv.i + '/' + nv.path.length + ' next=' + (nv.path[nv.i] ? nv.path[nv.i].move.t + '@' + nv.path[nv.i].x + ',' + nv.path[nv.i].y : '-') + (nv.partial ? ' PARTIAL' : '') : ' nonav') + ' ground=' + p.onGround); }
    }
    o.push('RESULT ' + res + ' final ' + Bot.feet() + ' tick ' + G.tick + ' planlog:\n' + (Bot.planLog || []).slice(-6).join('\n'));
    return o;
  }, [X, Y, TICKS, TOL]);
  console.log(out.join('\n'));
});
