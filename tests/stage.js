// Start the bot from a mid-game inventory so later tasks can be debugged without waiting for the early game.
// This is a TEST shortcut only (it edits the inventory); the bot itself still plays with inputs only.
// usage: node stage.js <stage> [ticks] [sampleEvery] [seed]      stage: iron | gold | lenses | demon | hell
const run = require('./harness');
const { applyStage } = require('./stagelib');
const STAGE = process.argv[2] || 'iron', TICKS = +process.argv[3] || 60000, EVERY = +process.argv[4] || 6000, SEED = process.argv[5] || 'bot67';
run(async (page) => {
  await page.newGame(SEED);
  await applyStage(page, STAGE);
  for (let done = 0; done < TICKS; done += EVERY) {
    const s = await page.evaluate(([n, FORCE]) => {
      for (let i = 0; i < n; i++) {
        if (FORCE && Bot.milestones.house && (!Bot.task || Bot.task.done) && !Bot.uiBusy) { Bot.task = Bot[FORCE](); Bot.taskAge = 1; }
        Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame(); }
      const p = G.player, newLogs = Bot.logLines.slice(window.__seen); window.__seen = Bot.logLines.length;
      return { t: G.tick, clock: G.clockString(), goal: Bot.goal, pos: [p.x / TS | 0, (p.y + p.h) / TS | 0], life: p.life + '/' + p.lifeMax, def: p.calc.defense, deaths: Bot.deaths, ms: Object.keys(Bot.milestones).join(','), logs: newLogs.slice(-10), plan: Math.round(Bot.planMs || 0) + 'ms/' + (Bot.planCount || 0), boss: (G.npcs.filter(n => n.boss).map(n => n.name + ' ' + Math.round(n.life) + '/' + n.lifeMax + ' ' + (n.state || '')).join(',')), flags: Object.keys(G.world.flags).filter(k => G.world.flags[k] === true).join(','), deathsL: (Bot.deathLog || []).join(' | '), inv: p.inv.filter(x => x && (ITEMS[x.id].damage || /_bar$|_ore$/.test(x.id))).map(x => x.id + ':' + x.count).join(' ') };
    }, [EVERY, process.env.FORCE || '']);
    console.log(`t=${s.t} ${s.clock} | ${s.goal} | pos ${s.pos} life ${s.life} def ${s.def} deaths ${s.deaths} plan ${s.plan} BOSS[${s.boss}] flags[${s.flags}]\n   deaths: ${s.deathsL}\n   inv: ${s.inv}\n   ms: ${s.ms}`);
    for (const l of s.logs) console.log('   > ' + l);
  }
});
