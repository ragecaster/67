// Boss-rush timeline: how many ticks until each boss dies, and how long the bot spends on each plan step.
// usage: node bosstime.js <ticks> <seed> [teacher|jev] [weights.js]   (60 ticks = 1 s of real-time play; 216000 = 1 hour)
const run = require('./harness');
const fs = require('fs');
const [TICKS, SEED, MODE, WFILE] = [parseInt(process.argv[2] || '216000'), process.argv[3] || 'evalA', process.argv[4] || 'jev', process.argv[5]];
const weights = WFILE ? JSON.parse(fs.readFileSync(WFILE, 'utf8').replace(/^[\s\S]*?const TERRAJEV_WEIGHTS = /, '').replace(/;\s*$/, '')) : null;
run(async (page) => {
  await page.newGame(SEED);
  await page.evaluate(([mode, w]) => {
    if (w) TerraJev.load(w);
    TerraJev.mode = mode; TerraJev.epsilon = 0; TerraJev.sample = false;
    Bot.start(1);
    const W = window.__b = { plan: {}, goal: {}, kills: {}, events: [], lastPlan: '' };
    const log0 = Bot.log.bind(Bot);
    Bot.log = (m) => { m = String(m); if (/MILESTONE|died of|defeated|summon|watchdog/.test(m)) W.events.push(G.tick + ' ' + m.slice(0, 110)); return log0(m); };
  }, [MODE, weights]);
  if (process.env.PRE) await page.evaluate((src) => eval(src), process.env.PRE);   // PRE='Bot.x = 1': settings for an A/B run
  const CH = 12000;
  let r;
  for (let done = 0; done < TICKS; done += CH) {
    r = await page.evaluate((k) => {
      const W = window.__b;
      for (let i = 0; i < k; i++) {
        Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame();
        for (const b of TerraJev.BOSSES) if (G.world.flags[b] && !W.kills[b]) { W.kills[b] = G.tick; W.events.push(G.tick + ' *** KILLED ' + b); }
        if (G.tick % 50) continue;
        // trips: every crossing between the surface and the underground (with what it was for)
        { const fy = Bot.feet()[1], z = G.player.dead ? W.zone : fy < G.world.worldSurface + 12 ? 'up' : 'down';
          if (z !== W.zone) { W.trips = W.trips || []; W.trips.push(G.tick + (G.isNight() ? ' N ' : ' D ') + (W.zone || '?') + '->' + z + ' | ' + (Bot.goal || '').slice(0, 70)); W.zone = z; } }
        const pl = (Bot.plan && Bot.plan.label || '-').replace(/\(.*\)/, '').trim();
        W.plan[pl] = (W.plan[pl] || 0) + 50;
        const g = (G.player.dead ? 'dead' : (Bot.goal || '-')).replace(/\d+/g, '#').replace(/\(.*?\)/g, '').trim().split(' ').slice(0, 3).join(' ');
        const key = (G.isNight() ? 'N ' : 'D ') + g; W.goal[key] = (W.goal[key] || 0) + 50;
      }
      const p = G.player;
      return { t: G.tick, n: Object.keys(W.kills).length, line: `t=${G.tick} day=${Math.floor(G.tick / 60000)} deaths=${Bot.deaths} life=${p.lifeMax} def=${p.calc.defense} pots=${Bot.potionCount()} hook=${Bot.owns('grappling_hook') ? 'G' : Bot.owns('hook') ? 'h' : '-'} dps=${Math.round(Bot.weaponDps(null).dps)} bosses=${Object.keys(W.kills).join('+') || '-'} | ${Bot.plan && Bot.plan.label} | ${Bot.goal}` };
    }, CH);
    console.error(r.line);
    if (r.n >= (+process.env.NEED || 4)) break;   // NEED=3: stop after the first three (the old metric)
  }
  const W = await page.evaluate(() => window.__b);
  const show = (title, o, n) => { const tot = Object.values(o).reduce((a, b) => a + b, 0); console.log('\n' + title); for (const [k, v] of Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n)) console.log(`  ${String(v).padStart(7)} ${(100 * v / tot).toFixed(1).padStart(5)}%  ${k}`); };
  console.log(r.line);
  show('ticks per plan step', W.plan, 20); show('ticks per goal (D=day N=night)', W.goal, 25);
  if (process.env.TRIPS) { console.log('\ntrips:'); for (const e of W.trips || []) console.log('  ' + e); }
  console.log('\nevents:'); for (const e of W.events.slice(-60)) console.log('  ' + e);
  const k = Object.values(W.kills).sort((a, b) => a - b);
  console.log(`\nBOSSES ${k.length} ${JSON.stringify(W.kills)} third=${k[2] || 'none'} fourth=${k[3] || 'none'}`);
});
