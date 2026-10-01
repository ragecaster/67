// Wall of Brainrot fight test: drop the bot on the underworld cavern floor, spawn the Wall like G.voodooInLava does, report.
const run = require('./harness');
const { applyStage } = require('./stagelib');
run(async (page) => {
  await page.newGame('bot67');
  await applyStage(page, 'hell');
  console.log(await page.evaluate(() => {
    const p = G.player, w = G.world, o = [];
    // find a standable cavern spot at x=1190, y 626..660
    let sx = 1190, sy = -1; for (let y = 624; y < 664; y++) if (!w.solid(sx, y) && !w.solid(sx + 1, y) && !w.solid(sx, y - 1) && !w.solid(sx, y - 2) && (w.solid(sx, y + 1) || w.solid(sx + 1, y + 1))) { sy = y; break; }
    o.push('spot ' + sx + ',' + sy);
    p.x = sx * TS + 6; p.y = (sy + 1) * TS - p.h; p.vx = p.vy = 0; p.lifeMax = p.life = 400; G.snapCamera();
    Bot.start(1); Bot.milestones.house = 1; Bot.base = [1054, 167]; Bot.houseSpot = [1049, 168]; Bot.task = { step() {}, done: false };
    G.spawnNPC('guide', p.cx, p.cy);
    const wall = G.spawnNPC('wall_of_flesh', p.cx - 700, p.cy); wall.ai[3] = 1; wall.y = p.cy - wall.h / 2; bossAwoken('wall_of_flesh');
    for (let t = 0; t < 9000 && !wall.dead; t++) {
      Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame();
      if (p.dead) { o.push('DEAD t=' + t + ' ' + G.deathCause); break; }
      if (t % 300 === 0) o.push(`t=${t} me ${Math.round(p.life)}/${p.lifeMax} @${Bot.feet()} wall ${Math.round(wall.life)}/${wall.lifeMax} dx=${Math.round(wall.cx - p.cx)} held ${(p.inv[p.sel] || {}).id} ${Bot.goal} why ${Bot.why}`);
    }
    o.push('wall flag ' + G.world.flags.wall_of_flesh);
    return o.join('\n');
  }));
});
