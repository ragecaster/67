// Early-game timeline: what the bot does by day and by night, and where the hours go.
// usage: node daynight.js <ticks> <seed> [every]
const run = require('./harness');
const [TICKS, SEED, EVERY] = [parseInt(process.argv[2] || '90000'), process.argv[3] || 'evalA', +process.argv[4] || 3000];
run(async (page) => {
  await page.newGame(SEED);
  await page.evaluate(() => {
    TerraJev.mode = 'teacher'; Bot.start(1);
    const W = window.__dn = { rows: [], share: {}, ev: [] }, l0 = Bot.log.bind(Bot);
    Bot.log = (m) => { m = String(m); if (/MILESTONE|died/.test(m)) W.ev.push(G.tick + ' ' + m.slice(0, 70)); return l0(m); };
  });
  for (let d = 0; d < TICKS; d += 10000) await page.evaluate(([k, E]) => {
    const W = window.__dn;
    for (let i = 0; i < k; i++) {
      Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame();
      if (G.tick % 50 === 0) { const g = (G.isNight() ? 'N ' : 'D ') + String(Bot.goal || '').replace(/[0-9(),/@:.]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 30); W.share[g] = (W.share[g] || 0) + 50; }
      if (G.tick % E === 0) { const p = G.player, [fx, fy] = Bot.feet(); W.rows.push(G.tick + (G.isNight() ? ' N ' : ' D ') + 'depth=' + (fy - G.world.worldSurface) + ' wood=' + Bot.count('wood') + ' ore cu/fe/ag/au=' + ['copper_ore', 'iron_ore', 'silver_ore', 'gold_ore'].map(o => Bot.count(o)).join('/') + ' | ' + (Bot.plan && Bot.plan.label || (Bot.planFrontier ? Bot.planFrontier(Bot.actionCandidates([])).label : '')) + ' | ' + Bot.goal); }
    }
  }, [10000, EVERY]);
  const r = await page.evaluate(() => window.__dn);
  console.log(r.rows.join('\n'));
  console.log('--- where the ticks went'); console.log(Object.entries(r.share).sort((a, b) => b[1] - a[1]).slice(0, 18).map(([k, v]) => String(v).padStart(7) + '  ' + k).join('\n'));
  console.log('--- events'); console.log(r.ev.join('\n'));
});
