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
      for (let i = 0; i < k; i++) { Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame(); }
      const recs = TerraJev.records; TerraJev.records = [];
      return { recs, t: G.tick, deaths: Bot.deaths, ms: Object.keys(Bot.milestones).length, goal: Bot.goal, life: G.player.life + '/' + G.player.lifeMax };
    }, CH);
    for (const rec of r.recs) { rec.seed = SEED; out.write(JSON.stringify(rec) + '\n'); }
    n += r.recs.length;
    console.log(`t=${r.t} decisions=${n} deaths=${r.deaths} milestones=${r.ms} life=${r.life} | ${r.goal}`);
  }
  out.end();
});
