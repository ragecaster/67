// Run the bot (TerraJev or rules) and sample it every 100 game ticks. Flags STUCK when the player stays inside a
// 2-tile box for 3000 ticks without deliberately resting/hiding, and dumps the surroundings + nav plan.
// usage: node jevwatch.js <ticks> <seed> <mode: jev|rules> <trace.log>
const run = require('./harness');
const fs = require('fs');
const [TICKS, SEED, MODE, TRACE] = [parseInt(process.argv[2] || '200000'), process.argv[3] || 'watchA', process.argv[4] || 'jev', process.argv[5] || '/tmp/jevwatch.log'];
run(async (page) => {
  await page.newGame(SEED);
  await page.evaluate((mode) => { if (mode === 'rules') TerraJev.ready = false; TerraJev.logging = true; Bot.start(1); }, MODE);
  const trace = fs.createWriteStream(TRACE);
  const CH = 5000;
  for (let done = 0; done < TICKS; done += CH) {
    const r = await page.evaluate((k) => {
      const samples = [], alerts = [];
      const W = window.__watch = window.__watch || { hist: [], alertedAt: -1e9 };
      for (let i = 0; i < k; i++) {
        Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame();
        if (G.tick % 100) continue;
        const p = G.player, fx = Math.floor(p.cx / TS), fy = Math.floor((p.y + p.h - 1) / TS);
        const t = Bot.act;
        const s = { t: G.tick, x: fx, y: fy, life: Math.round(p.life) + '/' + p.lifeMax, dead: p.dead, goal: Bot.goal, why: Bot.why, jev: t ? t.id : '', deaths: Bot.deaths };
        samples.push(s);
        W.hist.push(s); if (W.hist.length > 30) W.hist.shift();
        const h = W.hist;
        if (h.length === 30 && !p.dead && G.tick - W.alertedAt > 3000) {
          const xs = h.map(q => q.x), ys = h.map(q => q.y);
          const still = Math.max(...xs) - Math.min(...xs) <= 2 && Math.max(...ys) - Math.min(...ys) <= 2;
          const deliberate = h.every(q => /^(resting|hiding|waiting|jev:rest|jev:shelter)/.test(q.goal) || /jev:(rest|shelter)/.test(q.why));
          if (still && !deliberate) {
            W.alertedAt = G.tick;
            const rows = [];
            for (let y = fy - 6; y <= fy + 4; y++) { let line = ''; for (let x = fx - 12; x <= fx + 12; x++) { const tt = G.world.tile(x, y); line += (x === fx && (y === fy || y === fy - 1 || y === fy - 2)) ? '@' : G.world.liq(x, y) > 50 ? (G.world.ltype[G.world.idx(x, y)] ? 'L' : '~') : !tt ? '.' : TILES[tt].solid ? '#' : TILES[tt].tree ? 'T' : '+'; } rows.push(line); }
            const nav = Bot.nav && Bot.nav.path ? Bot.nav.path.slice(Bot.nav.i, Bot.nav.i + 4).map(q => q.move.t + '@' + q.x + ',' + q.y).join(' ') : '-';
            alerts.push({ t: G.tick, at: fx + ',' + fy, goal: Bot.goal, why: Bot.why, nav, recentLog: Bot.logLines.slice(-4), map: rows });
          }
        }
      }
      return { samples, alerts, ms: Object.keys(Bot.milestones), deaths: Bot.deaths };
    }, CH);
    for (const s of r.samples) trace.write(JSON.stringify(s) + '\n');
    const last = r.samples[r.samples.length - 1];
    const jevs = r.samples.map(s => s.jev).filter(Boolean), counts = {};
    for (const j of jevs) counts[j] = (counts[j] || 0) + 1;
    console.log(`t=${last.t} @${last.x},${last.y} life ${last.life} deaths ${r.deaths} | ${last.goal} | jev ${JSON.stringify(counts)} | ms ${r.ms.length}`);
    for (const a of r.alerts) {
      console.log(`  !!! STUCK at t=${a.t} ${a.at} goal="${a.goal}" why=${a.why} nav=${a.nav}`);
      for (const l of a.recentLog) console.log('      log: ' + l);
      for (const row of a.map) console.log('      ' + row);
    }
  }
  console.log('MILESTONES: ' + JSON.stringify(await page.evaluate(() => Bot.milestones)));
  trace.end();
});
