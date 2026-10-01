// Boss-fight analysis: run a stage until a boss shows up, then print a sample every 60 ticks (life, boss life/state, distance, what the bot does).
// usage: FORCE=taskEye node fightlog.js eyefight [maxTicks]
const run = require('./harness');
const { applyStage } = require('./stagelib');
const STAGE = process.argv[2] || 'eyefight', MAX = +process.argv[3] || 80000, FORCE = process.env.FORCE || '', START = +process.env.START || 0, STEP = +process.env.STEP || 300;
run(async (page) => {
  await page.newGame('bot67');
  await applyStage(page, STAGE);
  const out = await page.evaluate(([MAX, FORCE, START, STEP]) => {
    const o = []; let bossSince = -1;
    for (let i = 0; i < MAX; i++) {
      if (FORCE && Bot.milestones.house && (!Bot.task || Bot.task.done) && !Bot.uiBusy) { Bot.task = Bot[FORCE](); Bot.taskAge = 1; }
      Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame();
      const b = G.npcs.find(n => n.boss), p = G.player;
      if (b && bossSince < 0) bossSince = i;
      if (b && (i - bossSince) >= START && (i - bossSince) % STEP === 0) {
        o.push(`+${i - bossSince} me ${Math.round(p.life)}/${p.lifeMax} @${Bot.feet()} | ${b.name} ${Math.round(b.life)}/${b.lifeMax} ${b.state || ''} d=${Math.round(Math.hypot(b.cx - p.cx, b.cy - p.cy))} dy=${Math.round(b.cy - p.cy)} | held ${(p.inv[p.sel] || {}).id} | ${Bot.goal} | v=${(b.vx||0).toFixed(1)},${(b.vy||0).toFixed(1)} me v=${p.vx.toFixed(1)},${p.vy.toFixed(1)} keys=${Object.entries(Input.keys).filter(([k,v])=>v).map(([k])=>k).join('')} | foes ${G.npcs.filter(n => !n.boss && !n.friendly && !n.town && Math.hypot(n.cx - p.cx, n.cy - p.cy) < 300).length}`);
        if (o.length > 150) break;
      }
      if (bossSince >= 0 && !b) { o.push('boss gone after ' + (i - bossSince) + ' ticks; flags ' + JSON.stringify(G.world.flags) + ' dead=' + p.dead); break; }
    }
    o.push('deaths ' + JSON.stringify(Bot.deathLog || []));
    return o;
  }, [MAX, FORCE, START, STEP]);
  console.log(out.join('\n'));
});
