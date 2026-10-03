// Swinging along Ohio's ceiling with the grappling hook: how fast can we travel sideways without a floor?
// The bot logic under test is Bot.hookTravel(dir) (one tick: throw ahead-up, ride the pull, re-throw).
const run = require('./harness');
const { applyStage } = require('./stagelib');
run(async (page) => {
  await page.newGame('bot67');
  await applyStage(page, 'hell');
  const r = await page.evaluate(([DIR]) => {
    const w = G.world, p = G.player, o = [];
    invAdd(p.inv, 'grappling_hook', 1); p.lifeMax = p.life = 9999; G.godMode = true;
    // start just under the ceiling of the Ohio void, over the island the hell plan would pick
    const isl = Bot.findIsland(Math.floor(p.cx / TS)); const x0 = isl ? isl.x0 + 3 : 900;
    let cy = w.hellLayer; while (cy < w.h - 5 && w.solid(x0, cy)) cy++;
    while (cy < w.h - 5 && !w.solid(x0, cy) && cy < w.hellLayer + 5) cy++;
    let ceil = w.hellLayer - 5; for (let y = w.hellLayer + 40; y > w.hellLayer - 20; y--) if (w.solid(x0, y) && !w.solid(x0, y + 1)) { ceil = y; break; }
    const sy = isl ? isl.y - 3 : w.hellLayer + 36; p.x = x0 * TS; p.y = sy * TS; p.vx = p.vy = 0;   // island level, in the open void
    Bot.task = { step() { Bot.hookTravel(DIR); } }; Bot.act = { id: 'test', kind: 'reflex', at: G.tick, life: p.life, seen: new Set() }; Bot.needDecision = () => false;
    G.npcs = G.npcs.filter(n => n.town);
    const startX = p.cx, startY = p.cy;
    for (let i = 0; i < 1200; i++) { G.npcs = G.npcs.filter(n => n.town); Bot.wantsDraw = false; G.update(); Input.endFrame(); if (i >= 60 && i < 75) o.push('  t' + i + ' hook=' + (p.hook ? p.hook.state + ' d=' + Math.round(dist(p.hook.x, p.hook.y, p.cx, p.cy)) + ' ahead=' + Math.round((p.hook.x - p.cx) * DIR) : '-') + ' jumpHeld=' + p.jumpHeld + ' space=' + Input.keys[' '] + ' why=' + Bot.why); if (i % 200 === 0) o.push(i + ' x=' + Math.round(p.cx / TS) + ' y=' + Math.round(p.cy / TS) + ' hook=' + (p.hook ? p.hook.state : '-') + ' why=' + Bot.why); }
    o.push('ceiling row ' + ceil + ': moved ' + Math.round((p.cx - startX) / TS) + ' tiles sideways, ' + Math.round((p.cy - startY) / TS) + ' rows down in 1200 ticks (' + ((p.cx - startX) / 1200).toFixed(2) + ' px/tick; walking is 3, the Wall 1.3-3.9)');
    return o;
  }, [+process.env.DIR || 1]);
  console.log(r.join('\n'));
});
