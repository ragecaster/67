// Evaluate a policy greedily (no exploration) on one fixed seed and print a score. One seed per process (bot state leaks across games).
// usage: node jeveval.js <ticks> <mode: teacher|jev> <seed> [weights.js]
//   teacher: the scripted rules only.  jev: TerraJev (weights from the file, else the built-in ones), falling back to the rules when unsure
// score = 20 per boss killed + 2 per milestone - 1 per death  (the promotion gate in tools/jev/loop.sh compares these)
const run = require('./harness');
const fs = require('fs');
const [TICKS, MODE, SEED, WFILE] = [parseInt(process.argv[2] || '60000'), process.argv[3] || 'jev', process.argv[4] || 'evalA', process.argv[5]];
const weights = WFILE ? JSON.parse(fs.readFileSync(WFILE, 'utf8').replace(/^[\s\S]*?const TERRAJEV_WEIGHTS = /, '').replace(/;\s*$/, '')) : null;
run(async (page) => {
  await page.newGame(SEED);
  await page.evaluate(([mode, w]) => {
    if (w) TerraJev.load(w);
    TerraJev.mode = mode === 'teacher' ? 'teacher' : 'jev';
    TerraJev.epsilon = 0; TerraJev.sample = false; TerraJev.logging = true; TerraJev.records = []; TerraJev.pending = [];
    Bot.start(1);
  }, [MODE, weights]);
  const r = await page.evaluate((n) => {
    for (let i = 0; i < n; i++) { Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame(); }
    const src = {};
    for (const d of TerraJev.records.concat(TerraJev.pending)) src[d.src] = (src[d.src] || 0) + 1;
    const bosses = TerraJev.BOSSES.filter(b => G.world.flags[b]).length, ms = Object.keys(Bot.milestones).length;
    return { deaths: Bot.deaths, ms, bosses, lifeMax: G.player.lifeMax, def: G.player.calc.defense, plan: Bot.plan && Bot.plan.label, src, score: 20 * bosses + 2 * ms - Bot.deaths };
  }, TICKS);
  console.log(MODE, SEED, JSON.stringify(r));
  console.log('SCORE ' + r.score);
});
