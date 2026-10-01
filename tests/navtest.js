// isolates Bot.moveTo: start in random caves, try to walk home to spawn. Prints each start as it finishes.
// usage: node navtest.js [count] [seed]
const run = require('./harness');
run(async (page) => {
  await page.newGame('bot67');
  const N = +process.argv[2] || 6, SEED = +process.argv[3] || 5, ONLY = process.argv[4] !== undefined ? +process.argv[4] : -1;
  await page.evaluate(([N, SEED]) => {
    const w = G.world, p = G.player;
    G.godMode = true; p.inv[9] = { id: 'dirt_block', count: 200 };
    const rng = makeRng(SEED); window.__starts = [];
    while (window.__starts.length < N) {
      const x = w.spawnX + randInt(-120, 120, rng), y = randInt(w.worldSurface + 5, w.rockLayer + 40, rng);
      if (!w.solid(x, y) && !w.solid(x + 1, y) && !w.solid(x, y - 1) && !w.solid(x + 1, y - 1) && !w.solid(x, y - 2) && !w.solid(x + 1, y - 2) && (w.solid(x, y + 1) || w.solid(x + 1, y + 1)) && !w.liq(x, y)) window.__starts.push([x, y]);
    }
    Bot.active = true; Bot.base = [w.spawnX, w.spawnY];
  }, [N, SEED]);
  for (let k = 0; k < N; k++) {
    if (ONLY >= 0 && k !== ONLY) continue;
    const r = await page.evaluate((k) => {
      const w = G.world, p = G.player, [sx, sy] = window.__starts[k]; window.__trace = true;
      p.x = sx * TS + 6; p.y = (sy + 1) * TS - p.h; p.vx = p.vy = 0; Bot.nav = null; G.snapCamera();
      Bot.planMs = 0; Bot.planCount = 0;
      let r = false, t = 0, fails = 0, lastNav = null; const trace = [];
      for (; t < 6000 && r !== true; t++) {
        Bot.resetInputs(); Bot.wasDown = Input.mDown;
        r = Bot.moveTo(w.spawnX, w.spawnY, 2);
        if (r === 'fail') fails++;
        if (Bot.nav !== lastNav) { lastNav = Bot.nav; const [qx, qy] = Nav.nodeOf(p), pp = Bot.nav && Bot.nav.path; trace.push(t + ' at ' + (qx - w.spawnX) + ',' + (qy - w.spawnY) + ' ' + (Bot.nav ? Bot.nav.stage + ' len' + pp.length + (Bot.nav.partial ? ' PARTIAL' : '') + ' end ' + (pp.length ? (pp[pp.length - 1].x - w.spawnX) + ',' + (pp[pp.length - 1].y - w.spawnY) : '-') : 'null')); }
        if (t === 2400 && window.__trace) { const nv = Bot.nav; trace.push('STUCK i=' + nv.i + ' next ' + nv.path.slice(Math.max(0, nv.i - 1), nv.i + 4).map(q => q.move.t + '@' + (q.x - w.spawnX) + ',' + (q.y - w.spawnY) + ' digs=' + JSON.stringify(q.move.digs)).join(' | ') + ' player ' + [p.x, p.y].map(Math.round) + ' ground ' + p.onGround + ' cX ' + p.collidedX); const [qx, qy] = Nav.nodeOf(p); let rows = []; for (let yy = qy - 6; yy <= qy + 4; yy++) { let ss = ''; for (let xx = qx - 10; xx <= qx + 12; xx++) { const tt = w.tile(xx, yy); ss += (xx >= qx && xx <= qx + 1 && yy > qy - 3 && yy <= qy) ? '@' : !tt ? (w.liq(xx, yy) > 50 ? '~' : '.') : TILES[tt].solid ? '#' : 'o'; } rows.push(ss + ' ' + (yy - w.spawnY)); } trace.push(rows.join('\n')); }
        Bot.active = false; G.update(); Bot.active = true; if (Bot.wantsDraw || t % 300 === 0) G.draw(); Bot.wantsDraw = false; Input.endFrame();
      }
      const [nx, ny] = Nav.nodeOf(p);
      return { start: [sx - w.spawnX, sy - w.spawnY], arrived: r === true, ticks: t, fails, plans: Bot.planCount, planMs: Math.round(Bot.planMs), end: [nx - w.spawnX, ny - w.spawnY], trace };
    }, k);
    console.log(JSON.stringify({ ...r, trace: undefined })); if (r.trace && ONLY >= 0) console.log(r.trace.join('\n'));
  }
});
