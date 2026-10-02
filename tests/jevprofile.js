// Where does the bot's time go, as you'd see it watching? Plays the current TerraJev model greedily (like ?bot in the
// browser), samples the on-screen goal every 50 ticks, and counts why it fell back to 'exploring'.
// usage: node jevprofile.js <ticks> <seed> [teacher|jev]
const run = require('./harness');
const [TICKS, SEED, MODE] = [parseInt(process.argv[2] || '150000'), process.argv[3] || 'evalA', process.argv[4] || 'jev'];
run(async (page) => {
  await page.newGame(SEED);
  await page.evaluate((mode) => {
    TerraJev.mode = mode; TerraJev.epsilon = 0; TerraJev.sample = false;
    Bot.start(1);
    const W = window.__p = { goal: {}, act: {}, night: {}, logs: {}, crystals: [] };
    const log0 = Bot.log.bind(Bot);
    Bot.log = (m) => { const k = String(m).replace(/\d+/g, '#').replace(/"[^"]*"/g, '"…"').slice(0, 60); W.logs[k] = (W.logs[k] || 0) + 1; return log0(m); };
  }, MODE);
  const CH = 25000;
  for (let done = 0; done < TICKS; done += CH) {
    const r = await page.evaluate((k) => {
      const W = window.__p;
      for (let i = 0; i < k; i++) {
        Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame();
        if (G.tick % 50) continue;
        const g = (G.player.dead ? 'dead' : (Bot.goal || '-')).replace(/\d+/g, '#').replace(/\(.*?\)/g, '').trim().split(' ').slice(0, 3).join(' ');
        const a = Bot.act ? Bot.act.kind + (Bot.choiceSrc === 'teacher' ? '(rules)' : '') : '-';
        W.goal[g] = (W.goal[g] || 0) + 1; W.act[a] = (W.act[a] || 0) + 1;
        if (G.isNight()) W.night[g] = (W.night[g] || 0) + 1;
        if (G.tick % 25000 === 0) W.crystals.push(G.player.lifeMax);
      }
      return { t: G.tick, deaths: Bot.deaths, life: G.player.lifeMax, goal: Bot.goal };
    }, CH);
    console.error(`t=${r.t} deaths=${r.deaths} lifeMax=${r.life} | ${r.goal}`);
  }
  const W = await page.evaluate(() => window.__p);
  const show = (title, o, n = 18) => {
    const tot = Object.values(o).reduce((a, b) => a + b, 0);
    console.log('\n' + title + ` (${tot} samples)`);
    for (const [k, v] of Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n)) console.log(`  ${(100 * v / tot).toFixed(1).padStart(5)}%  ${k}`);
  };
  show('on-screen goal', W.goal, 25); show('action kind (who chose it)', W.act); show('goal at night', W.night, 10);
  show('log lines (counts)', W.logs, 25);
  console.log('\nlifeMax every 25k ticks: ' + W.crystals.join(' '));
});
