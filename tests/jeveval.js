// Compare policies on the same seeds: the old rules (no weights) vs TerraJev (trained weights).
// usage: node jeveval.js <ticks> <mode: rules|jev> <seed1,seed2,...>
const run = require('./harness');
const [TICKS, MODE, SEEDS] = [parseInt(process.argv[2] || '200000'), process.argv[3] || 'jev', (process.argv[4] || 'evalA').split(',')];
run(async (page) => {
  const res = [];
  for (const seed of SEEDS) {
    await page.newGame(seed);
    await page.evaluate((mode) => {
      if (mode === 'rules') { TerraJev.ready = false; } else if (!TerraJev.ready) throw new Error('no weights loaded');
      TerraJev.epsilon = 0; TerraJev.sample = false; TerraJev.logging = true; TerraJev.records = []; TerraJev.pending = [];
      TerraJev.counters = { dmgTaken: 0, dmgDealt: 0, bossDealt: 0, kills: 0, deaths: 0, value: 0 };
      Bot.deaths = 0; Bot.milestones = {}; Bot.start(1);
    }, MODE);
    const r = await page.evaluate((n) => {
      for (let i = 0; i < n; i++) { Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame(); }
      const c = TerraJev.counters, picks = {};
      for (const d of TerraJev.records) { const o = d.cands[d.chosen]; picks[o] = (picks[o] || 0) + 1; }
      return { deaths: Bot.deaths, taken: Math.round(c.dmgTaken), dealt: Math.round(c.dealt || c.dmgDealt), kills: G.player.stats.kills, ms: Object.keys(Bot.milestones).length, lifeMax: G.player.lifeMax, bosses: Object.entries(G.world.flags).filter(([k, v]) => v && k !== 'bloodMoon').map(([k]) => k).join(','), picks };
    }, TICKS);
    console.log(MODE, seed, JSON.stringify(r));
    res.push(r);
  }
  const sum = k => res.reduce((a, r) => a + r[k], 0);
  console.log(`TOTAL ${MODE}: deaths ${sum('deaths')} taken ${sum('taken')} kills ${sum('kills')} milestones ${sum('ms')} over ${SEEDS.length} x ${TICKS} ticks`);
});
