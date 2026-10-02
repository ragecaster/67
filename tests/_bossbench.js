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
  await page.newGame(process.env.SEED || 'bench1');
  const r = await page.evaluate(([KEY, S, TRACE, NOPERCH, PRE, REPS, ARENA]) => {
    TerraJev.mode = 'teacher'; Bot.start(1);
    if (PRE) eval(PRE);   // PRE='Bot.x = 1' : tweak the bot before the fight
    const p = G.player; p.lifeMax = S.life; p.life = S.life;
    S.inv.forEach(([id, n], i) => { p.inv[20 + i] = { id, count: n }; });
    p.armor = [0, 1, 2].map(i => S.armor[i] ? { id: S.armor[i], count: 1 } : null);
    for (let i = 0; i < 3; i++) { G.update(); Input.endFrame(); }
    Bot.base = Bot.feet(); Bot.houseSpot = Bot.feet();
    if (KEY !== 'king_slime') { G.world.dayTime = false; G.world.time = 1000; }
    const VIA = (KEY === 'tung_sahur' || (KEY === 'eye_of_cthulhu' && ARENA)) && !NOPERCH;   // ARENA=1: the Eye too (builds its platform arena)   // Tung: go through taskBoss (builds the perch, then summons with the item)
    if (VIA) { Bot.houseValid = () => true; const tp = Bot.teacherPick.bind(Bot); Bot.teacherPick = (c, f) => f.length || !c.some(x => x.id === 'boss:' + KEY) ? tp(c, f) : 'boss:' + KEY; invAdd(p.inv, BOSS_SUMMON[KEY].item, 1); invAdd(p.inv, 'dirt_block', 60); invAdd(p.inv, 'wood', 40); invAdd(p.inv, 'wood', 30); Bot.setAct({ id: 'boss:' + KEY, kind: 'boss' }, Bot.taskBoss(KEY), []); }
    else G.summonBoss(KEY, p);
    const out = { fights: [], hits: {} };
    // who hurts us: '<npc type>:<state>' -> [hits, damage]
    const hurt0 = p.hurt.bind(p);
    p.hurt = (dmg, kb, src, ...r) => { const l0 = p.life, ok = hurt0(dmg, kb, src, ...r); if (ok) { const k = (src && src.type || 'other:' + (r[0] || '')) + (src && src.state ? ':' + src.state : ''); const h = out.hits[k] || (out.hits[k] = [0, 0]); h[0]++; h[1] += Math.round(l0 - p.life); if (src && src.boss) (out.bossHits = out.bossHits || []).push([G.tick, src.state, src.ai[1], src.dashes, Math.round(src.vx), Math.round(src.vy), Math.round(src.cx - p.cx), Math.round(src.cy - p.cy), +p.vx.toFixed(1), p.onGround ? 'g' : 'air', Bot.eyeArena && Bot.eyeArena.dir, Bot.why, Math.round(p.y + p.h), Bot.eyeArena && Bot.eyeArena.floor].join(' ')); } return ok; };
    let f = null;
    for (let i = 0; i < 60000; i++) {
      if (TRACE && !G.npcs.some(n => n.boss) && G.tick % 60 === 0) out.trace = (out.trace || []).concat(['pre ' + G.tick + ' ' + Bot.goal + ' ' + Bot.feet() + ' perch=' + Bot.perch + ' on=' + Bot.onPerch() + ' ground=' + G.player.onGround + ' why=' + Bot.why]);
      Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw) G.draw(); Input.endFrame();
      const b = G.npcs.find(n => n.boss && !n.dead);
      if (b && !f) f = { t: G.tick, life0: b.life, taken: 0, last: p.life };
      if (TRACE && b && G.tick % (+TRACE || 30) === 0) out.trace = (out.trace || []).concat([[G.tick, Math.round(b.cx - p.cx), Math.round(b.cy - p.cy), Math.round(p.life), Math.round(b.life), b.state, Bot.goal, Bot.why, Bot.act && Bot.act.id, p.selected, p.inv[p.selected] && p.inv[p.selected].id, Bot.feet(), Object.keys(Input.keys).filter(k => Input.keys[k]).join(''), Bot.perch && [-2,-1,0,1].map(dy => [0,1,2].map(i => G.world.tile(Bot.perchSpot()[0] + Bot.perch[3] * i, Bot.perchSpot()[1] + dy) ? 'X' : '.').join('')).join('/')].join(' ')]);
      if (f) { if (p.life < f.last) f.taken += f.last - p.life; f.last = p.life; f.ticks = (f.ticks || 0) + 1; if (Bot.onArena && Bot.onArena() || (Bot.eyeArena && Bot.eyeArena.onArena)) f.onA = (f.onA || 0) + 1; }
      if (f && (!b || p.dead)) {
        f.arena = Math.round(100 * (f.onA || 0) / (f.ticks || 1)); delete f.onA; delete f.ticks; f.dashHits = (out.bossHits || []).filter(h => +h.split(' ')[0] >= f.t).length;
        f.dur = (G.tick - f.t) / 60; f.result = G.world.flags[KEY] ? 'WIN' : p.dead ? 'DIED' : 'despawn';
        f.bossLeft = b ? Math.round(b.life) : 0; f.dealtPerS = Math.round((f.life0 - f.bossLeft) / f.dur); f.takenPerS = Math.round(f.taken / f.dur);
        out.fights.push(f); f = null;
        if (REPS > 1 && out.fights.length < REPS) {   // REPS=n: n fresh fights in a row (full life, night again)
          G.world.flags[KEY] = false; if (p.dead) { for (let k = 0; k < 400 && p.dead; k++) { G.update(); Input.endFrame(); } }
          p.life = p.lifeMax; if (KEY !== 'king_slime') { G.world.dayTime = false; G.world.time = 1000; }
          for (const m of G.npcs) if (!m.town) { m.dead = true; m.silentRemove = true; }
          for (let k = 0; k < 60; k++) { G.update(); Input.endFrame(); }
          if (VIA) invAdd(p.inv, BOSS_SUMMON[KEY].item, 1); else G.summonBoss(KEY, p);
          continue;
        }
        if (G.world.flags[KEY] || out.fights.length >= 2) break;
        if (VIA) break;
        if (!G.npcs.some(n => n.boss)) { p.life = p.lifeMax; G.summonBoss(KEY, p); }
      }
    }
    out.dps = Math.round(Bot.weaponDps(null).dps); out.def = p.calc.defense;
    return out;
  }, [KEY, SETS[GEAR], process.env.TRACE, !!process.env.NOPERCH, process.env.PRE || '', +process.env.REPS || 1, !!process.env.ARENA]);
  if (r.trace) { console.log(r.trace.join('\n')); delete r.trace; }
  if (process.env.TRACE) console.log((await page.evaluate(() => Bot.logLines.slice(-25))).join('\n'));
  if (r.bossHits) { console.log('tick state ai1 dashN vx vy dx dy pvx ground dir\n' + r.bossHits.join('\n')); delete r.bossHits; }
  if (r.fights.length) console.log(r.fights.map(f => `  fight@${f.t} ${f.result} taken=${Math.round(f.taken)} dur=${f.dur.toFixed(1)}s arena=${f.arena}% bossHits=${f.dashHits}`).join('\n'));
  if (r.fights.length > 2) { const F = r.fights, sum = k => F.reduce((a, f) => a + f[k], 0);
    r.summary = { n: F.length, wins: F.filter(f => f.result === 'WIN').length, deaths: F.filter(f => f.result === 'DIED').length, takenAvg: Math.round(sum('taken') / F.length), durAvg: +(sum('dur') / F.length).toFixed(1) }; delete r.fights; }
  console.log(KEY, GEAR, JSON.stringify(r));
});
