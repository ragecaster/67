// per-tick trace after restoring a snapshot: node replay2.js <snap> <startTick> <count>
const run = require('./harness');
const { restore } = require('./snaplib');
run(async (page) => {
  await page.newGame('bot67');
  await restore(page, process.argv[2]);
  await page.evaluate(() => { Bot.cooldowns = {}; Bot.fails = {}; Bot.badTiles = new Set(); });
  const out = await page.evaluate(([a, n]) => {
    const o = [];
    for (let i = 0; i < a + n; i++) {
      Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame();
      if (i >= a) { const p = G.player, nv = Bot.nav; o.push([i, 'y', (p.y + p.h).toFixed(1), 'vy', p.vy.toFixed(2), 'g', p.onGround ? 1 : 0, 'sel', p.sel, 'held', (p.inv[p.sel] || {}).id, 'mD', Input.mDown ? 1 : 0, 'anim', p.itemAnim, 'nav', nv && nv.path.length ? nv.i + '/' + nv.path.length + ' ' + (nv.path[nv.i] ? nv.path[nv.i].move.t : '-') : '-', 'dxp', nv && nv.path[nv.i] ? (nv.path[nv.i].x * TS + 16 - p.cx).toFixed(1) : '-', 'digs', nv && nv.path[nv.i] ? JSON.stringify((nv.path[nv.i].move.digs || []).filter(([x, y]) => G.world.tile(x, y)).map(([x, y]) => x + ',' + y + ':' + G.world.tile(x, y))) : '-', 'jumpkey', Input.keys[' '] ? 1 : 0].join(' ')); }
    }
    return o;
  }, [+process.argv[3], +process.argv[4]]);
  console.log(out.join('\n'));
});
