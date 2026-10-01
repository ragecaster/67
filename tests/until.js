// usage: node until.js "<log pattern>" [maxTicks] [seed] [radius]
// Runs the bot until a log line matches, then dumps an ASCII map around the player and the base plus bot state.
// (@ player, S station, D door, # solid, w wall, o other object, ~ liquid)
const run = require('./harness');
const PAT = process.argv[2], MAX = +process.argv[3] || 100000, SEED = process.argv[4] || 'bot67', R = +process.argv[5] || 30;
run(async (page) => {
  await page.newGame(SEED);
  await page.evaluate(() => { Bot.start(1); });
  for (let done = 0; done < MAX; done += 5000) {
    const r = await page.evaluate(([pat, n, R]) => {
      for (let i = 0; i < n; i++) {
        Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame();
        if (Bot.logLines.some(l => l.includes(pat))) {
          const w = G.world, p = G.player, [fx, fy] = Bot.feet();
          const map = (cx, cy) => { const rows = []; for (let y = cy - 12; y <= cy + 8; y++) { let s = ''; for (let x = cx - R; x <= cx + R; x++) { const t = w.tile(x, y), d = TILES[t]; const me = x >= fx && x <= fx + 1 && y > fy - 3 && y <= fy; s += me ? '@' : !t ? (w.liq(x, y) > 50 ? '~' : w.wall(x, y) ? 'w' : '.') : d.door ? 'D' : d.station ? 'S' : d.solid ? '#' : 'o'; } rows.push(s + ' ' + y); } return rows.join('\n') + '\n  x0=' + (cx - R); };
          const [bx, by] = Bot.base; const probe = []; { const hf = (x, y) => Math.abs(x + 0.5 - bx) + (y > by ? (y - by) * 6 : (by - y) * 2); for (const budget of [90000, 300000, 600000]) { const t0 = performance.now(); const res = Nav.plan(fx, fy, (x, y) => Math.abs(x + 0.5 - bx) <= 2.5 && Math.abs(y - by) <= 2, hf, budget); const last = res.path[res.path.length - 1]; probe.push('direct budget ' + budget + ': len ' + res.path.length + ' reached ' + res.reached + ' exp ' + res.expanded + ' last ' + (last ? last.x + ',' + last.y : '-') + ' ' + Math.round(performance.now() - t0) + 'ms first ' + res.path.slice(0, 4).map(q => q.move.t + '@' + q.x + ',' + q.y).join(' ')); if (res.reached) break; } }
          const line = []; for (const tx of [fx - 28, fx - 29, fx - 32, fx - 36]) { const ty = Nav.rawSurf(tx) - 1; const t0 = performance.now(); const res = Nav.plan(fx, fy, (x, y) => Math.abs(x + 0.5 - tx) <= 1.5 && Math.abs(y - ty) <= 2, (x, y) => Math.abs(x + 0.5 - tx) + (y > ty ? (y - ty) * 6 : (ty - y) * 2), 60000); const lst = res.path[res.path.length - 1]; line.push('last ' + (lst ? lst.x + ',' + lst.y : '-') + ' ' + tx + ',' + ty + ':' + (res.reached ? 'ok' : 'NO') + ' exp' + res.expanded + ' len' + res.path.length + ' ' + Math.round(performance.now() - t0) + 'ms'); }
          return { found: true, line, surf: (() => { const o = []; for (let x = fx - 8; x <= fx + 8; x += 2) o.push(x + ':' + Nav.surfAt(x) + '/' + topSolid(w, x)); return o.join(' '); })(), probe, power: Nav.pickPower(), tick: G.tick, feet: [fx, fy], base: Bot.base, house: Bot.houseSpot, goal: Bot.goal, log: Bot.logLines.slice(-8), mapPlayer: map(fx, fy), mapBase: map(Bot.base[0], Bot.base[1]), inv: p.inv.filter(Boolean).map(s => s.id + ':' + s.count).join(' ') };
        }
      }
      return { found: false };
    }, [PAT, 5000, R]);
    if (r.found) { console.log(JSON.stringify({ ...r, mapPlayer: undefined, mapBase: undefined })); console.log('--- around player'); console.log(r.mapPlayer); console.log('--- around base'); console.log(r.mapBase); return; }
  }
  console.log('pattern not seen');
});
