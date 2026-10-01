// Start the bot from a mid-game inventory so later tasks can be debugged without waiting for the early game.
// This is a TEST shortcut only (it edits the inventory); the bot itself still plays with inputs only.
// usage: node stage.js <stage> [ticks] [sampleEvery] [seed]      stage: iron | gold | lenses | demon | hell
const run = require('./harness');
const STAGE = process.argv[2] || 'iron', TICKS = +process.argv[3] || 60000, EVERY = +process.argv[4] || 6000, SEED = process.argv[5] || 'bot67';
run(async (page) => {
  await page.newGame(SEED);
  await page.evaluate((stage) => {
    const p = G.player;
    const give = (id, n = 1) => invAdd(p.inv, id, n);
    give('wood', 150); give('stone_block', 100); give('torch', 40); give('dirt_block', 150); give('lesser_healing_potion', 8);
    if (stage !== 'iron') { for (const id of ['iron_pickaxe', 'iron_broadsword']) give(id); p.armor[0] = { id: 'iron_helmet', count: 1 }; p.armor[1] = { id: 'iron_chainmail', count: 1 }; p.armor[2] = { id: 'iron_greaves', count: 1 }; }
    if (stage === 'gold' || stage === 'lenses' || stage === 'demon' || stage === 'hell') { give('gold_pickaxe'); give('gold_broadsword'); p.lifeMax = 200; p.life = 200; }
    if (stage === 'lenses' || stage === 'demon' || stage === 'hell') give('lens', 6);
    if (stage === 'demon' || stage === 'hell') { G.world.flags.eye_of_cthulhu = true; }
    if (stage === 'hell') { give('nightmare_pickaxe'); give('demonite_bar', 12); p.lifeMax = 300; p.life = 300; }
    Bot.start(1); Bot.verbose = false; window.__seen = 0;
  }, STAGE);
  for (let done = 0; done < TICKS; done += EVERY) {
    const s = await page.evaluate((n) => {
      for (let i = 0; i < n; i++) { Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame(); }
      const p = G.player, newLogs = Bot.logLines.slice(window.__seen); window.__seen = Bot.logLines.length;
      return { t: G.tick, clock: G.clockString(), goal: Bot.goal, pos: [p.x / TS | 0, (p.y + p.h) / TS | 0], life: p.life + '/' + p.lifeMax, def: p.calc.defense, deaths: Bot.deaths, ms: Object.keys(Bot.milestones).join(','), logs: newLogs.slice(-10), plan: Math.round(Bot.planMs || 0) + 'ms/' + (Bot.planCount || 0) };
    }, EVERY);
    console.log(`t=${s.t} ${s.clock} | ${s.goal} | pos ${s.pos} life ${s.life} def ${s.def} deaths ${s.deaths} plan ${s.plan}\n   ms: ${s.ms}`);
    for (const l of s.logs) console.log('   > ' + l);
  }
});
