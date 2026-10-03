// The grappling-hook fall brake: a 2-wide shaft DEPTH rows deep with no rungs, the bot dropped in at the top holding S.
// Without a hook (HOOK=0) the fall kills it; with one it should hook the wall every ~18 rows and arrive alive.
// usage: node hookbrake.js   env: SEED, DEPTH (default 80), HOOK (default 1)
const run = require('./harness');
const { applyStage } = require('./stagelib');
run(async (page) => {
  await page.newGame(process.env.SEED || 'bot67');
  await applyStage(page, 'gold');
  console.log(await page.evaluate(([D, HOOK]) => {
    const w = G.world, p = G.player, x0 = Math.floor(p.cx / TS) + 30, top = topSolid(w, x0);
    for (let y = top - 10; y <= top + D; y++) { for (const x of [x0, x0 + 1]) { w.setTile(x, y, 0); w.liquid[w.idx(x, y)] = 0; } for (const x of [x0 - 2, x0 - 1, x0 + 2, x0 + 3]) w.setTile(x, y, y < top ? 0 : T.STONE); }
    w.setTile(x0, top + D + 1, T.STONE); w.setTile(x0 + 1, top + D + 1, T.STONE);
    if (HOOK) invAdd(p.inv, 'grappling_hook', 1); else for (let i = 0; i < p.inv.length; i++) if (p.inv[i] && ITEMS[p.inv[i].id].hook) p.inv[i] = null;
    for (let i = 0; i < p.inv.length; i++) if (p.inv[i] && ITEMS[p.inv[i].id].place) p.inv[i] = null;   // no blocks: the block catch can't save it
    p.x = x0 * TS + 16 - p.w / 2; p.y = (top - 1) * TS - p.h; p.vx = p.vy = 0;
    Bot.milestones.house = 1; Bot.houseFinished = true;
    const task = { step() { Input.keys.s = true; if (Math.abs(p.cx - (x0 * TS + 16)) > 3) Input.keys[p.cx < x0 * TS + 16 ? 'd' : 'a'] = true; } };
    Bot.needDecision = () => false; Bot.decideAct = () => { Bot.task = task; }; Bot.task = task;
    let brakes = 0, t; const dbg = [];
    for (t = 0; t < 3000; t++) {
      Bot.task = task; Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw) G.draw(); Input.endFrame();
      if (Bot.why === 'hook-brake') brakes++;
      if (t % 20 === 0 && t < 400) dbg.push(t + ' feet ' + Bot.feet() + ' vy ' + p.vy.toFixed(1) + ' gnd ' + p.onGround + ' why ' + Bot.why + ' fall ' + (p.fallStart != null ? ((p.y - p.fallStart) / TS).toFixed(1) : '-') + ' hook ' + (p.hook ? p.hook.state : '-') + ' below ' + [x0, x0 + 1].map(x => w.tile(x, Bot.feet()[1] + 1)).join(','));
      if (p.dead) return dbg.join('\n') + '\nDIED of ' + G.deathCause + ' at row ' + Bot.feet()[1] + ' (top ' + top + '), brakes ' + brakes;
      if (Bot.feet()[1] >= top + D - 1 && p.onGround) break;
    }
    return dbg.join('\n') + '\nx0 ' + x0 + ' top ' + top + ' feet ' + Bot.feet() + ' why ' + Bot.why + ' goal ' + Bot.goal + ' | ARRIVED row ' + Bot.feet()[1] + ' in ' + t + ' ticks, life ' + Math.round(p.life) + '/' + p.lifeMax + ', brakes ' + brakes;
  }, [+process.env.DEPTH || 80, process.env.HOOK === '0' ? 0 : 1]));
});
