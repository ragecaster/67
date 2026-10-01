// usage: node botrun.js <ticks> <seed> [sampleEvery]
const run = require('./harness');
const TICKS = parseInt(process.argv[2] || '60000'), SEED = process.argv[3] || 'bot67', EVERY = parseInt(process.argv[4] || '6000');
run(async (page, errors) => {
  await page.newGame(SEED);
  await page.evaluate(() => { Bot.start(1); Bot.verbose = false; window.__seen = 0; });
  for (let done = 0; done < TICKS; done += EVERY) {
    const s = await page.evaluate((n) => {
      for (let i = 0; i < n; i++) { Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame(); }
      const p = G.player, newLogs = Bot.logLines.slice(window.__seen); window.__seen = Bot.logLines.length;
      return { t: G.tick, day: G.world.day, clock: G.clockString(), goal: Bot.goal, pos: [p.x / TS | 0, (p.y + p.h) / TS | 0], life: p.life + '/' + p.lifeMax, def: p.calc.defense, pick: Math.max(0, ...p.inv.map(s => s ? ITEMS[s.id].pick || 0 : 0)), stuck: Bot.stuck, by: Object.entries(Bot.planBy || {}).sort((a, b) => b[1][0] - a[1][0]).slice(0, 4).map(([k, v]) => k + ':' + Math.round(v[0]) + '/' + v[1]).join(' '), plan: Math.round(Bot.planMs || 0) + 'ms/' + (Bot.planCount || 0), deaths: Bot.deaths, ms: Object.keys(Bot.milestones).join(','), logs: newLogs.slice(-8), inv: p.inv.filter(Boolean).map(s => s.id + ':' + s.count).join(' ') };
    }, EVERY);
    console.log(`t=${s.t} d${s.day} ${s.clock} | ${s.goal} | pos ${s.pos} life ${s.life} def ${s.def} pick ${s.pick} stuck ${s.stuck} deaths ${s.deaths} plan ${s.plan} [${s.by}]\n   ms: ${s.ms}`);
    for (const l of s.logs) console.log('   > ' + l);
  }
  console.log('INV:', await page.evaluate(() => G.player.inv.filter(Boolean).map(s => s.id + ':' + s.count).join(' ')));
  await page.screenshot({ path: 'botrun.png' });
});
