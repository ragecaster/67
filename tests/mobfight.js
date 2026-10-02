// Small-fight bench: spawn one enemy next to the bot at the start of a fresh world (no other mobs), let the real Bot.tick
// decide and fight, report time to kill and damage taken. usage: node mobfight.js <npcType> [weaponId|-] [n=6] [seed] [TRACE=1]
const run = require('./harness');
const [TYPE, WEAPON, N, SEED] = [process.argv[2] || 'green_slime', process.argv[3] || '-', +(process.argv[4] || 6), process.argv[5] || 'evalC'];
run(async (page) => {
  await page.newGame(SEED);
  const out = await page.evaluate(([TYPE, WEAPON, N, TRACE, FORCE, KITE, DIST]) => {
    const p = G.player, w = G.world, o = [];
    if (WEAPON !== '-') { p.inv[9] = { id: WEAPON, count: 1 }; if (ITEMS[WEAPON].ammo) p.inv[19] = { id: 'wooden_arrow', count: 500 }; }
    TerraJev.mode = "teacher"; Bot.start(1); Bot.ignore = {};
    let killed = 0, totalT = 0, taken = 0;
    for (let k = 0; k < N; k++) {
      G.npcs = G.npcs.filter(n => n.town || n.friendly);
      p.life = p.lifeMax; w.dayTime = true; w.time = 20000;
      const side = k % 2 ? -1 : 1;
      const n = G.spawnNPC(TYPE, p.cx + side * DIST, p.y + p.h - (NPC_TYPES[TYPE].ai === 'flyer' ? 80 : 0));
      let t = 0, life0 = p.life, lastLife = p.life;
      // FORCE=1: the bot must fight it (measures the combat skill, not the decision to fight)
      if (FORCE) { Bot.needDecision = () => !Bot.task || Bot.task.done; Bot.decideAct = function () { this.setAct({ id: 'fight:' + n.uid, kind: 'fight' }, this.skillFight(n, KITE), []); }; Bot.task = null; }
      for (; t < 2400 && !n.dead && G.npcs.includes(n) && !p.dead; t++) {
        G.npcs = G.npcs.filter(m => m === n || m.town || m.friendly);
        w.dayTime = true;
        Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || t % 600 === 0) G.draw(); Input.endFrame();
        if (p.life < lastLife) taken += lastLife - p.life; lastLife = p.life;
        if (TRACE && t % 15 === 0) o.push(`  t${t} me ${Math.round(p.cx)},${Math.round(p.cy)} vx ${p.vx.toFixed(1)} ground ${p.onGround} life ${Math.round(p.life)} | mob ${Math.round(n.cx - p.cx)},${Math.round(n.cy - p.cy)} life ${Math.round(n.life)} | held ${(p.inv[p.sel] || {}).id} anim ${p.itemAnim} goal ${Bot.goal} why ${Bot.why} act ${Bot.act && Bot.act.id}`);
      }
      if (n.dead || !G.npcs.includes(n)) killed++;
      totalT += t;
      o.push(`fight ${k}: ${n.dead ? 'killed' : p.dead ? 'DIED' : 'timeout'} in ${t} ticks, life ${Math.round(life0)} -> ${Math.round(p.life)}, mob life ${Math.round(n.life)}/${n.lifeMax}`);
      if (p.dead) { for (let i = 0; i < 900 && p.dead; i++) { G.update(); Input.endFrame(); } }
    }
    o.push(`TOTAL ${TYPE} with ${WEAPON}: killed ${killed}/${N}, avg ${Math.round(totalT / N)} ticks, damage taken ${Math.round(taken)}`);
    return o;
  }, [TYPE, WEAPON, N, !!process.env.TRACE, !!process.env.FORCE, !!process.env.KITE, +(process.env.DIST || 160)]);
  console.log(out.join('\n'));
});
