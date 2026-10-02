// Per-tick trace of the bot from a fresh world (or a snapshot): node btrace.js <seed|snap.json> <skipTicks> <traceTicks> [every=15]
const run = require('./harness');
const fs = require('fs');
const [SRC, SKIP, N, EVERY] = [process.argv[2] || 'evalC', +(process.argv[3] || 0), +(process.argv[4] || 600), +(process.argv[5] || 15)];
run(async (page) => {
  if (fs.existsSync(SRC)) { await page.newGame('evalA'); await page.loadSnap(SRC); } else await page.newGame(SRC);
  const out = await page.evaluate(([SKIP, N, EVERY]) => {
    TerraJev.mode = 'teacher'; TerraJev.epsilon = 0; if (!Bot.active) Bot.start(1);
    const p = G.player, o = [];
    const step = () => { Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame(); };
    for (let i = 0; i < SKIP; i++) step();
    const log0 = Bot.log.bind(Bot); Bot.log = (m) => { o.push(G.tick + ' LOG ' + m); return log0(m); };
    for (let i = 0; i < N; i++) {
      step();
      if (i % EVERY) continue;
      const nv = Bot.nav, nx = nv && nv.path && nv.path[nv.i];
      o.push(`${G.tick} feet ${Bot.feet()} v ${p.vx.toFixed(1)},${p.vy.toFixed(1)} g${p.onGround ? 1 : 0} life ${Math.round(p.life)} held ${(p.inv[p.sel] || {}).id} | ${Bot.goal} | why ${Bot.why} | nav ${nv ? (nv.tx + ',' + nv.ty + ' i' + nv.i + '/' + nv.path.length + (nx ? ' next ' + nx.move.t + '@' + nx.x + ',' + nx.y : '') + (nv.cooldown > G.tick ? ' cd' : '')) : '-'} keys ${['a', 'd', ' '].filter(k => Input.keys[k]).join('')} ${Bot.dbg || ''}`);
    }
    return o.concat((Bot.planLog || []).slice(-15));
  }, [SKIP, N, EVERY]);
  console.log(out.join('\n'));
  if (process.env.SNAP) await page.saveSnap(process.env.SNAP);
});
