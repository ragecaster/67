// The Wall of Brainrot fought from a tunnel in the rock just above Ohio (test shortcut: the tunnel is carved into the world,
// the doll drop is simulated). The Wall only touches what's below row hellLayer-20 and its body reaches up to row hellLayer,
// so a tunnel at rows hellLayer..hellLayer+2 is in its line of fire with solid floor everywhere (no lava under a runway).
// usage: node tunnelwall.js [maxTicks] [every]     env: SEED, LIFE, FROM=-1|1 (side the doll drops on), GOD=1
const run = require('./harness');
const { applyStage } = require('./stagelib');
const MAX = +process.argv[2] || 6000, STEP = +process.argv[3] || 300;
run(async (page) => {
  await page.newGame(process.env.SEED || 'bot67');
  await applyStage(page, 'hell');
  const out = await page.evaluate(([MAX, STEP, LIFE, FROM, GOD, FROW]) => {
    const w = G.world, p = G.player, o = [];
    const F = w.hellLayer + FROW, x0 = 300, x1 = 1800, mid = 1000;   // floor row, tunnel span
    for (let x = x0; x <= x1; x++) { for (let y = F - 3; y <= F - 1; y++) w.setTile(x, y, 0); if (!w.solid(x, F)) w.setTile(x, F, T.STONE); for (let y = F - 3; y <= F - 1; y++) w.liquid[w.idx(x, y)] = 0; }
    w.setTile(x0 - 1, F - 1, T.STONE); w.setTile(x1 + 1, F - 1, T.STONE);
    p.x = mid * TS + 6; p.y = F * TS - p.h; p.vx = p.vy = 0; if (LIFE) { p.lifeMax = LIFE; p.life = LIFE; } G.snapCamera && G.snapCamera();
    if (GOD) G.godMode = true;
    G.spawnNPC('guide', p.cx, p.cy - 40);
    for (const k of ['king_slime', 'eye_of_cthulhu', 'tung_sahur']) w.flags[k] = true;
    Bot.hell = { ph: 'wait', tunnelF: F }; Bot.milestones.house = 1;
    G.voodooInLava({ x: p.cx + FROM * 96, y: 650 * TS }, p);
    let wall = G.npcs.find(n => n.type === 'wall_of_flesh');
    o.push('wall spawned: ' + !!wall + ' dir ' + (wall && wall.ai[3]) + ' at x ' + (wall && Math.round(wall.x / TS)) + ', bot x ' + mid + ', floor row ' + F);
    let dealt0 = wall ? wall.life : 0, taken = 0, last = p.life; const hits = {}; const h0 = p.hurt.bind(p); p.hurt = (d, kb, src, ...r) => { const l = p.life, ok = h0(d, kb, src, ...r); if (ok) { const k = (src && (src.type || src.name) || 'other') + (src && src.state ? ':' + src.state : ''); hits[k] = (hits[k] || 0) + Math.round(l - p.life); } return ok; };
    for (let i = 0; i < MAX; i++) {
      Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame();
      if (p.life < last) taken += last - p.life; last = p.life;
      wall = G.npcs.find(n => n.type === 'wall_of_flesh');
      if (i % STEP === 0) o.push(`${i} life ${Math.round(p.life)} @${Bot.feet()} wall ${wall ? Math.round(wall.life) + ' x=' + Math.round(wall.x / TS) + '-' + Math.round((wall.x + wall.w) / TS) + ' y=' + Math.round(wall.y / TS) : '-'} why=${Bot.why} goal=${Bot.goal}`);
      if (p.dead) { o.push('DEAD ' + G.deathCause + ' at +' + i); break; }
      if (w.flags.wall_of_flesh) { o.push('WALL DEFEATED at +' + i + ' (' + (i / 60).toFixed(1) + ' s), bot at ' + Bot.feet() + ', took ' + Math.round(taken)); break; }
      if (!wall && i > 10) { o.push('wall gone'); break; }
    }
    o.push('hits: ' + JSON.stringify(hits));
    return o;
  }, [MAX, STEP, +process.env.LIFE || 300, +process.env.FROM || -1, !!process.env.GOD, +process.env.FROW || 3]);
  console.log(out.join('\n'));
});
