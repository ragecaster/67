const run = require('./harness');
const { restore } = require('./snaplib');
run(async (page) => {
  await page.newGame('bot67');
  await restore(page, '/tmp/island.json');
  console.log(await page.evaluate(() => {
    const p = G.player, o = []; Bot.active = false; G.godMode = false;
    G.npcs = []; p.life = p.lifeMax = 500;
    p.x = 934 * TS + 6; p.y = 641 * TS - p.h; p.vx = p.vy = 0;
    for (let i = 0; i < 20; i++) { for (const k in Input.keys) Input.keys[k] = false; G.update(); }
    p.immune = 0; const x0 = p.x; p.hurt(10, -1, null, 'enemy');
    let t = 0; for (; t < 200; t++) { for (const k in Input.keys) Input.keys[k] = false; G.update(); if (t % 6 === 0 && t < 80) o.push(t + ' x=' + (p.x / 16).toFixed(1) + ' y=' + (p.y / 16).toFixed(1) + ' vx=' + p.vx.toFixed(2) + ' vy=' + p.vy.toFixed(2) + ' g=' + p.onGround); if (t > 20 && p.onGround && Math.abs(p.vx) < 0.05) break; }
    o.push('knockback travel px ' + Math.round(x0 - p.x) + ' = ' + ((x0 - p.x) / 16).toFixed(1) + ' tiles in ' + t + ' ticks');
    return o.join('\n');
  }));
});
