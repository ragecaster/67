// Cave-stall scan: plays the bot from a fresh world and reports every stretch where it spent a long time underground
// inside one small box (the stall detector only catches standing still; this also catches pacing, digging in circles,
// re-pathing the same pocket). For each stretch: where, how long, the goals it had and the bot log lines from then.
// usage: node tests/_stuckscan.js [ticks] [seed] [minTicks] [boxW] [boxH]
const run = require('./harness');
const TICKS = +process.argv[2] || 150000, SEED = process.argv[3] || 'evalA', MIN = +process.argv[4] || 5000;
const BW = +process.argv[5] || 30, BH = +process.argv[6] || 20;
run(async (page) => {
  await page.newGame(SEED);
  await page.evaluate(() => {
    TerraJev.mode = 'teacher'; TerraJev.epsilon = 0; TerraJev.sample = false; Bot.start(1);
    window.__s = { tr: [], logs: [] };
    const log0 = Bot.log.bind(Bot);
    Bot.log = (m) => { window.__s.logs.push([G.tick, String(m).slice(0, 140)]); return log0(m); };
  });
  const CH = 12000;
  for (let done = 0; done < TICKS; done += CH) {
    const line = await page.evaluate((k) => {
      const S = window.__s;
      for (let i = 0; i < k; i++) {
        Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame();
        if (G.tick % 100) continue;
        const [fx, fy] = Bot.feet();
        S.tr.push([G.tick, fx, fy, G.player.dead ? 'dead' : (Bot.goal || '-').replace(/\d+/g, '#').slice(0, 50), fy > G.world.worldSurface + 12 ? 1 : 0, (Bot.goal || '').slice(0, 70)]);
      }
      return `t=${G.tick} deaths=${Bot.deaths} stalls=${Bot.stalls || 0} watchdogs=${Bot.watchdogs || 0} ms=${Object.keys(Bot.milestones).slice(-3).join(',')} | ${Bot.goal}`;
    }, CH);
    console.error(line);
  }
  const S = await page.evaluate(() => ({ tr: window.__s.tr, logs: window.__s.logs, flags: Object.keys(G.world.flags).filter(k => G.world.flags[k] === true), stalls: Bot.stalls || 0, watchdogs: Bot.watchdogs || 0, deaths: Bot.deaths }));
  // greedy windows: extend while the bounding box stays within BW x BH and the bot stays underground
  const tr = S.tr, out = [];
  for (let i = 0; i < tr.length;) {
    if (!tr[i][4]) { i++; continue; }
    let x0 = tr[i][1], x1 = x0, y0 = tr[i][2], y1 = y0, j = i;
    while (j + 1 < tr.length && tr[j + 1][4]) {
      const [, x, y] = tr[j + 1];
      const nx0 = Math.min(x0, x), nx1 = Math.max(x1, x), ny0 = Math.min(y0, y), ny1 = Math.max(y1, y);
      if (nx1 - nx0 > BW || ny1 - ny0 > BH) break;
      x0 = nx0; x1 = nx1; y0 = ny0; y1 = ny1; j++;
    }
    const dur = tr[j][0] - tr[i][0];
    if (dur >= MIN) {
      const goals = {}; for (let k = i; k <= j; k++) goals[tr[k][3]] = (goals[tr[k][3]] || 0) + 100;
      const top = Object.entries(goals).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([g, v]) => v + ' ' + g);
      const logs = S.logs.filter(([t]) => t >= tr[i][0] && t <= tr[j][0]).map(([t, m]) => t + ' ' + m);
      out.push({ from: tr[i][0], to: tr[j][0], dur, box: `${x0}-${x1},${y0}-${y1}`, top, logs });
      i = j + 1;
    } else i++;
  }
  // no-progress stretches: the same "... N to go" goal text (count unchanged) for a long time, wherever the bot wandered
  const np = []; let st = null;
  for (const e of tr) {
    const m = /to go\)/.test(e[5]) ? e[5] : null;
    if (st && (m === st.g || (!m && e[0] - st.last < 3000))) { if (m) st.last = e[0]; st.x0 = Math.min(st.x0, e[1]); st.x1 = Math.max(st.x1, e[1]); st.y0 = Math.min(st.y0, e[2]); st.y1 = Math.max(st.y1, e[2]); st.ug += e[4] ? 100 : 0; continue; }
    if (st && st.last - st.from >= MIN * 3) np.push(st);
    st = m ? { g: m, from: e[0], last: e[0], x0: e[1], x1: e[1], y0: e[2], y1: e[2], ug: 0 } : null;
  }
  if (st && st.last - st.from >= MIN * 3) np.push(st);
  if (process.env.OUT) require('fs').writeFileSync(process.env.OUT, JSON.stringify(S));
  console.log(`${SEED}: ${TICKS} ticks, deaths ${S.deaths}, stalls ${S.stalls}, watchdogs ${S.watchdogs}, flags [${S.flags.join(',')}]`);
  console.log(`underground stretches >= ${MIN} ticks inside ${BW}x${BH} tiles: ${out.length}, total ${out.reduce((a, o) => a + o.dur, 0)} ticks`);
  for (const o of np) console.log(`NO PROGRESS t ${o.from}-${o.last} (${o.last - o.from} ticks, ${o.ug} underground) "${o.g}" box ${o.x0}-${o.x1},${o.y0}-${o.y1}`);
  for (const o of out) {
    console.log(`\n== t ${o.from}-${o.to} (${o.dur} ticks) box ${o.box}`);
    for (const g of o.top) console.log('   goal ' + g);
    for (const l of o.logs.slice(0, 14)) console.log('   > ' + l);
    if (o.logs.length > 14) console.log(`   > ... ${o.logs.length - 14} more`);
  }
});
