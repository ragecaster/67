// A boss that comes by itself while the sky arena already exists: does the bot go up to it to fight?
// (builds the arena with a first summoned fight, then drops the bot at the house and spawns the boss directly)
const run = require('./harness');
const KEY = process.argv[2] || 'tung_sahur';
run(async (page) => {
  await page.newGame(process.env.SEED || 'evalC');
  const r = await page.evaluate(([KEY, WARN]) => {
    TerraJev.mode = 'teacher'; Bot.start(1);
    const p = G.player; p.lifeMax = p.life = 160; invAdd(p.inv, 'the_67', 1); invAdd(p.inv, 'wood', 60);
    for (let i = 0; i < 3; i++) { G.update(); Input.endFrame(); }
    Bot.base = Bot.feet(); Bot.houseSpot = Bot.feet(); Bot.houseValid = () => true;
    G.world.dayTime = false; G.world.time = 1000;
    const step = n => { for (let i = 0; i < n; i++) { Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw) G.draw(); Input.endFrame(); } };
    // build it (the summon flow builds the arena first)
    invAdd(p.inv, BOSS_SUMMON[KEY].item, 1); const tp = Bot.teacherPick.bind(Bot); Bot.teacherPick = (c, f) => f.length || !c.some(x => x.id === 'boss:' + KEY) ? tp(c, f) : 'boss:' + KEY;
    for (let i = 0; i < 300 && !(Bot.fightArena && Bot.fightArena.built); i++) step(60);
    const built = !!(Bot.fightArena && Bot.fightArena.built);
    Bot.teacherPick = tp; for (const s of p.inv) if (s && s.id === BOSS_SUMMON[KEY].item) s.count = 0;
    p.inv = p.inv.map(s => s && s.count > 0 ? s : null);
    G.npcs = G.npcs.filter(n => n.town);
    p.x = Bot.base[0] * TS; p.y = (Bot.base[1] - 2) * TS; p.vx = p.vy = 0; p.life = p.lifeMax; Bot.task = null; step(30);
    G.world.dayTime = false; G.world.time = 1000;
    if (WARN) { if (KEY === 'eye_of_cthulhu') G.eyeTimer = 1800; else { G.tungTimer = 1; G.world.time = 25200 - 1; } }
    else G.summonBoss(KEY, p);
    const hits = {}; const h0 = p.hurt.bind(p); p.hurt = (d, kb, src, ...r) => { const l = p.life, ok = h0(d, kb, src, ...r); if (ok) { const k = (src && src.type || 'other:' + (r[0] || '')) + '@' + (Bot.onSkyArena() ? 'arena' : 'off'); hits[k] = (hits[k] || 0) + Math.round(l - p.life); } return ok; };
    let upAt = -1; const t0 = G.tick;
    const tr = []; for (let i = 0; i < 6000; i++) { step(1); if (i % 60 === 0) tr.push(i + ' ' + Bot.feet() + ' why=' + Bot.why + ' goal=' + Bot.goal + ' act=' + (Bot.act && Bot.act.id) + ' life=' + Math.round(p.life) + ' px=' + p.cx.toFixed(0) + ' gnd=' + p.onGround + ' keys=' + Object.keys(Input.keys).filter(k => Input.keys[k]) + ' nav=' + (Bot.nav ? (Bot.nav.path.length + '/' + Bot.nav.i + ' cd' + (Bot.nav.cooldown - G.tick)) : '-') + ' rw=' + Bot.replanWhy + ' perch=' + Bot.perch + (G.npcs.find(n => n.boss) ? ' BOSS=' + Math.floor(G.npcs.find(n => n.boss).cx / 16) + ',' + Math.floor((G.npcs.find(n => n.boss).y + G.npcs.find(n => n.boss).h) / 16) + ' ' + G.npcs.find(n => n.boss).state : '')); const b = G.npcs.find(n => n.boss); if (upAt < 0 && Bot.onSkyArena()) upAt = G.tick - t0; if ((!b && i > 2000) || p.dead) break; }
    return { hits, tr, built, reachedArenaAfter: upAt, result: G.world.flags[KEY] ? 'WIN' : p.dead ? 'DIED' : 'ongoing', life: Math.round(p.life), arenaAt: Bot.fightArena && Bot.fightArena.slice(0, 3).join(','), base: Bot.base.join(',') };
  }, [KEY, !!process.env.WARN]);
  console.log(r.tr.join('\n')); delete r.tr; console.log(KEY, JSON.stringify(r));
});
