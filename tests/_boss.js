const run = require('./harness');
const KEY = process.argv[2] || 'king_slime', ITEM = process.argv[3] || 'slime_crown';
run(async (page) => {
  await page.newGame('boss1');
  const r = await page.evaluate(([KEY, ITEM]) => {
    Bot.start(1); const p = G.player;
    p.lifeMax = 300; p.life = 300;
    p.inv[0] = { id: 'gold_broadsword', count: 1 }; p.inv[3] = { id: 'gold_bow', count: 1 };
    p.inv[40] = { id: 'wooden_arrow', count: 999 }; p.inv[41] = { id: 'lesser_healing_potion', count: 20 };
    if (ITEM) p.inv[44] = { id: ITEM, count: 1 };
    p.armor = [{ id: 'gold_helmet', count: 1 }, { id: 'gold_chainmail', count: 1 }, { id: 'gold_greaves', count: 1 }];
    Bot.base = Bot.feet(); Bot.houseSpot = Bot.feet();
    for (let i = 0; i < 2; i++) { G.update(); Input.endFrame(); }
    Bot.setAct({ id: 'boss:' + KEY, kind: 'boss' }, Bot.taskBoss(KEY), []);
    const out = [];
    for (let i = 0; i < 80000; i++) {
      Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame();
      if (Bot.task && !/preparing|summon|boss|waiting|heading|healing|farming/.test(Bot.goal) && !G.npcs.some(n => n.boss) && !G.world.flags[KEY] && Bot.task.done !== false) { }
      if (i % 4000 === 0) out.push(G.tick + ' ' + G.clockString() + ' goal=' + Bot.goal + ' act=' + (Bot.act && Bot.act.id) + ' life=' + Math.round(p.life) + ' boss=' + (G.npcs.find(n => n.boss) || {}).life);
      if (G.world.flags[KEY]) { out.push('KILLED at ' + G.tick); break; }
    }
    return out.concat(['deaths ' + Bot.deaths], Bot.logLines.filter(l => /summon|MILESTONE|boss|died|death/i.test(l)).slice(-10));
  }, [KEY, ITEM]);
  console.log(r.join('\n'));
});
