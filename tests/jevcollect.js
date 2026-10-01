// Collect TerraJev decision rollouts (state, options, choice, outcome over the next 240 ticks) for training.
// usage: node jevcollect.js <ticks> <seed> <epsilon> <out.jsonl> [sample:0|1] [stage]
//   epsilon: chance of a random allowed option (exploration); sample=1 samples from the model instead of argmax
//   stage: optional tests/stage.js preset name to start mid-game (e.g. eyefight)
const run = require('./harness');
const fs = require('fs');
const [TICKS, SEED, EPS, OUT, SAMPLE, STAGE] = [parseInt(process.argv[2] || '200000'), process.argv[3] || 'jev1', parseFloat(process.argv[4] || '0.2'), process.argv[5] || '/tmp/jev.jsonl', process.argv[6] === '1', process.argv[7]];
run(async (page, errors) => {
  await page.newGame(SEED);
  await page.evaluate(([eps, sample]) => { Bot.start(1); TerraJev.logging = true; TerraJev.epsilon = eps; TerraJev.sample = sample; }, [EPS, SAMPLE]);
  const out = fs.createWriteStream(OUT, { flags: 'a' });
  let n = 0;
  const CH = 20000;
  for (let done = 0; done < TICKS; done += CH) {
    const r = await page.evaluate((k) => {
      const W = window.__w = window.__w || { hist: [], alertedAt: -1e9 }, alerts = [];
      for (let i = 0; i < k; i++) {
        Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame();
        if (G.tick % 100) continue;   // sample every 100 game ticks; STUCK = inside a 2-tile box for 3000 ticks, not resting/hiding
        const p = G.player, s = { x: Math.floor(p.cx / TS), y: Math.floor((p.y + p.h - 1) / TS), g: Bot.goal || '' };
        W.hist.push(s); if (W.hist.length > 30) W.hist.shift();
        if (W.hist.length === 30 && !p.dead && G.tick - W.alertedAt > 3000) {
          const xs = W.hist.map(q => q.x), ys = W.hist.map(q => q.y);
          if (Math.max(...xs) - Math.min(...xs) <= 2 && Math.max(...ys) - Math.min(...ys) <= 2 && !W.hist.every(q => /^(resting|hiding|waiting|going home)/.test(q.g))) {
            W.alertedAt = G.tick; alerts.push('STUCK t=' + G.tick + ' at ' + s.x + ',' + s.y + ' goal="' + s.g + '" why=' + Bot.why + ' | ' + (Bot.logLines.slice(-2).join(' / ')));
          }
        }
      }
      const recs = TerraJev.records; TerraJev.records = [];
      return { recs, alerts, t: G.tick, bosses: TerraJev.BOSSES.filter(b => G.world.flags[b]).join('+') || '-', deaths: Bot.deaths, ms: Object.keys(Bot.milestones).length, goal: Bot.goal, life: G.player.life + '/' + G.player.lifeMax };
    }, CH);
    for (const rec of r.recs) { rec.seed = SEED; out.write(JSON.stringify(rec) + '\n'); }
    n += r.recs.length;
    for (const al of r.alerts) console.log('  !!! ' + al);
    console.log(`t=${r.t} decisions=${n} bosses=${r.bosses} deaths=${r.deaths} milestones=${r.ms} life=${r.life} | ${r.goal}`);
  }
  out.end();
});
