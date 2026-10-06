// Ohio armor phase on its own: the hell elevator at the hellbridge site is carved down to the void's ceiling, the bot starts
// at its bottom with no armor (a furnace, an anvil and a work bench in the bag for the base), and runs taskHell's 'molten'
// phase: Ohiostone + obsidian from the ceiling slab, home, Ohioforge, bars, the set, worn.
// usage: node moltenflow.js [ticks] [every]   env: SEED, ARMOR=gold (keep the stage's gold set), PRE='...'
const run = require('./harness');
const { applyStage } = require('./stagelib');
const TICKS = +process.argv[2] || 80000, EVERY = +process.argv[3] || 4000;
run(async (page) => {
  await page.newGame(process.env.SEED || 'bot67');
  await applyStage(page, 'hell');
  if (process.env.PRE) await page.evaluate((src) => eval(src), process.env.PRE);
  await page.evaluate((a) => { window.__armor = a; }, process.env.ARMOR || 'none');
  console.log(await page.evaluate(() => {
    const w = G.world, p = G.player;
    for (const k of ['king_slime', 'eye_of_cthulhu', 'tung_sahur']) w.flags[k] = true;
    if (window.__armor !== 'gold') p.armor[0] = p.armor[1] = p.armor[2] = null;
    invAdd(p.inv, 'wood_platform', 200);
    Bot.base = Bot.feet();
    // a base like a real run's: work bench, furnace and anvil standing near home
    for (const id of ['work_bench', 'furnace', 'iron_anvil']) { const sp = Bot.findSpotAroundBase(id), t = ITEMS[id].place, td = TILES[t]; if (sp) w.placeObject(sp[0] - (td.multi ? Math.floor((td.multi[0] - 1) / 2) : 0), sp[1] - (td.multi ? td.multi[1] - 1 : 0), t); } Bot.houseSpot = Bot.feet(); Bot.houseValid = () => true; Bot.houseFinished = true; Bot.milestones.house = 1;
    let B = null; for (const L of [600, 520, 450]) { Bot.BRIDGE_LEN = L; B = Bot.findBridge(Bot.base[0]); if (B) { B.len = L; break; } }
    if (!B) return 'no site';
    const sx = B.sx, top = topSolid(w, sx);
    // the ceiling: the last solid row over a clear drop in the shaft's columns
    let R = w.hellLayer; while (R < B.y && !(w.solid(sx, R) && !w.solid(sx, R + 1) && !w.solid(sx + 1, R + 1))) R++;
    // as Bot.digShaft leaves it: 2 wide through the ceiling, a rung every 15 rows, lava beside it plugged, the rope beside the
    // hole from under the ceiling (its anchor cell solid) to over the island
    for (let y = top; y <= R; y++) for (const x of [sx, sx + 1]) { w.setTile(x, y, 0); w.liquid[w.idx(x, y)] = 0; }
    for (let y = top; y <= R; y++) for (const x of [sx - 1, sx + 2]) if (w.liq(x, y) > 0) { w.liquid[w.idx(x, y)] = 0; w.setTile(x, y, T.STONE); }
    for (let y = top + 15; y < R - 3; y += 15) for (const x of [sx, sx + 1]) w.setTile(x, y, T.PLATFORM);
    const rc = sx + 2; if (!w.solid(rc, R)) w.setTile(rc, R, T.STONE);
    for (let y = R + 1; y < B.y; y++) { w.setTile(rc, y, T.ROPE); w.setTile(rc + 1, y, 0); }
    Bot.hell = Object.assign({}, B, { bridge: true, ph: 'molten', top, R, rc, ropeEnd: B.y - 1 });
    p.x = Bot.base[0] * TS + 6; p.y = Bot.base[1] * TS - p.h + TS; p.vx = p.vy = 0; G.snapCamera && G.snapCamera();
    Bot.needDecision = () => false;
    Bot.decideAct = () => { Bot.task = Bot.taskHell(); Bot.act = { id: 'hell', kind: 'hell' }; };
    Bot.task = null;
    return 'site ' + JSON.stringify(Bot.hell) + ' needs ' + JSON.stringify(Bot.moltenNeeds());
  }));
  for (let done = 0; done < TICKS; done += EVERY) {
    const s = await page.evaluate((n) => {
      for (let i = 0; i < n; i++) {
        if (!G.player.dead && (!Bot.task || Bot.task.done) && !Bot.uiBusy) { Bot.task = Bot.taskHell(); Bot.act = { id: 'hell', kind: 'hell' }; }
        Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame();
        if (Bot.hell.ph !== 'molten' && !Bot.moltenWants().length && !window.__doneAt) window.__doneAt = G.tick;
        if (window.__doneAt && G.tick - window.__doneAt > 300) break;
      }
      const p = G.player, nl = Bot.logLines.slice(window.__seen || 0); window.__seen = Bot.logLines.length;
      return { t: G.tick, ph: Bot.hell.ph, goal: Bot.goal, feet: Bot.feet(), life: Math.round(p.life), def: p.calc.defense, hs: Bot.count('hellstone'), ob: Bot.count('obsidian'), bars: Bot.count('hellstone_bar'), wants: Bot.moltenWants().join(','), deaths: Bot.deaths, dl: (Bot.deathLog || []).slice(-2).join(' | '), logs: nl.filter(l => !/mining toward/.test(l)).slice(-12), done: !!window.__doneAt && G.tick - window.__doneAt > 300 };
    }, EVERY);
    if (process.env.DBG) console.log(await page.evaluate(() => { const w = G.world, [fx, fy] = Bot.feet(), o = []; for (let y = fy - 3; y <= fy + 3; y++) { let r = y + ':'; for (let x = fx - 3; x <= fx + 3; x++) { const t = w.tile(x, y); r += ' ' + (t ? TILES[t].name.slice(0, 5) : '.....'); } o.push(r); } return 'node ' + Nav.nodeOf(G.player) + ' feet ' + Bot.feet() + ' gnd ' + G.player.onGround + ' sx ' + Bot.hell.sx + '\n' + o.join('\n'); }));
    console.log(`t=${s.t} [${s.ph}] ${s.goal} | feet ${s.feet} life ${s.life} def ${s.def} hs ${s.hs} ob ${s.ob} bars ${s.bars} wants ${s.wants} deaths ${s.deaths} ${s.dl ? '[' + s.dl + ']' : ''}`);
    for (const l of s.logs) console.log('   > ' + l);
    if (s.done) { console.log('OHIO ARMOR DONE at ' + s.t + ' def ' + s.def); break; }
  }
});
