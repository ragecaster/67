// Mining throughput benchmark: force the bot to mine one ore type for N ticks and report ore/ticks and what it was doing.
// usage: node minebench.js <tileName: IRON|GOLD|SILVER|COPPER> [ticks] [stage]
const run = require('./harness');
const { applyStage } = require('./stagelib');
const TILE = process.argv[2] || 'IRON', TICKS = +process.argv[3] || 30000, STAGE = process.argv[4] || 'gold';
run(async (page) => {
  await page.newGame('bot67');
  await applyStage(page, STAGE);
  await page.evaluate((TILE) => { window.__ore = { IRON: 'iron_ore', GOLD: 'gold_ore', SILVER: 'silver_ore', COPPER: 'copper_ore' }[TILE]; Bot.houseSpot = Bot.houseSpot; }, TILE);
  const t0 = Date.now();
  for (let done = 0; done < TICKS; done += 5000) {
    const s = await page.evaluate(([TILE, n]) => {
      for (let i = 0; i < n; i++) {
        if (!Bot.task || Bot.task.done) { if (Bot.milestones.house) { Bot.task = Bot.taskMine('ore', () => false, [T[TILE]]); Bot.taskAge = 1; } }
        Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame();
      }
      const p = G.player;
      return { t: G.tick, ore: Bot.count(window.__ore), goal: Bot.goal, pos: Bot.feet(), deaths: Bot.deaths, house: !!Bot.milestones.house, log: Bot.logLines.slice(-3), plan: Math.round(Bot.planMs || 0) + 'ms/' + (Bot.planCount || 0) };
    }, [TILE, 5000]);
    console.log(`t=${s.t} ore=${s.ore} ${s.goal} pos ${s.pos} deaths ${s.deaths} house ${s.house} plan ${s.plan} | ${s.log.join(' | ').slice(0, 200)}`);
  }
  console.log(await page.evaluate(() => {
    const w = G.world, p = G.player, [fx, fy] = Bot.feet(), rows = [], nv = Bot.nav;
    for (let y = fy - 8; y <= fy + 6; y++) { let s = ''; for (let x = fx - 16; x <= fx + 16; x++) { const t = w.tile(x, y), d = TILES[t]; const me = x >= fx - 1 && x <= fx && y > fy - 3 && y <= fy; s += me ? '@' : !t ? (w.liq(x, y) > 50 ? '~' : w.wall(x, y) ? 'w' : '.') : d.ore ? 'O' : d.solid ? '#' : 'o'; } rows.push(s + ' ' + y); }
    return 'dbg: ' + Bot.dbg + ' why=' + Bot.why + ' stuck=' + Bot.stuck + ' nav=' + (nv ? JSON.stringify({ i: nv.i, len: nv.path.length, next: nv.path[nv.i] && nv.path[nv.i].move.t + '@' + nv.path[nv.i].x + ',' + nv.path[nv.i].y, digs: nv.path[nv.i] && nv.path[nv.i].move.digs, stage: nv.stage, partial: nv.partial }) : null) + '\nplanlog:\n' + (Bot.planLog || []).slice(-5).join('\n') + '\n' + rows.join('\n') + '\n x0=' + (fx - 16);
  }));
  console.log('wall', Math.round((Date.now() - t0) / 1000) + 's');
});
