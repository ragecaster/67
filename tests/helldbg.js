// Ohio/Wall debugging: stage 'hell', the guide appears after the house milestone, bot forced into taskHell; prints hell-plan state.
// usage: [GIVE=guide_voodoo_doll] node helldbg.js [ticks] [every]
const run = require('./harness');
const { capture, restore } = require('./snaplib');
const { applyStage } = require('./stagelib');
const TICKS = +process.argv[2] || 60000, EVERY = +process.argv[3] || 1000;
run(async (page) => {
  await page.newGame('bot67');
  const RESTORE = process.env.RESTORE;
  if (RESTORE) { await restore(page, RESTORE); await page.evaluate(() => { window.__g = 1; }); }
  else await applyStage(page, 'hell');
  if (process.env.GIVE) await page.evaluate((ids) => { for (const id of ids) invAdd(G.player.inv, id, 1); }, process.env.GIVE.split(','));
  for (let done = 0; done < TICKS; done += EVERY) {
    const s = await page.evaluate((n) => {
      for (let i = 0; i < n; i++) {
        if (Bot.milestones.house && !window.__g) { window.__g = 1; G.spawnNPC('guide', Bot.base[0] * TS, (Bot.base[1] - 2) * TS); }
        if (Bot.milestones.house && (!Bot.task || Bot.task.done) && !Bot.uiBusy) { Bot.task = Bot.taskHell(); Bot.taskAge = 1; }
        Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame();
      }
      const p = G.player, nl = Bot.logLines.slice(window.__seen || 0); window.__seen = Bot.logLines.length;
      const wall = G.npcs.find(n => n.type === 'wall_of_flesh');
      return { t: G.tick, goal: Bot.goal, feet: Bot.feet(), H: JSON.stringify(Bot.hell), dbg: Bot.dbg, why: Bot.why, life: Math.round(p.life), wall: wall ? Math.round(wall.life) + ' x=' + Math.round(wall.x / TS) : '', flags: G.world.flags.wall_of_flesh, logs: nl.filter(l => !/house finished/.test(l)).slice(-8), inv: ['guide_voodoo_doll', 'stone_block', 'ash_block'].map(i => i + ':' + Bot.count(i)).join(' '), dead: p.dead, deaths: Bot.deaths };
    }, EVERY);
    if (process.env.CAPAT && !global.__cap && s.feet[1] >= +process.env.CAPAT && !s.dead) { global.__cap = 1; await capture(page, '/tmp/hell_at.json'); console.log('captured at depth ' + s.feet); }
    if (!process.env.QUIET || (done / EVERY) % +process.env.QUIET === 0) console.log(`t=${s.t} ${s.goal} | feet ${s.feet} life ${s.life} why ${s.why} dbg ${s.dbg} wall[${s.wall}] ${s.inv} deaths ${s.deaths}\n   H=${s.H}`);
    if (!process.env.QUIET) for (const l of s.logs) console.log('   > ' + l);
    const ph = (JSON.parse(s.H || '{}') || {}).ph;
    if (process.env.CAPTURE && ph && ph !== global.__ph) { global.__ph = ph; await capture(page, '/tmp/hell_' + ph + '.json'); console.log('captured ' + ph); }
    if (s.flags) { console.log('WALL DEFEATED'); break; }
  }
});
