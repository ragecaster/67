// Grappling-hook navigation: the bot climbs out of a carved pit (PIT=depth) or walks home from a deep cave spot (CAVE=1), with
// HOOK=1 (a grappling hook in the bag) or without (platform pillars / ladders). Prints ticks, moves used and deaths.
// usage: node hooknav.js [maxTicks]   env: SEED, HOOK, PIT (default 30), CAVE=1, X (column), PLAT (platforms given, default 40)
const run = require('./harness');
const { applyStage } = require('./stagelib');
const MAX = +process.argv[2] || 6000;
run(async (page) => {
  await page.newGame(process.env.SEED || 'bot67');
  await applyStage(page, 'gold');
  const env = { HOOK: !!process.env.HOOK, PIT: +process.env.PIT || 30, CAVE: !!process.env.CAVE, X: +process.env.X || 0, GOD: !!process.env.GOD, TRACE: +process.env.TRACE || 0, PLANS: +process.env.PLANS || 4, PLAT: process.env.PLAT == null ? 40 : +process.env.PLAT };
  console.log(await page.evaluate(([env, MAX]) => {
    const w = G.world, p = G.player, o = [];
    // only the bag we choose: no dirt/stone/wood to pillar with
    for (let i = 0; i < p.inv.length; i++) if (p.inv[i] && ['dirt_block', 'stone_block', 'wood', 'wood_platform', 'clay_block', 'mud_block', 'sand_block', 'ash_block'].includes(p.inv[i].id)) p.inv[i] = null;
    if (env.PLAT) invAdd(p.inv, 'wood_platform', env.PLAT);
    if (env.HOOK) invAdd(p.inv, 'grappling_hook', 1);
    Bot.milestones.house = 1; Bot.houseFinished = true;
    let sx, sy, tx, ty;
    if (env.CAVE) {
      // a deep open cave cell ~60-120 rows down near the spawn
      const x0 = env.X || Math.floor(p.cx / TS);
      outer: for (let dy = 60; dy < 140; dy++) for (let dx = -60; dx <= 60; dx++) { const x = x0 + dx, y = topSolid(w, x0) + dy; if (Nav.standable(x, y) && Nav.space(x, y)[0] === 0) { sx = x; sy = y; break outer; } }
      tx = x0; ty = topSolid(w, x0) - 1;
    } else {
      const x0 = env.X || Math.floor(p.cx / TS) + 30, top = topSolid(w, x0);
      for (let y = top - 3; y <= top + env.PIT; y++) for (let x = x0; x <= x0 + 2; x++) { w.setTile(x, y, 0); w.liquid[w.idx(x, y)] = 0; }
      for (let x = x0 - 1; x <= x0 + 3; x++) if (!w.solid(x, top + env.PIT + 1)) w.setTile(x, top + env.PIT + 1, T.STONE);
      sx = x0; sy = top + env.PIT; tx = x0 + 6; ty = topSolid(w, x0 + 6) - 1;
    }
    p.x = sx * TS + 16 - p.w / 2; p.y = (sy + 1) * TS - p.h; p.vx = p.vy = 0; G.snapCamera && G.snapCamera();
    o.push('from ' + sx + ',' + sy + ' to ' + tx + ',' + ty + ' hook ' + p.hasHook() + ' platforms ' + Bot.count('wood_platform'));
    const moves = {}; let t, deaths = 0, throws = 0;
    G.godMode = env.GOD; const tr = [];
    const task = { step() { const r = Bot.moveTo(tx, ty, 2); if (r === true) this.done = true; } };
    Bot.needDecision = () => false; Bot.decideAct = () => { Bot.task = task; Bot.goal = 'nav test'; };
    Bot.task = task;
    const e0 = p.throwHook.bind(p); p.throwHook = () => { throws++; return e0(); };
    for (t = 0; t < MAX; t++) {
      if (!Bot.task || Bot.task.done) { if (task.done) break; Bot.task = task; }
      Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame();
      const n = Bot.nav && Bot.nav.path && Bot.nav.path[Bot.nav.i]; if (n) moves[n.move.t] = (moves[n.move.t] || 0) + 1;
      if (env.TRACE && t < env.TRACE) { const h = p.hook; tr.push(t + ' p=' + Math.round(p.cx) + ',' + Math.round(p.y + p.h) + ' node=' + Nav.nodeOf(p) + ' v=' + p.vx.toFixed(1) + ',' + p.vy.toFixed(1) + ' gnd=' + p.onGround + ' hook=' + (h ? h.state + '@' + Math.floor(h.x / TS) + ',' + Math.floor(h.y / TS) : '-') + ' step=' + (n ? Bot.nav.i + ':' + n.move.t + '->' + n.x + ',' + n.y + (n.move.ax != null ? ' a' + n.move.ax + ',' + n.move.ay : '') : '-') + ' why=' + Bot.replanWhy); }
      if (p.dead) { deaths++; o.push('DIED ' + G.deathCause + ' at +' + t); break; }
    }
    const [fx, fy] = Bot.feet();
    o.push((task.done ? 'ARRIVED' : 'NOT ARRIVED') + ' in ' + t + ' ticks at ' + fx + ',' + fy + '; hook throws ' + throws + '; platforms left ' + Bot.count('wood_platform') + '; move ticks ' + JSON.stringify(moves));
    if (tr.length) o.push(tr.join('\n'));
    o.push('plans: ' + (Bot.planLog || []).slice(-(env.PLANS || 4)).join('\n  '));
    return o.join('\n');
  }, [env, MAX]));
});
