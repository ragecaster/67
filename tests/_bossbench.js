// measure a boss fight with a given loadout: damage dealt/s, taken/s, outcome
const run = require('./harness');
const [KEY, GEAR] = [process.argv[2] || 'king_slime', process.argv[3] || 'iron'];
const SETS = {
  iron: { life: 120, inv: [['iron_broadsword', 1], ['iron_pickaxe', 1]], armor: ['copper_helmet', 'copper_chainmail', 'copper_greaves'] },
  ironbow: { life: 140, inv: [['iron_broadsword', 1], ['iron_bow', 1], ['wooden_arrow', 300], ['lesser_healing_potion', 5]], armor: ['iron_helmet', 'iron_chainmail', 'iron_greaves'] },
  gold: { life: 200, inv: [['gold_broadsword', 1], ['gold_bow', 1], ['wooden_arrow', 400], ['lesser_healing_potion', 10]], armor: ['gold_helmet', 'gold_chainmail', 'gold_greaves'] },
  the67melee: { life: 260, inv: [['the_67', 1], ['lesser_healing_potion', 10]], armor: ['gold_helmet', 'gold_chainmail', 'gold_greaves'] },
  goldmelee: { life: 200, inv: [['gold_broadsword', 1], ['lesser_healing_potion', 10]], armor: ['gold_helmet', 'gold_chainmail', 'gold_greaves'] },
  // early-game loadouts for the 1-hour boss rush (no crystals yet)
  e67: { life: 100, inv: [['the_67', 1], ['lesser_healing_potion', 5]], armor: ['iron_helmet', 'iron_chainmail', 'iron_greaves'] },
  e67life: { life: 160, inv: [['the_67', 1], ['lesser_healing_potion', 5]], armor: ['iron_helmet', 'iron_chainmail', 'iron_greaves'] },
  eiron: { life: 100, inv: [['iron_broadsword', 1], ['iron_bow', 1], ['wooden_arrow', 300], ['lesser_healing_potion', 5]], armor: ['iron_helmet', 'iron_chainmail', 'iron_greaves'] },
  egold: { life: 120, inv: [['gold_broadsword', 1], ['gold_bow', 1], ['wooden_arrow', 300], ['lesser_healing_potion', 5]], armor: ['silver_helmet', 'silver_chainmail', 'silver_greaves'] },
  n100: { life: 100, inv: [['the_67', 1]], armor: [] },
  n140: { life: 140, inv: [['the_67', 1]], armor: [] },
  n100p: { life: 100, inv: [['the_67', 1], ['lesser_healing_potion', 5]], armor: [] },
  c100: { life: 100, inv: [['the_67', 1]], armor: ['copper_helmet', 'copper_chainmail', 'copper_greaves'] },
  the67: { life: 260, inv: [['the_67', 1], ['gold_bow', 1], ['wooden_arrow', 400], ['lesser_healing_potion', 10]], armor: ['gold_helmet', 'gold_chainmail', 'gold_greaves'] },
};
run(async (page) => {
  await page.newGame('bench1');
  const r = await page.evaluate(([KEY, S, TRACE, NOPERCH]) => {
    TerraJev.mode = 'teacher'; Bot.start(1);
    const p = G.player; p.lifeMax = S.life; p.life = S.life;
    S.inv.forEach(([id, n], i) => { p.inv[20 + i] = { id, count: n }; });
    p.armor = [0, 1, 2].map(i => S.armor[i] ? { id: S.armor[i], count: 1 } : null);
    for (let i = 0; i < 3; i++) { G.update(); Input.endFrame(); }
    Bot.base = Bot.feet(); Bot.houseSpot = Bot.feet();
    if (KEY !== 'king_slime') { G.world.dayTime = false; G.world.time = 1000; }
    const VIA = KEY === 'tung_sahur' && !NOPERCH;   // Tung: go through taskBoss (builds the perch, then summons with the item)
    if (VIA) { Bot.houseValid = () => true; const tp = Bot.teacherPick.bind(Bot); Bot.teacherPick = (c, f) => f.length || !c.some(x => x.id === 'boss:' + KEY) ? tp(c, f) : 'boss:' + KEY; invAdd(p.inv, BOSS_SUMMON[KEY].item, 1); invAdd(p.inv, 'dirt_block', 60); invAdd(p.inv, 'wood', 30); Bot.setAct({ id: 'boss:' + KEY, kind: 'boss' }, Bot.taskBoss(KEY), []); }
    else G.summonBoss(KEY, p);
    const out = { fights: [] };
    let f = null;
    for (let i = 0; i < 60000; i++) {
      if (TRACE && !G.npcs.some(n => n.boss) && G.tick % 60 === 0) out.trace = (out.trace || []).concat(['pre ' + G.tick + ' ' + Bot.goal + ' ' + Bot.feet() + ' perch=' + Bot.perch + ' on=' + Bot.onPerch() + ' ground=' + G.player.onGround + ' why=' + Bot.why]);
      Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw) G.draw(); Input.endFrame();
      const b = G.npcs.find(n => n.boss && !n.dead);
      if (b && !f) f = { t: G.tick, life0: b.life, taken: 0, last: p.life };
      if (TRACE && b && G.tick % (+TRACE || 30) === 0) out.trace = (out.trace || []).concat([[G.tick, Math.round(b.cx - p.cx), Math.round(b.cy - p.cy), Math.round(p.life), Math.round(b.life), b.state, Bot.goal, Bot.why, Bot.act && Bot.act.id, p.selected, p.inv[p.selected] && p.inv[p.selected].id, Bot.feet(), Object.keys(Input.keys).filter(k => Input.keys[k]).join('')].join(' ')]);
      if (f) { if (p.life < f.last) f.taken += f.last - p.life; f.last = p.life; }
      if (f && (!b || p.dead)) {
        f.dur = (G.tick - f.t) / 60; f.result = G.world.flags[KEY] ? 'WIN' : p.dead ? 'DIED' : 'despawn';
        f.bossLeft = b ? Math.round(b.life) : 0; f.dealtPerS = Math.round((f.life0 - f.bossLeft) / f.dur); f.takenPerS = Math.round(f.taken / f.dur);
        out.fights.push(f); f = null;
        if (G.world.flags[KEY] || out.fights.length >= 2) break;
        if (VIA) break;
        if (!G.npcs.some(n => n.boss)) { p.life = p.lifeMax; G.summonBoss(KEY, p); }
      }
    }
    out.dps = Math.round(Bot.weaponDps(null).dps); out.def = p.calc.defense;
    return out;
  }, [KEY, SETS[GEAR], process.env.TRACE, !!process.env.NOPERCH]);
  if (r.trace) { console.log(r.trace.join('\n')); delete r.trace; }
  if (process.env.TRACE) console.log((await page.evaluate(() => Bot.logLines.slice(-25))).join('\n'));
  console.log(KEY, GEAR, JSON.stringify(r));
});
