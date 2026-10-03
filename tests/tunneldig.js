// How fast does the bot dig the Wall tunnel (Bot.digTunnel)? Starts in a small carved pocket at row hellLayer-1 and digs
// LEN columns west (or east with DIR=1); prints progress, the time per column and what killed it if it died.
// usage: node tunneldig.js [maxTicks] [every]     env: SEED, LEN (default 120), DIR (-1), X (1000), TRENCH (4)
const run = require('./harness');
const { applyStage } = require('./stagelib');
const MAX = +process.argv[2] || 20000, STEP = +process.argv[3] || 1000;
run(async (page) => {
  await page.newGame(process.env.SEED || 'bot67');
  await applyStage(page, 'hell');
  const out = await page.evaluate(([MAX, STEP, LEN, DIR, X, D]) => {
    const w = G.world, p = G.player, o = [], F = w.hellLayer;
    for (let x = X - 1; x <= X + 1; x++) { for (let y = F - 3; y <= F - 1; y++) { w.setTile(x, y, 0); w.liquid[w.idx(x, y)] = 0; } w.setTile(x, F, T.PLATFORM); }
    p.x = X * TS + 6; p.y = F * TS - p.h; p.vx = p.vy = 0; G.snapCamera && G.snapCamera();
    invAdd(p.inv, 'wood_platform', 400);
    Bot.milestones.house = 1;
    const H = { F, dir: DIR, xEnd: X + DIR * LEN, trench: D };
    let done = false, t0 = G.tick, deaths = 0;
    const task = { step() { const r = Bot.digTunnel(H); if (r === true) { done = true; this.done = true; } else if (r && r !== false) Bot.dbg = 'digTunnel ' + r; } };
    const counts = {};
    Bot.needDecision = () => false; Bot.decideAct = () => { if (!done) { Bot.task = task; Bot.goal = 'digging the Wall tunnel'; } };
    Bot.task = task; Bot.nav = null; Bot.goal = 'digging the Wall tunnel';
    for (let i = 0; i < MAX; i++) {
      if (!p.dead && (!Bot.task || Bot.task.done) && !done) { Bot.task = task; Bot.taskAge = 1; }
      Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame();
      counts[Bot.why] = (counts[Bot.why] || 0) + 1;
      if (p.dead && !Bot.deadSeen) { deaths++; o.push('DEAD ' + G.deathCause + ' at +' + i + ' @' + Bot.feet()); }
      Bot.deadSeen = p.dead;
      const [fx] = Bot.feet();
      if (i % STEP === 0) o.push(`${i} @${Bot.feet()} cols ${DIR * (fx - X)} life ${Math.round(p.life)} why=${Bot.why} goal=${Bot.goal} dbg=${Bot.dbg}`);
      if (done) { o.push('DONE ' + LEN + ' cols at +' + i + ' (' + (i / LEN).toFixed(1) + ' ticks/col), deaths ' + deaths); break; }
    }
    if (!done) { const [fx] = Bot.feet(); o.push('NOT DONE: ' + DIR * (fx - X) + ' cols in ' + MAX + ' ticks, deaths ' + deaths); }
    o.push('why: ' + JSON.stringify(Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10)));
    return o;
  }, [MAX, STEP, +process.env.LEN || 120, +process.env.DIR || -1, +process.env.X || 1000, +process.env.TRENCH || 4]);
  console.log(out.join('\n'));
});
