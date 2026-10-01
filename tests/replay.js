// usage: node replay.js <snapshot.json> [ticks] [every]
// Restores a frozen bot situation (see snaplib.js) and runs the bot from there, printing goal/position/nav every `every` ticks.
const run = require('./harness');
const { restore } = require('./snaplib');
const FILE = process.argv[2], TICKS = +process.argv[3] || 3000, EVERY = +process.argv[4] || 200;
run(async (page) => {
  await page.newGame('bot67');
  console.log('restored tick', await restore(page, FILE));
  if (process.env.CLEAR) await page.evaluate(() => { Bot.cooldowns = {}; Bot.fails = {}; Bot.badTiles = new Set(); });
  for (let done = 0; done < TICKS; done += EVERY) {
    const s = await page.evaluate((n) => {
      for (let i = 0; i < n; i++) { Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame(); }
      const p = G.player, nv = Bot.nav, [fx, fy] = Bot.feet();
      return { t: G.tick, goal: Bot.goal.slice(0, 50), pos: [fx, fy], why: Bot.why.slice(0, 30), stuck: Bot.stuck, nav: nv && nv.path.length ? ' i=' + nv.i + '/' + nv.path.length + ' next=' + (nv.path[nv.i] ? nv.path[nv.i].move.t + '@' + nv.path[nv.i].x + ',' + nv.path[nv.i].y : '-') + ' ' + nv.stage + (nv.partial ? ' PARTIAL' : '') : ' nonav', ground: p.onGround, sel: p.sel, life: Math.round(p.life), log: Bot.logLines.slice(-2), dbg: Bot.dbg, pl: (Bot.planLog || []).slice(-1)[0] };
    }, EVERY);
    console.log(`t=${s.t} ${s.goal} | pos ${s.pos} stuck ${s.stuck} ${s.nav} ground=${s.ground} sel=${s.sel} life=${s.life} dbg=${s.dbg} pl=${s.pl}`);
  }
  console.log((await page.evaluate(() => Bot.logLines.slice(-8))).join('\n'));
});
