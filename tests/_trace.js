// Replays a seed (deterministic) to tick FROM, then prints the bot's state every EVERY ticks until TO.
// usage: node _trace.js <seed> <from> <to> [every]   env: PRE='Bot.WALL_FIRST = true'
const run = require('./harness');
const [SEED, FROM, TO, EVERY] = [process.argv[2] || 'evalA', +process.argv[3] || 0, +process.argv[4] || 10000, +process.argv[5] || 300];
run(async (page) => {
  await page.newGame(SEED);
  await page.evaluate(() => { TerraJev.mode = 'teacher'; TerraJev.epsilon = 0; TerraJev.sample = false; Bot.start(1); });
  if (process.env.PRE) await page.evaluate((src) => eval(src), process.env.PRE);
  const step = (n) => page.evaluate((n) => { for (let i = 0; i < n; i++) { Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame(); } return G.tick; }, n);
  while (await page.evaluate(() => G.tick) < FROM) await step(Math.min(12000, FROM - await page.evaluate(() => G.tick)));
  await page.evaluate(() => { window.__seen = Bot.logLines.length; });
  for (let t = FROM; t < TO; t += EVERY) {
    await step(EVERY);
    const s = await page.evaluate(() => {
      const p = G.player, H = Bot.hell || {}, nl = Bot.logLines.slice(window.__seen); window.__seen = Bot.logLines.length;
      return `t=${G.tick} ph=${H.ph} feet=${Bot.feet()} life=${Math.round(p.life)}/${p.lifeMax} dead=${p.dead} rope=${!!p.onRope} gnd=${p.onGround} | ${Bot.goal} | why=${Bot.why} | dbg=${(Bot.dbg || '').slice(0, 160)} | act=${Bot.act && Bot.act.id}` + (() => { const W = G.npcs.find(n => n.type === 'wall_of_flesh'); return W ? ` WALL x=${Math.round(W.cx / TS)} life=${Math.round(W.life)} dir=${W.ai[3]}` : ''; })() + ` foes=${G.npcs.filter(n => !n.friendly && !n.town && !n.boss && !n.dead && dist(n.cx, n.cy, p.cx, p.cy) < 400).map(n => n.type).join(',')}` + nl.map(l => '\n   > ' + l.slice(0, 200)).join('');
    });
    console.log(s);
  }
  if (process.env.MXY) await page.evaluate((m) => { window.__mxy = m.split(',').map(Number); }, process.env.MXY);
  if (process.env.MAP) console.log(await page.evaluate(() => {
    const w = G.world, [fx, fy] = window.__mxy || Bot.feet(), rows = [];
    for (let y = fy - 12; y <= fy + 8; y++) { let s = ''; for (let x = fx - 30; x <= fx + 30; x++) { const t = w.tile(x, y), d = TILES[t]; const me = x === fx && y === fy; s += me ? '@' : !t ? (w.liq(x, y) > 50 ? '~' : '.') : t === T.ROPE ? '|' : w.isPlatform(x, y) ? '=' : d.solid ? '#' : 'o'; } rows.push(s + ' ' + y); }
    return rows.join('\n') + '\nH=' + JSON.stringify(Bot.hell);
  }));
});
