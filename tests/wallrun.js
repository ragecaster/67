// Wall of Brainrot fight on a ready-made runway (test shortcut: the bridge is written into the world, the doll drop is simulated).
// usage: node wallrun.js [snapshot] [maxTicks] [every]      env: GOD=1 (can't die), LIFE=n
const run = require('./harness');
const { restore } = require('./snaplib');
const FILE = process.argv[2] || '/tmp/island.json', MAX = +process.argv[3] || 9000, STEP = +process.argv[4] || 120;
run(async (page) => {
  await page.newGame('bot67');
  await restore(page, FILE);
  const out = await page.evaluate(([MAX, STEP, GOD, LIFE]) => {
    const w = G.world, p = G.player, o = [], H = Bot.hell;
    window.__g = 1;
    for (let x = H.xEnd; x < H.x0; x++) { for (let y = H.y - 3; y <= H.y; y++) if (w.solid(x, y)) w.setTile(x, y, 0); w.setTile(x, H.y + 1, T.STONE); }
    H.ph = 'wait';
    p.x = H.col * TS + 6; p.y = (H.y + 1) * TS - p.h; p.vx = p.vy = 0; if (LIFE) { p.lifeMax = LIFE; p.life = LIFE; } G.snapCamera();
    if (GOD) G.godMode = true;
    G.spawnNPC('guide', p.cx, p.cy - 40);
    Bot.milestones.house = 1; Bot.task = Bot.taskHell(); Bot.task.isHell = true;
    G.voodooInLava({ x: (H.col + 6) * TS, y: 650 * TS }, p);
    let wall = G.npcs.find(n => n.type === 'wall_of_flesh');
    o.push('wall spawned: ' + !!wall + ' dir ' + (wall && wall.ai[3]) + ' x ' + (wall && Math.round(wall.x / TS)));
    for (let i = 0; i < MAX; i++) {
      if ((!Bot.task || Bot.task.done) && !Bot.uiBusy) { Bot.task = Bot.taskHell(); Bot.task.isHell = true; }
      Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame();
      wall = G.npcs.find(n => n.type === 'wall_of_flesh');
      if (i % STEP === 0 || p.dead) o.push(`${i} life ${Math.round(p.life)}/${p.lifeMax} @${Bot.feet()} g=${p.onGround} vx=${p.vx.toFixed(1)} vy=${p.vy.toFixed(1)} keys=${Object.keys(Input.keys).filter(k => Input.keys[k]).join('')} why=${Bot.why} ${Bot.goal.slice(0, 60)} | wall ${wall ? Math.round(wall.life) + ' x=' + Math.round(wall.x / TS) + ' spd ' + (1.3 + (1 - wall.life / wall.lifeMax) * 2.6).toFixed(1) : '-'} lasers ${G.projectiles.filter(q => q.type === 'eye_laser').length}`);
      if (p.dead) { o.push('DEAD ' + G.deathCause); break; }
      if (G.world.flags.wall_of_flesh) { o.push('WALL DEFEATED at +' + i + ' bot x ' + Bot.feet()); break; }
      if (!wall && i > 10) { o.push('wall gone'); break; }
    }
    return o;
  }, [MAX, STEP, !!process.env.GOD, +process.env.LIFE || 0]);
  console.log(out.join('\n'));
});
