// Early-game timeline: when the house, stations and first metal gear are done, deaths, and where the time goes.
// usage: node early.js <ticks> <seed> [teacher|jev]   env LOG=file dumps every bot log line (with tick), SNAPAT=t1,t2 SNAPDIR=dir saves snapshots
const run = require('./harness');
const fs = require('fs');
const [TICKS, SEED, MODE] = [parseInt(process.argv[2] || '120000'), process.argv[3] || 'evalA', process.argv[4] || 'teacher'];
const SNAPAT = (process.env.SNAPAT || '').split(',').filter(Boolean).map(Number);
run(async (page) => {
  await page.newGame(SEED);
  await page.evaluate((mode) => {
    TerraJev.mode = mode; TerraJev.epsilon = 0; TerraJev.sample = false;
    Bot.start(1);
    const W = window.__e = { goal: {}, plan: {}, lines: [], marks: {}, deathsAt: {} };
    const log0 = Bot.log.bind(Bot);
    Bot.log = (m) => { W.lines.push(G.tick + ' ' + String(m).slice(0, 200)); return log0(m); };
  }, MODE);
  const CH = 6000;
  for (let done = 0; done < TICKS; done += CH) {
    const snap = SNAPAT.find(t => t > done && t <= done + CH);
    const k = snap ? snap - done : CH;
    const r = await page.evaluate((k) => {
      const W = window.__e, p = G.player;
      for (let i = 0; i < k; i++) {
        Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame();
        const M = W.marks;
        if (!M.house && Bot.houseFinished && Bot.houseValid()) M.house = G.tick;
        if (Bot.base && G.tick % 100 === 0) {
          if (!M.bench && Bot.stationPlaced('work_bench')) M.bench = G.tick;
          if (!M.furnace && Bot.stationPlaced('furnace')) M.furnace = G.tick;
          if (!M.anvil && Bot.stationPlaced('anvil')) M.anvil = G.tick;
          const own = id => Bot.owns(id);
          for (const id of ['copper_pickaxe', 'copper_broadsword', 'iron_pickaxe', 'iron_broadsword', 'iron_helmet', 'iron_chainmail', 'iron_greaves', 'the_67', 'silver_pickaxe', 'gold_pickaxe'])
            if (!M[id] && own(id)) M[id] = G.tick;
          if (!M.def5 && p.calc.defense >= 5) M.def5 = G.tick;
        }
        if (G.tick === 60000 || G.tick === 120000) W.deathsAt[G.tick] = Bot.deaths;
        if (G.tick % 50) continue;
        const g = (p.dead ? 'dead' : (Bot.goal || '-')).replace(/\d+/g, '#').replace(/\(.*?\)/g, '').trim().split(' ').slice(0, 3).join(' ');
        const key = (G.isNight() ? 'N ' : 'D ') + g; W.goal[key] = (W.goal[key] || 0) + 50;
        if (key !== W.lastKey) { W.lastKey = key; W.lines.push(G.tick + ' ~ ' + key + ' @' + Bot.feet() + ' life ' + Math.round(p.life)); }
        const pl = (Bot.plan && Bot.plan.label || '-').replace(/\(.*\)/, '').trim(); W.plan[pl] = (W.plan[pl] || 0) + 50;
      }
      return `t=${G.tick} deaths=${Bot.deaths} life=${p.life}/${p.lifeMax} def=${p.calc.defense} at=${Bot.feet()} | ${Bot.plan && Bot.plan.label} | ${Bot.goal}`;
    }, k);
    console.error(r);
    if (snap && process.env.SNAPDIR) { await page.saveSnap(process.env.SNAPDIR + '/' + SEED + '_' + snap + '.json'); console.error('snap ' + snap); done = snap - CH; }
  }
  const W = await page.evaluate(() => window.__e);
  const show = (title, o, n) => { const tot = Object.values(o).reduce((a, b) => a + b, 0); console.log('\n' + title); for (const [k, v] of Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n)) console.log(`  ${String(v).padStart(7)} ${(100 * v / tot).toFixed(1).padStart(5)}%  ${k}`); };
  show('ticks per plan step', W.plan, 12); show('ticks per goal (D=day N=night)', W.goal, 30);
  console.log('\ndeaths:'); for (const l of W.lines.filter(l => /died of/.test(l))) console.log('  ' + l.slice(0, 190));
  if (process.env.LOG) fs.writeFileSync(process.env.LOG, W.lines.join('\n'));
  console.log(`\nSUMMARY ${SEED} marks=${JSON.stringify(W.marks)} deaths60k=${W.deathsAt[60000]} deaths120k=${W.deathsAt[120000]}`);
});
