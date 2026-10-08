// Wall of Brainrot fight on a hellbridge: the wood-platform runway across Ohio's open void is written into the world at the
// site Bot.findBridge picks, the bot stands at the island's lava edge, the doll goes into the lava, and the bot fights.
// usage: node hellbridge.js [maxTicks] [every]   env: SEED, ARMOR=molten|none|gold, LIFE (400), POTS (10), GOD=1, PRE='...'
const run = require('./harness');
const { applyStage } = require('./stagelib');
const MAX = +process.argv[2] || 12000, EVERY = +process.argv[3] || 600;
run(async (page) => {
  await page.newGame(process.env.SEED || 'bot67');
  await applyStage(page, 'hell');
  if (process.env.PRE) await page.evaluate((src) => eval(src), process.env.PRE);
  if (process.env.STATS) await page.evaluate(() => { window.__stats = true; });
  const out = await page.evaluate(([MAX, EVERY, ARMOR, LIFE, POTS, GOD]) => {
    const w = G.world, p = G.player, o = [];
    for (const k of ['king_slime', 'eye_of_cthulhu', 'tung_sahur']) w.flags[k] = true;
    const B = Bot.findBridge(Bot.feet()[0]);
    if (!B) return ['no bridge site'];
    o.push('site ' + JSON.stringify(B));
    // the runway as the bot leaves it: body rows clear, a platform floor
    for (let k = 0; k <= Math.abs(B.xEnd - B.start); k++) {
      const c = B.start + B.dir * k;
      for (let r = B.y - 2; r <= B.y; r++) if (w.tile(c, r)) w.setTile(c, r, 0);
      if (!w.solid(c, B.y + 1)) w.setTile(c, B.y + 1, T.PLATFORM);
    }
    p.armor[0] = p.armor[1] = p.armor[2] = null;
    if (ARMOR === 'molten') { p.armor[0] = { id: 'molten_helmet', count: 1 }; p.armor[1] = { id: 'molten_breastplate', count: 1 }; p.armor[2] = { id: 'molten_greaves', count: 1 }; }
    if (ARMOR === 'gold') { p.armor[0] = { id: 'gold_helmet', count: 1 }; p.armor[1] = { id: 'gold_chainmail', count: 1 }; p.armor[2] = { id: 'gold_greaves', count: 1 }; }
    for (const s of p.inv) if (s && ITEMS[s.id].heal) s.count = 0;
    p.inv = p.inv.map(s => s && s.count > 0 ? s : null);
    if (POTS) invAdd(p.inv, 'lesser_healing_potion', POTS);
    p.lifeMax = LIFE; p.life = LIFE;
    p.x = B.col * TS + 6; p.y = (B.y + 1) * TS - p.h; p.vx = p.vy = 0; G.snapCamera && G.snapCamera();
    if (GOD) G.godMode = true;
    G.spawnNPC('guide', p.cx - 300, p.cy - 40);
    Bot.milestones.house = 1; Bot.houseFinished = true;
    Bot.hell = Object.assign({}, B, { ph: 'wait', bridge: true });
    Bot.needDecision = () => false; Bot.decideAct = () => {}; Bot.task = null;
    p.calc && Bot.p().calc;
    for (let i = 0; i < 60; i++) { Bot.wantsDraw = false; G.update(); Input.endFrame(); }
    o.push('def ' + p.calc.defense + ' life ' + p.life);
    G.voodooInLava({ x: (B.col - B.dir * 6) * TS, y: (B.y + 20) * TS }, p);
    let wall = G.npcs.find(n => n.type === 'wall_of_flesh');
    o.push('wall ' + !!wall + ' dir ' + (wall && wall.ai[3]));
    let minLife = p.life, deaths = 0;
    // STATS=1: life lost by source over the fight, and potions drunk
    const dmg = {}; if (window.__stats) { const h0 = p.hurt.bind(p); p.hurt = function (d, dir, src, cause, ...r) { const l0 = this.life, ok = h0(d, dir, src, cause, ...r); const k = (src && (src.name || src.type)) || cause || '?'; dmg[k] = (dmg[k] || 0) + Math.max(0, l0 - this.life); return ok; }; }
    const pots0 = Bot.potionCount();
    for (let i = 0; i < MAX; i++) {
      Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame();
      wall = G.npcs.find(n => n.type === 'wall_of_flesh');
      minLife = Math.min(minLife, p.life);
      if (i % EVERY === 0) o.push(`${i} life ${Math.round(p.life)} @${Bot.feet()} why=${Bot.why} | wall ${wall ? Math.round(wall.life) + ' x=' + Math.round(wall.x / TS) : '-'} near ${G.npcs.filter(n => !n.friendly && !n.boss && !n.town && dist(n.cx, n.cy, p.cx, p.cy) < 500).length} pots ${Bot.potionCount()}`);
      if (p.dead) { o.push('DEAD at +' + i + ' ' + G.deathCause + ' wall ' + (wall ? Math.round(wall.life) : '-') + ' x=' + Bot.feet()[0]); deaths++; break; }
      if (w.flags.wall_of_flesh) { o.push('WALL DEFEATED at +' + i + ' minLife ' + Math.round(minLife) + ' x=' + Bot.feet()[0]); break; }
      if (!wall && i > 10) { o.push('wall gone'); break; }
    }
    if (window.__stats) o.push('dmg ' + JSON.stringify(Object.fromEntries(Object.entries(dmg).map(([k, v]) => [k, Math.round(v)]))) + ' pots used ' + (pots0 - Bot.potionCount()));
    return o;
  }, [MAX, EVERY, process.env.ARMOR || 'none', +process.env.LIFE || 400, process.env.POTS != null ? +process.env.POTS : 10, !!process.env.GOD]);
  console.log(out.join('\n'));
});
