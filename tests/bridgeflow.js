// The Wall plan's last leg on its own: Ohio armor and the skull already worn, the hell elevator at the hellbridge site carved
// (rope to the island), the Guide at home; the bot rides down, builds the platform runway, hunts a Voodoo Demon's doll,
// throws it and fights the Wall. Prints the ticks each phase took.
// usage: node bridgeflow.js [ticks] [every]   env: SEED, ARMOR=molten|none, LIFE (400), POTS (10), PRE='...'
const run = require('./harness');
const { applyStage } = require('./stagelib');
const TICKS = +process.argv[2] || 80000, EVERY = +process.argv[3] || 4000;
run(async (page) => {
  await page.newGame(process.env.SEED || 'bot67');
  await applyStage(page, 'hell');
  if (process.env.PRE) await page.evaluate((src) => eval(src), process.env.PRE);
  await page.evaluate(([a, l, pt]) => { window.__armor = a; window.__life = l; window.__pots = pt; }, [process.env.ARMOR || 'molten', +process.env.LIFE || 400, process.env.POTS != null ? +process.env.POTS : 10]);
  console.log(await page.evaluate(() => {
    const w = G.world, p = G.player;
    for (const k of ['king_slime', 'eye_of_cthulhu', 'tung_sahur']) w.flags[k] = true;
    p.armor[0] = p.armor[1] = p.armor[2] = null;
    if (window.__armor === 'molten') { p.armor[0] = { id: 'molten_helmet', count: 1 }; p.armor[1] = { id: 'molten_breastplate', count: 1 }; p.armor[2] = { id: 'molten_greaves', count: 1 }; p.acc[0] = { id: 'obsidian_skull', count: 1 }; }
    p.lifeMax = window.__life; p.life = window.__life;
    for (const s2 of p.inv) if (s2 && ITEMS[s2.id].heal) s2.count = 0;
    p.inv = p.inv.map(s2 => s2 && s2.count > 0 ? s2 : null); invAdd(p.inv, 'lesser_healing_potion', window.__pots); invAdd(p.inv, 'wood_platform', 700);
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
    Bot.hell = Object.assign({}, B, { bridge: true, ph: 'ride', top, R, rc, ropeEnd: B.y - 1, moltenSkip: true });
    G.spawnNPC('guide', Bot.base[0] * TS, (Bot.base[1] - 3) * TS);
    p.x = Bot.base[0] * TS + 6; p.y = Bot.base[1] * TS - p.h + TS; p.vx = p.vy = 0; G.snapCamera && G.snapCamera();
    Bot.needDecision = () => false;
    Bot.decideAct = () => { Bot.task = Bot.taskHell(); Bot.act = { id: 'hell', kind: 'hell' }; };
    Bot.task = null;
    return 'site ' + JSON.stringify(Bot.hell) + ' def ' + p.calc.defense;
  }));
  if (process.env.STATS) await page.evaluate(() => {
    const S = window.__st = { dmg: {}, shots: 0, foes: 0, n: 0 };
    const h0 = G.player.hurt.bind(G.player);
    G.player.hurt = function (d, dir, src, cause, ...r) { const l0 = this.life, ok = h0(d, dir, src, cause, ...r); const k = (src && src.name) || cause || '?'; S.dmg[k] = (S.dmg[k] || 0) + Math.max(0, l0 - this.life); return ok; };
    const sp0 = G.spawnProjectile.bind(G);
    G.spawnProjectile = function (type, x, y, vx, vy, dmg, kb, owner, o) { if (owner === G.player) S.shots++; return sp0(type, x, y, vx, vy, dmg, kb, owner, o); };
  });
  for (let done = 0; done < TICKS; done += EVERY) {
    const s = await page.evaluate((n) => {
      const ph = window.__ph = window.__ph || {};
      for (let i = 0; i < n; i++) {
        if (!G.player.dead && (!Bot.task || Bot.task.done) && !Bot.uiBusy) { Bot.task = Bot.taskHell(); Bot.act = { id: 'hell', kind: 'hell' }; }
        Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame();
        const k = G.npcs.some(m => m.type === 'wall_of_flesh') ? 'fight' : Bot.hell.ph; ph[k] = (ph[k] || 0) + 1;
        if (G.world.flags.wall_of_flesh) break;
      }
      const p = G.player, nl = Bot.logLines.slice(window.__seen || 0); window.__seen = Bot.logLines.length;
      const wall = G.npcs.find(m => m.type === 'wall_of_flesh');
      if (window.__st) { const S = window.__st, P = G.player; S.foes += G.npcs.filter(m => !m.friendly && !m.town && !m.dead && dist(m.cx, m.cy, P.cx, P.cy) < 400).length; S.n++; }
      const st = window.__st ? JSON.stringify(Object.assign({}, window.__st, { foes: (window.__st.foes / Math.max(1, window.__st.n)).toFixed(1) })) : '';
      if (window.__st) window.__st = Object.assign(window.__st, { dmg: {}, shots: 0, foes: 0, n: 0 });
      return { st, t: G.tick, ph: Bot.hell.ph, goal: Bot.goal, feet: Bot.feet(), life: Math.round(p.life), def: p.calc.defense, wall: wall ? Math.round(wall.life) : '-', deaths: Bot.deaths, dl: (Bot.deathLog || []).slice(-2).join(' | '), logs: nl.filter(l => !/mining toward|giving up on target/.test(l)).slice(-10), won: !!G.world.flags.wall_of_flesh, phases: JSON.stringify(ph) };
    }, EVERY);
    if (process.env.DBG) console.log(await page.evaluate(() => { const w = G.world, p = G.player, [fx, fy] = Bot.feet(), o = []; for (let y = fy - 3; y <= fy + 5; y++) { let r = y + ':'; for (let x = fx - 4; x <= fx + 4; x++) { const t = w.tile(x, y); r += ' ' + (t ? TILES[t].name.slice(0, 5).padEnd(5) : (w.liq(x, y) ? 'liq' + w.liq(x, y) : '.....')); } o.push(r); } return 'feet ' + Bot.feet() + ' cx ' + p.cx.toFixed(1) + ' y ' + p.y.toFixed(1) + ' onRope ' + p.onRope + ' gnd ' + p.onGround + ' vy ' + p.vy.toFixed(2) + ' keys ' + Object.keys(Input.keys).filter(k => Input.keys[k]) + ' ropeStuck ' + Bot.ropeStuck + ' dbg ' + Bot.dbg + '\n' + o.join('\n'); }));
    console.log(`t=${s.t} [${s.ph}] ${s.goal} | feet ${s.feet} life ${s.life} def ${s.def} wall ${s.wall} deaths ${s.deaths} ${s.dl ? '[' + s.dl + ']' : ''}`);
    if (s.st) console.log('   stats ' + s.st);
    for (const l of s.logs) console.log('   > ' + l);
    if (s.won) { console.log('WALL DEFEATED at ' + s.t + ' phases ' + s.phases); break; }
    if (done + EVERY >= TICKS) console.log('NOT DEFEATED phases ' + s.phases);
  }
});
